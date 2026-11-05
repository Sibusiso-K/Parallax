// The figures a path screen shows, read from the engine: cash by month for each case, and each setback run on its own
// at the likely case. Every number here comes from shared/engine; nothing is typed in.
import { applySetback, lowestCash, milestones, SETBACK_IDS, SETBACK_LABELS, type SetbackId } from "../../../shared/engine/analysis";
import { simulate } from "../../../shared/engine/simulate";
import type { PathCard, Simulation } from "./types";

export interface Level {
  cash: number;
  month: number;
}

/** One setback on its own, at the likely case. */
export interface Setback {
  id: SetbackId;
  name: string;
  detail: string;
  /** The lowest cash in the likely case, with the month it happens. */
  lowest: Level;
  month36: number;
  /** The first month cash goes below zero in the likely case, or null if it never does. */
  runsOut: number | null;
  /** Cash at the start and at the end of each month, so index m is the cash at month m. */
  line: number[];
}

export interface Figures {
  /** Cash at the start and at the end of each month, so index m is the cash at month m, for each case. */
  bad: number[];
  likely: number[];
  good: number[];
  lowestLikely: Level;
  /** The first month cash goes below zero in the bad case, or null. */
  runsOutBad: number | null;
  /** The month the likely case first holds three months of fixed costs, or null. */
  bufferMonth: number | null;
  setbacks: Setback[];
  late: Setback;
  worst: Setback;
}

const NAME: Record<SetbackId, string> = {
  "late-payment": "Late payment",
  "lost-client": "Lost client",
  "slow-season": "Slow season",
  "equipment-breakdown": "Equipment breakdown",
  "cost-rise": "Cost rise",
};

/** Cash at the start and at the end of each month, so index m is the cash at month m. */
function series(sim: Simulation, kase: "bad" | "likely" | "good", start: number): number[] {
  return [start, ...sim[kase].rows.map((r) => r.cash)];
}

function setback(path: PathCard, id: SetbackId): Setback {
  const sim = simulate(applySetback(path, id));
  const label = SETBACK_LABELS[id];
  return {
    id,
    name: NAME[id],
    detail: label.slice(label.indexOf(": ") + 2),
    lowest: lowestCash(sim, "likely"),
    month36: sim.likely.rows[sim.likely.rows.length - 1]?.cash ?? 0,
    runsOut: sim.likely.shortfallMonths[0] ?? null,
    line: series(sim, "likely", path.startingCash),
  };
}

export function pathFigures(path: PathCard): Figures {
  const sim = simulate(path);
  const setbacks = SETBACK_IDS.map((id) => setback(path, id));
  const late = setbacks.find((s) => s.id === "late-payment")!;
  const worst = setbacks.reduce((a, b) => (b.lowest.cash < a.lowest.cash ? b : a));
  const buffer = milestones(path, sim).likely.find((m) => m.id === "cash-buffer-3-months");
  return {
    bad: series(sim, "bad", path.startingCash),
    likely: series(sim, "likely", path.startingCash),
    good: series(sim, "good", path.startingCash),
    lowestLikely: lowestCash(sim, "likely"),
    runsOutBad: sim.bad.shortfallMonths[0] ?? null,
    bufferMonth: buffer?.month ?? null,
    setbacks,
    late,
    worst,
  };
}

/** Use the path's nominated stress tests. Older saved cards fall back to the decision's relevant test. */
export function decisionSetback(path: PathCard, figures: Figures, decisionType: unknown): Setback {
  const fallback: SetbackId = decisionType === "hire" ? "slow-season" : decisionType === "pricing" ? "lost-client" : "late-payment";
  const relevant = figures.setbacks.filter((s) => (path.setbacks?.length ? path.setbacks : [fallback]).includes(s.id));
  return relevant.reduce((a, b) => b.lowest.cash < a.lowest.cash ? b : a, relevant[0] ?? figures.worst);
}
