import { z } from 'zod';

export const objectSlot = z.enum(['contract', 'pan', 'fridge', 'intake_desk', 'memo']);
export type WorldObjectSlot = z.infer<typeof objectSlot>;
// All geometry is normalised to the full plate, never to a cropped mask.
export const rectSchema = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), width: z.number().positive().max(1), height: z.number().positive().max(1) })
  .refine(r => r.x + r.width <= 1.001 && r.y + r.height <= 1.001, 'Rect extends past the plate');
export type WorldRect = z.infer<typeof rectSchema>;
export const assetUrl = z.string().max(4_200_000).refine(s => /^\/(?!\/)[^\\]*$/.test(s) || /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(s), 'Use a local asset or inline image');
const patch = z.object({ src: assetUrl, rect: rectSchema });
export const personSchema = z.object({
  src: assetUrl, mask: assetUrl.optional(), rect: rectSchema.optional(),
  frames: z.object({ rest: patch.optional(), ah: patch.optional(), ee: patch.optional(), oo: patch.optional(), fv: patch.optional(), mm: patch.optional(), blink: patch.optional() }).optional(),
});
export const photoManifestSchema = z.object({
  version: z.literal(1), id: z.string().min(1).max(120), title: z.string().min(1).max(100),
  mode: z.enum(['baked', 'generated']), width: z.number().int().positive().max(8192), height: z.number().int().positive().max(8192),
  plate: assetUrl, night: assetUrl, foreground: assetUrl.optional(),
  people: z.object({ A: personSchema, B: personSchema, C: personSchema }),
  objects: z.array(z.object({ id: objectSlot, label: z.string().max(60), rect: rectSchema, mask: assetUrl.optional(), paper: rectSchema.optional() })).max(5),
  places: z.array(z.object({ id: z.string().max(40), label: z.string().max(60), rect: rectSchema })).max(8),
  disclosure: z.literal('Illustrative imagery. Fictional people. Synthetic images.'),
});
export type PhotoManifest = z.infer<typeof photoManifestSchema>;
export const worldManifestSchema = photoManifestSchema;
export type WorldManifest = PhotoManifest;
export const DEMO_MANIFEST_URL = '/worlds/photo-demo/manifest.json';
