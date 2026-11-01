// Page 3: the three paths on one scale, with a two-month late payment, and the comfort check beside them.
import { avatar, badge, rand, sidebar, topbar, footer, last } from './lib2.mjs';
import { rangeBar } from './chart2.mjs';

const DOM = [-200000, 900000];
const EXAMPLE_RATING = { A: 3, B: 2, C: 4 };
const SETBACK_NAME = {
  'late-payment': 'Late payment',
  'lost-client': 'Lost client',
  'slow-season': 'Slow season',
  'equipment-breakdown': 'Equipment breakdown',
  'cost-rise': 'Cost rise',
};

const runsChip = (m) => (m ? `<span class="chipwarn">runs out in month ${m}</span>` : '<span class="chipok">stays above zero</span>');

const ROWS = [
  ['Cash at month 12, likely', (p) => `<div class="v">${rand(p.cash.likely[12])}</div><div class="r">Bad ${rand(p.cash.bad[12])} · Good ${rand(p.cash.good[12])}</div>`],
  ['Cash at month 36, likely', (p) => `<div class="v">${rand(last(p.cash.likely))}</div><div class="r">Bad ${rand(last(p.cash.bad))} · Good ${rand(last(p.cash.good))}</div>${rangeBar(p.letter, last(p.cash.bad), last(p.cash.likely), last(p.cash.good), DOM, 250)}`],
  ['Lowest cash, likely', (p) => `<div class="v">${rand(p.lowest.likely.cash)}</div><div class="s">Month ${p.lowest.likely.month}</div>`],
  ['Lowest cash with a 2-month late payment', (p) => `<div class="v">${rand(p.lateLowest.cash)}</div><div class="s">Month ${p.lateLowest.month} · ${runsChip(p.lateRunsOut)}</div>`],
  ['Cash runs out, bad case', (p) => (p.runsOut.bad ? `<div class="t">Month ${p.runsOut.bad}</div><div class="s">Only in the bad case</div>` : '<div class="t none">Never</div><div class="s">No case runs out</div>')],
  ['Three months of fixed costs covered', (p) => (p.milestones.likely['cash-buffer-3-months'] ? `<div class="t">Month ${p.milestones.likely['cash-buffer-3-months']}</div><div class="s">Likely case</div>` : '<div class="t none">Not reached</div>')],
  ['Worst setback, likely case', (p) => {
    const w = [...p.setbacks].sort((a, b) => a.lowest.cash - b.lowest.cash)[0];
    return `<div class="t">${SETBACK_NAME[w.id]}</div><div class="s">Lowest cash ${rand(w.lowest.cash)}, month ${w.lowest.month}</div>`;
  }],
  ['The plan', (p) => `<div class="quote">${p.summary}</div>`],
];

function compare(paths) {
  const heads = paths.map((p) => `<th class="p">${badge(p.letter)}${p.name}</th>`).join('');
  const body = ROWS.map(([label, cell]) => `<tr><td class="lab">${label}</td>${paths.map((p) => `<td>${cell(p)}</td>`).join('')}</tr>`).join('');
  return `
<section class="panel">
  <div class="panel-head"><div><h2>Three paths on one scale</h2><div class="sub">Bars share one scale, from −R200 000 to R900 000; the dot is the likely case. A late payment is a big client paying two months late. Path A has no contract, so it applies to the biggest client’s share of sales.</div></div></div>
  <table class="cmp"><thead><tr><th></th>${heads}</tr></thead><tbody>${body}</tbody></table>
</section>`;
}

function comfort(paths) {
  const rows = paths
    .map((p) => {
      const n = EXAMPLE_RATING[p.letter];
      const dots = [1, 2, 3, 4, 5].map((k) => `<span class="${k === n ? 'on' : ''}">${k}</span>`).join('');
      return `<div class="crow">${avatar(p.letter, 64)}<div class="cbody"><div class="cname">${badge(p.letter)} ${p.name}</div><div class="rate">${dots}</div></div></div>`;
    })
    .join('');
  return `
<section class="panel" style="flex:1">
  <div class="panel-head"><div><div class="caps">Comfort check</div><h2>How does each future sit with you?</h2><div class="sub">These ratings are an example of the check, not a real rating. 1 is very uneasy, 5 is at peace.</div></div></div>
  <div class="crows">${rows}</div>
  <div class="caps" style="margin-top:20px">What is still bothering you?</div>
  <div class="field">Whether the client will really pay on 30-day terms. <span class="src placeholder">example</span></div>
</section>`;
}

export function page3(d) {
  return `
<section class="page">
  ${sidebar('Compare')}
  <div class="main">
    ${topbar(d.paths, '')}
    <main class="content">
      <div class="row pagecols3">
        ${compare(d.paths)}
        <div class="rcol">${comfort(d.paths)}</div>
      </div>
    </main>
    ${footer()}
  </div>
</section>`;
}
