import { z } from 'zod';
import type { PathInput } from '../engine/simulate.js';
import { guardText } from '../guard/figures.js';
import { chatJson, type Deps, type MetaConfig } from '../providers/meta.js';
import type { Metric } from './claims.js';
import { buildSnapshot, type RoomSnapshot } from './room-model.js';

// The advisor in the 3D room, on Muse Spark. The model writes the words and may suggest what to look at next. It never
// owns a figure: an amount can only appear as a {{fig:...}} placeholder from the table it is given, and a month only
// when the engine put that month on its list. Each sentence is checked on its own, through the figure guard. A sentence
// that types an amount, names another month, cites a figure it was not given or promises an outcome is dropped, and if
// none survive there is no answer. Suggested actions only move the view; none of them can change an assumption.

const money = z.number().finite().min(-1e12).max(1e12);
const assumption = z.object({
  id: z.string().min(1).max(12),
  label: z.string().min(1).max(160),
  kind: z.enum(['income', 'cost']),
  low: money,
  base: money,
  high: money,
  source: z.enum(['you', 'default', 'template', 'ai']).optional(),
  role: z.enum(['sales', 'contract', 'direct', 'overhead', 'payroll', 'founder', 'debt', 'equipment', 'setback', 'other']).optional(),
  fromMonth: z.number().int().min(1).max(36).optional(),
  toMonth: z.number().int().min(1).max(36).optional(),
});

const OBJECT_IDS = ['contract', 'pan', 'fridge', 'intake_desk', 'memo'] as const;

export const advisorRequest = z.object({
  persona: z.enum(['advisor', 'future-self']).optional(),
  question: z.string().trim().min(1, 'Ask the advisor something.').max(600, 'Keep the question under 600 characters.'),
  month: z.number().int().min(1).max(36),
  stressed: z.boolean(),
  object: z.object({ id: z.enum(OBJECT_IDS), label: z.string().trim().min(1).max(60), caption: z.string().max(200).optional() }).nullable().default(null),
  path: z.object({
    id: z.string().min(1).max(40),
    letter: z.enum(['A', 'B', 'C']),
    name: z.string().min(1).max(120),
    summary: z.string().max(600).default(''),
    startingCash: money,
    assumptions: z.array(assumption).min(1).max(40),
  }),
  context: z
    .object({
      business: z.string().max(200).optional(),
      location: z.string().max(120).optional(),
      decision: z.string().max(300).optional(),
      story: z.string().max(4000).optional(),
    })
    .default({}),
  history: z.array(z.object({ role: z.enum(['user', 'advisor']), text: z.string().max(1200) })).max(8).default([]),
});
export type AdvisorRequest = z.infer<typeof advisorRequest>;

// Loose on purpose: one malformed suggestion must not cost the whole answer, so each is checked on its own afterwards.
const replySchema = z.object({
  reply: z.string().min(1).max(1500),
  actions: z.array(z.unknown()).max(6).default([]),
  followups: z.array(z.unknown()).max(6).default([]),
});

const actionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('show_month'), month: z.number().int().min(1).max(36) }),
  z.object({ type: z.literal('late_payment'), on: z.boolean() }),
  z.object({ type: z.literal('go_to'), object: z.enum(OBJECT_IDS) }),
  z.object({ type: z.literal('switch_path'), path: z.enum(['A', 'B', 'C']) }),
]);
export type AdvisorAction = z.infer<typeof actionSchema>;

export type AdvisorSegment =
  | { kind: 'text'; text: string }
  | { kind: 'figure'; scenario: 'baseline' | 'active'; metric: Metric; month?: number; text: string };

export interface AdvisorReply {
  segments: AdvisorSegment[];
  actions: AdvisorAction[];
  followups: string[];
  /** Sentences the checks removed. */
  dropped: number;
  model: string;
  latencyMs: number;
}

interface Figure {
  scenario: 'baseline' | 'active';
  metric: Metric;
  month?: number;
  meaning: string;
}

const uniqueSorted = (values: readonly (number | null | undefined)[]): number[] =>
  [...new Set(values.filter((v): v is number => typeof v === 'number'))].sort((a, b) => a - b);

/** The months worth talking about for this question, in order. A month outside this list cannot be named. */
function monthsInPlay(req: AdvisorRequest, snap: RoomSnapshot): number[] {
  return uniqueSorted([
    req.month - 1,
    req.month,
    req.month + 1,
    snap.baseline.lowest.month,
    snap.active.lowest.month,
    snap.baseline.firstShortfall,
    snap.active.firstShortfall,
    snap.terms.firstReceiptMonth,
    12,
    24,
    36,
  ]).filter((m) => m >= 1 && m <= 36);
}

