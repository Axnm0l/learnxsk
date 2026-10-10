# LearnXSK File Ownership

**Last Updated:** 2026-10-11  
**Rules:** One owner per file. Never overwrite another agent's code.

## Agent A — ANTIGRAVITY_COORDINATOR (Google Antigravity, Gemini 3.8 Flash)

**Responsibilities:** Unity project, C# code, first game scene, task coordination, integration.

### Owned Files and Directories

```
Game/                          # Entire Unity project
├── Assets/
│   ├── Scenes/                # Unity scenes
│   ├── LearnXSK/
│   │   ├── Scripts/          # C# gameplay scripts
│   │   ├── Art/              # Pixel art assets
│   │   ├── UI/               # UI prefabs and assets
│   │   └── Data/             # Game data (JSON, ScriptableObjects)
│   └── Editor/               # Editor scripts
├── Packages/manifest.json    # Unity Package Manager config
├── ProjectSettings/          # Unity project settings
└── *.sln, *.csproj           # Solution and project files

coordination/
├── TASK_BOARD.md             # Main task tracking
├── STATUS.md                 # Project status
├── DECISION_LOG.md           # Architecture and design decisions
├── BUILD_LOG.md              # Build and compilation logs
├── BLOCKERS.md               # Blockers and resolutions
└── agents/
    └── antigravity.md         # Agent A's personal report
```

### Do NOT Modify (Owned by Freebuff)

- `docs/` — All documentation
- `coordination/agents/freebuff.md` — Agent B's report
- Any file explicitly marked as Freebuff-owned in this document

---

## Agent B — FREEBUFF_DESIGN_QA (Freebuff, Solar Pro 4)

**Responsibilities:** Local Gemma setup and testing, product specifications, visual guidelines, setup documentation, independent QA.

### Owned Files and Directories

```
docs/
├── GAMEPLAY_SPEC.md          # Product vision and gameplay mechanics
├── PIXEL_ART_GUIDE.md        # Visual style and art guidelines
├── LOCAL_GEMMA.md            # Gemma setup, API, and integration notes
├── SETUP_WINDOWS.md          # Windows installation and setup guide
└── QA_CHECKLIST.md           # Quality assurance checklist

coordination/
└── agents/
    └── freebuff.md           # Agent B's personal report

tools/
└── gemma-smoke-test/         # Gemma smoke test scripts and logs
```

### Do NOT Modify (Owned by Antigravity)

- `Game/` — Entire Unity project (scenes, scripts, assets)
- `coordination/TASK_BOARD.md` — Main task tracking
- `coordination/STATUS.md` — Project status (Antigravity reconciles)
- `coordination/DECISION_LOG.md` — Architecture decisions
- `coordination/BUILD_LOG.md` — Build logs
- `coordination/BLOCKERS.md` — Blockers
- `coordination/agents/antigravity.md` — Agent A's report

---

## Shared Files (Coordinate Before Modifying)

| File | Primary Owner | Notes |
|------|---------------|-------|
| `.gitignore` | Antigravity | Freebuff may review but not modify |
| `README.md` | Antigravity | Freebuff may contribute sections on Gemma setup |

---

## Conflict Prevention Rules

1. **Before modifying any file**, check this ownership document and the latest TASK_BOARD.md.
2. **Never regenerate the Unity project** — Antigravity owns this.
3. **Never modify C# scripts or Unity scenes** — Antigravity owns these.
4. **Report required code changes to Antigravity** instead of making them yourself.
5. **Do not run broad formatting operations** that touch files owned by the other agent.
6. **Do not independently download Gemma models** — Freebuff owns this, but coordinate with Antigravity on integration plans.
7. **Use TODO, IN_PROGRESS, REVIEW, DONE, BLOCKED** states in task tracking.
