// Vercel Function: GET /api/health. Reports whether the Meta key is configured, never its value.
export function GET(): Response {
  return Response.json({
    ok: true,
    metaKeyConfigured: Boolean(process.env.META_API_KEY),
  });
}
