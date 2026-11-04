import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { templatePaths } from "../../../../shared/paths/templates";
import { buildProfile } from "../../../../shared/profile/profile";
import { DEMO_EXTRACTION } from "../../../../shared/intake/fixture";
import { CompareScreen, SummaryScreen } from "./DecideScreens";
import { TraceList } from "./ChatScreen";
import { ExploreScreen } from "./ExploreScreen";
import { GeneratingScreen } from "./ProfileScreens";
import { StartScreen } from "./StartScreens";

const state = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock("@/lib/parallax-store", () => ({ useParallax: () => state.current, LETTERS: ["A", "B", "C"] }));
vi.mock("./StepNav", () => ({ StepNav: () => null }));

describe("honest screen copy", () => {
  it("waits for settings before making model or storage claims", () => {
    state.current = { agreed: false, resume: null };
    const html = renderToStaticMarkup(createElement(StartScreen));
    expect(html).toContain("Checking model and saving settings");
    expect(html).not.toContain("No model is connected");
    expect(html).not.toContain("keeps nothing");
    expect(html).toContain("Contract decisions also open in a 3D room");
  });
  it("omits checks that never ran, including old saved null checks", () => {
    const html = renderToStaticMarkup(createElement(TraceList, { checks: [
      { name: "unrun", ok: null }, { name: "passed", ok: true }, { name: "failed", ok: false },
    ] }));
    expect(html).not.toContain("unrun");
    expect(html).toContain("passed");
    expect(html).toContain("failed");
  });
  it.each(["hire", "pricing"] as const)("keeps %s comparison and memo free of contract setback claims", (kind) => {
    const paths = templatePaths(buildProfile({ ...DEMO_EXTRACTION, decisionType: { value: kind, quote: kind } }));
    state.current = { paths, fields: { decisionType: kind }, comfort: { A: [], B: [], C: [] }, bothering: "",
      assumed: [], followed: [], chosen: null, decision: null, reasons: "", questions: "", pathOf: () => undefined };
    for (const Screen of [CompareScreen, SummaryScreen]) {
      const html = renderToStaticMarkup(createElement(Screen));
      expect(html.toLowerCase()).not.toContain("late payment");
      expect(html.toLowerCase()).not.toContain("30-day terms");
      expect(html).not.toContain("Muse Image");
    }
    state.current = { ...state.current, sessionId: "test", revision: 1, active: "A", story: "A shop", explore: { stressed: { A: false, B: false, C: false }, month: 1 } };
    const html = renderToStaticMarkup(createElement(ExploreScreen));
    expect(html).toContain("Try a stress test");
    expect(html).toContain("Compare and write a memo");
  });
  it("does not claim to draw a portrait or run the engine while preparing templates", () => {
    state.current = { profile: { fields: {}, assumed: [] }, intake: null };
    const html = renderToStaticMarkup(createElement(GeneratingScreen));
    expect(html).toContain("Preparing three template paths");
    expect(html).not.toContain("Drawing");
    expect(html).not.toContain("Running 36 months");
  });
});
