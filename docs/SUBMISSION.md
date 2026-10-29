# Submission: where and how we submit

Written 26 Oct 2026 from the kickoff slides and the Participant Guide ([CONTEXT.md](CONTEXT.md) §5). Anything marked **unknown** must be checked on the form or asked in Discord #questions. Track and theme reasoning: [RESEARCH.md](RESEARCH.md).

## 1. The essentials

| | |
|---|---|
| Where | Cerebral Valley (CV) platform: https://cerebralvalley.ai/e/meta-ai-developer-hackathon/hackathon/submit |
| Official deadline | **Wed 4 Nov, 21:00 ET = Thu 5 Nov, 04:00 SAST.** Late submissions are not considered |
| Our deadline | **Submit at 20:00 SAST on Wed 4 Nov; never later than 22:00 SAST** |
| Who submits | One appointed **Representative** enters the project, with every teammate listed |
| How many | One project per team |

## 2. The four required things *(slides)*

| # | Item | What it means for us |
|---|---|---|
| 1 | Submit on the CV platform, with every teammate | The Representative fills in the form; Sibusiso Khumalo and Lethabo Hoaeane are both listed. **Unknown:** whether each teammate must accept an invite or join on the platform, so Lethabo logs in to CV by Tue 3 Nov to check |
| 2 | A 3-minute demo video | Shows only what we built during the event; judges score from it (§4) |
| 3 | A public GitHub repo | Must open in a logged-out browser (§3) |
| 4 | Before the deadline | Do not wait for the last hour |

## 3. Representative and the logged-out repo check

**Representative: Sibusiso (proposal, Lethabo to confirm on day 1).** Back-up: Lethabo, who must be able to log in to CV and submit if Sibusiso loses power or internet.

**Logged-out check** (both of us, on 3 Nov and again just before submitting):

1. Open a private or incognito window, not logged in to GitHub.
2. Paste the repo URL exactly as it will appear on the form.
3. Confirm that the README, `docs/` and source code open, and that the commit history is visible.
4. Open the video link and the live URL in the same window; both must play or load without a login.
5. Check that no secret, API key or personal data is in the repo, its history or the video.

## 4. The 3-minute video

| Rule | How we meet it |
|---|---|
| At most 3:00 | Script in DEMO.md §3; trim to 2:55 to be safe |
| Only what we built during the event (else disqualification) | Every scene is the Parallax app built from 26 Oct; libraries are named as dependencies, never shown as ours |
| Judges score from it | Show all four criteria (DEMO.md §1A); burned-in captions; 1080p |
| Link must work | YouTube (public or unlisted) or another host that plays without a login; test it logged out |
| Honesty | Fictional persona labelled on screen; any sped-up wait labelled; no real personal data |

## 5. Making "built during the event" obvious

The rules disqualify anything not clearly identified as event work. The only pre-kickoff material is the planning docs written 20 to 26 Oct before 18:00 SAST (README.md says so). Docs written after kickoff are still planning, not product code. [BUILD_LOG.md](BUILD_LOG.md) records, day by day, what was built and when.

- **README section "Built during the hackathon":** kickoff time (26 Oct, 12:00 ET = 16:00 UTC); a list of the pre-kickoff files; the first product-code commit.
- **A tag on the last pre-kickoff commit, `7e71557`** (26 Oct, 12:03 SAST; for example `pre-kickoff`), plus a GitHub compare link from that tag to `main`, so a judge sees every line added during the event in one view. Tags add a label; they do not rewrite history.
- **Small, dated commits** pushed daily; never squash or rewrite history before submission.
- **In the video:** one second of the commit history starting 26 Oct, and the words "built between 26 October and 4 November".
- **Docs written during the event** (this file, RESEARCH.md and the others) are planning, not product, and say so.

## 6. Field-by-field draft

The exact form fields are **unknown** until we open the form. This is what we expect to need.

