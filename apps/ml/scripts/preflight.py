"""Phase 2 preflight: can this machine actually fine-tune Gemma 4?

Runs before anything is downloaded and writes a pass/fail report. Every check
reports the raw evidence it observed, so a failure can be reproduced by hand.

    python apps/ml/scripts/preflight.py --config apps/ml/configs/train_lora.yaml

Exit code is 0 when no check hard-fails, 1 otherwise. ``--strict`` also fails on
warnings, which is what a CI job should use.
"""

from __future__ import annotations

import argparse
import importlib
import json
import os
import platform
import shutil
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _common  # noqa: E402

PASS, WARN, FAIL = "PASS", "WARN", "FAIL"

REQUIRED_PACKAGES = ["torch", "transformers", "peft", "trl", "datasets", "accelerate"]
OPTIONAL_PACKAGES = ["bitsandbytes", "sentencepiece", "safetensors", "psutil", "yaml"]

HF_MODEL_IDS = [
    "google/gemma-4-E2B-it",
    "google/gemma-4-E4B-it",
    "google/gemma-4-12B",
]


class Checks:
    def __init__(self) -> None:
        self.rows: list[dict[str, Any]] = []

    def add(self, name: str, status: str, evidence: Any, note: str = "") -> str:
        self.rows.append({"check": name, "status": status,
                          "evidence": evidence, "note": note})
        return status

    @property
    def hard_failures(self) -> list[dict[str, Any]]:
        return [r for r in self.rows if r["status"] == FAIL]

    @property
    def warnings(self) -> list[dict[str, Any]]:
        return [r for r in self.rows if r["status"] == WARN]


def module_version(name: str) -> tuple[str | None, str]:
    try:
        module = importlib.import_module(name)
    except Exception as exc:  # noqa: BLE001 - report whatever the import threw
        return None, f"{type(exc).__name__}: {exc}"
    return str(getattr(module, "__version__", "unknown")), ""


def check_interpreter(checks: Checks) -> None:
    version = platform.python_version()
    # torch, transformers, peft, trl and datasets all resolve for cp314 here;
    # a 3.10-3.13 interpreter remains a safe fallback if a future wheel lags.
    status = PASS if tuple(int(p) for p in version.split(".")[:2]) >= (3, 10) else FAIL
    checks.add("python_interpreter", status, version,
               "3.10+ required by the ML stack")


def check_packages(checks: Checks) -> None:
    found: dict[str, Any] = {}
    for name in REQUIRED_PACKAGES:
        version, error = module_version(name)
        found[name] = version or {"error": error}
        if version is None:
            checks.add(f"package:{name}", FAIL, error, "required package missing")
    if all(isinstance(v, str) for k, v in found.items() if k in REQUIRED_PACKAGES):
        checks.add("packages_required", PASS, found)

    optional: dict[str, Any] = {}
    for name in OPTIONAL_PACKAGES:
        version, error = module_version(name)
        optional[name] = version or {"error": error}
    checks.add("packages_optional", PASS if optional.get("sentencepiece") else WARN,
               optional, "bitsandbytes enables 4-bit QLoRA; sentencepiece is needed "
                         "by the Gemma tokenizer")


def check_accuracy(checks: Checks) -> None:
    try:
        import torch  # noqa: PLC0415
    except ImportError as exc:
        checks.add("torch_runtime", FAIL, str(exc), "cannot inspect runtime without torch")
        return

    build = str(torch.__version__)
    cuda_build = torch.version.cuda
    payload = {
        "torch_version": build,
        "cuda_build": cuda_build,
        "cuda_available": torch.cuda.is_available(),
        "device_count": torch.cuda.device_count(),
    }
    if torch.cuda.is_available():
        free, total = torch.cuda.mem_get_info(0)
        payload.update({
            "device_name": torch.cuda.get_device_name(0),
            "capability": ".".join(str(x) for x in torch.cuda.get_device_capability(0)),
            "vram_total_gib": round(total / 1024 ** 3, 2),
            "vram_free_gib": round(free / 1024 ** 3, 2),
            "bf16_supported": torch.cuda.is_bf16_supported(),
        })
        checks.add("gpu_acceleration", PASS, payload)
    else:
        checks.add(
            "gpu_acceleration", WARN, payload,
            "torch has no CUDA device. A GPU may still be present: this wheel is a "
            "CPU build (see torch_version ending in '+cpu'). Install a CUDA build of "
            "torch to use it; until then every step runs on the CPU.",
        )


