// Downloads the approved source assets UNCHANGED into assets/source/ and records each file in assets/provenance.json:
// publisher URL, licence, bytes and SHA-256 (plus the publisher's MD5 or SHA-256 check where one is published).
// Approved by the user in chat on 2 Nov 2026: group A (Poly Haven courtyard assets) and group B (MPFB + MakeHuman packs).
// Re-running skips any file already on disk whose SHA-256 matches its provenance record.
//
// Usage: node assets/tools/fetch_assets.mjs polyhaven|people
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SOURCE = join(ROOT, 'assets', 'source');
const LEDGER = join(ROOT, 'assets', 'provenance.json');
// Poly Haven's API terms ask every caller to identify itself.
const UA = 'parallax-asset-build/1.0 (Parallax photoreal courtyard; one-off source download)';

const POLY = {
  textures: ['red_brick_03', 'concrete_floor_worn_001', 'brown_planks_03', 'rust_coarse_01', 'gravel_floor_02', 'forest_ground_04'],
  // glTF uses an ORM map (occlusion, roughness, metalness); Poly Haven's "arm" map is exactly that packing.
  maps: ['Diffuse', 'nor_gl', 'arm'],
  hdri: 'sunset_jhbcentral',
  models: ['fern_02', 'shrub_02', 'shrub_03', 'shrub_04', 'potted_plant_02', 'potted_plant_04', 'grass_bermuda_01', 'rock_moss_set_01', 'steel_frame_shelves_01'],
};

const PEOPLE = [
  {
    id: 'mpfb-2.0.18',
    url: 'https://extensions.blender.org/download/sha256:c075b3e9b94b8e5556a5f03f4653602d02ea306de08126e8f55ed6dee28a2dad/add-on-mpfb-v2.0.18.zip',
    sha256: 'c075b3e9b94b8e5556a5f03f4653602d02ea306de08126e8f55ed6dee28a2dad',
    licence: 'GPL-3.0-or-later (add-on code)',
    publisher: 'extensions.blender.org',
  },
  ...[
    ['makehuman_system_assets', 'asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip'],
    ['eyebrows01', 'asset_packs/eyebrows01/eyebrows01_cc0.zip'],
    ['eyelashes01', 'asset_packs/eyelashes01/eyelashes01_cc0.zip'],
    ['glasses01', 'asset_packs/glasses01/glasses01_cc0.zip'],
    ['visemes02', 'functional/visemes02.zip'],
    ['faceunits01', 'functional/faceunits01.zip'],
  // Both hosts are the official mirrors listed on each pack page; files2 measured 12.8 KB/s and files 545 KB/s (2 Nov 2026).
  ].map(([id, path]) => ({ id, url: `https://files.makehumancommunity.org/${path}`, licence: 'CC0-1.0', publisher: 'makehumancommunity.org' })),
];

async function getJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

async function hashFile(path, algo) {
  const h = createHash(algo);
  await pipeline(createReadStream(path), new Transform({ transform(chunk, _e, cb) { h.update(chunk); cb(null); } }));
  return h.digest('hex');
}

/** Streams one file to disk while hashing it; refuses HTML error pages and short downloads. */
async function download(url, dest, expectBytes) {
  await mkdir(dirname(dest), { recursive: true });
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok || !res.body) throw new Error(`${res.status} ${url}`);
  const type = res.headers.get('content-type') || '';
  if (type.includes('text/html')) throw new Error(`got an HTML page instead of a file: ${url}`);
  const sha = createHash('sha256');
  const md5 = createHash('md5');
  let bytes = 0;
  const tmp = `${dest}.part`;
  await pipeline(
    Readable.fromWeb(res.body),
    new Transform({ transform(chunk, _e, cb) { sha.update(chunk); md5.update(chunk); bytes += chunk.length; cb(null, chunk); } }),
    createWriteStream(tmp),
  );
  if (expectBytes && bytes !== expectBytes) throw new Error(`size mismatch for ${url}: ${bytes} != ${expectBytes}`);
  await rename(tmp, dest);
  return { bytes, sha256: sha.digest('hex'), md5: md5.digest('hex'), contentType: type };
}

