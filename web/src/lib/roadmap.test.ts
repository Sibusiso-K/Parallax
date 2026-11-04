import { describe, expect, it } from "vitest";
import { buildRoadmap, firstBelowZero, type RoadmapChat, type RoadmapInput, type RoadmapNode } from "./roadmap";
import type { Figures, Setback } from "./stress";
import type { PathCard } from "./types";

// The roadmap is built from figures the path screens already show. These tests use small hand-made figures, so they
// check the shape of the tree and its wording, not the engine.

const SETBACKS = [
  { id: "late-payment", name: "Late payment", detail: "a client pays 2 months late, then catches up" },
  { id: "lost-client", name: "Lost client", detail: "your biggest client stops buying for 3 months" },
  { id: "slow-season", name: "Slow season", detail: "two quiet months" },
  { id: "equipment-breakdown", name: "Equipment breakdown", detail: "one repair of R40 000" },
  { id: "cost-rise", name: "Cost rise", detail: "costs rise 10% for a year" },
] as const;

/** Cash at the start and at the end of each of 36 months. With dipAt set, that month is below zero. */
function series(dipAt?: number): number[] {
  return Array.from({ length: 37 }, (_, m) => (m === dipAt ? -150000 : m === 0 ? 120000 : 300000));
}

function figuresFor(opts: { dipAt?: number; runsOutSetbackId?: string; bufferMonth?: number | null } = {}): Figures {
  const likely = series(opts.dipAt);
  const low = Math.min(...likely);
  const setbacks = SETBACKS.map((s, i) => ({
    id: s.id,
    name: s.name,
    detail: s.detail,
    lowest: { cash: 90000 - i * 1000, month: 2 },
    month36: 250000,
    runsOut: s.id === opts.runsOutSetbackId ? 4 : null,
    line: likely,
  })) as Setback[];
  return {
    bad: likely,
    likely,
    good: likely,
    lowestLikely: { cash: low, month: likely.indexOf(low) },
    runsOutBad: null,
    bufferMonth: opts.bufferMonth ?? null,
    setbacks,
    late: setbacks[0]!,
    worst: setbacks[0]!,
  };
}

const path = (letter: "A" | "B" | "C", name: string): PathCard => ({
  id: `p-${letter.toLowerCase()}`,
  letter,
  name,
  summary: `Summary of ${name}.`,
  startingCash: 120000,
  assumptions: [],
});

const input = (over: Partial<RoadmapInput> = {}): RoadmapInput => ({
  decision: "Take on a 12-month corporate lunch contract",
  business: "meal-prep and catering business",
  // Out of order on purpose: the roadmap always shows A, B, C.
  paths: [path("B", "Take it as offered"), path("A", "Stay lean"), path("C", "Take it on safer terms")],
  figures: { A: figuresFor(), B: figuresFor({ dipAt: 3, runsOutSetbackId: "late-payment" }), C: figuresFor({ bufferMonth: 8 }) },
  chats: {},
  questions: [],
  ...over,
});

function findAll(node: RoadmapNode, pred: (n: RoadmapNode) => boolean): RoadmapNode[] {
  const out: RoadmapNode[] = [];
  const walk = (n: RoadmapNode) => {
    if (pred(n)) out.push(n);
    n.children.forEach(walk);
  };
  walk(node);
  return out;
}

describe("firstBelowZero", () => {
  it("finds the first month below zero, ignoring the start", () => {
    expect(firstBelowZero([-5, 10, 20, -1, -2])).toBe(3);
    expect(firstBelowZero([0, 10, 20])).toBeNull();
  });
});

