# Plan: who does what, day by day

Draft of 20 Oct 2026, updated 26 Oct 2026 after the official Participant Guide. Times are SAST. Facts come from [CONTEXT.md](CONTEXT.md); **unknown** means not published yet.

> **What is new work and what is not.** All product code is written from kickoff, **26 Oct 2026, 12:00 ET (18:00 SAST)**. These planning docs (and the README) contain no product code; most were written before kickoff and are the only pre-existing material, and the rest were added on kickoff evening ([BUILD_LOG.md](BUILD_LOG.md)), so judges can tell them apart from what was built during the Hackathon. The rules make this a disqualification matter (RISKS.md H6).

## 1. Team split

> **Updated 26 Oct from Sibusiso.** Full detail, and how we hand work over, is in [ROLES.md](ROLES.md). We work fluidly: owners are the people who make sure a thing gets done, not the only people allowed to touch it.

| Area | Owner | Support |
|---|---|---|
| UI and UX (React + TypeScript): every screen, design, flow, accessibility | Sibusiso | Lethabo |
| Back end (Node/TypeScript API on Vercel) and the simulation engine (money computed in code, assumptions, uncertainty) | Sibusiso | Lethabo |
| Avatars (Muse Image): style, generation, consistency across paths | Lethabo | Sibusiso |
| API integrations (Meta Model API: Spark, Wonder, Image, Voice Transcribe; partner inference) | **Both** (Lethabo leads model-API client and agents; Sibusiso leads API routes the UI calls) | — |
| Feature integration: wiring features end to end, the future-self agents, the figure guard, traceability | Lethabo | Sibusiso |
| Security: keys and secrets, abuse and rate guard, prompt-injection and faulty-input tests, data deletion, public-repo hygiene | Lethabo | Sibusiso |
| Demo video and pitch | Both (decide on day 6) | — |
| README and technical write-up | Sibusiso | Lethabo |
| **Final submission (Representative)** | **Sibusiso (proposal)** | Lethabo |

**Shared:** re-reading the Participant Guide rules, reviewing each other's PRs, the daily sync, scope-cut calls on days 4 and 6, watching credit spend, running the full flow before each checkpoint, and keeping [BUILD_LOG.md](BUILD_LOG.md) up to date.

## 2. Before the hackathon (Tue 20 – Sun 25 Oct)

> **Resolved on 26 Oct.** The Participant Guide confirms the new-work-only rule: what is presented must be built during the event. We wrote **no product code** before kickoff (no app scaffold, no engine, no prompts in the repo); only docs, sketches and accounts. The table below is kept as the record of pre-kickoff work.

