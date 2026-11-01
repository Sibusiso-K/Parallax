// Page 2: path B. The future founder's chat is the main panel; the avatar, the cash chart and the stress test sit beside it.
import { avatar, badge, COLORS, rand, sidebar, topbar, footer } from './lib2.mjs';
import { cashChart } from './chart2.mjs';

// The replies are the app's mock replies for the contract decision, path B (parallax-api.ts). They quote no figures.
const REPLY_FIRST = "Three years on, the contract changed the business. But the first stretch was the hardest I've had: I paid for food, a cook and the equipment long before the first payment landed, and cash got thinner than I ever want it again. Once the payments came in, it turned around fast.";
const REPLY_WARN = "If I could warn you about one thing, it's the gap between doing the work and being paid for it. Profit on paper didn't pay wages. If they had paid even later than agreed, I'm not sure we'd have made it.";
const SHORT = {
  'late-payment': 'Late payment',
  'lost-client': 'Lost client',
  'slow-season': 'Slow season',
  'equipment-breakdown': 'Equipment breakdown',
  'cost-rise': 'Cost rise',
};

const cite = (p, re) => {
  const a = p.assumptions.find((x) => re.test(x.label));
  return a ? `<span class="chip">${a.id} · ${a.label}</span>` : '';
};

function chat(p) {
  return `
<section class="panel chat chatmain">
  <div class="chat-head">
    <div class="avwrap">${avatar(p.letter, 96)}<div class="avcap">AI-generated</div></div>
    <div class="chead">
      <div class="caps">You, as the founder, 36 months on</div>
      <h2>${badge(p.letter)} ${p.name}</h2>
      <div class="sub">${p.summary}</div>
      <div class="quietrow"><span>All paths</span><span>Assumptions</span><span>Trace</span><span>Compare</span><span>Comfort check</span></div>
    </div>
  </div>
  <div class="chat-body">
    <div class="msg user">When did cash get tightest?</div>
    <div class="msg bot">${REPLY_FIRST}</div>
    <div class="based"><span class="caps">Based on</span>${cite(p, /contract income/i)}${cite(p, /equipment/i)}</div>
    <div class="actions"><span>Ask this on another path</span><span>Pin this quote</span></div>
    <div class="msg user">What would you warn me about?</div>
    <div class="msg bot">${REPLY_WARN}</div>
    <div class="based"><span class="caps">Based on</span>${cite(p, /contract income/i)}${cite(p, /direct costs/i)}</div>
    <div class="trace"><div class="caps">Trace · this reply</div>
      <ul><li>✓ Speaks in the first person, 36 months on</li><li>✓ Figures come from code, not the model</li>
      <li>✓ Cites two assumptions, B6 and B7</li><li>✓ Names a downside: the gap between work and payment</li>
      <li>✓ Does not tell her what to choose</li></ul></div>
  </div>
  <div class="composer"><span>Ask your future self…</span><span class="send">Send</span></div>
</section>`;
}

function stress(p, selected) {
  const rows = p.setbacks
    .map((s) => {
      const on = s.id === selected;
      const desc = s.label.split(': ')[1];
      const status = s.runsOut ? `<span class="chipwarn">runs out in month ${s.runsOut}</span>` : '<span class="chipok">stays above zero</span>';
      return `<div class="srow${on ? ' on' : ''}"><div class="sname">${SHORT[s.id]}<div class="ssub">${desc}</div></div><div class="sval">${rand(s.lowest.cash)}<span class="smonth"> · month ${s.lowest.month}</span></div><div class="ssub">Month 36: ${rand(p.cash.likely.at(-1) + s.end)}</div><div>${status}</div></div>`;
    })
    .join('');
  return `
<section class="panel">
  <div class="panel-head"><div><h2>Stress test on this path</h2><div class="sub">One setback at a time, likely case. Sizes are <span class="src placeholder">placeholder</span> except the client’s own payment terms.</div></div></div>
  <div class="srows">${rows}</div>
</section>`;
}

export function page2(d) {
  const p = d.paths[1];
  const chart = cashChart({
    letter: p.letter,
    start: p.startingCash,
    bad: p.cash.bad,
    likely: p.cash.likely,
    good: p.cash.good,
    overlay: p.lateCash.likely,
    overlayName: 'With late payment',
    w: 548,
    h: 244,
  });
  const m36 = (c) => rand(p.cash[c].at(-1));
  return `
<section class="page">
  ${sidebar('Paths')}
  <div class="main">
    ${topbar(d.paths, 'B')}
    <main class="content">
      <div class="row pagecols">
        ${chat(p)}
        <div class="rcol">
          <section class="panel">
            <div class="panel-head"><div><h2>Cash in the business, 36 months</h2><div class="sub">Path B. Solid: the likely case. Dashed: the same case with a two-month late payment on the first contract invoice.</div></div></div>
            ${chart}
            <div class="m36"><span>Month 36</span> bad ${m36('bad')} · likely ${m36('likely')} · good ${m36('good')}</div>
          </section>
          ${stress(p, 'late-payment')}
        </div>
      </div>
    </main>
    ${footer()}
  </div>
</section>`;
}
