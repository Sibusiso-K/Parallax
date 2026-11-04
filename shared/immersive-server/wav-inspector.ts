import type { AudioInspector } from './voice.js';

/** Strict local RIFF/WAVE PCM inspector. The bytes, not the MIME label, are authoritative. */
export const wavInspector: AudioInspector = {
  async inspect(bytes, mime, signal) {
    if (signal.aborted || mime !== 'audio/wav' || bytes.length < 44 || bytes.length > 2_000_000) throw new Error('invalid audio');
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const tag = (p: number) => String.fromCharCode(...bytes.subarray(p, p + 4));
    if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE' || view.getUint32(4, true) + 8 !== bytes.length) throw new Error('invalid audio');
    let pos = 12; let format: { channels: number; rate: number; align: number; bits: number } | null = null; let dataSize: number | null = null;
    while (pos + 8 <= bytes.length) {
      const name = tag(pos); const length = view.getUint32(pos + 4, true); const start = pos + 8; const end = start + length;
      if (end > bytes.length || end + (length % 2) > bytes.length) throw new Error('invalid audio');
      if (name === 'fmt ') {
        if (format || length !== 16 || view.getUint16(start, true) !== 1) throw new Error('invalid audio');
        const channels = view.getUint16(start + 2, true); const rate = view.getUint32(start + 4, true);
        const byteRate = view.getUint32(start + 8, true); const align = view.getUint16(start + 12, true); const bits = view.getUint16(start + 14, true);
        if (![1, 2].includes(channels) || rate < 8000 || rate > 48000 || ![8, 16, 24, 32].includes(bits) || align !== channels * bits / 8 || byteRate !== rate * align) throw new Error('invalid audio');
        format = { channels, rate, align, bits };
      } else if (name === 'data') {
        if (dataSize !== null) throw new Error('invalid audio');
        dataSize = length;
      }
      pos = end + (length % 2);
    }
    if (pos !== bytes.length || !format || dataSize === null || !dataSize || dataSize % format.align !== 0) throw new Error('invalid audio');
    const durationSeconds = dataSize / (format.rate * format.align);
    if (durationSeconds > 20 || signal.aborted) throw new Error('invalid audio');
    return { durationSeconds };
  },
};
