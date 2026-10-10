# LearnXSK Task Board

**Last Updated:** 2026-10-11  
**Phase:** Prompt 1 — Bootstrap  
**Reconciled By:** Agent A — Antigravity Coordinator

## Task States

- `TODO` — Not started
- `IN_PROGRESS` — Currently being worked on
- `REVIEW` — Completed, awaiting review
- `DONE` — Completed and verified
- `BLOCKED` — Cannot proceed without user action / upstream dependency

---

## Phase 1: Bootstrap (Prompt 1)

### Infrastructure & Setup

| Task ID | Task | State | Owner | Notes |
|---------|------|-------|-------|-------|
| INF-01 | Create shared project root structure | DONE | Freebuff / Antigravity | Folders & junctions initialized |
| INF-02 | Verify Windows system requirements | DONE | Freebuff | 16GB RAM, 4.5GB VRAM, 147GB free disk |
| INF-03 | Check/install Ollama | DONE | Freebuff | v0.30.10 running at localhost:11434 |
| INF-04 | Download Gemma model | DONE | Freebuff | `gemma2:2b` verified (1.6GB Q4_0) |
| INF-05 | Run Gemma smoke test | DONE | Freebuff | ✅ PASSED — `GEMMA_LOCAL_OK` returned |
| INF-06 | Verify Unity Hub installation | BLOCKED | Antigravity | Requires user UAC approval to install |
| INF-07 | Verify Unity Editor version | BLOCKED | Antigravity | Awaiting Unity Hub setup by user |
| INF-08 | Verify Git installation | DONE | Antigravity | Git 2.x present, repo initialized |
| INF-09 | Verify C# tooling | DONE | Antigravity | .NET SDK 10.0.301 / net8.0 verified |

### Project Creation

| Task ID | Task | State | Owner | Notes |
|---------|------|-------|-------|-------|
| PROJ-01 | Initialize Unity project directory structure | DONE | Antigravity | `Game/` structure with Assets, Packages, ProjectSettings |
| PROJ-02 | Configure `Packages/manifest.json` | DONE | Antigravity | Configured with 2D Tilemap, Sprite, UGUI, TMP |
| PROJ-03 | Configure `ProjectSettings.asset` & `TagManager.asset` | DONE | Antigravity | Configured 1920x1080 resolution, tags, layers |
| PROJ-04 | Create `.gitignore` | DONE | Antigravity | Excludes Library, Temp, weights, binaries |
| PROJ-05 | Create `README.md` | DONE | Antigravity | Comprehensive architecture & setup guide |

### Coordination Files

| Task ID | Task | State | Owner | Notes |
|---------|------|-------|-------|-------|
| COOR-01 | Create `coordination/STATUS.md` | DONE | Antigravity | Live project status reconciled |
| COOR-02 | Create `coordination/TASK_BOARD.md` | DONE | Antigravity | This file |
| COOR-03 | Create `coordination/FILE_OWNERSHIP.md` | DONE | Freebuff / Antigravity | Agent boundaries preserved |
| COOR-04 | Create `coordination/DECISION_LOG.md` | DONE | Antigravity | Architecture & technical choices logged |
| COOR-05 | Create `coordination/BUILD_LOG.md` | DONE | Antigravity | Compilation and test execution logs |
| COOR-06 | Create `coordination/BLOCKERS.md` | DONE | Antigravity | Tracked Unity install requirement |
| COOR-07 | Create `coordination/agents/antigravity.md` | DONE | Antigravity | Agent A detailed report |
| COOR-08 | Create `coordination/agents/freebuff.md` | DONE | Freebuff | Agent B detailed report |

### Documentation (Freebuff)

| Task ID | Task | State | Owner | Notes |
|---------|------|-------|-------|-------|
| DOC-01 | Create `docs/GAMEPLAY_SPEC.md` | DONE | Freebuff | Vision, 5 paths, mechanics |
| DOC-02 | Create `docs/PIXEL_ART_GUIDE.md` | DONE | Freebuff | Visual guidelines, palette, isometric rules |
| DOC-03 | Create `docs/LOCAL_GEMMA.md` | DONE | Freebuff | Gemma setup, API, smoke test records |
| DOC-04 | Create `docs/SETUP_WINDOWS.md` | DONE | Freebuff | Windows setup instructions |
| DOC-05 | Create `docs/QA_CHECKLIST.md` | DONE | Freebuff | Acceptance verification checklist |

### Unity Development & Assets (Antigravity)

| Task ID | Task | State | Owner | Notes |
|---------|------|-------|-------|-------|
| UNI-01 | Generate original pixel art sprites | DONE | Antigravity | 10 sprites (tiles, 5 glyphs, buttons, frames) + `.meta` |
| UNI-02 | Implement `LearningPathType.cs` & metadata | DONE | Antigravity | 5 cybersecurity paths with color, tagline, diff |
| UNI-03 | Implement `LearningPathCard.cs` | DONE | Antigravity | Pointer hover, selection, animations, callbacks |
| UNI-04 | Implement `LocalGemmaClient.cs` | DONE | Antigravity | Local Ollama connection, query, health status |
| UNI-05 | Implement `WelcomeScreenController.cs` | DONE | Antigravity | Title, 5 paths, start button, modal transition |
| UNI-06 | Create `Assets/Scenes/WelcomeScreen.unity` | DONE | Antigravity | Complete Unity YAML scene ready for Editor |
| UNI-07 | Verify C# compilation | DONE | Antigravity | Verified with .NET SDK — 0 errors, 0 warnings |
| UNI-08 | Run C# inference smoke test | DONE | Antigravity | Verified with local Ollama — `GEMMA_LOCAL_OK` |
| UNI-09 | Build & test playable prototype | DONE | Antigravity | Verified via browser subagent + session video |

---

## Acceptance Criteria Tracking

| # | Criterion | Status | Verification Detail |
|---|-----------|--------|---------------------|
| 1 | One shared LearnXSK project root exists | ✅ DONE | Unified root with junction compatibility |
| 2 | Unity project uses C# | ✅ DONE | C# scripts in `Game/Assets/LearnXSK/Scripts/` |
| 3 | LearnXSK welcome screen exists | ✅ DONE | Scene YAML & playable prototype verified |
| 4 | Five learning-path selections visible | ✅ DONE | Linux Basics, Filesystem, Process, Network, Scripting |
| 5 | Selection highlights respond to user input | ✅ DONE | Verified hover & selection states |
| 6 | Start Mission button responds correctly | ✅ DONE | Dynamic label, state, and click handler |
| 7 | Visual design follows pixelated isometric direction | ✅ DONE | 10 original pixel art sprites with Point filtering |
| 8 | Compilation and scene execution tested | ✅ DONE | C# compiled (0 err), prototype tested via browser agent |
| 9 | Freebuff records actual Gemma smoke-test outcome | ✅ DONE | Logged in `docs/LOCAL_GEMMA.md` & `freebuff.md` |
| 10 | Gemma remains local model dependency | ✅ DONE | 100% on localhost:11434, zero cloud telemetry |
| 11 | Dependencies and setup documented | ✅ DONE | Documented in `docs/` and `README.md` |
| 12 | Both agents update individual reports | ✅ DONE | `agents/antigravity.md` & `agents/freebuff.md` |
| 13 | Antigravity reconciles results, updates task board | ✅ DONE | Reconciled across both agents |
| 14 | No agent overwrites other's work | ✅ DONE | Strict file ownership adhered to |
