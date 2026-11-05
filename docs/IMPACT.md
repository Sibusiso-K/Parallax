# Impact: the problem Parallax addresses, with sources

This note sets out the South African figures behind Parallax's problem, and how confident we are in each one. It was
written on 5 November 2026. The first four figures were checked against their source pages. The SMME count and the formalisation rate come from a secondary summary, and the table marks them as such.

We have **no user evidence yet**: no founder has used Parallax in a study, pilot or interview. The figures show the
problem is real and large. They do not show that Parallax solves it. A plan for testing that is at the end.

## The figures

| Figure | What it measures | Source | Date and sample | Confidence |
|---|---|---|---|---|
| **62%** of small businesses had cash flow problems in the past year | Cash flow problems, self-reported | [Xero, *State of South African Small Business 2026*](https://www.xero.com/nz/media-releases/state-of-south-african-small-business-2026/) | Jan–Feb 2026; 427 businesses with up to 200 staff; run with KLA | Medium: vendor-commissioned, online panel |
| **52.8%** of small businesses (50 staff or fewer) say they are contracting, trading with difficulty or at risk of closure; **43.7%** say profits fell in the past six months | Business condition, self-reported | [Absa/SACCI/BMR Small Business Growth Index, H1 2025](https://bmr.co.za/2025/09/04/why-do-more-than-three-quarters-of-small-businesses-fail-in-south-africa/) | H1 2025 | Medium: an index survey, not a count of closures |
| **95,399** invoices older than 30 days, worth **R12.4 billion**, still unpaid by government at the end of Q2 2025 (up 17% from 81,736 in Q1) | Government late payment, from National Treasury | [Business Report, relaying National Treasury and Business Partners](https://businessreport.co.za/economy/2026-03-11-urgent-action-needed-late-payments-threaten-south-african-small-businesses/) | End of Q2 2025 | High for the count; this is government payment only, not private-sector late payment |
| **1,534** business liquidations in 2025: 1,341 voluntary and 193 compulsory (down 1.1% from 1,551 in 2024) | Business liquidations, from Stats SA | [EWN, citing Stats SA](https://www.ewn.co.za/2026/01/29/more-than-1-500-sa-businesses-liquidated-in-2025) | Calendar 2025 | High for the count; liquidations are a subset of closures |
| About **3 million** SMMEs (estimated range 2.4 to 3.5 million) | Size of the sector | [Trialogue, national context of small business support](https://trialogueknowledgehub.co.za/handbook-2025-entrepreneur-and-small-business-support/), summarising the 2025 State of the Nation Address and the FinScope MSME Survey 2024 | 2024–2025 | Low to medium: an estimate; the department does not count the sector |
| About **37%** of SMMEs are formally registered | Formalisation | [Trialogue](https://trialogueknowledgehub.co.za/handbook-2025-entrepreneur-and-small-business-support/), citing the department | April 2023 | Low: secondary summary of an older figure |

## Figures we do not use, and why

- **"70–80% of SMEs fail"** is widely repeated. It traces back to a 2011 estimate by Adeniran and Johnston. The current
  official rate is not published, and other estimates vary between about a third and 90%. We do not present a failure
  rate as fact.
- **"More than three quarters of small businesses fail"** (Cova Advisory, reported by BusinessTech in 2025) gives no
  year or method, so we do not use it as a headline.
- **"82% of business failures are due to poor cash management"** (a US figure cited by Huntington Bank) could not be
  traced to its study, so we leave it out.
- **Late-payment rates** for South African businesses in general are not measured by an official source. The Treasury
  backlog is government payment only. Xero's older research reports that most small firms are owed money past terms,
  but the sample and date are unclear, so we do not quote it.

## How the figures connect to Parallax

- **Cash strain is common and often unplanned.** 62% reported cash flow problems in a single year. Parallax shows a
  founder 36 months of cash, in a likely case, a bad case and a good case, before the founder commits.
- **Late payment is a known shock.** Government invoices alone run into billions of rand in arrears. Parallax's
  late-payment lever shows what a two-month delay does to a specific business, and which path survives it.
- **Closures are often decisions.** Most 2025 liquidations (1,341 of 1,534) were voluntary. Parallax is built to help
  a founder rehearse a decision before making it, not to make the decision.

## What Parallax does not claim

- It does not predict a business's future. Each path is one possible future, and the app says so.
- It does not give financial advice. The figures are computed from the founder's own inputs and marked placeholders where
  the sector's defaults are not sourced.
- The default assumptions in `shared/defaults/za.json` are placeholders, not sourced figures. The app marks each one.

## How we will test the impact

The next step is evidence from founders, not more statistics:

1. Run three to five founder sessions with South African owners of food, hospitality or trade businesses.
2. Record which decisions they rehearsed, what the paths showed them, and whether a path changed what they planned to do.
3. Publish the sessions as notes in this document, including the ones that did not help.
4. Replace the placeholder defaults for one sector with figures from a named source.

## Sources, all checked on 5 November 2026

- Xero, *The State of South African Small Business 2026*: https://www.xero.com/nz/media-releases/state-of-south-african-small-business-2026/
- BMR, *Why do more than three quarters of small businesses fail in South Africa?* (2025): https://bmr.co.za/2025/09/04/why-do-more-than-three-quarters-of-small-businesses-fail-in-south-africa/
- Business Report, *Urgent action needed: late payments threaten South African small businesses* (March 2026): https://businessreport.co.za/economy/2026-03-11-urgent-action-needed-late-payments-threaten-south-african-small-businesses/
- EWN, *More than 1,500 SA businesses liquidated in 2025* (January 2026): https://www.ewn.co.za/2026/01/29/more-than-1-500-sa-businesses-liquidated-in-2025
- Trialogue, *Entrepreneur and small business support handbook 2025*: https://trialogueknowledgehub.co.za/handbook-2025-entrepreneur-and-small-business-support/ (secondary summary; the department's own figures should be checked before publication)
