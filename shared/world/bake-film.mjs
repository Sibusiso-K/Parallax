// Resumable, bounded demo bake. No secrets or upstream errors are printed.
// Run: node shared/world/bake-film.mjs (from the checkout root).
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import { formats, decodeMaskToRaster } from './vendor/package/dist/index.js';
const directory = new URL('../../web/src/immersive/studio/demo/', import.meta.url);
const root = new URL('../../', import.meta.url);
const env = Object.fromEntries((await readFile(new URL('.env.local', root), 'utf8')).split(/\r?\n/).flatMap(line => { const match = line.match(/^([A-Z_]+)\s*=\s*(.*)$/); return match ? [[match[1], match[2].trim().replace(/^['"]|['"]$/g, '')]] : []; }));
if (!env.META_API_KEY) throw new Error('No server key is configured.');
const base = (env.META_API_BASE_URL || 'https://api.meta.ai/v1').replace(/\/$/, '');
const exists = async name => stat(new URL(name, directory)).then(() => true, () => false);
const request = async (path, body) => {
  const response = await fetch(`${base}${path}`, { method: 'POST', headers: { authorization: `Bearer ${env.META_API_KEY}`, 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(50_000) });
  if (!response.ok) throw new Error(`Bake request failed (${response.status}).`);
  return response.json();
};
const dataUrl = async name => `data:image/jpeg;base64,${(await readFile(new URL(name, directory))).toString('base64')}`;
const crc32 = bytes => { let crc = 0xffffffff; for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); } return (crc ^ 0xffffffff) >>> 0; };
const chunk = (name, bytes) => { const type = Buffer.from(name); const length = Buffer.alloc(4); length.writeUInt32BE(bytes.length); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([type, bytes]))); return Buffer.concat([length, type, bytes, crc]); };
function maskPng(record, width, height) {
  const raster = decodeMaskToRaster(record.mask); const b = record.bounds;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = Math.max(0, b.top); y < Math.min(height, b.bottom); y++) for (let x = Math.max(0, b.left); x < Math.min(width, b.right); x++) {
    const sx = Math.floor((x - b.left) / (b.right - b.left) * record.mask.width); const sy = Math.floor((y - b.top) / (b.bottom - b.top) * record.mask.height);
    const at = y * (width * 4 + 1) + 1 + x * 4; raw[at] = raw[at + 1] = raw[at + 2] = 255; raw[at + 3] = raster[sy * record.mask.width + sx] ? 255 : 0;
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', header), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
function jpegSize(buffer) {
  let i = 2;
  while (i < buffer.length) { if (buffer[i++] !== 255) continue; const marker = buffer[i++]; const size = buffer.readUInt16BE(i); if ([192,193,194].includes(marker)) return { width: buffer.readUInt16BE(i + 5), height: buffer.readUInt16BE(i + 3) }; i += size; }
  throw new Error('Could not read JPEG size.');
}
await mkdir(directory, { recursive: true });
const directions = [
  ['workplace', 'Wide establishing photograph of the same kitchen at golden hour, with the same fictional adult woman working quietly behind the counter.'],
  ['founder', 'Medium close photograph of the same fictional adult woman behind the counter, a thoughtful calm expression, shallow depth of field.'],
  ['offer', 'Photograph looking across the kitchen counter at a blank clipboard in the foreground and the same fictional adult woman behind it.'],
  ['work', 'Photograph of the same fictional adult woman preparing food at the kitchen counter, warm daylight and natural steam.'],
  ['pressure', 'Photograph of the same fictional adult woman in the exact same kitchen in tense evening light, blank loose invoices in the foreground.'],
  ['choice', 'Photograph of the same fictional adult woman in the exact same kitchen in soft morning light, relaxed and looking toward the open window.'],
];
const references = await Promise.all(['plate.jpg', 'scene-person.jpg'].map(async name => `data:image/jpeg;base64,${(await readFile(new URL(`assets/derived/photo-demo-src/${name}`, root))).toString('base64')}`));
for (const [focus, direction] of directions) {
  const file = `shot-${focus}.jpg`;
  if (!await exists(file)) {
    const reply = await request('/images/edits', { model: 'muse-image-1.0', prompt: `${direction} Preserve the person identity and room materials from the references. Cinematic photoreal photograph. No figures, numbers, readable text, logos, brands or celebrities.`, images: references.map(image_url => ({ image_url })), n: 1, size: '2048x1024', output_format: 'jpeg' });
    const b64 = reply.data?.[0]?.b64_json; if (!b64) throw new Error('No image returned.'); await writeFile(new URL(file, directory), Buffer.from(b64, 'base64'));
    console.log(`Baked ${focus} image.`);
  }
  const maskFile = `mask-${focus}.png`;
  if (!await exists(maskFile)) {
    const reply = await request('/responses', { model: 'sam-3.1', stream: false, input: [{ role: 'user', content: [{ type: 'input_text', text: 'person' }, { type: 'input_image', image_url: await dataUrl(file) }] }] });
    const text = (reply.output ?? []).flatMap(item => item.content ?? []).map(item => item.text ?? '').join('\n'); const parser = formats.segmentation.image().createParser(); parser.push(text); const records = parser.finish({ status: 'completed' }).result.records;
    const record = records.find(item => item.kind === 'mask'); if (!record) throw new Error('No person mask returned.'); const size = jpegSize(await readFile(new URL(file, directory)));
    await writeFile(new URL(maskFile, directory), maskPng(record, size.width, size.height)); console.log(`Baked ${focus} subject mask.`);
  }
  const backgroundFile = `background-${focus}.jpg`;
  if (!await exists(backgroundFile)) {
    const reply = await request('/images/edits', { model: 'muse-image-1.0', prompt: 'Remove the person completely. Reconstruct the empty workplace behind them. Keep the camera, objects, room, lighting and composition exactly the same. No people, figures, numbers, readable text or logos.', images: [{ image_url: await dataUrl(file) }], n: 1, size: '2048x1024', output_format: 'jpeg' });
    const b64 = reply.data?.[0]?.b64_json; if (!b64) throw new Error('No background returned.'); await writeFile(new URL(backgroundFile, directory), Buffer.from(b64, 'base64')); console.log(`Baked ${focus} clean background.`);
  }
}
await writeFile(new URL('PROVENANCE.json', directory), JSON.stringify({ generatedAt: new Date().toISOString(), imageModel: 'muse-image-1.0', maskModel: 'sam-3.1', fictional: true, illustrative: true, shots: directions.map(([focus]) => ({ focus, image: `shot-${focus}.jpg`, mask: `mask-${focus}.png`, background: `background-${focus}.jpg` })), note: 'Generated from existing Muse demo kitchen and fictional-person references. No financial figures in art direction. No browser playback acceptance.' }, null, 2));
console.log('Demo film bake complete.');
