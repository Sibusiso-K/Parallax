import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CourtyardManifest, OBJECT_IDS, PLACE_IDS, objectForNode, skyRotationY } from './manifest';

const world = (name: string) => fileURLToPath(new URL(`../../../public/worlds/courtyard-v1/${name}`, import.meta.url));
const raw = () => JSON.parse(readFileSync(world('manifest.json'), 'utf8')) as Record<string, unknown>;

/** Node names inside a GLB, read from its JSON chunk. */
function glbNodeNames(path: string): Set<string> {
  const b = readFileSync(path);
  expect(b.readUInt32LE(0)).toBe(0x46546c67); // 'glTF'
  const length = b.readUInt32LE(12);
  const json = JSON.parse(b.subarray(20, 20 + length).toString('utf8')) as { nodes: { name?: string }[] };
  return new Set(json.nodes.map((n) => n.name ?? ''));
}

describe('courtyard manifest', () => {
  const m = CourtyardManifest.parse(raw());

  it('validates strictly and names every place and object the app uses', () => {
    expect(Object.keys(m.places).sort()).toEqual([...PLACE_IDS].sort());
    expect(Object.keys(m.objects).sort()).toEqual([...OBJECT_IDS].sort());
    expect(m.places[m.spawn]).toBeDefined();
    for (const o of Object.values(m.objects)) expect(PLACE_IDS).toContain(o.place);
  });

  it('every interactive object is a real node in environment.glb', () => {
    const names = glbNodeNames(world(m.assets.environment));
    for (const id of OBJECT_IDS) expect(names.has(m.objects[id].node), `${id} -> ${m.objects[id].node}`).toBe(true);
  });

  it('colliders are real boxes and the sky turns by a finite angle', () => {
    expect(m.colliders.length).toBeGreaterThan(10);
    for (const c of m.colliders) expect(c.size.every((s) => s > 0)).toBe(true);
    expect(Number.isFinite(skyRotationY(m))).toBe(true);
    expect(m.lighting.sun.elevationDeg).toBeGreaterThan(0);
  });

  it('maps a picked node or any of its ancestors to its object', () => {
    expect(objectForNode(m, ['Mesh_12', m.objects.contract.node, 'Scene'])).toBe('contract');
    expect(objectForNode(m, ['env_brick', 'Scene'])).toBeNull();
  });

  it('refuses a manifest with a missing place or an object outside the world', () => {
    const noMemo = raw();
    delete (noMemo.places as Record<string, unknown>).memo;
    expect(CourtyardManifest.safeParse(noMemo).success).toBe(false);
    const stray = raw();
    (stray.objects as Record<string, { position: number[] }>).fridge!.position = [400, 0, 0];
    expect(CourtyardManifest.safeParse(stray).success).toBe(false);
  });
});
