import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_TEXT } from '../shared/intake/fixture.js';
import { transcribeResponseSchema } from '../shared/voice/contract.js';
import { MAX_SECONDS, SAMPLE_RATE, encodeWav } from '../shared/voice/wav.js';
import { POST } from './transcribe.js';

// Offline: the model path only ever meets a fetch stub, and the blocked-network guard catches anything else.
const KEY = 'test-key-not-real';
const VARS = ['META_VOICE_ENABLED', 'META_API_KEY', 'META_API_BASE_URL', 'META_ASR_MODEL'] as const;
beforeEach(() => VARS.forEach((k) => delete process.env[k]));
afterEach(() => {
  VARS.forEach((k) => delete process.env[k]);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const wav = (seconds = 1) => encodeWav(new Int16Array(Math.round(SAMPLE_RATE * seconds)));
const post = (body: Uint8Array | string) => POST(new Request('http://localhost/api/transcribe', { method: 'POST', body: body as BodyInit }));
const voiceOn = () => {
  process.env.META_VOICE_ENABLED = 'true';
  process.env.META_API_KEY = KEY;
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe('POST /api/transcribe, demo mode', () => {
  it('returns the demo story, labelled, when voice is off', async () => {
    const res = await post(wav());
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data).toMatchObject({ ok: true, mode: 'fixture', transcript: DEMO_TEXT, notice: expect.any(String) });
    expect(transcribeResponseSchema.safeParse(data).success).toBe(true);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('stays in demo mode with a key but the voice switch off, and sends nothing', async () => {
    process.env.META_API_KEY = KEY;
    const stub = vi.fn();
    vi.stubGlobal('fetch', stub);
    expect((await (await post(wav())).json()).mode).toBe('fixture');
    expect(stub).not.toHaveBeenCalled();
  });

  it('answers 400 for anything that is not a good WAV, and 413 for one over 60 seconds of bytes', async () => {
    for (const bad of ['', 'hello', new Uint8Array(500)]) expect((await post(bad)).status).toBe(400);
    expect((await post(wav(MAX_SECONDS + 1))).status).toBe(413);
  });
});

describe('POST /api/transcribe, voice on', () => {
  it('sends the audio to Meta as multipart with the key only in the header, and returns the transcript', async () => {
    voiceOn();
    const seen: { url: string; auth?: string; parts: string[]; model?: string }[] = [];
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      const form = init.body as FormData;
      const request = JSON.parse(await (form.get('request') as Blob).text());
      seen.push({ url, auth: (init.headers as Record<string, string>).authorization, parts: [...form.keys()], model: request.model });
      return reply({ sessionId: 's', transcript: '  Should I take the contract?  ', audioDurationMs: 1000, turns: [] });
    });
    const res = await post(wav());
    const data = await res.json();
    expect(data).toEqual({ ok: true, mode: 'model', transcript: 'Should I take the contract?' });
    expect(seen).toEqual([{ url: 'https://api.meta.ai/v1/asr/transcribe', auth: `Bearer ${KEY}`, parts: ['request', 'audio'], model: 'muse-voice-transcribe-1.0' }]);
    expect(JSON.stringify(data)).not.toContain(KEY);
  });

  it('says so when nothing was heard', async () => {
    voiceOn();
    vi.stubGlobal('fetch', async () => reply({ transcript: '' }));
    expect(await (await post(wav())).json()).toMatchObject({ ok: true, transcript: '', notice: expect.stringContaining("didn't hear") });
  });

  it('cuts a transcript over 4,000 characters and says it did', async () => {
    voiceOn();
    vi.stubGlobal('fetch', async () => reply({ transcript: 'x'.repeat(5000) }));
    const data = await (await post(wav())).json();
    expect(data.transcript.length).toBe(4000);
    expect(data.notice).toContain('cut off');
  });

  it('answers 502 with a plain message, never the key, when Meta refuses or the reply is wrong', async () => {
    voiceOn();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (const stub of [() => reply({}, 402), () => reply({}, 401), () => reply({}, 400), () => reply({ nope: 1 }), () => new Response('not json')]) {
      vi.stubGlobal('fetch', async () => stub());
      const res = await post(wav());
      const text = await res.text();
      expect(res.status).toBe(502);
      expect(transcribeResponseSchema.safeParse(JSON.parse(text)).success).toBe(true);
      expect(text).not.toContain(KEY);
    }
  });

  it('logs only the kind of a failure, never audio, text or the key', async () => {
    voiceOn();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('fetch', async () => reply({}, 402));
    await post(wav());
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]![0])).toBe('{"event":"transcribe.failed","kind":"billing"}');
  });

  it('refuses a contributor model and a non-https base URL, falling back to demo mode', async () => {
    voiceOn();
    process.env.META_ASR_MODEL = 'muse-voice-transcribe-1.0-contributor';
    expect((await (await post(wav())).json()).mode).toBe('fixture');
    delete process.env.META_ASR_MODEL;
    process.env.META_API_BASE_URL = 'http://example.com/v1';
    expect((await (await post(wav())).json()).mode).toBe('fixture');
  });
});
