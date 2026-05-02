from scapy.all import PcapReader, IP, TCP, UDP
from collections import Counter
import logging

logger = logging.getLogger(__name__)

def analyze_pcap_summary(pcap_path):
    """Create a summary of PCAP file contents for reporting."""
    try:
        ip_counter = Counter()
        port_counter = Counter()
        protocol_counter = Counter()
        packet_sizes = []
        unusual_ports = []
        unusual_protocols = []
        total_packets = 0
        
        with PcapReader(pcap_path) as pcap:
            for packet in pcap:
                total_packets += 1
                
                if IP in packet:
                    ip_src = packet[IP].src
                    ip_dst = packet[IP].dst
                    ip_counter[ip_src] += 1
                    ip_counter[ip_dst] += 1
                    
                    packet_sizes.append(len(packet))
                    
                    if TCP in packet:
                        protocol_counter['TCP'] += 1
                        port_counter[packet[TCP].sport] += 1
                        port_counter[packet[TCP].dport] += 1
                        
                        # Check for unusual ports
                        if packet[TCP].dport not in [80, 443, 22, 53] and packet[TCP].dport > 1024:
                            unusual_ports.append(packet[TCP].dport)
                            
                    elif UDP in packet:
                        protocol_counter['UDP'] += 1
                        port_counter[packet[UDP].sport] += 1
                        port_counter[packet[UDP].dport] += 1
                    else:
                        protocol = packet[IP].proto
                        protocol_counter[f'IP-{protocol}'] += 1
                        if protocol not in [6, 17]:  # TCP, UDP
                            unusual_protocols.append(protocol)
        
        # Generate summary
        top_ips = [f"{ip} ({count} packets)" for ip, count in ip_counter.most_common(5)]
        top_ports = [f"Port {port} ({count} packets)" for port, count in port_counter.most_common(5)]
        protocol_summary = [f"{proto} ({count} packets)" for proto, count in protocol_counter.most_common()]
        
        avg_packet_size = sum(packet_sizes) / len(packet_sizes) if packet_sizes else 0
        
        return {
            "total_packets": total_packets,
            "top_ips": top_ips,
            "top_ports": top_ports,
            "protocols": protocol_summary,
            "avg_packet_size": avg_packet_size,
            "unusual_ports": list(set(unusual_ports))[:10],
            "unusual_protocols": list(set(unusual_protocols)),
        }
    except Exception as e:
        logger.error(f"Error analyzing PCAP: {e}")
        return {"error": f"Failed to analyze PCAP: {str(e)}"}