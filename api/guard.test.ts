import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST as advisor } from './advisor.js';
import { POST as chat } from './chat.js';
import { POST as intake } from './intake.js';
import { POST as scene } from './scene.js';
import { POST as transcribe } from './transcribe.js';
import { LIMITS, resetGuard } from '../shared/http/guard.js';

// Offline: fetch is a spy, so these prove the guard answers before any model call is made.
const VARS = ['META_MODEL_ENABLED', 'META_VOICE_ENABLED', 'META_API_KEY'] as const;
const routes = { advisor, chat, intake, scene, transcribe };
const connect = () => {
  process.env.META_MODEL_ENABLED = 'true';
  process.env.META_VOICE_ENABLED = 'true';
  process.env.META_API_KEY = 'test-key-not-real';
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  return fetch;
};
const post = (name: string, headers: Record<string, string>) =>
  new Request(`http://localhost/api/${name}`, { method: 'POST', headers: { host: 'parallax.example', ...headers }, body: '{}' });

afterEach(() => {
  for (const k of VARS) delete process.env[k];
  vi.unstubAllGlobals();
  resetGuard();
});

describe('paid routes with a model connected', () => {
  for (const [name, handler] of Object.entries(routes)) {
    it(`/api/${name} refuses another site before calling Meta`, async () => {
      const fetch = connect();
      const res = await handler(post(name, { origin: 'https://evil.example' }));
      expect(res.status).toBe(403);
      expect(fetch).not.toHaveBeenCalled();
    });
  }

  it('/api/chat answers 429 once one visitor passes the limit, before calling Meta', async () => {
    const fetch = connect();
    const visitor = { origin: 'https://parallax.example', 'x-forwarded-for': '203.0.113.50' };
    // These bodies are invalid, so each allowed call stops at validation (400) without reaching Meta.
    for (let i = 0; i < LIMITS.chat; i++) expect((await chat(post('chat', visitor))).status).toBe(400);
    const res = await chat(post('chat', visitor));
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('paid routes in demo mode', () => {
  it('do not guard: no model means no spend', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const res = await advisor(post('advisor', { origin: 'https://evil.example' }));
    expect(await res.json()).toEqual({ ok: true, mode: 'fixture' });
  });
});
