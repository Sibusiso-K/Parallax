import { describe, expect, it } from "vitest";
import { chartStep } from "./charts";

// The cash chart's gridlines. A fixed R200 000 step drew thousands of lines for a path in the billions, which froze the
// chart and hid the curve; the step now grows with the range and keeps the count to about ten.

const lines = (lo: number, hi: number) => {
  const step = chartStep(lo, hi);
  return Math.ceil(hi / step) - Math.floor(lo / step) + 1;
};

describe("chartStep", () => {
  it("keeps the R200 000 step for the demo's range", () => {
    expect(chartStep(-474_000, 1_254_000)).toBe(200_000);
  });

  it("never goes below R200 000, even for a flat or tiny range", () => {
    expect(chartStep(0, 0)).toBe(200_000);
    expect(chartStep(-5_000, 40_000)).toBe(200_000);
  });

  it("uses a round step (1, 2 or 5 times a power of ten) for large ranges", () => {
    expect(chartStep(0, 10_000_000)).toBe(1_000_000);
    expect(chartStep(-143_000_000_000, 0)).toBe(20_000_000_000);
  });

  it("draws at most about a dozen gridlines whatever the figures", () => {
    for (const [lo, hi] of [
      [-474_000, 1_254_000],
      [0, 3_000_000],
      [-2_500_000, 7_100_000],
      [-143_000_000_000, 0],
      [0, 1_000_000_000_000],
    ] as const) {
      expect(lines(lo, hi)).toBeLessThanOrEqual(13);
      expect(lines(lo, hi)).toBeGreaterThanOrEqual(2);
    }
  });
});
