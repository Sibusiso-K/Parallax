# Features: owners, tiers, rubric fit and bonus prizes

Written 26 Oct 2026, after the kickoff slides and the role split in [ROLES.md](ROLES.md). **Updated Sun 1 Nov 2026 (day 7) for the founder direction** ([FOUNDERS.md](FOUNDERS.md)): the user stories and use cases are replaced, the rubric is weighted, and F22 (more decision types) is built. It adds no scope beyond [SCOPE.md](SCOPE.md); the cut order stays in [PLAN.md](PLAN.md) §5.

**Tiers**
- **Core:** on PLAN.md §5's never-cut list. If it breaks, fixing it beats everything else.
- **Must:** must ship, but has a place in the cut order.
- **Proposed stretch:** we decide together at a sync.
- **Stretch:** SCOPE.md §4 stretch list, in that order, only once the must-ship flow works on the hosted URL.

**Rubric columns** (Stage 2, 0–10 each, weighted, CONTEXT.md §5): **I** Impact (30%), **M** Use of Meta AI Tooling (25%), **T** Technical Depth and Execution (20%), **D** Demo (25%).

**Lead** makes sure it gets done and decides inside that area; **Support** reviews and helps. Either of us may work on anything (ROLES.md §3).

## 1. Product features

| ID | Feature | Lead | Support | Tier | Status (1 Nov) | Rubric | Bonus prize | Demo scene (DEMO.md) |
|---|---|---|---|---|---|---|---|---|
| F1 | Start and consent screen: what Parallax is, "a reflection aid, not financial advice", 18+, what we store, that Meta's API processes it, Delete everything | Sibusiso | Lethabo (privacy wording) | Core (the notice) | Built | I | — | On every screen; end card |
| F2 | Text intake: "Here is what I heard" form with the founder's quotes, one follow-up at a time, rough answers kept as ranges, kind of decision read in code | Sibusiso (screen, `/api/intake`) | Lethabo (intake agent, structured output) | Must | Built (model behind a switch) | I, M, T | — | 0:08–0:25 |
| F3 | Voice intake: push-to-talk, Muse Voice Transcribe, transcript confirmed before extraction | Lethabo | Sibusiso (mic UI, WAV encoder) | Must (cut 5) | Not started | M, D | — | 0:08–0:25 |
| F4 | Faulty-input handling: range chips, outlier confirmation (a misplaced zero), contradictions (direct costs above sales), scope judged on the decision, a 26-case script | Sibusiso | Lethabo (test list) | Core | Built | T, D | — | 2:00–2:15 |
| F5 | Profile card "Your business, today": facts, assumed defaults (marked), priorities; editable | Sibusiso | Lethabo | Must | Built | T | — | 0:25 |
| F6 | Path proposal: three paths per decision (contract, hire, prices) with assumption ranges and sources; template fallback; path-planner agent later | Lethabo (agent) | Sibusiso (templates, screen) | Must | Templates built; agent not started | M, T | Best Agentic Use-Case | 0:25–0:40 |
| F7 | Simulation engine: 36 monthly cash steps, bad / likely / good, cash timing, milestones, setback stress tests judged on the lowest cash point, drivers, unit and stress tests | Sibusiso | Lethabo | **Core** | Built (105 tests across the suite) | T, I | — | 0:25–0:40; 0:55–1:20 |
| F8 | Assumptions panel: IDs, values, ranges, source labels (you / default / template / AI-suggested), edit and re-run | Sibusiso | Lethabo | **Core** | Built | T, D | — | 1:35–1:50 (live edit) |
| F9 | Avatar per path: the founder at month 36, Muse Image base portrait, one edit per path, cached, initials fallback, labelled AI-generated | Lethabo | Sibusiso (cards) | Must | Not started | M, D | **Best Creative Build** | 0:25–0:40 |
| F10 | Future-founder agents: one per path, context pack, own memory, tools (`get_figure`, `remember`), streamed replies | Lethabo (agents) | Sibusiso (chat UI, `/api/chat`, SSE) | **Core** | Mock replies in the UI; agents not started | I, M, T, D | **Best Agentic Use-Case** | 0:40–1:20 |
| F11 | Figure guard, placeholder substitution and citation check: no model-written figure reaches the founder | Lethabo | Sibusiso (figure keys) | **Core** | Figure table built; guard not started | T, M | Best Agentic Use-Case | 2:15–2:25 |
| F12 | Traceability: "Based on" chips, trace drawer, per-turn projection version, trace export | Lethabo (trace data) | Sibusiso (drawer) | Must | Chips and drawer built (mock data) | T, D | — | 0:55–1:10 |
| F13 | Path switching and "Ask this on another path" | Sibusiso (UI) | Lethabo (each agent sees only its own path) | **Core** | Built (UI) | D, I | — | 1:05–1:20 |
| F14 | Compare view: cash at months 12 and 36, lowest cash, when cash runs out, the setback to watch, comfort, pinned quotes | Sibusiso | Lethabo | Must | Built (setback row to add) | D | — | 1:20–1:35 |
| F15 | Comfort check: 1–5 per path, "What is still bothering you?", trend | Sibusiso | Lethabo | Must | Built | I, D | — | 1:50–2:00 |
| F16 | Decision memo: choice or "Not ready yet", reasons, assumptions, the setback to watch, open questions, disclaimer, browser print | Sibusiso (screen) | Lethabo (memo writer, figure substitution) | **Core** (basic) | Basic summary built | I, D | — | 1:50–2:00 |
| F17 | Delete everything and export as JSON | Lethabo | Sibusiso | Must | Delete built; export not started | I, T | — | Optional live delete |
| F18 | Safety layer: crisis phrase list plus model flag, support card, banned certainty phrases, refusal of investment advice | Lethabo | Sibusiso (card UI) | Core (the notice); Must (the rest) | Investment-advice check built; rest not started | I | — | 2:25–2:35 |
| F19 | Model-API client: timeouts, retries, Zod validation and repair retry, trace entries, failover, `-contributor` guard | Lethabo | Sibusiso | Must | Built (PR #7) | T | — | — |
| F20 | Fixture (demo) mode and the seeded demo-founder session | Lethabo | Sibusiso | Must | Fixture intake built | D | — | DEMO.md §6 |
| F21 | Abuse and rate guard that cannot block judges | Lethabo | Sibusiso | Must (light) | Body-size limit built | T | — | — |
| F22 | More decision types: make a hire, raise prices | Sibusiso | Lethabo | ~~Proposed stretch~~ **Built 1 Nov** | Built with tests | I | — | Mentioned in the close |
| F23 | Model-collected open-questions list | Lethabo | Sibusiso | Proposed stretch | — | I | — | — |
| F24 | PDF export (browser print stays in F16) | Sibusiso | — | Proposed stretch | — | — | — | — |

### Stretch (SCOPE.md §4 order)

| ID | Feature | Lead | Rubric | Bonus prize | Note |
|---|---|---|---|---|---|
| F25 | "Ask every path": one question, all three founders answer side by side | Sibusiso | D | Best Agentic Use-Case | The 30-second hook builds this in the editor until it exists |
| F26 | What-if from chat: `what_if` tool proposes an assumption change ("What if they paid in 30 days?"); the founder confirms | Lethabo | M, T | Best Agentic Use-Case | Tools never change assumptions without a UI confirmation |
| F27 | Spoken replies with the browser's speech | Sibusiso | D | — | First to go; Meta has no text-to-speech |
| F28 | Resume a session later with memory | Lethabo | M | — | Our own memory store |
| F29 | Monte Carlo ranges | Sibusiso | T | — | Data model has the slots |
| F30 | Loans and investors as a fourth decision | Sibusiso | I | — | Needs repayment and dilution modelling, and care around advice |
| F31 | Open-weights path: one bounded job on Muse Spark Open (Baseten) or Muse Glimmer (Modal) | Lethabo | M | **Best Build on Meta Open Weights** | Only if F9 and F10 are live by Mon 2 Nov evening |
| F32 | Muse Wonder behind a flag | Lethabo | M | Best Creative Build (Wonder also qualifies) | Only if testing shows it adds value; it is Preview |

## 2. Deliverables that are not app features

| ID | Deliverable | Lead | Support | When | Counts for |
|---|---|---|---|---|---|
| D1 | Three-minute submission video (also what finalists are judged on) | Both | — | Tue 3 Nov | Demo; required |
| D2 | 2-minute cut-down and 30-second hook | Both | — | Tue 3 Nov | Most Viral Project; Community Vote |
| D3 | X post with the demo video, URL submitted on the platform | Sibusiso posts | Lethabo reposts | When the video is final | Most Viral Project |
| D4 | Gallery thumbnail and two-sentence blurb | Lethabo | Sibusiso | Tue 3 Nov | Community Vote |
| D5 | README (set-up, architecture, Meta models used, what was built during the event) and technical write-up | Sibusiso | Lethabo | Tue 3 Nov | Technical Depth; new-work rule |
| D6 | Security and data notes for the README | Lethabo | Sibusiso | Tue 3 Nov | Technical Depth; trust |
| D7 | [BUILD_LOG.md](BUILD_LOG.md), one entry per day (days 3 to 6 still to write) | Both | — | Daily | New-work rule |
| D8 | The submission itself, with both of us listed | Sibusiso (Representative) | Lethabo verifies | Wed 4 Nov | Required |
| D9 | One real founder's session and quote, with consent | Both | — | Tue 3 Nov | Impact |

## 3. Rubric fit at a glance

| Criterion (weight) | Features that carry it | Weakest spot today |
|---|---|---|
| **Impact (30%)** | F1, F2, F7, F10, F15, F16, F22; the founder story and the research (FOUNDERS.md) | No founder outside the team has used it yet (D9) |
| **Use of Meta AI Tooling (25%)** | F2, F3, F6, F9, F10, F11, F19; F31 and F32 if built | The agents and avatars are not live; Spark intake alone would look basic |
| **Technical Depth and Execution (20%)** | F4, F7, F8, F11, F12, F19, F21 | The figure guard must work live, not only in the plan |
| **Demo (25%)** | F8, F10, F13, F14, F15, F20; D1 | The late-payment moment needs F10 to feel alive |

## 4. Bonus prizes (USD 50K in total)

From the guide. Fit and recommendation for each: [RESEARCH.md](RESEARCH.md) §6.

| Prize | What it rewards | Our features | Extra work | Flag needed? |
|---|---|---|---|---|
| Most Viral Project, 20K | Highest engagement on X after the event, up to 8 Nov EOD | D2, D3 | A native clip, a thread, replies | Submit the X post link on the form |
| Best Build on Meta Open Weights, 10K | Muse Glimmer or Spark Open on own hardware or partner inference; partner verifies | F31 only | A second provider, credits, verification | Flagged by judges in round one |
| Community Vote, 10K | Most gallery votes, one per verified account | D2, D4 | Share the gallery link | — |
| Best Agentic Use-Case, 5K | Agents that complete meaningful tasks, make decisions or coordinate multi-step workflows | F2, F6, F10, F11, F19; F25, F26 if built | Show the agent loop | No opt-in field on the form |
| Best Creative Build, 5K | Most original creative project with Muse Image or Muse Wonder | F9; F32 if built | Show base portrait → per-path edits | Flagged by judges in round one |

## 5. Board labels

Each feature becomes one or more issues with one owner. Labels: `frontend`, `backend`, `simulation`, `ai`, `avatars`, `integration`, `security`, `demo`, `docs`, `bug`, `cut-candidate`. Put the feature ID in the issue title.

## 6. Meta model and founder value per feature

The headline is the conversation with each future founder (F10), with the avatars (F9) as its face and the engine (F7) as its truth. The compare view (F14) supports them and is never the headline: "dashboards as the main feature" is an anti-project (RESEARCH.md §5).

| ID | Founder value | Meta model / tool | Demo-critical |
|---|---|---|---|
| F1 | Trust before typing | None | Yes |
| F2 | No spreadsheet, no form | `muse-spark-1.3`, structured output | Yes |
| F3 | Speak naturally | `muse-voice-transcribe-1.0` | Yes (typed fallback) |
| F4 | Mistakes questioned, never silently fixed | None (code) | Yes |
| F5 | Sees what Parallax assumed | None | No |
| F6 | Real options to rehearse | `muse-spark-1.3`, structured output | Yes |
| F7 | Knows the month cash would run out | None (code) | Yes |
| F8 | Can challenge any number | None (code) | Yes (live edit) |
| F9 | Meets the founder they could become | `muse-image-1.0`; cues from `muse-spark-1.3` | Yes |
| F10 | Asks what matters to them | `muse-spark-1.3`, tools | Yes |
| F11 | No invented figures | None (code) | Yes |
| F12 | Every answer traceable | None (code) | Yes |
| F13 | Same question, another future | `muse-spark-1.3` | Yes (key moment) |
| F14 | Quick cross-check | None (code) | Yes (secondary) |
| F15 | Sees progress toward a decision | None | Yes |
| F16 | Leaves with a memo to share | `muse-spark-1.3`, structured output | Yes |
| F17 | Owns their data | None | Optional |
| F18 | Safe in hard moments | Phrase list plus `muse-spark-1.3` flag | Yes (investment refusal) |
| F19 | Works reliably | Meta Model API, all models | No |
| F20 | Demo survives an outage | None | Yes (insurance) |
| F21 | Credits last through judging | None | No |
| F22 | Their decision is covered | None (code) | Mentioned |

## 7. User stories and acceptance criteria (Core and Must)

Agents are in [AGENTS_AND_APIS.md](AGENTS_AND_APIS.md). The demo founder is fictional ([DEMO.md](DEMO.md) §1): a meal-prep and catering business in Johannesburg, three staff, R120,000 in the bank, offered a 12-month corporate lunch contract worth R60,000 a month that pays 60 days after each invoice.

**F1 Start and consent.** *As a founder trying Parallax for the first time, I want to know what happens to my business figures before I type them.*
- States: reflection aid, not financial advice; data stays in this browser; Meta's API processes it outside South Africa; how to delete.
- Intake stays locked until the founder confirms they are 18 or older. No account, email or name asked.

**F2 Text intake.** *As a founder, I want to describe my business and my decision the way I would to a cofounder, and check what Parallax heard.*
- Fills SCOPE §3's required fields or marks them missing; follow-ups one at a time; "R75k to R105k" becomes a range chip; "I don't know" becomes a labelled default.
- A field is kept only if its quote appears in the founder's text (code check), so hidden instructions change nothing. The kind of decision is read in code from the founder's words; if unclear, three buttons ask.
- Faulty input: health, legal, relationship or emigration decisions get "out of scope"; loans, investors, second sites and going full-time get "not supported yet"; scope is judged on the decision, not on every word of the story; if the model fails, an empty form keeps the text.

**F3 Voice intake.** *As a founder between deliveries, I want to speak my decision and fix any mishearing first.*
- Push-to-talk up to 60 s; 16 kHz mono PCM16 WAV; the transcript is editable before anything is extracted.
- A refused mic, silence, a clip over 60 s or a failed transcription each give a clear message and leave typing open. No audio stored by us.

**F4 Faulty-input handling.** *As a founder typing fast on a phone, I want my mistakes questioned, not silently fixed.*
- Checks run in code: a misplaced zero is confirmed ("Did you mean R900 000?"); direct costs above sales are asked once; nothing changes without the founder.
- The 26-case script in `shared/intake/checks.test.ts` passes.

**F5 Profile card.** *As a founder, I want to see what Parallax knows about my business and what it assumed.*
- Facts, assumed defaults (marked *assumed*) and priorities; editable; every path and avatar reads from it. An edit re-runs affected paths.

**F6 Path proposal.** *As a founder, I want three genuinely different ways to handle my decision, not three versions of yes.*
- The contract decision gives A Stay lean, B Take it as offered, C Take it on safer terms; the hire and price decisions give their three (SCOPE §2). Every assumption has an ID, low ≤ base ≤ high and a source, enforced in code. No bank, lender, product or supplier named.
- If the model fails, the template paths load with a banner.

**F7 Simulation engine.** *As a founder, I want to know the month my cash would run out on each path, computed from assumptions I can see.*
- 36 monthly steps; bad case / likely / good case (never "percentiles"); same inputs, same figures.
- A contract's income lands after its payment terms while its costs start at once. Sales are gross profit at today's margin.
- Milestones, runway, the 2–3 biggest drivers; 1–2 setbacks per path, judged on how far they push the lowest cash point. The timeline shows "One possible future, not a prediction."
- Tests cover a profitable contract that runs out of cash in month 4 when paid two months late, and the safer terms surviving the same shock.

**F8 Assumptions panel.** *As a founder, I want to change the payment terms or any cost and see what happens at once.*
- An edit re-runs in the browser and redraws in under a second, with no model call; impossible values are rejected inline.

**F9 Avatar per path.** *As a founder, I want to meet the version of me who chose each path.*
- Look attributes from fixed options (or skip); no photo upload; base portrait, then one edit per path (home kitchen, commercial kitchen, café for the demo); cached; illustrated, badged "AI-generated".
- Failure: one simpler retry, then the initials badge; the flow carries on.

**F10 Future-founder agents.** *As a founder, I want honest, specific answers from each future, in my words, about my business.*
- First person, 36 months on; knows only its own path; speaks conditionally; names a downside; never instructs, chooses or names products.
- "Just tell me what to do" plays back priorities and trade-offs; "Should I put the cash into crypto?" is declined.

**F11 Figure guard and citation check.** *As a founder, I want no invented number to reach me.*
- Per sentence: amounts and numbers of 1,000 or more absent from the path's figure table or the founder's inputs become "(see chart)" and are logged; unknown assumption IDs are dropped. Fails closed.

**F12 Traceability.** *As a founder or a judge, I want to see where every answer came from.*
- "Based on" chips open the assumption; the trace drawer shows model, latency, checks and fallback per step.

**F13 Switching and "Ask this on another path".** *As a founder, I want to ask the same question of the founder who took the safer terms.*
- Tabs keep history and drafts; the re-asked path answers from its own figures only.

**F14 Compare view.** *As a founder, I want a quick side-by-side check, then back to the conversation.*
- Every figure from the engine; never the landing screen or the video's opening.

**F15 Comfort check.** *As a founder, I want to notice when I am closer to deciding.*
- 1–5 per path and "What is still bothering you?"; "I've decided" and "Not ready yet" both lead to F16.

**F16 Decision memo.** *As a founder, I want a one-page memo I can show my cofounder, partner or funder.*
- Key ranges, chosen path or "Not ready yet", reasons in the founder's words, the setback to watch, open questions, disclaimer. Never names a choice the founder did not make.

**F17 Delete everything and export.** *As a founder, I want my business figures to stay mine.*
- Browser storage only; delete clears it and cancels in-flight requests; JSON export.

**F18 Safety layer.** *As a founder under pressure, I want help to appear if I am in a bad place, and no sales pitch ever.*
- Crisis phrases show the support card and pause role-play; investment questions are declined.

**F19 Model-API client.** *As a judge, I want it to work when an API does not.*
- Timeouts, bounded retries, failover to fixture mode with a banner; no key in the bundle; production refuses `-contributor` IDs.

**F20 Fixture mode and seeded session.** The seeded demo-founder session and offline mode each start with one command; a dropped network keeps every input.

**F21 Abuse and rate guard.** No passcode on the submitted URL; a spend ceiling switches to fixture mode instead of erroring.

## 8. Not building

| Not building | Why |
|---|---|
| A dashboard as the main feature | Anti-project; the conversation leads, charts support |
| A Streamlit app | Anti-project; React and Vite on Vercel |
| Medical or mental-health advice | Anti-project; distress gets a support card |
| Basic RAG or document Q&A | Anti-project; no uploads; figures come from the engine |
| Photo upload or image analysis | Anti-project; likeness risk |
| Hiring screens, CV ranking, staff scoring | Anti-project (job-application screeners); the hire template models cost and sales only |
| Personality profiling of the founder | Anti-project; the profile is the business's figures and priorities |
| Political or war content | Anti-project |
| Financial advice; named banks, lenders, products or suppliers | Reflection aid (RISKS P1) |
| Bank, accounting or payroll connections; a tax engine | Out of scope for the MVP (COMPETITORS.md §5 lists them as later partners) |
| Loans and investors, second sites, going full-time | Roadmap (FOUNDERS.md §3); "not supported yet" today |
| Accounts, a database, sharing, native apps | Browser-only sessions are simpler and safer |
| Meta TTS, talking video, lip-sync, voice cloning | Meta has no TTS; deepfake risk |
| Training on founder data; `-contributor` models with founder data | Privacy (RISKS L3) |
