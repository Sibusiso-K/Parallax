# Immersive Explore: implementation status

Execution pack: `C:\Users\USER\Desktop\Parallax\docs\immersive\execution-v1` (planning repo, untracked docs).
Evidence ledger: `progress.json` in that pack. This file records what the implementation checkout actually contains.

## Phase 0: integration base (verified 2 Nov 2026)

| Item | Value |
|---|---|
| Implementation checkout | `C:\Users\USER\Desktop\Parallax-photoreal` (git worktree of `Desktop\Parallax\.git`) |
| Branch | `codex/photoreal-world` (local only, no upstream, nothing pushed) |
| Base | `1c255ea` = `origin/feat/ui-marketplace-style` (Sibusiso-K, 2 Nov 13:52) |
| World work carried | merge of `feat/immersive-world` @ `900e6ec` (LethaboMH14, 12 commits incl. figure guard) |
| Merge commit | `41486b8`, one conflict (`web/src/main.tsx`), resolved by keeping the Control Room shell and re-adding the `?world` entry |
| Remote main | `origin/main` = `8f6e958` (PR #5). It contains neither the founder pivot (PR #8, `d7c3006`) nor the world work. |

### Which code the live URL serves

`parallax-d8gxefuhi-sibusiso-khumalos-projects.vercel.app` is a Vercel preview deployment (`dpl_7XiVJrwBBhW1av9A5cVqY3pLadFe`) in Sibusiso's team; the connected Vercel account (Lethabo's projects) cannot read its metadata (403). Matched by content instead: a local `vite build` of `1c255ea` emits `index-CyxSNQaO.js` and `index-PhBDSBuj.css`, the same content-hashed names the live HTML loads, and the live CSS contains the `1c255ea`-only `.logo` rule. So the live preview is `1c255ea`, not `main`, and not the world branch.

### Other checkouts (left untouched)

| Folder | State at inspection |
|---|---|
| `Parallax` | `plan/hackathon-build-plan` `b1392ee`; 14 untracked doc/design paths (the execution pack lives here) |
| `Parallax-world` | `feat/immersive-world` `900e6ec`, clean; its `node_modules` was copied (not linked) into the new worktree |
| `Parallax-pr8` | detached `d7c3006`; 3 untracked paths |
| `Parallax-guard` | `feat/figure-guard` `40b2182`, clean |
| `Parallax-main` | detached `8f6e958`, clean |
| `Parallax-build` | `feat/ai-client` `b167bed`; untracked `shared/ai/` |

No reset, clean, stash, checkout or push was run in any of them. The only shared-state change was `git fetch origin`, which added `origin/feat/ui-marketplace-style`.

### Baselines (commands run in each tree; build output written outside the repo)

| Tree | `tsc --noEmit` | `vitest run` | `vite build` |
|---|---|---|---|
| World `900e6ec` | pass (47 s) | 16 files, 154 tests pass | pass; `Scene` chunk 1,036.74 kB (277.49 kB gzip) over the 500 kB warning |
| Shell `1c255ea` | pass | 21 files, 147 tests pass | pass; `index-CyxSNQaO.js` 377.89 kB |
| Merge `41486b8` | pass | 24 files, 194 tests pass (147 + 47) | pass; shell CSS unchanged (`index-PhBDSBuj.css`) |

No failures existed before Phase 1 edits. The chunk-size warning predates this work.

### Machine preflight (read-only)

Node v24.18.0, npm 11.16.0, Git, Python 3.11, FFmpeg/FFprobe 9.0.2, Google Cloud SDK present. Blender 5.2 at `C:\Program Files\Blender Foundation\Blender 5.2\blender.exe` (not on PATH). GPU: Intel UHD Graphics only, so no CUDA; TRELLIS.2, splat training and other GPU jobs cannot run locally. Disk C: 15 GB free, which constrains texture packs, HDRIs and Blender sources.

## Phase 1: session bridge and app entry (functional pass, 2 Nov 2026)

What changed:

- `web/src/immersive/session-adapter.ts`: one discriminated input, `demo` or `confirmed`. A confirmed session is built from the store's own path cards (same objects the regular screens simulate), needs the store's session id, a revision of 1 or more and all three paths; anything else is refused, never replaced by the demo. `reviseCards` applies an edit with the engine's own validation (same rule as the assumptions panel: the line becomes `source: 'you'`).
- `web/src/immersive/session.ts`: sessions carry `mode` and `title`; `createSession` is only the explicit demo.
- `web/src/lib/store-patch.ts` + `parallax-store.tsx`: new `explore` step, a per-decision `sessionId` (new on reset), a `revision` that rises by one whenever any path card changes, and the Explore view (lever per path, month). The Explore path is the shared `active` path, so every screen agrees on it.
- `web/src/components/parallax/ExploreScreen.tsx`: hosts the room inside the Control Room frame; edits made in the room go back through the store, so Paths, Compare and Explore show one revision. Non-contract decisions get an honest "not built for this kind of decision yet" screen instead of a contract room.
- `Frame.tsx` (Explore in the rail, after Paths; eyebrow "Explore"; header path avatars hidden in Explore), `PathScreens.tsx` ("Explore this path" on each card), `main.tsx` (route; `?world` stays the labelled demo page and never touches the store).
- `World.tsx`, `replay.ts`, `memo.ts`: demo-only wording (Ayanda's question, "60 days", the R21,000 wages note, "Demo founder: fictional") now appears only in demo mode; confirmed sessions use the founder's decision and the engine's terms. Any new revision cancels pending answers and closes a stale replay.
- `immersive.css`: every selector scoped to `.world` (checked on the built CSS: 174 of 174), so a visit to Explore can no longer restyle the app's `.tab`, `.btn` or `.sub`; embedded mode keeps the canvas inside the content column.

Verification:

| Check | Result |
|---|---|
| `tsc --noEmit` | pass |
| `vitest run` | 25 files, 204 tests pass (10 new in `session-adapter.test.ts`) |
| `vite build` | pass; main `index` 390 kB (was 382 kB); World and Scene still lazy |
| Parity with the live app | for the recorded profile (demo story, wages "I don't know"), Path B month 36 = R695,000 and late payment lowest = -R5,000 in month 4, the figures in `evidence/recording-140s.png` |
| Browser (localhost dev server, 1440×900) | intake with the demo story → wages "I don't know" → paths (B: R695,000) → "Explore this path" → room opened on the confirmed session, labelled "Fictional founder · demo story · revision 1" |

The app's own "I am 18 or older" box was ticked as test input on the local dev build only, not on the live site.

Not verified in a browser yet: an edit round trip started inside the room, leave and re-enter, and 390×844 (each covered by unit tests only). The embedded room still uses the old stylised scene and its layout is cramped inside the frame; both are replaced by the photoreal pass. Refresh and Back behave as the whole app already does: no persistence, so a refresh returns to the start screen, and Back leaves the app.

## Approvals still needed

- Phase 2 runtime dependency (Rapier) and any later Spark/XR packages: exact versions to be proposed before install.
- Asset downloads (CC0 textures/HDRIs, MPFB) for Phase 3: item list and sizes to be proposed; disk space is limited.
- Cloud spending: none authorised; no job proposed yet.
- Meta API calls: none made; needs a key and usage authorisation.
