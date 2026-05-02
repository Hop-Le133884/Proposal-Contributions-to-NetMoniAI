# Attack Simulations — Network & Simulation Details

This README summarizes two ns-3 scenarios that are present.

---

## 1) DoS (UDP Flood) — 8 Nodes

### Network
- **Nodes:** 8 (IDs 0–7)
- **PHY/MAC:** 802.11g, AdhocWifiMac over YansWifiChannel
- **Mobility/Topology:** Static 3×3 grid (meters):  
  (0,0)=n0, (20,0)=n1, (40,0)=n2, (20,20)=n3, (0,20)=n4, (40,20)=n5, (0,40)=n6, (40,40)=n7
- **IP scheme:** 192.168.1.0/24 (node *i* → 192.168.1.(i+1))

### Simulation
- **Duration:** 0–10 s
- **Victim:** node 3 (192.168.1.4) — UDP sink on port **9000**
- **Attackers:** nodes **0, 1, 2** → continuous UDP to **n3:9000**  
  **Rate:** 5 Mbps each, **Pkt:** 256 B, **Window:** 1–9 s (On=1, Off=0)
- **Benign traffic:**  
  - n5 → n6 : **8000**, 128 B @ 1 Mbps, 2–9 s  
  - n7 → n4 : **8000**, 128 B @ 1 Mbps, 2–9 s
- **Artifacts:** `dos-simulation-animation.xml`, `dos-node-*.pcap`. :contentReference[oaicite:0]{index=0}

---

## 2) Port-Scan (TCP Connect Scan) — 20 Nodes

### Network
- **Nodes:** 20 (IDs 0–19)
- **PHY/MAC:** 802.11b, AdhocWifiMac over YansWifiChannel
- **Routing:** AODV
- **Mobility:** Random static in 50 m × 50 m
- **IP scheme:** 192.168.1.0/24 (node *i* → 192.168.1.(i+1))

### Simulation
- **Duration:** 0–30 s
- **Attackers:** nodes **0** and **1** (TCP connect attempts)
- **Victims:** nodes **17**, **18**, **19**
  - **Ground truth:** n17 opens **TCP/22**, n18 opens **TCP/25**, n19 keeps **20–25** closed
- **Scan behavior:** targets n17–n19, ports **20–25**; starts **5.0 s**; new attempt every **50 ms**  
  (Connect scan semantics: open → SYN/SYN-ACK/ACK then immediate close; closed → SYN/RST)
- **Benign traffic:** UDP echo rings among {3,4,5}, {6,7,8}, {9,10,11}, {12,13,14}, {15,16}  
  (ports 9000–9002, 1 pkt/s, 256 B)
- **Artifacts:** `port-scan.xml`, `port-scan-*.pcap`. :contentReference[oaicite:1]{index=1}
