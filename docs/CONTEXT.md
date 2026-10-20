# Context: the hackathon and the facts we build on

Shared source of truth for every planning doc. If another doc disagrees with this one, this one wins until someone updates it with a source.

Confidence labels: **confirmed** = read on the organiser's own page (or, for the Model API, on Meta's developer docs at dev.meta.ai); **reported** = news or secondary source; **unknown** = not published yet, do not assume.

---

## 1. The event (confirmed, cerebralvalley.ai/e/meta-ai-developer-hackathon, read 18–19 Oct 2026)

- **Name:** Meta Global AI Developer Hackathon, hosted by Meta and Cerebral Valley. Virtual, worldwide.
- **Prize pool:** USD 1,000,000 cash across two tracks. Per-track and per-place split: **unknown**.
- **Both of us are approved** (Sibusiso and Lethabo, emails of 20 Oct 2026).

### Dates (SAST, Africa/Johannesburg)

| What | ET (organiser) | SAST |
|---|---|---|
| Kickoff livestream, build starts | 26 Oct, 12:00 | 26 Oct, 18:00 (approval email invite says GMT-5, i.e. 19:00: **confirm on the day**) |
| Workshops + Discord office hours | 27 Oct – 4 Nov | same |
| **Submission deadline** | **4 Nov, 21:00 EST** | **5 Nov, 04:00** (treat 4 Nov 22:00 SAST as our real deadline) |
| Judging | 4 – 8 Nov | same |
| Closing ceremony, live finals | 9 Nov | time TBA |

Official Rules are published before 26 Oct. Submission requirements (video? repo? hosted demo?) are **unknown** until then.

### Tracks and judging (confirmed)

- **Indie developer track:** individual builders and students. Judged on **creativity, technical ambition, and whether it works**.
- **Startup track:** teams and founders building a real product. Judged on **technical execution and whether it holds up in production**.
- Every project enters one track. The form says the track can be changed any time.
- **Our track: Startup (team of two).** Sibusiso's application was switched to Startup; confirm both registrations match. Whether a pair may enter Indie is **unknown**.
- Judges: **not published**.
- Reported (one German-language article, mind-verse.de): judging attention on reliability of workflows, traceability of decisions, handling of faulty inputs, and practical use beyond a demo.

### Themes (pick one)

- **Build for Your World:** bring Meta's models into your own domain, solve a problem you know firsthand. **← Parallax is entered here.**
- Push the Frontier: software, robotics, manufacturing, energy, materials.

## 2. What Meta gives us

Participant credits: **USD 150 Meta Model API credits per selected participant** (reported, Meta for Developers on X). Sponsor credits for select participants (confirmed): Baseten USD 100 + 2M TPM, Modal USD 100, Fireworks USD 25 (+ workshop by Sinan Ozdemir). All three are for Meta's **open-weights** models.

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
- **Lethabo Hoaeane.** Skills and preferred role: **unknown, Lethabo to fill in**.
- Team rule from SONAR: no more than two overlapping builds at once; every entry must leave a reusable artifact.
- Location gives us a real "Build for Your World" story: South Africa, where many people make high-stakes money decisions with little safety net.
