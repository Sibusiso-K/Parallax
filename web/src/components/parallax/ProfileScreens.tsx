import { useEffect, useState } from "react";
import { mockApi } from "@/lib/parallax-api";
import { useParallax } from "@/lib/parallax-store";
import { cx } from "./shared";
import { FieldGrid } from "./FieldGrid";
import { StepNav } from "./StepNav";

const STEPS = ["Reading your business", "Running 36 months of cash, in code", "Drawing the founder you could become"];

export function GeneratingScreen() {
  const { profile, intake, set, go, startWorld } = useParallax();
  const [ready, setReady] = useState(0);

  useEffect(() => {
    let alive = true;
    // A story Muse Spark read is this founder's, not the demo chef's: start their own room and portrait now, in the
    // background, and show path-coloured silhouettes until the portrait lands.
    const own = intake?.mode === "model";
    if (own) startWorld();
    (async () => {
      await new Promise((r) => setTimeout(r, 1100));
      if (!alive) return;
      setReady(1);
      const built = await mockApi.paths(profile);
      const cards = own ? built.map((c) => ({ ...c, avatarUrl: undefined })) : built;
      await new Promise((r) => setTimeout(r, 900));
      if (!alive) return;
      set({ paths: cards, active: "A" });
      setReady(2);
      // Wait for the portraits, so the paths show them as soon as they open.
      await Promise.all(
        cards.map(
          (c) =>
            new Promise((r) => {
              if (!c.avatarUrl) return r(null);
              const i = new Image();
              i.onload = i.onerror = () => r(null);
              i.src = c.avatarUrl;
            }),
        ),
      );
      await new Promise((r) => setTimeout(r, 900));
      if (!alive) return;
      setReady(3);
      await new Promise((r) => setTimeout(r, 700));
      if (alive) go("paths");
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="screen">
      <div className="pagehead">
        <div className="eyebrow">Futures</div>
        <h1>Building three futures</h1>
      </div>
      <ol className="gensteps" aria-live="polite">
        {STEPS.map((s, i) => (
          <li key={s} className={cx(ready > i && "done", ready === i && "now")}>
            <span className="dot" aria-hidden="true" />
            {s}
            <span className="sr-only">{ready > i ? "done" : ready === i ? "in progress" : "waiting"}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function ProfileScreen() {
  const { go } = useParallax();
  return (
    <section className="screen">
      <div className="pagehead">
        <div className="eyebrow">Your starting point</div>
        <h1>This is your business, today</h1>
        <div className="sub">Every future starts here. Anything marked “assumed” is a default you can change.</div>
      </div>
      <FieldGrid editable={false} />
      <StepNav nextLabel="See my futures" onNext={() => go("paths")} />
    </section>
  );
}
