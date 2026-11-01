# Scope: the Parallax MVP

What we build in the 10-day window (26 Oct to 4 Nov 2026), what we cut, and how we will know it works. Event facts and Meta's models: [CONTEXT.md](CONTEXT.md). How it is built: [ARCHITECTURE.md](ARCHITECTURE.md). **Rewritten Sun 1 Nov 2026 (day 7) for the founder direction** ([FOUNDERS.md](FOUNDERS.md)); the earlier personal-decision scope is in the git history.

## 1. Who it is for

**Primary user:** a founder of an owner-led business (0 to 20 staff, no finance team) facing one big business decision. Beachhead: food and hospitality businesses in South Africa (caterers, meal-prep kitchens, bakeries, food producers, small restaurants); every owner-led business next (FOUNDERS.md §4). Currency and cost defaults are configuration; the MVP ships with rand (ZAR) defaults.

**Problem:** Founders decide one high-stakes thing after another with no finance team, on gut feel and spreadsheets they do not trust. Cash, not profit, decides whether a business survives, and a decision can look profitable and still empty the account if the money arrives late. There is no quick, safe way to rehearse the options before committing.

## 2. MVP decisions

Decision types are named, and paths are lettered A, B, C in every doc. Each decision is a template in `shared/paths/templates.ts`; each path has its own stress-test setbacks.

| Decision | A | B | C |
|---|---|---|---|
| **Take on a big contract or order** (demo) | **Stay lean:** turn it down, keep running as today | **Take it as offered:** the contract's terms as stated (for example paid 60 days after each invoice), extra staff, equipment bought up front | **Take it on safer terms:** only if the client pays within 30 days, and rent the equipment instead of buying it |
| **Make a hire** | **Stay as you are** | **Hire now:** full-time from month 1; extra gross profit from month 4 | **Start part-time:** half-time for 6 months, full-time from month 7 if it works |
| **Raise prices** | **Keep prices** | **Raise prices 10%** from month 2; some customers leave | **Raise prices 5%** from month 2; fewer leave |

