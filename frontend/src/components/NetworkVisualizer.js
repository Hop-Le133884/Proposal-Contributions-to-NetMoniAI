// // export default NetworkVisualizer;

// import React, { useEffect, useRef } from "react";
// import * as d3 from "d3";
// import "./NetworkVisualizer.css";

// // Generates a mapping from node IP → your internal filename key
// const getIpToFilenameMap = (nodes, nodesData) => {
//   const ipToFilenameMap = {};
//   const filenames = Object.keys(nodes).sort();

//   filenames.forEach((filename) => {
//     const { node_ip, ip_address } = nodes[filename];
//     const ip = node_ip || ip_address;
//     if (ip && nodesData.find((n) => n.id === ip)) {
//       ipToFilenameMap[ip] = filename;
//     }
//   });

//   if (Object.keys(ipToFilenameMap).length < nodesData.length) {
//     filenames.forEach((filename, idx) => {
//       if (idx < nodesData.length) {
//         const ip = nodesData[idx].id;
//         if (!ipToFilenameMap[ip]) {
//           ipToFilenameMap[ip] = filename;
//         }
//       }
//     });
//   }

//   return ipToFilenameMap;
// };

// const NetworkVisualizer = ({ nodes, onSelectNode }) => {
//   const svgRef = useRef();

//   useEffect(() => {
//     const SVG_W = 1200; // Increased from 800
//     const SVG_H = 900; // Increased from 600
//     const NODE_RADIUS = 40; // Increased from 30 for better readability
//     const LABEL_PX = 18; // Increased from 14 for better readability

//     // Clear out old drawing
//     const svg = d3.select(svgRef.current);
//     svg.selectAll("*").remove();

//     // Set up SVG with new dimensions
//     svg
//       .attr("viewBox", `0 0 ${SVG_W} ${SVG_H}`)
//       .attr("preserveAspectRatio", "xMidYMid meet")
//       .attr("width", SVG_W)
//       .attr("height", SVG_H);

//     // Tooltip div
//     const tooltip = d3
//       .select("body")
//       .append("div")
//       .attr("class", "tooltip")
//       .style("opacity", 0);

//     Promise.all([d3.json("/nodes_data.json"), d3.json("/packets_data.json")])
//       .then(([nodesData, packetsData]) => {
//         if (!nodesData?.length) return;

//         const ipMap = getIpToFilenameMap(nodes, nodesData);
//         const nodeIds = new Set(nodesData.map((d) => d.id));

//         // Process packetsData to get unique undirected links
//         const linkSet = new Set();
//         const links = [];
//         packetsData.forEach((pkt) => {
//           const source = pkt.src;
//           const target = pkt.dst;
//           if (nodeIds.has(source) && nodeIds.has(target) && source !== target) {
//             const key =
//               source < target ? `${source}-${target}` : `${target}-${source}`;
//             if (!linkSet.has(key)) {
//               linkSet.add(key);
//               links.push({ source, target });
//             }
//           }
//         });

//         // Define scaling factors based on original SVG size
//         const original_SVG_W = 800;
//         const original_SVG_H = 600;
//         const scaleX = SVG_W / original_SVG_W; // 1.5
//         const scaleY = SVG_H / original_SVG_H; // 1.5

//         // Enrich nodes, scale initial positions, and clamp within bounds
//         const enriched = nodesData.map((d) => {
//           const key = ipMap[d.id] || d.id;
//           const attack = !!nodes[key]?.attack_detected;
//           const scaledX = d.x * scaleX;
//           const scaledY = d.y * scaleY;
//           return {
//             ...d,
//             attack_detected: attack,
//             x: Math.max(NODE_RADIUS, Math.min(scaledX, SVG_W - NODE_RADIUS)),
//             y: Math.max(NODE_RADIUS, Math.min(scaledY, SVG_H - NODE_RADIUS)),
//           };
//         });

//         // Enhanced force simulation to prevent overlapping
//         const sim = d3
//           .forceSimulation(enriched)
//           .force("x", d3.forceX((d) => d.x).strength(0.1)) // Reduced from 1
//           .force("y", d3.forceY((d) => d.y).strength(0.1)) // Reduced from 1
//           .force("collide", d3.forceCollide(NODE_RADIUS + 20)) // Adjusted for larger nodes
//           .force("charge", d3.forceManyBody().strength(-50)) // Added repulsion
//           .stop();