def check_bitsandbytes(checks: Checks) -> None:
    version, error = module_version("bitsandbytes")
    if version is None:
        checks.add("qlora_support", WARN, {"bitsandbytes": {"error": error}},
                   "4-bit QLoRA unavailable; training falls back to bf16/fp32 LoRA")
    else:
        checks.add("qlora_support", PASS, {"bitsandbytes": version})


def check_system_resources(checks: Checks, config: dict[str, Any]) -> None:
    limits = config.get("resource_limits", {})
    min_ram = float(limits.get("min_free_ram_gb", 0) or 0)
    min_disk = float(limits.get("min_free_disk_gb", 0) or 0)

    ram_payload: dict[str, Any] = {}
    try:
        import psutil  # noqa: PLC0415
        virtual = psutil.virtual_memory()
        ram_payload = {
            "total_gib": round(virtual.total / 1024 ** 3, 2),
            "available_gib": round(virtual.available / 1024 ** 3, 2),
        }
        status = PASS if ram_payload["available_gib"] >= min_ram else WARN
        checks.add("ram", status, ram_payload,
                   f"wanted at least {min_ram} GiB free before a run")
    except ImportError:
        checks.add("ram", WARN, {"psutil": "not installed"}, "cannot measure free RAM")

    usage = shutil.disk_usage(str(Path(_common.training_root()).anchor or "C:/"))
    disk_payload = {
        "root": str(_common.training_root()),
        "free_gib": round(usage.free / 1024 ** 3, 2),
        "total_gib": round(usage.total / 1024 ** 3, 2),
    }
    checks.add("disk",
               PASS if disk_payload["free_gib"] >= min_disk else WARN,
               disk_payload, f"wanted at least {min_disk} GiB free for weights + adapters")


def check_paths(checks: Checks) -> None:
    try:
        root = _common.resolve_output_root(None)
        checks.add("output_root_writable", PASS, str(root))
    except Exception as exc:  # noqa: BLE001
        checks.add("output_root_writable", FAIL, f"{type(exc).__name__}: {exc}")

    try:
        _common.assert_safe_output_root(_common.datasets_root() / "processed")
    except _common.UnsafeOutputPathError as exc:
        checks.add("output_guard_blocks_datasets", PASS, str(exc).splitlines()[0])
    except Exception as exc:  # noqa: BLE001
        checks.add("output_guard_blocks_datasets", FAIL, f"{type(exc).__name__}: {exc}")
    else:
        checks.add("output_guard_blocks_datasets", FAIL,
                   "the guard allowed a write inside the read-only datasets tree")

    datasets = _common.datasets_root()
    checks.add("datasets_readable",
               PASS if datasets.is_dir() else FAIL, str(datasets))


