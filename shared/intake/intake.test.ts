import { describe, expect, it } from 'vitest';
import { formatRand, parseAmount } from './amount';
import { handleIntake } from './handle';
import { NALEDI_TEXT } from './fixture';

describe('parseAmount', () => {
  it('reads exact amounts in the ways people type them', () => {
    expect(parseAmount('19500')).toEqual({ ok: true, low: 19500, high: 19500, rough: false });
    expect(parseAmount('R19,500')).toMatchObject({ low: 19500, high: 19500 });
    expect(parseAmount('19.5k')).toMatchObject({ low: 19500 });
    expect(parseAmount('R 3 000 a month')).toMatchObject({ low: 3000 });
  });

  it('turns ranges and "about" into a range chip', () => {
    expect(parseAmount('8 to 12k')).toEqual({ ok: true, low: 8000, high: 12000, rough: true });
    expect(parseAmount('R2,500 - R11,000')).toMatchObject({ low: 2500, high: 11000 });
    expect(parseAmount('about 6k')).toEqual({ ok: true, low: 5100, high: 6900, rough: true });
  });

  it('rejects letters, negatives, blanks and back-to-front ranges', () => {
    expect(parseAmount('')).toMatchObject({ ok: false });
    expect(parseAmount('lots')).toMatchObject({ ok: false });
    expect(parseAmount('-500')).toMatchObject({ ok: false, error: 'Amounts cannot be negative' });
    expect(parseAmount('12k to 8k')).toMatchObject({ ok: false });
  });
});

describe('formatRand', () => {
  it('puts the minus sign before the R', () => {
    expect(formatRand(-476800)).toBe('−R476 800');
    expect(formatRand(19500)).toBe('R19 500');
  });
});

describe('handleIntake', () => {
  it('fills the demo persona from fixtures and asks for what is missing', async () => {
    const res = await handleIntake({ text: NALEDI_TEXT });
    expect(res).toMatchObject({ ok: true, mode: 'fixture', missing: ['essentialExpenses'] });
    if (res.ok) expect(res.fields.savings).toMatchObject({ low: 30000, high: 40000 });
  });

  it('drops any field whose quote is not in the person\'s text', async () => {
    const res = await handleIntake({ text: 'I want to change jobs.' }, async () => ({
      decision: { value: 'Change jobs', quote: 'change jobs' },
      savings: { low: 1_000_000, high: 1_000_000, quote: 'I have a million saved' },
    }));
    expect(res).toMatchObject({ ok: true, mode: 'model', dropped: ['savings'] });
    if (res.ok) expect(res.fields.decision?.value).toBe('Change jobs');
  });

  it('keeps going with an empty form when the model fails or returns junk', async () => {
    const failed = await handleIntake({ text: 'Should I quit?' }, async () => {
      throw new Error('timeout');
    });
    expect(failed).toMatchObject({ ok: true, fields: {}, notice: expect.any(String) });
    const junk = await handleIntake({ text: 'Should I quit?' }, async () => ({ takeHome: 'lots' }));
    expect(junk).toMatchObject({ ok: true, fields: {} });
  });

  it('rejects empty and oversized text', async () => {
    expect(await handleIntake({ text: '   ' })).toMatchObject({ ok: false });
    expect(await handleIntake({ text: 'x'.repeat(4001) })).toMatchObject({ ok: false });
    expect(await handleIntake(null)).toMatchObject({ ok: false });
  });
});
