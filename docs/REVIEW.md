# Review of the planning docs

Independent review of README.md and the six docs in `docs/`, written 20 Oct 2026 for Lethabo's PR review. The five planning docs were drafted in parallel, so the first job was to make them agree. Every edit is listed in section 2 so it can be checked or reverted.

---

## 1. Verdict

1. **The plan is sound and honest.** Figures come from code, Meta's API facts are checked, and the safety design is real. After 33 contradictions and 1 factual error were fixed, the docs agree on persona, paths, horizon, storage, voice, memory, owners and dates.
2. **The weak point is size.** The must-ship list is roughly twice what two part-time people can make production-solid in ten days. The hardest and most distinctive part, grounded chat with the figure guard, lands on days 3–4.
3. **Recommendation:** merge these docs as the baseline, then cut scope at the first sync, before any code (section 4).

---

## 2. Changes made, file by file

34 fixes in all: 33 contradictions between docs and 1 factual error found against Meta's docs. Wording that was merely different in style was left alone.

**Index of the 33 contradictions** (doc that changed ← doc it was aligned to):
1. Muse Wonder Active Memory relied on (CONTEXT, SCOPE, DEMO ← ARCHITECTURE: not exposed)
2. Meta TTS "unconfirmed" (CONTEXT, SCOPE, DEMO ← ARCHITECTURE: none)
3. Voice out "MVP default" (ARCHITECTURE ← SCOPE stretch, PLAN first cut)
4. Demo persona (SCOPE ← DEMO)
5. Path names (SCOPE ← DEMO)
6. Decision types lettered A–C, clashing with path letters (SCOPE ← DEMO, ARCHITECTURE)
7. "AI-suggested" source missing (SCOPE, DEMO, RISKS ← ARCHITECTURE)
8. "Ask this on another path" not in scope (SCOPE ← DEMO)
9. 30-second hook relied on a stretch feature (DEMO ← SCOPE)
10. South African language promises (SCOPE, DEMO ← ARCHITECTURE / Meta docs)
11. "One retry" (SCOPE ← ARCHITECTURE)
12. Delete button name (SCOPE ← RISKS)
13. Horizon 60 months (ARCHITECTURE ← SCOPE)
14. Monte Carlo as core (ARCHITECTURE ← SCOPE)
15. Model-invented setbacks (ARCHITECTURE ← SCOPE)
16. `what_if` as core (ARCHITECTURE ← SCOPE)
17. Helplines "to be verified" (ARCHITECTURE ← RISKS)
18. Server-side purge and delete (RISKS ← ARCHITECTURE)
19. Day-0 smoke test (ARCHITECTURE ← PLAN, RISKS)
20. Third-path cut with no demo fallback (PLAN, DEMO)
21. Voice-input cut with no demo fallback (PLAN, DEMO)
22. RISKS owners T4, T6, P3, P5 (RISKS ← PLAN)
23. DEMO had no owners (DEMO ← PLAN)
24. Risk appetite "2 out of 5" (DEMO ← SCOPE, ARCHITECTURE)
25. Confidence check 0–10 (DEMO ← SCOPE comfort check 1–5)
26. Pitch said Wonder voices the avatars (DEMO ← ARCHITECTURE: Spark; Wonder flagged)
27. Fallback to Fireworks Muse Spark Open (RISKS ← ARCHITECTURE: ends 29 Oct)
28. Figure-guard replacement text (RISKS ← ARCHITECTURE)
29. "Fixed seed if supported" (RISKS ← ARCHITECTURE: no seed)
30. Contributor mode "reportedly" (RISKS ← ARCHITECTURE: verified)
31. Pre-event "throwaway spikes" (RISKS ← PLAN)
32. Feature freeze end of day 8 (RISKS ← PLAN: day 6)
33. "Nine days" (RISKS ← SCOPE, PLAN: ten)

### Spot-checks on Meta's developer docs (20 Oct 2026)

