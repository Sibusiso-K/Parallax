import { describe, expect, it } from 'vitest';
import raw from '../../../public/worlds/courtyard-v1/manifest.json';
import { CourtyardManifest } from './manifest';
import { CourtyardController } from './controller';

describe('Rapier controller lifecycle', () => {
  it('continues walking and inspecting after overlapping controller creation and cleanup', async () => {
    const m = CourtyardManifest.parse(structuredClone(raw));
    for (let round = 0; round < 20; round++) {
      const [cancelled, active] = await Promise.all([CourtyardController.create(m), CourtyardController.create(m)]);
      try {
        cancelled.dispose();
        for (let frame = 0; frame < 180; frame++) {
          active.advance(1 / 60, { x: Math.sin(frame / 20), z: -1 }, 0);
          if (frame % 9 === 0) active.nearestVisible();
          if (frame % 37 === 0) active.recover();
        }
        expect(Number.isFinite(active.position.x)).toBe(true);
      } finally { cancelled.dispose(); active.dispose(); }
    }
  });
});
