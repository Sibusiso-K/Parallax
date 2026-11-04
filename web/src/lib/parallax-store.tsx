import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { mockApi } from "./parallax-api";
import { eraseSaved, loadSaved, saveState } from "./session";
import { buildWorld, type SceneDressing, type WorldContext } from "./world";
import { applyPatch } from "./store-patch";
import type { FieldKey, IntakeResponse, PathCard, Profile, Simulation } from "./types";

export type Letter = "A" | "B" | "C";
export type Step =
  | "start"
  | "intake"
  | "heard"
  | "generating"
  | "profile"
  | "paths"
  | "chat"
  | "explore"
  | "compare"
  | "comfort"
  | "summary";

/** What the founder last looked at in Explore. The path is the shared `active` path, so every screen agrees on it. */
export interface ExploreView {
  /** Whether the late-payment lever is pulled, per path. */
  stressed: Record<Letter, boolean>;
  month: number;
}

export interface Trace {
  model: string;
  latencyMs: number;
  // ok is null for a check the code does not run yet; the trace shows it as not run rather than as passed.
  checks: { name: string; ok: boolean | null }[];
}
export interface Msg {
  id: string;
  role: "user" | "self";
  text: string;
  citations: { id: string; label: string }[];
  streaming?: boolean;
  trace?: Trace;
  askedFrom?: Letter;
}

interface State {
  step: Step;
  agreed: boolean;
  story: string;
  intake: IntakeResponse | null;
  fields: Partial<Record<FieldKey, unknown>>;
  quotes: Partial<Record<FieldKey, string>>;
  assumed: FieldKey[];
  missing: FieldKey[];
  /** Fields the founder answered as a follow-up question. */
  followed: FieldKey[];
  paths: PathCard[];
  active: Letter;
  chats: Record<Letter, Msg[]>;
  comfort: Record<Letter, number[]>;
  bothering: string;
  pinned: Partial<Record<Letter, string>>;
  chosen: Letter | null;
  decision: "decided" | "notready" | null;
  reasons: string;
  questions: string;
  panel: { letter: Letter; rowId?: string } | null;
  traceOpen: boolean;
  announce: string;
  /** This decision's id in this tab. A reset starts a new one, so nothing from an earlier decision can be cited. */
  sessionId: string;
  /** Rises by one whenever any path card changes; Explore and every figure key to it. */
  revision: number;
  explore: ExploreView;
  /** This founder's room, named by Muse Spark from their story (null: the demo courtyard as built). */
  scene: SceneDressing | null;
  /** This founder's portrait from Muse Image, shown for all three paths (null: the path's own picture or silhouette). */
  portrait: string | null;
}

const initial: State = {
  sessionId: "",
  revision: 0,
  explore: { stressed: { A: false, B: false, C: false }, month: 1 },
  step: "start",
  agreed: false,
  story: "",
  intake: null,
  fields: {},
  quotes: {},
  assumed: [],
  missing: [],
  followed: [],
  paths: [],
  active: "A",
  chats: { A: [], B: [], C: [] },
  comfort: { A: [], B: [], C: [] },
  bothering: "",
  pinned: {},
  chosen: null,
  decision: null,
  reasons: "",
  questions: "",
  panel: null,
  traceOpen: false,
  announce: "",
  scene: null,
  portrait: null,
};

type Ctx = State & {
  set: (p: Partial<State> | ((s: State) => Partial<State>)) => void;
  go: (step: Step) => void;
  sims: Record<Letter, Simulation>;
  pathOf: (l: Letter) => PathCard | undefined;
  send: (letter: Letter, text: string, askedFrom?: Letter) => Promise<void>;
  reset: () => void;
  profile: Profile;
  /** A saved decision the start screen can offer to pick up again, once it has loaded. */
  resume: Resume | null;
  resumeSaved: () => void;
  dismissResume: () => void;
  /** Builds this founder's room and portrait with Meta's models, once per decision. Does nothing in demo mode. */
  startWorld: () => void;
};

