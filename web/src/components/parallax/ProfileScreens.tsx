import { useEffect, useState } from "react";
import { mockApi } from "@/lib/parallax-api";
import { useParallax } from "@/lib/parallax-store";
import { Button, cx } from "./shared";
import { FieldGrid } from "./FieldGrid";

const STEPS = ["Reading your business", "Computing 36 months of cash in code", "Drawing the founder you could become"];

export function GeneratingScreen() {
  const { profile, set, go } = useParallax();
  const [ready, setReady] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      await new Promise((r) => setTimeout(r, 1100));
      if (!alive) return;
      setReady(1);
      const cards = await mockApi.paths(profile);
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
      if (alive) go("profile");
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="screen">
      <div className="pagehead">
        <div className="eyebrow">Step 3 of 3</div>
        <h1>Drawing three possible futures</h1>
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
      <div className="actions-row">
        <Button variant="ghost" onClick={() => go("heard")}>
          Edit what I heard
        </Button>
        <Button variant="primary" size="lg" className="ml-auto" onClick={() => go("paths")}>
          Meet your three futures
        </Button>
      </div>
    </section>
  );
}
