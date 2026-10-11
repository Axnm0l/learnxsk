"""Phase 5 - LoRA smoke fine-tune of Gemma 4 on the prepared splits.

This is a *smoke* trainer: its job is to prove the pipeline can train an adapter
end to end, record what that actually cost, and refuse loudly when the machine
cannot hold the model.

Three things happen before a single weight is downloaded or loaded:

1. **Resource gate** - the checkpoint size is read from the Hugging Face file
   listing (safetensors metadata only, no weights) and compared against free RAM
   and disk. A 9.77 GiB checkpoint on a host with 2.7 GiB free is refused with
   both numbers in the report, instead of starting a 10 GB download that cannot
   finish.
2. **Dependency gate** - 4-bit QLoRA needs bitsandbytes; when it is absent the
   run falls back to bf16 LoRA and says so.
3. **Target-module verification** - every LoRA target module name from the
   config is checked against the loaded model. A name that does not exist aborts
   the run with the real list of linear modules, so the adapter can never
   silently train nothing.

``--allow-random-init`` trains the same LoRA path on a tiny randomly
initialized ``Gemma4TextConfig``. That is not Gemma 4 - it is a plumbing test
that needs no 10 GB download and is reported as such.
"""

from __future__ import annotations

import argparse
import json
import os
import platform
import sys
import time
import urllib.request
from pathlib import Path
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _common  # noqa: E402

DEFAULT_CONFIG = Path(__file__).resolve().parent.parent / "configs" / "train_lora.yaml"


# --------------------------------------------------------------------------
# Gates
# --------------------------------------------------------------------------

def free_ram_gib() -> float | None:
    try:
        import psutil  # noqa: PLC0415
    except ImportError:
        return None
    return psutil.virtual_memory().available / 1024 ** 3


def free_disk_gib(path: Path) -> float:
    import shutil  # noqa: PLC0415
    anchor = Path(path.anchor or "C:/")
    return shutil.disk_usage(str(anchor)).free / 1024 ** 3


def remote_checkpoint_size_gib(model_id: str) -> tuple[float | None, dict[str, Any]]:
    """Sum the size of the files a ``from_pretrained`` call would download."""
    url = f"https://huggingface.co/api/models/{model_id}?blobs=true"
    detail: dict[str, Any] = {"model_id": model_id, "url": url}
    try:
        token = os.environ.get("HF_TOKEN") or os.environ.get("HUGGING_FACE_HUB_TOKEN")
        request = urllib.request.Request(url)
        if token:
            request.add_header("Authorization", f"Bearer {token}")
        with urllib.request.urlopen(request, timeout=60) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except Exception as exc:  # noqa: BLE001
        detail["error"] = f"{type(exc).__name__}: {exc}"
        return None, detail

    weight_bytes = 0
    other_bytes = 0
    for sibling in payload.get("siblings", []):
        size = sibling.get("size") or 0
        name = sibling.get("rfilename", "")
        if name.endswith((".safetensors", ".bin", ".pt")):
            weight_bytes += size
        else:
            other_bytes += size
    detail.update({
        "gated": payload.get("gated"),
        "license": (payload.get("cardData") or {}).get("license"),
        "weight_files_gib": round(weight_bytes / 1024 ** 3, 2),
        "other_files_gib": round(other_bytes / 1024 ** 3, 2),
    })
    return weight_bytes / 1024 ** 3, detail


# nf4 stores 4 bits per parameter plus per-block absmax/scale overhead; 0.55
# bytes/parameter is the working figure for bitsandbytes nf4 with double quant.
NF4_BYTES_PER_PARAM = 0.55
# With gradient checkpointing, batch size 1 and a 1536-token limit, activations
# add roughly 30% on top of the int4 weights.
ACTIVATION_HEADROOM = 1.3


def device_memory() -> dict[str, Any]:
    """Report CUDA device memory, or an explicit reason there is none."""
    try:
        import torch  # noqa: PLC0415
    except ImportError as exc:
        return {"available": False, "reason": f"torch not importable: {exc}"}
    if not torch.cuda.is_available():
        return {"available": False,
                "reason": "torch.cuda.is_available() is False",
                "torch_version": str(torch.__version__),
                "cuda_build": torch.version.cuda}
    free, total = torch.cuda.mem_get_info(0)
    return {
        "available": True,
        "name": torch.cuda.get_device_name(0),
        "vram_total_gib": round(total / 1024 ** 3, 2),
        "vram_free_gib": round(free / 1024 ** 3, 2),
        "capability": ".".join(str(x) for x in torch.cuda.get_device_capability(0)),
    }


