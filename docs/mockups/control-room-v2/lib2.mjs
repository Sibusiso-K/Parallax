// Shared helpers for Mockup 5 v2 (the founder version): colours, number formats, avatars, sidebar and top bar.
export const COLORS = { A: '#3f6fd8', B: '#d9825f', C: '#7a5cc7' };
export const TINTS = { A: '#e4ebfb', B: '#f8e8e0', C: '#ece6f7' };
export const DECISIONS = {
  contract: 'Take on a big contract or order',
  hire: 'Make a hire',
  pricing: 'Raise prices',
};
const NB = ' ';
export const group = (n) => String(Math.abs(Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, NB);
export const rand = (n) => (Math.round(n) < 0 ? '−R' : 'R') + group(n);
export const axis = (n) => {
  const sign = n < 0 ? '−R' : 'R';
  const a = Math.abs(n);
  if (a === 0) return 'R0';
  if (a >= 1000000) return `${sign}${a / 1000000}m`;
  return `${sign}${a / 1000}k`;
};
export const last = (a) => a[a.length - 1];
export const scale = (d0, d1, r0, r1) => (v) => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);
const f1 = (n) => n.toFixed(1);
export const line = (xs, ys) => xs.map((x, i) => `${i ? 'L' : 'M'}${f1(x)} ${f1(ys[i])}`).join(' ');
export const area = (xs, hi, lo) =>
  `${line(xs, hi)} ${xs.map((_, i) => { const j = xs.length - 1 - i; return `L${f1(xs[j])} ${f1(lo[j])}`; }).join(' ')} Z`;
export const badge = (l) => `<span class="badge" style="--c:${COLORS[l]};--t:${TINTS[l]}">${l}</span>`;

// A range string for a money figure: "R75 000 – R105 000", or one figure when low and high match.
export const rangeOf = (f) => (f.low === f.high ? rand(f.base) : `${rand(f.low)} – ${rand(f.high)}`);

// Placeholder illustration for the founder on a path (F9). Muse Image replaces it later.
// Each path has its own setting: A a home kitchen, B a commercial kitchen, C a café.
const SETTING = {
  A: `<rect x="10" y="10" width="24" height="18" rx="3" fill="#fff" opacity=".8"/><path d="M22 10 V28 M10 19 H34" stroke="${COLORS.A}" stroke-width="1.4" opacity=".45"/>
<rect x="66" y="76" width="18" height="11" rx="3" fill="#fff" opacity=".85"/><rect x="84" y="79" width="6" height="3" rx="1.5" fill="#fff" opacity=".85"/>
<path d="M71 72 q2 -4 0 -8 M77 72 q2 -4 0 -8" stroke="#fff" stroke-width="1.6" fill="none" opacity=".75" stroke-linecap="round"/>`,
  B: `<path d="M6 12 H90 L80 24 H16 Z" fill="#fff" opacity=".75"/><rect x="0" y="86" width="96" height="10" fill="#fff" opacity=".5"/>`,
  C: `<path d="M10 32 V18 a8 8 0 0 1 16 0 V32 Z" fill="#fff" opacity=".8"/>
<rect x="64" y="70" width="16" height="13" rx="3" fill="#fff" opacity=".9"/><path d="M80 75 h3 a3 3 0 0 1 0 6 h-3" stroke="#fff" stroke-width="2" fill="none"/>
<rect x="60" y="84" width="24" height="3" rx="1.5" fill="#fff" opacity=".9"/>`,
};
// Real portraits (Muse Image, generated once for this mockup) replace the placeholder when they are loaded.
export const AVATAR_IMAGES = {};
export function avatar(letter, size = 96) {
  if (AVATAR_IMAGES[letter]) {
    return `<img class="avatar" src="${AVATAR_IMAGES[letter]}" width="${size}" height="${size}" alt="" style="border-radius:${Math.round(size * 0.23)}px;object-fit:cover">`;
  }
  const c = COLORS[letter];
  return `<svg class="avatar" width="${size}" height="${size}" viewBox="0 0 96 96" aria-hidden="true">
<rect width="96" height="96" rx="22" fill="${TINTS[letter]}"/>${SETTING[letter]}
<circle cx="48" cy="41" r="14" fill="${c}"/><path d="M22 96 C24 72 34 63 48 63 S72 72 74 96 Z" fill="${c}" opacity=".85"/></svg>`;
}

const ICONS = {
  Profile: '<circle cx="10" cy="7" r="3.2"/><path d="M3.5 17c.6-3.2 3.1-4.8 6.5-4.8s5.9 1.6 6.5 4.8"/>',
  Paths: '<path d="M10 3l7 3.6-7 3.6-7-3.6z"/><path d="M3 10.2l7 3.6 7-3.6"/><path d="M3 13.6l7 3.6 7-3.6"/>',
  Assumptions: '<path d="M3 6h14M3 10h14M3 14h14"/><circle cx="7" cy="6" r="1.7"/><circle cx="13" cy="10" r="1.7"/><circle cx="8" cy="14" r="1.7"/>',
  Compare: '<rect x="3" y="4" width="5.5" height="12" rx="1.2"/><rect x="11.5" y="4" width="5.5" height="12" rx="1.2"/>',
  Trace: '<path d="M7 5h10M7 10h10M7 15h10"/><circle cx="3.5" cy="5" r=".9"/><circle cx="3.5" cy="10" r=".9"/><circle cx="3.5" cy="15" r=".9"/>',
};

export function sidebar(active) {
  const items = Object.entries(ICONS)
    .map(([name, d]) => `<div class="${name === active ? 'on' : ''}"><svg viewBox="0 0 20 20">${d}</svg>${name}</div>`)
    .join('');
  const mark = `<svg width="34" height="34" viewBox="0 0 34 34"><rect x="3" y="9" width="17" height="17" rx="3" fill="${COLORS.A}"/><rect x="9" y="5" width="17" height="17" rx="3" fill="${COLORS.B}" fill-opacity=".85"/><rect x="14" y="11" width="17" height="17" rx="3" fill="${COLORS.C}" fill-opacity=".85"/></svg>`;
  return `<aside class="sidebar"><div class="logo">${mark}Parallax</div><nav class="nav">${items}</nav><div class="side-foot">Export JSON<br>Delete everything<div class="tag">Mockup 5 v2 · Control Room</div></div></aside>`;
}

// The top bar: the three paths with their founder avatars, and the decision in the founder's words.
export function topbar(paths, selected) {
  const tabs = paths
    .map((p) => `<div class="tab${p.letter === selected ? ' sel' : ''}" style="--c:${COLORS[p.letter]}">${avatar(p.letter, 30)}<span>${p.letter} · ${p.name}</span></div>`)
    .join('');
  return `<header class="topbar"><div class="tabs">${tabs}</div><div class="decision"><b>Ayanda’s decision:</b> take a 12-month corporate lunch contract</div></header>`;
}

export const footer = () => '<footer class="footer">Not financial advice · One possible future, not a prediction</footer>';
