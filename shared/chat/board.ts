import { z } from 'zod';
import { chatJson, type Deps, type MetaConfig } from '../providers/meta.js';
import { LANGUAGE_CODES, replyInLine } from './languages.js';

// The board meeting: the founder asks one question, each future self (A, B and C) answers it from its own path through
// the usual future-self chat and figure guard, and then a moderator reads the three answers and says where they agree
// and where they differ. The moderator never states a figure: it may refer to what a future said, but any sentence of
// its own with a digit in it is dropped by code, so every number on screen still comes from the engine.

export const boardRequest = z.object({
  kind: z.literal('board'),
  question: z.string().trim().min(1, 'Ask the board something.').max(1000, 'Keep the question under 1,000 characters.'),
  replies: z
    .array(z.object({ letter: z.enum(['A', 'B', 'C']), name: z.string().min(1).max(120), text: z.string().min(1).max(2000) }))
    .min(2)
    .max(3),
  language: z.enum(LANGUAGE_CODES as [string, ...string[]]).optional(),
});
export type BoardRequest = z.infer<typeof boardRequest>;

const moderatorReply = z.object({
  agree: z.array(z.string().min(1).max(300)).max(3),
  differ: z.array(z.string().min(1).max(300)).max(4),
  /** The one question the founder should still answer for themselves. */
  ask: z.string().max(300),
});

export interface BoardSummary {
  agree: string[];
  differ: string[];
  ask: string;
  /** Sentences the moderator wrote with a number in them, removed by code. */
  dropped: number;
  model: string;
  latencyMs: number;
}

/** Keeps the moderator's sentences that carry no digit. Numbers belong to the engine and the futures, not the moderator. */
export function withoutNumbers(lines: string[]): { kept: string[]; dropped: number } {
  const kept: string[] = [];
  let dropped = 0;
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (/\d/.test(t)) dropped++;
    else kept.push(t);
  }
  return { kept, dropped };
}

export function buildModeratorPrompt(req: BoardRequest): { system: string; user: string } {
  const system = [
    'You chair a short board meeting between three possible futures of one founder, 36 months from now. Each future took a different path (A, B, C) and has already answered the founder\'s question.',
    'Say where the futures agree, and where they differ, in plain words. Refer to them as A, B and C, or by their path names.',
    'Rules:',
    '1. Never write a number, amount, percentage, month or date. Say "the late months" or "when cash was tightest", not a figure. Any sentence with a digit is deleted.',
    '2. Do not choose for the founder or rank the paths. Give no financial, legal or tax advice.',
    '3. Each line is one short sentence. At most 3 agreements and 4 differences.',
    '4. "ask" is the one question the founder should still answer for themselves.',
    replyInLine(req.language as never),
    'Reply as JSON: {"agree": ["..."], "differ": ["..."], "ask": "..."}.',
  ]
    .filter(Boolean)
    .join('\n');
  const user = [`The founder asked: ${req.question}`, '', ...req.replies.map((r) => `Future ${r.letter} (${r.name}) answered:\n${r.text}`)].join('\n\n');
  return { system, user };
}

export async function moderateBoard(cfg: MetaConfig, req: BoardRequest, deps?: Deps): Promise<BoardSummary> {
  const { system, user } = buildModeratorPrompt(req);
  const { value, trace } = await chatJson(cfg, { name: 'board', system, user, schema: moderatorReply, timeoutMs: 25_000 }, deps);
  const agree = withoutNumbers(value.agree);
  const differ = withoutNumbers(value.differ);
  const ask = withoutNumbers([value.ask]);
  return {
    agree: agree.kept,
    differ: differ.kept,
    ask: ask.kept[0] ?? '',
    dropped: agree.dropped + differ.dropped + ask.dropped,
    model: trace.model,
    latencyMs: trace.latencyMs,
  };
}
