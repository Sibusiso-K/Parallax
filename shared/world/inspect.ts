import { z } from 'zod';
import type { MetaConfig } from '../providers/meta.js';
import { imageInput, providerPost, responseText, type ProviderFetch } from './provider.js';

const seen = z.object({
  readableText: z.boolean(),
  numerals: z.boolean(),
  logos: z.boolean(),
  changeVisible: z.boolean(),
  note: z.string().max(160).default(''),
});
export interface RepaintReview { pass: boolean; seen: z.output<typeof seen>; model: string }

/** Muse Spark looks at what Muse Image painted. Code decides: any text, numeral or logo in a repaint is rejected. */
export async function reviewRepaint(cfg: MetaConfig, image: string, change: string, request?: ProviderFetch): Promise<RepaintReview> {
  imageInput.parse(image);
  const prompt = [
    'You are the art director checking one generated photograph before a founder sees it.',
    'It must not contain words, numbers or logos anywhere, because every figure in this product comes from code and must never appear painted into an image.',
    `The change that was asked for: ${change}`,
    'Look closely at paper, screens, boxes and walls. Return JSON only: {"readableText":boolean,"numerals":boolean,"logos":boolean,"changeVisible":boolean,"note":"under 15 words on what you saw"}.',
  ].join(' ');
  const result = await providerPost(cfg, '/responses', {
    model: 'muse-spark-1.3', stream: false, reasoning: { effort: 'minimal' }, max_output_tokens: 1400,
    input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }, { type: 'input_image', image_url: image }] }],
  }, request);
  const text = responseText(result);
  const start = text.indexOf('{'), end = text.lastIndexOf('}');
  const found = seen.parse(JSON.parse(start >= 0 && end > start ? text.slice(start, end + 1) : ''));
  return { pass: !found.readableText && !found.numerals && !found.logos, seen: found, model: 'muse-spark-1.3' };
}
