import { useEffect, useRef, useState } from "react";
import { LETTERS, isLite, useParallax, withTransition, type Letter, type Msg } from "@/lib/parallax-store";
import { cn } from "@/lib/utils";
import { Avatar, Button, Drawer, LetterBadge } from "./shared";

const PROMPTS = ["What does a bad month look like?", "How is Mama doing?", "What would you warn me about?"];

export function ChatScreen() {
  const { active, chats, pathOf, send, set, go, announce } = useParallax();
  const path = pathOf(active);
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<"idle" | "back" | "forward">("idle");
  const [traceOpen, setTraceOpen] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const msgs = chats[active];
  const lastDone = [...msgs].reverse().find((m) => m.role === "self" && !m.streaming);

  useEffect(() => {
    list.current?.lastElementChild?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [msgs.length, msgs[msgs.length - 1]?.text]);

  const switchTo = (l: Letter) => {
    setPhase("forward");
    set({ active: l, announce: `Now on path ${l}: ${pathOf(l)?.name}` });
    setTimeout(() => setPhase("idle"), 650);
  };

  async function askOn(m: Msg, target: Letter) {
    setMenu(null);
    const from = active;
    const bubble = document.getElementById(`bubble-${m.id}`);
    if (isLite() || !bubble) {
      switchTo(target);
      await send(target, m.text, from);
      input.current?.focus();
      return;
    }
    const r = bubble.getBoundingClientRect();
    const clone = bubble.cloneNode(true) as HTMLElement;
    Object.assign(clone.style, { position: "fixed", left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, margin: "0", zIndex: "60", pointerEvents: "none" });
    clone.removeAttribute("id");
    document.body.appendChild(clone);
    setPhase("back");
    await new Promise((res) => setTimeout(res, 600));
    switchTo(target);
    await new Promise((res) => requestAnimationFrame(() => res(null)));
    const lr = list.current!.getBoundingClientRect();
    const last = list.current!.lastElementChild?.getBoundingClientRect();
    const top = (last ? last.bottom + 16 : lr.top + 8) - r.top;
    const left = lr.right - r.width - r.left;
    await clone.animate([{ transform: "none" }, { transform: `translate(${left}px, ${top}px)` }], { duration: 600, easing: "cubic-bezier(.19,1,.22,1)", fill: "forwards" }).finished.catch(() => {});
    clone.remove();
    const p = send(target, m.text, from);
    input.current?.focus();
    await p;
  }

  if (!path) return null;
  return (
    <section className="mx-auto flex max-w-2xl flex-col" data-path={active}>
      <div className="sr-only" aria-live="polite">{announce}</div>
      <div className="sr-only" aria-live="polite">{lastDone?.text}</div>
      <nav aria-label="Paths" className="flex gap-2 no-print">
        {LETTERS.map((l, i) => {
          const p = pathOf(l)!;
          const on = l === active;
          return (
            <button
              key={l}
              type="button"
              data-path={l}
              aria-pressed={on}
              onClick={() => !on && withTransition(() => switchTo(l))}
              className={cn("tap flex flex-1 items-center gap-2 rounded-xl border px-2 py-1.5 text-left text-sm transition-colors duration-150", on ? "border-path bg-path-soft font-semibold text-foreground" : "bg-card text-foreground hover:bg-muted")}
            >
              <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
                {LETTERS.map((x, j) => {
                  const d = (j - i + 3) % 3;
                  return <rect key={x} x={2 + d * 3} y={8 - d * 3} width="12" height="12" rx="3" fill={`var(--path-${x.toLowerCase()})`} opacity={d === 0 ? 1 : 0.35} />;
                }).reverse()}
              </svg>
              <span className="truncate">{l} · {p.name}</span>
            </button>
          );
        })}
      </nav>

      <header className="mt-4 flex items-center gap-4">
        <Avatar letter={active} src={path.avatarUrl} size={64} vtName="pm-avatar" />
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">Naledi in 2029</p>
          <h1 className="flex items-center gap-2 text-2xl font-semibold"><LetterBadge letter={active} /> {path.name}</h1>
        </div>
      </header>
      <div className="mt-3 flex flex-wrap gap-1 no-print">
        <Button variant="quiet" onClick={() => go("paths")}>All paths</Button>
        <Button variant="quiet" aria-expanded={false} onClick={() => set({ panel: { letter: active } })}>Assumptions</Button>
        <Button variant="quiet" aria-expanded={traceOpen} onClick={() => setTraceOpen(true)}>Trace</Button>
        <Button variant="quiet" onClick={() => go("compare")}>Compare</Button>
        <Button variant="quiet" onClick={() => go("comfort")}>Comfort check</Button>
      </div>

      <div ref={list} className={cn("mt-4 min-h-64 space-y-4", phase === "back" && "layer-back", phase === "forward" && "layer-forward")}>
        {msgs.length === 0 && (
          <div className="surface p-5 msg-in">
            <p>Ask the version of you who chose <strong>{path.name}</strong> anything.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {PROMPTS.map((q) => <Button key={q} variant="outline" size="sm" onClick={() => send(active, q)}>{q}</Button>)}
            </div>
          </div>
        )}
        {msgs.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="flex flex-col items-end msg-in">
              {m.askedFrom && <span className="chip mb-1">Asked on {m.askedFrom}, now on {active}</span>}
              <div id={`bubble-${m.id}`} className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-primary-foreground">{m.text}</div>
              <Button variant="quiet" aria-expanded={menu === m.id} onClick={() => setMenu(menu === m.id ? null : m.id)}>Ask this on another path</Button>
              {menu === m.id && (
                <div className="flex gap-2">
                  {LETTERS.filter((l) => l !== active).map((l) => (
                    <Button key={l} data-path={l} variant="path" size="sm" onClick={() => askOn(m, l)}>Ask on {l}: {pathOf(l)?.name}</Button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div key={m.id} className="flex gap-3 msg-in">
              <Avatar letter={active} src={path.avatarUrl} size={36} className="rounded-xl" />
              <div className="surface max-w-[85%] rounded-tl-md px-4 py-3">
                <p className="leading-relaxed">{m.text || <span className="text-muted-foreground">…</span>}</p>
                {m.citations.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Based on</span>
                    {m.citations.map((c) => (
                      <button key={c.id} type="button" className="chip tap-sm hover:bg-path-soft" onClick={() => set({ panel: { letter: active, rowId: c.id } })}>{c.label}</button>
                    ))}
                  </div>
                )}
                {!m.streaming && (
                  <Button variant="quiet" className="-ml-3" onClick={() => set((s) => ({ pinned: { ...s.pinned, [active]: m.text } }))}>Pin this quote</Button>
                )}
              </div>
            </div>
          ),
        )}
      </div>

      <form
        className="sticky bottom-2 mt-6 flex gap-2 rounded-full border bg-card p-1.5 shadow-lg no-print"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          send(active, text.trim());
          setText("");
        }}
      >
        <label htmlFor="chat-input" className="sr-only">Message your future self</label>
        <input id="chat-input" ref={input} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask your future self…" className="min-w-0 flex-1 rounded-full bg-transparent px-4 text-base" />
        <Button type="submit" disabled={!text.trim()}>Send</Button>
      </form>

      <Drawer open={traceOpen} onClose={() => setTraceOpen(false)} title="Trace">
        {msgs.filter((m) => m.trace).length === 0 && <p className="text-muted-foreground">No replies yet.</p>}
        <ol className="space-y-4">
          {msgs.filter((m) => m.trace).map((m, i) => (
            <li key={m.id} className="rounded-xl border p-3 text-sm">
              <p className="font-medium">Reply {i + 1}</p>
              <p>Model: {m.trace!.model}</p>
              <p>Latency: {m.trace!.latencyMs} ms</p>
              <ul className="mt-1">
                {m.trace!.checks.map((c) => <li key={c.name}>{c.ok ? "✓" : "✗"} {c.name}</li>)}
              </ul>
            </li>
          ))}
        </ol>
      </Drawer>
    </section>
  );
}
