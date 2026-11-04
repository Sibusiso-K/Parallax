import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as intake } from './intake.js';
import { POST as chat } from './chat.js';
import { POST as whatif } from './whatif.js';
import { POST as check } from './intake.js';
import { POST as scene } from './scene.js';
import { resetGuard } from '../shared/http/guard.js';
import { DEMO_EXTRACTION } from '../shared/intake/fixture.js';
import { templatePaths } from '../shared/paths/templates.js';
import { buildProfile } from '../shared/profile/profile.js';

// Route-level integration: each route that can use Meta's models, driven through its real handler with Meta's replies
// simulated. What must hold when Meta misbehaves: the route answers cleanly (no 500, no stack trace, JSON only), the API
// key never reaches the browser, a key or billing refusal is not retried or failed over (so a bad key cannot keep
// spending), and no model text is shown as an answer when the model failed.

const KEY = 'sk-test-KEY-9f8e7d6c5b4a';
const ORIGIN = 'https://parallax.example';
const paths = templatePaths(buildProfile({ ...DEMO_EXTRACTION, payroll: { low: 21000, high: 21000, quote: '21k' } }));
const p = paths[1]!;
const pathBody = { id: p.id, letter: p.letter, name: p.name, summary: p.summary, startingCash: p.startingCash, assumptions: p.assumptions };

type Reply = { status: number; body: string };
const SCENARIOS: Record<string, Reply> = {
  'invalid key (401)': { status: 401, body: JSON.stringify({ error: { message: `bad key ${KEY}` } }) },
  'billing refused (402)': { status: 402, body: JSON.stringify({ error: { message: 'payment required' } }) },
  'bad request (400)': { status: 400, body: JSON.stringify({ error: { message: 'bad request' } }) },
  'model not found (404)': { status: 404, body: JSON.stringify({ error: { message: 'model not found' } }) },
  'reply is not JSON': { status: 200, body: '<html>gateway said hello</html>' },
  'reply has no choices': { status: 200, body: JSON.stringify({ ok: true }) },
  'reply does not match the schema': {
    status: 200,
    body: JSON.stringify({ choices: [{ message: { content: JSON.stringify({ nonsense: true }) } }], model: 'muse-spark-1.3' }),
  },
};
const NO_RETRY = new Set(['invalid key (401)', 'billing refused (402)', 'bad request (400)']);

/** The routes, and what each must answer when Meta fails. Intake reads the story in code instead; the others say so. */
const ROUTES: { name: string; call: () => Promise<Response>; failure: (r: Response, body: any) => boolean }[] = [
  {
    name: 'intake (story reading)',
    call: () => intake(req('/api/intake', { text: 'We sell about R80k a month and rent is R12k. We have R60 000 in the bank.' })),
    failure: (r, b) => r.status === 200 && b.mode === 'fixture',
  },
  {
    name: 'intake self-check',
    call: () =>
      check(req('/api/intake', { check: true, text: 'We sell about R80k a month.', fields: [{ key: 'revenue', label: 'Sales a month', value: 'R80 000' }] })),
    failure: (r, b) => r.status === 502 && b.ok === false,
  },
  {
    name: 'future you (chat)',
    call: () => chat(req('/api/chat', { path: pathBody, context: {}, history: [], message: 'When was cash tightest?' })),
    failure: (r, b) => r.status === 502 && b.ok === false,
  },
  {
    name: 'board moderator',
    call: () =>
      chat(
        req('/api/chat', {
          kind: 'board',
          question: 'What would you warn me about?',
          replies: [
            { letter: 'A', name: 'Stay lean', text: 'Cash was tight in the slow months.' },
            { letter: 'B', name: 'Take it as offered', text: 'Late payment hurt.' },
          ],
        }),
      ),
    failure: (r, b) => r.status === 502 && b.ok === false,
  },
  {
    name: 'what-if reader',
    call: () => whatif(req('/api/whatif', { text: 'what if they pay late?' })),
    failure: (r, b) => r.status === 502 && b.ok === false,
  },
  {
    name: 'planning agent',
    call: () =>
      whatif(req('/api/whatif', { kind: 'plan', floor: 20000, withLatePayment: true, monthlySales: 90000, paths })),
    failure: (r, b) => r.status === 502 && b.ok === false,
  },
  {
    name: 'room dressing and portrait',
    call: () => scene(req('/api/scene', { context: { business: 'Catering', location: 'Johannesburg', decisionType: 'contract' } })),
    failure: (r, b) => r.status === 502 && b.ok === false,
  },
];

function req(path: string, body: unknown): Request {
  return new Request(`${ORIGIN}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: ORIGIN, host: 'parallax.example' },
    body: JSON.stringify(body),
  });
}

let calls: string[] = [];
function metaReplies(reply: Reply) {
  vi.stubGlobal('fetch', async (url: string) => {
    calls.push(String(url));
    return new Response(reply.body, { status: reply.status, headers: { 'content-type': 'application/json' } });
  });
}

beforeEach(() => {
  calls = [];
  process.env.META_MODEL_ENABLED = 'true';
  process.env.META_API_KEY = KEY;
  resetGuard();
});
afterEach(() => {
  delete process.env.META_MODEL_ENABLED;
  delete process.env.META_API_KEY;
  vi.unstubAllGlobals();
  resetGuard();
});

describe('a misbehaving Meta leaves every model route clean and safe', () => {
  for (const [scenario, reply] of Object.entries(SCENARIOS)) {
    for (const route of ROUTES) {
      it(`${route.name}: ${scenario}`, async () => {
        metaReplies(reply);
        const res = await route.call();
        const text = await res.text();
        // 1. Clean JSON, never a crash page or a stack trace.
        expect(res.headers.get('content-type') ?? '').toMatch(/json/);
        expect(text).not.toMatch(/\bat [\w.<>]+ \(|Error: |<html/i);
        const body = JSON.parse(text);
        // 2. The route's stated failure answer.
        expect(route.failure(res, body), `status ${res.status}: ${text.slice(0, 160)}`).toBe(true);
        // 3. The key never reaches the browser, and no raw bearer header is echoed.
        expect(text).not.toContain(KEY);
        expect(text).not.toMatch(/bearer/i);
        // 4. A key or billing refusal stops at once: no retry and no failover. The room makes two separate calls (the
        // scene and the portrait), each of which stops on its own, so it may make two; nothing else may make more than one.
        if (NO_RETRY.has(scenario)) expect(calls.length).toBe(route.name.startsWith('room') ? 2 : 1);
      });
    }
  }
});

describe('the failure answers say what happened without exposing the model', () => {
  it('chat reply after a failure is an error, never the model text', async () => {
    metaReplies({ status: 200, body: JSON.stringify({ choices: [{ message: { content: 'Here is my answer about R999 999.' } }] }) });
    const res = await chat(req('/api/chat', { path: pathBody, context: {}, history: [], message: 'Hi' }));
    const body = await res.json();
    // A reply that is not the JSON the route asked for fails over and then fails; its text is never returned as an answer.
    expect(body.text).toBeUndefined();
    expect(res.status).toBe(502);
  });
});
