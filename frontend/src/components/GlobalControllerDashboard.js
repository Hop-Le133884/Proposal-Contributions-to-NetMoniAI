//current stable and working code

// import React, { useEffect, useState, useRef } from "react";
// import ApexCharts from "react-apexcharts";
// import { getNodeStatuses } from "../apiService.js";
// import "../GlobalControllerDashboard.css";
// import NetworkVisualizer from "./NetworkVisualizer";
// import GlobalChatbot from "./GlobalChatbot";

// // MetricChart component
// const MetricChart = ({ metrics, title, yLabel, color, valueKey }) => {
//   if (!Array.isArray(metrics) || metrics.length === 0) return <p>No data available.</p>;
//   const data = metrics
//     .map((m) => ({ x: Number(m.time) * 1000, y: Number(m[valueKey]) }))
//     .filter((d) => !isNaN(d.x) && !isNaN(d.y));
//   if (data.length < 2) return <p>Insufficient data points to display graph.</p>;

//   const sortedData = data.sort((a, b) => a.x - b.x);
//   const minX = sortedData[0].x;
//   const maxX = sortedData[sortedData.length - 1].x;

//   const options = {
//     chart: { type: "line", height: 300, animations: { enabled: true, easing: "linear" } },
//     xaxis: { type: "datetime", min: minX, max: maxX, labels: { style: { fontSize: "14px" } } },
//     yaxis: { title: { text: yLabel }, labels: { style: { fontSize: "14px" }, formatter: (value) => value.toFixed(2) } },
//     title: { text: title, align: "center", style: { fontSize: "18px", fontWeight: "bold" } },
//     stroke: { width: 2, curve: "smooth" },
//     colors: [color],
//     tooltip: { y: { formatter: (value) => value.toFixed(2) }, x: { format: "HH:mm:ss.SSS" } },
//   };

//   return <ApexCharts options={options} series={[{ name: title, data: sortedData }]} type="line" height={300} />;
// };

// const GlobalControllerDashboard = () => {
//   const [nodes, setNodes] = useState({});
//   const [error, setError] = useState(null);
//   const [loading, setLoading] = useState(true);
//   const [lastUpdated, setLastUpdated] = useState(null);
//   const [selectedNode, setSelectedNode] = useState(null);
//   const [activePanel, setActivePanel] = useState(null);

//   const [globalChatMessages, setGlobalChatMessages] = useState([{ sender: "bot", text: "Hello! How can I assist you with the Central Controller Dashboard?" }]);
//   const wsRef = useRef(null);
//   const retryCountRef = useRef(0);

//   const colors = ["#FF5733", "#33FF57", "#3357FF", "#FF33A1", "#A133FF", "#33FFA1", "#FFA133", "#FF5733", "#33FF57"];

//   const fetchStatuses = async () => {
//     setLoading(true);
//     setError(null);
//     try {
//       const data = await getNodeStatuses();
//       const normalizedData = Object.keys(data).reduce((acc, key) => {
//         acc[key] = { ...data[key], time_series_metrics: Array.isArray(data[key].time_series_metrics) ? data[key].time_series_metrics : [] };
//         return acc;
//       }, {});
//       console.log("Fetched node statuses:", normalizedData);
//       setNodes(normalizedData);
//       setLastUpdated(new Date().toLocaleString());
//     } catch (error) {
//       console.error("Failed to fetch node statuses:", error);
//       setError("Failed to load node statuses. Please try again.");
//     } finally {
//       setLoading(false);
//     }
//   };

//   const addGlobalChatMessage = (message) => setGlobalChatMessages((prev) => [...prev, message]);
//   const sendGlobalChatMessage = (text) => {
//     if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
//       wsRef.current.send(JSON.stringify({ type: "global_chat", message: text }));
//     } else {
//       addGlobalChatMessage({ sender: "bot", text: "Error: Not connected to the server." });
//     }
//   };

//   const connectWebSocket = () => {
//     const ws = new WebSocket("ws://localhost:8000/ws");
//     wsRef.current = ws;
//     ws.onopen = () => { console.log("WebSocket connection established"); retryCountRef.current = 0; };
//     ws.onmessage = (event) => { const message = JSON.parse(event.data); if (message.type === "global_chat_response") addGlobalChatMessage({ sender: "bot", text: message.data }); };
//     ws.onclose = () => { console.log("WebSocket connection closed"); const retryDelay = Math.min(1000 * 2 ** retryCountRef.current, 30000); setTimeout(() => { retryCountRef.current += 1; connectWebSocket(); }, retryDelay); };
//     ws.onerror = (error) => console.error("WebSocket error:", error);
//   };

//   useEffect(() => { fetchStatuses(); const intervalId = setInterval(fetchStatuses, 60000); return () => clearInterval(intervalId); }, []);
//   useEffect(() => { connectWebSocket(); return () => { if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) wsRef.current.close(); }; }, []);
//   useEffect(() => { if (Object.keys(nodes).length > 0 && (!selectedNode || !nodes[selectedNode])) setSelectedNode(Object.keys(nodes)[0]); }, [nodes, selectedNode]);

//   const calculateRate = (metrics, valueKey) => {
//     if (!Array.isArray(metrics) || metrics.length < 2) return [];
//     const validMetrics = metrics
//       .map((m) => ({ time: Number(m.time), [valueKey]: Number(m[valueKey] || 0) }))
//       .filter((m) => !isNaN(m.time) && !isNaN(m[valueKey]));
//     const sortedMetrics = [...validMetrics].sort((a, b) => a.time - b.time);
//     const rateData = [];
//     for (let i = 1; i < sortedMetrics.length; i++) {
//       const prev = sortedMetrics[i - 1];
//       const curr = sortedMetrics[i];
//       const timeDiff = curr.time - prev.time;
//       if (timeDiff <= 0) continue;
//       const valueDiff = curr[valueKey] - prev[valueKey];
//       const rate = valueDiff >= 0 ? valueDiff / timeDiff : 0;
//       rateData.push({ time: curr.time, rate: rate });
//     }
//     return rateData;
//   };

//   const calculateAveragePacketSize = (metrics) => {
//     if (!Array.isArray(metrics) || metrics.length === 0) return { avgSize: "0.00" };
//     const totalPackets = metrics.reduce((sum, m) => sum + (m.packets || 0), 0);
//     const totalBytes = metrics.reduce((sum, m) => sum + (m.bytes || 0), 0);
//     const avgSize = totalPackets > 0 ? totalBytes / totalPackets : 0;
//     return { avgSize: avgSize.toFixed(2) };
//   };

//   const getPcapSummary = (nodeData) => {
//     if (!nodeData || !Array.isArray(nodeData.time_series_metrics)) return { totalPackets: 0, totalBytes: 0, avgPacketSize: "0.00", packetRate: "0.00", throughput: "0.00" };
//     const metrics = nodeData.time_series_metrics;
//     const totalPackets = metrics.reduce((sum, m) => sum + (m.packets || 0), 0);
//     const totalBytes = metrics.reduce((sum, m) => sum + (m.bytes || 0), 0);
//     const packetRate = calculateRate(metrics, "packets").length > 0 ? calculateRate(metrics, "packets")[calculateRate(metrics, "packets").length - 1].rate.toFixed(2) : "0.00";
//     const avgPacketSize = calculateAveragePacketSize(metrics).avgSize;
//     const totalTime = metrics.length > 1 ? metrics[metrics.length - 1].time - metrics[0].time : 1;
//     const throughput = totalBytes / totalTime || 0;
//     return { totalPackets, totalBytes, avgPacketSize, packetRate, throughput: throughput.toFixed(2) };
//   };

//   const getMetaData = (nodeData) => {
//     if (!nodeData || !Array.isArray(nodeData.time_series_metrics)) return null;
//     const metrics = nodeData.time_series_metrics;
//     const totalPackets = metrics.reduce((sum, m) => sum + (m.packets || 0), 0);
//     const totalBytes = metrics.reduce((sum, m) => sum + (m.bytes || 0), 0);
//     const packetsSent = Math.floor(totalPackets / 2);
//     const packetsReceived = totalPackets - packetsSent;
//     const bytesSent = Math.floor(totalBytes / 2);
//     const bytesReceived = totalBytes - bytesSent;

//     return {
//       ipAddress: selectedNode,
//       status: nodeData.attack_detected ? "Under Attack" : "Fine",
//       packetsSent,
//       packetsReceived,
//       bytesSent,
//       bytesReceived,
//     };
//   };

