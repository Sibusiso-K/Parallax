import { useEffect, useState } from "react";
import { mockApi } from "@/lib/parallax-api";
import { useParallax } from "@/lib/parallax-store";
import { Button } from "./shared";

export function GeneratingScreen() {
  const { profile, intake, set, go, startWorld } = useParallax();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    // A story Muse Spark read is this founder's, not the demo chef's: start their own room and portrait now, in the
    // background, and show path-coloured silhouettes until the portrait lands.
    const own = intake?.mode === "model";
    if (own) startWorld();
    (async () => {
      try {
        const built = await mockApi.paths(profile);
        const cards = own ? built.map((c) => ({ ...c, avatarUrl: undefined })) : built;
        if (!alive) return;
        set({ paths: cards, active: "A" });
        go("paths");
      } catch {
        if (alive) setError("We could not prepare the paths. Check your decision type and figures, then try again.");
      }
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
        <h1>Preparing three template paths</h1>
      </div>
      {error ? <><p role="alert">{error}</p><Button onClick={() => go("heard")}>Check my figures</Button></> :
        <p role="status">Applying your confirmed figures to each path.</p>}
    </section>
  );
}

export function ProfileScreen() {
  const { go } = useParallax();
  // Compatibility for an old saved route. Review and edits share the same screen.
  useEffect(() => go("heard"), [go]);
  return null;
}
