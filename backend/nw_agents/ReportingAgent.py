import logging
import asyncio
import os
import time
import uuid
from collections import deque

logger = logging.getLogger(__name__)

from pydantic_ai import Agent, RunContext
from common_classes import NetworkReport, MyDeps, AnalysisResult
from dotenv import load_dotenv
load_dotenv()
from tools.pcap_analyzer import analyze_pcap_summary

# ---------------------------------------------------------------------------
# Model selection — controlled by LLM_PROVIDER env var (set by benchmark_log.py)
#   LLM_PROVIDER=groq   → LLaMA 3.3 70B via Groq LPU  (default)
#   LLM_PROVIDER=openai → GPT-4o via OpenAI
# ---------------------------------------------------------------------------
_provider = os.getenv("LLM_PROVIDER", "groq").lower()
if _provider == "openai":
    from pydantic_ai.models.openai import OpenAIModel
    active_model = OpenAIModel("gpt-4o")
else:
    from pydantic_ai.models.groq import GroqModel
    active_model = GroqModel("llama-3.3-70b-versatile")

logger.info(f"[ReportingAgent] Using model provider: {_provider.upper()}")

# ---------------------------------------------------------------------------
# Proposal 1: Hybrid Detection Strategy
#   high   (≥90% BERT) → brief_reporting_agent  — short prompt, ~50% fewer tokens
#   medium (70–89%)    → reporting_agent         — full analysis (original behaviour)
#   low    (<70%)      → _generate_local_report  — pure Python, zero API cost
# ---------------------------------------------------------------------------

# --- Full analysis agent (medium confidence: 70–89%) ---
FULL_SYS_PROMPT = """
You are a network analysis reporting agent. Generate comprehensive reports on network anomalies
and security incidents using attack detection data and raw BERT model output. For each report:

1. Analyze attack data, raw BERT model output (attack type counts), and network metrics to identify patterns and anomalies
2. Determine the type and severity of any detected attacks based on BERT classifications
3. Recommend specific mitigation actions with clear priorities, tailored to identified attack types
4. Suggest further investigation steps when appropriate
5. Create concise but thorough summaries suitable for both technical and non-technical readers

Be specific and actionable in your recommendations. Include command suggestions when appropriate.
Include a confidence level based on the clarity of the evidence and the volume of attack traffic in the BERT output.
"""

# --- Brief analysis agent (high confidence: ≥90%) ---
BRIEF_SYS_PROMPT = """
You are a rapid-response security analyst. BERT has already confirmed an attack with very high confidence (≥90%).
Generate a focused, action-oriented incident report. Be direct and concise.
Prioritize immediate mitigation commands over lengthy investigation text.
"""

# Full analysis agent — used for medium-confidence detections
reporting_agent = Agent(
    model=active_model,
    system_prompt=FULL_SYS_PROMPT,
    model_settings={'temperature': 0.2},
    output_retries=3,
    retries=3,
    output_type=NetworkReport
)

# Brief analysis agent — used for high-confidence detections (no PCAP tool = faster)
brief_reporting_agent = Agent(
    model=active_model,
    system_prompt=BRIEF_SYS_PROMPT,
    model_settings={'temperature': 0.1},
    output_retries=2,
    retries=2,
    output_type=NetworkReport
)

# Tools for the full analysis agent only
@reporting_agent.tool
def get_pcap_summary(ctx: RunContext[MyDeps]) -> dict:
    print(f"Analyzing {ctx.deps.pathToFile}")
    return analyze_pcap_summary(ctx.deps.pathToFile)

@reporting_agent.tool
def generate_report_id(ctx: RunContext[MyDeps]) -> str:
    return f"NR-{uuid.uuid4().hex[:8]}-{int(time.time())}"

@reporting_agent.tool
def format_timestamp(ctx: RunContext[MyDeps]) -> str:
    return time.strftime("%Y-%m-%d %H:%M:%S")

@reporting_agent.tool
def get_network_metrics(ctx: RunContext[MyDeps]) -> dict:
    return {
        "latency": ctx.deps.avg_latency if ctx.deps.avg_latency is not None else 0.0,
        "packet_loss": ctx.deps.avg_loss if ctx.deps.avg_loss is not None else 0.0,
        "duration": ctx.deps.duration,
        "interval": ctx.deps.cycle_interval
    }


# ---------------------------------------------------------------------------
# Internal helpers for each path
# ---------------------------------------------------------------------------