//   return (
//     <div className="global-controller-dashboard">
//       <h2 className="network-title">Network Visualization</h2>
//       <div className="controls-wrapper">
//         <div className="right-controls">
//           <button
//             className={`sub-nav-tab ${activePanel === "Statistics" ? "active" : ""}`}
//             onClick={() => {
//               console.log("Clicked Statistics", activePanel);
//               setActivePanel(activePanel === "Statistics" ? null : "Statistics");
//             }}
//           >
//             Statistics
//           </button>
//           <button
//             className={`sub-nav-tab ${activePanel === "Meta Data" ? "active" : ""}`}
//             onClick={() => {
//               console.log("Clicked Meta Data", activePanel);
//               setActivePanel(activePanel === "Meta Data" ? null : "Meta Data");
//             }}
//           >
//             Meta Data
//           </button>
//           <button onClick={fetchStatuses} className="refresh-button">Refresh</button>
//         </div>
//       </div>
//       {error && <p className="error">{error}</p>}
//       {loading ? (
//         <p>Loading...</p>
//       ) : Object.keys(nodes).length === 0 ? (
//         <p>No nodes found.</p>
//       ) : (
//         <div className="dashboard-container">
//           <div className="left-panel">
//             <div className="network-visualization">
//               <NetworkVisualizer nodes={nodes} onSelectNode={setSelectedNode} />
//             </div>
//             <div className="node-charts">
//               <h2>Node Details: {selectedNode || "Select a node"}</h2>
//               {selectedNode && nodes[selectedNode] && (
//                 <>
//                   <div className="chart-grid">
//                     <div className="chart-container">
//                       <MetricChart
//                         metrics={nodes[selectedNode].time_series_metrics}
//                         title="Packet Count over Time"
//                         yLabel="Packets"
//                         color={colors[0]}
//                         valueKey="packets"
//                       />
//                     </div>
//                     <div className="chart-container">
//                       <MetricChart
//                         metrics={nodes[selectedNode].time_series_metrics}
//                         title="Byte Count over Time"
//                         yLabel="Bytes"
//                         color={colors[1]}
//                         valueKey="bytes"
//                       />
//                     </div>
//                     <div className="chart-container">
//                       <MetricChart
//                         metrics={calculateRate(
//                           nodes[selectedNode].time_series_metrics,
//                           "packets"
//                         )}
//                         title="Packet Rate over Time"
//                         yLabel="Packets per second"
//                         color={colors[2]}
//                         valueKey="rate"
//                       />
//                     </div>
//                     <div className="chart-container">
//                       <MetricChart
//                         metrics={calculateRate(
//                           nodes[selectedNode].time_series_metrics,
//                           "bytes"
//                         )}
//                         title="Throughput over Time"
//                         yLabel="Bytes per second"
//                         color={colors[3]}
//                         valueKey="rate"
//                       />
//                     </div>
//                     {nodes[selectedNode].time_series_metrics.some(
//                       (m) => m.error_count !== undefined
//                     ) && (
//                       <div className="chart-container">
//                         <MetricChart
//                           metrics={calculateRate(
//                             nodes[selectedNode].time_series_metrics,
//                             "error_count"
//                           )}
//                           title="Error Rate over Time"
//                           yLabel="Errors per second"
//                           color={colors[4]}
//                           valueKey="rate"
//                         />
//                       </div>
//                     )}
//                     {nodes[selectedNode].time_series_metrics.some(
//                       (m) => m.anomalies_detected !== undefined
//                     ) && (
//                       <div className="chart-container">
//                         <MetricChart
//                           metrics={calculateRate(
//                             nodes[selectedNode].time_series_metrics,
//                             "anomalies_detected"
//                           )}
//                           title="Anomaly Rate over Time"
//                           yLabel="Anomalies per second"
//                           color={colors[5]}
//                           valueKey="rate"
//                         />
//                       </div>
//                     )}
//                     <div className="chart-container">
//                       <MetricChart
//                         metrics={calculateAveragePacketSize(
//                           nodes[selectedNode].time_series_metrics
//                         )}
//                         title="Average Packet Size over Time"
//                         yLabel="Bytes per Packet"
//                         color={colors[6]}
//                         valueKey="avg_size"
//                       />
//                     </div>
//                     <div className="chart-container">
//                       <MetricChart
//                         metrics={nodes[selectedNode].time_series_metrics}
//                         title="Latency over Time"
//                         yLabel="Latency (ms)"
//                         color={colors[7]}
//                         valueKey="latency_ms"
//                       />
//                     </div>
//                     <div className="chart-container">
//                       <MetricChart
//                         metrics={nodes[selectedNode].time_series_metrics}
//                         title="Jitter over Time"
//                         yLabel="Jitter (ms)"
//                         color={colors[8]}
//                         valueKey="jitter_ms"
//                       />
//                     </div>
//                   </div>
//                   <div className="node-info">
//                     <h3>Node Information</h3>
//                     <p>
//                       <strong>Status:</strong>{" "}
//                       {nodes[selectedNode].attack_detected
//                         ? "Under Attack"
//                         : "Fine"}
//                     </p>
//                     <p>
//                       <strong>Anomalies Detected:</strong>{" "}
//                       {nodes[selectedNode].anomalies_detected}
//                     </p>
//                     <p>
//                       <strong>Summary:</strong> {nodes[selectedNode].summary}
//                     </p>
//                     <p>
//                       <strong>Attack Type:</strong>{" "}
//                       {nodes[selectedNode].attack_type || "N/A"}
//                     </p>
//                   </div>
//                 </>
//               )}
//             </div>
//           </div>
//           <div className="right-panel">
//             {activePanel === "Statistics" && selectedNode && nodes[selectedNode] && (
//               <div className="panel-content">
//                 <h3>Statistics for Node {selectedNode}</h3>
//                 <table className="stats-table">
//                   <tbody>
//                     <tr><td>Total Packets:</td><td>{getPcapSummary(nodes[selectedNode]).totalPackets}</td></tr>
//                     <tr><td>Total Bytes:</td><td>{getPcapSummary(nodes[selectedNode]).totalBytes}</td></tr>
//                     <tr><td>Average Packet Size (B):</td><td>{getPcapSummary(nodes[selectedNode]).avgPacketSize}</td></tr>
//                     <tr><td>Packet Rate (pkt/s):</td><td>{getPcapSummary(nodes[selectedNode]).packetRate}</td></tr>
//                     <tr><td>Throughput (B/s):</td><td>{getPcapSummary(nodes[selectedNode]).throughput}</td></tr>
//                   </tbody>
//                 </table>
//               </div>
//             )}
//             {activePanel === "Meta Data" && selectedNode && nodes[selectedNode] && (
//               <div className="panel-content">
//                 <h3>Meta Data for Node {selectedNode}</h3>
//                 <table className="meta-data-table">
//                   <tbody>
//                     <tr><td>IP Address:</td><td>{getMetaData(nodes[selectedNode]).ipAddress}</td></tr>
//                     <tr><td>Status:</td><td>{getMetaData(nodes[selectedNode]).status}</td></tr>
//                     <tr><td>Packets Sent:</td><td>{getMetaData(nodes[selectedNode]).packetsSent}</td></tr>
//                     <tr><td>Packets Received:</td><td>{getMetaData(nodes[selectedNode]).packetsReceived}</td></tr>
//                     <tr><td>Bytes Sent:</td><td>{getMetaData(nodes[selectedNode]).bytesSent}</td></tr>
//                     <tr><td>Bytes Received:</td><td>{getMetaData(nodes[selectedNode]).bytesReceived}</td></tr>
//                   </tbody>
//                 </table>
//               </div>
//             )}
//           </div>
//         </div>
//       )}
//       {lastUpdated && (
//         <p className="last-updated">Last updated: {lastUpdated}</p>
//       )}
//       <GlobalChatbot
//         globalChatMessages={globalChatMessages}
//         addGlobalChatMessage={addGlobalChatMessage}
//         sendGlobalChatMessage={sendGlobalChatMessage}
//       />
//     </div>
//   );
// };

// export default GlobalControllerDashboard;

//current working code

// import React, { useEffect, useState, useRef } from "react";
// import ApexCharts from "react-apexcharts";
// import { getNodeStatuses } from "../apiService.js";
// import "../GlobalControllerDashboard.css";
// import NetworkVisualizer from "./NetworkVisualizer";
// import GlobalChatbot from "./GlobalChatbot";

// // MetricChart component
// const MetricChart = ({ metrics, title, yLabel, color, valueKey }) => {
//   if (!Array.isArray(metrics) || metrics.length === 0) return <p>No data available.</p>;
//   const data = metrics
//     .map((m) => ({ x: Number(m.time) * 1000, y: Number(m[valueKey]) }))
//     .filter((d) => !isNaN(d.x) && !isNaN(d.y));
//   if (data.length < 2) return <p>Insufficient data points to display graph.</p>;

//   const sortedData = data.sort((a, b) => a.x - b.x);
//   const minX = sortedData[0].x;
//   const maxX = sortedData[sortedData.length - 1].x;



//   const options = {
//     chart: { type: "line", height: 300, animations: { enabled: true, easing: "linear" } },
//     xaxis: { type: "datetime", min: minX, max: maxX, labels: { style: { fontSize: "14px" } } },
//     yaxis: { title: { text: yLabel }, labels: { style: { fontSize: "14px" }, formatter: (value) => value.toFixed(2) } },
//     title: { text: title, align: "center", style: { fontSize: "18px", fontWeight: "bold" } },
//     stroke: { width: 2, curve: "smooth" },
//     colors: [color],
//     tooltip: { y: { formatter: (value) => value.toFixed(2) }, x: { format: "HH:mm:ss.SSS" } },
//   };

//   return <ApexCharts options={options} series={[{ name: title, data: sortedData }]} type="line" height={300} />;
// };

// const GlobalControllerDashboard = () => {
//   const [nodes, setNodes] = useState({});
//   const [error, setError] = useState(null);
//   const [loading, setLoading] = useState(true);
//   const [lastUpdated, setLastUpdated] = useState(null);
//   const [selectedNode, setSelectedNode] = useState(null);
//   const [activePanel, setActivePanel] = useState(null);

//   const [globalChatMessages, setGlobalChatMessages] = useState([{ sender: "bot", text: "Hello! How can I assist you with the Central Controller Dashboard?" }]);
//   const wsRef = useRef(null);
//   const retryCountRef = useRef(0);

//   const colors = ["#FF5733", "#33FF57", "#3357FF", "#FF33A1", "#A133FF", "#33FFA1", "#FFA133", "#FF5733", "#33FF57"];

