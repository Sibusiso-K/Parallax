// Generates the film's stills with Muse Image. Resumable: existing files are skipped. Never prints the key.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
const REPO = 'C:/Users/USER/Desktop/Parallax-photoreal';
const OUT = 'C:/Users/USER/Desktop/Parallax-film/gen';
mkdirSync(OUT, { recursive: true });
const env = Object.fromEntries(readFileSync(`${REPO}/.env.local`, 'utf8').split(/\r?\n/).filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
const H = { authorization: `Bearer ${env.META_API_KEY}`, 'content-type': 'application/json' };
const SRC = `${REPO}/assets/derived/photo-demo-src`;
const dataUrl = (p) => `data:image/jpeg;base64,${readFileSync(p).toString('base64')}`;
const NO_TEXT = ' No readable text, no numbers, no logos. Fictional adults only. Photographic, real film look, natural skin texture.';

async function image(name, prompt, refs = [], size = '2048x1152') {
  const file = `${OUT}/${name}.jpg`;
  if (existsSync(file)) return file;
  const t = Date.now();
  const body = { model: 'muse-image-1.0', prompt: prompt + NO_TEXT, n: 1, size, output_format: 'jpeg', ...(refs.length ? { images: refs.map((p) => ({ image_url: dataUrl(p) })) } : {}) };
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(`https://api.meta.ai/v1/images/${refs.length ? 'edits' : 'generations'}`, { method: 'POST', headers: H, body: JSON.stringify(body), signal: AbortSignal.timeout(170000) });
      const j = await r.json();
      if (!r.ok) { console.log(name, 'HTTP', r.status, JSON.stringify(j).slice(0, 200)); continue; }
      writeFileSync(file, Buffer.from(j.data[0].b64_json, 'base64'));
      console.log(name, 'ok', Date.now() - t, 'ms');
      return file;
    } catch (e) { console.log(name, 'retry', String(e).slice(0, 80)); }
  }
  throw new Error(`failed ${name}`);
}
async function pool(jobs, size = 6) {
  const out = [];
  let i = 0;
  await Promise.all(Array.from({ length: size }, async () => { while (i < jobs.length) { const k = i++; out[k] = await jobs[k](); } }));
  return out;
}
const SHAPES = { ah: 'her mouth: mouth open saying ah', ee: 'her mouth: mouth slightly open, corners wide saying ee', oo: 'her mouth: lips rounded saying oo', fv: 'her mouth: upper teeth touching lower lip saying f', mm: 'her mouth: lips gently pressed together saying m', blink: 'her eyes: both eyelids closed in a natural blink' };
const frames = (base, file) => Object.entries(SHAPES).map(([shape, change]) => () => image(`${base}-${shape}`, `Keep everything exactly the same, pixel-aligned: camera, framing, pose, lighting, hair, facial identity and expression. Only change ${change}.`, [file]));

const person = `${SRC}/person.jpg`, plate = `${SRC}/plate.jpg`, night = `${SRC}/mood-late.jpg`;
const golden = await image('close-golden', 'Close-up cinematic portrait of the woman from the second photo, standing in the kitchen from the first photo, which is soft and blurred far behind her. Framed from the upper chest up, her face large in the frame and slightly right of centre. Warm low sun from the big windows behind her rims her hair, with soft fill on her face. She wears the same olive shirt and a linen apron. She looks straight into the camera, calm and steady, mouth closed. 85mm lens, shallow depth of field.', [plate, person]);
const dusk = await image('close-night', 'Same photograph, same framing, same camera. Change only the light and the background: it is now night, the windows behind are dark with small distant city lights, and one cool overhead light falls from above. Her expression is serious and thoughtful, looking at the camera, mouth closed.', [golden]);
await pool([...frames('close-golden', golden), ...frames('close-night', dusk)]);

const broll = {
  'b-dawn': ['Wide cinematic photograph of a city skyline in Johannesburg at first light, a telecom tower in silhouette, gold haze over rooftops and jacaranda trees, long lens compression.', []],
  'b-hands': ['Extreme close-up of a Black woman\'s hands chopping fresh carrots on a worn wooden board in a commercial kitchen, golden morning light through steam, knife mid-motion, shallow depth of field.', []],
  'b-pots': ['Close-up of large stainless steel pots steaming on a commercial stove at dawn, warm backlight through the steam, droplets on the steel, shallow depth of field.', [plate]],
  'b-pen': ['Close-up of a woman\'s hand holding a pen, about to sign a printed contract on a steel kitchen counter. The printed lines are completely out of focus and unreadable. Warm window light, very shallow depth of field.', []],
  'b-boxes': ['A row of plain unmarked cardboard meal boxes being stacked by two kitchen workers seen from the shoulders down, warm morning light, motion in the hands, shallow depth of field.', []],
  'b-calendar': ['A paper wall calendar in a dim kitchen at night, seen at a steep angle and heavily out of focus so nothing on it can be read, cold fluorescent light, a pen hanging on a string.', []],
  'b-invoices': ['A stack of blank white paper and open envelopes on a steel counter at night, one cold fluorescent light reflected on the steel, a phone lying face down beside them. All paper is blank.', [night]],
  'b-alone': ['The woman from the photo sitting alone on an upturned crate in a dark commercial kitchen at night, elbows on her knees, her hands clasped at her mouth, seen from the side, cold light from one tube, the empty steel counter behind her. Quiet and heavy.', [person]],
  'b-staff': ['Two fictional kitchen workers in aprons standing still at the end of a dark kitchen at night, seen from behind, waiting, coats over their arms, out of focus. Cold light. Quiet.', []],
  'b-sunrise-door': ['The woman from the photo unlocking the steel back door of her kitchen at sunrise, warm orange light on her face, a small tired smile, seen from outside in the lane, shallow depth of field.', [person]],
  'b-team': ['The woman from the photo and two fictional kitchen workers packing meals together at a long steel table in warm morning light, laughing, real and candid, seen from slightly below, shallow depth of field.', [person]],
};
await pool(Object.entries(broll).map(([name, [prompt, refs]]) => () => image(name, prompt, refs)));
console.log('done');
