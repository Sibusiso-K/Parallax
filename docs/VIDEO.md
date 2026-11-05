# Demo video: pointers for recording

This note is for whoever records the three-minute demo. It follows the live product at
https://parallax-one-ivory.vercel.app, which is built from `main`. Everything in the script was built during the
hackathon (from 29 October 2026).

## Before you press record

1. **Check the live site is up.** Run `npm run smoke -- https://parallax-one-ivory.vercel.app` from the repository.
   All 25 checks should pass. If the health check says the model is not ready, do not record until it is.
2. **Start clean.** Open the site in a private window, or clear the site's storage. A saved decision from an earlier
   session can change the first screen.
3. **Set up the screen.** Use desktop width (about 1280 pixels) for the main take. Keep the browser zoom at 100%.
   Leave motion on, because the animations are part of the product. Close other tabs and notifications.
4. **Microphone.** "Speak instead" needs browser permission. If it is not allowed, type the story instead; the typed
   path is the same.
5. **Time the waits.** Reading a story takes about 15 seconds, and the board meeting takes about 30 seconds. Plan to
   cut those waits, or talk over them. Do not cut to a spinner for longer than a few seconds.

## The three-minute script

| Time | Screen | What to do | What to say (suggested) |
|---|---|---|---|
| 0:00–0:15 | Start | Show the headline and the two buttons. | "Take the contract? Hire? Raise prices? Parallax rehearses the decision before you bet the business on it." |
| 0:15–0:40 | Check | Press **Try the demo**. Show the four figure cards and the quotes. Answer the one follow-up question with **Next**. | "Every figure shows the words it came from. You can fix any of them in place." |
| 0:40–1:05 | Futures | Show the three futures side by side and the **Safest** marker. Type a what-if: *"what if they pay late and I raise prices 10%?"* Show the note that says it was read by the model. | "Muse Spark reads the what-if into the levers. The engine reruns all three futures. The model never writes a number." |
| 1:05–1:25 | Planner | Press **Find a safer plan** with the default floor. Show the steps and the options, each with what it gives up. | "A planning agent calls the engine as a tool, tries settings, and lists options. It does not choose for you." |
| 1:25–1:45 | Room | Press **Step inside**. Move the month slider once. Ask one suggested question. | "The same numbers, in the room. The advisor only moves the view." |
| 1:45–2:15 | Ask | Press **Ask future you** and show one reply. Then **Hold a board meeting** with a suggested question. Cut or talk over the wait. Show the three seats and the moderator's summary. | "Three futures answer the same question. A moderator says where they agree and where they differ. It states no numbers." |
| 2:15–2:35 | Meta inside | Click the **Meta** count in the top bar. Show the list: which model answered, and how long it took. | "Every call to a model is listed here: which model, what for, and how long it took." |
| 2:35–3:00 | Close | Return to the start or the memo. Read the disclaimer on screen. Show the repository address. | "Every figure is computed in code. It is a reflection aid, not financial advice, and it is one possible future." |

## Facts to say, and their sources

Use these only as written. The full note, with confidence ratings, is in `docs/IMPACT.md`.

- **62%** of South African small businesses reported cash flow problems in the past year (Xero, January–February 2026,
  427 businesses, vendor-commissioned).
- **R12.4 billion** in government invoices, 95,399 of them older than 30 days, were unpaid at the end of Q2 2025
  (National Treasury, relayed by Business Report). This is government payment only.
- **1,534** business liquidations in 2025, of which 1,341 were voluntary (Stats SA, relayed by EWN).

Say clearly, once, that we have no user evidence yet. Judges respect that more than a claim they cannot check.

## Things not to say

- Do not say the product has been tested with founders. It has not.
- Do not say Muse Wonder or SAM are part of the live product. They are not on `main`.
- Do not say the planner chooses a plan. It lists options.
- Do not say the room is photorealistic. The draft characters are behind `?people` and are not part of the default view.
- Do not say the figure guard checks every sentence for accuracy. It checks that figures come from the engine.
- Do not show a key, an environment file, or a device code. The Meta panel shows model names only, which is fine.

## If something goes wrong on camera

- **A model call fails.** The app falls back to code and says so on screen. Re-record that step rather than explaining
  it in the video.
- **A wait is too long.** Cut it. The board meeting is the usual case.
- **The site is slow.** Re-run the smoke test. If the health check fails, wait a few minutes and try again.

## After recording

- Upload the video, then add its link to the submission form and to the repository README.
- Post the demo on X and add the link to the submission, if the team is entering the viral bonus.
