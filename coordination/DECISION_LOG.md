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

### DEC-005: Canonical Project Root Repair & De-duplication
- **Rationale:** Prompt 2 pre-condition required repairing the accidental nested `LearnXSK\LearnXSK` directory structure and removing NTFS junctions so that all assets, scenes, scripts, docs, and coordination files physically reside solely at canonical root `C:\Users\anmol\OneDrive\Desktop\LearnXSK`.
- **Decision:**
  1. Complete backup preserved at `C:\Users\anmol\OneDrive\Desktop\LearnXSK_backup_pre_repair` and zip archive `LearnXSK_backup_pre_repair.zip`.
  2. NTFS junctions (`Game`, `coordination`, `docs`, `tools`) safely removed.
  3. Real physical directories promoted to root `C:\Users\anmol\OneDrive\Desktop\LearnXSK`.
  4. Empty nested directory `LearnXSK\LearnXSK` safely removed.
  5. `Game\Assets\LearnXSK` asset namespace preserved intact.
  6. Git index staged deletion of duplicate `LearnXSK/...` inner paths while preserving root files and Git commit history.
- **Status:** Completed and verified.

### DEC-006: Unity 6 (6000.6.5f1) Package Manifest Modernization
- **Rationale:** Initial launch with Unity 6 reported invalid dependencies for `com.unity.modules.core` and `com.unity.modules.vr` (deprecated/removed in Unity 6 LTS).
- **Decision:** Modernized `Game/Packages/manifest.json` by pruning these obsolete dependencies. Unity 6 package resolution and compilation succeeded immediately.
- **Status:** Completed and active.

### DEC-007: 2D Isometric Voxel Game Architecture ("The Blocklands")
- **Rationale:** Replace rejected neon-dashboard UI with a genuine playable block-world sandbox adhering to Prompt 2 creative and technical specifications.
- **Decision:**
  1. Procedural generation in code (`ProceduralPalette.cs`, `ProceduralSpriteGenerator.cs`, `IsometricWorldBuilder.cs`) avoiding third-party or downloaded art packs.
  2. Controllable character with WASD movement, walk/run animations, Rigidbody2D collision, and follow camera.
  3. Safe simulated Linux virtual filesystem (`VirtualFilesystem.cs`) preventing arbitrary host shell execution.
  4. In-world Quest Board and Cyber Terminal Station linked to `QuestManager.cs` progression and local Ollama (`LocalGemmaClient.cs`).
  5. Configured `Assets/Scenes/BlocklandsIsometric.unity` as active build Scene 0.
- **Status:** Implemented, verified in Unity 6 engine, and active.

### DEC-008: Standalone Windows Jury Build Packaging
- **Rationale:** Deliver an independent, self-contained executable for the jury that runs without requiring Unity Editor installation or project setup.
- **Decision:** Built `Game/Build/StandaloneWin64/LearnXSK_Blocklands.exe` (92.2 MB) via headless batchmode Unity pipeline. Feature freeze instituted post-build.
- **Status:** Complete and verified.

### DEC-009: Browser-Based Three.js Web Game Implementation
- **Rationale:** User requested an accessible browser-based game using Three.js, TypeScript, and Vite while maintaining the grassy blocklands isometric aesthetic and preserving the existing Unity build.
- **Decision:**
  1. Built inside dedicated `web-game/` directory; completely preserved Unity `Game/` directory.
  2. Procedural canvas pixel-art textures (grass, wood, cobblestone, water, quest board, CRT screen) — zero downloaded asset packs.
  3. Instanced 3D voxel terrain with orthographic isometric camera tracking.
  4. Voxel character with WASD movement, walk cycle animations, sprint, and E-interaction.
  5. Virtual Linux Filesystem (`VirtualFilesystem.ts`) running `ls`, `cd`, `cat`, `grep`, `pwd` with token discovery challenge.
  6. Backend proxy (`backend/server.js`) bridging frontend to local Ollama `gemma2:2b` at `http://127.0.0.1:11434` with client offline fallback.
  7. End-to-end browser tested and verified with browser subagent.
- **Status:** Complete, running, and verified.

