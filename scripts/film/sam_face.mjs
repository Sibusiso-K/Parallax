// Finds the mouth and eyes in the film's base stills with SAM 3.1. Never prints the key.
import { readFileSync, writeFileSync } from 'node:fs';
const REPO = 'C:/Users/USER/Desktop/Parallax-photoreal';
const env = Object.fromEntries(readFileSync(`${REPO}/.env.local`, 'utf8').split(/\r?\n/).filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
const H = { authorization: `Bearer ${env.META_API_KEY}`, 'content-type': 'application/json' };
const out = {};
for (const name of process.argv.slice(2)) {
  out[name] = {};
  const url = `data:image/jpeg;base64,${readFileSync(`gen/${name}.jpg`).toString('base64')}`;
  for (const concept of ['mouth', 'eyes', 'face']) {
    const r = await fetch('https://api.meta.ai/v1/responses', { method: 'POST', headers: H, body: JSON.stringify({ model: 'sam-3.1', stream: false, input: [{ role: 'user', content: [{ type: 'input_text', text: concept }, { type: 'input_image', image_url: url }] }] }) });
    const j = await r.json();
    const text = (j.output ?? []).flatMap((o) => o.content ?? []).map((c) => c.text ?? '').join('');
    const boxes = [...text.matchAll(/<\|box;x1=([\d.]+);y1=([\d.]+);x2=([\d.]+);y2=([\d.]+);w=([\d.]+);h=([\d.]+)\|>/g)].map((m) => m.slice(1, 7).map(Number));
    out[name][concept] = boxes;
    console.log(name, concept, JSON.stringify(boxes).slice(0, 160), r.status);
  }
}
writeFileSync('face_boxes.json', JSON.stringify(out, null, 1));
