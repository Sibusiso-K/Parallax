# Demo and pitch plan

Event and model facts come from [CONTEXT.md](CONTEXT.md); build details belong in ARCHITECTURE.md.

**Owners (roles agreed 26 Oct, [ROLES.md](ROLES.md)):** demo video and pitch: both, with who presents decided on day 6. Seeded session, fixture (mock) mode and the persona's data: Lethabo (feature integration), with Sibusiso on the back-end side. X post: Sibusiso posts, Lethabo reposts. This doc owns the demo persona; SCOPE.md follows it.

> **Submission format is confirmed (Participant Guide, 26 Oct, CONTEXT.md §5):** a **three-minute demo video** of the features, code and functionality built during the Hackathon, a **public repo**, a live product, and everyone who worked on it listed. The video is a primary artifact judges use. The **3-minute version (§3) is therefore the main submission video**; the 2-minute script (§2) is the cut-down version for social media, the X post and the fallback.

**Honesty rule:** answers on screen are real output from a seeded session. Quoted lines below show the *shape* we expect, not hard-coded text. Any sped-up wait is labelled on screen.

---

## 1. Demo persona (fictional)

**Naledi Mokoena, 27, Soweto. Fictional character; any likeness to a real person is accidental.** On-screen label: "Demo persona: fictional".

Naledi is a payroll administrator who caters birthdays, funerals and church events on weekends. A regular client has offered her a monthly contract. Her question: *"Do I quit my job and cater full-time?"* (Rand figures are plausible demo values, not research.)

| Input | What she says | What Parallax records |
|---|---|---|
| Take-home pay | "R19,500 a month" | R19,500 |
| Catering profit | "About six thousand, more in December" | R6,000 a month, range R2,500–R11,000 |
| Savings | "About 40k, maybe less after December" | **R30,000–R40,000** (vague input kept as a range) |
| Fixed costs | Rent R5,500, transport R1,800, living R5,000 | R12,300 a month |
| Family support | "I send my mother R3,000 every month. That can't stop." | R3,000, marked non-negotiable |
| Debt | Store account | R4,000 |
| Risk appetite | "Low. My mother depends on me." | Low (the scale is low / medium / high, SCOPE.md §3) |

**Paths Parallax proposes**

| Path | Description |
|---|---|
| A. Stay and grow | Keep the job, grow catering on weekends |
| B. Go full-time | Resign in three months, take the contract, cater full-time |
| C. Qualify up | R60,000 study loan for a two-year part-time accounting diploma, keep the job (interest rate is an editable demo assumption, not a real quote) |

---

## 1A. How the demo maps to the four judging criteria

Stage 2 scores four equally weighted criteria, 0-10 each (CONTEXT.md §5). Every scene should earn points on at least one; the 3-minute video must show all four.

| Criterion | What the video must show | Where in the script |
|---|---|---|
| **Impact** | A real person with real stakes (supporting her mother, thin savings), who benefits, and that people could use it tomorrow; South African story; fits "Build for Your World" | Opening question; Naledi's constraints; close (who benefits, who pays) |
| **Use of Meta AI Tooling** | Beyond a basic integration: Muse Spark 1.3 with structured output and tool calls inside a verified agent loop; per-path future-self personas; Muse Image avatars (base portrait plus an edit per path); Muse Voice Transcribe at intake; Muse Wonder behind a flag if it works; optionally an open-weights path. One on-screen "Built on Meta" beat names each model doing a visible job (ARCHITECTURE.md §2A) | Intake (Voice Transcribe), path cards (Image), chat (Spark), "how it works" beat |
| **Technical Depth and Execution** | Figures computed in code, never by the model; ranges; trace drawer and assumption IDs; the figure guard replacing an invented number; faulty-input catch ("195000"); live assumption edit that redraws the answer; a short code or architecture glimpse that is clearly new work from this hackathon | Assumptions panel; chat citation chips; faulty-input and live-edit beats |
| **Demo** | Works live on the deployed URL, no cuts that hide failures, a strong 5-second cold open, readable at 1080p, genuinely pleasant to watch | Whole video; recording checklist (§5); backup plan (§6) |

