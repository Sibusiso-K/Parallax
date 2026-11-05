// Figure guard (F11): the only way a number reaches the person from a model.
// The model writes {{fig:<key>}} placeholders. Code substitutes the engine's value under the right unit.
// Every other amount, percentage or large number the model typed is replaced, so a model can never
// attach a real-looking figure to the wrong metric, month or path. It fails closed: if the guard itself
// throws, the text is withheld. Pure and deterministic; checks hold keys and counts, never the text.

export type FigureTable = Record<string, number>;

export interface GuardContext {
  /** The path this reply belongs to. Keys of any other path are refused (path isolation, F13). */
  pathId: string;
  /**
   * Extra paths whose keys may be quoted, for the advisor only (a server-built allowlist). Default: just `pathId`.
   * The table must already contain only those paths' figures.
   */
  allowedPathIds?: readonly string[];
  /** figureTable(path) for that path. */
  table: FigureTable;
  /** Numbers the person typed themselves (income, savings...). These may be repeated back. */
  userNumbers?: readonly number[];
  /** Assumption and event IDs that exist on this path, such as "A7". Other IDs are dropped. */
  allowedIds?: readonly string[];
}

export type CheckType = 'substituted' | 'unknown_key' | 'wrong_path' | 'bad_value' | 'scrubbed' | 'dropped_id' | 'certainty' | 'advice' | 'false_month' | 'withheld';

export interface Check {
  type: CheckType;
  detail?: string;
}

export interface GuardResult {
  text: string;
  /** True only when nothing had to be repaired: no unknown key, no scrubbed number, no dropped ID, no certainty phrase. */
  clean: boolean;
  withheld: boolean;
  checks: Check[];
}

export const SEE_CHART = '(see chart)';
export const WITHHELD_TEXT = 'I could not check that answer against your numbers, so I am not showing it. Please ask again.';

const PLACEHOLDER = /\{\{\s*fig:([^}\s]*)\s*\}\}/g;

// Certainty the engine cannot back (RISKS S3), and telling a founder what to decide. The sentence is removed: a flag alone still reached the founder.
const CERTAINTY = /\b(guaranteed?|definitely will|certainly will|will definitely|you will (?:be|have|earn|save|make|survive|succeed|never)|(?:you|we|it|this business|the business|your business) (?:will|won'?t) (?:survive|succeed|thrive|fail|make it|be fine|be okay)|risk[- ]free|no risk|no chance of (?:failure|failing|losing)|can'?t (?:fail|lose)|cannot (?:fail|lose)|i promise)\b/i;
const DECIDING = '(?:take|sign|accept|borrow|reject|decline|refuse|invest|buy|sell|quit|hire|fire|choose|pick|walk away)';
const ADVICE = new RegExp(`\\byou\\s+(?:should|must|need to|have to|ought to|had better)\\s+(?:definitely\\s+|just\\s+)?${DECIDING}\\b|\\b(?:i|we)\\s+(?:advise|recommend|urge|suggest)\\s+(?:that\\s+)?you\\b|^\\s*${DECIDING}\\b`, 'i');

const WORD_NUMBER =
  /\b(?:(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|a|several)[\s-]+)*(?:hundred|thousand|million|billion)\b(?:\s+rand)?/gi;
const CURRENCY = /-?\b(?:ZAR|R)\s?(?:\d{1,3}(?:[ ,]\d{3})+|\d+)(?:\.\d+)?(?:\s?(?:k|m|million|thousand|billion)\b)?/gi;
// The model horizon is 36 months. A month past it is a figure the engine never computed.
const LAST_MONTH = 36;
const PAST_HORIZON_WORDS = /\bmonths?\s+(?:thirty[-\s](?:seven|eight|nine)|forty|fifty|sixty|seventy|eighty|ninety|(?:a\s+|one\s+)?hundred)(?:[-\s](?:one|two|three|four|five|six|seven|eight|nine))?\b/gi;
// A user's own number may be repeated back, but never as a claim about projected cash: its sign and meaning could be wrong.
const CASH_CLAIM = /\b(?:projected|projection|forecast|cash|balance|lowest|shortfall|runway)\b/i;

/** Any Unicode decimal digit becomes its ASCII digit, and invisible characters go, so digits cannot be disguised from the checks below. */
export function plainDigits(raw: string): string {
  // NFKC folds superscripts, circled digits and full-width forms into plain ones. Other scripts are mapped below.
  return raw.normalize('NFKC').replace(/[\u200B-\u200D\u2060\uFEFF\u00AD]/g, '').replace(/\p{Nd}/gu, ch => {
    if (ch >= '0' && ch <= '9') return ch;
    // Unicode keeps decimal digits in contiguous runs from zero, so walking back to the start of the run gives the value.
    let code = ch.codePointAt(0)!, value = 0;
    while (/\p{Nd}/u.test(String.fromCodePoint(code - 1)) && value < 49) { code--; value++; }
    return String(value % 10);
  });
}

/** True when a sentence names one month but its figures belong to another: "Cash in month 2 is {{fig:...m1}}". */
export function namesWrongMonth(sentence: string): boolean {
  const named = [...new Set([...sentence.matchAll(/\bmonth\s+(\d{1,2})\b/gi)].map(m => Number(m[1])))];
  if (named.length !== 1) return false;
  const held = [...sentence.matchAll(/\{\{\s*fig:[^}\s]*\.m(\d{1,2})(?:\.[^}\s]*)?\s*\}\}/g)].map(m => Number(m[1]));
  return held.length > 0 && held.every(month => month !== named[0]);
}
const PERCENT = /\d+(?:\.\d+)?\s?(?:%|percent\b|per cent\b)/gi;
const SUFFIXED = /\b\d+(?:\.\d+)?\s?(?:k|m)\b/gi;
const BIG_NUMBER = /\b\d{1,3}(?:[ ,]\d{3})+\b|\b\d{4,}\b/g;

