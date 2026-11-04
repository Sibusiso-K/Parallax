# Research: fit, rubric, anti-projects, prizes and landscape

Written 26 Oct 2026 from the Participant Guide ([CONTEXT.md](CONTEXT.md) §5) and the kickoff slides. **Rewritten Sun 1 Nov 2026 (day 7)** for the founder direction ([FOUNDERS.md](FOUNDERS.md)) and after re-reading the guide signed in: the rubric is now weighted. Confidence labels follow CONTEXT.md: **confirmed** (organiser's own material), **reported** (secondary source), **unknown**.

## 1. Summary

1. **Theme:** *Build for Your World* fits better than before: we are founders, and deciding under uncertainty is the problem we live with. Stage 1 (pass/fail) is safe as long as each Meta model visibly does a job.
2. **Track:** **Indie**, switched from Startup on 2 Nov after Discord confirmed that a team of two may enter Indie. Indie is "individual builders and students", judged on creativity, technical ambition and whether it works. Parallax is a product *for* founders, built by two of them.
3. **The rubric is weighted** (guide re-read 1 Nov): **Impact 30%**, Use of Meta AI Tooling 25%, Technical Depth and Execution 20%, Demo 25%. Impact is the biggest lever, which is why the founder direction matters.
4. **Biggest scoring levers:** the contract that looks profitable but runs out of cash in month 4 if the client pays late (Impact, Demo), and the grounded per-path founder agents (Meta tooling, Technical Depth).
5. **Anti-projects:** the main risk is now "dashboards as the main feature", because the chosen design (Mockup 5, Control Room) is dense and data-heavy. The avatar and the conversation must lead (§5, DESIGN.md §0).
6. **Bonus prizes:** Most Viral (USD 20K) is a real chance now, because founders on X are both the audience and the users. Best Agentic Use-Case and Best Creative Build cost nothing extra. Open weights stays a late, optional call (§6).

## 2. Theme fit (confirmed: slides and guide)

Both tracks can build toward either theme. We enter **Build for Your World**: bring Meta's models into your own domain, solve a problem you know firsthand, free up time and mental space, and make something possible that wasn't before.

| What the theme asks | Parallax |
|---|---|
| Your own domain, a problem you know firsthand | We are two founders in Johannesburg; brainstorming and deciding is most of our week. Our beachhead, owner-led food businesses, is a world we know (FOUNDERS.md §4) |
| Free up time and mental space | Turns days of circling one decision, or a spreadsheet nobody trusts, into one session that ends in a decision memo or an honest "not ready yet" |
| Something possible that wasn't before | Rehearsing a decision before making it: three futures, 36 months of cash each, stress-tested, with the founder you would become answering your questions |
| Bring Meta's models in | Spark (agents), Image (a founder avatar per path), Voice Transcribe (spoken intake); open weights optional |

*Push the Frontier* (software, robotics, manufacturing, energy, materials) does not fit and is not considered.

**Stage 1 (pass/fail):** "reasonably fits the theme and reasonably used Meta Model API and/or Meta's open-weight models". Pass, provided the README, the video and the submission name each model and what it does.

## 3. Track fit

| | Indie Developer | Startup |
|---|---|---|
| For (guide) | Individual builders and students | Teams and founders building a real product |
| Judged on (guide) | Creativity, technical ambition, whether it works | Technical execution, whether it holds up in production |
| Prizes, USD | 150K / 100K / 75K / 50K / 25K (400K) | 250K / 150K / 75K / 50K / 25K (550K) |
| Our fit | A team of two, not students entering alone | A real product for founders, built by founders, hardened for production (timeouts, failover, fixture mode, traceability, 107 tests) |
| Status | Not entered | **Both of us registered here (confirmed 26 Oct)** |

The guide adds: "Startups may build on existing products or codebases, but you must clearly identify what was newly developed." We bring none, so everything is new; BUILD_LOG.md and the README say so.

## 4. Rubric mapping (weights confirmed 1 Nov)

Stage 2: four criteria, 0–10 each, weighted. Stage 3: the top 5 per track go to a final round where judges "watch the video demos live and rank them using the same rubric", so the video is what wins the final. Feature IDs from [FEATURES.md](FEATURES.md).

| Criterion (weight) | What judges ask (guide) | Our evidence | Gap to close | Owner |
|---|---|---|---|---|
| **Impact (30%)** | Real-world potential; who benefits and how much; could people actually use it; fits a problem statement | About three million SA MSMEs; cash decisions as a leading cause of failure; late payment as a local fact (FOUNDERS.md §2); a beachhead and four business-model routes (FOUNDERS.md §6); no books needed | **One real founder's reaction** (with consent) by Tue 3 Nov; cite every statistic | Both |
| **Use of Meta AI Tooling (25%)** | How creatively; beyond a basic integration; surfaces capabilities that surprise Meta | Spark in a verified agent loop; one founder agent per path, each seeing only its path; the figure guard; Image avatars (one base portrait, one edit per path); Voice Transcribe intake | The agents (F10) and avatars (F9) must be live by Mon 2 Nov evening; a "Built on Meta" beat naming each model's job | Lethabo |
| **Technical Depth and Execution (20%)** | Sound, refined engineering; real craft | Engine with unit and stress tests; faulty-input script; quotes checked against the text; fixture mode; failover | Show the figure guard replacing an invented number live | Lethabo (guard), Sibusiso (engine) |
| **Demo (25%)** | Working, impressive, holds up live; the video is genuinely cool to watch | The late-payment moment (DEMO.md §2); a live assumption edit; "Ask this on another path" | Recording quality; keep the live URL up 5–8 Nov | Both |

## 5. Anti-project check (confirmed: guide and slides)

The guide's list: AI medical advice (including mental-health advisers and skin-blemish detectors), basic RAG apps, simple image analysers, simple "AI for Education" chatbots, AI job-application screeners, AI nutrition coaches, personality analysers, sports analysers or coaches, anything political or involving war. The kickoff slides added Streamlit apps and dashboards as the main feature. Neither list is complete.

| Anti-project | Risk for Parallax | How we stay clear |
|---|---|---|
| **Dashboards as the main feature** | **High** (the Control Room design is data-dense) | The founder avatar and the conversation lead every screen; charts support them; the video opens on the founder's question and the late-payment moment, never on a chart (DESIGN.md §0) |
| AI-generated medical advice | Low | Health decisions are out of scope and redirected; the crisis card shows hard-coded helplines only (RISKS.md S5) |
| Basic RAG apps | Low | No retrieval: a simulation engine plus agents |
| Simple image analysers | Low | We generate images; no photo upload |
| Streamlit apps | Low | React, Vite and TypeScript |
| "AI for Education" chatbots | None | — |
| AI job-application screeners | Low | The hire template models cost and sales; it never screens, ranks or reads CVs |
| AI nutrition coaches | None | Food businesses, but no nutrition content |
| **Personality analysers** | Medium | The profile is the business's figures, a self-reported risk comfort and chosen priorities; no psychological profiling |
| Sports analysers or coaches | None | — |
| Political or war content | Low | None in the demo, prompts or templates |

Not on the list but close: **financial advice**. We frame Parallax as a reflection aid, name no banks, lenders or products, decline investment advice, and keep loans and investors out of the MVP (RISKS.md P1).

## 6. Bonus prizes: where we can win

| Prize | Rule (guide) | Our fit | Extra effort | Recommendation |
|---|---|---|---|---|
| **Most Viral Project, 20K** | Highest engagement on X after the event; post the demo on X and submit the link; likes, reposts and comments up to 8 Nov EOD | **Strong:** founders on X are our users; "One late payment on this contract runs my business out of cash in month 4" is a hook founders share | A 30-second hook, a thread, replies for four days | **Do it** (DEMO.md §3) |
| **Community Vote, 10K** | Most votes in the public gallery, one per verified account; announced 16 Nov | Good: SA founder and developer communities, incubators | Share the gallery link from 9 Nov; no vote buying | **Do it** |
| **Best Agentic Use-Case, 5K** | Strongest use of agents to complete meaningful tasks, make decisions or coordinate multi-step workflows; autonomy, effectiveness, practical usefulness | **Strong:** intake agent, path planner, one founder agent per path with tools, verification on every reply | None beyond showing the loop | **Do it**: one video beat on the agent loop |
| **Best Creative Build, 5K** | Most original creative project with Muse Image or Muse Wonder; flagged in round one | Good: the same founder on three paths (a crowded home kitchen, a commercial kitchen, a steady café) | None beyond showing base portrait → per-path edits | **Do it**, if F9 ships |
| **Best Build on Meta Open Weights, 10K** | Muse Glimmer or Muse Spark Open on own hardware or partner inference; flagged in round one; partner verifies | Only through F31 | A second provider and its credits | **Only if** F10 and F9 work by Mon 2 Nov evening; otherwise skip |

The submission form has a field for the X post link and none for bonus opt-ins (checked 1 Nov, CONTEXT.md §5); "flagged in round one" seems to be done by the judges.

## 7. Landscape

The full competitor analysis is [COMPETITORS.md](COMPETITORS.md). In one line: cash-flow tools and accounting AI start from the books and add a what-if; chatbots talk but invent numbers; Parallax starts from the decision, needs no books, and lets the founder talk to each future with figures computed in code.

The earlier research on simulated future selves still holds as background: MIT Media Lab's *Future You* preprint reports that a conversation with a simulated future self reduced anxiety and raised future-self continuity (arXiv 2405.12514, 2024), though not self-reflection. Parallax applies the idea to a business decision, with several futures and checkable figures.

## 8. Recommendations

1. Lead every artefact (video, README, submission, X post) with the founder's question and the late-payment moment.
2. Get the founder agents (F10) and avatars (F9) live by Mon 2 Nov evening; everything else in the video depends on them.
3. Get one real founder (outside the team, with consent) through a session by Tue 3 Nov and quote one line (Impact).
4. Source the placeholder defaults in `shared/defaults/za.json` that the demo shows, or label them "placeholder" on screen.
5. Add Lethabo as a team member on the submission form (it lists only Sibusiso today) and check the registration answers on the Indie form (CONTEXT.md §5).
6. Post the demo on X as soon as the video is final; reply to comments until 8 Nov (Most Viral).
7. Decide open weights at the Mon 2 Nov sync, not later.
8. Keep BUILD_LOG.md daily; days 3 to 6 still need entries.

## Sources

- Participant Guide: https://cerebralvalley.ai/e/meta-ai-developer-hackathon/details (read 26 Oct; re-read signed in on 1 Nov 2026, CONTEXT.md §5)
- Kickoff slides, 26 Oct 2026
- Founder research: [FOUNDERS.md](FOUNDERS.md); competitors: [COMPETITORS.md](COMPETITORS.md)
- Pataranutaporn et al., *Future You*, arXiv:2405.12514 (2024); MIT Media Lab project: https://www.media.mit.edu/projects/future-you/overview/
