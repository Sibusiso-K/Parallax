# Demo and pitch plan

Event and model facts come from [CONTEXT.md](CONTEXT.md); build details belong in ARCHITECTURE.md. **Rewritten Sun 1 Nov 2026 (day 7) for the founder direction** ([FOUNDERS.md](FOUNDERS.md)). The earlier persona and script are in the git history.

**Owners (roles agreed 26 Oct, [ROLES.md](ROLES.md)):** demo video and pitch: both. Seeded session, fixture mode and the demo founder's data: Lethabo (feature integration), with Sibusiso on the back-end side. X post: Sibusiso posts, Lethabo reposts. This doc owns the demo founder; SCOPE.md follows it.

> **Submission format (Participant Guide, CONTEXT.md §5):** a **three-minute demo video** of what was built during the Hackathon, a **public repo**, a live product, and everyone who worked on it listed. In the final round, judges "watch the video demos live and rank them", so the **3-minute video (§3) is the main artefact**; the 2-minute script (§2) is the cut-down for social media and the fallback.

**Honesty rule:** answers on screen are real output from a seeded session. Quoted replies below show the *shape* we expect, not hard-coded text. **The figures below are real engine output** from the demo story (`shared/intake/fixture.ts`) with wages answered as R21,000; the template values behind them (direct-cost share, equipment rent) are placeholders in `shared/defaults/za.json`, and the video says so if they are still unsourced. Any sped-up wait is labelled on screen.

---

## 1. Demo founder (fictional)

**Ayanda Dube (she/her), founder of a meal-prep and catering business in Johannesburg. Fictional character; any likeness to a real person or business is accidental.** On-screen label: "Demo founder: fictional".

The business is two years old with three staff. A corporate client has offered a 12-month contract to cater staff lunches. It is the biggest offer the business has had, and it pays 60 days after each invoice. Ayanda's question: *"Should I take the contract?"*

| Input | What Ayanda says | What Parallax records |
|---|---|---|
| Sales | "About R90,000 a month, anywhere from R75k to R105k" | R75,000–R105,000, usually R90,000 (range chip) |
| Direct costs | "Ingredients and packaging cost R36,000 a month" | R36,000, so a 60% gross margin |
| Running costs | "Rent, power, fuel and software come to R16,000" | R16,000 |
| Wages | Not in the story; asked as the one follow-up | "21k" → R21,000 |
| Own pay | "I pay myself R12,000" | R12,000 |
| Debt | "We repay R3,500 a month on the delivery van" | R3,500 |
| Cash | "R120,000 in the business account" | R120,000 |
| The offer | "12-month contract … worth R60,000 a month, but they pay 60 days after each invoice"; "another cook at R8,500 a month and a second fridge for R25,000" | Contract R60,000 a month, paid 60 days later; extra staff R8,500; equipment R25,000 |
| Risk comfort and priorities | "I'm careful with risk. What matters most is cash safety and growth." | Low; cash safety, growth |

**The three paths, from the engine** (likely case unless stated)

| Path | What it means | Cash at month 36 | Lowest cash | With a 2-month late payment |
|---|---|---|---|---|
| **A. Stay lean** | Turn it down and keep running as today | R174,000 | R121,500 in month 1; **the bad case runs out of cash in month 17** | The setback to watch is a lost client instead |
| **B. Take it as offered** | Paid 60 days after each invoice; extra cook; fridge bought up front | R479,000 | **R33,000 in month 2**; back to the starting R120,000 in month 5 | **Runs out of cash in month 4** (−R29,000) |
| **C. Take it on safer terms** | Only if paid within 30 days; rent the fridge (R1,250 a month) | R489,000 | R87,750 in month 1 | Lowest point R23,250 in month 3: **tight, but it survives** |

**The insight the demo turns on:** B is the most exciting offer and the only path where one late payment kills the business. C ends in the same place with a far safer low point. Ayanda leaves with a decision ("Take it, but only on 30-day terms, and rent the fridge") and the setback to watch.

---

