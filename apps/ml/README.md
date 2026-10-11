# `apps/ml` - Gemma 4 fine-tuning pipeline

Everything needed to turn the read-only cybersecurity corpora into a LoRA adapter
for `google/gemma-4-E2B-it`, plus the audits that justify the data choices.

Full narrative documentation lives in:

* [`docs/GEMMA4_TRAINING_GUIDE.md`](../../docs/GEMMA4_TRAINING_GUIDE.md) - environment, gates, commands, results
* [`docs/DATASET_AUDIT.md`](../../docs/DATASET_AUDIT.md) - sources, licences, quality findings
* [`docs/MODEL_EVALUATION.md`](../../docs/MODEL_EVALUATION.md) - metrics and what was actually run
* [`docs/MODEL_DEPLOYMENT.md`](../../docs/MODEL_DEPLOYMENT.md) - export, GGUF, Ollama, Unity wiring

---

## Safety rules this code enforces

1. **The datasets tree is read-only.** `_common.assert_safe_output_root()` raises
   `UnsafeOutputPathError` for any output path inside the datasets directory,
   inside the Git repository, or outside the resolved training root - including
   `..` traversal.
2. **Generated artifacts live outside the repo**, under
   `C:\Users\anmol\OneDrive\Desktop\hackathon\training` by default. Override with
   `--out-root` or `LEARNXSK_TRAINING_ROOT`; that is the only documented
   mechanism.
3. **Credentials are never printed.** Detected key-like strings are masked as
   `<<REDACTED:...>>` in reports and in the data itself.
4. **Benchmarks are never trained on.** `validate_splits.py` fails if a row from
   an `eval_only` source file reaches a split.

---

## Layout

```
apps/ml/
  configs/
    dataset_manifest.yaml    per-dataset licence, usage, adapter, field map, gates
    data_pipeline.yaml       seed, paths, split ratios, dedupe, quality, evaluation
    train_lora.yaml          base model, LoRA + training hyperparameters, resource limits
  scripts/
    _common.py               path safety, JSONL IO, normalization, hashing, config
    _sources.py              one adapter per source format -> one normalized record shape
    inventory_datasets.py    read-only inventory of every dataset file
    audit_datasets.py        generates the four audit reports + resolved manifest
    preflight.py             interpreter/stack/GPU/RAM/auth/model gates
    prepare_dataset.py       normalize all sources
    dedupe.py                exact + SimHash near-duplicate removal
    quality_filter.py        length, degeneracy, refusal, echo, secret masking
    format_sft.py            chat-message rows with a native system role
    split_dataset.py         deterministic stratified splits + evaluation set
    validate_splits.py       the gate before training; exit 1 on any failure
    train_lora.py            LoRA smoke trainer with resource and module gates
    evaluate.py              MCQ letter accuracy + token F1, base vs tuned
    export_model.py          adapter package, model card, Modelfile, deploy notes
    make_checksums.py        hash manifest; `--verify` proves a rerun was identical
  tests/
    test_pipeline.py         35 unit tests (stdlib unittest)
```

---

## Commands

```bash
PY=C:/Users/anmol/OneDrive/Desktop/hackathon/training/.venv/Scripts/python.exe

python apps/ml/scripts/inventory_datasets.py
python apps/ml/scripts/audit_datasets.py
$PY apps/ml/scripts/preflight.py --strict

python apps/ml/scripts/prepare_dataset.py
python apps/ml/scripts/dedupe.py
python apps/ml/scripts/quality_filter.py
python apps/ml/scripts/format_sft.py
python apps/ml/scripts/split_dataset.py
python apps/ml/scripts/validate_splits.py

$PY apps/ml/scripts/train_lora.py
$PY apps/ml/scripts/evaluate.py --label base
$PY apps/ml/scripts/export_model.py

python apps/ml/scripts/make_checksums.py --verify
python -m unittest discover -s apps/ml/tests -p "test_*.py"
```

The first six data stages need only the standard library plus PyYAML. Anything
that imports `torch` or `transformers` should be run with the venv interpreter,
which is where the ML stack is installed.

---

## Design decisions worth knowing

* **One record shape.** Every source format is converted by an adapter in
  `_sources.py` into the same normalized record, so the audit, the pipeline and
  the evaluator cannot disagree about what a row is.
* **Streaming throughout.** `prepare`, `dedupe`, `quality` and `format` process
  one row at a time; the 186 MiB Trendyol file never fully materializes in RAM.
* **Hash-based splits.** Assignment depends only on row content, so reruns are
  identical and appending upstream rows cannot reshuffle an existing split.
* **Banded SimHash.** Near-duplicate detection bucketed by hash bands instead of
  comparing every pair, keeping the pass linear on a 16 GiB machine.
* **Script-aware text rules.** Repetition and word-count checks tokenize CJK
  characters individually; whitespace-only rules wrongly rejected Chinese rows.
* **Gates before downloads.** `train_lora.py` and `evaluate.py` read checkpoint
  metadata from the Hugging Face API and refuse a run that cannot fit, instead of
  starting a 9.5 GiB download that dies on load.
