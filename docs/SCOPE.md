# Scope: the Parallax MVP

What we build in the 10-day window (26 Oct to 4 Nov 2026), what we cut, and how we will know it works. Event facts and Meta's models: [CONTEXT.md](CONTEXT.md). How it is built: [ARCHITECTURE.md](ARCHITECTURE.md).

## 1. Who it is for

**Primary user:** a young working adult (roughly 20 to 35) in South Africa facing a career or money decision with no adviser and a thin safety net. They often support family, have little saved or have irregular income. Currency and cost defaults come from the profile, so it works in any country where Meta operates; the MVP ships with rand (ZAR) defaults.

**Problem:** People make life-changing decisions on gut feeling and scattered advice, and those with the least room for error pay the most for a wrong move. There is no safe way to try the options before living them.

## 2. MVP scenario type: career and money decisions

Decision types are numbered 1–3 so they are not confused with paths, which are lettered A, B, C in every doc.

| # | Decision | Default paths |
|---|---|---|
| **1** | **Leave a salaried job to grow a side business full-time** | A. Stay and grow (keep the job, grow the business on weekends) / B. Go full-time (resign in a few months) / C. Qualify up (study loan for a part-time qualification, keep the job) |
| 2 | Take a loan for a qualification or a vehicle (e.g. a car for e-hailing) | No loan / Loan now / Save first, smaller loan later |
| 3 | Move city for a job offer (e.g. Polokwane to Cape Town) | Stay / Move alone, send money home / Move with dependants |

**Demo default: decision 1.** It has the clearest money story (steady salary against uncertain revenue) and three truly different paths. The demo persona is **Naledi Mokoena** (fictional), owned by [DEMO.md](DEMO.md) §1: 27, Soweto, R19,500 take-home as a payroll administrator, weekend catering profit of about R6,000 a month (range R2,500–R11,000), R3,000 a month to her mother (non-negotiable), R30,000–R40,000 saved, a R4,000 store account, low risk comfort. The "bridge" idea (stay 12 months, then leap) is not a separate path: it is what the person can arrive at by comparing A and B, as Naledi does in the demo. Decisions 2 and 3 are proposed stretch, not must-ship (REVIEW.md H1; FEATURES.md F22). The engine is generic, so they are cheap to add later if the day-4 checkpoint allows.

## 3. User flow

**1. Start.** One screen: what Parallax is, "a reflection aid, not financial advice", what we store, and that the person can delete it any time. No account.

**2. Intake, by text or voice.** The person describes the decision, typed or spoken (Muse Voice Transcribe). Parallax extracts the fields into an editable form ("Here is what I heard") to confirm, then asks for anything missing, one question at a time. Ranges ("8 to 12k") become the low and high inputs.

| Required field | Used for |
|---|---|
| The decision, in their own words | Template and paths |
| Age band; province (or country, outside South Africa) | Framing, currency, cost defaults |
| Monthly take-home income | Baseline (take-home avoids tax modelling) |
| Essential expenses; monthly support to family (never cut without the person's consent); debt repayments | Fixed monthly costs |
| Savings | Runway |
| Risk comfort (low / medium / high) | How trade-offs are framed, never the numbers |
| Top 3 priorities, stored as `goals` (security, income, freedom, family time, growth) | What each future self reflects on |

Templates add optional fields (side-business revenue and costs; loan amount, rate and term; offer salary and new rent).

**3. Profile.** A "You, today" card: facts (from the person), assumptions (defaults we filled in, marked *assumed*) and priorities. Always editable; every path and avatar reads from it, so they stay consistent.

**4. Paths.** Parallax proposes 2 or 3 paths; the person can rename them, change key choices (resign month, loan amount) or delete them.

**5. Simulation: 36 months, monthly steps.** Each path runs on low, expected and high assumptions.

| Layer | Contents | Made by |
|---|---|---|
| Money | Income, expenses, savings, debt, months of runway, drawn as a low-to-high band | Code |
| Milestones | Emergency fund reaches 3 months; business matches old salary; loan paid off | Code |
| Setbacks | 1 or 2 per path from a fixed library (lost client, car breakdown, income gap, family emergency, rent increase), applied as stress tests | Code applies; model describes |
| Day-to-day life | Snapshots at 6, 12 and 36 months: routine, stress, family time | Model, given the numbers |
| Assumptions | Each with value, source (you / default / template / AI-suggested) and an edit control; editing re-runs the path | Code |
| Uncertainty | The 2 or 3 assumptions that drive most of the spread, in plain words | Code |

The screen always says: "One possible future, not a prediction."

**6. Avatar per path.** One Muse Image portrait of the person at month 36 on that path, from a short self-description (no photo upload), illustrated so it is clearly not a photo, with setting and mood following the outcome. A one-line status comes from code ("Month 36: the business pays me about R11,000; savings are thin").

**7. Talking to each future self.** Open-ended chat with each avatar in the first person, typed or spoken. It knows the shared profile and its own timeline, not the other paths. It may only quote figures from its timeline (code checks before display). It reflects; it does not choose, recommend products or give financial advice.

**8. Switching and comparing.** Paths are tabs; switching loses nothing. "Ask this on another path" carries the current question to another path's future self in one click (the demo's key moment; each avatar still sees only its own path). The compare view shows, side by side: savings at 12 and 36 months (ranges), worst month, milestones, biggest setback exposure, latest comfort rating, and quotes pinned from each chat.

