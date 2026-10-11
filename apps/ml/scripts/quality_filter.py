"""Stage 3 - quality filter: drop rows that cannot teach anything useful.

Rules come from ``data_pipeline.yaml``. Each rejection is counted by reason so
the report shows exactly how much data was lost and why. Credential-shaped
strings are masked rather than dropped: a row is still useful without the fake
key in it, and masking keeps the pipeline from shipping anything key-like.

Length rules are applied only to prompt/answer pairs. Multiple-choice rows carry
a one-letter answer by design, so they are exempt from ``min_answer_chars``.
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Iterator

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _common  # noqa: E402

DEFAULT_CONFIG = Path(__file__).resolve().parent.parent / "configs" / "data_pipeline.yaml"

SECRET_PATTERNS = (
    ("email", re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")),
    ("api_key_like", re.compile(r"\bsk-[A-Za-z0-9_\-]{16,}\b")),
    ("github_token", re.compile(r"\bgh[pousr]_[A-Za-z0-9]{20,}\b")),
    ("aws_key", re.compile(r"\bAKIA[0-9A-Z]{16}\b")),
    ("private_key", re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----")),
    ("credential_assignment",
     re.compile(r"(?i)\b(password|passwd|api[_-]?key|secret|token)\b\s*[:=]\s*\S{6,}")),
)

TOKEN_RE = re.compile(r"\S+")
CJK_RE = re.compile(r"[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u3040-\u30ff]")

# The repetition heuristic needs enough tokens to mean anything. A one-letter
# MCQ answer or a short Chinese sentence would otherwise score 1.0 and be
# dropped as "degenerate".
MIN_TOKENS_FOR_REPETITION_CHECK = 20


def mask_secrets(text: str) -> tuple[str, list[str]]:
    hits: list[str] = []
    masked = text
    for label, pattern in SECRET_PATTERNS:
        if pattern.search(masked):
            hits.append(label)
            masked = pattern.sub(f"<<REDACTED:{label}>>", masked)
    return masked, hits


def tokenize_for_repetition(text: str) -> list[str]:
    """Whitespace words plus individual CJK characters.

    Chinese is written without spaces, so ``tok tok tok``-style whitespace
    tokenization returns the whole sentence as one token and every Chinese row
    would look maximally repetitive. Adding CJK characters as tokens makes the
    measure comparable across scripts.
    """
    folded = text.casefold()
    tokens = TOKEN_RE.findall(folded)
    if CJK_RE.search(folded):
        tokens.extend(ch for ch in folded if CJK_RE.match(ch))
    return tokens


def max_token_repeat_ratio(text: str) -> float:
    tokens = tokenize_for_repetition(text)
    if len(tokens) < MIN_TOKENS_FOR_REPETITION_CHECK:
        return 0.0
    counts = Counter(tokens)
    return counts.most_common(1)[0][1] / len(tokens)


def symbol_ratio(text: str) -> float:
    if not text:
        return 0.0
    symbols = sum(1 for ch in text if not (ch.isalnum() or ch.isspace()))
    return symbols / len(text)


def readable_ratio(text: str) -> float:
    """Share of characters that are letters/digits/whitespace, ASCII or CJK."""
    if not text:
        return 0.0
    good = sum(1 for ch in text
               if ch.isalnum() or ch.isspace() or CJK_RE.match(ch)
               or ch in ".,;:!?'\"()[]{}<>/\\|-–—_=+*#$%&@^~")
    return good / len(text)


def should_drop(record: dict[str, Any], settings: dict[str, Any],
                refusal_patterns: tuple[re.Pattern[str], ...]
                ) -> tuple[str | None, list[str]]:
    """Return ``(drop_reason, masked_flags)``; ``None`` means keep."""
    prompt = record.get("prompt") or ""
    answer = record.get("answer") or ""
    task_type = record.get("task_type") or ""
    is_mcq = task_type == "multiple_choice"

    if settings.get("drop_empty_assistant", True) and not answer.strip():
        if record.get("usage") == "reference_only":
            return None, []
        return "empty_answer", []

    if not prompt.strip() and not is_mcq:
        return "empty_prompt", []

    if not is_mcq:
        if len(prompt) < int(settings.get("min_prompt_chars", 0)):
            return "prompt_too_short", []
        if len(answer) < int(settings.get("min_answer_chars", 0)):
            return "answer_too_short", []
        # Script-aware word count: Chinese is written without spaces, so a plain
        # whitespace split would score a complete Chinese sentence as one word
        # and reject most of the SecBench Chinese rows.
        if len(tokenize_for_repetition(answer)) < int(settings.get("min_words_answer", 0)):
            return "answer_too_few_words", []
    else:
        if len(prompt) < int(settings.get("min_prompt_chars", 0)):
            return "prompt_too_short", []

    if len(prompt) > int(settings.get("max_prompt_chars", 10 ** 9)):
        return "prompt_too_long", []
    if len(answer) > int(settings.get("max_answer_chars", 10 ** 9)):
        return "answer_too_long", []

    if settings.get("drop_prompt_echoing_answer", True) and not is_mcq:
        head = _common.normalize_text(answer).casefold()[:80]
        if head and head in _common.normalize_text(prompt).casefold():
            return "answer_echoes_prompt", []

    if settings.get("drop_refusal_answers", True) and not is_mcq:
        if any(pattern.search(answer) for pattern in refusal_patterns):
            return "refusal_answer", []

    if max_token_repeat_ratio(answer) > float(settings.get("max_repeated_token_ratio", 1.0)):
        return "degenerate_repetition", []
    if symbol_ratio(answer) > float(settings.get("max_symbol_ratio", 1.0)):
        return "symbol_blob", []
    if readable_ratio(answer) < float(settings.get("min_ascii_or_cjk_ratio", 0.0)):
        return "unreadable_characters", []

    masked_flags: list[str] = []
    if settings.get("mask_secrets", True):
        _, prompt_hits = mask_secrets(prompt)
        _, answer_hits = mask_secrets(answer)
        masked_flags = sorted(set(prompt_hits + answer_hits))
    return None, masked_flags


def main(argv: list[str] | None = None) -> int:
    _common.configure_stdout()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", default=str(DEFAULT_CONFIG))
    _common.add_common_args(parser)
    args = parser.parse_args(argv)

    config = _common.load_yaml(args.config)
    settings = config["quality"]
    paths = config["paths"]["outputs"]

    refusal_patterns = tuple(re.compile(re.escape(marker), re.I)
                             for marker in settings.get("refusal_markers", []))

    source = _common.artifact_path(paths["deduped"], args.out_root)
    target = _common.artifact_path(paths["filtered"], args.out_root)
    if not source.is_file():
        raise SystemExit(f"missing input: {source}\nrun dedupe.py first")

    drop_reasons: Counter[str] = Counter()
    per_source: dict[str, Counter] = defaultdict(Counter)
    masked_totals: Counter[str] = Counter()
    examples: dict[str, dict[str, Any]] = {}
    rows_in = 0

    def stream() -> Iterator[dict[str, Any]]:
        nonlocal rows_in
        for _line, record, _raw in _common.iter_jsonl(source):
            if record is None:
                continue
            rows_in += 1
            reason, masked = should_drop(record, settings, refusal_patterns)
            source_key = record.get("source_file", "unknown")
            per_source[source_key]["rows_in"] += 1
            if reason:
                drop_reasons[reason] += 1
                per_source[source_key][f"dropped_{reason}"] += 1
                examples.setdefault(reason, {
                    "source_file": source_key,
                    "row_index": record.get("row_index"),
                    "prompt_head": _common.normalize_text(record.get("prompt") or "")[:160],
                })
                continue
            if masked:
                record["prompt"], _ = mask_secrets(record.get("prompt") or "")
                record["answer"], _ = mask_secrets(record.get("answer") or "")
                record["masked"] = masked
                for name in masked:
                    masked_totals[name] += 1
            per_source[source_key]["rows_kept"] += 1
            yield record

    kept = _common.write_jsonl_atomic(target, stream())

    report = {
        "input": str(source),
        "output": str(target),
        "settings": settings,
        "rows_in": rows_in,
        "rows_kept": kept,
        "rows_dropped": rows_in - kept,
        "drop_reasons": dict(drop_reasons),
        "masked_flags": dict(masked_totals),
        "per_source": {k: dict(v) for k, v in sorted(per_source.items())},
        "drop_examples": examples,
    }
    report_path = _common.artifact_path(config["paths"]["reports"]["quality"], args.out_root)
    _common.write_json_atomic(report_path, report)

    _common.info(f"rows in={rows_in} kept={kept} dropped={rows_in - kept}")
    for reason in sorted(drop_reasons):
        _common.info(f"  dropped {reason}: {drop_reasons[reason]}")
    if masked_totals:
        _common.info(f"  masked flags: {dict(masked_totals)}")
    _common.info(f"wrote {target}")
    _common.info(f"wrote {report_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
