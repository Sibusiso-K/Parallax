// The board meeting: one question to all three futures at once. Each answers from its own path through the usual
// future-self chat (and its figure guard), side by side; then a moderator on Muse Spark says where they agree and where
// they differ, without stating a figure. In demo mode the answers are the scripted ones and the moderator is off.
import { useEffect, useRef, useState } from "react";
import { LETTERS, useParallax, type Letter } from "@/lib/parallax-store";
import { Avatar, Badge, Button, cx } from "./shared";

const ASKS = ["What would you each warn me about?", "When was cash tightest for you?", "What would you do differently?"];

interface Summary {
  agree: string[];
  differ: string[];
  ask: string;
  dropped: number;
  model?: string;
}
interface Round {
  question: string;
  /** Where each future's chat stood before this question, so its answer can be found as it streams in. */
  start: Record<Letter, number>;
  summary?: Summary;
  note?: string;
}

export function BoardMeeting() {
  const { paths, chats, send, language } = useParallax();
  const latest = useRef(chats);
  latest.current = chats;
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [round, setRound] = useState<Round | null>(null);
  const live = useRef(true);
  useEffect(() => () => void (live.current = false), []);

  const answerOf = (l: Letter, r: Round) => latest.current[l].slice(r.start[l]).find((m) => m.role === "self");

  async function hold(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    setBusy(true);
    const start = Object.fromEntries(LETTERS.map((l) => [l, latest.current[l].length])) as Record<Letter, number>;
    const r: Round = { question: q, start };
    setRound(r);
    await Promise.all(paths.map((p) => send(p.letter, q)));
    // Let the last streamed words land in the store before reading them back.
    for (let i = 0; i < 20 && paths.some((p) => answerOf(p.letter, r)?.streaming !== false); i++) await new Promise((res) => setTimeout(res, 100));
    const replies = paths
      .map((p) => ({ letter: p.letter, name: p.name, text: answerOf(p.letter, r)?.text.trim() ?? "" }))
      .filter((x) => x.text);
    let summary: Summary | undefined;
    let note: string | undefined;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "board", question: q, replies, language: language !== "en" ? language : undefined }),
      });
      const data = (await res.json()) as (Summary & { ok?: boolean; mode?: string; error?: string }) | null;
      if (data?.ok && data.mode === "model") summary = { agree: data.agree ?? [], differ: data.differ ?? [], ask: data.ask ?? "", dropped: data.dropped ?? 0, model: data.model };
      else if (data?.mode === "fixture") note = "Demo mode: the moderator needs Muse Spark, so the three answers are shown side by side.";
      else note = data?.error ?? "The moderator couldn't sum up just now.";
    } catch {
      note = "The moderator couldn't be reached.";
    }
    if (!live.current) return;
    setRound({ ...r, summary, note });
    setBusy(false);
  }

  if (paths.length < 2) return null;
  return (
    <section className={cx("board panel", open && "is-open")} aria-labelledby="board-title">
      <div className="board-head">
        <div>
          <div className="caps">Board meeting</div>
          <h2 id="board-title">Ask all three futures at once</h2>
        </div>
        <Button variant={open ? "ghost" : "primary"} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? "Close" : "Hold a board meeting"}
        </Button>
      </div>
      {open && (
        <>
          <form
            className="board-ask"
            onSubmit={(e) => {
              e.preventDefault();
              void hold(text);
            }}
          >
            <label htmlFor="board-q" className="sr-only">
              Your question for all three futures
            </label>
            <input id="board-q" className="field-input" value={text} maxLength={1000} onChange={(e) => setText(e.target.value)} placeholder="Ask A, B and C the same question" />
            <Button type="submit" variant="primary" disabled={busy || !text.trim()}>
              {busy ? "In session…" : "Ask the board"}
            </Button>
            <div className="board-chips">
              {ASKS.map((a) => (
                <button
                  key={a}
                  type="button"
                  className="chip"
                  disabled={busy}
                  onClick={() => {
                    setText(a);
                    void hold(a);
                  }}
                >
                  {a}
                </button>
              ))}
            </div>
          </form>
          {round && (
            <>
              <p className="board-q">“{round.question}”</p>
              <div className="board-seats">
                {paths.map((p) => {
                  const a = answerOf(p.letter, round);
                  return (
                    <article key={p.id} className={cx("seat", `p-${p.letter}`)}>
                      <header>
                        <Avatar letter={p.letter} src={p.avatarUrl} size={44} />
                        <span>
                          <Badge letter={p.letter} /> <b>{p.name}</b>
                        </span>
                      </header>
                      <p>{a?.text || <span className="sub">Thinking…</span>}</p>
                    </article>
                  );
                })}
              </div>
              {round.summary ? (
                <div className="moderator">
                  <div className="caps">The moderator · {round.summary.model ?? "Muse Spark"}</div>
                  {round.summary.agree.length > 0 && (
                    <>
                      <h3>Where they agree</h3>
                      <ul>
                        {round.summary.agree.map((x) => (
                          <li key={x}>{x}</li>
                        ))}
                      </ul>
                    </>
                  )}
                  {round.summary.differ.length > 0 && (
                    <>
                      <h3>Where they differ</h3>
                      <ul>
                        {round.summary.differ.map((x) => (
                          <li key={x}>{x}</li>
                        ))}
                      </ul>
                    </>
                  )}
                  {round.summary.ask && (
                    <p className="moderator-ask">
                      <b>For you to answer:</b> {round.summary.ask}
                    </p>
                  )}
                  <p className="sub small">
                    The moderator states no figures; every number above comes from the engine.
                    {round.summary.dropped > 0 ? ` ${round.summary.dropped} of its sentences had a number and were removed.` : ""} It does not choose for you.
                  </p>
                </div>
              ) : (
                round.note && <p className="sub board-note">{round.note}</p>
              )}
              {busy && !round.summary && !round.note && <p className="sub board-note">Waiting for all three, then the moderator…</p>}
            </>
          )}
        </>
      )}
    </section>
  );
}
