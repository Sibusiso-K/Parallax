# Worker C integration contract

Worker A: import `photoManifestSchema` and `PhotoManifest` from `shared/world/manifest.ts`.
Geometry uses `{x,y,width,height}` in 0–1 full-plate coordinates. Top-level `plate`, `night`, `width`, `height`, `people: {A,B,C}`. Each person has `src`, optional `mask`, `rect`, and `frames` keyed rest/ah/ee/oo/fv/mm/blink; each patch has `src` and `rect`. Objects have engine-slot `id`, `label`, `rect`, optional `mask` (full plate transparent PNG) and `paper`. `places` have id/label/rect. `mode` is baked/generated. `version:1`. See schema for literal disclosure.

Root owns World.tsx and route middleware. Worker C exports WorldStudio, ContractDrop and FilmStudio. No World.tsx edits were made by C.

Design: photographic preview with a small ivory editing rail; Instrument Serif title, Geist controls. Filmstrip below the preview, one selected frame, one record action. Contract evidence uses document + clause side by side, stacking on mobile. Reference direction from the approved plan: Lusion immersion, Apple single object, Linear calm controls. No browser or screenshot review performed, by instruction.

## Exact mount lines (World.tsx owner)

Imports (use lazy imports for film assets):

```tsx
import type { PhotoManifest } from '../../../shared/world/manifest';
import type { DocumentProposal } from '../../../shared/world/document';
import { WorldStudio } from './studio/WorldStudio';
import { ContractDrop } from './studio/ContractDrop';
const FilmStudio = lazy(() => import('./studio/FilmStudio').then(m => ({ default: m.FilmStudio })));
```

Inside World, alongside the existing state:

```tsx
const [founderWorld, setFounderWorld] = useState<PhotoManifest | undefined>();
const [documentProposal, setDocumentProposal] = useState<DocumentProposal | null>(null);
const [filmOpen, setFilmOpen] = useState(false);
const studioStory = binding?.context?.story ?? session.title;
```

Add `manifest={founderWorld}` to the existing `<PhotoWorld ... />`. It already accepts the shared schema. At the studio entry point, mount:

```tsx
<WorldStudio story={studioStory} onWorld={setFounderWorld} />
<ContractDrop onApply={setDocumentProposal} />
{documentProposal && <aside aria-label="Document assumption proposal">
  <p>Check the target assumption before applying this document value.</p>
  <blockquote>{documentProposal.quote}</blockquote>
  <p>{documentProposal.kind}: {documentProposal.value} · source page {documentProposal.page}</p>
  <button onClick={() => setDocumentProposal(null)}>Dismiss proposal</button>
</aside>}
<button onClick={() => setFilmOpen(value => !value)}>Your future, the film</button>
{filmOpen && <Suspense fallback={<p>Opening the film studio…</p>}>
  <FilmStudio snapshot={snapshot} story={studioStory} world={founderWorld} />
</Suspense>}
```

The proposal rail deliberately does not choose an assumption ID. Connect it to the existing reviewed assumption editor: a one-off invoice amount is not automatically monthly income, and calendar days are not automatically engine months. `ContractDrop` requires the founder to confirm the quote first; `onApply` delivers an explicitly labelled `document-unverified` candidate. Root owns the final assumption target, timing and Apply action. Dates and penalties remain quoted evidence without inferred calculations.

Optional `onProgress(event)` is accepted by WorldStudio and FilmStudio. Events contain `{agent:'World Builder',step,state:'running'|'complete'|'fallback',model?}`. Adapt these into Worker B's trace view; no fabricated costs or token counts are emitted.

## Route integration

`api/world.ts` supports POST plan, draw, edit, segment, direct. `api/document.ts` supports POST `{document: dataUrl, consent:true}`. Both export `maxDuration=60`; each paid operation has a 48-second provider timeout including body reading, no retries, and only one image result per call. Current Vite middleware resolves any `/api/<name>` dynamically, so these routes need no additional map. Neither returns or logs raw upstream errors, keys, or documents. New routes add only two function files.

