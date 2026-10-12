# 🛡️ LearnXSK — Cyber Blocklands

> **An immersive, Minecraft-inspired 3D cybersecurity learning game powered by Google Gemma AI.**

LearnXSK drops you into a procedurally generated voxel world where you learn Linux, networking, and cybersecurity through interactive quests, an in-game AI tutor (Gemma), and hands-on terminal challenges — all running 100% locally with zero cloud telemetry.

![Built with Three.js](https://img.shields.io/badge/Three.js-r170-black?logo=three.js)
![Gemma 4](https://img.shields.io/badge/Gemma_4-E2B--it-4285F4?logo=google)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript)
![Vite](https://img.shields.io/badge/Vite-6.x-646CFF?logo=vite)
![License](https://img.shields.io/badge/License-Apache_2.0-green)

---

## ✨ Features

- **3D Voxel World** — Procedurally generated terrain with biomes, trees, water, and caves built with Three.js
- **Mouse-Aim Combat** — Player faces the cursor direction; WASD movement follows where you look
- **Mob Spawning & Health** — Hostile mobs appear in the world with full combat mechanics (damage, health bar, respawn)
- **Pause System** — Press `P` to pause/resume with an overlay menu
- **AI Tutor (Gemma)** — Personalized hints, diagnostics, and coaching via local Ollama inference
- **5 Learning Tracks** — Linux Basics, Filesystem Explorer, Process Detective, Network Recon, Scripting Lab
- **Retro Pixel Aesthetic** — Press Start 2P typography, glassmorphic UI, pixel heart HUD
- **Fully Offline** — On-device AI inference via Ollama; no data ever leaves your machine

---

## 🏗️ Project Structure

```
LearnXSK/
├── frontend/                    # The game (Three.js + TypeScript + Vite)
│   ├── index.html               # Entry point with onboarding modal
│   ├── src/
│   │   ├── main.ts              # Game loop, pause system, mouse-aim raycasting
│   │   ├── style.css            # Retro pixel UI, glassmorphism, animations
│   │   ├── ai/
│   │   │   └── GemmaClient.ts   # Ollama/Gemma API client with fallback engine
│   │   ├── player/
│   │   │   └── Player.ts        # Player movement, rotation, mouse-follow logic
│   │   ├── world/               # Terrain generation, NPCs, mob spawning
│   │   ├── quest/               # Quest system and learning tracks
│   │   └── ui/                  # HUD, terminal overlay, mission control
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── apps/
│   └── ml/                      # Gemma 4 fine-tuning pipeline
│       ├── configs/             # Dataset manifest, training hyperparams
│       ├── scripts/             # 17 pipeline scripts (audit → train → export)
│       ├── tests/               # 35 unit tests
│       └── README.md            # Pipeline reference
├── docs/
│   ├── GEMMA4_TRAINING_GUIDE.md # Full training walkthrough & row counts
│   ├── DATASET_AUDIT.md         # Source licences & quality findings
│   ├── MODEL_EVALUATION.md      # Evaluation metrics
│   ├── MODEL_DEPLOYMENT.md      # Export, GGUF, Ollama wiring
│   ├── GAMEPLAY_SPEC.md         # Game mechanics spec
│   └── LOCAL_GEMMA.md           # Local Gemma setup
└── .gitignore
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ and **npm**
- **Ollama** (optional, for AI tutor) — [ollama.com](https://ollama.com)

### Run the Game

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` in your browser. The game works fully without Ollama — the AI tutor falls back to a built-in intelligence engine.

### Enable the AI Tutor (Optional)

```bash
# Install and start Ollama, then pull a Gemma model:
ollama pull gemma4:e2b

# The game auto-connects to http://localhost:11434
```

---

## 🧠 Gemma API Integration

LearnXSK integrates Google's **Gemma 4** model for personalized AI tutoring. The integration works through three layers:

### 1. In-Game Client (`frontend/src/ai/GemmaClient.ts`)

The `GemmaClient` singleton connects to a local **Ollama** instance at `http://localhost:11434/api/generate`. It:

- Sends student profile context (handle, track, skill level) with every prompt
- Generates personalized onboarding diagnostics per learning track
- Provides context-aware hints referencing the student's current mission and directory
- Falls back to a hand-crafted **local intelligence engine** when Ollama is unavailable (keyword-matched cybersecurity responses with suggested terminal commands)

```typescript
// Example: Asking the AI tutor for help
const response = await GemmaClient.getInstance().askTutor(
  "How do I find the hidden flag?",
  "Terminal Infiltration",
  "/var/log"
);
// → { answer: "...", source: "ollama" | "local-intelligence" }
```

### 2. Fine-Tuning Pipeline (`apps/ml/`)

The `apps/ml` directory contains a complete **LoRA fine-tuning pipeline** for `google/gemma-4-E2B-it`, designed to specialize the model on cybersecurity education. The pipeline is a 9-stage streaming architecture:

```
datasets (read-only) → prepare → dedupe → quality_filter → format_sft
  → split → validate → train_lora → evaluate → export
```

Key design decisions:
- **Streaming row-by-row** — the 186 MiB Trendyol dataset never fully loads into RAM
- **Hash-based splits** — deterministic and reproducible; adding rows doesn't reshuffle existing splits
- **Banded SimHash** — near-duplicate detection in linear time on a 16 GiB machine
- **Resource gates** — `train_lora.py` checks RAM/GPU before downloading the 9.5 GiB checkpoint

### 3. Deployment Path

The trained LoRA adapter is exported as a **GGUF** file with an Ollama `Modelfile`, ready to be loaded as a custom Ollama model. See [`docs/MODEL_DEPLOYMENT.md`](docs/MODEL_DEPLOYMENT.md) for the full export-to-Ollama workflow.

---

## 📊 Training Datasets (8 Sources)

The Gemma fine-tuning pipeline was trained on **8 cybersecurity datasets** sourced from HuggingFace and NIST, totalling **43,113 normalized records**. Each dataset is documented in [`apps/ml/configs/dataset_manifest.yaml`](apps/ml/configs/dataset_manifest.yaml) with licence, usage rules, and quality gates.

### Datasets Used for Training (`sft_train`)

| # | Dataset | Records | Licence | Purpose |
|---|---------|---------|---------|---------|
| 1 | **Trendyol Cybersecurity Instruction Tuning** | ~53,201 | Apache-2.0 | Primary SFT source — defensive security Q&A with chat-formatted instruction/response pairs |
| 2 | **CyberSec-Bench** | ~200 | Apache-2.0 | High-quality bilingual (EN/FR) compliance and defence Q&A |
| 3 | **SecBench** (SAQs) | ~270 | MIT | Short-answer cybersecurity questions (EN/ZH) |
| 4 | **Kali Linux Toolkit Dataset** | ~790 | MIT | Tool documentation synthesized into instruction pairs for authorised lab use |
| 5 | **Linux Terminal Commands Dataset** | ~599 | MIT | Linux command explanations with examples and man references |

### Datasets Used for Evaluation Only (`eval_only`)

| # | Dataset | Records | Licence | Purpose |
|---|---------|---------|---------|---------|
| 6 | **SecBench** (MCQs) | ~2,730 | MIT | Held-out multiple-choice benchmark (never trained on) |
| 7 | **CyberMetric** | ~10,000 | Apache-2.0 | 10K-question MCQ benchmark; nested subsets excluded to prevent inflation |
| 8 | **CTIBench** | ~5,610 | CC-BY-NC-SA-4.0 | Cyber threat intelligence benchmark (excluded from training due to NC licence) |

### Reference Data (Not Trained On)

| Dataset | Purpose |
|---------|---------|
| **NIST NICE Framework** | Workforce taxonomy for curriculum tagging and grounding (~2,356 components, 5,950 relationship edges) |

### Pipeline Results

| Stage | Rows |
|-------|-----:|
| Normalized from source | 43,113 |
| Training-eligible (`sft_train`) | 19,593 |
| After dedupe | 40,363 |
| After quality filter | 35,242 |
| SFT rows formatted | 19,461 |
| **Final splits** | **17,488 train / 971 val / 1,002 test** |
| Evaluation set | 422 (400 MCQ + 22 open) |

---

## 🎮 Controls

| Key | Action |
|-----|--------|
| `W` / `A` / `S` / `D` | Move (follows mouse direction) |
| Mouse | Aim / turn player |
| `Space` | Jump |
| `P` | Pause / Resume |
| `M` | Mission Control |
| `T` | Terminal |

---

## 📖 Documentation

| Document | Description |
|----------|-------------|
| [`docs/GEMMA4_TRAINING_GUIDE.md`](docs/GEMMA4_TRAINING_GUIDE.md) | Complete training walkthrough with row counts and environment details |
| [`docs/DATASET_AUDIT.md`](docs/DATASET_AUDIT.md) | Licence analysis and quality findings for all 8 datasets |
| [`docs/MODEL_EVALUATION.md`](docs/MODEL_EVALUATION.md) | Evaluation metrics and benchmark results |
| [`docs/MODEL_DEPLOYMENT.md`](docs/MODEL_DEPLOYMENT.md) | Export pipeline, GGUF conversion, and Ollama integration |
| [`docs/GAMEPLAY_SPEC.md`](docs/GAMEPLAY_SPEC.md) | Game mechanics and learning path design |
| [`docs/LOCAL_GEMMA.md`](docs/LOCAL_GEMMA.md) | Local Gemma / Ollama setup instructions |
| [`apps/ml/README.md`](apps/ml/README.md) | ML pipeline reference and script documentation |

---

## 🔒 Privacy & Security

- **100% on-device inference** — Gemma runs locally via Ollama; no API keys, no cloud calls
- **Datasets are read-only** — the pipeline refuses to write into the datasets directory
- **Credentials are masked** — any detected key-like strings are redacted as `<<REDACTED:...>>`
- **Benchmarks are never trained on** — `validate_splits.py` enforces this as a hard gate

---

## 🛠️ Tech Stack

- **Frontend**: Three.js, TypeScript, Vite
- **AI**: Google Gemma 4 (E2B-it) via Ollama
- **ML Pipeline**: Python, PyTorch, Transformers, PEFT, TRL
- **Styling**: Vanilla CSS with glassmorphism + pixel art aesthetics

---

## 📄 License

This project is licensed under the **Apache License 2.0**. See individual dataset licences in the [dataset manifest](apps/ml/configs/dataset_manifest.yaml).