## 1A. How the demo maps to the judging criteria

Stage 2 scores four criteria, 0–10 each, **weighted** (CONTEXT.md §5). Every scene should earn points on at least one; the 3-minute video must show all four.

| Criterion (weight) | What the video must show | Where in the script |
|---|---|---|
| **Impact (30%)** | A real founder problem with real stakes (a contract that could sink the business), who benefits (owner-led businesses; about three million in SA), and that founders could use it tomorrow with no books; one real founder's line if we have it | Cold open; the late-payment moment; close (who benefits, who pays) |
| **Use of Meta AI Tooling (25%)** | Muse Spark 1.3 in a verified agent loop (intake, paths, one founder agent per path with tools); Muse Image avatars (base portrait plus an edit per path); Muse Voice Transcribe at intake; a "Built on Meta" beat naming each model's job | Intake, path cards, chat, how-it-works beat |
| **Technical Depth and Execution (20%)** | Figures from code, never the model; ranges; assumption IDs and the trace drawer; the figure guard replacing an invented number; a faulty-input catch; a live edit that redraws; new work from this hackathon | Assumptions panel, chips, faulty-input and live-edit beats |
| **Demo (25%)** | Works live on the deployed URL, a strong cold open, readable at 1080p, pleasant to watch | Whole video; §5 checklist; §6 backup |

**New-work evidence.** Show the first product-code commit (after 26 Oct 12:00 ET) or the commit graph for a second, and say "built during the Hackathon". Libraries are named as dependencies, never shown as ours.

**Avoid the anti-project list.** Open on Ayanda's question and the conversation with the future founders, never on a chart. "Dashboards as the main feature" is on the kickoff slides' list and our design is data-rich, so the compare view and charts stay supporting scenes (DESIGN.md §0). No health, political or war content.

## 2. The 2-minute cut-down script (social and fallback)

About 150 words of voiceover, so the screen has time to speak.

| Time | On screen | Voiceover |
|---|---|---|
| 0:00–0:08 | Black screen. The question types itself out: "Should I take the contract?" Label: "Demo founder: fictional". | "Ayanda runs a catering business. A corporate client just offered the biggest contract she's ever had. Should she take it?" |
| 0:08–0:25 | *Robustness.* Intake: Ayanda speaks; the transcript appears (Voice Transcribe); "Here is what I heard" with her own words beside every figure; a range chip on sales; one follow-up: wages. | "She describes the business in her own words. Parallax quotes her back, keeps her rough numbers as ranges, and asks only for what's missing." |
| 0:25–0:40 | Three path cards, each with an illustrated avatar of Ayanda on that path (Muse Image) and a 36-month cash band. | "Three ways to handle it, 36 months of cash each, computed in code. Not a promise: a rehearsal." |
| 0:40–0:55 | Chat with Path B's founder: "When did cash get tightest?" Reply, in shape: "Month 2. We were down to R33,000 before the first payment landed." Chips **[B6 contract income, paid 60 days after each invoice] [B9 equipment, bought up front]**. | "She asks the founder she'd become if she says yes. The answer is specific, and it shows where it came from." |
| 0:55–1:10 | **The moment.** Stress test "Late payment" on Path B: the band drops below zero; "Cash runs out in month 4." One click: "Ask this on another path" → C. Reply, in shape: "The same late payment took us to R23,250. Tight, but we never ran out." | "One late payment, and the best offer she's ever had runs her out of cash in month 4. On safer terms, the same shock is survivable." |
| 1:10–1:25 | Compare view: cash at months 12 and 36, lowest cash, when cash runs out, for A, B and C. | "Side by side: the safer deal ends in the same place, without the cliff." |
| 1:25–1:40 | Comfort check on C rises from 2 to 4. Decision memo: "Take the contract only on 30-day terms; rent the fridge. Watch: late payment." | "When she's ready, Parallax writes down what she decided, why, and what to watch." |
| 1:40–2:00 | End card: logo, "Rehearse the decision before you bet the business." Models used. "A reflection aid, not financial advice." | "Parallax. For founders. Built on Meta's Muse models." |

