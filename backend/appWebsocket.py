from fastapi import WebSocket, WebSocketDisconnect
import asyncio
from config import metrics_queue, attack_queue, connected_clients, reports_queue
import logging

logger = logging.getLogger(__name__)

async def broadcaster():
    while True:
        if not metrics_queue.empty():
            metrics = await metrics_queue.get()
            logger.info(f"Metrics at {metrics['timestamp']}: "
                        f"Throughput Sent: {metrics['throughput_sent']:.2f} B/s, "
                        f"Throughput Recv: {metrics['throughput_recv']:.2f} B/s, "
                        f"Avg Latency: {metrics['aggregates']['avg_latency']:.2f} ms, "
                        f"Avg Loss: {metrics['aggregates']['avg_loss']:.2f}%")
            for client in connected_clients:
                try:
                    await client.send_json({"type": "metrics", "data": metrics})
                except Exception as e:
                    logger.error(f"Error sending metrics to client: {e}")
        if not attack_queue.empty():
            attack_result = await attack_queue.get()
            logger.info(f"Attack Detection Result: {attack_result}")
            for client in connected_clients:
                try:
                    await client.send_json({"type": "attack_detection", "data": attack_result})
                except Exception as e:
                    logger.error(f"Error sending attack result to client: {e}")
        if not reports_queue.empty():
            report = await reports_queue.get()
            logger.info(f"Network Report {report.report_id} generated")
            for client in connected_clients:
                try:
                    await client.send_json({"type": "network_report", "data": report.model_dump()})
                except Exception as e:
                    logger.error(f"Error sending report to client: {e}")

        await asyncio.sleep(0.1)


async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_clients.add(websocket)
    logger.info("Client connected")
    try:
        while True:
            data = await websocket.receive_json()
            if data.get('type') == 'chat':
                user_message = data.get('message')
                performance_agent = websocket.app.state.performance_agent

                latest_metrics = performance_agent.latest_metrics or (
                    performance_agent.sliding_window[-1] if performance_agent.sliding_window else None
                )
                if latest_metrics:
                    metrics_str = (
                        f"- Bytes sent: {latest_metrics['bytes_sent']}\n"
                        f"- Bytes received: {latest_metrics['bytes_recv']}\n"
                        f"- Throughput sent: {latest_metrics['throughput_sent']} B/s\n"
                        f"- Throughput received: {latest_metrics['throughput_recv']} B/s\n"
                        f"- External latency: {latest_metrics['external_ping']['avg_latency']} ms\n"
                        f"- External packet loss: {latest_metrics['external_ping']['packet_loss']}%\n"
                        f"- Local latency: {latest_metrics['local_ping']['avg_latency']} ms"
                    )
                else:
                    metrics_str = "No metrics available yet."

                prompt = (
                    f"User question: {user_message}\n\n"
                    f"Latest network metrics:\n{metrics_str}\n\n"
                    f"Please provide a concise answer to the user's question based on these metrics."
                )

                try:
                    chat_agent = websocket.app.state.chat_agent
                    response = await chat_agent.run(user_prompt=prompt)
                    await websocket.send_json({"type": "chat_response", "data": response.output})
                except Exception as e:
                    logger.error(f"Error generating chat response: {e}")
                    await websocket.send_json({"type": "chat_response", "data": "Sorry, I couldn't generate a response at this time."})

            elif data.get('type') == 'global_chat':
                user_message = data.get('message')
                node_statuses = websocket.app.state.node_statuses

                if not node_statuses:
                    await websocket.send_json({
                        "type": "global_chat_response",
                        "data": "No node statuses available yet. Please check back later."
                    })
                    continue

                node_statuses_str = "\n".join([
                    f"- {ip}:\n"
                    f"  Status: {'Under Attack' if status['attack_detected'] else 'Fine'}\n"
                    f"  Attack Type: {status.get('attack_type', 'N/A')}\n"
                    f"  Confidence: {status.get('confidence', 'N/A')}\n"
                    f"  Anomalies Detected: {status.get('anomalies_detected', 'N/A')}\n"
                    f"  Summary: {status.get('summary', 'No summary available')}"
                    for ip, status in node_statuses.items()
                ])

                prompt = (
                    f"User question: {user_message}\n\n"
                    f"Current node statuses:\n{node_statuses_str}\n\n"
                    f"Please provide a concise answer to the user's question based on these node statuses."
                )

                try:
                    chat_agent = websocket.app.state.chat_agent
                    response = await chat_agent.run(user_prompt=prompt)
                    await websocket.send_json({"type": "global_chat_response", "data": response.output})
                except Exception as e:
                    logger.error(f"Error generating global chat response: {e}")
                    await websocket.send_json({"type": "global_chat_response", "data": "Sorry, I couldn't generate a response at this time."})

    except WebSocketDisconnect:
        connected_clients.remove(websocket)
        logger.info("Client disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
