import { describe, expect, it } from 'vitest';
import { buildDecisionGraph } from './decision-graph.js';
const path = { id: 'B', startingCash: 100, months: 3, assumptions: [
  { id: 'cost', label: 'Costs', kind: 'cost' as const, low: 10, base: 10, high: 10 },
  { id: 'sales', label: 'Sales', kind: 'income' as const, low: 20, base: 20, high: 20 },
] };
describe('decision graph', () => {
  it('is invariant to assumption ordering and computes signed finite differences', () => {
    const a = buildDecisionGraph(path), b = buildDecisionGraph({ ...path, assumptions: [...path.assumptions].reverse() });
    expect(a.fingerprint).toBe(b.fingerprint);
    expect(a.edges.find(e => e.from === 'assumption:cost' && e.to === 'figure:cash:3')?.weight).toBe(-3);
    expect(a.nodes.find(n => n.id === 'claim:cash:3')?.value).toBe(130);
  });
  it('budgets a sorted slice including edges and reports estimates honestly', () => {
    const g = buildDecisionGraph(path), c = g.contextFor('cash', 'month:2', 300);
    expect(c.estimatedTokens).toBeLessThanOrEqual(300);
    expect(c).toEqual(g.contextFor('cash', 'month:2', 300));
    expect(c.estimatedTokensSaved).toBe(c.fullEstimatedTokens - c.estimatedTokens);
    expect(c.edges.every(e => c.nodes.some(n => n.id === e.from) && c.nodes.some(n => n.id === e.to))).toBe(true);
    expect(() => g.contextFor('cash', 'month:2', 0)).toThrow('Context budget');
  });
});