def resource_gate(config: dict[str, Any], out_root: str | None,
                  force: bool) -> dict[str, Any]:
    """Decide whether a run can fit, on whichever path it will actually take.

    The two paths need different resources and must not be conflated:

    * **4-bit on CUDA** - the weights live on the device at ~0.55 bytes per
      parameter, so the binding constraint is VRAM. Host RAM only has to stream
      the checkpoint shard through the loader.
    * **bf16 on CPU** - the whole checkpoint lands in host RAM, so the binding
      constraint is free RAM, roughly 1.6x the bf16 size for activations and
      optimizer state.

    An earlier version of this gate assumed the bf16-in-RAM path unconditionally,
    which wrongly refused a 4-bit GPU run that would have fit.
    """
    model_id = config["model"]["id"]
    limits = config.get("resource_limits", {})
    min_ram = float(limits.get("min_free_ram_gb", 0) or 0)
    min_disk = float(limits.get("min_free_disk_gb", 0) or 0)
    params = int(config["model"].get("parameter_count") or 0)

    weights_gib, detail = remote_checkpoint_size_gib(model_id)
    ram = free_ram_gib()
    disk = free_disk_gib(Path(_common.training_root(out_root)))
    device = device_memory()

    want_4bit = bool(config["model"].get("load_in_4bit"))
    try:
        import bitsandbytes  # noqa: F401,PLC0415
        have_bnb = True
    except ImportError:
        have_bnb = False

    quantized_gpu_path = bool(device.get("available")) and want_4bit and have_bnb
    reasons: list[str] = []
    plan: dict[str, Any] = {}

    if quantized_gpu_path:
        weights_device_gib = params * NF4_BYTES_PER_PARAM / 1024 ** 3
        device_required = round(weights_device_gib * ACTIVATION_HEADROOM, 2)
        host_required = max(2.0, min_ram)
        plan = {
            "path": "4bit_qlora_on_cuda",
            "device_weights_gib": round(weights_device_gib, 2),
            "device_required_gib": device_required,
            "vram_total_gib": device.get("vram_total_gib"),
            "host_ram_required_gib": host_required,
        }
        if float(device.get("vram_total_gib") or 0) < device_required:
            reasons.append(
                f"VRAM {device.get('vram_total_gib')} GiB < {device_required} GiB "
                f"needed for 4-bit weights + activations"
            )
        if ram is not None and ram < host_required:
            reasons.append(
                f"free RAM {ram:.2f} GiB < {host_required:.2f} GiB needed to stream "
                f"the checkpoint through the loader"
            )
    else:
        needed_gib = None if weights_gib is None else round(weights_gib * 1.6, 2)
        plan = {
            "path": "bf16_lora_on_cpu",
            "host_ram_required_gib": needed_gib,
            "reason_for_cpu_path": (
                device.get("reason") if not device.get("available")
                else ("bitsandbytes not installed" if not have_bnb
                      else "load_in_4bit disabled in config")
            ),
        }
        if ram is not None and needed_gib is not None and ram < needed_gib:
            reasons.append(
                f"free RAM {ram:.2f} GiB < estimated need {needed_gib:.2f} GiB for "
                f"a {weights_gib:.2f} GiB bf16 checkpoint resident in host memory"
            )
        if ram is not None and ram < min_ram:
            reasons.append(f"free RAM {ram:.2f} GiB < configured minimum {min_ram} GiB")

    if disk < min_disk:
        reasons.append(f"free disk {disk:.2f} GiB < configured minimum {min_disk} GiB")
    if detail.get("error"):
        reasons.append(f"could not read checkpoint size: {detail['error']}")

    verdict = "PASS" if not reasons else ("OVERRIDDEN" if force else "BLOCKED")
    return {
        "verdict": verdict,
        "reasons": reasons,
        "plan": plan,
        "free_ram_gib": None if ram is None else round(ram, 2),
        "free_disk_gib": round(disk, 2),
        "weights_gib": weights_gib,
        "parameter_count": params,
        "device": device,
        "bitsandbytes_available": have_bnb,
        "limits": {"min_free_ram_gb": min_ram, "min_free_disk_gb": min_disk},
        "checkpoint": detail,
    }


