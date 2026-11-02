import { useState, type FormEvent } from "react";
import { DECISION_LABELS, DECISION_TYPES, DEMO_STORY, FIELD_DEFAULTS, FIELD_LABELS, FIELD_QUESTIONS, MONEY_FIELDS, NUMBER_FIELDS, mockApi } from "@/lib/parallax-api";
import { useParallax } from "@/lib/parallax-store";
import { Button, ParallaxMark, Src } from "./shared";
import { DecisionStrip, FieldGrid, readValue } from "./FieldGrid";
import { MicButton } from "./MicButton";

export function StartScreen() {
  const { agreed, set, go } = useParallax();
  return (
    <section className="hero">
      <ParallaxMark size={56} />
      <div className="eyebrow">PARALLAX · FOR FOUNDERS</div>
      <h1>Rehearse the decision before you bet the business</h1>
      <p className="lead">
        Take the contract? Hire now? Raise prices? See 36 months of cash on each path, stress-test it, and question the founder
        you would become.
      </p>
      <ul className="bullets">
        <li>A reflection aid, not financial advice.</li>
        <li>What you type stays in this browser and can be deleted.</li>
        <li>Your words are sent to Meta's AI to write replies.</li>
        <li>Every figure is computed in code from assumptions you can see and change.</li>
      </ul>
      <label className="agree">
        <input type="checkbox" checked={agreed} onChange={(e) => set({ agreed: e.target.checked })} />
        <span>I am 18 or older</span>
      </label>
      <div className="actions-row">
        <Button variant="primary" size="lg" disabled={!agreed} onClick={() => go("intake")}>
          Begin
        </Button>
      </div>
    </section>
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

      {current && (
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
        <Button variant="primary" size="lg" className="ml-auto" disabled={!!current} onClick={() => go("generating")}>
          This is right
        </Button>
      </div>
      {current && <p className="hint">Answer the question above first.</p>}
    </section>
  );
}
