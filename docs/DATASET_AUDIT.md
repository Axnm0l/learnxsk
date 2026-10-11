# Dataset audit

Audit of the eight dataset groupings in
`C:\Users\anmol\OneDrive\Desktop\hackathon\datasets`, with the licensing
decisions that shaped the training mix.

This document summarizes four machine-generated reports. Regenerate them with:

```bash
python apps/ml/scripts/inventory_datasets.py
python apps/ml/scripts/audit_datasets.py
```

| Report | Contents |
|---|---|
| `training/reports/dataset_inventory.md` | files, sizes, hashes, schemas, declared-vs-observed mismatches |
| `training/reports/dataset_quality_audit.md` | per-file quality metrics and findings |
| `training/reports/dataset_license_audit.md` | licence per dataset, obligations, attribution block |
| `training/reports/dataset_recommendations.md` | what to train on and what to hold out |

---

## 1. What is on disk

8 dataset directories plus one loose `README.md` (deliberately **not** counted as
a dataset), ~204 MiB total, SHA-256 hashed per file.

| Dataset | Licence | Rows | Usage |
|---|---|---:|---|
| Trendyol Cybersecurity Instruction Tuning | apache-2.0 | 53,201 | train |
| SecBench (MCQs 2,730 + SAQs 270) | mit | 3,000 | MCQs eval only, SAQs train |
| CyberMetric (4 files) | apache-2.0 | 12,760 | eval only, canonical file only |
| cti-bench (6 task files) | **cc-by-nc-sa-4.0** | 5,610 | eval only, **never train** |
| NIST NICE Framework | US Gov work, no licence field | 2,420 | reference only |
| KALI Linux Toolkit | mit | 790 | train (synthesized prompts) |
| Linux Terminal Commands | mit | 600 | train (synthesized prompts) |
| CyberSec-Bench | apache-2.0 | 200 | train + eval |

---

## 2. Licensing: the one dataset that changes the plan

**`cti-bench` is CC-BY-NC-SA-4.0.** Both clauses matter:

* **NonCommercial** - weights fine-tuned on it cannot be used commercially. That
  would contaminate an otherwise permissive mix of Apache-2.0 and MIT sources.
  It is therefore **excluded from training** and kept as an evaluation-only
  benchmark.
* **ShareAlike** - redistributing derivatives carries the same licence. Any
  published evaluation derived from cti-bench must keep CC-BY-NC-SA-4.0 terms and
  credit Alam & Bhusal (RIT).

**`NIST-NICE-Framework` has no licence field in its README.** The underlying
publications are US Government works, not subject to US copyright (17 U.S.C.
105); NIST's terms of use ask for attribution and forbid implying NIST
endorsement. It is used as reference data only - never as training text.

Enforcement is not documentation-only. `validate_splits.py` loads the manifest
and fails if any row from an `eval_only` source file appears in a split, and a
unit test asserts that a dataset flagged `license_commercial_ok: false` can never
be marked `sft_train`.

---

## 3. Quality findings

All numbers below were computed by `audit_datasets.py` and the pipeline stages.

### Data defects, and what happened to them

| Finding | Handling |
|---|---|
| `LINUX_TERMINAL_COMMANDS.jsonl` line 455 is invalid JSON (a bare `\.` escape) | **Repaired** by re-escaping invalid backslashes, flagged `repaired_invalid_escape`. The row is kept; the repair is counted. Row count went 599 -> 600 valid records. |
| Trendyol punctuation is cp1252 mojibake (`—` rendered as replacement chars) | Normalized for whitespace and control characters; damaged characters are **left as they are** rather than guessed at. |
| NIST components JSON: many elements have an empty `text` field (e.g. `S-OG`) | Reference-only; 2,212 rows have an empty prompt and are dropped by the filter, which is correct for data that was never prompt/answer shaped. |
| CyberMetric ships 4 **nested** files (10,000 > 2,000 > 500 > 80) | Only the 10,000 file is ingested; the other 2,580 rows are marked `exclude`. Otherwise the same questions would be counted up to four times and accuracy would be inflated. |
| CyberMetric's "10,000" file actually contains **10,180** questions | Recorded as a declared-vs-observed mismatch rather than silently rounded. |
| SecBench snapshot has 2,730 MCQs / 270 SAQs, not the 44,823 / 3,087 the paper reports | Reported as a partial snapshot. |
| `cti-taa.tsv` ships **no** ground-truth column | Prompt-only rows, flagged `no_ground_truth_in_snapshot`; they cannot contribute to a scored metric. |
| 2,516 exact and 234 near duplicate rows | Removed by `dedupe.py`. |
| Credential-shaped strings (22 assignments, 7 emails) | **Masked, not dropped**: the row still teaches, the fake secret does not ship. |

### Rules that had to be script-aware

Two thresholds were wrong when first written, and verification caught it:

* **Repetition check.** Whitespace tokenization returns an entire Chinese
  sentence as one token, so every Chinese row scored 1.0 and was dropped as
  "degenerate". The check now tokenizes CJK characters individually and only
  applies when there are at least 20 tokens.
* **Word count.** `min_words_answer: 3` was rejecting Chinese answers for having
  no spaces. It now uses the same script-aware tokenizer.

Effect: SecBench SAQ rows kept went from 151/270 to **260/270**, and total SFT
rows from 19,352 to **19,461**. Both changes are covered by unit tests.

### Rows lost by the quality filter

| Reason | Rows |
|---|---:|
| Empty prompt (reference/NIST rows) | 2,212 |
| Answer too short | 1,942 |
| Answer too few words | 836 |
| Answer echoes the prompt | 79 |
| Empty answer | 50 |
| Prompt too short | 1 |
| Refusal-style answer | 1 |

---

## 4. Evaluation contamination

Three separate guarantees, each checked rather than assumed:

1. **Benchmark files never enter a split.** `no_eval_only_file_in_splits` fails
   if a row from an `eval_only` source file appears in train, validation or test.
2. **No answer leakage.** `no_answer_leakage` fails if a normalized
   `(prompt, answer)` pair appears in both training and validation/test. Currently
   0.
3. **Every trained source is evaluated.** `every_trained_source_is_evaluated`
   fails if a source is trained on but never measured.

One intentional overlap is reported, not hidden: **SecBench** contributes SAQs to
training and MCQs to evaluation. The manifest marks the MCQ file `eval_only` and
the SAQ file `sft_train`, and `validate_splits.py` emits
`benchmark_dataset_shared_with_training` as an advisory note so the overlap is
visible in every validation report. CyberSec-Bench is likewise split by rows:
184 train, 9 validation, 7 test.

---

## 5. Recommendation summary

**Train on:** Trendyol (17,678 rows), Kali toolkit (725), Linux terminal commands
(598), SecBench SAQs (260), CyberSec-Bench (200).

**Hold out entirely:** CyberMetric, SecBench MCQs, cti-bench.

**Reference only:** NIST NICE components.

Cautions carried into the model card:

* The Kali and Linux rows carry `synthesized_prompt` - they teach one narrow
  behaviour ("explain this command") and are over-represented relative to their
  information content.
* The Kali rows document penetration-testing commands. The system prompt frames
  them as authorised-lab documentation; any release should keep that framing and
  be evaluated for misuse.
* Trendyol text is slightly noisy upstream and the model will learn from that
  noise.