---

## 3. Other versions

### 30-second hook (social clip, opening of the pitch)

| Time | On screen | Voiceover |
|---|---|---|
| 0:00–0:07 | "This contract would have run my business out of cash in month 4." | "This contract would have run my business out of cash in month 4." |
| 0:07–0:22 | Split screen, made in the editor from two real answers (the app shows one path at a time; "Ask every path" is stretch): Path B "we ran out in month 4", Path C "tight, but we never ran out", each with its chip | "Same contract, same late payment. Different terms, different future. Every figure computed in code." |
| 0:22–0:30 | Decision memo, logo | "Parallax. Rehearse the decision before you bet the business." |

### 3-minute submission video (the main one, and the final round)

| Time | Segment | Criterion it scores |
|---|---|---|
| 0:00–0:05 | **Cold open:** "This contract would have run my business out of cash in month 4." | Demo, Impact |
| 0:05–0:20 | The problem, no slides: founders decide alone; cash, not profit, kills businesses; late payment is a South African fact (one cited figure from FOUNDERS.md §2) | Impact |
| 0:20–1:40 | The 2-minute flow, live on the seeded session | All four |
| 1:40–2:00 | **Faulty input:** sales typed as "9000000". Parallax asks: "Did you mean R900 000? Please confirm the amount." | Technical Depth |
| 2:00–2:15 | **Live edit:** raise Path B's contract direct costs; the band redraws and B's answer changes, proving figures come from code | Technical Depth, Demo |
| 2:15–2:25 | **Figure guard:** a reply that tries to invent a figure shows "(see chart)" instead; the trace drawer logs it | Technical Depth, Meta tooling |
| 2:25–2:35 | **Guardrail:** "Should I put the business's cash into crypto?" The founder agent declines investment advice and returns to the decision | Impact (responsible use) |
| 2:35–3:00 | **Built on Meta, built this week:** one line per model doing a job; a glimpse of the commit history from 26 Oct; who benefits and who pays (§4); close | Meta tooling, Technical Depth, Impact |

Keep the video under three minutes; test the link in a private window. If the app cannot show everything, the video is cut from real sessions (honesty rule).

### Most Viral Project (USD 20K) and Community Vote (USD 10K)

| Item | Plan |
|---|---|
| Most Viral: highest engagement on X after the event, counted up to 8 Nov EOD | Post the 30-second hook from Sibusiso's account as soon as the video is final (aim Wed 4 Nov, before we submit, since the form asks for the link); Lethabo reposts. First line: "This contract would have run my business out of cash in month 4." Thread: the hook, "the model never writes a number", the repo. Founders are the audience, so ask founder friends to reply with the decision they would rehearse. Reply to comments until 8 Nov. |
| Community Vote: one vote per verified account; opens 9 Nov, announced 16 Nov | Gallery thumbnail and two-sentence blurb; share with SA founder communities, incubators and developer groups. No vote buying. |
| Honesty | Only real footage of the seeded session, labelled "Demo founder: fictional". No fake engagement. |

---

## 4. Pitch narrative (Startup track)

1. **Problem.** Founders make one high-stakes decision after another with no finance team. Cash, not profit, decides whether a business survives, and a deal can look profitable and still empty the account. About three million small businesses in South Africa face this with little room for error (FOUNDERS.md §2).
2. **Demo.** The 2-minute flow inside the 3-minute video.
3. **How it works** (ARCHITECTURE.md decides every detail):
   - **Muse Spark 1.3** reads the founder's story into structured fields (each checked against their own words), proposes the paths, and voices one founder agent per path, each seeing only its own figures.
   - **Our simulation engine** computes every figure and range, month by month, including payment timing. The model never writes a number; the figure guard checks every reply.
   - **Muse Image** draws the founder on each path.
   - **Muse Voice Transcribe** takes spoken input. Meta has no text-to-speech, so replies are text.