# --------------------------------------------------------------------------
# Data
# --------------------------------------------------------------------------

def build_examples(path: Path, limit: int | None) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for _line, record, _raw in _common.iter_jsonl(path):
        if record is None:
            continue
        rows.append(record)
        if limit and len(rows) >= limit:
            break
    return rows


def render_completion_pair(messages: list[dict[str, str]], tokenizer: Any,
                           max_seq_len: int) -> dict[str, Any]:
    """Tokenize a chat row into prompt ids plus the assistant completion.

    Completion-only loss: the prompt tokens get label ``-100`` so the model is
    trained on the answer, not on reproducing the question.
    """
    prompt_messages = [m for m in messages if m["role"] != "assistant"]
    answer = next((m["content"] for m in reversed(messages)
                   if m["role"] == "assistant"), "")
    prompt_text = tokenizer.apply_chat_template(
        prompt_messages, tokenize=False, add_generation_prompt=True)
    prompt_ids = tokenizer(prompt_text, add_special_tokens=False)["input_ids"]
    answer_ids = tokenizer(answer, add_special_tokens=False)["input_ids"]
    answer_ids = answer_ids + [tokenizer.eos_token_id]
    if len(prompt_ids) + len(answer_ids) > max_seq_len:
        keep = max(1, max_seq_len - len(prompt_ids))
        answer_ids = answer_ids[:keep]
    input_ids = prompt_ids + answer_ids
    labels = [-100] * len(prompt_ids) + list(answer_ids)
    return {"input_ids": input_ids, "labels": labels,
            "prompt_len": len(prompt_ids), "answer_len": len(answer_ids)}


# --------------------------------------------------------------------------
# Model loading
# --------------------------------------------------------------------------

# A tiny randomly initialized Gemma 4 text stack. The vocabulary size is set
# from the real tokenizer at runtime, because the tokenizer emits Gemma's real
# ids (up to ~262k) and an undersized embedding table fails with
# "index out of range in self".
TINY_TEXT_CONFIG = dict(
    hidden_size=128,
    intermediate_size=256,
    num_hidden_layers=2,
    num_attention_heads=4,
    num_key_value_heads=2,
    head_dim=32,
    max_position_embeddings=4096,
    hidden_size_per_layer_input=32,
    sliding_window=256,
)


def load_model_and_tokenizer(config: dict[str, Any], random_init: bool
                             ) -> tuple[Any, Any, dict[str, Any]]:
    import torch  # noqa: PLC0415
    import transformers  # noqa: PLC0415

    model_cfg = config["model"]
    notes: dict[str, Any] = {"random_init": random_init,
                             "transformers_version": transformers.__version__,
                             "torch_version": torch.__version__}

    dtype = torch.bfloat16
    if model_cfg.get("dtype") == "float16":
        dtype = torch.float16
    notes["dtype"] = str(dtype)

    want_4bit = bool(model_cfg.get("load_in_4bit"))
    have_bnb = True
    try:
        import bitsandbytes  # noqa: F401,PLC0415
    except ImportError:
        have_bnb = False
    notes["load_in_4bit_requested"] = want_4bit
    notes["bitsandbytes_available"] = have_bnb
    quantization: dict[str, Any] | None = None
    if want_4bit and have_bnb:
        try:
            from transformers import BitsAndBytesConfig  # noqa: PLC0415
            quantization = BitsAndBytesConfig(
                load_in_4bit=True,
                bnb_4bit_quant_type=model_cfg.get("bnb_4bit_quant_type", "nf4"),
                bnb_4bit_use_double_quant=bool(
                    model_cfg.get("bnb_4bit_use_double_quant", True)),
            )
            notes["quantization"] = "4-bit nf4"
        except Exception as exc:  # noqa: BLE001
            notes["quantization_error"] = f"{type(exc).__name__}: {exc}"
    if quantization is None:
        notes["quantization"] = "none (bf16 LoRA fallback)"

    if random_init:
        tokenizer = load_tokenizer(config)
        vocabulary = len(tokenizer)
        text_config = transformers.Gemma4TextConfig(
            vocab_size=vocabulary,
            vocab_size_per_layer_input=vocabulary,
            **TINY_TEXT_CONFIG,
        )
        model = transformers.Gemma4ForCausalLM(text_config)
        notes["model_class"] = "Gemma4ForCausalLM(Gemma4TextConfig) random init"
        notes["vocab_size"] = vocabulary
        notes["embedding_note"] = (
            "vocabulary taken from the real Gemma tokenizer so token ids are valid; "
            "embeddings dominate the parameter count"
        )
        notes["parameter_count"] = sum(p.numel() for p in model.parameters())
        return model, tokenizer, notes

    model = transformers.Gemma4ForCausalLM.from_pretrained(
        model_cfg["id"],
        dtype=dtype,
        device_map=model_cfg.get("device_map", "auto"),
        attn_implementation=model_cfg.get("attn_implementation", "sdpa"),
        quantization_config=quantization,
        trust_remote_code=bool(model_cfg.get("trust_remote_code", False)),
    )
    tokenizer = load_tokenizer(config)
    notes["model_class"] = type(model).__name__
    notes["parameter_count"] = sum(p.numel() for p in model.parameters())
    return model, tokenizer, notes