async def _run_brief_report(analysis_result: dict, deps: MyDeps,
                             avg_latency: float, avg_loss: float,
                             duration: int) -> tuple[NetworkReport, int]:
    """Brief cloud prompt for high-confidence (≥90%) BERT detections."""
    raw_bert = analysis_result.get('raw_bert_output', {})
    label = next(iter(raw_bert.keys()), "Unknown Attack")
    score = next(iter(raw_bert.values()), 0.0)

    prompt = (
        f"HIGH-CONFIDENCE ATTACK CONFIRMED: BERT classified this traffic as '{label}' "
        f"with {score:.1%} confidence.\n"
        f"Network state: Latency={avg_latency}ms, PacketLoss={avg_loss}%, Capture={duration}s.\n"
        f"Generate a focused incident report. Confirm the attack type, assess severity (Low/Medium/High/Critical), "
        f"and provide the top 3 prioritized mitigation commands."
    )
    result = await brief_reporting_agent.run(user_prompt=prompt, deps=deps)
    usage = result.usage()
    return result.output, (usage.total_tokens if usage else 0)


async def _run_full_report(analysis_result: dict, deps: MyDeps,
                            avg_latency: float, avg_loss: float,
                            duration: int, cycle_interval: int) -> tuple[NetworkReport, int]:
    """Full cloud analysis for medium-confidence (70–89%) BERT detections."""
    raw_bert_output = (
        analysis_result.get('raw_bert_output', {})
        if isinstance(analysis_result, dict)
        else getattr(analysis_result, 'raw_bert_output', {})
    )
    attack_detected = (
        analysis_result.get('attack_detected', False)
        if isinstance(analysis_result, dict)
        else analysis_result.attack_detected
    )
    details = (
        analysis_result.get('details', '')
        if isinstance(analysis_result, dict)
        else analysis_result.details
    )

    prompt = (
        f"Generate a comprehensive report based on the following data:\n"
        f"- Attack detection result: {attack_detected}\n"
        f"- Detection details: {details}\n"
        f"- Raw BERT model output (attack type counts): {raw_bert_output}\n"
        f"- Network metrics: Latency={avg_latency}ms, Loss={avg_loss}%, "
        f"Duration={duration}s, Interval={cycle_interval}s\n"
        f"- BERT Confidence: MEDIUM — provide deeper analysis to validate and contextualize this threat.\n"
        f"Use the raw BERT output to identify specific attack types and their severity."
    )
    result = await reporting_agent.run(user_prompt=prompt, deps=deps)
    usage = result.usage()
    return result.output, (usage.total_tokens if usage else 0)


def _generate_local_report(analysis_result: dict,
                            avg_latency: float, avg_loss: float) -> NetworkReport:
    """Pure-Python report for low-confidence / no-attack results — zero API cost."""
    raw_bert = analysis_result.get('raw_bert_output', {})
    label = next(iter(raw_bert.keys()), "Normal")
    score = next(iter(raw_bert.values()), 0.0)

    return NetworkReport(
        report_id=f"NR-LOCAL-{uuid.uuid4().hex[:8]}-{int(time.time())}",
        timestamp=time.strftime("%Y-%m-%d %H:%M:%S"),
        summary=(
            f"BERT classified traffic as '{label}' with {score:.1%} confidence — "
            f"below the 70% attack threshold. No cloud analysis required."
        ),
        attack_detected=False,
        attack_type=None,
        confidence=score,
        metrics_summary=f"Latency: {avg_latency}ms, Loss: {avg_loss}%",
        anomalies_detected="No significant anomalies detected above threshold.",
        potential_causes="Normal network traffic or minor fluctuation.",
        recommended_actions="Continue standard monitoring. No immediate action required.",
        further_investigation=None,
    )


# ---------------------------------------------------------------------------
# Public dispatcher — called by ReportingAgent and analyze_nodes.py
# ---------------------------------------------------------------------------

