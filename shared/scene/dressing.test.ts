import { describe, expect, it } from 'vitest';
import { applyDressing, dressScene, scenePrompt, sceneDressing, type SceneDressing } from './dressing.js';
import { generatePortrait, portraitPrompt } from '../providers/image.js';
import type { Deps, MetaConfig } from '../providers/meta.js';

// The room is dressed for the founder's own business by Muse Spark, and their portrait drawn by Muse Image. Labels
// change; positions never do. Offline: both models are stubs.

const cfg: MetaConfig = { apiKey: 'test-key-not-real', baseUrl: 'https://api.meta.ai/v1', models: ['muse-spark-1.3'] };
const named = (label: string) => ({ label, caption: `${label}, in this decision.` });
const DEPOT: SceneDressing = {
  title: 'The depot',
  places: { spawn: named('Depot yard'), offer: named('Retail contract'), intake: named('Fleet desk'), bridge: named('Payment gap'), memo: named('Decision desk') },
  objects: { contract: named('Delivery contract'), pan: named('Fuel and tyres'), fridge: named('Two new trucks'), intake_desk: named('Fleet figures'), memo: named('Decision memo') },
  portrait: 'A truck depot at dawn, delivery trucks lined up behind, soft morning light.',
};

const stubModel = (reply: unknown): Deps => ({
  fetch: async () => Response.json({ choices: [{ message: { content: JSON.stringify(reply) } }] }),
  sleep: async () => {},
  now: () => 0,
  random: () => 0,
});

describe('scenePrompt', () => {
  it("names every place and object slot with its job, and carries the founder's own words", () => {
    const { system, user } = scenePrompt({ context: { business: 'Logistics company', location: 'Pretoria', decisionType: 'contract', story: 'We run six trucks.' } });
    for (const slot of ['spawn', 'offer', 'intake', 'bridge', 'memo', 'contract', 'pan', 'fridge', 'intake_desk']) expect(system).toContain(`${slot}:`);
    expect(system).toMatch(/Never use a figure/);
    expect(user).toContain('Business: Logistics company');
    expect(user).toContain('We run six trucks.');
  });
});

describe('dressScene', () => {
  it('returns a dressing that passes the schema', async () => {
    const { dressing, model } = await dressScene(cfg, { context: { business: 'Logistics company' } }, stubModel(DEPOT));
    expect(dressing.objects.pan.label).toBe('Fuel and tyres');
    expect(model).toBe('muse-spark-1.3');
  });

  it('refuses a dressing with a missing slot (after one repair try)', async () => {
    const broken = { ...DEPOT, objects: { ...DEPOT.objects, fridge: undefined } };
    await expect(dressScene(cfg, { context: {} }, stubModel(broken))).rejects.toMatchObject({ kind: 'schema' });
  });
});

describe('applyDressing', () => {
  const manifest = {
    version: 1,
    places: { spawn: { label: 'Courtyard', stand: [0, 0, 9] }, offer: { label: 'Offer', stand: [1, 0, 2] } },
    objects: { pan: { label: 'Ingredients and packaging', position: [1, 1, 1] }, fridge: { label: 'Second fridge', position: [2, 1, 1] } },
  };

  it("relabels places and objects for this founder, and moves nothing", () => {
    const dressed = applyDressing(manifest, DEPOT);
    expect(dressed.places.spawn).toEqual({ label: 'Depot yard', stand: [0, 0, 9] });
    expect(dressed.objects.pan).toEqual({ label: 'Fuel and tyres', position: [1, 1, 1] });
    expect(dressed.objects.fridge.label).toBe('Two new trucks');
    expect(manifest.objects.pan.label).toBe('Ingredients and packaging');
  });

  it('keeps the built room as it is with no dressing, or for a slot the dressing leaves out', () => {
    expect(applyDressing(manifest, null)).toBe(manifest);
    const partial = { places: { spawn: named('Yard') }, objects: {} } as unknown as SceneDressing;
    const dressed = applyDressing(manifest, partial);
    expect(dressed.places.offer.label).toBe('Offer');
    expect(dressed.objects.pan.label).toBe('Ingredients and packaging');
  });

  it('caps labels and captions so a long reply cannot break the room', () => {
    expect(sceneDressing.safeParse({ ...DEPOT, title: 'x'.repeat(49) }).success).toBe(false);
    expect(sceneDressing.safeParse({ ...DEPOT, places: { ...DEPOT.places, spawn: { label: 'x'.repeat(33), caption: 'c' } } }).success).toBe(false);
  });
});

describe('generatePortrait', () => {
  it('asks Muse Image for one square portrait in the setting, and returns it as a data URL', async () => {
    const seen: { url: string; body: { model: string; prompt: string; n: number; size: string } }[] = [];
    const out = await generatePortrait(cfg, DEPOT.portrait, {}, {
      fetch: async (url, init) => {
        seen.push({ url, body: JSON.parse(String(init.body)) });
        return Response.json({ data: [{ b64_json: 'AAAA' }], output_format: 'webp' });
      },
    });
    expect(out).toEqual({ dataUrl: 'data:image/webp;base64,AAAA', model: 'muse-image-1.0' });
    expect(seen[0]!.url).toBe('https://api.meta.ai/v1/images/generations');
    expect(seen[0]!.body).toMatchObject({ model: 'muse-image-1.0', n: 1, size: '1024x1024' });
    expect(seen[0]!.body.prompt).toContain('truck depot at dawn');
  });

  it('keeps the person generic and refuses contributor models', async () => {
    expect(portraitPrompt('A bakery.')).toMatch(/No text, no logos, no brand names, not a celebrity/);
    await expect(generatePortrait(cfg, 'x', { META_IMAGE_MODEL: 'muse-image-1.0-contributor' })).rejects.toThrow(/contributor/);
  });

  it('retries once on a server error, then gives up', async () => {
    let calls = 0;
    const deps = { fetch: async () => (calls++, new Response('{}', { status: 503 })) };
    await expect(generatePortrait(cfg, 'x', {}, deps)).rejects.toMatchObject({ status: 503 });
    expect(calls).toBe(2);
  });
});
