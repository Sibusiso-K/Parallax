import { describe, expect, it } from 'vitest';
import { DEFAULT_BASE_URL, DEFAULT_MODELS, MAX_TOKENS } from './meta.js';

// The Meta client's fixed settings, as the docs quote them: a change here must be deliberate.
describe('Meta client constants', () => {
  it('match the values the docs quote', () => {
    expect(DEFAULT_BASE_URL).toBe('https://api.meta.ai/v1');
    expect(DEFAULT_MODELS).toEqual(['muse-spark-1.3', 'muse-spark-1.2']);
    expect(MAX_TOKENS).toBe(1024);
  });
});
