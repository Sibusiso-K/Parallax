# Plan: who does what, day by day

Draft of 20 Oct 2026. Times are SAST. Facts come from [CONTEXT.md](CONTEXT.md); **unknown** means not published yet.

## 1. Team split

| Area | Owner | Back-up |
|---|---|---|
| Back end (Node/TypeScript API on Vercel) | Sibusiso | Lethabo |
| Simulation engine (money computed in code, assumptions, uncertainty) | Sibusiso | Lethabo |
| Model orchestration (Muse Spark/Wonder, future-self personas) and memory | Sibusiso | Lethabo |
| Front end and UX (React + TypeScript) | Lethabo *(proposal)* | Sibusiso |
| Avatars (Muse Image) and voice input (Voice Transcribe) | Lethabo *(proposal)* | Sibusiso |
| Testing: personas, faulty-input test list, bug triage | Lethabo *(proposal)* | Sibusiso |
| Demo video and pitch | Lethabo *(proposal)* | Sibusiso |
| README and technical write-up | Sibusiso | Lethabo |
| **Final submission** | **Sibusiso (single owner)** | Lethabo |

> **PROPOSAL, for Lethabo to change.** Lethabo's skills are unknown. This default keeps us in separate parts of the code (API vs UI), so fewer merge conflicts. If Lethabo prefers back-end or AI work, we swap, keeping one owner per area.

**Shared:** reading the Official Rules, reviewing each other's PRs, the daily sync, scope-cut calls on days 4 and 6, watching credit spend, running the full flow before each checkpoint.

## 2. Before the hackathon (Tue 20 – Sun 25 Oct)

> **Rule uncertainty.** The Official Rules are not out yet and may forbid product code before kickoff (26 Oct, 12:00 ET = 18:00 SAST). Until we have read them we write **no product code**: no app scaffold, no engine, no prompts in the repo. Docs, sketches and accounts are safe. If the rules allow more, we re-plan; if they are stricter, we follow them.

| Task | Owner | Done when |
|---|---|---|
| Read the Official Rules the day they appear: pre-existing code, submission format (video? repo? hosted demo?), licences | Both; Sibusiso updates CONTEXT.md | Notes merged, plan adjusted |
| Confirm both registrations are on the Startup track | Both | Confirmed in team chat |
| Accounts: Discord, Meta Model API, GitHub repo access, Vercel | Each their own | Both can log in; keys never in chat or the repo |
| Credits: do the reported USD 150 Meta credits and the Baseten, Modal and Fireworks credits arrive, and when? | Sibusiso | Amounts and expiry dates noted |
| Declare availability and other builds (SONAR rule) for 26 Oct – 4 Nov | Both | Shared in team chat |
| Design sketches: intake, paths, future-self chat, compare, summary | Lethabo *(proposal)* | Five rough screens shared |
| Two or three South African career-and-money test personas, plain text | Both | Ready for testing from day 2 |
| Prompt experiments in a scratch area, **only if the rules allow it and API access exists before kickoff** (unknown) | Sibusiso | Findings noted; nothing enters the product unless allowed |
| Repo hygiene: labels, issue templates, project board | Sibusiso | Board ready for day-1 issues |

## 3. Day-by-day plan (26 Oct – 4 Nov)

Weekdays compete with work and study; the weekend of 31 Oct – 1 Nov is our biggest block. Milestones in bold.

| Day | Date | Goals | Sibusiso | Lethabo *(proposal)* | Definition of done |
|---|---|---|---|---|---|
| 1 | Mon 26 Oct, from 18:00 | Kickoff, keys, scaffold | Watch kickoff; first Meta Model API call works; scaffold Node/TS API; deploy to Vercel | Watch kickoff; scaffold React/TS app; turn SCOPE.md into board issues | Deployed URL returns a model reply; board filled for days 2–4 |
| 2 | Tue 27 Oct | **Thin end-to-end skeleton** | Intake endpoint; simulation stub computes money figures in code for two paths; stub chat endpoint | Intake form → paths → chat box → summary, wired to the API | One persona passes through every step on the deployed URL; content may be stubbed |
| 3 | Wed 28 Oct | Real simulation and chat | Simulation v1 with assumptions and low/likely/high ranges; future-self persona from its path; chat with session memory | Paths view shows assumptions and uncertainty; chat UI; first Muse Image avatar | One future self answers consistently with its path's numbers |
| 4 | Thu 29 Oct | **Ugly-but-working full flow**; checkpoint 1 | Memory per path; path switching; decision summary; every model call logged | Avatar per path; path switcher; summary screen | Full flow works for one persona; scope-cut review held |
| 5 | Fri 30 Oct | Breadth and quality | All test personas pass; input validation; prompt tuning; measure cost and time per run | Voice input; compare view; design pass | All personas work; cost and time targets set |
| 6 | Sat 31 Oct | **Demo-ready**; checkpoint 2; feature freeze tonight | Fix demo-blocking bugs; set up the DEMO.md persona | Polish demo path; dry-run DEMO.md; rough recording | DEMO.md runs twice in a row on the deployed URL, no fixes between |
| 7 | Sun 1 Nov | Hardening: faulty inputs, edge cases | Missing, absurd and contradictory inputs; model errors, timeouts, rate limits; fallbacks | Write and run the faulty-input test list; phone widths | Test list in repo; every P1 bug fixed or listed as a known limitation |
| 8 | Mon 2 Nov | Hardening: traceability, performance, cost | Every figure traceable to its inputs and formula; caching; latency; spend check | Loading and error states; "not financial advice" notice; data controls | Trace visible in UI; time and spend within targets |
| 9 | Tue 3 Nov | Submission materials | README (set-up, architecture, Meta models used); technical write-up | Demo video; screenshots; pitch | All three reviewed by the other person; submission fields drafted |
| 10 | Wed 4 Nov | Final checks; **SUBMIT by 22:00 SAST** | Code freeze 16:00; final deploy and tag; smoke test; secrets check | Upload video; check every link in a private window | Submitted (aim 20:00, latest 22:00); confirmation saved |

