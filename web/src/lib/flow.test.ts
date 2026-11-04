import { describe, expect, it } from "vitest";
import { STATIONS, backOf, nextOf, reachable, stationOf, type FlowContext } from "./flow";
import type { Step } from "./parallax-store";

const ALL: Step[] = ["start", "intake", "heard", "generating", "profile", "paths", "chat", "explore", "compare", "comfort", "summary", "roadmap"];
const room: FlowContext = { hasPaths: true, hasRoom: true, hasIntake: true };
const noRoom: FlowContext = { hasPaths: true, hasRoom: false, hasIntake: true };

describe("the flow", () => {
  it("puts every screen under exactly one station", () => {
    for (const s of ALL) expect(STATIONS.filter((st) => st.steps.includes(s))).toHaveLength(1);
  });

  it("gives every screen after the start a Next and a Back, so none is a dead end", () => {
    for (const s of ALL.filter((s) => s !== "start" && s !== "generating")) {
      expect(nextOf(s, room), s).not.toBeNull();
      expect(backOf(s, room), s).not.toBeNull();
    }
  });

  it("walks the main path in order: tell, check, futures, room, ask, decide", () => {
    const seen: Step[] = ["intake"];
    let at: Step = "intake";
    while (at !== "summary") {
      const n: Step = nextOf(at, room)!.to;
      at = n === "generating" ? "paths" : n;
      seen.push(at);
    }
    expect(seen).toEqual(["intake", "heard", "paths", "explore", "chat", "compare", "summary"]);
    expect(seen.map(stationOf)).toEqual([...seen.map(stationOf)].sort((a, b) => a - b));
  });

  it("skips the room when the decision has none", () => {
    expect(nextOf("paths", noRoom)!.to).toBe("chat");
    expect(backOf("chat", noRoom)!.to).toBe("paths");
    expect(reachable(STATIONS.findIndex((s) => s.label === "Room"), noRoom)).toBe(false);
  });

  it("closes Tell once the futures exist and opens the rest only then", () => {
    const fresh: FlowContext = { hasPaths: false, hasRoom: false, hasIntake: false };
    expect(reachable(0, fresh)).toBe(true);
    expect(reachable(0, room)).toBe(false);
    expect(STATIONS.slice(2).every((_, i) => !reachable(i + 2, fresh))).toBe(true);
  });
});
