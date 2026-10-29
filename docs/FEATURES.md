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
| F13 | Path switching and "Ask this on another path" | Sibusiso (UI) | Lethabo (carries the question; each agent still sees only its own path) | **Core** (switching and "Ask this on another path", PLAN.md §5) | 4 | D, I | — | 1:10–1:25 |
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

## 6. Meta model and user value per feature

The headline is the simulation engine (F7) and the conversation with each future self (F10), with the avatars (F9) as its face. The compare view (F14) supports them and is never the headline: the launch slides list "dashboards as the main feature" and Streamlit apps as anti-projects.

| ID | User value | Meta model / tool | Demo-critical |
|---|---|---|---|
| F1 | Trust before typing | None | Yes (disclaimer on every screen) |
| F2 | No long form | `muse-spark-1.3`, structured output | Yes |
| F3 | Speak naturally | `muse-voice-transcribe-1.0` | Yes (typed fallback) |
| F4 | Mistakes questioned, never silently fixed | None (code) | Yes |
| F5 | Sees what Parallax assumed | None | No |
| F6 | Real options to explore | `muse-spark-1.3`, structured output, tool | Yes |
| F7 | Figures computed and repeatable | None (code) | Yes |
| F8 | Can challenge any number | None (code) | Yes (live edit) |
| F9 | Meets a recognisable future self | `muse-image-1.0`; cues from `muse-spark-1.3` | Yes |
| F10 | Asks what matters to them | `muse-spark-1.3`, tools | Yes |
| F11 | No invented figures | None (code) | Yes |
| F12 | Every answer traceable | None (code) | Yes |
| F13 | Same question, another future | `muse-spark-1.3` | Yes (key moment) |
| F14 | Quick cross-check | None (code) | Yes (secondary) |
| F15 | Sees progress toward a decision | None | Yes |
| F16 | Leaves with a plan | `muse-spark-1.3`, structured output | Yes |
| F17 | Owns their data | None | Optional (live delete) |
| F18 | Safe in hard moments | Phrase list plus `muse-spark-1.3` flag | Yes (crypto refusal) |
| F19 | Works reliably | Meta Model API, all models | No |
| F20 | Demo survives an outage | None | Yes (insurance) |
| F21 | Credits last through judging | None | No |
| F22–F30 | See §1 | `muse-spark-1.3` where a model is used; F27 browser `SpeechSynthesis` (no Meta TTS) | No |
| F31 | Same experience on an open model | Muse Spark Open (Baseten) or Muse Glimmer (Modal) | No |
| F32 | Richer narration | `muse-wonder-1.0` (Preview) | No |

## 7. Acceptance criteria for Core and Must features

Agents are in [AGENTS_AND_APIS.md](AGENTS_AND_APIS.md); Naledi is the demo persona ([DEMO.md](DEMO.md) §1).

**F1 Start and consent.** *As a first-time visitor, I want to know what happens to my data before I type.*
- States: reflection aid, not financial advice; data stays in this browser; Meta's API processes it outside South Africa; how to delete.
- Intake stays locked until the person confirms they are 18 or older. No account, email or name asked.
- Depends on: F17; Meta's retention terms (unknown, REVIEW M8).

**F2 Text intake.** *As Naledi, I want to say it my way and check what Parallax heard.*
- Fills SCOPE §3's required fields or marks them missing; at most three follow-ups, one at a time; "about 40k" becomes a range chip; "don't know" becomes a labelled, wider default.
- A field is filled only if its extracted quote appears in the person's text (code check), so hidden instructions change nothing.
- Faulty input: health, legal or relationship decisions get "out of scope", no simulation; loan or move-city decisions get "not supported yet" while F22 is stretch; if the model fails, an empty form keeps the text.
- Depends on: intake agent, F4, Zod schemas.

