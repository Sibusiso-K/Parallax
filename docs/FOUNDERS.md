# Founders: who Parallax is for, and why

Written Sun 1 Nov 2026 (day 7), when the two of us changed Parallax's direction from personal career-and-money decisions to founders' business decisions. It records the research behind that change and the choices that follow from it. Competitors are in [COMPETITORS.md](COMPETITORS.md); prize fit is in [RESEARCH.md](RESEARCH.md); what the MVP does is in [SCOPE.md](SCOPE.md).

Confidence labels follow [CONTEXT.md](CONTEXT.md): **confirmed** (read on the original source), **reported** (secondary source, or a vendor's own survey), **unverified** (widely repeated, original not found).

## 1. Summary

1. **The problem.** Founders make one high-stakes decision after another (take the contract, hire, raise prices, borrow, expand) with no finance team, on gut feel and spreadsheets they do not trust. Running out of cash is one of the most common ways a business dies, and a decision can look profitable and still empty the bank account.
2. **Why we care.** We are two founders building on the Startup track. Brainstorming and deciding is most of our week, and it is the problem we know firsthand ("Build for Your World").
3. **What Parallax becomes.** A decision rehearsal for founders. Describe the decision in your own words; Parallax proposes three genuinely different paths, plays each forward for 36 months of cash in a bad, likely and good case, stress-tests it against the setbacks that sink small businesses, and lets you question the founder you would become on each path. Every figure is computed in code and traceable to an assumption you can change.
4. **Who first.** Owner-led food and hospitality businesses in South Africa (catering, meal prep, bakeries, food production, small restaurants), with 0 to 20 staff. Then other cash-hungry service businesses, then tech startups (§4).
5. **Decisions in the MVP.** Take on a big contract or order, make a hire, raise prices: three templates with three paths each, built and tested on 1 Nov (§3). The rest of the founder journey is the roadmap.
6. **What makes a founder say "this is great".** An answer in minutes from their own words, the month cash would run out, what would have to be true, what could kill the business, and a memo they can show a cofounder or funder (§5).

## 2. Why founders: the evidence

| Finding | Figure | Label | Source |
|---|---|---|---|
| Startups rarely fail for one reason; lack of market need and running out of cash are near the top of founders' own post-mortems | "No market need" in 42% of 101 post-mortems (2018 edition); "ran out of cash" in about 29% of a later 242-letter update. Figures vary by edition, and the sample is founders who chose to publish | reported | CB Insights, *Top reasons startups fail* |
| Scaling ahead of the business is a common killer of high-growth startups | 74% of high-growth internet startups that failed had scaled prematurely, in a dataset of more than 3,200 (2011) | reported | Startup Genome report, via GeekWire and Steve Blank |
| Most businesses do not last | 34.7% of US establishments born in 2013 were still operating in 2023 | confirmed (headline) | US Bureau of Labor Statistics, *The Economics Daily*, 2024 |
| South Africa has about three million small, micro and medium enterprises | About 3 million (2024) | reported | FinScope MSME Survey 2024, via Trialogue |
| The largest group is trade and accommodation | 38% trade and accommodation; 15% construction; 15% community services; 14% finance and business (period not stated) | reported | Department of Small Business Development data, via Trialogue |
| South African small businesses fail early | "70 to 80% fail within five years" | unverified | Widely repeated (Business Report, 2023, credits the University of the Western Cape); no original study found |
| Many keep no financial records | 59% keep financial records | reported | FinScope MSME South Africa 2024 results deck |
| Cash flow is a standing problem | 43% of small businesses call cash flow a problem; 74% say it stayed the same or got worse in 12 months (2025) | reported (vendor survey) | QuickBooks survey, via Stacker |
| Late payment is a South African problem in particular | 95,399 government invoices older than 30 days, worth R12.4 billion, unpaid at the end of Q2 2025; private-sector terms of 90 to 120 days are common | reported | National Treasury data and industry comment, via SA press |
| Getting paid on time worries owners most | 48% of SA small businesses worried most about overdue invoices and cash flow (2017) | reported (vendor survey) | Xero, via CBN |
| Most small businesses cannot afford a finance chief | The premise of Mastercard's "Virtual CFO" for small businesses (announced 10 Mar 2026) | reported | Fortune |
| Meta is betting on agents for small businesses | Meta Business Agent on WhatsApp, Instagram and Messenger (3 Jun 2026), piloted in India, Mexico and Brazil; more than one million businesses signed up; Zuckerberg wants agents to "eventually help you run your whole business" | reported | Engadget |

**What this means for Parallax.** The decisions that kill businesses are cash decisions, and the cash trap is timing: work is paid for before it is paid. A tool that shows the month the money runs out, before the founder says yes, answers a question founders cannot easily answer today, and it fits a South African market where late payment is common. Every figure we quote in the pitch must cite one of these sources directly (DEMO.md §4).

## 3. The decisions founders face

The founder journey, the decision at each point, what is at stake, and what Parallax does about it. Noam Wasserman's research on more than 10,000 founders (*The Founder's Dilemmas*, 2012) frames many of these as "rich or king": growth or control. Parallax keeps "control" as one of the founder's priorities for that reason.

