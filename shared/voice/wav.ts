// WAV handling for voice intake, shared by the browser (which records and encodes) and the server (which checks what it
// is sent). Meta's speech-to-text takes only mono 16-bit PCM WAV at 16 or 24 kHz. We send 16 kHz, at most 60 seconds
// (FEATURES.md F3), which is about 1.9 MB and fits under Vercel's 4.5 MB body limit.

export const SAMPLE_RATE = 16_000;
export const MAX_SECONDS = 60;
/** The 16 kHz file the browser encodes: 44 + 16,000 x 2 x 60 = about 1.9 MB. */
export const MAX_WAV_BYTES = 44 + SAMPLE_RATE * 2 * MAX_SECONDS;
/** The largest file checkWav accepts: the same 60 seconds at Meta's other rate, 24 kHz. */
export const MAX_UPLOAD_BYTES = 44 + 24_000 * 2 * MAX_SECONDS;

const ascii = (b: Uint8Array, at: number, len: number) => String.fromCharCode(...b.subarray(at, at + len));

/** 16-bit mono PCM samples as a WAV file. */
export function encodeWav(samples: Int16Array, rate = SAMPLE_RATE): Uint8Array {
  const out = new Uint8Array(44 + samples.length * 2);
  const view = new DataView(out.buffer);
  const put = (at: number, text: string) => [...text].forEach((c, i) => (out[at + i] = c.charCodeAt(0)));
  put(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  put(8, 'WAVE');
  put(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  put(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((s, i) => view.setInt16(44 + i * 2, s, true));
  return out;
}

export type WavCheck = { ok: true; sampleRate: number; durationMs: number } | { ok: false; error: string; tooLong?: boolean };

/** Fail-closed check of a WAV file: only what Meta accepts, and no longer than MAX_SECONDS. Never throws. */
export function checkWav(bytes: Uint8Array): WavCheck {
  if (bytes.length < 44 || ascii(bytes, 0, 4) !== 'RIFF' || ascii(bytes, 8, 4) !== 'WAVE') {
    return { ok: false, error: 'That is not a WAV recording.' };
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let rate = 0;
  let at = 12;
  while (at + 8 <= bytes.length) {
    const id = ascii(bytes, at, 4);
    const size = view.getUint32(at + 4, true);
    const body = at + 8;
    if (id === 'fmt ') {
      if (size < 16 || body + 16 > bytes.length) return { ok: false, error: 'The recording header is damaged.' };
      const [format, channels, bits] = [view.getUint16(body, true), view.getUint16(body + 2, true), view.getUint16(body + 14, true)];
      rate = view.getUint32(body + 4, true);
      if (format !== 1 || channels !== 1 || bits !== 16) return { ok: false, error: 'The recording must be mono, 16-bit.' };
      if (rate !== 16_000 && rate !== 24_000) return { ok: false, error: 'The recording must be 16 kHz.' };
    } else if (id === 'data') {
      if (rate === 0) return { ok: false, error: 'The recording header is damaged.' };
      if (size === 0 || size % 2 !== 0 || body + size > bytes.length) return { ok: false, error: 'The recording is empty or cut short.' };
      const durationMs = Math.round((size / 2 / rate) * 1000);
      if (size / 2 > rate * MAX_SECONDS) return { ok: false, error: `Recordings can be at most ${MAX_SECONDS} seconds.`, tooLong: true };
      return { ok: true, sampleRate: rate, durationMs };
    }
    at = body + size + (size % 2);
  }
  return { ok: false, error: 'The recording has no audio in it.' };
}

/** Mixes the channels to mono and resamples to 16 kHz by averaging, which also filters out what 16 kHz cannot hold. */
export function toMono16k(channels: Float32Array[], inRate: number): Int16Array {
  const first = channels[0];
  if (!first || first.length === 0 || !(inRate > 0)) return new Int16Array(0);
  const mono = new Float32Array(first.length);
  for (const ch of channels) for (let i = 0; i < mono.length; i++) mono[i]! += (ch[i] ?? 0) / channels.length;
  const ratio = inRate / SAMPLE_RATE;
  const length = Math.floor(mono.length / ratio);
  const out = new Int16Array(length);
  for (let i = 0; i < length; i++) {
    const from = i * ratio;
    const to = Math.min(mono.length, (i + 1) * ratio);
    let sum = 0;
    let weight = 0;
    for (let j = Math.floor(from); j < to; j++) {
      const w = Math.min(j + 1, to) - Math.max(j, from);
      sum += mono[j]! * w;
      weight += w;
    }
    const v = weight > 0 ? sum / weight : 0;
    out[i] = Math.max(-32768, Math.min(32767, Math.round(v * 32767)));
  }
  return out;
}
