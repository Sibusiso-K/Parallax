// Seeded random numbers for the stress tests: the same seed gives the same run, so a failure can be replayed.

export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Whole number from lo to hi, both included. */
export const int = (r: () => number, lo: number, hi: number): number => lo + Math.floor(r() * (hi - lo + 1));

export const pick = <T>(r: () => number, items: readonly T[]): T => items[Math.floor(r() * items.length)]!;