const C = createContext<Ctx | null>(null);

export function isLite() {
  return typeof document !== "undefined" && document.documentElement.hasAttribute("data-lite");
}

/** Runs a DOM update inside a View Transition when supported, else a plain swap (CSS crossfades in). */
export function withTransition(fn: () => void) {
  const d = document as Document & { startViewTransition?: (cb: () => void) => { ready?: Promise<void> } };
  // A hidden tab gets no animation, and its transition update can be held back: a founder who switched tabs while the
  // model read their story came back to the intake screen, with Continue doing nothing visible.
  if (!d.startViewTransition || isLite() || document.visibilityState !== "visible") return fn();
  let done = false;
  const update = () => {
    if (done) return;
    done = true;
    flushSync(fn);
  };
  // The browser skips the animation when another screen change starts first. The update still runs, but `ready`
  // rejects with "Transition was skipped", which showed as an uncaught error in the console.
  d.startViewTransition(update).ready?.catch(() => {});
  // Never let a screen change wait on the animation: if the browser has not run the update within a second, run it.
  setTimeout(update, 1000);
}

let uid = 0;
const nid = () => `m${++uid}`;
let decisionSeq = 0;
const fresh = (): State => ({ ...initial, sessionId: `decision-${++decisionSeq}` });

// What is saved between visits (see lib/session.ts). Panels, the trace drawer and announcements are this tab's only.
const SAVED_KEYS = [
  "step", "agreed", "story", "intake", "fields", "quotes", "assumed", "missing", "followed", "paths", "active", "chats",
  "comfort", "bothering", "pinned", "chosen", "decision", "reasons", "questions", "sessionId", "revision", "explore",
  "scene", "portrait",
] as const satisfies readonly (keyof State)[];
const STEPS: readonly Step[] = ["start", "intake", "heard", "generating", "profile", "paths", "chat", "explore", "compare", "comfort", "summary"];
const NEEDS_PATHS: readonly Step[] = ["paths", "chat", "explore", "compare", "comfort", "summary"];

/** The part of the state worth saving. A reply still streaming is saved as it stands; generating resumes on profile. */
export function snapshotOf(s: State): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of SAVED_KEYS) out[k] = s[k];
  out.step = s.step === "generating" ? "profile" : s.step;
  out.chats = Object.fromEntries(LETTERS.map((l) => [l, s.chats[l].map((m) => ({ ...m, streaming: false }))]));
  return out;
}

// null in the fresh state (intake, chosen, decision) takes null or an object; an object never takes an array.
const sameKind = (a: unknown, b: unknown) =>
  Array.isArray(a) ? Array.isArray(b) : a === null ? b === null || (typeof b === "object" || typeof b === "string") && !Array.isArray(b) : typeof a === typeof b && Array.isArray(b) === false;
const isPath = (p: unknown): p is PathCard =>
  !!p && typeof p === "object" && typeof (p as PathCard).id === "string" && ["A", "B", "C"].includes((p as PathCard).letter) &&
  Array.isArray((p as PathCard).assumptions) && typeof (p as PathCard).startingCash === "number";

/** A saved state, checked field by field against a fresh one; anything of the wrong shape is left at its default. */
export function restoreFrom(saved: Record<string, unknown> | null): State | null {
  if (!saved) return null;
  const base = fresh();
  const out = { ...base } as Record<string, unknown>;
  for (const k of SAVED_KEYS) if (k in saved && sameKind(base[k], saved[k])) out[k] = saved[k];
  const s = out as unknown as State;
  s.paths = Array.isArray(s.paths) && s.paths.every(isPath) ? s.paths : [];
  for (const l of LETTERS) if (!Array.isArray(s.chats?.[l])) s.chats = { ...base.chats, ...(s.chats ?? {}), [l]: [] };
  if (!STEPS.includes(s.step)) s.step = "start";
  if (NEEDS_PATHS.includes(s.step) && s.paths.length === 0) s.step = Object.keys(s.fields ?? {}).length ? "heard" : "intake";
  if (s.step === "start" && !s.story.trim() && s.paths.length === 0) return null; // nothing worth resuming
  return s;
}

