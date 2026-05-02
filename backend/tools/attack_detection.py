import torch
import os
import sys
from scapy.all import PcapReader, IP, TCP, UDP
from transformers import AutoTokenizer, AutoModelForSequenceClassification
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, backend_dir)
from secretKeys import *

class PcapClassifier:
    def __init__(self, model_name="rdpahalavan/bert-network-packet-flow-header-payload"):
        self.classes = [
            'Backdoor', 'Bot', 'DDoS', 'DoS', 'DoS GoldenEye', 'DoS Hulk',
            'DoS SlowHTTPTest', 'DoS Slowloris', 'Exploits', 'FTP Patator', 'Fuzzers',
            'Generic', 'Heartbleed', 'Infiltration', 'Normal', 'Port Scan', 'Reconnaissance',
            'SSH Patator', 'Shellcode', 'Web Attack - Brute Force', 'Web Attack - SQL Injection',
            'Web Attack - XSS', 'Worms'
        ]
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        self.model = AutoModelForSequenceClassification.from_pretrained(model_name)

    def processing_packet_conversion(self, packet):
        """Convert packet data into a feature string for classification."""
        if IP not in packet or TCP not in packet:
            return None
        try:
            src_port = packet.sport
            dst_port = packet.dport
            ip_length = len(packet[IP])
            ip_ttl = packet[IP].ttl
            ip_tos = packet[IP].tos
            tcp_data_offset = packet[TCP].dataofs
            tcp_flags = packet[TCP].flags
            payload_bytes = bytes(packet.payload)
            payload_length = len(payload_bytes)
            payload_decimal = ' '.join(str(byte) for byte in payload_bytes)
            return f"0 0 195 -1 {src_port} {dst_port} {ip_length} {payload_length} {ip_ttl} {ip_tos} {tcp_data_offset} -1 {payload_decimal}"
        except Exception:
            return None

    def classify_pcap(self, file_path, filter=b"HTTP"):
        """Classify packets in a PCAP file and return attack type counts."""
        packets_brief = {}
        with PcapReader(file_path) as pcap:
            for pkt in pcap:
                input_line = self.processing_packet_conversion(pkt)
                if input_line:
                    truncated_line = input_line[:1024]
                    tokens = self.tokenizer(truncated_line, return_tensors="pt")
                    outputs = self.model(**tokens)
                    probabilities = outputs.logits.softmax(dim=1)
                    predicted_class = torch.argmax(probabilities, dim=1).item()
                    predicted_attack = self.classes[predicted_class]
                    packets_brief[predicted_attack] = packets_brief.get(predicted_attack, 0) + 1
        return packets_brief

def detect_attack_func(path):
    """Detect attacks in a PCAP file."""
    print(f"Path: {path}")
    classifier = PcapClassifier()
    results = classifier.classify_pcap(path)
    print(results)
    return str(results)

# detect_attack_func("/Users/thanikella_nikhil/Downloads/tcp-ddos-victim-0-0.pcap")