"""Stage 4 - format: render training rows into Gemma 4 chat messages.

Output rows are chat prompts, not pre-tokenized strings, so the tokenizer and
chat template stay the trainer's business:

    {"messages": [{"role": "system", ...}, {"role": "user", ...},
                  {"role": "assistant", ...}], ...}

Gemma 4 supports a native ``system`` role, so the configured system prompt is
emitted as a real system message. Rows that already carry a source system prompt
(Trendyol) keep theirs and are flagged ``source_system_prompt`` - replacing it
would throw away supervision the dataset author intended.

Long answers are truncated at a paragraph boundary, never mid-sentence, and the
truncation is counted and flagged.
"""

from __future__ import annotations

import argparse
import os
import sys
from collections import Counter
from pathlib import Path
from typing import Any, Iterator

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _common  # noqa: E402

DEFAULT_CONFIG = Path(__file__).resolve().parent.parent / "configs" / "data_pipeline.yaml"

# Characters per token for English prose. Used only to report an approximate
# token count; the trainer does the real tokenization.
CHARS_PER_TOKEN = 4.0


def truncate_at_paragraph(text: str, limit: int) -> tuple[str, bool]:
    if len(text) <= limit:
        return text, False
    window = text[:limit]
    split_at = window.rfind("\n\n")
    if split_at < limit // 3:
        split_at = window.rfind("\n")
    if split_at < limit // 3:
        split_at = window.rfind(". ")
    if split_at < limit // 3:
        split_at = limit
    return text[:split_at].rstrip(), True


def build_messages(record: dict[str, Any], settings: dict[str, Any],
                   truncation_limit: int) -> tuple[list[dict[str, str]], list[str]]:
    flags: list[str] = []
    answer = record.get("answer") or ""
    answer, truncated = truncate_at_paragraph(answer, truncation_limit)
    if truncated:
        flags.append("answer_truncated")

    existing = record.get("messages")
    if isinstance(existing, list) and existing:
        messages = [{"role": m.get("role", "user"), "content": m.get("content", "")}
                    for m in existing if isinstance(m, dict)]
        if any(m["role"] == "system" for m in messages):
            flags.append("source_system_prompt")
        elif settings.get("include_system_prompt", True):
            messages.insert(0, {"role": "system",
                                "content": settings.get("system_prompt", "")})
        for message in messages:
            if message["role"] == "assistant":
                message["content"] = answer
        return messages, flags

    messages = []
    if settings.get("include_system_prompt", True):
        messages.append({"role": "system", "content": settings.get("system_prompt", "")})
    messages.append({"role": "user", "content": record.get("prompt") or ""})
    messages.append({"role": "assistant", "content": answer})
    return messages, flags


def main(argv: list[str] | None = None) -> int:
    _common.configure_stdout()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", default=str(DEFAULT_CONFIG))
    parser.add_argument("--usage", default="sft_train",
                        help="Only rows with this usage value are formatted.")
    _common.add_common_args(parser)
    args = parser.parse_args(argv)

    config = _common.load_yaml(args.config)
    settings = config["format"]
    paths = config["paths"]["outputs"]
    limit = int(settings.get("truncate_answer_chars", 10 ** 9))

    source = _common.artifact_path(paths["filtered"], args.out_root)
    target = _common.artifact_path(paths["sft"], args.out_root)
    if not source.is_file():
        raise SystemExit(f"missing input: {source}\nrun quality_filter.py first")

    per_source: Counter[str] = Counter()
    flags_total: Counter[str] = Counter()
    role_shapes: Counter[str] = Counter()
    approx_tokens: list[int] = []
    rows_out = 0
    skipped_usage = 0

    def stream() -> Iterator[dict[str, Any]]:
        nonlocal rows_out, skipped_usage
        for _line, record, _raw in _common.iter_jsonl(source):
            if record is None:
                continue
            if record.get("usage") != args.usage:
                skipped_usage += 1
                continue
            messages, flags = build_messages(record, settings, limit)
            if not messages or not any(m["role"] == "assistant" for m in messages):
                skipped_usage += 1
                continue
            row = {
                "id": record.get("id"),
                "messages": messages,
                "source_dataset": record.get("source_dataset"),
                "source_file": record.get("source_file"),
                "task_type": record.get("task_type"),
                "language": record.get("language"),
                "license": None,
                "flags": sorted(set(list(record.get("flags") or []) + flags)),
                "metadata": record.get("metadata") or {},
            }
            if record.get("answer_label") is not None:
                row["answer_label"] = record.get("answer_label")
            if record.get("options") is not None:
                row["options"] = record.get("options")
            if record.get("masked"):
                row["masked"] = record.get("masked")
            if record.get("sampling"):
                row["sampling"] = record.get("sampling")

            char_total = sum(len(m["content"]) for m in messages)
            row["approx_tokens"] = int(char_total / CHARS_PER_TOKEN)
            approx_tokens.append(row["approx_tokens"])
            role_shapes["+".join(m["role"] for m in messages)] += 1
            per_source[str(record.get("source_file"))] += 1
            for flag in row["flags"]:
                flags_total[flag] += 1
            rows_out += 1
            yield row

    written = _common.write_jsonl_atomic(target, stream())

    ordered = sorted(approx_tokens)
    def pct(fraction: float) -> int:
        if not ordered:
            return 0
        return ordered[min(len(ordered) - 1, int(fraction * (len(ordered) - 1)))]

    report = {
        "input": str(source),
        "output": str(target),
        "settings": settings,
        "rows_written": written,
        "rows_skipped_usage_mismatch": skipped_usage,
        "per_source": dict(per_source),
        "flags": dict(flags_total),
        "message_role_shapes": dict(role_shapes),
        "approx_tokens": {
            "note": f"characters / {CHARS_PER_TOKEN}; the trainer does real tokenization",
            "p50": pct(0.50), "p95": pct(0.95), "max": pct(1.0),
            "rows_over_max_seq_len_1024": sum(1 for t in approx_tokens if t > 1024),
        },
    }
    report_path = _common.artifact_path(config["paths"]["reports"]["format"], args.out_root)
    _common.write_json_atomic(report_path, report)

    _common.info(f"rows written={written} (skipped {skipped_usage} non-{args.usage})")
    for key in sorted(per_source):
        _common.info(f"  {key}: {per_source[key]}")
    _common.info(f"  approx tokens p50={report['approx_tokens']['p50']} "
                 f"p95={report['approx_tokens']['p95']} "
                 f"max={report['approx_tokens']['max']}")
    _common.info(f"wrote {target}")
    _common.info(f"wrote {report_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
