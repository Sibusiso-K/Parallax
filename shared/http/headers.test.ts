import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// The security headers Vercel adds to every response (vercel.json). A test, so a later edit cannot drop one quietly.
interface VercelConfig {
  headers?: { source: string; headers: { key: string; value: string }[] }[];
}
const config = JSON.parse(readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8')) as VercelConfig;
const all = config.headers?.find((h) => h.source === '/(.*)')?.headers ?? [];
const header = (key: string) => all.find((h) => h.key.toLowerCase() === key.toLowerCase())?.value;

describe('security headers on every response', () => {
  it('stops browsers guessing file types and leaking full URLs to other sites', () => {
    expect(header('X-Content-Type-Options')).toBe('nosniff');
    expect(header('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
  });

  it('lets no other site frame the app', () => {
    expect(header('X-Frame-Options')).toBe('SAMEORIGIN');
    expect(header('Content-Security-Policy')).toContain("frame-ancestors 'self'");
  });

  it('keeps the microphone for the app itself, for voice input, and turns off what it never uses', () => {
    const policy = header('Permissions-Policy') ?? '';
    expect(policy).toContain('microphone=(self)');
    expect(policy).toContain('camera=()');
    expect(policy).toContain('geolocation=()');
  });

  it('sets no script or style policy yet: a strict one needs testing against the 3D room first', () => {
    expect(header('Content-Security-Policy')).not.toMatch(/script-src|default-src|style-src/);
  });
});
