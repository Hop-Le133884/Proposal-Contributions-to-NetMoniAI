# Proposal Contributions to NetMoniAI

**Original Paper**: [NetMoniAI: An Agentic AI Framework for Network Security & Monitoring](https://arxiv.org/abs/2508.10052)  
**Original Repository**: [github.com/pzambare3/NetMoniAI](https://github.com/pzambare3/NetMoniAI)  
**Author of Contributions**: Hop Le — Texas A&M University San Antonio

---

This repository extends the NetMoniAI framework with three implementation contributions proposed as improvements over the original paper and its published codebase.

---

## Background

NetMoniAI is a two-tier agentic AI framework for network security monitoring. It deploys autonomous micro-agents at each network node for local traffic analysis, and a centralized controller to correlate findings across nodes and detect coordinated attacks.

The original paper describes using BERT for local inference and an LLM (GPT-O3 / Gemini Pro) for centralized reasoning. However, **the published GitHub implementation does not include BERT** — the local inference layer was not implemented. Additionally, the original system sends every detection to the cloud LLM regardless of confidence, and does not evaluate latency or token cost of report generation.

These three contributions address those gaps.

---

## Contribution 1: BERT Integration for Local Node Inference

**Problem**: The original paper lists BERT (HuggingFace) as a component in Table III, but the published code does not implement it. All traffic classification was done by the cloud LLM.

**Implementation**: Integrated `rdpahalavan/bert-network-packet-flow-header-payload`, a network-specialized BERT model, into `SecurityAnalysisAgent`. The model runs locally on GPU via the HuggingFace `transformers` pipeline, eliminating the need for a cloud call on every packet capture cycle.

```
Packet capture (tshark/scapy)
        ↓
SecurityAnalysisAgent — BERT on local GPU
        ↓
Confidence score + attack label
        ↓
Routes to cloud LLM only when needed (Contribution 2)
```

**Key file**: `backend/nw_agents/SecurityAnalysisAgent.py`

---

## Contribution 2: Hybrid Detection Strategy (Three-Tier Routing)

**Problem**: The original system invokes the cloud LLM for every BERT detection, regardless of how confident BERT already is. This wastes API tokens and adds latency for clear-cut attacks.

**Implementation**: Added a confidence-tiered dispatch in `ReportingAgent` that routes each detection to the most cost-appropriate path:

| BERT Confidence | Tier | Reporting Path | API Cost |
|---|---|---|---|
| ≥ 90% | High | Brief cloud prompt — action-focused | Low |
| 70–89% | Medium | Full cloud analysis — deep investigation | Higher |
| < 70% | Low | Local Python report — no cloud call | Zero |

Each generated report records `analysis_strategy` and `time_to_report_ms` for evaluation.

**Key file**: `backend/nw_agents/ReportingAgent.py`

---

## Contribution 3: Groq LPU Inference (LLaMA 3.3 70B)

**Problem**: The original system uses GPT-4o (or GPT-O3) running on OpenAI GPU infrastructure. For time-critical network incident response, the latency of frontier GPU-based models is a bottleneck.

**Implementation**: Replaced GPT-4o with LLaMA 3.3 70B served via Groq's LPU (Language Processing Unit) — custom silicon designed specifically for LLM inference. Groq LPU achieves substantially faster token generation than GPU-based serving.

**Benchmark results** (8-node Web Attack – Brute Force scenario, `high_confidence_brief` path, run 2026-05-02):

| Model | Hardware | Avg Time-to-Report | Avg Tokens | Speedup |
|---|---|---|---|---|
| GPT-4o | OpenAI GPU cloud | 2,677 ms | 608 | baseline |
| LLaMA 3.3 70B | Groq LPU cloud | **773 ms** | 810 | **3.5×** |

Both models correctly identified all 8 nodes as under brute force attack — same accuracy, significantly different speed.

Raw benchmark data: `paper/benchmark_gpt4o.csv`, `paper/benchmark_groq.csv`, `paper/benchmark_all.csv`

**Key file**: `backend/nw_agents/ReportingAgent.py`

---

## Model Assignment

| Agent | Model | Where it runs |
|---|---|---|
| SecurityAnalysisAgent | BERT (`rdpahalavan/bert-network-packet-flow-header-payload`) | Local GPU |
| ReportingAgent | LLaMA 3.3 70B | Groq LPU (cloud) |
| ParameterTuningAgent | GPT-4o | OpenAI (cloud) |
| ChatAgent | GPT-4o | OpenAI (cloud) |

---

## Setup

### Requirements

- Python 3.12+
- Node.js 18+ and npm
- [uv](https://docs.astral.sh/uv/getting-started/installation/) package manager
- NVIDIA GPU (recommended for BERT — CPU fallback works)
- `tshark` (real-time mode only)

### 1. Install Python dependencies

```bash
uv venv --python 3.12
uv sync
```

> Do not use `pip install -r requirements.txt` — the project uses `pyproject.toml` managed by `uv`.

### 2. Configure API keys

Create `backend/.env`:

```
OPENAI_API_KEY=sk-...       # GPT-4o for ChatAgent and ParameterTuningAgent
GROQ_API_KEY=gsk_...        # LLaMA 3.3 70B for ReportingAgent

APP_HOST=0.0.0.0
APP_PORT=8000
```

- OpenAI key: https://platform.openai.com/api-keys
- Groq key (free tier): https://console.groq.com

### 3. Install frontend dependencies

```bash
cd frontend
npm install
```

---

## Execution

### Real-Time Monitoring

Monitors live network traffic on the local machine.

**Terminal 1:**
```bash
cd backend
uv run python app.py
```

**Terminal 2:**
```bash
cd frontend
npm start
```

Open **http://localhost:3000**. When latency or packet loss thresholds are breached, the pipeline triggers automatically: BERT classifies the traffic → hybrid routing selects the reporting path → LLaMA 3.3 70B generates the incident report → WebSocket pushes it to the dashboard.

### Offline PCAP Batch Analysis

Analyzes pre-captured PCAP files (NS-3 simulation output).

```bash
cd backend
python analyze_nodes.py
```

Reads from `backend/segregated/segregated_pcaps14/`. BERT is initialized once and reused across all files. Reports are posted to the central controller and visualized on the dashboard.

### Benchmarking (Contribution 3 Evaluation)

```bash
cd backend
python benchmark_log.py
```

Auto-detects the active model, runs `analyze_nodes.py`, parses `time_to_report_ms` and token counts from logs, and appends results to CSVs in `paper/`.

**To switch between models**, edit `backend/nw_agents/ReportingAgent.py`:

```python
# Groq LPU — LLaMA 3.3 70B (default):
from pydantic_ai.models.groq import GroqModel
groq_model = GroqModel('llama-3.3-70b-versatile')

# OpenAI GPU — GPT-4o (for baseline comparison):
from pydantic_ai.models.openai import OpenAIModel
gpt4o_model = OpenAIModel('gpt-4o')
```

---

## Repository Structure

```
NetMoniAI/
├── backend/
│   ├── app.py                         # FastAPI app — real-time mode
│   ├── analyze_nodes.py               # Offline PCAP batch analysis
│   ├── benchmark_log.py               # Benchmark tool (Contribution 3)
│   ├── common_classes.py              # Pydantic models (NetworkReport, etc.)
│   ├── config.py                      # Queue and app configuration
│   ├── appWebsocket.py                # WebSocket broadcaster
│   └── nw_agents/
│       ├── SecurityAnalysisAgent.py   # Contribution 1 — BERT local inference
│       ├── ReportingAgent.py          # Contribution 2 & 3 — Hybrid routing + Groq
│       ├── PerformanceMonitoringAgent.py
│       ├── ParameterTuningAgent.py
│       └── ChatAgent.py
│
├── frontend/                          # React dashboard (unchanged from original)
│
├── paper/
│   ├── benchmark_all.csv              # Combined benchmark results
│   ├── benchmark_gpt4o.csv            # GPT-4o baseline measurements
│   ├── benchmark_groq.csv             # Groq LPU measurements
│   └── figures/                       # Paper figures and architecture diagrams
│
├── pyproject.toml                     # Python dependencies (uv)
└── backend/.env                       # API keys (not committed)
```

---

## Troubleshooting

**Port 8000 already in use**
```bash
kill $(lsof -ti:8000) && uv run python app.py
```

**BERT not using GPU**
```bash
python -c "import torch; print(torch.cuda.is_available())"
```
Falls back to CPU automatically if no GPU is found.

**Groq rate limit errors (429)**
- Free tier: 30 requests/minute. `analyze_nodes.py` includes exponential backoff retry.

**No PCAP files found**
- Verify `backend/segregated/segregated_pcaps14/` contains `.pcap` files.
- Update `output_dir` in `analyze_nodes.py` if using a different folder.

---

## Original Paper Citation

```bibtex
@article{zambare2025netmoniai,
  title={NetMoniAI: An Agentic AI Framework for Network Security \& Monitoring},
  author={Zambare, Pallavi and Thanikella, Venkata Nikhil and
          Kottur, Nikhil Padmanabh and Akula, Sree Akhil and Liu, Ying},
  journal={arXiv preprint arXiv:2508.10052},
  year={2025}
}
```
