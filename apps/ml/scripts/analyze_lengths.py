"""Step 3 - measure real token lengths with the actual Gemma 4 tokenizer.

The previous audit reported "1,582 rows over max_seq_len=1024" from a
characters/4 estimate. An estimate is not a measurement, so this script
tokenizes every row with the real Gemma 4 tokenizer and the real chat template,
then answers the only question that matters for truncation:

    at a given limit, how many rows still show the model an answer at all?

A row whose *prompt* alone fills the limit teaches nothing - the assistant turn
is cut off entirely and the training row becomes pure prompt. That count is
reported separately from rows that merely lose the tail of a long answer.

Outputs (under the validated training root):
    reports/token_length_analysis.json
    reports/token_length_analysis.md
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

LIMITS = [512, 768, 1024, 1536, 2048, 4096]
DEFAULT_TOKENIZER = "google/gemma-4-E2B-it"


def load_tokenizer(model_id: str) -> Any:
    import transformers  # noqa: PLC0415

    tokenizer = transformers.AutoTokenizer.from_pretrained(model_id)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    _common.info(f"tokenizer loaded: {type(tokenizer).__name__} "
                 f"(vocab {tokenizer.vocab_size})")
    return tokenizer


def split_messages(messages: list[dict[str, str]]) -> tuple[list[dict[str, str]], str]:
    prompt = [m for m in messages if m.get("role") != "assistant"]
    answer = next((m.get("content", "") for m in reversed(messages)
                   if m.get("role") == "assistant"), "")
    return prompt, answer


def measure(tokenizer: Any, rows: Iterator[dict[str, Any]], max_rows: int | None
            ) -> dict[str, Any]:
    lengths: list[int] = []
    prompt_lengths: list[int] = []
    answer_lengths: list[int] = []
    over_threshold: Counter[int] = Counter()
    prompt_overflow: Counter[int] = Counter()
    per_source: dict[str, list[int]] = defaultdict(list)
    answer_loss_chars: list[int] = []
    samples: list[dict[str, Any]] = []

    for index, row in enumerate(rows, start=1):
        if max_rows and index > max_rows:
            break
        messages = row.get("messages") or []
        prompt_messages, answer = split_messages(messages)
        prompt_text = tokenizer.apply_chat_template(
            prompt_messages, tokenize=False, add_generation_prompt=True)
        prompt_ids = tokenizer(prompt_text, add_special_tokens=False)["input_ids"]
        answer_ids = tokenizer(answer, add_special_tokens=False)["input_ids"]
        total = len(prompt_ids) + len(answer_ids) + 1

        lengths.append(total)
        prompt_lengths.append(len(prompt_ids))
        answer_lengths.append(len(answer_ids))
        per_source[str(row.get("source_dataset"))].append(total)

        for limit in LIMITS:
            if total > limit:
                over_threshold[limit] += 1
            if len(prompt_ids) >= limit:
                prompt_overflow[limit] += 1

        # How much answer text is lost at the current configured limit.
        if total > 1024:
            keep = max(0, 1024 - len(prompt_ids))
            lost_tokens = max(0, len(answer_ids) - keep)
            if lost_tokens:
                approx_chars = int(lost_tokens * max(1.0, len(answer) / max(1, len(answer_ids))))
                answer_loss_chars.append(approx_chars)
            if len(samples) < 12:
                samples.append({
                    "id": row.get("id"),
                    "source_dataset": row.get("source_dataset"),
                    "prompt_tokens": len(prompt_ids),
                    "answer_tokens": len(answer_ids),
                    "total_tokens": total,
                    "answer_head": answer[:120],
                    "answer_tail": answer[-120:],
                    "source_file": row.get("source_file"),
                })

    def pct(values: list[int], fraction: float) -> int:
        if not values:
            return 0
        ordered = sorted(values)
        return ordered[min(len(ordered) - 1, int(fraction * (len(ordered) - 1)))]

    return {
        "rows_measured": len(lengths),
        "total_tokens": {
            "p50": pct(lengths, 0.50), "p90": pct(lengths, 0.90),
            "p95": pct(lengths, 0.95), "p99": pct(lengths, 0.99),
            "max": max(lengths) if lengths else 0,
            "mean": round(sum(lengths) / len(lengths), 1) if lengths else 0,
        },
        "prompt_tokens": {
            "p50": pct(prompt_lengths, 0.50), "p95": pct(prompt_lengths, 0.95),
            "max": max(prompt_lengths) if prompt_lengths else 0,
        },
        "answer_tokens": {
            "p50": pct(answer_lengths, 0.50), "p95": pct(answer_lengths, 0.95),
            "max": max(answer_lengths) if answer_lengths else 0,
        },
        "rows_over_limit": {str(limit): over_threshold[limit] for limit in LIMITS},
        "rows_where_prompt_alone_exceeds_limit": {
            str(limit): prompt_overflow[limit] for limit in LIMITS
        },
        "answer_loss_at_1024": {
            "rows_affected": len(answer_loss_chars),
            "approx_chars_lost_p50": pct(answer_loss_chars, 0.50),
            "approx_chars_lost_max": max(answer_loss_chars) if answer_loss_chars else 0,
        },
        "per_source_p95": {
            source: pct(values, 0.95) for source, values in sorted(per_source.items())
        },
        "per_source_counts": {
            source: len(values) for source, values in sorted(per_source.items())
        },
        "longest_row_samples": samples,
    }


def render_markdown(analysis: dict[str, Any], tokenizer_id: str,
                    configured_limit: int) -> str:
    lines = [
        "# Token-length analysis (measured, not estimated)",
        "",
        f"- Tokenizer: `{tokenizer_id}` (the real Gemma 4 tokenizer)",
        f"- Rows measured: **{analysis['rows_measured']}**",
        f"- Currently configured `max_seq_len`: **{configured_limit}**",
        "",
        "Measured with `apply_chat_template(..., add_generation_prompt=True)` plus the",
        "assistant turn, which is exactly what the trainer sees.",
        "",
        "| Statistic | Total tokens | Prompt only | Answer only |",
        "|---|---:|---:|---:|",
    ]
    t, p, a = analysis["total_tokens"], analysis["prompt_tokens"], analysis["answer_tokens"]
    for label, key in (("p50", "p50"), ("p90", "p90"), ("p95", "p95"),
                       ("p99", "p99"), ("max", "max"), ("mean", "mean")):
        lines.append(f"| {label} | {t.get(key, '-')} | {p.get(key, '-')} | "
                     f"{a.get(key, '-')} |")
    lines += [
        "",
        "## Rows over each candidate limit",
        "",
        "| Limit | Rows over limit | Rows where the PROMPT ALONE exceeds the limit |",
        "|---:|---:|---:|",
    ]
    for limit in LIMITS:
        over = analysis["rows_over_limit"][str(limit)]
        prompt_lost = analysis["rows_where_prompt_alone_exceeds_limit"][str(limit)]
        lines.append(f"| {limit} | {over} | {prompt_lost} |")
    lost = analysis["answer_loss_at_1024"]
    lines += [
        "",
        f"At the old limit of 1024, **{lost['rows_affected']} rows** lose part of their",
        f"answer (median ~{lost['approx_chars_lost_p50']} characters, worst case "
        f"~{lost['approx_chars_lost_max']} characters).",
        "",
        "## Per-source p95 total tokens",
        "",
        "| Source | Rows | p95 total tokens |",
        "|---|---:|---:|",
    ]
    for source, value in analysis["per_source_p95"].items():
        lines.append(f"| `{source}` | {analysis['per_source_counts'][source]} | {value} |")
    lines += ["", "## Longest rows (evidence)", ""]
    for sample in analysis["longest_row_samples"]:
        lines.append(
            f"- `{sample['source_dataset']}` id=`{sample['id']}`: "
            f"prompt {sample['prompt_tokens']} + answer {sample['answer_tokens']} "
            f"= {sample['total_tokens']} tokens; file `{sample['source_file']}`")
    lines.append("")
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    _common.configure_stdout()
    here = Path(__file__).resolve().parent
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tokenizer", default=DEFAULT_TOKENIZER)
    parser.add_argument("--split", default="train", choices=["train", "validation", "test"])
    parser.add_argument("--max-rows", type=int, default=None)
    _common.add_common_args(parser)
    args = parser.parse_args(argv)

    pipeline = _common.load_yaml(str(here.parent / "configs" / "data_pipeline.yaml"))
    train_config = _common.load_yaml(str(here.parent / "configs" / "train_lora.yaml"))
    configured_limit = int(train_config["training"]["max_seq_len"])

    split_path = _common.artifact_path(
        pipeline["paths"]["outputs"][args.split], args.out_root)
    if not split_path.is_file():
        raise SystemExit(f"missing split: {split_path}")

    tokenizer = load_tokenizer(args.tokenizer)

    def rows() -> Iterator[dict[str, Any]]:
        for _line, record, _raw in _common.iter_jsonl(split_path):
            if record is not None:
                yield record

    _common.info(f"tokenizing {split_path}")
    analysis = measure(tokenizer, rows(), args.max_rows)
    analysis["tokenizer_id"] = args.tokenizer
    analysis["configured_max_seq_len"] = configured_limit
    analysis["split"] = args.split

    json_path = _common.artifact_path("reports/token_length_analysis.json", args.out_root)
    _common.write_json_atomic(json_path, analysis)
    md_path = _common.artifact_path("reports/token_length_analysis.md", args.out_root)
    md_path.write_text(render_markdown(analysis, args.tokenizer, configured_limit),
                       encoding="utf-8")

    _common.info(f"rows={analysis['rows_measured']} "
                 f"total p50={analysis['total_tokens']['p50']} "
                 f"p95={analysis['total_tokens']['p95']} "
                 f"p99={analysis['total_tokens']['p99']} "
                 f"max={analysis['total_tokens']['max']}")
    for limit in LIMITS:
        _common.info(f"  >{limit}: {analysis['rows_over_limit'][str(limit)]} "
                     f"(prompt alone over: "
                     f"{analysis['rows_where_prompt_alone_exceeds_limit'][str(limit)]})")
    _common.info(f"wrote {json_path}")
    _common.info(f"wrote {md_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