**Demo default: the contract.** It shows the cash-timing trap most clearly: Path B is the most profitable on paper and the only one that runs out of cash if the client pays late (DEMO.md §1). The template numbers (contract length, share of direct costs, rent for equipment, the hire's ramp-up and uplift, customers lost to a price rise) are placeholders in `shared/defaults/za.json`, labelled "template" and editable.

**Not yet supported** (Parallax says so plainly and simulates nothing): loans and investors, a second site or new market, going full-time on a business. These are the roadmap (FOUNDERS.md §3).

## 3. User flow

**1. Start.** One screen: what Parallax is ("Rehearse the decision before you bet the business"), "a reflection aid, not financial advice", what we store, that the founder can delete it any time, 18 or older. No account.

**2. Intake, by text or voice.** The founder describes the business and the decision, typed or spoken (Muse Voice Transcribe). Parallax fills an editable form ("Here is what I heard"), quoting the founder's own words beside each figure, then asks for anything missing, one question at a time. Ranges ("R75k to R105k") become the low and high inputs. A field is kept only if its quote is in the founder's text.

| Required field | Used for |
|---|---|
| The decision, in their own words | Template and paths |
| Kind of decision (contract, hire, prices) | Read in code from the founder's words; asked with three buttons if unclear |
| What the business does | Framing for the agents and avatars |
| Sales each month | Gross profit at today's margin |
| Direct costs each month (stock, ingredients, materials) | Today's margin |
| Rent and running costs; staff wages; the founder's own pay; debt repayments | Fixed monthly costs |
| Cash in the business | Starting cash and runway |
| Risk comfort (low / medium / high) | How trade-offs are framed, never the numbers |
| Top 3 priorities, stored as `goals` (cash safety, growth, profit, control, time) | What each future founder reflects on |

Optional template fields, never asked as follow-ups: the contract's monthly value, the days the client takes to pay, the cost of a new person, a one-off cost to get started, the price rise. Defaults fill them in, marked as assumed or template. Where the business is based is optional.

**3. Profile.** A "Your business, today" card: facts (from the founder), assumptions (defaults we filled in, marked *assumed*) and priorities. Always editable; every path and avatar reads from it, so they stay consistent.

**4. Paths.** Parallax proposes three paths (§2); the founder can rename them or change key choices.

**5. Simulation: 36 months, monthly steps.** Each path runs on bad, likely and good assumptions (the bad case takes every income at its low end and every cost at its high end).

| Layer | Contents | Made by |
|---|---|---|
| Cash | Money in, money out and cash in the business each month, drawn as a bad-to-likely-to-good band. Sales are modelled as gross profit at today's margin, so a bad month of sales also buys fewer ingredients | Code |
| Timing | A contract's income lands after its payment terms (30 days is one month later, 60 is two) while its costs start at once | Code |
| Milestones | Cash covers three months of fixed costs; cash runs out; cash back to where it started after dipping below it; debt repayments end | Code |
| Setbacks | 1 or 2 per path from a fixed library (late payment, lost client, slow season, equipment breakdown, cost rise), applied as stress tests and judged by how close they push the business to empty | Code applies; model describes |
| Day-to-day life | Snapshots at months 6, 12 and 36: the work, the team, the founder's time | Model, given the numbers |
| Assumptions | Each with value, range, source (you / default / template / AI-suggested) and an edit control; editing re-runs the path | Code |
| Uncertainty | The 2 or 3 assumptions that drive most of the spread, in plain words | Code |

The screen always says: "One possible future, not a prediction."

**6. Avatar per path.** One Muse Image portrait of the founder at month 36 on that path, from a short self-description (no photo upload), illustrated so it is clearly not a photo, with the setting following the outcome (a crowded home kitchen, a commercial kitchen, a steady café). A one-line status comes from code ("Month 36: cash R479 000; lowest point R33 000 in month 2").

**7. Talking to each future founder.** Open-ended chat with each avatar in the first person, typed or spoken. It knows the shared profile and its own path's figures, not the other paths. It may only quote figures from its path (code checks before display). It reflects; it does not choose, recommend products or give financial advice.

**8. Switching and comparing.** Paths are tabs; switching loses nothing. "Ask this on another path" carries the current question to another path's founder in one click. The compare view shows, side by side: cash at 12 and 36 months (ranges), lowest cash, when cash runs out, the setback to watch, latest comfort rating, and quotes pinned from each chat. It supports the conversation and is never the landing screen.

**9. Reaching "comfortable".** Parallax does not decide when the founder is done; it shows what is still missing.
- **Comfort check:** a 1 to 5 rating per path plus "What is still bothering you?", after each chat and on demand, with the trend shown.
- **Open questions list:** the founder's own worries, each tagged with what could settle it: change an assumption, ask a future founder, or find out in real life ("ask the client for 30-day terms"). The model-collected version is proposed stretch (FEATURES.md F23).
- The session ends with "I've decided: path X" or "Not ready yet". Both are valid.

**10. What they leave with.** A one-page decision memo: paths and key ranges, the chosen or leaning path with reasons in their own words, assumptions, the setback to watch, open questions, things to check in real life, and the disclaimer. Printable from the browser, next to "Delete everything" (RISKS.md §3). It is meant to be shown to a cofounder, partner or funder.

## 4. In scope, out of scope, stretch

**In scope (must ship)**
- Steps 1 to 10 for the contract decision, polished; the hire and price templates working end to end (built 1 Nov).
- Cash engine with unit and stress tests; avatar placeholder if image generation fails.
- Input validation and a fallback for every model call.
- Hosted at a public URL, with a **public repo** and a **three-minute demo video** (CONTEXT.md §5).

**Out of scope**
- Decisions outside a trading business's cash: health, relationships, legal disputes, emigration, cofounder equity.
- Loans and investors, second sites, going full-time (roadmap; "not supported yet").
- Bank, accounting or payroll connections; tax calculation.
- Naming specific banks, lenders, loans, investments or suppliers.
- Photo upload, photoreal likeness, video or lip-synced avatars.
- Accounts, sharing, native mobile apps (responsive web only).
- Languages other than English.

**Stretch, in order, only once must-ship works on the hosted URL**
1. "Ask every path": one question, all three founders answer side by side.
2. What-if from chat: the founder agent proposes an assumption change as a button ("What if they paid in 30 days?"); confirming re-runs the path.
3. Spoken avatar replies with the browser's built-in speech (Meta has no text-to-speech; CONTEXT.md §2.1).
4. Resume a session later with memory (our own memory store).
5. Monte Carlo ranges instead of three fixed runs.
6. A fourth decision template (loans and investors) once repayment and dilution are modelled with care.
7. **Open-weights path** (for the USD 10K bonus): one bounded job, for example one path's founder chat, on Muse Spark Open via Baseten (`meta-models/muse-spark-open-1026`) or Muse Glimmer on Modal, behind the provider adapter and a flag. Only if the founder agents and avatars are live first (RESEARCH.md §6).

## 4A. Use of Meta AI Tooling (25% of the score)

"Use of Meta AI Tooling" is weighted 25% (CONTEXT.md §5): beyond a basic integration, creative, surfacing capabilities that surprise Meta. This section describes how the scoped features use Meta's stack; it adds no must-ship work.

| Meta capability | How Parallax uses it beyond a basic call | Status |
|---|---|---|
| Muse Spark 1.3 (Muse Wonder behind a flag) | An **agent loop with tools and verification**: the intake agent fills a strict schema with quotes that code checks against the founder's text; the path planner proposes paths and assumptions as structured output; each path's founder agent calls tools (`get_figure`, `remember`) instead of doing arithmetic; every reply passes the figure guard and citation check before the founder sees it. Several agents with different facts talk about the same business. | Intake live behind a switch; agents in progress (F10) |
| Muse Image | One founder avatar per path: a base portrait, then an edit per path so the founder stays recognisable while the setting follows the outcome | In progress (F9) |
| Muse Voice Transcribe | Spoken intake, transcript confirmed before anything is extracted | Must ship (cut 5 in PLAN.md §5 if needed) |
| Structured output | Strict JSON schemas for intake, paths, assumptions and the decision memo | Live for intake |
| Open weights | Stretch goal 7 above | **Stretch only** |

**Anti-project check.** The main risk is "dashboards as the main feature" (kickoff slides): the chosen design is data-dense (DESIGN.md §0). Parallax stays clear by leading with the founder avatar and the conversation, keeping charts and the compare view in support, and never opening the video on a chart. Full check: RESEARCH.md §5.

## 5. Success criteria

Track: **Startup**. Rubric: Impact 30%, Use of Meta AI Tooling 25%, Technical Depth and Execution 20%, Demo 25% (CONTEXT.md §5).

| Lens | Our bar |
|---|---|
| Technical execution | Full flow on a live URL; a founder finishes the contract decision in under 10 minutes without help |
| Holds up in production | Every model call has a timeout, bounded retries (ARCHITECTURE.md §12) and a fallback; figures still render if the model is down |
| Traceable decisions | Tapping any number shows its inputs and assumptions; zero founder-agent figures absent from the path's figure table |
| Faulty inputs | The scripted set of 26 bad inputs passes (`shared/intake/checks.test.ts`) |
| Practical use | At least one founder outside the team completes a session by Tue 3 Nov; feedback logged with consent |

| Faulty or vague input | What Parallax does |
|---|---|
| Vague decision ("I'm stuck") | Asks what the decision is, or offers the three decisions as buttons |
| Missing number | Asks once; if skipped, uses a labelled default with a wide range |
| Rough answer ("about 90k") | Stores a range for the bad and good cases |
| Impossible or contradictory values (direct costs above sales, a misplaced zero) | Code flags them and asks to confirm, suggesting the likely figure when one is plausible |
| A story that mentions a loan or a lawyer in passing | Judged on the decision itself, so it is not blocked |
| Out-of-scope or not-yet-supported decision | Says so plainly; no simulation |
| "Just tell me what to do" | Plays back priorities and trade-offs; does not choose |
| Distress or crisis language | Pauses and points to support (RISKS.md) |
| Model error or timeout | Retries, then falls back; inputs are never lost |

## 6. Product principles

1. **A reflection aid, not advice.** Parallax shows consequences and asks questions; the founder decides.
2. **Numbers come from code.** Every figure is computed from stated assumptions. The model only writes the words, and code checks any figure it quotes.
3. **Cash before profit.** Paths are judged on whether the business stays alive month by month, not only on where it ends.
4. **Honest uncertainty.** Ranges, not single answers; every default labelled; less input means wider ranges. "Not ready yet" is a good outcome.
5. **The founder owns their data.** Minimum fields; a clear note that inputs go to Meta's model API; delete any time; nothing kept or reused without their say-so.

## 7. Open questions for Lethabo

1. Do the three decisions (contract, hire, prices) match what founders you know face most? Which would you add first?
2. Can you find one or two founders (food businesses first) to run a session by Tue 3 Nov?
3. Are the placeholder template numbers in `shared/defaults/za.json` believable to you, or should we show them as "placeholder" on screen?
4. Avatars: one founder on three paths (home kitchen, commercial kitchen, café). Does that work with Muse Image edits?
5. Is 36 months the right horizon for a contract decision, or should the contract templates run 24?
