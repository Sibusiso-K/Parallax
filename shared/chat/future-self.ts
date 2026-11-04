import { z } from 'zod';
import { figureTable } from '../engine/analysis.js';
import type { PathInput } from '../engine/simulate.js';
import { guardSentences, type Check } from '../guard/figures.js';
import { chatJson, type Deps, type MetaConfig } from '../providers/meta.js';
import { LANGUAGE_CODES, replyInLine, type LanguageCode } from './languages.js';

// The future-self chat (F9, F10): the founder questions the person they would be 36 months down one path.
// Muse Spark writes the words; the engine owns every number. The model may only name a figure by its key, as a
// {{fig:...}} placeholder, and the figure guard (shared/guard) swaps in the engine's value and scrubs anything else
// that looks like an amount. So a reply adapts to the founder's own business and question, but can never invent a
// figure, borrow one from another path, or cite an assumption the path does not have.

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

export const chatRequest = z.object({
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
      goals: z.array(z.string().max(60)).max(6).optional(),
      story: z.string().max(4000).optional(),
      language: z.enum(LANGUAGE_CODES as [string, ...string[]]).optional(),
    })
    .default({}),
  history: z.array(z.object({ role: z.enum(['user', 'self']), text: z.string().max(2000) })).max(12).default([]),
  message: z.string().trim().min(1, 'Ask your future self something.').max(1000, 'Keep the question under 1,000 characters.'),
});
export type ChatRequest = z.infer<typeof chatRequest>;

const replySchema = z.object({
  reply: z.string().min(1).max(1500),
  cites: z.array(z.string().max(12)).max(6).default([]),
});

export interface ChatAnswer {
  text: string;
  citations: { id: string; label: string }[];
  /** What the guard had to do: nothing (clean), or which kinds of repair. */
  checks: Check[];
  clean: boolean;
  model: string;
  latencyMs: number;
}

// The keys worth offering the model, with what each one means. The full table has more (bad and good cases for every
// metric); offering fewer keeps the prompt short and the choice clear.
function describe(key: string, pathId: string, labels: Map<string, string>): string | null {
  const k = key.slice(pathId.length + 1);
  const caseName = (c: string) => (c === 'likely' ? 'likely case' : c === 'bad' ? 'bad case' : 'good case');
  let m: RegExpMatchArray | null;
  if (k === 'start') return 'cash in the business today';
  if ((m = k.match(/^cash\.m(12|36)\.(bad|likely|good)$/))) return `cash at month ${m[1]}, ${caseName(m[2]!)}`;
  if ((m = k.match(/^lowest\.(bad|likely|good)$/)) && m[1] !== 'good') return `lowest cash over the 36 months, ${caseName(m[1]!)}`;
  if ((m = k.match(/^lowestMonth\.(bad|likely)$/))) return `the month of that lowest cash, ${caseName(m[1]!)}`;
  if ((m = k.match(/^(income|costs)\.m1\.likely$/))) return `${m[1] === 'income' ? 'money in' : 'money out'} in month 1, likely case`;
  if (k === 'runway') return 'months the cash would last with no income';
  if ((m = k.match(/^milestone\.cash-runs-out\.(bad|likely)$/))) return `the month cash first runs out, ${caseName(m[1]!)}`;
  if ((m = k.match(/^setback\.([a-z-]+)\.(lowest|runsOut)$/)))
    return `${m[2] === 'lowest' ? 'lowest cash' : 'the month cash runs out'} if this setback hits: ${m[1]!.replace(/-/g, ' ')}`;
  if (k === 'setback.late-payment.paidFromMonth') return 'the month a late-paying client finally pays';
  if ((m = k.match(/^([A-Z]\d+)\.base$/))) return `${labels.get(m[1]!) ?? m[1]} a month (the assumption's likely value)`;
  return null;
}

