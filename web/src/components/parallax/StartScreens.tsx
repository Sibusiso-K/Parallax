import { useState } from "react";
import { DEMO_STORY, FIELD_DEFAULTS, FIELD_LABELS, FIELD_QUESTIONS, MONEY_FIELDS, mockApi } from "@/lib/parallax-api";
import { useParallax } from "@/lib/parallax-store";
import { formatField, isMoneyField, parseAmount } from "@/lib/format";
import type { FieldKey } from "@/lib/types";
import { Button, ParallaxMark, ScreenTitle, inputCls } from "./shared";

export function StartScreen() {
  const { agreed, set, go } = useParallax();
  return (
    <section className="mx-auto flex max-w-xl flex-col pt-8 sm:pt-20 stagger">
      <ParallaxMark size={56} />
      <p className="mt-6 text-sm font-semibold tracking-wide text-muted-foreground">PARALLAX</p>
      <h1 className="mt-2 text-4xl font-semibold sm:text-5xl">Talk to each possible future before you choose one</h1>
      <ul className="mt-8 space-y-2 border-l-2 border-border pl-4 text-foreground">
        <li>A reflection aid, not financial advice.</li>
        <li>What you type stays in this browser and can be deleted.</li>
        <li>Your words are sent to Meta's AI to write replies.</li>
        <li>Every figure is computed in code from assumptions you can see and change.</li>
      </ul>
      <label className="tap mt-8 flex cursor-pointer items-center gap-3 rounded-xl py-2">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => set({ agreed: e.target.checked })}
          className="h-6 w-6 shrink-0 accent-[var(--foreground)]"
        />
        <span>I am 18 or older</span>
      </label>
      <Button size="lg" className="mt-4 self-start" disabled={!agreed} onClick={() => go("intake")}>
        Begin
      </Button>
    </section>
  );
}

export function IntakeScreen() {
  const { story, set, go } = useParallax();
  const [busy, setBusy] = useState(false);
  async function next() {
    setBusy(true);
    const res = await mockApi.intake(story);
    set({ intake: res, fields: res.fields, missing: res.missing, assumed: [] });
    setBusy(false);
    go("heard");
  }
  return (
    <section className="mx-auto max-w-2xl screen-in">
      <ScreenTitle eyebrow="Step 1 of 3" title="What are you deciding?">
        Write it the way you'd tell a friend: your work, money coming in and going out, who depends on you, and what
        matters most.
      </ScreenTitle>
      <label htmlFor="story" className="sr-only">
        What are you deciding?
      </label>
      <textarea
        id="story"
        rows={9}
        value={story}
        onChange={(e) => set({ story: e.target.value })}
        className={`${inputCls} min-h-56 resize-y leading-relaxed`}
        placeholder="I'm thinking about leaving my job to…"
      />
      <div className="mt-4 flex flex-wrap gap-3">
        <Button variant="outline" onClick={() => set({ story: DEMO_STORY })}>
          Use the demo story (Naledi, fictional)
        </Button>
        <Button onClick={next} disabled={!story.trim() || busy} className="sm:ml-auto">
          {busy ? "Reading…" : "Continue"}
        </Button>
      </div>
      <p className="mt-3 text-sm text-muted-foreground" aria-live="polite">
        {busy ? "Reading your situation" : ""}
      </p>
    </section>
  );
}

function readValue(key: FieldKey, raw: string): { ok: true; value: unknown } | { ok: false; msg: string } {
  if (!raw.trim()) return { ok: false, msg: "Type something, or choose “I don't know”." };
  if (MONEY_FIELDS.includes(key)) {
    const p = parseAmount(raw);
    if (!p) return { ok: false, msg: "Try an amount like 8000, 8k, about 8k, or 8k to 12k." };
    return { ok: true, value: { ...p, quote: raw.trim() } };
  }
  return { ok: true, value: raw.trim() };
}

