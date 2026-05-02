import asyncio
import asyncio
from secretKeys import GEMINI_API_KEY
from pydantic_ai import Agent
# Add this:
from pydantic_ai.models.openai import OpenAIModel

import logging
logger = logging.getLogger(__name__)

ChatAgent = Agent(
    model = OpenAIModel('gpt-4o'),
    system_prompt="You are a network monitoring assistant. Based on the provided network metrics, answer the user's question about the current network performance.",
    model_settings={'temperature': 0.5},
    output_retries=3,
    retries=3,
    output_type=str
)
