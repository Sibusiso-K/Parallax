# How the demo video was made

Nothing here runs in the product. These scripts are kept so anyone can see what is real in the film.

- **App footage is real.** `capture.mjs` drives the app in Edge over the DevTools protocol and records frames. The lever, board, repaint and Apply take replays the API replies saved from one live run, so the take could be repeated without new paid calls. That run's speech, sources and images are shown as they came back. The salon and contract takes are live calls. Cuts are sped up, and the film says so.
- **Close-ups are rendered, not the app's own frame.** `cine.py` applies the app's technique at higher resolution: Muse Image edits of one person's mouth and eyes, aligned to one base frame and blended from word timings. The film labels this. Her in-app self uses the same idea at room scale, with no WebGL (`web/src/immersive/photo/LivingPerson.tsx`).
- **Stills** come from `muse-image-1.0` through `film_gen.mjs`. People are fictional.
- **Voices** are Microsoft en-ZA neural voices through the unofficial `edge-tts` client (`tts.py`), not a Meta model. Meta has no text-to-speech. In the app the voice is the browser's.
- **Score** is synthesised by `score.py`, with nothing licensed.
- **Edit** is `assemble.py`, with ffmpeg and libass.
