/* -*- Mode:C++; c-file-style:"gnu"; indent-tabs-mode:nil; -*- */
#include "ns3/core-module.h"
#include "ns3/network-module.h"
#include "ns3/mobility-module.h"
#include "ns3/wifi-module.h"
#include "ns3/internet-module.h"
#include "ns3/applications-module.h"
#include "ns3/aodv-module.h"
#include "ns3/netanim-module.h"

using namespace ns3;

class PortScanApp : public Application
{
public:
  PortScanApp() = default;

  void Configure(const std::vector<Ipv4Address>& victims,
                 const std::vector<uint16_t>& ports,
                 Time start, Time interval)
  {
    m_victims = victims;
    m_ports   = ports;
    m_start   = start;
    m_step    = interval;
  }

private:
  void StartApplication() override
  {
    // schedule staggered connect attempts (connect-scan)
    Time t = m_start;
    for (auto addr : m_victims)
    {
      for (auto port : m_ports)
      {
        Simulator::Schedule(t, &PortScanApp::DoConnect, this, addr, port);
        t += m_step;
      }
    }
  }

  void StopApplication() override
  {
    for (auto &s : m_sockets)
    {
      if (s) { s->Close(); }
    }
    m_sockets.clear();
  }

  void DoConnect(Ipv4Address addr, uint16_t port)
  {
    Ptr<Socket> sock = Socket::CreateSocket(GetNode(), TcpSocketFactory::GetTypeId());
    sock->SetAttribute("TcpNoDelay", BooleanValue(true));

    // Keep sockets alive so they don't get GC'd
    m_sockets.push_back(sock);

    sock->SetConnectCallback(
      MakeCallback(&PortScanApp::OnConnectSuccess, this),
      MakeCallback(&PortScanApp::OnConnectFail, this)
    );

    sock->Connect(InetSocketAddress(addr, port));
  }

  void OnConnectSuccess(Ptr<Socket> sock)
  {
    // For a connect scan: immediately close on success (open port detected)
    sock->Close();
  }

  void OnConnectFail(Ptr<Socket> sock)
  {
    // Closed/filtered port: nothing more to do
    sock->Close();
  }

  std::vector<Ipv4Address> m_victims;
  std::vector<uint16_t>    m_ports;
  Time m_start;
  Time m_step;
  std::vector< Ptr<Socket> > m_sockets;
};

int main (int argc, char *argv[])
{
  // --- Sim config ---
  double simTime = 30.0; // seconds
  RngSeedManager::SetSeed(12345);
  RngSeedManager::SetRun(1);
  Simulator::Stop(Seconds(simTime));

  // --- Nodes ---
  NodeContainer nodes;
  nodes.Create(20);

  // --- Wi-Fi 802.11b ad-hoc ---
  WifiHelper wifi; wifi.SetStandard(WIFI_STANDARD_80211b);
  YansWifiPhyHelper phy; // note: no ::Default() on ns-3-dev
  phy.SetPcapDataLinkType(YansWifiPhyHelper::DLT_IEEE802_11_RADIO);
  YansWifiChannelHelper channel = YansWifiChannelHelper::Default();
  phy.SetChannel(channel.Create());
  WifiMacHelper mac; mac.SetType("ns3::AdhocWifiMac");
  NetDeviceContainer devices = wifi.Install(phy, mac, nodes);

  // --- Routing: AODV ---
  AodvHelper aodv;
  InternetStackHelper internet; internet.SetRoutingHelper(aodv);
  internet.Install(nodes);

  // --- IPv4 ---
  Ipv4AddressHelper ipv4;
  ipv4.SetBase("192.168.1.0", "255.255.255.0");
  Ipv4InterfaceContainer ifs = ipv4.Assign(devices);

  // --- Mobility: random static in 50x50 ---
  MobilityHelper mobility;
  mobility.SetPositionAllocator(
    "ns3::RandomRectanglePositionAllocator",
    "X", StringValue("ns3::UniformRandomVariable[Min=0.0|Max=50.0]"),
    "Y", StringValue("ns3::UniformRandomVariable[Min=0.0|Max=50.0]")
  );
  mobility.SetMobilityModel("ns3::ConstantPositionMobilityModel");
  mobility.Install(nodes);

  // --- Victims: nodes 17,18,19 —
  //     Expose a couple of open TCP ports so the scan can “find” them
  //     (others stay closed = no listener)
  // Node 17: open 22
  {
    PacketSinkHelper sink("ns3::TcpSocketFactory",
                          InetSocketAddress(Ipv4Address::GetAny(), 22));
    sink.Install(nodes.Get(17)).Start(Seconds(0.0));
  }
  // Node 18: open 25
  {
    PacketSinkHelper sink("ns3::TcpSocketFactory",
                          InetSocketAddress(Ipv4Address::GetAny(), 25));
    sink.Install(nodes.Get(18)).Start(Seconds(0.0));
  }
  // Node 19: all scanned ports closed (no sink)

  // --- Attackers: nodes 0 and 1 scan ports 20–25 on victims 17–19 ---
  std::vector<uint16_t> ports;
  for (int p = 20; p <= 25; ++p) ports.push_back(static_cast<uint16_t>(p));
  std::vector<Ipv4Address> victims = {
    ifs.GetAddress(17), ifs.GetAddress(18), ifs.GetAddress(19)
  };

  // Create and configure the scan app on each attacker
  for (uint32_t attacker : {0u, 1u})
  {
    Ptr<PortScanApp> app = CreateObject<PortScanApp>();
    nodes.Get(attacker)->AddApplication(app);
    // Start at 5s; try a new port every 50 ms
    app->Configure(victims, ports, Seconds(5.0), MilliSeconds(50));
    app->SetStartTime(Seconds(5.0));
    app->SetStopTime(Seconds(simTime));
  }

  // --- Background UDP echo groups (light load) ---
  std::vector<std::vector<uint32_t>> groups = {
    {3,4,5}, {6,7,8}, {9,10,11}, {12,13,14}, {15,16}
  };
  for (const auto &g : groups)
  {
    const size_t n = g.size();
    for (size_t i = 0; i < n; ++i)
    {
      uint32_t sender = g[i];
      uint32_t receiver = g[(i + 1) % n];
      uint16_t port = 9000 + static_cast<uint16_t>(i % 3); // 9000..9002

      UdpEchoServerHelper server(port);
      server.Install(nodes.Get(receiver)).Start(Seconds(0.0));

      UdpEchoClientHelper client(ifs.GetAddress(receiver), port);
      client.SetAttribute("MaxPackets", UintegerValue(1000));
      client.SetAttribute("Interval", TimeValue(Seconds(1.0)));
      client.SetAttribute("PacketSize", UintegerValue(256));
      client.Install(nodes.Get(sender)).Start(Seconds(0.0));
    }
  }

  // --- Tracing ---
  phy.EnablePcapAll("port-scan"); // files: port-scan-<node>.pcap

  // --- NetAnim viz ---
  AnimationInterface anim("port-scan.xml");
  for (uint32_t i = 0; i < nodes.GetN(); ++i)
  {
    if (i == 0 || i == 1) anim.UpdateNodeColor(nodes.Get(i), 255, 0, 0);     // attackers
    else if (i >= 17 && i <= 19) anim.UpdateNodeColor(nodes.Get(i), 0, 0, 255); // victims
    else anim.UpdateNodeColor(nodes.Get(i), 0, 180, 0);                      // benign
  }
  anim.EnablePacketMetadata(true);

  Simulator::Run();
  Simulator::Destroy();
  return 0;
}
