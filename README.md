# LEARNXSK — Adaptive Cybersecurity Learning Game

> **Welcome, Adventurer! Your journey to mastering Linux and cybersecurity begins here.**

LearnXSK is a Minecraft-inspired, pixelated cybersecurity learning game built in C# with Unity, powered by an on-device local Gemma model via Ollama. It brings the TerminalQuest vision to life: interactive Linux challenges, skill-based progression, anti-vibe hacking safeguards, and personalized AI debriefs without any cloud telemetry.

---

## Architecture & Team Roles

This project is co-developed by two specialized AI agents working inside this shared repository:

1. **Agent A — Antigravity Coordinator (`Gemini 3.8 Flash`)**
   - IDE: Google Antigravity
   - Scope: Unity project architecture, C# gameplay scripts, welcome screen, isometric UI/world, task board, and integration.
2. **Agent B — Freebuff Design & QA (`Solar Pro 4`)**
   - CLI: Freebuff
   - Scope: Local Gemma setup & smoke tests, product specifications, visual guidelines, Windows setup documentation, and QA validation.

---

## Project Structure

```
LearnXSK/
├── Game/
│   ├── Assets/
│   │   ├── Scenes/                  # WelcomeScreen.unity
│   │   ├── LearnXSK/
│   │   │   ├── Scripts/             # C# controllers, models, Gemma client
│   │   │   ├── Art/                 # Original isometric & pixel art sprites
│   │   │   ├── UI/                  # UI components and prefabs
│   │   │   └── Data/                # Path definitions and configuration
│   │   └── Editor/                  # Unity editor utilities
│   ├── Packages/
│   │   └── manifest.json            # Unity Package Manager manifest
│   └── ProjectSettings/             # Project settings (TagManager, etc.)
├── docs/
│   ├── GAMEPLAY_SPEC.md             # Gameplay mechanics and vision
│   ├── PIXEL_ART_GUIDE.md           # Isometric pixel art style guide
│   ├── LOCAL_GEMMA.md               # Local Gemma inference documentation
│   ├── SETUP_WINDOWS.md             # Windows environment setup guide
│   └── QA_CHECKLIST.md              # Quality assurance checklist
├── coordination/
│   ├── STATUS.md                    # Live project status
│   ├── TASK_BOARD.md                # Shared task tracking
│   ├── FILE_OWNERSHIP.md            # Agent boundaries and ownership rules
│   ├── DECISION_LOG.md              # Architectural decisions
│   ├── BUILD_LOG.md                 # Compilation and verification logs
│   ├── BLOCKERS.md                  # Active blockers & resolutions
│   └── agents/
│       ├── antigravity.md           # Agent A log
│       └── freebuff.md              # Agent B log
├── tools/
│   └── gemma-smoke-test/            # Verification scripts
├── .gitignore                       # Clean Git tracking (weights excluded)
└── README.md                        # Project entry point
```

---

## 5 Selectable Learning Paths

1. **Linux Basics** — Navigate the terminal, learn core commands, and master shell navigation.
2. **Filesystem Explorer** — Investigate file structures, permissions, and hidden clues.
3. **Process Detective** — Understand running processes, background tasks, and process telemetry.
4. **Network Recon** — Explore networking fundamentals, port reconnaissance, and network labs.
5. **Scripting Lab** — Learn Bash commands, one-liners, and automation essentials.

---

## Local Gemma AI Integration

- **Runtime:** Local Ollama (`http://127.0.0.1:11434`)
- **Active Model:** `gemma2:2b` (tested and verified with smoke test `GEMMA_LOCAL_OK`)
- **Security & Privacy:** 100% on-device local inference. No gameplay telemetry or prompts are ever transmitted to cloud APIs.

---

## Requirements & Running the Game

- **OS:** Windows 10/11 64-bit
- **Unity Version:** Unity 6 (6000.x) or Unity 2022.3 LTS
- **Runtime Dependencies:**
  - .NET 8.0 / 10.0 SDK for C# compilation
  - Ollama with `gemma2:2b` running at `localhost:11434`
- **To Launch in Unity Editor:**
  1. Open **Unity Hub**.
  2. Click **Add** -> **Add project from disk**.
  3. Select the `LearnXSK/Game` folder.
  4. Open `Assets/Scenes/WelcomeScreen.unity`.
  5. Press **Play** in the Unity Editor toolbar.
