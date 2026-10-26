# Features: owners, tiers, rubric fit and bonus prizes

Written 26 Oct 2026, after the kickoff slides and the role split in [ROLES.md](ROLES.md). This is the list we turn into board issues on day 1. It adds no scope: every feature comes from [SCOPE.md](SCOPE.md), and the cut order stays in [PLAN.md](PLAN.md) §5.

**Tiers**
- **Core:** on PLAN.md §5's never-cut list. If it breaks, fixing it beats everything else.
- **Must:** must ship, but has a place in the cut order at the day-4 or day-6 checkpoint.
- **Proposed stretch:** REVIEW.md H1 recommends moving it to stretch; we decide together at the first sync.
- **Stretch:** SCOPE.md §4 stretch list, in that order, only once the must-ship flow works on the hosted URL.

**Rubric columns** (Stage 2, four equally weighted criteria, 0–10 each, CONTEXT.md §5): **I** Impact, **M** Use of Meta AI Tooling, **T** Technical Depth and Execution, **D** Demo.

**Lead** makes sure it gets done and decides inside that area; **Support** reviews and helps. Either of us may work on anything (ROLES.md §3).

## 1. Product features

| ID | Feature | Lead | Support | Tier | Plan day | Rubric | Bonus prize | Demo scene (DEMO.md) |
|---|---|---|---|---|---|---|---|---|
| F1 | Start and consent screen: what Parallax is, "a reflection aid, not financial advice", 18+, what we store, that Meta's API processes it, Delete everything | Sibusiso | Lethabo (privacy wording) | Core (the notice) | 2, 8 | I | — | On every screen; end card |
| F2 | Text intake: "Here is what I heard" form, one follow-up at a time, rough answers kept as ranges | Sibusiso (screen, `/api/intake` route) | Lethabo (intake agent, structured output) | Must | 2 | I, M, T | — | 0:10–0:28 |
| F3 | Voice intake: push-to-talk, Muse Voice Transcribe, transcript confirmed before extraction | Lethabo | Sibusiso (mic UI, WAV encoder) | Must (cut 5) | 5 | M, D | — | 0:10–0:28 |
| F4 | Faulty-input handling: range chips, outlier confirmation ("195000"), contradictions, out-of-scope decisions, a 20+ case test list | Sibusiso (checks in back end and UI) | Lethabo (test list, runs it) | Core | 2–7 | T, D | — | 1:40–2:00 (3-min video) |
| F5 | Profile card "You, today": facts, assumed defaults (marked), priorities; editable | Sibusiso | Lethabo | Must | 3 | T | — | 0:28 |
| F6 | Path proposal: 2–3 paths with assumption ranges and rationale, strict JSON, editable | Lethabo (path-planner agent) | Sibusiso (`/api/paths`, paths screen) | Must (third path is cut 2) | 2–3 | M, T | Best Agentic Use-Case | 0:28–0:42 |
| F7 | Simulation engine: 36 monthly steps, bad / likely / good runs, milestones, setbacks from the fixed library, sensitivity, sourced ZA defaults, unit tests | Sibusiso | Lethabo | **Core** | 2–3 | T, I | — | 0:28–0:42; live edit 2:00–2:20 |
| F8 | Assumptions panel: IDs, values, ranges, source labels (you / default / template / AI-suggested), edit and re-run | Sibusiso | Lethabo | **Core** | 3 | T, D | — | 0:42–0:52; live edit |
| F9 | Avatar per path: Muse Image base portrait, one edit per path, cached, initials badge fallback, labelled AI-generated | Lethabo | Sibusiso (path cards) | Must (extras are cut 3) | 2–3 | M, D | **Best Creative Build** | 0:28–0:42 |
| F10 | Future-self agents: one per path, context pack, own memory, tools (`get_figure`, `remember`), streamed replies | Lethabo (agents) | Sibusiso (chat UI, `/api/chat` route, SSE) | **Core** | 2–4 | I, M, T, D | **Best Agentic Use-Case** | 0:52–1:25 |
| F11 | Figure guard, placeholder substitution and citation check: no model-written figure reaches the user | Lethabo | Sibusiso (figure keys from the engine) | **Core** | 2 (fixtures), 3 (live) | T, M | Best Agentic Use-Case | Trace drawer beat |
| F12 | Traceability: "Based on" chips, trace drawer, per-turn projection version, trace export | Lethabo (trace data) | Sibusiso (drawer UI) | Must | 4, 8 | T, D | — | 0:52–1:10 |
| F13 | Path switching and "Ask this on another path" | Sibusiso (UI) | Lethabo (carries the question; each agent still sees only its own path) | **Core** (switching); "Ask this on another path" proposed for never-cut (REVIEW L4) | 4 | D, I | — | 1:10–1:25 |
| F14 | Compare view: savings at 12 and 36 months, worst month, milestones, setback exposure, comfort, pinned quotes | Sibusiso | Lethabo | Must (cut 4: plain table) | 5 | D | — | 1:25–1:38 |
| F15 | Comfort check: 1–5 per path, "What is still bothering you?", trend | Sibusiso | Lethabo | Must | 4–5 | I, D | — | 1:38–1:52 |
| F16 | Decision summary: choice or "Not ready yet", reasons, assumptions, the setback to watch, disclaimer, browser print | Sibusiso (screen) | Lethabo (summary writer, figure substitution) | **Core** (basic summary) | 4 | I, D | — | 1:38–1:52 |
| F17 | Delete everything and export as JSON | Lethabo (verifies storage cleared, requests cancelled) | Sibusiso (button, IndexedDB store) | Must | 8 | I, T | — | Optional live delete |
| F18 | Safety layer: crisis phrase list plus model flag, support card (hard-coded helplines), banned certainty phrases, refusal of investment advice | Lethabo (detection, checks, tests) | Sibusiso (support card and notice UI) | Core (the notice); Must (the rest) | 5–8 | I | — | 2:20–2:35 |
| F19 | Model-API client: timeouts, retries with backoff, Zod validation and repair retry, trace entries, failover chain, `-contributor` guard | Lethabo | Sibusiso | Must | 2 | T | — | — |
| F20 | Fixture (demo) mode and the seeded Naledi session | Lethabo | Sibusiso | Must | 6 | D | — | DEMO.md §6 backup levels 1–2 |
| F21 | Abuse and rate guard that cannot block judges | Lethabo | Sibusiso | Must (light) | 5 | T | — | — |
| F22 | Decision types 2 and 3 as working templates | Sibusiso | Lethabo | Proposed stretch | — | I | — | Not in the demo |
| F23 | Model-collected open-questions list | Lethabo | Sibusiso | Proposed stretch | — | I | — | Not in the demo |
| F24 | PDF export (browser print stays in F16) | Sibusiso | — | Proposed stretch | — | — | — | — |