| Field | Draft or what we need | Owner | Status |
|---|---|---|---|
| Project name | Parallax | — | Ready |
| One-line pitch | "Try a career or money decision before you live it: Parallax simulates each path for 36 months and lets you talk to your future self on each one." | Lethabo | Draft |
| Description | Opens with the theme statement (RESEARCH.md §2); then problem, what it does, how Meta's models are used, what was built during the event, and "a reflection aid, not financial advice" | Sibusiso | To write by 3 Nov |
| Track | Startup (both registered, confirmed 26 Oct) | — | Ready |
| Theme | Build for Your World | — | Ready |
| Team members | Sibusiso Khumalo, Lethabo Hoaeane (as registered) | Representative | Ready |
| Repo URL | Public GitHub URL, checked logged out | Sibusiso | To fill in |
| Video URL | 3-minute video, checked logged out | Lethabo | To fill in |
| Live demo URL | Hosted app, with no passcode that blocks judges (REVIEW.md M3) | Sibusiso | Unknown whether the form asks |
| Meta models used | Muse Spark 1.3 (structured output, tool calls, future-self chat); Muse Image (base portrait plus an edit per path); Muse Voice Transcribe (spoken intake); Muse Wonder only if shipped | Sibusiso | Update on 4 Nov |
| X post link | URL of the demo post, for Most Viral Project | Sibusiso | Post before submitting |
| Open-weights flag | Only if an open-weights path ships: model, host (Baseten or Modal) and which feature uses it (FEATURES.md F31) | Lethabo | Stretch; leave blank otherwise |
| Bonus opt-ins | Best Creative Build, Best Agentic Use-Case | Representative | Unknown whether the form asks |
| Pre-existing work | "Planning docs only (20 to 26 Oct); no product code before kickoff" | Sibusiso | Ready |
| Gallery thumbnail and blurb | For the Community Vote | Lethabo | Unknown whether the form asks |

## 7. Timeline in SAST

US clocks go back on Sun 1 Nov, so ET is 6 hours behind SAST until then and 7 hours behind from 1 Nov.

| When (SAST) | What |
|---|---|
| Mon 26 Oct, 18:00 | Kickoff; claim credits from #resources |
| Thu 29 Oct | Day-4 checkpoint; track decided |
| Sat 31 Oct | Feature freeze |
| Tue 3 Nov | Last full day for questions to organisers; video recorded; fields drafted; Lethabo checks CV access; logged-out check |
| Wed 4 Nov, 16:00 | Code freeze, final deploy, tag |
| Wed 4 Nov, 18:00 | Video uploaded and checked logged out |
| Wed 4 Nov, 19:00 | X post live |
| **Wed 4 Nov, 20:00** | **Submit (target)** |
| Wed 4 Nov, 22:00 | Latest internal time |
| Thu 5 Nov, 04:00 | Official deadline |
| 5 to 8 Nov | Judging: keep the app up and credits reserved |
| Mon 9 Nov, 06:59 | Most Viral counting ends (8 Nov, 23:59 ET) |
| Mon 9 Nov, 19:00 | Closing ceremony and live final round |
| Mon 16 Nov | Community Vote winner announced on Discord |

## 8. Final pre-submit checklist

- [ ] The submission shows the Startup track.
- [ ] Theme statement is in the first lines of the description and README.
- [ ] Repo, video and live URL all open in a logged-out window.
- [ ] No secrets, keys or personal data in the repo, its history or the video.
- [ ] README has "Built during the hackathon", the tag and the compare link.
- [ ] Video is 3:00 or less, captioned, shows only event work, fictional persona labelled.
- [ ] Both teammates listed; Lethabo has confirmed he can see the project on CV.
- [ ] Meta models listed exactly as used; open weights flagged only if real.
- [ ] X post live and its link on the form.
- [ ] Credits left for judging 5 to 8 Nov.
- [ ] Confirmation screen or email saved; both told in team chat.

**Questions to ask in #questions by Tue 3 Nov:** must every teammate accept on CV? Can a submission be edited after it is sent? Do bonus prizes need an opt-in? Does X engagement before 4 Nov count? Must the models the rules list (Muse Code, SAM 3.1) be used inside the product, or is "Meta Model API and/or open-weight models" (Stage 1) enough?
