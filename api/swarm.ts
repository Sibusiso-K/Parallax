import { guardPaidRoute } from '../shared/swarm/paid-guard.js';
import { isCrossSite } from '../shared/http/guard.js';
import { modelConfigOrNull } from '../shared/providers/meta.js';
import { swarmRequest } from '../shared/swarm/contracts.js';
import { runSwarm } from '../shared/swarm/run.js';
import { simulate } from '../shared/engine/simulate.js';
import { readRates } from '../shared/swarm/rates.js';

export const maxDuration = 60;
export async function POST(request: Request): Promise<Response> {
  const config = modelConfigOrNull(process.env);
  // Adapter retains the shared guard and adds a swarm-specific budget without editing its owner's files.
  const denied = config ? guardPaidRoute(request, 'swarm') : isCrossSite(request) ? Response.json({ error: 'Cross-site request refused' }, { status: 403 }) : null;
  if (denied) return denied;
  if (Number(request.headers.get('content-length') ?? 0) > 65536) return Response.json({ error: 'Request too large' }, { status: 413 });
  let raw: unknown;
  try { const text = await request.text(); if (new TextEncoder().encode(text).length > 65536) return Response.json({ error: 'Request too large' }, { status: 413 }); raw = JSON.parse(text); }
  catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const parsed = swarmRequest.safeParse(raw);
  if (!parsed.success) return Response.json({ error: 'Invalid decision review request' }, { status: 400 });
  try {
    simulate(parsed.data.path);
    if (new Set(parsed.data.path.assumptions.map(a => a.id)).size !== parsed.data.path.assumptions.length) throw new Error('Duplicate IDs');
  } catch { return Response.json({ error: 'Invalid assumptions' }, { status: 400 }); }
  const controller = new AbortController();
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(sink) {
      void runSwarm(parsed.data, event => { if (!controller.signal.aborted) sink.enqueue(encoder.encode(JSON.stringify(event) + '\n')); }, { config, signal: AbortSignal.any([request.signal, controller.signal]), rates: readRates(process.env.META_SWARM_RATES_JSON) })
        .catch(() => { if (!controller.signal.aborted) sink.enqueue(encoder.encode(JSON.stringify({ type: 'error', message: 'Review interrupted. Your assumptions are unchanged.' }) + '\n')); })
        .finally(() => { if (!controller.signal.aborted) sink.close(); });
    },
    cancel() { controller.abort(); },
  });
  return new Response(stream, { headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store, no-transform', 'x-accel-buffering': 'no' } });
}
