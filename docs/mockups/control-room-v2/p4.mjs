// Page 4: the decision memo the founder leaves with. It names no choice the founder has not made.
import { avatar, badge, rand, sidebar, topbar, footer, last } from './lib2.mjs';

export function page4(d) {
  const [A, B, C] = d.paths;
  const pathRow = (p) => `<tr>
    <td><div class="pname">${avatar(p.letter, 38)}<div>${badge(p.letter)} <b>${p.name}</b><div class="s">${p.summary}</div></div></div></td>
    <td class="n">${rand(last(p.cash.bad))}</td><td class="n">${rand(last(p.cash.likely))}</td><td class="n">${rand(last(p.cash.good))}</td>
    <td class="n">${rand(p.lowest.likely.cash)}<div class="s">month ${p.lowest.likely.month}</div></td>
    <td class="n">${rand(p.lateLowest.cash)}<div class="s">month ${p.lateLowest.month}${p.lateRunsOut ? ' · runs out' : ''}</div></td>
  </tr>`;
  return `
<section class="page">
  ${sidebar('')}
  <div class="main">
    ${topbar(d.paths, '')}
    <main class="content memowrap">
      <article class="memo">
        <div class="caps">Decision memo · printed from Parallax</div>
        <h1>Take on the 12-month corporate lunch contract?</h1>
        <div class="choice"><span class="caps">Choice</span><b>Not chosen yet.</b> Ayanda picks a path, or “Not ready yet”, before this prints. Parallax never names a choice she has not made.</div>

        <h3>The three paths, 36 months of cash in the business</h3>
        <table class="cmp memo-table">
          <thead><tr><th>Path</th><th class="n">Month 36, bad</th><th class="n">Month 36, likely</th><th class="n">Month 36, good</th><th class="n">Lowest, likely</th><th class="n">Lowest, 2-month late payment</th></tr></thead>
          <tbody>${[A, B, C].map(pathRow).join('')}</tbody>
        </table>

        <h3>The setback to watch</h3>
        <p>Late payment. If the client pays two months late on the first invoice, path B falls to <b>${rand(B.lateLowest.cash)}</b> in month ${B.lateLowest.month} and runs out of cash. Path C bottoms at <b>${rand(C.lateLowest.cash)}</b> in month ${C.lateLowest.month} and stays above zero.</p>

        <div class="twocol">
          <div>
            <h3>What the numbers rest on</h3>
            <ul>
              <li>Sales R75 000 to R105 000 a month, usually R90 000 <span class="src you">you</span></li>
              <li>Staff wages R21 000 a month <span class="src followup">from a follow-up</span></li>
              <li>The client pays 60 days after each invoice <span class="src you">you</span></li>
              <li>Contract direct costs 35–50% of its value <span class="src placeholder">placeholder</span></li>
              <li>Rented equipment 5% of its price a month <span class="src placeholder">placeholder</span></li>
              <li>Setback sizes <span class="src placeholder">placeholder</span></li>
            </ul>
          </div>
          <div>
            <h3>Open questions and checks in real life</h3>
            <ul>
              <li>Will the client agree to 30-day terms? <span class="src placeholder">example</span></li>
              <li>What does a fridge cost to rent, compared with buying? <span class="src placeholder">example</span></li>
              <li>Ask the client for 30-day payment terms before signing. <span class="src placeholder">example</span></li>
            </ul>
          </div>
        </div>
        <div class="memo-foot">Avatars are AI-generated illustrations (Muse Image). A reflection aid, not financial advice. One possible future, not a prediction.</div>
      </article>
    </main>
    ${footer()}
  </div>
</section>`;
}
