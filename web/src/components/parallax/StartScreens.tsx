import { useEffect, useState, type FormEvent } from "react";
import { DECISION_LABELS, DECISION_TYPES, DEMO_STORY, FIELD_DEFAULTS, FIELD_LABELS, FIELD_QUESTIONS, MONEY_FIELDS, NUMBER_FIELDS, mockApi, type Health } from "@/lib/parallax-api";
import { useParallax } from "@/lib/parallax-store";
import { Avatar, Button, Src } from "./shared";
import { DecisionStrip, FieldGrid, readValue } from "./FieldGrid";
import { MicButton } from "./MicButton";

// The four steps of a run, for a founder (or a judge) opening Parallax for the first time.
const HOW_TO: [string, string][] = [
  ["Tell it your decision", "Type it the way you would tell a cofounder, or press Speak instead. Sales, costs, cash and the choice on the table."],
  ["Check what it heard", "Every figure shows the words it came from. Answer the follow-ups, or press I don't know to use a marked default."],
  ["Meet three futures", "Paths A, B and C, each with 36 months of cash computed in code. Stress-test them and ask each future you why."],
  ["Compare and decide", "Put the paths side by side, check how much risk you are comfortable with, and print a decision memo."],
];

/**
 * The privacy and model notes say what is really switched on, from /api/health. Until it answers, they describe demo
 * mode, where nothing leaves Parallax's own server.
 */
function ModelNotes() {
  const [health, setHealth] = useState<Health | null>(null);
  useEffect(() => {
    let live = true;
    mockApi.health().then((h) => live && setHealth(h));
    return () => {
      live = false;
    };
  }, []);
  if (!health?.modelReady && !health?.voiceReady) {
    return (
      <>
        <div className="note">
          <b>Not stored</b>
          <span>Your text goes only to Parallax's own server, to be read. The server does not keep it.</span>
        </div>
        <div className="note">
          <b>No model connected yet</b>
          <span>This demo reads only the demo story and writes canned replies. Every figure is computed in code.</span>
        </div>
      </>
    );
  }
  const reads = [health.modelReady && "Muse Spark reads your story", health.voiceReady && "Muse Voice Transcribe turns your voice into text"]
    .filter(Boolean)
    .join(", and ");
  return (
    <>
      <div className="note">
        <b>Not stored</b>
        <span>
          Your {health.modelReady ? "text" : "recording"} goes to Parallax's server and on to Meta's Model API, only to be read. Parallax
          does not keep it.
        </span>
      </div>
      <div className="note">
        <b>Read by Meta's Muse models</b>
        <span>{reads}. Every figure is still computed in code, and the future-self chat uses scripted replies.</span>
      </div>
    </>
  );
}

export function StartScreen() {
  const { agreed, set, go } = useParallax();
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">Parallax · for founders</div>
          <h1>Rehearse the decision before you bet the business</h1>
          <p className="lead">
            Take the contract? Hire now? Raise prices? See 36 months of cash on each path, stress-test it, and question the founder
            you would become.
          </p>
          <label className="agree">
            <input type="checkbox" checked={agreed} onChange={(e) => set({ agreed: e.target.checked })} />
            <span>I am 18 or older</span>
          </label>
          <div className="actions-row">
            <Button variant="primary" size="lg" disabled={!agreed} onClick={() => go("intake")}>
              Begin
            </Button>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <Avatar letter="B" src="/avatars/B.png" size={210} className="hero-face hero-b" />
          <Avatar letter="A" src="/avatars/A.png" size={168} className="hero-face hero-a" />
          <Avatar letter="C" src="/avatars/C.png" size={168} className="hero-face hero-c" />
        </div>
      </section>
      <section className="how-to" aria-labelledby="how-to-title">
        <div className="how-head">
          <h2 id="how-to-title">How it works</h2>
          <p>
            First time? Tick the box, press <b>Begin</b>, then <b>Use the demo story</b> to see a full run in about two minutes.
          </p>
        </div>
        <ol className="how-steps">
          {HOW_TO.map(([title, text], i) => (
            <li key={title}>
              <span className="how-num" aria-hidden="true">
                {i + 1}
              </span>
              <b>{title}</b>
              <span>{text}</span>
            </li>
          ))}
        </ol>
      </section>
      <section className="start-notes">
        <div className="note">
          <b>A reflection aid</b>
          <span>Not financial advice. One possible future, not a prediction.</span>
        </div>
        <ModelNotes />
      </section>
    </>
  );
}

