import { describe, expect, it } from "vitest";
import { restoreFrom } from "./parallax-store";

// A saved decision comes back from the database or the browser, so it is checked field by field: anything of the
// wrong shape falls back to its default, and a screen that needs paths never opens without them.

const path = { id: "p-a", letter: "A", name: "Stay lean", summary: "", startingCash: 120000, assumptions: [] };

describe("restoreFrom", () => {
  it("brings a saved decision back, screen and all", () => {
    const s = restoreFrom({ step: "compare", agreed: true, story: "We cater.", fields: { decision: "Take the contract" }, paths: [path] });
    expect(s).toMatchObject({ step: "compare", agreed: true, story: "We cater.", fields: { decision: "Take the contract" } });
    expect(s?.paths).toHaveLength(1);
    expect(s?.chats).toEqual({ A: [], B: [], C: [] });
  });

  it("offers nothing to resume when nothing was written", () => {
    expect(restoreFrom(null)).toBeNull();
    expect(restoreFrom({ step: "start", story: "  " })).toBeNull();
  });

  it("drops fields of the wrong shape instead of trusting them", () => {
    const s = restoreFrom({ step: "heard", story: 42, fields: "nope", chats: { A: "x" }, comfort: [1] });
    expect(s?.story).toBe("");
    expect(s?.fields).toEqual({});
    expect(Array.isArray(s?.chats.A)).toBe(true);
    expect(s?.comfort).toEqual({ A: [], B: [], C: [] });
  });

  it("never opens a paths screen without valid paths, and never an unknown screen", () => {
    expect(restoreFrom({ step: "summary", story: "x", fields: { business: "Bakery" }, paths: [{ id: 1 }] })?.step).toBe("heard");
    expect(restoreFrom({ step: "chat", story: "x", paths: [] })?.step).toBe("intake");
    expect(restoreFrom({ step: "nowhere", story: "x" })?.step).toBe("start");
  });
});
