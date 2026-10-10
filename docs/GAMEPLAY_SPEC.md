# LearnXSK Gameplay Specification

**Version:** 1.0 (Prompt 1 — Bootstrap)  
**Last Updated:** 2026-10-11  
**Owner:** Freebuff (Agent B)

## 1. Product Vision

LearnXSK is a Minecraft-inspired, pixelated cybersecurity learning game written in C# with Unity. Players navigate a block-world environment while completing Linux and cybersecurity challenges that adapt to their skill level using local Gemma AI.

**Core Concept:** Interactive Linux challenges, skill-based progression, personalized Gemma tutoring, and post-session explanations — all running locally on the player's machine.

## 2. Reference

This specification preserves the original TerminalQuest concept from `terminalquest-plan.md`:
- Onboarding profiler with skill vector
- Adaptive challenge generation via Gemma
- Anti-vibe-code layer (prevents mindless command spraying)
- Post-session debriefs
- CTF mode (future phase)

## 3. First Prototype Scope (Prompt 1)

The first prototype delivers only the welcome screen with learning path selection. This is the entry point to the game — not a complete mission.

### 3.1 Welcome Screen Requirements

| Element | Requirement |
|---------|-------------|
| Title | Display "LEARNXSK" prominently |
| Subtitle | "Welcome, Adventurer!" |
| Tagline | "Your journey to mastering Linux and cybersecurity begins here." |
| Learning Paths | Five visually distinct selectable objects/mission boards |
| Selection | Mouse-responsive highlighting |
| Start Button | "Start Mission" button that responds to selection |
| Transition | Meaningful placeholder when mission starts |

### 3.2 Learning Paths

1. **Linux Basics** — Navigate the terminal
2. **Filesystem Explorer** — Investigate files and hidden clues
3. **Process Detective** — Understand processes and system activity
4. **Network Recon** — Explore networking fundamentals in controlled labs
5. **Scripting Lab** — Learn commands and basic automation

Each path is a mission board or interactive object in the isometric world.

## 4. Visual Direction

### 4.1 Overall Style

- 2D game with isometric or pseudo-3D block-world appearance
- Original pixel art (no Minecraft assets)
- Convincing depth through shading and layering
- Environmental lighting effects
- Crisp textures at native resolution
- Readable UI that doesn't obscure the world

### 4.2 Technical Approach

- Unity 2D Isometric Tilemap system
- SpriteRenderer for pixel art sprites
- Pixel-perfect rendering settings
- Orthographic camera for isometric view
- Custom pixel font for terminal aesthetic

### 4.3 Color Palette (Suggested)

| Element | Suggested Colors |
|---------|------------------|
| Sky/Background | Deep gradient (dark blue to purple) |
| Blocks (ground) | Varied earth tones with highlighting |
| UI Panels | Dark panels with light borders |
| Selected State | Bright highlight color (e.g., cyan or yellow) |
| Text | High contrast (light on dark) |

## 5. Game Flow (Future Phases)

### 5.1 Onboarding (Phase 2)

- Terminal-style intake sequence
- Multiple choice and free-text questions
- Gemma generates initial skill vector (JSON)

### 5.2 Challenge Execution (Phase 3+)

- Player receives challenge scenario
- Types real Linux commands (simulated or via backend)
- Anti-vibe layer monitors for mindless spraying
- Gemma validates hypotheses

### 5.3 Post-Session (Every Session)

- Gemma generates personalized debrief
- Skill vector updates
- Next challenge difficulty calibrated

## 6. Gemma Integration

### 6.1 Runtime

- **Local only** — Ollama on the player's machine
- API endpoint: `http://127.0.0.1:11434`
- No cloud AI services

### 6.2 Model

- Initial: `gemma2:2b` (verified working)
- Target: `gemma4:e2b` if available and machine supports it

### 6.3 Usage in Game

| Feature | Gemma Role |
|---------|------------|
| Onboarding | Generate initial skill vector from player answers |
| Challenge Generation | Create scenarios and seed commands |
| Anti-Vibe | Evaluate player hypotheses |
| Post-Session | Write personalized debrief |

### 6.4 Output Constraints

- JSON mode preferred for structured outputs
- Strict parsing with one retry
- Fallback to hand-crafted content on failure

## 7. Acceptance Criteria (Prompt 1)

1. One shared LearnXSK project root exists
2. Unity project uses C#
3. LearnXSK welcome screen exists
4. Five learning-path selections are visible
5. Selection highlights respond to user input
6. Start Mission button responds correctly
7. Visual design follows pixelated isometric direction
8. Compilation and scene execution tested where possible
9. Gemma smoke-test outcome recorded
10. Gemma remains local model dependency
11. Dependencies and setup documented
12. Both agents update individual reports
13. Antigravity reconciles results and updates task board
14. No agent overwrites other's work

## 8. Out of Scope (Prompt 1)

- Complete cybersecurity missions
- Docker sandbox integration
- Real command execution
- Skill vector ML updates
- CTF mode
- Multiplayer features

These are reserved for future prompts.
