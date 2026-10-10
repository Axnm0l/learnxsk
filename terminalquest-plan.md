# TerminalQuest: Adaptive Offensive Security Learning Game with Gemma

Prepared with Claude, October 11, 2026

## 1. Overview

**Goal:** Build a gamified, terminal-based cybersecurity learning platform that adapts to each player's skill level in real time using Gemma as the AI brain. It generates challenges, grades approach (not just answers), and actively prevents vibe hacking — mindless command spraying without intent.

**Why not just use cmdchallenge or HackTheBox?** Existing platforms are static — every user gets the same challenge, graded the same way, with no memory of who you are. TerminalQuest generates fresh challenges per user, adapts difficulty per session, and teaches *how to think*, not just *what to type*.

**Features to build (all confirmed):**

- Onboarding profiler (builds a per-user skill vector via terminal-style intake)
- Isolated Docker sandbox per user (ephemeral, real Linux environment)
- Gemma-powered adaptive challenge generation (fresh per user, per session)
- Real command execution via browser terminal (xterm.js)
- Anti-vibe-code layer (detects and interrupts mindless spraying)
- ML skill vector (tracks growth across sessions, updates per command)
- CTF mode (unlocked at skill threshold, team vs team supported)
- Post-session Gemma debrief (personalized, not generic)

## 2. Core Principle

> Gemma generates. The user executes. ML remembers.

Three layers, kept strictly separate:

1. **Intelligence layer (Gemma):** challenge generation, hypothesis validation, post-session coaching. Outputs structured JSON only.
2. **Execution layer (Docker + backend):** runs real commands in an isolated container, logs every action, scores the approach.
3. **Adaptation layer (ML):** maintains the skill vector per user, updates it after every session, feeds it back to Gemma for the next challenge.

## 3. System Architecture

```
User arrives
   |
   v
[Onboarding Terminal] -> free-text + command answers
   |
   v
[Gemma profiler] -> initial skill vector (JSON)
   |
   v
[Docker sandbox spin-up] -> isolated per-user container
   |
   v
[Gemma challenge generator] -> plants artifacts, flags, vulns in container
   |
   v
[Browser terminal (xterm.js)] -> user types real Linux commands
   |
   v
[Command logger + anti-vibe detector] -> watches every keystroke
        |                    |
        v                    v
[Gemma hypothesis      [Skill vector updater]
 validator]                  |
        |                    v
        v             [SQLite: per-user profile]
[Continue or interrupt]
   |
   v
[Session ends] -> Gemma post-session debrief -> next challenge difficulty set
```

## 4. Skill Vector Schema

One JSON format shared by every layer. Fixed ranges so bad model output can be clamped.

```json
{
  "file_system_nav": 0.4,
  "process_analysis": 0.2,
  "network_recon": 0.1,
  "privilege_escalation": 0.0,
  "scripting": 0.3,
  "pattern_thinking": 0.5
}
```

| Dimension | Range | What it measures |
| --- | --- | --- |
| file\_system\_nav | 0 to 1 | Comfort navigating Linux filesystem |
| process\_analysis | 0 to 1 | Reading and interpreting running processes |
| network\_recon | 0 to 1 | Port scanning, service identification |
| privilege\_escalation | 0 to 1 | SUID, sudoers, kernel exploits |
| scripting | 0 to 1 | Bash, Python one-liners, automation |
| pattern\_thinking | 0 to 1 | Methodical approach vs random spraying |

All values start at 0.0. They are updated after every session. Gemma reads this vector before generating the next challenge to calibrate difficulty.

## 5. Components

### 5.1 Onboarding Profiler

Build this first. It establishes the starting skill vector and is the user's first impression of the product.

The onboarding runs entirely inside a fake terminal in the browser. It asks a mix of multiple choice and free-text:

```
[TerminalQuest] Welcome. Let's figure out where you're starting.

> Have you used Linux before? (y/n)
> What does this command do?   $ find / -perm -4000 2>/dev/null
> Why are you here? (CTF / college lab / job / curiosity)
> Type any command you know. Don't think. Just type.
```

Gemma reads all answers — especially the free-text ones — and produces the initial skill vector JSON. This is stored in the database and never shown to the user directly.

Rules:
- Parse strictly. On parse failure, retry once, then fall back to all-zeros vector.
- Clamp every value to 0.0–1.0.
- The last question (type any command) is the most signal-rich. Gemma reads *what* they typed, *how* they typed it, and whether it was intentional or guessed.

### 5.2 Docker Sandbox

Every user gets a fresh, isolated Docker container. No two users share a box. Containers are:

- Spun up on session start, torn down on session end
- Pre-seeded by Gemma with challenge-specific artifacts (modified files, planted flags, misconfigured services, vulnerable binaries)
- Completely safe to destroy — nothing persists between sessions unless deliberately saved to the user profile

The backend (FastAPI) manages container lifecycle. Commands typed in the browser are forwarded to the container via a WebSocket connection and real output is streamed back.

### 5.3 Gemma Challenge Generator

