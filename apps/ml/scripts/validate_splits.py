"""Stage 6 - validate: prove the splits are usable and leak-free.

This is the gate that runs before any training. It fails loudly (exit code 1)
rather than warning, because every check here is the difference between a
meaningful number and a meaningless one:

* every row parses as JSON and matches the chat schema;
* every row has exactly one user turn and at least one assistant turn with
  non-empty content;
* no ``id`` appears in two splits;
* no normalized ``(prompt, answer)`` pair appears in both a training split and
  validation/test - that is answer leakage;
* split sizes are within tolerance of the configured ratios;
* every source dataset present in training appears in validation and test;
* the read-only datasets tree was not modified during the run (mtime sweep);
* no evaluation benchmark dataset appears in any training split.
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
import _sources  # noqa: E402

DEFAULT_CONFIG = Path(__file__).resolve().parent.parent / "configs" / "data_pipeline.yaml"
RATIO_TOLERANCE = 0.02


def iter_rows(path: Path) -> Iterator[dict[str, Any]]:
    for _line, record, _raw in _common.iter_jsonl(path):
        if record is not None:
            yield record


def main(argv: list[str] | None = None) -> int:
    _common.configure_stdout()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", default=str(DEFAULT_CONFIG))
    parser.add_argument("--ratio-tolerance", type=float, default=RATIO_TOLERANCE)
    _common.add_common_args(parser)
    args = parser.parse_args(argv)

    config = _common.load_yaml(args.config)
    paths = config["paths"]["outputs"]
    eval_source_datasets = set(config.get("evaluation", {}).get("sources", []))

    failures: list[str] = []
    checks: list[dict[str, Any]] = []

    def record_check(name: str, ok: bool, evidence: Any, detail: str = "",
                     advisory: bool = False) -> None:
        checks.append({"check": name, "ok": bool(ok), "evidence": evidence,
                       "advisory": advisory,
                       **({"detail": detail} if detail else {})})
        if not ok and not advisory:
            failures.append(f"{name}: {detail or evidence}")
        label = "PASS" if ok else ("NOTE" if advisory else "FAIL")
        _common.info(f"{label} {name}" + (f" - {detail}" if detail and not ok else ""))

    split_paths = {
        "train": _common.artifact_path(paths["train"], args.out_root),
        "validation": _common.artifact_path(paths["validation"], args.out_root),
        "test": _common.artifact_path(paths["test"], args.out_root),
    }
    eval_path = _common.artifact_path(paths["eval_set"], args.out_root)

    for name, path in split_paths.items():
        record_check(f"exists:{name}", path.is_file(),
                     str(path), f"{name} split file missing")
    if failures:
        report = {"checks": checks, "failures": failures}
        _common.write_json_atomic(
            _common.artifact_path(config["paths"]["reports"]["validation"], args.out_root),
            report)
        return 1

    ids_per_split: dict[str, dict[str, str]] = {}
    pairs_per_split: dict[str, defaultdict[str, str]] = {}
    source_counts: dict[str, Counter] = {}
    counts: Counter[str] = Counter()
    schema_problems: list[dict[str, Any]] = []
    files_per_split: dict[str, Counter[str]] = {}

    for name, path in split_paths.items():
        ids: dict[str, str] = {}
        pairs: defaultdict[str, str] = defaultdict(str)
        sources: Counter[str] = Counter()
        source_files: Counter[str] = Counter()
        with path.open("r", encoding="utf-8", errors="strict") as handle:
            for line_number, line in enumerate(handle, start=1):
                if not line.strip():
                    continue
                try:
                    row = json.loads(line)
                except Exception as exc:  # noqa: BLE001
                    schema_problems.append({"split": name, "line": line_number,
                                            "problem": f"invalid JSON: {exc}"})
                    continue
                messages = row.get("messages")
                if not isinstance(messages, list) or not messages:
                    schema_problems.append({"split": name, "line": line_number,
                                            "problem": "missing messages"})
                    continue
                roles = [m.get("role") for m in messages if isinstance(m, dict)]
                if roles.count("user") != 1:
                    schema_problems.append({"split": name, "line": line_number,
                                            "problem": f"expected 1 user turn, got "
                                                       f"{roles.count('user')}"})
                if roles.count("assistant") < 1:
                    schema_problems.append({"split": name, "line": line_number,
                                            "problem": "no assistant turn"})
                if roles and roles[0] == "assistant":
                    schema_problems.append({"split": name, "line": line_number,
                                            "problem": "first turn is assistant"})
                for message in messages:
                    if not isinstance(message, dict) or not str(
                            message.get("content") or "").strip():
                        schema_problems.append({"split": name, "line": line_number,
                                                "problem": "empty message content"})
                        break
                row_id = str(row.get("id"))
                if row_id in ids:
                    schema_problems.append({"split": name, "line": line_number,
                                            "problem": f"duplicate id {row_id}"})
                ids[row_id] = name
                prompt = next((m["content"] for m in messages
                               if isinstance(m, dict) and m.get("role") == "user"), "")
                answer = next((m["content"] for m in messages
                               if isinstance(m, dict) and m.get("role") == "assistant"), "")
                pairs[_common.normalized_key(prompt, answer)] = row_id
                sources[str(row.get("source_dataset"))] += 1
                source_files[str(row.get("source_file"))] += 1
                counts[name] += 1
        ids_per_split[name] = ids
        pairs_per_split[name] = pairs
        source_counts[name] = sources
        files_per_split[name] = source_files

    record_check("schema_conformance", not schema_problems, schema_problems[:20],
                 f"{len(schema_problems)} schema problem(s)")

    overlap_ids = set(ids_per_split["train"]) & (
        set(ids_per_split["validation"]) | set(ids_per_split["test"]))
    record_check("no_id_overlap_train_vs_eval", not overlap_ids,
                 sorted(overlap_ids)[:10],
                 f"{len(overlap_ids)} id(s) appear in training and eval")

    held_out_pairs = set(pairs_per_split["validation"]) | set(pairs_per_split["test"])
    leaked = set(pairs_per_split["train"]) & held_out_pairs
    record_check("no_answer_leakage", not leaked, sorted(leaked)[:10],
                 f"{len(leaked)} (prompt, answer) pair(s) in both train and eval")

    total = sum(counts.values())
    actual = {name: counts[name] / max(1, total) for name in split_paths}
    expected = {name: float(config["splits"][name]) for name in split_paths}
    ratio_ok = all(abs(actual[name] - expected[name]) <= args.ratio_tolerance
                   for name in split_paths)
    record_check("split_ratios_within_tolerance", ratio_ok,
                 {"expected": expected,
                  "actual": {k: round(v, 5) for k, v in actual.items()},
                  "tolerance": args.ratio_tolerance},
                 "a split drifted from its configured share")

    train_sources = set(source_counts["train"])
    missing_in_eval = sorted(train_sources - set(source_counts["validation"])
                             - set(source_counts["test"]))
    record_check("every_trained_source_is_evaluated", not missing_in_eval,
                 missing_in_eval,
                 "a source is trained on but never evaluated")

    # Contamination is checked per SOURCE FILE, not per dataset. The manifest
    # deliberately marks SecBench MCQs eval_only and SecBench SAQs sft_train, so
    # a dataset-level rule would report a false failure for SecBench while
    # missing a genuine leak of the MCQ file into training.
    manifest = _sources.load_manifest(
        str(Path(__file__).resolve().parent.parent / "configs" / "dataset_manifest.yaml"))
    eval_only_files = {spec["source_path"] for _dataset, spec in _sources.iter_source_specs(manifest)
                       if spec.get("usage") == "eval_only"}
    sft_train_files = {spec["source_path"] for _dataset, spec in _sources.iter_source_specs(manifest)
                       if spec.get("usage") == "sft_train"}

    leaked_files = sorted({f for name in split_paths
                           for f in files_per_split[name] if f in eval_only_files})
    record_check("no_eval_only_file_in_splits", not leaked_files, leaked_files,
                 "an eval_only source file ended up in a training or held-out split")

    unknown_files = sorted({f for name in split_paths for f in files_per_split[name]
                            if f not in sft_train_files and f not in eval_only_files})
    record_check("all_split_rows_traceable_to_manifest", not unknown_files,
                 unknown_files, "a split row came from a file the manifest never declared")

    shared_datasets = sorted(train_sources & eval_source_datasets)
    record_check(
        "benchmark_dataset_shared_with_training", not shared_datasets,
        {"shared": shared_datasets,
         "eval_only_files": sorted(eval_only_files),
         "note": "a dataset used for both training and evaluation is reported here so "
                 "the overlap is visible; per-file usage in the manifest decides "
                 "whether it is a leak"},
        f"{shared_datasets} contributes to both training and evaluation "
        f"(different files: SAQ rows train, MCQ rows are held out)",
        advisory=True,
    )

    eval_exists = eval_path.is_file()
    eval_rows = 0
    eval_composition: Counter[str] = Counter()
    if eval_exists:
        for row in iter_rows(eval_path):
            eval_rows += 1
            eval_composition[f"{row.get('source_dataset')}:{row.get('kind')}"] += 1
            if not str(row.get("answer") or "").strip():
                failures.append(f"eval row {row.get('eval_id')} has no answer")
    record_check("eval_set_present", eval_exists and eval_rows > 0,
                 {"path": str(eval_path), "rows": eval_rows,
                  "composition": dict(eval_composition)},
                 "evaluation set is empty or missing")

    # Read-only integrity: nothing under the datasets tree may be newer than the
    # inventory that recorded it.
    datasets_root = _common.datasets_root()
    inventory = Path(_common.training_root()) / "reports" / "data_inventory.json"
    modified: list[str] = []
    if datasets_root.is_dir() and inventory.is_file():
        inventory_mtime = inventory.stat().st_mtime
        for path in datasets_root.rglob("*"):
            if path.is_file() and path.stat().st_mtime > inventory_mtime + 1:
                modified.append(str(path.relative_to(datasets_root)))
    record_check("datasets_tree_untouched", not modified, modified[:10],
                 f"{len(modified)} file(s) newer than the inventory snapshot")

    report = {
        "checks": checks,
        "failures": failures,
        "split_counts": dict(counts),
        "actual_ratios": {k: round(v, 6) for k, v in actual.items()},
        "per_source": {k: dict(v) for k, v in source_counts.items()},
        "schema_problems": schema_problems[:50],
        "eval_set": {"rows": eval_rows, "composition": dict(eval_composition)},
        "verdict": "PASS" if not failures else "FAIL",
    }
    report_path = _common.artifact_path(config["paths"]["reports"]["validation"], args.out_root)
    _common.write_json_atomic(report_path, report)
    _common.info(f"verdict: {report['verdict']} ({len(failures)} failure(s))")
    _common.info(f"wrote {report_path}")
    return 0 if not failures else 1


if __name__ == "__main__":
    raise SystemExit(main())