//         // Run simulation for more ticks to ensure settling
//         for (let i = 0; i < 300; i++) sim.tick(); // Increased from 120

//         // Map of simulated positions for drawing lines and nodes
//         const simulatedNodeMap = new Map(
//           enriched.map((d) => [d.id, { x: d.x, y: d.y }])
//         );

//         // Append groups for links and nodes
//         const linkGroup = svg.append("g").attr("class", "links");
//         const nodeGroup = svg.append("g").attr("class", "nodes");

//         // Draw thin lines between nodes
//         linkGroup
//           .selectAll("line")
//           .data(links)
//           .enter()
//           .append("line")
//           .attr("x1", (d) => simulatedNodeMap.get(d.source).x)
//           .attr("y1", (d) => simulatedNodeMap.get(d.source).y)
//           .attr("x2", (d) => simulatedNodeMap.get(d.target).x)
//           .attr("y2", (d) => simulatedNodeMap.get(d.target).y)
//           .attr("stroke", "blue")
//           .attr("stroke-width", 0.2); // Thin lines

//         // Draw node groups at settled positions
//         const groups = nodeGroup
//           .selectAll(".node")
//           .data(enriched, (d) => d.id)
//           .enter()
//           .append("g")
//           .attr("class", "node")
//           .attr("transform", (d) => `translate(${d.x},${d.y})`);

//         // Circle for each node
//         groups
//           .append("circle")
//           .attr("r", NODE_RADIUS)
//           .style("fill", (d) => (d.attack_detected ? "red" : "green"))
//           .on("mouseover", function (evt, d) {
//             d3.select(this)
//               .attr("r", NODE_RADIUS * 1.2)
//               .style("fill", "orange");
//             tooltip
//               .html(`Node: ${d.id}`)
//               .style("left", `${evt.pageX + 5}px`)
//               .style("top", `${evt.pageY - 28}px`)
//               .transition()
//               .duration(200)
//               .style("opacity", 0.9);
//           })
//           .on("mouseout", function (evt, d) {
//             d3.select(this)
//               .attr("r", NODE_RADIUS)
//               .style("fill", d.attack_detected ? "red" : "green");
//             tooltip.transition().duration(500).style("opacity", 0);
//           })
//           .on("click", (e, d) => onSelectNode?.(d.id));

//         // Label for each node
//         groups
//           .append("text")
//           .attr("dy", -(NODE_RADIUS + 6))
//           .attr("text-anchor", "middle")
//           .style("font-size", `${LABEL_PX}px`)
//           .style("pointer-events", "none")
//           .text((d) => d.id);
//       })
//       .catch(console.error);

//     // Cleanup tooltip on unmount
//     return () => tooltip.remove();
//   }, [nodes, onSelectNode]);

//   return (
//     <div className="container">
//       <svg ref={svgRef} />
//     </div>
//   );
// };

// export default NetworkVisualizer;

//2nd Version

// import React, { useEffect, useRef } from "react";
// import * as d3 from "d3";
// import "./NetworkVisualizer.css";

// // Generates a mapping from node IP → your internal filename key
// const getIpToFilenameMap = (nodes, nodesData) => {
//   const ipToFilenameMap = {};
//   const filenames = Object.keys(nodes).sort();

//   filenames.forEach((filename) => {
//     const { node_ip, ip_address } = nodes[filename];
//     const ip = node_ip || ip_address;
//     if (ip && nodesData.find((n) => n.id === ip)) {
//       ipToFilenameMap[ip] = filename;
//     }
//   });

//   if (Object.keys(ipToFilenameMap).length < nodesData.length) {
//     filenames.forEach((filename, idx) => {
//       if (idx < nodesData.length) {
//         const ip = nodesData[idx].id;
//         if (!ipToFilenameMap[ip]) {
//           ipToFilenameMap[ip] = filename;
//         }
//       }
//     });
//   }

//   return ipToFilenameMap;
// };

// const NetworkVisualizer = ({ nodes, onSelectNode }) => {
//   const svgRef = useRef();

//   useEffect(() => {
//     const SVG_W = 1200; // Increased from 800
//     const SVG_H = 900; // Increased from 600
//     const NODE_RADIUS = 40; // Increased from 30 for better readability
//     const LABEL_PX = 18; // Increased from 14 for better readability

//     // Clear out old drawing
//     const svg = d3.select(svgRef.current);
//     svg.selectAll("*").remove();