export function IntakeScreen() {
  const { story, set, go } = useParallax();
  const [busy, setBusy] = useState(false);
  async function next() {
    setBusy(true);
    const res = await mockApi.intake(story);
    set({ intake: res, fields: res.fields, quotes: res.quotes ?? {}, missing: res.missing, assumed: [], followed: [] });
    setBusy(false);
    go("heard");
  }
  return (
    <section className="screen intake">
      <div className="pagehead">
        <div className="eyebrow">Step 1 of 3</div>
        <h1>What are you deciding?</h1>
        <div className="sub">
          Write it the way you would tell a cofounder: what the business does, what it sells and spends each month, the cash in the
          bank, the decision on the table, and what matters most.
        </div>
      </div>
      <label htmlFor="story" className="sr-only">
        What are you deciding?
      </label>
      <textarea
        id="story"
        className="field-area"
        rows={9}
        value={story}
        onChange={(e) => set({ story: e.target.value })}
        placeholder="A client has offered us a contract, but…"
      />
      <div className="actions-row">
        <Button variant="outline" onClick={() => set({ story: DEMO_STORY })}>
          Use the demo story (fictional founder)
        </Button>
        <MicButton onText={(text) => set((s) => ({ story: s.story.trim() ? `${s.story.trimEnd()} ${text}` : text }))} />
        <Button variant="primary" className="ml-auto" onClick={next} disabled={!story.trim() || busy}>
          {busy ? "Reading…" : "Continue"}
        </Button>
      </div>
      <p className="hint" aria-live="polite">
        {busy ? "Reading your situation" : ""}
      </p>
    </section>
  );
}

export function HeardScreen() {
  const { missing, intake, set, go } = useParallax();
  const current = missing[0];
  // F4: a blocking check (under 18, out of scope, not supported yet) stops the paths until the founder changes what
  // they wrote. The others are questions to confirm; they never stop anything.
  const issues = intake?.issues ?? [];
  const blocking = issues.filter((i) => i.blocking);
  const checks = issues.filter((i) => !i.blocking);
  const [answer, setAnswer] = useState("");
  const [err, setErr] = useState("");

  const resolve = (value: unknown, isDefault: boolean) => {
    if (!current) return;
    set((s) => ({
      fields: { ...s.fields, [current]: value },
      missing: s.missing.slice(1),
      assumed: isDefault ? [...s.assumed, current] : s.assumed,
      followed: isDefault ? s.followed : [...s.followed, current],
    }));
    setAnswer("");
    setErr("");
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!current) return;
    const r = readValue(current, answer);
    if (!r.ok) return setErr(r.msg);
    resolve(r.value, false);
  };

  return (
    <section className="screen">
      <div className="pagehead">
        <div className="eyebrow">Step 2 of 3 · Your business, today</div>
        <h1>Here is what I heard</h1>
        <div className="sub">
          Check each line. The quotes are your own words. Anything marked as a default or a follow-up is one tap from changing.
        </div>
      </div>
      {intake?.notice && <p className="notice">{intake.notice}</p>}

      {blocking.length > 0 && (
        <div className="issue-box blocking" role="alert">
          <div className="caps">Parallax can't go on with this</div>
          <ul>
            {[...new Set(blocking.map((i) => i.message))].map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
          <div className="row-btns">
            <Button variant="primary" onClick={() => go("intake")}>
              Change what I wrote
            </Button>
          </div>
        </div>
      )}
      {checks.length > 0 && (
        <div className="issue-box">
          <div className="caps">Please check</div>
          <ul>
            {[...new Set(checks.map((i) => i.message))].map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      )}

      {current && blocking.length === 0 && (
        <form key={current} className="followup-box" onSubmit={submit}>
          <div className="caps">
            One more thing{missing.length > 1 ? ` · ${missing.length} left` : ""}
          </div>
          {current === "decisionType" ? (
            <>
              <p className="q" id="followup-q">
                {FIELD_QUESTIONS[current]}
              </p>
              <div className="row-btns" role="group" aria-labelledby="followup-q">
                {DECISION_TYPES.map((t) => (
                  <Button key={t} variant="outline" onClick={() => resolve(t, false)}>
                    {DECISION_LABELS[t]}
                  </Button>
                ))}
              </div>
            </>
          ) : (
            <>
              <label htmlFor="followup" className="q">
                {FIELD_QUESTIONS[current] ?? FIELD_LABELS[current]}
              </label>
              <input
                id="followup"
                autoFocus
                className="field-input"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder={MONEY_FIELDS.includes(current) ? "e.g. 8k, or 8k to 12k" : NUMBER_FIELDS.includes(current) ? "e.g. 30" : ""}
                aria-invalid={!!err}
                aria-describedby={err ? "followup-err" : undefined}
              />
              {err && (
                <p id="followup-err" className="ferr" role="alert">
                  {err}
                </p>
              )}
              <div className="row-btns">
                <Button type="submit" variant="primary">
                  Add
                </Button>
                <Button variant="outline" onClick={() => resolve(FIELD_DEFAULTS[current] ?? "Not sure", true)}>
                  I don't know
                </Button>
              </div>
            </>
          )}
        </form>
      )}

      <DecisionStrip />
      <FieldGrid editable />
      <div className="notice">
        <Src kind="placeholder" /> Behind the three paths, not yet sourced: the cost shares, the rented-equipment share and the setback
        sizes come from the defaults file. Each is marked on the path pages.
      </div>
      <div className="actions-row">
        <Button variant="ghost" onClick={() => go("intake")}>
          Back
        </Button>
        <Button variant="primary" size="lg" className="ml-auto" disabled={!!current || blocking.length > 0} onClick={() => go("generating")}>
          This is right
        </Button>
      </div>
      {blocking.length > 0 ? (
        <p className="hint">Change what you wrote to go on.</p>
      ) : (
        current && <p className="hint">Answer the question above first.</p>
      )}
    </section>
  );
}
