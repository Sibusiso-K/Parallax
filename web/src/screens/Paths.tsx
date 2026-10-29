import { useMemo } from 'react';
import { formatRand } from '../../../shared/intake/amount';
import { simulate } from '../../../shared/engine/simulate';
import type { PathCard } from '../../../shared/paths/templates';

// Path cards (DEMO.md §7 #3): avatar, name and a three-year range band.
// The avatar is a path-colour silhouette until Muse Image portraits land (F9).
export function Paths({ paths, fromTemplates }: { paths: PathCard[]; fromTemplates: boolean }) {
  const results = useMemo(() => paths.map((p) => ({ path: p, sim: simulate(p) })), [paths]);

  // One shared scale so bands can be compared across cards.
  const all = results.flatMap(({ sim }) => [sim.bad.rows.at(-1)!.savings, sim.good.rows.at(-1)!.savings]);
  const min = Math.min(0, ...all);
  const max = Math.max(...all);
  const pct = (v: number) => ((v - min) / (max - min || 1)) * 100;

  return (
    <section aria-labelledby="paths-title">
      <h2 id="paths-title">Three possible futures</h2>
      {fromTemplates && <p className="small muted">These are starting templates. You can change every number.</p>}

      <ol className="paths">
        {results.map(({ path, sim }) => {
          const bad = sim.bad.rows.at(-1)!.savings;
          const likely = sim.likely.rows.at(-1)!.savings;
          const good = sim.good.rows.at(-1)!.savings;
          const shortfall = sim.bad.shortfallMonths[0];
          return (
            <li key={path.id} className="path-card" style={{ '--path': `var(--path-${path.letter.toLowerCase()})` } as React.CSSProperties}>
              <div className="avatar" aria-hidden="true">
                <svg viewBox="0 0 48 48" width="56" height="56">
                  <circle cx="24" cy="18" r="9" />
                  <path d="M8 46c0-10 7-16 16-16s16 6 16 16z" />
                </svg>
              </div>
              <div className="path-body">
                <h3>
                  <span className="path-letter">{path.letter}</span> {path.name}
                </h3>
                <p className="small">{path.summary}</p>
                <p className="band-label">Savings at month 36</p>
                <div
                  className="band"
                  role="img"
                  aria-label={`Bad case ${formatRand(bad)}, likely ${formatRand(likely)}, good case ${formatRand(good)}`}
                >
                  <span className="band-range" style={{ left: `${pct(bad)}%`, width: `${Math.max(pct(good) - pct(bad), 1)}%` }} />
                  <span className="band-likely" style={{ left: `${pct(likely)}%` }} />
                  {min < 0 && <span className="band-zero" style={{ left: `${pct(0)}%` }} />}
                </div>
                <p className="band-figures small">
                  <span>Bad {formatRand(bad)}</span>
                  <strong>Likely {formatRand(likely)}</strong>
                  <span>Good {formatRand(good)}</span>
                </p>
                {shortfall !== undefined && (
                  <p className="small">In the bad case, savings run out in month {shortfall}.</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      <p className="small muted">Every figure is computed in code from the assumptions on each path.</p>
    </section>
  );
}
