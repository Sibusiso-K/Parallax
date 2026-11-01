import { useState } from 'react';
import { formatRange } from '../../../shared/intake/amount';
import { NALEDI_TEXT } from '../../../shared/intake/fixture';
import type { IntakeResponse } from '../../../shared/intake/handle';
import {
  fieldLabels,
  followUps,
  requiredFields,
  type Extraction,
  type FieldKey,
} from '../../../shared/intake/schema';
import { FieldEditor } from './FieldEditor';

// F2 text intake: say it your way, then check "Here is what I heard".
// Missing fields are asked one at a time; at most three follow-ups, the rest go in the form.
const MAX_FOLLOW_UPS = 3;

type Phase = 'write' | 'loading' | 'review';

export function Intake({ onDone }: { onDone: (fields: Extraction, skipped: FieldKey[]) => void }) {
  const [phase, setPhase] = useState<Phase>('write');
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ mode: string; notice?: string } | null>(null);
  const [fields, setFields] = useState<Extraction>({});
  const [skipped, setSkipped] = useState<FieldKey[]>([]);
  const [asked, setAsked] = useState(0);
  const [editing, setEditing] = useState<FieldKey | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPhase('loading');
    try {
      const res = await fetch('/api/intake', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = (await res.json()) as IntakeResponse;
      if (!data.ok) {
        setError(data.error);
        setPhase('write');
        return;
      }
      setFields(data.fields);
      setResult({ mode: data.mode, notice: data.notice });
      setPhase('review');
    } catch {
      // F2: if extraction fails, keep the text and open an empty form.
      setFields({});
      setResult({ mode: 'offline', notice: "We couldn't reach Parallax. Your text is kept; please fill in the form." });
      setPhase('review');
    }
  }

  const missing = requiredFields.filter((k) => fields[k] === undefined && !skipped.includes(k));
  const followUp = asked < MAX_FOLLOW_UPS ? missing[0] : undefined;

  function save(key: FieldKey, value: NonNullable<Extraction[FieldKey]>) {
    setFields((f) => ({ ...f, [key]: value }));
    setSkipped((s) => s.filter((k) => k !== key));
    setEditing(null);
  }

  if (phase !== 'review') {
    return (
      <section className="intake" aria-labelledby="intake-title">
        <h2 id="intake-title">What are you deciding?</h2>
        <p className="muted">
          Say it your way: the decision, what you earn and spend, what you have saved, who you support. Rough numbers are
          fine.
        </p>
        <form onSubmit={submit}>
          <label htmlFor="intake-text" className="visually-hidden">
            Your decision and situation
          </label>
          <textarea
            id="intake-text"
            rows={8}
            maxLength={4000}
            value={text}
            onChange={(e) => setText(e.target.value)}
            aria-describedby={error ? 'intake-error' : undefined}
          />
          {error && (
            <p className="error" id="intake-error" role="alert">
              {error}
            </p>
          )}
          <div className="actions">
            <button type="submit" className="primary" disabled={phase === 'loading' || !text.trim()}>
              {phase === 'loading' ? 'Reading…' : 'Continue'}
            </button>
            <button type="button" className="quiet" onClick={() => setText(NALEDI_TEXT)}>
              Use the demo story (Naledi, fictional)
            </button>
          </div>
        </form>
      </section>
    );
  }

  return (
    <section className="intake" aria-labelledby="heard-title">
      <h2 id="heard-title">Here is what I heard</h2>
      {result?.notice && <p className="banner" role="status">{result.notice}</p>}
      {result?.mode === 'fixture' && (
        <p className="muted small">Demo mode: no model is connected yet, so only the demo story is read for you.</p>
      )}

      {followUp && editing === null && (
        <div className="follow-up" aria-live="polite">
          <FieldEditor
            key={followUp}
            field={followUp}
            label={followUps[followUp]}
            submitLabel="Add"
            onSave={(v) => {
              save(followUp, v);
              setAsked((n) => n + 1);
            }}
          />
          <button
            type="button"
            className="quiet"
            onClick={() => {
              setSkipped((s) => [...s, followUp]);
              setAsked((n) => n + 1);
            }}
          >
            I don't know
          </button>
        </div>
      )}

      <dl className="heard">
        {requiredFields.map((key) => (
          <div className="heard-row" key={key}>
            <dt>{fieldLabels[key]}</dt>
            <dd>
              {editing === key ? (
                <FieldEditor
                  field={key}
                  label={`Edit ${fieldLabels[key].toLowerCase()}`}
                  initial={fields[key]}
                  submitLabel="Save"
                  onSave={(v) => save(key, v)}
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <>
                  <FieldValue value={fields[key]} skipped={skipped.includes(key)} />
                  <button type="button" className="link" onClick={() => setEditing(key)}>
                    {fields[key] ? 'Edit' : 'Add'}
                    <span className="visually-hidden"> {fieldLabels[key].toLowerCase()}</span>
                  </button>
                </>
              )}
            </dd>
          </div>
        ))}
      </dl>

      <div className="actions">
        <button type="button" className="primary" disabled={missing.length > 0} onClick={() => onDone(fields, skipped)}>
          This is right
        </button>
        <button type="button" className="quiet" onClick={() => setPhase('write')}>
          Back to my words
        </button>
      </div>
      {missing.length > 0 && (
        <p className="muted small">
          Still needed: {missing.map((k) => fieldLabels[k].toLowerCase()).join(', ')}. You can say "I don't know".
        </p>
      )}
    </section>
  );
}

function FieldValue({ value, skipped }: { value: Extraction[FieldKey]; skipped: boolean }) {
  if (!value) {
    return <span className="muted">{skipped ? "Don't know: we'll use a labelled default with a wider range" : 'Missing'}</span>;
  }
  if ('low' in value) {
    return (
      <span>
        {formatRange(value.low, value.high)}
        {value.low !== value.high && <span className="chip">range</span>}
      </span>
    );
  }
  return <span>{Array.isArray(value.value) ? value.value.join(', ') : value.value}</span>;
}