**9. Reaching "comfortable".** Parallax does not decide when the person is done; it shows what is still missing.
- **Comfort check:** a 1 to 5 rating per path plus "What is still bothering you?", after each chat and on demand, with the trend shown.
- **Open questions list:** the person's own worries, typed or confirmed from the chats, editable, each tagged with what could settle it: change an assumption, ask a future self, or find out in real life ("get a quote for a second oven"). The version where the model collects the list is proposed stretch (FEATURES.md F23).
- The session ends with "I've decided: path X" or "Not ready yet". Both are valid.

**10. What they leave with.** A one-page decision summary: paths and key ranges, the chosen or leaning path with reasons in their own words, assumptions, the setback to watch, open questions, things to check in real life, and the disclaimer. Printable with the browser's print (PDF export is proposed stretch, FEATURES.md F24), next to the "Delete everything" button (RISKS.md §3).

## 4. In scope, out of scope, stretch

**In scope (must ship)**
- Steps 1 to 10 above for decision 1, polished. Decisions 2 and 3 are proposed stretch (see §2).
- Cash-flow engine with unit tests; avatar placeholder if image generation fails.
- Input validation and a fallback for every model call.
- Hosted at a public URL, with a **public repo** and a **three-minute demo video** (confirmed submission package, CONTEXT.md §5).

**Out of scope**
- Decisions outside career and money (health, relationships, legal, emigration).
- Bank, credit bureau or payroll connections; tax calculation.
- Naming specific loans, banks or investments.
- Photo upload, photoreal likeness, video or lip-synced avatars.
- Accounts, sharing, native mobile apps (responsive web only).
- Languages other than English.

