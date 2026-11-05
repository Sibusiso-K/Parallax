// The workspace frame: the decision heading and a small Tools drawer above each screen, then the journey strip, which
// is the only flow navigation. Tools holds what is not a step: the assumptions, the model trace, export and delete.
import { useState, type ReactNode } from "react";
import { useParallax } from "@/lib/parallax-store";
import { Badge, Button, Drawer, Footer, ParallaxMark } from "./shared";
import { RoadmapStrip } from "./RoadmapStrip";
import { useMetaCalls, type MetaCall } from "@/lib/meta-log";

const MODE_LABEL: Record<MetaCall["mode"], string> = { model: "Meta model", fixture: "Demo, in code", error: "Failed" };

/** Every call this tab made to a route that can use Meta's models: what it was for, which model, how long. */
function MetaInside() {
  const calls = useMetaCalls();
  const byModel = calls.filter((c) => c.mode === "model").length;
  return (
    <div className="tools-group meta-inside">
      <div className="caps">Meta inside</div>
      <p className="sub">
        {calls.length === 0
          ? "No model calls yet. Each one shows here: what it did, which Meta model, and how long it took."
          : `${byModel} of ${calls.length} calls answered by Meta models in this tab. Figures always come from code, never a model.`}
      </p>
      {calls.length > 0 && (
        <ol className="meta-calls">
          {[...calls].reverse().map((c) => (
            <li key={c.id} className={`meta-call meta-call--${c.mode}`}>
              <b>{c.feature}</b>
              <span>{c.mode === "model" ? (c.model ?? "Meta model") : MODE_LABEL[c.mode]}</span>
              <span className="meta-call-ms">{(c.ms / 1000).toFixed(1)} s</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** The top bar's count of Meta model calls; opens Tools, where they are listed. */
function MetaPill({ onOpen }: { onOpen: () => void }) {
  const calls = useMetaCalls();
  const n = calls.filter((c) => c.mode === "model").length;
  return (
    <button type="button" className="meta-pill" onClick={onOpen} title="Which Meta models ran in this tab">
      <span className="meta-dot" aria-hidden="true" />
      Meta <b>{n}</b>
      <span className="sr-only"> model calls. Show them.</span>
    </button>
  );
}

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

function Tools({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useParallax();
  const { paths, set, go, reset, step } = s;
  const [confirming, setConfirming] = useState(false);
  const close = () => {
    setConfirming(false);
    onClose();
  };
  return (
    <Drawer open={open} onClose={close} title="Tools">
      <MetaInside />
      {paths.length > 0 && (
        <div className="tools-group">
          <div className="caps">Assumptions</div>
          <p className="sub">The numbers behind each future. Edit any one and every screen updates.</p>
          <div className="tools-row">
            {paths.map((p) => (
              <Button
                key={p.id}
                onClick={() => {
                  close();
                  set({ panel: { letter: p.letter } });
                }}
              >
                <Badge letter={p.letter} /> {p.name}
              </Button>
            ))}
          </div>
        </div>
      )}
      {paths.length > 0 && (
        <div className="tools-group">
          <div className="caps">Model trace</div>
          <p className="sub">Which model answered, how fast, and the checks on each reply.</p>
          <Button
            onClick={() => {
              close();
              set({ traceOpen: true });
              if (step !== "chat") go("chat");
            }}
          >
            Show the trace
          </Button>
        </div>
      )}
      <div className="tools-group">
        <div className="caps">Your data</div>
        <p className="sub">Download everything as a file, or erase it here and in the saved copy.</p>
        <div className="tools-row">
          <Button onClick={() => exportJson(s)}>Export (JSON)</Button>
          {confirming ? (
            <>
              <Button variant="primary" className="danger" onClick={() => { close(); reset(); }}>
                Yes, delete everything
              </Button>
              <Button variant="ghost" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
            </>
          ) : (
            <Button variant="ghost" onClick={() => setConfirming(true)}>
              Delete everything
            </Button>
          )}
        </div>
      </div>
    </Drawer>
  );
}

export function ControlRoom({ children }: { children: ReactNode }) {
  const { fields } = useParallax();
  const [tools, setTools] = useState(false);
  const decision = typeof fields.decision === "string" ? fields.decision : "";

  return (
    <div className="cr">
      <div className="main">
        <header className="topbar no-print">
          <div className="logo" aria-hidden="true">
            <ParallaxMark size={24} />
          </div>
          <div className="decision-block">
            <div className="eyebrow">Your decision</div>
            <div className="decision-title">{decision || "Your decision"}</div>
          </div>
          <MetaPill onOpen={() => setTools(true)} />
          <Button variant="outline" className="tools-btn" aria-haspopup="dialog" aria-expanded={tools} onClick={() => setTools(true)}>
            Tools
          </Button>
        </header>
        <main className="content">
          <RoadmapStrip />
          {children}
        </main>
        <Footer />
      </div>
      <Tools open={tools} onClose={() => setTools(false)} />
    </div>
  );
}