//   const fetchStatuses = async () => {
//     setLoading(true);
//     setError(null);
//     try {
//       const data = await getNodeStatuses();
//       const normalizedData = Object.keys(data).reduce((acc, key) => {
//         acc[key] = {
//           ...data[key],
//           time_series_metrics: Array.isArray(data[key].time_series_metrics) ? data[key].time_series_metrics : [],
//           packet_details: Array.isArray(data[key].packet_details) ? data[key].packet_details : [], // Default to empty if not provided
//         };
//         return acc;
//       }, {});
//       console.log("Fetched node statuses with packet_details:", normalizedData);
//       setNodes(normalizedData);
//       setLastUpdated(new Date().toLocaleString());
//     } catch (error) {
//       console.error("Failed to fetch node statuses:", error);
//       setError("Failed to load node statuses. Please try again.");
//     } finally {
//       setLoading(false);
//     }
//   };

//   const addGlobalChatMessage = (message) => setGlobalChatMessages((prev) => [...prev, message]);
//   const sendGlobalChatMessage = (text) => {
//     if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
//       wsRef.current.send(JSON.stringify({ type: "global_chat", message: text }));
//     } else {
//       addGlobalChatMessage({ sender: "bot", text: "Error: Not connected to the server." });
//     }
//   };

//   const connectWebSocket = () => {
//     const ws = new WebSocket("ws://localhost:8000/ws");
//     wsRef.current = ws;
//     ws.onopen = () => { console.log("WebSocket connection established"); retryCountRef.current = 0; };
//     ws.onmessage = (event) => { const message = JSON.parse(event.data); if (message.type === "global_chat_response") addGlobalChatMessage({ sender: "bot", text: message.data }); };
//     ws.onclose = () => { console.log("WebSocket connection closed"); const retryDelay = Math.min(1000 * 2 ** retryCountRef.current, 30000); setTimeout(() => { retryCountRef.current += 1; connectWebSocket(); }, retryDelay); };
//     ws.onerror = (error) => console.error("WebSocket error:", error);
//   };

//   useEffect(() => { fetchStatuses(); const intervalId = setInterval(fetchStatuses, 60000); return () => clearInterval(intervalId); }, []);
//   useEffect(() => { connectWebSocket(); return () => { if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) wsRef.current.close(); }; }, []);
//   useEffect(() => { if (Object.keys(nodes).length > 0 && (!selectedNode || !nodes[selectedNode])) setSelectedNode(Object.keys(nodes)[0]); }, [nodes, selectedNode]);

//   const calculateRate = (metrics, valueKey) => {
//     if (!Array.isArray(metrics) || metrics.length < 2) return [];
//     const validMetrics = metrics
//       .map((m) => ({ time: Number(m.time), [valueKey]: Number(m[valueKey] || 0) }))
//       .filter((m) => !isNaN(m.time) && !isNaN(m[valueKey]));
//     const sortedMetrics = [...validMetrics].sort((a, b) => a.time - b.time);
//     const rateData = [];
//     for (let i = 1; i < sortedMetrics.length; i++) {
//       const prev = sortedMetrics[i - 1];
//       const curr = sortedMetrics[i];
//       const timeDiff = curr.time - prev.time;
//       if (timeDiff <= 0) continue;
//       const valueDiff = curr[valueKey] - prev[valueKey];
//       const rate = valueDiff >= 0 ? valueDiff / timeDiff : 0;
//       rateData.push({ time: curr.time, rate: rate });
//     }
//     return rateData;
//   };

//   const calculateAveragePacketSize = (metrics) => {
//     if (!Array.isArray(metrics) || metrics.length === 0) return { avgSize: "0.00" };
//     const totalPackets = metrics.reduce((sum, m) => sum + (m.packets || 0), 0);
//     const totalBytes = metrics.reduce((sum, m) => sum + (m.bytes || 0), 0);
//     const avgSize = totalPackets > 0 ? totalBytes / totalPackets : 0;
//     return { avgSize: avgSize.toFixed(2) };
//   };

//   const getPcapSummary = (nodeData) => {
//     if (!nodeData || !Array.isArray(nodeData.time_series_metrics)) return { totalPackets: 0, totalBytes: 0, avgPacketSize: "0.00", packetRate: "0.00", throughput: "0.00" };
//     const metrics = nodeData.time_series_metrics;
//     const totalPackets = metrics.reduce((sum, m) => sum + (m.packets || 0), 0);
//     const totalBytes = metrics.reduce((sum, m) => sum + (m.bytes || 0), 0);
//     const packetRate = calculateRate(metrics, "packets").length > 0 ? calculateRate(metrics, "packets")[calculateRate(metrics, "packets").length - 1].rate.toFixed(2) : "0.00";
//     const avgPacketSize = calculateAveragePacketSize(metrics).avgSize;
//     const totalTime = metrics.length > 1 ? metrics[metrics.length - 1].time - metrics[0].time : 1;
//     const throughput = totalBytes / totalTime || 0;
//     return { totalPackets, totalBytes, avgPacketSize, packetRate, throughput: throughput.toFixed(2) };
//   };

//   const getMetaData = (nodeData) => {
//     if (!nodeData || !Array.isArray(nodeData.time_series_metrics)) return null;
//     const metrics = nodeData.time_series_metrics;
//     const totalPackets = metrics.reduce((sum, m) => sum + (m.packets || 0), 0);
//     const totalBytes = metrics.reduce((sum, m) => sum + (m.bytes || 0), 0);
//     const packetsSent = Math.floor(totalPackets / 2);
//     const packetsReceived = totalPackets - packetsSent;
//     const bytesSent = Math.floor(totalBytes / 2);
//     const bytesReceived = totalBytes - bytesSent;

//     return {
//       ipAddress: selectedNode,
//       status: nodeData.attack_detected ? "Under Attack" : "Fine",
//       packetsSent,
//       packetsReceived,
//       bytesSent,
//       bytesReceived,
//     };
//   };