def load_tokenizer(config: dict[str, Any]) -> Any:
    import transformers  # noqa: PLC0415
    model_cfg = config["model"]
    for candidate in [model_cfg["id"]] + list(model_cfg.get("fallback_ids", [])):
        try:
            tokenizer = transformers.AutoTokenizer.from_pretrained(
                candidate,
                trust_remote_code=bool(model_cfg.get("trust_remote_code", False)),
            )
            if tokenizer.pad_token is None:
                tokenizer.pad_token = tokenizer.eos_token
            return tokenizer
        except Exception as exc:  # noqa: BLE001
            _common.info(f"tokenizer {candidate} unavailable: "
                         f"{type(exc).__name__}: {exc}")
    raise SystemExit("no tokenizer could be loaded")


def verify_target_modules(model: Any, targets: list[str]) -> dict[str, Any]:
    """Abort when a configured LoRA target does not exist on the model."""
    present = {name.split(".")[-1] for name, _module in model.named_modules()}
    linear_like = sorted({
        name.split(".")[-1] for name, module in model.named_modules()
        if type(module).__name__ == "Linear"
    })
    missing = [target for target in targets if target not in present]
    return {"targets": targets, "missing": missing, "available_linear_modules": linear_like}


# --------------------------------------------------------------------------
# Training
# --------------------------------------------------------------------------

