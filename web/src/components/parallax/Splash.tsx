import { useCallback, useEffect, useState } from "react";
import { PATH_COLOR } from "./shared";

// The start-up animation: the three squares of the mark (paths A, B and C) slide apart from one point, then the name
// rises in. Once per tab, about 1.7 s, skipped by a click or any key, and a quick fade for reduced motion. It is
// decoration only: hidden from screen readers, and the app behind it is already loaded and usable.

const SEEN_KEY = "parallax.splash";
const seen = () => {
  try {
    return sessionStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
};

export function Splash() {
  const [phase, setPhase] = useState<"in" | "out" | "gone">(() => (seen() ? "gone" : "in"));
  const leave = useCallback(() => setPhase((p) => (p === "in" ? "out" : p)), []);

  useEffect(() => {
    if (phase !== "in") return;
    try {
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* shown again next load: harmless */
    }
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const t = setTimeout(leave, reduced ? 300 : 1700);
    window.addEventListener("keydown", leave, { once: true });
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", leave);
    };
  }, [phase, leave]);

  useEffect(() => {
    if (phase !== "out") return;
    const t = setTimeout(() => setPhase("gone"), 450);
    return () => clearTimeout(t);
  }, [phase]);

  if (phase === "gone") return null;
  return (
    <div className={`splash no-print${phase === "out" ? " splash-out" : ""}`} aria-hidden="true" onClick={leave}>
      <svg className="splash-mark" width="112" height="112" viewBox="0 0 34 34" focusable="false">
        <rect className="sq sq-a" x="3" y="9" width="17" height="17" rx="3" fill={PATH_COLOR.A} />
        <rect className="sq sq-b" x="9" y="5" width="17" height="17" rx="3" fill={PATH_COLOR.B} fillOpacity=".85" />
        <rect className="sq sq-c" x="14" y="11" width="17" height="17" rx="3" fill={PATH_COLOR.C} fillOpacity=".85" />
      </svg>
      <div className="splash-word">Parallax</div>
      <div className="splash-tag">Rehearse the decision before you bet the business</div>
    </div>
  );
}
