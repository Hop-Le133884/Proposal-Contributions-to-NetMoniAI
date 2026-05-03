import asyncio
from collections import deque
import subprocess
from config import SLIDING_WINDOW_MAXLEN, INTERFACE
import psutil
import time
import json
from utils import get_ping_metrics, get_default_gateway
from common_classes import MyDeps
import logging

logger = logging.getLogger(__name__)

class PerformanceMonitoringAgent:
    def __init__(self, metrics_queue: asyncio.Queue, performance_to_tuning_queue: asyncio.Queue,
                 tuning_to_performance_queue: asyncio.Queue, performance_to_security_queue: asyncio.Queue,
                 security_to_performance_queue: asyncio.Queue):
        self.metrics_queue = metrics_queue
        self.performance_to_tuning_queue = performance_to_tuning_queue
        self.tuning_to_performance_queue = tuning_to_performance_queue
        self.performance_to_security_queue = performance_to_security_queue
        self.security_to_performance_queue = security_to_performance_queue
        self.sliding_window = deque(maxlen=SLIDING_WINDOW_MAXLEN)
        self.latest_metrics = None
        self.deps = MyDeps(pathToFile="lastCapture/capture.pcap", duration=18, cycle_interval=1)
        self.previous_attack_detected = False
        self.last_check_time = time.time()
        self.history = []
        self.history_file = "history.json"
        self.max_history = 1000
        self.load_history()

    def load_history(self):
        """Load historical data from JSON file if it exists."""
        try:
            with open(self.history_file, "r") as f:
                self.history = json.load(f)
        except FileNotFoundError:
            self.history = []

    async def save_history(self):
        """Save the history list to a JSON file, keeping only the last max_history entries."""
        with open(self.history_file, "w") as f:
            json.dump(self.history[-self.max_history:], f)

    async def collect_metrics(self) -> None:
        """Collect network metrics and update the sliding window."""
        io_old = psutil.net_io_counters()
        router_ip = get_default_gateway() or "192.168.1.1"
        await asyncio.sleep(0.1)
        io_new = psutil.net_io_counters()
        bytes_sent = io_new.bytes_sent - io_old.bytes_sent
        bytes_recv = io_new.bytes_recv - io_old.bytes_recv
        throughput_sent = bytes_sent / 2
        throughput_recv = bytes_recv / 2
        external_ping = await get_ping_metrics("8.8.8.8")
        local_ping = await get_ping_metrics(router_ip)
        data_point = {
            "timestamp": time.ctime(),
            "bytes_sent": bytes_sent,
            "bytes_recv": bytes_recv,
            "throughput_sent": throughput_sent,
            "throughput_recv": throughput_recv,
            "external_ping": external_ping,
            "local_ping": local_ping
        }
        self.sliding_window.append(data_point)

        if self.sliding_window:
            latencies = [dp["external_ping"]["avg_latency"] for dp in self.sliding_window if dp["external_ping"]["avg_latency"] is not None]
            losses = [dp["external_ping"]["packet_loss"] for dp in self.sliding_window if dp["external_ping"]["packet_loss"] is not None]
            aggregates = {
                "avg_latency": sum(latencies) / len(latencies) if latencies else None,
                "avg_loss": sum(losses) / len(losses) if losses else None,
                "max_latency": max(latencies) if latencies else None,
                "max_loss": max(losses) if losses else None
            }
            data_point["aggregates"] = aggregates
        await self.metrics_queue.put(data_point)

    def _should_capture(self) -> bool:
        """Determine if an anomaly requires PCAP capture."""
        if not self.sliding_window:
            return False
        latencies = [dp["external_ping"]["avg_latency"] for dp in self.sliding_window if dp["external_ping"]["avg_latency"] is not None]
        losses = [dp["external_ping"]["packet_loss"] for dp in self.sliding_window if dp["external_ping"]["packet_loss"] is not None]
        if not latencies or not losses:
            return False
        avg_latency = sum(latencies) / len(latencies)
        max_latency = max(latencies)
        avg_loss = sum(losses) / len(losses)
        max_loss = max(losses)
        return (avg_latency > 75) or (max_latency > 100) or (avg_loss > 5) or (max_loss > 10)

    async def capture_pcap(self) -> None:
        """Capture network traffic using tshark."""
        logger.info(f"Capturing data for {self.deps.duration} seconds...")
        try:
            capture_result = await asyncio.to_thread(
                subprocess.run,
                ["tshark", "-i", INTERFACE, "-a", f"duration:{self.deps.duration}", "-w", self.deps.pathToFile],
                capture_output=True,
                text=True
            )
            if capture_result.returncode != 0:
                logger.error(f"Capture failed: {capture_result.stderr}")
        except Exception as e:
            logger.error(f"Error during capture: {e}")

    async def metric_collection_loop(self) -> None:
        """Periodically collect network metrics."""
        while True:
            await self.collect_metrics()
            await asyncio.sleep(2)

    async def anomaly_checking_loop(self) -> None:
        """Monitor for anomalies based on cycle interval and update history."""
        while True:
            current_time = time.time()
            if current_time - self.last_check_time >= self.deps.cycle_interval:
                self.last_check_time = current_time
                
                if hasattr(self, 'security_agent') and self.sliding_window:
                    await self.security_agent.update_metrics(self.sliding_window[-1])
                    
                if self.sliding_window:
                    latest_metrics = self.sliding_window[-1]
                    aggregates = latest_metrics["aggregates"]
                    anomaly_detected = self._should_capture()
                    
                    if anomaly_detected:
                        logger.info("Anomaly detected, coordinating with team.")
                        await self.performance_to_tuning_queue.put({
                            "metrics": latest_metrics,
                            "previous_attack_detected": self.previous_attack_detected,
                            "recent_history": self.history[-10:]
                        })
                        updated_deps = await self.tuning_to_performance_queue.get()
                        self.deps.duration = updated_deps.duration
                        self.deps.cycle_interval = updated_deps.cycle_interval
                        await self.capture_pcap()
                        await self.performance_to_security_queue.put(self.deps.pathToFile)
                        analysis_result = await self.security_to_performance_queue.get()
                        self.previous_attack_detected = analysis_result.attack_detected
                        attack_detected = analysis_result.attack_detected
                    else:
                        attack_detected = None
                    
                    history_entry = {
                        "timestamp": latest_metrics["timestamp"],
                        "avg_latency": aggregates["avg_latency"],
                        "avg_loss": aggregates["avg_loss"],
                        "anomaly_detected": anomaly_detected,
                        "attack_detected": attack_detected
                    }
                    self.history.append(history_entry)
                    await self.save_history()
                    
                    self.latest_metrics = self.sliding_window[-1]
                    self.sliding_window.clear()
            await asyncio.sleep(1)

    async def run(self) -> None:
        """Execute metric collection and anomaly checking concurrently."""
        await asyncio.gather(
            self.metric_collection_loop(),
            self.anomaly_checking_loop()
        )