// Charts for the path and compare screens, drawn from the engine's cash by month (see lib/stress.ts).
import { formatMoney } from "@/lib/format";
import type { Letter } from "@/lib/parallax-store";
import { PATH_COLOR } from "./shared";
import type { Figures } from "@/lib/stress";

const STEP = 200000;
const GRID = "#e1e6ee";
const ZERO = "#8f9bb0";
const INK = "#1d2634";

type Scale = (v: number) => number;
const scale = (d0: number, d1: number, r0: number, r1: number): Scale => (v) => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);
const f1 = (n: number) => n.toFixed(1);
const linePath = (xs: number[], ys: number[]) => xs.map((x, i) => `${i ? "L" : "M"}${f1(x)} ${f1(ys[i]!)}`).join(" ");
const areaPath = (xs: number[], hi: number[], lo: number[]) =>
  `${linePath(xs, hi)} ${xs.map((_, i) => { const j = xs.length - 1 - i; return `L${f1(xs[j]!)} ${f1(lo[j]!)}`; }).join(" ")} Z`;
const last = (a: number[]) => a[a.length - 1]!;

/** Axis labels in the mockup's style: R0, R200k, R1m, −R200k. */
function axisLabel(n: number): string {
  const sign = n < 0 ? "−R" : "R";
  const a = Math.abs(n);
  if (a === 0) return "R0";
  return a >= 1_000_000 ? `${sign}${a / 1_000_000}m` : `${sign}${a / 1000}k`;
}

/** One shared scale for the range bars: from the lowest bad case (at least −R200 000) to the highest good case. */
export function domainOf(list: Figures[]): [number, number] {
  const lows = list.flatMap((f) => f.bad);
  const highs = list.flatMap((f) => f.good);
  return [
    Math.min(-200000, Math.floor(Math.min(...lows) / 100000) * 100000),
    Math.max(900000, Math.ceil(Math.max(...highs) / 100000) * 100000),
  ];
}

/**
 * Cash in the business over 36 months: the bad-to-good band, the likely line, and an optional dashed overlay (a setback
 * run at the likely case) with its lowest point marked. Index i is month i; index 0 is today.
 */
