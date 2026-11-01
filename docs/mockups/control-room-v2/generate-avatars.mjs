// One-off for Mockup 5 v2: a base portrait of the fictional founder, then one edit per path with Muse Image.
// Run with the repo's env file loaded by Node (node --env-file), so the key never passes through this script's output.
// Four images at USD 0.01 each. Stops at the first failure.
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const key = process.env.META_API_KEY;
if (!key) {
  console.error('META_API_KEY is not set in the environment. Nothing was sent.');
  process.exit(1);
}
const BASE = (process.env.META_API_BASE_URL || 'https://api.meta.ai/v1').replace(/\/+$/, '');
// Every built-in tool is on by default; none is needed to draw a portrait.
const TOOLS = { enable_image_search: false, enable_web_search: false, enable_shell: false };
const STYLE = 'Illustrated portrait in a flat vector style with soft shading. Not photorealistic.';

async function post(endpoint, body) {
  const res = await fetch(`${BASE}${endpoint}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${endpoint} failed with HTTP ${res.status}: ${text.slice(0, 300).replaceAll(key, '[key]')}`);
  return JSON.parse(text);
}

const BASE_PROMPT = `${STYLE} A woman in her thirties with a warm, confident expression, natural hair, wearing a simple white chef's jacket. Head and shoulders, centred, plain pale background.`;
const EDITS = {
  A: 'Same woman, same illustrated style, face and jacket unchanged. Behind her a small home kitchen: a pot on the stove and a window with plants.',
  B: 'Same woman, same illustrated style, face and jacket unchanged. Behind her a busy commercial kitchen: stainless steel counters and an extractor hood.',
  C: 'Same woman, same illustrated style, face and jacket unchanged. Behind her a small café: a coffee machine and a cup on the counter.',
};

const generated = await post('/images/generations', {
  model: 'muse-image-1.0',
  prompt: BASE_PROMPT,
  n: 1,
  size: '1024x1024',
  output_format: 'png',
  reasoning_strength: 'low',
  tool_enablement: TOOLS,
});
const baseB64 = generated.data[0].b64_json;
writeFileSync(path.join(here, 'avatar-base.png'), Buffer.from(baseB64, 'base64'));
console.log('saved avatar-base.png, tokens', generated.usage?.total_tokens);

for (const letter of ['A', 'B', 'C']) {
  const edited = await post('/images/edits', {
    model: 'muse-image-1.0',
    prompt: `${STYLE} ${EDITS[letter]}`,
    images: [{ image_url: `data:image/png;base64,${baseB64}` }],
    n: 1,
    output_format: 'png',
    reasoning_strength: 'low',
    tool_enablement: TOOLS,
  });
  writeFileSync(path.join(here, `avatar-${letter}.png`), Buffer.from(edited.data[0].b64_json, 'base64'));
  console.log(`saved avatar-${letter}.png, tokens`, edited.usage?.total_tokens);
}
