# Parallax

Rehearse a business decision before you bet the business on it. A founder describes a choice in their own words: take
a big contract, hire, or raise prices. Parallax reads the figures, builds three possible paths, and runs 36 months of
cash on each one. Every figure is computed in code, never by a model. The founder can stress-test each path, question
the founder they could become on it, and print a decision memo.

Live: https://parallax-one-ivory.vercel.app

Parallax is a reflection aid, not financial advice. It is for people aged 18 and over.

## Built during the Meta Global AI Developer Hackathon

Everything here was built during the hackathon, between 29 Oct and 4 Nov 2026. The repository's first commit (20 Oct)
holds only a `.gitignore`.

- **Meta models:**
  - Muse Spark (`muse-spark-1.3`, falling back to `muse-spark-1.2`) reads the founder's story into figures, each with
    the words it came from.
  - Muse Voice Transcribe turns **Speak instead** into text.
  - Muse Image made the three future-self portraits.
- **No model produces a figure.** Every number comes from the cash engine in `shared/engine/`, and `shared/guard/`
  keeps figures out of model replies.
- **The UI** was first generated with Lovable on 30 Oct, then reworked by hand into the Control Room design.
- **The 3D courtyard** is built from CC0 sources (Poly Haven and MakeHuman) by `assets/blender/build_courtyard.py`.
  Each source and its licence is listed in `assets/provenance.json`.

## Using it for the first time

1. Open the app, tick **I am 18 or older**, and press **Begin**.
2. **Tell it your decision.** Type it the way you would tell a cofounder: what the business sells and spends each
   month, the cash in the bank, and the decision on the table. **Speak instead** records up to 60 seconds and turns it
   into text you can correct. To see a full run straight away, press **Use the demo story** (a fictional founder).
3. **Check what it heard.** Each figure is shown with the words it came from. Answer the follow-up questions, or press
   **I don't know** to use a marked default. Any figure can be edited. If the story is out of scope (for example, the
   founder is under 18), Parallax says why and asks you to change what you wrote.
4. **Meet three futures.** Paths A, B and C each show 36 months of cash with a likely, bad and good case. Open the
   assumptions to see where every number comes from, and chat to each future self.
5. **Compare and decide.** Put the paths side by side, check how much risk you are comfortable with, and print the
   decision memo.

**Export JSON** in the sidebar downloads the session. **Delete everything** clears it. Nothing is stored on the
server.

## Running it locally

You need Node 20 or later.

```bash
npm ci
npm run dev
```

Open http://localhost:5173. The dev server also serves `/api/*` from the same handlers Vercel runs, so you don't need
the Vercel CLI.

With no settings, the app runs in **demo mode**: it reads only the demo story, and the mic returns the demo text. This
mode makes no network calls.

### Connecting the Meta models (optional)

Copy `.env.example` to `.env.local` and fill it in. Never commit `.env.local`: the repo is public.

| Variable | What it does |
| --- | --- |
| `META_API_KEY` | Your Meta Model API key. |
| `META_MODEL_ENABLED` | `true` lets intake read any story with the model. Off by default. |
| `META_VOICE_ENABLED` | `true` turns on Meta speech-to-text for **Speak instead**. Off by default. |
| `META_MODELS`, `META_ASR_MODEL`, `META_API_BASE_URL` | Optional overrides. The defaults live in `shared/providers/`. |

## Checks

```bash
npm run typecheck
```

```bash
npm test
```

```bash
npm run stress
```

```bash
npm run build
```

`npm test` runs offline: a guard blocks real network calls. `npm run stress` runs the randomised suites, and
`STRESS_RUNS=2000 npm run stress` runs them harder.

## Layout

- `web/`: the React app (Vite).
- `api/`: Vercel Functions: `intake`, `transcribe` and `health`.
- `shared/`: the logic both sides run:
  - `intake/`: reading the story, and the checks on it.
  - `profile/`: the business profile, with defaults from `defaults/za.json`.
  - `paths/`: the three paths.
  - `engine/`: the cash simulation.
  - `guard/`: keeps figures out of model replies.
  - `voice/`: WAV handling for speech-to-text.

Open `/?world` for the 3D demo room on its own.