| Stage | Decision | What is at stake | Parallax |
|---|---|---|---|
| Win work | **Take on a big contract or order** (a corporate client, a tender, a large order) | Upfront costs and extra staff before the first payment; payment terms of 30 to 120 days; one client becoming most of the business | **MVP template** (demo decision) |
| Team | **Make a hire** (first or next) | Wages from day one, extra sales only after a ramp-up; whether part-time first is safer | **MVP template** |
| Revenue | **Raise prices** | Higher margin against customers who leave | **MVP template** |
| Start | Go full-time on the business (leave a job) | The founder's own income and runway | Roadmap; today it gets "not supported yet" |
| Capital | Borrow, take an investor, or keep bootstrapping | Repayments, dilution, control | Roadmap: needs repayment and dilution modelling, and care around advice (RISKS.md P1) |
| Grow | Open a second site or enter a new market | Fixed costs that arrive before the new sales | Roadmap |
| Focus | Cut, keep or pivot a product line | Margin and attention | Roadmap |
| Founder | Pay yourself, or reinvest | The founder's own finances against the business's runway | Partly: "Your own pay" is an assumption on every path, so it can be changed and re-run |
| Team | Split equity with a cofounder | Fairness and control, not cash | Out of scope: not a cash simulation |

**Why these three first.** They are frequent, they are cash decisions the engine models well (monthly amounts with timing), and they apply to almost any owner-led business. Each adds one template function and its tests; no new engine work. The demo uses the contract because it shows the cash-timing trap most clearly (DEMO.md §1).

## 4. Who first: the beachhead

We scored five candidate segments against what matters for impact and for winning. The ratings are our judgement from the evidence in §2, not measurements.

| Criterion | Food and hospitality | Construction and trades | Professional services and agencies | Retail and spaza shops | Tech startups |
|---|---|---|---|---|---|
| Cash pressure (stock, equipment, wages, thin margins) | High | High | Medium | High | Medium (burn) |
| How often big decisions come up (contracts, hires, prices) | High | High | High | Medium | High |
| Size in South Africa | High (inside the 38% trade and accommodation group) | Medium (15%) | Medium (14%) | High, mostly informal | Low |
| Underserved by current tools | High | High | Medium | High | Low: crowded (COMPETITORS.md) |
| Fit with the engine today | High: contracts, hires, prices, equipment | High, but tenders and retention need modelling | Medium: mostly people costs | Medium: daily stock cycles | Medium: fundraising needs dilution |
| Our access and firsthand knowledge (Johannesburg; Sibusiso built StokUp, a WhatsApp ordering agent) | High | Medium | Medium | Medium | High |
| Fit with Meta's world (orders and customers on WhatsApp; Meta Business Agent) | High | Medium | Medium | High | Low |
| A demo story judges feel | High | Medium | Medium | Medium | High |

