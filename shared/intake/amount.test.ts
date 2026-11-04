import { describe, expect, it } from 'vitest';
import { ROUGH_SPREAD, formatRand, formatRange, parseAmount } from './amount.js';

describe('rough amounts', () => {
  it('spreads a rough figure by the placeholder 15% either side', () => {
    expect(ROUGH_SPREAD).toBe(0.15);
    expect(parseAmount('about 90k')).toEqual({ ok: true, low: 76500, high: 103500, rough: true });
  });
});

describe('formatRange and formatRand', () => {
  it('shows one figure when the range is a single value, and both ends otherwise', () => {
    expect(formatRange(19500, 19500)).toBe('R19 500');
    expect(formatRange(75000, 105000)).toBe('R75 000 – R105 000');
  });

  it('rounds to whole rand, and writes a negative with the minus sign before the R', () => {
    expect(formatRand(-0.4)).toBe('R0');
    expect(formatRand(1234.5)).toBe('R1 235');
    expect(formatRand(-476800)).toBe('−R476 800');
  });
});
