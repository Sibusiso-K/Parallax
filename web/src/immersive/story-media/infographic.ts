import { formatRand } from '../../../../shared/guard/figures';
import type { RoomSnapshot } from '../../../../shared/scene/room-model';

function xml(value: string): string {
  return value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!);
}

/** Creates a self-contained SVG from the engine snapshot. No external images, scripts, or model-generated figures. */
export function createCashInfographic(snapshot: RoomSnapshot, month: number): string {
  const active = snapshot.active.rows[month - 1];
  const baseline = snapshot.baseline.rows[month - 1];
  if (!Number.isInteger(month) || month < 1 || !active || !baseline || active.month !== month || baseline.month !== month || !Number.isFinite(active.cash) || !Number.isFinite(baseline.cash)) {
    throw new RangeError('Invalid month or scenario data');
  }
  const isStress = snapshot.ref.setback !== null;
  const title = xml(`${snapshot.pathName} · ${snapshot.ref.case} case`);
  const activeLabel = isStress ? 'With selected stress' : 'Baseline';
  const qualification = snapshot.active.firstShortfall !== null
    ? `First shortfall: month ${snapshot.active.firstShortfall}. Later projections assume the business continues.`
    : 'No shortfall in the modelled period.';
  // The whole 36 months beside the selected month's figure, drawn from the same rows.
  const values = [...snapshot.baseline.rows, ...snapshot.active.rows].map(r => r.cash);
  const min = Math.min(0, ...values), max = Math.max(0, ...values), span = max - min || 1;
  const left = 620, width = 470, top = 305, height = 200;
  const x = (i: number) => left + i / (snapshot.active.rows.length - 1) * width;
  const y = (v: number) => top + height - (v - min) / span * height;
  const points = (rows: RoomSnapshot['active']['rows']) => rows.map((r, i) => `${x(i).toFixed(1)},${y(r.cash).toFixed(1)}`).join(' ');
  const chart = `<line x1="${left}" x2="${left + width}" y1="${y(0).toFixed(1)}" y2="${y(0).toFixed(1)}" stroke="#211c46" stroke-opacity="0.3" stroke-width="2"/>${isStress ? `<polyline points="${points(snapshot.baseline.rows)}" fill="none" stroke="#8d8798" stroke-width="3" stroke-dasharray="9 8"/>` : ''}<polyline points="${points(snapshot.active.rows)}" fill="none" stroke="#5943bd" stroke-width="5" stroke-linejoin="round"/><circle cx="${x(month - 1).toFixed(1)}" cy="${y(active.cash).toFixed(1)}" r="9" fill="#5943bd" stroke="#fff" stroke-width="3"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800" role="img" aria-labelledby="title description"><title id="title">Cash snapshot: ${title}</title><desc id="description">${xml(qualification)} Funding and survival after a shortfall are not modelled.</desc><rect width="1200" height="800" rx="36" fill="#f8f6f2"/><text x="72" y="95" fill="#211c46" font-family="sans-serif" font-size="28" font-weight="700">PARALLAX · SCENARIO SNAPSHOT</text><text x="72" y="170" fill="#211c46" font-family="serif" font-size="54">${title}</text><text x="72" y="225" fill="#615d70" font-family="sans-serif" font-size="25">Month ${month} · revision ${snapshot.ref.profileRevision} · illustrative projection</text><rect x="72" y="275" width="1056" height="270" rx="26" fill="#fff" stroke="#ddd8e7"/><text x="110" y="340" fill="#615d70" font-family="sans-serif" font-size="25">${activeLabel}</text><text x="110" y="420" fill="${active.cash < 0 ? '#a3302a' : '#211c46'}" font-family="sans-serif" font-size="62" font-weight="700">${xml(formatRand(active.cash))}</text>${isStress ? `<text x="110" y="490" fill="#615d70" font-family="sans-serif" font-size="27">Baseline: ${xml(formatRand(baseline.cash))}</text>` : ''}${chart}<text x="72" y="615" fill="#77491a" font-family="sans-serif" font-size="24">${xml(qualification)}</text><text x="72" y="662" fill="#615d70" font-family="sans-serif" font-size="22">Funding and survival after a shortfall are not modelled.</text><text x="72" y="735" fill="#615d70" font-family="sans-serif" font-size="21">One possible future, not a prediction. Figures calculated by Parallax.</text></svg>`;
}

/** The same picture as a PNG, for places that will not take an SVG. Every pixel comes from the SVG above. */
export async function svgToPng(svg: string, width = 1200, height = 800): Promise<Blob> {
  const image = new Image();
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No drawing surface');
  ctx.drawImage(image, 0, 0, width, height);
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('No image'))), 'image/png'));
}
