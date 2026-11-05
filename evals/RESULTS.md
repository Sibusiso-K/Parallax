# Live evaluation of the Meta features

6 live runs against muse-spark-1.3, 75 of 78 case results passed (per run: 12/13, 12/13, 12/13, 13/13, 13/13, 13/13).
Each case has a pass rule that does not depend on wording (see `evals/live.eval.ts`). The model is not deterministic, so a case can pass in one run and fail in another; the table shows how often each case passed.
Each run makes real, billed calls. Run with `npm run eval:live` (repeat for more runs), then `npm run eval:summary`.

| Feature | Case | Passed | Typical time | Latest detail |
|---|---|---|---|---|
| What-if | What if the client pays two months late? | 6/6 | 3.2 s | got {"latePayment":true} |
| What-if | what if I raise my prices by 10 percent | 6/6 | 3.9 s | got {"pricePercent":10} |
| What-if | What if the contract is only half the size and they pay late | 6/6 | 3.4 s | got {"latePayment":true,"contractScale":0.5} |
| What-if | what if we cut prices 5% to win more customers | 6/6 | 5.1 s | got {"pricePercent":-5} |
| What-if | what if I take out a bank loan | 6/6 | 3.9 s | got {} (out of scope) |
| Self-check | consistent story | 6/6 | 2.0 s | nothing flagged |
| Self-check | sales contradict | 6/6 | 4.2 s | flagged revenue |
| Self-check | yearly read as monthly | 6/6 | 4.7 s | flagged overheads |
| Future self + guard | Walk me through how cash moved: where was the lowest point, and where did it end at month 36? | 6/6 | 13.8 s | 3 amounts (120000, 33000, 479000), 0 not from the engine; guard: substituted, substituted, substituted, substituted |
| Future self + guard | When was cash tightest for you, and how much was left at that point? | 0/3 | 11.8 s | 1 amounts (33000), 0 not from the engine; guard: substituted, substituted |
| Future self + guard | What were the cash figures at month 12 and at month 36 in the likely case? | 6/6 | 11.8 s | 2 amounts (323000, 479000), 0 not from the engine; guard: substituted, substituted |
| Board moderator | warn me | 6/6 | 9.2 s | 3 agree, 4 differ, 0 dropped for digits |
| Planning agent | floor R20 000, late payment | 6/6 | 9.6 s | 5 tool calls, 4 model calls, 3 plans (A c100 p0; C c100 p0; B c50 p5) |
| Future self + guard | When was cash tightest for you, how much was left at that point, and what was cash at month 36? | 3/3 | 11.5 s | 2 amounts (33000, 479000), 0 not from the engine; guard: substituted, substituted, substituted |

Runs: 2026-11-04T23-30-28-463Z, 2026-11-04T23-32-00-095Z, 2026-11-04T23-33-35-523Z, 2026-11-04T23-35-15-288Z, 2026-11-04T23-36-39-600Z, 2026-11-04T23-38-16-783Z.
