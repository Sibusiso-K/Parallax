// The founder's business, one card per figure: the value, where it came from, and the founder's own words beside it.
import { useState, type FormEvent } from "react";
import { DECISION_LABELS, DECISION_TYPES, FIELD_LABELS, MONEY_FIELDS, NUMBER_FIELDS, parseDecisionAnswer } from "@/lib/parallax-api";
import { useParallax } from "@/lib/parallax-store";
import { formatField, formatMoney, isMoneyField, moneyDraft, parseAmount } from "@/lib/format";
import type { FieldKey, MoneyField } from "@/lib/types";
import { Button, Src, cx, type Kind } from "./shared";

/** Reads one typed answer for a field, or says what is wrong with it. */
export function readValue(key: FieldKey, raw: string): { ok: true; value: unknown } | { ok: false; msg: string } {
  if (!raw.trim()) return { ok: false, msg: "Type something, or choose “I don't know”." };
  if (MONEY_FIELDS.includes(key)) {
    const p = parseAmount(raw);
    if (!p) return { ok: false, msg: "Try an amount like 8000, 8k, about 8k, or 8k to 12k." };
    return { ok: true, value: { ...p, quote: raw.trim() } };
  }
  if (NUMBER_FIELDS.includes(key)) {
    const n = Number(raw.trim().replace(/\s*(days?|%)$/i, ""));
    if (!Number.isFinite(n) || n < 0) return { ok: false, msg: "Use a whole number, like 30." };
    return { ok: true, value: n };
  }
  if (key === "decisionType") {
    const type = parseDecisionAnswer(raw);
    if (!type) return { ok: false, msg: "Type contract, hire or prices." };
    return { ok: true, value: type };
  }
  return { ok: true, value: raw.trim() };
}

/** The kind of decision, as three buttons. The one read from the founder's words is marked. */
export function DecisionStrip() {
  const { fields, set } = useParallax();
  const current = typeof fields.decisionType === "string" ? fields.decisionType : undefined;
  return (
    <div className="dstrip">
      <span className="caps">Kind of decision</span>
      {DECISION_TYPES.map((t) => (
        <button
          key={t}
          type="button"
          className={cx("dbtn", current === t && "on")}
          aria-pressed={current === t}
          onClick={() =>
            set((s) => ({
              fields: { ...s.fields, decisionType: t },
              assumed: s.assumed.filter((k) => k !== "decisionType"),
              missing: s.missing.filter((k) => k !== "decisionType"),
            }))
          }
        >
          {current === t && "✓ "}
          {DECISION_LABELS[t]}
        </button>
      ))}
      <span className="dnote">Read from your words, in code</span>
    </div>
  );
}

interface Card {
  k: FieldKey;
  label: string;
  value: string;
  sub?: string;
  kind: Kind;
  quote?: string;
}

