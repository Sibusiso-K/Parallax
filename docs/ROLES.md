# Roles: who owns what and how we work together

Agreed 26 Oct 2026 (kickoff day). This replaces the role proposal in the 20 Oct drafts. [PLAN.md](PLAN.md) §1 holds the short version and §3 the day-by-day work; [FEATURES.md](FEATURES.md) names a lead for every feature.

## 1. The team

| | Sibusiso Khumalo | Lethabo Hoaeane |
|---|---|---|
| GitHub | [Sibusiso-K](https://github.com/Sibusiso-K) (repo owner) | [LethaboMH14](https://github.com/LethaboMH14) (collaborator) |
| Time zone | SAST (Johannesburg) | SAST *(to confirm)* |
| Leads | UI and UX, back end (including the simulation engine), API integrations (the routes the UI calls) | Avatars, API integrations (the model-API client and agents), feature integration (including the figure guard and traceability), security |
| Submission | Representative *(proposal; Lethabo to confirm)* | Back-up Representative: can log in to the CV platform and submit if Sibusiso cannot |

## 2. Areas

**Owner** makes sure it gets done and decides within the area. **Support** reviews the PRs, knows enough to take over if the owner is offline, and helps when asked.

| Area | Owner | Support | Includes |
|---|---|---|---|
| UI and UX | Sibusiso | Lethabo | Every screen (start, intake, profile, paths, assumptions panel, chat, switcher, compare, comfort check, summary), design, accessibility, phone widths, loading and error states |
| Back end | Sibusiso | Lethabo | Vercel Functions in `/api`, request shapes, SSE streaming, input validation, IndexedDB store |
| Simulation engine | Sibusiso | Lethabo | `/shared/engine`: monthly cash flow, bad / likely / good runs, milestones, setbacks, sensitivity, figure keys, sourced ZA defaults, unit tests |
| API integrations | **Both** | — | Lethabo: the Meta Model API client (retries, timeouts, structured output, failover, trace entries) and every agent and prompt. Sibusiso: the API routes the UI calls and how they use the client |
| Avatars | Lethabo | Sibusiso | Muse Image art style, base portrait plus one edit per path, caching, fallback badge, AI-generated label |
| Feature integration | Lethabo | Sibusiso | Wiring intake → simulation → avatar → chat → switch → summary end to end; future-self agents and memory; the figure guard and citation check; the trace log; voice input; the seeded demo session and fixture mode |
| Security | Lethabo | Sibusiso | Keys and secrets, the secrets scan, `-contributor` guard, abuse and rate guard that cannot block judges, prompt-injection and faulty-input tests, crisis-detection tests, Delete everything, public-repo hygiene ([AGENTS_AND_APIS.md](AGENTS_AND_APIS.md) §5) |
| README and technical write-up | Sibusiso | Lethabo | Lethabo writes the security and data notes |
| Demo video and pitch | Both | — | Who presents is decided on day 6 |
| Submission | Sibusiso (Representative, proposal) | Lethabo | [SUBMISSION.md](SUBMISSION.md) |

**Where our work meets.** Shared types and Zod schemas in `/shared` are the contract: the engine's figure keys feed Lethabo's figure guard; Sibusiso's routes call Lethabo's client; the UI renders what the agents return. A change to `/shared/types.ts` or `/shared/schemas.ts` goes in its own small PR that the other person approves before anything builds on it.

## 3. How we work together

We work fluidly. Ownership says who makes sure something happens, not who is allowed to touch it.

- **Daily sync, 15 minutes:** 08:30 SAST on weekdays, 10:00 on the weekend (Lethabo may move it). Each says what they finished, what they do today, what blocks them, and credits spent. Decisions go in [BUILD_LOG.md](BUILD_LOG.md) the same day.
- **Small PRs, reviewed by the other person:** one concern, roughly under 300 changed lines, on a `feat/…`, `fix/…` or `docs/…` branch. The other person reviews on the Vercel preview, ideally within four waking hours. Squash-merge; `main` is always deployable.
- **Work-in-progress handovers:** stopping mid-task, or about to go offline? Push the branch, open a draft PR and post this in it:
  > **Handover:** what works · what is half done · next step · how to run it · anything surprising
- **Owners decide in their own area.** The other person gives input in review; if we still disagree, the owner decides and we move on.
- **Scope calls are joint:** adding or cutting a feature, changing the demo script, or changing a never-cut item (PLAN.md §5). Made at the sync or at the day-4 and day-6 checkpoints, never alone.
- **Working in the other's area:** say so on the board or in team chat first, then the owner reviews the PR.
- **If one of us is offline** (illness, power or internet cuts): the Support person takes over that area from the latest handover note. Push small commits daily so nothing lives only on one laptop.
- **Where to talk:** team chat for the day-to-day; GitHub issues and PRs for anything we must find again; Discord #questions (Cerebral Valley, ping @CV) and #office-hours (Meta) for the organisers.

## 4. Live sessions and office hours

Live sessions run 18:00–19:00 SAST and are recorded to #resources.

| Date | Session | Who attends |
|---|---|---|
| Tue 27 Oct | Meta Engineering Workshop P1: Agents 101 (Suraj Subramanian, Meta) | Both |
| Wed 28 Oct | Meta Engineering Workshop P2: Verifiable Agents (Yash Khare, Meta) | Both: it is our figure-guard and traceability design |
| Fri 30 Oct | Fireworks AI Workshop (Sinan Ozdemir, Fireworks AI) | Lethabo if free (open weights); otherwise the recording |

**Office hours** are weekdays only, text only, 10:00–11:00 ET: **16:00–17:00 SAST until Fri 30 Oct, then 17:00–18:00 SAST from Mon 2 Nov** (US clocks go back on Sun 1 Nov). Tue 3 Nov is the last full day for submission questions.

## 5. Credits each of us must claim individually

Nobody can claim for the other. Request forms are in Discord **#resources** from kickoff. The Meta deadline is Wed 4 Nov 21:00 ET (Thu 5 Nov 04:00 SAST), but claim on day 1.

| Credit | Amount | Who gets it | How | Sibusiso | Lethabo |
|---|---|---|---|---|---|
| **Meta Model API** | USD 150 | Every participant | Form in #resources; **a credit card must be on the account** to make calls; set a Spend Limit notification on the Billing page | ☐ | ☐ |
| Baseten | USD 100 + 2M TPM | Up to 2,000 participants, reviewed on use case | Request form; use model `meta-models/muse-spark-open-1026` | ☐ | ☐ |
| Modal | USD 100 | First 1,000 participants | Request form; for Meta open-weights models | ☐ | ☐ |
| Fireworks | USD 25 | Select participants only | By invitation; do not plan on it | — | — |

- The pair has USD 300 of Meta credits only once **both** have claimed and attached a card.
- Agree on day 1 which account holds the project's `MODEL_API_KEY` (rate limits are per Meta team). The key goes straight into Vercel environment variables, never into chat, Discord or the repo.
- Log the amount spent each day in BUILD_LOG.md; nothing else about the accounts.

## 6. Still to settle

1. Lethabo confirms the Representative (proposal: Sibusiso) and that he can log in to the CV platform.
2. Who presents in the video and the live final (decided on day 6).
3. Lethabo's daily hours, time zone and Vercel username (PLAN.md §7).
4. Startup or Indie: answer from #questions.
