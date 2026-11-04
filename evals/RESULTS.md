# Live evaluation of the Meta features

Run on 2026-11-04 23:23 UTC against muse-spark-1.3: **13 of 13 cases passed.**
Each case has a pass rule that does not depend on wording (see `evals/live.eval.ts`). Run it with `npm run eval:live`; it makes real, billed calls.

| Feature | Case | Pass | Detail | Time |
|---|---|---|---|---|
| What-if | What if the client pays two months late? | yes | got {"latePayment":true} | 3.7 s |
| What-if | what if I raise my prices by 10 percent | yes | got {"pricePercent":10} | 4.2 s |
| What-if | What if the contract is only half the size and they pay late | yes | got {"latePayment":true,"contractScale":0.5} | 4.1 s |
| What-if | what if we cut prices 5% to win more customers | yes | got {"pricePercent":-5} | 6.2 s |
| What-if | what if I take out a bank loan | yes | got {} (out of scope) | 2.6 s |
| Self-check | consistent story | yes | nothing flagged | 1.9 s |
| Self-check | sales contradict | yes | flagged revenue | 4.0 s |
| Self-check | yearly read as monthly | yes | flagged overheads | 3.4 s |
| Future self + guard | When was cash tightest for you? | yes | 1 amounts, 0 not from the engine; guard: substituted, substituted | 9.8 s |
| Future self + guard | What would you warn me about? | yes | 1 amounts, 0 not from the engine; guard: substituted | 12.2 s |
| Future self + guard | Was it worth it? | yes | 1 amounts, 0 not from the engine; guard: substituted | 13.7 s |
| Board moderator | warn me | yes | 2 agree, 3 differ, 0 dropped for digits | 9.6 s |
| Planning agent | floor R20 000, late payment | yes | 2 tool calls, 3 model calls, 3 plans found (A c100 p0; C c100 p0; B c50 p5) | 10.4 s |
