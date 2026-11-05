// Explore: the 3D room for the decision the founder confirmed. The store owns every figure; the room reads the same
// path cards through the session adapter and sends edits back through the store, so every screen shows one revision.
import { Suspense, lazy, useCallback, useMemo, useRef } from "react";
import type { Edit } from "../../../../shared/engine/simulate";
import { SnapshotRegistry } from "../../../../shared/scene/room-model";
import { DECISION_LABELS, DEMO_STORY } from "@/lib/parallax-api";
import { LETTERS, useParallax, type Letter } from "@/lib/parallax-store";
import { exploreSession, reviseCards } from "@/immersive/session-adapter";
import type { ExploreBinding, ExploreSelection } from "@/immersive/World";
import { Button, NoPaths } from "./shared";
import { StepNav } from "./StepNav";

const World = lazy(() => import("@/immersive/World"));

export function ExploreScreen() {
  const { paths, fields, story, sessionId, revision, active, explore, scene, set, go } = useParallax();
  // One snapshot registry per decision, kept across revisions so earlier answers still resolve as historical.
  const registry = useRef<{ id: string; snapshots: SnapshotRegistry } | null>(null);
  if (registry.current?.id !== sessionId) registry.current = { id: sessionId, snapshots: new SnapshotRegistry() };
  const snapshots = registry.current.snapshots;
  // The path the founder entered on; switching paths inside the room does not rebuild the session.
  const enteredOn = useRef(active);
  const title = typeof fields.decision === "string" ? fields.decision : "";

  const result = useMemo(
    () =>
      paths.length > 0
        ? exploreSession({ kind: "confirmed", sessionId, revision, title, paths, selectedPath: enteredOn.current }, snapshots)
        : null,
    [paths, sessionId, revision, title, snapshots],
  );

  const onSelection = useCallback(
    (view: ExploreSelection) =>
      set((s) =>
        s.active === view.pathId && s.explore.month === view.month && LETTERS.every((l) => s.explore.stressed[l] === view.stressed[l])
          ? {}
          : { active: view.pathId, explore: { stressed: { ...view.stressed }, month: view.month } },
      ),
    [set],
  );

  const onRevise = useCallback(
    (letter: Letter, assumptionId: string, edit: Edit) => {
      const r = reviseCards(paths, letter, assumptionId, edit);
      if (!r.ok) return r;
      set({ paths: r.paths });
      return { ok: true as const, revision: revision + 1 };
    },
    [paths, revision, set],
  );

  const founderLabel = story.trim() === DEMO_STORY.trim() ? "Fictional founder · demo story" : "Your decision";
  const context = useMemo(() => {
    const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
    return { business: str(fields.business), location: str(fields.location), decision: str(fields.decision), story: str(story)?.slice(0, 4000) };
  }, [fields.business, fields.decision, fields.location, story]);
  const binding = useMemo<ExploreBinding | null>(
    () =>
      result?.ok
        ? { session: result.session, initial: { pathId: active, stressed: explore.stressed, month: explore.month }, onSelection, onRevise, founderLabel, dressing: scene, context }
        : null,
    // The month and the late-payment lever only matter when the room mounts. The path also flows back in, so the
    // journey strip can switch the future while the room is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [result, onSelection, onRevise, founderLabel, scene, context, active],
  );

  if (paths.length === 0) return <NoPaths />;

  const kind = fields.decisionType;
  if (kind !== "contract") {
    const label = typeof kind === "string" && kind in DECISION_LABELS ? DECISION_LABELS[kind as keyof typeof DECISION_LABELS] : "this kind of decision";
    return (
      <section className="screen">
        <div className="pagehead">
          <div className="eyebrow">Explore</div>
          <h1>Explore your three paths</h1>
          <div className="sub">
            For “{label}”, compare the cash forecasts under Futures and try the stress tests under Ask.
            The 3D room uses contract-specific controls.
          </div>
        </div>
        <div className="actions-row">
          <Button variant="primary" onClick={() => go("paths")}>
            See your paths
          </Button>
          <Button onClick={() => go("chat")}>Try a stress test</Button>
          <Button onClick={() => go("compare")}>Compare and write a memo</Button>
        </div>
      </section>
    );
  }

  if (!binding) {
    return (
      <section className="screen" role="alert">
        <div className="pagehead">
          <div className="eyebrow">Explore</div>
          <h1>Explore could not open this decision</h1>
          <div className="sub">{result && !result.ok ? result.reason : "The paths are not ready."} Nothing was changed.</div>
        </div>
        <div className="actions-row">
          <Button variant="primary" onClick={() => go("paths")}>
            Back to your paths
          </Button>
        </div>
      </section>
    );
  }

  return (
    <Suspense
      fallback={
        <div className="explore-loading" role="status">
          Loading the room. Your figures are ready under Futures meanwhile.
        </div>
      }
    >
      <World key={sessionId} binding={binding} />
      <StepNav />
    </Suspense>
  );
}
