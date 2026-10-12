"""Stage 2 - dedupe: drop exact and near-duplicate rows.

Two passes, both streaming:

1. **Exact** - SHA-256 of NFKC-normalized, case-folded ``(prompt, answer)``.
2. **Near** - 64-bit SimHash over token shingles, compared only inside shared
   band buckets so the pass stays linear on a 16 GB machine instead of
   comparing every row with every other row.

Records without an answer (reference tables, prompt-only CTI-Bench rows) are
passed through untouched: there is no pair to duplicate.
"""

from __future__ import annotations

import argparse
import os
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Iterator

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _common  # noqa: E402

DEFAULT_CONFIG = Path(__file__).resolve().parent.parent / "configs" / "data_pipeline.yaml"


def iter_records(path: Path) -> Iterator[dict[str, Any]]:
    for _line, record, _raw in _common.iter_jsonl(path):
        if record is not None:
            yield record


def band_keys(simhash: int, bands: int) -> list[int]:
    """Split the 64-bit hash into ``bands`` chunks used as bucket keys."""
    width = 64 // bands
    return [(simhash >> (index * width)) & ((1 << width) - 1) for index in range(bands)]


def dedupe(records: Iterator[dict[str, Any]], *, exact: bool, near: bool,
           bands: int, max_distance: int, shingle_width: int
           ) -> tuple[Iterator[dict[str, Any]], Counter[str], list[dict[str, Any]]]:
    seen_exact: dict[str, str] = {}
    buckets: dict[tuple[int, int], list[int]] = defaultdict(list)
    kept_hashes: list[int] = []

    counters: Counter[str] = Counter()
    duplicate_examples: list[dict[str, Any]] = []

    def stream() -> Iterator[dict[str, Any]]:
        for record in records:
            counters["rows_in"] += 1
            prompt = record.get("prompt") or ""
            answer = record.get("answer") or ""

            if not answer.strip():
                counters["rows_passed_through_no_answer"] += 1
                yield record
                continue

            if exact:
                key = _common.normalized_key(prompt, answer)
                if key in seen_exact:
                    counters["dropped_exact_duplicate"] += 1
                    if len(duplicate_examples) < 5:
                        duplicate_examples.append({
                            "reason": "exact",
                            "kept_id": seen_exact[key],
                            "dropped_id": record.get("id"),
                            "prompt_head": _common.normalize_text(prompt)[:120],
                        })
                    continue
                seen_exact[key] = str(record.get("id"))

            if near:
                simhash = _common.simhash64(f"{prompt}\n{answer}", shingle_width)
                record["simhash"] = simhash
                matched: int | None = None
                for band, key_part in enumerate(band_keys(simhash, bands)):
                    for index in buckets.get((band, key_part), ()):
                        if _common.hamming64(kept_hashes[index], simhash) <= max_distance:
                            matched = index
                            break
                    if matched is not None:
                        break
                if matched is not None:
                    counters["dropped_near_duplicate"] += 1
                    if len(duplicate_examples) < 10:
                        duplicate_examples.append({
                            "reason": "near",
                            "hamming_distance": _common.hamming64(kept_hashes[matched],
                                                                  simhash),
                            "dropped_id": record.get("id"),
                            "prompt_head": _common.normalize_text(prompt)[:120],
                        })
                    continue
                kept_hashes.append(simhash)
                for band, key_part in enumerate(band_keys(simhash, bands)):
                    buckets[(band, key_part)].append(len(kept_hashes) - 1)

            counters["rows_out"] += 1
            yield record

    return stream(), counters, duplicate_examples


def main(argv: list[str] | None = None) -> int:
    _common.configure_stdout()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", default=str(DEFAULT_CONFIG))
    _common.add_common_args(parser)
    args = parser.parse_args(argv)

    config = _common.load_yaml(args.config)
    settings = config["dedupe"]
    paths = config["paths"]["outputs"]

    source = _common.artifact_path(paths["normalized"], args.out_root)
    target = _common.artifact_path(paths["deduped"], args.out_root)
    if not source.is_file():
        raise SystemExit(f"missing input: {source}\nrun prepare_dataset.py first")

    stream, counters, examples = dedupe(
        iter_records(source),
        exact=bool(settings.get("exact", True)),
        near=bool(settings.get("near", True)),
        bands=int(settings.get("band_hashes", 4)),
        max_distance=int(settings.get("near_duplicate_hamming_distance", 3)),
        shingle_width=int(settings.get("shingle_width", 5)),
    )
    kept = _common.write_jsonl_atomic(target, stream)

    report = {
        "input": str(source),
        "output": str(target),
        "settings": settings,
        "counters": dict(counters),
        "rows_written": kept,
        "duplicate_examples": examples,
    }
    report_path = _common.artifact_path(config["paths"]["reports"]["dedupe"], args.out_root)
    _common.write_json_atomic(report_path, report)

    for key in sorted(counters):
        _common.info(f"{key}: {counters[key]}")
    _common.info(f"wrote {target} ({kept} rows)")
    _common.info(f"wrote {report_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
