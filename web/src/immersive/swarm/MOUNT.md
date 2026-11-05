# Worker B integration — 4 November 2026

Implementation is ready for integration, not browser accepted. No browser or dev server was started. Own files only were edited. The graph, API, fixture and stream tests are offline/stubbed; no paid provider call was made.

Validation: 20 focused tests across `shared/graph/decision-graph.test.ts`, `shared/swarm/swarm.test.ts`, `shared/swarm/dev-stream.test.ts`, and `web/src/immersive/swarm/stream.test.ts` passed. Full `npx.cmd tsc --noEmit` passed. Use `npx.cmd` on this Windows host because PowerShell blocks `npx.ps1`. Offline events have a short, cancellable presentation replay; the UI labels it a fixture replay and never reports that pacing as model latency.

## Mount in World.tsx (Worker A / root only)

Add these imports:

```tsx
import { MissionControl } from './swarm/MissionControl';
import type { SwarmRequest } from '../../../shared/swarm/contracts';
import { inputKey as swarmInputKey } from '../../../shared/swarm/engine-tools';
```

Inside `World`, after `snapshot` and `shownMonth` exist, add:

```tsx
const swarmPathId = snapshot.ref.pathId;
const swarmEntry = session.paths[swarmPathId];
const swarmRequest: SwarmRequest = {
  event: snapshot.ref.setback ? 'Late payment switched on. Challenge this plan.' : 'Review this path before I decide.',
  month: shownMonth,
  stressed: snapshot.ref.setback !== null,
  path: {
    ...swarmEntry.path,
    letter: swarmPathId,
    name: swarmEntry.name,
    summary: swarmEntry.summary,
  },
  context: binding?.context ?? DEMO_CONTEXT,
};
```

Inside `<section className="stage">`, add this sibling of the photo/courtyard stage:

```tsx
{!inReplay && <MissionControl
  request={swarmRequest}
  onApply={(proposal) => {
    if (proposal.inputKey !== swarmInputKey(swarmRequest)) {
      return { ok: false, error: 'The decision changed. Run a new review first.' };
    }
    if (binding) return binding.onRevise(swarmPathId, proposal.assumptionId, proposal.values);
    const revised = session.revise(swarmPathId, proposal.assumptionId, proposal.values);
    if (!revised.ok) return revised;
    setOwnSession(revised.session);
    return { ok: true };
  }}
/>}
```

The component imports its own CSS; do not copy CSS into immersive.css.

