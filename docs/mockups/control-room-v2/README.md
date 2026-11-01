# Mockup 5 v2: Control Room, founder version

Four 1920 × 1080 pages: the founder version of the Control Room mockup chosen on 1 Nov 2026 ([DESIGN.md §0](../../DESIGN.md)). Every figure is engine output for the demo founder (fictional), from the `feat/founder-pivot` branch.

| File | What it is |
|---|---|
| `Parallax-mockup-5-v2-Control-Room.pdf` | The deliverable: four pages. |
| `engine.json` | The demo founder's figures, written by the engine probe. Regenerate it with the probe; do not edit it by hand. |
| `engine-probe.test.ts.txt` | The probe that writes `engine.json` (see below). |
| `build2.mjs`, `lib2.mjs`, `chart2.mjs`, `p1.mjs` to `p4.mjs` | The build: the pages, the charts and the shared helpers. |
| `style.css`, `style2.css`, `style3.css` | Styles: the first two are the v1 base styles; `style3.css` is for v2. |
| `avatar-A-480.png`, `avatar-B-480.png`, `avatar-C-480.png` | The founder on each path, generated with Muse Image by `generate-avatars.mjs`. AI-generated and labelled as such. |
| `generate-avatars.mjs` | The one-off that generated the portraits (four images, USD 0.04). |

The earlier two-page mockup, with the personal-decision figures, is kept in [`../control-room-v1/`](../control-room-v1/) for history.

## Rebuild the PDF

```bash
npm install
npm run build
```

`npm install` fetches `puppeteer-core` only; it does not download Chrome. Chrome is found at `CHROME_PATH`, or at the default Windows path. The build writes `mockup5v2.html` and `page1.png` to `page4.png` beside the PDF; they are git-ignored.

## Regenerate the figures

1. Copy `engine-probe.test.ts.txt` into `shared/` on `feat/founder-pivot`, named `_mockup_probe.test.ts`.
2. Run `PROBE_OUT=<this folder>/engine.json npx vitest run shared/_mockup_probe.test.ts`.
3. Delete the copy from `shared/`. Never commit it there.

## Regenerate the portraits

Only if the portraits need changing. The script needs `META_API_KEY` and costs about USD 0.04 for four images:

```bash
node --env-file=<repo>/.env.local generate-avatars.mjs
```

The script never prints the key, and it writes the full-size images beside itself, where `.gitignore` keeps them out of the repo. Resize them to 480 px before committing.