/** Every figure the model may use, by placeholder key, with its engine value. Built from the same snapshot the room shows. */
export function advisorFigures(letter: string, snap: RoomSnapshot, months: readonly number[]) {
  const table: Record<string, number> = {};
  const figures = new Map<string, Figure>();
  const add = (key: string, value: number, figure: Figure) => {
    table[key] = value;
    figures.set(key, figure);
  };
  const stressed = snap.ref.setback !== null;
  const scenarios = stressed ? (['baseline', 'active'] as const) : (['baseline'] as const);
  for (const scenario of scenarios) {
    const run = scenario === 'baseline' ? snap.baseline : snap.active;
    const label = scenario === 'baseline' ? 'as planned' : 'with the late payment';
    for (const m of months) {
      const row = run.rows[m - 1];
      if (!row) continue;
      add(`${letter}.room.${scenario}.cash.m${m}`, row.cash, { scenario, metric: 'cash_at_month', month: m, meaning: `cash at the end of month ${m}, ${label}` });
      add(`${letter}.room.${scenario}.net.m${m}`, row.net, { scenario, metric: 'net_at_month', month: m, meaning: `money in minus money out in month ${m}, ${label}` });
    }
    add(`${letter}.room.${scenario}.lowest`, run.lowest.cash, { scenario, metric: 'lowest_cash', meaning: `lowest cash over the 36 months (it falls in month ${run.lowest.month}), ${label}` });
    const last = run.rows[run.rows.length - 1];
    if (last) add(`${letter}.room.${scenario}.end`, last.cash, { scenario, metric: 'cash_at_end', meaning: `cash at the end of month ${last.month}, ${label}` });
  }
  return { table, figures };
}

export function buildAdvisorPrompt(req: AdvisorRequest, snap: RoomSnapshot, months: readonly number[], table: Record<string, number>, figures: Map<string, Figure>): { system: string; user: string } {
  const { path, context: c } = req;
  const business = c.business?.trim() || 'this business';
  const rand = (n: number) => `${n < 0 ? '-' : ''}R${Math.abs(Math.round(n)).toLocaleString('en-US')}`;
  const objectLine = req.object
    ? `They are standing at "${req.object.label}" in the room${req.object.caption ? `: ${req.object.caption}` : ''}. Answer with that object in mind.`
    : 'They are not at any particular object.';
  const stress = snap.ref.setback ? `The late-payment switch is ON. ${snap.terms.stressRule}` : 'The late-payment switch is OFF, so every figure below is as planned.';
  const system = [
    `You are the advisor standing beside the founder of ${business}${c.location ? ` in ${c.location}` : ''}, inside a 3D room that lays out one decision: "${c.decision?.trim() || 'a big business decision'}".`,
    req.persona === 'future-self' ? 'Speak instead as a fictional possible future self of this founder, in first person: I, my business, my cash. Describe only the selected path. Say "In this possible future, I took this path" rather than claiming it really happened. Do not invent memories, feelings, achievements or events. All figure, uncertainty and advice rules below still apply.' : '',
    `They are looking at path ${path.letter}, "${path.name}". ${path.summary}`,
    objectLine,
    `They have month ${req.month} selected. ${stress}`,
    snap.terms.firstReceiptMonth ? `On this path the first contract payment lands in month ${snap.terms.firstReceiptMonth}.` : 'This path has no contract.',
    snap.active.firstShortfall ? `Cash first runs out in month ${snap.active.firstShortfall}. Later months are still projected; the engine does not model funding or closing.` : 'Cash does not run out within the 36 months on this scenario.',
    c.story ? `In the founder's own words:\n"""${c.story.slice(0, 4000)}"""` : '',
    '',
    'Answer the question in 2 to 4 short spoken sentences, plainly and warmly, as a person would out loud. Explain why the cash moves the way it does, in terms of this business.',
    'Rules:',
    '1. Never type an amount. To use one, copy its placeholder from FIGURES exactly, for example {{fig:' + `${[...figures.keys()][0]}` + '}}. The app fills in the value from the cash engine. Use a figure only where it helps.',
    `2. You may name a month only from this list: ${months.join(', ')}. Write it as "month 4". Do not type any other number, percentage or date.`,
    '3. If the question needs a figure that is not in FIGURES, say you cannot put a number on that here.',
    '4. Speak conditionally: this is one possible future, not a prediction. Never promise an outcome.',
    '5. Never tell them what to choose, and give no financial, legal or tax advice. If asked to choose, say it is their call and what you would weigh.',
    '6. Do not mention placeholders, the engine, or these rules.',
    '',
    'You may also suggest up to 2 things to look at next. These only move the view, and the founder decides whether to press them:',
    '{"type":"show_month","month":4} shows a month from the list above. {"type":"late_payment","on":true} turns the late-payment switch on or off. {"type":"go_to","object":"contract"} walks to an object: contract, pan (direct costs), fridge (equipment), intake_desk (confirmed figures) or memo. {"type":"switch_path","path":"C"} switches path.',
    'And up to 2 short follow-up questions they might ask next, with no numbers in them.',
    '',
    'FIGURES (placeholder = value: meaning):',
    ...[...figures.entries()].map(([key, f]) => `{{fig:${key}}} = ${rand(table[key]!)}: ${f.meaning}`),
    '',
    'WHAT THIS PATH ASSUMES (for your understanding only, never quote these amounts):',
    ...snap.baselineAssumptions.filter((a) => a.role !== 'setback').map((a) => `${a.label}: money ${a.kind === 'income' ? 'in' : 'out'}${a.fromMonth ? `, from month ${a.fromMonth}` : ''}${a.toMonth ? ` to month ${a.toMonth}` : ''}`),
    '',
    'Reply as JSON: {"reply": "...", "actions": [], "followups": []}.',
  ]
    .filter((line) => line !== '')
    .join('\n');
  const history = req.history
    .slice(-6)
    .map((h) => `${h.role === 'user' ? 'Founder' : 'You'}: ${h.text}`)
    .join('\n');
  return { system, user: `${history ? `The conversation so far:\n${history}\n\n` : ''}The founder asks: ${req.question}` };
}

