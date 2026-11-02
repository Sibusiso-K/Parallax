import { describe, expect, it } from "vitest";
import { DEMO_EXTRACTION } from "../../../shared/intake/fixture";
import { templatePaths } from "../../../shared/paths/templates";
import { buildProfile } from "../../../shared/profile/profile";
import { pathFigures } from "./stress";

// The demo founder on the three contract paths, with R21,000 of wages given as the follow-up answer. These are the
// figures the Control Room mockup and DEMO.md quote, so a change here must be deliberate.
const founder = buildProfile({ ...DEMO_EXTRACTION, payroll: { low: 21000, high: 21000, quote: "21k" } });
const [a, b, c] = templatePaths(founder).map((p) => pathFigures(p));

describe("the figures the Control Room shows", () => {
  it("gives cash at month 36 for each case", () => {
    expect([a!.bad.at(-1), a!.likely.at(-1), a!.good.at(-1)]).toEqual([-150000, 174000, 498000]);
    expect([b!.bad.at(-1), b!.likely.at(-1), b!.good.at(-1)]).toEqual([83000, 479000, 839000]);
    expect([c!.bad.at(-1), c!.likely.at(-1), c!.good.at(-1)]).toEqual([93000, 489000, 849000]);
  });

  it("gives the lowest cash in the likely case, and the month it falls", () => {
    expect(a!.lowestLikely).toEqual({ cash: 121500, month: 1 });
    expect(b!.lowestLikely).toEqual({ cash: 33000, month: 2 });
    expect(c!.lowestLikely).toEqual({ cash: 87750, month: 1 });
  });

  it("gives the late-payment low point, and whether cash runs out", () => {
    expect(a!.late.lowest).toEqual({ cash: 98100, month: 7 });
    expect(b!.late.lowest).toEqual({ cash: -29000, month: 4 });
    expect(b!.late.runsOut).toBe(4);
    expect(c!.late.lowest).toEqual({ cash: 23250, month: 3 });
    expect(c!.late.runsOut).toBeNull();
  });

  it("gives the first bad-case runout, and the month three months of fixed costs are covered", () => {
    expect(a!.runsOutBad).toBe(17);
    expect(b!.runsOutBad).toBeNull();
    expect([a!.bufferMonth, b!.bufferMonth, c!.bufferMonth]).toEqual([25, 8, 5]);
  });

  it("names the setback that leaves the lowest cash on each path", () => {
    expect(a!.worst).toMatchObject({ id: "lost-client", lowest: { cash: 83400, month: 8 } });
    expect(b!.worst).toMatchObject({ id: "late-payment", lowest: { cash: -29000, month: 4 } });
    expect(c!.worst).toMatchObject({ id: "late-payment", lowest: { cash: 23250, month: 3 } });
  });

  it("gives month 36 under a lost client on path B", () => {
    expect(b!.setbacks.find((s) => s.id === "lost-client")?.month36).toBe(430400);
  });
});