//     // Set up SVG with new dimensions
//     svg
//       .attr("viewBox", `0 0 ${SVG_W} ${SVG_H}`)
//       .attr("preserveAspectRatio", "xMidYMid meet")
//       .attr("width", SVG_W)
//       .attr("height", SVG_H);

//     // Tooltip div
//     const tooltip = d3
//       .select("body")
//       .append("div")
//       .attr("class", "tooltip")
//       .style("opacity", 0);

//     Promise.all([d3.json("/nodes_data.json"), d3.json("/packets_data.json")])
//       .then(([nodesData, packetsData]) => {
//         if (!nodesData?.length) return;

//         const ipMap = getIpToFilenameMap(nodes, nodesData);
//         const nodeIds = new Set(nodesData.map((d) => d.id));

//         // Process packetsData to get unique undirected links
//         const linkSet = new Set();
//         const links = [];
//         packetsData.forEach((pkt) => {
//           const source = pkt.src;
//           const target = pkt.dst;
//           if (nodeIds.has(source) && nodeIds.has(target) && source !== target) {
//             const key =
//               source < target ? `${source}-${target}` : `${target}-${source}`;
//             if (!linkSet.has(key)) {
//               linkSet.add(key);
//               links.push({ source, target });
//             }
//           }
//         });

//         // Define scaling factors based on original SVG size
//         const original_SVG_W = 800;
//         const original_SVG_H = 600;
//         const scaleX = SVG_W / original_SVG_W; // 1.5
//         const scaleY = SVG_H / original_SVG_H; // 1.5

//         // Enrich nodes, scale initial positions, and clamp within bounds
//         const enriched = nodesData.map((d) => {
//           const key = ipMap[d.id] || d.id;
//           const attack = !!nodes[key]?.attack_detected;
//           const scaledX = d.x * scaleX;
//           const scaledY = d.y * scaleY;
//           return {
//             ...d,
//             attack_detected: attack,
//             x: Math.max(NODE_RADIUS, Math.min(scaledX, SVG_W - NODE_RADIUS)),
//             y: Math.max(NODE_RADIUS, Math.min(scaledY, SVG_H - NODE_RADIUS)),
//           };
//         });

//         // Enhanced force simulation to prevent overlapping
//         const sim = d3
//           .forceSimulation(enriched)
//           .force("x", d3.forceX((d) => d.x).strength(0.1)) // Reduced from 1
//           .force("y", d3.forceY((d) => d.y).strength(0.1)) // Reduced from 1
//           .force("collide", d3.forceCollide(NODE_RADIUS + 20)) // Adjusted for larger nodes
//           .force("charge", d3.forceManyBody().strength(-50)) // Added repulsion
//           .stop();

//         // Run simulation for more ticks to ensure settling
//         for (let i = 0; i < 300; i++) sim.tick(); // Increased from 120

//         // Map of simulated positions for drawing lines and nodes
//         const simulatedNodeMap = new Map(
//           enriched.map((d) => [d.id, { x: d.x, y: d.y }])
//         );

//         // Append groups for links and nodes
//         const linkGroup = svg.append("g").attr("class", "links");
//         const nodeGroup = svg.append("g").attr("class", "nodes");

//         // Draw dotted lines between nodes
//         linkGroup
//           .selectAll("line")
//           .data(links)
//           .enter()
//           .append("line")
//           .attr("x1", (d) => simulatedNodeMap.get(d.source).x)
//           .attr("y1", (d) => simulatedNodeMap.get(d.source).y)
//           .attr("x2", (d) => simulatedNodeMap.get(d.target).x)
//           .attr("y2", (d) => simulatedNodeMap.get(d.target).y)
//           .attr("stroke", "black")
//           .attr("stroke-width", 1) // Thin lines
//           .attr("stroke-dasharray", "5,5"); // Dotted lines

//         // Draw node groups at settled positions
//         const groups = nodeGroup
//           .selectAll(".node")
//           .data(enriched, (d) => d.id)
//           .enter()
//           .append("g")
//           .attr("class", "node")
//           .attr("transform", (d) => `translate(${d.x},${d.y})`);

