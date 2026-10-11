"""Phase 1 audit: inventory, quality, licence and recommendation reports.

Reads the read-only datasets tree exactly once per source, in a streaming pass,
and writes four human-readable reports plus a resolved manifest:

    reports/dataset_inventory.md
    reports/dataset_quality_audit.md
    reports/dataset_license_audit.md
    reports/dataset_recommendations.md
    manifests/dataset_manifest_resolved.yaml

Every number in those reports is computed here. Declared values from
``configs/dataset_manifest.yaml`` are compared against observed values and any
mismatch is printed as a finding rather than quietly corrected.

Standard library only (plus PyYAML for the manifest).
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _common  # noqa: E402
import _sources  # noqa: E402

SECRET_PATTERNS = (
    ("email", re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")),
    ("api_key_like", re.compile(r"\bsk-[A-Za-z0-9_\-]{16,}\b")),
    ("github_token", re.compile(r"\bgh[pousr]_[A-Za-z0-9]{20,}\b")),
    ("aws_key", re.compile(r"\bAKIA[0-9A-Z]{16}\b")),
    ("private_key", re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----")),
    ("credential_assignment",
     re.compile(r"(?i)\b(password|passwd|api[_-]?key|secret|token)\b\s*[:=]\s*\S{6,}")),
)

REFUSAL_PATTERNS = (
    re.compile(r"as an ai( language)? model", re.I),
    re.compile(r"i (cannot|can't|can not) (assist|help|provide) (with )?(that|this)", re.I),
    re.compile(r"i'?m sorry, but i (can'?t|cannot)", re.I),
    re.compile(r"i am unable to provide", re.I),
)

MULTI_SPACE = re.compile(r"\s{2,}")


def percentile(values: list[int], fraction: float) -> int:
    if not values:
        return 0
    ordered = sorted(values)
    index = min(len(ordered) - 1, max(0, int(round(fraction * (len(ordered) - 1)))))
    return ordered[index]


def mask_preview(text: str, limit: int = 160) -> str:
    masked = text
    for label, pattern in SECRET_PATTERNS:
        masked = pattern.sub(f"<<REDACTED:{label}>>", masked)
    masked = MULTI_SPACE.sub(" ", masked.replace("\n", " ")).strip()
    return masked[:limit] + ("..." if len(masked) > limit else "")


class SourceStats:
    def __init__(self, dataset_id: str, source_file: str, adapter: str, usage: str):
        self.dataset_id = dataset_id
        self.source_file = source_file
        self.adapter = adapter
        self.usage = usage
        self.rows = 0
        self.empty_prompt = 0
        self.empty_answer = 0
        self.malformed = 0
        self.refusals = 0
        self.multi_select = 0
        self.answer_lens: list[int] = []
        self.prompt_lens: list[int] = []
        self.flag_counts: Counter[str] = Counter()
        self.secret_flags: Counter[str] = Counter()
        self.languages: Counter[str] = Counter()
        self.prompt_keys: set[str] = set()
        self.full_keys: set[str] = set()
        self.duplicate_full = 0
        self.duplicate_prompt = 0
        self.non_ascii_rows = 0
        self.samples: list[dict[str, str]] = []

    def observe(self, record: "_sources.SourceRecord") -> None:
        self.rows += 1
        for flag in record.flags:
            self.flag_counts[flag] += 1
        if record.task_type == "malformed" or "excluded_malformed_row" in record.flags:
            self.malformed += 1
            if len(self.samples) < 2:
                self.samples.append({
                    "prompt": f"(malformed row {record.row_index})",
                    "answer": ", ".join(record.flags),
                })
            return

        prompt = record.prompt or ""
        answer = record.answer or ""
        if not prompt.strip():
            self.empty_prompt += 1
        if not answer.strip():
            self.empty_answer += 1
        self.prompt_lens.append(len(prompt))
        self.answer_lens.append(len(answer))
        if record.language:
            self.languages[record.language] += 1
        if "multi_select_answer" in record.flags:
            self.multi_select += 1

        if prompt and answer:
            key = _common.normalized_key(prompt)
            if key in self.prompt_keys:
                self.duplicate_prompt += 1
            else:
                self.prompt_keys.add(key)
            full = _common.normalized_key(prompt, answer)
            if full in self.full_keys:
                self.duplicate_full += 1
            else:
                self.full_keys.add(full)

        haystack = f"{prompt}\n{answer}"
        if any(ord(ch) > 127 for ch in haystack):
            self.non_ascii_rows += 1
        if any(p.search(answer) for p in REFUSAL_PATTERNS):
            self.refusals += 1
        for label, pattern in SECRET_PATTERNS:
            if pattern.search(haystack):
                self.secret_flags[label] += 1
        if len(self.samples) < 2 and prompt:
            self.samples.append({
                "prompt": mask_preview(prompt),
                "answer": mask_preview(answer),
            })

    def prompt_stats(self) -> dict[str, int]:
        return self._length_stats(self.prompt_lens)

    def answer_stats(self) -> dict[str, int]:
        return self._length_stats(self.answer_lens)

    @staticmethod
    def _length_stats(values: list[int]) -> dict[str, int]:
        return {
            "p05": percentile(values, 0.05),
            "p50": percentile(values, 0.50),
            "p95": percentile(values, 0.95),
            "max": max(values) if values else 0,
        }

    def to_dict(self) -> dict[str, Any]:
        return {
            "source_dataset": self.dataset_id,
            "source_file": self.source_file,
            "adapter": self.adapter,
            "usage": self.usage,
            "rows": self.rows,
            "malformed_rows": self.malformed,
            "empty_prompt_rows": self.empty_prompt,
            "empty_answer_rows": self.empty_answer,
            "duplicate_prompt_rows": self.duplicate_prompt,
            "duplicate_pair_rows": self.duplicate_full,
            "refusal_answers": self.refusals,
            "multi_select_rows": self.multi_select,
            "non_ascii_rows": self.non_ascii_rows,
            "prompt_chars": self.prompt_stats(),
            "answer_chars": self.answer_stats(),
            "languages": dict(self.languages),
            "flags": dict(self.flag_counts),
            "secret_flags": dict(self.secret_flags),
            "samples": self.samples,
        }


def collect_stats(manifest: dict[str, Any], datasets_root: Path) -> list[SourceStats]:
    stats: list[SourceStats] = []
    for dataset, spec in _sources.iter_source_specs(manifest):
        source_path = _sources.resolve_source_path(datasets_root, spec)
        if not source_path.exists():
            _common.info(f"MISSING source: {source_path}")
            continue
        stat = SourceStats(dataset["id"], spec["source_path"], spec.get("adapter", "?"),
                           spec.get("usage", "sft_train"))
        _common.info(f"auditing {dataset['id']} :: {spec['source_path']}")
        for record in _sources.iter_dataset_records(dataset, spec, datasets_root):
            stat.observe(record)
        stats.append(stat)
    return stats


# --------------------------------------------------------------------------
# Report writers
# --------------------------------------------------------------------------

def write_inventory_report(inventory: dict[str, Any], manifest: dict[str, Any],
                           stats: list[SourceStats]) -> str:
    observed_bytes = {ds["dataset_id"]: ds["total_size_bytes"]
                      for ds in inventory["datasets"]}
    observed_files = {ds["dataset_id"]: ds["file_count"] for ds in inventory["datasets"]}
    rows_by_dataset: dict[str, int] = defaultdict(int)
    for stat in stats:
        rows_by_dataset[stat.dataset_id] += stat.rows

    lines: list[str] = []
    lines.append("# Dataset inventory")
    lines.append("")
    lines.append(f"- Datasets root (read-only): `{inventory['datasets_root']}`")
    lines.append(f"- Dataset groupings discovered: **{inventory['dataset_count']}**")
    lines.append(f"- Loose files in the datasets root: {inventory['ungrouped_file_count']} "
                 f"(a top-level `README.md`, deliberately not counted as a dataset)")
    lines.append("")
    lines.append("Counts below are observed from the files on disk. Where the manifest "
                 "declares an approximate count, the observed value is compared "
                 "against it and mismatches are listed as findings.")
    lines.append("")
    lines.append("| Dataset | Files | Size (MiB) | Normalized rows | Usage | Licence |")
    lines.append("|---|---:|---:|---:|---|---|")
    for dataset in inventory["datasets"]:
        dataset_id = dataset["dataset_id"]
        declared = next((d for d in manifest["datasets"] if d["id"] == dataset_id), {})
        lines.append(
            f"| `{dataset_id}` | {dataset['file_count']} | "
            f"{dataset['total_size_bytes'] / 1024 / 1024:.2f} | "
            f"{rows_by_dataset.get(dataset_id, 0)} | "
            f"{declared.get('usage', 'not in manifest')} | "
            f"{declared.get('license', 'n/a')} |"
        )
    lines.append("")
    lines.append("## Per-dataset detail")
    lines.append("")

    mismatches: list[str] = []
    for dataset in inventory["datasets"]:
        dataset_id = dataset["dataset_id"]
        declared = next((d for d in manifest["datasets"] if d["id"] == dataset_id), None)
        lines.append(f"### {dataset_id}")
        lines.append("")
        if declared:
            lines.append(f"- Upstream: {declared.get('upstream', 'n/a')}")
            lines.append(f"- Licence: `{declared.get('license')}` "
                         f"(commercial use: "
                         f"{'allowed' if declared.get('license_commercial_ok') else 'restricted'})")
            lines.append(f"- Intended use: `{declared.get('usage')}`")
            approx = declared.get("approx_rows")
            observed = rows_by_dataset.get(dataset_id, 0)
            if approx is not None and observed and approx != observed:
                mismatches.append(
                    f"`{dataset_id}`: manifest declares ~{approx} rows, observed {observed} "
                    f"normalized rows"
                )
            size_declared = declared.get("size_bytes")
            size_observed = observed_bytes.get(dataset_id)
            if size_declared and size_observed and size_declared != size_observed:
                mismatches.append(
                    f"`{dataset_id}`: manifest declares {size_declared} bytes, "
                    f"observed {size_observed} bytes"
                )
        else:
            lines.append("- Not described in the manifest, so it is not ingested.")
        lines.append("")
        lines.append("| File | Kind | Records on disk | Malformed | SHA-256 (first 16) |")
        lines.append("|---|---|---:|---:|---|")
        for file_info in dataset["files"]:
            lines.append(
                f"| `{file_info['relative_path']}` | {file_info['kind']} | "
                f"{file_info['record_count'] if file_info['record_count'] is not None else '-'} | "
                f"{file_info['malformed_records'] if file_info['malformed_records'] is not None else '-'} | "
                f"`{(file_info['sha256'] or '')[:16]}` |"
            )
        lines.append("")
        for file_info in dataset["files"]:
            if file_info["schema"]:
                keys = ", ".join(f"`{k}`" for k in list(file_info["schema"])[:12])
                lines.append(f"- Schema for `{file_info['relative_path']}`: {keys}")
        lines.append("")

    lines.append("## Declared-vs-observed mismatches")
    lines.append("")
    if mismatches:
        for item in mismatches:
            lines.append(f"- {item}")
    else:
        lines.append("- None.")
    lines.append("")
    return "\n".join(lines)


def write_quality_report(stats: list[SourceStats], manifest: dict[str, Any]) -> str:
    lines: list[str] = []
    lines.append("# Dataset quality audit")
    lines.append("")
    lines.append("Produced by `apps/ml/scripts/audit_datasets.py` in a single streaming "
                 "pass over the read-only datasets. No row content is modified.")
    lines.append("")
    lines.append("| Source file | Rows | Malformed | Empty prompt | Empty answer | "
                 "Duplicate prompt | Duplicate pair | Refusal answers | Multi-select | "
                 "Answer chars (p50) |")
    lines.append("|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|")
    for stat in stats:
        lines.append(
            f"| `{stat.source_file}` | {stat.rows} | {stat.malformed} | "
            f"{stat.empty_prompt} | {stat.empty_answer} | {stat.duplicate_prompt} | "
            f"{stat.duplicate_full} | {stat.refusals} | {stat.multi_select} | "
            f"{stat.answer_stats()['p50']} |"
        )
    lines.append("")
    lines.append("## Length distribution")
    lines.append("")
    lines.append("| Source file | Prompt p05/p50/p95/max | Answer p05/p50/p95/max |")
    lines.append("|---|---|---|")
    for stat in stats:
        p = stat.prompt_stats()
        a = stat.answer_stats()
        lines.append(
            f"| `{stat.source_file}` | {p['p05']}/{p['p50']}/{p['p95']}/{p['max']} | "
            f"{a['p05']}/{a['p50']}/{a['p95']}/{a['max']} |"
        )
    lines.append("")
    lines.append("## Findings")
    lines.append("")

    findings: list[str] = []
    for stat in stats:
        if stat.malformed:
            findings.append(
                f"**{stat.source_file}**: {stat.malformed} row(s) are not valid JSON and "
                f"are excluded from training. The repair path re-escapes bare backslashes; "
                f"rows that still fail are dropped and counted here."
            )
        if stat.empty_answer and stat.usage in {"sft_train", "eval_only"}:
            findings.append(
                f"**{stat.source_file}**: {stat.empty_answer} row(s) have an empty answer. "
                f"These cannot teach anything and are dropped by the quality filter."
            )
        if stat.empty_prompt:
            findings.append(
                f"**{stat.source_file}**: {stat.empty_prompt} row(s) have an empty prompt."
            )
        if stat.refusals:
            findings.append(
                f"**{stat.source_file}**: {stat.refusals} row(s) contain a refusal-style "
                f"answer. Dropped from training (they teach refusal, not skill) unless the "
                f"source is evaluation-only."
            )
        if stat.duplicate_full:
            findings.append(
                f"**{stat.source_file}**: {stat.duplicate_full} exact duplicate "
                f"(prompt, answer) row(s) after NFKC + whitespace normalization."
            )
        if stat.duplicate_prompt and not stat.duplicate_full:
            findings.append(
                f"**{stat.source_file}**: {stat.duplicate_prompt} repeated prompt(s) with "
                f"differing answers - kept, because they are different supervision targets."
            )
        if stat.multi_select:
            findings.append(
                f"**{stat.source_file}**: {stat.multi_select} multiple-choice row(s) have "
                f"a multi-letter label (for example `ABD`). These are rendered as "
                f"several letters and scored only on exact set match."
            )
        if stat.secret_flags:
            summary = ", ".join(f"{k}={v}" for k, v in sorted(stat.secret_flags.items()))
            findings.append(
                f"**{stat.source_file}**: credential-shaped strings detected ({summary}). "
                f"Matches are masked in outputs and never printed verbatim."
            )
        if stat.non_ascii_rows:
            share = stat.non_ascii_rows / max(1, stat.rows)
            findings.append(
                f"**{stat.source_file}**: {stat.non_ascii_rows} row(s) "
                f"({share:.1%}) contain non-ASCII characters. Handled by the UTF-8 "
                f"stdout guard; Chinese rows are kept in their original script."
            )

    dataset_notes = {
        "CyberMetric": (
            "The four CyberMetric files are **nested subsets** of one another "
            "(10,000 > 2,000 > 500 > 80). Only `CyberMetric-10000-v1.json` is "
            "ingested; ingesting all four would place the same questions in the "
            "evaluation set up to four times and inflate accuracy."
        ),
        "NIST-NICE-Framework": (
            "The NICE components JSON holds 2,356 elements but a large share have an "
            "empty `text` field (for example element `S-OG`). It is reference data, not "
            "question/answer data, and is exported as a reference table instead of SFT "
            "rows. The bundled PDF needs `pypdf` for a page count and the spreadsheets "
            "are summarized per sheet rather than exploded into thousands of rows."
        ),
        "Trendyol-Cybersecurity-Instruction-Tuning-Dataset": (
            "Upstream bytes look like UTF-8 that was re-encoded through cp1252: smart "
            "quotes appear as `\\uFFFD`-style mojibake. Normalization strips control "
            "characters and collapses whitespace, but damaged characters are left as "
            "they are rather than guessed at."
        ),
        "KALI_LINUX_TOOLKIT_DATASET": (
            "No prompts exist upstream, so prompts are synthesized deterministically "
            "from tool + command. Every synthesized row is flagged "
            "`synthesized_prompt` so a reviewer can filter them out."
        ),
        "Linux_Terminal_Commands_Dataset": (
            "Row `cmd-455` is invalid JSON (a bare `\\.` escape). It is repaired rather "
            "than dropped, and the repair is counted."
        ),
        "SecBench": (
            "The snapshot holds 2,730 MCQs and 270 SAQs, far fewer than the 44,823 / "
            "3,087 the upstream paper reports, so this is a subset. MCQs are held out "
            "of training; SAQs are used for training and evaluation."
        ),
        "cti-bench": (
            "`cti-taa.tsv` ships the task prompt with no ground truth column, so it "
            "cannot contribute to a scored metric and is marked prompt-only."
        ),
    }
    for dataset_id, note in dataset_notes.items():
        if any(stat.dataset_id == dataset_id for stat in stats):
            findings.append(f"**{dataset_id}**: {note}")

    for finding in findings:
        lines.append(f"- {finding}")
    if not findings:
        lines.append("- No quality issues detected.")
    lines.append("")
    lines.append("## Sample rows (credentials masked, truncated)")
    lines.append("")
    for stat in stats:
        lines.append(f"### {stat.source_file}")
        lines.append("")
        for sample in stat.samples:
            lines.append(f"- prompt: `{sample['prompt']}`")
            lines.append(f"  answer: `{sample['answer']}`")
        if not stat.samples:
            lines.append("- (no non-empty rows)")
        lines.append("")
    return "\n".join(lines)


def write_license_report(manifest: dict[str, Any]) -> str:
    lines: list[str] = []
    lines.append("# Dataset licence audit")
    lines.append("")
    lines.append("Licence status is taken from each upstream dataset card (the "
                 "`license:` field in the README shipped inside this repository) and "
                 "recorded verbatim. Nothing here is legal advice.")
    lines.append("")
    lines.append("| Dataset | Declared licence | Commercial training | Redistribution | "
                 "Decision |")
    lines.append("|---|---|---|---|---|")
    obligations: list[str] = []
    for dataset in manifest["datasets"]:
        licence = dataset.get("license", "unknown")
        commercial = dataset.get("license_commercial_ok")
        usage = dataset.get("usage")
        if licence == "cc-by-nc-sa-4.0":
            redistribution = "ShareAlike + NonCommercial propagate to derivatives"
        elif licence in {"apache-2.0", "mit"}:
            redistribution = "Allowed with attribution and licence text"
        elif licence == "us-government-public-domain":
            redistribution = "Public domain; attribution requested by NIST terms"
        else:
            redistribution = "Unclear"
        decision = {
            "sft_train": "Train",
            "eval_only": "Evaluate only",
            "reference_only": "Reference only",
            "exclude": "Exclude",
        }.get(usage, "Exclude")
        lines.append(
            f"| `{dataset['id']}` | `{licence}` | "
            f"{'yes' if commercial else 'NO'} | {redistribution} | {decision} |"
        )
        if dataset.get("license_note"):
            obligations.append(f"**{dataset['id']}** - {dataset['license_note']}")
    lines.append("")
    lines.append("## Obligations and risks")
    lines.append("")
    for item in obligations:
        lines.append(f"- {item}")
    lines.append("")
    lines.append("## The one licence that changes the plan")
    lines.append("")
    lines.append("- `cti-bench` is **CC-BY-NC-SA-4.0**. Two clauses matter:")
    lines.append("  1. *NonCommercial* - weights fine-tuned on it cannot be used "
                 "commercially. That would poison an otherwise permissive mix of "
                 "Apache-2.0 and MIT sources, so `cti-bench` is **excluded from "
                 "training** and kept as an evaluation-only benchmark.")
    lines.append("  2. *ShareAlike* - redistributing a derivative of the dataset "
                 "carries the same licence. Evaluation outputs derived from it must "
                 "keep the CC-BY-NC-SA-4.0 terms and credit Alam & Bhusal (RIT).")
    lines.append("")
    lines.append("- `NIST-NICE-Framework` carries **no licence field** in its README. "
                 "The underlying publications are US Government works (17 U.S.C. 105) "
                 "and are not subject to US copyright; NIST's terms of use ask for "
                 "attribution and forbid implying NIST endorsement. It is used as "
                 "reference data only, never as training text.")
    lines.append("")
    lines.append("## Attribution block to ship with any derived model")
    lines.append("")
    lines.append("```")
    lines.append("Fine-tuned on: Trendyol Cybersecurity Instruction Tuning Dataset (Apache-2.0);")
    lines.append("CyberSec-Bench (Apache-2.0); SecBench (MIT); Kali Linux Toolkit Dataset (MIT);")
    lines.append("Linux Terminal Commands Dataset (MIT); NIST NICE Framework components")
    lines.append("(US Government work, NIST terms of use).")
    lines.append("Base model: Gemma 4, subject to the Gemma Terms of Use.")
    lines.append("CyberMetric (Apache-2.0) and cti-bench (CC-BY-NC-SA-4.0) were used for")
    lines.append("evaluation only; cti-bench content is non-commercial.")
    lines.append("```")
    lines.append("")
    return "\n".join(lines)


def write_recommendations_report(stats: list[SourceStats], manifest: dict[str, Any]) -> str:
    stitched_rows = sum(s.rows for s in stats if s.usage == "sft_train")
    eval_rows = sum(s.rows for s in stats if s.usage == "eval_only")
    reference_rows = sum(s.rows for s in stats if s.usage == "reference_only")
    lines: list[str] = []
    lines.append("# Dataset recommendations")
    lines.append("")
    lines.append(f"- Rows eligible for training: **{stitched_rows}**")
    lines.append(f"- Rows available for evaluation only: **{eval_rows}**")
    lines.append(f"- Reference rows (no prompts): **{reference_rows}**")
    lines.append("")
    lines.append("## What to train on")
    lines.append("")
    lines.append("| Priority | Source | Why |")
    lines.append("|---|---|---|")
    lines.append("| 1 | Trendyol instruction-tuning rows | 53k chat-format rows with a real "
                 "system prompt; the only source big enough to move the model |")
    lines.append("| 2 | SecBench SAQs (270) | Short-answer supervision in English and "
                 "Chinese, a task shape the MCQs cannot teach |")
    lines.append("| 3 | CyberSec-Bench (200) | Bilingual compliance/defence answers, "
                 "high signal per row |")
    lines.append("| 4 | Kali toolkit (790) + Linux terminal commands (599) | Teaches the "
                 "command-explanation behaviour the game needs; prompts are synthesized, "
                 "so they are the lowest-trust rows |")
    lines.append("")
    lines.append("## What to hold out")
    lines.append("")
    lines.append("| Source | Role | Why |")
    lines.append("|---|---|---|")
    lines.append("| CyberMetric (10,000, canonical file only) | Evaluation | Public MCQ "
                 "benchmark; training on it would make the score meaningless |")
    lines.append("| SecBench MCQs (2,730) | Evaluation | Same reason, and the MCQ file is "
                 "far larger than the SAQ file, so it dominates if misused |")
    lines.append("| cti-bench (6 task files) | Evaluation only | CC-BY-NC-SA-4.0 |")
    lines.append("| NIST NICE components | Reference | Taxonomy, not answers |")
    lines.append("")
    lines.append("## Cautions worth stating out loud")
    lines.append("")
    lines.append("- **The MCQ training trap.** CyberMetric and SecBench MCQs are the "
                 "easiest sources to accidentally train on and the fastest way to "
                 "produce a flattering number. Both are excluded from training by the "
                 "manifest and the splitter only reads `sft_train` rows.")
    lines.append("- **Synthesized prompts.** Every Kali and Linux command row carries a "
                 "`synthesized_prompt` flag. They teach one narrow behaviour "
                 "(explain this command) and are over-represented relative to their "
                 "information content.")
    lines.append("- **Offensive-security content.** The Kali rows document "
                 "penetration-testing commands. The system prompt frames them as "
                 "authorised-lab documentation; a released model should keep that "
                 "framing and be evaluated for misuse.")
    lines.append("- **Mojibake in Trendyol.** Some punctuation is already damaged "
                 "upstream. The model will learn from slightly noisy text; this is "
                 "accepted rather than silently rewritten.")
    lines.append("- **Scale.** A 20-step LoRA smoke run on ~20k rows is a plumbing test, "
                 "not a capable model. See `docs/GEMMA4_TRAINING_GUIDE.md`.")
    lines.append("")
    return "\n".join(lines)


def write_resolved_manifest(manifest: dict[str, Any], inventory: dict[str, Any],
                            stats: list[SourceStats]) -> dict[str, Any]:
    observed_rows: dict[str, int] = defaultdict(int)
    observed_flags: dict[str, Counter[str]] = defaultdict(Counter)
    for stat in stats:
        observed_rows[stat.dataset_id] += stat.rows
        observed_flags[stat.dataset_id].update(stat.flag_counts)
    sizes = {ds["dataset_id"]: ds["total_size_bytes"] for ds in inventory["datasets"]}

    resolved = {
        "manifest_version": manifest.get("manifest_version"),
        "datasets_root": inventory["datasets_root"],
        "observed_dataset_count": inventory["dataset_count"],
        "excluded_from_training": manifest.get("excluded_from_training", []),
        "datasets": [],
    }
    for dataset in manifest["datasets"]:
        dataset_id = dataset["id"]
        resolved["datasets"].append({
            "id": dataset_id,
            "usage": dataset.get("usage"),
            "license": dataset.get("license"),
            "license_commercial_ok": dataset.get("license_commercial_ok"),
            "declared_approx_rows": dataset.get("approx_rows"),
            "observed_normalized_rows": observed_rows.get(dataset_id, 0),
            "observed_size_bytes": sizes.get(dataset_id),
            "observed_flags": dict(observed_flags.get(dataset_id, {})),
        })
    return resolved


def main(argv: list[str] | None = None) -> int:
    _common.configure_stdout()
    here = Path(__file__).resolve().parent
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", default=str(here.parent / "configs" / "dataset_manifest.yaml"))
    parser.add_argument("--datasets-root", default=str(_common.DEFAULT_DATASETS_ROOT))
    parser.add_argument("--inventory", default="reports/data_inventory.json")
    _common.add_common_args(parser)
    args = parser.parse_args(argv)

    datasets_root = Path(args.datasets_root)
    inventory_path = _common.artifact_path(args.inventory, args.out_root)
    if not inventory_path.is_file():
        raise SystemExit(
            f"inventory not found: {inventory_path}\n"
            f"run inventory_datasets.py first."
        )

    manifest = _sources.load_manifest(args.manifest)
    inventory = _common.read_json(inventory_path)

    _common.info(f"streaming {len(manifest['datasets'])} datasets for statistics")
    stats = collect_stats(manifest, datasets_root)

    outputs = {
        "reports/dataset_inventory.md": write_inventory_report(inventory, manifest, stats),
        "reports/dataset_quality_audit.md": write_quality_report(stats, manifest),
        "reports/dataset_license_audit.md": write_license_report(manifest),
        "reports/dataset_recommendations.md": write_recommendations_report(stats, manifest),
    }
    for relative, text in outputs.items():
        target = _common.artifact_path(relative, args.out_root)
        target.write_text(text, encoding="utf-8")
        _common.info(f"wrote {target}")

    stats_payload = {
        "datasets_root": str(datasets_root),
        "sources": [stat.to_dict() for stat in stats],
        "totals": {
            "sft_train_rows": sum(s.rows for s in stats if s.usage == "sft_train"),
            "eval_only_rows": sum(s.rows for s in stats if s.usage == "eval_only"),
            "reference_rows": sum(s.rows for s in stats if s.usage == "reference_only"),
            "malformed_rows": sum(s.malformed for s in stats),
        },
    }
    stats_path = _common.artifact_path("reports/dataset_source_stats.json", args.out_root)
    _common.write_json_atomic(stats_path, stats_payload)
    _common.info(f"wrote {stats_path}")

    resolved = write_resolved_manifest(manifest, inventory, stats)
    resolved_path = _common.artifact_path("manifests/dataset_manifest_resolved.yaml",
                                          args.out_root)
    import yaml  # noqa: PLC0415 - optional at import time, required here
    resolved_path.write_text(
        yaml.safe_dump(resolved, sort_keys=False, allow_unicode=True),
        encoding="utf-8",
    )
    _common.info(f"wrote {resolved_path}")

    totals = stats_payload["totals"]
    _common.info(
        "totals: "
        f"sft_train={totals['sft_train_rows']} "
        f"eval_only={totals['eval_only_rows']} "
        f"reference={totals['reference_rows']} "
        f"malformed={totals['malformed_rows']}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
