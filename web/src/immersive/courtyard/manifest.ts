import { z } from 'zod';

// The courtyard's single source of positions: places, interactive objects, colliders and lighting, written by
// assets/blender/build_courtyard.py next to environment.glb. The app validates it strictly and refuses a malformed
// world instead of half-rendering one. Coordinates are runtime metres, Y up.

export const WORLD_BASE = '/worlds/courtyard-v1/';
export const PLACE_IDS = ['spawn', 'offer', 'intake', 'bridge', 'memo'] as const;
export const OBJECT_IDS = ['contract', 'pan', 'fridge', 'intake_desk', 'memo'] as const;
export type PlaceId = (typeof PLACE_IDS)[number];
export type ObjectId = (typeof OBJECT_IDS)[number];

const Vec3 = z.tuple([z.number(), z.number(), z.number()]);

const Place = z.object({ label: z.string().min(1), stand: Vec3, camera: Vec3, target: Vec3 });

const SceneObject = z.object({
  label: z.string().min(1),
  node: z.string().min(1),
  place: z.enum(PLACE_IDS),
  radius: z.number().positive(),
  actions: z.array(z.string()).min(1),
  claimBinding: z.string().nullable(),
  position: Vec3,
});

const Collider = z.object({ id: z.string().min(1), shape: z.literal('box'), center: Vec3, size: Vec3 });

const PointLight = z.object({
  id: z.string(),
  type: z.literal('point'),
  position: Vec3,
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
  intensity: z.number().nonnegative(),
  distance: z.number().positive(),
});

export const CourtyardManifest = z
  .object({
    version: z.literal(1),
    assetVersion: z.string(),
    worldId: z.literal('courtyard-v1'),
    units: z.literal('metres'),
    up: z.literal('y'),
    bounds: z.object({ min: Vec3, max: Vec3 }),
    eyeHeight: z.number().positive(),
    spawn: z.enum(PLACE_IDS),
    places: z.record(z.enum(PLACE_IDS), Place),
    objects: z.record(z.enum(OBJECT_IDS), SceneObject),
    colliders: z.array(Collider).min(1),
    lighting: z.object({
      hdri: z.object({
        lighting: z.string(),
        background: z.string(),
        assetId: z.string(),
        glowUV: z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]),
        glowRadiance: z.number(),
      }),
      sun: z.object({ direction: Vec3, elevationDeg: z.number(), color: z.string(), intensity: z.number().positive() }),
      skyIntensity: z.number().positive(),
      blenderWorldRotationZ: z.number(),
      lights: z.array(PointLight),
      exposure: z.number().positive(),
    }),
    assets: z.object({ environment: z.string(), plantsPlaced: z.number().int().nonnegative() }),
    provenance: z.string(),
  })
  .superRefine((m, ctx) => {
    const inside = (p: readonly number[]) => p.every((v, i) => v >= m.bounds.min[i]! && v <= m.bounds.max[i]!);
    for (const [id, place] of Object.entries(m.places)) {
      for (const key of ['stand', 'camera', 'target'] as const) {
        if (!inside(place[key])) ctx.addIssue({ code: 'custom', message: `place ${id} ${key} is outside the world bounds`, path: ['places', id, key] });
      }
    }
    for (const [id, o] of Object.entries(m.objects)) {
      if (!inside(o.position)) ctx.addIssue({ code: 'custom', message: `object ${id} is outside the world bounds`, path: ['objects', id] });
    }
  });

export type CourtyardManifest = z.infer<typeof CourtyardManifest>;

export async function loadManifest(fetcher: typeof fetch = fetch): Promise<CourtyardManifest> {
  const res = await fetcher(`${WORLD_BASE}manifest.json`);
  if (!res.ok) throw new Error(`The courtyard manifest did not load (${res.status}).`);
  return CourtyardManifest.parse(await res.json());
}

/**
 * Rotation about Y that puts the sky panorama's sunset glow behind the scene's sun. Three samples an equirect map at
 * u = atan2(z, x) / 2π + 0.5, and a rotation of r about Y moves a direction's azimuth by -r.
 */
export function skyRotationY(m: CourtyardManifest): number {
  const theta = (m.lighting.hdri.glowUV[0] - 0.5) * 2 * Math.PI;
  const [x, , z] = m.lighting.sun.direction;
  return Math.atan2(z, x) - theta;
}

/** Interactive object whose node (or one of its ancestors) has this name. */
export function objectForNode(m: CourtyardManifest, names: readonly string[]): ObjectId | null {
  for (const id of OBJECT_IDS) if (names.includes(m.objects[id].node)) return id;
  return null;
}