//         // Circle for each node
//         groups
//           .append("circle")
//           .attr("r", NODE_RADIUS)
//           .style("fill", (d) => (d.attack_detected ? "red" : "green"))
//           .on("mouseover", function (evt, d) {
//             d3.select(this)
//               .attr("r", NODE_RADIUS * 1.2)
//               .style("fill", "orange");
//             tooltip
//               .html(`Node: ${d.id}`)
//               .style("left", `${evt.pageX + 5}px`)
//               .style("top", `${evt.pageY - 28}px`)
//               .transition()
//               .duration(200)
//               .style("opacity", 0.9);
//           })
//           .on("mouseout", function (evt, d) {
//             d3.select(this)
//               .attr("r", NODE_RADIUS)
//               .style("fill", d.attack_detected ? "red" : "green");
//             tooltip.transition().duration(500).style("opacity", 0);
//           })
//           .on("click", (e, d) => onSelectNode?.(d.id));

//         // Label for each node
//         groups
//           .append("text")
//           .attr("dy", -(NODE_RADIUS + 6))
//           .attr("text-anchor", "middle")
//           .style("font-size", `${LABEL_PX}px`)
//           .style("pointer-events", "none")
//           .text((d) => d.id);
//       })
//       .catch(console.error);

//     // Cleanup tooltip on unmount
//     return () => tooltip.remove();
//   }, [nodes, onSelectNode]);

//   return (
//     <div className="container">
//       <svg ref={svgRef} />
//     </div>
//   );
// };

// export default NetworkVisualizer;

//3rd Version
// import React, { useEffect, useRef } from "react";
// import * as d3 from "d3";
// import "./NetworkVisualizer.css";

// // Generates a mapping from node IP → your internal filename key
// const getIpToFilenameMap = (nodes, nodesData) => {
//   const ipToFilenameMap = {};
//   const filenames = Object.keys(nodes).sort();

//   filenames.forEach((filename) => {
//     const { node_ip, ip_address } = nodes[filename];
//     const ip = node_ip || ip_address;
//     if (ip && nodesData.find((n) => n.id === ip)) {
//       ipToFilenameMap[ip] = filename;
//     }
//   });

//   if (Object.keys(ipToFilenameMap).length < nodesData.length) {
//     filenames.forEach((filename, idx) => {
//       if (idx < nodesData.length) {
//         const ip = nodesData[idx].id;
//         if (!ipToFilenameMap[ip]) {
//           ipToFilenameMap[ip] = filename;
//         }
//       }
//     });
//   }

//   return ipToFilenameMap;
// };

// const NetworkVisualizer = ({ nodes, onSelectNode }) => {
//   const svgRef = useRef();

//   useEffect(() => {
//     const SVG_W = 1200; // Increased from 800
//     const SVG_H = 900; // Increased from 600
//     const NODE_RADIUS = 40; // Increased from 30 for better readability
//     const LABEL_PX = 18; // Increased from 14 for better readability

//     // Clear out old drawing
//     const svg = d3.select(svgRef.current);
//     svg.selectAll("*").remove();

//     // Set up SVG with new dimensions
//     svg
//       .attr("viewBox", `0 0 ${SVG_W} ${SVG_H}`)
//       .attr("preserveAspectRatio", "xMidYMid meet")
//       .attr("width", SVG_W)
//       .attr("height", SVG_H);

//     // Tooltip div
//     const tooltip = d3
//       .select("body")
//       .append("div")
//       .attr("class", "tooltip")
//       .style("opacity", 0);

//     Promise.all([d3.json("/nodes_data.json"), d3.json("/packets_data.json")])
//       .then(([nodesData, packetsData]) => {
//         if (!nodesData?.length) return;

//         const ipMap = getIpToFilenameMap(nodes, nodesData);
//         const nodeIds = new Set(nodesData.map((d) => d.id));

//         // Define scaling factors based on original SVG size
//         const original_SVG_W = 800;
//         const original_SVG_H = 600;
//         const scaleX = SVG_W / original_SVG_W; // 1.5
//         const scaleY = SVG_H / original_SVG_H; // 1.5

//         // Enrich nodes, scale initial positions, and clamp within bounds
//         const enriched = nodesData.map((d) => {
//           const key = ipMap[d.id] || d.id;
//           const attack = !!nodes[key]?.attack_detected;
//           const scaledX = d.x * scaleX;
//           const scaledY = d.y * scaleY;
//           return {
//             ...d,
//             attack_detected: attack,
//             x: Math.max(NODE_RADIUS, Math.min(scaledX, SVG_W - NODE_RADIUS)),
//             y: Math.max(NODE_RADIUS, Math.min(scaledY, SVG_H - NODE_RADIUS)),
//           };
//         });

