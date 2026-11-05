## What changed

<!-- One or two sentences. Link the issue if there is one. -->

## Why

<!-- The reason, when it is not obvious from the change. -->

## How it was checked

- [ ] `npm run verify` passes locally (typecheck, tests, build)
- [ ] New logic has tests; bugs fixed have a test that fails without the fix
- [ ] Screens checked in the browser, at phone and desktop width, if the UI changed
- [ ] No secrets, keys or personal data in the diff (`git grep -nE "sk-[A-Za-z0-9]{20,}"` is clean)

## Not checked

<!-- Say what you did not check, so the reviewer knows where to look. -->

## Meta and cost

- [ ] No live model call was made, or the call is listed above with its purpose
- [ ] Any new route that calls a model goes through `shared/http/guard.ts`
