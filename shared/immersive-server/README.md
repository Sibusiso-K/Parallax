# Server advisor and voice integration: fixture building blocks

**Not deployed.** These building blocks live in `shared/`, not `api/`: every file under `api/` becomes a Vercel Function and the Hobby plan allows 12 per deployment. The three route wrappers this design describes (`POST /api/scene/advisor`, `/api/voice/transcribe`, `/api/voice/speak`) each called `createRoutes(routeConfig(process.env), null)` and returned 503, so they are left out until a host exists.

These modules are not wired into the app. Disabled-by-default HTTP wrappers and their host requirements are documented in HTTP-INTEGRATION.md. They perform no provider calls and do not implement authentication, session persistence, audio decoding, timeouts, rate limiting or a voice worker. The existing browser fixture remains unchanged. No model-generated explanation is accepted; the server fixture selects a bounded metric and renders a ClaimRef against the engine snapshot. Financial assumptions are not verified facts.

## Server configuration

The default is off. In a server-only, gitignored `.env` or a secret manager set `VOICE_STT_PROVIDER=adapter` and/or `VOICE_TTS_PROVIDER=adapter` only after a reviewed host supplies the corresponding authenticated adapters. Other values fail closed. `configured-unverified` indicates a requested configuration, not a working provider. Never put credentials in a `VITE_` variable, the frontend, URLs, logs, chat, or a committed file. Existing Meta settings `META_MODEL_ENABLED` and `META_API_KEY` belong exclusively to the server; this fixture does not read them or call Meta. Do not add real values to `.env.example`.

## Work required before exposing a route

1. Authenticate and authorize each request; create the scope from the server-owned current session, revision, selected path and snapshot. A snapshot key is a non-cryptographic fingerprint and is not an authorization token. Do not trust a client-supplied scope or answer object.
2. Store approved answers server-side under unpredictable, short-lived IDs bound to user, session, path and revision. Look up the answer for TTS; never expose unrestricted client text to synthesis. Invalidate answers when the revision, path or session changes. Integrate RequestGate and AbortController with the UI and check current generation before display and playback.
3. Implement an isolated, authenticated audio decoder/inspector that checks the actual codec and decoded duration and fails closed on malformed input; supply a bounded STT adapter. Add host-enforced request/body limits, timeouts, concurrency and rate limits, and no hidden retries. Supply a similarly bounded TTS adapter. Handle provider cancellation and failures; never log or retain raw audio or transcripts by default.
4. Add explicit microphone consent, editable transcripts, captions, interruption and typed fallback. Voice-driven edits must remain proposals requiring deliberate Apply. Review actual privacy and subprocessors before enabling the service. Only genuine alignment data supports viseme timing; amplitude is approximate mouth motion.
5. Test auth, per-user isolation, expiry, malformed codecs, duration, provider timeouts, cancellation and route limits in the chosen hosting environment. Run consented South African accent/name and rand transcription evaluations, plus real browser and device tests. No such acceptance or live provider verification is claimed here.

The adapter interfaces carry an AbortSignal but cannot force an implementation to stop; the host must enforce a deadline and discard late results. The host must also cap incoming bytes before buffering. The fixture's answer includes code-formatted claims and any shortfall qualification; synthesize exactly its `text` and display the same text.
