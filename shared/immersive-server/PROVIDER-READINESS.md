# Provider readiness for immersive advisor and voice

**Status: not ready for a provider key or live test.** The immersive advisor and voice HTTP route wrappers currently pass a null host and return 503. They do not read a provider credential or implement a real speech transport. The local browser demo uses speech synthesis supplied by the browser/device and remains fictional, not a hosted model. Do not place a provider secret in a frontend variable, URL, source file, chat or committed file.

## Settings that exist in code

| Server-only name | Current behavior |
| --- | --- |
| `IMMERSIVE_ADVISOR_ENABLED` | Only exact `true` enables the advisor factory; the checked-in route still has no host and stays unavailable. |
| `VOICE_STT_PROVIDER` | Only `adapter` enables the factory path when a host with an inspector and adapter is supplied. No real provider is configured. |
| `VOICE_TTS_PROVIDER` | Only `adapter` enables the factory path when a host with a TTS adapter is supplied. No real provider is configured. |
| `META_MODEL_ENABLED` and `META_API_KEY` | Existing **separate intake** Meta adapter settings; immersive routes do not consume these. Do not turn on the intake model for this task. |
| `META_API_BASE_URL` and `META_MODELS` | Optional settings for that existing intake adapter, not an immersive speech configuration. |

All switches should remain absent or disabled. The project ignores `.env` and `.env.*` except `.env.example`; no secret is needed for the local demo. No credential name for an immersive STT/TTS provider exists yet, and inventing one would not connect a provider. When a provider is selected and its transport is implemented, document its actual credential name and exact server-side setup before requesting a live test; a key must be entered directly into a server-only secret store or ignored server `.env`, never pasted into chat.

## Minimum before a real test

1. Implement actual user authentication and server-owned current session, selected path, snapshot, revision and request generation. Protect cookie-based routes from CSRF as appropriate. The current local SQLite prototype is process-local and is not a shared production store.
2. Implement a protected shared store with atomic current-generation checks on answer creation and retrieval, cryptographically unpredictable short-lived answer IDs, per-user/session binding, revocation and expiry. Verify cross-instance behavior and keep `ClaimRef`/the deterministic engine as the only source of financial figures.
3. Choose and implement the real provider transport with server-only secrets, authenticated worker/service access where used, a decoder for the actual audio codec, bounded data, timeout, request and spend caps, cancellation handling and sanitized errors. Assess provider data processing, retention and subprocessors; no unapproved provider calls or paid usage.
4. Add explicit microphone consent, stop/revocation and editable transcript, plus current-answer checks before playback. Keep typed use and captions available on denial or failure. Test isolation, stale requests, revocation, actual audio limits, outages and secret leakage against the real host.
5. Only after these steps, document the exact server-only credential variable for the selected implementation and obtain authorization for a small nonproduction provider smoke test with a spending cap. Verify provider result, browser audio, device behavior and consented accent/name/amount accuracy separately. No fixture, configured switch or local browser voice is live-provider evidence.