### Stretch (SCOPE.md §4 order)

| ID | Feature | Lead | Rubric | Bonus prize | Note |
|---|---|---|---|---|---|
| F25 | "Ask every path": one question, all avatars answer side by side | Sibusiso | D | Best Agentic Use-Case | The 30-second hook fakes this in the editor until it exists |
| F26 | What-if from chat: `what_if` tool proposes an assumption change; the user confirms | Lethabo | M, T | Best Agentic Use-Case | Tools never change assumptions without a UI confirmation |
| F27 | Spoken avatar replies with the browser's speech | Sibusiso | D | — | First to go (cut 1); Meta has no text-to-speech |
| F28 | Resume a session later with memory | Lethabo | M | — | Our own memory store; Active Memory is not exposed to developers |
| F29 | Monte Carlo ranges (true P10 / P50 / P90 fan chart) | Sibusiso | T | — | Data model already has the slots |
| F30 | Typed intake in a second South African language | Lethabo | I | — | Voice Transcribe has no isiZulu or Afrikaans |
| F31 | Open-weights path: one bounded job (for example one path's future-self chat) on Muse Spark Open via Baseten or Muse Glimmer on Modal | Lethabo | M | **Best Build on Meta Open Weights** | Not before day 6; decide together (REVIEW.md §7, decision 4) |
| F32 | Muse Wonder behind a flag | Lethabo | M | Best Creative Build (Wonder also qualifies) | Only if testing shows it adds value; it is Preview |

## 2. Deliverables that are not app features

| ID | Deliverable | Lead | Support | When | Counts for |
|---|---|---|---|---|---|
| D1 | Three-minute submission video | Both (who presents is decided on day 6) | — | Day 9 | Demo; required to submit |
| D2 | 2-minute cut-down and 30-second hook | Both | — | Day 9 | Most Viral Project; Community Vote |
| D3 | X post with the demo video, URL submitted on the platform | Sibusiso posts | Lethabo reposts | As soon as the video is final (timing question at the end of [SUBMISSION.md](SUBMISSION.md) §8) | Most Viral Project |
| D4 | Gallery thumbnail and two-sentence blurb | Lethabo | Sibusiso | Day 9 | Community Vote |
| D5 | README (set-up, architecture, Meta models used, what was built during the event) and technical write-up | Sibusiso | Lethabo | Day 9 | Technical Depth; new-work rule |
| D6 | Security and data notes for the README | Lethabo | Sibusiso | Day 9 | Technical Depth; trust |
| D7 | [BUILD_LOG.md](BUILD_LOG.md), one entry per day | Both | — | Daily | New-work rule (judges can tell what we built) |
| D8 | The submission itself | Sibusiso (Representative, proposal) | Lethabo verifies | Day 10 | Required |

## 3. Rubric fit at a glance

| Criterion | Features that carry it | Weakest spot today |
|---|---|---|
| **Impact** | F1, F2, F7, F10, F15, F16, F18; Naledi's story | No real tester yet: recruit 3 people outside the team (REVIEW M5) |
| **Use of Meta AI Tooling** | F2, F3, F6, F9, F10, F11, F19; F31 and F32 if built | Every model must visibly do a job in the video; Spark alone would look like a basic integration |
| **Technical Depth and Execution** | F4, F7, F8, F11, F12, F19, F21 | The figure guard is the hardest part and must start on day 2 against fixtures (REVIEW H2) |
| **Demo** | F8, F10, F13, F14, F15, F20; D1 | Live URL must hold up for judges 5–8 Nov with credits in reserve (REVIEW M3) |

## 4. Bonus prizes (USD 50K in total)

From the kickoff slides. More detail and a recommendation for each: [RESEARCH.md](RESEARCH.md) §6.

| Prize | What it rewards | Our features | Extra work | Flag needed? |
|---|---|---|---|---|
| Most Viral Project, 20K | Most likes, reposts and comments on the X post of the demo, counted to 8 Nov 11:59 PM ET (9 Nov 06:59 SAST) | D2, D3 | A good native clip and a short thread; reply to comments | Submit the X post link on the platform |
| Best Build on Meta Open Weights, 10K | Best project on Muse Glimmer or Muse Spark Open, on own hardware or partner inference; the infra partner verifies it | F31 only | Real: a second provider, credits, verification | Yes, in round one |
| Community Vote, 10K | Most votes in the public gallery, one per verified account; announced 16 Nov | D2, D4 | Share the gallery link when voting opens | — |
| Best Agentic Use-Case, 5K | Agents that complete tasks, make decisions or run multi-step workflows; scored on autonomy, effectiveness, practical usefulness | F6, F10, F11, F19; F25, F26 if built | None; make the video show the agent loop | Unknown: ask how bonus prizes are flagged |
| Best Creative Build, 5K | Most original creative project with Muse Image or Muse Wonder; scored on originality, execution, use of the model | F9; F32 if built | None; show the base portrait plus per-path edits | Yes, in round one |

## 5. Board labels

Each feature becomes one or more issues with one owner. Labels: `frontend`, `backend`, `simulation`, `ai`, `avatars`, `integration`, `security`, `demo`, `docs`, `bug`, `cut-candidate`. Put the feature ID in the issue title (for example "F11 figure guard: sentence-by-sentence check") so BUILD_LOG.md and PRs can point back here.
