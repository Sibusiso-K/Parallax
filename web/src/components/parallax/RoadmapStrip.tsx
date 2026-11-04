// The journey along the top of every screen, and the app's only flow navigation: the six stations of a decision, with
// the current one marked. Once the futures exist, the Futures station forks into A, B and C; a pill opens that future.
import type { CSSProperties } from "react";
import { STATIONS, reachable, stationOf } from "@/lib/flow";
import { useParallax } from "@/lib/parallax-store";
import { PATH_COLOR, cx } from "./shared";
import { useFlowContext } from "./StepNav";

export function RoadmapStrip() {
  const { step, paths, active, set, go } = useParallax();
  const ctx = useFlowContext();
  const current = stationOf(step);

  return (
    <nav className="rm-strip no-print" aria-label="Your journey">
      <ol>
        {STATIONS.map((s, i) => {
          const status = i < current ? "done" : i === current ? "now" : "next";
          const open = reachable(i, ctx);
          return (
            <li key={s.label} className={cx("rm-st", status, !open && "off")} aria-current={status === "now" ? "step" : undefined}>
              <span className="rm-line" aria-hidden="true" />
              <span className="rm-dot-s" aria-hidden="true" />
              {open && s.goes !== step ? (
                <button type="button" className="rm-label" onClick={() => go(s.goes)}>
                  {s.label}
                </button>
              ) : (
                <span className="rm-label">{s.label}</span>
              )}
              {s.label === "Futures" && paths.length > 0 && (
                <span className="rm-fork">
                  {paths.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={cx("rm-pill", p.letter === active && "sel")}
                      style={{ "--c": PATH_COLOR[p.letter] } as CSSProperties}
                      title={`${p.letter} · ${p.name}`}
                      aria-label={`Future ${p.letter}: ${p.name}`}
                      aria-pressed={p.letter === active}
                      onClick={() => {
                        set({ active: p.letter });
                        // On a screen about one future, the pill switches future; elsewhere it steps into it.
                        if (step !== "chat" && step !== "explore") go(ctx.hasRoom ? "explore" : "chat");
                      }}
                    >
                      {p.letter}
                    </button>
                  ))}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
