import { useId, useState } from 'react';
import { formatRand, parseAmount } from '../../../shared/intake/amount';
import { editAssumption, type Assumption, type Source } from '../../../shared/engine/simulate';
import type { PathCard } from '../../../shared/paths/templates';

// F8 assumptions panel: IDs, values, ranges and sources; edit in place, re-run in the browser.
const sourceLabel: Record<Source, string> = {
  you: 'you',
  default: 'default',
  template: 'template',
  ai: 'AI-suggested',
};

export function AssumptionsPanel({ path, onChange }: { path: PathCard; onChange: (p: PathCard) => void }) {
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <ul className="assumptions">
      {path.assumptions.map((a) => (
        <li key={a.id} className="assumption">
          {editing === a.id ? (
            <EditRow
              a={a}
              onCancel={() => setEditing(null)}
              onSave={(values) => {
                const res = editAssumption(path, a.id, values);
                if (!res.ok) return friendly(res.error);
                onChange(res.path);
                setEditing(null);
                return null;
              }}
            />
          ) : (
            <>
              <div className="assumption-head">
                <span className="id-chip">{a.id}</span>
                <span className="assumption-label">{a.label}</span>
                <span className={`chip source-${a.source ?? 'template'}`}>{sourceLabel[a.source ?? 'template']}</span>
              </div>
              <div className="assumption-values small">
                <span>
                  {a.kind === 'cost' ? 'Cost' : 'Income'} a month: {values(a)}
                  {monthWindow(a)}
                </span>
                <button type="button" className="link" onClick={() => setEditing(a.id)}>
                  Edit<span className="visually-hidden"> {a.id} {a.label}</span>
                </button>
              </div>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}

function friendly(error: string): string {
  if (error.includes('low <= base <= high')) return 'Low can’t be above usually, and usually can’t be above high.';
  if (error.includes('negative')) return 'Amounts can’t be negative.';
  return error;
}

function values(a: Assumption): string {
  if (a.low === a.high) return formatRand(a.base);
  return `${formatRand(a.low)} – ${formatRand(a.high)}, usually ${formatRand(a.base)}`;
}

function monthWindow(a: Assumption): string {
  if (a.fromMonth && a.toMonth) return ` (months ${a.fromMonth}–${a.toMonth})`;
  if (a.fromMonth) return ` (from month ${a.fromMonth})`;
  if (a.toMonth) return ` (until month ${a.toMonth})`;
  return '';
}

type Values = Pick<Assumption, 'low' | 'base' | 'high'>;

function EditRow({ a, onSave, onCancel }: { a: Assumption; onSave: (v: Values) => string | null; onCancel: () => void }) {
  const id = useId();
  const [text, setText] = useState({ low: String(a.low), base: String(a.base), high: String(a.high) });
  const [error, setError] = useState<string | null>(null);

  function save(e: React.FormEvent) {
    e.preventDefault();
    const parsed: Partial<Values> = {};
    for (const k of ['low', 'base', 'high'] as const) {
      const p = parseAmount(text[k]);
      if (!p.ok || p.low !== p.high) return setError(p.ok ? `Give one amount for ${k}` : p.error);
      parsed[k] = p.low;
    }
    setError(onSave(parsed as Values));
  }

  return (
    <form onSubmit={save} className="assumption-edit" noValidate>
      <p className="assumption-head">
        <span className="id-chip">{a.id}</span>
        <span className="assumption-label">{a.label}</span>
      </p>
      <div className="triple">
        {(['low', 'base', 'high'] as const).map((k) => (
          <label key={k} htmlFor={`${id}-${k}`}>
            <span className="small muted">{k === 'base' ? 'usually' : k}</span>
            <input
              id={`${id}-${k}`}
              inputMode="decimal"
              value={text[k]}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${id}-error` : undefined}
              onChange={(e) => {
                setText({ ...text, [k]: e.target.value });
                setError(null);
              }}
            />
          </label>
        ))}
      </div>
      {error && (
        <p className="error" id={`${id}-error`} role="alert">
          {error}
        </p>
      )}
      <div className="actions">
        <button type="submit" className="primary">
          Save and re-run
        </button>
        <button type="button" className="quiet" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
