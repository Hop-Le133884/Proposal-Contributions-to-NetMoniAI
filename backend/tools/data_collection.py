import subprocess

# INTERFACE = "Wi-Fi"  # Network interface for capture
INTERFACE = "en0"
OUTPUT_FILE = "lastCapture/capture.pcap"

def collect_data_func(duration):
    """Capture network data using tshark."""
    cmd = ["tshark", "-i", INTERFACE, "-a", f"duration:{duration}", "-w", OUTPUT_FILE]
    subprocess.run(cmd)