| Claim from ARCHITECTURE.md | Page re-read | Result |
|---|---|---|
| Model IDs `muse-spark-1.3`, `muse-spark-1.2`, `muse-wonder-1.0` (Preview), `muse-image-1.0`, `muse-voice-transcribe-1.0`; no Active Memory on the models page | dev.meta.ai/docs/models | **Holds** |
| Base URL `https://api.meta.ai/v1`, Bearer auth; Voice Transcribe "does not synthesize speech" (no TTS) | dev.meta.ai/docs/ | **Holds** |
| `-contributor` IDs let Meta train on your content; prices and per-team rate limits | dev.meta.ai/docs/pricing-rate-limits | **Holds**. The page adds that contributor mode exists only for Spark 1.3 and 1.2, not Wonder |
| Speech-to-text: endpoint, WAV format, 10 min, 32 MB; isiZulu and Afrikaans not supported | dev.meta.ai/docs/speech-to-text | **Holds, with one correction:** the page says "25 languages with code-switching", not "25 evaluated languages". Fixed in ARCHITECTURE.md |
| Fireworks serverless Muse Spark Open ends 29 Oct 2026 | fireworks.ai/models/fireworks/muse-spark-open | **Holds** |

### CONTEXT.md
- Muse Wonder row: added that on the API it is `muse-wonder-1.0` (Preview) and Active Memory is not exposed to developers.
- "Not confirmed anywhere: a Meta TTS" → **confirmed: no Meta TTS**; voice out is stretch only, using browser speech.
- New **§2.1 Meta Model API: verified facts**: base URL, model IDs, no TTS, Active Memory not exposed, contributor-mode warning, prices and limits, speech-to-text limits and languages, no image `seed`, protocol state, retention unknown, and the Fireworks preview ending 29 Oct. Each fact has its dev.meta.ai (or fireworks.ai) URL, and ✓ marks the ones I re-read.
- "Confirmed" label now also covers Meta's developer docs.
- Added a note on where the plan now differs from the application text (voice is input only; memory is our own store; Spark does the reasoning, Wonder is optional).

### SCOPE.md
- **Persona aligned to DEMO.md:** Naledi Mokoena (R19,500, catering, R3,000 to her mother) replaces the R16,500 baking persona.
- **Path names aligned to DEMO.md:** A. Stay and grow / B. Go full-time / C. Qualify up. "Leap now / Bridge" is gone; the bridge idea is now what Naledi works out by comparing paths.
- **Decision types renumbered 1–3**, because "decision A" collided with "Path A" in DEMO and ARCHITECTURE. All references are updated (in-scope list, success criteria, open question 2).
- Assumption sources now include **AI-suggested** (ARCHITECTURE has a `model-suggested` source; hiding it would break the honesty principle).
- **"Ask this on another path"** added to step 8 as in scope, because the demo's key moment depends on it.
- Stretch 1 now points to that in-scope version. Stretch 3 now says browser speech (no Meta TTS). Stretch 4 now says our own memory store, with Active Memory if and when available. Stretch 6 now says typed only, because isiZulu and Afrikaans are not supported by Voice Transcribe.
- "One retry" → "bounded retries" (ARCHITECTURE §12 allows up to 3 for 429/500).
- "Delete my data" → "Delete everything", the name RISKS.md uses.

### ARCHITECTURE.md
- Model IDs row: added `muse-spark-1.2`, which the failover chain already used.
- Speech-to-text row: "25 evaluated languages" → "25 supported languages with code-switching; isiZulu and Afrikaans are not among them" (factual correction).
- Active Memory status: "unverified" → "not available to developers (as documented)", re-checked.
- **Horizon 60 → 36 months** (matches SCOPE), with figure keys `y1..y3`.
- **Uncertainty:** the MVP is three deterministic runs (bad / likely / good), and **Monte Carlo is now marked stretch**, as SCOPE has it. The `p10/p50/p90` slots are kept, so the data model is unchanged. The UI must not call the runs percentiles, and "low" means the unfavourable end (for a cost, the high value).
- **Setbacks** come from SCOPE's fixed library and are applied as stress tests. Before, the model invented setbacks and their probabilities.
- `what_if` from chat marked as stretch (SCOPE stretch 2). In the MVP, edits go through the assumptions panel.
- **Voice out:** "MVP default" → stretch only (diagram, §10, build order).
- Distress row: helplines are verified in RISKS §2. The old text said "to be verified".
- §13: added the 30-day metadata log limit and the 24-hour auto-clear proposal, and pointed to RISKS §3 as the single statement.
- Build order: "Day-0 smoke test" → "Day-1" (kickoff evening), matching PLAN's no-code-before-rules rule.
- Open question 6 notes that all docs now use 36 months.

