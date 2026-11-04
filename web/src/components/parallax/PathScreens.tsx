import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useParallax, type Letter } from "@/lib/parallax-store";
import { describeAssumption, formatMoney, isMoneyField, parseAmount } from "@/lib/format";
import { pathFigures } from "@/lib/stress";
import type { Assumption, PathCard } from "@/lib/types";
import { Avatar, Button, Drawer, NoPaths, SOURCE_KIND, Src, cx } from "./shared";
import { Spark } from "./charts";
import { NO_LENS, applyLens, safest, summarise, type Lens } from "../../../../shared/engine/compare";
import { SETBACK_LABELS } from "../../../../shared/engine/analysis";
import { StepNav } from "./StepNav";

const end = (a: number[]) => a[a.length - 1] ?? 0;

/** The founder's usual sales a month, which a price change acts on. */
function usualSales(v: unknown): number {
  if (!isMoneyField(v)) return 0;
  return v.base ?? Math.round((v.low + v.high) / 2);
}

const LATE = SETBACK_LABELS["late-payment"].slice(SETBACK_LABELS["late-payment"].indexOf(": ") + 2);
const pct = (n: number) => `${n > 0 ? "+" : ""}${n}%`;

/** The what-ifs: each one reruns the engine on all three futures at once, so they stay comparable. */
function WhatIf({ lens, onChange, hasContract }: { lens: Lens; onChange: (l: Lens) => void; hasContract: boolean }) {
  const changed = lens.latePayment || lens.contractScale !== 1 || lens.pricePercent !== 0;
  return (
    <section className="whatif" aria-labelledby="whatif-title">
      <h2 id="whatif-title" className="caps">
        What if…
      </h2>
      <label className="wi-toggle">
        <input type="checkbox" checked={lens.latePayment} onChange={(e) => onChange({ ...lens, latePayment: e.target.checked })} />
        <span>{LATE.charAt(0).toUpperCase() + LATE.slice(1)}</span>
      </label>
      {hasContract && (
        <label className="wi-range">
          <span>
            Contract size <b>{Math.round(lens.contractScale * 100)}%</b>
          </span>
          <input
            type="range"
            min={25}
            max={150}
            step={25}
            value={Math.round(lens.contractScale * 100)}
            onChange={(e) => onChange({ ...lens, contractScale: Number(e.target.value) / 100 })}
          />
        </label>
      )}
      <label className="wi-range">
        <span>
          Prices <b>{pct(lens.pricePercent)}</b>
        </span>
        <input type="range" min={-10} max={20} step={5} value={lens.pricePercent} onChange={(e) => onChange({ ...lens, pricePercent: Number(e.target.value) })} />
      </label>
      <button type="button" className="wi-reset" disabled={!changed} onClick={() => onChange(NO_LENS)}>
        Reset
      </button>
    </section>
  );
}

/** The three futures side by side: likely-case cash for each, the safest marked by the engine's rule, and what-ifs. */
export function PathsScreen() {
  const { paths, fields, set, go } = useParallax();
  const [lens, setLens] = useState<Lens>(NO_LENS);
  const sales = usualSales(fields.revenue);
  const seen = useMemo(() => paths.map((p) => ({ ...p, ...applyLens(p, lens, sales) }) as PathCard), [paths, lens, sales]);
  const figures = useMemo(() => seen.map((p) => pathFigures(p)), [seen]);
  const summaries = useMemo(() => seen.map((p) => summarise(p)), [seen]);
  const best = useMemo(() => safest(summaries), [summaries]);
  const hasRoom = fields.decisionType === "contract";
  const hasContract = paths.some((p) => p.assumptions.some((a) => (a as { role?: string }).role === "contract"));
  if (paths.length === 0) return <NoPaths />;
  return (
    <section className="screen">
      <div className="pagehead">
        <div className="eyebrow">Futures</div>
        <h1>Three futures, side by side</h1>
        <div className="sub">Cash in the business over 36 months, likely case. Try a what-if: all three rerun at once.</div>
      </div>
      <WhatIf lens={lens} onChange={setLens} hasContract={hasContract} />
      <div className="pathgrid">
        {paths.map((p, i) => {
          const f = figures[i]!;
          const s = summaries[i]!;
          const isBest = best === p.id;
          return (
            <article key={p.id} className={cx("nft", `p-${p.letter}`, isBest && "is-safest")} aria-label={`Future ${p.letter}: ${p.name}`}>
              <div className="nft-media">
                <Spark letter={p.letter} values={f.likely} />
                <span className="nft-letter">{p.letter}</span>
                {isBest && <span className="safest-tag">Safest</span>}
                <Avatar letter={p.letter} src={p.avatarUrl} size={84} className="nft-avatar" />
              </div>
              <div className="nft-body">
                <h2 className="nft-title">{p.name}</h2>
                <p className="nft-sub">{p.summary}</p>
              </div>
              <dl className="fut-figs">
                <div>
                  <dt>Lowest cash</dt>
                  <dd>
                    <span key={s.lowest.cash} className="tick">{formatMoney(s.lowest.cash)}</span> <small>month {s.lowest.month}</small>
                  </dd>
                </div>
                <div>
                  <dt>Cash runs out</dt>
                  <dd>{s.runsOut ? <span key={s.runsOut} className="chipwarn tick">Month {s.runsOut}</span> : <span className="chipok tick">Never</span>}</dd>
                </div>
                <div>
                  <dt>Month 36</dt>
                  <dd><span key={s.endCash} className="tick">{formatMoney(s.endCash)}</span></dd>
                </div>
              </dl>
              <div className="nft-actions">
                <Button
                  variant="primary"
                  onClick={() => {
                    set({ active: p.letter });
                    go(hasRoom ? "explore" : "chat");
                  }}
                >
                  {hasRoom ? "Step inside" : "Ask this future"}
                </Button>
                {hasRoom ? (
                  <Button
                    onClick={() => {
                      set({ active: p.letter });
                      go("chat");
                    }}
                  >
                    Ask
                  </Button>
                ) : (
                  <Button onClick={() => set({ panel: { letter: p.letter } })}>Numbers</Button>
                )}
              </div>
            </article>
          );
        })}
      </div>
      <p className="hint">
        {best
          ? "Safest: never runs out, or lasts longest, with the highest lowest cash. A rule, not advice."
          : "No single safest future: the top two are level."}{" "}
        What-ifs here are a preview; they do not change your saved numbers.
      </p>
      <StepNav />
    </section>
  );
}