**New-work evidence.** Show the date of the first product-code commit (after 26 Oct 12:00 ET) or the commit graph for one second, and say "built during the Hackathon". The only earlier commits are planning docs ([BUILD_LOG.md](BUILD_LOG.md)). Anything not built during the event (for example a library) is named as a dependency, never presented as ours.

**Avoid the anti-project list.** Open on Naledi's question and the conversation with her future selves, backed by the simulation engine, not on "an AI that gives advice" and never on a chart: Streamlit apps and "dashboards as the main feature" are on the kickoff slides' list, so the compare view stays a supporting scene. No health decisions, no political or war content on screen (RISKS.md P7, RESEARCH.md §5).

## 2. The 2-minute cut-down script (social and fallback)

This is the short version for the X post, the community-vote gallery blurb and the fallback (§6). It is **not** the submission video; the 3-minute version in §3 is. About 150 words of voiceover, so the screen has time to speak.

| Time | On screen | Voiceover |
|---|---|---|
| 0:00–0:10 | Black screen. Naledi's question types itself out. Label: "Demo persona: fictional". | "Naledi is 27. She has a steady job, a catering business, and a mother who depends on her. Should she quit?" |
| 0:10–0:28 | *Robustness.* Intake: she speaks, the transcript appears (Voice Transcribe). "About 40k, maybe less" becomes a chip: **Savings R30,000–R40,000: you said "about", so we kept a range.** | "She describes her life in her own words. When she's vague, Parallax doesn't invent a number. It keeps a range and tells her." |
| 0:28–0:42 | Three path cards appear, each with an illustrated future-self avatar (Muse Image) and a three-year money band. | "Parallax proposes three paths and simulates three years of each. Every figure is calculated in code and shown as a range, not a promise." |
| 0:42–0:52 | Assumptions panel opens on Path B: ID, value, range, source ("you said", "Parallax default" or "AI-suggested"). | "Every assumption is on the table, and she can change any of them." |
| 0:52–1:10 | **The moment, part 1** (*traceability*). Chat with 2029 Naledi on Path B. She asks: "Could I still send Ma R3,000 every month?" Reply, in shape: "Most months. In winter 2027 bookings dropped, I sent R1,500 for two months and used R9,000 of savings." Chip **[B3: winter bookings −40%, range −20% to −60%]**. Click: the panel highlights B3. | "Then she asks her future self the question that matters most. The answer is specific, and it shows where it came from." |
| 1:10–1:25 | **Part 2.** One click: "Ask this on Path A". 2029 Naledi in office clothes answers, in shape: "Every month. Money wasn't the problem. Time was: I turned down most wedding bookings." Chip **[A2: 2 events a month]**. | "Same question, another future. A different answer, grounded in the same facts about her." |
| 1:25–1:38 | Compare view: money to Ma, savings range in year 3, debt, working hours, for A, B and C. | "She compares all three side by side, including the study-loan path." |
| 1:38–1:52 | Comfort check on her leaning path rises from 2/5 to 4/5 (SCOPE.md §3 step 9). Decision summary: "Stay 12 months. Go full-time once catering clears R12,000 a month for three months in a row. Watch B3." | "When she's ready, Parallax writes down what she decided, why, and what would change her mind." |
| 1:52–2:00 | End card: logo, "Talk to your future before you choose it." Models used. "A reflection aid, not financial advice." | "Parallax. Built on Meta's Muse models." |

---

## 3. Other versions

### 30-second hook (social clip, opening of the pitch)

| Time | On screen | Voiceover |
|---|---|---|
| 0:00–0:07 | The question types out | "Should Naledi quit her job to cater full-time?" |
| 0:07–0:22 | Split screen, made in the video editor from the two real answers in the 2-minute flow (the app itself shows one path at a time; "Ask every path" side by side is a stretch goal): same question to Path B and Path A, two answers, two assumption chips | "She asked both her futures the same question. They answered differently, and each showed its working." |
| 0:22–0:30 | Decision summary, logo | "Parallax. Talk to your future before you choose it." |

### 3-minute submission video (the main one) and live-finals version

