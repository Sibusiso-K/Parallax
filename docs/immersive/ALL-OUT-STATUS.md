
## Worker A — photo stage, 2026-11-04 (publication in progress)

A's changes are being committed through the authorized GitHub connector onto codex/photoreal-world because the local worktree gitdir is outside this session's write boundary and shell HTTPS credentials are unavailable. The local HEAD remains 20a0cdf; do not force push. Integration owner must fetch and reconcile the remote commits before later pushes. Only A's owned files and the plan's explicit advisor persona change are included; B/C files are not staged or published by A.

Implemented: offline Muse/SAM photo layers, three fictional people with rest + ah/ee/oo/fv/mm/blink patches, aligned crop inspection, mask picking, keyboard object buttons, paper figures from buildReadout, stress crossfade, pointer parallax, reduced motion, snapshot-bound device speech, Photo default / Walk lazy / VR disabled. Canonical schema imported from Worker C's shared/world/manifest.ts (C owns publishing that dependency). Future-self persona in the existing guarded advisor route; no new route.

Current checks: 22 focused photo/advisor tests pass; TypeScript passes. Real image/SAM calls and offline resume succeeded. No browser, dev server, audio listening, phone or deployment checks. Mouth timing is estimated and boundary-corrected, not phoneme recognition. Review composites are in web/src/immersive/photo/review. Complete publication hashes and final checks follow.

Mount already applied in World.tsx: `<PhotoWorld readout={readout} place={shownPlace} selected={focus} onSelect={inspect} reduced={reduced} transcript={heardAnswer} resetKey={`${snapshot.key}|${shownMonth}|${answers.length}`} disabled={inReplay || working} />`. For C's generated world add `manifest={generatedManifest}` (the canonical shared type). B/C feature mounts remain for the integration owner.

Vault write boundary: this session can read but cannot append to the vault. Pending lesson: `2026-11-04 | Parallax photo | SAM may segment distant counters as well as the foreground; inspect composites and select the largest lower-half occluder.` Pending log: `2026-11-04 | Worker A | Baked and tested the offline photo world; browser acceptance remains with Claude.`

## Worker B — 2026-11-04

Implemented in owned paths: deterministic finite-difference decision graph and bounded context; NDJSON swarm with Wonder dispatch, parallel Spark specialists, bounded engine tools, verified search snippets, guarded first-person speech, code claim verifier, engine-computed assumption proposals and honest offline fixture; light SVG MissionControl with context/tool/source/cost inspection, fixture replay, cancellation and explicit Apply. Streaming dev bridge is implemented and tested in shared/swarm/dev-stream.ts.

Validation: 20 focused tests passed; full npx.cmd tsc --noEmit passed. No browser, dev server or paid provider call. Live Meta compatibility, browser/device layout, scene/voice hooks and final integration remain unverified. Ten non-test API route files currently exist, below the twelve-route limit.

Exact World.tsx mount lines, Vite chunk-forwarding replacement and optional voice/world hooks: web/src/immersive/swarm/MOUNT.md. World.tsx, immersive.css, vite.config.ts and other workers' files were not edited by B. Root/A must mount the component; root must wire the dev-stream helper (current Vite middleware still buffers until that patch is applied).

BLOCKED: commit/push. Git cannot create C:/Users/USER/Desktop/Parallax/.git/worktrees/Parallax-photoreal/index.lock (permission denied; metadata is outside the writable worktree). No commits or pushes performed. Exact path-scoped commit/push commands are in MOUNT.md. Vault findings/log writes are also outside this session's writable roots; proposed lesson is in MOUNT.md for root to record.

## Worker A — final local handoff, 2026-11-04

