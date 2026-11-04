import { z } from 'zod';
import type { MetaConfig } from './meta.js';
import { imageInput, providerPost, responseText, type ProviderFetch } from '../world/provider.js';
import { buildObjectPrompt, formats } from '../world/vendor/package/dist/index.js';
import type { SegmentationMaskRecord } from '../world/vendor/package/dist/index.js';

export const pixelBox = z.object({ left: z.number().int().nonnegative(), top: z.number().int().nonnegative(), right: z.number().int().positive(), bottom: z.number().int().positive() })
  .refine(b => b.left < b.right && b.top < b.bottom, 'Empty box');
export const segmentRequest = z.object({
  image: imageInput, concept: z.string().trim().min(1).max(100),
  width: z.number().int().positive().max(4096), height: z.number().int().positive().max(4096), box: pixelBox.optional(),
});
export type SegmentRequest = z.infer<typeof segmentRequest>;
export type SamMask = Pick<SegmentationMaskRecord, 'objectId' | 'mask' | 'bounds'>;

export function parseSamText(text: string): SamMask[] {
  // The official decoder validates the codec but has no application allocation quota.
  // Bound dimensions BEFORE invoking it, not after it has allocated a raster.
  if (text.length > 4_200_000) throw new Error('The segmentation was too large.');
  const dimensions = [...text.matchAll(/data=(\d+),(\d+),/g)];
  if (dimensions.length > 32 || dimensions.some(m => Number(m[1]) > 4096 || Number(m[2]) > 4096 || Number(m[1]) * Number(m[2]) > 4096 * 4096)) throw new Error('The segmentation was too large.');
  const parser = formats.segmentation.image().createParser();
  parser.push(text);
  const result = parser.finish({ status: 'completed' }).result;
  if (result.diagnostics.some(d => d.severity === 'error')) throw new Error('The segmentation was not readable.');
  return result.records.filter((r): r is SegmentationMaskRecord => r.kind === 'mask')
    .filter(r => r.mask.width * r.mask.height <= 4096 * 4096).slice(0, 8)
    .map(({ objectId, mask, bounds }) => ({ objectId, mask, bounds }));
}

export async function segmentImage(cfg: MetaConfig, input: SegmentRequest, deps?: ProviderFetch): Promise<{ masks: SamMask[]; model: string }> {
  const req = segmentRequest.parse(input);
  const prompt = req.box ? buildObjectPrompt({ size: { width: req.width, height: req.height }, objects: [{ id: 0, prompts: [{ box: req.box }] }] }) : req.concept;
  const result = await providerPost(cfg, '/responses', {
    model: 'sam-3.1', stream: false,
    input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }, { type: 'input_image', image_url: req.image }] }],
  }, deps);
  const masks = parseSamText(responseText(result)).filter(m => m.bounds.left >= 0 && m.bounds.top >= 0 && m.bounds.right <= req.width && m.bounds.bottom <= req.height);
  return { masks, model: 'sam-3.1' };
}
