/**
 * Parallax data layer: the ONLY place components get data from.
 * intake → POST /api/intake; paths → shared templates; simulate → shared engine (all figures in code).
 * chat is still a mock until the future-self agents (F10) land; its replies contain no figures.
 */
import { simulate as runEngine } from "../../../shared/engine/simulate";
import za from "../../../shared/defaults/za.json";
import { parseDecisionAnswer } from "../../../shared/intake/decision";
import { DEMO_TEXT } from "../../../shared/intake/fixture";
import type { IntakeResponse as ApiIntake } from "../../../shared/intake/handle";
import { decisionLabels, type DecisionType, type Extraction } from "../../../shared/intake/schema";
import { templatePaths } from "../../../shared/paths/templates";
import { buildProfile } from "../../../shared/profile/profile";
import { isMoneyField } from "./format";
import type { ChatChunk, FieldKey, IntakeIssue, IntakeResponse, PathCard, Profile, Simulation } from "./types";

export const DEMO_STORY = DEMO_TEXT;
export { parseDecisionAnswer };
export const DECISION_LABELS: Record<DecisionType, string> = decisionLabels;
export const DECISION_TYPES = Object.keys(decisionLabels) as DecisionType[];

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const FIELD_LABELS: Record<FieldKey, string> = {
  decision: "What you're deciding",
  decisionType: "Kind of decision",
  business: "What the business does",
  location: "Where it's based",
  revenue: "Sales a month",
  directCosts: "Stock, ingredients or materials a month",
  overheads: "Rent and running costs a month",
  payroll: "Staff wages a month",
  founderPay: "What you pay yourself a month",
  debtRepayments: "Debt repayments a month",
  cash: "Cash in the business",
  riskComfort: "Comfort with risk",
  goals: "What matters most",
  offerRevenue: "New contract or order a month",
  paymentDays: "Days the client takes to pay",
  hireCost: "New person's cost a month",
  upfrontCost: "One-off cost to get started",
  priceRisePercent: "Price rise (%)",
};

export const FIELD_QUESTIONS: Partial<Record<FieldKey, string>> = {
  decisionType: "Which is closest to your decision?",
  business: "What does the business do?",
  revenue: "Roughly how much does the business sell a month?",
  directCosts: "What do stock, ingredients or materials cost you a month?",
  overheads: "What do rent and running costs (power, fuel, software) come to a month?",
  payroll: "What do staff wages come to a month, in total?",
  founderPay: "How much do you pay yourself a month?",
  debtRepayments: "Does the business repay any debt each month? About how much?",
  cash: "About how much cash is in the business right now?",
  riskComfort: "How comfortable are you with the business's cash going up and down? (low, medium or high)",
  goals: "What matters most to you in this decision? (cash safety, growth, profit, control, time)",
  offerRevenue: "What is the new contract or order worth a month?",
  paymentDays: "How many days after an invoice does the client pay?",
  hireCost: "What would the new person cost you a month?",
  upfrontCost: "Is there a one-off cost to get started, such as equipment?",
  priceRisePercent: "By what percentage would you raise prices?",
};

export const MONEY_FIELDS: FieldKey[] = [
  "revenue",
  "directCosts",
  "overheads",
  "payroll",
  "founderPay",
  "debtRepayments",
  "cash",
  "offerRevenue",
  "hireCost",
  "upfrontCost",
];

/** Whole numbers that are not rand: days and percentages. */
export const NUMBER_FIELDS: FieldKey[] = ["paymentDays", "priceRisePercent"];

/** What Parallax asks for when it could not read the story at all. Template fields keep their defaults. */
const ASK_WHEN_UNREAD: FieldKey[] = ["decisionType", "revenue", "directCosts", "overheads", "payroll", "founderPay", "debtRepayments", "cash"];

// "I don't know" answers use the same defaults the engine uses (shared/defaults/za.json, still placeholders).
const fromZa = (f: { low: number; base: number; high: number }) => ({ ...f, quote: "assumed default" });
export const FIELD_DEFAULTS: Partial<Record<FieldKey, unknown>> = {
  revenue: fromZa(za.monthly.revenue),
  directCosts: fromZa(za.monthly.directCosts),
  overheads: fromZa(za.monthly.overheads),
  payroll: fromZa(za.monthly.payroll),
  founderPay: fromZa(za.monthly.founderPay),
  debtRepayments: fromZa(za.monthly.debtRepayments),
  cash: fromZa(za.cash),
  riskComfort: "low",
  goals: "cash safety",
};

