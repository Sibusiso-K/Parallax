// The self-check on intake, shown on the check screen: once the figures are on screen, Muse Spark compares them with
// the founder's story in the background and lists anything that disagrees. It changes nothing; it only asks. Shown
// only when a model read the story (in demo mode there is nothing to double-check).
import { useEffect, useState } from "react";
import { useParallax } from "@/lib/parallax-store";
import { cardsFor } from "./FieldGrid";

interface Note {
  field: string;
  label: string;
  message: string;
}
type State = { status: "working" } | { status: "done"; notes: Note[]; model?: string } | { status: "failed"; error: string };

// One check per story and set of figures, kept across visits to the screen in this tab.
const done = new Map<string, State>();
const inFlight = new Map<string, Promise<State>>();

export function SelfCheck() {
  const { intake, story, fields, quotes, assumed, followed, missing } = useParallax();
  const ready = intake?.mode === "model" && missing.length === 0 && story.trim().length > 0;
  const cards = ready ? cardsFor(fields, quotes, assumed, followed).filter((c) => !assumed.includes(c.k)) : [];
  const payload = ready ? JSON.stringify({ check: true, text: story.slice(0, 4000), fields: cards.slice(0, 24).map((c) => ({ key: c.k, label: c.label, value: c.value.slice(0, 300), quote: c.quote?.slice(0, 400) })) }) : "";
  const [state, setState] = useState<State | null>(() => (payload ? (done.get(payload) ?? null) : null));

  useEffect(() => {
    if (!payload || cards.length === 0) return;
    const cached = done.get(payload);
    if (cached) return setState(cached);
    let live = true;
    setState({ status: "working" });
    // One request per payload, even if the screen mounts twice (React's StrictMode does in development).
    let run = inFlight.get(payload);
    if (!run) {
      run = (async (): Promise<State> => {
        try {
          const res = await fetch("/api/intake", { method: "POST", headers: { "content-type": "application/json" }, body: payload });
          const data = (await res.json()) as { ok?: boolean; mode?: string; notes?: Note[]; model?: string; error?: string };
          return data.ok && data.mode === "model" ? { status: "done", notes: data.notes ?? [], model: data.model } : { status: "failed", error: data.error ?? "Couldn't double-check just now." };
        } catch {
          return { status: "failed", error: "Couldn't double-check just now." };
        }
      })();
      inFlight.set(payload, run);
    }
    void run.then((next) => {
      done.set(payload, next);
      inFlight.delete(payload);
      if (live) setState(next);
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload]);

  if (!ready || !state) return null;
  return (
    <section className={`selfcheck selfcheck--${state.status}`} aria-live="polite">
      <div className="caps">Double-check · Muse Spark</div>
      {state.status === "working" && <p>Comparing these figures with your story…</p>}
      {state.status === "failed" && <p className="sub">{state.error} The figures above are still yours to check.</p>}
      {state.status === "done" &&
        (state.notes.length === 0 ? (
          <p>Nothing here disagrees with your story.</p>
        ) : (
          <>
            <p>
              <b>Worth a look before you go on:</b>
            </p>
            <ul>
              {state.notes.map((n, i) => (
                <li key={`${i}-${n.field}`}>
                  <span className="selfcheck-field">{n.label}</span> {n.message}
                </li>
              ))}
            </ul>
            <p className="sub small">Tap the figure in the cards to change it. Nothing was changed for you.</p>
          </>
        ))}
    </section>
  );
}
