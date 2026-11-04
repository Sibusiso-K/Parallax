import { z } from 'zod';
import { guardPaidRoute } from '../shared/http/guard.js';
import { modelConfigOrNull } from '../shared/providers/meta.js';
import { generateWorldImage } from '../shared/providers/image.js';
import { segmentImage, segmentRequest } from '../shared/providers/sam.js';
import { planWorld } from '../shared/world/plan.js';
import { imageInput, readBody, worldJson } from '../shared/world/provider.js';
import { DEMO_MANIFEST_URL } from '../shared/world/manifest.js';
import { directFilm } from '../shared/world/film-plan.js';

export const maxDuration = 60;
const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('plan'), story: z.string().trim().min(1).max(4000) }),
  z.object({ action: z.literal('direct'), story: z.string().trim().min(1).max(4000) }),
  z.object({ action: z.literal('draw'), prompt: z.string().trim().min(1).max(2000) }),
  z.object({ action: z.literal('edit'), prompt: z.string().trim().min(1).max(2000), references: z.array(imageInput).min(1).max(2) }),
  segmentRequest.extend({ action: z.literal('segment') }),
]);
export async function POST(request: Request): Promise<Response> {
  let input: z.infer<typeof actionSchema>;
  try { input = actionSchema.parse(await readBody(request)); }
  catch { return worldJson({ ok: false, error: 'Use a smaller image and a valid world request.' }, 400); }
  const cfg = modelConfigOrNull(process.env);
  if (!cfg) return worldJson({ ok: true, mode: 'fixture', manifestUrl: DEMO_MANIFEST_URL });
  // Existing guard buckets until the integration owner adds named world/document limits.
  // Forty calls cover one sequential world and film; image calls remain bounded and one-shot.
  const refused = guardPaidRoute(request, 'advisor');
  if (refused) return refused;
  try {
    if (input.action === 'plan') return worldJson({ ok: true, mode: 'model', plan: await planWorld(cfg, input.story) });
    if (input.action === 'direct') return worldJson({ ok: true, mode: 'model', plan: await directFilm(cfg, input.story) });
    if (input.action === 'segment') return worldJson({ ok: true, mode: 'model', ...await segmentImage(cfg, input) });
    const result = await generateWorldImage(cfg, input.prompt, input.action === 'edit' ? input.references : []);
    return worldJson({ ok: true, mode: 'model', ...result });
  } catch { return worldJson({ ok: false, error: 'Your world could not be generated just now. The labelled demo is still available.' }, 502); }
}