//         // Enhanced force simulation to prevent overlapping
//         const sim = d3
//           .forceSimulation(enriched)
//           .force("x", d3.forceX((d) => d.x).strength(0.1))
//           .force("y", d3.forceY((d) => d.y).strength(0.1))
//           .force("collide", d3.forceCollide(NODE_RADIUS + 20))
//           .force("charge", d3.forceManyBody().strength(-50))
//           .stop();

//         // Run simulation for more ticks to ensure settling
//         for (let i = 0; i < 300; i++) sim.tick();

//         // Map of simulated positions for drawing nodes and packets
//         const simulatedNodeMap = new Map(
//           enriched.map((d) => [d.id, { x: d.x, y: d.y }])
//         );

//         // Append group for nodes
//         const nodeGroup = svg.append("g").attr("class", "nodes");

//         // Draw node groups at settled positions
//         const groups = nodeGroup
//           .selectAll(".node")
//           .data(enriched, (d) => d.id)
//           .enter()
//           .append("g")
//           .attr("class", "node")
//           .attr("transform", (d) => `translate(${d.x},${d.y})`);

//         // Circle for each node
//         groups
//           .append("circle")
//           .attr("r", NODE_RADIUS)
//           .style("fill", (d) => (d.attack_detected ? "red" : "green"))
//           .on("mouseover", function (evt, d) {
//             d3.select(this)
//               .attr("r", NODE_RADIUS * 1.2)
//               .style("fill", "orange");
//             tooltip
//               .html(`Node: ${d.id}`)
//               .style("left", `${evt.pageX + 5}px`)
//               .style("top", `${evt.pageY - 28}px`)
//               .transition()
//               .duration(200)
//               .style("opacity", 0.9);
//           })
//           .on("mouseout", function (evt, d) {
//             d3.select(this)
//               .attr("r", NODE_RADIUS)
//               .style("fill", d.attack_detected ? "red" : "green");
//             tooltip.transition().duration(500).style("opacity", 0);
//           })
//           .on("click", (e, d) => onSelectNode?.(d.id));

//         // Label for each node
//         groups
//           .append("text")
//           .attr("dy", -(NODE_RADIUS + 6))
//           .attr("text-anchor", "middle")
//           .style("font-size", `${LABEL_PX}px`)
//           .style("pointer-events", "none")
//           .text((d) => d.id);

//         // Packet animation
//         if (!packetsData || packetsData.length === 0) {
//           console.warn("No packet data to animate.");
//           return;
//         }

//         packetsData.forEach((pkt, i) => {
//           const srcNode = simulatedNodeMap.get(pkt.src);
//           const dstNode = simulatedNodeMap.get(pkt.dst);

//           if (!srcNode || !dstNode) {
//             console.warn(
//               `Skipping packet ${i}: Source or destination node not found.`
//             );
//             return;
//           }

//           const packetCircle = svg
//             .append("circle")
//             .attr("class", "packet")
//             .attr("r", 8)
//             .attr("cx", srcNode.x)
//             .attr("cy", srcNode.y)
//             .style("opacity", 0);

//           // Animation timing parameters
//           const simulationSpeedFactor = 200000000;
//           const packetStartDelayFactor = 1000000;
//           const forcePacketDuration = null;

//           let packetDurationMs =
//             (pkt.timestamp_end - pkt.timestamp_start) * simulationSpeedFactor;
//           let validDurationMs = Math.max(50, packetDurationMs);

//           if (forcePacketDuration !== null && forcePacketDuration > 0) {
//             validDurationMs = forcePacketDuration;
//           }

//           const startDelayMs = pkt.timestamp_start * packetStartDelayFactor;

//           packetCircle
//             .transition()
//             .delay(startDelayMs)
//             .style("opacity", 1)
//             .duration(validDurationMs)
//             .attr("cx", dstNode.x)
//             .attr("cy", dstNode.y)
//             .transition()
//             .duration(200)
//             .style("opacity", 0)
//             .remove();
//         });
//       })
//       .catch(console.error);

//     // Cleanup tooltip on unmount
//     return () => tooltip.remove();
//   }, [nodes, onSelectNode]);

//   return (
//     <div className="container">
//       <svg ref={svgRef} />
//     </div>
//   );
// };

// export default NetworkVisualizer;

// current working code

// import React, { useEffect, useRef } from "react";
// import * as d3 from "d3";
// import "./NetworkVisualizer.css";

// // Generates a mapping from node IP → your internal filename key
// const getIpToFilenameMap = (nodes, nodesData) => {
//   const ipToFilenameMap = {};
//   const filenames = Object.keys(nodes).sort();

