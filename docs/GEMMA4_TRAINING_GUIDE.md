# Gemma 4 fine-tuning guide

How to turn the cybersecurity corpora in `hackathon/datasets` into a LoRA adapter
for **`google/gemma-4-E2B-it`**, what this machine can and cannot do, and the
exact commands to run.

The code lives in `apps/ml`. Generated artifacts live outside the repository in
`C:\Users\anmol\OneDrive\Desktop\hackathon\training` (see
[Output layout](#output-layout)). Nothing in this pipeline ever writes into the
datasets tree - `apps/ml/scripts/_common.py` refuses it.

---

## 1. Verified environment

Checked by `apps/ml/scripts/preflight.py` on this machine:

| Item | Observed |
|---|---|
| Python | 3.14.5 |
| `torch` | 2.14.1 **+cpu** (no CUDA device visible) |
| `transformers` | 5.19.0 (native `Gemma4` support) |
| `peft` / `trl` / `datasets` / `accelerate` | 0.21.2 / 1.15.0 / 5.1.0 / 1.15.0 |
| `bitsandbytes` | not installed (no cp314 Windows wheel) |
| CPU / RAM | Ryzen 9 8945HX (16c/32t) / 15.3 GiB total |
| Free RAM during the run | 1.17 - 2.66 GiB |
| Free disk | ~95 GiB |
| GPU | RTX 5060 Laptop present, **unusable by the installed torch build** |

Preflight verdict: **PASS WITH WARNINGS** (4 warnings). The two that matter are
`gpu_acceleration` and `ram`; both are explained below.

### Target model

| Field | Value |
|---|---|
| Checkpoint | `google/gemma-4-E2B-it` |
| Gating | **not gated** (verified via the HF API) |
| Licence | `apache-2.0` per the model card |
| Weight file | `model.safetensors`, 9.77 GiB, single shard |
| Modality | multimodal upstream (text + image, audio on E2B/E4B); this pipeline uses **text only** |
| Context | 128K on the small models |

Framework facts confirmed by import, not by memory:

* `transformers` 5.19.0 exposes `Gemma4ForCausalLM`, `Gemma4ForConditionalGeneration`,
  `Gemma4Processor`, `Gemma4TextConfig`, `Gemma4VisionConfig`, `Gemma4AudioConfig`.
  No `trust_remote_code` is needed.
* The seven LoRA targets in `configs/train_lora.yaml` were checked against the
  loaded module tree and all exist: `q_proj`, `k_proj`, `v_proj`, `o_proj`,
  `gate_proj`, `up_proj`, `down_proj`.

---

## 2. Why the real fine-tune is blocked on this host

`train_lora.py` runs a resource gate **before** downloading anything:

```
free RAM 1.17 GiB < estimated need 15.27 GiB for a 9.54 GiB bf16 checkpoint
free RAM 1.17 GiB < configured minimum 6.0 GiB
```

`google/gemma-4-E2B-it` reports **9.54 GiB** of weight files. The gate multiplies
that by 1.6 to cover activations, gradients and optimizer state, giving
**15.27 GiB** - against a machine that currently has 1.17 GiB free of 15.3 GiB
total. Two independent blockers, either of which is fatal:

1. **RAM.** Gemma 4 E2B is called "E2B" because the *effective* parameter count
   is around 2B, but the checkpoint is 9.5 GiB: the per-layer embedding (PLE)
   tables and the 262,144-token vocabulary dominate the file. Per-layer
   embeddings put the honest floor well above what this laptop can hold.
2. **No GPU acceleration.** The `torch` wheel resolved for this interpreter is
   `2.14.1+cpu`, so `torch.cuda.is_available()` is `False` even though an RTX
   5060 is physically present. Everything would run on the CPU.

Additionally, `bitsandbytes` has no official cp314 Windows wheel, so 4-bit QLoRA
- the technique that would shrink the resident footprint most - is unavailable.
The loader treats it as optional and falls back to bf16 LoRA, which is the mode
that needs the 15.27 GiB.

### What would unblock it

| Fix | Effect |
|---|---|
| Close applications to free RAM | Not enough: the gap is ~14 GiB |
| Install a CUDA build of `torch` (`--index-url .../cu128`) | Unlocks the GPU, removes the RAM ceiling if VRAM suffices |
| Add the matching `bitsandbytes` build | Enables 4-bit QLoRA, cuts the footprint ~4x |
| Train on a machine with >= 16 GiB free RAM | The gate passes as-is |

Re-check at any time:

```bash
python apps/ml/scripts/preflight.py            # add --strict to fail on warnings
```

---

## 3. Running the pipeline

Set a short alias first:

```bash
cd C:/Users/anmol/OneDrive/Desktop/LearnXSK
PY=C:/Users/anmol/OneDrive/Desktop/hackathon/training/.venv/Scripts/python.exe
```

The venv was created for this work and already has the stack installed. The
first three stages need no ML packages at all and run on any Python 3.10+:

```bash
# ---- audit: inventory, quality, licence, recommendations -------------------
python apps/ml/scripts/inventory_datasets.py
python apps/ml/scripts/audit_datasets.py

# ---- preflight: environment and model gates --------------------------------
$PY apps/ml/scripts/preflight.py --strict

# ---- stages 1-6: data ------------------------------------------------------
python apps/ml/scripts/prepare_dataset.py
python apps/ml/scripts/dedupe.py
python apps/ml/scripts/quality_filter.py
python apps/ml/scripts/format_sft.py
python apps/ml/scripts/split_dataset.py
python apps/ml/scripts/validate_splits.py      # exit 1 means do not train

# ---- stage 7: training -----------------------------------------------------
$PY apps/ml/scripts/train_lora.py                          # real run: gate applies
$PY apps/ml/scripts/train_lora.py --allow-random-init \
    --limit-rows 64 --max-steps 3                          # plumbing test

# ---- stage 8: evaluation ---------------------------------------------------
$PY apps/ml/scripts/evaluate.py --label base
$PY apps/ml/scripts/evaluate.py --adapter <adapter-dir> --label tuned

# ---- stage 9: export -------------------------------------------------------
$PY apps/ml/scripts/export_model.py

# ---- reproducibility -------------------------------------------------------
python apps/ml/scripts/make_checksums.py
python apps/ml/scripts/make_checksums.py --verify
```

Tests:

```bash
python -m unittest discover -s apps/ml/tests -p "test_*.py"
```

### Stage contract

Each stage reads the previous stage's file, writes the next one and drops a JSON
report in `training/reports/`. Any stage can be re-run on its own:

```
datasets (read-only)
  -> prepare      normalized_records.jsonl   + reference_tables.jsonl
  -> dedupe       deduped_records.jsonl
  -> quality      quality_filtered_records.jsonl
  -> format       sft_records.jsonl
  -> split        train / validation / test .jsonl + evaluation/eval_set.jsonl
  -> validate     reports/validate_splits_report.json   (gate: exit 1 on failure)
  -> train        adapters/<run>/  + reports/train_lora_report.json
  -> evaluate     evaluation/<label>_report.json + comparison
  -> export       exports/<run>/  + reports/export_report.json
```

`prepare`, `dedupe`, `quality` and `format` stream row by row; nothing loads a
whole dataset into memory, which is what makes the 186 MiB Trendyol file safe on
a 16 GiB machine.

---

## 4. Row counts, end to end

| Stage | Rows | Note |
|---|---:|---|
| Normalized from source | 43,113 | all manifest usages |
| -> training-eligible | 19,593 | `sft_train` only |
| -> `eval_only` | 18,520 | never trained on |
| -> `exclude` | 2,580 | nested CyberMetric subsets |
| -> `reference_only` | 2,420 | NICE taxonomy, no prompts |
| After dedupe | 40,363 | -2,516 exact, -234 near |
| After quality filter | 35,242 | -5,230 |
| SFT rows written | 19,461 | `sft_train` only |
| Splits | 17,390 / 967 / 995 | train / validation / test |
| Evaluation set | 415 | 400 MCQ + 15 open |

`format_sft.py` reports approximate token counts (characters / 4):
p50 = 884, p95 = 1,058, max = 1,762, with **1,582 rows above the 1,024
`max_seq_len`** in the config. Those rows are truncated by the tokenizer during
training. Raise `max_seq_len` if you have the memory.

---

## 5. Configuration

Four files, all in `apps/ml/configs`:

| File | Controls |
|---|---|
| `dataset_manifest.yaml` | per-dataset licence, usage, adapters, field maps, quality gates |
| `data_pipeline.yaml` | seed, paths, split ratios, dedupe settings, quality thresholds, eval caps |
| `train_lora.yaml` | base model, LoRA hyperparameters, training args, resource limits |
| `evaluation` section of `data_pipeline.yaml` | which benchmarks are scored and how many rows |

Defaults worth knowing:

* `seed: 20260402` and hash-based split assignment - splits are reproducible and
  no row index or file order influences them.
* `format.max_records_per_source: 20000` - the 53,201 Trendyol rows are sampled
  with a **stride** (`ceil(53201 / 20000) = 2`) rather than by taking the first
  N, so the sample is spread across the file instead of following its ordering.
* `training.max_steps: 20` - this is a smoke configuration, not a training
  recipe.
* `resource_limits` - the gate thresholds. Lower them only with a reason.

---

## 6. Output layout

```
C:\Users\anmol\OneDrive\Desktop\hackathon\training\
  processed\    normalized, deduped, filtered, sft, reference tables
  splits\       train.jsonl, validation.jsonl, test.jsonl
  evaluation\   eval_set.jsonl, <label>_report.json, model_evaluation.md
  adapters\     LoRA adapters (smoke-gemma4-e2b-lora)
  exports\      deployable package + Modelfile + model card
  manifests\    dataset_manifest_resolved.yaml
  reports\      every stage report, preflight, checksums, FINAL_REPORT.md
  runs\         trainer output directories
  cache\        pip log, HF metadata cache, venv is at training/.venv
```

Override the root with `--out-root` or `LEARNXSK_TRAINING_ROOT`. The guard
rejects any target inside the datasets tree, inside the repository, or outside
the resolved root - including `..` traversal.

---

## 7. Reproducing a real fine-tune elsewhere

1. Copy `LearnXSK/apps/ml` and the `hackathon/datasets` tree.
2. Create a venv and install the stack (`torch` **with CUDA**, `transformers>=5`,
   `peft`, `trl`, `datasets`, `accelerate`, `bitsandbytes`).
3. Run preflight with `--strict` and confirm the resource gate passes.
4. Run stages 1-6 and check `validate_splits.py` exits 0.
5. Raise `max_steps` and `num_train_epochs` in `train_lora.yaml` - 20 steps is a
   smoke value.
6. Re-run `validate` and `evaluate` after any config change; the checksum
   manifest in `reports/checksums.json` is how you prove a rerun was identical.

---

## 8. Honest limitations

* **No real Gemma 4 adapter exists yet.** Training the actual checkpoint is
  blocked by RAM, documented above with measured numbers.
* **The adapter in `training/adapters/smoke-gemma4-e2b-lora` is not a model.**
  It was produced by `--allow-random-init`: a tiny randomly initialized
  `Gemma4TextConfig` with the real Gemma tokenizer. Its purpose is to prove the
  tokenization, completion-only loss masking, LoRA application, checkpoint save
  and reload path all work. Its loss (~12.5) and its evaluation scores carry no
  meaning.
* **CPU-only.** Even unblocked, the installed torch build would use the CPU.
* **Smoke scale.** 20 optimiser steps over 17,390 rows is plumbing, not learning.