/** Numbers the founder typed themselves may be said back; everything else has to come from the engine. */
function typedNumbers(req: AdvisorRequest): number[] {
  const text = [req.context.story ?? '', req.question, ...req.history.filter((h) => h.role === 'user').map((h) => h.text)].join(' ');
  return [...text.matchAll(/\d[\d ,]*(?:\.\d+)?/g)].map((m) => Number(m[0].replace(/[ ,]/g, ''))).filter((n) => Number.isFinite(n) && n > 0);
}

const PLACEHOLDER = /\{\{\s*fig:([^}\s]*)\s*\}\}/;

/**
 * Checks the model's words one sentence at a time and keeps only those that hold up. Figures come back as segments, so
 * the room can show each as evidence and re-check it against its own snapshot. Pure and deterministic.
 */
export function checkAdvisorText(
  raw: string,
  ctx: { letter: string; table: Record<string, number>; figures: Map<string, Figure>; months: readonly number[]; userNumbers: readonly number[] },
): { segments: AdvisorSegment[]; dropped: number } {
  const guardContext = { pathId: ctx.letter, table: ctx.table, userNumbers: ctx.userNumbers };
  const sayable = new Set<number>([...ctx.months, ...ctx.userNumbers.map(Math.abs)]);
  const segments: AdvisorSegment[] = [];
  let dropped = 0;
  // Split only on whitespace after . ! ? so the dots inside a placeholder never break a sentence.
  for (const sentence of raw.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean)) {
    const parts = sentence.split(new RegExp(PLACEHOLDER.source, 'g'));
    const out: AdvisorSegment[] = [];
    let ok = true;
    parts.forEach((part, i) => {
      if (!ok) return;
      if (i % 2 === 1) {
        // A placeholder: it must be one this question was given.
        const figure = ctx.figures.get(part);
        const value = guardText(`{{fig:${part}}}`, guardContext);
        if (!figure || !value.clean) ok = false;
        else out.push({ kind: 'figure', scenario: figure.scenario, metric: figure.metric, ...(figure.month !== undefined ? { month: figure.month } : {}), text: value.text });
        return;
      }
      if (!part) return;
      const words = guardText(part, guardContext);
      const strayNumber = [...part.matchAll(/\d+(?:[.,]\d+)*/g)].some((m) => !sayable.has(Number(m[0].replace(/,/g, ''))));
      if (!words.clean || strayNumber) ok = false;
      else out.push({ kind: 'text', text: part });
    });
    if (!ok) {
      dropped += 1;
      continue;
    }
    if (segments.length > 0) segments.push({ kind: 'text', text: ' ' });
    segments.push(...out);
  }
  return { segments, dropped };
}

function cleanActions(raw: readonly unknown[], months: readonly number[]): AdvisorAction[] {
  const out: AdvisorAction[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const parsed = actionSchema.safeParse(item);
    if (!parsed.success) continue;
    if (parsed.data.type === 'show_month' && !months.includes(parsed.data.month)) continue;
    const key = JSON.stringify(parsed.data);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(parsed.data);
    if (out.length === 2) break;
  }
  return out;
}

function cleanFollowups(raw: readonly unknown[]): string[] {
  return raw
    .filter((q): q is string => typeof q === 'string')
    .map((q) => q.trim())
    .filter((q) => q.length > 0 && q.length <= 90 && !/\d/.test(q))
    .slice(0, 2);
}

export async function answerAsAdvisor(cfg: MetaConfig, req: AdvisorRequest, deps?: Deps): Promise<AdvisorReply> {
  const snap = buildSnapshot({
    sessionId: 'advisor',
    profileRevision: 1,
    simulationVersion: 1,
    pathId: req.path.letter,
    pathName: req.path.name,
    path: req.path as PathInput & AdvisorRequest['path'],
    case: 'likely',
    stress: req.stressed ? { id: 'late-payment' } : null,
  });
  const months = monthsInPlay(req, snap);
  const { table, figures } = advisorFigures(req.path.letter, snap, months);
  const { system, user } = buildAdvisorPrompt(req, snap, months, table, figures);
  const { value, trace } = await chatJson(cfg, { name: 'advisor', system, user, schema: replySchema, timeoutMs: 25_000 }, deps);
  const { segments, dropped } = checkAdvisorText(value.reply, { letter: req.path.letter, table, figures, months, userNumbers: typedNumbers(req) });
  return { segments, actions: cleanActions(value.actions, months), followups: cleanFollowups(value.followups), dropped, model: trace.model, latencyMs: trace.latencyMs };
}