//   filenames.forEach((filename) => {
//     const { node_ip, ip_address } = nodes[filename];
//     const ip = node_ip || ip_address;
//     if (ip && nodesData.find((n) => n.id === ip)) {
//       ipToFilenameMap[ip] = filename;
//     }
//   });

//   if (Object.keys(ipToFilenameMap).length < nodesData.length) {
//     filenames.forEach((filename, idx) => {
//       if (idx < nodesData.length) {
//         const ip = nodesData[idx].id;
//         if (!ipToFilenameMap[ip]) {
//           ipToFilenameMap[ip] = filename;
//         }
//       }
//     });
//   }

//   return ipToFilenameMap;
// };

// const NetworkVisualizer = ({ nodes, onSelectNode }) => {
//   const svgRef = useRef();

//   useEffect(() => {
//     const SVG_W = 800; // Restored to original width for better fit
//     const SVG_H = 600; // Restored to original height for better fit
//     const NODE_RADIUS = 20; // Adjusted radius for visibility

//     // Clear out old drawing
//     const svg = d3.select(svgRef.current);
//     svg.selectAll("*").remove();

//     // Set up SVG with new dimensions
//     svg
//       .attr("viewBox", `0 0 ${SVG_W} ${SVG_H}`)
//       .attr("preserveAspectRatio", "xMidYMid meet")
//       .attr("width", "100%")
//       .attr("height", "auto");

//     // Tooltip div
//     const tooltip = d3
//       .select("body")
//       .append("div")
//       .attr("class", "tooltip")
//       .style("opacity", 0);

//     Promise.all([d3.json("/nodes_data.json"), d3.json("/packets_data.json")])
//       .then(([nodesData, packetsData]) => {
//         if (!nodesData?.length) return;

//         const ipMap = getIpToFilenameMap(nodes, nodesData);
//         const nodeIds = new Set(nodesData.map((d) => d.id));

//         // Define scaling factors based on original SVG size (800x600)
//         const original_SVG_W = 800;
//         const original_SVG_H = 600;
//         const scaleX = SVG_W / original_SVG_W; // 1.0 (no scaling needed)
//         const scaleY = SVG_H / original_SVG_H; // 1.0 (no scaling needed)

//         // Enrich nodes, scale initial positions, and clamp within bounds
//         const enriched = nodesData.map((d) => {
//           const key = ipMap[d.id] || d.id;
//           const attack = !!nodes[key]?.attack_detected;
//           const scaledX = d.x * scaleX;
//           const scaledY = d.y * scaleY;
//           return {
//             ...d,
//             attack_detected: attack,
//             x: Math.max(NODE_RADIUS, Math.min(scaledX, SVG_W - NODE_RADIUS)),
//             y: Math.max(NODE_RADIUS, Math.min(scaledY, SVG_H - NODE_RADIUS)),
//           };
//         });

//         // Enhanced force simulation to prevent excessive spreading
//         const sim = d3
//           .forceSimulation(enriched)
//           .force("x", d3.forceX((d) => d.x).strength(0.2)) // Increased strength to anchor nodes
//           .force("y", d3.forceY((d) => d.y).strength(0.2)) // Increased strength to anchor nodes
//           .force("collide", d3.forceCollide(NODE_RADIUS + 5)) // Reduced collision distance
//           .force("charge", d3.forceManyBody().strength(-20)) // Reduced repulsion
//           .stop();

//         // Run simulation for more ticks to ensure settling
//         for (let i = 0; i < 150; i++) sim.tick(); // Reduced ticks to prevent over-spreading

//         // Map of simulated positions for drawing nodes and packets
//         const simulatedNodeMap = new Map(
//           enriched.map((d) => [d.id, { x: d.x, y: d.y }])
//         );

//         // Append group for nodes
//         const nodeGroup = svg.append("g").attr("class", "nodes");

//         // Draw node groups at settled positions
//         const groups = nodeGroup
//           .selectAll(".node")
//           .data(enriched, (d) => d.id)
//           .enter()
//           .append("g")
//           .attr("class", "node")
//           .attr("transform", (d) => `translate(${d.x},${d.y})`);

