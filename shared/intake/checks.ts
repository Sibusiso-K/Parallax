import za from '../defaults/za.json' with { type: 'json' };
import { formatRand } from './amount.js';
import { moneyKeys, type Extraction, type FieldKey } from './schema.js';

// F4 faulty-input checks, run in code before anything is simulated (SCOPE section 5). They only ask: a flagged value is
// shown back and the founder confirms it. Nothing here changes a value (F4: questioned, never silently fixed).

export type IssueKind =
  | 'vague-decision'
  | 'under-age'
  | 'impossible-age'
  | 'outlier'
  | 'contradiction'
  | 'out-of-scope'
  | 'not-supported'
  | 'advice';

export interface Issue {
  kind: IssueKind;
  message: string;
  field?: FieldKey;
  /** For an outlier that looks like a misplaced decimal point: the figure to confirm. */
  suggestion?: number;
  /** A blocking issue stops the simulation until the founder changes the decision. */
  blocking: boolean;
}

const OUT_OF_SCOPE: [RegExp, string][] = [
  [
    /\b(surgery|diagnos\w*|medication|hospital|therapy|depression|pregnan\w*|my health)\b/i,
    'Health decisions are outside what Parallax covers. A doctor or health professional can help.',
  ],
  [/\b(break ?up|divorce|get married|marry my|wedding)\b/i, 'Relationship decisions are outside what Parallax covers.'],
  [/\b(sue|lawsuit|court case|criminal case|arrested|custody|lawyer|attorney)\b/i, 'Legal decisions are outside what Parallax covers. A lawyer can help.'],
  [/\b(emigrat\w*|immigrat\w*|move abroad|move overseas|leave the country)\b/i, 'Emigration is outside what Parallax covers.'],
];

const COVERED = 'Parallax covers big contracts, hires and price rises for now.';
const NOT_SUPPORTED: [RegExp, string][] = [
  [
    /\b(loans?|borrow\w*|overdraft|investors?|raise (?:money|capital|funding|a round)|funding round|equity|venture capital|angel invest\w*)\b/i,
    `Funding decisions (loans and investors) are not supported yet. ${COVERED}`,
  ],
  [
    /\b(second (?:shop|store|branch|location|site|kitchen)|new (?:branch|location|site)|open(?:ing)? another|expand(?:ing)? (?:to|into)|franchis\w*)\b/i,
    `Opening a second site or a new market is not supported yet. ${COVERED}`,
  ],
  [
    /\b(?:quit(?:ting)?|resign(?:ing)?(?: from)?|leav(?:e|ing)) (?:my|the) job\b/i,
    `Going full-time on a business is not supported yet. ${COVERED}`,
  ],
];

const ADVICE = /\b(crypto\w*|bitcoin|etf|stock market|invest (in|my savings)|put my savings (in|into))\b/i;

// "I'm 27", "aged 16", "I'm 27 years old". Not "I'm 3 years into this" or "I'm 2 jobs".
const AGE = /\b(?:I[’']?m|I am|aged?)\s+(\d{1,3})(?:\s+years?\s+old)?\b(?!\s*(?:%|k\b|years?\b|jobs?|kids?|children|people|staff|employees|months?))/i;

const wordCount = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

/** Runs the F4 checks on the decision text and on the fields extracted from it. */
export function checkIntake(text: string, ex: Extraction): Issue[] {
  const issues: Issue[] = [];
  if (!ex.decision && wordCount(text) < 6) {
    issues.push({
      kind: 'vague-decision',
      blocking: false,
      message: 'What decision are you weighing up? Say it in your own words, or pick one: a big contract, a hire or a price rise.',
    });
  }
  const age = AGE.exec(text);
  if (age) {
    const years = Number(age[1]);
    if (years < 18) issues.push({ kind: 'under-age', blocking: true, message: 'Parallax is for people aged 18 and over.' });
    else if (years > 100) issues.push({ kind: 'impossible-age', blocking: false, message: `Is ${years} really your age? Please confirm it.` });
  }
  // Scope is judged on the decision itself when we have it, so a story that mentions a van loan or the company lawyer
  // in passing is not blocked. Without an extracted decision, the whole text is the decision.
  const subject = [ex.decision?.value, ex.decision?.quote].filter(Boolean).join(' ') || text;
  for (const [re, message] of OUT_OF_SCOPE) {
    if (re.test(subject)) issues.push({ kind: 'out-of-scope', blocking: true, message });
  }
  for (const [re, message] of NOT_SUPPORTED) {
    if (re.test(subject)) issues.push({ kind: 'not-supported', blocking: true, message });
  }
  if (ADVICE.test(text)) {
    issues.push({ kind: 'advice', blocking: false, message: 'Parallax does not give investment advice. It can help you think through your own choice.' });
  }
  for (const key of moneyKeys) {
    const field = ex[key];
    const cap = za.caps[key];
    if (!field || field.high <= cap) continue;
    const tenth = field.high / 10;
    const per = key === 'cash' || key === 'upfrontCost' ? '' : ' a month';
    if (tenth >= cap / 10 && tenth <= cap) {
      issues.push({ kind: 'outlier', field: key, suggestion: tenth, blocking: false, message: `Did you mean ${formatRand(tenth)}? Please confirm the amount.` });
    } else {
      issues.push({ kind: 'outlier', field: key, blocking: false, message: `${formatRand(field.high)}${per} is far above what Parallax expects. Please confirm it.` });
    }
  }
  const { revenue, directCosts } = ex;
  if (revenue && directCosts && revenue.high > 0 && directCosts.low > revenue.high) {
    issues.push({
      kind: 'contradiction',
      field: 'directCosts',
      blocking: false,
      message: `Your direct costs (${formatRand(directCosts.low)} a month) are more than your sales (${formatRand(revenue.high)} a month). Is that right?`,
    });
  }
  return issues;
}
