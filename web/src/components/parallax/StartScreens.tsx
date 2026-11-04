import { useEffect, useState, type FormEvent } from "react";
import { DECISION_LABELS, DECISION_TYPES, DEMO_STORY, FIELD_DEFAULTS, FIELD_LABELS, FIELD_QUESTIONS, MONEY_FIELDS, NUMBER_FIELDS, mockApi, type Health } from "@/lib/parallax-api";
import { useParallax } from "@/lib/parallax-store";
import { Avatar, Button, Src } from "./shared";
import { Listen } from "./Listen";
import { DecisionStrip, FieldCards, readValue } from "./FieldGrid";
import { MicButton } from "./MicButton";
import { StepNav } from "./StepNav";

// The run in four lines, for a founder (or a judge) opening Parallax for the first time.
const HOW_TO: [string, string][] = [
  ["Tell", "Type or say your decision, like you'd tell a cofounder."],
  ["Check", "Fix any figure it got wrong."],
  ["See three futures", "36 months of cash on each path, computed in code."],
  ["Step inside and ask", "Walk into each future and question the founder you'd become."],
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
  const meta = !!(health?.modelReady || health?.voiceReady);
  const toMeta = meta ? " Meta's Model API reads it too, and keeps nothing for Parallax." : "";
  const privacy = health?.savingReady ? (
    <div className="note">
      <b>Saved privately</b>
      <span>Saved under a code only this browser holds. Delete everything erases it.{toMeta}</span>
    </div>
  ) : (
    <div className="note">
      <b>Kept on this device</b>
      <span>The server keeps nothing; this browser keeps a copy. Delete everything erases it.{toMeta}</span>
    </div>
  );
  if (!meta) {
    return (
      <>
        {privacy}
        <div className="note">
          <b>Demo mode</b>
          <span>No model is connected: it reads the demo story only, with canned replies. Figures are computed in code.</span>
        </div>
      </>
    );
  }
  const reads = [health?.modelReady && "Muse Spark reads your story and speaks as each future you", health?.voiceReady && "Muse Voice Transcribe hears you"]
    .filter(Boolean)
    .join("; ");
  return (
    <>
      {privacy}
      <div className="note">
        <b>Meta's Muse models</b>
        <span>{reads}. Every figure is computed in code, never by a model.</span>
      </div>
    </>
  );
}

const STEP_NAMES: Partial<Record<string, string>> = {
  intake: "telling your story",
  heard: "checking the figures",
  profile: "checking the figures",
  paths: "the three futures",
  chat: "asking a future you",
  explore: "the room",
  compare: "deciding",
  comfort: "deciding",
  summary: "your memo",
  roadmap: "your journey",
};

/** Offers the saved decision back. Nothing is restored until the founder says so. */
function ResumeCard() {
  const { resume, resumeSaved, dismissResume } = useParallax();
  if (!resume) return null;
  return (
    <div className="resume-card" role="region" aria-label="Your saved decision">
      <div className="eyebrow">Welcome back</div>
      <b>{resume.decision || "Your saved decision"}</b>
      <span>
        {resume.business ? `${resume.business} · ` : ""}you were on {STEP_NAMES[resume.step] ?? "your decision"}.
      </span>
      <div className="actions-row">
        <Button variant="primary" onClick={resumeSaved}>
          Pick up where I left off
        </Button>
        <Button variant="ghost" className="on-navy" onClick={dismissResume}>
          Start fresh
        </Button>
      </div>
    </div>
  );
}

/** Reads a story into figures and opens the check screen. Shared by the demo button and the story screen. */
function useReadStory() {
  const { set, go } = useParallax();
  const [busy, setBusy] = useState(false);
  async function read(story: string) {
    setBusy(true);
    const res = await mockApi.intake(story);
    set({ story, intake: res, fields: res.fields, quotes: res.quotes ?? {}, missing: res.missing, assumed: [], followed: [] });
    setBusy(false);
    go("heard");
  }
  return { busy, read };
}

