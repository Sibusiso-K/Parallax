// The Control Room frame: the sidebar, the three path tabs and the decision line, around each workspace screen.
import { useState, type ReactNode } from "react";
import { useParallax, type Step } from "@/lib/parallax-store";
import { Avatar, Footer, ParallaxMark, cx } from "./shared";

type NavId = "Profile" | "Paths" | "Assumptions" | "Compare" | "Trace";
const NAV: NavId[] = ["Profile", "Paths", "Assumptions", "Compare", "Trace"];

const ICON: Record<NavId, ReactNode> = {
  Profile: (
    <>
      <circle cx="10" cy="7" r="3.2" />
      <path d="M3.5 17c.6-3.2 3.1-4.8 6.5-4.8s5.9 1.6 6.5 4.8" />
    </>
  ),
  Paths: (
    <>
      <path d="M10 3l7 3.6-7 3.6-7-3.6z" />
      <path d="M3 10.2l7 3.6 7-3.6" />
      <path d="M3 13.6l7 3.6 7-3.6" />
    </>
  ),
  Assumptions: (
    <>
      <path d="M3 6h14M3 10h14M3 14h14" />
      <circle cx="7" cy="6" r="1.7" />
      <circle cx="13" cy="10" r="1.7" />
      <circle cx="8" cy="14" r="1.7" />
    </>
  ),
  Compare: (
    <>
      <rect x="3" y="4" width="5.5" height="12" rx="1.2" />
      <rect x="11.5" y="4" width="5.5" height="12" rx="1.2" />
    </>
  ),
  Trace: (
    <>
      <path d="M7 5h10M7 10h10M7 15h10" />
      <circle cx="3.5" cy="5" r=".9" />
      <circle cx="3.5" cy="10" r=".9" />
      <circle cx="3.5" cy="15" r=".9" />
    </>
  ),
};

/** The nav item each screen sits under. The printed memo has none, as in the mockup. */
const CURRENT: Partial<Record<Step, NavId>> = {
  heard: "Profile",
  profile: "Profile",
  paths: "Paths",
  chat: "Paths",
  compare: "Compare",
  comfort: "Compare",
};

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** Downloads what the founder has entered and the paths built from it. Nothing is sent anywhere. */
function exportJson(s: ReturnType<typeof useParallax>) {
  const data = {
    decision: s.fields.decision ?? null,
    fields: s.fields,
    quotes: s.quotes,
    assumed: s.assumed,
    followed: s.followed,
    paths: s.paths,
    chosen: s.chosen,
    choice: s.decision,
    reasons: s.reasons,
    questions: s.questions,
    comfort: s.comfort,
    bothering: s.bothering,
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "parallax-decision.json";
  a.click();
  URL.revokeObjectURL(url);
}

export function ControlRoom({ children }: { children: ReactNode }) {
  const s = useParallax();
  const { step, paths, active, fields, set, go, reset } = s;
  const [confirming, setConfirming] = useState(false);
  const here = CURRENT[step];
  const ready = paths.length > 0;
  const decision = typeof fields.decision === "string" ? fields.decision : "";

  function open(id: NavId) {
    if (id === "Profile") go(ready ? "profile" : "heard");
    if (id === "Paths") go("paths");
    if (id === "Assumptions") set({ panel: { letter: active } });
    if (id === "Compare") go("compare");
    if (id === "Trace") {
      set({ traceOpen: true });
      if (step !== "chat") go("chat");
    }
  }

  return (
    <div className="cr">
      <aside className="sidebar no-print">
        <div className="logo">
          <ParallaxMark />
          <span>Parallax</span>
        </div>
        <nav className="nav" aria-label="Main">
          {NAV.map((id) => (
            <button
              key={id}
              type="button"
              className={cx(here === id && "on")}
              aria-current={here === id ? "page" : undefined}
              disabled={id !== "Profile" && !ready}
              onClick={() => open(id)}
            >
              <svg viewBox="0 0 20 20" aria-hidden="true">
                {ICON[id]}
              </svg>
              {id}
            </button>
          ))}
        </nav>
        <div className="side-foot">
          <button type="button" onClick={() => exportJson(s)}>
            Export JSON
          </button>
          {confirming ? (
            <>
              <button type="button" onClick={reset}>
                Yes, delete everything
              </button>
              <button type="button" onClick={() => setConfirming(false)}>
                Cancel
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setConfirming(true)}>
              Delete everything
            </button>
          )}
        </div>
      </aside>
      <div className="main">
        <header className="topbar no-print">
          <div className="tabs">
            {ready ? (
              paths.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={cx("tab", `p-${p.letter}`, step === "chat" && p.letter === active && "sel")}
                  aria-pressed={step === "chat" && p.letter === active}
                  onClick={() => {
                    set({ active: p.letter });
                    if (step !== "chat") go("chat");
                  }}
                >
                  <Avatar letter={p.letter} src={p.avatarUrl} size={30} />
                  <span>
                    {p.letter} · {p.name}
                  </span>
                </button>
              ))
            ) : (
              <span className="sub">Your three paths appear once you confirm what you heard.</span>
            )}
          </div>
          {decision && (
            <div className="decision">
              <b>Your decision:</b> {lowerFirst(decision)}
            </div>
          )}
        </header>
        <main className="content">{children}</main>
        <Footer />
      </div>
    </div>
  );
}
