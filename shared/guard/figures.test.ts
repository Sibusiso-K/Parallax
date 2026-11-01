import { describe, expect, it } from 'vitest';
import { figureTable } from '../engine/analysis.js';
import type { PathInput } from '../engine/simulate.js';
import { formatFigure, formatRand, guardSentences, guardText, SEE_CHART, WITHHELD_TEXT, type GuardContext } from './figures.js';

const pathA: PathInput = {
  id: 'A',
  startingSavings: 9000,
  assumptions: [
    { id: 'A1', label: 'Salary', kind: 'income', low: 18000, base: 18500, high: 19000, role: 'salary' },
    { id: 'A2', label: 'Rent and food', kind: 'cost', low: 11000, base: 12000, high: 13000, role: 'essential' },
  ],
};
const table = figureTable(pathA);
const ctx: GuardContext = { pathId: 'A', table, userNumbers: [18500, 9000], allowedIds: ['A1', 'A2'] };

describe('figure guard', () => {
  it('substitutes a real key with the engine value', () => {
    const r = guardText('You would have {{fig:A.savings.m36.likely}} by then.', ctx);
    expect(r.text).toBe(`You would have ${formatRand(table['A.savings.m36.likely']!)} by then.`);
    expect(r.clean).toBe(true);
    expect(r.checks).toEqual([{ type: 'substituted', detail: 'A.savings.m36.likely' }]);
  });

  it('formats month and runway keys as months, not rand', () => {
    expect(formatFigure('A.worstMonth.bad', 7)).toBe('month 7');
    expect(formatFigure('A.milestone.emergency-3-months.likely', 14)).toBe('month 14');
    expect(formatFigure('A.runway', 5.4)).toBe('5 months');
    expect(formatFigure('A.start', -3000)).toBe('-R3,000');
  });

  it('refuses unknown keys and other paths (isolation)', () => {
    const r = guardText('{{fig:A.made.up}} and {{fig:B.savings.m36.likely}}', ctx);
    expect(r.text).toBe(`${SEE_CHART} and ${SEE_CHART}`);
    expect(r.clean).toBe(false);
    expect(r.checks.map(c => c.type)).toEqual(['unknown_key', 'wrong_path']);
  });

  it('does not let prototype keys through', () => {
    const r = guardText('{{fig:A.constructor}} {{fig:toString}}', ctx);
    expect(r.text).toBe(`${SEE_CHART} ${SEE_CHART}`);
  });

  it('scrubs a raw amount even when it equals a real figure (strict: only placeholders carry numbers)', () => {
    const real = formatRand(table['A.savings.m36.likely']!);
    const r = guardText(`You will end with ${real}.`, ctx);
    expect(r.text).not.toContain(real);
    expect(r.text).toContain(SEE_CHART);
  });

  it('scrubs the many ways a model can write an invented amount', () => {
    for (const bad of ['R50,000', 'R 50 000', 'R50000', 'R1.2 million', 'R5k', '50k', 'about 12%', '12 percent', '1 000 000', '250000', 'fifty thousand rand', 'two million', 'a hundred thousand']) {
      const r = guardText(`Expect ${bad} soon.`, ctx);
      expect(r.text, bad).toContain(SEE_CHART);
      expect(r.clean, bad).toBe(false);
    }
  });

  it('keeps what the person said, years, and small counts', () => {
    const r = guardText('You said R18,500 and R9,000. By 2029, over 36 months, in month 12, you save 3 times a week.', ctx);
    expect(r.text).toContain('R18,500');
    expect(r.text).toContain('R9,000');
    expect(r.text).toContain('2029');
    expect(r.text).toContain('36 months');
    expect(r.clean).toBe(true);
  });

  it('does not let a user number launder a percentage', () => {
    const r = guardText('That is 18500% more.', ctx);
    expect(r.text).toContain(SEE_CHART);
  });

  it('drops citation IDs that are not on this path', () => {
    const r = guardText('Because of [A1] and [A9] and [E3].', ctx);
    expect(r.text).toContain('[A1]');
    expect(r.text).not.toContain('A9');
    expect(r.text).not.toContain('E3');
    expect(r.checks.filter(c => c.type === 'dropped_id').length).toBe(2);
  });

  it('flags certainty the engine cannot back', () => {
    for (const p of ['This is guaranteed.', 'You will be rich.', 'It is risk-free.', 'I promise it works.']) {
      expect(guardText(p, ctx).checks.some(c => c.type === 'certainty'), p).toBe(true);
    }
    expect(guardText('It might go either way.', ctx).clean).toBe(true);
  });

  it('fails closed when the guard itself throws', () => {
    const exploding = new Proxy({}, { has: () => { throw new Error('boom'); }, get: () => { throw new Error('boom'); }, getOwnPropertyDescriptor: () => { throw new Error('boom'); } }) as Record<string, number>;
    const r = guardText('{{fig:A.start}}', { ...ctx, table: exploding });
    expect(r.withheld).toBe(true);
    expect(r.text).toBe(WITHHELD_TEXT);
  });

  it('treats a non-finite engine value as missing, never printing it', () => {
    const r = guardText('{{fig:A.x}}', { ...ctx, table: { 'A.x': Number.NaN } });
    expect(r.text).toBe(SEE_CHART);
    expect(r.checks[0]!.type).toBe('bad_value');
  });

  it('never prints a placeholder or key in the output', () => {
    const r = guardText('{{fig:A.start}} {{ fig:A.nope }} {{fig:}}', ctx);
    expect(r.text).not.toMatch(/\{\{|fig:/);
  });

  it('guards sentence by sentence and keeps substitutions', () => {
    const r = guardSentences('Your savings start at {{fig:A.start}}. You will definitely have R99,999! Is that fine?', ctx);
    expect(r.text).toContain('R9,000');
    expect(r.text).not.toContain('99,999');
    expect(r.clean).toBe(false);
  });

  it('does not lose text when a placeholder is split across sentence punctuation', () => {
    const r = guardSentences('A {{fig:A.savings.m12.bad}}. B.', ctx);
    expect(r.text).toBe(`A ${formatRand(table['A.savings.m12.bad']!)}. B.`);
  });

  it('is deterministic', () => {
    const a = guardText('{{fig:A.savings.m12.bad}} R777 7%', ctx);
    const b = guardText('{{fig:A.savings.m12.bad}} R777 7%', ctx);
    expect(a).toEqual(b);
  });

  it('checks never contain the model text itself', () => {
    const r = guardText('Secret plan: R123,456 for Mama.', ctx);
    expect(JSON.stringify(r.checks)).not.toMatch(/Secret|Mama|123/);
  });
});