// Keys whose value is a month number, not rand: lowestMonth, milestone.<id>.<case>, runway, setback.<id>.runsOut and
// setback.late-payment.paidFromMonth. A month printed as rand ("R5" instead of "month 5") is a figure the engine did
// not compute, so every month-valued key must be named here.
const MONTH_KEY = /\.(?:worstMonth|lowestMonth|milestone\.[^.]+|runway)(?:\.|$)|\.setback\.[^.]+\.(?:runsOut|paidFromMonth)$/;

const groupThousands = (n: number): string => Math.abs(Math.round(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export function formatRand(n: number): string {
  return `${n < 0 ? '-' : ''}R${groupThousands(n)}`;
}

export function formatFigure(key: string, value: number): string {
  if (/\.runway$/.test(key)) return `${Math.round(value)} months`;
  if (MONTH_KEY.test(key)) return `month ${Math.round(value)}`;
  return formatRand(value);
}

const isYear = (digits: string): boolean => digits.length === 4 && Number(digits) >= 1900 && Number(digits) <= 2100;

const numericValue = (token: string): number | null => {
  const m = token.replace(/[ ,]/g, '').match(/-?\d+(?:\.\d+)?/);
  return m ? Math.abs(Number(m[0])) : null;
};

function guardInner(input: string, ctx: GuardContext): GuardResult {
  const checks: Check[] = [];
  let clean = true;
  // 0. Undisguise digits, then drop any sentence whose words and figure disagree about the month, or that decides for the founder.
  const raw = plainDigits(input).split(/(?<=[.!?])\s+/).filter(sentence => {
    const refused: CheckType | null = namesWrongMonth(sentence) ? 'false_month' : ADVICE.test(sentence) ? 'advice' : CERTAINTY.test(sentence) ? 'certainty' : null;
    if (!refused) return true;
    checks.push({ type: refused });
    clean = false;
    return false;
  }).join(' ');
  const user = new Set((ctx.userNumbers ?? []).map(n => Math.abs(n)));
  const ids = new Set(ctx.allowedIds ?? []);
  const allowed = ctx.allowedPathIds ?? [ctx.pathId];

  // 1. Swap placeholders for sentinels so their values are not treated as stray numbers in step 2.
  const resolved: string[] = [];
  let text = raw.replace(PLACEHOLDER, (_m, key: string) => {
    let out = SEE_CHART;
    if (!allowed.some(p => key.startsWith(`${p}.`))) {
      checks.push({ type: 'wrong_path', detail: key });
      clean = false;
    } else if (!Object.prototype.hasOwnProperty.call(ctx.table, key)) {
      checks.push({ type: 'unknown_key', detail: key });
      clean = false;
    } else {
      const value = ctx.table[key]!;
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        checks.push({ type: 'bad_value', detail: key });
        clean = false;
      } else {
        out = formatFigure(key, value);
        checks.push({ type: 'substituted', detail: key });
      }
    }
    resolved.push(out);
    return `\u0000${resolved.length - 1}\u0000`;
  });

  // 2. Every other quantity the model typed is replaced, unless the person typed that number themselves.
  let scrubbed = 0;
  const scrub = (token: string, offset: number, whole: string): string => {
    const digits = token.replace(/[^\d]/g, '');
    if (isYear(digits) && !/[R%]/i.test(token)) return token;
    const value = numericValue(token);
    const before = whole.slice(0, offset), after = whole.slice(offset + token.length);
    const sentence = before.slice(Math.max(before.lastIndexOf('. '), before.lastIndexOf('! '), before.lastIndexOf('? ')) + 1) + after.split(/[.!?](?:\s|$)/)[0];
    if (value !== null && user.has(value) && !/%|percent|per cent/i.test(token) && !CASH_CLAIM.test(sentence)) return token;
    scrubbed++;
    return SEE_CHART;
  };
  for (const pattern of [WORD_NUMBER, CURRENCY, PERCENT, SUFFIXED, BIG_NUMBER]) text = text.replace(pattern, scrub);
  text = text.replace(PAST_HORIZON_WORDS, () => { scrubbed++; return SEE_CHART; });
  text = text.replace(/\bmonths?\s+(\d{1,5})\b/gi, (match, month: string) => { if (Number(month) <= LAST_MONTH) return match; scrubbed++; return SEE_CHART; });
  if (scrubbed > 0) {
    checks.push({ type: 'scrubbed', detail: String(scrubbed) });
    clean = false;
  }

  // 3. Citation IDs that are not on this path are dropped (A7, E3).
  text = text.replace(/\[\s*([AE]\d+)\s*\]/g, (m, id: string) => {
    if (ids.has(id)) return m;
    checks.push({ type: 'dropped_id', detail: id });
    clean = false;
    return '';
  });

  // 4. Put the engine's values back.
  // oxlint-disable-next-line no-control-regex -- a sanitiser: it removes control characters from model text on purpose
  text = text.replace(/\u0000(\d+)\u0000/g, (_m, i: string) => resolved[Number(i)] ?? SEE_CHART);
  return { text: text.replace(/[ \t]{2,}/g, ' ').trim(), clean, withheld: false, checks };
}

/** Guard one piece of model text. Fails closed. */
export function guardText(raw: string, ctx: GuardContext): GuardResult {
  try {
    return guardInner(raw, ctx);
  } catch {
    return { text: WITHHELD_TEXT, clean: false, withheld: true, checks: [{ type: 'withheld' }] };
  }
}

/** Streaming helper: guard sentence by sentence, as the chat releases them. */
export function guardSentences(raw: string, ctx: GuardContext): GuardResult {
  // Split only on whitespace after . ! ? so the dots inside a placeholder key (A.savings.m36) never break a sentence.
  const parts = raw.split(/(?<=[.!?])\s+/).filter(p => p.length > 0);
  const results = parts.map(p => guardText(p, ctx));
  const withheld = results.some(r => r.withheld);
  return {
    text: withheld ? WITHHELD_TEXT : results.map(r => r.text).join(' ').replace(/\s+/g, ' ').trim(),
    clean: results.every(r => r.clean),
    withheld,
    checks: results.flatMap(r => r.checks),
  };
}