**F3 Voice intake.** *As Naledi, I want to speak and fix any mishearing first.*
- Push-to-talk up to 60 s; the browser encodes 16 kHz mono PCM16 WAV; the transcript is editable before anything is extracted.
- Faulty input: refused mic, silence, a clip over 60 s or a failed transcription each give a clear message and leave typing open. No audio stored by us.
- Tested on three or more South African English accents by day 5 (REVIEW M6). Depends on: F2.

**F4 Faulty-input handling.** *I want mistakes questioned, not silently fixed.*
- Checks run in code before any model call: letters, negatives and blanks rejected inline; out-of-band values confirmed ("195000" → "Did you mean R19,500?").
- Contradictions (expenses five times income, age under 18) are asked once and never changed without the person.
- SCOPE §5's 20+ bad-input script runs as an automated test and passes. Depends on: sourced bands in `defaults/za.json`.

**F5 Profile card.** *I want to see what Parallax knows and assumed about me.*
- Facts, assumed defaults (marked *assumed*) and priorities; editable at any time; every path and avatar reads from it.
- An edit re-runs affected paths; invalid values are rejected inline. Depends on: F2.

**F6 Path proposal.** *As Naledi, I want 2–3 genuinely different options I can change.*
- Decision 1 follows A Stay and grow, B Go full-time, C Qualify up; every assumption has an ID, unit, low ≤ base ≤ high and a source (you / default / template / AI-suggested), enforced in code.
- Rename, change key choices (resign month, loan amount), delete down to two paths. No bank, lender or product named.
- If the model fails, template paths load with a banner. Depends on: F2, F7.

