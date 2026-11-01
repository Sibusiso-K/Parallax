import type { DecisionType } from './schema.js';

// Which decision template fits (SCOPE.md §2). Code reads it from the founder's own words, so the choice repeats for the
// same text and the quote check (verify.ts) still applies: the matched words are the quote.
// Order matters: "Should I hire a cook to take the contract?" is a contract decision, with the hire inside its paths.
const PATTERNS: [DecisionType, RegExp][] = [
  ['contract', /\b(contract|tender|big (?:order|client|customer|job)|corporate client|new client|purchase order)\b/i],
  [
    'pricing',
    /\b(rais(?:e|ing) (?:my |our |the )?prices?|price (?:rise|increase|hike)|put (?:my |our )?prices up|charg(?:e|ing) more|increas(?:e|ing) (?:my |our |the )?prices?)\b/i,
  ],
  ['hire', /\b(hire|hiring|employ(?:ing)? (?:a|an|my|our|someone)|first employee|take on (?:staff|someone|a|an)|recruit\w*)\b/i],
];

/** The decision type and the words that showed it, or null if the text names none of the three. */
export function detectDecision(text: string): { value: DecisionType; quote: string } | null {
  for (const [value, re] of PATTERNS) {
    const m = re.exec(text);
    if (m) return { value, quote: m[0] };
  }
  return null;
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