async function loadLedger() {
  if (!existsSync(LEDGER)) return { schemaVersion: 1, approval: 'User approved groups A (courtyard), B (people tools) and C (walking physics) in chat, 2026-11-02.', files: [] };
  return JSON.parse(await readFile(LEDGER, 'utf8'));
}

async function fetchOne(ledger, item) {
  const rel = relative(ROOT, item.dest).replaceAll('\\', '/');
  const known = ledger.files.find((f) => f.path === rel);
  if (known && existsSync(item.dest) && (await hashFile(item.dest, 'sha256')) === known.sha256) {
    console.log(`skip (hash matches) ${rel}`);
    return;
  }
  const got = await download(item.url, item.dest, item.bytes);
  if (item.md5 && got.md5 !== item.md5) throw new Error(`MD5 mismatch for ${rel}`);
  if (item.sha256 && got.sha256 !== item.sha256) throw new Error(`SHA-256 mismatch for ${rel}`);
  const record = {
    path: rel,
    url: item.url,
    publisher: item.publisher,
    assetId: item.assetId,
    licence: item.licence,
    bytes: got.bytes,
    sha256: got.sha256,
    publisherCheck: item.md5 ? 'md5 verified' : item.sha256 ? 'sha256 verified' : 'none published',
    downloadedAt: new Date().toISOString(),
  };
  ledger.files = [...ledger.files.filter((f) => f.path !== rel), record].sort((a, b) => a.path.localeCompare(b.path));
  await writeFile(LEDGER, `${JSON.stringify(ledger, null, 2)}\n`);
  console.log(`ok ${rel} ${(got.bytes / 1048576).toFixed(1)} MB ${record.publisherCheck}`);
}

async function polyhavenItems() {
  const items = [];
  const base = { publisher: 'polyhaven.com', licence: 'CC0-1.0' };
  for (const id of POLY.textures) {
    const f = await getJson(`https://api.polyhaven.com/files/${id}`);
    for (const map of POLY.maps) {
      const file = f[map]?.['2k']?.jpg;
      if (!file) throw new Error(`${id} has no 2k ${map}`);
      items.push({ ...base, assetId: id, url: file.url, md5: file.md5, bytes: file.size, dest: join(SOURCE, 'polyhaven', 'textures', id, file.url.split('/').pop()) });
    }
  }
  const h = await getJson(`https://api.polyhaven.com/files/${POLY.hdri}`);
  for (const file of [h.hdri['2k'].hdr, h.tonemapped]) {
    items.push({ ...base, assetId: POLY.hdri, url: file.url, md5: file.md5, bytes: file.size, dest: join(SOURCE, 'polyhaven', 'hdris', POLY.hdri, decodeURIComponent(file.url.split('/').pop())) });
  }
  for (const id of POLY.models) {
    const g = (await getJson(`https://api.polyhaven.com/files/${id}`)).gltf['1k'].gltf;
    const dir = join(SOURCE, 'polyhaven', 'models', id);
    items.push({ ...base, assetId: id, url: g.url, md5: g.md5, bytes: g.size, dest: join(dir, g.url.split('/').pop()) });
    // Included files keep their relative paths so the .gltf references stay valid.
    for (const [relPath, inc] of Object.entries(g.include || {})) items.push({ ...base, assetId: id, url: inc.url, md5: inc.md5, bytes: inc.size, dest: join(dir, relPath) });
  }
  return items;
}

const group = process.argv[2];
if (!['polyhaven', 'people'].includes(group)) throw new Error('usage: node assets/tools/fetch_assets.mjs polyhaven|people');
const ledger = await loadLedger();
const items = group === 'polyhaven' ? await polyhavenItems() : PEOPLE.map((p) => ({ ...p, assetId: p.id, dest: join(SOURCE, p.publisher === 'extensions.blender.org' ? 'mpfb' : 'makehuman', p.url.split('/').pop()) }));
console.log(`${group}: ${items.length} files`);
for (const item of items) await fetchOne(ledger, item);
console.log(`${group}: done`);