**Publication blocked; no commit or push completed.** Local `git add`/`commit` cannot write `C:/Users/USER/Desktop/Parallax/.git/worktrees/Parallax-photoreal/index.lock` (permission denied); shell push also returned `SEC_E_NO_CREDENTIALS`. GitHub connector read checks verified `Sibusiso-K/Parallax` and `push=true`, but its first `create_blob` was rejected with `MCP tool call requires approval, but approval policy is never`. No blob, commit or branch update was made. Local and inspected remote HEAD were both `20a0cdf7473b5786f45a5f28105a2e3aa067f043`. The earlier publication-in-progress note is superseded by this result.

**Finished locally:** default no-WebGL photo stage; three SAM-cut fictional people; rest plus six aligned patches each; exact mask hover/click with rectangle fallback and keyboard buttons; camera/place/object focus, layered pointer parallax, breathing, steam/grain/vignette, 1.5 s stress-night fade; actual SAM paper placements carrying buildReadout figures; device speech and captions with word-boundary correction, random blinks, startup timeout, snapshot/navigation cancellation, reduced motion; Photo / lazy Walk / disabled VR. The explicit plan-assigned advisor persona change is in shared/scene/advisor-model.ts; only schema/prompt lines changed there. Photo mode sends it through photo/advisor.ts and keeps the existing server sentence guard and client ClaimRef verification. Authored offline replies remain labelled fixtures, with a first-person introduction. Demo-only contract introductions are not reused for a different founder's business.

**Assets:** `node scripts/bake-photo-world.mjs --offline` succeeds from the retained temp cache, with 447,674 bytes in the published demo directory. The deployed demo itself only fetches baked files and needs no key, parser, Python or model call. The bake is resumable; Meta raw responses live in the OS temporary directory, not the repository. Parser installation was explicitly approved by the plan and placed in TEMP/parallax-photo-tools because normal npm cache writes were restricted. Rebuilding on a new machine requires Pillow/numpy, the approved @meta-sam/parser (SAM_PARSER_PATH can override its entry point), source images and the Meta key for uncached requests.

**Evidence:** focused command `npx vitest run web/src/immersive/photo/photo.test.ts api/advisor.test.ts` passed 22 tests. `npx tsc --noEmit` passed. Crops and two rounds of offline composite inspection corrected the foreground occluder and checked all three faces/expressions; see photo/review/face-registration.jpg and photo/review/composite-golden.jpg. These are asset inspections, not browser screenshots. No browser, dev server, full suite, audio listening, real phone, live advisor persona call or deployment validation was performed. Articulation is a text-derived estimate, not measured phonemes. It still needs Claude's checks for mobile composition, patch transitions, speech start/cancel, real pointer picking and stress fade.

**Integration:** World already mounts PhotoWorld. Its props include canonical `manifest?: PhotoManifest` from C's `shared/world/manifest.ts`, `readout`, `place`, `selected`, `onSelect`, `reduced`, `transcript`, `resetKey`, `disabled`, `autoPlay`, `demo`. C's generated person masks and inline image URLs are supported. `manifest={generatedManifest}` selects a live world; absent it loads `/worlds/photo-demo/manifest.json`. The default never mounts Courtyard until Walk is chosen. C owns publication of shared/world/manifest.ts; B/C component mounts are not included in A's work.

