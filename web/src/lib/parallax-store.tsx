import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { mockApi } from "./parallax-api";
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
};

type Ctx = State & {
  set: (p: Partial<State> | ((s: State) => Partial<State>)) => void;
  go: (step: Step) => void;
  sims: Record<Letter, Simulation>;
  pathOf: (l: Letter) => PathCard | undefined;
  send: (letter: Letter, text: string, askedFrom?: Letter) => Promise<void>;
  reset: () => void;
  profile: Profile;
};

const C = createContext<Ctx | null>(null);

export function isLite() {
  return typeof document !== "undefined" && document.documentElement.hasAttribute("data-lite");
}

/** Runs a DOM update inside a View Transition when supported, else a plain swap (CSS crossfades in). */
export function withTransition(fn: () => void) {
  const d = document as Document & { startViewTransition?: (cb: () => void) => { ready?: Promise<void> } };
  if (d.startViewTransition && !isLite()) {
    // The browser skips the animation when another screen change starts first or the tab is hidden. The update still
    // runs, but `ready` rejects with "Transition was skipped", which showed as an uncaught error in the console.
    d.startViewTransition(() => flushSync(fn)).ready?.catch(() => {});
  } else fn();
}

let uid = 0;
const nid = () => `m${++uid}`;
let decisionSeq = 0;
const fresh = (): State => ({ ...initial, sessionId: `decision-${++decisionSeq}` });

export function ParallaxProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<State>(fresh);
  const ref = useRef(s);
  ref.current = s;

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

  const pathOf = useCallback((l: Letter) => s.paths.find((p) => p.letter === l), [s.paths]);

  const send = useCallback(
    async (letter: Letter, text: string, askedFrom?: Letter) => {
      const path = ref.current.paths.find((p) => p.letter === letter);
      if (!path) return;
      const user: Msg = { id: nid(), role: "user", text, citations: [], askedFrom };
      const replyId = nid();
      const reply: Msg = { id: replyId, role: "self", text: "", citations: [], streaming: true };
      set((st) => ({ chats: { ...st.chats, [letter]: [...st.chats[letter], user, reply] } }));
      const t0 = performance.now();
      const patch = (fn: (m: Msg) => Msg) =>
        set((st) => ({
          chats: { ...st.chats, [letter]: st.chats[letter].map((m) => (m.id === replyId ? fn(m) : m)) },
        }));
      for await (const chunk of mockApi.chat(path.id, text)) {
        if (chunk.type === "token") patch((m) => ({ ...m, text: m.text + (chunk.text ?? "") }));
        else if (chunk.type === "citation" && chunk.citation)
          patch((m) => ({ ...m, citations: [...m.citations, chunk.citation!] }));
        else if (chunk.type === "done") {
          const latencyMs = Math.round(performance.now() - t0);
          patch((m) => ({
            ...m,
            streaming: false,
            trace: {
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
    withTransition(() => setS(fresh()));
    window.scrollTo({ top: 0 });
  }, []);

  const profile = useMemo<Profile>(() => ({ fields: s.fields, assumed: s.assumed }), [s.fields, s.assumed]);

  const value: Ctx = { ...s, set, go, sims, pathOf, send, reset, profile };
  return <C.Provider value={value}>{children}</C.Provider>;
}

export function useParallax() {
  const c = useContext(C);
  if (!c) throw new Error("useParallax outside provider");
  return c;
}

export const LETTERS: Letter[] = ["A", "B", "C"];
