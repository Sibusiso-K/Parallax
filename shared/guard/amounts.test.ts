import { describe, expect, it } from 'vitest';
import { amountsIn } from './amounts.js';

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
