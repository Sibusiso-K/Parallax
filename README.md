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
  - **Self-check** (`shared/intake/check.ts`): a second Muse Spark pass compares the figures it read with the
    founder's story and flags contradictions ("R80k a month" against "only around R45 000"). It changes nothing, and
    a note is kept only if it uses the founder's own numbers.
  - **What-ifs in your own words** (`shared/whatif/read.ts`, `POST /api/whatif`): typed or spoken ("what if they pay
    late and I raise prices 10%?"), Muse Spark reads it into lever positions and the engine reruns all three futures.
    The model sees only the words, never a figure.
  - **A board meeting of your futures** (`shared/chat/board.ts`): one question goes to A, B and C at once, each
    answering from its own path; then a Muse Spark moderator says where they agree and differ. Code deletes any
    moderator sentence that contains a number.
  - **South African languages** (`shared/chat/languages.ts`): the story can be in English, isiZulu, isiXhosa,
    Afrikaans, Sesotho or Setswana, and future you, the board and the moderator reply in it. Figures are still filled
    in by the engine.
  - **Meta inside:** the **Meta** count in the top bar lists every model call in the tab: what it did, which Meta
    model answered, and how long it took (`web/src/lib/meta-log.ts`, metadata only).
- **No model produces a figure.** Every number comes from the cash engine in `shared/engine/`, and `shared/guard/`
  keeps figures out of model replies. The room's advisor is checked sentence by sentence, and the browser checks each
  figure again against its own engine run, withholding the answer if any figure differs. The three paths come from
  code templates (`shared/paths/`), and the **Safest** marker on the futures screen is a fixed engine rule
  (`shared/engine/compare.ts`), not a model's opinion.
- **Every model client refuses `-contributor` models**, which would train on what is sent, and has timeouts, bounded
  retries, one repair retry and a fallback to demo mode (`shared/providers/`).
- **The UI** was first generated with Lovable on 30 Oct, then reworked by hand into the Control Room design.
- **The 3D courtyard** is built from CC0 sources (Poly Haven and MakeHuman) by `assets/blender/build_courtyard.py`.
  Each source and its licence is listed in `assets/provenance.json`, and the CC BY overshirt's credit is in `assets/CREDITS.md`.
  In the room the founder can walk the courtyard (Rapier physics, loaded only when **Walk** is pressed), press a place
  to walk there, and make a vertical reel or a PNG of one month in the browser. Nothing is uploaded.
- **Who built what (team Sonar):** Sibusiso (`Sibusiso-K`) wrote the cash engine, intake, the chat and session
  routes, the UI flow, and the self-check, what-ifs, board meeting, languages and Meta panel. Lethabo
  (`LethaboMH14`) wrote most of the 3D room: walk mode, the room's advisor, the reel and PNG, and the draft
  characters. The commit history shows each change.

## Using it for the first time

The journey strip along the top (Tell, Check, Futures, Room, Ask, Decide) is the way through. Every screen has one
**Next** and a **Back**.

1. Open the app, tick **I am 18 or older**, then press **Try the demo** (a fictional caterer weighing a big contract)
   or **Tell my own story**.
2. **Tell.** Pick your language, then type the decision the way you would tell a cofounder: what the business sells
   and spends each month, the cash in the bank, and the choice on the table. **Speak instead** records up to 60
   seconds and turns it into text you can correct.
3. **Check.** Answer the follow-up questions one at a time, or press **I don't know** for a marked default. Then tap
   any figure to fix it in place. The self-check flags anything that disagrees with your story. If the story is out
   of scope (for example, the founder is under 18), Parallax says why.
4. **Futures.** A, B and C side by side: lowest cash, the month cash runs out, and cash at month 36, with the safest
   one marked. Try a what-if with the switches, or say it in your own words.
5. **Room.** **Step inside** a future: the 3D room, a month slider, and a question box.
6. **Ask.** Question each future you, or hold a **board meeting** and ask all three at once.
7. **Decide.** Rate how each future sits with you, write your memo, print it, and see the whole journey.

Your decision is **saved as you go**, so a reload or a return visit offers to pick up where you left off. It is
stored in Parallax's Supabase database under a private code that only your browser holds. Row-level security
lets each request reach only its own row (`supabase/migrations/`). With no database configured, the copy stays in
your browser instead.

**Export (JSON)** under **Tools** downloads the session. **Delete everything** erases it, the saved copy included, and
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

With `META_MODEL_ENABLED` on, the chat, the board's moderator, the self-check, the what-ifs, the room's advisor, and
the founder's own room and portrait use the same key.

Every route that spends credits (`intake`, `chat`, `advisor`, `scene`, `transcribe`, `whatif`) refuses browser calls from other
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

GitHub Actions runs the typecheck, the tests and the build on every pull request and every push to `main`
(`.github/workflows/ci.yml`). It needs no secrets and cannot spend credits. Every response carries security headers
(`vercel.json`): `nosniff`, a strict referrer policy, no framing by other sites, and a permissions policy that keeps
only the microphone.

## Layout

- `web/`: the React app (Vite).
- `api/`: Vercel Functions: `intake` (also the self-check), `transcribe`, `chat` (also the board's moderator),
  `advisor`, `scene`, `whatif`, `session` and `health`.
- `supabase/migrations/`: the database table and its row-level security.
- `shared/`: the logic both sides run:
  - `intake/`: reading the story, the checks on it, and the Muse Spark self-check.
  - `profile/`: the business profile, with defaults from `defaults/za.json`.
  - `paths/`: the three paths.
  - `engine/`: the cash simulation, and the side-by-side comparison with its safest rule and what-if lens.
  - `guard/`: keeps figures out of model replies.
  - `chat/`: the future-self agent, the board's moderator, and the reply languages.
  - `whatif/`: reading a what-if in words into lever positions.
  - `scene/`: the 3D room's claims, its dressing for each founder's business, and its advisor.
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
- Replies in isiZulu, isiXhosa, Afrikaans, Sesotho and Setswana have not yet been reviewed by speakers of each
  language. The screens themselves are in English only.
- Muse Spark calls take time: about 15 seconds to read a story and about 30 seconds for a full board meeting.
- What-ifs on the futures screen are a preview: they do not change the saved numbers.
- The draft characters use one CC BY garment, the advisor's overshirt (CC BY 4.0). Its credit is in `assets/CREDITS.md`
  and in the room's caption, which shows whenever the characters do (`?people`).
