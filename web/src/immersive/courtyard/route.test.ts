import { describe, expect, it } from 'vitest';
import raw from '../../../public/worlds/courtyard-v1/manifest.json';
import { CourtyardController } from './controller';
import { CourtyardManifest, type PlaceId } from './manifest';
import { routeTo, stopForObject, turnToward, yawToward } from './route';

const manifest = () => CourtyardManifest.parse(structuredClone(raw));
const PLACES: PlaceId[] = ['spawn', 'offer', 'intake', 'bridge', 'memo'];

describe('walking routes', () => {
  it('walks between every pair of places through the real colliders, without falling or sticking', async () => {
    const m = manifest();
    const c = await CourtyardController.create(m);
    try {
      for (const from of PLACES) {
        for (const to of PLACES) {
          if (from === to) continue;
          c.standAt(m.places[from].stand);
          c.advance(1 / 60, { x: 0, z: 0 }, 0);
          for (const point of routeTo(c.position, to)) {
            for (let i = 0; i < 1200; i++) {
              const p = c.position;
              const dx = point.x - p.x;
              const dz = point.z - p.z;
              if (Math.hypot(dx, dz) < 0.2) break;
              c.advance(1 / 60, { x: dx, z: dz }, 0);
            }
            expect(Math.hypot(c.position.x - point.x, c.position.z - point.z), `${from} to ${to}, at ${point.x}, ${point.z}`).toBeLessThan(0.25);
            expect(c.position.y, `${from} to ${to} stays on the floor`).toBeGreaterThan(0.8);
          }
        }
      }
    } finally {
      c.dispose();
    }
  }, 120_000);

  it('gives the same route every time', () => {
    const from = { x: 0.4, z: 8.1 };
    expect(routeTo(from, 'memo')).toEqual(routeTo(from, 'memo'));
  });

  it('crosses by the bridge to reach the memo from the intake desk', () => {
    const route = routeTo({ x: -2.9, z: -0.9 }, 'memo');
    expect(route.some((p) => p.x === 0 && p.z === -3)).toBe(true);
    expect(route.at(-1)).toEqual({ x: 4, z: -7.6 });
  });

  it('reaches the fridge stop through the real colliders', async () => {
    const c = await CourtyardController.create(manifest());
    try {
      for (const point of routeTo(c.position, 'fridge')) {
        for (let i = 0; i < 1200; i++) {
          const p = c.position;
          if (Math.hypot(point.x - p.x, point.z - p.z) < 0.2) break;
          c.advance(1 / 60, { x: point.x - p.x, z: point.z - p.z }, 0);
        }
        expect(Math.hypot(c.position.x - point.x, c.position.z - point.z)).toBeLessThan(0.25);
      }
    } finally {
      c.dispose();
    }
  }, 60_000);

  it('every object can be inspected from its stop', async () => {
    for (const id of ['contract', 'pan', 'fridge', 'intake_desk', 'memo'] as const) {
      const standing = manifest();
      const stop = routeTo({ x: 0, z: 9 }, stopForObject(id)).at(-1)!;
      standing.places.spawn.stand = [stop.x, 0, stop.z];
      const c = await CourtyardController.create(standing);
      try {
        expect(c.nearestVisible(id), id).toBe(id);
      } finally {
        c.dispose();
      }
    }
  });

  it('turns the short way round and faces what it should', () => {
    expect(yawToward({ x: 0, z: 0 }, { x: 0, z: -5 })).toBeCloseTo(0);
    expect(yawToward({ x: 0, z: 0 }, { x: -5, z: 0 })).toBeCloseTo(Math.PI / 2);
    expect(turnToward(3.1, -3.1, 0.05)).toBeGreaterThan(3.1);
    expect(turnToward(1, 1.02, 0.05)).toBe(1.02);
  });
});