const money = (v: unknown): MoneyField | undefined => (isMoneyField(v) ? v : undefined);
/** A money figure's usual value: its base, or the middle of its range. */
const usual = (v: unknown): number | undefined => {
  const m = money(v);
  return m ? (m.base ?? Math.round((m.low + m.high) / 2)) : undefined;
};
const days = (v: unknown): number | undefined => (typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : undefined);
const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The cards, in the order the founder reads them. Each figure comes from the answers; nothing is typed in here. */
function cardsFor(
  fields: Partial<Record<FieldKey, unknown>>,
  quotes: Partial<Record<FieldKey, string>>,
  assumed: FieldKey[],
  followed: FieldKey[],
): Card[] {
  const out: Card[] = [];
  const add = (k: FieldKey, value: string, sub?: string) => {
    const v = fields[k];
    if (v === undefined || v === "") return;
    const m = money(v);
    const kind: Kind = assumed.includes(k) ? "assumed" : followed.includes(k) ? "followup" : m && m.low !== m.high ? "range" : "you";
    out.push({ k, label: FIELD_LABELS[k], value, sub, kind, quote: assumed.includes(k) ? undefined : (m?.quote ?? quotes[k]) });
  };
  const sales = usual(fields.revenue);
  const direct = usual(fields.directCosts);
  const cash = usual(fields.cash);
  const fixed = [fields.overheads, fields.payroll, fields.founderPay, fields.debtRepayments].reduce<number>((sum, v) => sum + (usual(v) ?? 0), 0);
  const paid = days(fields.paymentDays) ?? 30;
  const rev = money(fields.revenue);

  add("decision", String(fields.decision ?? ""));
  add("business", String(fields.business ?? ""));
  add("location", String(fields.location ?? ""));
  add("revenue", formatField(fields.revenue), rev && rev.low !== rev.high ? `Usually ${formatMoney(usual(rev) ?? 0)}` : undefined);
  add(
    "directCosts",
    formatField(fields.directCosts),
    sales && direct !== undefined && sales > 0 ? `${Math.round((1 - direct / sales) * 100)}% of sales left after these` : undefined,
  );
  add("overheads", formatField(fields.overheads), "Fixed every month");
  add("payroll", formatField(fields.payroll), "Fixed every month");
  add("founderPay", formatField(fields.founderPay), "Counted as a cost on every path");
  add("debtRepayments", formatField(fields.debtRepayments), "Fixed every month");
  add(
    "cash",
    formatField(fields.cash),
    cash !== undefined && fixed > 0
      ? cash / fixed >= 1
        ? `Covers about ${Math.floor(cash / fixed)} months of fixed costs`
        : "Covers less than a month of fixed costs"
      : undefined,
  );
  add("offerRevenue", formatField(fields.offerRevenue), `Paid ${paid} days after each invoice`);
  add("paymentDays", `${paid} days`, "Sets when the contract money lands");
  add("hireCost", formatField(fields.hireCost), "Needed to run the decision");
  add("upfrontCost", formatField(fields.upfrontCost), "Paid once, at the start");
  add("priceRisePercent", `${days(fields.priceRisePercent) ?? 0}%`, "The rise you would test");
  add("riskComfort", capitalise(String(fields.riskComfort ?? "")), "Shapes how trade-offs are framed, never the numbers");
  add("goals", String(fields.goals ?? ""), "Each future founder reflects on these");
  return out;
}

function FieldCard({ card, editable }: { card: Card; editable: boolean }) {
  const { fields, set } = useParallax();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [err, setErr] = useState("");
  const save = (e: FormEvent) => {
    e.preventDefault();
    const r = readValue(card.k, draft);
    if (!r.ok) return setErr(r.msg);
    set((s) => ({
      fields: { ...s.fields, [card.k]: r.value },
      quotes: { ...s.quotes, [card.k]: draft.trim() },
      assumed: s.assumed.filter((k) => k !== card.k),
      followed: s.followed.filter((k) => k !== card.k),
    }));
    setEditing(false);
    setErr("");
  };
  const toggle = () => {
    const v = fields[card.k];
    const m = money(v);
    // Start from the figures, not the sentence they were read from: a quote such as "about R90,000 a month, anywhere
    // from R75k to R105k" cannot be saved back through readValue without retyping it.
    setDraft(m ? moneyDraft(m) : String(v ?? ""));
    setErr("");
    setEditing((open) => !open);
  };
  return (
    <div className="ffield">
      <div className="fcap">
        {card.label}
        <Src kind={card.kind} />
        {editable && (
          <Button variant="link" size="sm" className="fedit" aria-expanded={editing} onClick={toggle}>
            {editing ? "Cancel" : "Edit"}
          </Button>
        )}
      </div>
      <div className="fval">{card.value}</div>
      {card.sub && <div className="fsub">{card.sub}</div>}
      {card.quote && <div className="fquote">You said: “{card.quote}”</div>}
      {editing && (
        <form className="fedit-form" onSubmit={save}>
          <label className="sr-only" htmlFor={`f-${card.k}`}>
            {card.label}
          </label>
          <input
            id={`f-${card.k}`}
            className="field-input"
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-invalid={!!err}
          />
          <Button type="submit" variant="primary" size="sm">
            Save
          </Button>
          {err && (
            <p className="ferr" role="alert">
              {err}
            </p>
          )}
        </form>
      )}
    </div>
  );
}

