import { describe, expect, it } from "vitest";
import { memoQuestion, moneyDraft, parseAmount } from "./format";

// The parser behind every typed follow-up and every edited assumption. It must read the same shorthand the intake's
// own parser reads, so "8 to 12k" never becomes a range from R8 to R12 000.

describe("parseAmount", () => {
  it("reads single values the ways people type them", () => {
    expect(parseAmount("8000")).toEqual({ low: 8000, high: 8000, base: 8000 });
    expect(parseAmount("8k")).toEqual({ low: 8000, high: 8000, base: 8000 });
    expect(parseAmount("R8 000")).toEqual({ low: 8000, high: 8000, base: 8000 });
    expect(parseAmount("8,000.50")).toEqual({ low: 8001, high: 8001, base: 8001 });
    expect(parseAmount("about 8k")).toEqual({ low: 8000, high: 8000, base: 8000 });
    expect(parseAmount("1 000 000 000")).toEqual({ low: 1_000_000_000, high: 1_000_000_000, base: 1_000_000_000 });
  });

  it("reads a range, including a unit on the right end only", () => {
    expect(parseAmount("8k to 12k")).toEqual({ low: 8000, high: 12000, base: 10000 });
    expect(parseAmount("8 to 12k")).toEqual({ low: 8000, high: 12000, base: 10000 });
    expect(parseAmount("8-12k")).toEqual({ low: 8000, high: 12000, base: 10000 });
    expect(parseAmount("R8 000 to R12 000")).toEqual({ low: 8000, high: 12000, base: 10000 });
    expect(parseAmount("0 to 1m")).toEqual({ low: 0, high: 1_000_000, base: 500_000 });
  });

  it("does not scale a left end that is already in rand", () => {
    expect(parseAmount("8000 to 12k")).toEqual({ low: 8000, high: 12000, base: 10000 });
    expect(parseAmount("999 to 1k")).toEqual({ low: 999, high: 1000, base: 1000 });
  });

  it("returns null for blanks, words, negatives and extra pieces", () => {
    for (const input of ["", "   ", "eight thousand", "lots", "-500", "R-500", "−500", "-500 to 200", "8 to 12 to 15"]) expect(parseAmount(input)).toBeNull();
  });
});

describe("moneyDraft", () => {
  it("gives the edit box a range the parser can read, never the sentence it came from", () => {
    expect(moneyDraft({ low: 120000, high: 120000, base: 120000, quote: "R120,000 in the business account" })).toBe("120000");
    expect(moneyDraft({ low: 75000, high: 105000, base: 90000, quote: "about R90,000 a month, anywhere from R75k to R105k" })).toBe("75000 to 105000");
    expect(parseAmount(moneyDraft({ low: 75000, high: 105000, quote: "about R90,000 a month" }))).toEqual({ low: 75000, high: 105000, base: 90000 });
  });
});

describe("memoQuestion", () => {
  it("keeps the founder's words and prints exactly one question mark", () => {
    expect(memoQuestion("Should I take the contract?")).toBe("Should I take the contract?");
    expect(memoQuestion("should I hire")).toBe("Should I hire?");
    expect(memoQuestion("Take on the contract!")).toBe("Take on the contract?");
    expect(memoQuestion(undefined)).toBe("Your decision?");
    expect(memoQuestion("   ")).toBe("Your decision?");
    expect(memoQuestion(42)).toBe("Your decision?");
  });
});
