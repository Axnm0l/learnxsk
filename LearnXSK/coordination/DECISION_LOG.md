# LearnXSK Decision Log

**Last Updated:** 2026-10-11  
**Phase:** Prompt 1 — Bootstrap

## Recording Decisions

This log records significant decisions made during the LearnXSK project, including:
- Architecture choices
- Technology selections
- Design tradeoffs
- Scope decisions
- Blocker resolutions

## Decisions

### 2026-10-11 — Project Bootstrap

| Decision | Rationale | Consequences |
|----------|-----------|--------------|
| Use `gemma2:2b` for Prompt 1 | `gemma4:e2b` is not currently available in local Ollama repository. `gemma2:2b` is already downloaded (1.6GB, Q4_0) and verified with `GEMMA_LOCAL_OK`. | Verified local inference. Future prompts can evaluate upgrading to larger/newer Gemma models if supported. |
| Ollama at `http://127.0.0.1:11434` | Mandatory local runtime specified in prompt. No cloud APIs permitted. | Privacy preserved; zero prompt telemetry leaves machine. Game C# connects via `UnityWebRequest` / `HttpClient`. |
| Two-agent parallel coordination | Strict two-agent setup: Agent A (Antigravity Coordinator) & Agent B (Freebuff Design/QA). | Shared root with single-ownership per file. Clean division between C#/Unity and Docs/QA. |
| NTFS Junctions for dual-root compatibility | Freebuff created sub-hierarchy at `LearnXSK\LearnXSK`. Created directory junctions to unify root and subfolder. | Both `LearnXSK\` and `LearnXSK\LearnXSK\` access identical physical files on disk with zero duplication. |
| Original pixel art generated via code | Prompt strictly forbids Minecraft textures and logo assets. | Created 10 original crisp PNG pixel art sprites (grass/tech isometric tiles, 5 distinct mission board glyphs, frames) with Point filtering. |
| Unity 2D Isometric Project Architecture | Standard Unity 2D Package Manager manifest, 1920x1080 ProjectSettings, TagManager, and YAML scene. | Standardized Unity project ready to open in Unity Editor. |
| Standalone C# verification runner | Machine currently lacks Unity Editor executable in PATH. | Built .NET 8/10 C# verification suite proving C# compilation, models, and real local Ollama Gemma inference with zero warnings. |
| Playable HTML5/JS prototype runner | Enables immediate visual & interactive verification in browser at 1920x1080 with pixel art sprites. | Browser subagent verified all 10 acceptance criteria and recorded session video. |
