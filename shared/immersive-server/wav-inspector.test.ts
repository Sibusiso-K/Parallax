import { describe, expect, it } from 'vitest';
import { wavInspector } from './wav-inspector.js';

function pcm(seconds: number): Uint8Array {
  const length = seconds * 8000 * 2; const b = new Uint8Array(44 + length); const d = new DataView(b.buffer);
  const tag = (p: number, s: string) => [...s].forEach((c, i) => { b[p + i] = c.charCodeAt(0); });
  tag(0, 'RIFF'); d.setUint32(4, b.length - 8, true); tag(8, 'WAVE'); tag(12, 'fmt '); d.setUint32(16, 16, true);
  d.setUint16(20, 1, true); d.setUint16(22, 1, true); d.setUint32(24, 8000, true); d.setUint32(28, 16000, true);
  d.setUint16(32, 2, true); d.setUint16(34, 16, true); tag(36, 'data'); d.setUint32(40, length, true); return b;
}
describe('PCM WAV inspector', () => {
  it('measures duration from actual PCM framing', async () => {
    expect(await wavInspector.inspect(pcm(2), 'audio/wav', new AbortController().signal)).toEqual({ durationSeconds: 2 });
  });
  it('rejects forged MIME, truncated chunks, unsupported format and audio beyond the duration limit', async () => {
    const signal = new AbortController().signal;
    await expect(wavInspector.inspect(pcm(1), 'audio/ogg', signal)).rejects.toThrow();
    const truncated = pcm(1).subarray(0, 50);
    await expect(wavInspector.inspect(truncated, 'audio/wav', signal)).rejects.toThrow();
    const compressed = pcm(1); new DataView(compressed.buffer).setUint16(20, 3, true);
    await expect(wavInspector.inspect(compressed, 'audio/wav', signal)).rejects.toThrow();
    await expect(wavInspector.inspect(pcm(21), 'audio/wav', signal)).rejects.toThrow();
    const c = new AbortController(); c.abort();
    await expect(wavInspector.inspect(pcm(1), 'audio/wav', c.signal)).rejects.toThrow();
  });
});