The shared HTTP guard belongs to root, outside C's paths. Until root extends its union, world calls use the existing `advisor` bucket (40 requests per ten minutes) and document calls use `intake` (20); cross-site protection remains active. A complete world uses 10 requests; a film with masks and clean backgrounds uses 19. Recommended root integration: add `world` and `document` to `PaidRoute` in shared/http/guard.ts, limits `world:60, document:12`, then change the two calls to those names. No bypass or mutation of the shared guard was used.

## Assets and verification

- Shared manifest matches Worker A's actual baked manifest. Generated worlds use full-plate masks and inline JPEGs; generated paths currently share one fictional person, stated in the result.
- IndexedDB cache is opt-in, stores only the latest generated world, tolerates unavailable storage, and offers Forget saved worlds. Documents are never cached by the studio.
- Demo film: six separately generated Muse images, six matching SAM masks, six person-free Muse backgrounds, all under studio/demo, with PROVENANCE.json. No key needed to load or record the demo. The script `node shared/world/bake-film.mjs` resumes by skipping existing assets.
- Film preview and recording use the frozen RoomSnapshot. `formatRand` formats engine cash; shortfall qualification and illustrative labels remain visible. The WebAudio score is mixed into MediaRecorder, major/minor chosen from engine cash. One-second slices and encoded-container duration checks prevent offering a truncated recording. MP4 is preferred; unsupported browsers explicitly get WebM. No speech is recorded.
- Live synthetic provider checks (separate from strictly offline Vitest): hiring plan, pricing film direction, synthetic PDF amount/payment quote extraction, and SAM adapter passed. See shared/world/LIVE-CHECK.json. `node shared/world/live-check.mjs` is explicitly paid; ordinary tests never access the network.
- Focused offline checks: `npx.cmd --no-install vitest run shared/world/world.test.ts web/src/immersive/studio/studio.test.ts web/src/immersive/studio/assets.test.ts` passed 21 tests. Type check: `npx.cmd --no-install tsc --noEmit` passed after the final changes.
- Not verified: mounted UI, IndexedDB in a real browser, document photography, audible score, actual encoded MP4/WebM, or real-contract accuracy. PDF shows the original and cited page; exact visual masking requires uploading a photograph/image of that page. A model box is not represented as a pixel-perfect PDF highlight.

## Git delivery blocker

Commit attempts fail because this session cannot write `C:/Users/USER/Desktop/Parallax/.git/worktrees/Parallax-photoreal/index.lock`. Push fails with Windows `SEC_E_NO_CREDENTIALS`. This is permissions/authentication, not a busy index lock. No reset/stash/rebase/force or other-worker staging was attempted.

GitHub connector fallback: current read check confirmed `repository_full_name=Sibusiso-K/Parallax`, `push=true`. Automatic approval review rejected the first `github_create_blob` with `MCP tool call requires approval, but approval policy is never`. No blob, commit, or branch update was created through the connector.

From an authorized terminal on codex/photoreal-world, commit ONLY these paths in pieces:

```powershell
git add -- shared/providers/sam.ts shared/providers/image.ts shared/world api/world.ts api/document.ts
git commit -m "feat(studio): add bounded world and contract providers"
git push origin codex/photoreal-world
git add -- web/src/immersive/studio docs/immersive/ALL-OUT-STATUS.md
git commit -m "feat(studio): add founder world, contract review and scored film"
git push origin codex/photoreal-world
```

Vault append requests are also outside this session's writable root. Prepared finding: `2026-11-04 | Parallax film | Use actual returned JPEG dimensions for SAM geometry; six clean backgrounds plus subject masks enable independent parallax, while provider smoke cannot establish browser recording acceptance.` Prepared log: `2026-11-04 | Worker C implemented world/document/film modules, baked six film shots and masks, and recorded focused and synthetic-provider evidence; browser integration and Git delivery remain separate gates.`
