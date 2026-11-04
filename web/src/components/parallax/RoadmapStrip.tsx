// The journey along the top of every screen: the six stations of a decision, with the current one marked. Once the futures
// exist, the Futures station forks into A, B and C, so the strip shows the decision breaking out as well.
import type { CSSProperties } from "react";
import { useParallax, type Step } from "@/lib/parallax-store";
import { PATH_COLOR, cx } from "./shared";

const STATIONS: { label: string; steps: readonly Step[]; goes: Step }[] = [
  { label: "Tell", steps: ["start", "intake"], goes: "intake" },
  { label: "Check", steps: ["heard"], goes: "heard" },
  { label: "Profile", steps: ["generating", "profile"], goes: "profile" },
  // The roadmap is the overview of the futures, so it sits under this station.
  { label: "Futures", steps: ["paths", "explore", "roadmap"], goes: "paths" },
  { label: "Ask", steps: ["chat"], goes: "chat" },
  { label: "Decide", steps: ["compare", "comfort", "summary"], goes: "compare" },
];

export function RoadmapStrip() {
  const { step, paths, intake, set, go } = useParallax();
  const current = STATIONS.findIndex((s) => s.steps.includes(step));

  return (
    <nav className="rm-strip" aria-label="Your journey">
      <ol>
        {STATIONS.map((s, i) => {
          const status = i < current ? "done" : i === current ? "now" : "next";
          // Telling the story again is open only before the futures exist; checking what was heard, while it exists.
          const reachable = i === 0 ? paths.length === 0 : i === 1 ? intake !== null : paths.length > 0;
          return (
            <li key={s.label} className={cx("rm-st", status)} aria-current={status === "now" ? "step" : undefined}>
              <span className="rm-line" aria-hidden="true" />
              <span className="rm-dot-s" aria-hidden="true" />
              {reachable && status !== "now" ? (
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
                      className="rm-pill"
                      style={{ "--c": PATH_COLOR[p.letter] } as CSSProperties}
                      title={`${p.letter} · ${p.name}`}
                      aria-label={`Future ${p.letter}: ${p.name}`}
                      onClick={() => {
                        set({ active: p.letter });
                        go("chat");
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