//   return (
//     <div className="global-controller-dashboard">
//       <h2 className="network-title">Network Visualization</h2>
//       <div className="controls-wrapper">
//         <div className="right-controls">
//           <button
//             className={`sub-nav-tab ${activePanel === "Statistics" ? "active" : ""}`}
//             onClick={() => {
//               console.log("Clicked Statistics", activePanel);
//               setActivePanel(activePanel === "Statistics" ? null : "Statistics");
//             }}
//           >
//             Statistics
//           </button>
//           <button
//             className={`sub-nav-tab ${activePanel === "Meta Data" ? "active" : ""}`}
//             onClick={() => {
//               console.log("Clicked Meta Data", activePanel);
//               setActivePanel(activePanel === "Meta Data" ? null : "Meta Data");
//             }}
//           >
//             Meta Data
//           </button>
//           <button onClick={fetchStatuses} className="refresh-button">Refresh</button>
//         </div>
//       </div>
//       {error && <p className="error">{error}</p>}
//       {loading ? (
//         <p>Loading...</p>
//       ) : Object.keys(nodes).length === 0 ? (
//         <p>No nodes found.</p>
//       ) : (
//         <div className="dashboard-container">
//           <div className="left-panel">
//             <div className="network-visualization">
//               <NetworkVisualizer nodes={nodes} onSelectNode={setSelectedNode} />
//             </div>
//             <div className="node-charts">
//               <h2>Node Details: {selectedNode || "Select a node"}</h2>
//               {selectedNode && nodes[selectedNode] && (
//                 <>
//                   <div className="chart-grid">
//                     <div className="chart-container">
//                       <MetricChart
//                         metrics={nodes[selectedNode].time_series_metrics}
//                         title="Packet Count over Time"
//                         yLabel="Packets"
//                         color={colors[0]}
//                         valueKey="packets"
//                       />
//                     </div>
//                     <div className="chart-container">
//                       <MetricChart
//                         metrics={nodes[selectedNode].time_series_metrics}
//                         title="Byte Count over Time"
//                         yLabel="Bytes"
//                         color={colors[1]}
//                         valueKey="bytes"
//                       />
//                     </div>
//                     <div className="chart-container">
//                       <MetricChart
//                         metrics={calculateRate(
//                           nodes[selectedNode].time_series_metrics,
//                           "packets"
//                         )}
//                         title="Packet Rate over Time"
//                         yLabel="Packets per second"
//                         color={colors[2]}
//                         valueKey="rate"
//                       />
//                     </div>
//                     <div className="chart-container">
//                       <MetricChart
//                         metrics={calculateRate(
//                           nodes[selectedNode].time_series_metrics,
//                           "bytes"
//                         )}
//                         title="Throughput over Time"
//                         yLabel="Bytes per second"
//                         color={colors[3]}
//                         valueKey="rate"
//                       />
//                     </div>
//                     {nodes[selectedNode].time_series_metrics.some(
//                       (m) => m.error_count !== undefined
//                     ) && (
//                       <div className="chart-container">
//                         <MetricChart
//                           metrics={calculateRate(
//                             nodes[selectedNode].time_series_metrics,
//                             "error_count"
//                           )}
//                           title="Error Rate over Time"
//                           yLabel="Errors per second"
//                           color={colors[4]}
//                           valueKey="rate"
//                         />
//                       </div>
//                     )}
//                     {nodes[selectedNode].time_series_metrics.some(
//                       (m) => m.anomalies_detected !== undefined
//                     ) && (
//                       <div className="chart-container">
//                         <MetricChart
//                           metrics={calculateRate(
//                             nodes[selectedNode].time_series_metrics,
//                             "anomalies_detected"
//                           )}
//                           title="Anomaly Rate over Time"
//                           yLabel="Anomalies per second"
//                           color={colors[5]}
//                           valueKey="rate"
//                         />
//                       </div>
//                     )}
//                     <div className="chart-container">
//                       <MetricChart
//                         metrics={calculateAveragePacketSize(
//                           nodes[selectedNode].time_series_metrics
//                         )}
//                         title="Average Packet Size over Time"
//                         yLabel="Bytes per Packet"
//                         color={colors[6]}
//                         valueKey="avg_size"
//                       />
//                     </div>
//                     <div className="chart-container">
//                       <MetricChart
//                         metrics={nodes[selectedNode].time_series_metrics}
//                         title="Latency over Time"
//                         yLabel="Latency (ms)"
//                         color={colors[7]}
//                         valueKey="latency_ms"
//                       />
//                     </div>
//                     <div className="chart-container">
//                       <MetricChart
//                         metrics={nodes[selectedNode].time_series_metrics}
//                         title="Jitter over Time"
//                         yLabel="Jitter (ms)"
//                         color={colors[8]}
//                         valueKey="jitter_ms"
//                       />
//                     </div>
//                   </div>
//                   <div className="node-info">
//                     <h3>Node Information</h3>
//                     <p>
//                       <strong>Status:</strong>{" "}
//                       {nodes[selectedNode].attack_detected
//                         ? "Under Attack"
//                         : "Fine"}
//                     </p>
//                     <p>
//                       <strong>Anomalies Detected:</strong>{" "}
//                       {nodes[selectedNode].anomalies_detected}
//                     </p>
//                     <p>
//                       <strong>Summary:</strong> {nodes[selectedNode].summary}
//                     </p>
//                     <p>
//                       <strong>Attack Type:</strong>{" "}
//                       {nodes[selectedNode].attack_type || "N/A"}
//                     </p>
//                   </div>
//                 </>
//               )}
//             </div>
//           </div>
//           <div className="right-panel">
//             {activePanel === "Statistics" && selectedNode && nodes[selectedNode] && (
//               <div className="panel-content">
//                 <h3>Statistics for Node {selectedNode}</h3>
//                 {nodes[selectedNode].packet_details.length > 0 ? (
//                   <table className="stats-table">
//                     <thead>
//                       <tr>
//                         <th>Time</th>
//                         <th>Source IP</th>
//                         <th>Destination IP</th>
//                         <th>Protocol</th>
//                         <th>Length (B)</th>
//                       </tr>
//                     </thead>
//                     <tbody>
//                       {nodes[selectedNode].packet_details.slice(0, 10).map((packet, index) => (
//                         <tr key={index}>
//                           <td>{new Date(packet.timestamp).toLocaleTimeString()}</td>
//                           <td>{packet.src_ip || "N/A"}</td>
//                           <td>{packet.dst_ip || "N/A"}</td>
//                           <td>{packet.protocol || "N/A"}</td>
//                           <td>{packet.length || "N/A"}</td>
//                         </tr>
//                       ))}
//                     </tbody>
//                   </table>
//                 ) : (
//                   <p>No packet details available. Please ensure the backend provides packet_details data from the PCAP file.</p>
//                 )}
//               </div>
//             )}
//             {activePanel === "Meta Data" && selectedNode && nodes[selectedNode] && (
//               <div className="panel-content">
//                 <h3>Meta Data for Node {selectedNode}</h3>
//                 <table className="meta-data-table">
//                   <tbody>
//                     <tr><td>IP Address:</td><td>{getMetaData(nodes[selectedNode]).ipAddress}</td></tr>
//                     <tr><td>Status:</td><td>{getMetaData(nodes[selectedNode]).status}</td></tr>
//                     <tr><td>Packets Sent:</td><td>{getMetaData(nodes[selectedNode]).packetsSent}</td></tr>
//                     <tr><td>Packets Received:</td><td>{getMetaData(nodes[selectedNode]).packetsReceived}</td></tr>
//                     <tr><td>Bytes Sent:</td><td>{getMetaData(nodes[selectedNode]).bytesSent}</td></tr>
//                     <tr><td>Bytes Received:</td><td>{getMetaData(nodes[selectedNode]).bytesReceived}</td></tr>
//                   </tbody>
//                 </table>
//               </div>
//             )}
//           </div>
//         </div>
//       )}
//       {lastUpdated && (
//         <p className="last-updated">Last updated: {lastUpdated}</p>
//       )}
//       <GlobalChatbot
//         globalChatMessages={globalChatMessages}
//         addGlobalChatMessage={addGlobalChatMessage}
//         sendGlobalChatMessage={sendGlobalChatMessage}
//       />
//     </div>
//   );
// };

// export default GlobalControllerDashboard;


//experiment - 3: success

// import React, { useEffect, useState, useRef } from "react";
// import ApexCharts from "react-apexcharts";
// import { getNodeStatuses } from "../apiService.js";
// import "../GlobalControllerDashboard.css";
// import NetworkVisualizer from "./NetworkVisualizer";
// import GlobalChatbot from "./GlobalChatbot";

// // MetricChart component
// const MetricChart = ({ metrics, title, yLabel, color, valueKey }) => {
//   if (!Array.isArray(metrics) || metrics.length === 0) return <p>No data available.</p>;

//   const data = metrics
//     .map((m) => ({ x: Number(m.time) * 1000, y: Number(m[valueKey]) }))
//     .filter((d) => !isNaN(d.x) && !isNaN(d.y));

//   if (data.length < 2) return <p>Insufficient data points to display graph.</p>;

//   const sortedData = data.sort((a, b) => a.x - b.x);
//   const minX = sortedData[0].x;
//   const maxX = sortedData[sortedData.length - 1].x;

//   const options = {
//     chart: { type: "line", height: 300, animations: { enabled: true, easing: "linear" } },
//     xaxis: { type: "datetime", min: minX, max: maxX, labels: { style: { fontSize: "14px" } } },
//     yaxis: {
//       title: { text: yLabel },
//       labels: {
//         style: { fontSize: "14px" },
//         formatter: (value) => value.toFixed(2),
//       },
//     },
//     title: {
//       text: title,
//       align: "center",
//       style: { fontSize: "18px", fontWeight: "bold" },
//     },
//     stroke: { width: 2, curve: "smooth" },
//     colors: [color],
//     tooltip: {
//       y: { formatter: (value) => value.toFixed(2) },
//       x: { format: "HH:mm:ss.SSS" },
//     },
//   };

//   return (
//     <ApexCharts
//       options={options}
//       series={[{ name: title, data: sortedData }]}
//       type="line"
//       height={300}
//     />
//   );
// };

// const GlobalControllerDashboard = () => {
//   const [nodes, setNodes] = useState({});
//   const [error, setError] = useState(null);
//   const [loading, setLoading] = useState(true);
//   const [lastUpdated, setLastUpdated] = useState(null);
//   const [selectedNode, setSelectedNode] = useState(null);
//   const [activePanel, setActivePanel] = useState(null);

//   const [globalChatMessages, setGlobalChatMessages] = useState([
//     { sender: "bot", text: "Hello! How can I assist you with the Central Controller Dashboard?" },
//   ]);
//   const wsRef = useRef(null);
//   const retryCountRef = useRef(0);

//   const colors = [
//     "#FF5733", "#33FF57", "#3357FF",
//     "#FF33A1", "#A133FF", "#33FFA1",
//     "#FFA133", "#FF5733", "#33FF57"
//   ];

//   // Fetch statuses from backend
//   const fetchStatuses = async () => {
//     setLoading(true);
//     setError(null);
//     try {
//       const data = await getNodeStatuses();
//       const normalizedData = Object.keys(data).reduce((acc, key) => {
//         acc[key] = {
//           ...data[key],
//           time_series_metrics: Array.isArray(data[key].time_series_metrics)
//             ? data[key].time_series_metrics
//             : [],
//           packet_details: Array.isArray(data[key].packet_details)
//             ? data[key].packet_details
//             : [],
//         };
//         return acc;
//       }, {});
//       console.log("Fetched node statuses with packet_details:", normalizedData);
//       setNodes(normalizedData);
//       setLastUpdated(new Date().toLocaleString());
//     } catch (err) {
//       console.error("Failed to fetch node statuses:", err);
//       setError("Failed to load node statuses. Please try again.");
//     } finally {
//       setLoading(false);
//     }
//   };

//   // WebSocket chat helpers
//   const addGlobalChatMessage = (message) =>
//     setGlobalChatMessages((prev) => [...prev, message]);
//   const sendGlobalChatMessage = (text) => {
//     if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
//       wsRef.current.send(JSON.stringify({ type: "global_chat", message: text }));
//     } else {
//       addGlobalChatMessage({ sender: "bot", text: "Error: Not connected to the server." });
//     }
//   };

//   const connectWebSocket = () => {
//     const ws = new WebSocket("ws://localhost:8000/ws");
//     wsRef.current = ws;
//     ws.onopen = () => {
//       console.log("WebSocket connection established");
//       retryCountRef.current = 0;
//     };
//     ws.onmessage = (event) => {
//       const message = JSON.parse(event.data);
//       if (message.type === "global_chat_response") {
//         addGlobalChatMessage({ sender: "bot", text: message.data });
//       }
//     };
//     ws.onclose = () => {
//       console.log("WebSocket connection closed");
//       const retryDelay = Math.min(1000 * 2 ** retryCountRef.current, 30000);
//       setTimeout(() => {
//         retryCountRef.current += 1;
//         connectWebSocket();
//       }, retryDelay);
//     };
//     ws.onerror = (err) => console.error("WebSocket error:", err);
//   };

//   // Initial data & WS setup
//   useEffect(() => {
//     fetchStatuses();
//     const intervalId = setInterval(fetchStatuses, 60000);
//     return () => clearInterval(intervalId);
//   }, []);

//   useEffect(() => {
//     connectWebSocket();
//     return () => {
//       if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
//         wsRef.current.close();
//       }
//     };
//   }, []);

