/* -*- Mode:C++; c-file-style:"gnu"; indent-tabs-mode:nil; -*- */
#include "ns3/core-module.h"
#include "ns3/network-module.h"
#include "ns3/mobility-module.h"
#include "ns3/wifi-module.h"
#include "ns3/internet-module.h"
#include "ns3/applications-module.h"
#include "ns3/netanim-module.h"

using namespace ns3;

int main (int argc, char *argv[])
{
  // Optional: reproducible RNG
  // RngSeedManager::SetSeed(12345);
  // RngSeedManager::SetRun(1);

  // 1) Nodes
  NodeContainer nodes; 
  nodes.Create (8);

  // 2) Wi-Fi (ad-hoc)
  WifiHelper wifi; 
  wifi.SetStandard (WIFI_STANDARD_80211g);

  // NOTE: YansWifiPhyHelper::Default() is not available on current ns-3-dev.
  // Use a direct constructor instead.
  YansWifiPhyHelper phy; 
  YansWifiChannelHelper channel = YansWifiChannelHelper::Default ();
  phy.SetChannel (channel.Create ());

  WifiMacHelper mac;
  mac.SetType ("ns3::AdhocWifiMac");
  NetDeviceContainer devices = wifi.Install (phy, mac, nodes);

  // 3) Positions — exact 0/20/40 grid from your capture
  Ptr<ListPositionAllocator> pos = CreateObject<ListPositionAllocator> ();
  pos->Add (Vector ( 0,  0, 0));   // node 0 -> 192.168.1.1
  pos->Add (Vector (20,  0, 0));   // node 1 -> 192.168.1.2
  pos->Add (Vector (40,  0, 0));   // node 2 -> 192.168.1.3
  pos->Add (Vector (20, 20, 0));   // node 3 -> 192.168.1.4 (victim)
  pos->Add (Vector ( 0, 20, 0));   // node 4 -> 192.168.1.5
  pos->Add (Vector (40, 20, 0));   // node 5 -> 192.168.1.6
  pos->Add (Vector ( 0, 40, 0));   // node 6 -> 192.168.1.7
  pos->Add (Vector (40, 40, 0));   // node 7 -> 192.168.1.8
  MobilityHelper mobility;
  mobility.SetPositionAllocator (pos);
  mobility.SetMobilityModel ("ns3::ConstantPositionMobilityModel");
  mobility.Install (nodes);

  // 4) Internet stack & IPv4 addresses
  InternetStackHelper stack; 
  stack.Install (nodes);
  Ipv4AddressHelper ipv4;
  ipv4.SetBase ("192.168.1.0", "255.255.255.0");
  Ipv4InterfaceContainer ifs = ipv4.Assign (devices);

  // 5) Main victim sink: node 3, UDP :9000 (0–10 s)
  const uint16_t mainPort = 9000;
  PacketSinkHelper sink9000 ("ns3::UdpSocketFactory",
                             InetSocketAddress (Ipv4Address::GetAny (), mainPort));
  ApplicationContainer sinkApp = sink9000.Install (nodes.Get (3));
  sinkApp.Start (Seconds (0.0));
  sinkApp.Stop  (Seconds (10.0));

  // 6) Attackers: nodes 0–2 -> node 3:9000, 256 B @ 5 Mbps (1–9 s)
  OnOffHelper flood9000 ("ns3::UdpSocketFactory",
                         Address (InetSocketAddress (ifs.GetAddress (3), mainPort)));
  flood9000.SetAttribute ("PacketSize", UintegerValue (256));
  flood9000.SetAttribute ("DataRate",   DataRateValue (DataRate ("5Mbps")));
  flood9000.SetAttribute ("OnTime",  StringValue ("ns3::ConstantRandomVariable[Constant=1]"));
  flood9000.SetAttribute ("OffTime", StringValue ("ns3::ConstantRandomVariable[Constant=0]"));
  for (uint32_t i = 0; i < 3; ++i)
  {
    ApplicationContainer apps = flood9000.Install (nodes.Get (i));
    apps.Start (Seconds (1.0));
    apps.Stop  (Seconds (9.0));
  }

  // 7) Aux UDP flows: :8000, 128 B (2–9 s)
  const uint16_t auxPort = 8000;
  PacketSinkHelper sink8000 ("ns3::UdpSocketFactory",
                             InetSocketAddress (Ipv4Address::GetAny (), auxPort));
  ApplicationContainer auxSinks;
  auxSinks.Add (sink8000.Install (nodes.Get (6))); // 192.168.1.7
  auxSinks.Add (sink8000.Install (nodes.Get (4))); // 192.168.1.5
  auxSinks.Start (Seconds (0.0));
  auxSinks.Stop  (Seconds (10.0));

  // Flow A: 192.168.1.6 (node 5) -> 192.168.1.7 (node 6) :8000
  OnOffHelper on8000A ("ns3::UdpSocketFactory",
                       Address (InetSocketAddress (ifs.GetAddress (6), auxPort)));
  on8000A.SetAttribute ("PacketSize", UintegerValue (128));
  on8000A.SetAttribute ("DataRate",   DataRateValue (DataRate ("1Mbps")));
  on8000A.SetAttribute ("OnTime",  StringValue ("ns3::ConstantRandomVariable[Constant=1]"));
  on8000A.SetAttribute ("OffTime", StringValue ("ns3::ConstantRandomVariable[Constant=0]"));
  ApplicationContainer aA = on8000A.Install (nodes.Get (5));
  aA.Start (Seconds (2.0));
  aA.Stop  (Seconds (9.0));

  // Flow B: 192.168.1.8 (node 7) -> 192.168.1.5 (node 4) :8000
  OnOffHelper on8000B ("ns3::UdpSocketFactory",
                       Address (InetSocketAddress (ifs.GetAddress (4), auxPort)));
  on8000B.SetAttribute ("PacketSize", UintegerValue (128));
  on8000B.SetAttribute ("DataRate",   DataRateValue (DataRate ("1Mbps")));
  on8000B.SetAttribute ("OnTime",  StringValue ("ns3::ConstantRandomVariable[Constant=1]"));
  on8000B.SetAttribute ("OffTime", StringValue ("ns3::ConstantRandomVariable[Constant=0]"));
  ApplicationContainer aB = on8000B.Install (nodes.Get (7));
  aB.Start (Seconds (2.0));
  aB.Stop  (Seconds (9.0));

  // 8) Optional: pcap capture per node (non-promiscuous)
  for (uint32_t i = 0; i < nodes.GetN (); ++i)
  {
    phy.EnablePcap ("dos-node-" + std::to_string (i), devices.Get (i), false);
  }

  // 9) NetAnim output — same name as your capture, with metadata
  AnimationInterface anim ("dos-simulation-animation.xml");
  anim.EnablePacketMetadata (true);

  // 10) Run
  Simulator::Stop (Seconds (10.0));
  Simulator::Run ();
  Simulator::Destroy ();
  return 0;
}
