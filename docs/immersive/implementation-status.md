# Immersive Explore: implementation status

Execution pack: kept in the team's planning workspace, not in this repository.
Evidence ledger: `progress.json` in that pack. This file records what the implementation checkout actually contains.

## Phase 0: integration base (verified 2 Nov 2026)

| Item | Value |
|---|---|
| Implementation checkout | a local git worktree of this repository |
| Branch | `codex/photoreal-world` (at the time of this phase: local only. Pushed since; see the 4 Nov section) |
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

## Phase 3, part 1: the photoreal courtyard (2 Nov 2026)

The user saw the old stylised room after Phase 1 and asked for the photoreal world first, so Phase 3 (photoreal environment) moved ahead of Phase 2 (walking). Choices, made by the user: the courtyard is a real 3D model built in Blender (not photo stations, not AI world generation), and the people are realistic rigged 3D characters (not video).

Approved installs and downloads (user, in chat): group A, Poly Haven CC0 courtyard assets; group B, MPFB 2.0.18 for Blender plus CC0 MakeHuman packs; group C, `@react-three/rapier` 2.2.0 (pinned; pulls `@dimforge/rapier3d-compat` 0.19.2; wrapper licence MIT per its repository, engine Apache-2.0). Every downloaded file is in `assets/provenance.json` (75 files, 434 MB, URL, licence, SHA-256; Poly Haven MD5 and the extensions.blender.org SHA-256 verified). Originals stay unchanged in `assets/source/` (gitignored). MPFB is installed in Blender's `user_default` repository.

What exists now:

