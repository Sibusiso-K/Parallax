// The workspace frame: a slim icon sidebar, the decision heading and the three path tabs above each screen.
import { useState, type ReactNode } from "react";
import { useParallax, type Step } from "@/lib/parallax-store";
import { Avatar, Footer, ParallaxMark, cx } from "./shared";

type NavId = "Profile" | "Paths" | "Explore" | "Assumptions" | "Compare" | "Trace";
const NAV: NavId[] = ["Profile", "Paths", "Explore", "Assumptions", "Compare", "Trace"];

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
  Explore: (
    <>
      <path d="M10 2.8l6.5 3.6v7.2L10 17.2l-6.5-3.6V6.4z" />
      <path d="M3.5 6.4L10 10l6.5-3.6M10 10v7.2" />
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

const EXPORT_ICON = (
  <>
    <path d="M10 3v9" />
    <path d="M6.5 8.5 10 12l3.5-3.5" />
    <path d="M4 15.5V17h12v-1.5" />
  </>
);

const TRASH_ICON = (
  <>
    <path d="M4 6h12" />
    <path d="M8 6V4.5h4V6" />
    <path d="M5.5 6l.8 10.2h7.4L14.5 6" />
  </>
);

/** The nav item each screen sits under. The printed memo has none. */
const CURRENT: Partial<Record<Step, NavId>> = {
  heard: "Profile",
  profile: "Profile",
  paths: "Paths",
  chat: "Paths",
  explore: "Explore",
  compare: "Compare",
  comfort: "Compare",
};

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
    if (id === "Explore") go("explore");
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
          <ParallaxMark size={26} />
        </div>
        <nav className="nav" aria-label="Main">
          {NAV.map((id) => (
            <button
              key={id}
              type="button"
              className={cx(here === id && "on")}
              aria-label={id}
              title={id}
              aria-current={here === id ? "page" : undefined}
              disabled={id !== "Profile" && !ready}
              onClick={() => open(id)}
            >
              <svg viewBox="0 0 20 20" aria-hidden="true">
                {ICON[id]}
              </svg>
            </button>
          ))}
        </nav>
        <div className="side-foot">
          <button type="button" title="Export JSON" aria-label="Export JSON" onClick={() => exportJson(s)}>
            <svg viewBox="0 0 20 20" aria-hidden="true">
              {EXPORT_ICON}
            </svg>
          </button>
          {confirming ? (
            <>
              <button type="button" className="confirm" onClick={reset}>
                Yes, delete
              </button>
              <button type="button" onClick={() => setConfirming(false)}>
                Cancel
              </button>
            </>
          ) : (
            <button type="button" title="Delete everything" aria-label="Delete everything" onClick={() => setConfirming(true)}>
              <svg viewBox="0 0 20 20" aria-hidden="true">
                {TRASH_ICON}
              </svg>
            </button>
          )}
        </div>
      </aside>
      <div className="main">
        <header className="topbar no-print">
          <div className="decision-block">
            <div className="eyebrow">{step === "explore" ? "Explore" : decision ? "Your decision" : "Parallax"}</div>
            <div className="decision-title">{decision || "Describe a business decision to begin"}</div>
          </div>
          <div className="tabs">
            {/* Explore has its own path selector inside the room; two selectors that disagree would confuse. */}
            {ready &&
              step !== "explore" &&
              paths.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={cx("tab", `p-${p.letter}`, step === "chat" && p.letter === active && "sel")}
                  aria-pressed={step === "chat" && p.letter === active}
                  title={`${p.letter} · ${p.name}`}
                  aria-label={`${p.letter} · ${p.name}`}
                  onClick={() => {
                    set({ active: p.letter });
                    if (step !== "chat") go("chat");
                  }}
                >
                  <Avatar letter={p.letter} src={p.avatarUrl} size={44} />
                  <span className="tab-letter">{p.letter}</span>
                </button>
              ))}
          </div>
        </header>
        <main className="content">{children}</main>
        <Footer />
      </div>
    </div>
  );
}
