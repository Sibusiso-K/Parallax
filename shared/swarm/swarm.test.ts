import { describe, expect, it, vi } from 'vitest';
import { checkedSources, runSwarm } from './run.js';
import { delayPath, findBreakpoint, proposalCandidates } from './engine-tools.js';
import { simulate } from '../engine/simulate.js';
import { swarmRequest, type SwarmEvent } from './contracts.js';
import { POST } from '../../api/swarm.js';
import { guardPaidRoute, SWARM_LIMIT } from './paid-guard.js';
import { resetGuard } from '../http/guard.js';
import { readRates } from './rates.js';

const req = swarmRequest.parse({ event: 'What if the client pays late?', month: 2, stressed: true,
  path: { id: 'B', letter: 'B', name: 'Take the contract', startingCash: 150,
    assumptions: [{ id: 'B1', label: 'Contract', kind: 'income', role: 'contract', low: 80, base: 100, high: 120 },
      { id: 'B2', label: 'Costs', kind: 'cost', low: 50, base: 60, high: 70 }] } });
const cfg = { apiKey: 'stub-only', baseUrl: 'https://provider.invalid/v1', models: ['ignored'] };
const response = (content: unknown, tool_calls?: unknown[]) => Response.json({ choices: [{ message: { content: JSON.stringify(content), ...(tool_calls ? { tool_calls } : {}) } }], usage: { prompt_tokens: 100, completion_tokens: 40 } });

describe('swarm engine boundaries', () => {
  it('binary search agrees with exhaustive engine checks, including baseline failure and no contract', () => {
    const p = req.path;
    const expected = Array.from({ length: 37 }, (_, i) => i).filter(i => simulate(delayPath(p, i)).likely.shortfallMonths.length === 0).at(-1);
    expect(findBreakpoint(p).longestDelayMonths).toBe(expected);
    expect(findBreakpoint({ ...p, startingCash: -1000 }).baselineAlreadyShort).toBe(true);
    expect(findBreakpoint({ ...p, assumptions: [] }).applicable).toBe(false);
  });
  it('proposals retain uncertainty bounds, have computed impacts, and never mutate input', () => {
    const before = JSON.stringify(req), candidates = proposalCandidates(req);
    expect(candidates.length).toBe(2);
    expect(candidates.every(p => p.delta === p.afterLowest - p.beforeLowest)).toBe(true);
    expect(candidates.find(p => p.assumptionId === 'B1')?.values).toEqual({ low: 80, base: 120, high: 120 });
    expect(JSON.stringify(req)).toBe(before);
  });
  it('retains a shorter engine horizon and rejects a selected month outside it', async () => {
    const short = swarmRequest.parse({ ...req, path: { ...req.path, months: 6 } });
    expect(short.path.months).toBe(6);
    expect(swarmRequest.safeParse({ ...short, month: 7 }).success).toBe(false);
    const result = await runSwarm(short, () => {}, { config: null });
    expect(result.verification.every(v => v.pass)).toBe(true);
  });
  it('fixture emits all specialists and verified speech with no network and repeats identically', async () => {
    const events: SwarmEvent[] = [];
    const a = await runSwarm(req, e => events.push(e), { config: null });
    expect(a).toEqual(await runSwarm(req, () => {}, { config: null }));
    expect(a.mode).toBe('fixture'); expect(a.costUsd).toBe(0);
    expect(a.traces).toHaveLength(8); expect(a.sources).toEqual([]);
    expect(a.speech.some(s => s.kind === 'figure')).toBe(true);
    expect(a.verification.every(v => v.pass)).toBe(true);
    expect(events[0]?.type).toBe('start'); expect(events.at(-1)?.type).toBe('result');
  });
  it('requires both a search-result URL and an exact snippet; rejects unsafe URLs and fabricated quotes', () => {
    const raw = { output: [{ type: 'web_search_call', results: [{ url: 'https://www.resbank.co.za/example', snippet: 'An exact supplied sentence.' }] },
      { type: 'message', content: [{ text: JSON.stringify({ sources: [
        { url: 'https://www.resbank.co.za/example', quote: 'An exact supplied sentence.' },
        { url: 'https://www.resbank.co.za/example', quote: 'Made up rate' },
        { url: 'https://evil.invalid', quote: 'An exact supplied sentence.' },
      ] }) }] }] };
    expect(checkedSources(raw)).toHaveLength(1);
    expect(checkedSources({ output: [raw.output[1]] })).toEqual([]);
  });
});