async def generate_network_report(analysis_result, pcap_path: str,
                                   duration: int, cycle_interval: int,
                                   avg_latency: float = None, avg_loss: float = None,
                                   confidence_tier: str = "medium") -> NetworkReport:
    """
    Dispatch to the appropriate reporting path based on BERT confidence tier.

    Tiers (set by SecurityAnalysisAgent):
        high   → brief cloud prompt  (~50% fewer tokens, shorter latency)
        medium → full cloud analysis (original behaviour)
        low    → local Python report (zero API cost)
    """
    t_start = time.perf_counter()

    # --- Path: local (no cloud) ---
    if confidence_tier == "low":
        report = _generate_local_report(analysis_result, avg_latency, avg_loss)
        elapsed_ms = (time.perf_counter() - t_start) * 1000
        logger.info(
            f"[Hybrid|LOCAL] no-cloud report in {elapsed_ms:.0f}ms | 0 tokens"
        )
        report.analysis_strategy = "local_no_cloud"
        report.time_to_report_ms = round(elapsed_ms, 1)
        return report

    deps = MyDeps(
        pathToFile=pcap_path,
        duration=duration,
        cycle_interval=cycle_interval,
        avg_latency=avg_latency,
        avg_loss=avg_loss
    )

    try:
        if confidence_tier == "high":
            report, tokens = await _run_brief_report(
                analysis_result, deps, avg_latency, avg_loss, duration
            )
            strategy = "high_confidence_brief"
        else:  # medium
            report, tokens = await _run_full_report(
                analysis_result, deps, avg_latency, avg_loss, duration, cycle_interval
            )
            strategy = "medium_confidence_full"

        elapsed_ms = (time.perf_counter() - t_start) * 1000
        logger.info(
            f"[Hybrid|{strategy.upper()}|LLaMA-3.3-70B] report in {elapsed_ms:.0f}ms | {tokens} tokens"
        )
        report.analysis_strategy = strategy
        report.time_to_report_ms = round(elapsed_ms, 1)
        return report

    except Exception as e:
        logger.error(f"Error generating report: {e}")
        elapsed_ms = (time.perf_counter() - t_start) * 1000
        return NetworkReport(
            report_id=f"NR-ERROR-{int(time.time())}",
            timestamp=time.strftime("%Y-%m-%d %H:%M:%S"),
            summary=f"Report generation failed: {str(e)}",
            attack_detected=(
                analysis_result.get('attack_detected', False)
                if isinstance(analysis_result, dict)
                else analysis_result.attack_detected
            ),
            attack_type=None,
            confidence=0.0,
            metrics_summary=f"Latency: {avg_latency}ms, Loss: {avg_loss}%",
            anomalies_detected="Error in analysis",
            potential_causes="Unknown due to error",
            recommended_actions="Please retry analysis",
            further_investigation="Investigate report generation failure",
            analysis_strategy="error",
            time_to_report_ms=round(elapsed_ms, 1),
        )


# ---------------------------------------------------------------------------
# ReportingAgent — queue-based runner consumed by app.py and analyze_nodes.py
# ---------------------------------------------------------------------------

class ReportingAgent:
    def __init__(self, security_to_reporting_queue: asyncio.Queue,
                 reports_queue: asyncio.Queue):
        self.security_to_reporting_queue = security_to_reporting_queue
        self.reports_queue = reports_queue
        self.metrics_history = deque(maxlen=50)

    async def generate_report(self, attack_data: dict,
                               metrics_data: dict, pcap_path: str):
        """Generate report via the appropriate hybrid strategy."""
        confidence_tier = attack_data.get("confidence_tier", "medium")
        logger.info(
            f"[Hybrid] Routing to '{confidence_tier.upper()}' strategy "
            f"(attack_detected={attack_data.get('attack_detected')})"
        )

        # High-confidence attacks get faster turnaround (3 s debounce vs 15 s for medium)
        debounce = 3 if confidence_tier == "high" else 15
        if confidence_tier != "low":
            await asyncio.sleep(debounce)

        try:
            report = await generate_network_report(
                analysis_result=attack_data,
                pcap_path=pcap_path,
                duration=metrics_data.get("duration", 5),
                cycle_interval=metrics_data.get("interval", 2),
                avg_latency=metrics_data.get("latency"),
                avg_loss=metrics_data.get("packet_loss"),
                confidence_tier=confidence_tier,
            )
            await self.reports_queue.put(report)
            logger.info(
                f"[Hybrid] Report ready | id={report.report_id} | "
                f"strategy={report.analysis_strategy} | "
                f"time_to_report={report.time_to_report_ms}ms"
            )
            return report
        except Exception as e:
            logger.error(f"Error generating report: {e}")
            return None

    async def update_metrics_history(self, metrics: dict):
        self.metrics_history.append(metrics)

    async def run(self):
        while True:
            data = await self.security_to_reporting_queue.get()
            await self.generate_report(
                data["attack_data"],
                data["metrics_data"],
                data["pcap_path"]
            )
