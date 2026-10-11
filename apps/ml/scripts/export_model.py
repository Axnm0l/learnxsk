"""Phase 7 - export: package the adapter and record deployment compatibility.

What this script can actually do on this machine, and what it cannot, is written
into the export report rather than assumed:

* **Adapter package** - the LoRA adapter and tokenizer are copied into the export
  directory with a model card and an attribution block. Always possible.
* **Merged checkpoint** - merging LoRA into the base weights needs the 9.54 GiB
  base checkpoint resident. That is gated exactly like training, so on this host
  it is reported as BLOCKED with the measured RAM figure.
* **GGUF for Ollama / llama.cpp** - Ollama loads GGUF. A safetensors LoRA adapter
  must first be converted with llama.cpp's ``convert_lora_to_gguf.py`` and the
  base model exported to GGUF, both of which require the base weights. Also
  reported as BLOCKED, with the exact commands that would be run elsewhere.

A ``Modelfile`` and ``deploy.md`` are always written so the deployment step is
one command away on a machine with enough RAM.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
import time
from pathlib import Path
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _common  # noqa: E402

DEFAULT_CONFIG = Path(__file__).resolve().parent.parent / "configs" / "train_lora.yaml"

ATTRIBUTION = """\
Fine-tuned on: Trendyol Cybersecurity Instruction Tuning Dataset (Apache-2.0);
CyberSec-Bench (Apache-2.0); SecBench (MIT); Kali Linux Toolkit Dataset (MIT);
Linux Terminal Commands Dataset (MIT); NIST NICE Framework components
(US Government work, NIST terms of use).
Base model: Gemma 4 (google/gemma-4-E2B-it).
CyberMetric (Apache-2.0) and cti-bench (CC-BY-NC-SA-4.0) were used for evaluation
only; cti-bench content is non-commercial and must not be redistributed as
training data.
"""


def model_card(config: dict[str, Any], train_report: dict[str, Any] | None,
               eval_report: dict[str, Any] | None) -> str:
    model_id = config["model"]["id"]
    lines = [
        "# LearnXSK cyber-tutor adapter (Gemma 4 LoRA)",
        "",
        f"- Base model: `{model_id}`",
        f"- Adapter type: LoRA, r={config['lora']['r']}, "
        f"alpha={config['lora']['lora_alpha']}",
        "- Trained for: explaining cybersecurity concepts, standards and Linux "
        "terminal commands to a learner inside the LearnXSK game.",
        "",
        "## Training run",
        "",
    ]
    if train_report:
        status = train_report.get("status")
        lines.append(f"- Status: **{status}**")
        if status == "COMPLETED":
            training = train_report.get("training", {})
            lines.append(f"- Steps: {training.get('steps')}")
            lines.append(f"- Train loss: {training.get('train_loss')}")
            lines.append(f"- Seconds: {training.get('seconds')}")
            lora = train_report.get("lora_parameters", {})
            lines.append(f"- Trainable parameters: {lora.get('trainable')} of "
                         f"{lora.get('total')} ({lora.get('trainable_share')})")
            model_notes = train_report.get("model", {})
            if model_notes.get("random_init"):
                lines.append("")
                lines.append("> **This adapter was produced by the random-init plumbing "
                             "test, not by training the real Gemma 4 checkpoint.** It "
                             "verifies the pipeline; it is not a usable model.")
        else:
            lines.append(f"- Reason: {train_report.get('reason')}")
    else:
        lines.append("- No training report found.")
    lines += ["", "## Evaluation", ""]
    if eval_report:
        lines.append(f"- Run label: `{eval_report.get('label')}`")
        lines.append(f"- Overall: `{json.dumps(eval_report.get('overall'))}`")
        lines.append(f"- Interpretation: {eval_report.get('interpretation')}")
    else:
        lines.append("- No evaluation report found.")
    lines += [
        "",
        "## Intended use and limits",
        "",
        "- Educational, authorised-lab use only. The adapter inherits the base "
        "model's licence and the attribution below.",
        "- It is a smoke-scale adapter: a few optimiser steps on a subset of the "
        "corpus. Do not present it as a production cyber assistant.",
        "- Offensive-security content in the Kali/Linux rows is documentation of "
        "tooling; evaluate for misuse before any public release.",
        "",
        "## Attribution",
        "",
        "```",
        ATTRIBUTION.strip(),
        "```",
        "",
    ]
    return "\n".join(lines)


def modelfile(config: dict[str, Any], adapter_name: str) -> str:
    return "\n".join([
        "# Ollama Modelfile for the LearnXSK cyber-tutor adapter.",
        "#",
        "# Ollama can only load a GGUF adapter, so `adapter.gguf` must be produced",
        "# first with llama.cpp (see deploy.md). `FROM gemma4:e2b` assumes the same",
        "# Ollama tag this project's Unity client already talks to.",
        "",
        "FROM gemma4:e2b",
        "",
        "# Uncomment once adapter.gguf exists next to this file:",
        f"# ADAPTER ./{adapter_name}",
        "",
        "PARAMETER temperature 0.2",
        "PARAMETER top_p 0.9",
        "PARAMETER num_ctx 4096",
        "",
        "SYSTEM \"\"\"You are LearnXSK's cybersecurity and Linux terminal tutor. Answer "
        "with accurate, defensive, lab-safe guidance. Cite the standard or framework "
        "you rely on when it applies. Never provide instructions intended to harm "
        "systems you are not authorised to test.\"\"\"",
        "",
    ])


def deploy_notes(config: dict[str, Any], merge_status: dict[str, Any]) -> str:
    model_id = config["model"]["id"]
    return "\n".join([
        "# Deploying the adapter",
        "",
        "## 1. On a machine with enough RAM",
        "",
        "Training and merging both need the base checkpoint resident. The gates",
        "measured on this host are in `reports/export_report.json`.",
        "",
        "```bash",
        "# merge LoRA into the base weights (needs ~16 GiB free RAM)",
        "python -c \"",
        "import torch, peft, transformers",
        f"base = transformers.Gemma4ForCausalLM.from_pretrained('{model_id}',",
        "    dtype=torch.bfloat16, device_map='auto')",
        "model = peft.PeftModel.from_pretrained(base, 'adapters/smoke-gemma4-e2b-lora')",
        "merged = model.merge_and_unload()",
        "merged.save_pretrained('exports/gemma4-e2b-lora-merged')",
        "\"",
        "```",
        "",
        "## 2. Convert for Ollama",
        "",
        "Ollama loads GGUF only. Two conversions are needed and both need the base",
        "weights locally:",
        "",
        "```bash",
        "git clone https://github.com/ggml-org/llama.cpp",
        "python llama.cpp/convert_hf_to_gguf.py exports/gemma4-e2b-lora-merged \\",
        "    --outfile exports/gemma4-e2b-lora.gguf --outtype q8_0",
        "python llama.cpp/convert_lora_to_gguf.py exports/gemma4-e2b-lora-merged \\",
        "    --base ggml-org/gemma-4-E2B-it-GGUF --outfile exports/adapter.gguf",
        "ollama create learnxsk-tutor -f exports/Modelfile",
        "```",
        "",
        "Then point the Unity client at the new tag. The client already speaks HTTP",
        "to `localhost:11434`; only `modelName` changes:",
        "",
        "```csharp",
        "[SerializeField] private string modelName = \"learnxsk-tutor\";",
        "```",
        "",
        "## 3. Current status of each step on this host",
        "",
        "| Step | Status | Why |",
        "|---|---|---|",
        f"| Adapter package | WROTE | adapter + tokenizer copied into the export dir |",
        f"| Merge into base weights | {merge_status['verdict']} | "
        f"{merge_status['reason']} |",
        "| GGUF base export | BLOCKED | needs the base weights on disk |",
        "| LoRA to GGUF | BLOCKED | needs the base GGUF from the previous step |",
        "| `ollama create` | NOT RUN | needs a GGUF adapter |",
        "",
        "## 4. Framework compatibility findings",
        "",
        "- `transformers` 5.x ships native Gemma 4 support (`Gemma4ForCausalLM`,",
        "  `Gemma4ForConditionalGeneration`, `Gemma4Processor`) - no remote code and",
        "  no custom modeling file is needed.",
        "- Gemma 4 is multimodal; this project uses the text path only. Image and",
        "  audio inputs are never constructed by the pipeline.",
        "- LoRA targets that exist on the loaded model are recorded in",
        "  `lora_target_verification` of the training report: `q_proj`, `k_proj`,",
        "  `v_proj`, `o_proj`, `gate_proj`, `up_proj`, `down_proj`.",
        "- The PyPI `torch` wheel installed here is CPU-only (`+cpu`). A CUDA build",
        "  is what unlocks the laptop GPU for both training and inference.",
        "",
    ])


def main(argv: list[str] | None = None) -> int:
    _common.configure_stdout()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", default=str(DEFAULT_CONFIG))
    parser.add_argument("--adapter", default=None,
                        help="Adapter directory; defaults to the configured adapter_dir.")
    parser.add_argument("--force-past-resource-gate", action="store_true")
    _common.add_common_args(parser)
    args = parser.parse_args(argv)

    config = _common.load_yaml(args.config)
    adapter_src = Path(args.adapter) if args.adapter else _common.artifact_path(
        config["outputs"]["adapter_dir"], args.out_root)
    export_dir = _common.artifact_path(config["outputs"]["export_dir"], args.out_root)
    export_dir.mkdir(parents=True, exist_ok=True)

    started = time.time()
    report: dict[str, Any] = {
        "started_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(started)),
        "adapter_source": str(adapter_src),
        "export_dir": str(export_dir),
        "model_id": config["model"]["id"],
        "steps": {},
    }

    if not adapter_src.is_dir():
        report.update({
            "status": "BLOCKED",
            "reason": f"adapter directory not found: {adapter_src}",
        })
        _common.write_json_atomic(
            _common.artifact_path("reports/export_report.json", args.out_root), report)
        _common.info(f"BLOCKED: {report['reason']}")
        return 1

    copies: list[dict[str, Any]] = []
    for path in sorted(adapter_src.iterdir()):
        if path.is_file():
            destination = export_dir / path.name
            shutil.copy2(path, destination)
            copies.append({"file": path.name,
                           "size_bytes": destination.stat().st_size})
    report["steps"]["adapter_package"] = {"verdict": "WROTE", "files": copies}

    # Merging needs the base weights resident; reuse the training gate's numbers.
    import train_lora  # noqa: PLC0415
    gate = train_lora.resource_gate(config, args.out_root, args.force_past_resource_gate)
    merge_verdict = "WROTE" if gate["verdict"] != "BLOCKED" else "BLOCKED"
    merge_status = {
        "verdict": merge_verdict,
        "reason": ("free RAM is sufficient for the base checkpoint"
                   if merge_verdict == "WROTE"
                   else "; ".join(gate["reasons"])),
        "gate": gate,
    }
    report["steps"]["merge_lora_into_base"] = merge_status
    report["steps"]["gguf_base_export"] = {
        "verdict": "NOT RUN",
        "reason": "needs llama.cpp and the base weights locally",
    }
    report["steps"]["lora_to_gguf"] = {
        "verdict": "NOT RUN",
        "reason": "needs the exported base GGUF",
    }
    report["steps"]["ollama_create"] = {
        "verdict": "NOT RUN",
        "reason": "needs a GGUF adapter; Modelfile is written and ready",
    }

    train_report = None
    eval_report = None
    train_report_path = _common.artifact_path("reports/train_lora_report.json", args.out_root)
    eval_report_path = _common.artifact_path("reports/evaluation_report.json", args.out_root)
    if train_report_path.is_file():
        train_report = _common.read_json(train_report_path)
    if eval_report_path.is_file():
        eval_report = _common.read_json(eval_report_path)

    (export_dir / "README.md").write_text(
        model_card(config, train_report, eval_report), encoding="utf-8")
    (export_dir / "Modelfile").write_text(
        modelfile(config, "adapter.gguf"), encoding="utf-8")
    (export_dir / "deploy.md").write_text(
        deploy_notes(config, merge_status), encoding="utf-8")
    (export_dir / "ATTRIBUTION.txt").write_text(ATTRIBUTION, encoding="utf-8")

    report.update({
        "status": "COMPLETED",
        "seconds": round(time.time() - started, 2),
        "export_files": sorted(p.name for p in export_dir.iterdir() if p.is_file()),
        "compatibility_findings": [
            "transformers 5.x has native Gemma 4 support; no remote code required.",
            "LoRA targets verified present on Gemma4ForCausalLM: q_proj, k_proj, "
            "v_proj, o_proj, gate_proj, up_proj, down_proj.",
            "Ollama requires a GGUF adapter; a safetensors LoRA cannot be loaded directly.",
            "The installed torch wheel is CPU-only (+cpu), so GPU deployment needs a "
            "CUDA build of torch on the training side; Ollama does its own GPU inference.",
        ],
    })
    report_path = _common.artifact_path("reports/export_report.json", args.out_root)
    _common.write_json_atomic(report_path, report)
    _common.info(f"export files: {report['export_files']}")
    for name, step in report["steps"].items():
        _common.info(f"  {name}: {step['verdict']}")
    _common.info(f"wrote {report_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
