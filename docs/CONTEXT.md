# Context: the hackathon and the facts we build on

Shared source of truth for every planning doc. If another doc disagrees with this one, this one wins until someone updates it with a source.

Confidence labels: **confirmed** = read on the organiser's own page (or, for the Model API, on Meta's developer docs at dev.meta.ai); **reported** = news or secondary source; **unknown** = not published yet, do not assume.

**Updated 26 Oct 2026 (kickoff day):** the official Participant Guide is now read and most earlier "unknown" items are resolved. The full facts are in [section 5](#5-official-participant-guide-read-26-oct-2026), cross-checked that evening against the kickoff slides (18:00 SAST); where an older line below disagrees with section 5, section 5 wins.

---

## 1. The event (confirmed, cerebralvalley.ai/e/meta-ai-developer-hackathon, read 18–19 Oct 2026)

- **Name:** Meta Global AI Developer Hackathon, hosted by Meta and Cerebral Valley. Virtual, worldwide.
- **Prize pool:** USD 1,000,000 cash: Indie USD 400,000, Startup USD 550,000, plus USD 50,000 in bonus prizes (confirmed in the Participant Guide, section 5).
- **Both of us are approved** (Sibusiso and Lethabo, emails of 20 Oct 2026).

### Dates (SAST, Africa/Johannesburg)

| What | ET (organiser) | SAST |
|---|---|---|
| Kickoff livestream, build starts | 26 Oct, 12:00 | **26 Oct, 18:00** (confirmed by the guide and the event email, "12PM EST / 9AM PT"; the earlier 19:00 reading is wrong) |
| Live sessions (27, 28, 30 Oct) | 12:00 – 13:00 | 18:00 – 19:00 |
| Daily Discord office hours (text only, **not weekends**) | 10:00 – 11:00 | 16:00 – 17:00 until Fri 30 Oct; **17:00 – 18:00 from Mon 2 Nov** (US clocks go back on Sun 1 Nov; SAST does not change) |
| **Submission deadline** (CV platform; final office hours at the same time) | **4 Nov, 21:00 ET** | **5 Nov, 04:00** (treat 4 Nov 22:00 SAST as our real deadline; late submissions are not considered) |
| Judging period | **5 – 8 Nov** | same |
| Closing ceremony, live final round | 9 Nov, 12:00 | 9 Nov, 19:00 |
| Community vote winner announced (Discord) | 16 Nov | same |

Submission requirements, rules and judging criteria are now confirmed: see section 5.

### Tracks and judging (confirmed)

- **Indie developer track:** individual builders and students. Judged on **creativity, technical ambition, and whether it works**.
- **Startup track:** teams and founders building a real product. Judged on **technical execution and whether it holds up in production**.
- Every project enters one track. The form says the track can be changed any time. Both tracks can build toward either theme (kickoff slides).
- **Our track: Startup (team of two). Confirmed 26 Oct:** both of us registered on the Startup track. Settled; we no longer need to ask about Indie.
- Judges: **still not named** (the guide does not list them). The criteria are now published: section 5.
- Reported (one German-language article, mind-verse.de): judging attention on reliability of workflows, traceability of decisions, handling of faulty inputs, and practical use beyond a demo.

### Themes (pick one)

- **Build for Your World:** bring Meta's models into your own domain, solve a problem you know firsthand. **← Parallax is entered here.**
- Push the Frontier: software, robotics, manufacturing, energy, materials.

## 2. What Meta gives us

Participant credits: **USD 150 Meta Model API credits per accepted participant** (confirmed by the Participant Guide; request forms are in Discord #resources from kickoff; each person claims their own, see section 5). Sponsor credits (confirmed): Baseten USD 100 + 2M TPM (request, per individual), Modal USD 100 (first 1,000 participants), Fireworks USD 25 (select participants only, by email; workshop by Sinan Ozdemir on Fri 30 Oct). All three are for Meta's **open-weights** models.

Models and tools (from Meta's own posts; check the live API docs before relying on any detail):

| Model / tool | What it is | Source |
|---|---|---|
| Muse Spark 1.3 | Flagship for complex coding and agentic workflows, via Meta Model API | Meta Connect 2026 recap (confirmed) |
| **Muse Wonder** | Agent model. **Active Memory** (keeps context across conversations) and **Active Focus** (keeps pursuing goals, recovers from errors, checks in before important actions). Available to developers via Meta Model API and Muse Code. **On the API it is `muse-wonder-1.0`, labelled Preview, and the developer docs expose no Active Memory parameter, tool or endpoint (see §2.1)** | about.fb.com, 12 Oct 2026 (confirmed); API status: dev.meta.ai (confirmed) |
| Muse Wonder Full | Muse Code subscribers only | same |
| **Muse Image** | Production image generation | Connect recap |
| **Muse Voice Transcribe** | Speech-to-text | Connect recap |
| SAM 3.1 | Segmentation | event page |
| Muse Spark Open | Open weights, natively multimodal, 1M-token context, runs on Apple silicon (released 15 Oct 2026) | TechCrunch (reported) |
| Muse Glimmer | Open weights, 30B, single GPU or Mac mini | Connect recap |
| Muse Code | Multi-agent coding agent, out of beta | Connect recap |
| Meta AI Connectors, WebMCP | Developer preview | Connect recap |

**No Meta text-to-speech (confirmed, see §2.1).** If avatars speak at all, it is a stretch goal using the browser's built-in speech (ARCHITECTURE.md §10).

### 2.1 Meta Model API: facts read on Meta's developer docs (confirmed)

Read by the ARCHITECTURE.md author on 20 Oct 2026; the reviewer re-read the rows marked ✓ on 20 Oct 2026 (see REVIEW.md). Details can change during the event: re-check on day 1.

| Fact | Source |
|---|---|
| Base URL `https://api.meta.ai/v1`, header `Authorization: Bearer <key>` (the docs call the key `MODEL_API_KEY`). OpenAI-compatible Chat Completions is one of the supported protocols. ✓ | https://dev.meta.ai/docs/ |
| Model IDs: `muse-spark-1.3` ("recommended for new work"), `muse-spark-1.2` (previous version), `muse-wonder-1.0` (**Preview**), `muse-image-1.0`, `muse-voice-transcribe-1.0`. Spark 1.3 and Wonder: 1,048,576-token context. ✓ | https://dev.meta.ai/docs/models |
| **No text-to-speech.** The overview says Voice Transcribe "is speech-to-text only; it does not synthesize speech". ✓ | https://dev.meta.ai/docs/ |
| **Active Memory is not exposed to developers.** The models page and API docs show no memory parameter, tool or endpoint for Muse Wonder. We use our own memory store, and Active Memory only if and when Meta documents it. ✓ | https://dev.meta.ai/docs/models, https://dev.meta.ai/docs/protocols/responses, https://dev.meta.ai/docs/cookbook/agent-patterns |
| **Contributor-mode warning.** `-contributor` model IDs (Spark 1.3 and 1.2 only) are discounted "in exchange for permission to use your content" to train future Meta models. Never use them with real user data. ✓ | https://dev.meta.ai/docs/pricing-rate-limits |
| Prices (standard mode, per 1M tokens in / cached / out): Spark 1.3 USD 1.25 / 0.15 / 4.25; Wonder USD 4.00 / 0.20 / 20.00. Muse Image USD 0.01 per image; Voice Transcribe USD 0.18 per audio hour. Rate limits are per team: Spark and Wonder 3,000 RPM and 4M TPM. ✓ | https://dev.meta.ai/docs/pricing-rate-limits |
| Speech-to-text: `POST /v1/asr/transcribe`, WAV mono 16-bit PCM at 16 or 24 kHz, at most 10 minutes and 32 MB. 25 supported languages with code-switching; **isiZulu and Afrikaans are not on the list**. Accuracy on South African English accents is untested. ✓ | https://dev.meta.ai/docs/speech-to-text |
| Images: generation and edit endpoints; **no `seed` parameter**, so face consistency across paths must be tested. | https://dev.meta.ai/docs/image-generation |
| Chat Completions keeps no memory between requests; the Responses protocol stores state by default (`store: true`). | https://dev.meta.ai/docs/protocols/chat-completions, https://dev.meta.ai/docs/protocols/responses |
| Standard-mode data retention and training terms: **unknown** (the pages point to the AI Developer Legal Center). | https://dev.meta.ai/help/policies-and-privacy/data-handling |
| **Fireworks' serverless Muse Spark Open is a limited preview "through October 29, 2026"** (day 4 of the build), so the Fireworks credits cannot be a late-event fallback without an on-demand deployment. ✓ | https://fireworks.ai/models/fireworks/muse-spark-open |

Meta's stated direction: "personal superintelligence for everyone"; agents with memory; velocity and accessibility; open weights.

## 3. The project as submitted

Application answer (Startup track, theme Build for Your World):

> **The problem:** People make life-changing decisions (quit a job, take a loan, move cities) on gut feeling and scattered advice, and the people with the least safety net pay the most for a wrong move. There is no way to try the options before living them.
>
> **The solution:** Parallax is an AI decision simulator. You describe a decision and your real situation (income, skills, obligations, risk tolerance), and Parallax builds a grounded model of you that it remembers across the whole session. For each path it simulates the next several years (money, setbacks, day-to-day life) and generates a personalised avatar of your future self on that path. When a simulation finishes, you keep talking to that future self, by text or voice, and you can move between paths and compare them, until you feel comfortable making the decision.
>
> Muse Spark/Wonder for reasoning and simulation, with assumptions and uncertainty shown for every projection; long-term memory so each avatar stays consistent; Muse Image for avatars; Voice Transcribe for spoken input. MVP: one scenario type (career and money decisions) end to end. A reflection aid, not financial advice; the user controls their own data.

The product owner's own framing: when each simulation finishes, the person can **keep going and interact with each path until they are comfortable with a decision**.

Where the plan now differs from the application (because of §2.1): "by text or voice" means spoken **input** (Voice Transcribe); avatar replies are text, with browser speech as a stretch goal. "Long-term memory" is our own per-session memory store, not Muse Wonder's Active Memory, which developers cannot call yet. Muse Spark 1.3 does the reasoning; Muse Wonder (Preview) is optional behind a flag.

## 4. Team

- **Sibusiso Khumalo** (GitHub Sibusiso-K, Johannesburg). Electrical engineer, full-stack and AI developer, medical background. Agent work: BobSwarm (5-specialist multi-agent audit swarm on IBM Bob 2.0, 3rd place, team lead, React/TypeScript/Vite/Node/WebSocket), Swarm_Corp (7-role coding-agent swarm), StokUp (LangGraph WhatsApp ordering agent), CivicLens (Stats SA assistant where no model writes figures), VUKA (safety app with ledger-anchored records).
- **Lethabo Hoaeane** (GitHub LethaboMH14, collaborator on the repo).
- **Roles, agreed 26 Oct** ([ROLES.md](ROLES.md)): Sibusiso leads UI and UX, the back end (including the simulation engine) and API integrations; Lethabo leads avatars, API integrations, feature integration (including the figure guard and traceability) and security.
- Team rule from SONAR: no more than two overlapping builds at once; every entry must leave a reusable artifact.
- Location gives us a real "Build for Your World" story: South Africa, where many people make high-stakes money decisions with little safety net.

## 5. Official Participant Guide (read 26 Oct 2026)

Source: https://cerebralvalley.ai/e/meta-ai-developer-hackathon/details (the page is JavaScript-rendered; read by the user in Chrome on 26 Oct 2026, facts copied from it). Cross-checked against the **kickoff slides** (26 Oct, 18:00 SAST); lines marked *(slides)* come from them. All times in the guide are ET. Label: **confirmed**.

**Time-zone note.** ET is 6 hours behind SAST until US clocks go back on Sun 1 Nov, then 7 hours. Kickoff, live sessions, the deadline and the closing ceremony convert as shown; only office hours move (16:00 → 17:00 SAST from Mon 2 Nov).

### Schedule

- Kickoff Mon 26 Oct 12:00 ET (= 18:00 SAST).
- Live sessions, all 12:00-13:00 ET (= 18:00-19:00 SAST), each recorded and posted to #resources *(slides)*: Tue 27 Oct Meta Engineering Workshop P1, "Agents 101: Build a Multimodal AI Agent" (Suraj Subramanian, Meta); Wed 28 Oct Meta Engineering Workshop P2, "Agents 102: Best Practices for Verifiable Agents" (Yash Khare, Meta); Fri 30 Oct Fireworks AI Workshop, "Building Specialized Intelligence on Fireworks: From Inference to Training with Muse Open Models" (Sinan Ozdemir, Fireworks AI).
- Discord office hours daily 10:00-11:00 ET, text only, **not on weekends**: 16:00-17:00 SAST until Fri 30 Oct, 17:00-18:00 SAST from Mon 2 Nov. Tue 3 Nov is the last full day for submission questions.
- Wed 4 Nov 21:00 ET (= 5 Nov 04:00 SAST): final office hours and **submissions due** on the Cerebral Valley (CV) platform. Late submissions are not considered.
- Judging period Thu 5 - Sun 8 Nov (not 4-8 Nov).
- Closing ceremony Mon 9 Nov 12:00 ET (= 19:00 SAST): top 10 teams (5 per track) announced, live final-round judging, winners; community vote opens. Community vote winner announced Mon 16 Nov on Discord.

### Rules

- Repositories must be **public** (open source).
- Team of at most 4; solo allowed.
- **New work only.** Build it between 26 Oct and 4 Nov *(slides)*. The demo must highlight only features and code built during the Hackathon. Judges must be able to clearly identify what was created during it; failure is **immediate disqualification**. Startups may bring an existing product, but only work from the event counts, and they must clearly identify what was newly developed. We bring no product; [BUILD_LOG.md](BUILD_LOG.md) records what we build each day.
- Banned: legal, ethical or platform-policy violations; using code, data or assets without the rights to them.
- Projects must incorporate Meta's models: Muse Spark series, Muse Wonder, Muse Image, Muse Voice Transcribe and SAM 3.1 via the Meta Model API; open weights Muse Glimmer and Muse Spark Open; Muse Code.
- **Sample Anti-Projects** (generic or policy-violating; avoid): AI-generated medical advice (including AI mental health advisors and skin blemish detectors); basic RAG apps; simple image analysers; **Streamlit apps** *(slides)*; **dashboards as the main feature** *(slides)*; simple "AI for Education" chatbots; AI job application screeners; AI nutrition coaches; personality analysers; sports analysers or coaches; anything political or involving war. The slides say the list is not complete. How Parallax stays clear: [RESEARCH.md](RESEARCH.md) §5.

### Credits

- Accepted participants get USD 150 Meta Model API credits. Request forms for all credits open in Discord **#resources** at kickoff *(slides)*.
- **Each participant (solo, team member or startup entrant) must claim their own credits individually by Wed 4 Nov 21:00 ET; nobody can claim for someone else.**
- A **credit card must be on the account** to make API calls with credits; set a Spend Limit notification on the Billing page.
- So the pair has USD 300 only if both claim and both attach a card. Share one API key per project deliberately (rate limits are per team, section 2.1).
- Baseten: request USD 100 + 2M TPM (up to 2,000 participants, reviewed on use case, per individual). For the hackathon use model `meta-models/muse-spark-open-1026`, **not** `meta-models/muse-spark-open`.
- Modal: USD 100 to the first 1,000 participants, for Meta open-weights models.
- Fireworks: USD 25 for select participants only (shortlisted, by email), plus the workshop with Sinan Ozdemir.

### Submission

- Submit at https://cerebralvalley.ai/e/meta-ai-developer-hackathon/hackathon/submit *(slides)*, before Wed 4 Nov 21:00 ET; "don't wait for the last hour".
- One project per team, entered by one appointed **Representative**, with every teammate listed. The repo must be public (check that it opens in a logged-out browser before submitting) and the video link accessible.
- A **three-minute demo video** showing only what the team built during the event; judges score from it, along with the code and the live product. Checklists: [SUBMISSION.md](SUBMISSION.md).

### Judging

- **Stage 1 (pass/fail):** reasonably fits the theme and reasonably uses the Meta Model API and/or open-weight models.
- **Stage 2:** four equally weighted criteria, 0-10 each:
  1. **Impact:** real-world potential, who benefits, could people use it, fits a problem statement.
  2. **Use of Meta AI Tooling:** how creatively; beyond a basic integration; surfaces capabilities that surprise Meta.
  3. **Technical Depth and Execution:** sound, refined engineering, real craft.
  4. **Demo:** working, impressive, holds up live; the video is genuinely cool to watch.
- **Stage 3:** the top 5 per track go to a live final round using the same rubric: judges watch the demos live on 9 Nov and rank them *(slides)*.
- Judges are still not named.

### Prizes (USD)

- **Indie track, 400,000 total:** 1st 150K, 2nd 100K, 3rd 75K, 4th 50K, 5th 25K.
- **Startup track, 550,000 total:** 1st 250K, 2nd 150K, 3rd 75K, 4th 50K, 5th 25K.
- **Bonus, 50,000:**
  - Most Viral Project 20K: engagement on X after the event; post the demo on X and submit the link on the platform; most likes, reposts and comments by **8 Nov 11:59 PM ET (= 9 Nov 06:59 SAST)** wins *(slides)*. Unknown: whether a post made before the submission deadline counts.
  - Best Build on Meta Open Weight Models 10K: Muse Glimmer or Spark Open on your own hardware or partner inference; flagged in round one, verified by the infrastructure partner.
  - Community Vote 10K: public gallery votes, one per verified account; announced 16 Nov.
  - Best Agentic Use-Case 5K: the strongest use of agents to complete tasks, make decisions or run multi-step workflows; scored on autonomy, effectiveness and practical usefulness.
  - Best Creative Build 5K: Muse Image or Muse Wonder; flagged in round one; scored on originality, execution and use of the model.
  - Fit and recommendation for each: [RESEARCH.md](RESEARCH.md) §6.

### Tracks (settled)

**Both of us registered on the Startup track** (confirmed 26 Oct). The guide never said whether a team may enter Indie, but that no longer matters. The Startup registration form asked for company country and funding stage (Sibusiso's form showed South Africa / Bootstrapped); check those answers are right before the deadline.

### Discord

Join: https://cv.inc/e/meta-ai-developer-hackathon/discord *(slides)*. Channels: #announcements (official updates and deadlines), #questions (ask the Cerebral Valley team, ping @CV), #office-hours (ask the Meta team), **#resources** (docs, credit forms, session recordings), #team-search, #intros (who you are and what you are building).

### Our repository

The Parallax GitHub repo was made **public** on 26 Oct 2026, as the rules require, after checking that its history holds only docs and no secrets. Everything pushed from now on is public: keys and account, team or project IDs never go in the repo ([AGENTS_AND_APIS.md](AGENTS_AND_APIS.md) §5).