//   // Auto-select first node when data arrives
//   useEffect(() => {
//     if (Object.keys(nodes).length > 0 && (!selectedNode || !nodes[selectedNode])) {
//       setSelectedNode(Object.keys(nodes)[0]);
//     }
//   }, [nodes, selectedNode]);

//   // Rate & average packet size calculators
//   const calculateRate = (metrics, valueKey) => {
//     if (!Array.isArray(metrics) || metrics.length < 2) return [];
//     const validMetrics = metrics
//       .map((m) => ({ time: Number(m.time), [valueKey]: Number(m[valueKey] || 0) }))
//       .filter((m) => !isNaN(m.time) && !isNaN(m[valueKey]));
//     const sortedMetrics = [...validMetrics].sort((a, b) => a.time - b.time);
//     const rateData = [];
//     for (let i = 1; i < sortedMetrics.length; i++) {
//       const prev = sortedMetrics[i - 1];
//       const curr = sortedMetrics[i];
//       const dt = curr.time - prev.time;
//       if (dt <= 0) continue;
//       const dv = curr[valueKey] - prev[valueKey];
//       rateData.push({ time: curr.time, rate: dv >= 0 ? dv / dt : 0 });
//     }
//     return rateData;
//   };

//   const calculateAveragePacketSize = (metrics) => {
//     if (!Array.isArray(metrics) || metrics.length < 2) return [];
//     return metrics
//       .map((m) => {
//         const t = Number(m.time);
//         const pk = Number(m.packets) || 0;
//         const bt = Number(m.bytes) || 0;
//         const avg = pk > 0 ? bt / pk : 0;
//         return { time: t, x: t * 1000, y: avg, avg_size: avg };
//       })
//       .filter((d) => !isNaN(d.x) && !isNaN(d.y));
//   };

//   // Summary & metadata helpers
//   const getMetaData = (nodeData) => {
//     if (!nodeData || !Array.isArray(nodeData.time_series_metrics)) return null;
//     const m = nodeData.time_series_metrics;
//     const totalPackets = m.reduce((s, x) => s + (x.packets || 0), 0);
//     const totalBytes   = m.reduce((s, x) => s + (x.bytes   || 0), 0);
//     return {
//       ipAddress:      selectedNode,
//       status:         nodeData.attack_detected ? "Under Attack" : "Fine",
//       packetsSent:    Math.floor(totalPackets / 2),
//       packetsReceived:totalPackets - Math.floor(totalPackets / 2),
//       bytesSent:      Math.floor(totalBytes / 2),
//       bytesReceived:  totalBytes - Math.floor(totalBytes / 2),
//     };
//   };

//   return (
//     <div className="global-controller-dashboard">
//       <h2 className="network-title">Network Visualization</h2>
//       <div className="controls-wrapper">
//         <div className="right-controls">
//           <button
//             className={`sub-nav-tab ${activePanel === "Statistics" ? "active" : ""}`}
//             onClick={() => setActivePanel(
//               activePanel === "Statistics" ? null : "Statistics"
//             )}
//           >
//             Statistics
//           </button>
//           <button
//             className={`sub-nav-tab ${activePanel === "Meta Data" ? "active" : ""}`}
//             onClick={() => setActivePanel(
//               activePanel === "Meta Data" ? null : "Meta Data"
//             )}
//           >
//             Meta Data
//           </button>
//           <button onClick={fetchStatuses} className="refresh-button">
//             Refresh
//           </button>
//         </div>
//       </div>

//       {error && <p className="error">{error}</p>}
//       {loading ? (
//         <p>Loading...</p>
//       ) : Object.keys(nodes).length === 0 ? (
//         <p>No nodes found.</p>
//       ) : (
//         <div className="dashboard-container">

//           {/* ────────── LEFT PANEL ────────── */}
//           <div className="left-panel">
//             <div className="network-visualization">
//               <NetworkVisualizer nodes={nodes} onSelectNode={setSelectedNode} />
//             </div>
//             <div className="node-charts">
//               <h2>Node Details: {selectedNode}</h2>
//               {selectedNode && nodes[selectedNode] && (
//                 <>
//                   <div className="chart-grid">

//                     {/* Packet Count */}
//                     <div className="chart-container">
//                       <MetricChart
//                         metrics={nodes[selectedNode].time_series_metrics}
//                         title="Packet Count over Time"
//                         yLabel="Packets"
//                         color={colors[0]}
//                         valueKey="packets"
//                       />
//                     </div>

//                     {/* Byte Count */}
//                     <div className="chart-container">
//                       <MetricChart
//                         metrics={nodes[selectedNode].time_series_metrics}
//                         title="Byte Count over Time"
//                         yLabel="Bytes"
//                         color={colors[1]}
//                         valueKey="bytes"
//                       />
//                     </div>

//                     {/* Packet Rate */}
//                     <div className="chart-container">
//                       <MetricChart
//                         metrics={calculateRate(nodes[selectedNode].time_series_metrics, "packets")}
//                         title="Packet Rate over Time"
//                         yLabel="Packets per second"
//                         color={colors[2]}
//                         valueKey="rate"
//                       />
//                     </div>

//                     {/* Throughput */}
//                     <div className="chart-container">
//                       <MetricChart
//                         metrics={calculateRate(nodes[selectedNode].time_series_metrics, "bytes")}
//                         title="Throughput over Time"
//                         yLabel="Bytes per second"
//                         color={colors[3]}
//                         valueKey="rate"
//                       />
//                     </div>

//                     {/* Error Rate (if present) */}
//                     {nodes[selectedNode].time_series_metrics.some(m => m.error_count !== undefined) && (
//                       <div className="chart-container">
//                         <MetricChart
//                           metrics={calculateRate(nodes[selectedNode].time_series_metrics, "error_count")}
//                           title="Error Rate over Time"
//                           yLabel="Errors per second"
//                           color={colors[4]}
//                           valueKey="rate"
//                         />
//                       </div>
//                     )}

//                     {/* Anomaly Rate (if present) */}
//                     {nodes[selectedNode].time_series_metrics.some(m => m.anomalies_detected !== undefined) && (
//                       <div className="chart-container">
//                         <MetricChart
//                           metrics={calculateRate(nodes[selectedNode].time_series_metrics, "anomalies_detected")}
//                           title="Anomaly Rate over Time"
//                           yLabel="Anomalies per second"
//                           color={colors[5]}
//                           valueKey="rate"
//                         />
//                       </div>
//                     )}

//                     {/* Average Packet Size */}
//                     <div className="chart-container">
//                       <MetricChart
//                         metrics={calculateAveragePacketSize(nodes[selectedNode].time_series_metrics)}
//                         title="Average Packet Size over Time"
//                         yLabel="Bytes per Packet"
//                         color={colors[6]}
//                         valueKey="avg_size"
//                       />
//                     </div>

//                     {/* Latency */}
//                     <div className="chart-container">
//                       <MetricChart
//                         metrics={nodes[selectedNode].time_series_metrics}
//                         title="Latency over Time"
//                         yLabel="Latency (ms)"
//                         color={colors[7]}
//                         valueKey="latency_ms"
//                       />
//                     </div>

//                     {/* Jitter */}
//                     <div className="chart-container">
//                       <MetricChart
//                         metrics={nodes[selectedNode].time_series_metrics}
//                         title="Jitter over Time"
//                         yLabel="Jitter (ms)"
//                         color={colors[8]}
//                         valueKey="jitter_ms"
//                       />
//                     </div>

//                   </div>

//                   {/* Node Info */}
//                   <div className="node-info">
//                     <h3>Node Information</h3>
//                     <p>
//                       <strong>Status:</strong>{" "}
//                       {nodes[selectedNode].attack_detected ? "Under Attack" : "Fine"}
//                     </p>
//                     <p>
//                       <strong>Anomalies Detected:</strong>{" "}
//                       {nodes[selectedNode].anomalies_detected}
//                     </p>
//                     <p>
//                       <strong>Summary:</strong> {nodes[selectedNode].summary}
//                     </p>
//                     <p>
//                       <strong>Attack Type:</strong>{" "}
//                       {nodes[selectedNode].attack_type || "N/A"}
//                     </p>
//                   </div>
//                 </>
//               )}
//             </div>
//           </div>

//           {/* ────────── RIGHT PANEL ────────── */}
//           <div className="right-panel">

//             {/* Statistics Panel (remounts on node change) */}
//             {activePanel === "Statistics" && selectedNode && nodes[selectedNode] && (
//               <div className="panel-content" key={`stats-${selectedNode}`}>
//                 <h3>Statistics for Node {selectedNode}</h3>
//                 {nodes[selectedNode].packet_details.length > 0 ? (
//                   <table className="stats-table">
//                     <thead>
//                       <tr>
//                         <th>Time</th>
//                         <th>Source IP</th>
//                         <th>Destination IP</th>
//                         <th>Protocol</th>
//                         <th>Length (B)</th>
//                       </tr>
//                     </thead>
//                     <tbody>
//                       {nodes[selectedNode].packet_details.slice(0, 10).map((pkt, idx) => (
//                         <tr key={idx}>
//                           <td>{new Date(pkt.timestamp).toLocaleTimeString()}</td>
//                           <td>{pkt.src_ip || "N/A"}</td>
//                           <td>{pkt.dst_ip || "N/A"}</td>
//                           <td>{pkt.protocol || "N/A"}</td>
//                           <td>{pkt.length || "N/A"}</td>
//                         </tr>
//                       ))}
//                     </tbody>
//                   </table>
//                 ) : (
//                   <p>No packet details available. Please ensure the backend provides packet_details data.</p>
//                 )}
//               </div>
//             )}

