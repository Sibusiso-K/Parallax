import { useEffect, useMemo, useRef, useState } from "react";
import { LETTERS, useParallax, type Letter } from "@/lib/parallax-store";
import { formatMoney } from "@/lib/format";
import { pathFigures, type Setback } from "@/lib/stress";
import { Avatar, Badge, Button, Drawer, NoPaths, Src, cx } from "./shared";
import { CashChart } from "./charts";

const PROMPTS = ["When did cash get tightest?", "What would you warn me about?", "Was it worth it?"];
const end = (a: number[]) => a[a.length - 1] ?? 0;

/** The checks on one reply. A check the code does not run shows as "not run", never as passed. */
function TraceList({ checks }: { checks: { name: string; ok: boolean | null }[] }) {
  return (
    <ul>
      {checks.map((c) => (
        <li key={c.name}>
          {c.ok === null ? "–" : c.ok ? "✓" : "✗"} {c.name}
          {c.ok === null ? " (not run)" : ""}
        </li>
      ))}
    </ul>
  );
}

/** The future founder on the active path: the chat, with the cash chart and the stress test beside it. */
export function ChatScreen() {
  const { active, chats, pathOf, send, set, go, traceOpen } = useParallax();
  const path = pathOf(active);
  const figures = useMemo(() => (path ? pathFigures(path) : null), [path]);
  const [text, setText] = useState("");
  const [menu, setMenu] = useState<string | null>(null);
  const [picked, setPicked] = useState("late-payment");
  const list = useRef<HTMLDivElement>(null);
  const msgs = chats[active];

  useEffect(() => {
    list.current?.lastElementChild?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [msgs.length, msgs[msgs.length - 1]?.text]);

  if (!path || !figures) return <NoPaths />;

  const selected: Setback = figures.setbacks.find((s) => s.id === picked) ?? figures.late;
  /** The question asked just before the reply at index i: the one a reply on another path answers. */
  const questionBefore = (i: number) => [...msgs.slice(0, i)].reverse().find((m) => m.role === "user")?.text ?? "";
  const askOn = (question: string, from: Letter, target: Letter) => {
    set({ active: target });
    void send(target, question, from);
  };

  return (
    <div className="row pagecols">
      <section className="panel chat">
        <header className="chat-head">
          <div className="avwrap">
            <Avatar letter={active} src={path.avatarUrl} size={96} />
            <div className="avcap">AI-generated</div>
          </div>
          <div className="chead">
            <div className="caps">You, as the founder, 36 months on</div>
            <h2>
              <Badge letter={active} /> {path.name}
            </h2>
            <div className="sub">{path.summary}</div>
            <div className="quietrow">
              <button type="button" onClick={() => go("paths")}>
                All paths
              </button>
              <button type="button" onClick={() => set({ panel: { letter: active } })}>
                Assumptions
              </button>
              <button type="button" aria-expanded={traceOpen} onClick={() => set({ traceOpen: true })}>
                Trace
              </button>
              <button type="button" onClick={() => go("compare")}>
                Compare
              </button>
              <button type="button" onClick={() => go("compare")}>
                Comfort check
              </button>
            </div>
          </div>
        </header>

        <div ref={list} className="chat-body">
          {msgs.length === 0 && (
            <div className="suggest">
              <p className="sub">Ask the founder who chose {path.name} anything.</p>
              <div className="actions-row">
                {PROMPTS.map((q) => (
                  <button key={q} type="button" className="chip" onClick={() => send(active, q)}>
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
          {msgs.map((m, i) =>
            m.role === "user" ? (
              <div key={m.id} className="user-wrap">
                {m.askedFrom && <span className="askednote">Asked on {m.askedFrom}, now on {active}</span>}
                <div className="msg user">{m.text}</div>
              </div>
            ) : (
              <div key={m.id} className="bot-wrap">
                <div className="msg bot">{m.text || <span className="sub">…</span>}</div>
                {m.citations.length > 0 && (
                  <div className="based">
                    <span className="caps">Based on</span>
                    {m.citations.map((c) => (
                      <button key={c.id} type="button" className="chip" onClick={() => set({ panel: { letter: active, rowId: c.id } })}>
                        {c.label}
                      </button>
                    ))}
                  </div>
                )}
                {!m.streaming && (
                  <>
                    <div className="acts">
                      <button type="button" aria-expanded={menu === m.id} onClick={() => setMenu(menu === m.id ? null : m.id)}>
                        Ask this on another path
                      </button>
                      <button type="button" onClick={() => set((s) => ({ pinned: { ...s.pinned, [active]: m.text } }))}>
                        Pin this quote
                      </button>
                    </div>
                    {menu === m.id && (
                      <div className="actions-row">
                        {LETTERS.filter((l) => l !== active).map((l) => (
                          <Button
                            key={l}
                            variant="path"
                            size="sm"
                            className={`p-${l}`}
                            onClick={() => {
                              setMenu(null);
                              askOn(questionBefore(i), active, l);
                            }}
                          >
                            Ask on {l}: {pathOf(l)?.name}
                          </Button>
                        ))}
                      </div>
                    )}
                    {m.trace && (
                      <div className="trace">
                        <div className="caps">Trace · this reply</div>
                        <TraceList checks={m.trace.checks} />
                      </div>
                    )}
                  </>
                )}
              </div>
            ),
          )}
        </div>

        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault();
            if (!text.trim()) return;
            send(active, text.trim());
            setText("");
          }}
        >
          <label htmlFor="chat-input" className="sr-only">
            Message your future self
          </label>
          <input id="chat-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask your future self…" />
          <button type="submit" className="send" disabled={!text.trim()}>
            Send
          </button>
        </form>
      </section>

      <div className="rcol">
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Cash in the business, 36 months</h2>
              <div className="sub">
                Path {active}. Solid: the likely case. Dashed: the same case with {selected.name.toLowerCase()} ({selected.detail}).
              </div>
            </div>
          </div>
          <CashChart
            letter={active}
            start={path.startingCash}
            bad={figures.bad}
            likely={figures.likely}
            good={figures.good}
            overlay={selected.line}
            overlayLabel={`${selected.name}: ${formatMoney(selected.lowest.cash)} in month ${selected.lowest.month}`}
          />
          <div className="m36">
            <span>Month 36</span> bad {formatMoney(end(figures.bad))} · likely {formatMoney(end(figures.likely))} · good{" "}
            {formatMoney(end(figures.good))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Stress test on this path</h2>
              <div className="sub">
                One setback at a time, likely case. Sizes are <Src kind="placeholder" /> except the client's own payment terms.
              </div>
            </div>
          </div>
          <div className="srows">
            {figures.setbacks.map((s) => (
              <button
                key={s.id}
                type="button"
                className={cx("srow", s.id === selected.id && "on")}
                aria-pressed={s.id === selected.id}
                onClick={() => setPicked(s.id)}
              >
                <span className="sbody">
                  <span className="sname">{s.name}</span>
                  <span className="ssub">{s.detail}</span>
                  <span className="sstatus">
                    {s.runsOut ? <span className="chipwarn">runs out in month {s.runsOut}</span> : <span className="chipok">stays above zero</span>}
                  </span>
                </span>
                <span className="sright">
                  <span className="sval">
                    {formatMoney(s.lowest.cash)}
                    <span className="smonth"> · month {s.lowest.month}</span>
                  </span>
                  <span className="ssub">Month 36: {formatMoney(s.month36)}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      </div>

      <Drawer open={traceOpen} onClose={() => set({ traceOpen: false })} title="Trace">
        {msgs.filter((m) => m.trace).length === 0 && <p className="sub">No replies yet.</p>}
        <ol className="tracelist">
          {msgs
            .filter((m) => m.trace)
            .map((m, i) => (
              <li key={m.id} className="trace">
                <p>
                  <b>Reply {i + 1}</b> · {m.trace!.model} · {m.trace!.latencyMs} ms
                </p>
                <TraceList checks={m.trace!.checks} />
              </li>
            ))}
        </ol>
      </Drawer>
    </div>
  );
}
