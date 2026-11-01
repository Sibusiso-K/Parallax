import za from '../defaults/za.json' with { type: 'json' };
import { formatRand } from './amount.js';
import type { Extraction, FieldKey } from './schema.js';

// F4 faulty-input checks, run in code before anything is simulated (SCOPE section 5). They only ask: a flagged value is
// shown back and the person confirms it. Nothing here changes a value (F4: questioned, never silently fixed).

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
  /** A blocking issue stops the simulation until the person changes the decision. */
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

const NOT_SUPPORTED: [RegExp, string][] = [
  [/\b(loan|borrow\w*|car finance|vehicle finance|home loan)\b/i, 'Loan decisions are not supported yet. Parallax covers career and money paths for now.'],
  [/\b(move|relocat\w*) (to|city)\b/i, 'Moving city is not supported yet.'],
];

const ADVICE = /\b(crypto\w*|bitcoin|etf|stock market|invest (in|my savings)|put my savings (in|into))\b/i;

// "I'm 27", "aged 16", "I'm 27 years old". Not "I'm 3 years into this" or "I'm 2 jobs".
const AGE = /\b(?:I[’']?m|I am|aged?)\s+(\d{1,3})(?:\s+years?\s+old)?\b(?!\s*(?:%|k\b|years?\b|jobs?|kids?|children|people|staff|employees|months?))/i;

const MONEY_KEYS = ['takeHome', 'sideIncome', 'essentialExpenses', 'familySupportMonthly', 'debtRepayments', 'savings'] as const;

const wordCount = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

/** Runs the F4 checks on the decision text and on the fields extracted from it. */
export function checkIntake(text: string, ex: Extraction): Issue[] {
  const issues: Issue[] = [];
  if (!ex.decision && wordCount(text) < 6) {
    issues.push({
      kind: 'vague-decision',
      blocking: false,
      message: 'What decision are you weighing up? Say it in your own words, or start from one of the three paths.',
    });
  }
  const age = AGE.exec(text);
  if (age) {
    const years = Number(age[1]);
    if (years < 18) issues.push({ kind: 'under-age', blocking: true, message: 'Parallax is for people aged 18 and over.' });
    else if (years > 100) issues.push({ kind: 'impossible-age', blocking: false, message: `Is ${years} really your age? Please confirm it.` });
  }
  for (const [re, message] of OUT_OF_SCOPE) {
    if (re.test(text)) issues.push({ kind: 'out-of-scope', blocking: true, message });
  }
  for (const [re, message] of NOT_SUPPORTED) {
    if (re.test(text)) issues.push({ kind: 'not-supported', blocking: true, message });
  }
  if (ADVICE.test(text)) {
    issues.push({ kind: 'advice', blocking: false, message: 'Parallax does not give investment advice. It can help you think through your own choice.' });
  }
  for (const key of MONEY_KEYS) {
    const field = ex[key];
    const cap = za.caps[key];
    if (!field || field.high <= cap) continue;
    const tenth = field.high / 10;
    if (tenth >= cap / 10 && tenth <= cap) {
      issues.push({ kind: 'outlier', field: key, suggestion: tenth, blocking: false, message: `Did you mean ${formatRand(tenth)}? Please confirm the amount.` });
    } else {
      issues.push({ kind: 'outlier', field: key, blocking: false, message: `${formatRand(field.high)} a month is far above what Parallax expects. Please confirm it.` });
    }
  }
  const takeHome = ex.takeHome;
  if (takeHome) {
    const fixed = (ex.essentialExpenses?.low ?? 0) + (ex.familySupportMonthly?.low ?? 0) + (ex.debtRepayments?.low ?? 0);
    if (fixed > 5 * takeHome.high) {
      issues.push({
        kind: 'contradiction',
        field: 'essentialExpenses',
        blocking: false,
        message: `Your fixed costs (${formatRand(fixed)} a month) are more than five times your take-home pay. Is that right?`,
      });
    }
  }
  return issues;
}
