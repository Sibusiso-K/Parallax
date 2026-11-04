import { z } from 'zod';
import { NO_LENS, applyLens, safest, summarise, type Lens } from '../engine/compare.js';
import type { PathInput } from '../engine/simulate.js';
import { ModelError, type Deps, type MetaConfig } from '../providers/meta.js';
import { CONTRACT_STEPS, PRICE_STEPS } from '../whatif/read.js';

// The planner: an agent that looks for plans meeting the founder's goal ("keep cash above R20,000, even if the client
// pays late"). Muse Spark drives the search with native tool calls on the engine: it tries a plan, reads the engine's
// result, and decides what to try next, for a few rounds. The model never states a figure: the tools return the
// engine's numbers, the final answer names plans by their settings only, and code reruns every plan it names before
// showing it. It does not choose for the founder; it lists plans that meet the goal. With no model connected, the same
// tools are searched in code, so the screen works in demo mode too.

export const PATH_LETTERS = ['A', 'B', 'C'] as const;
type Letter = (typeof PATH_LETTERS)[number];

const assumption = z.object({
  id: z.string().max(12),
  label: z.string().max(160),
  kind: z.enum(['income', 'cost']),
  low: z.number().finite(),
  base: z.number().finite(),
  high: z.number().finite(),
  role: z.string().max(20).optional(),
  source: z.string().max(20).optional(),
  fromMonth: z.number().int().optional(),
  toMonth: z.number().int().optional(),
});

export const planRequest = z.object({
  kind: z.literal('plan'),
  /** Keep cash at or above this, in rand, in every month of the likely case. */
  floor: z.number().finite().min(0).max(1e9),
  /** Hold the goal even when a big client pays late. */
  withLatePayment: z.boolean(),
  monthlySales: z.number().finite().min(0).max(1e9),
  paths: z
    .array(z.object({ id: z.string().max(40), letter: z.enum(PATH_LETTERS), name: z.string().max(120), startingCash: z.number().finite(), assumptions: z.array(assumption).min(1).max(40) }))
    .min(1)
    .max(3),
});
export type PlanRequest = z.infer<typeof planRequest>;

export interface PlanSettings {
  path: Letter;
  contractPercent: number;
  pricePercent: number;
}
export interface PlanResult extends PlanSettings {
  lowestCash: number;
  lowestMonth: number;
  runsOutMonth: number | null;
  endCash: number;
  meetsGoal: boolean;
}
export interface Step {
  tool: 'try_plan' | 'compare_all';
  args: Record<string, unknown>;
  results: PlanResult[];
}
export interface PlanAnswer {
  mode: 'model' | 'fixture';
  steps: Step[];
  /** Plans that meet the goal, each rerun by code; at most three. */
  found: PlanResult[];
  /** The closest plan when none meets the goal. */
  closest: PlanResult | null;
  note: string;
  model?: string;
  calls: number;
}

const snap = (n: number, steps: readonly number[]) => steps.reduce((b, s) => (Math.abs(s - n) < Math.abs(b - n) ? s : b), steps[0]!);

/** The engine, as the agent's tool: one path under one plan, judged against the goal. */
export function runPlan(req: PlanRequest, s: PlanSettings): PlanResult {
  const path = req.paths.find((p) => p.letter === s.path);
  if (!path) throw new Error(`no path ${s.path}`);
  const contractPercent = snap(s.contractPercent, CONTRACT_STEPS);
  const pricePercent = snap(s.pricePercent, PRICE_STEPS);
  const lens: Lens = { ...NO_LENS, latePayment: req.withLatePayment, contractScale: contractPercent / 100, pricePercent };
  const sum = summarise(applyLens(path as PathInput, lens, req.monthlySales));
  return {
    path: s.path,
    contractPercent,
    pricePercent,
    lowestCash: sum.lowest.cash,
    lowestMonth: sum.lowest.month,
    runsOutMonth: sum.runsOut,
    endCash: sum.endCash,
    meetsGoal: sum.runsOut === null && sum.lowest.cash >= req.floor,
  };
}

/**
 * Best first: meets the goal; then the smallest change from the plan as it stands (a smaller price change asks less of
 * customers, a contract nearer its offered size changes less); then the higher lowest cash.
 */