**Stretch, in order, only once must-ship works on the hosted URL**
1. "Ask every path": one question, all avatars answer side by side (the in-scope version is "Ask this on another path", one path at a time).
2. What-if from chat: the avatar proposes an assumption change as a button; confirming re-runs the path.
3. Spoken avatar replies using the browser's built-in speech (Meta has no text-to-speech; see CONTEXT.md §2.1).
4. Resume a session later with memory (our own memory store; Muse Wonder Active Memory if and when Meta exposes it to developers).
5. Monte Carlo ranges instead of three fixed runs.
6. Intake in a second South African language, typed only, if the model handles it well (isiZulu and Afrikaans are not on Voice Transcribe's language list).
7. **Open-weights path (stretch, for the USD 10K "Best Build on Meta Open Weight Models" bonus).** Run one clearly bounded part of Parallax, for example the future-self chat for one path, on an open-weights model: Muse Spark Open via Baseten (`meta-models/muse-spark-open-1026`, not `meta-models/muse-spark-open`) or Muse Glimmer on Modal, behind the existing provider adapter and a config flag. The submission must flag it in round one so the infrastructure partner can verify it. Do this only after the must-ship flow is stable (not before day 6) and only if the pair chooses to chase the bonus (REVIEW.md addendum). It also doubles as the failover in RISKS.md T1.

## 4A. Use of Meta AI Tooling (a judging criterion)

"Use of Meta AI Tooling" is one of four equally weighted criteria (CONTEXT.md §5): beyond a basic integration, creative, and surfacing capabilities that surprise Meta. This section only describes how the **already-scoped** features use Meta's stack; it adds no new must-ship work, and the cuts in PLAN.md §5 stand. Technical detail: ARCHITECTURE.md §2A.

| Meta capability | How Parallax uses it beyond a basic call | Status |
|---|---|---|
| Muse Spark 1.3 (and Muse Wonder behind a flag) | An **agent loop with tools and verification**: the model proposes paths and assumptions as strict structured output (no tools there; code fills the defaults), the future-self chat calls tools (`get_figure`, `remember`) instead of doing arithmetic, and every reply is checked by the figure guard and citation check before the user sees it. Each path has its own persona and memory, so several agents with different facts talk about the same life. | Must ship (Spark); Wonder optional |
| Muse Image | One avatar per path: a base portrait, then an edit call per path so the person stays recognisable while setting and mood follow the outcome | Must ship |
| Muse Voice Transcribe | Spoken intake, with the transcript shown and confirmed before anything is extracted | Must ship (cut 5 in PLAN.md §5 if needed) |
| Structured output | Strict JSON schemas for intake extraction, paths, assumptions and the decision summary | Must ship |
| Open weights (Muse Spark Open via Baseten `meta-models/muse-spark-open-1026`, or Muse Glimmer on Modal) | See stretch goal 7 below | **Stretch only** |

**Prize fit (no extra scope).** *Best Creative Build* (Muse Image or Muse Wonder) fits the per-path avatars; *Best Agentic Use-Case* (autonomy, effectiveness, usefulness) fits the multi-path agent design in which each future self reasons from its own path and the verification layer stops it inventing figures. We do not build anything extra for these; we make sure the video shows them.

**Anti-project check.** The guide and kickoff slides list projects to avoid, among them AI medical advice, basic RAG, personality analysers, **Streamlit apps** and **dashboards as the main feature** (full list: CONTEXT.md §5). Parallax stays out of that list by leading with the simulation engine and the conversation with each future self (the compare view and charts support it; they are never the headline), by keeping health decisions out of scope (§4), by building in React and TypeScript, and by keeping the "not advice" framing (RISKS.md P7; item-by-item check in RESEARCH.md §5).

## 5. Success criteria

Our track is **Startup** (both registered, confirmed 26 Oct): technical execution, and whether it holds up in production. The official Stage 2 rubric is Impact, Use of Meta AI Tooling, Technical Depth and Execution, and Demo, equally weighted. Rows marked *(reported)* come from one secondary source (CONTEXT.md §1).

| Lens | Our bar |
|---|---|
| Technical execution | Full flow on a live URL; a new user finishes decision 1 in under 10 minutes without help |
| Holds up in production | Every model call has a timeout, bounded retries (rules in ARCHITECTURE.md §12) and a fallback; numbers still render if the model is down |
| Traceable decisions *(reported)* | Tapping any number shows its inputs and assumptions; zero avatar figures absent from the timeline |
| Faulty inputs *(reported)* | A scripted set of 20 or more bad inputs passes (table below) |
| Practical use *(reported)* | At least 3 people outside the team complete a session; feedback logged |

We still lead with talking to future selves across paths, because Impact and Demo carry half the score.

| Faulty or vague input | What Parallax does |
|---|---|
| Vague decision ("I'm stuck") | Asks one clarifying question at a time; offers the three templates |
| Missing number | Asks once; if skipped, uses a labelled default and widens the range |
| Rough answer ("about 10k") | Stores a range for the low and high runs |
| Impossible or contradictory values (age 7, expenses five times income) | Code flags them and asks to confirm |
| Mis-heard voice | Shows transcript and extracted fields for confirmation first |
| Out-of-scope decision | Says so plainly; no simulation |
| "Just tell me what to do" | Plays back priorities and trade-offs; does not choose |
| Distress or crisis language | Pauses and points to support (see [RISKS.md](RISKS.md)) |
| Model error or timeout | Retries, then falls back; inputs are never lost |

## 6. Product principles

1. **A reflection aid, not advice.** Parallax shows consequences and asks questions; the person decides.
2. **Numbers come from code.** Every figure is computed from stated assumptions. The model only writes the words, and code checks any figure it quotes.
3. **Honest uncertainty.** Ranges, not single answers; every default labelled; less input means wider ranges. "Not ready yet" is a good outcome.
4. **The user owns their data.** Minimum fields; a clear note that inputs go to Meta's model API for processing; delete any time; nothing kept or reused without their say-so.

## 7. Open questions for Lethabo

1. ~~Which skills and role do you want?~~ Answered 26 Oct: avatars, API integrations, feature integration, security ([ROLES.md](ROLES.md); every feature's lead is in [FEATURES.md](FEATURES.md)).
2. Is decision 1 the right demo, or is decision 2 or 3 closer to people you know?
3. Can you find 3 to 5 people to test intake, including voice in a range of accents?
4. Are you happy with illustrated avatars and no photo upload?
5. Is a 3-year horizon enough, or should it be 5?
6. If we reach the language stretch goal, which language matters most?
7. ~~Have you confirmed your registration is on the Startup track?~~ Yes, confirmed 26 Oct.