- `assets/blender/build_courtyard.py`: deterministic build (seed 20261102). Brick warehouse with the open stainless kitchen behind steel-framed glazing, stock room behind open sage doors, a sunken planted channel with seating steps, a steel bridge with a plank deck and cable railings, a planted wall at the far end, and the five places. Real CC0 photo textures (concrete and deck colour maps toned from measured means of sRGB 86 and 110 toward the reference's lighter surfaces), lit by Poly Haven's `sunset_jhbcentral`, a real HDR photograph of the Johannesburg CBD (-26.205, 28.040), plus a warm low sun. Static architecture is merged to one mesh per material; plants are decimated to about 8k triangles each.
- `web/public/worlds/courtyard-v1/`: `environment.glb` (18.7 MB), `manifest.json` (places, objects, 21 colliders, lighting), the sky (`joburg_2k.hdr`, `joburg_bg.jpg`) and five Cycles stills used as loading posters and the no-WebGL fallback (`assets/derived-provenance.json`).
- `web/src/immersive/courtyard/`: strict zod manifest schema (refuses a malformed world), and `Courtyard.tsx`, the R3F scene: one guided camera that eases between places (drag looks around), sky and sun, baked shadows, instanced plants, and pointer hits only on the five interactive objects (contract, pan, fridge, intake desk, memo board).
- `World.tsx` and `immersive.css`: the Explore layout from the integrated mock-up. The stage carries a place card, path chips and view modes (Walk and VR shown disabled with the reason), plus Places and a separate 1 to 36 month slider. The context panel holds the late-payment switch, baseline versus delay figures, a first-shortfall caution with an icon, Show calculation, the selected object with its engine-validated edit, and the fixture advisor (Hold to talk is disabled with the reason). The old stylised `Scene.tsx` (floating islands, month-tile bridge, glass avatars) is removed.

Evidence (planning pack, `docs/immersive/execution-v1/evidence/`): `photoreal-v1-cycles-{spawn,offer,intake,bridge,memo}.png`, `photoreal-v1-demo-desktop.jpg`, `photoreal-v1-app-explore-desktop.jpg`, `photoreal-v1-app-explore-phone.jpg`. In the app, Explore on the recorded profile shows Path B at R70,000 in month 1, lowest R45,000 and R695,000 at month 36, matching the live app.

Measured frame cost on this laptop (Intel UHD Graphics via ANGLE/D3D11, dev build, forced renders timed with a 1-pixel read-back, pane hidden so frame-rate counters are throttled and unusable):

| Configuration | Draw buffer | Avg / median / p95 (ms) | Draw calls, triangles |
|---|---|---|---|
| First version (shadow map every frame, ratio 1.25) | 1102×807 | 38.6 / 38 / 49 | 231, 787,627 |
| Shadows baked once, plants instanced | 1102×807 | 30.6 / 29.4 / 42.9 | 50, 410,821 |
| Same, pixel ratio 1 | 882×646 | 20.9 (p95 30.7) | as above |
| Shipped integrated-GPU setting (ratio 1, PCF), wider pane | 1102×645 | 25.1 / 24 / 36.2 | 55, 411,629 |

Against the pack's desktop target (60 fps, p95 under 22 ms) this is not met on integrated graphics; it is about 40 fps on average. Not verified: a discrete GPU, a phone, a production build, cold-cache download time.

Not done yet, honestly: no people in the courtyard (realistic Ayanda and advisor are next, with MPFB); no walking or collision (Rapier installed, not wired); the Joburg panorama has no sun disc, so the warm sun is an added light, not measured from the photo; light is real-time, without the bounced light of the Cycles renders, so the browser view is flatter than the stills; the environment download (18.7 MB) is above the 15 MB first-payload target.

## 4 Nov 2026: Codex's work landed, checked in a browser, and finished

Codex stopped at its usage limit on 3 Nov with its work uncommitted and never checked in a browser. Its "Edge WebGL failure" was the test setup: its check launched Edge with `--disable-gpu`, and a later shader error was `GL_OUT_OF_MEMORY` (`HRESULT 0x8007000E`) from the HLSL compiler on this 7.7 GB machine, not a fault in the shaders. Checks below ran in real Edge 156 with the Intel UHD GPU (headless, driven over the DevTools protocol) at 1440x900, on the production build unless noted.

| Gate (NEXT-INTEGRATED-PASS) | Result | Evidence |
|---|---|---|
| Renders in Edge | Pass | `ANGLE (Intel UHD Direct3D11)`, no shader errors with memory available. Under severe memory pressure it falls back to the still image, as designed |
| Walk to an object, inspect, resume, Guided still usable | Pass | Pressing Memo walked to (3.95, -7.39) through the real colliders, E selected the board. After selecting at Offer, S moved z from 5.2 to 2.23. Guided eased back to the place camera. `route.test.ts` walks every pair of places in Rapier |
| Characters reviewed at ordinary distance | **Failed, so off by default** | Blank white eyes, hair cap with holes, apron through the collar, plastic skin (`evidence/people-ayanda-face.jpg`). Reachable with `?people` |
| Object question: labelled answer, text fallback, truthful speech | Pass, except audio | Live Muse Spark in the room on the demo profile. Read-aloud reached `speaking: true` with 324 voices listed, in a headless browser, so **nobody has heard it yet** |
| Graph and image use one selected scenario and month | Pass | SVG contains -R29,000, R91,000 and "First shortfall: month 4"; the PNG renders unclipped (`evidence/`) |
| Reel | Real video, no longer a storyboard | H.264, 720x1280, 16.48 s of 16.5 s, 487 frames, steady 30 fps (ffprobe). All five scenes checked by eye (`evidence/reel-frames.jpg`). Silent by design |
| Checks after integration | Pass | `tsc` clean, 69 files / 474 tests, `vite build` passes, 7 of 12 Vercel Functions |

The confirmed path was run once, live, on the dev server: intake with the demo story and "I don't know" for wages, then paths, then Explore on path B. Muse Spark dressed it as "The Johannesburg Kitchen" ("Client Offer Table", "Corporate Lunch Agreement"). Late payment at month 4 showed -R5,000 against a R115,000 baseline, the same figure as the 2 Nov parity check. The advisor's three figures all matched the room.

Frame cost by the same method as the 2 Nov table: **15.6 ms average, median 14, p95 17.2 ms**, 62 draw calls, 426k triangles, 993x868, production build with the characters off. One run on one machine. This meets the pack's 22 ms p95 target there; the 2 Nov figures (25.1 / 36.2 ms) were a development build, so the build type accounts for some of the gain.

First load: the guided room's chunk is 275 kB gzipped, and Rapier now loads only when Walk starts. Measured once on the Vercel preview, cold, on this laptop and connection: **25 s to a live 3D room, 23.7 MB in 18 requests** (`environment.glb` 17.9 MB in 8.8 s, the HDR 4.8 MB in 2.3 s), with the still render showing until then. That misses the pack's 5 s and 15 MB targets. Walk then fetched 783 KB in 2.2 s. The avatars are not downloaded. Codex's 1K HDR experiment would save about 3 MB, but has had no visual review.

The preview deployment has no Meta key, so it shows the authored answers; production has one (`/api/health`), so the live advisor needs a merge, or the key set for previews, to run on Vercel. Live answers above were on the local dev server.

### Live model use during this work

Seven calls on the team's key: four to `/api/advisor` (demo path B), and one full intake with its scene and portrait. Answers took about 9 s each. There is no rate limit on `/api/advisor`, the same as `/api/chat`, so a public deployment can spend credits at the rate people ask.

### Not verified

- Hearing read-aloud, or **Speak** with a real microphone in the room. The transcribe route has its own tests; the two have never been run together.
- A real phone. 390x844 was checked in Edge's device emulation: no sideways scroll, controls reachable, crowded. Touch input was not exercised, only the layout.
- A discrete GPU, Firefox and Safari. `MediaRecorder` MP4 is Chromium-tested; other browsers fall back to WebM or say they cannot record.
- VR: still disabled, no headset.
- Sign language: not implemented. Nothing here is sign support.

### Known limits

- No people in the room by default, so "ask a person" is a panel, not a character.
- The real-time scene is still flatter than the Cycles stills; it reads as a good game, not a photograph.
- The advisor sees figures only for the scenario on screen, so with the switch off it cannot quantify a late payment and offers to turn the switch on.
- The CC BY version of one shirt is unconfirmed (`assets/CREDITS.md`), which only matters if the characters are shown.

