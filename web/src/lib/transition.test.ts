import { afterEach, describe, expect, it, vi } from "vitest";
import { withTransition } from "./parallax-store";

// Every screen change goes through withTransition. It must always land, whatever the View Transition API does: a
// founder who switched tabs while the model read their story came back to a screen that never moved on.

type Vt = (cb: () => void) => { ready: Promise<void> };
const page = (visible: boolean, startViewTransition?: Vt) =>
  vi.stubGlobal("document", {
    visibilityState: visible ? "visible" : "hidden",
    documentElement: { hasAttribute: () => false },
    ...(startViewTransition ? { startViewTransition } : {}),
  });

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("withTransition", () => {
  it("swaps at once in a hidden tab, without asking for an animation", () => {
    const vt = vi.fn<Vt>(() => ({ ready: Promise.resolve() }));
    page(false, vt);
    const fn = vi.fn();
    withTransition(fn);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(vt).not.toHaveBeenCalled();
  });

  it("swaps at once where the browser has no View Transitions", () => {
    page(true);
    const fn = vi.fn();
    withTransition(fn);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("runs the update once when the browser calls back, even after the fallback timer", () => {
    vi.useFakeTimers();
    page(true, (cb) => {
      cb();
      return { ready: Promise.resolve() };
    });
    const fn = vi.fn();
    withTransition(fn);
    vi.advanceTimersByTime(2000);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("still lands within a second when the browser holds the update back", () => {
    vi.useFakeTimers();
    page(true, () => ({ ready: new Promise<void>(() => {}) }));
    const fn = vi.fn();
    withTransition(fn);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("swallows a skipped transition instead of logging an uncaught error", async () => {
    page(true, (cb) => {
      cb();
      return { ready: Promise.reject(new Error("Transition was skipped")) };
    });
    const fn = vi.fn();
    withTransition(fn);
    await new Promise((r) => setTimeout(r, 0));
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
