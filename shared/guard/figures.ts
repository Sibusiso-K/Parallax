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

export type CheckType = 'substituted' | 'unknown_key' | 'wrong_path' | 'bad_value' | 'scrubbed' | 'dropped_id' | 'certainty' | 'withheld';

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

// Certainty the engine cannot back (RISKS S3). Flagged, not rewritten: the reply is still honest about numbers.
const CERTAINTY = /\b(guaranteed?|definitely will|certainly will|will definitely|you will (?:be|have|earn|save|make)|risk[- ]free|can'?t fail|cannot fail|i promise)\b/i;

const WORD_NUMBER =
  /\b(?:(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|a|several)[\s-]+)*(?:hundred|thousand|million|billion)\b(?:\s+rand)?/gi;
const CURRENCY = /-?\bR\s?(?:\d{1,3}(?:[ ,]\d{3})+|\d+)(?:\.\d+)?(?:\s?(?:k|m|million|thousand|billion)\b)?/gi;
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

function guardInner(raw: string, ctx: GuardContext): GuardResult {
  const checks: Check[] = [];
  let clean = true;
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
  const scrub = (token: string): string => {
    const digits = token.replace(/[^\d]/g, '');
    if (isYear(digits) && !/[R%]/i.test(token)) return token;
    const value = numericValue(token);
    if (value !== null && user.has(value) && !/%|percent|per cent/i.test(token)) return token;
    scrubbed++;
    return SEE_CHART;
  };
  for (const pattern of [WORD_NUMBER, CURRENCY, PERCENT, SUFFIXED, BIG_NUMBER]) text = text.replace(pattern, scrub);
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

  // 4. Flag certainty the engine cannot back.
  if (CERTAINTY.test(text)) {
    checks.push({ type: 'certainty' });
    clean = false;
  }

  // 5. Put the engine's values back.
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
