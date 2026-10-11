# Model deployment and game integration

How the adapter becomes something the LearnXSK game can talk to, what was
produced on this machine, and what still cannot be produced here.

```bash
PY=C:/Users/anmol/OneDrive/Desktop/hackathon/training/.venv/Scripts/python.exe
$PY apps/ml/scripts/export_model.py
```

---

## 1. What the export step produces

Into `training/exports/gemma4-e2b-lora/`:

| File | Purpose |
|---|---|
| `adapter_model.safetensors`, `adapter_config.json` | the LoRA adapter itself |
| `tokenizer.json`, `tokenizer_config.json`, `chat_template.jinja` | tokenizer and chat template |
| `README.md` | model card: run metadata, evaluation, intended use, limits |
| `Modelfile` | Ollama build file, ready except for the GGUF adapter |
| `deploy.md` | the commands below, with this host's measured gate status |
| `ATTRIBUTION.txt` | dataset and base-model attribution |

Status recorded in `reports/export_report.json`:

| Step | Status | Reason |
|---|---|---|
| Adapter package | **WROTE** | adapter + tokenizer copied |
| Merge LoRA into base | **BLOCKED** | free RAM 1.17 GiB vs 15.27 GiB needed for the 9.54 GiB base |
| GGUF base export | NOT RUN | needs llama.cpp and the base weights locally |
| LoRA to GGUF | NOT RUN | needs the base GGUF from the previous step |
| `ollama create` | NOT RUN | needs a GGUF adapter |

Nothing here is claimed as done when it is not. The merge and GGUF steps need the
base weights resident, which is the same wall training hits.

---

## 2. Ollama cannot load a safetensors adapter

This is the integration fact worth stating plainly: **Ollama loads GGUF**. The
`ADAPTER` directive in a `Modelfile` points at a **GGUF** adapter file, not at the
PEFT `adapter_model.safetensors` this pipeline produces. Two conversions are
required, and both need the base weights locally:

```bash
# 1. merge LoRA into the base weights (~16 GiB free RAM)
python -c "
import torch, peft, transformers
base = transformers.Gemma4ForCausalLM.from_pretrained(
    'google/gemma-4-E2B-it', dtype=torch.bfloat16, device_map='auto')
model = peft.PeftModel.from_pretrained(base, 'adapters/smoke-gemma4-e2b-lora')
model.merge_and_unload().save_pretrained('exports/gemma4-e2b-lora-merged')
"

# 2. export the base to GGUF, then the adapter to GGUF
git clone https://github.com/ggml-org/llama.cpp
python llama.cpp/convert_hf_to_gguf.py exports/gemma4-e2b-lora-merged \
    --outfile exports/gemma4-e2b-lora.gguf --outtype q8_0
python llama.cpp/convert_lora_to_gguf.py exports/gemma4-e2b-lora-merged \
    --base <base-gguf-repo> --outfile exports/adapter.gguf

# 3. build the Ollama model
ollama create learnxsk-tutor -f exports/Modelfile
```

The generated `Modelfile` already contains:

```
FROM gemma4:e2b
# ADAPTER ./adapter.gguf        <- uncomment once the file exists
PARAMETER temperature 0.2
PARAMETER top_p 0.9
PARAMETER num_ctx 4096
SYSTEM """You are LearnXSK's cybersecurity and Linux terminal tutor. ..."""
```

`PARAMETER num_ctx 4096` is deliberate: Gemma 4 supports 128K context, but a
laptop-class machine cannot afford a large KV cache alongside the model.

---## 3. Wiring it into the game client

**Read this before copying a filename from an older doc.** The Unity client these
docs previously referenced (`Game/Assets/LearnXSK/Scripts/LocalGemmaClient.cs`) is
**not in this repository any more** - the Unity project was removed before this
pipeline was built. The live client is:

```
frontend/src/ai/GemmaClient.ts
```

As it stands in the working tree, that client calls Ollama **directly** over
HTTP and picks the model from a single field:

```ts
private ollamaUrl: string = 'http://localhost:11434/api/generate';
private modelName: string = 'gemma2:2b'; // or gemma4 when loaded
```

It is a singleton (`GemmaClient.getInstance()`), and when Ollama is unreachable it
falls back to built-in "local-intelligence" answers rather than failing, so a
wrong model tag degrades quietly instead of throwing.

### The one-line change

To use the model that is actually installed and verified on this machine, change
that field to the Ollama tag:

```ts
private modelName: string = 'gemma4:e2b';    // verified: `ollama list` shows it, 4.6 GB
```

After a successful export, point it at the adapter tag instead:

```ts
private modelName: string = 'learnxsk-tutor';
```

This pipeline does **not** edit that field: the file was being changed by another
workstream while this pipeline was built, so the change is documented here rather
than applied on top of someone else's in-flight edit.

Two practical notes for the integration:

* The client's default is still `gemma2:2b`. Until that line changes, the game
  asks Ollama for a model tag that is not the active one.
* The training rows use a **system prompt** that frames answers as defensive,
  lab-safe guidance. The generated `Modelfile` sets the same text as `SYSTEM`, so
  serving behaviour matches what the adapter saw during training. If you change
  the serving prompt, change the Modelfile too.
* Gemma 4's thinking mode adds latency on CPU. `/api/generate` has no timeout in
  this client, so a slow model will look like a hang rather than a fallback.

### In-game labels

The interactive shell prints `AI_MENTOR=gemma4` and calls the tutor "GEMMA 4" in
its UI strings, which matches the installed runtime.

---

## 4. Framework compatibility findings

Verified by import and by a real (tiny) training run, not from documentation
alone:

* `transformers` 5.x ships **native** Gemma 4 support (`Gemma4ForCausalLM`,
  `Gemma4ForConditionalGeneration`, `Gemma4Processor`). No `trust_remote_code`,
  no custom modeling file.
* All seven configured LoRA targets exist on the loaded Gemma 4 module tree:
  `q_proj`, `k_proj`, `v_proj`, `o_proj`, `gate_proj`, `up_proj`, `down_proj`. The
  training script verifies this at run time and aborts with the real module list
  if a name is wrong, so an adapter can never silently train nothing.
* Gemma 4 upstream is multimodal (text + image, audio on E2B/E4B). This pipeline
  is text-only and never constructs image or audio inputs.
* The installed `torch` wheel is CPU-only (`2.14.1+cpu`). That limits training
  here; Ollama does its own GPU inference, so serving is unaffected.

---

## 5. Limitations to carry forward

1. **No deployable custom model exists yet.** The only adapter present came from
   the random-init plumbing test and is not a usable model. The merge and GGUF
   steps are blocked on RAM.
2. **`ollama create` has not been run**, so the `Modelfile` is unverified against
   a real GGUF adapter.
3. **Licence hygiene travels with the artifact.** `ATTRIBUTION.txt` records that
   cti-bench (CC-BY-NC-SA-4.0) was evaluation-only and must not be redistributed
   as training data.
