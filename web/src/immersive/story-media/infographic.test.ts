import { describe, expect, it } from 'vitest';
import { createSession } from '../session';
import { createCashInfographic } from './infographic';

describe('engine-backed infographic', () => {
  it('contains exact snapshot figures and the qualification', () => {
    const s = createSession('image-test').snapshotFor('B', true);
    const svg = createCashInfographic(s, 4);
    const money = (n: number) => new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(n);
    expect(svg).toContain(money(s.active.rows[3]!.cash));
    expect(svg).toContain(money(s.baseline.rows[3]!.cash));
    expect(svg).toContain('First shortfall: month 4');
    expect(svg).not.toContain('<script');
  });
  it('rejects invalid months and escapes path text', () => {
    const s = createSession('image-test').snapshotFor('A', false);
    expect(() => createCashInfographic(s, 0)).toThrow(RangeError);
    expect(createCashInfographic({ ...s, pathName: '<script>bad</script>' }, 1)).not.toContain('<script>');
  });
});
