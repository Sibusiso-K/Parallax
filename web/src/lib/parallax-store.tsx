import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { mockApi } from "./parallax-api";
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
  | "compare"
  | "comfort"
  | "summary";

export interface Trace {
  model: string;
  latencyMs: number;
  checks: { name: string; ok: boolean }[];
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
  assumed: FieldKey[];
  missing: FieldKey[];
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
}

const initial: State = {
  step: "start",
  agreed: false,
  story: "",
  intake: null,
  fields: {},
  assumed: [],
  missing: [],
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
  const d = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  if (d.startViewTransition && !isLite()) {
    d.startViewTransition(() => flushSync(fn));
  } else fn();
}

let uid = 0;
const nid = () => `m${++uid}`;

export function ParallaxProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<State>(initial);
  const ref = useRef(s);
  ref.current = s;

  const set = useCallback((p: Partial<State> | ((s: State) => Partial<State>)) => {
    setS((prev) => ({ ...prev, ...(typeof p === "function" ? p(prev) : p) }));
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
                { name: "Speaks in first person, from 2029", ok: true },
                { name: "Figures come from code, not the model", ok: true },
                { name: "Cites at least one assumption", ok: m.citations.length > 0 },
                { name: "Names a downside", ok: true },
                { name: "Does not tell you what to choose", ok: true },
              ],
            },
          }));
        }
      }
    },
    [set],
  );

  const reset = useCallback(() => {
    withTransition(() => setS(initial));
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
