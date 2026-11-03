import { describe, expect, it } from 'vitest';
import { MAX_SECONDS, MAX_UPLOAD_BYTES, MAX_WAV_BYTES, SAMPLE_RATE, checkWav, encodeWav, toMono16k } from './wav.js';

const silence = (seconds: number) => new Int16Array(Math.round(SAMPLE_RATE * seconds));

describe('encodeWav and checkWav', () => {
  it('round-trips: what we encode, we accept, with the right duration', () => {
    const res = checkWav(encodeWav(silence(1.5)));
    expect(res).toEqual({ ok: true, sampleRate: 16000, durationMs: 1500 });
  });

  it('keeps a full 60 seconds under the size cap, and refuses one sample more', () => {
    const full = encodeWav(silence(MAX_SECONDS));
    expect(full.length).toBe(MAX_WAV_BYTES);
    expect(checkWav(full).ok).toBe(true);
    expect(checkWav(encodeWav(new Int16Array(SAMPLE_RATE * MAX_SECONDS + 2)))).toMatchObject({ ok: false, tooLong: true });
  });

  it('accepts the same 60 seconds at Meta\'s other rate, 24 kHz', () => {
    const full = encodeWav(new Int16Array(24_000 * MAX_SECONDS), 24_000);
    expect(full.length).toBe(MAX_UPLOAD_BYTES);
    expect(checkWav(full)).toEqual({ ok: true, sampleRate: 24000, durationMs: 60_000 });
    expect(checkWav(encodeWav(new Int16Array(24_000 * MAX_SECONDS + 2), 24_000))).toMatchObject({ ok: false, tooLong: true });
  });

  it('refuses what Meta would refuse', () => {
    const good = encodeWav(silence(1));
    const stereo = good.slice();
    new DataView(stereo.buffer).setUint16(22, 2, true);
    const eightBit = good.slice();
    new DataView(eightBit.buffer).setUint16(34, 8, true);
    const rate44 = good.slice();
    new DataView(rate44.buffer).setUint32(24, 44100, true);
    for (const bad of [stereo, eightBit, rate44, good.slice(0, 30), new Uint8Array(0), good.slice(0, 1000), new TextEncoder().encode('RIFFxxxxWAVE')]) {
      expect(checkWav(bad).ok).toBe(false);
    }
    expect(checkWav(encodeWav(new Int16Array(0)))).toMatchObject({ ok: false });
  });
});

describe('toMono16k', () => {
  const tone = (rate: number, hz: number, seconds: number) =>
    Float32Array.from({ length: Math.round(rate * seconds) }, (_, i) => 0.5 * Math.sin((2 * Math.PI * hz * i) / rate));

  it('gives one second of 16 kHz audio from one second at 48 kHz or 44.1 kHz', () => {
    for (const rate of [48000, 44100, 16000, 8000]) {
      expect(Math.abs(toMono16k([tone(rate, 440, 1)], rate).length - 16000)).toBeLessThanOrEqual(1);
    }
  });

  it('keeps a speech-range tone at about the same level, and mixes stereo to mono', () => {
    const peak = (a: Int16Array) => Math.max(...a.map(Math.abs)) / 32767;
    const left = tone(48000, 440, 0.5);
    const out = toMono16k([left, left], 48000);
    expect(peak(out)).toBeGreaterThan(0.45);
    expect(peak(out)).toBeLessThanOrEqual(0.51);
    const opposite = toMono16k([left, left.map((v) => -v)], 48000);
    expect(peak(opposite)).toBeLessThan(0.01);
  });

  it('returns nothing for empty or nonsense input, and clamps loud input', () => {
    expect(toMono16k([], 48000).length).toBe(0);
    expect(toMono16k([new Float32Array(0)], 48000).length).toBe(0);
    expect(toMono16k([new Float32Array(10)], 0).length).toBe(0);
    expect(toMono16k([new Float32Array(100).fill(5)], 16000)[0]).toBe(32767);
  });
});
