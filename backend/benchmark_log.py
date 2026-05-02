"""
Run analyze_nodes.py and save timing/token results to CSV in paper/
Usage:
  python benchmark_log.py --llm=groq    (LLaMA 3.3 70B via Groq LPU)
  python benchmark_log.py --llm=openai  (GPT-4o via OpenAI)

Appends one row per PCAP file to:
  ../paper/benchmark_gpt4o.csv   (when --llm=openai)
  ../paper/benchmark_groq.csv    (when --llm=groq)
  ../paper/benchmark_all.csv     (always — combined across both models)
"""

import argparse
import subprocess
import re
import csv
import os
import sys
import datetime


PAPER_DIR = os.path.join(os.path.dirname(__file__), "../paper")

FIELDNAMES = [
    "run_timestamp", "model", "pcap_file", "node_ip",
    "bert_label", "bert_score", "confidence_tier",
    "strategy", "time_to_report_ms", "tokens"
]

MODEL_DISPLAY = {
    "groq": "LLaMA-3.3-70B (Groq LPU)",
    "openai": "GPT-4o (OpenAI)",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Benchmark analyze_nodes.py with a chosen LLM.")
    parser.add_argument(
        "--llm",
        choices=["groq", "openai"],
        default="groq",
        help="Which LLM backend to use for the ReportingAgent (default: groq)",
    )
    return parser.parse_args()


def run_analyze_nodes(llm: str) -> str:
    print("Running analyze_nodes.py ...\n")
    env = os.environ.copy()
    env["LLM_PROVIDER"] = llm
    lines = []
    with subprocess.Popen(
        [sys.executable, "analyze_nodes.py"],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
        env=env,
    ) as proc:
        for line in proc.stdout:
            print(line, end="", flush=True)
            lines.append(line)
    return "".join(lines)


def parse_logs(output: str, model_name: str) -> list[dict]:
    records = []
    current: dict = {}
    run_ts = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    node_ip_list: list[str] = []

    for line in output.splitlines():

        # New PCAP file starting
        m = re.search(r"Starting analysis for .+?/([^/]+\.pcap)", line)
        if m:
            if current:
                records.append(current)
            current = {
                "run_timestamp": run_ts,
                "model": model_name,
                "pcap_file": m.group(1),
                "node_ip": "",
                "bert_label": "",
                "bert_score": "",
                "confidence_tier": "",
                "strategy": "",
                "time_to_report_ms": "",
                "tokens": "",
            }

        # BERT classification line
        m = re.search(r"\[BERT\] label=(.+?) score=(\d+\.\d+)% → tier=(\w+)", line)
        if m and current:
            current["bert_label"] = m.group(1)
            current["bert_score"] = m.group(2)
            current["confidence_tier"] = m.group(3)

        # Report timing line
        m = re.search(r"\[Hybrid\|(\w+)\|.+?\] report in (\d+)ms \| (\d+) tokens", line)
        if m and current:
            current["strategy"] = m.group(1).lower()
            current["time_to_report_ms"] = m.group(2)
            current["tokens"] = m.group(3)

        # Node IP from final results section
        m = re.search(r"Node (\d+\.\d+\.\d+\.\d+):", line)
        if m:
            node_ip_list.append(m.group(1))

    if current:
        records.append(current)

    # Assign node IPs in order
    for i, record in enumerate(records):
        if i < len(node_ip_list):
            record["node_ip"] = node_ip_list[i]

    return records


def append_to_csv(path: str, records: list[dict]):
    file_exists = os.path.exists(path)
    with open(path, "a", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
        if not file_exists:
            writer.writeheader()
        writer.writerows(records)


def save_records(records: list[dict], model_name: str) -> tuple[str, str]:
    os.makedirs(PAPER_DIR, exist_ok=True)

    if "Groq" in model_name or "LLaMA" in model_name:
        model_csv = os.path.join(PAPER_DIR, "benchmark_groq.csv")
    else:
        model_csv = os.path.join(PAPER_DIR, "benchmark_gpt4o.csv")

    combined_csv = os.path.join(PAPER_DIR, "benchmark_all.csv")

    append_to_csv(model_csv, records)
    append_to_csv(combined_csv, records)

    return model_csv, combined_csv


def print_summary(records: list[dict], model_name: str):
    print(f"\n{'='*65}")
    print(f"  Model: {model_name}")
    print(f"  Run:   {records[0]['run_timestamp'] if records else 'N/A'}")
    print(f"{'='*65}")
    print(f"{'PCAP File':<22} {'Node IP':<14} {'Tier':<8} {'ms':<10} {'Tokens'}")
    print(f"{'-'*65}")
    for r in records:
        print(f"{r['pcap_file']:<22} {r['node_ip']:<14} {r['confidence_tier']:<8} {r['time_to_report_ms']:<10} {r['tokens']}")

    times = [float(r["time_to_report_ms"]) for r in records if r["time_to_report_ms"]]
    tokens = [int(r["tokens"]) for r in records if r["tokens"]]
    if times:
        print(f"{'-'*65}")
        print(f"{'Average':<22} {'':<14} {'':<8} {sum(times)/len(times):<10.1f} {sum(tokens)//len(tokens)}")
    print(f"{'='*65}\n")


def main():
    args = parse_args()
    model_name = MODEL_DISPLAY[args.llm]
    print(f"Active model: {model_name}\n")

    output = run_analyze_nodes(args.llm)

    records = parse_logs(output, model_name)
    if not records:
        print("No records parsed. Check that analyze_nodes.py ran successfully.")
        return

    model_csv, combined_csv = save_records(records, model_name)

    print_summary(records, model_name)
    print(f"Saved {len(records)} records to:")
    print(f"  {model_csv}")
    print(f"  {combined_csv}")


if __name__ == "__main__":
    main()
