import { requiredFields, type Extraction, type FieldKey } from './schema.js';

const normalise = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

// Amounts written in a quote, in rand: "R19,500", "2.5k", "R3 000", "11k". A k or m only counts when it is not the
// start of a word, so "R6,000 monthly" reads as 6,000 and not as six million.
export function amountsIn(quote: string): number[] {
  const found: number[] = [];
  for (const m of quote.matchAll(/(\d[\d,. ]*\d|\d)(?:\s*([kKmM])(?![a-zA-Z]))?/g)) {
    const digits = m[1]!.replace(/[ ,]/g, '');
    const scale = m[2] === undefined ? 1 : m[2].toLowerCase() === 'k' ? 1_000 : 1_000_000;
    const n = Number(digits) * scale;
    if (Number.isFinite(n)) found.push(n);
  }
  return found;
}

// A field is kept only if its quote appears in the person's own text (F2), so text that tries to instruct the model
// cannot fill fields the person never wrote. A money figure is also kept only if its quote states an amount in range.
export function keepQuoted(text: string, ex: Extraction): { kept: Extraction; dropped: FieldKey[] } {
  const haystack = normalise(text);
  const kept: Extraction = {};
  const dropped: FieldKey[] = [];
  for (const key of Object.keys(ex) as FieldKey[]) {
    const field = ex[key];
    if (!field) continue;
    const money = 'low' in field ? field : undefined;
    const quoted = haystack.includes(normalise(field.quote));
    const stated = !money || amountsIn(money.quote).some((n) => n >= money.low && n <= money.high);
    if (quoted && stated) (kept as Record<FieldKey, unknown>)[key] = field;
    else dropped.push(key);
  }
  return { kept, dropped };
}

export function missingFields(ex: Extraction): FieldKey[] {
  return requiredFields.filter((k) => ex[k] === undefined);
}
