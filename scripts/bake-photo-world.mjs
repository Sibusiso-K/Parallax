/** Resumable offline demo bake. Paid requests are sequential and never retried silently.
 * Run: node scripts/bake-photo-world.mjs [--offline]
 * SAM_PARSER_PATH may point to an approved temporary @meta-sam/parser installation.
 * Raw responses live in the OS temp directory; only compressed assets are published.
 */
import { readFile, writeFile, mkdir, access, readdir, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const out = join(root, 'web/public/worlds/photo-demo');
const cache = join(tmpdir(), 'parallax-photo-bake-v1');
const source = join(root, 'assets/derived/photo-demo-src');
await mkdir(out, { recursive: true });
await mkdir(cache, { recursive: true });
const exists = async (p) => access(p).then(() => true, () => false);
const env = await readFile(join(root, '.env.local'), 'utf8').catch(() => '');
const settings = Object.fromEntries(env.split(/\r?\n/).flatMap((line) => {
  const m = line.match(/^([A-Z_]+)\s*=\s*["']?(.*?)["']?\s*$/); return m ? [[m[1], m[2]]] : [];
}));
const key = process.env.META_API_KEY || settings.META_API_KEY || process.env.META_MODEL_API_KEY || settings.META_MODEL_API_KEY;
const offline = process.argv.includes('--offline');
async function post(endpoint, body) {
  if (offline || !key) throw new Error('Missing bake input: use the authorized Meta key or resume with cached inputs. No live result is fabricated.');
  const r = await fetch(`https://api.meta.ai/v1/${endpoint}`, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(120000) });
  if (!r.ok) throw new Error(`Meta ${endpoint}: HTTP ${r.status}; no automatic retry.`);
  return r.json();
}
const dataURL = async (p) => `data:image/jpeg;base64,${(await readFile(p)).toString('base64')}`;
const python = (code, args = []) => execFileSync('python', ['-c', code, ...args], { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 16 * 1024 * 1024 });
async function compress(input, name) {
  const dest = join(out, name);
  if (!await exists(dest)) python("from PIL import Image; import sys; im=Image.open(sys.argv[1]); im.thumbnail((1920,960)); im.save(sys.argv[2],quality=85,method=6)", [input, dest]);
  return name;
}
async function edit(name, reference, prompt) {
  const dest = join(cache, `${name}.jpg`);
  if (!await exists(dest)) {
    console.log(`Generating ${name}`);
    const r = await post('images/edits', { model: 'muse-image-1.0', images: [{ image_url: await dataURL(reference) }], prompt: `${prompt} Photoreal. Same fictional adult woman. No writing, numbers, logos or watermarks.`, n: 1, size: '2048x1024', output_format: 'jpeg' });
    if (!r.data?.[0]?.b64_json) throw new Error('Image response has no image');
    await writeFile(dest, Buffer.from(r.data[0].b64_json, 'base64'));
  }
  return dest;
}
let parser;
async function segment(name, input, concept) {
  const dest = join(cache, `${name}.json`);
  let r;
  if (await exists(dest)) r = JSON.parse(await readFile(dest, 'utf8'));
  else {
    console.log(`Segmenting ${name}`);
    r = await post('responses', { model: 'sam-3.1', stream: false, input: [{ role: 'user', content: [{ type: 'input_text', text: concept }, { type: 'input_image', image_url: await dataURL(input) }] }] });
    await writeFile(dest, JSON.stringify(r));
  }
  if (!parser) {
    const location = process.env.SAM_PARSER_PATH || join(tmpdir(), 'parallax-photo-tools/node_modules/@meta-sam/parser/dist/index.js');
    parser = await import(pathToFileURL(location).href);
  }
  const output = (r.output ?? []).flatMap((v) => v.content ?? []).map((v) => v.text ?? '').join('');
  async function* events() { yield { type: 'response.output_text.done', item_id: 'bake', output_index: 0, content_index: 0, text: output }; yield { type: 'response.completed' }; }
  const parsed = parser.parseImageStream(events());
  for await (const _ of parsed) { /* consume bounded response */ }
  const result = await parsed.finalResult;
  const masks = parser.recordsOfKind(result.records, 'mask');
  const records = [];
  for (const [i, mask] of masks.entries()) {
    const raw = join(cache, `${name}-${i}.raw`);
    const bounds = mask.bounds;
    await writeFile(raw, parser.decodeMaskToRaster(mask.mask));
    records.push({ bounds, raw, maskWidth: mask.mask.width, maskHeight: mask.mask.height });
  }
  if (!records.length) throw new Error(`SAM found no ${concept}; cached response retained for inspection.`);
  return records;
}
const golden = await compress(join(source, 'plate.jpg'), 'golden.webp');
const night = await compress(join(source, 'mood-late.jpg'), 'night.webp');
const base = join(source, 'scene-person.jpg');
const plateSource = join(source, 'plate.jpg');
const dimensions = JSON.parse(python('from PIL import Image; import sys,json; print(json.dumps(Image.open(sys.argv[1]).size))', [base]).toString());
const [width, height] = dimensions;
const rect = (b) => [b.left / width, b.top / height, (b.right - b.left) / width, (b.bottom - b.top) / height];
async function maskAsset(name, input, records, cutout = false) {
  const dest = join(out, `${name}.webp`);
  if (!await exists(dest)) python(`from PIL import Image,ImageChops
import sys,json
im=Image.open(sys.argv[1]).convert('RGBA'); mask=Image.new('L',im.size)
for r in json.loads(sys.argv[3]):
 b=r['bounds']; w=b['right']-b['left']; h=b['bottom']-b['top']; raw=open(r['raw'],'rb').read()
 m=Image.frombytes('L',(r['maskWidth'],r['maskHeight']),raw).point(lambda p:255 if p else 0).resize((w,h)); layer=Image.new('L',im.size); layer.paste(m,(b['left'],b['top'])); mask=ImageChops.lighter(mask,layer)
if sys.argv[4]=='true': im.putalpha(mask)
else: im=Image.new('RGBA',im.size,(255,255,255,0)); im.putalpha(mask)
im.thumbnail((1920,960)); im.save(sys.argv[2],quality=88,method=6)`, [input, dest, JSON.stringify(records), String(cutout)]);
  return `${name}.webp`;
}
const objects = [];
for (const [id, label, concept] of [['contract','The contract','clipboard'],['pan','Cost of each meal','stainless steel pot'],['fridge','Equipment','refrigerator'],['intake_desk','Your assumptions','wooden desk'],['memo','Your decision','cork board']]) {
  const records = await segment(`plate-${id}`, plateSource, concept);
  objects.push({ id, label, rect: rect(records[0].bounds), mask: await maskAsset(`plate-mask-${id}`, plateSource, records) });
}
const papers = await segment('plate-papers', plateSource, 'paper');
await maskAsset('plate-mask-papers', plateSource, papers);
const counter = await segment('plate-counter', plateSource, 'foreground stainless steel counter');
// SAM also finds distant worktops. Only the largest lower-half surface is the foreground occluder.
const foregroundCounter = counter.filter(r=>r.bounds.top>height*.5).sort((a,b)=>(b.bounds.right-b.bounds.left)*(b.bounds.bottom-b.bounds.top)-(a.bounds.right-a.bounds.left)*(a.bounds.bottom-a.bounds.top)).slice(0,1);
if(!foregroundCounter.length)throw new Error('No foreground counter found; inspect the cached SAM response.');
const foreground = await maskAsset('foreground-main', plateSource, foregroundCounter, true);
const people = {};
for (const [path, mood] of [['A','She stayed small: calm, thoughtful, rested.'],['B','She took the contract: tired but proud, subtle determined expression.'],['C','She negotiated safer terms: relaxed, quietly confident.']]) {
  const rest = path === 'B' ? base : await edit(`person-${path}`, base, `Keep the camera, room, light, face identity, body position and all objects exactly unchanged. Only change her expression subtly. ${mood}`);
  const masks = await segment(`person-${path}`, rest, 'person');
  const image = await maskAsset(`person-${path}`, rest, masks, true);
  const mouth = await segment(`mouth-${path}`, rest, 'mouth');
  const eyes = await segment(`eyes-${path}`, rest, 'eyes');
  const patches = {};
  for (const [shape, instruction] of [['ah','mouth open saying ah'],['ee','mouth slightly open, corners wide saying ee'],['oo','lips rounded saying oo'],['fv','upper teeth touching lower lip saying f'],['mm','lips gently pressed together saying m'],['blink','both eyelids closed in a natural blink']]) {
    const frame = await edit(`person-${path}-${shape}`, rest, `Keep everything exactly the same, pixel-aligned: camera, pose, lighting, facial identity and expression. Only change ${shape === 'blink' ? 'her eyes: ' : 'her mouth: '}${instruction}.`);
    const records = shape === 'blink' ? eyes : mouth;
    const b = { left: Math.min(...records.map(r=>r.bounds.left)), top: Math.min(...records.map(r=>r.bounds.top)), right: Math.max(...records.map(r=>r.bounds.right)), bottom: Math.max(...records.map(r=>r.bounds.bottom)) };
    const pad = shape === 'blink' ? 7 : 14;
    b.left = Math.max(0,b.left-pad); b.top=Math.max(0,b.top-pad); b.right=Math.min(width,b.right+pad); b.bottom=Math.min(height,b.bottom+pad);
    const filename = `patch-${path}-${shape}.webp`;
    // Register on unchanged face pixels outside the patch, then feather patch edges.
    if (!await exists(join(out,filename))) python(`from PIL import Image,ImageFilter
import numpy as np,sys,json
rest=Image.open(sys.argv[1]).convert('RGB'); frame=Image.open(sys.argv[2]).convert('RGB').resize(rest.size)
b=json.loads(sys.argv[4]); x,y,r,d=b['left'],b['top'],b['right'],b['bottom']; box=(max(20,x-40),max(20,y-55),min(rest.width-20,r+40),min(rest.height-20,d+30))
target=np.asarray(rest.crop(box),dtype=float); weights=np.ones(target.shape[:2]); weights[max(0,y-box[1]):d-box[1],max(0,x-box[0]):r-box[0]]=0
best=(float('inf'),0,0)
for dy in range(-12,13,2):
 for dx in range(-12,13,2):
  candidate=np.asarray(frame.crop((box[0]+dx,box[1]+dy,box[2]+dx,box[3]+dy)),dtype=float)
  score=np.mean(np.abs(candidate-target)*weights[:,:,None])
  if score<best[0]: best=(score,dx,dy)
_,dx,dy=best; patch=frame.crop((x+dx,y+dy,r+dx,d+dy)).convert('RGBA'); alpha=Image.new('L',patch.size,0)
from PIL import ImageDraw
ImageDraw.Draw(alpha).rectangle((4,4,patch.width-5,patch.height-5),fill=255); patch.putalpha(alpha.filter(ImageFilter.GaussianBlur(2))); patch.save(sys.argv[3],quality=92,method=6)`, [rest, frame, join(out,filename), JSON.stringify(b)]);
    patches[shape] = { image: filename, rect: rect(b) };
  }
  people[path] = { image, rect: [0,0,1,1], patches, label: 'Fictional person. Synthetic image and voice.' };
}
const asset = (name) => `/worlds/photo-demo/${name}`;
const rectangle = ([x,y,width,height]) => ({x,y,width,height});
const manifest = { version: 1, id: 'photo-demo', title:'A possible future', mode:'baked', width, height, plate:asset(golden), night:asset(night), foreground:asset(foreground),
  objects:objects.map(o=>{
    const candidates=papers.map(p=>rect(p.bounds)).filter(([x,y,w,h])=>o.id==='contract' ? y>.65&&x<.5 : o.id==='memo' ? x>.8&&y<.6 : false);
    candidates.sort((a,b)=>b[2]*b[3]-a[2]*a[3]);
    return {...o,rect:rectangle(o.rect),mask:asset(o.mask),...(candidates[0]?{paper:rectangle(candidates[0])}:{})};
  }),
  people:Object.fromEntries(Object.entries(people).map(([path,p])=>[path,{src:asset(p.image),rect:rectangle(p.rect),frames:{rest:{src:asset(p.image),rect:rectangle(p.rect)},...Object.fromEntries(Object.entries(p.patches).map(([shape,patch])=>[shape,{src:asset(patch.image),rect:rectangle(patch.rect)}]))}}])),
  places:[{id:'spawn',label:'The whole picture',rect:{x:0,y:0,width:1,height:1}}], disclosure:'Illustrative imagery. Fictional people. Synthetic images.' };
await writeFile(join(out,'manifest.json'), JSON.stringify(manifest,null,2)+'\n');
const bytes = (await Promise.all((await readdir(out)).map(async f=>(await stat(join(out,f))).size))).reduce((a,b)=>a+b,0);
console.log(`Bake complete: ${bytes} bytes. ${bytes <= 8*1024*1024 ? 'Within 8 MiB budget.' : 'OVER BUDGET: reduce image quality before shipping.'}`);
if (bytes > 8*1024*1024) process.exitCode=1;
