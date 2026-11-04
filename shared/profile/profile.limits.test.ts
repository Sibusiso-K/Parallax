import { describe, expect, it } from 'vitest';
import type { Extraction } from '../intake/schema.js';
import { simulate } from '../engine/simulate.js';
import { templatePaths } from '../paths/templates.js';
import { buildProfile } from './profile.js';

// The founder's "usual" figure must sit inside the range they gave. Rounding the midpoint to R50 once pushed it below
// the bottom of a narrow range (R2 010 to R2 020 became R2 000), and the engine then refused the whole path.
describe('buildProfile keeps the usual figure inside the range the founder gave', () => {
  it('for a narrow range of small amounts', () => {
    const ex: Extraction = { revenue: { low: 2010, high: 2020, quote: 'R2010 to R2020' } };
    const { base } = buildProfile(ex).money.revenue;
    expect(base).toBeGreaterThanOrEqual(2010);
    expect(base).toBeLessThanOrEqual(2020);
  });

  it('so the paths built from it still simulate', () => {
    const ex: Extraction = {
      decisionType: { value: 'contract', quote: 'a contract' },
      revenue: { low: 2010, high: 2020, quote: 'R2010 to R2020' },
      directCosts: { low: 1, high: 3, quote: 'R1 to R3' },
      cash: { low: 1005, high: 1015, quote: 'R1005 to R1015' },
    };
    for (const path of templatePaths(buildProfile(ex))) expect(() => simulate(path)).not.toThrow();
  });
});
