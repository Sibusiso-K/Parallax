/**
 * Parallax data layer: the ONLY place components get data from.
 * intake → POST /api/intake; paths → shared templates; simulate → shared engine (all figures in code).
 * chat is still a mock until the future-self agents (F10) land; its replies contain no figures.
 */
import { simulate as runEngine } from "../../../shared/engine/simulate";
import za from "../../../shared/defaults/za.json";
import { NALEDI_TEXT } from "../../../shared/intake/fixture";
import type { IntakeResponse as ApiIntake } from "../../../shared/intake/handle";
import type { Extraction } from "../../../shared/intake/schema";
import { templatePaths } from "../../../shared/paths/templates";
import { buildProfile } from "../../../shared/profile/profile";
import { isMoneyField } from "./format";
import type { ChatChunk, FieldKey, IntakeResponse, PathCard, Profile, Simulation } from "./types";

export const DEMO_STORY = NALEDI_TEXT;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const FIELD_LABELS: Record<FieldKey, string> = {
  decision: "What you're deciding",
  ageBand: "Age",
  province: "Where you live",
  takeHome: "Take-home pay a month",
  sideIncome: "Side income a month",
  essentialExpenses: "Essential costs a month",
  familySupportMonthly: "Family support a month",
  debtRepayments: "Debt repayments a month",
  savings: "Savings right now",
  riskComfort: "Comfort with risk",
  goals: "What matters most",
};

export const FIELD_QUESTIONS: Partial<Record<FieldKey, string>> = {
  essentialExpenses: "Roughly what do rent, food, transport and other essentials cost you a month?",
  debtRepayments: "Do you pay off any debt or store accounts each month? About how much?",
  riskComfort: "How comfortable are you with your income going up and down? (low, medium or high)",
  ageBand: "Which age band are you in?",
  province: "Which province do you live in?",
  takeHome: "What do you take home a month after tax?",
  savings: "About how much do you have saved?",
  goals: "What matters most to you in this decision?",
  sideIncome: "Do you earn anything on the side?",
  familySupportMonthly: "Do you support family each month? About how much?",
};

export const MONEY_FIELDS: FieldKey[] = [
  "takeHome",
  "sideIncome",
  "essentialExpenses",
  "familySupportMonthly",
  "debtRepayments",
  "savings",
];

// "I don't know" answers use the same defaults the engine uses (shared/defaults/za.json, still placeholders).
const fromZa = (f: { low: number; base: number; high: number }) => ({ ...f, quote: "assumed default" });
export const FIELD_DEFAULTS: Partial<Record<FieldKey, unknown>> = {
  essentialExpenses: fromZa(za.monthly.essentialExpenses),
  debtRepayments: fromZa(za.monthly.debtRepayments),
  familySupportMonthly: fromZa(za.monthly.familySupportMonthly),
  sideIncome: fromZa(za.monthly.sideIncome),
  takeHome: fromZa(za.monthly.takeHome),
  savings: fromZa(za.savings),
  riskComfort: "low",
  goals: "security",
};

// /api/intake returns { value, quote } for text fields; the screens show plain values.
function toScreenFields(ex: Extraction): Partial<Record<FieldKey, unknown>> {
  const out: Partial<Record<FieldKey, unknown>> = {};
  for (const [key, field] of Object.entries(ex) as [FieldKey, Extraction[FieldKey]][]) {
    if (!field) continue;
    if ("low" in field) out[key] = field;
    else out[key] = Array.isArray(field.value) ? field.value.join(", ") : field.value;
  }
  return out;
}

async function intake(text: string): Promise<IntakeResponse> {
  try {
    const res = await fetch("/api/intake", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const data = (await res.json()) as ApiIntake;
    if (!data.ok) return { ok: true, mode: "fixture", fields: {}, missing: [...MONEY_FIELDS], notice: data.error };
    return {
      ok: true,
      mode: data.mode,
      fields: toScreenFields(data.fields),
      missing: data.missing.filter((k) => k !== "decision"),
      notice:
        data.notice ?? (data.mode === "fixture" ? "Demo mode: no model is connected yet, so only the demo story is read for you." : undefined),
    };
  } catch {
    return {
      ok: true,
      mode: "fixture",
      fields: {},
      missing: [...MONEY_FIELDS],
      notice: "We couldn't reach Parallax. Your text is kept; please fill in the answers.",
    };
  }
}

// Screens hold plain values; the engine's profile builder wants intake fields. Assumed answers are
// left out so the profile builder fills them from za.json and marks them as defaults.
function toExtraction(p: Profile): Extraction {
  const ex: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(p.fields) as [FieldKey, unknown][]) {
    if (p.assumed.includes(key) || value === undefined) continue;
    if (isMoneyField(value)) ex[key] = value;
    else if (key === "goals") ex[key] = { value: String(value).split(/,\s*/).filter(Boolean), quote: String(value) };
    else ex[key] = { value: String(value), quote: String(value) };
  }
  return ex as Extraction;
}

const lastPaths = new Map<string, PathCard>();

async function paths(profile: Profile): Promise<PathCard[]> {
  const cards = templatePaths(buildProfile(toExtraction(profile)));
  for (const c of cards) lastPaths.set(c.id, c);
  return cards;
}

function simulate(path: PathCard): Simulation {
  return runEngine(path);
}

// Mock replies: first person, conditional, one downside, no figures (the figure guard, F11, will
// enforce that for real replies). Citations point at real assumptions on the path, matched by label.
type Reply = { text: string; cite: RegExp[] };
const REPLIES: Record<"A" | "B" | "C", Reply[]> = {
  A: [
    {
      text: "It's 2029 and I'm still at the payroll desk, a team lead now. If the weekend bookings hold, the savings grow quietly every month and the money for Mama never feels like a question. The downside is honest: some Sundays I'm too tired to sit with her, and I sometimes wonder what the catering could have been.",
      cite: [/side/i, /family/i],
    },
    {
      text: "If I'm careful with the store account, it's gone by the second year, and that small win felt bigger than I expected. What still bothers me is that one year the raise never came, so I leaned on the weekend money more than I planned.",
      cite: [/debt/i, /salary/i],
    },
  ],
  B: [
    {
      text: "It's 2029 and the business has a name people in Soweto recognise. When bookings hold, the months even out, but the first winter was slow and I dipped into savings more than once. The freedom is real. So is the knot in my stomach every June.",
      cite: [/full-time/i, /essential/i],
    },
    {
      text: "If I could tell you one thing: the costs I didn't see coming hurt more than the slow months. Some months I earned more than the salary ever paid, others far less. My family time is better on weekdays and worse on weekends, which is not what I imagined.",
      cite: [/full-time/i, /family/i],
    },
  ],
  C: [
    {
      text: "It's 2029 and I finished the qualification after a year and a half. Those evenings of studying were long and the catering mostly paused, so money was tight while the fees ran. If the raise lands where it did for me, the last year feels lighter than anything before it.",
      cite: [/course/i, /raise/i],
    },
    {
      text: "The downside I'd name is time: for a year and a half, family time shrank to Sunday lunches. If the raise comes in at the low end, the trade feels slower to pay back. I still cook on some weekends, just because I love it.",
      cite: [/while studying/i, /raise/i],
    },
  ],
};
const counters: Record<string, number> = {};

async function* chat(pathId: string, message: string): AsyncIterable<ChatChunk> {
  void message;
  const path = lastPaths.get(pathId);
  const letter = path?.letter ?? "A";
  const list = REPLIES[letter];
  const i = counters[letter] ?? 0;
  counters[letter] = i + 1;
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

export const mockApi = { intake, paths, simulate, chat };
