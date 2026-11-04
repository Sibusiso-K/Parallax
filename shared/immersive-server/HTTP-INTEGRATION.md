# Immersive advisor and voice HTTP integration

## Current state

`POST /api/scene/advisor`, `POST /api/voice/transcribe`, and `POST /api/voice/speak` are designed here but not deployed (see README.md): `createRoutes` with a null host returns 503, so **flags alone cannot enable them**. The route factory and fake host are tested offline; this is not a production authentication implementation or a live provider integration. The existing app has client-local sessions and does not provide a server-owned authenticated session store. Do not substitute a client snapshot key, client-supplied principal, in-memory map, or the non-cryptographic snapshot fingerprint for authentication or authorization.

## Server-only environment

```
IMMERSIVE_ADVISOR_ENABLED=false
VOICE_STT_PROVIDER=disabled
VOICE_TTS_PROVIDER=disabled
```

These are the defaults when absent. For a future reviewed host, the only recognized opt-in values are `IMMERSIVE_ADVISOR_ENABLED=true` and `VOICE_STT_PROVIDER=adapter` / `VOICE_TTS_PROVIDER=adapter`. All other values stay disabled. These settings do not select, implement, verify or connect any real provider. `META_MODEL_ENABLED` and `META_API_KEY` remain existing server-only settings for the separate intake adapter; these routes do not use them. This work introduces no new credential variable, endpoint URL or `.env` file. Keep credentials exclusively in a server secret manager or gitignored server `.env`, never `VITE_` variables, client code, URLs, logs, chat or committed files.

## Contract and host requirements

The advisor accepts strict JSON `{ "intent": "cash", "month": 4 }` or `{ "intent": "lowest" }` / `{ "intent": "shortfall" }`. It never accepts a snapshot, question prose or model-generated figures from the request. It returns a fixture label, approved claim text and an answer ID. Transcription accepts bounded raw audio (`audio/webm`, `audio/ogg`, `audio/wav`); the injected inspector must decode the bytes, validate the true codec and duration, and refuse malformed content. The editable transcript always requires confirmation. Synthesis accepts only strict JSON `{ "answerId": "..." }` and returns bounded opaque bytes; a real adapter/route must set an accurate validated audio format before a player consumes them. It cannot accept client-supplied speech text.

The integrating host must provide:

1. Real per-request authentication and authorization, CSRF/origin protections appropriate to its credential mechanism, and server-derived principal, current session, path, revision, snapshot and request generation. `current` must check authoritative shared state on each call, including after provider completion. Advancing generation must invalidate older work even when the selected path later returns to the same value.
2. A shared, durable, access-controlled answer store. `saveAnswer` must atomically verify the authenticated principal, session, path, revision, current generation, non-aborted signal and expiry before committing; generate an unpredictable cryptographically random ID. `loadAnswer` must enforce all of those bindings and expiration. Do not trust the ID alone. A failed or late write must not make an answer available.
3. Authenticated, bounded adapters and a decoder running under resource limits. Enforce request size at the platform edge before buffering, per-principal rate/concurrency limits, worker identity, quotas, timeouts, cancellation, and no hidden retries. The ten-second handler deadline discards late results; it cannot force an adapter that ignores cancellation to stop work. Do not log or retain raw audio, transcripts, credentials or financial stories by default. Document actual retention and subprocessors before enabling.
4. Client consent and interruption controls, editable transcript, captions, typed fallback and generation checks before display/playback. Voice edits remain proposals requiring Apply. Only verified timing supports phoneme lip sync. No route grants access to media assets or changes financial state.

The factory caps JSON at 2,048 bytes and audio at 2,000,000 bytes, checks actual decoded duration up to 20 seconds through the inspector, rejects control characters in transcripts, marks responses `no-store`, sanitizes errors and uses a ten-second deadline. It does not by itself provide platform edge limits, real auth, CSRF protection, durable storage, decoder, rate limiting, media type validation for synthesized audio, or a provider. Production route wrappers must not receive a host until these controls exist and have been reviewed.

## Real test readiness

First implement and test the host controls above and wire only a nonproduction environment. Then document the selected provider, model, account, data terms, exact secret variable names, timeout/quotas and cost cap; obtain the user's authorization for that provider and usage before any network call. Supply credentials directly to the server secret store, never in chat. Run an explicit minimal smoke test, record actual provider/model, result and cost without secrets or raw personal data, and separately test consented South African names, amounts and accents, browser interruption and device playback. Configuration or a passing fixture test is not evidence of live availability or accent accuracy.
