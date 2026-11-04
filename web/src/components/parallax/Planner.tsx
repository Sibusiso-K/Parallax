// "Find a safer plan": the planner agent on the futures screen. The founder sets a floor for cash and whether it must
// hold through a late payment; Muse Spark then searches with tool calls on the engine, and each step it took is shown
// with the engine's figures. Every plan listed was rerun by code and meets the goal. In demo mode the same search runs
// in code. Applying a plan only moves the what-if levers; nothing saved changes.
import { useState } from "react";
import { formatMoney, isMoneyField, parseAmount } from "@/lib/format";
import { useParallax, type Letter } from "@/lib/parallax-store";
import type { Lens } from "../../../../shared/engine/compare";
import { planRequest, searchInCode, tradeoffOf, type PlanAnswer, type PlanResult } from "../../../../shared/agent/planner";
import { Badge, Button, cx } from "./shared";

const usual = (v: unknown) => (isMoneyField(v) ? (v.base ?? Math.round((v.low + v.high) / 2)) : 0);
const settings = (r: PlanResult) =>
  [r.contractPercent !== 100 && `contract at ${r.contractPercent}%`, r.pricePercent !== 0 && `prices ${r.pricePercent > 0 ? "+" : ""}${r.pricePercent}%`]
    .filter(Boolean)
    .join(", ") || "as it stands";

export function Planner({ lens, onApply }: { lens: Lens; onApply: (l: Lens, path: Letter) => void }) {
  const { paths, fields, set } = useParallax();
  const [floorText, setFloorText] = useState("20000");
  const [late, setLate] = useState(true);
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<PlanAnswer | null>(null);
  const [error, setError] = useState("");

  async function run() {
    const amount = parseAmount(floorText);
    const floor = amount ? (amount.base ?? amount.low) : undefined;
    if (floor === undefined || floor < 0) return setError("Type an amount, like 20000 or 20k.");
    setError("");
    setBusy(true);
    setAnswer(null);
    const body = {
      kind: "plan" as const,
      floor,
      withLatePayment: late,
      monthlySales: usual(fields.revenue),
      paths: paths.map((p) => ({ id: p.id, letter: p.letter, name: p.name, startingCash: p.startingCash, assumptions: p.assumptions })),
    };
    try {
      const res = await fetch("/api/whatif", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = (await res.json()) as (PlanAnswer & { ok?: boolean; error?: string }) | null;
      if (data?.ok && data.mode === "model") setAnswer(data);
      else if (data?.mode === "fixture") setAnswer(searchInCode(planRequest.parse(body)));
      else {
        setError(data?.error ?? "The planner couldn't finish just now.");
        setAnswer(searchInCode(planRequest.parse(body)));
      }
    } catch {
      setError("The planner couldn't be reached; this search ran in code.");
      setAnswer(searchInCode(planRequest.parse(body)));
    }
    setBusy(false);
  }

  return (
    <section className="planner" aria-labelledby="planner-title">
      <div className="planner-head">
        <div>
          <div className="caps">Planning agent</div>
          <h2 id="planner-title">Find a safer plan</h2>
          <p className="sub">Set a goal. The agent tries settings on the engine, step by step, and lists the ones that meet it. It does not choose for you.</p>
        </div>
      </div>
      <form
        className="planner-form"
        onSubmit={(e) => {
          e.preventDefault();
          void run();
        }}
      >
        <label>
          Keep cash above
          <input className="field-input" value={floorText} onChange={(e) => setFloorText(e.target.value)} inputMode="numeric" aria-invalid={!!error} />
        </label>
        <label className="wi-toggle">
          <input type="checkbox" checked={late} onChange={(e) => setLate(e.target.checked)} />
          <span>even if the client pays late</span>
        </label>
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? "Searching…" : "Find plans"}
        </Button>
      </form>
      {error && <p className="ferr">{error}</p>}
      {busy && <p className="sub">The agent is trying settings on the engine. With Muse Spark this takes a little while.</p>}
      {answer && (
        <div className="planner-out">
          <ol className="planner-steps" aria-label="What the agent tried">
            {answer.steps.map((s, i) => (
              <li key={i}>
                <span className="step-tool">
                  {s.tool === "compare_all"
                    ? answer.mode === "fixture"
                      ? `Searched ${String(s.args.searched ?? "every")} settings in code; the best three are shown`
                      : "Compared all three"
                    : "Tried a plan"}
                </span>
                {s.results.map((r) => (
                  <span key={`${r.path}${r.contractPercent}${r.pricePercent}`} className={cx("step-res", r.meetsGoal ? "ok" : "no")}>
                    <Badge letter={r.path} /> {settings(r)}: lowest {formatMoney(r.lowestCash)}
                    {r.runsOutMonth ? `, runs out month ${r.runsOutMonth}` : ""} {r.meetsGoal ? "✓" : "✗"}
                  </span>
                ))}
              </li>
            ))}
          </ol>
          {answer.found.length > 0 ? (
            <div className="planner-found">
              <h3>Options that meet your goal</h3>
              <p className="sub small">Each one has a cost. Weigh them; the choice is yours.</p>
              {answer.found.map((r) => (
                <div key={`${r.path}${r.contractPercent}${r.pricePercent}`} className="found-row">
                  <span>
                    <Badge letter={r.path} /> <b>{paths.find((p) => p.letter === r.path)?.name}</b>, {settings(r)}. Lowest {formatMoney(r.lowestCash)} in month {r.lowestMonth}; month 36{" "}
                    {formatMoney(r.endCash)}.
                    <span className="found-cost">Gives up: {tradeoffOf(r)}.</span>
                  </span>
                  <Button
                    size="sm"
                    onClick={() => {
                      onApply({ ...lens, latePayment: late, contractScale: r.contractPercent / 100, pricePercent: r.pricePercent }, r.path);
                      set({ active: r.path });
                    }}
                  >
                    Show it
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            answer.closest && (
              <p>
                No setting meets that goal. Closest: <Badge letter={answer.closest.path} /> {settings(answer.closest)}, lowest {formatMoney(answer.closest.lowestCash)}.
              </p>
            )
          )}
          {answer.note && <p className="sub">{answer.note}</p>}
          <p className="sub small">
            {answer.mode === "model" ? `Planned by ${answer.model ?? "Muse Spark"} with ${answer.steps.length} engine tool calls over ${answer.calls} model calls.` : "Searched in code (demo mode)."}{" "}
            Every figure comes from the engine, and every listed plan was rerun by code.
          </p>
        </div>
      )}
    </section>
  );
}