describe('bounded live review with stubbed fetch', () => {
  it('runs the fixed tool roster, guards invented money and keeps unknown cost unknown', async () => {
    let calls = 0, toolCalls = 0;
    const events: SwarmEvent[] = [];
    const fake: typeof fetch = async (_url, init) => {
      calls++;
      const body = JSON.parse(String(init?.body));
      if (body.model === 'muse-wonder-1.0') return response({ agents: ['cash', 'devil', 'world', 'director'] });
      const system = body.messages[0].content as string;
      if (system.includes('Cash Forensics') && !body.messages.some((m: { role: string }) => m.role === 'tool')) {
        toolCalls++; return response({}, [{ id: 'tool-a', type: 'function', function: { name: 'find_breakpoint', arguments: '{}' } }]);
      }
      if (system.includes('World Builder')) return response({ mood: 'night' });
      if (system.includes('Director')) return response({ shots: ['Wide room', 'Future self'] });
      return response({ reply: 'I would have R999999. My lowest projected cash would be {{fig:B.room.active.lowest}}.', proposalIds: ['bound:B2', 'invented'] });
    };
    const result = await runSwarm(req, e => events.push(e), { config: cfg, fetch: fake });
    expect(calls).toBeLessThanOrEqual(9); expect(toolCalls).toBe(1);
    expect(JSON.stringify(result.speech)).not.toContain('999999');
    expect(result.verification.some(v => !v.pass)).toBe(true);
    expect(result.proposals.map(p => p.id)).toEqual(['bound:B2']);
    expect(result.traces.find(t => t.agent === 'cash')?.tools[0]?.name).toBe('find_breakpoint');
    expect(result.worldOps[0]?.value).toBe('night'); expect(result.costUsd).toBeNull();
    expect(events.filter(e => e.type === 'trace').length).toBeGreaterThan(10);
  });
  it('provider errors are partial results, never disguised as a live fixture', async () => {
    const result = await runSwarm(req, () => {}, { config: cfg, fetch: async () => new Response('', { status: 503 }) });
    expect(result.mode).toBe('partial'); expect(result.speech).toEqual([]);
    expect(result.traces.filter(t => t.status === 'failed').length).toBeGreaterThan(0);
  });
  it('refuses malformed inputs and streams an offline run', async () => {
    vi.stubEnv('META_MODEL_ENABLED', 'false');
    const bad = await POST(new Request('http://localhost/api/swarm', { method: 'POST', body: '{}' }));
    expect(bad.status).toBe(400);
    const res = await POST(new Request('http://localhost/api/swarm', { method: 'POST', body: JSON.stringify(req) }));
    expect(res.headers.get('content-type')).toContain('ndjson');
    const reader = res.body!.getReader();
    const first = await reader.read(); expect(new TextDecoder().decode(first.value)).toContain('"type":"start"');
    await reader.cancel();
    vi.unstubAllEnvs();
  });
  it('enforces request size, origin, ordered values and unique assumption IDs before streaming', async () => {
    vi.stubEnv('META_MODEL_ENABLED', 'false');
    const send = (body: unknown, headers?: Record<string, string>) => POST(new Request('http://localhost/api/swarm', { method: 'POST', headers, body: JSON.stringify(body) }));
    expect((await send(req, { origin: 'https://unrelated.invalid' })).status).toBe(403);
    expect((await send(req, { 'content-length': '70000' })).status).toBe(413);
    expect((await send({ ...req, path: { ...req.path, assumptions: [req.path.assumptions[0], req.path.assumptions[0]] } })).status).toBe(400);
    expect((await send({ ...req, path: { ...req.path, assumptions: [{ ...req.path.assumptions[0], low: 999 }] } })).status).toBe(400);
    vi.unstubAllEnvs();
  });
  it('charges one quota hit per swarm and never invents rate configuration', () => {
    resetGuard();
    const request = new Request('http://localhost/api/swarm', { headers: { 'x-forwarded-for': 'test-swarm-visitor' } });
    for (let i = 0; i < SWARM_LIMIT; i++) expect(guardPaidRoute(request, 'swarm', 1000)).toBeNull();
    expect(guardPaidRoute(request, 'swarm', 1000)?.status).toBe(429);
    expect(guardPaidRoute(request, 'swarm', 601001)).toBeNull();
    expect(readRates(undefined)).toBeUndefined(); expect(readRates('{bad')).toBeUndefined();
    expect(readRates('{"model":{"input":-1,"output":1}}')).toBeUndefined();
    expect(readRates('{"model":{"input":1,"output":2}}')).toEqual({ model: { input: 1, output: 2 } });
  });
  it('refuses a tool loop exceeding its budget without mutating assumptions', async () => {
    let tools = 0;
    const before = JSON.stringify(req);
    const fake: typeof fetch = async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      if (body.model === 'muse-wonder-1.0') return response({ agents: ['cash', 'devil'] });
      if (body.messages[0].content.includes('Cash Forensics')) {
        tools++;
        return response({}, Array.from({ length: 4 }, (_, i) => ({ id: `call-${tools}-${i}`, type: 'function', function: { name: 'inspect_month', arguments: '{}' } })));
      }
      return response({ reply: 'My lowest cash would be {{fig:B.room.active.lowest}}.' });
    };
    const result = await runSwarm(req, () => {}, { config: cfg, fetch: fake });
    expect(result.traces.find(t => t.agent === 'cash')?.status).toBe('failed');
    expect(result.traces.find(t => t.agent === 'cash')?.tools).toHaveLength(4);
    expect(tools).toBe(2); expect(JSON.stringify(req)).toBe(before);
  });
});
