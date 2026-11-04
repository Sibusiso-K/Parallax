import type { MetaConfig } from './meta.js';

// Muse Image on the Meta Model API: POST /images/generations, answered with base64 image data (webp). One portrait
// per decision, drawn from a setting line written by Muse Spark (shared/scene/dressing.ts). Uses the same key and
// switch as the text model (META_MODEL_ENABLED); META_IMAGE_MODEL overrides the model.

export const DEFAULT_IMAGE_MODEL = 'muse-image-1.0';
const TIMEOUT_MS = 45_000;

export interface ImageDeps {
  fetch: (url: string, init: RequestInit) => Promise<Response>;
}
const liveDeps: ImageDeps = { fetch: (url, init) => fetch(url, init) };

export class ImageError extends Error {
  readonly status?: number;
  /** The start of the API's own error reply, the key redacted. */
  detail?: string;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ImageError';
    this.status = status;
  }
}

/**
 * The portrait prompt. The setting comes from the model's scene line; everything about the person stays generic, so
 * no real person is depicted and nothing is guessed from the founder's story.
 */
export function portraitPrompt(setting: string): string {
  const where = setting.replace(/\s+/g, ' ').trim().slice(0, 300);
  return [
    'Editorial portrait photograph of a small-business founder in their own workplace, head and shoulders, looking at the camera with a calm, quietly confident expression.',
    `Setting: ${where}`,
    'Natural light, shallow depth of field, warm and honest, square crop. No text, no logos, no brand names, not a celebrity.',
  ].join(' ');
}

/** One generated portrait, as a data URL. Retries once on a rate limit or a server error. */
export async function generatePortrait(cfg: MetaConfig, setting: string, env: Record<string, string | undefined> = {}, deps: ImageDeps = liveDeps): Promise<{ dataUrl: string; model: string }> {
  const model = env.META_IMAGE_MODEL?.trim() || DEFAULT_IMAGE_MODEL;
  if (model.endsWith('-contributor')) throw new ImageError('contributor models train on what we send them, so they are refused');
  for (let attempt = 1; ; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await deps.fetch(`${cfg.baseUrl}/images/generations`, {
        method: 'POST',
        headers: { authorization: `Bearer ${cfg.apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({ model, prompt: portraitPrompt(setting), n: 1, size: '1024x1024' }),
        signal: controller.signal,
      });
    } catch {
      throw new ImageError(controller.signal.aborted ? 'no image within the time limit' : 'could not reach the image API');
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) {
      if (attempt < 2 && (res.status === 429 || res.status >= 500)) continue;
      const err = new ImageError(`the image API answered ${res.status}`, res.status);
      err.detail = (await res.text().catch(() => '')).slice(0, 240).split(cfg.apiKey).join('<key>');
      throw err;
    }
    const data = (await res.json().catch(() => null)) as { data?: { b64_json?: unknown }[]; output_format?: unknown } | null;
    const b64 = data?.data?.[0]?.b64_json;
    if (typeof b64 !== 'string' || !b64) throw new ImageError('the reply had no image');
    const format = typeof data?.output_format === 'string' && /^(webp|png|jpeg)$/.test(data.output_format) ? data.output_format : 'webp';
    return { dataUrl: `data:image/${format};base64,${b64}`, model };
  }
}