// /api/intake returns { value, quote } for text fields; the screens show plain values and keep each quote beside them.
// Exported so the end-to-end test drives the same mapping the screens do, not a copy of it.
export function toScreenFields(ex: Extraction): { fields: Partial<Record<FieldKey, unknown>>; quotes: Partial<Record<FieldKey, string>> } {
  const fields: Partial<Record<FieldKey, unknown>> = {};
  const quotes: Partial<Record<FieldKey, string>> = {};
  for (const [key, field] of Object.entries(ex) as [FieldKey, Extraction[FieldKey]][]) {
    if (!field) continue;
    if ("low" in field) {
      fields[key] = field;
      continue;
    }
    fields[key] = Array.isArray(field.value) ? field.value.join(", ") : field.value;
    if (field.quote) quotes[key] = field.quote;
  }
  return { fields, quotes };
}

// The F4 checks as the screens read them. An older deploy may send none, and a malformed entry is skipped rather than
// shown; a blocking flag must be exactly true, so nothing is blocked by accident.
function readIssues(raw: unknown): IntakeIssue[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((i) =>
    i && typeof i === "object" && typeof i.message === "string" && i.message.trim()
      ? [{ kind: String(i.kind ?? ""), message: i.message, blocking: i.blocking === true, ...(typeof i.field === "string" ? { field: i.field as FieldKey } : {}) }]
      : [],
  );
}

async function intake(text: string): Promise<IntakeResponse> {
  try {
    const res = await fetch("/api/intake", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const data = (await res.json()) as ApiIntake | null;
    if (!data || data.ok !== true) {
      // The route always sends a plain-English error, but a proxy or an older deploy may not. Never show no message,
      // and never leave the founder without a way forward: the text stays in the box and the answers open below.
      const raw = data as { error?: unknown } | null;
      const error = raw && typeof raw.error === "string" && raw.error.trim() ? raw.error : "We couldn't read that. Your text is kept; please fill in the answers.";
      return { ok: true, mode: "fixture", fields: {}, missing: [...ASK_WHEN_UNREAD], notice: error };
    }
    const screen = toScreenFields(data.fields);
    return {
      ok: true,
      mode: data.mode,
      fields: screen.fields,
      quotes: screen.quotes,
      issues: readIssues(data.issues),
      missing: data.missing.filter((k) => k !== "decision"),
      notice:
        data.notice ?? (data.mode === "fixture" ? "Demo mode: no model is connected yet, so only the demo story is read for you." : undefined),
    };
  } catch {
    return {
      ok: true,
      mode: "fixture",
      fields: {},
      missing: [...ASK_WHEN_UNREAD],
      notice: "We couldn't reach Parallax. Your text is kept; please fill in the answers.",
    };
  }
}

export interface Health {
  modelReady: boolean;
  voiceReady: boolean;
  /** Whether /api/session saves to Parallax's database. Off, a decision is kept in this browser only. */
  savingReady: boolean;
}

/** What the server has switched on. Anything but a clear yes reads as off, so the screens never claim a model. */
async function health(): Promise<Health> {
  try {
    const res = await fetch("/api/health", { cache: "no-store" });
    const data = (await res.json()) as Partial<Record<keyof Health, unknown>> | null;
    return { modelReady: data?.modelReady === true, voiceReady: data?.voiceReady === true, savingReady: data?.savingReady === true };
  } catch {
    return { modelReady: false, voiceReady: false, savingReady: false };
  }
}

// Screens hold plain values; the engine's profile builder wants intake fields. Assumed answers are
// left out so the profile builder fills them from za.json and marks them as defaults. Exported for the end-to-end test.
export function toExtraction(p: Profile): Extraction {
  const ex: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(p.fields) as [FieldKey, unknown][]) {
    if (p.assumed.includes(key) || value === undefined) continue;
    if (isMoneyField(value)) ex[key] = value;
    else if (key === "goals") ex[key] = { value: String(value).split(/,\s*/).filter(Boolean), quote: String(value) };
    else if (NUMBER_FIELDS.includes(key)) ex[key] = { value: Number(value), quote: String(value) };
    else ex[key] = { value: String(value), quote: String(value) };
  }
  return ex as Extraction;
}

const lastPaths = new Map<string, PathCard>();
let lastDecision: DecisionType = "contract";

async function paths(profile: Profile): Promise<PathCard[]> {
  const built = buildProfile(toExtraction(profile));
  if (built.decisionType === null) throw new Error("Choose a kind of decision first");
  lastDecision = built.decisionType;
  const cards = templatePaths(built).map((c) => ({ ...c, avatarUrl: `/avatars/${c.letter}.png` }));
  for (const c of cards) lastPaths.set(c.id, c);
  return cards;
}

