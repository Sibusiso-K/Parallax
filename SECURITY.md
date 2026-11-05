# Security policy

## Supported versions

Only the code on `main` is supported. The live deployment is built from `main` on every merge.

## Reporting a vulnerability

Please **do not open a public issue** for a security problem. Report it privately using GitHub's private vulnerability
reporting on this repository (the "Security" tab, then "Report a vulnerability"). We aim to reply within three working
days and to agree a fix and disclosure date with you.

When you report, please include:

- what you found and where (file, route or screen);
- the steps to reproduce it, or a proof of concept that does not call a paid model;
- the impact you expect, and anything you have already tried.

Never include a real API key, a database key or a founder's personal data in a report.

## What is in scope

- The web application and the Vercel functions under `api/`.
- The guards in `shared/http/`, the figure guard in `shared/guard/`, and the saved-session code in `shared/session/`
  and `supabase/migrations/`.
- Anything that lets a browser spend model credits without the guard, read another visitor's saved decision, or see a
  server secret.

## Design notes for reviewers

- **Keys stay on the server.** The browser never receives `META_API_KEY`, `SUPABASE_*` service values, or any other
  server setting. The bundle is checked for this in the post-deploy smoke test (`npm run smoke`).
- **Paid routes refuse cross-site calls** and apply a per-visitor burst limit (`shared/http/guard.ts`). The limit is
  held in memory per function instance, so it slows floods rather than enforcing a quota. The billing limit on the
  model provider is the real ceiling.
- **Saved decisions are private to a browser.** A random device code stays in the browser; the server stores only its
  SHA-256 hash, and row-level security lets each request reach only its own row (`supabase/migrations/`).
- **Model output is checked before it is shown.** Sentences that carry figures are checked against the engine, and a
  reply that does not match its schema is repaired once or treated as a failure, never shown raw.
- **Security headers** on every response: `nosniff`, a strict referrer policy, no framing by other sites, COOP, and a
  permissions policy that allows only the microphone (`vercel.json`).

Parallax does not run a bug bounty programme.
