from pydantic import BaseModel, Field
from typing import Optional
from dataclasses import dataclass

class AttackDetectionResult(BaseModel):
    op: str = Field(description="Result of the attack detection operation")

class AnalysisResult(BaseModel):
    attack_detected: bool = Field(description="Whether an attack was detected")
    details: Optional[str] = Field(default=None, description="Additional details about the analysis")

class ParameterResult(BaseModel):
    duration: int = Field(description="Updated capture duration in seconds")
    interval: int = Field(description="Interval in seconds before the next monitoring cycle")

@dataclass
class MyDeps:
    pathToFile: str = Field(description="Path to the PCAP file")
    duration: int = Field(default=5, description="Duration of data collection in seconds")
    cycle_interval: int = Field(default=2, description="Interval between monitoring cycles")
    avg_latency: float = Field(default=None, description="Average network latency")
    avg_loss: float = Field(default=None, description="Average packet loss")
    api_key: str = None

class EnhancedAnalysisResult(AnalysisResult):
    raw_bert_output: dict = Field(default_factory=dict, description="Raw attack type counts from BERT model")

class NetworkReport(BaseModel):
    report_id: str = Field(description="Unique identifier for the report")
    timestamp: str = Field(description="Timestamp when the report was generated")
    summary: str = Field(description="Executive summary of findings")
    attack_detected: bool = Field(description="Whether an attack was detected")
    attack_type: Optional[str] = Field(default=None, description="Type of attack if detected")
    confidence: float = Field(description="Confidence level in the analysis (0-1)")
    metrics_summary: str = Field(description="Summary of key network metrics")
    anomalies_detected: str = Field(description="Description of detected anomalies")
    potential_causes: str = Field(description="Analysis of potential causes")
    recommended_actions: str = Field(description="Recommended mitigation actions")
    further_investigation: Optional[str] = Field(default=None, description="Recommendations for further investigation")
    # Proposal 1 evaluation fields
    analysis_strategy: Optional[str] = Field(default=None, description="Detection strategy used: high_confidence_brief, medium_confidence_full, or local_no_cloud")
    time_to_report_ms: Optional[float] = Field(default=None, description="Milliseconds elapsed to generate this report (excludes debounce delay)")