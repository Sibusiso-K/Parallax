# Competitors: who else helps a founder decide, and where Parallax wins

Researched Sun 1 Nov 2026 (day 7) for the founder direction ([FOUNDERS.md](FOUNDERS.md)). Product facts come from vendors' own pages and announcements or from press coverage; prices change and several sources disagree, so every price here is indicative and labelled. Confidence labels follow [CONTEXT.md](CONTEXT.md): **confirmed** (vendor's own page or announcement), **reported** (press, reviews or aggregators), **unknown**.

## 1. Summary

1. **Nobody we found starts from the decision.** Cash-flow tools, accounting platforms and the new "AI CFO" agents start from the books: they forecast what the ledger implies and let you add a what-if. Parallax starts from one decision in the founder's own words, builds three genuinely different paths, and needs no accounting connection.
2. **Nobody we found lets you talk to each future.** Chatbots talk but invent numbers; forecasting tools have numbers but no conversation. Parallax's future-self agents answer from code-computed figures only, and every figure is traceable to an assumption.
3. **The big threat is platforms adding what-ifs.** Xero, QuickBooks and Sage already offer scenario planning inside their products; Mastercard has announced a "Virtual CFO" for small businesses; in South Africa, Yoco is building its own AI assistant and bought a restaurant AI company. Our answer is to be decision-first, independent and easy to embed (§4).
4. **The real incumbent is the spreadsheet, the accountant and gut feel.** Most of our segment has no forecasting tool at all: in South Africa, 59% of small businesses keep financial records (FinScope 2024, reported).

## 2. The landscape