export function rank(list: PlanResult[]): PlanResult[] {
  const key = (r: PlanResult) => `${r.path}:${r.contractPercent}:${r.pricePercent}`;
  const unique = [...new Map(list.map((r) => [key(r), r])).values()];
  const change = (r: PlanResult) => Math.abs(r.pricePercent) + Math.abs(r.contractPercent - 100) / 5;
  return unique.sort((a, b) => Number(b.meetsGoal) - Number(a.meetsGoal) || change(a) - change(b) || b.lowestCash - a.lowestCash);
}

/** The first plan per path, in rank order: three different futures rather than three versions of one. */
export function onePerPath(ranked: PlanResult[]): PlanResult[] {
  const seen = new Set<string>();
  return ranked.filter((r) => (seen.has(r.path) ? false : (seen.add(r.path), true)));
}

const hasContract = (req: PlanRequest, letter: Letter) => req.paths.find((p) => p.letter === letter)?.assumptions.some((a) => a.role === 'contract') ?? false;

/** The same search without a model: every path, every price step, and the contract sizes where there is one. */
export function searchInCode(req: PlanRequest): PlanAnswer {
  const results: PlanResult[] = [];
  for (const p of req.paths) {
    const sizes = hasContract(req, p.letter) ? CONTRACT_STEPS : [100];
    for (const c of sizes) for (const pr of PRICE_STEPS) results.push(runPlan(req, { path: p.letter, contractPercent: c, pricePercent: pr }));
  }
  const ranked = rank(results);
  const found = onePerPath(ranked.filter((r) => r.meetsGoal)).slice(0, 3);
  return {
    mode: 'fixture',
    steps: [{ tool: 'compare_all', args: { searched: results.length }, results: ranked.slice(0, 3) }],
    found,
    closest: found.length ? null : (ranked[0] ?? null),
    note: found.length ? 'Searched every setting in code (demo mode).' : 'No setting meets the goal; the closest is shown.',
    calls: 0,
  };
}

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'try_plan',
      description: 'Run the cash engine for one path with given settings. Returns the lowest cash, its month, the month cash runs out (or null), cash at month 36, and whether the goal is met.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', enum: [...PATH_LETTERS] },
          contractPercent: { type: 'integer', description: `Contract size as a percent of the offer. One of ${CONTRACT_STEPS.join(', ')}. Use 100 for a path with no contract.` },
          pricePercent: { type: 'integer', description: `Price change in percent. One of ${PRICE_STEPS.join(', ')}.` },
        },
        required: ['path', 'contractPercent', 'pricePercent'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'compare_all',
      description: 'Run the cash engine for every path with the same settings, and say which is safest by the engine rule.',
      parameters: {
        type: 'object',
        properties: { contractPercent: { type: 'integer' }, pricePercent: { type: 'integer' } },
        required: ['contractPercent', 'pricePercent'],
        additionalProperties: false,
      },
    },
  },
] as const;

const completion = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.string().nullable().optional(),
          tool_calls: z
            .array(z.object({ id: z.string(), type: z.literal('function'), function: z.object({ name: z.string(), arguments: z.string().max(2000) }) }))
            .optional(),
        }),
      }),
    )
    .min(1),
  model: z.string().optional(),
});
const finalAnswer = z.object({
  plans: z.array(z.object({ path: z.enum(PATH_LETTERS), contractPercent: z.number().int(), pricePercent: z.number().int() })).max(3),
  note: z.string().max(300).default(''),
});

const MAX_ROUNDS = 4;
const MAX_TOOL_CALLS = 10;

const live: Deps = {
  fetch: (url, init) => fetch(url, init),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  now: () => Date.now(),
  random: () => Math.random(),
};

/** What the agent sees of a tool result: the engine's numbers, rounded to whole rand. */
const forModel = (r: PlanResult) => ({ ...r, lowestCash: Math.round(r.lowestCash), endCash: Math.round(r.endCash) });

