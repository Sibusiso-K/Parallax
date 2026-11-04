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
  const currency = (n: number) => new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(n);
  const isStress = snapshot.ref.setback !== null;
  const title = xml(`${snapshot.pathName} · ${snapshot.ref.case} case`);
  const activeLabel = isStress ? 'With selected stress' : 'Baseline';
  const qualification = snapshot.active.firstShortfall !== null
    ? `First shortfall: month ${snapshot.active.firstShortfall}. Later projections assume the business continues.`
    : 'No shortfall in the modelled period.';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800" role="img" aria-labelledby="title description"><title id="title">Cash snapshot: ${title}</title><desc id="description">${xml(qualification)} Funding and survival after a shortfall are not modelled.</desc><rect width="1200" height="800" rx="36" fill="#f8f6f2"/><text x="72" y="95" fill="#211c46" font-family="sans-serif" font-size="28" font-weight="700">PARALLAX · SCENARIO SNAPSHOT</text><text x="72" y="170" fill="#211c46" font-family="serif" font-size="54">${title}</text><text x="72" y="225" fill="#615d70" font-family="sans-serif" font-size="25">Month ${month} · revision ${snapshot.ref.profileRevision} · illustrative projection</text><rect x="72" y="275" width="1056" height="270" rx="26" fill="#fff" stroke="#ddd8e7"/><text x="110" y="340" fill="#615d70" font-family="sans-serif" font-size="25">${activeLabel}</text><text x="110" y="420" fill="#211c46" font-family="sans-serif" font-size="62" font-weight="700">${xml(currency(active.cash))}</text>${isStress ? `<text x="110" y="490" fill="#615d70" font-family="sans-serif" font-size="27">Baseline: ${xml(currency(baseline.cash))}</text>` : ''}<text x="72" y="615" fill="#77491a" font-family="sans-serif" font-size="24">${xml(qualification)}</text><text x="72" y="662" fill="#615d70" font-family="sans-serif" font-size="22">Funding and survival after a shortfall are not modelled.</text><text x="72" y="735" fill="#615d70" font-family="sans-serif" font-size="21">One possible future, not a prediction. Figures calculated by Parallax.</text></svg>`;
}
