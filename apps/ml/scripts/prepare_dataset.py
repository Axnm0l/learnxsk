"""Stage 1 - prepare: normalize every manifest source into one record stream.

Writes:
    processed/normalized_records.jsonl   every record, all usages, one pass
    processed/reference_tables.jsonl     usage == reference_only rows
    reports/prepare_dataset_report.json  counts, flags and the sampling decision

Read-only promise: the datasets tree is opened for reading only. The output root
is validated by ``_common`` before a single byte is written.
"""

from __future__ import annotations

import argparse
import math
import os
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _common  # noqa: E402
import _sources  # noqa: E402

DEFAULT_CONFIG = Path(__file__).resolve().parent.parent / "configs" / "data_pipeline.yaml"


def compute_stride(expected_rows: int | None, cap: int | None) -> int:
    """Rows are kept when ``row_index % stride == 0``.

    A stride beats taking the first N rows because the upstream files are
    topically ordered; a stride spreads the sample across the whole file while
    staying a pure function of the row index, so the result is reproducible.
    """
    if not cap or not expected_rows or expected_rows <= cap:
        return 1
    return max(1, math.ceil(expected_rows / cap))


def main(argv: list[str] | None = None) -> int:
    _common.configure_stdout()
    here = Path(__file__).resolve().parent
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", default=str(DEFAULT_CONFIG))
    parser.add_argument("--manifest",
                        default=str(here.parent / "configs" / "dataset_manifest.yaml"))
    parser.add_argument("--datasets-root", default=str(_common.DEFAULT_DATASETS_ROOT))
    _common.add_common_args(parser)
    args = parser.parse_args(argv)

    config = _common.load_yaml(args.config)
    manifest = _sources.load_manifest(args.manifest)
    datasets_root = Path(args.datasets_root)

    paths = config["paths"]
    cap = config.get("format", {}).get("max_records_per_source")

    # Expected row counts come from the audit when it has run, so the sampling
    # stride can be decided before streaming instead of buffering the file.
    expected: dict[str, int] = {}
    stats_path = _common.artifact_path("reports/dataset_source_stats.json", args.out_root)
    if stats_path.is_file():
        for source in _common.read_json(stats_path)["sources"]:
            expected[source["source_file"]] = source["rows"]
    else:
        _common.info("no audit stats found; falling back to manifest approximations")

    out_normalized = _common.artifact_path(paths["outputs"]["normalized"], args.out_root)
    out_reference = _common.artifact_path(paths["outputs"]["reference"], args.out_root)

    counters: dict[str, Counter] = defaultdict(Counter)
    flag_totals: Counter[str] = Counter()
    language_totals: Counter[str] = Counter()
    stride_report: dict[str, int] = {}
    usage_totals: Counter[str] = Counter()
    normalized_count = 0
    reference_count = 0

    # Both output files are written in one single pass over the sources.
    out_normalized.parent.mkdir(parents=True, exist_ok=True)
    tmp_all = out_normalized.with_suffix(".jsonl.tmp")
    tmp_ref = out_reference.with_suffix(".jsonl.tmp")
    with tmp_all.open("w", encoding="utf-8", newline="\n") as handle_all, \
            tmp_ref.open("w", encoding="utf-8", newline="\n") as handle_ref:
        for dataset, spec in _sources.iter_source_specs(manifest):
            _common.info(f"preparing {dataset['id']} :: {spec['source_path']}")
            usage = spec.get("usage", "sft_train")
            source_file = spec["source_path"]
            expected_rows = expected.get(source_file)
            stride = compute_stride(expected_rows if usage == "sft_train" else None,
                                    cap if usage == "sft_train" else None)
            stride_report[source_file] = stride
            kept = 0
            for record in _sources.iter_dataset_records(dataset, spec, datasets_root):
                counters[source_file]["rows_seen"] += 1
                if usage == "sft_train" and stride > 1 and record.row_index % stride:
                    counters[source_file]["rows_sampled_out"] += 1
                    continue
                if usage == "sft_train" and cap and kept >= cap:
                    counters[source_file]["rows_capped_out"] += 1
                    continue
                payload = record.to_dict()
                if stride > 1:
                    payload["sampling"] = {"stride": stride, "cap": cap}
                kept += 1
                usage_totals[payload["usage"]] += 1
                counters[source_file]["rows_kept"] += 1
                for flag in payload["flags"]:
                    flag_totals[flag] += 1
                if payload.get("language"):
                    language_totals[payload["language"]] += 1
                line = _common.json.dumps(payload, ensure_ascii=False)
                handle_all.write(line + "\n")
                normalized_count += 1
                if payload["usage"] == "reference_only":
                    handle_ref.write(line + "\n")
                    reference_count += 1

    os.replace(tmp_all, out_normalized)
    os.replace(tmp_ref, out_reference)

    report = {
        "datasets_root": str(datasets_root),
        "normalized_records": normalized_count,
        "reference_records": reference_count,
        "usage_totals": dict(usage_totals),
        "sampling_stride_per_source": stride_report,
        "max_records_per_source": cap,
        "per_source": {k: dict(v) for k, v in sorted(counters.items())},
        "flag_totals": dict(flag_totals),
        "language_totals": dict(language_totals),
        "outputs": {
            "normalized": str(out_normalized),
            "reference": str(out_reference),
        },
    }
    report_path = _common.artifact_path(paths["reports"]["prepare"], args.out_root)
    _common.write_json_atomic(report_path, report)
    _common.info(f"wrote {out_normalized} ({normalized_count} records)")
    _common.info(f"wrote {out_reference} ({reference_count} reference rows)")
    _common.info(f"wrote {report_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
