import { readFileSync, readdirSync, statSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { photoManifestSchema } from '../../../../shared/world/manifest';

const directory = 'web/src/immersive/studio/demo/';
function jpegSize(bytes: Buffer): [number, number] {
  let at = 2;
  while (at < bytes.length) {
    if (bytes[at++] !== 255) continue;
    const marker = bytes[at++]!, size = bytes.readUInt16BE(at);
    if ([192,193,194].includes(marker)) return [bytes.readUInt16BE(at + 5), bytes.readUInt16BE(at + 3)];
    at += size;
  }
  throw new Error('Invalid JPEG');
}
describe('baked film delivery', () => {
  it('ships six image / empty-background / nonempty SAM-mask sets in under eight MB', () => {
    const provenance = JSON.parse(readFileSync(directory + 'PROVENANCE.json', 'utf8')) as { shots: { image: string; mask: string; background: string }[] };
    expect(provenance.shots).toHaveLength(6);
    for (const shot of provenance.shots) {
      const size = jpegSize(readFileSync(directory + shot.image));
      expect(jpegSize(readFileSync(directory + shot.background))).toEqual(size);
      const mask = readFileSync(directory + shot.mask);
      expect([mask.readUInt32BE(16), mask.readUInt32BE(20)]).toEqual(size);
      const chunks: Buffer[] = []; let at = 8;
      while (at < mask.length) { const length = mask.readUInt32BE(at), kind = mask.toString('ascii', at + 4, at + 8); if (kind === 'IDAT') chunks.push(mask.subarray(at + 8, at + 8 + length)); at += 12 + length; }
      const raw = inflateSync(Buffer.concat(chunks)); let pixels = 0;
      for (let y = 0; y < size[1]; y++) for (let x = 0; x < size[0]; x++) if (raw[y * (size[0] * 4 + 1) + 4 + x * 4]) pixels++;
      expect(pixels).toBeGreaterThan(size[0]); expect(pixels).toBeLessThan(size[0] * size[1]);
    }
    expect(readdirSync(directory).reduce((bytes, name) => bytes + statSync(directory + name).size, 0)).toBeLessThan(8_000_000);
  });
  it('accepts Worker A’s actual baked manifest through the shared schema', () => {
    const manifest = photoManifestSchema.parse(JSON.parse(readFileSync('web/public/worlds/photo-demo/manifest.json', 'utf8')));
    expect(manifest.mode).toBe('baked'); expect(manifest.objects).toHaveLength(5);
  });
});