4. **Why it is trustworthy.** Figures from code; answers cite assumption IDs; vague input stays a range; outliers are confirmed; no products, no investment advice; the founder can delete the session.
5. **Who pays** (hypotheses, FOUNDERS.md §6): freemium for founders; enterprise and supplier development programmes and incubators paying per founder; platforms founders already use embedding it.
6. **Why us, why now.** We are founders; Meta wants agents that "help you run your whole business" (Meta Business Agent, June 2026), and Parallax is the agent that helps a founder decide.

**Competition, in one line** (COMPETITORS.md): spreadsheets have numbers but no conversation; chatbots have conversation but no numbers; Parallax has both, and the model never writes a number.

### Build for Your World

We are two founders in Johannesburg, and our beachhead is food businesses: caterers, bakeries and meal-prep kitchens that sell on WhatsApp, buy ingredients before they are paid, and take every big order on gut feel. (Any statistic we quote must cite its source directly.)

**Why it works everywhere:** the engine is country-agnostic; currency, defaults and language are configuration; every owner-led business makes contract, hiring and pricing decisions.

---

## 5. Recording checklist

| Area | Checklist |
|---|---|
| Screen | 1920×1080, 30 fps; browser zoom 125%; clean profile; notifications off |
| Data | Seeded session, "Demo founder: fictional" visible, no real business data |
| Audio | Headset or USB mic, quiet room; voiceover recorded separately; no music under speech |
| Captions | Burned-in plus an .srt file; check rand amounts and names |
| Pacing | No more than 140 words a minute; hold key screens 3+ seconds; zoom on the citation chip and the late-payment band |
| Final check | No more than three minutes; link works in a private window; watch once on a phone, sound off |

---

## 6. Backup plan

| Level | What runs | Switch when |
|---|---|---|
| 0. Live | Real models, real engine | Default |
| 1. Seeded session | Simulation and avatars cached; chat live | Generation slow or failing |
| 2. Offline mode | Fixture intake and recorded replies; engine runs locally (`web-offline` preview forces model calls off) | API down or no internet |
| 3. Pre-recorded video | The 3-minute submission video | Laptop or screen share fails |

Also: charged laptop, power bank for the router (load-shedding), mobile-data hotspot, video saved locally and in the cloud.

---

## 7. Screens and features the demo depends on

| # | Screen / feature | Must be polished | Status (1 Nov) |
|---|---|---|---|
| 1 | Intake, voice and text | Quotes beside figures, range chips, one follow-up | Text built; voice not started |
| 2 | Generation progress | Real steps, no blank waits | Built |
| 3 | Path cards | Avatar, name, 36-month cash band | Built without avatars |
| 4 | Assumptions panel | IDs, values, ranges, source, edit in place | Built |
| 5 | Future-founder chat | Citation chips that open the panel | UI built; agents not started |
| 6 | Setback stress test on a path | "Cash runs out in month 4" shown from the engine | Engine built; screen to add |
| 7 | "Ask this on another path" | One click, keeps the question | Built |
| 8 | Compare view | Readable at 1080p | Built |
| 9 | Comfort check | 1–5 per path, trend | Built |
| 10 | Decision memo | Choice, reasons, setback to watch, print | Basic built |
| 11 | Guardrail reply | Polite refusal of investment advice | Agents not started |
| 12 | Disclaimer and fictional label | On every screen in the video | Built (label to add to the video) |

**If PLAN.md §5 scope cuts are applied:** with two paths, keep B and C (the late-payment moment needs both) and drop A. With voice input cut, Ayanda types; the range chip still carries the scene.

---

## 8. Open questions for Lethabo

1. Does Ayanda's story ring true for food businesses you know? Would another business type make a stronger demo?
2. Who presents the finals, records the voiceover, or edits the video?
3. Which avatar settings for the three paths (home kitchen, commercial kitchen, café)?
4. Can you bring one real founder to a session by Tue 3 Nov, for a quote with consent?
5. Will you post from your own X account for Most Viral, or only repost?
6. Are you free for the closing ceremony and live final round on Mon 9 Nov, 19:00 SAST?
