import json
import os
import asyncio
import logging
import requests
from nw_agents.SecurityAnalysisAgent import SecurityAnalysisAgent
from nw_agents.ReportingAgent import ReportingAgent
#from secretKeys import GEMINI_API_KEYS
from decimal import Decimal
import time
import datetime
from scapy.all import PcapReader
from dotenv import load_dotenv


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Rate limit constants for Gemini 2.5 Pro
REQUESTS_PER_MINUTE = 50
REQUESTS_PER_DAY = 500
DELAY_BETWEEN_REQUESTS = 1.0  # 12 seconds
MAX_RETRIES = 3
RETRY_DELAY = 10  # Initial retry delay in seconds

# Track daily requests
daily_request_count = 0
last_request_day = datetime.date.today()

def check_daily_quota():
    """Check if daily request limit has been reached."""
    global daily_request_count, last_request_day
    today = datetime.date.today()
    if today != last_request_day:
        daily_request_count = 0
        last_request_day = today
    if daily_request_count >= REQUESTS_PER_DAY:
        logger.error("Daily request limit (25) reached for Gemini 2.5 Pro. Please try again tomorrow.")
        return False
    return True

def convert_decimals(obj):
    """Convert Decimal objects to floats for JSON serialization."""
    if isinstance(obj, Decimal):
        return float(obj)
    elif isinstance(obj, dict):
        return {k: convert_decimals(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_decimals(item) for item in obj]
    else:
        return obj

def send_to_global_controller(report_data):
    """Send analysis report to the global controller."""
    url = "http://localhost:8000/gcreport"
    try:
        response = requests.post(url, json=report_data)
        if response.status_code == 200:
            logger.info(f"Report for node {report_data['node_ip']} sent successfully")
        else:
            logger.error(f"Failed to send report for node {report_data['node_ip']}: {response.status_code}")
    except Exception as e:
        logger.error(f"Error sending report for node {report_data['node_ip']}: {e}")

def extract_time_series_metrics(pcap_path, num_bins=10):
    """Extract time-series metrics from a PCAP file."""
    with PcapReader(pcap_path) as pcap:
        packets = list(pcap)
        if not packets:
            return []
        
        start_time = packets[0].time
        end_time = packets[-1].time
        total_time = end_time - start_time
        
        bin_size = total_time / num_bins if total_time > 0 else 1.0
        
        metrics = []
        current_bin_start = start_time
        packet_count = 0
        byte_count = 0
        
        for pkt in packets:
            if pkt.time >= current_bin_start + bin_size:
                metrics.append({"time": current_bin_start, "packets": packet_count, "bytes": byte_count})
                current_bin_start += bin_size
                packet_count = 0
                byte_count = 0
            packet_count += 1
            byte_count += len(pkt)

        if packet_count > 0:
            metrics.append({"time": current_bin_start, "packets": packet_count, "bytes": byte_count})
        
        return metrics

async def analyze_single_pcap_with_retry(pcap_path, security_agent):
    """Analyze a single PCAP file with retry logic for rate limit errors."""
    for attempt in range(MAX_RETRIES):
        try:
            report = await analyze_single_pcap(pcap_path, security_agent)
            return report
        except Exception as e:
            if "429" in str(e):
                wait_time = RETRY_DELAY * (2 ** attempt)
                logger.warning(f"Rate limit (429) exceeded for {pcap_path}. Retrying in {wait_time} seconds...")
                await asyncio.sleep(wait_time)
            else:
                logger.error(f"Error analyzing {pcap_path}: {e}")
                return None

    logger.error(f"Failed to analyze {pcap_path} after {MAX_RETRIES} attempts.")
    return None

async def analyze_single_pcap(pcap_path, security_agent):
    """Analyze a single PCAP file using the shared SecurityAnalysisAgent (BERT loaded once)."""
    logger.info(f"Starting analysis for {pcap_path}...")

    # Fresh queues per cycle so results don't bleed between files
    attack_queue = asyncio.Queue()
    security_to_performance_queue = asyncio.Queue()
    security_to_report_queue = asyncio.Queue()
    reports_queue = asyncio.Queue()

    # Point the shared agent at this cycle's queues
    security_agent.attack_queue = attack_queue
    security_agent.security_to_performance_queue = security_to_performance_queue
    security_agent.security_to_report_queue = security_to_report_queue

    reporting_agent = ReportingAgent(security_to_report_queue, reports_queue)
    reporting_task = asyncio.create_task(reporting_agent.run())

    await security_agent.analyze_traffic(pcap_path)

    try:
        report = await asyncio.wait_for(reports_queue.get(), timeout=150)
        logger.info(f"Finished analysis for {pcap_path}")
    except asyncio.TimeoutError:
        logger.error(f"Timeout waiting for report for {pcap_path}")
        report = None

    reporting_task.cancel()
    await asyncio.gather(reporting_task, return_exceptions=True)

    await asyncio.sleep(0.5)
    return report

async def main():
    """Main function to process PCAP files with rate limit enforcement."""
    output_dir = "segregated/segregated_pcaps14"
    pcap_files = [f for f in os.listdir(output_dir) if f.endswith(".pcap")]
    pcap_files.sort()

    if not pcap_files:
        logger.error("No .pcap files found in the directory. Exiting.")
        return

    # Load nodes_data.json to get the correct IP addresses
    with open("../frontend/public/nodes_data.json", "r") as f:
        nodes_data = json.load(f)
    node_ips = [node["id"] for node in nodes_data]

    pcap_paths = [os.path.join(output_dir, f) for f in pcap_files]

    # Initialize BERT once — shared across all PCAP files
    dummy_q = asyncio.Queue()
    security_agent = SecurityAnalysisAgent(dummy_q, dummy_q, dummy_q, dummy_q)
    logger.info("SecurityAnalysisAgent (BERT) initialized once — reusing for all files.")

    results = []
    for i, pcap_path in enumerate(pcap_paths):
        if i >= len(node_ips):
            logger.warning(f"Skipping extra PCAP file {pcap_path} due to node limit")
            break
        if not check_daily_quota():
            break

        report = await analyze_single_pcap_with_retry(pcap_path, security_agent)
        results.append(report)
        
        global daily_request_count
        daily_request_count += 1
        logger.info(f"Requests made today: {daily_request_count}/{REQUESTS_PER_DAY}")
        await asyncio.sleep(DELAY_BETWEEN_REQUESTS)
    
    logger.info("Sending results to global controller...")
    for ip, result, pcap_path in zip(node_ips, results, pcap_files):
        if result is not None:
            logger.info(f"Node {ip}: {result}")
            time_series_metrics = extract_time_series_metrics(os.path.join(output_dir, pcap_path))
            report_data = result.model_dump() if hasattr(result, 'model_dump') else result
            report_data['node_ip'] = ip  # Use the IP from nodes_data.json
            report_data['time_series_metrics'] = time_series_metrics
            report_data = convert_decimals(report_data)
            send_to_global_controller(report_data)
        else:
            logger.warning(f"Skipping node {ip} due to analysis failure")
    logger.info("Finished sending results to global controller")

if __name__ == "__main__":
    asyncio.run(main())