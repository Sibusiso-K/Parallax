import { z } from 'zod';
import { chatJson, type Deps, type MetaConfig } from '../providers/meta.js';

// The self-check on intake: a second Muse Spark pass that compares what was read with the founder's own story and
// flags contradictions ("you said R90k a month here, and R60k later"). It runs in the background once the figures are
// on screen, so it never slows the first read. Its notes are questions for the founder, never changes: nothing is
// edited by it. A note may repeat only numbers the founder wrote or that are on screen; any other number drops it.

export const checkRequest = z.object({
  check: z.literal(true),
  text: z.string().trim().min(1).max(4000),
  fields: z
    .array(z.object({ key: z.string().min(1).max(40), label: z.string().min(1).max(80), value: z.string().max(300), quote: z.string().max(400).optional() }))
    .min(1)
    .max(24),
});
export type CheckRequest = z.infer<typeof checkRequest>;

const checkReply = z.object({
  issues: z.array(z.object({ field: z.string().max(40), message: z.string().min(1).max(280) })).max(4),
});

export interface CheckNote {
  field: string;
  label: string;
  message: string;
}
export interface CheckResult {
  notes: CheckNote[];
  /** Notes dropped by code: an unknown field, or a number the founder never wrote. */
  dropped: number;
  model: string;
  latencyMs: number;
}

/** Every number in a text, as written, without spaces or commas: "R90 000" and "90,000" both give 90000. */
export function numbersIn(text: string): number[] {
  return [...text.matchAll(/\d[\d ,]*(?:\.\d+)?/g)].map((m) => Number(m[0].replace(/[ ,]/g, ''))).filter((n) => Number.isFinite(n));
}

/** Keeps a note only if it names a field on screen and every number in it was written by the founder or shown. */
export function keepNotes(req: CheckRequest, issues: { field: string; message: string }[]): { notes: CheckNote[]; dropped: number } {
  const labels = new Map(req.fields.map((f) => [f.key, f.label]));
  const known = new Set([...numbersIn(req.text), ...req.fields.flatMap((f) => numbersIn(`${f.value} ${f.quote ?? ''}`))]);
  // "90k" in a story is 90 000 on screen; let either form through.
  for (const m of req.text.matchAll(/(\d+(?:\.\d+)?)\s*k\b/gi)) known.add(Math.round(Number(m[1]) * 1000));
  const notes: CheckNote[] = [];
  let dropped = 0;
  for (const i of issues) {
    const label = labels.get(i.field);
    // Small counts (up to 12, such as "3 months") are allowed; any larger number must be the founder's own.
    const ok = label !== undefined && numbersIn(i.message).every((n) => known.has(n) || n < 13);
    if (ok) notes.push({ field: i.field, label: label!, message: i.message.trim() });
    else dropped++;
  }
  return { notes, dropped };
}

const SYSTEM = [
  'You double-check a reading of a founder\'s story. You get the story and the figures read from it, each with the founder\'s quoted words.',
  'Flag only real problems: a figure that does not match the story, a figure read from the wrong part of the story, a monthly amount read as yearly or the other way round, or two parts of the story that disagree with each other.',
  'Do not flag missing information, style, or anything you are unsure of. If the reading is consistent, return no issues.',
  'Each message is one short, plain question or note to the founder, in English, quoting their words where it helps. Use only numbers that appear in the story or the figures.',
  'Name the field by its key.',
  'Reply as JSON: {"issues": [{"field": "revenue", "message": "..."}]}.',
].join('\n');

export async function checkIntake(cfg: MetaConfig, req: CheckRequest, deps?: Deps): Promise<CheckResult> {
  const fields = req.fields.map((f) => `${f.key} (${f.label}): ${f.value}${f.quote ? ` — from "${f.quote}"` : ''}`).join('\n');
  const user = `STORY:\n"""${req.text}"""\n\nREAD FROM IT:\n${fields}`;
  const { value, trace } = await chatJson(cfg, { name: 'intake_check', system: SYSTEM, user, schema: checkReply, timeoutMs: 25_000 }, deps);
  const { notes, dropped } = keepNotes(req, value.issues);
  return { notes, dropped, model: trace.model, latencyMs: trace.latencyMs };
}