function FieldRow({ k, value, assumed }: { k: FieldKey; value: unknown; assumed: boolean }) {
  const { set } = useParallax();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [err, setErr] = useState("");
  const range = isMoneyField(value) && value.low !== value.high;
  const save = () => {
    const r = readValue(k, draft);
    if (!r.ok) return setErr(r.msg);
    set((s) => ({ fields: { ...s.fields, [k]: r.value }, assumed: s.assumed.filter((a) => a !== k) }));
    setEditing(false);
  };
  return (
    <li className="py-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground">{FIELD_LABELS[k]}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-lg">
            <span className="tabular-nums">{formatField(value)}</span>
            {range && <span className="chip">range</span>}
            {assumed && <span className="chip border border-dashed border-input bg-card">assumed</span>}
          </p>
          {isMoneyField(value) && value.quote && !assumed && (
            <p className="mt-0.5 text-sm text-muted-foreground">You said: “{value.quote}”</p>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          aria-expanded={editing}
          onClick={() => {
            setDraft(isMoneyField(value) ? value.quote : String(value ?? ""));
            setErr("");
            setEditing((e) => !e);
          }}
        >
          {editing ? "Cancel" : "Edit"}
        </Button>
      </div>
      {editing && (
        <form
          className="mt-3 flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <label className="sr-only" htmlFor={`f-${k}`}>
            {FIELD_LABELS[k]}
          </label>
          <input
            id={`f-${k}`}
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className={inputCls}
            aria-invalid={!!err}
            aria-describedby={err ? `e-${k}` : undefined}
          />
          <Button type="submit">Save</Button>
          {err && (
            <p id={`e-${k}`} className="text-sm text-destructive sm:hidden">
              {err}
            </p>
          )}
        </form>
      )}
      {editing && err && <p className="mt-1 hidden text-sm text-destructive sm:block">{err}</p>}
    </li>
  );
}

export function HeardScreen() {
  const { fields, missing, assumed, set, go } = useParallax();
  const current = missing[0];
  const [answer, setAnswer] = useState("");
  const [err, setErr] = useState("");
  const keys = (Object.keys(FIELD_LABELS) as FieldKey[]).filter((k) => fields[k] !== undefined);

  const resolve = (value: unknown, isDefault: boolean) => {
    if (!current) return;
    set((s) => ({
      fields: { ...s.fields, [current]: value },
      missing: s.missing.slice(1),
      assumed: isDefault ? [...s.assumed, current] : s.assumed,
    }));
    setAnswer("");
    setErr("");
  };

  return (
    <section className="mx-auto max-w-2xl screen-in">
      <ScreenTitle eyebrow="Step 2 of 3" title="Here is what I heard">
        Check each line. Change anything that isn't quite right.
      </ScreenTitle>

      {current && (
        <form
          key={current}
          className="surface mb-6 border-2 border-path bg-highlight p-5 msg-in"
          onSubmit={(e) => {
            e.preventDefault();
            const r = readValue(current, answer);
            if (!r.ok) return setErr(r.msg);
            resolve(r.value, false);
          }}
        >
          <p className="text-sm font-medium text-muted-foreground">
            One more thing{missing.length > 1 ? ` · ${missing.length} left` : ""}
          </p>
          <label htmlFor="followup" className="mt-1 block text-xl font-medium">
            {FIELD_QUESTIONS[current] ?? FIELD_LABELS[current]}
          </label>
          <input
            id="followup"
            autoFocus
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            className={`${inputCls} mt-3`}
            placeholder={MONEY_FIELDS.includes(current) ? "e.g. 8k, or 8k to 12k" : ""}
            aria-invalid={!!err}
            aria-describedby={err ? "followup-err" : undefined}
          />
          {err && (
            <p id="followup-err" className="mt-2 text-sm text-destructive">
              {err}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-3">
            <Button type="submit">Add</Button>
            <Button variant="outline" onClick={() => resolve(FIELD_DEFAULTS[current] ?? "Not sure", true)}>
              I don't know
            </Button>
          </div>
        </form>
      )}

      <ul className="surface divide-y px-5">
        {keys.map((k) => (
          <FieldRow key={k} k={k} value={fields[k]} assumed={assumed.includes(k)} />
        ))}
      </ul>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button variant="ghost" onClick={() => go("intake")}>
          Back
        </Button>
        <Button className="ml-auto" size="lg" disabled={!!current} onClick={() => go("generating")}>
          This is right
        </Button>
      </div>
      {current && <p className="mt-2 text-right text-sm text-muted-foreground">Answer the question above first.</p>}
    </section>
  );
}
