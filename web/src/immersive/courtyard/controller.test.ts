import { describe, expect, it } from 'vitest';
import raw from '../../../public/worlds/courtyard-v1/manifest.json';
import { CourtyardManifest } from './manifest';
import { CourtyardController } from './controller';
import { MovementInput } from './input';

const manifest = () => CourtyardManifest.parse(structuredClone(raw));
describe('movement input', () => {
  it('normalizes diagonals, tracks aliases and clears on text focus', () => {
    const input = new MovementInput();
    input.keyDown('KeyW'); input.keyDown('ArrowUp'); input.keyDown('KeyD');
    expect(Math.hypot(input.vector().x, input.vector().z)).toBeCloseTo(1);
    input.keyUp('KeyW'); expect(input.vector().z).toBeLessThan(0);
    input.keyDown('KeyA', true); expect(input.vector()).toEqual({ x: 0, z: 0 });
  });
});
describe('Rapier courtyard controller', () => {
  it('traverses the courtyard route and returns using manifest collision boxes', async () => {
    const c = await CourtyardController.create(manifest());
    const route = [[-3.1, 9], [-3.1, 5.2], [-3.3, -0.9], [-3.3, -3], [0, -3], [3.3, -3], [4, -7.6], [3.3, -3], [0, -3], [-3.3, -3], [-3.1, 4.5], [-3.05, 5.2], [-3.1, 9], [0, 9]];
    try {
      for (const [x, z] of route) {
        for (let i = 0; i < 400; i++) {
          const p = c.position, dx = x! - p.x, dz = z! - p.z;
          if (Math.hypot(dx, dz) < 0.16) break;
          c.advance(1 / 60, { x: dx, z: dz }, 0);
        }
        expect(Math.hypot(c.position.x - x!, c.position.z - z!), `waypoint ${x}, ${z}`).toBeLessThan(0.2);
        expect(c.position.y).toBeGreaterThan(0.8);
      }
    } finally { c.dispose(); }
  });
  it('stands on the floor, moves and is stopped by the back wall', async () => {
    const c = await CourtyardController.create(manifest());
    try {
      for (let i = 0; i < 180; i++) c.advance(1 / 60, { x: 0, z: 1 }, 0);
      expect(c.isGrounded).toBe(true);
      expect(c.position.y).toBeGreaterThan(0.8);
      expect(c.position.z).toBeLessThan(12.2);
      expect(c.position.z).toBeGreaterThan(11);
    } finally { c.dispose(); }
  });
  it('clamps suspended time and can recover to spawn', async () => {
    const m = manifest(); const c = await CourtyardController.create(m);
    try {
      const start = c.position.z;
      c.advance(60, { x: 0, z: -1 }, 0);
      expect(start - c.position.z).toBeLessThan(0.25);
      c.recover(); expect(c.position.z).toBeCloseTo(m.places.spawn.stand[2]);
    } finally { c.dispose(); }
  });
  it('can inspect the memo board from its courtyard approach', async () => {
    const m = manifest(); m.places.spawn.stand = [4, 0, -8.5];
    const c = await CourtyardController.create(m);
    try { expect(c.nearestVisible('memo')).toBe('memo'); } finally { c.dispose(); }
  });
  it('requires distance and unobstructed line of sight for objects', async () => {
    const m = manifest();
    m.places.spawn.stand = [-2.9, 0, 5.2];
    const c = await CourtyardController.create(m);
    try {
      expect(['contract', 'pan']).toContain(c.nearestVisible());
      expect(c.nearestVisible('contract')).toBe('contract');
      expect(c.nearestVisible('memo')).toBeNull();
      m.objects.contract.radius = 0.01; m.objects.pan.radius = 0.01;
      expect(c.nearestVisible()).toBeNull();
    } finally { c.dispose(); }
    const blocked = manifest(); blocked.places.spawn.stand = [-2.9, 0, 5.2];
    blocked.colliders.push({ id: 'test_wall', shape: 'box', center: [-3.25, 1.1, 5.6], size: [0.1, 3, 3] });
    const other = await CourtyardController.create(blocked);
    try { expect(other.nearestVisible()).toBeNull(); expect(other.nearestVisible('contract')).toBeNull(); } finally { other.dispose(); }
  });
});
