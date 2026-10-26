# Research: fit, rubric, anti-projects, prizes and landscape

Written 26 Oct 2026 from the Participant Guide ([CONTEXT.md](CONTEXT.md) §5) and the kickoff slides shown at 18:00 SAST the same day. Confidence labels follow CONTEXT.md: **confirmed** (organiser's own material), **reported** (secondary source), **unknown**.

## 1. Summary

1. **Theme:** Parallax fits *Build for Your World* closely. Stage 1 (pass/fail) is safe as long as each Meta model visibly does a job.
2. **Track:** **Startup**, confirmed 26 Oct (both registered). The four Stage 2 criteria are the same on both tracks; only the emphasis differs.
3. **Biggest scoring lever:** Technical Depth and Use of Meta AI Tooling both rest on the grounded future-self chat (F10, F11). Build it early.
4. **Anti-projects:** we are clear of all ten on the slide, but three need care in how we present: medical advice, dashboards as the main feature, and personality analysers.
5. **Bonus prizes:** Best Agentic Use-Case and Best Creative Build cost nothing extra; Most Viral and Community Vote cost only effort; Best Build on Open Weights is real work and stays a day-6 decision.
6. **Landscape:** MIT Media Lab's *Future You* showed that talking to a simulated future self can reduce anxiety. Parallax goes further: several futures for one real decision, with figures computed in code.

## 2. Theme fit (confirmed: slides and guide)

Both tracks can build toward either theme. We enter **Build for Your World**: bring Meta's models into your own domain, solve a problem you know firsthand, free up time and mental space, and make something possible that wasn't before.

| What the theme asks | Parallax |
|---|---|
| Your own domain, a problem you know firsthand | Johannesburg: supporting family, side businesses and thin savings are everyday life for people we know (DEMO.md §4) |
| Free up time and mental space | Turns weeks of circling one decision into one session that ends in a written summary, or an honest "not ready yet" |
| Something possible that wasn't before | Trying a path before living it: talking to the person you would become on each path, grounded in your own numbers |
| Bring Meta's models in | Spark (agents), Image (avatars), Voice Transcribe (spoken intake); open weights optional |

*Push the Frontier* (software, robotics, manufacturing, energy, materials) does not fit and is not considered.

**Stage 1 (pass/fail):** "reasonably fits a theme and uses Meta AI products". Pass, provided the README, the video and the submission name each model and what it does.

## 3. Track fit

| | Indie Developer | Startup |
|---|---|---|
| For (slides) | Individual builders and students | Teams and founders building a real product |
| Judged on (slides) | Creativity, technical ambition, whether it works | Technical execution, whether it holds up in production |
| Prizes, USD | 150K / 100K / 75K / 50K / 25K (400K) | 250K / 150K / 75K / 50K / 25K (550K) |
| Our fit | We are a team of two, not students entering alone | We are a team; our design is built around production hardening (timeouts, failover, fixture mode, traceability) |
| Status | Not entered | **Both of us registered here (confirmed 26 Oct)** |

**Decision: Startup.** The Stage 2 rubric is the same four criteria on both tracks; the Startup wording adds weight to holding up in production, which our design already targets. "Startups can bring a product, but only work from the event counts": we bring none, so everything in the product is new.

## 4. Rubric mapping

Stage 2: four equally weighted criteria, 0–10 each. Stage 3: the top 5 per track demo live on Mon 9 Nov and are ranked with the same rubric. Feature IDs from [FEATURES.md](FEATURES.md).

| Criterion | What judges look for (guide) | Our evidence | Gap to close | Owner |
|---|---|---|---|---|
| **Impact** | Real-world potential, who benefits, could people use it, fits a problem statement | Naledi's story; people with the least safety net; "reflection aid, not advice"; works in any country by configuration | No one outside the team has used it. Run 3 external sessions on day 7 or 8 and quote one reaction (with consent) | Both |
| **Use of Meta AI Tooling** | Creative, beyond a basic integration, surfaces capabilities that surprise Meta | Spark in a verified agent loop with tools; per-path agents with their own memory; Image base portrait plus per-path edits; Voice Transcribe intake; structured output everywhere | A "Built on Meta" beat in the video naming each model's job; the open-weights path only if chosen | Lethabo |
| **Technical Depth and Execution** | Sound, refined engineering, real craft | Engine with unit tests; figure guard; citation IDs; trace drawer; failover chain; faulty-input handling | The figure guard must work live, not only in the plan; show it replacing an invented number | Lethabo (guard), Sibusiso (engine) |
| **Demo** | Works, impressive, holds up live; the video is genuinely cool to watch | 3-minute script with a cold open, live assumption edit, faulty-input catch | Recording quality and pace; keep the live URL up and credits reserved for 5–8 Nov | Both |

## 5. Anti-project check (confirmed: slide "Skip these overdone projects", plus the guide)

The slide says the list is not complete, and medical advice includes tools such as AI mental-health advisers and skin-blemish detectors. The guide adds anything political or involving war.

| Anti-project | Risk for Parallax | How we stay clear |
|---|---|---|
| AI-generated medical advice | **Medium** | Health decisions are out of scope and redirected. The crisis support card shows hard-coded helplines only; Parallax never counsels or diagnoses (RISKS.md S5) |
| Basic RAG apps | Low | No retrieval product: a simulation engine plus agents |
| Simple image analysers | Low | We generate images; we never analyse the user's photo (no photo upload) |
| Streamlit apps | Low | React + Vite + Vercel Functions in TypeScript |
| **Dashboards as the main feature** | **Medium** | Charts and the compare view support the conversation; the headline is talking to your future selves. The video never opens on a chart |
| "AI for Education" chatbots | Low | Path C involves a study loan, but Parallax teaches nothing |
| AI job application screeners | Low | Career decisions, but no screening, ranking or CVs |
| AI nutrition coaches | None | — |
| **Personality analysers** | **Medium** | The profile holds money facts, a self-reported risk comfort and chosen priorities. No personality or psychological profiling, no inferred traits |
| Sports analysers or coaches | None | — |
| Political or war content | Low | None in personas, prompts or the demo |

Not on the list but close: **financial advice** (South Africa's FAIS Act). We frame Parallax as a reflection aid, name no products or lenders, and the avatars refuse investment advice (RISKS.md P1, P7).

## 6. Bonus prizes (confirmed: slides)

| Prize | Fit | Extra effort | Recommendation |
|---|---|---|---|
| **Most Viral Project, 20K:** most likes, reposts and comments on the X post of the demo by 8 Nov 11:59 PM ET (9 Nov 06:59 SAST) | Any project can win; a talking future self is shareable | A 30-second hook, a short thread, replies for four days | **Do it** (DEMO.md §3). Ask whether a post before the deadline counts, since the slide says "after the event" |
| **Best Build on Meta Open Weights, 10K:** Muse Glimmer or Muse Spark Open, own hardware or partner inference; flagged in round one; the infra partner verifies it | Only through F31 | Second provider, Baseten or Modal credits, verification, risk to the core | **Decide on day 6.** Request Baseten and Modal credits on day 1 anyway so the option stays open |
| **Community Vote, 10K:** most gallery votes, one per verified account; announced 16 Nov | Any project | Share the gallery link widely from 9 Nov; no vote buying | **Do it** |
| **Best Agentic Use-Case, 5K:** agents that complete tasks, make decisions or run multi-step workflows; scored on autonomy, effectiveness, usefulness | Strong: the multi-step flow plus per-path agents with tools, memory and verification | None beyond showing it | **Do it**: one video beat on the agent loop (AGENTS_AND_APIS.md §2) |
| **Best Creative Build, 5K:** most original creative project with Muse Image or Muse Wonder; flagged in round one | Good: one future self per path, the same face in different lives | None beyond showing it | **Do it**: flag it, and show base portrait → per-path edits |

## 7. Landscape

| Work | What it is | What Parallax adds |
|---|---|---|
| **Future You, MIT Media Lab (2024)**, with Hal Hershfield (UCLA) | A chat with a simulated 60-year-old version of yourself, built from a questionnaire and an age-progressed photo. The authors' preprint reports lower anxiety and negative emotion and higher future-self continuity (arXiv 2405.12514), but no gain in self-reflection or insight (UCLA Anderson Review). Target users 18–30 (reported) | Not one generic future but **several, one per path of a real decision**; every figure computed in code with ranges and sources; a comfort check and decision summary aimed squarely at the reflection Future You did not move; no photo of the user |
| **Future You, multimodal follow-up (2025 preprint, arXiv 2512.06106)** | Age-progressed, animated "digital twins" with conversation; measures continuity, engagement, trust and persuasion (results not yet read) | We deliberately avoid photoreal likeness and animated faces (RISKS.md L4, L5) |
| Hershfield et al. on age-progressed renderings and saving | Seeing an aged image of yourself increased saving in lab studies (reported, from memory: check the paper before quoting) | The idea behind per-path avatars, applied to a decision rather than retirement saving |
| General chatbots (Meta AI and others) asked "should I quit my job?" | Fluent, generic, invents numbers, gives one answer | Grounded figures, several futures, traceable answers, no verdict |
| Spreadsheets, budget and loan calculators | Correct arithmetic, no story, no uncertainty, no conversation | The same arithmetic, explained by the person you might become |
| Bank and robo-adviser tools | Regulated advice tied to products | No products, no advice: reflection only |

**Pitch line we can defend:** "Research from MIT's Media Lab found that talking to a future self can reduce anxiety about the future. Parallax lets you talk to each future a decision could lead to, with numbers you can check." Cite the preprint in the README, not just in the video.

## 8. Recommendations

1. Build the figure guard against fixtures on day 2 (Lethabo) and the engine's figure keys the same day (Sibusiso), so F10 and F11 work live by day 4.
2. Open the video on Naledi's question, never on a chart; keep the compare view as support.
3. Give every Meta model one visible job in the video and one line in the README.
4. Flag Best Creative Build and Best Agentic Use-Case in the submission; ask in #questions how bonus prizes are flagged.
5. Run three sessions with people outside the team on day 7 or 8 for Impact.
6. Request Baseten and Modal credits on day 1; decide the open-weights path at the day-6 checkpoint.
7. Ask in #questions on day 1: does an X post made before 4 Nov 21:00 ET count for Most Viral?
8. Keep BUILD_LOG.md daily so judges can tell exactly what was built during the event.

## Sources

- Participant Guide: https://cerebralvalley.ai/e/meta-ai-developer-hackathon/details (read 26 Oct 2026, CONTEXT.md §5)
- Kickoff slides, 26 Oct 2026 (tracks, themes, rules, anti-projects, prizes, timeline, Discord, credits, judging, submissions)
- MIT Media Lab, Future You project: https://www.media.mit.edu/projects/future-you/overview/ and https://futureyou.media.mit.edu/research/
- Pataranutaporn et al., *Future You: A Conversation with an AI-Generated Future Self Reduces Anxiety, Negative Emotions, and Increases Future Self-Continuity*, arXiv:2405.12514 (2024)
- *Future You: Designing and Evaluating Multimodal AI-generated Digital Twins for Strengthening Future Self-Continuity*, arXiv:2512.06106
- UCLA Anderson Review on the Future You study: https://anderson-review.ucla.edu/young-adults-with-an-ai-bot-chat-with-their-60-year-old-selves
