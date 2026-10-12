"""Phase 6 - evaluate: score a model on the held-out evaluation set.

Two scoring paths, matching the two kinds of row in ``evaluation/eval_set.jsonl``:

* **multiple_choice** - the model must answer with the letter of the correct
  option. Reported as letter accuracy, plus chance level (1 / option count) so a
  score can be read honestly.
* **open_answer** - token F1 and exact match against the reference answer, with
  the same script-aware tokenization the quality filter uses.

A tuned score only means something next to the base model, so the report records
which run each number came from. Running without ``--adapter`` gives the base
number; running with one gives the tuned number. ``--allow-random-init`` scores
a tiny randomly initialized Gemma 4 text stack instead of the real checkpoint -
that proves the scoring path works and produces numbers that must be read as
plumbing verification, never as model quality.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _common  # noqa: E402

DEFAULT_CONFIG = Path(__file__).resolve().parent.parent / "configs" / "train_lora.yaml"

CJK_RE = re.compile(r"[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u3040-\u30ff]")
TOKEN_RE = re.compile(r"[A-Za-z0-9_']+")
# A letter only counts as an answer when it stands alone ("B", "(B)", "answer: B")
# rather than appearing inside a word. A greedy fallback that scanned the whole
# response for any A-H character would silently turn "The C programming language"
# into an answer, inflating accuracy on prose answers.
LETTER_RE = re.compile(r"(?:(?<=^)|(?<=[\s(*\[:]))([A-H])(?=[\s.,;:)!\]*]|$)")
LETTER_SCAN_CHARS = 60


def script_tokens(text: str) -> list[str]:
    folded = _common.normalize_text(text).casefold()
    tokens = TOKEN_RE.findall(folded)
    tokens.extend(ch for ch in folded if CJK_RE.match(ch))
    return tokens


def token_f1(prediction: str, reference: str) -> float:
    pred = script_tokens(prediction)
    gold = script_tokens(reference)
    if not pred or not gold:
        return 0.0
    overlap = Counter(pred) & Counter(gold)
    shared = sum(overlap.values())
    if shared == 0:
        return 0.0
    precision = shared / len(pred)
    recall = shared / len(gold)
    return 2 * precision * recall / (precision + recall)


def exact_match(prediction: str, reference: str) -> float:
    return 1.0 if _common.normalize_text(prediction).casefold() == \
        _common.normalize_text(reference).casefold() else 0.0


def extract_letters(text: str) -> str:
    """Return the sorted set of standalone option letters in a response."""
    letters = LETTER_RE.findall(text.upper()[:LETTER_SCAN_CHARS])
    return "".join(sorted(set(letters)))


def load_eval_rows(path: Path, mcq_cap: int, open_cap: int,
                   limit: int | None = None) -> list[dict[str, Any]]:
    """Load the evaluation set, capped per source and optionally balanced.

    ``limit`` splits evenly between the two kinds so a short run exercises both
    scoring paths instead of consuming its whole budget on the MCQ block that
    happens to come first in the file.
    """
    per_kind_source: Counter[str] = Counter()
    mcq: list[dict[str, Any]] = []
    open_rows: list[dict[str, Any]] = []
    for _line, record, _raw in _common.iter_jsonl(path):
        if record is None:
            continue
        kind = record.get("kind")
        key = f"{kind}:{record.get('source_dataset')}"
        cap = mcq_cap if kind == "multiple_choice" else open_cap
        if per_kind_source[key] >= cap:
            continue
        per_kind_source[key] += 1
        (mcq if kind == "multiple_choice" else open_rows).append(record)
    if limit is None or limit >= len(mcq) + len(open_rows):
        return mcq + open_rows
    half = max(1, limit // 2)
    chosen_mcq = mcq[:half]
    chosen_open = open_rows[:max(0, limit - len(chosen_mcq))]
    if len(chosen_mcq) + len(chosen_open) < limit:
        chosen_mcq = mcq[:limit - len(chosen_open)]
    return chosen_mcq + chosen_open


def build_model(config: dict[str, Any], adapter: str | None, random_init: bool):
    import torch  # noqa: PLC0415
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import train_lora  # noqa: PLC0415

    model, tokenizer, notes = train_lora.load_model_and_tokenizer(config, random_init)
    if adapter:
        import peft  # noqa: PLC0415
        model = peft.PeftModel.from_pretrained(model, adapter)
        notes["adapter"] = adapter
    model.eval()
    return model, tokenizer, notes


def generate(model: Any, tokenizer: Any, messages: list[dict[str, str]],
             max_new_tokens: int) -> str:
    import torch  # noqa: PLC0415
    text = tokenizer.apply_chat_template(messages, tokenize=False,
                                         add_generation_prompt=True)
    inputs = tokenizer(text, return_tensors="pt", add_special_tokens=False)
    with torch.no_grad():
        output = model.generate(**inputs, max_new_tokens=max_new_tokens,
                                do_sample=False, temperature=None, top_p=None,
                                pad_token_id=tokenizer.pad_token_id)
    generated = output[0][inputs["input_ids"].shape[-1]:]
    return tokenizer.decode(generated, skip_special_tokens=True).strip()


def main(argv: list[str] | None = None) -> int:
    _common.configure_stdout()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", default=str(DEFAULT_CONFIG))
    parser.add_argument("--adapter", default=None,
                        help="Path to a LoRA adapter directory. Omit for the base model.")
    parser.add_argument("--label", default=None,
                        help="Name for this run in the report (default derived).")
    parser.add_argument("--allow-random-init", action="store_true")
    parser.add_argument("--limit", type=int, default=None,
                        help="Score at most this many rows (useful for a quick pass).")
    _common.add_common_args(parser)
    args = parser.parse_args(argv)

    config = _common.load_yaml(args.config)
    pipeline = _common.load_yaml(str(Path(args.config).parent / "data_pipeline.yaml"))
    eval_settings = pipeline["evaluation"]

    eval_path = _common.artifact_path(pipeline["paths"]["outputs"]["eval_set"], args.out_root)
    if not eval_path.is_file():
        raise SystemExit(f"missing evaluation set: {eval_path}\nrun split_dataset.py first")

    rows = load_eval_rows(eval_path, int(eval_settings.get("mcq_max_questions", 200)),
                          int(eval_settings.get("open_max_questions", 50)),
                          args.limit)

    # Evaluating the real checkpoint has the same memory requirement as training
    # it, so the same gate refuses a run that would only start a 9.5 GiB download
    # and die on load.
    if not args.allow_random_init:
        import train_lora  # noqa: PLC0415
        gate = train_lora.resource_gate(config, args.out_root, False)
        if gate["verdict"] == "BLOCKED":
            blocked = {
                "label": args.label or ("tuned" if args.adapter else "base"),
                "adapter": args.adapter,
                "status": "BLOCKED",
                "reason": "resource gate refused evaluation of the real checkpoint: "
                          + "; ".join(gate["reasons"]),
                "resource_gate": gate,
            }
            _common.write_json_atomic(
                _common.artifact_path("reports/evaluation_report.json", args.out_root),
                blocked)
            for reason in gate["reasons"]:
                _common.info(f"BLOCKED: {reason}")
            return 1

    label = args.label or ("tuned" if args.adapter else "base")
    started = time.time()
    report: dict[str, Any] = {
        "label": label,
        "adapter": args.adapter,
        "random_init": bool(args.allow_random_init),
        "eval_set": str(eval_path),
        "rows": len(rows),
        "max_new_tokens": int(eval_settings.get("max_new_tokens", 128)),
        "started_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(started)),
        "status": "STARTED",
    }

    model, tokenizer, model_notes = build_model(config, args.adapter, args.allow_random_init)
    report["model"] = model_notes

    per_source: dict[str, Counter] = defaultdict(Counter)
    per_source_chance: dict[str, list[float]] = defaultdict(list)
    predictions: list[dict[str, Any]] = []
    max_new_tokens = int(eval_settings.get("max_new_tokens", 128))

    for index, row in enumerate(rows, start=1):
        messages = [{"role": "user", "content": row["prompt"]}]
        try:
            output = generate(model, tokenizer, messages, max_new_tokens)
        except Exception as exc:  # noqa: BLE001
            report["status"] = "FAILED"
            report["error"] = f"{type(exc).__name__}: {exc}"
            report["failed_at_row"] = index
            _common.write_json_atomic(
                _common.artifact_path("reports/evaluation_report.json", args.out_root), report)
            raise
        source = str(row.get("source_dataset"))
        if row.get("kind") == "multiple_choice":
            options = row.get("options") or {}
            option_count = max(1, len(options))
            predicted = extract_letters(output)
            correct = _common.normalize_text(row.get("answer") or "").upper()
            hit = 1.0 if predicted and predicted == correct else 0.0
            per_source[source]["mcq_questions"] += 1
            per_source[source]["mcq_correct"] += int(hit)
            per_source_chance[source].append(1.0 / option_count)
        else:
            f1 = token_f1(output, row.get("answer") or "")
            em = exact_match(output, row.get("answer") or "")
            hit = f1
            per_source[source]["open_questions"] += 1
            per_source[source]["open_f1_sum"] += f1
            per_source[source]["open_exact_sum"] += em
        if len(predictions) < 25:
            predictions.append({
                "eval_id": row.get("eval_id"),
                "kind": row.get("kind"),
                "source_dataset": source,
                "score": round(hit, 4),
                "expected": (row.get("answer") or "")[:120],
                "predicted": output[:200],
            })
        if index % 25 == 0:
            _common.info(f"scored {index}/{len(rows)}")

    metrics: dict[str, Any] = {}
    for source, counters in per_source.items():
        entry: dict[str, Any] = {}
        if counters["mcq_questions"]:
            accuracy = counters["mcq_correct"] / counters["mcq_questions"]
            chance = (sum(per_source_chance[source]) / len(per_source_chance[source])
                      if per_source_chance[source] else 0.0)
            entry["mcq"] = {
                "questions": counters["mcq_questions"],
                "correct": counters["mcq_correct"],
                "accuracy": round(accuracy, 4),
                "chance_level": round(chance, 4),
                "above_chance": round(accuracy - chance, 4),
            }
        if counters["open_questions"]:
            entry["open"] = {
                "questions": counters["open_questions"],
                "token_f1": round(counters["open_f1_sum"] / counters["open_questions"], 4),
                "exact_match": round(counters["open_exact_sum"] / counters["open_questions"], 4),
            }
        metrics[source] = entry

    total_mcq = sum(c["mcq_questions"] for c in per_source.values())
    total_mcq_correct = sum(c["mcq_correct"] for c in per_source.values())
    total_f1 = sum(c["open_f1_sum"] for c in per_source.values())
    total_open = sum(c["open_questions"] for c in per_source.values())

    report.update({
        "status": "COMPLETED",
        "seconds": round(time.time() - started, 2),
        "metrics": metrics,
        "overall": {
            "mcq_questions": total_mcq,
            "mcq_accuracy": round(total_mcq_correct / total_mcq, 4) if total_mcq else None,
            "open_questions": total_open,
            "open_token_f1": round(total_f1 / total_open, 4) if total_open else None,
        },
        "predictions_sample": predictions,
        "interpretation": (
            "RANDOM-INIT PLUMBING VERIFICATION: these numbers come from a tiny "
            "randomly initialized Gemma4TextConfig, so they measure the harness, "
            "not the model."
            if args.allow_random_init or args.adapter and "random-init" in str(args.adapter)
            else "Scores come from the checkpoint named in `model`."
        ),
    })
    report_path = _common.artifact_path("reports/evaluation_report.json", args.out_root)
    _common.write_json_atomic(report_path, report)
    labelled_path = _common.artifact_path(f"evaluation/{label}_report.json", args.out_root)
    _common.write_json_atomic(labelled_path, report)
    _common.info(f"overall: {report['overall']}")
    _common.info(f"wrote {report_path}")
    _common.info(f"wrote {labelled_path}")

    write_comparison_if_ready(args.out_root)
    return 0


def write_comparison_if_ready(out_root: str | None) -> None:
    """Emit base-vs-tuned artifacts once both numbers exist.

    A tuned score without the base score next to it says nothing, so the
    comparison is produced automatically rather than by memory.
    """
    base_path = _common.artifact_path("evaluation/base_report.json", out_root)
    tuned_path = _common.artifact_path("evaluation/tuned_report.json", out_root)
    if not (base_path.is_file() and tuned_path.is_file()):
        return
    base = _common.read_json(base_path)
    tuned = _common.read_json(tuned_path)

    def metric(report: dict[str, Any], source: str, path: tuple[str, str]) -> Any:
        entry = (report.get("metrics") or {}).get(source, {})
        section = entry.get(path[0], {})
        return section.get(path[1])

    sources = sorted({*base.get("metrics", {}), *tuned.get("metrics", {})})
    rows = []
    for source in sources:
        rows.append({
            "source_dataset": source,
            "base_mcq_accuracy": metric(base, source, ("mcq", "accuracy")),
            "tuned_mcq_accuracy": metric(tuned, source, ("mcq", "accuracy")),
            "base_open_token_f1": metric(base, source, ("open", "token_f1")),
            "tuned_open_token_f1": metric(tuned, source, ("open", "token_f1")),
        })

    comparison = {
        "base": {"label": base.get("label"), "overall": base.get("overall"),
                 "model": base.get("model")},
        "tuned": {"label": tuned.get("label"), "overall": tuned.get("overall"),
                  "model": tuned.get("model")},
        "per_source": rows,
        "delta": {
            "mcq_accuracy": _delta(tuned.get("overall", {}).get("mcq_accuracy"),
                                   base.get("overall", {}).get("mcq_accuracy")),
            "open_token_f1": _delta(tuned.get("overall", {}).get("open_token_f1"),
                                    base.get("overall", {}).get("open_token_f1")),
        },
        "interpretation": tuned.get("interpretation"),
    }
    _common.write_json_atomic(
        _common.artifact_path("reports/model_evaluation_comparison.json", out_root),
        comparison)

    lines = [
        "# Base vs tuned evaluation",
        "",
        f"- Base run: `{base.get('label')}` - {json.dumps(base.get('overall'))}",
        f"- Tuned run: `{tuned.get('label')}` - {json.dumps(tuned.get('overall'))}",
        f"- Interpretation: {tuned.get('interpretation')}",
        "",
        "| Source | Base MCQ | Tuned MCQ | Base token F1 | Tuned token F1 |",
        "|---|---:|---:|---:|---:|",
    ]
    for row in rows:
        lines.append(
            f"| `{row['source_dataset']}` | {row['base_mcq_accuracy']} | "
            f"{row['tuned_mcq_accuracy']} | {row['base_open_token_f1']} | "
            f"{row['tuned_open_token_f1']} |")
    lines += ["", "```json", json.dumps(comparison["delta"], indent=2), "```", ""]
    _common.artifact_path("evaluation/model_evaluation.md", out_root).write_text(
        "\n".join(lines), encoding="utf-8")


def _delta(tuned: Any, base: Any) -> Any:
    if isinstance(tuned, (int, float)) and isinstance(base, (int, float)):
        return round(tuned - base, 4)
    return None


if __name__ == "__main__":
    raise SystemExit(main())
