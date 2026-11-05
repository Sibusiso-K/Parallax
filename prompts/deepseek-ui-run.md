# Prompt: full UI run for Parallax (clipping, layout, polish)

Paste everything below the line into the DeepSeek harness, with the repo checked out at `integration/live-build`.

---

You are doing a visual QA pass on **Parallax**, a React/Vite web app. Parallax lets a small-business founder rehearse a
decision: take a contract, hire, or raise prices. Your job is to drive every screen in a real browser, at several
sizes, and find anything clipped, overlapping, cut off, misaligned, unreadable or ugly. Fix what you find. The app
must look finished and consistent for a hackathon judge seeing it for the first time.

## The repo

- `web/src/main.tsx`: the screen map.
  - Screens: `start`, `intake`, `heard`, `generating`, `profile`, `paths`, `chat`, `explore`, `compare`, `comfort`
    and `summary`.
  - `start`, `intake` and `generating` stand alone. The rest sit inside the Control Room frame (`Frame.tsx`), which
    has a sidebar.
- `web/src/components/parallax/*.tsx`: the screens.
  - `StartScreens.tsx`: start, intake and heard.
  - `ProfileScreens.tsx`: generating and profile.
  - `PathScreens.tsx`: paths and the assumptions panel.
  - `ChatScreen.tsx`.
  - `ExploreScreen.tsx`: the 3D room, Three.js.
  - `DecideScreens.tsx`: compare, comfort and summary (the printable memo).
  - `charts.tsx`.
  - `FieldGrid.tsx`.
  - `shared.tsx`.
- `web/src/styles.css`: all styling, in one file.
  - Design tokens are on `:root`: `--navy`, `--accent`, `--panel`, `--ink`, `--ink-2`, `--muted`, `--warn`, `--A`,
    `--B` and `--C`.
  - Breakpoints are at 1280, 1180 and 860px.
- `/?world` opens the 3D demo room on its own page.
- Run the app with `npm ci`, then `npm run dev -- --port 5173`, and open http://localhost:5173.
  - With no settings it runs in demo mode: it reads only the demo story and makes no network calls. That is the mode
    to test in.

## Hard rules

1. **No live Meta calls.** Never read `.env.local`, and never set `META_MODEL_ENABLED` or `META_VOICE_ENABLED`.
2. **No commits, pushes or branch switches.** Leave every change in the working tree, for review.
3. **Do not add dependencies to `package.json`.** If you need Playwright or Puppeteer, install it in a scratch folder
   outside the repo, or use `npx`.
4. **Keep the existing design language:**
   - the navy hero band with its slanted edges
   - rounded panels (`--panel`), pill buttons and the bold condensed headings
   - colours A, B and C for the three paths
   - Use the tokens; do not add new colours. Do not restyle the app; fix it.
5. **Do not change what the copy says.** You may shorten a label only when it cannot fit, and you must keep its
   meaning.
6. After every change, `npm run typecheck`, `npm test` and `npm run build` must pass. They currently pass with 333
   tests.

## How to reach every screen

Drive it like a first-time user:

1. On **start**, tick **I am 18 or older**, then press **Begin**.
2. On **intake**, press **Use the demo story (fictional founder)**, then **Continue**.
3. On **heard**, answer each "One more thing" question.
   - Do one run where you press **I don't know** for every question.
   - Do a second run where you type values, such as `8k to 12k`.
   - Press **This is right**.
4. **generating** moves to **profile** on its own, after about 4 seconds.
5. From **profile**, go to **paths**. Open each of A, B and C. Open the **assumptions panel** and edit one assumption.
6. Open **chat** for each path and send two messages. The replies are scripted.
7. Open **explore**. The 3D room needs WebGL; give it time to load.
8. Open **compare**, **comfort** and **summary**. Also check the memo in print preview (`window.print()` or
   print-media emulation).
9. Use the sidebar to jump between screens. Also try **Export JSON**, and **Delete everything**. Delete everything
   asks you to confirm.
10. Check the block state as well: type `I'm 16 and a client wants me to take a big catering contract.` on intake and
    press Continue. The heard screen must show the red-bordered "Parallax can't go on with this" box.
11. Check **`/?world`**.

## What to check

On every screen above, check these sizes:

- 375×812 (phone)
- 768×1024 (tablet)
- 1024×768
- 1280×800
- 1440×900
- 1920×1080

Take a full-page screenshot of each screen at each size. Then check:

- **Clipping:**
  - Text cut by `overflow: hidden`, `clip-path` or a fixed height. The navy hero uses a slanted `clip-path`. Its
    depth was just changed to a fixed `--slant`, so confirm nothing touches the slant at any width.
  - Text cut off at the ends of buttons or pills.
  - Truncated headings, values or chart labels.
- **Overflow:**
  - Any horizontal page scroll, where `document.documentElement.scrollWidth > innerWidth`.
  - Long values, such as R1,000,000,000 or a 200-character decision, that break cards, the field grid, the path cards,
    the compare table or the memo.
- **Overlap:** elements sitting on top of each other, especially:
  - the hero portraits over the hero text
  - the sidebar over the content at 860px and below
  - the assumptions panel over the screen
  - the chat composer over the messages
- **Alignment and rhythm:**
  - Uneven gaps.
  - Cards in one row with different heights where they should match.
  - Buttons not lined up.
  - Inconsistent padding between screens.
- **Readability:**
  - Text contrast at least 4.5:1, or 3:1 for text 24px and larger.
  - Pale text on the navy band, and on white where the band ends.
  - Nothing smaller than 11px.
- **States:**
  - empty
  - loading ("Reading…" and generating)
  - error notices
  - disabled buttons
  - focus rings when moving with the keyboard
  - hover
- **Charts** (`charts.tsx`):
  - Labels collide or run off the edge.
  - Too many ticks. A path with very large figures can draw far too many gridlines; cap the tick count.
- **The 3D room:**
  - The canvas fills its area at every size.
  - It shows a clean fallback when WebGL is missing.
  - The labels stay readable.
- **Console:** no errors or React warnings on any screen.

Use a script as well as your eyes. For each screen and size, find elements whose `scrollWidth > clientWidth` or
`scrollHeight > clientHeight` while `overflow` is `hidden` or `clip`, plus text nodes whose bounding box falls outside
their clipping ancestor. Report what it finds.

## Make it look good, too

After fixing the defects, make up to **five** small polish changes that make the app look more finished. Some
examples:

- consistent page headers
- even card heights
- a better empty state
- smoother screen transitions
- clearer primary and secondary buttons

Keep each one small and in the existing style. Explain each one in the report, so it can be reverted on its own.

## Report

End with one Markdown report:

1. **Screens × sizes:** a table of every screen against every size, marked pass or fail. Link the before and after
   screenshots, saved in a folder outside the repo.
2. **Every defect:** screen, size, what was wrong (with the screenshot), the cause (file and line), and the fix.
3. **The polish changes**, and why each one helps.
4. **Anything left unfixed**, and why.
5. **The list of changed files**, and the final typecheck, test and build results.