export function StartScreen() {
  const { agreed, set, go } = useParallax();
  const { busy, read } = useReadStory();
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">Parallax · for founders</div>
          <h1>Rehearse a big decision before you make it</h1>
          <p className="lead">Take the contract? Hire? Raise prices? See three futures, 36 months of cash each, then ask the founder you'd become.</p>
          <ResumeCard />
          <label className="agree">
            <input type="checkbox" checked={agreed} onChange={(e) => set({ agreed: e.target.checked })} />
            <span>I am 18 or older</span>
          </label>
          <div className="start-choice">
            <Button variant="primary" size="lg" disabled={!agreed || busy} onClick={() => void read(DEMO_STORY)}>
              {busy ? "Reading the demo…" : "Try the demo"}
            </Button>
            <Button variant="outline" size="lg" className="on-navy" disabled={!agreed || busy} onClick={() => go("intake")}>
              Tell my own story
            </Button>
          </div>
          <p className="start-sub">The demo is a fictional caterer weighing a big contract. About two minutes.</p>
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
  const { story, set } = useParallax();
  const { busy, read } = useReadStory();
  return (
    <section className="screen intake">
      <div className="pagehead">
        <div className="eyebrow">Tell</div>
        <h1>What are you deciding?</h1>
        <div className="sub">Say it like you'd tell a cofounder: what you sell and spend a month, the cash in the bank, and the choice on the table.</div>
      </div>
      <label htmlFor="story" className="sr-only">
        What are you deciding?
      </label>
      <textarea
        id="story"
        className="field-area"
        rows={8}
        value={story}
        onChange={(e) => set({ story: e.target.value })}
        placeholder="We sell about R90k a month. A client has offered us a 12-month contract, but they pay 90 days late…"
      />
      <StepNav nextLabel={busy ? "Reading…" : undefined} onNext={() => void read(story)} nextDisabled={!story.trim() || busy}>
        <Button variant="outline" onClick={() => set({ story: DEMO_STORY })}>
          Use the demo story
        </Button>
        <MicButton onText={(text) => set((s) => ({ story: s.story.trim() ? `${s.story.trimEnd()} ${text}` : text }))} />
      </StepNav>
      <p className="hint" aria-live="polite">
        {busy ? "Reading your story" : ""}
      </p>
    </section>
  );
}

export function HeardScreen() {
  const { missing, followed, assumed, intake, set, go } = useParallax();
  const current = missing[0];
  // F4: a blocking check (under 18, out of scope, not supported yet) stops the paths until the founder changes what
  // they wrote. The others are questions to confirm; they never stop anything.
  const issues = intake?.issues ?? [];
  const blocking = issues.filter((i) => i.blocking);
  const checks = issues.filter((i) => !i.blocking);
  const [answer, setAnswer] = useState("");
  const [err, setErr] = useState("");
  // Questions answered so far plus the ones left: shown as "2 of 4", one question at a time.
  const asked = followed.length + assumed.length;
  const total = asked + missing.length;

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
        <div className="eyebrow">Check</div>
        <h1>{current ? "A few quick questions" : "Is this right?"}</h1>
        <div className="sub">{current ? "One at a time. Not sure? Press I don't know and a marked default is used." : "Tap any figure to fix it."}</div>
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
            Question {asked + 1} of {total}
          </div>
          {current === "decisionType" ? (
            <>
              <p className="q" id="followup-q">
                {FIELD_QUESTIONS[current]}
              </p>
              <Listen id={`q-${current}`} text={FIELD_QUESTIONS[current] ?? ""} />
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
              <Listen id={`q-${current}`} text={FIELD_QUESTIONS[current] ?? FIELD_LABELS[current]} />
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
                  Next
                </Button>
                <Button variant="outline" onClick={() => resolve(FIELD_DEFAULTS[current] ?? "Not sure", true)}>
                  I don't know
                </Button>
              </div>
            </>
          )}
        </form>
      )}

      {!current && (
        <>
          <DecisionStrip />
          <FieldCards />
          <p className="notice small">
            <Src kind="placeholder" /> Some numbers behind the futures are placeholders, such as cost shares and setback sizes. Change
            them any time under Tools.
          </p>
        </>
      )}
      <StepNav
        nextDisabled={!!current || blocking.length > 0}
        hint={blocking.length > 0 ? "Change what you wrote to go on." : "Answer the question above first."}
      />
    </section>
  );
}
