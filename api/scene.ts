import { dressScene, sceneRequest } from '../shared/scene/dressing.js';
import { ImageError, generatePortrait } from '../shared/providers/image.js';
import { ModelError, modelConfigOrNull } from '../shared/providers/meta.js';

// Vercel Function: POST /api/scene. Builds the founder's world from their own story, in two Meta calls:
//   1. Muse Spark dresses the fixed 3D room for this business: a title, a label and caption for each place and object,
//      and a line saying where the founder stands (shared/scene/dressing.ts);
//   2. Muse Image draws the founder's portrait in that setting (shared/providers/image.ts).
// The portrait is best-effort: if it fails the dressing is still returned. With no model configured the route answers
// { mode: "fixture" } and the app keeps the demo courtyard and portraits. Nothing is stored or logged but failure kinds.

const MAX_BODY_BYTES = 16 * 1024;
const json = (body: unknown, status: number) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });

export async function POST(request: Request): Promise<Response> {
  const cfg = modelConfigOrNull(process.env);
  if (!cfg) return json({ ok: true, mode: 'fixture' }, 200);
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return json({ ok: false, error: 'That story is too long to build a scene from.' }, 413);
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return json({ ok: false, error: 'The scene request was not readable.' }, 400);
  }
  const req = sceneRequest.safeParse(body);
  if (!req.success) return json({ ok: false, error: 'The scene request was not readable.' }, 400);
  let dressing;
  let model: string;
  try {
    ({ dressing, model } = await dressScene(cfg, req.data));
  } catch (err) {
    console.warn(JSON.stringify({ event: 'scene.failed', kind: err instanceof ModelError ? err.kind : 'unknown' }));
    return json({ ok: false, error: "We couldn't build your scene just now. The demo room is shown instead." }, 502);
  }
  let portrait: string | null = null;
  let imageModel: string | null = null;
  try {
    const out = await generatePortrait(cfg, dressing.portrait, process.env);
    portrait = out.dataUrl;
    imageModel = out.model;
  } catch (err) {
    console.warn(JSON.stringify({ event: 'portrait.failed', status: err instanceof ImageError ? (err.status ?? null) : null }));
  }
  return json({ ok: true, mode: 'model', dressing, portrait, models: { scene: model, portrait: imageModel } }, 200);
}