export function CashChart({
  letter,
  start,
  bad,
  likely,
  good,
  overlay,
  overlayLabel,
}: {
  letter: Letter;
  start: number;
  bad: number[];
  likely: number[];
  good: number[];
  overlay?: number[];
  overlayLabel?: string;
}) {
  const w = 548;
  const h = 244;
  const pad = { l: 84, r: 176, t: 18, b: 40 };
  const color = PATH_COLOR[letter];
  const n = likely.length - 1;
  const lo = Math.floor(Math.min(...bad, 0, ...(overlay ?? [])) / STEP) * STEP;
  const hi = Math.ceil(Math.max(...good) / STEP) * STEP;
  const x = scale(0, n, pad.l, w - pad.r);
  const y = scale(lo, hi, h - pad.b, pad.t);
  const xs = likely.map((_, i) => x(i));
  const Y = (arr: number[]) => arr.map(y);
  const ticks: number[] = [];
  for (let v = lo; v <= hi; v += STEP) ticks.push(v);
  const endX = w - pad.r + 14;
  const low = overlay ? Math.min(...overlay) : 0;
  const lowAt = overlay ? overlay.indexOf(low) : 0;

  return (
    <svg className="chart" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Cash in the business over 36 months, path ${letter}`}>
      {ticks.map((v) => (
        <g key={v}>
          <line x1={pad.l} x2={w - pad.r} y1={y(v)} y2={y(v)} stroke={v === 0 ? ZERO : GRID} strokeWidth={v === 0 ? 1.5 : 1} />
          <text className="ax" x={pad.l - 14} y={y(v) + 4} textAnchor="end">{axisLabel(v)}</text>
        </g>
      ))}
      {[0, 6, 12, 18, 24, 30, 36].map((m) => (
        <text key={m} className="ax" x={x(m)} y={h - 14} textAnchor={m === 0 ? "start" : m === n ? "end" : "middle"}>
          {m === 0 ? "Today" : m}
        </text>
      ))}
      <path d={areaPath(xs, Y(good), Y(bad))} fill={color} fillOpacity=".14" />
      <path d={linePath(xs, Y(good))} fill="none" stroke={color} strokeWidth="1.5" strokeDasharray="6 5" opacity=".75" />
      <path d={linePath(xs, Y(bad))} fill="none" stroke={color} strokeWidth="1.5" strokeDasharray="6 5" opacity=".75" />
      <path d={linePath(xs, Y(likely))} fill="none" stroke={color} strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round" />
      {overlay && (
        <g>
          <path d={linePath(xs, Y(overlay))} fill="none" stroke={INK} strokeWidth="2" strokeDasharray="7 5" />
          <circle cx={xs[lowAt]} cy={y(low)} r="6" fill="#fff" stroke={INK} strokeWidth="2.5" />
          {overlayLabel && (
            <text className="flag halo" x={xs[lowAt]! + 12} y={y(low) + 22}>{overlayLabel}</text>
          )}
        </g>
      )}
      <circle cx={xs[0]} cy={y(start)} r="6" fill="#fff" stroke={color} strokeWidth="2.5" />
      {[
        { name: "Good case", v: last(good) },
        { name: "Likely case", v: last(likely) },
        { name: "Bad case", v: last(bad) },
      ].map((e) => (
        <g key={e.name}>
          <text className="flag" x={endX} y={y(e.v) - 6}>{e.name}</text>
          <text className="end" x={endX} y={y(e.v) + 16}>{formatMoney(e.v)}</text>
        </g>
      ))}
    </svg>
  );
}

const SPARK_TINT: Record<Letter, string> = { A: "#9cb8f4", B: "#f2b595", C: "#bba6f0" };

/** A path's cash curve over 36 months, drawn as the picture on its card. The line is the engine's likely case. */
export function Spark({ letter, values }: { letter: Letter; values: number[] }) {
  const w = 300;
  const h = 240;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const xs = values.map((_, i) => (i / (values.length - 1)) * w);
  const ys = values.map((v) => h - 40 - ((v - lo) / span) * (h - 80));
  return (
    <svg className="nft-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <path
        d={linePath(xs, ys)}
        fill="none"
        stroke={SPARK_TINT[letter]}
        strokeWidth="3"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/** One range bar: bad to good at month 36 on a scale shared by the paths, with the likely case as a dot. */
export function RangeBar({
  letter,
  bad,
  likely,
  good,
  domain,
}: {
  letter: Letter;
  bad: number;
  likely: number;
  good: number;
  domain: [number, number];
}) {
  const w = 300;
  const color = PATH_COLOR[letter];
  const x = scale(domain[0], domain[1], 8, w - 8);
  const xb = x(bad);
  const xg = x(good);
  return (
    <svg className="rangebar" viewBox={`0 0 ${w} 46`} role="img" aria-label={`Cash at month 36: bad ${formatMoney(bad)}, likely ${formatMoney(likely)}, good ${formatMoney(good)}`}>
      <rect x="8" y="14" width={w - 16} height="14" rx="7" fill="#eef1f6" />
      <rect x={xb} y="14" width={Math.max(0, xg - xb)} height="14" rx="7" fill={color} fillOpacity=".28" stroke={color} strokeWidth="1.5" />
      <line x1={x(0)} x2={x(0)} y1="6" y2="36" stroke={ZERO} strokeDasharray="3 3" />
      <circle cx={x(likely)} cy="21" r="7" fill={color} stroke="#fff" strokeWidth="2" />
      <text className="ax" x={x(0)} y="45" textAnchor="middle">R0</text>
    </svg>
  );
}
