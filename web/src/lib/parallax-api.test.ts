import { afterEach, describe, expect, it, vi } from "vitest";
import { DEMO_EXTRACTION } from "../../../shared/intake/fixture";
import { mockApi } from "./parallax-api";

// What the founder sees when /api/intake is slow, broken or refused. The hook must never throw, never lose the typed
// text (it stays in the store; intake only reports), and always leave a plain-English notice.

const reply = (body: unknown, status = 200) => new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
const stub = (fn: () => Response | Promise<Response>) => vi.stubGlobal("fetch", vi.fn(fn));

afterEach(() => vi.unstubAllGlobals());

describe("mockApi.intake, the request", () => {
  it("sends exactly POST /api/intake as JSON, and reads { fields, missing, mode, notice }", async () => {
    const seen: { url: string; init: RequestInit }[] = [];
    stub(async (url?: unknown, init?: RequestInit) => {
      seen.push({ url: String(url), init: init! });
      return reply({ ok: true, mode: "fixture", fields: DEMO_EXTRACTION, missing: ["payroll", "decision"], dropped: [], issues: [] });
    });
    const res = await mockApi.intake("Should I take the contract?");
    expect(seen).toHaveLength(1);
    expect(seen[0]!.url).toBe("/api/intake");
    expect(seen[0]!.init.method).toBe("POST");
    expect(seen[0]!.init.headers).toEqual({ "content-type": "application/json" });
    expect(JSON.parse(String(seen[0]!.init.body))).toEqual({ text: "Should I take the contract?" });
    expect(res).toMatchObject({ ok: true, mode: "fixture", missing: ["payroll"] });
    expect(res.fields.revenue).toMatchObject({ low: 75000, high: 105000 });
    expect(res.fields.decision).toBe("Take on a 12-month corporate lunch contract");
    expect(res.quotes?.revenue).toBeUndefined(); // a money field carries its own quote
    expect(res.quotes?.decision).toBe("Should I take the contract?");
    expect(res.notice).toMatch(/Demo mode/);
  });
});

describe("mockApi.intake, failure and refusal", () => {
  const failures: [string, Response][] = [
    ["413 too large", reply({ ok: false, error: "Request is too large. Keep your text under 4,000 characters." }, 413)],
    ["415 wrong type", reply({ ok: false, error: "Send the text as JSON: { \"text\": \"...\" }" }, 415)],
    ["500 server", reply({ ok: false, error: "Something went wrong. Your text is kept." }, 500)],
    ["502 upstream", reply({ ok: false, error: "We couldn't reach the model. Your text is kept; please fill in the form." }, 502)],
  ];

  for (const [name, response] of failures) {
    it(`keeps the text and shows the server's plain message on ${name}`, async () => {
      stub(() => response.clone());
      const res = await mockApi.intake("My story");
      expect(res.ok).toBe(true);
      expect(res.mode).toBe("fixture");
      expect(res.fields).toEqual({});
      expect(res.missing).toEqual(expect.arrayContaining(["decisionType", "revenue", "directCosts", "cash"]));
      expect(res.missing).not.toContain("decision");
      expect(res.notice).toEqual((await response.clone().json()).error);
    });
  }

  it("uses its own plain message when the server refuses without one", async () => {
    stub(() => reply({ ok: false }, 500));
    const res = await mockApi.intake("My story");
    expect(res.notice).toBeTruthy();
    expect(res.notice).toMatch(/text is kept/i);
    expect(res.fields).toEqual({});
  });

  it("falls back cleanly when the body is not JSON at all", async () => {
    stub(() => new Response("<html>Internal Server Error</html>", { status: 500, headers: { "content-type": "text/html" } }));
    const res = await mockApi.intake("My story");
    expect(res.ok).toBe(true);
    expect(res.fields).toEqual({});
    expect(res.missing).toContain("decisionType");
    expect(res.notice).toMatch(/couldn.t reach Parallax/);
  });

  it("falls back cleanly when the network fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new TypeError("fetch failed");
    }));
    const res = await mockApi.intake("My story");
    expect(res.ok).toBe(true);
    expect(res.fields).toEqual({});
    expect(res.notice).toMatch(/couldn.t reach Parallax/);
  });

  it("never rejects, whatever the answer is", async () => {
    for (const body of [null, [], "hello", 42, true, {}]) {
      stub(() => reply(body, 200));
      await expect(mockApi.intake("My story")).resolves.toMatchObject({ ok: true });
    }
  });
});

describe("mockApi.paths", () => {
  const demoProfile = { fields: { decision: "Take the contract", decisionType: "contract", business: "Catering", revenue: { low: 75000, high: 105000, base: 90000, quote: "R75k to R105k" }, cash: { low: 120000, high: 120000, base: 120000, quote: "R120k" } }, assumed: [] };

  it("maps the profile to three cards with the avatars the path screens show", async () => {
    const cards = await mockApi.paths(demoProfile);
    expect(cards.map((c) => c.letter)).toEqual(["A", "B", "C"]);
    for (const card of cards) {
      expect(card).toMatchObject({ id: card.letter, avatarUrl: `/avatars/${card.letter}.png` });
      expect(card.name.length).toBeGreaterThan(0);
      expect(card.assumptions.length).toBeGreaterThan(0);
      expect(Number.isFinite(card.startingCash)).toBe(true);
    }
    expect(mockApi.simulate(cards[0]!).likely.rows).toHaveLength(36);
  });

  it("refuses to build paths before the kind of decision is known, with one clear sentence", async () => {
    await expect(mockApi.paths({ fields: { business: "Catering" }, assumed: [] })).rejects.toThrow("Choose a kind of decision first");
  });
});
