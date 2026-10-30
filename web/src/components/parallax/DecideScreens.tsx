import { useState } from "react";
import { LETTERS, useParallax } from "@/lib/parallax-store";
import { formatMoney } from "@/lib/format";
import type { Simulation } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Avatar, Button, LetterBadge, ScreenTitle, at, inputCls } from "./shared";

const range = (s: Simulation, m: number) => `${formatMoney(at(s, "bad", m))} to ${formatMoney(at(s, "good", m))} (likely ${formatMoney(at(s, "likely", m))})`;
function worst(s: Simulation) {
  const r = s.bad.rows.reduce((a, b) => (b.savings < a.savings ? b : a));
  return `${formatMoney(r.savings)} in month ${r.month} (bad case)`;
}
function milestone(s: Simulation) {
  const out: string[] = [];
  const hit = s.likely.rows.find((r) => r.savings >= 100000);
  if (hit) out.push(`Likely passes R100 000 in month ${hit.month}`);
  if (s.bad.shortfallMonths[0]) out.push(`Bad case runs out in month ${s.bad.shortfallMonths[0]}`);
  return out.join(". ") || "No big milestone in 36 months";
}

export function CompareScreen() {
  const { paths, sims, comfort, pinned, go } = useParallax();
  const rows: [string, (l: (typeof LETTERS)[number]) => string][] = [
    ["Savings at month 12", (l) => range(sims[l], 12)],
    ["Savings at month 36", (l) => range(sims[l], 36)],
    ["Worst month", (l) => worst(sims[l])],
    ["Milestones", (l) => milestone(sims[l])],
    ["Your comfort", (l) => (comfort[l].length ? `${comfort[l].at(-1)} of 5` : "Not rated yet")],
    ["Pinned quote", (l) => (pinned[l] ? `“${pinned[l]}”` : "None pinned")],
  ];
  return (
    <section className="mx-auto max-w-5xl screen-in">
      <ScreenTitle title="Side by side" />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left align-top">
          <thead>
            <tr>
              <th className="p-3" />
              {paths.map((p) => (
                <th key={p.id} className="p-3 font-semibold"><span className="flex items-center gap-2"><LetterBadge letter={p.letter} />{p.name}</span></th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, f]) => (
              <tr key={label} className="border-t">
                <th className="p-3 text-sm font-medium text-muted-foreground">{label}</th>
                {LETTERS.map((l) => <td key={l} className="p-3 align-top tabular-nums">{f(l)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button variant="ghost" onClick={() => go("chat")}>Back to chat</Button>
        <Button className="ml-auto" onClick={() => go("comfort")}>Comfort check</Button>
      </div>
    </section>
  );
}

export function ComfortScreen() {
  const { paths, comfort, bothering, set, go } = useParallax();
  return (
    <section className="mx-auto max-w-2xl screen-in">
      <ScreenTitle title="How does each future sit with you?">1 is very uneasy, 5 is at peace. You can rate again later; the dots show how it changes.</ScreenTitle>
      <ul className="space-y-3">
        {paths.map((p) => (
          <li key={p.id} data-path={p.letter} className="surface p-4">
            <p className="flex items-center gap-2 font-medium"><LetterBadge letter={p.letter} /> {p.name}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label={`Comfort with ${p.name}`}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Button key={n} variant={comfort[p.letter].at(-1) === n ? "path" : "outline"} className="w-11 px-0" aria-pressed={comfort[p.letter].at(-1) === n}
                  onClick={() => set((s) => ({ comfort: { ...s.comfort, [p.letter]: [...s.comfort[p.letter], n] } }))}>{n}</Button>
              ))}
              {comfort[p.letter].length > 0 && (
                <span className="ml-auto flex h-8 items-end gap-1" aria-label={`Trend: ${comfort[p.letter].join(", ")}`}>
                  {comfort[p.letter].slice(-8).map((n, i) => <span key={i} className="h-2 w-2 rounded-full bg-path" style={{ marginBottom: (n - 1) * 5 }} />)}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
      <label htmlFor="bother" className="mt-6 block font-medium">What is still bothering you?</label>
      <textarea id="bother" rows={4} value={bothering} onChange={(e) => set({ bothering: e.target.value })} className={`${inputCls} mt-2`} />
      <div className="mt-6 flex flex-wrap gap-3">
        <Button variant="ghost" onClick={() => go("chat")}>Back to chat</Button>
        <Button className="ml-auto" onClick={() => { set((s) => ({ questions: s.questions || s.bothering })); go("summary"); }}>Go to decision summary</Button>
      </div>
    </section>
  );
}

export function SummaryScreen() {
  const { paths, sims, chosen, decision, reasons, questions, set, reset, go, pathOf } = useParallax();
  const [confirm, setConfirm] = useState(false);
  const p = chosen ? pathOf(chosen) : undefined;
  const setback = p
    ? sims[p.letter].bad.shortfallMonths[0]
      ? `In the bad case, savings run out in month ${sims[p.letter].bad.shortfallMonths[0]}.`
      : `Lowest point in the bad case: ${worst(sims[p.letter])}.`
    : "";
  return (
    <section className="mx-auto max-w-4xl screen-in">
      <ScreenTitle title="Your decision summary">Choose the layer that feels closest, or say you're not ready.</ScreenTitle>
      <div className="fan grid grid-cols-1 gap-3 sm:grid-cols-3">
        {paths.map((x) => (
          <button key={x.id} type="button" data-path={x.letter} data-chosen={chosen === x.letter} aria-pressed={chosen === x.letter}
            onClick={() => set({ chosen: x.letter })}
            className={cn("fan-layer surface flex items-center gap-3 border-t-4 border-t-path p-4 text-left", chosen && chosen !== x.letter && "opacity-70")}>
            <Avatar letter={x.letter} src={x.avatarUrl} size={48} />
            <span><LetterBadge letter={x.letter} /> <span className="font-semibold">{x.name}</span></span>
          </button>
        ))}
      </div>
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 no-print">
        <Button variant="outline" size="lg" aria-pressed={decision === "decided"} disabled={!chosen} onClick={() => set({ decision: "decided" })}>
          {chosen ? `I've decided: path ${chosen}` : "I've decided (pick a path above)"}
        </Button>
        <Button variant="outline" size="lg" aria-pressed={decision === "notready"} onClick={() => set({ decision: "notready" })}>Not ready yet</Button>
      </div>
      <div className="surface mt-6 space-y-5 p-5">
        <div><p className="text-sm text-muted-foreground">Choice</p><p className="text-lg font-medium">{decision === "notready" ? "Not ready yet" : p ? `Path ${p.letter}: ${p.name}` : "Not chosen yet"}</p></div>
        <div><label htmlFor="reasons" className="text-sm text-muted-foreground">Reasons, in your words</label><textarea id="reasons" rows={3} value={reasons} onChange={(e) => set({ reasons: e.target.value })} className={`${inputCls} mt-1`} /></div>
        {setback && <div><p className="text-sm text-muted-foreground">Setback to watch</p><p className="tabular-nums">{setback}</p></div>}
        <div><label htmlFor="qs" className="text-sm text-muted-foreground">Open questions</label><textarea id="qs" rows={3} value={questions} onChange={(e) => set({ questions: e.target.value })} className={`${inputCls} mt-1`} /></div>
      </div>
      <div className="mt-6 flex flex-wrap gap-3 no-print">
        <Button variant="ghost" onClick={() => go("chat")}>Back to chat</Button>
        <Button variant="outline" onClick={() => window.print()}>Print</Button>
        {confirm ? (
          <span className="ml-auto flex gap-2">
            <Button variant="outline" onClick={() => setConfirm(false)}>Cancel</Button>
            <Button onClick={reset}>Yes, delete everything</Button>
          </span>
        ) : (
          <Button variant="ghost" className="ml-auto" onClick={() => setConfirm(true)}>Delete everything</Button>
        )}
      </div>
    </section>
  );
}
