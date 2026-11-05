# Contributing

Thank you for looking at Parallax. This guide is short on purpose: it covers how to run the project, how to check a
change, and how changes reach `main`.

## Run it

You need Node.js 20 or later (CI uses 24).

```bash
npm ci
npm run dev          # http://localhost:5173, in demo mode: no network calls
```

Demo mode needs no keys and makes no network calls. See [README.md](README.md#connecting-the-meta-models-optional)
for turning on the Meta models.

## Check a change

```bash
npm run lint         # oxlint: hook rules and correctness rules
npm run verify       # lint, typecheck, the test suite (offline) and the production build
npm run stress       # the randomised engine and pipeline suites (optional, slower)
```

`npm test` never reaches the network: a guard in `shared/testing/offline.ts` blocks every request, so a test cannot
spend Meta credits by accident. The live evaluation (`npm run eval:live`) is the only command that calls Meta, and it
is never run in CI. Run it only with the owner's agreement, because every call is billed.

## Rules that protect the project

- **Figures come from code, never from a model.** A change that lets a model state a number, or that bypasses
  `shared/guard/`, will not be merged.
- **No secrets in the repository.** Keys live in environment variables. `.env.local` is ignored by git. Run
  `git grep -nE "sk-[A-Za-z0-9]{20,}"` before you push if you are unsure.
- **Paid routes stay guarded.** Any new route that calls Meta must go through `shared/http/guard.ts`, and must refuse
  cross-site browser calls.
- **Contributor models are refused.** Model names ending in `-contributor` train on what they are sent; the clients
  refuse them.

## Branches, commits and pull requests

- Branch from `main`. Name branches `feat/…`, `fix/…`, `docs/…`, `chore/…`, `test/…`, `qa/…` or `ci/…`.
- Write commit messages as `type(scope): summary`, for example `fix(intake): do not label an empty reply as a reading`.
  Keep the summary under 72 characters, and say why in the body when the reason is not obvious.
- Keep pull requests small enough to review in one sitting. Each PR should pass `npm run verify` on its own.
- Use the pull request template. Describe what changed, how you checked it, and what you did not check.
- **Merge with a merge commit.** Squash and rebase are not used, so the history shows every change as it was made.
- Do not rewrite history on a branch that is already pushed.

## Reporting bugs and security issues

- Bugs and questions: open an issue with the bug report template.
- Security issues: do not open a public issue. See [SECURITY.md](SECURITY.md).

## Scope of the project

Parallax is a reflection aid for founders, not financial advice. Changes that present a model's output as a financial
recommendation, or that remove the disclaimers, will not be accepted.

## Lint

`npm run lint` runs oxlint with the React hook rules and the correctness rules. Errors fail the build. The React
compiler-style rules (mutation and refs in the 3D room) are reported as warnings; they are known debt, listed below.

## Known gaps

- **Warnings to clear.** About two dozen React compiler-style warnings remain, mostly in the 3D camera code and refs read
  during render, plus a few effect dependencies in the 3D room. Each is a small refactor.
- **Five `eslint-disable` comments** from earlier work name ESLint rules that oxlint does not run. They are harmless and
  will be removed when the warnings above are cleared.
