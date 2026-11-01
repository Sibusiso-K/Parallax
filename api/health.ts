import { modelConfigOrNull } from '../shared/providers/meta.js';

// Vercel Function: GET /api/health. Reports what is configured, never a key or an address. Makes no model call.
export function GET(): Response {
  return Response.json({
    ok: true,
    metaKeyConfigured: Boolean(process.env.META_API_KEY),
    modelEnabled: process.env.META_MODEL_ENABLED?.trim().toLowerCase() === 'true',
    modelReady: modelConfigOrNull(process.env) !== null,
  });
}