Given a user's skill vector, Gemma generates the challenge scenario and a seeding script that sets up the container.

Example system prompt:

```
You are a cybersecurity challenge designer. Given a user skill vector,
return ONLY a JSON object with:
  - scenario: one-sentence description shown to the user
  - difficulty: 1-10
  - seed_commands: array of bash commands to run inside the container
    to plant the challenge (create files, set permissions, hide flags, etc.)
  - solution_path: the intended command sequence (hidden, used for grading)
  - category: one of [filesystem, process, network, privesc, scripting]
No commentary. No markdown. JSON only.
```

Rules:
- Validate and run seed\_commands inside a sandboxed pre-check before deploying to the user's container.
- Solution path is stored server-side only — never sent to the frontend.
- Difficulty must match the user's skill vector: if `privilege_escalation` is 0.1, do not generate a privesc challenge rated above 3/10.

### 5.4 Anti-Vibe-Code Layer

This is the unique feature no other platform has. A passive monitor watches every command the user types and scores it for intentionality.

Vibe hacking patterns (triggers an interrupt):

```
$ find / -name "flag*" 2>/dev/null       # spray scan
$ grep -r "password" / 2>/dev/null       # spray grep
$ ls -la / && ls -la /home && ls -la /tmp  # mindless enumeration chain
$ cat /etc/passwd /etc/shadow /etc/hosts   # dumping everything at once
```

When a vibe pattern is detected, the terminal freezes and shows:

```
[TerminalQuest] Hold on.

You're spraying commands hoping something sticks.
That's vibe hacking. It works sometimes. It teaches you nothing.

What are you actually looking for right now?
State your hypothesis before you continue.

> _
```

Gemma reads the hypothesis. If it's logical and specific, the user continues. If it's vague ("I don't know", "just checking"), Gemma asks one follow-up question. If they can't articulate it, they get a small nudge — not the answer, but a concept to research.

This is tracked in the skill vector. `pattern_thinking` rises when users can articulate hypotheses. It falls when they spray.

### 5.5 ML Skill Vector Updater

After every session, the following signals are collected per user:

```
- Total commands typed
- Unique commands (ratio of unique / total = diversity score)
- Time between commands (hesitation = uncertainty)
- Error rate (invalid commands, permission denied, command not found)
- Vibe interrupts triggered (lower = better pattern_thinking)
- Hypotheses submitted and accepted by Gemma
- Whether the flag was found, and how many commands it took
- Commands vs optimal path length (from solution_path)
```

These signals are fed into a simple update function per skill dimension. For example:

```python
# After a filesystem challenge
gap = commands_used - optimal_path_length
efficiency = max(0, 1 - (gap / optimal_path_length))
skill_vector["file_system_nav"] = (
    0.8 * old_score + 0.2 * efficiency
)
```

The 0.8 / 0.2 weighting means old skills decay slowly — one bad session doesn't wipe progress, and one lucky session doesn't inflate the score.

### 5.6 CTF Mode

Unlocked when any skill vector dimension reaches 0.6 or when the user has completed 10 standard challenges.

CTF mode features:
- Timed challenges (30 to 90 minutes depending on difficulty)
- Multi-stage flags: finding flag\_1 unlocks the path to flag\_2
- Team vs Team: two isolated lab networks, same challenge, race to root
- Weekly CTF events: Gemma generates a fresh scenario each Monday, retired the following Sunday
- Leaderboard: scored by flags captured, commands used (fewer = better), and time

CTF challenges are generated the same way as standard challenges but with `difficulty` forced to 7–10 and multi-stage `seed_commands`.

### 5.7 Post-Session Gemma Debrief

After every session (win or not), Gemma generates a personalized debrief using:
- The user's command log for the session
- The optimal solution path
- The current skill vector

Output is shown in the terminal, styled like a mentor speaking:

```
[TerminalQuest] Session complete.

You found the flag in 31 commands. The intended path was 7.

What you did well:
- You checked /etc/passwd early. That's the right instinct.
- You didn't guess the flag format — you looked for it properly.

What to fix:
- Commands 12–19 were all variations of the same grep. When a
  command fails twice, change your approach, not the flags.
- You never checked file permissions. That was the key to this one.

Your skill vector update:
  file_system_nav    0.31 → 0.38  ↑
  pattern_thinking   0.45 → 0.41  ↓  (3 vibe interrupts this session)

Next session: I'll give you something in the same category, slightly harder.
```

## 6. Gemma Integration

- **Run locally** with Ollama on your Ryzen 9X. The hardware handles Gemma 27B comfortably. Use Gemma 9B for faster iteration during development.
- **Constrain output:** use JSON mode if available; otherwise prompt for JSON only, validate with `json.loads()`, retry once on failure.
- **Cache** challenge seeds per skill vector hash so repeat-similar-profile users don't hammer the model.
- **Batch** where possible — combine challenge generation and debrief into one call at session end.
- **Temperature:** 0.3 for challenge generation and skill assessment (consistency), 0.7 for debrief and hypothesis feedback (natural language).