### PLAN.md
- Cut 1: "no Meta TTS is confirmed" → Meta has none; voice out is stretch anyway.
- **Cut 2 (third path) and cut 5 (voice input)** each got a demo fallback, because DEMO.md relied on both.
- Cut 6: memory beyond the session is stretch, so it is normally never built.
- Risk row on model features now states what is already known (no Active Memory, Wonder in Preview, no TTS) and the Fireworks 29 Oct cut-off.

### DEMO.md
- Added owners per PLAN: Lethabo for the video and pitch, Sibusiso for the seeded session and mock mode.
- Risk appetite "2 out of 5" → "Low", the scale SCOPE and ARCHITECTURE use.
- Assumption source labels include "AI-suggested".
- **"Confidence check 3/10 → 7/10" → "Comfort check 2/5 → 4/5"**, SCOPE's 1–5-per-path scale (also in the checklist and §7).
- 30-second hook: the split screen is made in the editor from two real answers, because "ask every path" side by side is a stretch goal.
- Pitch "How it works": Spark 1.3 does the work, Wonder is Preview behind a flag, memory is our own store, and there is no claim of Active Memory. Replies are text, because Meta has no TTS.
- Added a "**If scope cuts are applied**" note under §7.
- Question 4: isiZulu is not on Voice Transcribe's list.

