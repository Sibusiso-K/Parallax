import { z } from 'zod';
import type { MetaConfig } from '../providers/meta.js';

export type ProviderFetch = (url: string, init: RequestInit) => Promise<Response>;
export const imageInput = z.string().max(3_900_000).regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/);
export const documentInput = z.string().max(3_900_000).regex(/^data:(image\/(jpeg|png|webp)|application\/pdf);base64,[A-Za-z0-9+/]+={0,2}$/);
/** A single paid call, including reading its body, bounded below the function deadline. No silent retries. */
export async function providerPost(cfg: MetaConfig, path: string, body: unknown, request: ProviderFetch = fetch): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 48_000);
  try {
    const response = await request(`${cfg.baseUrl}${path}`, {
      method: 'POST', headers: { authorization: `Bearer ${cfg.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify(body), signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Provider unavailable (${response.status}).`);
    const text = await response.text();
    if (text.length > 4_300_000) throw new Error('Provider reply is too large.');
    return JSON.parse(text) as unknown;
  } catch {
    // Never return upstream error text: it can contain document contents or credentials.
    throw new Error(controller.signal.aborted ? 'The model took too long. Please try again.' : 'The model could not complete this request.');
  } finally { clearTimeout(timer); }
}

export function responseText(value: unknown): string {
  const parsed = z.object({ output: z.array(z.object({ content: z.array(z.object({ text: z.string().optional() }).passthrough()).optional() }).passthrough()) }).parse(value);
  return parsed.output.flatMap(o => o.content ?? []).map(c => c.text ?? '').join('\n');
}

export async function sparkJson<S extends z.ZodType>(cfg: MetaConfig, schema: S, system: string, user: string, request?: ProviderFetch): Promise<z.output<S>> {
  const format = z.toJSONSchema(schema);
  const data = await providerPost(cfg, '/chat/completions', {
    model: 'muse-spark-1.3', reasoning_effort: 'minimal', temperature: 0, max_tokens: 2600,
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    response_format: { type: 'json_schema', json_schema: { name: 'world_plan', strict: false, schema: format } },
  }, request);
  const reply = z.object({ choices: z.array(z.object({ message: z.object({ content: z.string() }) })) }).parse(data);
  return schema.parse(JSON.parse(reply.choices[0]!.message.content));
}

export async function readBody(request: Request, limit = 4_200_000): Promise<unknown> {
  if (Number(request.headers.get('content-length')) > limit) throw new Error('Request too large.');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Missing request.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new Error('Request too large.'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}
export const worldJson = (value: unknown, status = 200) => Response.json(value, { status, headers: { 'cache-control': 'no-store' } });
