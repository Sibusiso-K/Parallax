import { voiceConfigOrNull } from '../shared/providers/asr.js';
import { modelConfigOrNull } from '../shared/providers/meta.js';
import { sessionConfigOrNull } from '../shared/session/store.js';

const json = (body: unknown, status: number) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });

// Vercel Function: GET /api/health. Reports what is configured, never a key or an address. Makes no model call.
// The answer is no-store like every other route: a cached one would keep saying "not ready" after a switch is turned on.
export function GET(): Response {
  return json({
    ok: true,
    metaKeyConfigured: Boolean(process.env.META_API_KEY?.trim()),
    modelEnabled: process.env.META_MODEL_ENABLED?.trim().toLowerCase() === 'true',
    modelReady: modelConfigOrNull(process.env) !== null,
    voiceReady: voiceConfigOrNull(process.env) !== null,
    savingReady: sessionConfigOrNull(process.env) !== null,
  }, 200);
}