export async function planWithModel(cfg: MetaConfig, req: PlanRequest, deps: Deps = live): Promise<PlanAnswer> {
  const model = cfg.models[0]!;
  const system = [
    'You are a planning agent for a small-business founder. Use the tools to find settings under which a path meets the goal.',
    `The goal: cash never runs out and never falls below R${Math.round(req.floor).toLocaleString('en-ZA')} in the likely case${req.withLatePayment ? ', even when a big client pays late (already applied in every tool run)' : ''}.`,
    `Paths: ${req.paths.map((p) => `${p.letter} "${p.name}"${hasContract(req, p.letter) ? ' (has a contract)' : ' (no contract: contractPercent stays 100)'}`).join('; ')}.`,
    'Start with compare_all at 100 and 0, then try changes that could lift the lowest cash. Prefer smaller price rises. Stop when you have found up to three plans that meet the goal, or after a few tries.',
    'Then reply with JSON only: {"plans": [{"path": "C", "contractPercent": 100, "pricePercent": 5}], "note": "..."}. List only plans a tool showed meeting the goal. The note is one plain sentence without any digits. Never choose for the founder.',
  ].join('\n');
  const messages: Record<string, unknown>[] = [
    { role: 'system', content: system },
    { role: 'user', content: 'Find plans that meet the goal.' },
  ];
  const steps: Step[] = [];
  let calls = 0;
  let toolCalls = 0;
  let usedModel = model;

  const post = async (withTools: boolean) => {
    calls++;
    const res = await deps.fetch(`${cfg.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { authorization: `Bearer ${cfg.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0,
        max_tokens: 4096,
        reasoning_effort: 'minimal',
        ...(withTools ? { tools: TOOLS, tool_choice: 'auto' } : { response_format: { type: 'json_object' } }),
      }),
    });
    if (!res.ok) throw new ModelError(res.status === 429 ? 'rate' : res.status >= 500 ? 'server' : 'request', `the planner call failed (${res.status})`);
    const parsed = completion.safeParse(await res.json());
    if (!parsed.success) throw new ModelError('schema', 'the planner reply was not a chat completion');
    usedModel = parsed.data.model ?? model;
    return parsed.data.choices[0]!.message;
  };

  let message = await post(true);
  for (let round = 0; round < MAX_ROUNDS && message.tool_calls?.length && toolCalls < MAX_TOOL_CALLS; round++) {
    messages.push({ role: 'assistant', content: message.content ?? null, tool_calls: message.tool_calls });
    for (const call of message.tool_calls) {
      toolCalls++;
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.function.arguments) as Record<string, unknown>;
      } catch {
        /* an unreadable call is answered with an error, below */
      }
      let content: unknown;
      const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
      if (call.function.name === 'try_plan' && PATH_LETTERS.includes(args.path as Letter)) {
        const r = runPlan(req, { path: args.path as Letter, contractPercent: num(args.contractPercent, 100), pricePercent: num(args.pricePercent, 0) });
        steps.push({ tool: 'try_plan', args, results: [r] });
        content = forModel(r);
      } else if (call.function.name === 'compare_all') {
        const rs = req.paths.map((p) =>
          runPlan(req, { path: p.letter, contractPercent: hasContract(req, p.letter) ? num(args.contractPercent, 100) : 100, pricePercent: num(args.pricePercent, 0) }),
        );
        steps.push({ tool: 'compare_all', args, results: rs });
        const best = safest(rs.map((r) => ({ id: r.path, lowest: { cash: r.lowestCash, month: r.lowestMonth }, runsOut: r.runsOutMonth, endCash: r.endCash })));
        content = { results: rs.map(forModel), safest: best };
      } else {
        content = { error: 'Unknown tool or bad arguments. Use try_plan or compare_all with the documented arguments.' };
      }
      messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(content) });
    }
    message = await post(toolCalls < MAX_TOOL_CALLS && round < MAX_ROUNDS - 1);
  }

  // The final answer: settings only. If the model ended on a tool call, ask once more for the answer.
  let text = message.content ?? '';
  if (!text.trim() || message.tool_calls?.length) {
    messages.push({ role: 'user', content: 'Reply now with the JSON answer only.' });
    text = (await post(false)).content ?? '';
  }
  let named: PlanSettings[] = [];
  let note = '';
  try {
    const parsed = finalAnswer.safeParse(JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)));
    if (parsed.success) {
      named = parsed.data.plans;
      note = /\d/.test(parsed.data.note) ? '' : parsed.data.note.trim();
    }
  } catch {
    /* no usable answer: fall back to the best the tools showed */
  }
  // Code reruns every plan the model named, and keeps only those that really meet the goal.
  const checked = rank(named.map((s) => runPlan(req, s))).filter((r) => r.meetsGoal);
  const tried = rank(steps.flatMap((s) => s.results));
  const found = onePerPath(checked.length ? checked : tried.filter((r) => r.meetsGoal)).slice(0, 3);
  return { mode: 'model', steps, found, closest: found.length ? null : (tried[0] ?? null), note, model: usedModel, calls };
}
