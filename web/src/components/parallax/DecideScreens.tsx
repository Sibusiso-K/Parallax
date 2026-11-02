import { useMemo, useState, type ReactNode } from "react";
import { FIELD_LABELS } from "@/lib/parallax-api";
import { useParallax, type Letter } from "@/lib/parallax-store";
import { formatField, formatMoney } from "@/lib/format";
import type { FieldKey, PathCard } from "@/lib/types";
import { pathFigures, type Figures } from "@/lib/stress";
import { Avatar, Badge, Button, NoPaths, Src, type Kind } from "./shared";
import { RangeBar, domainOf } from "./charts";

const end = (a: number[]) => a[a.length - 1] ?? 0;
const at = (a: number[], month: number) => a[month] ?? 0;
const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The three paths side by side, with the comfort check beside them. */
export function CompareScreen() {
  const { paths, comfort, bothering, set, go } = useParallax();
  const figures = useMemo(() => paths.map((p) => pathFigures(p)), [paths]);
  if (paths.length === 0) return <NoPaths />;
  const domain = domainOf(figures);

  const rows: { label: string; cell: (p: PathCard, f: Figures) => ReactNode }[] = [
    {
      label: "Cash at month 12, likely",
      cell: (_, f) => (
        <>
          <div className="v">{formatMoney(at(f.likely, 12))}</div>
          <div className="r">
            Bad {formatMoney(at(f.bad, 12))} · Good {formatMoney(at(f.good, 12))}
          </div>
        </>
      ),
    },
    {
      label: "Cash at month 36, likely",
      cell: (p, f) => (
        <>
          <div className="v">{formatMoney(end(f.likely))}</div>
          <div className="r">
            Bad {formatMoney(end(f.bad))} · Good {formatMoney(end(f.good))}
          </div>
          <RangeBar letter={p.letter} bad={end(f.bad)} likely={end(f.likely)} good={end(f.good)} domain={domain} />
        </>
      ),
    },
    {
      label: "Lowest cash, likely",
      cell: (_, f) => (
        <>
          <div className="v">{formatMoney(f.lowestLikely.cash)}</div>
          <div className="s">Month {f.lowestLikely.month}</div>
        </>
      ),
    },
    {
      label: "Lowest cash with a 2-month late payment",
      cell: (_, f) => (
        <>
          <div className="v">{formatMoney(f.late.lowest.cash)}</div>
          <div className="s">
            Month {f.late.lowest.month} ·{" "}
            {f.late.runsOut ? <span className="chipwarn">runs out in month {f.late.runsOut}</span> : <span className="chipok">stays above zero</span>}
          </div>
        </>
      ),
    },
    {
      label: "Cash runs out, bad case",
      cell: (_, f) =>
        f.runsOutBad ? (
          <>
            <div className="t">Month {f.runsOutBad}</div>
            <div className="s">Only in the bad case</div>
          </>
        ) : (
          <>
            <div className="t none">Never</div>
            <div className="s">No case runs out</div>
          </>
        ),
    },
    {
      label: "Three months of fixed costs covered",
      cell: (_, f) =>
        f.bufferMonth ? (
          <>
            <div className="t">Month {f.bufferMonth}</div>
            <div className="s">Likely case</div>
          </>
        ) : (
          <div className="t none">Not reached</div>
        ),
    },
    {
      label: "Worst setback, likely case",
      cell: (_, f) => (
        <>
          <div className="t">{f.worst.name}</div>
          <div className="s">
            Lowest cash {formatMoney(f.worst.lowest.cash)}, month {f.worst.lowest.month}
          </div>
        </>
      ),
    },
    { label: "The plan", cell: (p) => <div className="quote">{p.summary}</div> },
  ];

  return (
    <div className="row pagecols3">
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Three paths on one scale</h2>
            <div className="sub">
              Bars share one scale, from {formatMoney(domain[0])} to {formatMoney(domain[1])}; the dot is the likely case. A late payment
              is a big client paying two months late.
            </div>
          </div>
        </div>
        <div className="tablewrap">
          <table className="cmp">
            <thead>
              <tr>
                <th />
                {paths.map((p) => (
                  <th key={p.id} className="p">
                    <Badge letter={p.letter} /> {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label}>
                  <td className="lab">{r.label}</td>
                  {paths.map((p, i) => (
                    <td key={p.id}>{r.cell(p, figures[i]!)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="rcol">
        <section className="panel panel-grow">
          <div className="panel-head">
            <div>
              <div className="caps">Comfort check</div>
              <h2>How does each future sit with you?</h2>
              <div className="sub">Rate each one from 1 (very uneasy) to 5 (at peace). You can rate again later; the last rating is the one shown.</div>
            </div>
          </div>
          <div className="crows">
            {paths.map((p) => {
              const last = comfort[p.letter].at(-1);
              return (
                <div key={p.id} className="crow">
                  <Avatar letter={p.letter} src={p.avatarUrl} size={64} />
                  <div className="cbody">
                    <div className="cname">
                      <Badge letter={p.letter} /> {p.name}
                    </div>
                    <div className="rate" role="group" aria-label={`Comfort with ${p.name}`}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          aria-pressed={last === n}
                          onClick={() => set((s) => ({ comfort: { ...s.comfort, [p.letter]: [...s.comfort[p.letter], n] } }))}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <label htmlFor="bother" className="caps mt">
            What is still bothering you?
          </label>
          <textarea
            id="bother"
            className="field-area"
            rows={4}
            value={bothering}
            onChange={(e) => set({ bothering: e.target.value })}
            placeholder="Whether the client will really pay on 30-day terms."
          />
          <div className="actions-row">
            <Button variant="ghost" onClick={() => go("chat")}>
              Back to chat
            </Button>
            <Button
              variant="primary"
              className="ml-auto"
              onClick={() => {
                set((s) => ({ questions: s.questions || s.bothering }));
                go("summary");
              }}
            >
              Decision memo
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}

const BASIS: FieldKey[] = ["revenue", "directCosts", "overheads", "payroll", "founderPay", "debtRepayments", "cash", "offerRevenue", "paymentDays", "hireCost", "upfrontCost"];

/** The decision memo the founder leaves with. It names no choice the founder has not made. */
export function SummaryScreen() {
  const { paths, fields, assumed, followed, chosen, decision, reasons, questions, set, go, reset, pathOf } = useParallax();
  const figures = useMemo(() => paths.map((p) => pathFigures(p)), [paths]);
  const [confirming, setConfirming] = useState(false);
  if (paths.length === 0) return <NoPaths />;

  const chosenPath = chosen ? pathOf(chosen) : undefined;
  const question = typeof fields.decision === "string" && fields.decision ? fields.decision : "Your decision";
  const pick = (l: Letter) => set({ chosen: l, decision: "decided" });

  const choice =
    decision === "notready" ? (
      <>
        <b>Not ready yet.</b> Parallax never names a choice you have not made.
      </>
    ) : chosenPath && decision === "decided" ? (
      <>
        <b>
          Path {chosenPath.letter}: {chosenPath.name}.
        </b>{" "}
        You chose this path. Parallax does not choose for you.
      </>
    ) : (
      <>
        <b>Not chosen yet.</b> You pick a path, or “Not ready yet”, before this prints. Parallax never names a choice you have not
        made.
      </>
    );

  const basis = BASIS.filter((k) => fields[k] !== undefined).map((k) => {
    const shown = k === "paymentDays" ? `${Number(fields[k])} days` : formatField(fields[k]);
    const kind: Kind = assumed.includes(k) ? "assumed" : followed.includes(k) ? "followup" : "you";
    return { k, text: `${FIELD_LABELS[k]}: ${shown}`, kind };
  });
  const placeholders = Array.from(new Set(paths.flatMap((p) => p.assumptions.filter((a) => a.source === "template").map((a) => a.label))));
  const late = paths.map((p, i) => {
    const f = figures[i]!;
    return `Path ${p.letter} bottoms at ${formatMoney(f.late.lowest.cash)} in month ${f.late.lowest.month}${
      f.late.runsOut ? ", and runs out of cash." : ", and stays above zero."
    }`;
  });

  return (
    <div className="memowrap">
      <article className="memo">
        <div className="caps">Decision memo · printed from Parallax</div>
        <h1>{capitalise(question)}?</h1>
        <div className="choice">
          <span className="caps">Choice</span>
          {choice}
          <div className="choice-buttons no-print">
            {paths.map((p) => (
              <Button
                key={p.id}
                variant="path"
                size="sm"
                className={`p-${p.letter}`}
                aria-pressed={decision === "decided" && chosen === p.letter}
                onClick={() => pick(p.letter)}
              >
                Choose {p.letter}
              </Button>
            ))}
            <Button size="sm" aria-pressed={decision === "notready"} onClick={() => set({ decision: "notready" })}>
              Not ready yet
            </Button>
          </div>
        </div>

        <h3>The three paths, 36 months of cash in the business</h3>
        <div className="tablewrap">
          <table className="cmp memo-table">
            <thead>
              <tr>
                <th>Path</th>
                <th className="n">Month 36, bad</th>
                <th className="n">Month 36, likely</th>
                <th className="n">Month 36, good</th>
                <th className="n">Lowest, likely</th>
                <th className="n">Lowest, 2-month late payment</th>
              </tr>
            </thead>
            <tbody>
              {paths.map((p, i) => {
                const f = figures[i]!;
                return (
                  <tr key={p.id}>
                    <td>
                      <div className="pname">
                        <Avatar letter={p.letter} src={p.avatarUrl} size={38} />
                        <div>
                          <div className="ptitle">
                            <Badge letter={p.letter} /> <b>{p.name}</b>
                          </div>
                          <div className="psub">{p.summary}</div>
                        </div>
                      </div>
                    </td>
                    <td className="n">{formatMoney(end(f.bad))}</td>
                    <td className="n">{formatMoney(end(f.likely))}</td>
                    <td className="n">{formatMoney(end(f.good))}</td>
                    <td className="n">
                      {formatMoney(f.lowestLikely.cash)}
                      <div className="psub">month {f.lowestLikely.month}</div>
                    </td>
                    <td className="n">
                      {formatMoney(f.late.lowest.cash)}
                      <div className="psub">
                        month {f.late.lowest.month}
                        {f.late.runsOut ? " · runs out" : ""}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <h3>The setback to watch</h3>
        <p>Late payment: a big client pays two months late, then catches up. {late.join(" ")}</p>

        <div className="twocol">
          <div>
            <h3>What the numbers rest on</h3>
            <ul>
              {basis.map((b) => (
                <li key={b.k}>
                  {b.text} <Src kind={b.kind} />
                </li>
              ))}
              {placeholders.map((label) => (
                <li key={label}>
                  {label} <Src kind="placeholder" />
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3>Open questions and checks in real life</h3>
            {questions.trim() ? <p>{questions}</p> : <p className="sub">None written yet.</p>}
          </div>
        </div>
        {reasons.trim() && (
          <>
            <h3>Reasons, in your words</h3>
            <p>{reasons}</p>
          </>
        )}
        <div className="memo-foot">
          Avatars are AI-generated illustrations (Muse Image). A reflection aid, not financial advice. One possible future, not a
          prediction.
        </div>
      </article>

      <div className="memo-tools no-print">
        <div className="notes">
          <label>
            Reasons, in your words
            <textarea className="field-area" rows={3} value={reasons} onChange={(e) => set({ reasons: e.target.value })} />
          </label>
          <label>
            Open questions
            <textarea className="field-area" rows={3} value={questions} onChange={(e) => set({ questions: e.target.value })} />
          </label>
        </div>
        <div className="actions-row">
          <Button variant="ghost" onClick={() => go("compare")}>
            Back to side by side
          </Button>
          <Button variant="outline" onClick={() => window.print()}>
            Print memo
          </Button>
          {confirming ? (
            <>
              <Button variant="outline" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={reset}>
                Yes, delete everything
              </Button>
            </>
          ) : (
            <Button variant="ghost" className="ml-auto" onClick={() => setConfirming(true)}>
              Delete everything
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
