"""Stage 5 - split: deterministic train/validation/test plus the evaluation set.

Assignment is a pure function of the row's own content
(``sha256(source_dataset, normalized_prompt, normalized_answer)`` mapped into
[0,1)) and then bucketed against the configured ratios. Re-running the script on
the same input produces byte-identical splits, and no row index or file order
leaks into the decision, so an appended upstream row cannot shuffle the splits.

Because the bucket is derived per row rather than per source, every source that
has enough rows appears in every split - that is the stratification.

The evaluation set is built here too, from two things that are deliberately
never trained on:

* MCQ rows from the ``eval_only`` datasets (CyberMetric, SecBench MCQs,
  CTI-Bench) - scored by letter.
* Open questions that landed in the test split (CyberSec-Bench) - scored by
  token overlap.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Iterator

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _common  # noqa: E402

DEFAULT_CONFIG = Path(__file__).resolve().parent.parent / "configs" / "data_pipeline.yaml"


def bucket(fraction: float, ratios: list[tuple[str, float]]) -> str:
    cumulative = 0.0
    for name, ratio in ratios:
        cumulative += ratio
        if fraction < cumulative:
            return name
    return ratios[-1][0]


def main(argv: list[str] | None = None) -> int:
    _common.configure_stdout()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", default=str(DEFAULT_CONFIG))
    _common.add_common_args(parser)
    args = parser.parse_args(argv)

    config = _common.load_yaml(args.config)
    split_settings = config["splits"]
    eval_settings = config["evaluation"]
    paths = config["paths"]["outputs"]

    ratios = [(name, float(split_settings[name]))
              for name in ("train", "validation", "test")]
    total_ratio = sum(ratio for _name, ratio in ratios)
    if abs(total_ratio - 1.0) > 1e-9:
        raise SystemExit(f"split ratios must sum to 1.0, got {total_ratio}")
    ratios = [(name, ratio / total_ratio) for name, ratio in ratios]

    source = _common.artifact_path(paths["sft"], args.out_root)
    normalized = _common.artifact_path(paths["normalized"], args.out_root)
    if not source.is_file():
        raise SystemExit(f"missing input: {source}\nrun format_sft.py first")

    targets = {
        "train": _common.artifact_path(paths["train"], args.out_root),
        "validation": _common.artifact_path(paths["validation"], args.out_root),
        "test": _common.artifact_path(paths["test"], args.out_root),
    }
    handles = {name: path.open("w", encoding="utf-8", newline="\n")
               for name, path in targets.items()}
    counts: Counter[str] = Counter()
    per_source: dict[str, Counter] = defaultdict(Counter)
    seen_ids: Counter[str] = Counter()

    rows_in = 0
    try:
        for _line, record, _raw in _common.iter_jsonl(source):
            if record is None:
                continue
            rows_in += 1
            messages = record.get("messages") or []
            prompt = next((m["content"] for m in messages if m.get("role") == "user"), "")
            answer = next((m["content"] for m in messages
                           if m.get("role") == "assistant"), "")
            key = split_settings.get("key_fields") or ["source_dataset", "normalized_key"]
            parts = []
            for field in key:
                if field == "source_dataset":
                    parts.append(str(record.get("source_dataset", "")))
                elif field == "normalized_key":
                    parts.append(_common.normalized_key(prompt, answer))
                else:
                    parts.append(str(record.get(field, "")))
            fraction = _common.seeded_index(*parts) / float(1 << 64)
            name = bucket(fraction, ratios)
            record["split"] = name
            record["split_key"] = {"parts": key, "fraction": round(fraction, 6)}
            handles[name].write(json.dumps(record, ensure_ascii=False) + "\n")
            counts[name] += 1
            per_source[str(record.get("source_dataset"))][name] += 1
            record_id = str(record.get("id"))
            seen_ids[f"{record_id}::{name}"] += 1
    finally:
        for handle in handles.values():
            handle.close()

    # ---- evaluation set ----------------------------------------------------
    eval_rows: list[dict[str, Any]] = []
    eval_composition: Counter[str] = Counter()
    mcq_cap = int(eval_settings.get("mcq_max_questions", 200))
    open_cap = int(eval_settings.get("open_max_questions", 50))
    eval_sources = set(eval_settings.get("sources", []))
    per_source_mcq: Counter[str] = Counter()

    if normalized.is_file():
        for _line, record, _raw in _common.iter_jsonl(normalized):
            if record is None:
                continue
            if record.get("usage") != "eval_only":
                continue
            if record.get("source_dataset") not in eval_sources:
                continue
            if record.get("task_type") != "multiple_choice":
                continue
            if not record.get("answer_label"):
                continue
            if per_source_mcq[record["source_dataset"]] >= mcq_cap:
                continue
            per_source_mcq[record["source_dataset"]] += 1
            eval_rows.append({
                "eval_id": record.get("id"),
                "kind": "multiple_choice",
                "source_dataset": record.get("source_dataset"),
                "source_file": record.get("source_file"),
                "prompt": record.get("prompt"),
                "options": record.get("options"),
                "answer": record.get("answer_label"),
                "metadata": record.get("metadata") or {},
            })
            eval_composition[f"{record.get('source_dataset')}:mcq"] += 1
    else:
        _common.info(f"warning: {normalized} missing, evaluation MCQs skipped")

    # Open questions come from the held-out test split so the tuned model is
    # never scored on anything it was trained on.
    per_source_open: Counter[str] = Counter()
    for _line, record, _raw in _common.iter_jsonl(targets["test"]):
        if record is None:
            continue
        if record.get("source_dataset") not in eval_sources:
            continue
        messages = record.get("messages") or []
        prompt = next((m["content"] for m in messages if m.get("role") == "user"), "")
        answer = next((m["content"] for m in messages
                       if m.get("role") == "assistant"), "")
        if not prompt or not answer:
            continue
        if per_source_open[record["source_dataset"]] >= open_cap:
            continue
        per_source_open[record["source_dataset"]] += 1
        eval_rows.append({
            "eval_id": record.get("id"),
            "kind": "open_answer",
            "source_dataset": record.get("source_dataset"),
            "source_file": record.get("source_file"),
            "prompt": prompt,
            "options": None,
            "answer": answer,
            "metadata": record.get("metadata") or {},
        })
        eval_composition[f"{record.get('source_dataset')}:open"] += 1

    eval_path = _common.artifact_path(paths["eval_set"], args.out_root)
    written = _common.write_jsonl_atomic(eval_path, iter(eval_rows))

    report = {
        "input": str(source),
        "ratios": dict(ratios),
        "rows_in": rows_in,
        "split_counts": dict(counts),
        "actual_ratios": {name: round(counts[name] / max(1, rows_in), 6)
                          for name in targets},
        "per_source": {k: dict(v) for k, v in sorted(per_source.items())},
        "duplicate_ids_within_split": {k: v for k, v in seen_ids.items() if v > 1},
        "outputs": {name: str(path) for name, path in targets.items()},
        "eval_set": {
            "path": str(eval_path),
            "rows": written,
            "composition": dict(eval_composition),
            "per_source_mcq": dict(per_source_mcq),
            "per_source_open": dict(per_source_open),
        },
    }
    report_path = _common.artifact_path(config["paths"]["reports"]["split"], args.out_root)
    _common.write_json_atomic(report_path, report)

    for name in targets:
        _common.info(f"{name}: {counts[name]} rows "
                     f"({report['actual_ratios'][name]:.4%})")
    _common.info(f"eval set: {written} rows {dict(eval_composition)}")
    _common.info(f"wrote {report_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