| Category | Examples | What they do well | Gap for an owner-led founder facing one decision | Threat |
|---|---|---|---|---|
| **Cash-flow forecasting add-ons** | **Float** (forecasts up to 3 years; scenarios such as a new hire, a late payment or slower collections; connects to Xero, QuickBooks Online or FreeAgent; from about USD 59 a month, varies by region and revenue, reported); **Fathom** (three-way forecasting, scenarios, reporting, reported); **Futrli** (short-term cash flow and scenario planning, now with Sage, reported); **Agicap** (reported) | Real forecasts from real books; scenario comparison | Need clean, connected books first; built for accountants and finance-literate owners; a what-if is an edit to one forecast, not three paths for one decision; no conversation | Medium |
| **Accounting platforms with AI** | **Xero Analytics** (Cash Flow Manager; projections up to 180 days with "what if" scenario planning, announced Jan 2026; AI predictions in Analytics Plus, confirmed on Xero's pages); **QuickBooks** Finance Agent (cash-flow forecasts and "what-if" planning, for example "Project my cash flow for the next 90 days if I add a $2,500 monthly recurring expense", reported); **Sage Copilot** (forecasting and cash-flow suggestions; rolled out in South Africa, reported) | Huge reach; data already inside; natural-language questions | Only for businesses whose books live there; short horizons; answers one forecast, not several futures; no stress-test library for South African setbacks; not neutral about their own products (for example a pre-approved line of credit) | **High** (fast followers) |
| **AI CFO agents** | **Mastercard "Virtual CFO"**, first of a "Virtual C-Suite" (announced 10 Mar 2026; detects cash-flow risks, runs what-ifs such as a revenue drop; to be delivered through banks, accounting platforms and software providers; no price given, reported) | Plain-language questions on the owner's own data; distribution through banks | Not launched when reported; needs the systems a business already uses; a bank-delivered tool is not neutral | **High** (well funded) |
| **Startup finance (FP&A, bookkeeping, fractional CFO)** | **Runway** (FP&A for startups; custom pricing; a report says it moved from runway.com to cfo.ai, unverified); **Causal** (joined Lucanet, Oct-Nov 2024, confirmed); **Digits** (AI bookkeeping with cash, burn and runway summaries, reported); **Pilot** (human-led books, tax and CFO help; about USD 499-799+ a month, reported by a competitor) | Strong for venture-backed startups with finance staff | Priced and built for funded startups, not a caterer with three staff; a model to build, not a decision to rehearse | Low for our beachhead, higher for tech startups |
| **Business-plan software** | **LivePlan** (plans, forecasts, "what if" scenarios, an AI assistant; about USD 20 a month standard per a May 2026 snapshot of its pricing page, reported) | Structured plans for funders | Plans a whole business once; not built around a single decision or cash timing; no stress tests | Low |
| **South African SME platforms** | **Yoco** (payments for small merchants; revealed "Yoco AI", its first AI agent, in June 2026, with launch reported for Q3 2026; bought Dyner.ai, an AI operating system focused on restaurants, in May 2026; Yoco Connect brings accounting, bookings, inventory and loyalty together, reported); **iKhokha** (card acceptance, invoicing, cash advances; now owned by Nedbank, reported); **Lula** (business funding; SME Pulse research, reported) | Already in merchants' pockets, with their sales data | Insight from past sales, not rehearsal of a future decision; no evidence of scenario planning in what we read; tied to their own data and products | **High in our segment**, and a likely partner (§5) |
| **General AI assistants** | ChatGPT, Meta AI, Claude, Gemini | Free, fluent, always there; can list options and pros and cons | No model of the business's cash month by month; can invent or mis-add figures; one answer, not traceable; nothing stops it pushing a product | Medium (good enough for many) |
| **Meta's business AI** | **Meta Business Agent** on WhatsApp, Instagram and Messenger (3 Jun 2026): serves customers, books appointments, closes sales; more than one million businesses signed up; market research and competitive intelligence on a waitlist (reported) | Customer-facing agent where our segment already sells | Faces customers, not the founder's own decisions | Not a competitor: a channel and a story (§5) |
| **People and spreadsheets** | Accountants, business advisers, incubator mentors; Excel and Google Sheets | Trusted; local knowledge; flexible | Costly or slow for a micro business; a spreadsheet has no ranges, setbacks or story unless the founder builds them | The real incumbent |

## 3. Feature comparison

What we could find in public material on 1 Nov 2026. "Partly" means the product does something close; "unknown" means we found nothing either way. Parallax's column is what is on the `feat/founder-pivot` branch tonight; "mock" means the interface exists with stand-in replies until the agents land (F10).

| Capability | Parallax | Float / Fathom | Xero, QuickBooks, Sage AI | Mastercard Virtual CFO | Yoco AI | LivePlan | General chatbot | Spreadsheet |
|---|---|---|---|---|---|---|---|---|
| Starts from the decision in the founder's own words | Yes | No | Partly (questions about the books) | Partly (announced) | Unknown | No | Yes | No |
| Works with no accounting or bank connection | Yes | No | No | No | No (Yoco data) | Yes | Yes | Yes |
| Several genuinely different paths for one decision | Yes (three per decision) | Partly (scenarios) | Partly (what-if) | Partly (announced) | Unknown | Partly | Partly (in words) | If built |
| Cash timing, such as payment terms, month by month | Yes | Yes | Yes | Unknown | Unknown | Partly | No | If built |
| Bad, likely and good cases for every path | Yes | Partly | Unknown | Unknown | Unknown | Partly | No | If built |
| Stress tests from a setback library | Yes (five) | Partly (manual scenarios) | Unknown | Partly (revenue drop) | Unknown | No | No | If built |
| Every figure traceable to an editable assumption | Yes | Partly | Partly | Unknown | Unknown | Partly | No | Yes |
| The model never writes a number | Yes (figures from code) | n/a | Unknown | Unknown | Unknown | n/a | No | n/a |
| Talk to the founder you would become on each path | Mock (F10) | No | No | No | No | No | No | No |
| Decision memo to share | Basic (F16) | Reports | Reports | Unknown | Unknown | Yes (plan) | Partly | If built |
| Built for South African founders on phones | Yes | No | Partly (Sage, Xero in SA) | Unknown | Yes | No | Partly | Partly |

## 4. Where Parallax wins, and how we say it

**Positioning.** For an owner-led business facing one big decision, Parallax is the rehearsal you run before you commit. Describe it in your own words; get three paths with 36 months of cash each; stress-test them against the setbacks that sink small businesses; question the founder you would become on each path. Unlike cash-flow tools, it needs no books and starts from the decision, not the ledger. Unlike chatbots, every figure is computed in code and traceable.

**Our edges, in order of how hard they are to copy**

1. **Grounded conversation with each future.** Several agents, each seeing only its own path's figures, with a figure guard that stops invented numbers (F10, F11). Platforms can add a what-if box; a per-path agent design with verification is real work.
2. **Decision-first templates with cash timing.** The contract template shows a profitable contract emptying the bank account in month 4 if the client pays late, and a safer version surviving the same shock (DEMO.md §1). That is the insight founders share.
3. **No setup.** No accounting connection, no clean books, no bank login: it works for the 41% who keep no records.
4. **Neutral.** No lender, product or platform to sell.
5. **Local.** South African setbacks, rand defaults (to be sourced), phone-first and data-light.

**Threats and our response**

| Threat | Response |
|---|---|
| Accounting platforms and Mastercard ship better what-ifs | Be the decision layer they can embed (H3 in FOUNDERS.md §6); keep the per-path agents and stress-test library ahead; later import actuals from them rather than compete on books |
| Yoco's AI reaches the same food businesses first | Partner rather than race: Yoco has the sales data, Parallax has the decision rehearsal |
| Chatbots get better at numbers | Traceability, the setback library and "the model never writes a number" are the proof points; show the figure guard catching an invented figure |
| Founders do not pay | Distribute through enterprise and supplier development programmes and incubators (H2), where the buyer is not the founder |

## 5. Partners rather than rivals

| Partner | Why | First step |
|---|---|---|
| Yoco, iKhokha and other SA payment platforms | They have the sales data that would replace typed estimates | After the hackathon: an import of monthly sales |
| Accounting platforms (Xero, Sage, QuickBooks) | Actuals for the starting point | Read-only import, later |
| Meta Business Agent and WhatsApp | Our segment already sells on WhatsApp; Meta wants agents to help run small businesses | Pitch line, not a build: "Parallax is the decision agent beside the business agent" |
| Enterprise and supplier development programmes, incubators, accelerators | They already fund support for exactly these founders | Three conversations after 9 Nov |

## 6. For the judges

**Impact (30%):** a real, common, expensive problem (cash decisions) for a large, underserved group (about three million SA small businesses), with a clear path to use (free tier, programmes, platforms). **Use of Meta AI Tooling (25%):** what no forecasting tool has: per-path founder agents on Muse Spark with tools and verification, avatars from Muse Image, spoken intake with Voice Transcribe. **The line for the video:** "Spreadsheets have numbers but no conversation. Chatbots have conversation but no numbers. Parallax has both, and the model never writes a number."

## Sources

- Float: https://www.capterra.com/p/226486/Float-Cash-Flow/pricing/ ; https://apps.xero.com/ca/app/float-cashflow-forecasting ; https://toolradar.com/tools/float-cash/pricing
- Fathom and Futrli: https://www.fathomhq.com/blog/the-best-cash-flow-forecasting-software ; https://gitnux.org/best/cash-flow-planning-software/
- Xero Analytics: https://www.xero.com/accounting-software/analytics/ ; https://www.businesswire.com/news/home/20260114547180/en/ ; https://itbrief.com.au/story/xero-analytics-adds-ai-cash-forecasts-ops-metrics
- QuickBooks and Intuit: https://quickbooks.intuit.com/ca/resources/product-update/intuit-intelligence-october-2026/ ; https://www.intuit.com/blog/innovative-thinking/delivering-done-for-you
- Sage Copilot in South Africa: https://www.sage.com/en-za/news/press-releases/2024/02/new-sage-copilot-driving-efficiency-and-growth-for-smbs-and-accountants-with-generative-ai/ ; https://iafrica.com/?p=282645
- Mastercard Virtual CFO: https://www.fortune.com/2026/03/10/small-businesses-cant-afford-finance-chief-mastercard-virtual-cfo-ai
- Runway: https://pricingsaas.com/companies/runway ; https://toolradar.com/tools/runway-finance/pricing
- Causal and Lucanet: https://causal.app/blog/causal-joins-the-lucanet-group ; https://cfotech.co.uk/story/lucanet-acquires-causal-to-enhance-planning-solutions
- Digits and Pilot: https://pilot.com/blog/digits-alternatives ; https://pilot.com/solutions/ai
- LivePlan: https://www.xpay.sh/saas-pricing/liveplan/ ; https://www.capterra.com/p/142049/LivePlan/pricing/
- Yoco: https://www.ewn.co.za/2026/06/24/yoco-enables-small-business-growth-with-over-20-new-products-including-its-first-ai-agent ; https://www.dailymaverick.co.za/article/2026-06-18-yoco-empowers-small-businesses-with-major-platform-update-and-first-ai-agent/ ; https://techcabal.com/2026/05/28/yocos-dyner-ai-deal-ushers-in-new-ai-era-for-south-african-smes/
- iKhokha and Lula: https://liners.com/compare/ikhokha-vs-snapscan-vs-yoco ; https://iol.co.za/business-report/entrepreneurs/2026-06-09-south-african-smes-shift-from-survival-mode-to-disciplined-growth-lula-report-finds/
- Meta Business Agent: https://engadget.com/2186241/meta-is-bringing-ai-agents-to-businesses-on-whatsapp-instagram-and-messenger
- FinScope MSME South Africa 2024: https://finmark.org.za/Publications/FS_MSME_2024_results_launch.pdf
