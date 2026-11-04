import { EventEmitter } from 'node:events';
import type { ServerResponse } from 'node:http';
import { expect, it } from 'vitest';
import { pipeWebResponse } from './dev-stream.js';

it('writes the first chunk before the source finishes, respecting backpressure', async () => {
  let source!: ReadableStreamDefaultController<Uint8Array>;
  const response = new Response(new ReadableStream<Uint8Array>({ start(c) { source = c; c.enqueue(new TextEncoder().encode('first\n')); } }));
  const chunks: string[] = [];
  const res = Object.assign(new EventEmitter(), { statusCode: 0, destroyed: false, setHeader: () => {}, flushHeaders: () => {}, write: (v: Uint8Array) => { chunks.push(new TextDecoder().decode(v)); return false; }, end: () => {} });
  const pending = pipeWebResponse(response, res as unknown as ServerResponse);
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(chunks).toEqual(['first\n']);
  source.enqueue(new TextEncoder().encode('last\n')); source.close(); res.emit('drain');
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(chunks).toEqual(['first\n', 'last\n']); res.emit('drain');
  await pending;
});
