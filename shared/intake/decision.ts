import type { DecisionType } from './schema.js';

// Which decision template fits (SCOPE.md §2). Code reads it from the founder's own words, so the choice repeats for the
// same text and the quote check (verify.ts) still applies: the matched words are the quote.
// A text that names two kinds ("Should I hire a cook to take the contract?") is not guessed at: the founder is asked which.
const PATTERNS: [DecisionType, RegExp][] = [
  ['contract', /\b(contract|tender|big (?:order|client|customer|job)|corporate client|purchase order)\b/i],
  [
    'pricing',
    /\b(rais(?:e|ing) (?:my |our |the )?prices?|price (?:rise|increase|hike)|put (?:my |our )?prices up|charg(?:e|ing) more|increas(?:e|ing) (?:my |our |the )?prices?)\b/i,
  ],
  ['hire', /\b(hire|hiring|employ(?:ing)? (?:a|an|my|our|someone)|first employee|take on (?:staff|someone|somebody)|recruit\w*)\b/i],
];

/** The decision type and the words that showed it. Null when the text names none of the three, or more than one. */
export function detectDecision(text: string): { value: DecisionType; quote: string } | null {
  const found = PATTERNS.flatMap(([value, re]) => {
    const m = re.exec(text);
    return m ? [{ value, quote: m[0] }] : [];
  });
  return found.length === 1 ? found[0]! : null;
}

// Short answers to the follow-up question ("contract", "a hire", "prices").
const SHORT: [DecisionType, RegExp][] = [
  ['contract', /contract|order|tender|client/i],
  ['hire', /hir|staff|employ/i],
  ['pricing', /pric/i],
];

export function parseDecisionAnswer(answer: string): DecisionType | null {
  return detectDecision(answer)?.value ?? SHORT.find(([, re]) => re.test(answer))?.[0] ?? null;
}
