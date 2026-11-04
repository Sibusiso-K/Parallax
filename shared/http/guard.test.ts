import { afterEach, describe, expect, it } from 'vitest';
import { LIMITS, WINDOW_MS, clientKey, guardPaidRoute, isCrossSite, resetGuard } from './guard.js';

const req = (headers: Record<string, string> = {}) => new Request('http://localhost/api/chat', { method: 'POST', headers, body: '{}' });
const fromApp = (ip = '203.0.113.7') => req({ host: 'parallax.example', origin: 'https://parallax.example', 'x-forwarded-for': `${ip}, 10.0.0.1` });

afterEach(() => resetGuard());

describe('isCrossSite', () => {
  it('lets the app itself through, and calls with no Origin', () => {
    expect(isCrossSite(fromApp())).toBe(false);
    expect(isCrossSite(req())).toBe(false);
    expect(isCrossSite(req({ 'x-forwarded-host': 'Parallax.Example', origin: 'https://parallax.example' }))).toBe(false);
  });

  it('refuses another site, the "null" origin and a cross-site fetch with no Origin', () => {
    expect(isCrossSite(req({ host: 'parallax.example', origin: 'https://evil.example' }))).toBe(true);
    expect(isCrossSite(req({ host: 'parallax.example', origin: 'null' }))).toBe(true);
    expect(isCrossSite(req({ host: 'parallax.example', 'sec-fetch-site': 'cross-site' }))).toBe(true);
  });

  it('prefers the forwarded host over the internal one', () => {
    expect(isCrossSite(req({ host: 'internal.vercel', 'x-forwarded-host': 'parallax.example', origin: 'https://parallax.example' }))).toBe(false);
  });
});

describe('clientKey', () => {
  it('takes the first forwarded address, then x-real-ip, else none', () => {
    expect(clientKey(fromApp('198.51.100.2'))).toBe('198.51.100.2');
    expect(clientKey(req({ 'x-real-ip': '198.51.100.3' }))).toBe('198.51.100.3');
    expect(clientKey(req())).toBeNull();
  });
});

describe('guardPaidRoute', () => {
  it('answers 403 with a plain message for another site', async () => {
    const res = guardPaidRoute(req({ host: 'parallax.example', origin: 'https://evil.example' }), 'chat');
    expect(res?.status).toBe(403);
    expect(await res?.json()).toEqual({ ok: false, error: expect.stringMatching(/Parallax app/) });
  });

  it('allows the limit, then answers 429 with Retry-After, until the window passes', async () => {
    const t0 = 1_000_000;
    for (let i = 0; i < LIMITS.scene; i++) expect(guardPaidRoute(fromApp(), 'scene', t0 + i)).toBeNull();
    const refused = guardPaidRoute(fromApp(), 'scene', t0 + 60_000);
    expect(refused?.status).toBe(429);
    expect(Number(refused?.headers.get('retry-after'))).toBe((WINDOW_MS - 60_000) / 1000);
    expect((await refused!.json()).error).toMatch(/wait/);
    expect(guardPaidRoute(fromApp(), 'scene', t0 + WINDOW_MS)).toBeNull();
  });

  it('counts each route and each visitor on its own', () => {
    for (let i = 0; i < LIMITS.scene; i++) guardPaidRoute(fromApp(), 'scene', 0);
    expect(guardPaidRoute(fromApp(), 'scene', 1)?.status).toBe(429);
    expect(guardPaidRoute(fromApp(), 'chat', 1)).toBeNull();
    expect(guardPaidRoute(fromApp('198.51.100.9'), 'scene', 1)).toBeNull();
  });

  it('never limits a call with no visitor address (local dev and tests)', () => {
    for (let i = 0; i < LIMITS.scene * 3; i++) expect(guardPaidRoute(req(), 'scene')).toBeNull();
  });
});
