import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useParallax, type Letter } from "@/lib/parallax-store";
import { describeAssumption, formatMoney, parseAmount } from "@/lib/format";
import { pathFigures } from "@/lib/stress";
import type { Assumption, PathCard } from "@/lib/types";
import { Avatar, Badge, Button, Drawer, NoPaths, SOURCE_KIND, Src, cx } from "./shared";
import { RangeBar, domainOf } from "./charts";

const end = (a: number[]) => a[a.length - 1] ?? 0;

/** The three paths side by side: what each does to the business's cash, and where to go next. */
export function PathsScreen() {
  const { paths, set, go } = useParallax();
  const figures = useMemo(() => paths.map((p) => pathFigures(p)), [paths]);
  if (paths.length === 0) return <NoPaths />;
  const domain = domainOf(figures);
  return (
    <section className="screen">
      <div className="pagehead">
        <div className="eyebrow">Three possible futures</div>
        <h1>Which future do you want to hear from first?</h1>
        <div className="sub">Each path runs 36 months of cash in three cases. Open one to talk to the founder you would become on it.</div>
      </div>
      <div className="pathgrid">
        {paths.map((p, i) => {
          const f = figures[i]!;
          return (
            <article key={p.id} className={cx("pcard", `p-${p.letter}`)}>
              <div className="pname">
                <Avatar letter={p.letter} src={p.avatarUrl} size={64} />
                <div>
                  <div className="ptitle">
                    <Badge letter={p.letter} /> <b>{p.name}</b>
                  </div>
                  <div className="psub">{p.summary}</div>
                </div>
              </div>
              <div className="pband">
                <div className="caps">Cash in the business at month 36</div>
                <div className="v">{formatMoney(end(f.likely))}</div>
                <div className="r">
                  Bad {formatMoney(end(f.bad))} · Good {formatMoney(end(f.good))}
                </div>
                <RangeBar letter={p.letter} bad={end(f.bad)} likely={end(f.likely)} good={end(f.good)} domain={domain} />
              </div>
              <div>
                {f.runsOutBad ? (
                  <span className="chipwarn">Runs out in month {f.runsOutBad} in the bad case</span>
                ) : (
                  <span className="chipok">Stays above zero in every case</span>
                )}
              </div>
              <div className="pact">
                <Button variant="outline" onClick={() => set({ panel: { letter: p.letter } })}>
                  Show assumptions
                </Button>
                <Button
                  variant="path"
                  className={`p-${p.letter}`}
                  onClick={() => {
                    set({ active: p.letter });
                    go("chat");
                  }}
                >
                  Talk to your future self
                </Button>
              </div>
            </article>
          );
        })}
      </div>
      <div className="actions-row">
        <Button variant="ghost" onClick={() => go("profile")}>
          Back to your business today
        </Button>
      </div>
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