//             {/* Meta Data Panel (remounts on node change) */}
//             {activePanel === "Meta Data" && selectedNode && nodes[selectedNode] && (
//               <div className="panel-content" key={`meta-${selectedNode}`}>
//                 <h3>Meta Data for Node {selectedNode}</h3>
//                 <table className="meta-data-table">
//                   <tbody>
//                     <tr>
//                       <td>IP Address:</td>
//                       <td>{getMetaData(nodes[selectedNode]).ipAddress}</td>
//                     </tr>
//                     <tr>
//                       <td>Status:</td>
//                       <td>{getMetaData(nodes[selectedNode]).status}</td>
//                     </tr>
//                     <tr>
//                       <td>Packets Sent:</td>
//                       <td>{getMetaData(nodes[selectedNode]).packetsSent}</td>
//                     </tr>
//                     <tr>
//                       <td>Packets Received:</td>
//                       <td>{getMetaData(nodes[selectedNode]).packetsReceived}</td>
//                     </tr>
//                     <tr>
//                       <td>Bytes Sent:</td>
//                       <td>{getMetaData(nodes[selectedNode]).bytesSent}</td>
//                     </tr>
//                     <tr>
//                       <td>Bytes Received:</td>
//                       <td>{getMetaData(nodes[selectedNode]).bytesReceived}</td>
//                     </tr>
//                   </tbody>
//                 </table>
//               </div>
//             )}

//           </div>
//         </div>
//       )}

//       {lastUpdated && <p className="last-updated">Last updated: {lastUpdated}</p>}

//       <GlobalChatbot
//         globalChatMessages={globalChatMessages}
//         addGlobalChatMessage={addGlobalChatMessage}
//         sendGlobalChatMessage={sendGlobalChatMessage}
//       />
//     </div>
//   );
// };

// export default GlobalControllerDashboard;

// new final experiment 

// import React, { useEffect, useState, useRef } from "react";
// import ApexCharts from "react-apexcharts";
// import { getNodeStatuses } from "../apiService.js";
// import "../GlobalControllerDashboard.css";
// import NetworkVisualizer from "./NetworkVisualizer";
// import GlobalChatbot from "./GlobalChatbot";

// // MetricChart component
// const MetricChart = ({ metrics, title, yLabel, color, valueKey }) => {
//   if (!Array.isArray(metrics) || metrics.length === 0) return <p>No data available.</p>;

//   const data = metrics
//     .map((m) => ({ x: Number(m.time) * 1000, y: Number(m[valueKey]) }))
//     .filter((d) => !isNaN(d.x) && !isNaN(d.y));

//   if (data.length < 2) return <p>Insufficient data points to display graph.</p>;

//   const sortedData = data.sort((a, b) => a.x - b.x);
//   const minX = sortedData[0].x;
//   const maxX = sortedData[sortedData.length - 1].x;

//   const options = {
//     chart: { type: "line", height: 300, animations: { enabled: true, easing: "linear" } },
//     xaxis: { type: "datetime", min: minX, max: maxX, labels: { style: { fontSize: "14px" } } },
//     yaxis: {
//       title: { text: yLabel },
//       labels: { style: { fontSize: "14px" }, formatter: (value) => value.toFixed(2) },
//     },
//     title: {
//       text: title,
//       align: "center",
//       style: { fontSize: "18px", fontWeight: "bold" },
//     },
//     stroke: { width: 2, curve: "smooth" },
//     colors: [color],
//     tooltip: { y: { formatter: (value) => value.toFixed(2) }, x: { format: "HH:mm:ss.SSS" } },
//   };

//   return (
//     <ApexCharts options={options} series={[{ name: title, data: sortedData }]} type="line" height={300} />
//   );
// };

// const GlobalControllerDashboard = () => {
//   const [nodes, setNodes] = useState({});
//   const [error, setError] = useState(null);
//   const [loading, setLoading] = useState(true);
//   const [lastUpdated, setLastUpdated] = useState(null);
//   const [selectedNode, setSelectedNode] = useState(null);
//   const [activePanel, setActivePanel] = useState(null);

//   const [globalChatMessages, setGlobalChatMessages] = useState([
//     { sender: "bot", text: "Hello! How can I assist you with the Central Controller Dashboard?" },
//   ]);
//   const wsRef = useRef(null);
//   const retryCountRef = useRef(0);

//   // Chart colors
//   const colors = [
//     "#FF5733", "#33FF57", "#3357FF",
//     "#FF33A1", "#A133FF", "#33FFA1",
//     "#FFA133", "#FF5733", "#33FF57"
//   ];

//   // Fetch statuses from backend
//   const fetchStatuses = async () => {
//     setLoading(true);
//     setError(null);
//     try {
//       const data = await getNodeStatuses();
//       const normalizedData = Object.keys(data).reduce((acc, key) => {
//         acc[key] = {
//           ...data[key],
//           time_series_metrics: Array.isArray(data[key].time_series_metrics)
//             ? data[key].time_series_metrics
//             : [],
//           packet_details: Array.isArray(data[key].packet_details)
//             ? data[key].packet_details
//             : [],
//         };
//         return acc;
//       }, {});
//       console.log("Fetched node statuses with packet_details:", normalizedData);
//       setNodes(normalizedData);
//       setLastUpdated(new Date().toLocaleString());
//     } catch (err) {
//       console.error("Failed to fetch node statuses:", err);
//       setError("Failed to load node statuses. Please try again.");
//     } finally {
//       setLoading(false);
//     }
//   };

//   // Chat helpers
//   const addGlobalChatMessage = (message) =>
//     setGlobalChatMessages((prev) => [...prev, message]);
//   const sendGlobalChatMessage = (text) => {
//     if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
//       wsRef.current.send(JSON.stringify({ type: "global_chat", message: text }));
//     } else {
//       addGlobalChatMessage({ sender: "bot", text: "Error: Not connected to the server." });
//     }
//   };

//   const connectWebSocket = () => {
//     const ws = new WebSocket("ws://localhost:8000/ws");
//     wsRef.current = ws;
//     ws.onopen = () => {
//       console.log("WebSocket connection established");
//       retryCountRef.current = 0;
//     };
//     ws.onmessage = (event) => {
//       const message = JSON.parse(event.data);
//       if (message.type === "global_chat_response") {
//         addGlobalChatMessage({ sender: "bot", text: message.data });
//       }
//     };
//     ws.onclose = () => {
//       console.log("WebSocket closed, retrying…");
//       const delay = Math.min(1000 * 2 ** retryCountRef.current, 30000);
//       setTimeout(() => {
//         retryCountRef.current += 1;
//         connectWebSocket();
//       }, delay);
//     };
//     ws.onerror = (err) => console.error("WebSocket error:", err);
//   };

//   // On mount: fetch + poll + WS
//   useEffect(() => {
//     fetchStatuses();
//     const id = setInterval(fetchStatuses, 60000);
//     return () => clearInterval(id);
//   }, []);

//   useEffect(() => {
//     connectWebSocket();
//     return () => {
//       if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
//         wsRef.current.close();
//       }
//     };
//   }, []);

//   // Auto-select first node
//   useEffect(() => {
//     if (Object.keys(nodes).length > 0 && (!selectedNode || !nodes[selectedNode])) {
//       setSelectedNode(Object.keys(nodes)[0]);
//     }
//   }, [nodes, selectedNode]);

//   // Rate calculator
//   const calculateRate = (metrics, key) => {
//     if (!Array.isArray(metrics) || metrics.length < 2) return [];
//     const pts = metrics
//       .map((m) => ({ t: Number(m.time), v: Number(m[key] || 0) }))
//       .filter((m) => !isNaN(m.t) && !isNaN(m.v))
//       .sort((a, b) => a.t - b.t);
//     const out = [];
//     for (let i = 1; i < pts.length; i++) {
//       const dt = pts[i].t - pts[i - 1].t;
//       if (dt <= 0) continue;
//       out.push({ time: pts[i].t, rate: Math.max(0, (pts[i].v - pts[i - 1].v) / dt) });
//     }
//     return out;
//   };

//   // Average packet size
//   const calculateAveragePacketSize = (metrics) => {
//     if (!Array.isArray(metrics) || metrics.length < 2) return [];
//     return metrics
//       .map((m) => {
//         const t = Number(m.time);
//         const pk = Number(m.packets) || 0;
//         const bt = Number(m.bytes) || 0;
//         const avg = pk > 0 ? bt / pk : 0;
//         return { time: t, x: t * 1000, y: avg, avg_size: avg };
//       })
//       .filter((d) => !isNaN(d.x) && !isNaN(d.y));
//   };

//   // MetaData summary
//   const getMetaData = (nodeData) => {
//     if (!nodeData || !Array.isArray(nodeData.time_series_metrics)) return {};
//     const m = nodeData.time_series_metrics;
//     const totalPk = m.reduce((s, x) => s + (x.packets || 0), 0);
//     const totalBy = m.reduce((s, x) => s + (x.bytes   || 0), 0);
//     return {
//       ipAddress:      selectedNode,
//       status:         nodeData.attack_detected ? "Under Attack" : "Fine",
//       packetsSent:    Math.floor(totalPk / 2),
//       packetsReceived: totalPk - Math.floor(totalPk / 2),
//       bytesSent:      Math.floor(totalBy / 2),
//       bytesReceived:  totalBy - Math.floor(totalBy / 2),
//     };
//   };

//   return (
//     <div className="global-controller-dashboard">
//       <h2 className="network-title">Network Visualization</h2>

//       <div className="controls-wrapper">
//         <div className="right-controls">
//           <button
//             className={`sub-nav-tab ${activePanel === "Statistics" ? "active" : ""}`}
//             onClick={() => setActivePanel(activePanel === "Statistics" ? null : "Statistics")}
//           >
//             Statistics
//           </button>
//           <button
//             className={`sub-nav-tab ${activePanel === "Meta Data" ? "active" : ""}`}
//             onClick={() => setActivePanel(activePanel === "Meta Data" ? null : "Meta Data")}
//           >
//             Meta Data
//           </button>
//           <button onClick={fetchStatuses} className="refresh-button">
//             Refresh
//           </button>
//         </div>
//       </div>