function simulate(path: PathCard): Simulation {
  return runEngine(path);
}

// Mock replies: first person, three years on, conditional, one downside, no figures (the figure guard, F11, will
// enforce that for real replies). Citations point at real assumptions on the path, matched by label.
type Reply = { text: string; cite: RegExp[] };
const REPLIES: Record<DecisionType, Record<"A" | "B" | "C", Reply[]>> = {
  contract: {
    A: [
      {
        text: "Three years on, the business looks a lot like it did when I said no. When sales held, there was a little left over each month and I slept fine. The honest downside: in the slow months there was nothing to cushion us, and I kept wondering whether that contract would have carried us through.",
        cite: [/gross profit/i, /rent and running/i],
      },
      {
        text: "Saying no kept things simple. I never had to chase a big client for money. What bothers me is how much rides on our usual customers: when one of them went quiet for a while, I felt it straight away.",
        cite: [/gross profit/i, /staff wages/i],
      },
    ],
    B: [
      {
        text: "Three years on, the contract changed the business. But the first stretch was the hardest I've had: I paid for food, a cook and the equipment long before the first payment landed, and cash got thinner than I ever want it again. Once the payments came in, it turned around fast.",
        cite: [/contract income/i, /equipment/i],
      },
      {
        text: "If I could warn you about one thing, it's the gap between doing the work and being paid for it. Profit on paper didn't pay wages. If they had paid even later than agreed, I'm not sure we'd have made it.",
        cite: [/contract income/i, /direct costs/i],
      },
    ],
    C: [
      {
        text: "Three years on, I'm glad I pushed back on the terms before saying yes. Getting paid sooner meant we never got close to empty, even at the start. The trade-off: renting the equipment cost more than I liked, and the negotiation nearly lost us the deal.",
        cite: [/contract income/i, /rented/i],
      },
      {
        text: "The contract still stretched us, just less. I watched every invoice. What still worries me is what happens when the contract ends: the business got used to that work.",
        cite: [/contract income/i, /extra staff/i],
      },
    ],
  },
  hire: {
    A: [
      {
        text: "Three years on, it's still mostly me and the team I had. Costs stayed predictable, which I valued. The downside is my own time: I turned work away because nobody else could do it, and I was tired more often than I'd admit.",
        cite: [/your own pay/i, /gross profit/i],
      },
      {
        text: "Not hiring kept the business steady in quiet months. What I'd warn you about is the work that doesn't get done when you're the bottleneck.",
        cite: [/staff wages/i, /gross profit/i],
      },
    ],
    B: [
      {
        text: "Three years on, hiring early was the right call in the good months and a weight in the bad ones. They cost money from the first day, and it took a while before they brought in more than they cost. If sales had stayed weak, that hire would have hurt.",
        cite: [/new hire/i, /extra gross profit/i],
      },
      {
        text: "The biggest change was my time: I finally worked on the business, not just in it. The downside is that wages don't pause when sales do.",
        cite: [/new hire/i, /staff wages/i],
      },
    ],
    C: [
      {
        text: "Three years on, starting part-time let me test the fit before committing. The early months were cheaper and calmer. The downside: they took longer to get up to speed, and I nearly lost them to a full-time job elsewhere.",
        cite: [/part-time help/i, /full-time from/i],
      },
      {
        text: "By the time they went full-time, I knew what they were worth to the business. If sales had been slower, I'd have been glad I could stop at part-time.",
        cite: [/extra gross profit, part-time/i, /same person/i],
      },
    ],
  },
  pricing: {
    A: [
      {
        text: "Three years on, our prices are where they were, and our customers stayed. But costs kept creeping up and the margin got thinner each year. I sometimes wish I'd tested a rise earlier.",
        cite: [/gross profit/i, /rent and running/i],
      },
      {
        text: "Keeping prices felt safe, and nobody complained. The downside is that we had to sell more just to stand still.",
        cite: [/gross profit/i, /staff wages/i],
      },
    ],
    B: [
      {
        text: "Three years on, the price rise paid for itself. A few customers left early on and that stung, but the ones who stayed were the ones I wanted. If more had left, it would have been a different story.",
        cite: [/higher/i, /current sales/i],
      },
      {
        text: "I'd tell you to explain the rise before it lands. The customers we lost were mostly the ones who first heard about it on an invoice.",
        cite: [/higher/i],
      },
    ],
    C: [
      {
        text: "Three years on, the smaller rise was easy to explain and almost nobody left. It helped, but less than I hoped, and I've had to raise prices again since.",
        cite: [/higher/i, /rent and running/i],
      },
      {
        text: "The small rise was the comfortable choice. What still bothers me is that I may have left money on the table.",
        cite: [/higher/i],
      },
    ],
  },
};
const counters: Record<string, number> = {};

