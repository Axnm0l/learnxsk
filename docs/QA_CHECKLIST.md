# LearnXSK QA Checklist

**Version:** 1.0 (Prompt 1 — Bootstrap)  
**Last Updated:** 2026-10-11  
**Owner:** Freebuff (Agent B)

## 1. Purpose

This checklist ensures LearnXSK meets quality standards at each phase. Freebuff is responsible for running these checks and reporting results.

## 2. Phase 1: Bootstrap QA

### 2.1 Project Structure

| Check | Status | Notes |
|-------|--------|-------|
| Project root exists at LearnXSK/ | | |
| Unity project folder exists at Game/ | | |
| Assets/Scenes/ directory exists | | |
| Assets/LearnXSK/Scripts/ exists | | |
| Assets/LearnXSK/Art/ exists | | |
| Assets/LearnXSK/UI/ exists | | |
| Assets/LearnXSK/Data/ exists | | |
| Packages/ directory exists | | |
| ProjectSettings/ exists | | |
| docs/ directory with all docs exists | | |
| coordination/ directory with all files exists | | |

### 2.2 Gemma Setup (Verified 2026-10-11)

| Check | Status | Notes |
|-------|--------|-------|
| Ollama installed | ✅ | C:\Users\anmol\AppData\Local\Programs\Ollama\ollama.exe |
| Ollama running | ✅ | API responding at http://127.0.0.1:11434 |
| Gemma model downloaded | ✅ | gemma2:2b (1.6 GB) |
| Smoke test PASSED | ✅ | Returned GEMGA_LOCAL_OK |
| Model name documented | ✅ | LOCAL_GEMMA.md |
| Local-only (no cloud) | ✅ | Confirmed |

### 2.3 Documentation

| Document | Status | Notes |
|----------|--------|-------|
| GAMEPLAY_SPEC.md | ✅ Created | |
| PIXEL_ART_GUIDE.md | ✅ Created | |
| LOCAL_GEMMA.md | ✅ Created | Includes smoke test results |
| SETUP_WINDOWS.md | ✅ Created | |
| QA_CHECKLIST.md | ✅ Created | This file |
| coordination/STATUS.md | ✅ Created | |
| coordination/TASK_BOARD.md | ✅ Created | |
| coordination/FILE_OWNERSHIP.md | ✅ Created | |
| coordination/DECISION_LOG.md | ✅ Created | |
| coordination/BUILD_LOG.md | ✅ Created | |
| coordination/BLOCKERS.md | ✅ Created | |
| coordination/agents/freebuff.md | ⏳ Pending | Agent B report |

### 2.4 Visual Design (Pending Scene)

| Check | Status | Notes |
|-------|--------|-------|
| Pixelated art style | | TBD — scene not built yet |
| Isometric or pseudo-3D appearance | | TBD |
| Five learning paths visually distinct | | TBD |
| Title "LEARNXSK" displayed | | TBD |
| "Welcome, Adventurer!" subtitle | | TBD |
| Tagline displayed | | TBD |

### 2.5 Interaction (Pending Scene)

| Check | Status | Notes |
|-------|--------|-------|
| Mouse-responsive selection | | TBD |
| Selection highlight visible | | TBD |
| Start Mission button present | | TBD |
| Start Mission responds to selection | | TBD |
| Mission start transition/placeholder | | TBD |

### 2.6 Technical (Pending Build)

| Check | Status | Notes |
|-------|--------|-------|
| C# compilation succeeds | | TBD — Unity project not created yet |
| Scene executes without errors | | TBD |
| Readable at 1920x1080 | | TBD |
| Reasonable scaling | | TBD |

## 3. Phase 2+ QA (Future)

When subsequent phases are implemented, add checks for:

### 3.1 Onboarding Flow

- [ ] Terminal-style intake displays correctly
- [ ] Questions render properly
- [ ] Input accepts text and choices
- [ ] Gemma generates skill vector
- [ ] Vector stored correctly

### 3.2 Challenge Execution

- [ ] Challenges generate from Gemma
- [ ] Commands accept player input
- [ ] Anti-vibe detection triggers correctly
- [ ] Hypothesis validation works
- [ ] Session logging works

### 3.3 Post-Session

- [ ] Debrief generates correctly
- [ ] Skill vector updates
- [ ] Next challenge difficulty adjusts

## 4. Ongoing QA Practices

### 4.1 Before Each Session

1. Read coordination/TASK_BOARD.md for current state
2. Read coordination/STATUS.md for recent updates
3. Read coordination/BLOCKERS.md for known issues
4. Read your agent report for your last action

### 4.2 After Each Change

1. Verify the change compiles (if code)
2. Verify the change renders (if visual)
3. Document the change in appropriate log
4. Update task board state

### 4.3 When Reporting Issues

Include:
- What you were testing
- What you expected
- What actually happened
- Steps to reproduce
- Screenshots or logs if available
- Suggested fix (if known)

## 5. Acceptance Criteria Verification

| # | Criterion | Verified By | Status |
|---|-----------|-------------|--------|
| 1 | One shared LearnXSK project root exists | Freebuff | ✅ |
| 2 | Unity project uses C# | Antigravity | ⏳ |
| 3 | LearnXSK welcome screen exists | Freebuff | ⏳ |
| 4 | Five learning-path selections visible | Freebuff | ⏳ |
| 5 | Selection highlights respond to input | Freebuff | ⏳ |
| 6 | Start Mission button responds correctly | Freebuff | ⏳ |
| 7 | Visual design follows pixelated isometric direction | Freebuff | ⏳ |
| 8 | Compilation and scene execution tested | Antigravity | ⏳ |
| 9 | Freebuff records actual Gemma smoke-test outcome | Freebuff | ✅ |
| 10 | Gemma remains local model dependency | Freebuff | ✅ |
| 11 | Dependencies and setup documented | Freebuff | ✅ |
| 12 | Both agents update individual reports | Both | ⏳ |
| 13 | Antigravity reconciles results, updates task board | Antigravity | ⏳ |
| 14 | No agent overwrites other's work | Both | ✅ (in effect) |

## 6. Quality Standards

### 6.1 Code Quality

- No compilation errors
- No runtime errors in normal use
- Clear variable and function names
- Consistent coding style

### 6.2 Visual Quality

- Pixel art is crisp (no blur)
- Colors are consistent
- UI is readable
- Selection states are obvious

### 6.3 Documentation Quality

- Clear and accurate
- Up to date
- Addresses the intended audience
- No placeholder text left in final docs

## 7. Sign-Off Criteria (Prompt 1)

The bootstrap phase is complete when:

- [ ] All Phase 1 QA checks pass
- [ ] Welcome screen is functional and visually appropriate
- [ ] Gemma is verified working locally
- [ ] All documentation is complete and accurate
- [ ] Both agents have updated their reports
- [ ] Antigravity has reconciled results in task board
- [ ] No blockers remain unresolved
