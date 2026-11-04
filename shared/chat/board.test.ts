import { describe, expect, it } from 'vitest';
import { boardRequest, buildModeratorPrompt, moderateBoard, withoutNumbers } from './board.js';
import type { Deps, MetaConfig } from '../providers/meta.js';

const replies = [
  { letter: 'A' as const, name: 'Stay lean', text: 'Cash never ran out for me, but growth was slow.' },
  { letter: 'B' as const, name: 'Take it as offered', text: 'The late months nearly broke us.' },
  { letter: 'C' as const, name: 'Take it on safer terms', text: 'Renting the equipment kept a cushion.' },
];
const cfg = { apiKey: 'k', baseUrl: 'https://model.example/v1', models: ['muse-spark-1.3'] } as unknown as MetaConfig;
const scripted = (reply: unknown, seen: string[] = []): Deps => ({
  fetch: async (_url, init) => {
    seen.push(String(init.body));
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(reply) } }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  },
  sleep: async () => {},
  now: () => 0,
  random: () => 0,
});

describe('the board moderator', () => {
  it('keeps only sentences without a digit: figures belong to the engine', () => {
    expect(withoutNumbers(['They agree cash was tight.', 'B fell to R7 000 in month 4.', ' '])).toEqual({ kept: ['They agree cash was tight.'], dropped: 1 });
  });

  it('drops any numbered sentence from a real reply and counts it', async () => {
    const out = await moderateBoard(
      cfg,
      boardRequest.parse({ kind: 'board', question: 'What would you warn me about?', replies }),
      scripted({ agree: ['All three worry about late payers.'], differ: ['B ran out in month 4.', 'A grew slowest.'], ask: 'How long can you wait to be paid?' }),
    );
    expect(out.agree).toEqual(['All three worry about late payers.']);
    expect(out.differ).toEqual(['A grew slowest.']);
    expect(out.dropped).toBe(1);
    expect(out.ask).toBe('How long can you wait to be paid?');
  });

  it('asks for the reply in the founder\'s language, and only then', () => {
    const zu = buildModeratorPrompt(boardRequest.parse({ kind: 'board', question: 'Q?', replies, language: 'zu' }));
    expect(zu.system).toContain('isiZulu');
    const en = buildModeratorPrompt(boardRequest.parse({ kind: 'board', question: 'Q?', replies }));
    expect(en.system).not.toMatch(/isiZulu|Write your reply in/);
  });

  it('refuses a board with fewer than two answers or an unknown language', () => {
    expect(boardRequest.safeParse({ kind: 'board', question: 'Q?', replies: replies.slice(0, 1) }).success).toBe(false);
    expect(boardRequest.safeParse({ kind: 'board', question: 'Q?', replies, language: 'xx' }).success).toBe(false);
  });
});
