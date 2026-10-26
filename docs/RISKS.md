# Risks, safety and ethics

Draft, 20 Oct 2026; owners and hackathon risks updated 26 Oct after the kickoff slides. Facts and confidence labels follow [CONTEXT.md](CONTEXT.md). This is a hackathon planning aid, **not legal advice**: a South African privacy lawyer must review it before any real launch.

Owners follow the roles agreed on 26 Oct ([ROLES.md](ROLES.md); Sibusiso: UI and UX, back end and simulation engine, API routes; Lethabo: avatars, model-API client and agents, feature integration including the figure guard and traceability, security). L = likelihood, I = impact (Low/Medium/High).

## 1. Risk register

### Technical

| ID | Risk | L | I | Mitigation | Owner |
|---|---|---|---|---|---|
| T1 | API access or model behaviour differs from Meta's posts (already true: Active Memory is not exposed to developers and Muse Wonder is Preview; CONTEXT.md §2.1) | M | H | Day-1 smoke test of every model we use; one adapter for all model calls; our own memory store; failover `muse-spark-1.3` → `muse-spark-1.2` → open weights → demo fixture (ARCHITECTURE.md §12). Fireworks' serverless Muse Spark Open ends 29 Oct, so a late open-weights fallback needs an on-demand deployment on Modal or Baseten credits. | Lethabo (client and failover); Sibusiso (routes) |
| T2 | Rate limits, or credits (USD 150 each, confirmed) run out | M | H | Per-session token budget; cache simulations and images; daily spend check; sponsor credits in reserve. See H8 for how credits are claimed. | Both (Lethabo: rate guard; Sibusiso: caching) |
| T3 | Slow conversation | H | M | Stream short replies; compact context (path card plus summary, not the whole transcript); track latency daily. | Sibusiso (streaming, UI); Lethabo (context pack) |
| T4 | Persona drift in long chats | M | H | Fixed "path card" (facts, figures, assumptions) sent every turn; separate memory per path; scripted 30-turn drift test. | Lethabo (future-self agents and the drift test) |
| T5 | Model invents numbers | H | H | All figures computed in code. A post-check (the figure guard, ARCHITECTURE.md §8) replaces any number not on the path card or in the user's inputs with "(see chart)" and logs it (the CivicLens rule). | Lethabo (figure guard); Sibusiso (engine figures) |
| T6 | No Meta text-to-speech (verified, CONTEXT.md §2.1) | H | L | Avatars reply in text; voice is input only (Voice Transcribe). Any voice output is a stretch goal using browser speech, labelled as such. | Lethabo (voice input); Sibusiso (browser speech, if built) |
| T7 | Avatars look like different people across paths | H | M | One base description from user-chosen traits; one base portrait, then one `/v1/images/edits` call per path so only path cues change (Muse Image has no `seed` parameter, verified); generate once and cache; stylised, not photoreal; test on day 3. | Lethabo |
| T8 | Faulty or hostile input (impossible figures, prompt injection) | M | M | Range checks in code with friendly errors; free text treated as data, never instructions; security test list (AGENTS_AND_APIS.md §5.4). | Both (Sibusiso: range checks in back end and UI; Lethabo: injection and security tests) |

### Product and ethics

| ID | Risk | L | I | Mitigation | Owner |
|---|---|---|---|---|---|
| P1 | Output treated as financial advice | H | H | Rule S1; no named products or lenders; avatars turn "what should I do?" back into questions; summary suggests a registered financial adviser. | Both |
| P2 | Overconfidence from precise-looking projections | H | H | Rule S2: ranges, rounding to the nearest R1,000, assumptions beside every figure. | Sibusiso |
| P3 | Emotional harm from a bleak future self | M | H | Rule S4; a short note before a hard path; pause or leave any time. | Lethabo (persona prompts); Sibusiso (the note and pause in the UI) |
| P4 | Bias by gender, race, location or class | M | H | Assumptions come from user inputs and a sourced table, never from race or gender; same-situation tests with varied personas; appearance chosen by the user. | Both |
| P5 | Person in distress or crisis | M | H | Rule S5. | Lethabo (detection in code, model flag and crisis tests); Sibusiso (support card UI) |
| P6 | Avatar says what the user wants to hear | M | M | Every avatar must name at least one real downside of its path. | Lethabo |
| P7 | **Parallax is mistaken for a "sample anti-project"** (Participant Guide and kickoff slides, CONTEXT.md §5; the list is not complete): AI-generated medical advice (including mental-health advisers), a basic RAG app, a simple image analyser, a **Streamlit app**, a **dashboard as the main feature**, an "AI for Education" chatbot, a job-application screener, a nutrition coach, a personality analyser, a sports coach; or mistaken for financial advice | M | H | Lead the pitch, video and README with the **simulation engine** (figures computed in code, uncertainty ranges), the multi-agent path avatars and the verification layer, not with "chat with an AI". Keep the "not advice" framing (S1). **No medical content:** no health decisions in scope, health topics redirected like any out-of-scope decision; the crisis card lists hard-coded helplines and never counsels. **Not a dashboard:** charts and the compare view support the conversation; the video never opens on a chart. **Not Streamlit:** React, Vite and TypeScript. No political or war content in the demo, personas or prompts. Avoid personality or psychological profiling of the user: the profile is money facts and priorities, nothing else. Full check: RESEARCH.md §5. | Both |