def main(argv: list[str] | None = None) -> int:
    _common.configure_stdout()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", default=str(DEFAULT_CONFIG))
    parser.add_argument("--train-file", default=None,
                        help="Defaults to splits/train.jsonl under the training root.")
    parser.add_argument("--limit-rows", type=int, default=None)
    parser.add_argument("--max-steps", type=int, default=None)
    parser.add_argument("--model-id", default=None)
    parser.add_argument("--allow-random-init", action="store_true",
                        help="Train on a tiny randomly initialized Gemma4TextConfig "
                             "instead of downloading the real checkpoint.")
    parser.add_argument("--force-past-resource-gate", action="store_true")
    parser.add_argument(
        "--report-name", default="reports/train_lora_report.json",
        help="Report path relative to the training root. Set this to keep earlier "
             "reports (for example the random-init smoke evidence) intact.")
    parser.add_argument(
        "--adapter-dir", default=None,
        help="Override the adapter output directory.")
    parser.add_argument(
        "--validation-file", default=None,
        help="Held-out rows for validation loss/ppl. Defaults to "
             "splits/validation.jsonl under the training root when it exists. "
             "Validation data is never trained on.")
    parser.add_argument(
        "--run-dir", default=None,
        help="Override the trainer output directory.")
    _common.add_common_args(parser)
    args = parser.parse_args(argv)

    config = _common.load_yaml(args.config)
    if args.model_id:
        config["model"]["id"] = args.model_id
    paths = _common.load_yaml(str(Path(args.config).parent / "data_pipeline.yaml"))
    run_dir = _common.artifact_path(
        args.run_dir or config["outputs"]["run_dir"], args.out_root)
    adapter_dir = _common.artifact_path(
        args.adapter_dir or config["outputs"]["adapter_dir"], args.out_root)
    report_path = _common.artifact_path(args.report_name, args.out_root)
    train_file = Path(args.train_file) if args.train_file else _common.artifact_path(
        paths["paths"]["outputs"]["train"], args.out_root)

    started = time.time()
    report: dict[str, Any] = {
        "started_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(started)),
        "host": {
            "platform": platform.platform(),
            "python": platform.python_version(),
            "processor": platform.processor(),
        },
        "config": args.config,
        "model_id": config["model"]["id"],
        "report_path": str(report_path),
        "train_file": str(train_file),
        "limit_rows": args.limit_rows,
        "max_steps": args.max_steps,
        "allow_random_init": args.allow_random_init,
        "status": "STARTED",
    }

    if not train_file.is_file():
        report.update({"status": "BLOCKED", "reason": f"missing training split {train_file}"})
        _common.write_json_atomic(report_path, report)
        _common.info(f"BLOCKED: missing {train_file}")
        return 1

    # ---- gate 1: resources (skipped for the random-init plumbing test) -----
    if not args.allow_random_init:
        gate = resource_gate(config, args.out_root, args.force_past_resource_gate)
        report["resource_gate"] = gate
        _common.info(f"resource gate: {gate['verdict']}")
        for reason in gate["reasons"]:
            _common.info(f"  - {reason}")
        if gate["verdict"] == "BLOCKED":
            report.update({
                "status": "BLOCKED",
                "reason": "resource gate refused the run before downloading the "
                          "checkpoint: " + "; ".join(gate["reasons"]),
            })
            _common.write_json_atomic(report_path, report)
            _common.info(f"BLOCKED. wrote {report_path}")
            return 1

    import torch  # noqa: PLC0415
    from torch.utils.data import Dataset  # noqa: PLC0415
    from transformers import Trainer, TrainingArguments  # noqa: PLC0415
    import peft  # noqa: PLC0415

    examples = build_examples(train_file, args.limit_rows)
    report["rows_loaded"] = len(examples)
    if not examples:
        report.update({"status": "BLOCKED", "reason": "training split is empty"})
        _common.write_json_atomic(report_path, report)
        return 1

    model, tokenizer, load_notes = load_model_and_tokenizer(config, args.allow_random_init)
    report["model"] = load_notes

    verification = verify_target_modules(model, config["lora"]["target_modules"])
    report["lora_target_verification"] = verification
    if verification["missing"]:
        report.update({
            "status": "BLOCKED",
            "reason": f"configured LoRA targets not present on the model: "
                      f"{verification['missing']}",
        })
        _common.write_json_atomic(report_path, report)
        _common.info(f"BLOCKED: missing LoRA targets {verification['missing']}")
        _common.info(f"available linear modules: {verification['available_linear_modules']}")
        return 1
    _common.info(f"lora targets verified: {verification['targets']}")

    max_seq_len = int(config["training"]["max_seq_len"])
    tokenized = [render_completion_pair(row["messages"], tokenizer, max_seq_len)
                 for row in examples]
    effective = [t for t in tokenized if t["answer_len"] > 0]
    report["rows_tokenized"] = len(tokenized)
    report["rows_with_supervision"] = len(effective)
    if not effective:
        report.update({"status": "BLOCKED", "reason": "no row produced assistant tokens"})
        _common.write_json_atomic(report_path, report)
        return 1

    # ---- held-out validation, kept strictly separate from training ---------
    validation_file = (Path(args.validation_file) if args.validation_file
                       else _common.artifact_path(paths["paths"]["outputs"]["validation"],
                                                  args.out_root))
    validation_effective: list[dict[str, Any]] = []
    if validation_file.is_file():
        validation_rows = build_examples(validation_file, None)
        validation_effective = [
            item for item in (render_completion_pair(row["messages"], tokenizer, max_seq_len)
                              for row in validation_rows)
            if item["answer_len"] > 0
        ]
        report["validation"] = {
            "file": str(validation_file),
            "rows": len(validation_rows),
            "rows_with_supervision": len(validation_effective),
            "used_for_training": False,
        }
        _common.info(f"validation rows: {len(validation_effective)} from "
                     f"{validation_file.name} (held out)")
    else:
        report["validation"] = {"file": str(validation_file), "rows": 0,
                                "used_for_training": False,
                                "note": "no validation file found"}

    class ChatDataset(Dataset):
        def __init__(self, rows: list[dict[str, Any]] | None = None) -> None:
            self.rows = rows if rows is not None else effective

        def __len__(self) -> int:
            return len(self.rows)

        def __getitem__(self, index: int) -> dict[str, Any]:
            return self.rows[index]

    pad_id = tokenizer.pad_token_id or tokenizer.eos_token_id

    def collate(batch: list[dict[str, Any]]) -> dict[str, Any]:
        width = max(len(item["input_ids"]) for item in batch)
        input_ids, labels, attention = [], [], []
        for item in batch:
            pad = width - len(item["input_ids"])
            input_ids.append(item["input_ids"] + [pad_id] * pad)
            labels.append(item["labels"] + [-100] * pad)
            attention.append([1] * len(item["input_ids"]) + [0] * pad)
        return {
            "input_ids": torch.tensor(input_ids, dtype=torch.long),
            "labels": torch.tensor(labels, dtype=torch.long),
            "attention_mask": torch.tensor(attention, dtype=torch.long),
        }

    lora_settings = config["lora"]
    lora_config = peft.LoraConfig(
        r=int(lora_settings["r"]),
        lora_alpha=int(lora_settings["lora_alpha"]),
        lora_dropout=float(lora_settings["lora_dropout"]),
        bias=lora_settings.get("bias", "none"),
        task_type=lora_settings.get("task_type", "CAUSAL_LM"),
        target_modules=list(lora_settings["target_modules"]),
    )
    model = peft.get_peft_model(model, lora_config)
    trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
    total = sum(p.numel() for p in model.parameters())
    report["lora_parameters"] = {
        "trainable": trainable, "total": total,
        "trainable_share": round(trainable / max(1, total), 6),
    }
    _common.info(f"trainable params: {trainable:,} / {total:,} "
                 f"({trainable / max(1, total):.4%})")

    training = dict(config["training"])
    training["max_steps"] = int(args.max_steps or training.get("max_steps", 20))
    training["output_dir"] = str(run_dir)
    training["bf16"] = bool(training.get("bf16")) and torch.cuda.is_available()
    if not torch.cuda.is_available():
        training["fp16"] = False
        training["use_cpu"] = True
    if training.get("gradient_checkpointing"):
        try:
            model.gradient_checkpointing_enable(
                gradient_checkpointing_kwargs=training.get(
                    "gradient_checkpointing_kwargs"))
        except Exception as exc:  # noqa: BLE001
            _common.info(f"gradient checkpointing unavailable: {exc}")

    trainer_args = TrainingArguments(**{
        key: value for key, value in training.items()
        if key in TrainingArguments.__dataclass_fields__
    })
    eval_dataset = (ChatDataset(validation_effective) if validation_effective else None)
    trainer = Trainer(model=model, args=trainer_args, train_dataset=ChatDataset(),
                      eval_dataset=eval_dataset, data_collator=collate)

    train_started = time.time()
    result = trainer.train()
    train_seconds = time.time() - train_started

    eval_metrics: dict[str, float] = {}
    if eval_dataset is not None:
        evaluation = trainer.evaluate()
        eval_metrics = {k: float(v) for k, v in evaluation.items()
                        if isinstance(v, (int, float))}
        _common.info(f"validation metrics: {eval_metrics}")

    adapter_dir.mkdir(parents=True, exist_ok=True)
    model.save_pretrained(str(adapter_dir))
    tokenizer.save_pretrained(str(adapter_dir))

    report.update({
        "status": "COMPLETED",
        "training": {
            "seconds": round(train_seconds, 2),
            "steps": int(getattr(result, "global_step", 0)),
            "train_loss": float(getattr(result, "training_loss", float("nan"))),
            "metrics": {k: float(v) for k, v in (result.metrics or {}).items()
                        if isinstance(v, (int, float))},
            "final_eval_metrics": eval_metrics,
            "validation_loss": eval_metrics.get("eval_loss"),
        },
        "hyperparameters": {k: v for k, v in training.items()
                            if isinstance(v, (str, int, float, bool))},
        "adapter_dir": str(adapter_dir),
        "run_dir": str(run_dir),
        "total_seconds": round(time.time() - started, 2),
        "free_ram_gib_after": (None if free_ram_gib() is None
                               else round(free_ram_gib(), 2)),
    })
    _common.write_json_atomic(report_path, report)
    _common.info(f"adapter saved to {adapter_dir}")
    _common.info(f"loss={report['training']['train_loss']:.4f} "
                 f"steps={report['training']['steps']} "
                 f"seconds={report['training']['seconds']}")
    _common.info(f"wrote {report_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
