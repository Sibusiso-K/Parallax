import { z } from 'zod';
import { chatJson, type Deps, type MetaConfig } from '../providers/meta.js';

// Scene from the founder's prompt (docs/scene-from-prompt.md). The 3D room is one fixed, CC0-built courtyard with five
// places and five objects, each with a job in the decision: the offer, what the work costs, the equipment, the figures
// and the memo. Muse Spark reads the founder's story and writes a dressing for that same room: what each place and
// object is in this founder's business ("Fuel and tyres" instead of "Ingredients and packaging" for a logistics
// company), a caption for each, a name for the setting, and a line describing where the founder stands, which Muse
// Image turns into their portrait. The geometry, the figures and the claims never come from the model.

export const PLACE_SLOTS = {
  spawn: 'the overview: the whole business at a glance',
  offer: 'where the decision on the table sits (the contract, order, hire or price change)',
  intake: 'where the figures the founder confirmed sit, beside the equipment',
  bridge: 'the gap between doing the work and being paid for it: where cash runs thin',
  memo: 'where the decision memo is written',
} as const;

export const OBJECT_SLOTS = {
  contract: 'the offer itself (the contract, order or deal document)',
  pan: 'the direct costs of doing the extra work (stock, materials, fuel, ingredients...)',
  fridge: 'the equipment or upfront purchase the decision needs, to buy or rent',
  intake_desk: 'the desk with the figures the founder confirmed',
  memo: 'the decision memo',
} as const;

export type PlaceSlot = keyof typeof PLACE_SLOTS;
export type ObjectSlot = keyof typeof OBJECT_SLOTS;

const line = (max: number) => z.string().trim().min(1).max(max);
const named = z.object({ label: line(32), caption: line(160) });
const placeShape = Object.fromEntries(Object.keys(PLACE_SLOTS).map((k) => [k, named])) as Record<PlaceSlot, typeof named>;
const objectShape = Object.fromEntries(Object.keys(OBJECT_SLOTS).map((k) => [k, named])) as Record<ObjectSlot, typeof named>;

export const sceneDressing = z.object({
  title: line(48),
  places: z.object(placeShape),
  objects: z.object(objectShape),
  /** Where the founder stands, for the portrait: setting and light only, never a named person. */
  portrait: line(300),
});
export type SceneDressing = z.infer<typeof sceneDressing>;

export const sceneRequest = z.object({
  context: z.object({
    business: z.string().max(200).optional(),
    location: z.string().max(120).optional(),
    decision: z.string().max(300).optional(),
    decisionType: z.enum(['contract', 'hire', 'pricing']).optional(),
    story: z.string().max(4000).optional(),
  }),
});
export type SceneRequest = z.infer<typeof sceneRequest>;

export function scenePrompt(req: SceneRequest): { system: string; user: string } {
  const c = req.context;
  const system = [
    "You dress a fixed 3D room for one founder's business decision, and reply with JSON only.",
    'The room has five places and five objects, each with a job. Give each a short label (2 to 4 words) naming what it is in THIS business, and a one-sentence caption saying what it stands for in this decision.',
    'Use the founder\'s own business and words. Never use a figure, amount, percentage or date. Never name a real person or company; "the client" or "the hotel group" is fine.',
    'title: a name for the setting, such as "The bakery" or "The depot" (at most 5 words, no person\'s name).',
    'portrait: one sentence describing where the founder stands for an editorial portrait photo: the setting, objects behind them and the light, in this business and place. Do not describe the person.',
    '',
    'PLACES:',
    ...Object.entries(PLACE_SLOTS).map(([k, v]) => `${k}: ${v}`),
    '',
    'OBJECTS:',
    ...Object.entries(OBJECT_SLOTS).map(([k, v]) => `${k}: ${v}`),
    '',
    'Reply as {"title": "...", "places": {"spawn": {"label": "...", "caption": "..."}, ...}, "objects": {"contract": {"label": "...", "caption": "..."}, ...}, "portrait": "..."}.',
  ].join('\n');
  const user = [
    c.business ? `Business: ${c.business}` : '',
    c.location ? `Where: ${c.location}` : '',
    c.decision ? `Decision: ${c.decision}` : '',
    c.decisionType ? `Kind of decision: ${c.decisionType}` : '',
    c.story ? `In the founder's words:\n"""${c.story.slice(0, 4000)}"""` : '',
  ]
    .filter(Boolean)
    .join('\n');
  return { system, user: user || 'A small business weighing a big decision.' };
}

export async function dressScene(cfg: MetaConfig, req: SceneRequest, deps?: Deps): Promise<{ dressing: SceneDressing; model: string }> {
  const { system, user } = scenePrompt(req);
  const { value, trace } = await chatJson(cfg, { name: 'scene', system, user, schema: sceneDressing, timeoutMs: 25_000 }, deps);
  return { dressing: value, model: trace.model };
}

interface Labelled {
  label: string;
}

/**
 * The room's manifest with this founder's labels. Positions, colliders and lighting are untouched, and a slot the
 * dressing does not name keeps its own label, so a partial or missing dressing can never break the room.
 */
export function applyDressing<M extends { places: Record<string, Labelled>; objects: Record<string, Labelled> }>(
  manifest: M,
  dressing: Pick<SceneDressing, 'places' | 'objects'> | null | undefined,
): M {
  if (!dressing) return manifest;
  const relabel = <T extends Labelled>(items: Record<string, T>, names: Record<string, { label: string }>) =>
    Object.fromEntries(Object.entries(items).map(([id, item]) => [id, names[id]?.label ? { ...item, label: names[id]!.label } : item]));
  return { ...manifest, places: relabel(manifest.places, dressing.places), objects: relabel(manifest.objects, dressing.objects) };
}
