// Turns what a person types for an amount into a low-high range (FEATURES.md F2, F4).
// "about 6k" becomes a range chip; letters, negatives and blanks are rejected.

export type Parsed = { ok: true; low: number; high: number; rough: boolean } | { ok: false; error: string };

// Placeholder spread for "about"; to replace with sourced bands from defaults/za.json.
export const ROUGH_SPREAD = 0.15;

const ROUGH = /\b(about|around|roughly|approximately|approx|more or less|±)\b|~/i;

function toNumber(raw: string): number | null {
  const s = raw.trim().toLowerCase().replace(/^r\s*/, '').replace(/[\s,]/g, '');
  const m = /^(\d+(?:\.\d+)?)(k|m)?$/.exec(s);
  if (!m) return null;
  const n = Number(m[1]);
  const scale = m[2] === 'k' ? 1_000 : m[2] === 'm' ? 1_000_000 : 1;
  const value = n * scale;
  return Number.isFinite(value) ? value : null;
}

export function parseAmount(input: string): Parsed {
  const text = input.trim();
  if (!text) return { ok: false, error: 'Enter an amount' };
  if (/-\s*\d/.test(text) && !/\d\s*-\s*\d/.test(text)) return { ok: false, error: 'Amounts cannot be negative' };

  const rough = ROUGH.test(text);
  const body = text.replace(ROUGH, ' ').replace(/\b(a month|per month|pm|monthly)\b/gi, ' ').trim();

  // "8 to 12k", "8-12k", "R8,000 – R12,000": a trailing k applies to both ends, but only when that leaves the left end
  // the smaller one. "8000 to 12k" is already in rand, and "999 to 1k" must stay 999, not 999,000.
  const range = /^(.+?)\s*(?:to|-|–|—)\s*(.+)$/i.exec(body);
  if (range) {
    const left = range[1]!.trim();
    const right = range[2]!.trim();
    const suffix = /[km]$/i.exec(right)?.[0] ?? '';
    const scale = suffix.toLowerCase() === 'k' ? 1_000 : suffix ? 1_000_000 : 1;
    const bare = toNumber(left);
    const hi = toNumber(right);
    if (bare === null || hi === null) return { ok: false, error: 'Use numbers, like 8000 or 8k to 12k' };
    const lo = /[km]$/i.test(left) || suffix === '' || bare * scale > hi ? bare : bare * scale;
    if (lo > hi) return { ok: false, error: 'The first amount should be the lower one' };
    return { ok: true, low: lo, high: hi, rough: true };
  }

  const n = toNumber(body);
  if (n === null) return { ok: false, error: 'Use numbers, like 8000 or 8k to 12k' };
  if (rough) return { ok: true, low: Math.round(n * (1 - ROUGH_SPREAD)), high: Math.round(n * (1 + ROUGH_SPREAD)), rough: true };
  return { ok: true, low: n, high: n, rough: false };
}

export function formatRand(n: number): string {
  const r = Math.round(n);
  const digits = Math.abs(r).toLocaleString('en-ZA').replace(/ /g, ' ');
  return (r < 0 ? '−R' : 'R') + digits;
}

export function formatRange(low: number, high: number): string {
  return low === high ? formatRand(low) : `${formatRand(low)} – ${formatRand(high)}`;
}
