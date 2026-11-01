import { describe, expect, it } from 'vitest';
import { isLite } from './lite';

const nav = (hints: object) => hints as Navigator;

describe('isLite', () => {
  it('turns on for reduced motion, Save-Data or low memory', () => {
    expect(isLite(nav({}), true)).toBe(true);
    expect(isLite(nav({ connection: { saveData: true } }), false)).toBe(true);
    expect(isLite(nav({ deviceMemory: 4 }), false)).toBe(true);
  });

  it('stays off when nothing asks for it or the browser reports nothing', () => {
    expect(isLite(nav({ deviceMemory: 8 }), false)).toBe(false);
    expect(isLite(nav({}), false)).toBe(false);
  });
});
