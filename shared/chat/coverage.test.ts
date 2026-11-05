import { describe, expect, it } from 'vitest';
import { figureTable } from '../engine/analysis.js';
import { templatePaths } from '../paths/templates.js';
import { buildProfile } from '../profile/profile.js';
import { DEMO_EXTRACTION } from '../intake/fixture.js';

// The figures the future-self check asks replies to state come from the engine. This test makes sure those keys exist,
// so the live check can never pass by checking nothing.
const path = templatePaths(buildProfile({ ...DEMO_EXTRACTION, payroll: { low: 21000, high: 21000, quote: '21k' } }))[1]!;
const table = figureTable(path);

describe('the figures the future-self check relies on', () => {
  for (const key of [`${path.id}.lowest.likely`, `${path.id}.cash.m12.likely`, `${path.id}.cash.m36.likely`]) {
    it(`the engine provides ${key}`, () => {
      expect(typeof table[key]).toBe('number');
      expect(Number.isFinite(table[key])).toBe(true);
    });
  }
});