//         // Circle for each node
//         groups
//           .append("circle")
//           .attr("r", NODE_RADIUS)
//           .style("fill", (d) => (d.attack_detected ? "red" : "green"))
//           .on("mouseover", function (evt, d) {
//             d3.select(this)
//               .attr("r", NODE_RADIUS * 1.2)
//               .style("fill", "orange");
//             tooltip
//               .html(`Node: ${d.id}`)
//               .style("left", `${evt.pageX + 5}px`)
//               .style("top", `${evt.pageY - 28}px`)
//               .transition()
//               .duration(200)
//               .style("opacity", 0.9);
//           })
//           .on("mouseout", function (evt, d) {
//             d3.select(this)
//               .attr("r", NODE_RADIUS)
//               .style("fill", d.attack_detected ? "red" : "green");
//             tooltip.transition().duration(500).style("opacity", 0);
//           })
//           .on("click", (e, d) => onSelectNode?.(d.id));

//         // Label for each node
//         groups
//           .append("text")
//           .attr("dy", -(NODE_RADIUS + 6))
//           .attr("text-anchor", "middle")
//           .style("font-size", "12px")
//           .style("pointer-events", "none")
//           .text((d) => d.id);

//         // Packet animation
//         if (!packetsData || packetsData.length === 0) {
//           console.warn("No packet data to animate.");
//           return;
//         }

//         packetsData.forEach((pkt, i) => {
//           const srcNode = simulatedNodeMap.get(pkt.src);
//           const dstNode = simulatedNodeMap.get(pkt.dst);

//           if (!srcNode || !dstNode) {
//             console.warn(
//               `Skipping packet ${i}: Source or destination node not found.`
//             );
//             return;
//           }

//           const packetCircle = svg
//             .append("circle")
//             .attr("class", "packet")
//             .attr("r", 5)
//             .attr("cx", srcNode.x)
//             .attr("cy", srcNode.y)
//             .style("opacity", 0);

//           const simulationSpeedFactor = 200000000;
//           const packetStartDelayFactor = 1000000;
//           const forcePacketDuration = null;

//           let packetDurationMs =
//             (pkt.timestamp_end - pkt.timestamp_start) * simulationSpeedFactor;
//           let validDurationMs = Math.max(50, packetDurationMs);

//           if (forcePacketDuration !== null && forcePacketDuration > 0) {
//             validDurationMs = forcePacketDuration;
//           }

//           const startDelayMs = pkt.timestamp_start * packetStartDelayFactor;

//           packetCircle
//             .transition()
//             .delay(startDelayMs)
//             .style("opacity", 1)
//             .duration(validDurationMs)
//             .attr("cx", dstNode.x)
//             .attr("cy", dstNode.y)
//             .transition()
//             .duration(200)
//             .style("opacity", 0)
//             .remove();
//         });
//       })
//       .catch(console.error);

//     // Cleanup tooltip on unmount
//     return () => tooltip.remove();
//   }, [nodes, onSelectNode]);

//   return (
//     <div className="container">
//       <svg ref={svgRef} />
//     </div>
//   );
// };

// export default NetworkVisualizer;

// new experiment:

// src/components/NetworkVisualizer.js
import React, { useEffect, useRef } from "react";
import * as d3 from "d3";
import "./NetworkVisualizer.css";

// Generates a mapping from node IP → your internal filename key
const getIpToFilenameMap = (nodes, nodesData) => {
  const ipToFilenameMap = {};
  const filenames = Object.keys(nodes).sort();

  filenames.forEach((filename) => {
    const { node_ip, ip_address } = nodes[filename];
    const ip = node_ip || ip_address;
    if (ip && nodesData.find((n) => n.id === ip)) {
      ipToFilenameMap[ip] = filename;
    }
  });

  // If we still haven’t covered all nodes, fall back to index order
  if (Object.keys(ipToFilenameMap).length < nodesData.length) {
    filenames.forEach((filename, idx) => {
      if (idx < nodesData.length) {
        const ip = nodesData[idx].id;
        if (!ipToFilenameMap[ip]) {
          ipToFilenameMap[ip] = filename;
        }
      }
    });
  }

  return ipToFilenameMap;
};

