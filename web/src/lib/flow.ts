// The one route through a decision. The journey strip draws these stations, and every screen's Back and Next come from
// here, so the strip and the buttons can never disagree and no screen is a dead end.
import type { Step } from "./parallax-store";

export interface Station {
  label: string;
  steps: readonly Step[];
  /** The screen the station opens. */
  goes: Step;
}

export const STATIONS: readonly Station[] = [
  { label: "Tell", steps: ["start", "intake"], goes: "intake" },
  { label: "Check", steps: ["heard", "profile"], goes: "heard" },
  { label: "Futures", steps: ["generating", "paths"], goes: "paths" },
  { label: "Room", steps: ["explore"], goes: "explore" },
  { label: "Ask", steps: ["chat"], goes: "chat" },
  // The roadmap is the summary of the whole journey, so it sits with the decision.
  { label: "Decide", steps: ["compare", "comfort", "summary", "roadmap"], goes: "compare" },
];

export interface FlowContext {
  /** The three futures exist. */
  hasPaths: boolean;
  /** The 3D room is built for this kind of decision (contracts, for now). */
  hasRoom: boolean;
  /** What the founder said was read, so it can be checked. */
  hasIntake: boolean;
}

export interface Move {
  to: Step;
  label: string;
}

export function stationOf(step: Step): number {
  return STATIONS.findIndex((s) => s.steps.includes(step));
}

/** Whether the strip lets the founder jump to station i from where they are. */
export function reachable(i: number, ctx: FlowContext): boolean {
  const label = STATIONS[i]?.label;
  if (label === "Tell") return !ctx.hasPaths;
  if (label === "Check") return ctx.hasIntake;
  if (label === "Room") return ctx.hasPaths && ctx.hasRoom;
  return ctx.hasPaths;
}

/** The screen's one forward move. Null only on the start screen, which offers its own two choices. */
export function nextOf(step: Step, ctx: FlowContext): Move | null {
  switch (step) {
    case "intake":
      return { to: "heard", label: "Continue" };
    case "heard":
    case "profile":
      return { to: "generating", label: "Show my futures" };
    case "generating":
    case "paths":
      return ctx.hasRoom ? { to: "explore", label: "Step inside" } : { to: "chat", label: "Ask future you" };
    case "explore":
      return { to: "chat", label: "Ask future you" };
    case "chat":
      return { to: "compare", label: "Decide" };
    case "compare":
    case "comfort":
      return { to: "summary", label: "Write my memo" };
    case "summary":
      return { to: "roadmap", label: "See the whole journey" };
    case "roadmap":
      return { to: "summary", label: "Back to my memo" };
    default:
      return null;
  }
}

/** The screen's one way back. Null on the start screen. */
export function backOf(step: Step, ctx: FlowContext): Move | null {
  switch (step) {
    case "intake":
      return { to: "start", label: "Back" };
    case "heard":
      return { to: "intake", label: "Edit my story" };
    case "profile":
      return { to: "heard", label: "Back" };
    case "paths":
      return { to: "heard", label: "Change my numbers" };
    case "explore":
      return { to: "paths", label: "All futures" };
    case "chat":
      return ctx.hasRoom ? { to: "explore", label: "Back to the room" } : { to: "paths", label: "All futures" };
    case "compare":
    case "comfort":
      return { to: "chat", label: "Back" };
    case "summary":
      return { to: "compare", label: "Back" };
    case "roadmap":
      return { to: "summary", label: "Back" };
    default:
      return null;
  }
}
