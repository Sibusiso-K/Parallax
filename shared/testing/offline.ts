import { beforeEach, vi } from 'vitest';

// No test may reach a real network, so no test can spend Meta credits. A test that needs the model stubs fetch itself.
beforeEach(() => {
  vi.stubGlobal('fetch', async (input: unknown) => {
    throw new Error(`network blocked in tests: ${String(input)}`);
  });
});
