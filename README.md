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

- **Meta models, live in production:**
  - Muse Spark (`muse-spark-1.3`, falling back to `muse-spark-1.2`) reads the founder's story into figures, each with
    the words it came from.
  - Muse Spark answers as each future self, from the founder's own story and that path's figures
    (`shared/chat/future-self.ts`).
  - Muse Spark dresses the 3D room for the founder's own business, and Muse Image draws the founder there
    (`shared/scene/dressing.ts`, `shared/providers/image.ts`, and [docs/scene-from-prompt.md](docs/scene-from-prompt.md)).
  - Muse Spark answers as the advisor inside the 3D room (`shared/scene/advisor-model.ts`, `POST /api/advisor`). It
    may suggest what to look at next (a month, the late payment, an object, another path), and each suggestion only
    moves the view.
  - Muse Voice Transcribe turns **Speak instead** into text, and lets the founder ask the room out loud.
  - Muse Image made the demo founder's three portraits.
- **No model produces a figure.** Every number comes from the cash engine in `shared/engine/`, and `shared/guard/`
  keeps figures out of model replies. The room's advisor is checked sentence by sentence, and the browser checks each
  figure again against its own engine run, withholding the answer if any figure differs.
- **The UI** was first generated with Lovable on 30 Oct, then reworked by hand into the Control Room design.
- **The 3D courtyard** is built from CC0 sources (Poly Haven and MakeHuman) by `assets/blender/build_courtyard.py`.
  Each source and its licence is listed in `assets/provenance.json`, and the CC BY overshirt's credit is in `assets/CREDITS.md`.
  In the room the founder can walk the courtyard (Rapier physics, loaded only when **Walk** is pressed), press a place
  to walk there, and make a vertical reel or a PNG of one month in the browser. Nothing is uploaded. Its props and the
  figures on its paper are drawn in the browser from the engine (`web/src/immersive/courtyard/dressing.ts`).
- **Who built what (team Sonar):** Sibusiso (`Sibusiso-K`) wrote the cash engine, intake, and the chat and session
  routes. Lethabo (`LethaboMH14`) wrote most of the 3D room: walk mode, the room's advisor, the reel and PNG, and the
  draft characters. The commit history shows each change.

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
5. **Step inside.** **Explore this path** opens the decision as a 3D courtyard for contract decisions. Press **Walk**,
   then use WASD or the on-screen buttons, or press a place to walk there. Walk up to the contract, the pots or the memo
   board and press **E**. Ask the advisor by typing or with **Speak**; pull the late-payment switch and watch the room
   answer. **Create** makes a short video or an image of that month, in your browser, from your own figures.
6. **Compare and decide.** Put the paths side by side, check how much risk you are comfortable with, and print the
   decision memo.

Your decision is **saved as you go**, so a reload or a return visit offers to pick up where you left off. It is
stored in Parallax's Supabase database under a private code that only your browser holds. Row-level security
lets each request reach only its own row (`supabase/migrations/`). With no database configured, the copy stays in
your browser instead.

**Export JSON** in the sidebar downloads the session. **Delete everything** erases it, the saved copy included, and
gives the browser a new code.

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
| `META_MODELS`, `META_ASR_MODEL`, `META_IMAGE_MODEL`, `META_API_BASE_URL` | Optional overrides. The defaults live in `shared/providers/`. |

With `META_MODEL_ENABLED` on, the chat, the room's advisor, and the founder's own room and portrait use the same key.

Every route that spends credits (`intake`, `chat`, `advisor`, `scene`, `transcribe`) refuses browser calls from other
sites and allows each network address a burst of calls per ten minutes (`shared/http/guard.ts`). The count is kept per function
instance, so it slows floods but is not a quota. Set a spend limit on the Meta billing page as well.

### Saving decisions (optional)

Without these settings, a decision is kept in the browser only. To save decisions in Supabase, apply
`supabase/migrations/20261104120000_parallax_sessions.sql` to a project, then set:

| Variable | What it does |
| --- | --- |
| `SUPABASE_URL` | The project's API URL. |
| `SUPABASE_PUBLISHABLE_KEY` | Its publishable key. It is used only on the server, and row-level security limits each request to its own row. |

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
- `api/`: Vercel Functions: `intake`, `transcribe`, `chat`, `advisor`, `scene`, `session` and `health`.
- `supabase/migrations/`: the database table and its row-level security.
- `shared/`: the logic both sides run:
  - `intake/`: reading the story, and the checks on it.
  - `profile/`: the business profile, with defaults from `defaults/za.json`.
  - `paths/`: the three paths.
  - `engine/`: the cash simulation.
  - `guard/`: keeps figures out of model replies.
  - `chat/`: the future-self agent.
  - `scene/`: the 3D room's claims, its dressing for each founder's business, and its advisor.
  - `immersive-server/`: fail-closed server contracts for a future signed-in room. Not deployed.
  - `session/`: saved decisions in Supabase.
  - `voice/`: WAV handling for speech-to-text.
  - `http/`: the guard on the routes that spend credits.
  - `immersive-server/`: offline building blocks for a future room server. Nothing in it is deployed.
- `web/src/immersive/`: the 3D courtyard, walk mode, the room's advisor and the reel.

Open `/?world` for the 3D demo room on its own. Add `?people` to see the draft characters.

## Known limits

- The default assumptions in `shared/defaults/za.json` are placeholders, not sourced figures. The app marks each one.
- There are no accounts. A saved decision belongs to one browser's private code.
- Without a Meta key, the chat and the room's advisor use scripted answers, and the app says so.
- The characters behind `?people` are drafts, not photoreal.
- The reel has no sound: the browser's speech voices cannot be recorded.
- The reel and read aloud were checked only in Chromium-based browsers. Safari, Android voices and real phones are not
  yet checked.
- Limits count by network address, so visitors who share one connection share the limit.
- The draft characters use one CC BY garment, the advisor's overshirt (CC BY 4.0). Its credit is in `assets/CREDITS.md`
  and in the room's caption, which shows whenever the characters do (`?people`).
