import { describe, expect, it } from 'vitest';
import { answerFromReply, actionLabel } from './live-advisor';
import { createSession } from './session';

const session = createSession();
const snap = session.snapshotFor('B', true);
const scope = { pathId: 'B' as const, snapshotKey: snap.key, month: 4 };
const cash = snap.active.rows[3]!.cash;
const text = `${cash < 0 ? '-' : ''}R${Math.abs(cash).toLocaleString('en-US')}`;

describe('answerFromReply', () => {
  it('shows figures as claims resolved from this browser’s own snapshot', () => {
    const a = answerFromReply(session, scope, 'Why?', {
      segments: [{ kind: 'text', text: 'Cash reaches ' }, { kind: 'figure', scenario: 'active', metric: 'cash_at_month', month: 4, text }, { kind: 'text', text: '.' }],
      actions: [{ type: 'show_month', month: 4 }],
      followups: ['What next?'],
      model: 'muse-spark-1.3',
      latencyMs: 9000,
    });
    expect(a.status).toBe('answered');
    expect(a.source).toBe('model');
    expect(a.claims[0]!.text).toBe(text);
    expect(a.segments[1]).toEqual({ kind: 'claim', index: 0 });
    expect(a.actions).toEqual([{ type: 'show_month', month: 4 }]);
    expect(a.trace.map((t) => t.tool)).toEqual(['muse-spark-1.3', 'figure_guard', 'verify_claims']);
  });

  it('withholds the whole answer when a figure differs from the engine run on screen', () => {
    const a = answerFromReply(session, scope, 'Why?', { segments: [{ kind: 'figure', scenario: 'active', metric: 'cash_at_month', month: 4, text: 'R1' }] });
    expect(a.status).toBe('withheld');
    expect(a.claims).toEqual([]);
    expect(JSON.stringify(a.segments)).not.toContain('R1"');
  });

  it('withholds when nothing survived the checks, or the snapshot is gone', () => {
    expect(answerFromReply(session, scope, 'Why?', { segments: [] }).status).toBe('withheld');
    expect(answerFromReply(session, { ...scope, snapshotKey: 'gone' }, 'Why?', { segments: [{ kind: 'text', text: 'Hi.' }] }).status).toBe('withheld');
  });

  it('records what the guard removed', () => {
    const a = answerFromReply(session, scope, 'Why?', { segments: [{ kind: 'text', text: 'Hi.' }], dropped: 2 });
    expect(a.trace[1]).toMatchObject({ tool: 'figure_guard', ok: false });
    expect(a.trace[1]!.detail).toContain('2');
  });
});

describe('actionLabel', () => {
  it('says plainly what each suggestion does', () => {
    const label = (id: string) => (id === 'pan' ? 'Ingredients and packaging' : id);
    expect(actionLabel({ type: 'show_month', month: 4 }, label)).toBe('Show month 4');
    expect(actionLabel({ type: 'late_payment', on: true }, label)).toBe('Turn on the late payment');
    expect(actionLabel({ type: 'go_to', object: 'pan' }, label)).toBe('Go to Ingredients and packaging');
    expect(actionLabel({ type: 'switch_path', path: 'C' }, label)).toBe('Switch to path C');
  });
});