def check_hf_auth(checks: Checks) -> None:
    token = (os.environ.get("HF_TOKEN")
             or os.environ.get("HUGGING_FACE_HUB_TOKEN")
             or os.environ.get("HUGGINGFACE_TOKEN"))
    checks.add("hf_token_present", PASS if token else WARN,
               {"present": bool(token)},
               "Gemma checkpoints are licence-gated; a token is required to download them")

    probe: dict[str, Any] = {}
    for model_id in HF_MODEL_IDS:
        url = f"https://huggingface.co/api/models/{model_id}"
        try:
            request = urllib.request.Request(url, method="GET")
            if token:
                request.add_header("Authorization", f"Bearer {token}")
            with urllib.request.urlopen(request, timeout=30) as response:
                document = json.loads(response.read().decode("utf-8"))
            probe[model_id] = {
                "http_status": 200,
                "gated": document.get("gated"),
                "license": (document.get("cardData") or {}).get("license"),
                "tags_include_gemma4": "gemma4" in (document.get("tags") or []),
            }
        except urllib.error.HTTPError as exc:
            probe[model_id] = {"http_status": exc.code, "error": exc.reason}
        except Exception as exc:  # noqa: BLE001
            probe[model_id] = {"error": f"{type(exc).__name__}: {exc}"}

    reachable = any(entry.get("http_status") == 200 for entry in probe.values())
    gated = any(entry.get("gated") not in (None, False) for entry in probe.values())
    status = PASS if reachable else WARN
    note = "model metadata reachable"
    if gated:
        note = ("at least one checkpoint is gated: accepting the Gemma licence on "
                "Hugging Face and exporting HF_TOKEN is required before download")
    checks.add("hf_model_registry", status, probe, note)


def check_pipeline_artifacts(checks: Checks) -> None:
    inventory = Path(_common.training_root()) / "reports" / "data_inventory.json"
    checks.add("inventory_present", PASS if inventory.is_file() else WARN,
               str(inventory), "run inventory_datasets.py / audit_datasets.py first")
    manifest = Path(__file__).resolve().parent.parent / "configs" / "dataset_manifest.yaml"
    checks.add("manifest_present", PASS if manifest.is_file() else FAIL, str(manifest))


def render_markdown(checks: Checks, config: dict[str, Any]) -> str:
    verdict = "BLOCKED" if checks.hard_failures else (
        "PASS WITH WARNINGS" if checks.warnings else "PASS")
    lines = [
        "# Gemma 4 fine-tuning preflight",
        "",
        f"**Verdict: {verdict}**",
        "",
        f"- Hard failures: {len(checks.hard_failures)}",
        f"- Warnings: {len(checks.warnings)}",
        f"- Target model: `{config.get('model', {}).get('id', 'unknown')}`",
        "",
        "| Check | Status | Note |",
        "|---|---|---|",
    ]
    for row in checks.rows:
        note = (row["note"] or "").replace("\n", " ")
        lines.append(f"| `{row['check']}` | {row['status']} | {note} |")
    lines.append("")
    lines.append("## Raw evidence")
    lines.append("")
    lines.append("```json")
    lines.append(json.dumps(checks.rows, indent=2, default=str))
    lines.append("```")
    lines.append("")
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    _common.configure_stdout()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", default=str(
        Path(__file__).resolve().parent.parent / "configs" / "train_lora.yaml"))
    parser.add_argument("--strict", action="store_true",
                        help="Treat warnings as failures.")
    _common.add_common_args(parser)
    args = parser.parse_args(argv)

    config = _common.load_yaml(args.config)

    checks = Checks()
    check_interpreter(checks)
    check_packages(checks)
    check_accuracy(checks)
    check_bitsandbytes(checks)
    check_system_resources(checks, config)
    check_paths(checks)
    check_hf_auth(checks)
    check_pipeline_artifacts(checks)

    for row in checks.rows:
        _common.info(f"{row['status']:4} {row['check']}: "
                     f"{json.dumps(row['evidence'], default=str)[:160]}")

    payload = {
        "verdict": ("BLOCKED" if checks.hard_failures
                    else "PASS_WITH_WARNINGS" if checks.warnings else "PASS"),
        "config": args.config,
        "model_id": config.get("model", {}).get("id"),
        "checks": checks.rows,
    }
    json_path = _common.artifact_path("reports/preflight.json", args.out_root)
    _common.write_json_atomic(json_path, payload)
    md_path = _common.artifact_path("reports/preflight.md", args.out_root)
    md_path.write_text(render_markdown(checks, config), encoding="utf-8")
    _common.info(f"wrote {json_path}")
    _common.info(f"wrote {md_path}")
    _common.info(f"verdict: {payload['verdict']}")

    if checks.hard_failures or (args.strict and checks.warnings):
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