/** What the start screen offers to pick up again. */
export interface Resume {
  decision: string;
  business: string;
  step: Step;
}

export function ParallaxProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<State>(fresh);
  const ref = useRef(s);
  ref.current = s;
  // The saved decision, once loaded: offered on the start screen, never applied without the founder's say-so.
  const savedRef = useRef<State | null>(null);
  const [resume, setResume] = useState<Resume | null>(null);
  // Nothing is saved until the saved copy has been read, so a blank start can never overwrite it.
  const [loaded, setLoaded] = useState(false);
  const [offering, setOffering] = useState(false);

  useEffect(() => {
    let live = true;
    void loadSaved().then((raw) => {
      if (!live) return;
      const restored = restoreFrom(raw);
      savedRef.current = restored;
      if (restored) {
        const f = restored.fields;
        setResume({
          decision: typeof f.decision === "string" ? f.decision : restored.story.slice(0, 80),
          business: typeof f.business === "string" ? f.business : "",
          step: restored.step,
        });
        setOffering(true);
      }
      setLoaded(true);
    });
    return () => {
      live = false;
    };
  }, []);

  // Autosave, a second after the last change, and once more as the page closes.
  useEffect(() => {
    if (!loaded || offering) return;
    if (s.step === "start" && !s.story.trim() && s.paths.length === 0) return;
    const t = setTimeout(() => void saveState(snapshotOf(s)), 1000);
    return () => clearTimeout(t);
  }, [s, loaded, offering]);
  useEffect(() => {
    const flush = () => {
      const cur = ref.current;
      if (!loaded || offering || (cur.step === "start" && !cur.story.trim() && cur.paths.length === 0)) return;
      void saveState(snapshotOf(cur), { keepalive: true });
    };
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, [loaded, offering]);

  const resumeSaved = useCallback(() => {
    const saved = savedRef.current;
    setOffering(false);
    setResume(null);
    if (!saved) return;
    withTransition(() => setS({ ...saved, sessionId: saved.sessionId || `decision-${++decisionSeq}` }));
    window.scrollTo({ top: 0 });
  }, []);
  const dismissResume = useCallback(() => {
    setOffering(false);
    setResume(null);
  }, []);

  // The founder's own room and portrait, built once per decision in the background (lib/world.ts).
  const worldFor = useRef<string | null>(null);
  const startWorld = useCallback(() => {
    const cur = ref.current;
    if (worldFor.current === cur.sessionId || cur.scene) return;
    worldFor.current = cur.sessionId;
    const f = cur.fields;
    const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
    const kind = str(f.decisionType);
    const context: WorldContext = {
      business: str(f.business),
      location: str(f.location),
      decision: str(f.decision),
      decisionType: kind === "contract" || kind === "hire" || kind === "pricing" ? kind : undefined,
      story: str(cur.story)?.slice(0, 4000),
    };
    const sessionId = cur.sessionId;
    void buildWorld(context).then((world) => {
      // A reset or a new decision while it was drawing: this world belongs to the old one.
      if (!world || ref.current.sessionId !== sessionId) return;
      setS((prev) => ({ ...prev, scene: world.dressing ?? prev.scene, portrait: world.portrait ?? prev.portrait }));
    });
  }, []);

  // Every screen shows the founder's own portrait once there is one; the path cards themselves are not changed, so
  // the figures' revision (which the 3D room keys to) does not move for a picture.
  const shownPaths = useMemo(
    () => (s.portrait ? s.paths.map((p) => ({ ...p, avatarUrl: s.portrait! })) : s.paths),
    [s.paths, s.portrait],
  );

  const set = useCallback((p: Partial<State> | ((s: State) => Partial<State>)) => {
    setS((prev) => applyPatch(prev, typeof p === "function" ? p(prev) : p));
  }, []);

  const go = useCallback(
    (step: Step) => {
      withTransition(() => set({ step }));
      if (typeof window !== "undefined") window.scrollTo({ top: 0 });
    },
    [set],
  );

  const sims = useMemo(() => {
    const out = {} as Record<Letter, Simulation>;
    for (const p of s.paths) out[p.letter] = mockApi.simulate(p);
    return out;
  }, [s.paths]);

  const pathOf = useCallback((l: Letter) => shownPaths.find((p) => p.letter === l), [shownPaths]);

  const send = useCallback(
    async (letter: Letter, text: string, askedFrom?: Letter) => {
      const cur = ref.current;
      const path = cur.paths.find((p) => p.letter === letter);
      if (!path) return;
      // What the future self needs to answer this founder, not the demo one: their own words and the turns so far.
      const f = cur.fields;
      const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
      const context = {
        business: str(f.business),
        location: str(f.location),
        decision: str(f.decision),
        goals: Array.isArray(f.goals) ? f.goals.map(String) : str(f.goals)?.split(/,\s*/),
        story: str(cur.story)?.slice(0, 4000),
      };
      const history = cur.chats[letter].filter((m) => !m.streaming).map((m) => ({ role: m.role, text: m.text }));
      const user: Msg = { id: nid(), role: "user", text, citations: [], askedFrom };
      const replyId = nid();
      const reply: Msg = { id: replyId, role: "self", text: "", citations: [], streaming: true };
      set((st) => ({ chats: { ...st.chats, [letter]: [...st.chats[letter], user, reply] } }));
      const t0 = performance.now();
      const patch = (fn: (m: Msg) => Msg) =>
        set((st) => ({
          chats: { ...st.chats, [letter]: st.chats[letter].map((m) => (m.id === replyId ? fn(m) : m)) },
        }));
      for await (const chunk of mockApi.chat(path, text, history, context)) {
        if (chunk.type === "token") patch((m) => ({ ...m, text: m.text + (chunk.text ?? "") }));
        else if (chunk.type === "citation" && chunk.citation)
          patch((m) => ({ ...m, citations: [...m.citations, chunk.citation!] }));
        else if (chunk.type === "done") {
          const latencyMs = Math.round(performance.now() - t0);
          patch((m) => ({
            ...m,
            streaming: false,
            trace: chunk.trace ? { ...chunk.trace, latencyMs } : {
              model: "fixture (stand-in for muse-spark-1.3)",
              latencyMs,
              checks: [
                { name: "Speaks in first person, 36 months on", ok: null },
                { name: "Figures come from code, not the model", ok: null },
                { name: "Cites at least one assumption", ok: m.citations.length > 0 },
                { name: "Names a downside", ok: null },
                { name: "Does not tell you what to choose", ok: null },
              ],
            },
          }));
        }
      }
    },
    [set],
  );

  const reset = useCallback(() => {
    // Delete everything means everywhere: the saved copy too, under a code this browser will never use again.
    savedRef.current = null;
    setResume(null);
    setOffering(false);
    void eraseSaved();
    withTransition(() => setS(fresh()));
    window.scrollTo({ top: 0 });
  }, []);

  const profile = useMemo<Profile>(() => ({ fields: s.fields, assumed: s.assumed }), [s.fields, s.assumed]);

  const value: Ctx = { ...s, paths: shownPaths, set, go, sims, pathOf, send, reset, profile, resume, resumeSaved, dismissResume, startWorld };
  return <C.Provider value={value}>{children}</C.Provider>;
}

export function useParallax() {
  const c = useContext(C);
  if (!c) throw new Error("useParallax outside provider");
  return c;
}

export const LETTERS: Letter[] = ["A", "B", "C"];
