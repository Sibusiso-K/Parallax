import { z } from 'zod';
import { chatJson, type Deps, type MetaConfig } from '../providers/meta.js';
import type { Lens } from '../engine/compare.js';

// A what-if in the founder's own words ("what if they pay late and I put prices up 10%?") read into the futures
// screen's three levers. The model only picks lever positions the founder named; it never sees or writes a figure,
// and the engine reruns the futures from the levers. In demo mode, or if the model fails, a plain reader in code does
// the same job for the common phrasings.

export const CONTRACT_STEPS = [25, 50, 75, 100, 125, 150] as const;
export const PRICE_STEPS = [-10, -5, 0, 5, 10, 15, 20] as const;

export const whatIfRequest = z.object({
  text: z.string().trim().min(3, 'Say a what-if, like “what if they pay late?”').max(300, 'Keep the what-if under 300 characters.'),
});

/** What the model returns: only the levers the founder mentioned; null for the rest. */
export const leverReply = z.object({
  latePayment: z.boolean().nullable(),
  contractPercent: z.number().int().nullable(),
  pricePercent: z.number().int().nullable(),
  /** True when the what-if names something the levers cannot express, such as a new hire or a loan. */
  outOfScope: z.boolean(),
});
export type LeverReply = z.infer<typeof leverReply>;

/** The result the browser applies: changes to the current lens, and what was understood. */
export interface WhatIfResult {
  changes: Partial<Lens>;
  /** Asked for something the three levers cannot show. */
  outOfScope: boolean;
  /** A value was asked for beyond the slider's range, so it was set to the nearest end. */
  clamped: boolean;
}

const snap = (n: number, steps: readonly number[]): { value: number; clamped: boolean } => {
  const lo = steps[0]!;
  const hi = steps[steps.length - 1]!;
  const clamped = n < lo || n > hi;
  const within = Math.min(hi, Math.max(lo, n));
  const value = steps.reduce((best, s) => (Math.abs(s - within) < Math.abs(best - within) ? s : best), steps[0]!);
  return { value, clamped };
};

/** Turns lever positions into lens changes, kept on the sliders' own steps. */
export function toResult(reply: LeverReply): WhatIfResult {
  const changes: Partial<Lens> = {};
  let clamped = false;
  if (reply.latePayment !== null) changes.latePayment = reply.latePayment;
  if (reply.contractPercent !== null) {
    const s = snap(reply.contractPercent, CONTRACT_STEPS);
    changes.contractScale = s.value / 100;
    clamped ||= s.clamped;
  }
  if (reply.pricePercent !== null) {
    const s = snap(reply.pricePercent, PRICE_STEPS);
    changes.pricePercent = s.value;
    clamped ||= s.clamped;
  }
  return { changes, outOfScope: reply.outOfScope, clamped };
}

const NUM = String.raw`(\d{1,3})\s*(?:%|percent|per\s*cent)`;
/** The plain reader: common phrasings only. Used in demo mode, and when the model cannot be reached. */
export function readInCode(text: string): LeverReply {
  const t = text.toLowerCase();
  let latePayment: boolean | null = null;
  if (/\b(on time|pays? (promptly|on time)|no (delay|late))\b/.test(t)) latePayment = false;
  else if (/\b(late|delay(ed|s)?|slow(ly)? to pay|pays? (later|slowly)|doesn'?t pay)\b/.test(t)) latePayment = true;

  let pricePercent: number | null = null;
  const priceNum = t.match(new RegExp(String.raw`(?:price|prices|charge|charging|rates?)[^.,;]*?${NUM}|${NUM}[^.,;]*?(?:price|prices|more|higher|lower|less|cheaper|dearer)`));
  if (priceNum) {
    const n = Number(priceNum[1] ?? priceNum[2]);
    const down = /\b(cut|lower|drop|reduce|less|cheaper|discount|down)\b/.test(t.slice(Math.max(0, (priceNum.index ?? 0) - 25), (priceNum.index ?? 0) + priceNum[0].length + 10));
    pricePercent = down ? -n : n;
  } else if (/\b(keep|same|don'?t (raise|change)) (my )?prices?\b/.test(t)) pricePercent = 0;

  let contractPercent: number | null = null;
  const contractNum = t.match(new RegExp(String.raw`contract[^.,;]*?${NUM}|${NUM}[^.,;]*?contract`));
  if (contractNum) contractPercent = Number(contractNum[1] ?? contractNum[2]);
  else if (/\bhalf (the|a|of the)? ?(size|contract|order)|contract (is |was )?halved|half[- ]size\b/.test(t)) contractPercent = 50;
  else if (/\b(double|twice) (the )?(contract|order)|contract (is |was )?doubled\b/.test(t)) contractPercent = 200;
  else if (/\b(bigger|larger) (contract|order)\b/.test(t)) contractPercent = 125;
  else if (/\b(smaller) (contract|order)\b/.test(t)) contractPercent = 75;

  const outOfScope = /\b(hire|loan|borrow|invest(or|ment)?|sell the business|new (staff|branch|location))\b/.test(t);
  return { latePayment, contractPercent, pricePercent, outOfScope };
}

const SYSTEM = `You turn a small-business founder's "what if" into positions for three levers on a cash forecast.
The levers:
- latePayment: true if they ask what happens when a big client pays late; false if they ask about the client paying on time; null if not mentioned.
- contractPercent: the new contract's size as a percent of what was offered (100 = as offered, 50 = half, 150 = half again). null if not mentioned.
- pricePercent: a change in their prices, in percent (10 = prices up 10%, -5 = down 5%). null if not mentioned.
- outOfScope: true if they ask about anything these levers cannot show (a hire, a loan, a new branch, a different client).
Only set a lever the founder clearly named. A price rise or cut with no amount is 10 or -10; a bigger or smaller contract with no amount is 125 or 75.
Reply with JSON only.`;

/** Reads a what-if with Muse Spark. The founder's words are the only input; no figures are sent. */
export async function readWithModel(cfg: MetaConfig, text: string, deps?: Deps): Promise<{ result: WhatIfResult; model: string; latencyMs: number }> {
  const { value, trace } = await chatJson(cfg, { name: 'whatif', system: SYSTEM, user: `What if: ${text}`, schema: leverReply, timeoutMs: 20_000 }, deps);
  return { result: toResult(value), model: trace.model, latencyMs: trace.latencyMs };
}
