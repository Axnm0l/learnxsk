# LearnXSK Decision Log

**Last Updated:** 2026-10-11  
**Phase:** Prompt 1 Follow-up — Direction Reset

## Recorded Decisions

### DEC-001: Model Selection — `gemma2:2b`
- **Rationale:** `gemma4:e2b` is not currently available in Ollama's model catalog. `gemma2:2b` is downloaded, tested, and returns `GEMMA_LOCAL_OK`.
- **Status:** Verified and active.

### DEC-002: Dual-Root Directory Junction
- **Rationale:** Agent B (Freebuff) placed initial docs under a nested directory. Directory junctions unified `LearnXSK` and `LearnXSK\LearnXSK` to point to identical files on disk without duplication.
- **Status:** Active.

### DEC-003: Strict Verification & Runtime Differentiation
- **Rationale:** Prompt instructions require absolute honesty regarding test execution.
- **Decision:** Clearly distinguish between:
  1. HTML prototype (tested in browser only)
  2. .NET test build (tested via dotnet CLI only)
  3. Unity scene build (NOT tested because Unity Editor is not installed)
- **Status:** Enforced across all project documentation.

### DEC-004: Pivot from Neon-Dashboard UI to Playable Voxel Game (User Directive)
- **Rationale:** The user explicitly rejected the 2D neon-dashboard UI direction and requested a genuine Minecraft-inspired voxel experience.
- **Decision:**
  - LearnXSK will be redesigned as a genuine, playable voxel game.
  - Core features to implement:
    1. Procedural grassy voxel terrain.
    2. Controllable character with movement.
    3. Running and locomotion animations.
    4. In-world quest board / interactable mission boards.
    5. Mission progression system.
  - Changes will be implemented directly inside the existing canonical `LearnXSK` project root without creating a second project or overwriting unrelated files.
- **Status:** Architecture pivot approved; awaiting user implementation prompt.