### Legal and privacy

| ID | Risk | L | I | Mitigation | Owner |
|---|---|---|---|---|---|
| L1 | POPIA, plus GDPR-style expectations from global users | M | H | Section 3. Sending data to Meta's servers may be a cross-border transfer under POPIA section 72: flag for legal review. | Both |
| L2 | Sensitive financial and personal data stored or leaked via logs | M | H | Session data only in the user's browser (section 3); stateless server; no accounts; no raw text in logs. | Lethabo (security review, log checks); Sibusiso (stateless back end) |
| L3 | Provider trains on user data | M | H | Meta's cheaper `-contributor` model IDs (Spark 1.3 and 1.2) are discounted in exchange for permission to use our content to train Meta models (verified on [Meta's pricing page](https://dev.meta.ai/docs/pricing-rate-limits); also seen on a [Vercel AI Gateway listing](https://vercel.com/ai-gateway/models/muse-spark-1.2-contributor/faq)): never use them for user data, and a config guard refuses them in production (ARCHITECTURE.md §13). Standard-mode retention terms are still unknown: read them in the AI Developer Legal Center. | Lethabo (config guard); Sibusiso (reads the terms, REVIEW M8) |
| L4 | Likeness and consent if photos were used | L | H | **No photo upload in the MVP.** Avatars come from traits the user chooses. | Both |
| L5 | Deepfake concerns about talking avatars | M | M | Stylised images, "AI-generated" badge, no voice cloning, no real person's likeness, no export of talking clips. | Lethabo |

### Hackathon

| ID | Risk | L | I | Mitigation | Owner |
|---|---|---|---|---|---|
| H1 | Whether a pair may enter Indie is **still unconfirmed** (the Participant Guide, read 26 Oct, resolved the rules, submission format and judging; CONTEXT.md §5). Entering the wrong track could cost eligibility or prize standing. | M | M | Ask in Discord #questions on day 1 and save the answer; both registrations must show the same track; Startup is the default. | Both |
| H2 | Schedule: ten days (26 Oct evening to 4 Nov), two people, weekdays shared with work or study | H | H | Agreed cut list (PLAN.md §5); a demoable build every evening; feature freeze at the end of day 6 (Sat 31 Oct). | Both |
| H3 | Submission-day failure (API outage, upload fails, time-zone mix-up) | M | H | Internal deadline 4 Nov 22:00 SAST; demo video by day 9; cached "demo mode" persona; submit a draft early. | Both |
| H4 | Power or internet outage, including load-shedding | M | M | Hosted deployment; either of us can submit; mobile data backup. | Both |
| H5 | **Repository must be public** (open source). **Done 26 Oct:** made public after checking the history (docs only, no secrets). The risk now is leaking a secret, key, or account, team or project ID into a public repo | M | H | Keys only in Vercel env vars and gitignored `.env.local`; never `VITE_`-prefixed; `.vercel/` gitignored; GitHub secret scanning and push protection on; secrets scan before every merge to `main` and on day 10; if anything leaks, rotate first (AGENTS_AND_APIS.md §5). Verify the repo in a logged-out window before submitting. | Lethabo (scans, rules); Sibusiso (repo settings) |
| H6 | **New-work-only rule:** judges must clearly identify what was built during the Hackathon; failure is immediate disqualification | L | H | The `docs/` planning files are the only pre-existing material and contain no product code (stated in README.md and PLAN.md). All product code starts after 26 Oct 12:00 ET, in commits after that time; no code copied from earlier projects (BobSwarm, CivicLens and others) unless it is named, licensed and marked as reused, and even then prefer rewriting; list dependencies; say "built during the Hackathon" in the video and README; never rewrite git history. | Both |
| H7 | **Submission mechanics:** one appointed Representative enters the project on the CV platform, listing everyone who worked on it, with an accessible repo and video link | M | H | Appoint the Representative on day 1 (proposal: Sibusiso); both confirm the submission fields on day 9; test the repo and video links in a private window; submit by 22:00 SAST on 4 Nov, never on the 04:00 deadline. | Sibusiso |
| H8 | **Credits are per individual and need a credit card:** each person must claim their own USD 150 by 4 Nov 21:00 ET (request forms in Discord #resources from kickoff); a card must be on the account to make calls; nobody can claim for the other | M | H | Each person claims their own the day the link opens and attaches a card with a spend-limit notification; agree who holds the shared project API key; do not assume USD 300 until both have claimed; log spend daily (T2). | Both |
| H9 | **Fireworks credits (USD 25) are only for select participants**, by email; the serverless Muse Spark Open also ends 29 Oct | H | L | Do not plan around Fireworks credits. Use Baseten (request USD 100 + 2M TPM, per individual, model `meta-models/muse-spark-open-1026`) and Modal (USD 100, first 1,000 participants) for open-weights work, and each of us requests them on day 1 (ROLES.md §5). | Both (each requests their own); Lethabo (open-weights path) |
| H10 | **Track eligibility for a pair is unconfirmed** (Startup entered; Indie says "individual builders and students") | M | M | See H1. If Discord says teams cannot enter Indie, we stay Startup; if our Startup form answers (company country, funding stage) are wrong, correct them before the deadline. | Both |

## 2. Safety design

Product rules. Each one gets a test before submission.

- **S1 Reflection, not advice.** A line on every screen and on the decision summary: "Parallax helps you think a decision through. It is not financial, legal or medical advice." A consent screen at the start confirms the user is 18 or older.
- **S2 Figures with assumptions and ranges.** Every figure shows a low, likely and high value plus the assumptions behind it and their source ("you told us", "public source", "our default", "AI-suggested"). The user can edit any assumption and rerun.
- **S3 No certainty.** Avatars speak conditionally ("on this path, if rent stayed flat..."). Banned phrases ("definitely", "guaranteed", "I promise") are checked in code. Each avatar is one possible future, not *the* future.
- **S4 Honest, not cruel.** A hard path names the difficulty plainly, then what helped and what was in the user's control. No mocking, shaming or despair. Future selves never describe death, serious illness, self-harm or family breakdown as outcomes.
- **S5 Distress and crisis.** Two layers: a deterministic phrase list in code and a model safety flag on each user turn. On a trigger the avatar steps out of character, role-play pauses and the support card appears. Parallax does not diagnose or counsel, and resumes only if the user chooses. Only the event type is logged.
- **S6 Transparency.** Every avatar and image is labelled AI-generated. A "Why?" link on any figure opens the path card behind it.

**Support card.** Numbers are hard-coded in the UI, never generated by the model. Verified on the official sites on 20 Oct 2026; re-check on day 9.

| Service | Contact | Source |
|---|---|---|
| SADAG Suicide Crisis Helpline (24 hours) | 0800 567 567 | [sadag.org](https://www.sadag.org/) |
| SADAG Cipla Mental Health Helpline (24 hours) | 0800 456 789, SMS 31393 | [sadag.org](https://www.sadag.org/) |
| Lifeline South Africa national counselling line | 0861 322 322 | [lifelinesa.co.za](https://www.lifelinesa.co.za/) |
| SAPS emergency | 10111 | [saps.gov.za](https://www.saps.gov.za/services/cc_10111.php) |
| Emergency from a cellphone | 112 | [ekurhuleni.gov.za](https://www.ekurhuleni.gov.za/press-releases/featured-article/know-your-life-threatening-emergency-services-number/) |
| Debt stress | *insert verified debt-counselling resource* | |
| Outside South Africa | Helplines by country | [findahelpline.com](https://findahelpline.com/) (ThroughLine) |

## 3. Privacy design

| Principle | MVP rule |
|---|---|
| Data minimisation | Ask only what the simulation needs: income and savings bands, obligations, skills, risk tolerance, city or province. Never an ID number, bank details, employer name, address or photo. |
| Where data lives (the one statement all docs follow) | No accounts and no database. Session data (inputs, transcripts, path cards, conversations, images, memory notes, the decision trace) is stored **only in the user's browser** (IndexedDB, ARCHITECTURE.md §13). Our server is stateless: it passes requests to Meta and keeps no user content. Voice audio is forwarded to Meta for transcription and never written to disk by us. *Proposal, not yet agreed:* the browser store clears itself 24 hours after the last activity unless the user chooses to keep the session. |
| Delete button | "Delete everything" on every screen clears the browser store (inputs, transcripts, images, path cards, conversations, memory, trace) and cancels in-flight requests. There is no copy on our server to wipe. We cannot delete what Meta may retain under its standard-mode terms (unknown until we read the AI Developer Legal Center), and the consent notice must say so. |
| No training | We never train or fine-tune on user data, and use only a non-training API tier (L3). |
| Notice and consent | Plain-language notice before the first input: what we collect, why, which providers process it, and how to delete it. |
| Secrets | API keys in environment variables, never in the repo or demo video. |

**Logging for traceability.** We log a random session ID, timestamps, model and prompt versions, assumptions-table version, token counts, latency, validation errors and safety-flag *types*. We never log raw user text, audio, images or figures. The full decision trace (which inputs and assumptions produced which figures) is shown to the user and deleted with the session. Aggregate logs are kept for 30 days at most. If we add the optional abuse guard (ARCHITECTURE.md §3), it keeps short-lived per-IP request counters and no content; an IP address can be personal information under POPIA, so the notice mentions it. The demo uses a synthetic persona.

**For production (out of scope).** A lawyer would need to advise on POPIA (Information Officer duties, lawful basis, cross-border transfers, agreements with model hosts, and special personal information such as health details users may volunteer), on GDPR for EU users, and on whether anything Parallax says could count as financial advice under South Africa's FAIS Act.

## 4. What Meta and the judges may care about

The judging criteria are **now published** (Participant Guide, CONTEXT.md §5): Impact, Use of Meta AI Tooling, Technical Depth and Execution, and Demo, equally weighted, 0-10 each, after a pass/fail check that the project fits the theme and uses Meta's models. **Judges are still not named.** The table below keeps the earlier guesses (Startup track wording and one reported article), which still map onto Technical Depth and Demo; DEMO.md §1A maps the video to the four criteria.

| Likely interest | How the demo could show it |
|---|---|
| Reliability | Same inputs give the same figures; an API error degrades gracefully. |
| Traceability | "Why?" on a figure shows its assumptions and sources. |
| Faulty inputs | Type an impossible salary; Parallax politely asks the user to check it. |
| Responsible AI | Framing line; an avatar declining to promise an outcome; a hard path told kindly; possibly the crisis card (section 6). |
| Privacy | Press "Delete everything" live. |
| Meta's models | Spark/Wonder, Image and Voice Transcribe each visibly doing a job. |

In the pitch, say "reflection aid", never "predicts your future".

## 5. Pre-submission checklist (days 9–10)

- [ ] Participant Guide rules re-read (public repo, new-work-only, Representative, three-minute video, everyone listed); track confirmed in Discord; both registrations on the same track.
- [ ] Repo is public and verified in a private window; no secrets in history.
- [ ] Each of us claimed our own credits and attached a card with a spend limit.
- [ ] X post published and its URL submitted on the platform (Most Viral bonus).
- [ ] Not an anti-project (RESEARCH.md §5): pitch leads with the engine and the future-self conversation, not a chart or dashboard; no medical, political or war content; no personality profiling.
- [ ] Every support-card number re-checked on the official site that day.
- [ ] Crisis test phrases: card shows, role-play pauses, no text logged.
- [ ] 30-turn script per path: no invented figures, no drift, a downside named.
- [ ] No banned certainty phrases in 50 sample replies.
- [ ] Every figure has a range and assumptions; framing line on every screen.
- [ ] Bias check: same situation and city with different names and genders gives the same figures; location effects come only from the sourced table.
- [ ] Delete verified in storage; logs hold no raw text, audio or images.
- [ ] Non-training API tier confirmed; no keys in the repo or video.
- [ ] Enough credits for judging (5–8 Nov) plus a buffer.
- [ ] Three-minute demo video uploaded and its link works; cached demo mode works if the APIs are down.
- [ ] Submitted before 4 Nov 22:00 SAST.

## 6. Open questions for Lethabo

1. ~~Which areas do you want to own?~~ Answered 26 Oct ([ROLES.md](ROLES.md)): the owners above now follow it. Anything you would rather hand back?
2. Are you comfortable testing the crisis rules with distressing test phrases? If not, we split them.
3. Is your registration on the Startup track?
4. Do you have power and internet backup for 26 Oct – 4 Nov, and any days you are unavailable?
5. Should the demo show the crisis card live, or only mention it?
6. Do you know a lawyer, financial adviser or counsellor who could give 15 minutes of informal feedback?
7. Which assumptions might be unfair to people in your community, so we can test for them?