Optional integration hooks (names deliberately not guessed from Worker A's unfinished implementation):

- `onSpeech={(segments) => ...}` feeds the **guarded segments** to LivingPerson. Join segment `.text` for speech; preserve segments for evidence rendering. No auto-speech: the user presses “Hear my future self”.
- `onWorldOp={(op) => ...}` previews `op.value` (`golden`, `night`, `calm`). This is visual only. `op.prompt` is authored, validated prose, never arbitrary model instructions. It does not issue a paid image edit itself.
- `trigger={revisionOrEventCounter}` opts into review after a deliberate founder event. Omit it to require “Start review” (default; avoids incidental paid reruns). The component aborts pending results and removes old proposals whenever path, month or stress changes.

## Vite streaming patch (root owner only)

The working implementation is `shared/swarm/dev-stream.ts`. It forwards chunks, flushes headers, handles backpressure and cancels the upstream stream on disconnect. Its focused test proves the first chunk arrives before the producer closes.

In `vite.config.ts`, add:

```ts
import { pipeWebResponse } from './shared/swarm/dev-stream';
```

Replace these three lines:

```ts
res.statusCode = response.status;
response.headers.forEach((v, k) => res.setHeader(k, v));
res.end(Buffer.from(await response.arrayBuffer()));
```

with:

```ts
await pipeWebResponse(response, res);
```

Until this is mounted, Vite's current middleware buffers the response, so live trace animation will arrive at the end. The Vercel API Response itself already streams NDJSON.

## API and accounting

`POST /api/swarm` accepts `SwarmRequest`. It validates paths before streaming and returns `start`, `trace`, `result` or `error` NDJSON records. A missing/disabled key uses an explicitly labelled deterministic fixture. Provider failures produce `partial` results, never an unlabelled fallback. The global deadline aborts provider calls after 52 seconds. Cash has at most two tool rounds and four tool executions. Specialists run concurrently.

`shared/swarm/paid-guard.ts` calls the existing shared paid-route guard and adds 12 complete swarms per visitor per ten minutes. It temporarily shares the advisor guard's outer quota because its closed route union is outside B's ownership. Root may instead add `swarm` to `PaidRoute`/`LIMITS` with 12, then import the shared guard directly in api/swarm.ts. Do not count individual agents as separate route hits. This in-memory guard is not a global spend cap.

Meta usage tokens are shown when returned. USD cost is unknown unless the operator supplies verified per-million-token rates as server-only `META_SWARM_RATES_JSON`, shaped as `{ "muse-spark-1.3": { "input": ..., "output": ... }, "muse-wonder-1.0": { "input": ..., "output": ... } }`. Do not copy invented sample prices. Search billing is not covered by token rates, so runs containing live Market Scout retain unknown total cost. Fixture calls cost zero.

Market Scout asks for official South African sources through Responses web search. Code requires the URL and verbatim quote to appear in returned search results. If the provider returns URLs without snippets, it withholds sources. Quotes stay external; they never become engine figures or automatic edits. This checks traceability, not factual truth or freshness.

Proposal candidates use the current low/high bounds and preserve the uncertainty range. Selecting a higher income/lower cost is an optimistic assumption, not a promise that it is achievable. The engine recomputes minimum cash for that candidate and the active stress. Apply is the only mutation path.

## Visual direction and acceptance

The supplied plan is the visual reference: Lusion's immersive background stays visible, Apple's single focal object becomes the agent constellation, and Linear's calm inspection pane sits beside it. These are supplied reference intentions, not newly browser-researched claims. Fonts are the existing Instrument Serif/Geist. Palette: pearl `#f7f9fd`, ink `#283946`, muted blue `#526674`, lavender `#67558b`, connection grey `#c8d1da`. The memorable moment is specialists fanning out around the conductor as real stream events arrive; the evidence pane changes on selection.

```text
┌ status / second look at your future              close ┐
│ founder question                         Start review │
│           cash        market   │ selected agent       │
│     devil    conductor   world │ model / usage / tools │
│              director          │ exact context         │
│         future self → verifier │ external sources      │
│ board brief / guarded speech / explicit Apply actions  │
└───────────────────────────────────────────────────────┘
```

Source critique round one: kept the photograph visible, reduced chrome to one graph and one inspection pane, scoped styles to `.mc`, no repeating card grid. Round two: added narrow-screen stacking, visible keyboard focus, reduced-motion behavior, abort/reset on changed inputs, immediate duplicate-Apply lock, partial/unknown labels, and source disclosure. These are source reviews, not screenshot critiques. Browser, mobile/device, live Meta and final scene integration remain unverified.

## Commit and push handoff

Attempted `git add` / `git commit` failed creating `C:/Users/USER/Desktop/Parallax/.git/worktrees/Parallax-photoreal/index.lock`: permission denied. The session can write this worktree but cannot write its parent Git metadata. No commits or pushes were claimed or performed. Run these from an authorized terminal after reviewing the named files (never `git add -A` in this shared tree):

```powershell
git add -- shared/graph
git commit -m "Add deterministic engine graph and bounded agent context"
git push origin codex/photoreal-world
git add -- shared/swarm api/swarm.ts
git commit -m "Add guarded streaming specialist swarm and offline fixture"
git push origin codex/photoreal-world
git add -- web/src/immersive/swarm
git commit -m "Add interactive mission control graph and integration handoff"
git push origin codex/photoreal-world
```

The required vault lesson/log append is outside this session's writable roots. Root can record: `2026-11-04 | Parallax swarm | Streaming handlers need a chunk-forwarding dev bridge; traceability and engine claim checks remain distinct from live-provider and browser acceptance.`
