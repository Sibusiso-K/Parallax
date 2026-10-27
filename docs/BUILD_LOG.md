# Build log

A dated record of what we built and when, so judges can tell exactly what was created during the Meta Global AI Developer Hackathon. The rules disqualify a project if they cannot ([CONTEXT.md](CONTEXT.md) §5).

**Kickoff: Mon 26 Oct 2026, 12:00 ET = 18:00 SAST = 16:00 UTC.** Every line of product code in this repository is written after that moment.

## Before kickoff

| What existed | When | Commits | Product code? |
|---|---|---|---|
| `.gitignore` | 20 Oct | `f4d3239` | No |
| README.md and planning docs in `docs/` (CONTEXT, SCOPE, ARCHITECTURE, PLAN, DEMO, RISKS, REVIEW) | 20 Oct; last edited before kickoff at 12:03 SAST on 26 Oct | `2a72c64`, `7e71557` | No |

Nothing else existed: no app scaffold, engine, prompts, designs in the repo or code copied from earlier projects. Commits after kickoff (`5a3b6b7` at 18:47 SAST and `3327b4b` at 18:52 SAST) changed planning docs only. They are listed under Day 1 and are still planning, not product code.

## How to write an entry

- One entry per day, oldest first, times in SAST. Append only: fix a mistake with a dated correction line, never by rewriting an old entry.
- Link the PR or commit for every change to the product.
- Name anything reused (libraries, snippets, assets) as reused, with its licence. Never present it as ours.
- No keys, account, team or project IDs, and no personal data. Credits: the amount spent, nothing else.

```markdown
## Day N · Ddd DD Mmm YYYY

**Product code written today:** yes / no

**Built** (what works tonight that did not this morning, with PR or commit links)
- …

**Meta models used today:** …

**Decisions** (who decided)
- …

**Blockers and risks**
- …

**Credits spent today (USD):** Meta … · Baseten … · Modal …

**Next**
- …
```

---

## Pre-event · Tue 20 Oct 2026

**Product code written today:** no.

**Done**
- Both of us approved for the hackathon (emails of 20 Oct).
- Created the private repo `Sibusiso-K/Parallax` with a `.gitignore` only (`f4d3239`, 16:18).
- Wrote the planning docs: context, scope, architecture, plan, demo script, risks, and an independent review that fixed 33 contradictions between them (`2a72c64`, 18:24). Opened PR #1 on `plan/hackathon-build-plan` for Lethabo's review.
- Read Meta's developer docs and recorded the facts we build on (CONTEXT.md §2.1): no Meta text-to-speech, Active Memory not exposed to developers, `-contributor` models train on our data, no isiZulu or Afrikaans in Voice Transcribe.

**Decisions:** Startup track; theme Build for Your World; demo persona Naledi Mokoena (fictional); no product code until the rules are read.

**Credits spent (USD):** 0.

## Day 1 · Mon 26 Oct 2026 (kickoff)

**Product code written today:** no (as of this entry).

**Before kickoff**
- Read the official Participant Guide and updated the planning docs with its rules, rubric, prizes, schedule and credit terms (`7e71557`, 12:03).
- Made the repo **public**, as the rules require. Checked the history first: docs only, no secrets.

**At and after kickoff (18:00)**
- Kickoff livestream. Cross-checked every doc against the kickoff slides: anti-project list (adds Streamlit apps and dashboards as the main feature), bonus-prize rules, Discord channels, credit forms in #resources, live-session names, submission link.
- Agreed the roles ([ROLES.md](ROLES.md)). Sibusiso: UI and UX, back end and the simulation engine, API integrations. Lethabo: avatars, API integrations, feature integration (figure guard, traceability), security.
- Added planning docs, not product code: ROLES.md, this build log, FEATURES.md, AGENTS_AND_APIS.md, RESEARCH.md and SUBMISSION.md; aligned the existing docs with the slides and the roles. Added `.vercel/` to `.gitignore` so Vercel project IDs never reach the public repo. All on PR #1 (`5a3b6b7`, `3327b4b`).
- Found that US clocks go back on Sun 1 Nov, so office hours (10:00 ET) move from 16:00 to 17:00 SAST from Mon 2 Nov. Kickoff, live sessions, the deadline and the closing ceremony are unaffected.

**Meta models used today:** none yet.

**Decisions**
- Roles as above (both).
- Representative: Sibusiso, proposed; Lethabo to confirm.
- Track: Startup. Both of us registered on it (confirmed 26 Oct).

**Blockers and risks**
- Credits: each of us claims our own USD 150 from #resources and adds a card; Baseten and Modal requested individually.

**Credits spent (USD):** 0.

**Next**
- Lethabo reviews PR #1; merge once we both agree.
- Join Discord, post in #intros.
- Claim credits; agree who holds the project key.
- Scaffold the app and API, deploy to Vercel, smoke-test every Meta model (PLAN.md §3, day 1).

---

## Day 2 · Tue 27 Oct 2026

**Product code written today:** no.

**Built** (planning docs only)
- Reconciled the docs with the kickoff slides, the Participant Guide and the roles: anti-project lists, Stage 3 wording, Most Viral timing, Fireworks wording, the Muse Code and SAM 3.1 question, and the safety-flag cost.
- Settled the open conflicts: the open-weights fallback is Baseten or Modal, not Fireworks; the path planner has no tools; the profile fields match ARCHITECTURE; "Ask this on another path" is on the never-cut list.
- Checked the public repo: visibility public; GitHub secret scanning and push protection enabled.

**Meta models used today:** none.

**Decisions** (who decided)
- Merge with merge commits, not squash, so the build history stays visible (Sibusiso; for Lethabo to agree).
- Decisions 2 and 3, the model-collected open-questions list and PDF export are proposed stretch (REVIEW.md H1; to agree at the next sync).
- Safety layer 2 (model flag) is costed at about USD 0.04 per session in ARCHITECTURE §14 (Lethabo to confirm).

**Blockers and risks**
- Lethabo has not reviewed PR #1 yet.
- Most Viral: whether a post before the 4 Nov deadline counts is still open; the question is not yet asked in #questions.

**Credits spent today (USD):** not recorded here yet; each of us fills in from our own Billing page.

**Next**
- Lethabo reviews PR #1, starting with ROLES.md, PLAN.md §1 and §3, and AGENTS_AND_APIS.md §2 and §5.
- Meta Engineering Workshop P1 at 18:00 SAST (recorded to #resources).
- Ask the Most Viral and track questions in #questions (Sibusiso).
