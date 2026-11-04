import { useId } from 'react';
import { createCashInfographic } from './infographic';
import type { RoomSnapshot } from '../../../../shared/scene/room-model';

/** A deterministic view of one existing snapshot. It does not calculate the scenario. */
export function CashStory({ snapshot, selectedMonth, onSelectMonth, disabled = false }: {
  snapshot: RoomSnapshot;
  selectedMonth: number;
  onSelectMonth: (month: number) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const baseline = snapshot.baseline.rows;
  const active = snapshot.active.rows;
  if (!active.length || active.length !== baseline.length || !Number.isInteger(selectedMonth) || selectedMonth < 1 || selectedMonth > active.length) {
    return <p role="alert">This graph is unavailable for the selected scenario.</p>;
  }
  const values = [...baseline, ...active].map(row => row.cash);
  if (values.some(value => !Number.isFinite(value)) || active.some((row, i) => row.month !== baseline[i]?.month)) {
    return <p role="alert">This graph is unavailable because the scenario data is incomplete.</p>;
  }
  const min = Math.min(0, ...values), max = Math.max(0, ...values);
  const span = max - min || 1;
  const x = (i: number) => 30 + (active.length === 1 ? 0 : i / (active.length - 1) * 540);
  const y = (v: number) => 180 - (v - min) / span * 150;
  const points = (rows: typeof active) => rows.map((row, i) => `${x(i)},${y(row.cash)}`).join(' ');
  const money = (value: number) => new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(value);
  const changed = snapshot.ref.setback !== null;
  return <section aria-labelledby={`${id}-title`}>
    <h3 id={`${id}-title`}>Cash over {active.length} months</h3>
    <p>{snapshot.pathName} · {snapshot.ref.case} case · {changed ? 'baseline and selected stress' : 'baseline'}</p>
    <svg viewBox="0 0 600 210" role="img" aria-labelledby={`${id}-title ${id}-description`}>
      <desc id={`${id}-description`}>Cash at the end of each month. The full values are available in the table below.</desc>
      <line x1="30" x2="570" y1={y(0)} y2={y(0)} stroke="currentColor" strokeOpacity="0.4" />
      {changed && <polyline points={points(baseline)} fill="none" stroke="#777080" strokeWidth="2" strokeDasharray="5 4" />}
      <polyline points={points(active)} fill="none" stroke="#5943bd" strokeWidth="3" />
      <circle cx={x(selectedMonth - 1)} cy={y(active[selectedMonth - 1]!.cash)} r="5" fill="#5943bd" />
    </svg>
    <p>Month {selectedMonth}: {changed ? 'with stress ' : ''}{money(active[selectedMonth - 1]!.cash)}{changed ? `; baseline ${money(baseline[selectedMonth - 1]!.cash)}` : ''}.</p>
    {active.length > 1 && <label>Month <input type="range" disabled={disabled} min="1" max={active.length} value={selectedMonth} onChange={e => onSelectMonth(Number(e.currentTarget.value))} /></label>}
    {snapshot.active.firstShortfall !== null && <p>First shortfall: month {snapshot.active.firstShortfall}. Later projections assume the business continues; funding and survival are not modelled.</p>}
    <button type="button" onClick={() => {
      const data = createCashInfographic(snapshot, selectedMonth);
      const url = URL.createObjectURL(new Blob([data], { type: 'image/svg+xml;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `parallax-path-${snapshot.ref.pathId}-month-${selectedMonth}.svg`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }}>Download this cash snapshot</button>
    <details><summary>Show monthly values</summary><table><caption>Month-end cash for {snapshot.pathName}</caption><thead><tr><th scope="col">Month</th>{changed && <th scope="col">Baseline</th>}<th scope="col">{changed ? 'With stress' : 'Cash'}</th></tr></thead><tbody>{active.map((row, i) => <tr key={row.month}><th scope="row">{row.month}</th>{changed && <td>{money(baseline[i]!.cash)}</td>}<td>{money(row.cash)}</td></tr>)}</tbody></table></details>
  </section>;
}
