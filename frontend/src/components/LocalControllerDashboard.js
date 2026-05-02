import React, { useState, useEffect, useRef } from "react";
import ApexCharts from "react-apexcharts";
import "../App.css";
import Chatbot from "./chatbot";

const colors = [
  "#FF5733",
  "#33FF57",
  "#3357FF",
  "#FF33A1",
  "#A133FF",
  "#33FFA1",
  "#FFA133",
];

const metricBins = {
  "Bytes Sent": [100, 500],
  "Bytes Received": [100, 500],
  "Throughput Sent": [100, 500],
  "Throughput Received": [100, 500],
  "External Latency": [50, 100],
  "Local Latency": [50, 100],
};

const thresholds = {
  "External Latency": { avg: 75, max: 100 },
  "Local Latency": { avg: 75, max: 100 },
  "External Packet Loss": { avg: 0.05, max: 0.1 },
};

const Dashboard = () => {
  // State for metrics data
  const [metricsData, setMetricsData] = useState({
    bytesSentData: [],
    bytesRecvData: [],
    throughputSentData: [],
    throughputRecvData: [],
    externalLatencyData: [],
    externalPacketLossData: [],
    localLatencyData: [],
  });

  // State for attack detection
  const [attackDetection, setAttackDetection] = useState(null);

  // State for connection status
  const [connectionStatus, setConnectionStatus] = useState("Connecting...");

  // State for active tab
  const [activeTab, setActiveTab] = useState("line");

  // State for chat messages
  const [chatMessages, setChatMessages] = useState([
    {
      sender: "bot",
      text: "Hello! How can I assist you with the network monitoring?",
    },
  ]);

  // Ref for WebSocket
  const wsRef = useRef(null);

  // Ref for retry count
  const retryCountRef = useRef(0);

  // Function to add a new chat message
  const addChatMessage = (message) => {
    setChatMessages((prev) => [...prev, message]);
  };

  // Function to send a chat message via WebSocket
  const sendChatMessage = (text) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "chat", message: text }));
    } else {
      addChatMessage({
        sender: "bot",
        text: "Error: Not connected to the server.",
      });
    }
  };

  // WebSocket connection function with re-establishment
  const connectWebSocket = () => {
    const ws = new WebSocket("ws://localhost:8000/ws");
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("WebSocket connection established");
      setConnectionStatus("Connected");
      retryCountRef.current = 0;
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === "metrics") {
        const newMetric = message.data;
        const maxPoints = 100;
        setMetricsData((prevData) => ({
          bytesSentData: [
            ...prevData.bytesSentData,
            {
              x: new Date(newMetric.timestamp).getTime(),
              y: newMetric.bytes_sent,
            },
          ].slice(-maxPoints),
          bytesRecvData: [
            ...prevData.bytesRecvData,
            {
              x: new Date(newMetric.timestamp).getTime(),
              y: newMetric.bytes_recv,
            },
          ].slice(-maxPoints),
          throughputSentData: [
            ...prevData.throughputSentData,
            {
              x: new Date(newMetric.timestamp).getTime(),
              y: newMetric.throughput_sent,
            },
          ].slice(-maxPoints),
          throughputRecvData: [
            ...prevData.throughputRecvData,
            {
              x: new Date(newMetric.timestamp).getTime(),
              y: newMetric.throughput_recv,
            },
          ].slice(-maxPoints),
          externalLatencyData: [
            ...prevData.externalLatencyData,
            {
              x: new Date(newMetric.timestamp).getTime(),
              y: newMetric.external_ping.avg_latency,
            },
          ].slice(-maxPoints),
          externalPacketLossData: [
            ...prevData.externalPacketLossData,
            {
              x: new Date(newMetric.timestamp).getTime(),
              y: newMetric.external_ping.packet_loss,
            },
          ].slice(-maxPoints),
          localLatencyData: [
            ...prevData.localLatencyData,
            {
              x: new Date(newMetric.timestamp).getTime(),
              y: newMetric.local_ping.avg_latency,
            },
          ].slice(-maxPoints),
        }));
      } else if (message.type === "attack_detection") {
        setAttackDetection(message.data);
      } else if (message.type === "chat_response") {
        addChatMessage({ sender: "bot", text: message.data });
      }
    };

    ws.onclose = () => {
      console.log("WebSocket connection closed");
      setConnectionStatus("Disconnected");
      const retryDelay = Math.min(1000 * 2 ** retryCountRef.current, 30000);
      setTimeout(() => {
        retryCountRef.current += 1;
        connectWebSocket();
      }, retryDelay);
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      setConnectionStatus("Error");
    };
  };

  // Initialize WebSocket on mount
  useEffect(() => {
    connectWebSocket();
    return () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
    };
  }, []);

  // Define metrics array
  const metrics = [
    { name: "Bytes Sent", data: metricsData.bytesSentData, unit: "bytes" },
    { name: "Bytes Received", data: metricsData.bytesRecvData, unit: "bytes" },
    {
      name: "Throughput Sent",
      data: metricsData.throughputSentData,
      unit: "B/s",
    },
    {
      name: "Throughput Received",
      data: metricsData.throughputRecvData,
      unit: "B/s",
    },
    {
      name: "External Latency",
      data: metricsData.externalLatencyData,
      unit: "ms",
    },
    {
      name: "External Packet Loss",
      data: metricsData.externalPacketLossData,
      unit: "%",
    },
    { name: "Local Latency", data: metricsData.localLatencyData, unit: "ms" },
  ];

  // Aggregate data for bar charts
  const aggregateData = (data, intervalMinutes = 5) => {
    if (data.length === 0) return [];
    const intervalMs = intervalMinutes * 60 * 1000;
    const aggregated = {};
    data.forEach((point) => {
      const intervalStart = Math.floor(point.x / intervalMs) * intervalMs;
      if (!aggregated[intervalStart]) {
        aggregated[intervalStart] = { sum: 0, count: 0 };
      }
      aggregated[intervalStart].sum += point.y;
      aggregated[intervalStart].count += 1;
    });
    return Object.entries(aggregated).map(([time, { sum, count }]) => ({
      x: Number(time),
      y: sum / count,
    }));
  };

  // Get pie chart data and check threshold exceedance
  const getPieChartData = (metricName, data) => {
    if (data.length === 0) return { series: [], labels: [], exceeded: false };
    if (metricName === "External Packet Loss") {
      const noLoss = data.filter((d) => d.y === 0).length;
      const loss = data.length - noLoss;
      const latestValue = data[data.length - 1]?.y || 0;
      const threshold = thresholds[metricName];
      const exceeded =
        threshold &&
        (latestValue > threshold.avg || latestValue > threshold.max);
      return {
        series: [(noLoss / data.length) * 100, (loss / data.length) * 100],
        labels: ["No Loss", "Loss"],
        exceeded,
      };
    } else {
      const bins = metricBins[metricName] || [100, 500];
      const low = data.filter((d) => d.y < bins[0]).length;
      const medium = data.filter((d) => d.y >= bins[0] && d.y < bins[1]).length;
      const high = data.filter((d) => d.y >= bins[1]).length;
      const total = data.length;
      const latestValue = data[data.length - 1]?.y || 0;
      const threshold = thresholds[metricName];
      const exceeded =
        threshold &&
        (latestValue > threshold.avg || latestValue > threshold.max);
      return {
        series: [
          (low / total) * 100,
          (medium / total) * 100,
          (high / total) * 100,
        ],
        labels: [
          `Low (<${bins[0]})`,
          `Medium (${bins[0]}-${bins[1]})`,
          `High (>${bins[1]})`,
        ],
        exceeded,
      };
    }
  };

  // Chart options with threshold lines
  const lineChartOptions = (title, yAxisLabel, color, threshold) => {
    const options = {
      chart: {
        type: "line",
        height: 300,
        animations: { enabled: true, easing: "linear" },
      },
      xaxis: { type: "datetime", labels: { style: { fontSize: "14px" } } },
      yaxis: {
        title: { text: yAxisLabel },
        labels: {
          style: { fontSize: "14px" },
          formatter: (value) =>
            title === "External Packet Loss"
              ? `${(value * 100).toFixed(2)}%`
              : value.toFixed(2),
        },
        ...(title === "External Packet Loss" ? { min: 0, max: 1 } : {}),
      },
      title: {
        text: title,
        align: "center",
        style: { fontSize: "18px", fontWeight: "bold" },
      },
      stroke: { width: 2, curve: "smooth" },
      colors: [color],
      tooltip: { x: { format: "HH:mm:ss" } },
    };
    if (threshold) {
      const isPacketLoss = title === "External Packet Loss";
      options.annotations = {
        yaxis: [
          {
            y: threshold.avg,
            borderColor: "#FF0000",
            label: {
              borderColor: "#FF0000",
              style: { color: "#fff", background: "#FF0000" },
              text: `Avg Threshold: ${
                isPacketLoss
                  ? (threshold.avg * 100).toFixed(0) + "%"
                  : threshold.avg + " " + yAxisLabel
              }`,
            },
          },
          {
            y: threshold.max,
            borderColor: "#FF00FF",
            label: {
              borderColor: "#FF00FF",
              style: { color: "#fff", background: "#FF00FF" },
              text: `Max Threshold: ${
                isPacketLoss
                  ? (threshold.max * 100).toFixed(0) + "%"
                  : threshold.max + " " + yAxisLabel
              }`,
            },
          },
        ],
      };
    }
    return options;
  };

  const barChartOptions = (title, yAxisLabel, threshold) => {
    const options = {
      chart: { type: "bar", height: 300 },
      xaxis: { type: "datetime", labels: { style: { fontSize: "14px" } } },
      yaxis: {
        title: { text: yAxisLabel },
        labels: { style: { fontSize: "14px" } },
      },
      title: {
        text: title,
        align: "center",
        style: { fontSize: "18px", fontWeight: "bold" },
      },
      plotOptions: { bar: { horizontal: false } },
      colors: [colors[0]],
      tooltip: { x: { format: "HH:mm:ss" } },
    };
    if (threshold) {
      const isPacketLoss = title.includes("Packet Loss");
      options.annotations = {
        yaxis: [
          {
            y: threshold.avg,
            borderColor: "#FF0000",
            label: {
              borderColor: "#FF0000",
              style: { color: "#fff", background: "#FF0000" },
              text: `Avg Threshold: ${
                isPacketLoss
                  ? (threshold.avg * 100).toFixed(0) + "%"
                  : threshold.avg + " " + yAxisLabel
              }`,
            },
          },
          {
            y: threshold.max,
            borderColor: "#FF00FF",
            label: {
              borderColor: "#FF00FF",
              style: { color: "#fff", background: "#FF00FF" },
              text: `Max Threshold: ${
                isPacketLoss
                  ? (threshold.max * 100).toFixed(0) + "%"
                  : threshold.max + " " + yAxisLabel
              }`,
            },
          },
        ],
      };
    }
    return options;
  };

  const pieChartOptions = (title, labels) => ({
    chart: { type: "pie", height: 300 },
    labels,
    title: {
      text: title,
      align: "center",
      style: { fontSize: "18px", fontWeight: "bold" },
    },
    colors: colors.slice(0, labels.length),
  });

  return (
    <div className="app">
      <h1>Network Monitoring Dashboard</h1>
      <div className={`connection-status ${connectionStatus.toLowerCase()}`}>
        Connection Status: {connectionStatus}
      </div>
      <div
        className={`attack-status ${
          attackDetection
            ? attackDetection.attack_detected
              ? "detected"
              : "no-attack"
            : "waiting"
        }`}
      >
        {attackDetection
          ? attackDetection.attack_detected
            ? `Attack Detected: ${attackDetection.details}`
            : `No Attack Detected: ${attackDetection.details}`
          : "Waiting for attack detection..."}
      </div>
      <div className="tabs">
        <button
          className={activeTab === "line" ? "active" : ""}
          onClick={() => setActiveTab("line")}
        >
          Line Charts
        </button>
        <button
          className={activeTab === "bar" ? "active" : ""}
          onClick={() => setActiveTab("bar")}
        >
          Bar Graphs
        </button>
        <button
          className={activeTab === "pie" ? "active" : ""}
          onClick={() => setActiveTab("pie")}
        >
          Pie Charts
        </button>
      </div>
      <div className="chart-grid">
        {activeTab === "line" &&
          metrics.map((metric, index) => {
            const threshold = thresholds[metric.name];
            const latestValue =
              metric.data.length > 0
                ? metric.data[metric.data.length - 1].y
                : null;
            const exceeded =
              threshold &&
              latestValue !== null &&
              (latestValue > threshold.avg || latestValue > threshold.max);
            return (
              <div
                key={index}
                className={`chart-container ${
                  exceeded ? "exceeded-threshold" : ""
                }`}
              >
                <ApexCharts
                  options={lineChartOptions(
                    metric.name,
                    metric.unit,
                    colors[index % colors.length],
                    threshold
                  )}
                  series={[{ name: metric.name, data: metric.data }]}
                  type="line"
                  height={300}
                />
                {exceeded && (
                  <div className="threshold-alert">Threshold exceeded!</div>
                )}
              </div>
            );
          })}
        {activeTab === "bar" &&
          metrics.map((metric, index) => {
            const aggregatedData = aggregateData(metric.data);
            const threshold = thresholds[metric.name];
            const latestBarValue =
              aggregatedData.length > 0
                ? aggregatedData[aggregatedData.length - 1].y
                : null;
            const exceeded =
              threshold &&
              latestBarValue !== null &&
              (latestBarValue > threshold.avg ||
                latestBarValue > threshold.max);
            return (
              <div
                key={index}
                className={`chart-container ${
                  exceeded ? "exceeded-threshold" : ""
                }`}
              >
                <ApexCharts
                  options={barChartOptions(
                    `Average ${metric.name} per 5-min`,
                    metric.unit,
                    threshold
                  )}
                  series={[{ name: metric.name, data: aggregatedData }]}
                  type="bar"
                  height={300}
                />
                {exceeded && (
                  <div className="threshold-alert">Threshold exceeded!</div>
                )}
              </div>
            );
          })}
        {activeTab === "pie" &&
          metrics.map((metric, index) => {
            const { series, labels, exceeded } = getPieChartData(
              metric.name,
              metric.data
            );
            if (series.length === 0) return null;
            return (
              <div
                key={index}
                className={`chart-container ${
                  exceeded ? "exceeded-threshold" : ""
                }`}
              >
                <ApexCharts
                  options={pieChartOptions(
                    `${metric.name} Distribution`,
                    labels
                  )}
                  series={series}
                  type="pie"
                  height={300}
                />
                {exceeded && (
                  <div className="threshold-alert">Threshold exceeded!</div>
                )}
              </div>
            );
          })}
      </div>
      <Chatbot
        chatMessages={chatMessages}
        addChatMessage={addChatMessage}
        sendChatMessage={sendChatMessage}
      />
    </div>
  );
};

export default Dashboard;
