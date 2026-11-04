// Page 1: "Here is what I heard" and "your business, today". The founder's own words sit beside every figure.
import { DECISIONS, rand, rangeOf, sidebar, topbar, footer } from './lib2.mjs';

const SRC = { you: '<span class="src you">you</span>', followUp: '<span class="src followup">from a follow-up</span>', range: '<span class="src range">range</span>' };

function field(label, value, { chip = '', sub = '', quote = '' } = {}) {
  return `<div class="ffield"><div class="fcap">${label}${chip}</div><div class="fval">${value}</div>${sub ? `<div class="fsub">${sub}</div>` : ''}${quote ? `<div class="fquote">You said: “${quote}”</div>` : ''}</div>`;
}

export function page1(d) {
  const ex = d.extraction;
  const pr = d.profile;
  const m = pr.money;
  const decisionKey = pr.decisionType;
  const decisionButtons = Object.entries(DECISIONS)
    .map(([k, label]) => `<span class="dbtn${k === decisionKey ? ' on' : ''}">${k === decisionKey ? '✓ ' : ''}${label}</span>`)
    .join('');
  const cards = [
    field('The decision', ex.decision.value, { chip: SRC.you, quote: ex.decision.quote }),
    field('The business', `${ex.business.value}, ${ex.location.value}`, { chip: SRC.you, quote: ex.business.quote }),
    field('Sales a month', rangeOf(m.revenue), { chip: SRC.range, sub: `Usually ${rand(m.revenue.base)}`, quote: ex.revenue.quote }),
    field('Stock, ingredients and packaging', rand(m.directCosts.base), { chip: SRC.you, sub: `${Math.round(d.margin * 100)}% of sales left after these`, quote: ex.directCosts.quote }),
    field('Rent, power, fuel and software', rand(m.overheads.base), { chip: SRC.you, sub: 'Fixed every month', quote: ex.overheads.quote }),
    field('Staff wages', rand(m.payroll.base), { chip: SRC.followUp, sub: 'Asked once, as the only follow-up', quote: ex.payroll.quote }),
    field('What you pay yourself', rand(m.founderPay.base), { chip: SRC.you, sub: 'Counted as a cost on every path', quote: ex.founderPay.quote }),
    field('Debt repayments', rand(m.debtRepayments.base), { chip: SRC.you, sub: 'The delivery van', quote: ex.debtRepayments.quote }),
    field('Cash in the business', rand(m.cash.base), { chip: SRC.you, sub: `Covers about ${d.paths[0].runway} months of fixed costs`, quote: ex.cash.quote }),
    field('New contract, a month', rand(m.offerRevenue.base), { chip: SRC.you, sub: `Paid ${pr.paymentDays.value} days after each invoice`, quote: ex.offerRevenue.quote }),
    field('Days the client takes to pay', `${pr.paymentDays.value} days`, { chip: SRC.you, sub: 'Sets when the contract money lands', quote: ex.paymentDays.quote }),
    field('The new person, a month', rand(m.hireCost.base), { chip: SRC.you, sub: 'Needed to run the contract', quote: ex.hireCost.quote }),
    field('One-off cost to start', rand(m.upfrontCost.base), { chip: SRC.you, sub: 'Paid in month 1 on path B', quote: ex.upfrontCost.quote }),
    field('Comfort with risk', 'Low', { chip: SRC.you, sub: 'Shapes how trade-offs are framed, never the numbers', quote: ex.riskComfort.quote }),
    field('What matters most', ex.goals.value.join(', '), { chip: SRC.you, sub: 'Each future founder reflects on these', quote: ex.goals.quote }),
  ].join('');
  return `
<section class="page">
  ${sidebar('Profile')}
  <div class="main">
    ${topbar(d.paths, '')}
    <main class="content">
      <div class="pagehead">
        <div class="eyebrow">Step 2 of 3 · Your business, today</div>
        <h1>Here is what I heard</h1>
        <div class="sub">Check each line. The quotes are Ayanda’s own words. Anything marked as a default or a follow-up is one tap from changing.</div>
      </div>
      <div class="dstrip"><span class="caps">Kind of decision</span>${decisionButtons}<span class="dnote">Read from her words, in code</span></div>
      <div class="fgrid">${cards}</div>
      <div class="notice"><span class="src placeholder">placeholder</span> Behind the three paths, not yet sourced: the contract’s direct costs are 35–50% of its value; rented equipment costs 5% of its price a month; setback sizes come from the defaults file. Each is marked on the path pages.</div>
    </main>
    ${footer()}
  </div>
</section>`;
}