export interface ChatContext {
  business?: string;
  location?: string;
  decision?: string;
  goals?: string[];
  story?: string;
}

type ModelReply = { ok?: boolean; mode?: string; text?: unknown; citations?: unknown; clean?: unknown; checks?: unknown; model?: unknown; error?: unknown };

/** Types a reply out word by word, as the scripted replies do, so both read the same way on screen. */
async function* typeOut(text: string): AsyncIterable<ChatChunk> {
  const words = text.split(" ");
  for (let w = 0; w < words.length; w++) {
    await wait(18);
    yield { type: "token", text: (w ? " " : "") + words[w] };
  }
}

/**
 * One question to a future self. With Muse Spark connected, /api/chat answers from this path's own figures and the
 * founder's own story, through the figure guard; the path sent is the one on screen, edits and all. With no model
 * connected the route says so and the scripted replies below are used.
 */
async function* chat(
  path: PathCard,
  message: string,
  history: { role: "user" | "self"; text: string }[] = [],
  context: ChatContext = {},
): AsyncIterable<ChatChunk> {
  let data: ModelReply | null = null;
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        path: { id: path.id, letter: path.letter, name: path.name, summary: path.summary, startingCash: path.startingCash, assumptions: path.assumptions },
        context,
        history: history.filter((h) => h.text.trim()).slice(-8).map((h) => ({ role: h.role, text: h.text.slice(0, 2000) })),
        message: message.slice(0, 1000),
      }),
    });
    data = (await res.json()) as ModelReply | null;
  } catch {
    data = null;
  }
  if (data?.ok && data.mode === "model" && typeof data.text === "string" && data.text.trim()) {
    yield* typeOut(data.text);
    const cites = Array.isArray(data.citations) ? data.citations : [];
    for (const c of cites as { id?: unknown; label?: unknown }[]) {
      if (typeof c?.id === "string" && typeof c.label === "string") yield { type: "citation", citation: { id: c.id, label: c.label } };
    }
    const checks = Array.isArray(data.checks) ? (data.checks as { type?: unknown }[]).map((c) => String(c?.type ?? "")) : [];
    yield {
      type: "done",
      trace: {
        model: typeof data.model === "string" ? data.model : "muse-spark",
        checks: [
          { name: "Figures come from code, not the model", ok: !checks.some((t) => ["scrubbed", "unknown_key", "wrong_path", "bad_value"].includes(t)) },
          { name: "Cites at least one assumption on this path", ok: cites.length > 0 },
          { name: "Makes no promises", ok: !checks.includes("certainty") },
          { name: "Speaks in first person, 36 months on", ok: null },
          { name: "Does not tell you what to choose", ok: null },
        ],
      },
    };
    return;
  }
  if (data && data.mode !== "fixture" && !(data.ok && data.mode === "model")) {
    // The model is connected but this answer failed: say so, rather than pass a scripted reply off as an answer.
    yield* typeOut(typeof data.error === "string" && data.error ? data.error : "Your future self couldn't answer just now. Please ask again.");
    yield { type: "done", trace: { model: "none (the answer failed)", checks: [] } };
    return;
  }
  yield* scripted(path.id);
}

async function* scripted(pathId: string): AsyncIterable<ChatChunk> {
  const path = lastPaths.get(pathId);
  const letter = path?.letter ?? "A";
  const list = REPLIES[lastDecision][letter];
  const key = `${lastDecision}.${letter}`;
  const i = counters[key] ?? 0;
  counters[key] = i + 1;
  const reply = list[i % list.length]!;
  await wait(350);
  const words = reply.text.split(" ");
  for (let w = 0; w < words.length; w++) {
    await wait(30);
    yield { type: "token", text: (w ? " " : "") + words[w] };
  }
  for (const re of reply.cite) {
    const a = path?.assumptions.find((x) => re.test(x.label));
    if (a) yield { type: "citation", citation: { id: a.id, label: `${a.id}: ${a.label.toLowerCase()}` } };
  }
  yield { type: "done" };
}

export const mockApi = { intake, health, paths, simulate, chat };
