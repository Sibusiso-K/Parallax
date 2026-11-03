import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_TEXT } from '../shared/intake/fixture.js';
import { transcribeResponseSchema } from '../shared/voice/contract.js';
import { MAX_UPLOAD_BYTES, MAX_WAV_BYTES, SAMPLE_RATE, encodeWav } from '../shared/voice/wav.js';
import * as transcribeRoute from './transcribe.js';
import { POST } from './transcribe.js';

// The WAV path, including the shapes checkWav refuses and the ways the speech API can fail. No live call: every
// upstream answer is a stub, and the offline setup blocks anything else.
const KEY = 'test-key-not-real';
const VARS = ['META_VOICE_ENABLED', 'META_API_KEY', 'META_API_BASE_URL', 'META_ASR_MODEL'] as const;
beforeEach(() => VARS.forEach((k) => delete process.env[k]));
afterEach(() => {
  VARS.forEach((k) => delete process.env[k]);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const silence = (seconds: number, rate = SAMPLE_RATE) => encodeWav(new Int16Array(Math.round(rate * seconds)), rate);
const post = (body: Uint8Array | string) => POST(new Request('http://localhost/api/transcribe', { method: 'POST', body: body as BodyInit }));
const voiceOn = () => {
  process.env.META_VOICE_ENABLED = 'true';
  process.env.META_API_KEY = KEY;
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const damaged = (seconds: number, field: (view: DataView) => void, rate = SAMPLE_RATE) => {
  const bytes = silence(seconds, rate);
  field(new DataView(bytes.buffer));
  return bytes;
};

describe('POST /api/transcribe, the WAV the browser sends', () => {
  it('accepts a valid 16 kHz mono WAV and a valid 24 kHz mono WAV', async () => {
    for (const body of [silence(1), silence(1, 24_000), silence(60), silence(60, 24_000)]) {
      const res = await post(body);
      expect(res.status, `${body.length} bytes`).toBe(200);
      const data = await res.json();
      expect(data).toMatchObject({ ok: true, mode: 'fixture', transcript: DEMO_TEXT });
      expect(transcribeResponseSchema.safeParse(data).success).toBe(true);
    }
  });

  it('refuses a stereo, 8-bit or 44.1 kHz recording with a plain reason', async () => {
    const stereo = damaged(1, (v) => v.setUint16(22, 2, true));
    const eightBit = damaged(1, (v) => v.setUint16(34, 8, true));
    const rate44 = damaged(1, (v) => v.setUint32(24, 44_100, true));
    const cases: [Uint8Array, RegExp][] = [
      [stereo, /mono, 16-bit/],
      [eightBit, /mono, 16-bit/],
      [rate44, /16 kHz/],
    ];
    for (const [body, message] of cases) {
      const res = await post(body);
      const data = await res.json();
      expect(res.status).toBe(400);
      expect(data.ok).toBe(false);
      expect(data.error).toMatch(message);
      expect(transcribeResponseSchema.safeParse(data).success).toBe(true);
    }
  });

  it('tells a founder their empty, cut-short or non-WAV file cannot be read', async () => {
    const cases: [Uint8Array | string, RegExp][] = [
      [new Uint8Array(0), /not a WAV/],
      ['', /not a WAV/],
      ['hello there', /not a WAV/],
      [silence(1).slice(0, 1000), /cut short|damaged/],
      [silence(1).slice(0, 30), /not a WAV/],
    ];
    for (const [body, message] of cases) {
      const res = await post(body);
      const data = await res.json();
      expect(res.status).toBe(400);
      expect(data.error).toMatch(message);
    }
  });

  it('answers 413 for a file one sample over 60 seconds, at either rate', async () => {
    expect(silence(60, SAMPLE_RATE).length).toBe(MAX_WAV_BYTES);
    expect((await post(encodeWav(new Int16Array(SAMPLE_RATE * 60 + 1)))).status).toBe(413);
    expect((await post(encodeWav(new Int16Array(24_000 * 60 + 1), 24_000))).status).toBe(413);
    expect((await post(new Uint8Array(MAX_UPLOAD_BYTES + 1))).status).toBe(413);
  });

  it('marks every answer no-store and exports only POST', async () => {
    const ok = await post(silence(1));
    const bad = await post('hello');
    expect(ok.headers.get('cache-control')).toBe('no-store');
    expect(bad.headers.get('cache-control')).toBe('no-store');
    expect(Object.keys(transcribeRoute)).toEqual(['POST']);
  });
});

describe('POST /api/transcribe, upstream failures', () => {
  it('answers 502 in plain English when the speech API returns a 500', async () => {
    voiceOn();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('fetch', async () => reply({}, 500));
    const res = await post(silence(1));
    const data = await res.json();
    expect(res.status).toBe(502);
    expect(data).toMatchObject({ ok: false, error: "We couldn't turn that into text. Please try again, or type instead." });
    expect(transcribeResponseSchema.safeParse(data).success).toBe(true);
    expect(String(warn.mock.calls[0]![0])).not.toContain(KEY);
  });

  it('answers 502 when the speech API never replies, within its own timeout', async () => {
    voiceOn();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        }),
    );
    const pending = post(silence(1));
    await vi.advanceTimersByTimeAsync(25_000);
    const res = await pending;
    expect(res.status).toBe(502);
    expect(transcribeResponseSchema.safeParse(await res.json()).success).toBe(true);
  });

  it('answers 502 when the speech API replies without a transcript', async () => {
    voiceOn();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (const body of [{}, { transcript: 42 }, { audioDurationMs: 1000 }]) {
      vi.stubGlobal('fetch', async () => reply(body));
      const res = await post(silence(1));
      expect(res.status).toBe(502);
      expect(transcribeResponseSchema.safeParse(await res.json()).success).toBe(true);
    }
  });
});