The official deadline (5 Nov 04:00 SAST) is for disasters only; we never plan on it.

## 4. Rituals

- **Daily sync, 15 minutes, 08:30 SAST** on weekdays (before work or class), 10:00 on the weekend: what I finished, what I am doing today, what blocks me, credits spent so far. Lethabo may move the time.
- **Checkpoints:** 30 minutes on the evenings of day 4 and day 6 to apply the scope-cut rules.
- **Task board:** GitHub Projects, columns Backlog, Today, In progress, In review, Done. Every task is an issue with one owner and a label (`frontend`, `backend`, `simulation`, `ai`, `demo`, `bug`, `cut-candidate`). Not on the board means nobody is doing it.
- **Branches and PRs:** `main` is always deployable and is what Vercel serves. Work on `feat/…`, `fix/…` or `docs/…` branches. Small PRs: one concern, roughly under 300 changed lines. The other person reviews, ideally within four waking hours, on the Vercel preview link. Squash-merge. Keys live in Vercel environment variables, never in the repo. Days 9–10: fixes only, agreed in chat first.
- **Meta workshops and Discord office hours** (27 Oct – 4 Nov; schedule **unknown**, likely SAST evenings). Sibusiso: Model API, Muse Spark/Wonder, memory. Lethabo: Muse Image, Voice Transcribe, demo or pitch sessions. Fireworks workshop: whoever is free. The attendee posts three bullet points in team chat. Ask rules and API-limit questions early, not on day 9.

## 5. Scope-cut rules

**Never cut:** money figures computed in code with assumptions and uncertainty shown; open-ended conversation with each future self; switching between paths; a basic decision summary; handling of faulty inputs; the "not financial advice" notice. These are the product and what judges look at.

**Day 4 checkpoint.** If the full flow does not work end to end, cut in this order:

1. Any voice output (Meta has no text-to-speech; voice output is a stretch goal anyway).
2. The third path: simulate two paths. *Demo fallback:* DEMO.md drops Path C (Qualify up); the key chat moment already uses only A and B, and the compare view shows two columns.
3. Avatar extras: one image per path, generated once and cached, with a neutral placeholder if generation fails.
4. Compare view: replace with a plain side-by-side table.

**Day 6 checkpoint.** If not demo-ready, also cut, in this order:

5. Voice input: text only. *Demo fallback:* Naledi types her intake in DEMO.md's 0:10 scene; the range chip ("you said 'about'") is the point of that scene and still works. The pitch then names Voice Transcribe as next, not as shown.
6. Memory beyond the current session (a stretch goal in SCOPE.md, so normally never built).
7. Any feature the DEMO.md script does not use.
8. Visual polish beyond readable and consistent.

After day 6 nothing new goes in, unless both agree at the sync.

## 6. Risks to the schedule

| Risk | Response |
|---|---|
| Official Rules unknown; may forbid code before kickoff | No product code before 26 Oct 18:00; re-plan the day the rules appear. |
| API access may only open at kickoff (unknown) | Day 1 evening is for keys; UI work runs against a mock model reply so it never waits. |
| Kickoff time unclear (18:00 or 19:00 SAST) | Confirm on the day; nothing depends on the exact hour. |
| Submission requirements unknown | Day 9 assumes video, repo, hosted demo and write-up; adjust when the rules are out. |
| Credits run short (USD 150 each is reported, not confirmed) | Log spend daily; cache simulation results; cheaper models or sponsor credits for development. |
| Other commitments on weekdays | Availability declared before 26 Oct; heavy work on the weekend; days 7–8 double as buffer. |
| SONAR rule: no more than two overlapping builds | Check before 26 Oct; if Parallax would be a third, pause another build. |
| One of us ill or offline (including power or internet cuts) | Small commits pushed daily; both can deploy; every area has a back-up. |
| Model features differ from Meta's posts (already true: Muse Wonder's Active Memory is not in the developer docs, Wonder is Preview, and there is no Meta text-to-speech; CONTEXT.md §2.1) | We build our own memory store and use Spark 1.3; test every model on day 1; fall back as ARCHITECTURE.md §12 sets out. Fireworks' serverless Muse Spark Open ends 29 Oct (day 4), so decide by day 3 whether an on-demand fallback is worth it. |
| Last-day upload or form problems | Aim for 20:00, never later than 22:00 SAST. |

## 7. Open questions for Lethabo

1. What are your strongest skills, and what would you like to own or learn? Change the split in section 1 freely.
2. How many hours can you give each day from 26 Oct to 4 Nov, especially weekdays?
3. Are you on SAST, and does 08:30 suit the daily sync?
4. Is your registration on the Startup track, and have credits or API access reached you?
5. Are you in another build during this window (SONAR's two-build rule)?
6. Will you present in the demo video (on camera or voice-over), or should Sibusiso?
7. Your GitHub and Vercel usernames, for access?
8. Figma or paper for the design sketches?