//       {error && <p className="error">{error}</p>}

//       {loading
//         ? <p>Loading…</p>
//         : Object.keys(nodes).length === 0
//           ? <p>No nodes found.</p>
//           : (
//             <>
//               {/* ────────── TOP SECTION ────────── */}
//               <div className="dashboard-container top-section">

//                 {/* LEFT: network graph */}
//                 <div className="left-panel">
//                   <div className="network-visualization">
//                     <NetworkVisualizer nodes={nodes} onSelectNode={setSelectedNode} />
//                   </div>
//                 </div>

//                 {/* RIGHT: sticky panels */}
//                 <div className="right-panel">
//                   {activePanel === "Statistics" && selectedNode && nodes[selectedNode] && (
//                     <div className="panel-content">
//                       <h3>Statistics for Node {selectedNode}</h3>
//                       <table className="stats-table">
//                         <thead>
//                           <tr>
//                             <th>Time</th>
//                             <th>Source IP</th>
//                             <th>Destination IP</th>
//                             <th>Protocol</th>
//                             <th>Length (B)</th>
//                           </tr>
//                         </thead>
//                         <tbody>
//                           {nodes[selectedNode].packet_details.slice(0, 10).map((pkt, i) => (
//                             <tr key={i}>
//                               <td>{new Date(pkt.timestamp).toLocaleTimeString()}</td>
//                               <td>{pkt.src_ip || "N/A"}</td>
//                               <td>{pkt.dst_ip || "N/A"}</td>
//                               <td>{pkt.protocol || "N/A"}</td>
//                               <td>{pkt.length || "N/A"}</td>
//                             </tr>
//                           ))}
//                         </tbody>
//                       </table>
//                     </div>
//                   )}

//                   {activePanel === "Meta Data" && selectedNode && nodes[selectedNode] && (
//                     <div className="panel-content">
//                       <h3>Meta Data for Node {selectedNode}</h3>
//                       <table className="meta-data-table">
//                         <tbody>
//                           <tr>
//                             <td>IP Address:</td>
//                             <td>{getMetaData(nodes[selectedNode]).ipAddress}</td>
//                           </tr>
//                           <tr>
//                             <td>Status:</td>
//                             <td>{getMetaData(nodes[selectedNode]).status}</td>
//                           </tr>
//                           <tr>
//                             <td>Packets Sent:</td>
//                             <td>{getMetaData(nodes[selectedNode]).packetsSent}</td>
//                           </tr>
//                           <tr>
//                             <td>Packets Received:</td>
//                             <td>{getMetaData(nodes[selectedNode]).packetsReceived}</td>
//                           </tr>
//                           <tr>
//                             <td>Bytes Sent:</td>
//                             <td>{getMetaData(nodes[selectedNode]).bytesSent}</td>
//                           </tr>
//                           <tr>
//                             <td>Bytes Received:</td>
//                             <td>{getMetaData(nodes[selectedNode]).bytesReceived}</td>
//                           </tr>
//                         </tbody>
//                       </table>
//                     </div>
//                   )}
//                 </div>
//               </div>

//               {/* ────────── BOTTOM SECTION ────────── */}
//               <div className="bottom-section">
//                 <h2>Node Details: {selectedNode}</h2>
//                 <div className="node-charts">
//                   {/* Packet Count */}
//                   <div className="chart-container">
//                     <MetricChart
//                       metrics={nodes[selectedNode].time_series_metrics}
//                       title="Packet Count over Time"
//                       yLabel="Packets"
//                       color={colors[0]}
//                       valueKey="packets"
//                     />
//                   </div>

//                   {/* Byte Count */}
//                   <div className="chart-container">
//                     <MetricChart
//                       metrics={nodes[selectedNode].time_series_metrics}
//                       title="Byte Count over Time"
//                       yLabel="Bytes"
//                       color={colors[1]}
//                       valueKey="bytes"
//                     />
//                   </div>

//                   {/* Packet Rate */}
//                   <div className="chart-container">
//                     <MetricChart
//                       metrics={calculateRate(nodes[selectedNode].time_series_metrics, "packets")}
//                       title="Packet Rate over Time"
//                       yLabel="Packets per second"
//                       color={colors[2]}
//                       valueKey="rate"
//                     />
//                   </div>

//                   {/* Throughput */}
//                   <div className="chart-container">
//                     <MetricChart
//                       metrics={calculateRate(nodes[selectedNode].time_series_metrics, "bytes")}
//                       title="Throughput over Time"
//                       yLabel="Bytes per second"
//                       color={colors[3]}
//                       valueKey="rate"
//                     />
//                   </div>

//                   {/* Error Rate */}
//                   {nodes[selectedNode].time_series_metrics.some(m => m.error_count !== undefined) && (
//                     <div className="chart-container">
//                       <MetricChart
//                         metrics={calculateRate(nodes[selectedNode].time_series_metrics, "error_count")}
//                         title="Error Rate over Time"
//                         yLabel="Errors per second"
//                         color={colors[4]}
//                         valueKey="rate"
//                       />
//                     </div>
//                   )}

//                   {/* Anomaly Rate */}
//                   {nodes[selectedNode].time_series_metrics.some(m => m.anomalies_detected !== undefined) && (
//                     <div className="chart-container">
//                       <MetricChart
//                         metrics={calculateRate(nodes[selectedNode].time_series_metrics, "anomalies_detected")}
//                         title="Anomaly Rate over Time"
//                         yLabel="Anomalies per second"
//                         color={colors[5]}
//                         valueKey="rate"
//                       />
//                     </div>
//                   )}

//                   {/* Average Packet Size */}
//                   <div className="chart-container">
//                     <MetricChart
//                       metrics={calculateAveragePacketSize(nodes[selectedNode].time_series_metrics)}
//                       title="Average Packet Size over Time"
//                       yLabel="Bytes per Packet"
//                       color={colors[6]}
//                       valueKey="avg_size"
//                     />
//                   </div>

//                   {/* Latency */}
//                   <div className="chart-container">
//                     <MetricChart
//                       metrics={nodes[selectedNode].time_series_metrics}
//                       title="Latency over Time"
//                       yLabel="Latency (ms)"
//                       color={colors[7]}
//                       valueKey="latency_ms"
//                     />
//                   </div>

//                   {/* Jitter */}
//                   <div className="chart-container">
//                     <MetricChart
//                       metrics={nodes[selectedNode].time_series_metrics}
//                       title="Jitter over Time"
//                       yLabel="Jitter (ms)"
//                       color={colors[8]}
//                       valueKey="jitter_ms"
//                     />
//                   </div>
//                 </div>

//                 <div className="node-info">
//                   <h3>Node Information</h3>
//                   <p>
//                     <strong>Status:</strong>{" "}
//                     {nodes[selectedNode].attack_detected ? "Under Attack" : "Fine"}
//                   </p>
//                   <p>
//                     <strong>Anomalies Detected:</strong>{" "}
//                     {nodes[selectedNode].anomalies_detected}
//                   </p>
//                   <p>
//                     <strong>Summary:</strong> {nodes[selectedNode].summary}
//                   </p>
//                   <p>
//                     <strong>Attack Type:</strong>{" "}
//                     {nodes[selectedNode].attack_type || "N/A"}
//                   </p>
//                 </div>
//               </div>
//             </>
//           )
//       }

//       {lastUpdated && <p className="last-updated">Last updated: {lastUpdated}</p>}

//       <GlobalChatbot
//         globalChatMessages={globalChatMessages}
//         addGlobalChatMessage={addGlobalChatMessage}
//         sendGlobalChatMessage={sendGlobalChatMessage}
//       />
//     </div>
//   );
// };

// export default GlobalControllerDashboard;

// src/components/GlobalControllerDashboard.js

import React, { useEffect, useState, useRef } from "react";
import ApexCharts from "react-apexcharts";
import { getNodeStatuses } from "../apiService.js";
import "../GlobalControllerDashboard.css";
import NetworkVisualizer from "./NetworkVisualizer";
import GlobalChatbot from "./GlobalChatbot";

// ─── MetricChart ───────────────────────────────────────────────────────────────
const MetricChart = ({ metrics, title, yLabel, color, valueKey }) => {
  if (!Array.isArray(metrics) || metrics.length < 2) {
    return <p>Insufficient data points to display graph.</p>;
  }

  const data = metrics
    .map((m) => ({ x: Number(m.time) * 1000, y: Number(m[valueKey] ?? 0) }))
    .filter((d) => !isNaN(d.x) && !isNaN(d.y));

  if (data.length < 2) {
    return <p>Insufficient data points to display graph.</p>;
  }

  const sortedData = data.sort((a, b) => a.x - b.x);
  const minX = sortedData[0].x;
  const maxX = sortedData[sortedData.length - 1].x;

  const options = {
    chart: { type: "line", height: 300, animations: { enabled: true, easing: "linear" } },
    xaxis: { type: "datetime", min: minX, max: maxX, labels: { style: { fontSize: "14px" } } },
    yaxis: {
      title: { text: yLabel },
      labels: { style: { fontSize: "14px" }, formatter: (v) => v.toFixed(2) },
    },
    title: { text: title, align: "center", style: { fontSize: "18px", fontWeight: "bold" } },
    stroke: { width: 2, curve: "smooth" },
    colors: [color],
    tooltip: { y: { formatter: (v) => v.toFixed(2) }, x: { format: "HH:mm:ss.SSS" } },
  };

  return <ApexCharts options={options} series={[{ name: title, data: sortedData }]} type="line" height={300} />;
};

