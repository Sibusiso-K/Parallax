import { describe, expect, it } from 'vitest';
import { amountsIn, missingAmounts } from './amounts.js';

describe('reading rand amounts in a reply', () => {
  it('reads commas, spaces and plain digits', () => {
    expect(amountsIn('R33,000 and R120 000 and R1,500 and R7000.')).toEqual([33000, 120000, 1500, 7000]);
  });

  it('does not join an amount to the number after it', () => {
    expect(amountsIn('R120 000 in 2 months')).toEqual([120000]);
    expect(amountsIn('R120,000, 3 times')).toEqual([120000]);
  });

  it('ignores numbers that are not rand amounts', () => {
    expect(amountsIn('In month 4 we had 2 staff and 30%.')).toEqual([]);
  });
});

describe('checking a reply states the figures the question asked for', () => {
  it('reports the expected amounts a reply leaves out', () => {
    expect(missingAmounts('The lowest was R33,000 and it ended at R479 000.', [33000, 479000])).toEqual([]);
    expect(missingAmounts('The lowest was R33,000.', [33000, 479000])).toEqual([479000]);
  });

  it('allows a rand of rounding', () => {
    expect(missingAmounts('About R33 001.', [33000])).toEqual([]);
  });
});
