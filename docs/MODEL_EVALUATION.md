# Model evaluation

How the fine-tune is measured, what was actually run on this machine, and which
numbers must not be read as model quality.

```bash
PY=C:/Users/anmol/OneDrive/Desktop/hackathon/training/.venv/Scripts/python.exe

$PY apps/ml/scripts/evaluate.py --label base                    # base model
$PY apps/ml/scripts/evaluate.py --adapter <adapter-dir> --label tuned
```

Running the tuned pass writes the comparison automatically - a tuned score
without the base score beside it means nothing, so
`evaluation/model_evaluation.md` and `reports/model_evaluation_comparison.json`
are produced as soon as both reports exist.

---

## 1. The evaluation set

Built by `split_dataset.py` into `training/evaluation/eval_set.jsonl` - **415
rows**, from sources that training never sees:

| Source | Kind | Rows | Cap |
|---|---|---:|---:|
| CyberMetric (10,000 file) | multiple choice | 200 | 200 |
| SecBench MCQs | multiple choice | 200 | 200 |
| CyberSec-Bench | open answer (test split) | 7 | 50 |
| SecBench SAQs | open answer (test split) | 8 | 50 |

Open-answer rows are drawn from the **test split**, so they are held out by
construction. MCQ rows come from files the manifest marks `eval_only`. Caps live
in `data_pipeline.yaml` under `evaluation` and exist so a pass finishes on this
laptop.

---

## 2. Metrics

**Multiple choice - letter accuracy.** The model must answer with the letter of
the correct option; the scorer extracts standalone letters (`B`, `(C)`,
`answer: D`) from the first 60 characters and compares them as a set, so
multi-select labels such as `ABD` compare correctly.

Reported next to **chance level** (1 / option count) and **above chance**. A raw
accuracy figure without its chance baseline is the easiest way to be fooled by a
4-option benchmark.

> A greedy fallback that scanned any A-H character in the response was removed
> during verification: it turned prose like "the C programming language" into an
> answer. Now only standalone letters count.

**Open answer - token F1 and exact match.** SQuAD-style F1 over script-aware
tokens (ASCII words plus individual CJK characters, so Chinese answers are scored
fairly), plus normalized exact match.

---

## 3. What was actually run

### Real checkpoint - BLOCKED

```
$PY apps/ml/scripts/evaluate.py --label base
BLOCKED: free RAM 1.92 GiB < estimated need 15.27 GiB for a 9.54 GiB bf16 checkpoint
BLOCKED: free RAM 1.92 GiB < configured minimum 6.0 GiB
```

Evaluation loads the same 9.54 GiB checkpoint as training, so it hits the same
gate. Recorded as BLOCKED in `reports/evaluation_report.json` with the measured
figures, rather than attempted as a download that cannot finish.

### Harness verification - COMPLETED

Both passes were run against the tiny randomly initialized `Gemma4TextConfig`
(`--allow-random-init`) to prove the scoring path, prompt rendering, adapter
loading and report generation all work:

| Run | MCQ accuracy | MCQ questions | Open token F1 | Open questions |
|---|---:|---:|---:|---:|
| `base` (random init) | 0.0 | 12 | 0.0068 | 12 |
| `tuned` (random init + LoRA adapter) | 0.0 | 12 | 0.0099 | 12 |

Per source (`evaluation/model_evaluation.md`):

| Source | Base MCQ | Tuned MCQ | Base token F1 | Tuned token F1 |
|---|---:|---:|---:|---:|
| `CyberSec-Bench` | - | - | 0.0022 | 0.0038 |
| `SecBench` | 0.0 | 0.0 | 0.0132 | 0.0183 |

**These numbers are not model quality.** The underlying weights are random, the
"tuned" adapter was trained for three steps on a different random model, and the
MCQ accuracy of 0.0 is what a model producing unstructured text scores. The F1
differences between the two runs are noise. What the run proves is that the
harness produces numbers, both kinds of row are scored, and the adapter loads.

Every artifact carries this in its `interpretation` field so the numbers cannot
be quoted without it.

---

## 4. What a real evaluation would need

1. A machine where the resource gate passes (`preflight.py --strict`).
2. `evaluate.py --label base` for the baseline - mandatory, not optional.
3. `train_lora.py` with real hyperparameters, then
   `evaluate.py --adapter <dir> --label tuned`.
4. Raise `evaluation.mcq_max_questions` from 200 if a narrower confidence
   interval is wanted; 200 questions gives roughly +/- 6 percentage points at
   95% confidence around an accuracy near chance.
5. Read the score against the chance baseline, and report per-source numbers
   instead of one blended figure - a model can look competent on
   `CyberSec-Bench` prose while being at chance on `CyberMetric` MCQs.

---

## 5. Reproducibility

* `seed: 20260402` in `data_pipeline.yaml`; split assignment is a hash of the row
  content, so it survives upstream file growth.
* `evaluation/temperature` is 0.0 and generation uses greedy decoding.
* `python apps/ml/scripts/make_checksums.py --verify` rehashes every artifact and
  fails if anything changed, which is how a rerun is proven identical.