| Task | Owner | Done when |
|---|---|---|
| Read the Participant Guide (published 26 Oct): pre-existing code, submission format, licences | Both; Sibusiso updated CONTEXT.md §5 | Done 26 Oct |
| Confirm both registrations are on the Startup track | Both | Done 26 Oct: both on Startup |
| Accounts: Discord, Meta Model API, GitHub repo access, Vercel | Each their own | Both can log in; keys never in chat or the repo |
| Credits: USD 150 Meta credits are confirmed but each person claims their own (forms in Discord #resources from kickoff); Baseten, Modal and Fireworks credits: see the first-day checklist below | Each person | Amounts and expiry dates noted |
| Declare availability and other builds (SONAR rule) for 26 Oct – 4 Nov | Both | Shared in team chat |
| Design sketches: intake, paths, future-self chat, compare, summary | Sibusiso (UI and UX owner since 26 Oct; first proposed for Lethabo) | Five rough screens shared |
| Two or three South African career-and-money test personas, plain text | Both | Ready for testing from day 2 |
| Prompt experiments: **not done**; new-work-only means product prompts are written after kickoff | Sibusiso | n/a |
| Repo hygiene: labels, issue templates, project board | Sibusiso | Board ready for day-1 issues |

### First-day checklist (Mon 26 Oct, from 18:00 SAST)

- [ ] Watch the kickoff (18:00 SAST; the recording goes to #resources) and join the Discord: https://cv.inc/e/meta-ai-developer-hackathon/discord
- [ ] Introduce ourselves in **#intros**. (Track settled: both registered on Startup.)
- [ ] **Each** of us claims our own USD 150 Meta credits from the form in **#resources**, adds a credit card, and sets a Spend Limit notification on the Billing page. Nobody can claim for the other. Agree who holds the project API key ([ROLES.md](ROLES.md) §5).
- [ ] Request Baseten credits (USD 100 + 2M TPM; model `meta-models/muse-spark-open-1026`) and Modal credits (USD 100, first 1,000 participants), each as an individual, from the forms in #resources.
- [ ] Sibusiso turns on GitHub secret scanning and push protection for the public repo (AGENTS_AND_APIS.md §5).
- [ ] First [BUILD_LOG.md](BUILD_LOG.md) entry for the day.
- [x] **Repo made public** on 26 Oct (rules require it). History checked first: docs only, no secrets. From now on everything we push is public, so keys live only in env vars.
- [ ] Appoint the **Representative** who will enter the submission (proposal: Sibusiso) and note everyone to list.
- [ ] Day-1 smoke test of every model (ARCHITECTURE.md §15).

## 3. Day-by-day plan (26 Oct – 4 Nov)

Weekdays compete with work and study; the weekend of 31 Oct – 1 Nov is our biggest block. Milestones in bold.

| Day | Date | Goals | Sibusiso (UI, UX, back end, APIs) | Lethabo (avatars, APIs, integration, security) | Definition of done |
|---|---|---|---|---|---|
| 1 | Mon 26 Oct, from 18:00 (kickoff confirmed 18:00) | Kickoff, keys, scaffold, first-day checklist | Watch kickoff; scaffold React/TS app and Node/TS API; deploy to Vercel; turn FEATURES.md into board issues | Watch kickoff; claim credits; set up env vars and secrets (nothing in the repo); smoke-test every Meta model | Deployed URL returns a model reply; board filled for days 2–4; BUILD_LOG day 1 entry |
| 2 | Tue 27 Oct (18:00 Meta Workshop P1, Agents 101) | **Thin end-to-end skeleton** | Intake screen and endpoint; simulation stub computes money figures in code for two paths | Model-API client (retries, structured output, logging); stub future-self chat; first Muse Image avatar test; **figure guard against canned data** (REVIEW: build the hardest part early) | One persona passes through every step on the deployed URL; content may be stubbed |
| 3 | Wed 28 Oct (18:00 Meta Workshop P2, Verifiable Agents) | Real simulation and chat | Simulation v1 with assumptions and low/likely/high ranges; paths view; chat UI | Future-self agents grounded in their own timeline; avatar style locked; figure guard on live replies | One future self answers consistently with its path's numbers |
| 4 | Thu 29 Oct | **Ugly-but-working full flow**; checkpoint 1 | Path switcher and decision-summary screens; per-path memory store | Integrate intake → simulation → avatar → chat → switch → summary; every model call traced | Full flow works for one persona; scope-cut review held |
| 5 | Fri 30 Oct (18:00 Fireworks workshop) | Breadth and quality | Compare view (supporting, never the headline); design pass; input validation in UI | Voice input (Voice Transcribe); abuse and rate guard that cannot block judges; security review of keys | All test personas work; cost and time per run measured |
| 6 | Sat 31 Oct | **Demo-ready**; checkpoint 2; feature freeze tonight | Polish the demo path UI; fix demo-blocking bugs | Seed the DEMO.md persona; fix integration bugs; both dry-run DEMO.md | DEMO.md runs twice in a row on the deployed URL, no fixes between |
| 7 | Sun 1 Nov | Hardening: faulty inputs, edge cases | Missing, absurd and contradictory inputs in back end and UI; phone widths | Write and run the faulty-input and security test list (prompt injection, key exposure, oversize input); model errors, timeouts, fallbacks | Test list in repo; every P1 bug fixed or listed as a known limitation |
| 8 | Mon 2 Nov | Hardening: traceability, performance, cost | Loading and error states; "not financial advice" notice; latency and caching | Every figure traceable to inputs and formula in the UI; spend check; delete-my-data works | Trace visible in UI; time and spend within targets |
| 9 | Tue 3 Nov (last full day for submission questions) | Submission materials | README (set-up, architecture, Meta models used, what was built during the Hackathon); technical write-up | Security and data notes for the README; screenshots; X post drafted. **Both:** record the three-minute video and the 2-minute cut-down | All reviewed by the other person; submission fields drafted (SUBMISSION.md); open questions to organisers asked today |
| 10 | Wed 4 Nov | Final checks; **SUBMIT by 22:00 SAST** | Code freeze 16:00; final deploy and tag; smoke test; Representative submits | Secrets scan of the public repo; check every link in a logged-out browser; post on X | Submitted (aim 20:00, latest 22:00); confirmation saved; X link submitted |

The official deadline (4 Nov 21:00 ET = 5 Nov 04:00 SAST; late submissions are not considered) is for disasters only; we never plan on it. Judging runs Thu 5 - Sun 8 Nov (keep the app up, credits reserved, X post engagement counts to 8 Nov 11:59 PM ET = 9 Nov 06:59 SAST). **Closing ceremony and live final round: Mon 9 Nov, 12:00 ET = 19:00 SAST** (top 10 teams, 5 per track); community vote opens then and is announced 16 Nov on Discord.

### Submission checklist (the Representative submits; both verify)

Full detail, the form-field drafts and the day-10 run sheet: [SUBMISSION.md](SUBMISSION.md). Submit at https://cerebralvalley.ai/e/meta-ai-developer-hackathon/hackathon/submit.

- [ ] Repo is **public** and opens in a logged-out browser; README states what was built during the Hackathon; BUILD_LOG.md is up to date.
- [ ] **Three-minute** demo video link works without a login.
- [ ] Everyone who worked on it is listed; one Representative enters the project.
- [ ] Live product URL works for judges (no passcode that blocks them).
- [ ] X post published, demo video attached, URL submitted on the platform (Most Viral Project).
- [ ] Open-weights use (if any) flagged in the submission (Best Build on Open Weights).
- [ ] Each of us claimed our own credits before 4 Nov 21:00 ET.

## 4. Rituals

- **Daily sync, 15 minutes, 08:30 SAST** on weekdays (before work or class), 10:00 on the weekend: what I finished, what I am doing today, what blocks me, credits spent so far. Lethabo may move the time.
- **Checkpoints:** 30 minutes on the evenings of day 4 and day 6 to apply the scope-cut rules.
- **Task board:** GitHub Projects, columns Backlog, Today, In progress, In review, Done. Every task is an issue with one owner, a feature ID from [FEATURES.md](FEATURES.md) in its title, and a label (`frontend`, `backend`, `simulation`, `ai`, `avatars`, `integration`, `security`, `demo`, `docs`, `bug`, `cut-candidate`). Not on the board means nobody is doing it.
- **Handovers:** stopping mid-task or going offline means pushing the branch with a handover note in a draft PR ([ROLES.md](ROLES.md) §3).
- **Branches and PRs:** `main` is always deployable and is what Vercel serves. Work on `feat/…`, `fix/…` or `docs/…` branches. Small PRs: one concern, roughly under 300 changed lines. The other person reviews, ideally within four waking hours, on the Vercel preview link. Squash-merge. Keys live in Vercel environment variables, never in the repo. Days 9–10: fixes only, agreed in chat first.
- **Live sessions** (confirmed, 18:00–19:00 SAST, all recorded to #resources): Tue 27 Oct Meta Engineering Workshop P1, Agents 101 (Build a Multimodal AI Agent; Suraj Subramanian); **Wed 28 Oct Meta Engineering Workshop P2, Agents 102 (Best Practices for Verifiable Agents; Yash Khare)**; Fri 30 Oct Fireworks AI Workshop on Muse open models (Sinan Ozdemir). **Both of us attend P1 and P2**: Lethabo leads the agents and the figure guard, and our traceability design (assumption IDs, figure guard, citation checks, trace drawer) is a verifiable-agent design, so we compare it with Meta's guidance and adjust before the day-4 checkpoint. Fireworks: Lethabo if free (open weights), otherwise the recording. Each attendee posts three bullet points in team chat.
- **Discord office hours:** weekdays only, text only, 10:00–11:00 ET: **16:00–17:00 SAST until Fri 30 Oct, then 17:00–18:00 SAST from Mon 2 Nov** (US clocks go back on Sun 1 Nov). This collides with work or study hours, so post questions in #questions (Cerebral Valley, ping @CV) or #office-hours (Meta) and read the answers later. Last full day for submission questions is Tue 3 Nov. Ask rules and API-limit questions early, not on day 9.

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
| New-work-only rule (immediate disqualification if breached) | No product code before 26 Oct 18:00 SAST; planning docs are the only pre-existing material and are labelled as such; RISKS.md H6. |
| API access opens only at kickoff; credit forms are in #resources from kickoff | Day 1 evening is for keys; UI work runs against a mock model reply so it never waits. Each of us claims our own credits and adds a card on day 1. |
| Public repo leaks a secret | Repo went public on 26 Oct; keys only in env vars; Lethabo runs a secrets scan before every merge to main and on day 10; RISKS.md H5. |
| Submission mechanics (Representative, public repo, three-minute video, everyone listed) | Submission checklist above; Representative appointed on day 1. |
| Credits run short (USD 150 each, confirmed, per individual, card required) | Log spend daily; cache simulation results; cheaper models or sponsor credits for development; Fireworks credits are for shortlisted teams only, so do not rely on them. |
| Other commitments on weekdays | Availability declared before 26 Oct; heavy work on the weekend; days 7–8 double as buffer. |
| SONAR rule: no more than two overlapping builds | Check before 26 Oct; if Parallax would be a third, pause another build. |
| One of us ill or offline (including power or internet cuts) | Small commits pushed daily; both can deploy; every area has a back-up. |
| Model features differ from Meta's posts (already true: Muse Wonder's Active Memory is not in the developer docs, Wonder is Preview, and there is no Meta text-to-speech; CONTEXT.md §2.1) | We build our own memory store and use Spark 1.3; test every model on day 1; fall back as ARCHITECTURE.md §12 sets out. Fireworks' serverless Muse Spark Open ends 29 Oct (day 4), so decide by day 3 whether an on-demand fallback is worth it. |
| Last-day upload or form problems | Aim for 20:00, never later than 22:00 SAST. |

## 7. Open questions for Lethabo

0. Will you claim your own USD 150 Meta credits (and add a card) when the link opens? It cannot be done for you.

1. ~~What are your strongest skills?~~ Answered 26 Oct: avatars, API integrations, feature integration, security (see [ROLES.md](ROLES.md)). Is anything there you would rather swap or add?
2. How many hours can you give each day from 26 Oct to 4 Nov, especially weekdays?
3. Are you on SAST, and does 08:30 suit the daily sync?
4. Have credits or API access reached you? (Track settled: both on Startup.)
5. Are you in another build during this window (SONAR's two-build rule)?
6. Will you present in the demo video (on camera or voice-over), or should Sibusiso?
7. Your Vercel username, for access? (GitHub: LethaboMH14, already a collaborator.)
8. Figma or paper for the design sketches?