The Participant Guide requires a three-minute video; the same script serves the top-5 live final round (9 Nov, 19:00 SAST), which uses the same rubric. The kickoff slides say judges watch the demos live and rank them, so assume a live screen share and keep the pre-recorded video as the fallback.

| Time | Segment | Criterion it scores |
|---|---|---|
| 0:00–0:05 | **Cold open:** Naledi's hardest question on screen ("Could I still send Ma R3,000 every month?") | Demo, Impact |
| 0:05–0:20 | The problem, no slides: who loses most from a wrong move | Impact |
| 0:20–1:40 | The 2-minute flow, live on the seeded session | All four |
| 1:40–2:00 | **Faulty input:** take-home typed as "195000". Parallax asks: "That doesn't fit your budget. Did you mean R19,500?" | Technical Depth |
| 2:00–2:20 | **Live edit:** B3 from −40% to −20%; the range redraws and Path B's answer changes, proving figures come from code | Technical Depth, Demo |
| 2:20–2:35 | **Guardrail:** "Should I put my savings in crypto?" The future self declines investment advice and returns to her decision | Impact (responsible use) |
| 2:35–3:00 | **Built on Meta, built this week:** one line per model doing a job (Spark, Image, Voice Transcribe, Wonder if used, open weights if used); a one-second glimpse of the repo and commit history from 26 Oct; who benefits and who pays; close | Use of Meta AI Tooling, Technical Depth, Impact |

Keep the video under three minutes and test the link in a private window. If the app itself cannot show everything, the video is cut together from real sessions (honesty rule above).

### Most Viral Project bonus (USD 20K) and Community Vote (USD 10K)

| Item | Plan |
|---|---|
| Most Viral Project: most likes, reposts and comments on X by 8 Nov 11:59 PM ET (9 Nov 06:59 SAST) | Post the demo on X from Sibusiso's account (and Lethabo reposts) **as soon as the video is final, aiming for Wed 4 Nov before we submit**, because the form asks for the post link. The slide says "engagement on X after the event", and the guide does not say whether a pre-deadline post counts. Ask in #questions now; if the answer is no, post a second thread after 4 Nov 21:00 ET. Either way, engagement counts to 8 Nov 11:59 PM ET. Use the 30-second hook or the 2-minute cut-down as the native video (the 3-minute video is linked). First line is the cold-open question; tag Meta's and Cerebral Valley's accounts; a short thread: the hook, the "figures come from code" moment, the repo link. Submit the post URL on the platform. Reply to comments for the 4 days that count. |
| Community Vote: public gallery votes, one per verified account; opens 9 Nov, announced 16 Nov | Prepare a gallery thumbnail and a two-sentence blurb. Share the gallery link with friends, colleagues and the South African developer community when voting opens. No vote buying or botting: it risks disqualification and the platform-policy ban. |
| Honesty | Posts use only real footage of the seeded session, labelled "fictional persona". No fake engagement. |

---

## 4. Pitch narrative (Startup track)

The Startup track page says it is judged on **technical execution and holding up in production**, and the official Stage 2 rubric weights four criteria equally (§1A), so the pitch spends its time on reliability *and* on impact and Meta tooling.

1. **Problem.** Big money decisions are made on gut feel and scattered advice. People with the least safety net pay most for a wrong move, and nobody can try a path before living it.
2. **Demo.** The 2-minute flow inside the 3-minute video.
3. **How it works** (check every detail against the live API docs; ARCHITECTURE.md decides):
   - **Muse Spark 1.3** turns her story into structured inputs, proposes paths and assumptions, and voices each future self. (Muse Wonder is in Preview; we use it only behind a flag.) Our own memory store keeps each future self consistent; Wonder's Active Memory is not available to developers yet, so we do not claim it.
   - **Our simulation engine** computes every figure and range. The model never writes a number.
   - **Muse Image** draws one avatar per path.
   - **Muse Voice Transcribe** handles spoken input. Meta has no text-to-speech, so replies are text; spoken replies, if we add them, use the browser's built-in voice and are labelled as such.
