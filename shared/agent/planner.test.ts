import { describe, expect, it } from 'vitest';
import { planRequest, planWithModel, rank, runPlan, searchInCode, type PlanRequest } from './planner.js';
import { DEMO_EXTRACTION } from '../intake/fixture.js';
import { templatePaths } from '../paths/templates.js';
import { buildProfile } from '../profile/profile.js';
import type { Deps, MetaConfig } from '../providers/meta.js';

const founder = buildProfile({ ...DEMO_EXTRACTION, payroll: { low: 21000, high: 21000, quote: '21k' } });
const paths = templatePaths(founder);
const req: PlanRequest = planRequest.parse({ kind: 'plan', floor: 20000, withLatePayment: true, monthlySales: 90000, paths });
const cfg = { apiKey: 'k', baseUrl: 'https://model.example/v1', models: ['muse-spark-1.3'] } as unknown as MetaConfig;

/** Scripted model replies, one per call, and a record of what was sent. */
function scripted(replies: unknown[]) {
  const sent: Record<string, unknown>[] = [];
  const deps: Deps = {
    fetch: async (_url, init) => {
      sent.push(JSON.parse(String(init.body)) as Record<string, unknown>);
      const message = replies[Math.min(sent.length - 1, replies.length - 1)];
      return new Response(JSON.stringify({ model: 'muse-spark-1.3', choices: [{ message }] }), { status: 200, headers: { 'content-type': 'application/json' } });
    },
    sleep: async () => {},
    now: () => 0,
    random: () => 0,
  };
  return { deps, sent };
}
const call = (id: string, name: string, args: unknown) => ({ id, type: 'function', function: { name, arguments: JSON.stringify(args) } });

describe('the planner tools (the engine)', () => {
  it('judges a plan by the engine: path B as offered runs out with a late payment, so it misses the goal', () => {
    const b = runPlan(req, { path: 'B', contractPercent: 100, pricePercent: 0 });
    expect(b.runsOutMonth).toBe(4);
    expect(b.meetsGoal).toBe(false);
  });

  it('keeps settings on the sliders', () => {
    const r = runPlan(req, { path: 'C', contractPercent: 60, pricePercent: 7 });
    expect([r.contractPercent, r.pricePercent]).toEqual([50, 5]);
  });

  it('ranks plans that meet the goal first, then by lowest cash', () => {
    const list = rank([runPlan(req, { path: 'B', contractPercent: 100, pricePercent: 0 }), runPlan(req, { path: 'A', contractPercent: 100, pricePercent: 0 })]);
    expect(list[0]!.path).toBe('A');
  });

  it('searches in code with no model, and every plan it lists really meets the goal', () => {
    const out = searchInCode(req);
    expect(out.found.length).toBeGreaterThan(0);
    for (const f of out.found) expect(runPlan(req, f).meetsGoal).toBe(true);
  });
});

describe('the planner agent loop', () => {
  it('calls tools, feeds the engine results back, and reruns every plan it names', async () => {
    const { deps, sent } = scripted([
      { content: null, tool_calls: [call('1', 'compare_all', { contractPercent: 100, pricePercent: 0 })] },
      { content: null, tool_calls: [call('2', 'try_plan', { path: 'C', contractPercent: 100, pricePercent: 5 })] },
      { content: JSON.stringify({ plans: [{ path: 'C', contractPercent: 100, pricePercent: 5 }, { path: 'B', contractPercent: 100, pricePercent: 0 }], note: 'Safer terms with a small price rise hold up.' }) },
    ]);
    const out = await planWithModel(cfg, req, deps);
    expect(out.mode).toBe('model');
    expect(out.steps.map((s) => s.tool)).toEqual(['compare_all', 'try_plan']);
    // B as offered misses the goal, so code drops it even though the model named it.
    expect(out.found.map((f) => f.path)).toEqual(['C']);
    expect(out.note).toBe('Safer terms with a small price rise hold up.');
    // The engine's result went back to the model as a tool message.
    const toolMsg = (sent[1]!.messages as { role: string; content: string }[]).find((m) => m.role === 'tool');
    expect(JSON.parse(toolMsg!.content).results).toHaveLength(3);
    expect(sent[0]!.tools).toBeDefined();
  });

  it('drops a note with a number in it, and never trusts the model for figures', async () => {
    const { deps } = scripted([{ content: JSON.stringify({ plans: [{ path: 'A', contractPercent: 100, pricePercent: 0 }], note: 'A keeps R99,999 at its lowest.' }) }]);
    const out = await planWithModel(cfg, req, deps);
    expect(out.note).toBe('');
    expect(out.found[0]!.lowestCash).toBe(runPlan(req, { path: 'A', contractPercent: 100, pricePercent: 0 }).lowestCash);
  });

  it('stops after a bounded number of tool rounds', async () => {
    const { deps, sent } = scripted([{ content: null, tool_calls: [call('x', 'try_plan', { path: 'A', contractPercent: 100, pricePercent: 0 })] }]);
    await planWithModel(cfg, req, deps);
    expect(sent.length).toBeLessThanOrEqual(6);
  });
});