function AssumptionRow({ a, letter, highlight }: { a: Assumption; letter: Letter; highlight: boolean }) {
  const { set } = useParallax();
  const [edit, setEdit] = useState(false);
  const [v, setV] = useState({ low: "", base: "", high: "" });
  const [err, setErr] = useState("");
  const ref = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (highlight) ref.current?.scrollIntoView({ block: "center" });
  }, [highlight]);

  const save = (e: FormEvent) => {
    e.preventDefault();
    const n = [v.low, v.base, v.high].map((x) => parseAmount(x)?.base);
    if (n.some((x) => x === undefined)) return setErr("Each box needs an amount, like 8000 or 8k.");
    const [low, base, high] = n as [number, number, number];
    if (!(low <= base && base <= high)) return setErr("Low must be at most usual, and usual at most high.");
    set((s) => ({
      paths: s.paths.map((p) =>
        p.letter !== letter
          ? p
          : { ...p, assumptions: p.assumptions.map((x) => (x.id === a.id ? { ...x, low, base, high, source: "you" } : x)) },
      ),
    }));
    setEdit(false);
  };

  return (
    <li ref={ref} className={cx("arow", highlight && "hl")}>
      <div className="arow-head">
        <span className="aid">{a.id}</span>
        <div className="arow-main">
          <div className="alab">
            {a.label}
            {a.source && <Src kind={SOURCE_KIND[a.source]} />}
          </div>
          <div className="adesc">{describeAssumption(a)}</div>
        </div>
        <Button
          variant="link"
          size="sm"
          aria-expanded={edit}
          onClick={() => {
            setV({ low: String(a.low), base: String(a.base), high: String(a.high) });
            setErr("");
            setEdit(!edit);
          }}
        >
          {edit ? "Cancel" : "Edit"}
        </Button>
      </div>
      {edit && (
        <form onSubmit={save}>
          <div className="arow-edit">
            {(["low", "base", "high"] as const).map((k) => (
              <label key={k}>
                {k === "base" ? "usually" : k}
                <input className="field-input" value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} inputMode="numeric" />
              </label>
            ))}
          </div>
          {err && (
            <p className="aerr" role="alert">
              {err}
            </p>
          )}
          <div className="arow-edit-foot">
            <Button type="submit" variant="primary" size="sm">
              Save and re-run
            </Button>
          </div>
        </form>
      )}
    </li>
  );
}

function AssumptionList({ path, highlight }: { path: PathCard; highlight?: string }) {
  const f = useMemo(() => pathFigures(path), [path]);
  return (
    <>
      <div className="m36">
        <span>Month 36</span> bad {formatMoney(end(f.bad))} · likely {formatMoney(end(f.likely))} · good {formatMoney(end(f.good))}
      </div>
      <p className="sub">
        Cash in the business at the start: {formatMoney(path.startingCash)}. The bad case uses low income and high costs; the good
        case the reverse.
      </p>
      <ul className="arows">
        {path.assumptions.map((a) => (
          <AssumptionRow key={a.id} a={a} letter={path.letter} highlight={highlight === a.id} />
        ))}
      </ul>
    </>
  );
}

/** The assumptions behind one path, each with its source and an edit. */
export function AssumptionsPanel() {
  const { panel, set, pathOf } = useParallax();
  const p = panel ? pathOf(panel.letter) : undefined;
  return (
    <Drawer open={!!panel} onClose={() => set({ panel: null })} title={p ? `Assumptions · ${p.letter}: ${p.name}` : "Assumptions"}>
      {p && <AssumptionList path={p} highlight={panel?.rowId} />}
    </Drawer>
  );
}