4. **Why it is trustworthy.** Figures from code; answers cite assumption IDs; vague input stays a range; outliers are confirmed; no investment advice; she can delete her session.
5. **Who pays.** Hypotheses, not facts.

### Business-model hypotheses

| Hypothesis | Who pays | What would prove it wrong |
|---|---|---|
| H1. B2C freemium | Individuals: one decision free; pay for saved sessions and more decision types | People won't pay for a one-off decision |
| H2. Institutions as a benefit | University career offices; employers' HR benefits; per-seat licence | Slow sales cycles; no budget line |
| H3. Banks' financial-wellness programmes | Banks, for customers facing loan or business decisions | Advice regulation, or a conflict of interest the bank can't remove |

### Build for Your World

We are in Johannesburg, where someone who supports her mother and caters on weekends is a familiar story, not an edge case. Side businesses, family obligations and thin savings mean one bad move can take years to undo. (Any statistic we quote must cite Stats SA directly.)

**Why it works in every country Meta operates in:** the engine is country-agnostic; currency, cost defaults and language are configuration. Choosing under uncertainty with little room for error is universal.

---

## 5. Recording checklist

| Area | Checklist |
|---|---|
| Screen | 1920×1080, 30 fps; browser zoom 125%; clean profile, no bookmarks bar; Windows notifications off |
| Data | Seeded session, fictional label visible, no real personal data |
| Audio | Headset or USB mic, quiet room; voiceover recorded separately; levels normalised; no music under speech |
| Captions | Burned-in plus an .srt file; check rand amounts and names |
| Pacing | Speak at no more than 140 words a minute; hold key screens 3+ seconds; zoom on the citation chip and comfort check |
| Final check | Length no more than three minutes; link works in a private window; watch once on a phone, sound off |

---

## 6. Backup plan

| Level | What runs | Switch when |
|---|---|---|
| 0. Live | Real models, real engine | Default |
| 1. Seeded session | Simulation and avatars cached; chat live | Generation slow or failing |
| 2. Offline mock mode | Recorded model responses replayed; engine runs locally | API down or no internet |
| 3. Pre-recorded video | The 3-minute submission video (or the 2-minute cut-down if time is short) | Laptop or screen share fails |

Also: charged laptop, UPS or power bank for the router (load-shedding), mobile-data hotspot, video saved locally and in the cloud.

---

## 7. Screens and features the demo depends on

| # | Screen / feature | Must be polished |
|---|---|---|
| 1 | Intake, voice and text | Live transcript, range chips, outlier confirmation |
| 2 | Generation progress | Progress messages, no blank waits |
| 3 | Path cards | Avatar, name, three-year range band |
| 4 | Assumptions panel | IDs, values, ranges, source, edit in place |
| 5 | Future-self chat | Citation chips that open the panel |
| 6 | "Ask this on another path" | One click, keeps the question |
| 7 | Compare view | Four or five rows, readable at 1080p |
| 8 | Comfort check | 1–5 per path, trend tracked over the session |
| 9 | Decision summary | Choice, reasons, revisit triggers, export |
| 10 | Guardrail reply | Polite refusal of investment advice |
| 11 | Seeded session, mock mode | One command each |
| 12 | Disclaimer, fictional label | On every screen in the video |

**If PLAN.md §5 scope cuts are applied:** with two paths, drop Path C and the "including the study-loan path" line, and the compare shows A and B. With voice input cut, Naledi types her intake and the range chip still carries the scene. Nothing else in this script depends on a cuttable or stretch feature.

---

## 8. Open questions for Lethabo

1. Would you rather present the finals, record the voiceover, or edit the video?
2. Which video editor do you know (Clipchamp, CapCut, DaVinci Resolve)?
3. Does Naledi's story ring true? What would you change?
4. Should the intake show isiZulu–English code-switching? Only if Voice Transcribe handles it in testing; isiZulu is not on its published language list, so expect it to fail.
5. Illustrated or more realistic avatars?
6. Any contacts at a career office, bank or HR team to test H1–H3?
7. Are you free for the closing ceremony and live final round on 9 November, 19:00 SAST?
8. Will you post from your own X account for the Most Viral Project bonus, or only repost?