**Recommendation: owner-led food and hospitality businesses in South Africa**, 0 to 20 staff: caterers, meal-prep kitchens, bakeries, food producers and small restaurants. They sit in the largest SMME group, run on cash (stock, equipment, wages), face contract, hiring and pricing decisions all the time, and already sell through WhatsApp, which is Meta's home ground. Yoco's purchase of Dyner.ai, an AI operating system for restaurants (May 2026), shows others see the same segment (COMPETITORS.md §2).

**Then:** other cash-hungry service businesses (construction subcontractors, cleaning, salons, agencies), where the contract and hire templates already apply. **Later:** tech startups, once fundraising and runway templates exist, and other countries by configuration (currency, defaults and language are data, not code).

**What we say in the pitch:** "Built for founders in Johannesburg's food businesses first, for every owner-led business next." The product is not limited to food: nothing in the engine or templates is food-specific; only the demo founder and some placeholder defaults are.

## 5. What a founder needs to find Parallax great

From the evidence above and the jobs a finance chief does for a bigger company. "Status" is what exists on the `feat/founder-pivot` branch tonight.

| A founder wants | How Parallax answers | Status |
|---|---|---|
| An answer in minutes, from their own words, with no spreadsheet and no bank login | Text intake fills a form from the story, quotes the founder's words back, asks only for what is missing | Built (text); voice intake planned (F3) |
| "Will we run out of cash, and when?" | The month cash runs out in each case, and the lowest balance and its month | Built |
| Cash timing, not just profit | Contract income lands after its payment terms while the costs start at once, so a profitable contract can still empty the account | Built |
| "What could kill us?" | Five setback stress tests (late payment, lost client, slow season, equipment breakdown, cost rise), judged by how close they push the business to empty | Built |
| "What has to be true for this to work?" | The two or three assumptions that move the result most, each with a range and a source (you, default, template, AI-suggested) | Built |
| To challenge any number and see the effect at once | Edit an assumption; the paths re-run in the browser in well under a second | Built (F8) |
| Options side by side | Compare view: cash at months 12 and 36, lowest cash, when cash runs out, comfort, pinned quotes | Built (supporting, never the headline) |
| Someone to think it through with | The founder they would become on each path, answering in the first person from that path's figures only | Mock replies today; the agents are F10 (Lethabo) |
| Honest uncertainty | Bad, likely and good cases; "one possible future, not a prediction" on every screen | Built |
| Something to show a cofounder, partner or funder | A one-page decision memo: the paths, the choice or "not ready yet", reasons, the setback to watch, open questions | Basic summary built (F16) |
| Privacy | Data stays in the browser; delete everything at any time; no accounts | Built (F17 export still to do) |
| No sales pitch | Names no banks, lenders or products; declines investment advice | Built (checks) |
| Works on a phone with costly data | Phone-first layout, lite mode | Built |

## 6. Business and technical feasibility

**Technical.** The engine, the intake, the faulty-input checks and the three decision templates were built during the event and are covered by 105 offline tests (stress tests included). A business is modelled as monthly cash lines with timing, which covers contracts, hires, prices, equipment and late payment without new engine work. Model calls are bounded: one structured intake call, one call per chat turn, one image per path; figures never come from the model. Meta's published prices (CONTEXT.md §2.1) keep a session to cents.

**Business-model hypotheses** (replacing the personal-decision hypotheses in DEMO.md §4):

