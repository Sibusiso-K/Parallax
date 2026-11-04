// Deliberate opt-in live provider smoke, outside the repository's strictly offline tests.
// Run: node shared/world/live-check.mjs. Uses fictional images and a synthetic invoice only.
import { readFile, writeFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import assert from 'node:assert/strict';
registerHooks({ resolve(specifier, context, nextResolve) {
  try { return nextResolve(specifier, context); }
  catch (error) { if (error.code === 'ERR_MODULE_NOT_FOUND' && specifier.endsWith('.js') && specifier.startsWith('.')) return nextResolve(specifier.slice(0, -3) + '.ts', context); throw error; }
} });
const { planWorld } = await import('./plan.ts');
const { directFilm } = await import('./film-plan.ts');
const { readDocument, proposalFor } = await import('./document.ts');
const { segmentImage } = await import('../providers/sam.ts');
const source = await readFile('.env.local', 'utf8');
const env = Object.fromEntries(source.split(/\r?\n/).flatMap(line => { const match = line.match(/^([A-Z_]+)\s*=\s*(.*)$/); return match ? [[match[1], match[2].trim().replace(/^['"]|['"]$/g, '')]] : []; }));
if (!env.META_API_KEY) throw new Error('No live key configured.');
const cfg = { apiKey: env.META_API_KEY, baseUrl: env.META_API_BASE_URL || 'https://api.meta.ai/v1', models: ['muse-spark-1.3'] };
function syntheticPdf() {
  const stream = 'BT /F1 20 Tf 50 740 Td (SYNTHETIC TEST INVOICE) Tj 0 -50 Td (Total ZAR 120,000.00) Tj 0 -50 Td (Payment within 30 days of invoice.) Tj ET';
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
  let pdf = '%PDF-1.4\n'; const offsets = [0];
  objects.forEach((object, index) => { offsets.push(pdf.length); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = pdf.length; pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return `data:application/pdf;base64,${Buffer.from(pdf).toString('base64')}`;
}
const checks = [
  ['hiring-world-plan', async () => { const plan = await planWorld(cfg, 'A bicycle repair workshop considering hiring an assistant.'); assert.equal(plan.objects.length, 5); }],
  ['pricing-film-direction', async () => { const film = await directFilm(cfg, 'A fictional bakery founder deciding whether to change bread prices.'); assert.equal(film.shots.length, 6); }],
  ['synthetic-pdf-reading', async () => { const reading = await readDocument(cfg, syntheticPdf()); assert.equal(reading.unreadable, false); const proposals = reading.clauses.map(proposalFor); assert(proposals.some(p => p?.kind === 'paymentDays' && p.value === 30)); assert(proposals.some(p => p?.kind === 'amount' && p.value === 120000)); }],
  ['sam-person-adapter', async () => {
    const bytes = await readFile('web/src/immersive/studio/demo/shot-founder.jpg'); let width = 0, height = 0, at = 2;
    while (at < bytes.length) { if (bytes[at++] !== 255) continue; const marker = bytes[at++], length = bytes.readUInt16BE(at); if ([192,193,194].includes(marker)) { width = bytes.readUInt16BE(at + 5); height = bytes.readUInt16BE(at + 3); break; } at += length; }
    assert(width > 0); const result = await segmentImage(cfg, { image: `data:image/jpeg;base64,${bytes.toString('base64')}`, concept: 'person', width, height }); assert(result.masks.length > 0);
  }],
];
const results = [];
for (const [name, run] of checks) { if (process.argv[2] && name !== process.argv[2]) continue; const started = Date.now(); try { await run(); results.push({ name, passed: true, milliseconds: Date.now() - started }); } catch (error) { results.push({ name, passed: false, milliseconds: Date.now() - started, failure: error.name }); } console.log(JSON.stringify(results.at(-1))); }
const previous = await readFile('shared/world/LIVE-CHECK.json', 'utf8').then(text => JSON.parse(text).results ?? [], () => []);
const merged = [...previous.filter(result => !results.some(next => next.name === result.name)), ...results];
await writeFile('shared/world/LIVE-CHECK.json', JSON.stringify({ checkedAt: new Date().toISOString(), evidence: 'Synthetic provider smoke only; no browser, recording, human-document or deployment acceptance.', results: merged }, null, 2));
process.exitCode = results.every(result => result.passed) ? 0 : 1;
