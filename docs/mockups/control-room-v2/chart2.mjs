// Charts for Mockup 5 v2, drawn from the engine's 36-month cash (data prepared by build2.mjs).
import { COLORS, rand, axis, scale, line, area, last } from './lib2.mjs';

const STEP = 200000;
const GRID = '#e1e6ee';
const ZERO = '#8f9bb0';
const INK = '#1d2634';

// Cash in the business over 36 months: the bad-to-good band, the likely line, and an optional dashed overlay (a setback)
// with its lowest point marked. Every series starts at month 0 (today), so index i is month i.
export function cashChart({ letter, start, bad, likely, good, overlay = null, overlayName = '', w, h }) {
  const c = COLORS[letter];
  const pad = { l: 84, r: 176, t: 18, b: 40 };
  const n = likely.length - 1;
  const floorValues = [...bad, 0, ...(overlay ?? [])];
  const lo = Math.floor(Math.min(...floorValues) / STEP) * STEP;
  const hi = Math.ceil(Math.max(...good) / STEP) * STEP;
  const x = scale(0, n, pad.l, w - pad.r);
  const y = scale(lo, hi, h - pad.b, pad.t);
  const xs = likely.map((_, i) => x(i));
  const Y = (arr) => arr.map(y);

  let grid = '';
  for (let v = lo; v <= hi; v += STEP) {
    grid += `<line x1="${pad.l}" x2="${w - pad.r}" y1="${y(v)}" y2="${y(v)}" stroke="${v === 0 ? ZERO : GRID}" stroke-width="${v === 0 ? 1.5 : 1}"/>`;
    grid += `<text class="ax" x="${pad.l - 14}" y="${y(v) + 4}" text-anchor="end">${axis(v)}</text>`;
  }
  const months = [0, 6, 12, 18, 24, 30, 36]
    .map((m) => {
      const anchor = m === 0 ? 'start' : m === n ? 'end' : 'middle';
      return `<text class="ax" x="${x(m)}" y="${h - 14}" text-anchor="${anchor}">${m === 0 ? 'Today' : m}</text>`;
    })
    .join('');
  const edge = (ys) => `<path d="${line(xs, Y(ys))}" fill="none" stroke="${c}" stroke-width="1.5" stroke-dasharray="6 5" opacity=".75"/>`;
  const label = (name, v) => {
    const yy = y(v);
    return `<text class="flag" x="${w - pad.r + 14}" y="${yy - 6}">${name}</text><text class="end" x="${w - pad.r + 14}" y="${yy + 16}">${rand(v)}</text>`;
  };
  let mark = '';
  if (overlay) {
    const low = Math.min(...overlay);
    const i = overlay.indexOf(low);
    mark = `<path d="${line(xs, Y(overlay))}" fill="none" stroke="${INK}" stroke-width="2" stroke-dasharray="7 5"/>
<circle cx="${xs[i]}" cy="${y(low)}" r="6" fill="#fff" stroke="${INK}" stroke-width="2.5"/>
<text class="flag halo" x="${xs[i] + 12}" y="${y(low) + 22}">${overlayName}: ${rand(low)} in month ${i}</text>`;
  }
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${grid}${months}
<path d="${area(xs, Y(good), Y(bad))}" fill="${c}" fill-opacity=".14"/>${edge(good)}${edge(bad)}
<path d="${line(xs, Y(likely))}" fill="none" stroke="${c}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/>
${mark}
<circle cx="${xs[0]}" cy="${y(start)}" r="6" fill="#fff" stroke="${c}" stroke-width="2.5"/>
${label('Good case', last(good))}${label('Likely case', last(likely))}${label('Bad case', last(bad))}</svg>`;
}

// One range bar for the compare table: bad to good at month 36 on a scale shared by all three paths, with the likely dot.
export function rangeBar(letter, bad, likely, good, [lo, hi], w) {
  const c = COLORS[letter];
  const x = scale(lo, hi, 8, w - 8);
  const xb = x(bad);
  const xg = x(good);
  return `<svg width="${w}" height="46" viewBox="0 0 ${w} 46"><rect x="8" y="14" width="${w - 16}" height="14" rx="7" fill="#eef1f6"/>
<rect x="${xb}" y="14" width="${xg - xb}" height="14" rx="7" fill="${c}" fill-opacity=".28" stroke="${c}" stroke-width="1.5"/>
<line x1="${x(0)}" x2="${x(0)}" y1="6" y2="36" stroke="${ZERO}" stroke-dasharray="3 3"/>
<circle cx="${x(likely)}" cy="21" r="7" fill="${c}" stroke="#fff" stroke-width="2"/>
<text class="ax" x="${x(0)}" y="45" text-anchor="middle">R0</text></svg>`;
}
