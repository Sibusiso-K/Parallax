import { z } from 'zod';
import { photoManifestSchema, DEMO_MANIFEST_URL, type PhotoManifest } from '../../../../shared/world/manifest';
import { worldPlanSchema } from '../../../../shared/world/plan';
import { fingerprint } from '../../../../shared/scene/room-model';
import type { SamMask } from '../../../../shared/providers/sam';
import { compactImage, maskDataUrl, maskRect } from './masks';
import { cachedWorld, saveWorld } from './cache';

export interface WorldProgress { agent: 'World Builder'; step: string; state: 'running' | 'complete' | 'fallback'; model?: string }
export type WorldCall = (body: unknown, signal: AbortSignal) => Promise<Record<string, unknown>>;
export const callWorld: WorldCall = async (body, signal) => {
  const timeout = AbortSignal.timeout(55_000);
  const response = await fetch('/api/world', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.any([signal, timeout]) });
  const data = await response.json() as Record<string, unknown>;
  if (!response.ok || !data.ok) throw new Error(typeof data.error === 'string' ? data.error : 'World generation failed.');
  return data;
};
export interface WorldResult { manifest: PhotoManifest; source: 'generated' | 'cache' | 'demo'; message: string }
export async function demoWorld(signal: AbortSignal): Promise<PhotoManifest> {
  const response = await fetch(DEMO_MANIFEST_URL, { signal });
  if (!response.ok) throw new Error('The demo world has not been baked yet.');
  return photoManifestSchema.parse(await response.json());
}

export async function buildLiveWorld(story: string, options: { signal: AbortSignal; onProgress: (event: WorldProgress) => void; saveLocally?: boolean; call?: WorldCall }): Promise<WorldResult> {
  const { signal, onProgress } = options; const call = options.call ?? callWorld;
  const key = `world-v1:${fingerprint(story)}`;
  const event = (step: string, state: WorldProgress['state'], model?: string) => onProgress({ agent: 'World Builder', step, state, model });
  if (options.saveLocally) { const cached = await cachedWorld(key); if (cached) return { manifest: cached, source: 'cache', message: 'Saved generated world, restored from this device.' }; }
  const request = async (step: string, body: unknown, model: string) => {
    signal.throwIfAborted(); event(step, 'running', model);
    const result = await call(body, signal); signal.throwIfAborted();
    if (result.mode !== 'model') throw new Error('Live generation is not connected.');
    event(step, 'complete', model); return result;
  };
  try {
    const plan = worldPlanSchema.parse((await request('Planning your workplace', { action: 'plan', story }, 'muse-spark-1.3')).plan);
    const plateReply = await request('Drawing the daylight plate', { action: 'draw', prompt: plan.platePrompt }, 'muse-image-1.0');
    const plate = await compactImage(z.string().parse(plateReply.dataUrl), signal);
    const personReply = await request('Placing your fictional future self', { action: 'edit', references: [plate.dataUrl], prompt: `${plan.personPrompt} Keep the room and camera exactly fixed. Add the fictional adult behind the counter or desk.` }, 'muse-image-1.0');
    const person = await compactImage(z.string().parse(personReply.dataUrl), signal);
    const nightReply = await request('Re-lighting the same workplace', { action: 'edit', references: [plate.dataUrl], prompt: 'Keep the room and camera exactly fixed. Change to a tense evening with blank invoices on the desk. No person.' }, 'muse-image-1.0');
    const night = await compactImage(z.string().parse(nightReply.dataUrl), signal);
    const objects: PhotoManifest['objects'] = [];
    for (const object of plan.objects) {
      const result = await request(`Finding ${object.label}`, { action: 'segment', image: plate.dataUrl, width: plate.width, height: plate.height, concept: object.concept }, 'sam-3.1');
      const masks = result.masks as SamMask[];
      const mask = masks?.[0];
      if (mask) objects.push({ id: object.id, label: object.label.slice(0, 60), rect: maskRect(mask, plate.width, plate.height), mask: maskDataUrl(mask, plate.width, plate.height) });
    }
    const personResult = await request('Separating the person from the room', { action: 'segment', image: person.dataUrl, width: person.width, height: person.height, concept: 'person' }, 'sam-3.1');
    const personMask = (personResult.masks as SamMask[])?.[0];
    const personLayer = { src: person.dataUrl, ...(personMask ? { mask: maskDataUrl(personMask, person.width, person.height), rect: maskRect(personMask, person.width, person.height) } : {}) };
    const manifest = photoManifestSchema.parse({
      version: 1, id: key, title: plan.title.slice(0, 100), mode: 'generated', width: plate.width, height: plate.height,
      plate: plate.dataUrl, night: night.dataUrl, people: { A: personLayer, B: personLayer, C: personLayer }, objects,
      places: plan.rooms, disclosure: 'Illustrative imagery. Fictional people. Synthetic images.',
    });
    const saved = options.saveLocally ? await saveWorld(key, manifest) : false;
    return { manifest, source: 'generated', message: `Generated for your story. The same fictional person represents each path.${saved ? ' Saved on this device.' : options.saveLocally ? ' Local saving was unavailable.' : ''}${objects.length < 5 ? ' Some objects could not be located.' : ''}` };
  } catch (error) {
    if (signal.aborted) throw error;
    event('Using the baked demonstration', 'fallback');
    return { manifest: await demoWorld(signal), source: 'demo', message: 'Generation is unavailable. This is the baked demonstration world, not a generated version of your story.' };
  }
}