// ─── Main Dashboard ────────────────────────────────────────────────────────────
const GlobalControllerDashboard = () => {
  const [nodes, setNodes] = useState({});
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [activePanel, setActivePanel] = useState(null);

  const [globalChatMessages, setGlobalChatMessages] = useState([
    { sender: "bot", text: "Hello! How can I assist you with the Central Controller Dashboard?" },
  ]);
  const wsRef = useRef(null);
  const retryCountRef = useRef(0);

  const colors = [
    "#FF5733", "#33FF57", "#3357FF",
    "#FF33A1", "#A133FF", "#33FFA1",
    "#FFA133", "#FF5733", "#33FF57",
  ];

  // ─── Fetch & normalize ────────────────────────────────────────────
  const fetchStatuses = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getNodeStatuses();
      const normalized = Object.fromEntries(
        Object.entries(data).map(([k, v]) => [
          k,
          {
            ...v,
            time_series_metrics: Array.isArray(v.time_series_metrics) ? v.time_series_metrics : [],
            packet_details: Array.isArray(v.packet_details) ? v.packet_details : [],
          },
        ])
      );
      setNodes(normalized);
      setLastUpdated(new Date().toLocaleString());
    } catch (e) {
      console.error(e);
      setError("Failed to load node statuses.");
    } finally {
      setLoading(false);
    }
  };

  // ─── WebSocket chat ───────────────────────────────────────────────
  const addGlobalChatMessage = (msg) => setGlobalChatMessages((m) => [...m, msg]);
  const sendGlobalChatMessage = (text) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "global_chat", message: text }));
    } else {
      addGlobalChatMessage({ sender: "bot", text: "Error: Not connected." });
    }
  };
  const connectWebSocket = () => {
    const ws = new WebSocket("ws://localhost:8000/ws");
    wsRef.current = ws;
    ws.onopen = () => { retryCountRef.current = 0; };
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.type === "global_chat_response") addGlobalChatMessage({ sender: "bot", text: msg.data });
    };
    ws.onclose = () => {
      const delay = Math.min(1000 * 2 ** retryCountRef.current, 30000);
      setTimeout(() => {
        retryCountRef.current++;
        connectWebSocket();
      }, delay);
    };
    ws.onerror = console.error;
  };

  useEffect(() => {
    fetchStatuses();
    const id = setInterval(fetchStatuses, 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    connectWebSocket();
    return () => wsRef.current?.close();
  }, []);

  // ─── Auto-select first node ────────────────────────────────────────
  useEffect(() => {
    const keys = Object.keys(nodes);
    if (keys.length && !nodes[selectedNode]) {
      setSelectedNode(keys[0]);
    }
  }, [nodes, selectedNode]);

  // ─── Helpers ───────────────────────────────────────────────────────
  const calculateRate = (m, key) => {
    if (!Array.isArray(m) || m.length < 2) return [];
    const sorted = m
      .map((x) => ({ t: +x.time, v: +x[key] || 0 }))
      .filter((x) => !isNaN(x.t) && !isNaN(x.v))
      .sort((a, b) => a.t - b.t);
    const out = [];
    for (let i = 1; i < sorted.length; i++) {
      const dt = sorted[i].t - sorted[i - 1].t;
      if (dt > 0) out.push({ time: sorted[i].t, rate: (sorted[i].v - sorted[i - 1].v) / dt });
    }
    return out;
  };
  const calculateAveragePacketSize = (m) =>
    Array.isArray(m) && m.length > 1
      ? m
          .map((x) => {
            const t = +x.time;
            const pk = +x.packets || 0,
                  bt = +x.bytes   || 0,
                  avg = pk > 0 ? bt / pk : 0;
            return { time: t, x: t * 1000, y: avg, avg_size: avg };
          })
          .filter((d) => !isNaN(d.x) && !isNaN(d.y))
      : [];

  const getMetaData = (nd) => {
    const m = nd?.time_series_metrics ?? [];
    const totalPk = m.reduce((s, x) => s + (x.packets || 0), 0);
    const totalBy = m.reduce((s, x) => s + (x.bytes   || 0), 0);
    return {
      ipAddress:      selectedNode,
      status:         nd.attack_detected ? "Under Attack" : "Fine",
      packetsSent:    Math.floor(totalPk / 2),
      packetsReceived: totalPk - Math.floor(totalPk / 2),
      bytesSent:      Math.floor(totalBy / 2),
      bytesReceived:  totalBy - Math.floor(totalBy / 2),
    };
  };

  // ─── Render ────────────────────────────────────────────────────────
  const current = nodes[selectedNode] || null;

  return (
    <div className="global-controller-dashboard">
      <h2 className="network-title">Network Visualization</h2>

      {/* ─── Controls ─────────────────────────────────────────────── */}
      <div className="controls-wrapper">
        <button
          className={`sub-nav-tab ${activePanel === "Statistics" ? "active" : ""}`}
          onClick={() => setActivePanel(activePanel === "Statistics" ? null : "Statistics")}
        >
          Statistics
        </button>
        <button
          className={`sub-nav-tab ${activePanel === "Meta Data" ? "active" : ""}`}
          onClick={() => setActivePanel(activePanel === "Meta Data" ? null : "Meta Data")}
        >
          Meta Data
        </button>
        <button className="refresh-button" onClick={fetchStatuses}>
          Refresh
        </button>
      </div>

      {error && <p className="error">{error}</p>}
      {loading && <p>Loading…</p>}

      {!loading && current && (
        <>
          {/* ─── TOP: viz + side panel ───────────────────────── */}
          <div className="dashboard-container">
            <div className="left-panel">
              <div className="network-visualization">
                <NetworkVisualizer nodes={nodes} onSelectNode={setSelectedNode} />
              </div>
            </div>

            <div className="right-panel">
              {activePanel === "Statistics" && (
                <div className="panel-content">
                  <h3>Statistics for Node {selectedNode}</h3>
                  {current.packet_details.length ? (
                    <table className="stats-table">
                      <thead>
                        <tr>
                          <th>Time</th>
                          <th>Source IP</th>
                          <th>Destination IP</th>
                          <th>Protocol</th>
                          <th>Length (B)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {current.packet_details.slice(0, 10).map((pkt, i) => (
                          <tr key={i}>
                            <td>{new Date(pkt.timestamp * 1000).toLocaleTimeString()}</td>
                            <td>{pkt.src_ip}</td>
                            <td>{pkt.dst_ip}</td>
                            <td>{pkt.protocol}</td>
                            <td>{pkt.length}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p>No packet details available.</p>
                  )}
                </div>
              )}
              {activePanel === "Meta Data" && (
                <div className="panel-content">
                  <h3>Meta Data for Node {selectedNode}</h3>
                  <table className="meta-data-table">
                    <tbody>
                      {Object.entries(getMetaData(current)).map(([label, val]) => (
                        <tr key={label}>
                          <td>{label.replace(/([A-Z])/g, " $1") + ":"}</td>
                          <td>{val}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* ─── BOTTOM: full-width charts & info ───────────── */}
          <div className="bottom-section">
            <div className="node-charts">
              <h2>Node Details: {selectedNode}</h2>
              <div className="chart-grid">
                <MetricChart
                  metrics={current.time_series_metrics}
                  title="Packet Count over Time"
                  yLabel="Packets"
                  color={colors[0]}
                  valueKey="packets"
                />
                <MetricChart
                  metrics={current.time_series_metrics}
                  title="Byte Count over Time"
                  yLabel="Bytes"
                  color={colors[1]}
                  valueKey="bytes"
                />
                <MetricChart
                  metrics={calculateRate(current.time_series_metrics, "packets")}
                  title="Packet Rate over Time"
                  yLabel="Packets/s"
                  color={colors[2]}
                  valueKey="rate"
                />
                <MetricChart
                  metrics={calculateRate(current.time_series_metrics, "bytes")}
                  title="Throughput over Time"
                  yLabel="Bytes/s"
                  color={colors[3]}
                  valueKey="rate"
                />
                <MetricChart
                  metrics={calculateAveragePacketSize(current.time_series_metrics)}
                  title="Average Packet Size"
                  yLabel="Bytes/packet"
                  color={colors[4]}
                  valueKey="avg_size"
                />
                <MetricChart
                  metrics={current.time_series_metrics}
                  title="Latency over Time"
                  yLabel="Latency (ms)"
                  color={colors[5]}
                  valueKey="latency_ms"
                />
                <MetricChart
                  metrics={current.time_series_metrics}
                  title="Jitter over Time"
                  yLabel="Jitter (ms)"
                  color={colors[6]}
                  valueKey="jitter_ms"
                />
              </div>
            </div>

            <div className="node-info">
              <h3>Node Information</h3>
              <p>
                <strong>Status:</strong> {current.attack_detected ? "Under Attack" : "Fine"}
              </p>
              <p>
                <strong>Anomalies Detected:</strong> {current.anomalies_detected ?? 0}
              </p>
              <p>
                <strong>Summary:</strong> {current.summary ?? "N/A"}
              </p>
              <p>
                <strong>Attack Type:</strong> {current.attack_type ?? "N/A"}
              </p>
            </div>
          </div>
        </>
      )}

      {lastUpdated && <p className="last-updated">Last updated: {lastUpdated}</p>}

      <GlobalChatbot
        globalChatMessages={globalChatMessages}
        addGlobalChatMessage={addGlobalChatMessage}
        sendGlobalChatMessage={sendGlobalChatMessage}
      />
    </div>
  );
};

export default GlobalControllerDashboard;
