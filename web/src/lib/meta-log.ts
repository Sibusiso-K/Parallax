// "Meta inside": a record of every call this tab makes to a route that can use Meta's models, so the founder (and a
// judge) can see which model did what, how long it took, and when the app fell back to code. It watches the app's own
// /api calls in one place, so no screen has to remember to log. Only metadata is kept: the route, the mode, the model
// name and the time taken. No words, figures or recordings are recorded, and nothing leaves the browser.
import { useSyncExternalStore } from "react";

export interface MetaCall {
  id: number;
  /** What the founder was doing, in plain words. */
  feature: string;
  /** "model": a Meta model answered. "fixture": demo mode, answered in code. "error": the call failed. */
  mode: "model" | "fixture" | "error";
  /** The model that answered, when the route says. */
  model?: string;
  ms: number;
  at: number;
}

const FEATURES: Record<string, string> = {
  intake: "Read your story",
  chat: "Future you answered",
  advisor: "Room question answered",
  scene: "Dressed your room and drew your portrait",
  transcribe: "Turned your voice into text",
  whatif: "Read your what-if",
  board: "Board moderator summed up",
  check: "Double-checked what it read",
};
/** The model each route uses when its reply does not name one. */
const DEFAULT_MODEL: Record<string, string> = { board: "Muse Spark", check: "Muse Spark", intake: "Muse Spark", chat: "Muse Spark", advisor: "Muse Spark", whatif: "Muse Spark", transcribe: "Muse Voice Transcribe" };

let calls: MetaCall[] = [];
let seq = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function recordCall(c: Omit<MetaCall, "id" | "at">): void {
  calls = [...calls, { ...c, id: ++seq, at: Date.now() }].slice(-50);
  emit();
}

export function useMetaCalls(): MetaCall[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => calls,
    () => calls,
  );
}

/** Reads the model name from a route's reply, wherever that route puts it. */
export function modelOf(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  const d = data as Record<string, unknown>;
  const pick = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
  const trace = d.trace && typeof d.trace === "object" ? (d.trace as Record<string, unknown>) : undefined;
  const models = d.models && typeof d.models === "object" ? Object.values(d.models as Record<string, unknown>).map(pick) : [];
  const names = [pick(d.model), pick(trace?.model), ...models].filter(Boolean) as string[];
  return names.length ? [...new Set(names)].join(" + ") : undefined;
}

/** Starts watching the app's /api calls. Safe to call more than once. */
export function watchMetaCalls(): void {
  const w = window as Window & { __metaWatch?: boolean };
  if (w.__metaWatch || typeof window.fetch !== "function") return;
  w.__metaWatch = true;
  const original = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const path = url.match(/\/api\/(intake|chat|advisor|scene|transcribe|whatif)\b/)?.[1];
    if (!path) return original(input, init);
    // Two routes do a second job, told apart by the request: the board moderator (chat) and the self-check (intake).
    const body = typeof init?.body === "string" ? init.body : "";
    const route = path === "chat" && body.includes('"kind":"board"') ? "board" : path === "intake" && body.includes('"check":true') ? "check" : path;
    const t0 = performance.now();
    try {
      const res = await original(input, init);
      const ms = Math.round(performance.now() - t0);
      void res
        .clone()
        .json()
        .then(
          (data: unknown) => {
            const d = (data ?? {}) as { ok?: boolean; mode?: string };
            const mode = d.mode === "fixture" ? "fixture" : res.ok && d.ok !== false ? "model" : "error";
            recordCall({ feature: FEATURES[route]!, mode, model: mode === "model" ? (modelOf(data) ?? DEFAULT_MODEL[route]) : undefined, ms });
          },
          () => recordCall({ feature: FEATURES[route]!, mode: res.ok ? "model" : "error", model: res.ok ? DEFAULT_MODEL[route] : undefined, ms }),
        );
      return res;
    } catch (err) {
      recordCall({ feature: FEATURES[route]!, mode: "error", ms: Math.round(performance.now() - t0) });
      throw err;
    }
  };
}
