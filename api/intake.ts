import { handleIntake } from '../shared/intake/handle.js';

// Vercel Function: POST /api/intake. Runs in fixture mode until the intake agent
// (Lethabo, F2) is wired in; the response says which mode answered.
export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: 'Send JSON: { "text": "..." }' }, { status: 400 });
  }
  const result = await handleIntake(body);
  return Response.json(result, { status: result.ok ? 200 : 400 });
}