const NetworkVisualizer = ({ nodes, onSelectNode }) => {
  const svgRef = useRef();

  useEffect(() => {
    const SVG_W = 800;
    const SVG_H = 600;
    const NODE_RADIUS = 20;

    // clear prior drawing
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // set up SVG
    svg
      .attr("viewBox", `0 0 ${SVG_W} ${SVG_H}`)
      .attr("preserveAspectRatio", "xMidYMid meet")
      .attr("width", "100%")
      .attr("height", "auto");

    // tooltip
    const tooltip = d3
      .select("body")
      .append("div")
      .attr("class", "tooltip")
      .style("opacity", 0);

    // load topology + packet data
    Promise.all([d3.json("/nodes_data.json"), d3.json("/packets_data.json")])
      .then(([nodesData, packetsData]) => {
        if (!nodesData?.length) return;

        const ipMap = getIpToFilenameMap(nodes, nodesData);
        // scale & clamp node positions
        const enriched = nodesData.map((d) => {
          const key = ipMap[d.id] || d.id;
          const attack = !!nodes[key]?.attack_detected;
          return {
            ...d,
            attack_detected: attack,
            x: Math.max(NODE_RADIUS, Math.min(d.x, SVG_W - NODE_RADIUS)),
            y: Math.max(NODE_RADIUS, Math.min(d.y, SVG_H - NODE_RADIUS)),
          };
        });

        // force‐layout (just to settle nodes)
        const sim = d3
          .forceSimulation(enriched)
          .force("x", d3.forceX((d) => d.x).strength(0.2))
          .force("y", d3.forceY((d) => d.y).strength(0.2))
          .force("collide", d3.forceCollide(NODE_RADIUS + 5))
          .force("charge", d3.forceManyBody().strength(-20))
          .stop();
        for (let i = 0; i < 150; i++) sim.tick();

        // map for quick lookups
        const nodePos = new Map(enriched.map((d) => [d.id, { x: d.x, y: d.y }]));

        // draw nodes
        const groups = svg
          .append("g")
          .attr("class", "nodes")
          .selectAll(".node")
          .data(enriched, (d) => d.id)
          .enter()
          .append("g")
          .attr("class", "node")
          .attr("transform", (d) => `translate(${d.x},${d.y})`);

        groups
          .append("circle")
          .attr("r", NODE_RADIUS)
          .style("fill", (d) => (d.attack_detected ? "red" : "green"))
          .on("mouseover", function (evt, d) {
            d3.select(this).attr("r", NODE_RADIUS * 1.2).style("fill", "orange");
            tooltip
              .html(`Node: ${d.id}`)
              .style("left", `${evt.pageX + 5}px`)
              .style("top", `${evt.pageY - 28}px`)
              .transition()
              .duration(200)
              .style("opacity", 0.9);
          })
          .on("mouseout", function (evt, d) {
            d3.select(this)
              .attr("r", NODE_RADIUS)
              .style("fill", d.attack_detected ? "red" : "green");
            tooltip.transition().duration(500).style("opacity", 0);
          })
          .on("click", (e, d) => onSelectNode?.(d.id));

        groups
          .append("text")
          .attr("dy", -(NODE_RADIUS + 6))
          .attr("text-anchor", "middle")
          .style("font-size", "12px")
          .style("pointer-events", "none")
          .text((d) => d.id);

        // ——— Packet animation (with real‐time timing) ———
        if (!packetsData || packetsData.length === 0) {
          console.warn("No packet data to animate.");
          return;
        }

        // baseline: earliest packet time
        const t0 = d3.min(packetsData, (pkt) => pkt.timestamp_start);
        const msPerSecond = 10000;
        const playbackSpeed = 1; // 1× real time

        packetsData.forEach((pkt, i) => {
          const src = nodePos.get(pkt.src);
          const dst = nodePos.get(pkt.dst);
          if (!src || !dst) {
            console.warn(`Skipping packet ${i}: ${pkt.src}→${pkt.dst}`);
            return;
          }

          const delayMs = (pkt.timestamp_start - t0) * msPerSecond / playbackSpeed;
          const rawDur = (pkt.timestamp_end - pkt.timestamp_start) * msPerSecond / playbackSpeed;
          const durMs = Math.max(1500, Math.min(rawDur, 2000));

          svg.append("circle")
            .attr("class", "packet")
            .attr("r", 5)
            .attr("cx", src.x)
            .attr("cy", src.y)
            .style("opacity", 0)
            .transition()
              .delay(delayMs)
              .style("opacity", 1)
              .duration(durMs)
              .attr("cx", dst.x)
              .attr("cy", dst.y)
            .transition()
              .duration(200)
              .style("opacity", 0)
              .remove();
        });
        // — end packet animation ———
      })
      .catch(console.error);

    // clean up on unmount
    return () => tooltip.remove();
  }, [nodes, onSelectNode]);

  return (
    <div className="container">
      <svg ref={svgRef} />
    </div>
  );
};

export default NetworkVisualizer;
