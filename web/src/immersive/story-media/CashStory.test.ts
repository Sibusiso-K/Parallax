import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { createSession } from '../session';
import { CashStory } from './CashStory';

describe('CashStory', () => {
  it('shows actual baseline and stressed snapshot values and the shortfall qualification', () => {
    const snapshot = createSession('graph-test').snapshotFor('B', true);
    const html = renderToStaticMarkup(createElement(CashStory, { snapshot, selectedMonth: 4, onSelectMonth: vi.fn() }));
    const money = (n: number) => new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(n);
    expect(html).toContain(money(snapshot.baseline.rows[3]!.cash));
    expect(html).toContain(money(snapshot.active.rows[3]!.cash));
    expect(html).toContain('First shortfall: month');
    expect(html).toContain('funding and survival are not modelled');
    expect(html).toContain('Show monthly values');
  });
  it('refuses an out-of-range month', () => {
    const snapshot = createSession('graph-test').snapshotFor('B', false);
    const html = renderToStaticMarkup(createElement(CashStory, { snapshot, selectedMonth: 0, onSelectMonth: vi.fn() }));
    expect(html).toContain('role="alert"');
    expect(html).not.toContain('<svg');
  });
});
