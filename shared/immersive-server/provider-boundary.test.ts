import { describe, expect, it, vi } from 'vitest';
import { createVoiceBoundary } from './provider-boundary.js';

function pcm(): Uint8Array {
  const b = new Uint8Array(16044); const d = new DataView(b.buffer);
  const tag = (p: number, s: string) => [...s].forEach((c, i) => { b[p + i] = c.charCodeAt(0); });
  tag(0, 'RIFF'); d.setUint32(4, b.length - 8, true); tag(8, 'WAVE'); tag(12, 'fmt '); d.setUint32(16, 16, true);
  d.setUint16(20, 1, true); d.setUint16(22, 1, true); d.setUint32(24, 8000, true); d.setUint32(28, 16000, true);
  d.setUint16(32, 2, true); d.setUint16(34, 16, true); tag(36, 'data'); d.setUint32(40, 16000, true); return b;
}
describe('voice transport boundary', () => {
  it('uses only validated WAV and preserves the approved speech text', async () => {
    const transport = { transcribe: vi.fn(async () => ' editable '), synthesize: vi.fn(async () => pcm()) };
    const b = createVoiceBoundary(transport); const signal = new AbortController().signal;
    expect(await b.stt.transcribe(pcm(), 'audio/wav', signal)).toBe('editable');
    expect(await b.tts.synthesize('Cash: R42.', signal)).toEqual(pcm());
    expect(transport.synthesize).toHaveBeenCalledWith('Cash: R42.', signal);
  });
  it('rejects malformed data and sanitizes provider errors', async () => {
    const transport = { transcribe: vi.fn(async () => { throw new Error('secret-from-provider'); }), synthesize: vi.fn(async () => new Uint8Array([1])) };
    const b = createVoiceBoundary(transport); const signal = new AbortController().signal;
    await expect(b.stt.transcribe(new Uint8Array([1]), 'audio/wav', signal)).rejects.toThrow('transcription unavailable');
    expect(transport.transcribe).not.toHaveBeenCalled();
    await expect(b.stt.transcribe(pcm(), 'audio/wav', signal)).rejects.toThrow(/^transcription unavailable$/);
    await expect(b.tts.synthesize('approved', signal)).rejects.toThrow(/^speech unavailable$/);
    const aborted = new AbortController(); aborted.abort();
    await expect(b.tts.synthesize('approved', aborted.signal)).rejects.toThrow();
  });
});
