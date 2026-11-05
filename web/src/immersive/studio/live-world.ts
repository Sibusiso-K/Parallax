import { z } from 'zod';
import { photoManifestSchema, DEMO_MANIFEST_URL, type PhotoManifest } from '../../../../shared/world/manifest';
import { visibleObjectsSchema } from '../../../../shared/world/objects';
import { worldPlanSchema } from '../../../../shared/world/plan';
import { fingerprint } from '../../../../shared/scene/room-model';
import type { SamMask } from '../../../../shared/providers/sam';
import { compactImage, maskDataUrl, maskRect, registeredPatch } from './masks';
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
  const key = `world-v2:${fingerprint(story)}`;
  const event = (step: string, state: WorldProgress['state'], model?: string) => onProgress({ agent: 'World Builder', step, state, model });
  if (options.saveLocally) { const cached = await cachedWorld(key); if (cached) return { manifest: cached, source: 'cache', message: 'Saved generated world, restored from this device.' }; }
  let active = 0; const queue: (() => void)[] = [];
  const request = async (step: string, body: unknown, model: string) => {
    if (active >= 6) await new Promise<void>(resolve => queue.push(resolve));
    else active++;
    try {
      signal.throwIfAborted(); event(step, 'running', model);
      const result = await call(body, signal); signal.throwIfAborted();
      if (result.mode !== 'model') throw new Error('Live generation is not connected.');
      event(step, 'complete', model); return result;
    } catch (error) { event(step, 'fallback', model); throw error; }
    finally { const next = queue.shift(); if (next) next(); else active--; }
  };
  try {
    const plan = worldPlanSchema.parse((await request('Planning your workplace', { action: 'plan', story }, 'muse-spark-1.3')).plan);
    const plateReply = await request('Drawing the daylight plate', { action: 'draw', prompt: `${plan.platePrompt} Eye-level wide shot from the customer's side. A clear worktop, counter or table runs across the foreground. The middle of the room behind it is open and uncluttered. No people, no figures in mirrors, no mirrors facing the camera.` }, 'muse-image-1.0');
    const plate = await compactImage(z.string().parse(plateReply.dataUrl), signal);
    const drawEdit = async (step: string, reference: string, prompt: string) => {
      const reply = await request(step, { action: 'edit', references: [reference], prompt }, 'muse-image-1.0');
      return compactImage(z.string().parse(reply.dataUrl), signal);
    };
    const [person, night] = await Promise.all([
      drawEdit('Placing your fictional future self', plate.dataUrl, `${plan.personPrompt} Add this one fictional adult founder standing behind the foreground worktop at the exact centre of the frame, facing the camera, seen from the waist up, close enough that the face is clear and fills about a quarter of the frame height. Same light as the room. Looking directly at the camera, calm and warm, mouth closed. Keep the room, camera and every object exactly the same.`),
      drawEdit('Re-lighting the same workplace', plate.dataUrl, 'Keep the room, camera and every object exactly fixed. Change only the light to evening. No people, no figures in mirrors, no text, numerals or logos.'),
    ]);
    const segment = async (step: string, image: typeof plate, concept: string, box?: {left:number;top:number;right:number;bottom:number}) => {
      try {
        const result = await request(step, { action: 'segment', image: image.dataUrl, width: image.width, height: image.height, concept, ...(box ? {box} : {}) }, 'sam-3.1');
        return (result.masks as SamMask[] | undefined) ?? [];
      } catch (error) { if (signal.aborted) throw error; return []; }
    };
    let approximate = false;
    const objectsTask = async (): Promise<PhotoManifest['objects']> => {
      let found; let mappingFailed = false;
      try { found = visibleObjectsSchema.parse(await request('Finding objects in your actual room', { action: 'objects', image: plate.dataUrl, story }, 'muse-spark-1.3')).objects; }
      catch (error) {
        if (signal.aborted) throw error;
        approximate = true; mappingFailed = true;
        // Deterministic spaced targets remain available if visual mapping fails entirely.
        found = plan.objects.map((o, i) => ({ ...o, box: [i * 200, 650, i * 200 + 180, 900] as [number,number,number,number] }));
      }
      return Promise.all(found.map(async object => {
        const [l,t,r,b] = object.box;
        const box = { left: Math.floor(l * plate.width / 1000), top: Math.floor(t * plate.height / 1000), right: Math.ceil(r * plate.width / 1000), bottom: Math.ceil(b * plate.height / 1000) };
        const mask = (await segment(`Finding ${object.label}`, plate, object.concept, mappingFailed ? undefined : box))[0];
        const rect = mask ? maskRect(mask, plate.width, plate.height) : {x:l/1000,y:t/1000,width:(r-l)/1000,height:(b-t)/1000};
        if (!mask) approximate = true;
        return { id: object.id, label: object.label.slice(0,39), rect, ...(mask ? {mask:maskDataUrl(mask,plate.width,plate.height)} : {}),
          ...((mask || !mappingFailed) && ['contract','memo'].includes(object.id) ? {paper:{x:rect.x+rect.width*.12,y:rect.y+rect.height*.12,width:rect.width*.76,height:rect.height*.76}} : {}) };
      }));
    };
    const personTask = segment('Separating the person from the room', person, 'person');
    const mouthTask = segment('Locating the mouth', person, 'mouth');
    const eyesTask = segment('Locating the eyes', person, 'eyes');
    const shapes = [['ah','mouth open saying ah'], ['ee','mouth slightly open, corners wide saying ee'], ['oo','lips rounded saying oo'], ['fv','upper teeth touching lower lip saying f'], ['mm','lips gently pressed together saying m'], ['blink','both eyelids closed in a natural blink']] as const;
    const framesTask = Promise.all(shapes.map(async ([shape, instruction]) => {
      try {
        const masks = await (shape === 'blink' ? eyesTask : mouthTask);
        if (!masks.length) return null;
        const frame = await drawEdit(`Animating ${shape}`, person.dataUrl, `Keep everything exactly the same, pixel-aligned: camera, pose, lighting, facial identity and expression. Only change their ${shape === 'blink' ? 'eyes' : 'mouth'}: ${instruction}.`);
        return [shape, await registeredPatch(person.dataUrl, frame.dataUrl, masks, person.width, person.height, shape === 'blink', signal)] as const;
      } catch (error) { if (signal.aborted) throw error; return null; }
    }));
    const [objects, personMasks, patches] = await Promise.all([objectsTask(), personTask, framesTask]);
    const personMask = personMasks[0];
    const frames = Object.fromEntries(patches.filter(p => p !== null));
    const lips = (await eyesTask).length > 0 && shapes.slice(0,5).every(([shape]) => shape in frames);
    // Do not alternate incomplete visemes with the rest face.
    if (!lips) for (const [shape] of shapes.slice(0,5)) delete frames[shape];
    const personLayer = { src: person.dataUrl, frames, ...(personMask ? { mask: maskDataUrl(personMask, person.width, person.height), rect: maskRect(personMask, person.width, person.height) } : {}) };
    const manifest = photoManifestSchema.parse({
      version: 1, id: key, title: plan.title.slice(0, 100), mode: 'generated', width: plate.width, height: plate.height,
      plate: plate.dataUrl, night: night.dataUrl, people: { A: personLayer, B: personLayer, C: personLayer }, objects,
      places: plan.rooms, disclosure: 'Illustrative imagery. Fictional people. Synthetic images.',
    });
    const saved = options.saveLocally ? await saveWorld(key, manifest) : false;
    return { manifest, source: 'generated', message: `Generated for your story. The same fictional person represents each path.${saved ? ' Saved on this device.' : options.saveLocally ? ' Local saving was unavailable.' : ''}${approximate ? ' Some object targets are approximate.' : ''}${!lips ? ' The person will not move their lips.' : ''}` };
  } catch (error) {
    if (signal.aborted) throw error;
    event('Using the baked demonstration', 'fallback');
    return { manifest: await demoWorld(signal), source: 'demo', message: 'Generation is unavailable. This is the baked demonstration world, not a generated version of your story.' };
  }
}
