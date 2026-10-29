import { useId, useState } from 'react';
import { parseAmount } from '../../../shared/intake/amount';
import {
  ageBands,
  goalOptions,
  moneyKeys,
  riskLevels,
  type Extraction,
  type FieldKey,
} from '../../../shared/intake/schema';

type Props = {
  field: FieldKey;
  label: string;
  initial?: Extraction[FieldKey];
  submitLabel: string;
  onSave: (value: NonNullable<Extraction[FieldKey]>) => void;
  onCancel?: () => void;
};

const isMoney = (k: FieldKey): k is (typeof moneyKeys)[number] => (moneyKeys as readonly FieldKey[]).includes(k);

// One input per field kind. What the person types becomes the field's quote:
// it is their own words, so it passes the same check as an extracted field.
export function FieldEditor({ field, label, initial, submitLabel, onSave, onCancel }: Props) {
  const id = useId();
  const [text, setText] = useState(() => initialText(field, initial));
  const [goals, setGoals] = useState<string[]>(() =>
    field === 'goals' && initial && 'value' in initial && Array.isArray(initial.value) ? initial.value : [],
  );
  const [error, setError] = useState<string | null>(null);

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (isMoney(field)) {
      const p = parseAmount(text);
      if (!p.ok) return setError(p.error);
      return onSave({ low: p.low, high: p.high, quote: text.trim() });
    }
    if (field === 'goals') {
      if (goals.length === 0) return setError('Pick at least one');
      return onSave({ value: goals as (typeof goalOptions)[number][], quote: goals.join(', ') });
    }
    if (!text.trim()) return setError('This cannot be empty');
    onSave({ value: text.trim(), quote: text.trim() } as NonNullable<Extraction[FieldKey]>);
  }

  const errorId = `${id}-error`;
  const common = {
    id,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? errorId : undefined,
  };

  return (
    <form className="field-editor" onSubmit={save} noValidate>
      <label htmlFor={id}>{label}</label>
      {field === 'ageBand' || field === 'riskComfort' ? (
        <select {...common} value={text} onChange={(e) => setText(e.target.value)}>
          <option value="">Choose…</option>
          {(field === 'ageBand' ? ageBands : riskLevels).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : field === 'goals' ? (
        <fieldset className="goals" id={id}>
          <legend className="visually-hidden">{label}</legend>
          {goalOptions.map((g) => (
            <label key={g} className="check">
              <input
                type="checkbox"
                checked={goals.includes(g)}
                disabled={!goals.includes(g) && goals.length >= 3}
                onChange={(e) => setGoals(e.target.checked ? [...goals, g] : goals.filter((x) => x !== g))}
              />
              {g}
            </label>
          ))}
        </fieldset>
      ) : (
        <input
          {...common}
          inputMode={isMoney(field) ? 'decimal' : 'text'}
          placeholder={isMoney(field) ? 'e.g. 8000, about 8k, or 8k to 12k' : undefined}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setError(null);
          }}
        />
      )}
      {error && (
        <p className="error" id={errorId} role="alert">
          {error}
        </p>
      )}
      <div className="actions">
        <button type="submit" className="primary">
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="quiet" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

function initialText(field: FieldKey, initial?: Extraction[FieldKey]): string {
  if (!initial) return '';
  if ('low' in initial) return initial.low === initial.high ? String(initial.low) : `${initial.low} to ${initial.high}`;
  if (field === 'goals') return '';
  return String(initial.value);
}
