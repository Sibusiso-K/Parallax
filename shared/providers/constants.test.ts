import { describe, expect, it } from 'vitest';
import { DEFAULT_BASE_URL, DEFAULT_MODELS, MAX_TOKENS, REASONING_EFFORT } from './meta.js';

// The Meta client's fixed settings, as the docs quote them: a change here must be deliberate.
describe('Meta client constants', () => {
  it('match the values the docs quote', () => {
    expect(DEFAULT_BASE_URL).toBe('https://api.meta.ai/v1');
    expect(DEFAULT_MODELS).toEqual(['muse-spark-1.3', 'muse-spark-1.2']);
    // Reasoning counts against the cap: at 1,024 a live intake came back empty (4 Nov 2026).
    expect(MAX_TOKENS).toBe(8192);
    expect(REASONING_EFFORT).toBe('minimal');
  });
});
