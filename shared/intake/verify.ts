import { requiredFields, type Extraction, type FieldKey } from './schema';

const normalise = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

// A field is kept only if its quote appears in the person's own text (F2), so text
// that tries to instruct the model cannot fill fields the person never wrote.
export function keepQuoted(text: string, ex: Extraction): { kept: Extraction; dropped: FieldKey[] } {
  const haystack = normalise(text);
  const kept: Extraction = {};
  const dropped: FieldKey[] = [];
  for (const key of Object.keys(ex) as FieldKey[]) {
    const field = ex[key];
    if (!field) continue;
    if (haystack.includes(normalise(field.quote))) {
      (kept as Record<FieldKey, unknown>)[key] = field;
    } else {
      dropped.push(key);
    }
  }
  return { kept, dropped };
}

export function missingFields(ex: Extraction): FieldKey[] {
  return requiredFields.filter((k) => ex[k] === undefined);
}