## 7. Build Plan

| Phase | Work | Done when |
| --- | --- | --- |
| 0 | Project scaffold: Next.js frontend, FastAPI backend, SQLite, Docker API | `docker run` works from the backend |
| 1 | xterm.js terminal in browser connected to container via WebSocket | User can type real commands and see real output |
| 2 | Onboarding flow + Gemma profiler + initial skill vector | New user gets a skill vector stored in DB |
| 3 | Gemma challenge generator + container seeder | Gemma plants a challenge, user can find it |
| 4 | Command logger + anti-vibe-code detector + Gemma hypothesis validator | Vibe interrupts work and hypothesis gate functions |
| 5 | Skill vector updater (post-session ML update) | Skill scores change correctly after a session |
| 6 | Post-session Gemma debrief | Debrief renders in terminal with correct data |
| 7 | CTF mode (timed + multi-stage) | A complete CTF challenge runs end to end |
| 8 | UI polish (dark terminal theme, animations, leaderboard) | Looks impressive in a demo |
| 9 | README, demo script, open-source license | Someone else can deploy it from the README |

Suggested repo layout:

```
terminalquest/
  frontend/          # Next.js + xterm.js
  backend/           # FastAPI + Docker management + WebSocket
  gemma/             # prompts, client, validators, caching
  ml/                # skill vector schema, update functions
  challenges/        # hand-crafted seed scripts as fallback
  ctf/               # CTF mode logic and weekly event scheduler
  eval/              # test scripts, sample sessions
  docker/            # base container image for user sandboxes
  README.md
```

## 8. Evaluation

- **User test:** run 5 people through 3 sessions each. Measure whether their skill vectors move in the right direction.
- **Anti-vibe effectiveness:** count vibe interrupts in session 1 vs session 5. Interrupts should decrease as users learn to think before typing.
- **Challenge quality:** after each generated challenge, rate it 1–5 for: solvability, realism, appropriate difficulty. Target average above 4.
- **Debrief quality:** ask users if the debrief accurately described what they did. Target accuracy above 80%.
- **Rule:** if the ML adaptation doesn't produce measurably different challenges after 3 sessions, the skill vector update function is broken — fix it before adding features.

## 9. Hackathon Prize Alignment

| Prize | How TerminalQuest qualifies |
| --- | --- |
| **Best Use of Gemma 4** | Gemma is the core brain: profiler, challenge generator, hypothesis validator, debrief writer. Not a wrapper — it drives every decision. |
| **Best Open-Source AI Project** | Fully MIT licensed, self-hostable, uses open-weight Gemma, designed for university labs and clubs to deploy internally. |

## 10. Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| Gemma returns malformed JSON | Strict parsing, one retry, then fall back to hand-crafted challenge library |
| Docker container escape | Use gVisor or rootless Docker; never mount host filesystem; drop all capabilities |
| Challenge too hard or too easy | Difficulty validation step before deploying — if seed\_commands produce an unsolvable setup, regenerate |
| Anti-vibe layer is annoying | Cap interrupts at 2 per session; after the 2nd, show a tip instead of blocking |
| Skill vector doesn't converge | Add a minimum 10-session window before trusting scores; use conservative update weights |
| Slow Gemma response during session | Pre-generate the next challenge in the background while the user is solving the current one |
| Students share flag answers | Flags are dynamically generated per session (UUID-based); sharing a flag from yesterday's session doesn't help today |

## 11. What Makes This Different

Every existing platform fails in at least one of these ways. TerminalQuest doesn't.

| Feature | cmdchallenge | HackTheBox | OverTheWire | **TerminalQuest** |
| --- | --- | --- | --- | --- |
| Adaptive difficulty | ❌ | ❌ | ❌ | ✅ Gemma-driven per skill vector |
| Isolated per-user lab | ❌ | ✅ | ❌ | ✅ Fresh Docker per session |
| Anti-vibe-code layer | ❌ | ❌ | ❌ | ✅ Core differentiator |
| Personalized curriculum | ❌ | ❌ | ❌ | ✅ ML skill vector |
| Fresh challenges every time | ❌ | ❌ | ❌ | ✅ Gemma-generated |
| CTF mode | ❌ | ✅ | ✅ | ✅ Auto-generated |
| Open source + self-hostable | ✅ | ❌ | ❌ | ✅ |
| College lab ready | ⚠️ | ❌ | ⚠️ | ✅ Built specifically for this |
| Teaches thinking process | ❌ | ❌ | ❌ | ✅ Hypothesis gate enforces it |

## 12. Next Steps

1. Confirm which Gemma variant to use for the hackathon (9B for speed, 27B for quality — your hardware can run either).
2. Set up the base Docker image for user sandboxes (Alpine Linux + common tools pre-installed).
3. Start Phase 0: scaffold the repo, confirm Docker API works from FastAPI, get xterm.js rendering a real shell in the browser.
4. Build the onboarding flow first — it's the demo hook and the ML foundation.