describe("buildRoadmap", () => {
  it("makes the decision the root, with each question the app asked branching off it", () => {
    const r = buildRoadmap(
      input({
        questions: [
          { key: "payroll", question: "What do staff wages come to a month, in total?", answered: true },
          { key: "debtRepayments", question: "Does the business repay any debt each month?", answered: false },
        ],
      }),
    );
    expect(r.root.kind).toBe("decision");
    expect(r.root.title).toBe("Take on a 12-month corporate lunch contract");
    expect(r.root.detail).toBe("Meal-prep and catering business");
    expect(r.root.children.map((c) => c.kind)).toEqual(["question", "question"]);
    expect(r.root.children[0]!.detail).toBe("You answered this.");
    expect(r.root.children[1]!.detail).toContain("I don't know");
    expect(r.root.children[0]!.target).toEqual({ step: "heard" });
  });

  it("breaks the decision into one branch per future, in A, B, C order, each linked to its path", () => {
    const r = buildRoadmap(input());
    expect(r.branches.map((b) => b.letter)).toEqual(["A", "B", "C"]);
    expect(r.branches[0]!.title).toBe("A · Stay lean");
    expect(r.branches[0]!.target).toEqual({ step: "paths", letter: "A" });
  });

  it("lists each setback as a possibility, and flags the ones that run cash out", () => {
    const r = buildRoadmap(input());
    const setbacks = findAll(r.branches[1]!, (n) => n.kind === "setback");
    expect(setbacks.map((s) => s.title)).toEqual(["Late payment", "Lost client", "Slow season", "Equipment breakdown", "Cost rise"]);
    expect(setbacks[0]!.warn).toBe(true);
    expect(setbacks[1]!.warn).toBe(false);
    expect(setbacks[0]!.detail).toMatch(/^A client pays 2 months late/);
    expect(setbacks[0]!.target).toEqual({ step: "chat", letter: "B" });
  });

  it("says when cash runs out in the likely case, and when it never does", () => {
    const r = buildRoadmap(input());
    const cashA = findAll(r.branches[0]!, (n) => n.id === "A-cash")[0]!;
    expect(cashA.title).toBe("Cash stays above zero for 36 months");
    expect(cashA.warn).toBe(false);
    const cashB = findAll(r.branches[1]!, (n) => n.id === "B-cash")[0]!;
    expect(cashB.title).toBe("Cash runs out in month 3");
    expect(cashB.warn).toBe(true);
  });

  it("shows the three-month reserve only where the figures reach it", () => {
    const r = buildRoadmap(input());
    expect(findAll(r.branches[2]!, (n) => n.id === "C-buffer")[0]!.title).toBe("Three months of costs in reserve from month 8");
    expect(findAll(r.branches[0]!, (n) => n.id === "A-buffer")).toHaveLength(0);
  });

  it("pairs each question with the reply that answered it, and leaves out a reply still being written", () => {
    const chat: RoadmapChat[] = [
      { id: "u1", role: "user", text: "When did cash get tightest?" },
      { id: "s1", role: "self", text: "Around month three, when the client was late." },
      { id: "u2", role: "user", text: "Was it worth it?" },
      { id: "s2", role: "self", text: "Still writing", streaming: true },
    ];
    const r = buildRoadmap(input({ chats: { A: chat } }));
    const asks = findAll(r.branches[0]!, (n) => n.kind === "conversation");
    expect(asks.map((a) => a.title)).toEqual(["You asked: When did cash get tightest?", "You asked: Was it worth it?"]);
    expect(asks[0]!.detail).toBe("Future you: Around month three, when the client was late.");
    expect(asks[1]!.detail).toBe("Waiting for an answer");
  });

  it("keeps the six latest conversations on a future, so a long chat stays readable", () => {
    const chat: RoadmapChat[] = Array.from({ length: 8 }, (_, i) => [
      { id: `u${i}`, role: "user" as const, text: `Question ${i}` },
      { id: `s${i}`, role: "self" as const, text: `Answer ${i}` },
    ]).flat();
    const r = buildRoadmap(input({ chats: { A: chat } }));
    const asks = findAll(r.branches[0]!, (n) => n.kind === "conversation");
    expect(asks).toHaveLength(6);
    expect(asks[0]!.title).toBe("You asked: Question 2");
    expect(asks[5]!.title).toBe("You asked: Question 7");
  });

  it("offers a hint, not an empty list, when nothing has been asked on a future yet", () => {
    const r = buildRoadmap(input());
    const hint = findAll(r.branches[0]!, (n) => n.kind === "hint")[0];
    expect(hint?.title).toBe("No questions asked yet");
    expect(hint?.target).toEqual({ step: "chat", letter: "A" });
  });

  it("clips long text, so a long decision cannot break the layout", () => {
    const long = "x".repeat(300);
    const r = buildRoadmap(input({ decision: long, questions: [{ key: "k", question: long, answered: true }] }));
    expect(r.root.title.length).toBeLessThanOrEqual(120);
    expect(r.root.children[0]!.title.length).toBeLessThanOrEqual(110);
  });

  it("still gives the decision and its questions when no future has been drawn yet", () => {
    const r = buildRoadmap(input({ paths: [], figures: {}, questions: [{ key: "k", question: "Which kind of decision is it?", answered: true }] }));
    expect(r.branches).toEqual([]);
    expect(r.root.children).toHaveLength(1);
  });
});