| Hypothesis | Who pays | What would prove it wrong |
|---|---|---|
| H1. Freemium for founders | One decision free; paid for saved decisions, all templates and memo export | Founders will not pay for a tool they use a few times a year |
| H2. Enterprise and supplier development programmes, incubators and accelerators | Corporates and programmes that fund small-business support pay per founder. Under the B-BBEE codes, large companies are expected to spend about 2% of net profit after tax on supplier development and 1% on enterprise development (reported; check the current codes) | Programmes buy training and loans, not software |
| H3. Embedded in tools founders already use | Payment, accounting and messaging platforms (for example Yoco, accounting software, WhatsApp through Meta's business tools) license it as a decision layer | Platforms build it themselves (COMPETITORS.md §4) |
| H4. Funders use it for funding readiness | Development funders and lenders ask applicants to rehearse the decision the money is for | Conflict of interest: a lender's tool is no longer neutral |

## 7. What changes and what does not

| Changes | Stays |
|---|---|
| The user: a founder, not an individual weighing a job | The engine, three cases, ranges, figures from code, the figure guard |
| The decisions: contract, hire, prices | Future-self agents per path, "Ask this on another path", avatars |
| The intake fields: sales, direct costs, running costs, wages, founder pay, debt, cash | Faulty-input checks, quotes checked against the text, fixture mode |
| The setbacks: late payment, lost client, slow season, equipment breakdown, cost rise | Comfort check, decision summary, delete everything |
| The demo founder and the story (DEMO.md §1) | "A reflection aid, not financial advice" |

**Removed:** the personal user stories and use cases (the payroll administrator weighing whether to quit, family support, the study-loan path, the e-hailing car loan, the move-city decision). They stay in the git history and in REVIEW.md, which reviewed the earlier direction.

## Sources

- CB Insights, *Top reasons startups fail* (2018 edition, 101 post-mortems; later update): https://cdn.shopify.com/s/files/1/1707/0685/files/CB-Insights_Top-Reasons-Startups-Fail.pdf and https://www.talentica.com/wp-content/uploads/2024/02/The-20-Reasons-Startups-Fail.pdf
- Startup Genome (2011), via GeekWire: https://www.geekwire.com/2011/number-reason-startups-fail-premature-scaling/ and Steve Blank: https://steveblank.com/2011/08/29/it%E2%80%99s-not-how-big-it-is-%E2%80%93-it%E2%80%99s-how-well-it-performs-the-startup-genome-compass/amp/
- US BLS, *34.7 percent of business establishments born in 2013 were still operating in 2023*: https://www.bls.gov/opub/ted/2024/34-7-percent-of-business-establishments-born-in-2013-were-still-operating-in-2023.htm
- Trialogue, *Entrepreneur and small business support* (2025 handbook; FinScope MSME 2024 and DSBD figures): https://trialogueknowledgehub.co.za/handbook-2025-entrepreneur-and-small-business-support/
- FinScope MSME South Africa 2024 results: https://finmark.org.za/Publications/FS_MSME_2024_results_launch.pdf
- Business Report, *Majority of small businesses fail* (28 Mar 2023): https://iol.co.za/business-report/entrepreneurs/2023-03-28-majority-of-small-businesses-fail--tips-on-how-to-stay-afloat/
- QuickBooks survey, via Stacker: https://stacker.com/stories/personal-finance-investing/your-tax-return-filed-now-heres-whats-quietly-draining-your-cash
- Late payment in South Africa (National Treasury figures and private-sector terms): https://www.zawya.com/en/economy/africa/cash-flow-is-still-the-biggest-threat-to-south-africa-smes-c615n1vz and https://www.engineeringnews.co.za/print-version/late-payment-crisis-detrimental-to-smes-business-partners-says-2026-03-11
- Xero survey (9 Feb 2017), via CBN: https://cbn.co.za/industry-news/late-payments-represent-biggest-challenge-for-half-of-south-african-smes/
- Fortune, Mastercard "Virtual CFO" (10 Mar 2026): https://www.fortune.com/2026/03/10/small-businesses-cant-afford-finance-chief-mastercard-virtual-cfo-ai
- Engadget, Meta Business Agent (3 Jun 2026): https://engadget.com/2186241/meta-is-bringing-ai-agents-to-businesses-on-whatsapp-instagram-and-messenger
- Noam Wasserman, *The Founder's Dilemmas* (Princeton University Press, 2012), review: https://blogs.lse.ac.uk/lsereviewofbooks/2012/08/09/book-review-the-founders-dilemmas
- B-BBEE enterprise and supplier development targets: https://www.rsm.global/southafrica/news/what-happens-your-b-bbee-compliance-targets-if-you-make-financial-loss
- Yoco and Dyner.ai: https://www.ewn.co.za/2026/06/24/yoco-enables-small-business-growth-with-over-20-new-products-including-its-first-ai-agent
