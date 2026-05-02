import asyncio
import logging
import torch
from transformers import pipeline
import os
from dotenv import load_dotenv
from tools.pcap_analyzer import analyze_pcap_summary
from scapy.all import rdpcap


load_dotenv()
logger = logging.getLogger(__name__)

class SecurityAnalysisAgent:
    def __init__(self, performance_to_security_queue: asyncio.Queue, 
                 security_to_performance_queue: asyncio.Queue, 
                 attack_queue: asyncio.Queue,
                 security_to_report_queue: asyncio.Queue,
                 api_key: str = None):
        
        # 1. Initialize queues required by app.py
        self.performance_to_security_queue = performance_to_security_queue
        self.security_to_performance_queue = security_to_performance_queue
        self.attack_queue = attack_queue
        self.security_to_report_queue = security_to_report_queue
        self.latest_metrics = None
        self.api_key = api_key

        # 2. Detect your NVIDIA RTX 3050
        self.device = 0 if torch.cuda.is_available() else -1
        self.device_name = torch.cuda.get_device_name(0) if self.device == 0 else "CPU"
        
        print(f"[*] Initializing SecurityAnalysisAgent on {self.device_name}")
        
        # 3. Load the network-specialized BERT model into VRAM
        self.classifier = pipeline(
            "text-classification", 
            model="rdpahalavan/bert-network-packet-flow-header-payload",
            device=self.device
        )

    async def analyze_traffic(self, pcap_path: str):
        try:
            # 1. Read the raw packets (we only need the first 5-10 to see the pattern)
            packets = await asyncio.to_thread(rdpcap, pcap_path, count=10)
            
            # 2. Extract the raw hex/payload BERT actually understands
            # This joins the hex representation of the first few packets
            hex_data = []
            for pkt in packets:
                if pkt.haslayer('TCP'):
                    # BERT models for networking usually look at the hex-string 
                    hex_data.append(bytes(pkt).hex()[:100]) # Take first 100 chars of each packet
            
            packet_summary = " ".join(hex_data)

            # 3. Run BERT on the raw hex data
            result = await asyncio.to_thread(self.classifier, packet_summary)
            result = result[0]
            
            label = result['label']
            score = result['score']

            # Proposal 1: Classify BERT confidence into three tiers
            #   high   (≥90%): BERT very certain → brief cloud prompt, fast response
            #   medium (70–89%): uncertain → full cloud analysis
            #   low    (<70% or Normal): no attack → local report, zero API cost
            attack_detected = score > 0.7 and label != "Normal"
            if score >= 0.90 and attack_detected:
                confidence_tier = "high"
            elif score >= 0.70 and attack_detected:
                confidence_tier = "medium"
            else:
                confidence_tier = "low"

            analysis_report = {
                "node_status": "alert" if attack_detected else "clear",
                "detected_threat": label,
                "confidence": score,
                "engine": "Local-BERT-GPU",
                "confidence_tier": confidence_tier,
                "raw_summary": packet_summary,
                "raw_bert_output": {label: score}
            }

            logger.info(
                f"[BERT] label={label} score={score:.2%} → tier={confidence_tier.upper()}"
            )

            # Map the BERT results to the expected attack_data dictionary format
            attack_data = {
                "attack_detected": attack_detected,
                "details": f"BERT detected {label} with {score:.2%} confidence",
                "raw_bert_output": analysis_report["raw_bert_output"],
                "confidence_tier": confidence_tier,
            }

            # Put the results in the queues for the next agents
            await self.attack_queue.put(attack_data)
            await self.security_to_performance_queue.put(analysis_report)

            # Package metrics for the ReportingAgent
            metrics_data = self.latest_metrics if self.latest_metrics else {}
            if metrics_data and "aggregates" in metrics_data:
                metrics_data["latency"] = metrics_data["aggregates"].get("avg_latency")
                metrics_data["packet_loss"] = metrics_data["aggregates"].get("avg_loss")
            
            await self.security_to_report_queue.put({
                "attack_data": attack_data,
                "metrics_data": metrics_data,
                "pcap_path": pcap_path
            })

        except Exception as e:
            logger.error(f"Error during BERT analysis: {e}")

    async def update_metrics(self, metrics):
        """Stores metrics history from the performance agent."""
        self.latest_metrics = metrics

    async def run(self) -> None:
        """The main async loop required by app.py to process the queue."""
        while True:
            pcap_path = await self.performance_to_security_queue.get()
            await self.analyze_traffic(pcap_path)