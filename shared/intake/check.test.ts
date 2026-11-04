import { describe, expect, it } from 'vitest';
import { checkIntake, checkRequest, keepNotes, numbersIn } from './check.js';
import type { Deps, MetaConfig } from '../providers/meta.js';

const story = 'We sell about R90k a month, anywhere from 75k to 105k. Later: honestly we only clear 60,000 most months. Cash is R120 000.';
const req = checkRequest.parse({
  check: true,
  text: story,
  fields: [
    { key: 'revenue', label: 'Sales a month', value: 'R75 000 – R105 000', quote: 'about R90k a month, anywhere from 75k to 105k' },
    { key: 'cash', label: 'Cash in the business', value: 'R120 000', quote: 'Cash is R120 000' },
  ],
});

describe('the intake self-check', () => {
  it('reads numbers as written, with spaces or commas', () => {
    expect(numbersIn('R90 000 and 60,000 and 3 months')).toEqual([90000, 60000, 3]);
  });

  it('keeps a note that names a field on screen and uses only the founder\'s numbers', () => {
    const out = keepNotes(req, [{ field: 'revenue', message: 'You said R90k a month, and later 60,000. Which is usual?' }]);
    expect(out.notes).toHaveLength(1);
    expect(out.notes[0]!.label).toBe('Sales a month');
    expect(out.dropped).toBe(0);
  });

  it('drops a note with a number the founder never wrote, or an unknown field', () => {
    const out = keepNotes(req, [
      { field: 'revenue', message: 'Sales may really be R250 000.' },
      { field: 'nonsense', message: 'Check this.' },
      { field: 'cash', message: 'Is the R120 000 in the bank or owed to you, over 3 months?' },
    ]);
    expect(out.notes.map((n) => n.field)).toEqual(['cash']);
    expect(out.dropped).toBe(2);
  });

  it('runs one model call and returns only the kept notes', async () => {
    const deps: Deps = {
      fetch: async () =>
        new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ issues: [{ field: 'revenue', message: 'You also said 60,000. Which is usual?' }, { field: 'cash', message: 'Is it R999 999?' }] }) } }] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      sleep: async () => {},
      now: () => 0,
      random: () => 0,
    };
    const cfg = { apiKey: 'k', baseUrl: 'https://model.example/v1', models: ['muse-spark-1.3'] } as unknown as MetaConfig;
    const out = await checkIntake(cfg, req, deps);
    expect(out.notes.map((n) => n.field)).toEqual(['revenue']);
    expect(out.dropped).toBe(1);
  });
});
