from fastapi import FastAPI, HTTPException
import json
from fastapi.middleware.cors import CORSMiddleware
import asyncio
from nw_agents.ParameterTuningAgent import ParameterTuningAgent
from nw_agents.ReportingAgent import ReportingAgent
from nw_agents.PerformanceMonitoringAgent import PerformanceMonitoringAgent
from nw_agents.SecurityAnalysisAgent import SecurityAnalysisAgent
from nw_agents.ChatAgent import ChatAgent
from appWebsocket import broadcaster, websocket_endpoint
from config import metrics_queue, attack_queue, reports_queue
from contextlib import asynccontextmanager
import logging
import time

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting application...")

    performance_to_tuning_queue = asyncio.Queue()
    tuning_to_performance_queue = asyncio.Queue()
    performance_to_security_queue = asyncio.Queue()
    security_to_performance_queue = asyncio.Queue()
    security_to_report_queue = asyncio.Queue()

    app.state.performance_to_tuning_queue = performance_to_tuning_queue

    performance_agent = PerformanceMonitoringAgent(
        metrics_queue, performance_to_tuning_queue, tuning_to_performance_queue,
        performance_to_security_queue, security_to_performance_queue
    )

    tuning_agent = ParameterTuningAgent(performance_to_tuning_queue, tuning_to_performance_queue)

    security_agent = SecurityAnalysisAgent(
        performance_to_security_queue, security_to_performance_queue, 
        attack_queue, security_to_report_queue
    )

    reporting_agent = ReportingAgent(security_to_report_queue, reports_queue)

    app.state.performance_agent = performance_agent
    app.state.chat_agent = ChatAgent
    # Add node_statuses to app.state
    app.state.node_statuses = node_statuses

    asyncio.create_task(performance_agent.run())
    asyncio.create_task(tuning_agent.run())
    asyncio.create_task(security_agent.run())
    asyncio.create_task(reporting_agent.run())
    asyncio.create_task(broadcaster())
    yield
    logger.info("Shutting down application...")

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # React app’s origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.websocket("/ws")(websocket_endpoint)

node_statuses = {}

@app.post("/gcreport")
async def receive_report(report: dict):
    logger.info(f"Received report: {report}")
    node_ip = report.get("node_ip")
    if not node_ip:
        return {"error": "node_ip is required"}, 400
    node_statuses[node_ip] = report
    return {"message": f"Report for {node_ip} received"}

@app.get("/gcstatuses")
async def get_statuses():
    return node_statuses

@app.get("/gccorrelation")
async def get_correlation():
    """
    
    Analyzes node reports to determine roles in the network.
    """
    attackers = []
    victims = []
    
    for ip, status in node_statuses.items():
        # Using the BERT detection results we just generated
        is_attack = status.get("attack_detected", False)
        
        # In a SYN Flood, the BERT model labels the aggressive traffic patterns.
        # We can also check confidence to ensure we only label high-probability attackers.
        if is_attack and status.get("confidence", 0) > 0.8:
            attackers.append(ip)
        else:
            # Nodes with normal traffic or identified as 'clear' are the victims/bystanders
            victims.append(ip)
            
    return {
        "attackers": attackers,
        "victims": victims,
        "total_nodes": len(node_statuses),
        "timestamp": time.ctime()
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)