**F7 Simulation engine.** *I want every figure computed from assumptions I can see.*
- 36 monthly steps; three deterministic runs labelled bad case / likely / good case (never "percentiles"); same inputs, same figures.
- Milestones, runway, the 2–3 biggest drivers; 1–2 setbacks per path from the fixed library; the timeline shows "One possible future, not a prediction."
- A non-negotiable payment (Naledi's R3,000 to her mother) is never cut without consent; shortfall rule (REVIEW M1), tax set-aside (M2) and rounding (L2) still to decide.
- Vitest: zero income, zero savings, debt above savings, a shortfall month, the final month. All paths re-run in the browser in well under a second.

**F8 Assumptions panel.** *I want to challenge any number and see what changes.*
- An edit re-runs in the browser and redraws in under a second, with no model call; low above high, impossible negatives or text are rejected inline.
- Each chat turn stores its projection version; older answers are marked after an edit. Depends on: F6, F7.

**F9 Avatar per path.** *I want to meet a recognisable future me on each path.*
- Look attributes from fixed options (or skip); no photo upload; base portrait, then one edit per path; cached; illustrated, badged "AI-generated".
- Failure: policy block, server error or 45 s timeout → one simpler retry → initials badge; the flow carries on.
- Face consistency tested on day 3 (REVIEW M7). Depends on: persona builder, F7.

**F10 Future-self agents.** *I want specific, honest answers from each future.*
- Streams in the first person; time to first sentence logged from day 3 (timeout 20 s). Knows only its own path; speaks conditionally, names a downside; never instructs, chooses or names products.
- "Just tell me what to do" plays back priorities and trade-offs; "Should I put my savings in crypto?" is declined. `remember` notes are visible and deletable; special-category details are not stored.
- The 30-turn drift script passes on every path; on failure the typed message is kept. Depends on: F7, F9, F11, F18.

**F11 Figure guard and citation check.** *I want no invented figure to reach me.*
- Per sentence: amounts, percentages and numbers of 1,000 or more (not years) absent from the figures table or the person's inputs become "(see chart)" and are logged; unknown `A…`/`E…` IDs are dropped; banned certainty phrases: zero in 50 replies.
- Unit tests with an invented R25,000 and a fake `A99` catch both. Fails closed if the guard itself errors. Depends on: F7 figure keys.

**F12 Traceability.** *As Naledi or a judge, I want to see where answers come from.*
- "Based on" chips open the assumption or event; the trace drawer shows model, latency, tokens, cost, checks and fallback per step, and exports as JSON. Depends on: F11, F19.

**F13 Switching and "Ask this on another path".** *I want the same question answered by another future.*
- Tabs keep history, scroll and drafts. The re-asked path answers from its own context only (test: no figures or IDs from the first path leak).
- A path with a failed portrait still chats. Depends on: F10.

**F14 Compare view.** *I want a quick check, then back to talking.*
- Savings at 12 and 36 months (ranges), worst month, milestones, setback exposure, comfort, pinned quotes; every figure from the engine.
- Opened from chat; never the landing screen or the video's opening; readable at 1080p and phone width. Depends on: F7, F15.

**F15 Comfort check.** *I want to notice when I am closer to deciding.*
- 1–5 per path plus "What is still bothering you?" after each chat (dismissible) and on demand; trend shown.
- "I've decided: path X" and "Not ready yet" both lead to F16. Depends on: F10.

**F16 Decision summary.** *I want to leave with what I decided and why.*
- Key ranges, chosen path or "Not ready yet", reasons in the person's words, setback to watch, their open questions, real-life checks, disclaimer.
- Code checks it never names a choice the person did not make. Browser print only (F24 is stretch); a code-built fallback if the model fails. Depends on: F15, F11.

**F17 Delete everything and export.** *I want my data to stay mine.*
- IndexedDB only; "Delete everything" clears it and cancels in-flight requests (checked in browser storage tools); JSON export of the session.

**F18 Safety layer.** *In a hard moment, I want role-play to stop and help to appear.*
- Crisis test phrases show the support card (numbers hard-coded from RISKS §2, re-checked day 9), pause role-play and log only the event type; resume only by choice.
- Medical questions redirected, no diagnosis. If the model flag fails, the phrase list still works.

**F19 Model-API client.** *As a judge, I want it to work when an API does not.*
- Timeouts, bounded retries, failover `muse-spark-1.3` → `muse-spark-1.2` → fixture (ARCHITECTURE §12); a 402 or 403 switches to fixture mode with a banner and engine figures still show.
- No key in the built bundle; production refuses `-contributor` IDs; logs hold IDs and metrics only.

**F20 Fixture mode and seeded session.** The seeded Naledi session and offline mock mode each start with one command; a dropped network keeps every input.

**F21 Abuse and rate guard.** No passcode on the submitted URL; generous limits; a daily spend ceiling switches to fixture mode instead of erroring; a fresh session always works for a judge.

## 8. Not building

| Not building | Why |
|---|---|
| A dashboard as the main feature | Anti-project (launch slides); the compare view stays secondary |
| A Streamlit app | Anti-project (launch slides); we use React and Vite on Vercel |
| Medical or mental-health advice | Anti-project; distress gets a support card, never counselling |
| Basic RAG or document Q&A | Anti-project; no uploads or retrieval; figures come from the engine |
| Photo upload or image analysis | Anti-project ("simple image analysers"); likeness risk (RISKS L4) |
| Tutoring, CV screening, nutrition, sports, personality profiling | Anti-projects; Qualify up is a money path, skills are typed facts, the profile is money and priorities (RISKS P7) |
| Political or war content | Anti-project; none in personas, prompts or the demo |
| Financial advice; named products or lenders | Reflection aid, not advice (FAIS; RISKS P1) |
| Bank, credit bureau or payroll links; a tax engine | Out of scope (SCOPE §4) |
| Accounts, a database, sharing, native apps | Browser-only sessions are simpler and safer (RISKS §3) |
| Meta TTS, talking video, lip-sync, voice cloning | Meta has no TTS; deepfake risk (RISKS L5) |
| Active Memory claims; realtime transcription | Active Memory is not exposed (CONTEXT §2.1); realtime needs the key in a WebSocket frame |
| Training on user data; `-contributor` models with user data | Privacy (RISKS L3) |
| Decisions beyond career and money; a non-English MVP | Out of scope (SCOPE §4) |
