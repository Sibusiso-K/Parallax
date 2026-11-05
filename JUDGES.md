# Parallax: evidence for judges

Parallax lets a founder step inside a big decision before making it. This page maps each judging criterion to what you can open or run. Every claim names its file. What is not proven is listed at the end.

**Live:** https://parallax-one-ivory.vercel.app · **Demo room, no sign-up:** https://parallax-one-ivory.vercel.app/?world · **Repo:** https://github.com/Sibusiso-K/Parallax · **Team:** Sonar (Sibusiso Khumalo, Lethabo Masilo Hoaeane). **Built during the event**, 27 Oct to 4 Nov 2026: the first code commit is 29 Oct (`git log --reverse`).

## Check it yourself in five minutes

```bash
git clone https://github.com/Sibusiso-K/Parallax && cd Parallax && npm install
npm run eval      # no API key needed. Prints the table below and writes docs/immersive/evidence/evals.json
npm test
npm run dev       # works with no key: labelled fixtures and the baked demo room at /?world
```

Then in the room: hover the pots, pull **Late payment**, press **Convene the board**, read the graph, press **Apply assumption**.

## Measured, not asserted

`npm run eval` makes no network calls and the JSON it writes is byte-identical between runs. Fields starting `sim_` hold authored fixtures. Everything else is counted by code.

| Suite | Result | What it means |
|---|---|---|
| `guard_attacks` | 450 attempts, 450 blocked, 0 leaked | Hostile model replies run through the real guards: invented rand amounts in many formats, Unicode and full-width digits, a real figure attached to the wrong month, figures from another path, prompt injection, advice, guarantees |
| `determinism` | 12 comparisons, 0 mismatches | Engine and offline swarm, run twice, hashed |
| `engine_truth` | 10 candidates, 5 breakpoints, 0 mismatches | Every proposal's after-figure and every "survives N months" recomputed independently |
| `context_engineering` | 84.1% median saving per agent | Each agent's graph slice against the whole graph. Character-based estimate |
| `document_parsing` | 38 correct, 0 wrong | Payment terms and amounts from authored clauses. Ambiguous terms must produce no proposal |

**The first run of this suite failed.** 219 of the 450 hostile replies got past the guards. Disguised digits, `ZAR29000`, a true figure on a false month, advice and guarantees all reached the text. We fixed the guard (`shared/guard/figures.ts`), and the numbers above are the rerun. The history is in `git log -- shared/guard/figures.ts`. Because we fixed against this corpus, it is no longer a held-out test.

## Impact (30%)

- **Who:** South African small business owners deciding on a contract, a hire or a price, with no finance team. Payment dates decide whether they survive. At the end of Q2 2025, invoices older than 30 days worth R12.4 billion were unpaid by government departments alone ([Engineering News, 11 March 2026](https://www.engineeringnews.co.za/article/late-payment-crisis-detrimental-to-smes-business-partners-says-2026-03-11), citing National Treasury data).
- **What changes for them:** a question a spreadsheet does not answer out loud: "how late can this client pay before I cannot pay my staff?" The engine finds the exact line: `findBreakpoint` in `shared/swarm/engine-tools.ts`.
- **Any business:** one paragraph builds that founder's own room, with a person who can speak. `web/src/immersive/studio/live-world.ts`. About 19 Meta calls and $0.11 in images and SAM per world, plus Spark tokens.
- **Their real paper:** drop a contract, see the clause and what its payment terms do to lowest cash, from the engine. `web/src/immersive/studio/ContractDrop.tsx`, `DocumentConsequence.tsx`, sample at `/samples/sample-contract.png`.

## Use of Meta AI tooling (25%)

| Model | Its job here | Where |
|---|---|---|
| `muse-image-1.0` | Paints the room, the person, and the same room at night. Six edits of her mouth and eyes make a photograph speak with **no video model**. Repaints the room live when the board decides. Shoots the founder's film | `scripts/bake-photo-world.mjs`, `studio/live-world.ts`, `swarm/repaint.ts`, `studio/film.ts` |
| `sam-3.1` | The photograph is the interface: pixel masks make real objects clickable and bind them to engine roles. Also finds her mouth and eyes, cuts the person out, and highlights a contract clause | `shared/providers/sam.ts`, `photo/PhotoWorld.tsx` |
| `muse-wonder-1.0` | Conductor: dispatches the swarm from a fixed roster, with the event treated as untrusted data. Writes what she says, in the first person, from the founder's own story | `shared/swarm/run.ts` |
| `muse-spark-1.3` | Specialists with engine tools, intake with a verbatim quote for every figure, the advisor, live web search, reading contracts as image or PDF, naming what is really visible in a painted room | `shared/swarm/run.ts`, `shared/intake/agent.ts`, `shared/world/document.ts`, `shared/world/objects.ts` |
| Muse Spark vision | **Art Director:** looks at each repaint. Code rejects it if legible words, numerals or logos appear, so no figure can reach a founder through a picture | `shared/world/inspect.ts` |
| `muse-voice-transcribe-1.0` | Ask the room a question out loud | `api/transcribe.ts` |

What we have not seen elsewhere, and invite you to check: lip-sync built from image edits; SAM masks used as a hit-test layer on a generated photo; one model painting and another rejecting the painting, in a loop the founder can watch.

## Technical depth and execution (20%)

- **No model can produce a figure.** Models write `{{fig:key}}` placeholders. Code substitutes the engine's value sentence by sentence and fails closed. `shared/guard/figures.ts`, `shared/scene/advisor-model.ts`.
- **Deterministic engine.** `shared/engine/`. Sorted traversals, stable keys, per-snapshot fingerprints.
- **Context engineering.** The decision graph is built from the path, with edge weights from engine finite differences, never from a model. Each agent receives only its k-hop slice. `shared/graph/decision-graph.ts`.
- **Agents propose, founders decide.** Models can only select engine-computed candidates by ID. Only the founder's Apply changes a number. `proposalCandidates`, `web/src/immersive/swarm/MissionControl.tsx`.
- **Live sources are checked by code.** A cited URL must be in the search results, then code opens the page and looks for the figure. If it cannot confirm it, the UI says so. `confirmOnPage` in `shared/swarm/run.ts`.
- **Secrets stay on the server.** Paid routes go through `shared/http/guard.ts` with per-route limits. Model-written code never runs: world changes are validated operations or image edits.
- **Works with no key.** Labelled fixtures and a baked world. `web/public/worlds/photo-demo/` is about 0.7 MB. The photo world uses no WebGL context.

## Demo (25%)

The video was made from real app footage and real recorded runs. `scripts/film/README.md` says how each part was made, what was sped up, and what is a rendered close-up rather than the app's own frame.

## Limits, stated plainly

- Three paths come from templates adapted to the founder's figures, not from a model. A model proposes changes within them.
- Default costs for "I don't know" answers are estimates. `shared/defaults/za.json` says which, and links official references.
- The guard stops unsupported figures. It does not stop bad reasoning, and a founder's assumptions can still be wrong. "Matched" means consistent with the simulation, not true.
- The eval corpus is authored and finite. It was used to harden the guard, so it is not held out.
- Meta has no text-to-speech. In the app, the voice is the browser's. In the video it is a Microsoft en-ZA neural voice through the unofficial `edge-tts` client. Both are synthetic and labelled.
- People in the images are fictional and generated. The world's lighting and scene changes are illustrative.
- Web sources are quoted as found. Code checks the figure is on the page, not that the page is right.
- Lip-sync timing comes from word boundaries or an estimate. It is convincing, not phoneme-accurate.
- Not financial or legal advice. One possible future, not a prediction.