export function buildPrompt(req: ChatRequest, table: Record<string, number>): { system: string; user: string } {
  const { path, context: c } = req;
  const labels = new Map(path.assumptions.map((a) => [a.id, a.label]));
  // When the lowest point is still above the starting cash, cash never dipped: say so, or the model calls a rise a dip
  // ("dipping toward R121,500" from R120,000, seen in a live test on 4 Nov).
  const start = table[`${path.id}.start`];
  const neverDipped = (key: string) => /\.lowest\.(likely|bad)$/.test(key) && start !== undefined && (table[key] ?? -Infinity) >= start;
  const figures = Object.keys(table)
    .map((key) => [key, describe(key, path.id, labels)] as const)
    .filter((e): e is readonly [string, string] => e[1] !== null)
    .map(([key, what]) => `{{fig:${key}}}: ${what}${neverDipped(key) ? ' (cash never fell below where it started on this case; do not call this a dip)' : ''}`);
  const business = c.business?.trim() || 'the business';
  const system = [
    `You are the founder of ${business}${c.location ? ` in ${c.location}` : ''}, speaking 36 months from now. Three years ago you faced this decision: "${c.decision?.trim() || 'a big business decision'}". You chose path ${path.letter}: "${path.name}". ${path.summary}`,
    c.goals?.length ? `What mattered most to you then: ${c.goals.join(', ')}.` : '',
    c.story ? `In your own words, three years ago:\n"""${c.story.slice(0, 4000)}"""` : '',
    '',
    'Answer the question your younger self asks, in the first person, warmly and plainly, in 2 to 5 sentences. Speak about this business and this decision only, with the details of this business, not generic advice.',
    'Rules:',
    '1. Never type a number, amount, percentage, count of months or date yourself. To use a figure, copy one placeholder from FIGURES exactly, for example {{fig:' + `${path.id}.cash.m36.likely` + '}}. The app fills in the real value from the cash engine.',
    '2. If the question needs a figure that is not in FIGURES (a what-if), say you cannot put a number on that here, and suggest changing that assumption in the Assumptions panel to see it computed.',
    '3. Speak conditionally ("in the months the client paid late", "when sales held"). This is one possible future, not a prediction. Never promise an outcome.',
    '4. Name at least one downside, or one thing you would do differently.',
    '5. Never tell your younger self what to choose, and give no financial, legal or tax advice. If asked to choose, say it is their call, and say what you would weigh.',
    '6. Cite the assumptions your answer leans on by id in square brackets, like [A3], using ids from ASSUMPTIONS only.',
    '',
    'FIGURES (placeholder: meaning):',
    ...figures,
    '',
    'ASSUMPTIONS on your path (id: what it is, money in or out):',
    ...path.assumptions.map((a) => `${a.id}: ${a.label} (${a.kind === 'income' ? 'money in' : 'money out'})`),
    '',
    replyInLine(c.language as LanguageCode | undefined) || null,
    'Reply as JSON: {"reply": "...", "cites": ["A1"]}.',
  ]
    .filter((line) => line !== null)
    .join('\n');
  const history = req.history
    .slice(-8)
    .map((h) => `${h.role === 'user' ? 'Younger you' : 'You'}: ${h.text}`)
    .join('\n');
  const user = `${history ? `The conversation so far:\n${history}\n\n` : ''}Younger you asks: ${req.message}`;
  return { system, user };
}

/** Numbers the founder typed (story, earlier questions, this question). The guard lets these be repeated back. */
function typedNumbers(req: ChatRequest): number[] {
  const text = [req.context.story ?? '', req.message, ...req.history.filter((h) => h.role === 'user').map((h) => h.text)].join(' ');
  return [...text.matchAll(/\d[\d ,]*(?:\.\d+)?/g)].map((m) => Number(m[0].replace(/[ ,]/g, ''))).filter((n) => Number.isFinite(n) && n > 0);
}

export async function answerAsFutureSelf(cfg: MetaConfig, req: ChatRequest, deps?: Deps): Promise<ChatAnswer> {
  const path = req.path as PathInput & ChatRequest['path'];
  const table = figureTable(path);
  const { system, user } = buildPrompt(req, table);
  const { value, trace } = await chatJson(cfg, { name: 'future_self', system, user, schema: replySchema, timeoutMs: 25_000 }, deps);
  const allowedIds = path.assumptions.map((a) => a.id);
  const guarded = guardSentences(value.reply, { pathId: path.id, table, userNumbers: typedNumbers(req), allowedIds });
  const cited = new Set<string>([...value.cites, ...[...guarded.text.matchAll(/\[\s*([A-Z]\d+)\s*\]/g)].map((m) => m[1]!)]);
  const citations = path.assumptions.filter((a) => cited.has(a.id)).map((a) => ({ id: a.id, label: `${a.id}: ${a.label.toLowerCase()}` }));
  return { text: guarded.text, citations, checks: guarded.checks, clean: guarded.clean, model: trace.model, latencyMs: trace.latencyMs };
}
