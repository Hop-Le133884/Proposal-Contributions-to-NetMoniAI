import asyncio
import subprocess
import netifaces
import sys
import re

async def get_ping_metrics(host: str, count: int = 4, timeout: int = 2) -> dict:
    """Retrieve ping metrics asynchronously."""
    cmd = ["ping", "-n" if sys.platform.startswith("win") else "-c", str(count),
           "-w" if sys.platform.startswith("win") else "-W", str(timeout * 1000 if sys.platform.startswith("win") else timeout), host]
    try:
        output = await asyncio.to_thread(subprocess.check_output, cmd, stderr=subprocess.STDOUT, universal_newlines=True)
        loss_match = re.search(r"(\d+)% (packet )?loss", output)
        packet_loss = float(loss_match.group(1)) if loss_match else None
        avg_match = re.search(r"Average = (\d+)ms|min/avg/max[^=]+ = [\d\.]+/([\d\.]+)/", output)
        avg_latency = float(avg_match.group(1) or avg_match.group(2)) if avg_match else None
        return {"packet_loss": packet_loss, "avg_latency": avg_latency}
    except subprocess.CalledProcessError:
        return {"packet_loss": None, "avg_latency": None}

def get_default_gateway() -> str:
    """Retrieve the default gateway IP address."""
    try:
        gateways = netifaces.gateways()
        return gateways['default'][netifaces.AF_INET][0]
    except Exception:
        return None