/** The business as cards. Editable on the "what I heard" screen; read-only on the profile screen. */
export function FieldGrid({ editable }: { editable: boolean }) {
  const { fields, quotes, assumed, followed } = useParallax();
  return (
    <div className="fgrid">
      {cardsFor(fields, quotes, assumed, followed).map((c) => (
        <FieldCard key={c.k} card={c} editable={editable} />
      ))}
    </div>
  );
}

// The check screen's few short cards. Each groups figures the founder thinks of together; every value is a button that
// turns into a box in place, so fixing a figure is one tap and Enter.
const GROUPS: { title: string; keys: FieldKey[] }[] = [
  { title: "The decision", keys: ["decision", "offerRevenue", "paymentDays", "hireCost", "upfrontCost", "priceRisePercent"] },
  { title: "Each month", keys: ["revenue", "directCosts", "overheads", "payroll", "founderPay", "debtRepayments"] },
  { title: "Cash today", keys: ["cash"] },
  { title: "You and the business", keys: ["business", "location", "riskComfort", "goals"] },
];

function FieldRow({ card }: { card: Card }) {
  const { fields, set } = useParallax();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [err, setErr] = useState("");
  const open = () => {
    const m = money(fields[card.k]);
    setDraft(m ? moneyDraft(m) : String(fields[card.k] ?? ""));
    setErr("");
    setEditing(true);
  };
  const save = (e: FormEvent) => {
    e.preventDefault();
    const r = readValue(card.k, draft);
    if (!r.ok) return setErr(r.msg);
    set((s) => ({
      fields: { ...s.fields, [card.k]: r.value },
      quotes: { ...s.quotes, [card.k]: draft.trim() },
      assumed: s.assumed.filter((k) => k !== card.k),
      followed: s.followed.filter((k) => k !== card.k),
    }));
    setEditing(false);
  };
  return (
    <li className={cx("frow", card.value.length > 22 && "frow--wide")}>
      <span className="frow-lab">
        {card.label} <Src kind={card.kind} />
      </span>
      {editing ? (
        <form className="frow-form" onSubmit={save} onKeyDown={(e) => e.key === "Escape" && setEditing(false)}>
          <label className="sr-only" htmlFor={`fr-${card.k}`}>
            {card.label}
          </label>
          <input id={`fr-${card.k}`} className="field-input" autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} aria-invalid={!!err} />
          <Button type="submit" variant="primary" size="sm">
            Save
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
            Cancel
          </Button>
          {err && (
            <p className="ferr" role="alert">
              {err}
            </p>
          )}
        </form>
      ) : (
        <button type="button" className="frow-val" onClick={open} aria-label={`${card.label}: ${card.value}. Change`}>
          {card.value} <span aria-hidden="true">✎</span>
        </button>
      )}
      {!editing && (card.sub || card.quote) && (
        <span className="frow-sub" title={card.quote ? `You said: “${card.quote}”` : undefined}>
          {card.quote ? `“${card.quote}”` : card.sub}
        </span>
      )}
    </li>
  );
}

/** What was heard, as a few short cards with each figure editable in place. */
export function FieldCards() {
  const { fields, quotes, assumed, followed } = useParallax();
  const cards = cardsFor(fields, quotes, assumed, followed);
  return (
    <div className="fcards">
      {GROUPS.map((g) => {
        const rows = g.keys.map((k) => cards.find((c) => c.k === k)).filter((c): c is Card => !!c);
        if (rows.length === 0) return null;
        return (
          <section key={g.title} className="fcard">
            <h2 className="caps">{g.title}</h2>
            <ul>
              {rows.map((c) => (
                <FieldRow key={c.k} card={c} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
