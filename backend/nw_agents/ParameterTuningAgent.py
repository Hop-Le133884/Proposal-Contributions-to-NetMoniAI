import asyncio
from common_classes import MyDeps, ParameterResult
from secretKeys import GEMINI_API_KEY
from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIModel
import logging

logger = logging.getLogger(__name__) 

class ParameterTuningAgent:
    def __init__(self, performance_to_tuning_queue: asyncio.Queue, tuning_to_performance_queue: asyncio.Queue):
        self.performance_to_tuning_queue = performance_to_tuning_queue
        self.tuning_to_performance_queue = tuning_to_performance_queue
        
        self.sys_prompt = (
            "You are a parameter tuning agent. Based on network conditions, previous analysis, and historical data, "
            "set optimal capture duration (30-40 seconds) and cycle interval (5-30 seconds). "
            "Guidelines: Increase duration and decrease interval if attacks are frequent or latency is high; "
            "otherwise, decrease duration and increase interval."
        )
        self.model = OpenAIModel('gpt-4o')
        self.agent = Agent(
            model=self.model,
            system_prompt=self.sys_prompt,
            model_settings={'temperature': 0.3},
            output_retries=3,
            retries=3,
            output_type=ParameterResult
        )

    async def run(self) -> None:
        """Adjust monitoring parameters based on current and historical network conditions."""
        while True:
            data = await self.performance_to_tuning_queue.get()
            metrics = data["metrics"]
            previous_attack_detected = data["previous_attack_detected"]
            recent_history = data.get("recent_history", [])
            
            if recent_history:
                latencies = [entry["avg_latency"] for entry in recent_history if entry["avg_latency"] is not None]
                attacks = [entry["attack_detected"] for entry in recent_history if entry["attack_detected"] is not None]
                avg_latency_history = sum(latencies) / len(latencies) if latencies else None
                num_attacks = sum(1 for attack in attacks if attack)
            else:
                avg_latency_history = None
                num_attacks = 0
            
            prompt = (
                f"Tune parameters based on current network conditions, previous analysis, and historical data. "
                f"Current average latency: {metrics['aggregates']['avg_latency']} ms, "
                f"current packet loss: {metrics['aggregates']['avg_loss']} %, "
                f"previous attack detected: {previous_attack_detected}, "
                f"number of attacks in last 10 cycles: {num_attacks}, "
                f"average latency in last 10 cycles: {avg_latency_history or 'N/A'} ms."
            )
            param_result = await self.agent.run(user_prompt=prompt, deps=MyDeps())
            updated_deps = MyDeps(duration=param_result.output.duration, cycle_interval=param_result.output.interval)
            await self.tuning_to_performance_queue.put(updated_deps)