### RISKS.md
- Owner intro now follows PLAN §1. Owners changed: **T4** → Sibusiso (Lethabo runs the drift test); **T6** → Lethabo (voice); **P3** → Sibusiso for prompts, Lethabo for UI; **P5** → Sibusiso for detection, Lethabo for the support card and tests.
- **T1:** failover chain from ARCHITECTURE, plus the Fireworks end date. The old text said "fallback to Muse Spark Open on sponsor credits", which stops working on 29 Oct.
- **T5:** replacement text aligned to ARCHITECTURE's figure guard ("(see chart)", logged).
- **T6:** marked verified.
- **T7:** "fixed seed if supported" → there is no seed (verified); use one base portrait plus an edit per path.
- **L2 and §3, storage and retention, reconciled.** The old text had server data purged after 24 hours, and "Delete everything" wiping data on the server. The new text: data lives only in the browser; the server is stateless; Delete clears the browser and cancels requests; nothing is on our server to wipe. We also say what we cannot delete (Meta's side, terms unknown). The 24-hour auto-clear is kept as a **proposal** for the browser store.
- **L3:** contributor mode upgraded from "reportedly" to verified on Meta's pricing page.
- **H1:** "throwaway spikes" → no product code until the rules are read (PLAN §2).
- **H2:** "nine days" → ten days; "feature freeze end of day 8" → **end of day 6**, as PLAN has it.
- S2: source labels include "AI-suggested".
- Logging: notes that the optional per-IP counters store IP addresses, which can be personal information under POPIA.

### README.md
- The doc table matches the files that exist (seven docs, including this one). The CONTEXT row mentions the verified API facts.

### Checked and already consistent
Dates and times: 26 Oct 2026 is a Monday; 12:00 EDT = 18:00 SAST; 4 Nov 21:00 EST = 5 Nov 04:00 SAST; the internal deadline is 4 Nov 22:00, with PLAN aiming for 20:00. Also consistent: transport is SSE in every doc (WebSocket appears only in Sibusiso's past projects); input is take-home pay with no tax engine; each avatar sees only its own path plus shared session facts.

---

## 3. Quality review and remaining issues

### 3.1 Against the judging criteria (Startup track)

| Criterion | Where the plan is strong | Where it is weak |
|---|---|---|
| Technical execution *(confirmed)* | Structured output, a deterministic engine, a figure guard, citation IDs, a provider adapter. Well above typical hackathon depth | Breadth: 10 must-ship steps, 3 decision templates, voice, images and PDF all compete for the same days |
| Holds up in production *(confirmed)* | Timeouts, retry rules from Meta's own error docs, a failover chain, fixture mode, a cost model | Judges hit the live URL during 4–8 Nov: the passcode, credits and rate limits must not lock them out (M3). No soak test is planned |
| Reliability *(reported)* | Same inputs give the same figures, now that the MVP uses three deterministic runs | Chat quality under load is untested until day 3 |
| Traceability *(reported)* | The standout strength: assumption and event IDs, "Based on" chips, a trace drawer, a per-turn projection version | The 2-minute video shows it only once |
| Faulty inputs *(reported)* | A 20+ case table, range chips, outlier confirmation | The best faulty-input moment ("195000") is only in the 3-minute finals version, not in the video every judge sees |
| Real use beyond a demo *(reported)* | Business hypotheses; a real South African story | SCOPE's "3 outside users" bar has no slot in PLAN (M5) |

**Is ten days realistic for two people?** Not for the full must-ship list. Weekdays are shared with work or study, Lethabo's skills and hours are unknown, and day 1 starts at 18:00. That leaves about 6.5 working days before the day-6 freeze. Sibusiso's column for days 1–4 holds the API, engine, simulation, personas, chat, memory, summary and logging. It is realistic if decisions 2 and 3, the model-collected open-questions list and the PDF export move to stretch, and the core loop (intake → paths → grounded chat → switch → summary) is hardened first.

**Single biggest risk to winning:** spreading two part-time people across the whole must-ship list, so the one thing judges remember (talking to a future self who gives specific, traceable answers) is slow, stilted or flaky on the live URL. Placeholders, streaming, a sentence-by-sentence figure guard and citation checks are the hardest engineering in the plan. That work should start on day 2 against fixtures, not day 3–4.

**What would make the demo stronger:**
1. Put one "holds up in production" moment into the **2-minute video**, not only the finals version: the "195000" catch, or the trace drawer showing the figure guard replacing a number the model invented.
2. Move the **live assumption edit** (B3 from −40% to −20%, and the answer changes) into the 2-minute cut. It is the clearest proof that figures come from code. It could replace part of the compare scene.
3. **Cold-open on the question** ("Could I still send Ma R3,000 every month?") for 5 seconds before the setup. The key moment currently arrives at 0:52.
4. Add **one real tester's reaction** (with consent, no personal data) for "real use beyond a demo".
5. Fix the shape of Naledi's Path B answer so the engine can produce it honestly (M1).

### 3.2 Remaining issues

**High**

| # | Issue | Suggested fix |
|---|---|---|
| H1 | Must-ship scope is larger than ten part-time days allow (above) | At the first sync: move decisions 2 and 3, the model-collected open-questions list and the PDF export to stretch (browser print is enough). Keep the engine generic so 2 and 3 are cheap later |
| H2 | The core differentiator (grounded chat with the figure guard) is scheduled late and is the hardest part | Build the figure guard and placeholder substitution against fixtures on day 2; measure time to first sentence from day 3 |
| H3 | Lethabo's role, skills and hours are unknown; every Lethabo row in PLAN is a proposal | Lethabo answers section 5 (questions 1–3) before 26 Oct; re-balance PLAN §1 the same day |
| H4 | ~~Official Rules are unpublished (pre-event code, submission format, video length, IP)~~ **Resolved 26 Oct:** the Participant Guide is read (CONTEXT.md §5). New issues it raised: addendum below | Done |

**Medium**

| # | Issue | Suggested fix |
|---|---|---|
| M1 | DEMO marks the R3,000 to her mother as non-negotiable, yet the expected Path B answer is "I sent R1,500 for two months". No doc defines what the engine does when cash runs out | Sibusiso defines a shortfall rule (savings first, then debt, and never a cut to a non-negotiable payment unless the user allows it); then update the answer's shape |
| M2 | No tax modelling favours Path B: A uses take-home pay, but B's catering profit is before tax | Add an editable "tax set-aside on business income" assumption (sourced default), or label B's income as before tax on screen |
| M3 | Judges' access 4–8 Nov: the demo passcode, per-IP limits and credit exhaustion could block them | Put the passcode in the submission notes, or drop it and rely on limits; reserve credits for judging (RISKS checklist); fixture mode shows a clear banner |
| M4 | Credits: USD 150 each is reported, not confirmed; it is unknown whether they cover Wonder, Image and Voice, or whether both keys are in one team (rate limits are per team) | Confirm on day 1; ARCHITECTURE §14 already budgets for 3× overrun |
| M5 | SCOPE's "3 people outside the team complete a session" has no slot in PLAN | Add to day 7 or 8, owner Lethabo; recruit the testers before 26 Oct |
| M6 | Voice intake opens the demo, but accuracy on South African English accents is untested | Test on day 1–2; the typed fallback is now written into PLAN and DEMO |
| M7 | Avatar face consistency across paths without a seed is untested | Test on day 3 (now in RISKS T7); the initials badge is the fallback |
| M8 | Meta's standard-mode retention and training terms are unknown, so the consent notice cannot yet be accurate | Sibusiso reads the AI Developer Legal Center before the notice is written (day 8 at the latest) |
| M9 | Browser-only data: auto-clear after 24 hours is still a proposal and pulls against stretch goal 4 (resume later) | Decide together (section 4) |

**Low**

| # | Issue | Suggested fix |
|---|---|---|
| L1 | The demo says "2029 Naledi", but ARCHITECTURE's minimality rule says "no names" | Ask for an optional first name, or label the avatar "You, 2029" |
| L2 | RISKS P2 rounds figures to the nearest R1,000; demo shapes use R1,500 | Pick one rounding rule (for example R500 below R10,000) |
| L3 | Vercel Hobby plan: check its terms on commercial use before relying on it for a Startup-track product | Check on day 1; budget for Pro if needed |
| L4 | "Ask this on another path" is not in PLAN's never-cut list, though the key demo moment needs it | Add it at the day-4 checkpoint |
| L5 | The bad and good case runs put every assumption at its extreme at once, which may make all paths look scarier than they are | Fine for the MVP; show the top 2–3 drivers (already in SCOPE) so the band is explained |
| L6 | ~~The kickoff hour (18:00 or 19:00 SAST) is unresolved~~ **Resolved 26 Oct:** 18:00 SAST (12:00 ET) | Done |

---

## 4. Decisions needed

**For Lethabo**
1. Accept or change the proposed split in PLAN §1 (front end, avatars, voice input, testing, demo video).
2. Present or voice the video, or hand it to Sibusiso.
3. Confirm Naledi's story and the A / B / C paths ring true, or propose changes.
4. Choose the avatar art style.
5. Recruit 3–5 testers and own the external-test session (M5).

**For Sibusiso**
1. Engine shortfall rule and the treatment of non-negotiable payments (M1).
2. Tax set-aside assumption for business income (M2).
3. Rounding rule for displayed figures (L2).
4. By day 3: an on-demand open-weights fallback (Modal or Baseten), or rely on `muse-spark-1.2` plus fixture mode.
5. Passcode and abuse guard design that cannot block judges (M3).
6. Read Meta's data-handling terms before the consent notice (M8).

**For both**
1. **Cut scope now:** move decisions 2 and 3, the model-collected open-questions list and PDF export to stretch (H1). Recommended.
2. Confirm the defaults this review chose to settle contradictions: **36-month horizon**, **three deterministic runs (Monte Carlo as stretch)**, **paths A Stay and grow / B Go full-time / C Qualify up**, **comfort check 1–5 per path**.
3. Browser data auto-clears after 24 hours unless the user keeps it: yes or no (M9).
4. Both registrations on the Startup track, confirmed in writing.
5. Read the Official Rules together on the day they appear; agree what pre-event work stays.

---

## 5. All open questions for Lethabo (merged from every doc)

Source docs in brackets. Duplicates are merged.

**Role and logistics**
1. Which areas do you want to own or learn? Change PLAN §1 freely. [SCOPE 1, ARCHITECTURE 1, PLAN 1, RISKS 1]
2. Are you comfortable with TypeScript, React and Vercel, or do you prefer other tools? [ARCHITECTURE 2]
3. How many hours a day can you give from 26 Oct to 4 Nov, especially on weekdays, and which days are you unavailable? [PLAN 2, RISKS 4]
4. Are you on SAST, and does an 08:30 daily sync suit you? [PLAN 3]
5. Are you in another build during this window (SONAR's two-build rule)? [PLAN 5]
6. Is your registration on the Startup track, and have credits or API access reached you? [SCOPE 7, PLAN 4, RISKS 3]
7. Is your Meta Model API account in the same team as Sibusiso's (rate limits, and possibly credits, are per team)? [ARCHITECTURE 3]
8. What are your GitHub and Vercel usernames? [PLAN 7]
9. Do you have power and internet backup for the build window? [RISKS 4]
10. Figma or paper for the design sketches? [PLAN 8]

**Product**
11. Is decision 1 (leave a job for a side business) the right demo, or is decision 2 or 3 closer to people you know? [SCOPE 2]
12. Does Naledi's story ring true? What would you change? [DEMO 3]
13. Is a 3-year horizon enough, or should it be 5? [SCOPE 5, ARCHITECTURE 6]
14. Are you happy with illustrated avatars and no photo upload, and which art style? [SCOPE 4, ARCHITECTURE 7, DEMO 5]
15. If we reach voice out (stretch), are browser voices good enough, or is a better TTS worth the cost and privacy trade-off? [ARCHITECTURE 4]
16. Should avatars have a South African flavour or code-switch, and which second language matters most for the language stretch goal? (Voice Transcribe does not support isiZulu or Afrikaans, so that would be typed.) [ARCHITECTURE 5, SCOPE 6, DEMO 4]
17. Who sources and dates the South African defaults (CPI range, savings and debt rates, salary bands)? [ARCHITECTURE 8]
18. Which assumptions might be unfair to people in your community, so we can test for them? [RISKS 7]

**Testing and safety**
19. Can you find 3–5 people to test intake, including voice in a range of accents? [SCOPE 3]
20. Are you comfortable testing the crisis rules with distressing test phrases, or should we split them? [RISKS 2]
21. Should the demo show the crisis card live, or only mention it? [RISKS 5]
22. Do you know a lawyer, financial adviser or counsellor who could give 15 minutes of informal feedback? [RISKS 6]
23. Any contacts at a career office, bank or HR team to test the business hypotheses H1–H3? [DEMO 6]

**Demo**
24. Will you present (finals, on camera or voice-over) or edit the video, or should Sibusiso present? [DEMO 1, PLAN 6]
25. Which video editor do you know (Clipchamp, CapCut, DaVinci Resolve)? [DEMO 2]
26. Are you free for the finals on 9 November (time TBA)? [DEMO 7]

---

## 6. How to review this PR (for Lethabo)

**Read in this order (about an hour):**
1. **This file, sections 1 and 4** (10 min): the verdict and what needs your decision.
2. **CONTEXT.md §2.1** (5 min): what Meta's API actually offers. Several of Meta's announcements (Active Memory, a voice for avatars) are not available to developers.
3. **SCOPE.md** (15 min): the product contract. If something here is wrong, everything downstream is wrong.
4. **DEMO.md** (10 min): the story judges will see. Ask yourself whether you would want to present it.
5. **PLAN.md** (10 min): your proposed role and days. This is the part most about you.
6. **RISKS.md** (10 min), then **ARCHITECTURE.md** last. Skim it unless you take on back-end work.

**Push back on:**
- **Your role and hours.** The plan assumes things about you that nobody has asked yet. Change PLAN §1 directly.
- **Scope.** If you think something should go, say so. This review already argues for cuts (H1).
- **The persona.** Naledi was written by people who are not her; tell us what rings false.
- **The defaults this review picked** to settle contradictions (section 4, "For both", item 2). They were chosen for consistency, not because anyone decided them.
- **Any statement of fact without a source.** CONTEXT.md's labels (confirmed / reported / unknown) are the rule.
- **The privacy promise in RISKS.md §3.** Would you be comfortable saying it to a friend who uses the app?

**How to respond:** comment on lines in the PR, and answer section 5 in one comment, numbered. Approve once the "for Lethabo" decisions in section 4 are answered or explicitly parked.


---

## 7. Update after the Participant Guide (26 Oct)

The official Participant Guide was read on 26 Oct 2026 (kickoff day). Full facts: [CONTEXT.md §5](CONTEXT.md). The review sections above are kept as written on 20 Oct; this addendum supersedes them where they conflict.

**Resolved**
- **"Official Rules unknown" (H4) is resolved.** Rules, submission package, judging criteria, prize split, schedule and credit terms are now confirmed.
- Kickoff is **18:00 SAST** (not 19:00); L6 is closed.
- Judging is **5-8 Nov** (not 4-8 Nov); closing ceremony Mon 9 Nov 12:00 ET = **19:00 SAST**.
- The video is **three minutes**, and the repo must be **public**. The 3-minute script is now the main submission video; the 2-minute script is the cut-down.
- USD 150 Meta credits are confirmed (no longer "reported"), but **each person claims their own** and a **credit card** is required.
- The judging rubric is published: Impact, Use of Meta AI Tooling, Technical Depth and Execution, Demo, equally weighted. This changes section 3.1: Startup-track wording (execution, production) is no longer the whole story, and Impact and Meta tooling now carry half the score.
- Pre-event work: new-work-only is confirmed; we wrote no product code before kickoff, so the planning docs are the only pre-existing material.

**New**
- **Sample anti-projects** (generic advisors, personality analysers, basic RAG, medical advice, anything political or war): Parallax must not read like one (RISKS.md P7).
- **Repo is private; rules require public** (RISKS.md H5).
- **New-work-only with immediate disqualification** (RISKS.md H6).
- Appointed **Representative** submits; everyone who worked on it is listed (H7).
- Bonus prizes: Most Viral Project (X post, USD 20K), Best Build on Open Weights (USD 10K), Community Vote (USD 10K), Best Agentic Use-Case (USD 5K), Best Creative Build (USD 5K). The last two fit the existing design (SCOPE.md §4A); the first needs a plan (DEMO.md); the open-weights one is a labelled stretch goal (SCOPE.md stretch 7).
- Fireworks credits are for shortlisted teams only; Baseten and Modal are by request and per individual; use `meta-models/muse-spark-open-1026` on Baseten.
- Workshops 18:00-19:00 SAST on 27, 28 and 30 Oct; Agents 102 (Verifiable Agents) is directly relevant to our traceability design. Office hours are weekdays only, 16:00-17:00 SAST.
- No scope has been added; the cuts decided in section 4 stand.

**Still open**
- Whether a team of two may enter **Indie** (the guide does not say; ask in #questions).
- Judges are still not named.

**Decisions now needed**
1. **Startup vs Indie:** stay Startup unless Discord says otherwise (Sibusiso and Lethabo; both registrations must match).
2. **Repo visibility:** make the repo public (Sibusiso decides; check history for secrets first).
3. **Representative:** proposal is Sibusiso (Lethabo to agree).
4. **Open-weights bonus:** chase the USD 10K "Best Build on Meta Open Weight Models" bonus (stretch goal, only after the must-ship flow is stable, not before day 6), or skip it? Both decide; request Baseten and Modal credits on day 1 either way so the option stays open.
5. Each person claims their own credits and adds a card (no decision, but a hard dependency).
