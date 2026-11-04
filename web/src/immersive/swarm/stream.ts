import type { SwarmEvent, SwarmRequest } from '../../../../shared/swarm/contracts.js';

/** Incremental NDJSON parser: handles split UTF-8 and split lines, aborts, bounded buffers and explicit terminal state. */
export async function reviewStream(request: SwarmRequest, receive: (event: SwarmEvent) => void | Promise<void>, signal: AbortSignal, fetcher: typeof fetch = fetch) {
  const response = await fetcher('/api/swarm', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(request), signal });
  if (!response.ok || !response.body) throw new Error(response.status === 429 ? 'Please wait before starting another review.' : 'The review service is unavailable. Your decision is unchanged.');
  const reader = response.body.getReader(), decoder = new TextDecoder();
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener('abort', cancel, { once: true });
  let pending = '', ended = false;
  const line = async (text: string) => {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    if (!text.trim()) return;
    const value: unknown = JSON.parse(text);
    if (!value || typeof value !== 'object' || !('type' in value) || !['start', 'trace', 'result', 'error'].includes(String(value.type))) throw new Error('The review sent an unreadable update.');
    const event = value as SwarmEvent;
    if (event.type === 'error') throw new Error(event.message);
    if (event.type === 'result') ended = true;
    await receive(event);
  };
  try {
    while (true) {
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
      const { value, done } = await reader.read();
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
      pending += done ? decoder.decode() : decoder.decode(value, { stream: true });
      if (pending.length > 2_000_000) throw new Error('The review update was too large.');
      const lines = pending.split('\n'); pending = lines.pop() ?? '';
      for (const text of lines) await line(text);
      if (done) break;
    }
    await line(pending);
    if (!ended) throw new Error('The review was interrupted. You can try again.');
  } finally { signal.removeEventListener('abort', cancel); await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

/** Presentation pacing only for the explicitly labelled fixture replay. Never reported as model latency. */
export function fixtureBeat(signal: AbortSignal, ms = 100): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException('Aborted', 'AbortError')); return; }
    const abort = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); reject(new DOMException('Aborted', 'AbortError')); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
    signal.addEventListener('abort', abort, { once: true });
  });
}
