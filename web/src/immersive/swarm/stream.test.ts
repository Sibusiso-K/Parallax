import { describe, expect, it } from 'vitest';
import { fixtureBeat, reviewStream } from './stream.js';
import { swarmRequest, type SwarmEvent } from '../../../../shared/swarm/contracts.js';
import { NODE_POSITIONS } from './layout.js';
const req = swarmRequest.parse({ event: 'Review', month: 1, stressed: false, path: { id: 'A', letter: 'A', name: 'Stay small', startingCash: 0, assumptions: [{ id: 'A1', label: 'Income', kind: 'income', low: 0, base: 0, high: 0 }] } });
const start = { type: 'start', mode: 'fixture', inputKey: 'key' };
const result = { type: 'result', result: { mode: 'fixture', inputKey: 'key', note: 'Café' } };
const streamOf = (text: string) => new Response(new ReadableStream({ start(c) { for (const byte of new TextEncoder().encode(text)) c.enqueue(Uint8Array.of(byte)); c.close(); } }));
describe('board transport', () => {
  it('decodes byte-split UTF-8 and a final line without a newline', async () => {
    const events: SwarmEvent[] = [];
    await reviewStream(req, e => { events.push(e); }, new AbortController().signal, async () => streamOf(JSON.stringify(start) + '\n' + JSON.stringify(result)));
    expect(events).toEqual([start, result]);
  });
  it('rejects truncated streams, malformed messages and explicit errors', async () => {
    for (const text of [JSON.stringify(start), '{bad}\n', '{"type":"error","message":"Interrupted"}\n', '{"type":"unknown"}\n']) {
      await expect(reviewStream(req, () => {}, new AbortController().signal, async () => streamOf(text))).rejects.toThrow();
    }
  });
  it('does not deliver updates after an abort', async () => {
    const controller = new AbortController(); controller.abort();
    let events = 0;
    await expect(reviewStream(req, () => { events++; }, controller.signal, async () => streamOf(JSON.stringify(result)))).rejects.toThrow();
    expect(events).toBe(0);
  });
  it('cancels a pending reader immediately when the decision changes', async () => {
    const controller = new AbortController(); let cancelled = false, received = 0;
    const response = new Response(new ReadableStream({ cancel() { cancelled = true; } }));
    const pending = reviewStream(req, () => { received++; }, controller.signal, async () => response);
    await Promise.resolve();
    controller.abort();
    await expect(pending).rejects.toThrow();
    expect(cancelled).toBe(true); expect(received).toBe(0);
  });
  it('awaits replay consumers in order and cancels presentation pacing', async () => {
    const seen: string[] = [];
    await reviewStream(req, async e => { await Promise.resolve(); seen.push(e.type); }, new AbortController().signal, async () => streamOf(JSON.stringify(start) + '\n' + JSON.stringify(result)));
    expect(seen).toEqual(['start', 'result']);
    const controller = new AbortController(), beat = fixtureBeat(controller.signal, 1000);
    controller.abort(); await expect(beat).rejects.toThrow();
  });
  it('keeps every node inside a deterministic, collision-free viewbox', () => {
    const positions = Object.values(NODE_POSITIONS);
    for (const a of positions) {
      expect(a.x).toBeGreaterThan(45); expect(a.x).toBeLessThan(475);
      expect(a.y).toBeGreaterThan(30); expect(a.y + 59).toBeLessThanOrEqual(461);
      for (const b of positions) if (a !== b) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(90);
    }
  });
});