**Exact A publish paths** (run in an environment allowed to write the existing gitdir, with no other worker's staged files; do not force push):

```powershell
git add -- scripts/bake-photo-world.mjs web/public/worlds/photo-demo
git commit -m "feat(photo): bake offline Muse world and aligned speech patches"
git push origin codex/photoreal-world
git add -- web/src/immersive/photo web/src/immersive/World.tsx web/src/immersive/immersive.css shared/scene/advisor-model.ts
git commit -m "feat(photo): make the photograph an interactive speaking world"
git push origin codex/photoreal-world
```

Append/review this shared status file with the integration handoff commit. A did not edit, stage or publish B/C files. No software beyond the explicitly approved SAM parser was installed. Vault findings/log writes remain outside the permitted filesystem; the pending lesson/log lines above are ready for the integration owner to append.

## Worker C — local implementation complete; publication and integration remain, 2026-11-04

Owned changes: shared/providers/sam.ts, additions to shared/providers/image.ts, shared/world/*, api/world.ts, api/document.ts, and web/src/immersive/studio/*. No World.tsx, CSS outside studio, package manifests, shared HTTP guard, or other-worker implementation files were edited by C.

Implemented: bounded one-shot Muse draw/edit, SAM text/box prompts using vendored approved @meta-sam/parser 0.1.0, Spark world planning for arbitrary business/contract/hire/pricing stories, sequential live-world generation with full-frame masks and the shared PhotoManifest, progress callbacks, opt-in IndexedDB cache/forget and honest baked-demo fallback. Worker A already imports the shared manifest and accepts it through PhotoWorld's manifest prop.

ContractDrop accepts images, camera capture and PDF, requires upload consent, displays verbatim unverified quotes with page and model box, offers SAM box-prompt refinement on images, and delivers founder-confirmed proposals parsed from explicit quote literals by code. No assumption is silently changed. Exact PDF masking requires an image of the page; the PDF viewer itself shows the source/cited page, not a claimed pixel-perfect overlay. Root must connect the candidate to the reviewed assumption editor and choose the target/timing explicitly.

FilmStudio provides six independently generated photographic demo shots, six SAM subject masks and six clean backgrounds, no-key filmstrip/motion preview, optional live Director/anchored shot generation, canvas depth motion, frozen engine figures and persistent qualifications, WebAudio score that turns minor below zero, one-second MediaRecorder slices, encoded-container duration checking and MP4 preference with explicit WebM fallback. Assets are under 8 MB; provenance is in studio/demo/PROVENANCE.json. The person is fictional and all imagery illustrative. No speech recording is claimed.

Evidence: 21 focused offline tests passed across shared/world/world.test.ts, studio/studio.test.ts and studio/assets.test.ts. Final npx.cmd --no-install tsc --noEmit passed. Tests cover actual shared baked manifest compatibility, six nonempty aligned mask/image/background sets under 8 MB, figures/shortfall captions, schema/input limits, SAM allocation bounds, quote parsing, consent, cross-site refusal and no-key honesty. Four real provider smoke checks passed using synthetic content: hire planning, pricing-film direction, synthetic PDF quotes/amount/payment days, SAM adapter. See shared/world/LIVE-CHECK.json. Actual returned JPEG dimensions must be used for SAM; requested output size is not authoritative. Initial live checks inside Vitest were stopped by the repo's offline guard; the separate explicit paid smoke harness preserves the normal offline rule.

Not verified: browser rendering, IndexedDB in-browser, real document/phone accuracy, audible score, actual MP4/WebM playback/duration, deployed routes, or fully mounted founder studio. No browser, dev server or full test suite was run. Static offer/pressure images and a clean background were inspected. Generated worlds currently share one fictional person across paths and say so. Root should add dedicated world/document guard names/limits; currently the existing guarded advisor=40 and intake=20 buckets are used without bypass. One world uses 10 requests and one fully layered film uses 19.

Exact imports, state and mount lines are in web/src/immersive/studio/MOUNT.md. Add manifest={founderWorld} to PhotoWorld; mount WorldStudio with onWorld={setFounderWorld}, ContractDrop with a pending-proposal callback, and lazy FilmStudio with snapshot/story/world. Progress events can feed Worker B's trace. Current Vite API resolver is dynamic and needs no new route mapping.

PUBLICATION BLOCKED: git add/commit cannot create the parent checkout's index.lock (permission denied); shell push fails SEC_E_NO_CREDENTIALS. Connector read verified Sibusiso-K/Parallax and push=true, but automatic approval review rejected the first github_create_blob: "MCP tool call requires approval, but approval policy is never". No C commit, push, blob or branch mutation succeeded. Authorized-terminal commit/push commands with exact C paths are in MOUNT.md. No main/reset/stash/rebase/force action was used.

Vault findings/log appends are outside the writable root. Exact pending lesson and log lines are prepared in MOUNT.md for the integration owner; no vault edit is claimed.
