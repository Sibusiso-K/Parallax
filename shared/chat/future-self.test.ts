import { describe, expect, it } from 'vitest';
import { figureTable } from '../engine/analysis.js';
import type { Deps, MetaConfig } from '../providers/meta.js';
import { answerAsFutureSelf, buildPrompt, chatRequest } from './future-self.js';

// The future self answers this founder's question about this path, but the engine owns every number: placeholders
// become the engine's values, and any amount the model typed itself is scrubbed. Offline: the model is a stub.

const cfg: MetaConfig = { apiKey: 'test-key-not-real', baseUrl: 'https://api.meta.ai/v1', models: ['muse-spark-1.3'] };
const path = {
  id: 'p-b',
  letter: 'B' as const,
  name: 'Take it as offered',
  summary: 'Supply the hotel for a year, paid 45 days after invoice.',
  startingCash: 60000,
  assumptions: [
    { id: 'B1', label: 'Current sales', kind: 'income' as const, low: 85000, base: 95000, high: 105000, role: 'sales' as const },
    { id: 'B2', label: 'Hotel contract', kind: 'income' as const, low: 40000, base: 40000, high: 40000, role: 'contract' as const, fromMonth: 3 },
    { id: 'B3', label: 'Flour, butter and packaging', kind: 'cost' as const, low: 30000, base: 30000, high: 34000, role: 'direct' as const },
  ],
};
const request = (message: string, extra: object = {}) =>
  chatRequest.parse({
    path,
    context: { business: 'Bakery', location: 'Durban', decision: 'Supply a hotel group for a year', story: 'We sell about R95 000 a month.' },
    message,
    ...extra,
  });

function modelSays(reply: object) {
  const sent: { body: { messages: { role: string; content: string }[] } }[] = [];
  const deps: Deps = {
    fetch: async (_url, init) => {
      sent.push({ body: JSON.parse(String(init.body)) });
      return Response.json({ choices: [{ message: { content: JSON.stringify(reply) } }] });
    },
    sleep: async () => {},
    now: () => 0,
    random: () => 0,
  };
  return { deps, sent };
}

describe('buildPrompt', () => {
  it("speaks as this founder's future self, in their business, with their own words", () => {
    const req = request('How did the late payments feel?');
    const { system, user } = buildPrompt(req, figureTable(path));
    expect(system).toContain('founder of Bakery in Durban');
    expect(system).toContain('Supply a hotel group for a year');
    expect(system).toContain('We sell about R95 000 a month.');
    expect(system).toContain('path B: "Take it as offered"');
    expect(user).toContain('How did the late payments feel?');
  });

  it('offers only figure keys that exist on this path, and lists its assumptions by id', () => {
    const table = figureTable(path);
    const { system } = buildPrompt(request('Hi'), table);
    const offered = [...system.matchAll(/\{\{fig:([^}]+)\}\}:/g)].map((m) => m[1]!);
    expect(offered.length).toBeGreaterThan(8);
    for (const key of offered) expect(table).toHaveProperty([key]);
    expect(system).toContain('B3: Flour, butter and packaging (money out)');
  });

  it('carries the last turns of the conversation', () => {
    const req = request('And then?', { history: [{ role: 'user', text: 'Was month one hard?' }, { role: 'self', text: 'It was tight.' }] });
    expect(buildPrompt(req, figureTable(path)).user).toMatch(/Younger you: Was month one hard\?\nYou: It was tight\./);
  });
});

describe('answerAsFutureSelf', () => {
  it("swaps placeholders for the engine's values and scrubs amounts the model typed", async () => {
    const table = figureTable(path);
    const { deps } = modelSays({ reply: 'At month 36 we had {{fig:p-b.cash.m36.likely}} [B2]. I once told people we cleared R999 999.', cites: ['B2'] });
    const a = await answerAsFutureSelf(cfg, request('Where did we end up?'), deps);
    expect(a.text).toContain(`R${Math.round(table['p-b.cash.m36.likely']!).toLocaleString('en-US')}`.replace('R-', '-R'));
    expect(a.text).not.toContain('999');
    expect(a.clean).toBe(false);
    expect(a.checks.map((c) => c.type)).toContain('scrubbed');
    expect(a.citations).toEqual([{ id: 'B2', label: 'B2: hotel contract' }]);
  });

  it("refuses another path's figures and drops assumption ids this path does not have", async () => {
    const { deps } = modelSays({ reply: 'Path A ended at {{fig:p-a.cash.m36.likely}} [A1] [B1].', cites: ['A1', 'B1'] });
    const a = await answerAsFutureSelf(cfg, request('Compare us with A'), deps);
    expect(a.text).toContain('(see chart)');
    expect(a.text).not.toContain('[A1]');
    expect(a.citations.map((c) => c.id)).toEqual(['B1']);
  });

  it('lets the founder hear back a number they typed themselves', async () => {
    const { deps } = modelSays({ reply: 'You asked about R50 000 a month; I cannot put a number on that here.', cites: [] });
    const a = await answerAsFutureSelf(cfg, request('What if sales fell to R50 000?'), deps);
    expect(a.text).toContain('R50 000');
  });
});
