import type { Assumption, MoneyField } from "./types";

const MINUS = "−";

/** "R19 500", negatives "−R476 800". Non-breaking space keeps figures on one line. */
export function formatMoney(n: number): string {
  const r = Math.round(n);
  const abs = Math.abs(r)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${r < 0 ? MINUS : ""}R${abs}`;
}

function parseOne(raw: string): number | null {
  const s = raw.toLowerCase().replace(/[r,\s ]/g, "").replace(MINUS, "-");
  const m = s.match(/^(-?\d+(?:\.\d+)?)(k|m)?$/);
  if (!m) return null;
  let n = parseFloat(m[1]!);
  if (m[2] === "k") n *= 1000;
  if (m[2] === "m") n *= 1_000_000;
  return Math.round(n);
}

/**
 * Accepts "8000", "8k", "about 8k", "R8 000", "8k to 12k", "8k-12k".
 * Returns null when the text cannot be read as an amount.
 */
export function parseAmount(input: string): { low: number; high: number; base?: number } | null {
  let s = input.trim().toLowerCase();
  if (!s) return null;
  s = s.replace(/^(about|around|roughly|approx\.?|approximately|~)\s*/, "");
  s = s.replace(/\s*(a|per)\s*month$|\/\s*m(onth)?$|\s*pm$/, "");
  const parts = s.split(/\s*(?:to|–|—|-(?=\s*r?\d)|and)\s*/).filter(Boolean);
  if (parts.length === 1) {
    const n = parseOne(parts[0]!);
    return n === null || n < 0 ? null : { low: n, high: n, base: n };
  }
  if (parts.length === 2) {
    const a = parseOne(parts[0]!);
    const b = parseOne(parts[1]!);
    if (a === null || b === null || a < 0 || b < 0) return null;
    const low = Math.min(a, b);
    const high = Math.max(a, b);
    return { low, high, base: Math.round((low + high) / 2) };
  }
  return null;
}

export function isMoneyField(v: unknown): v is MoneyField {
  return typeof v === "object" && v !== null && "low" in v && "high" in v;
}

export function formatField(v: unknown): string {
  if (v === undefined || v === null || v === "") return "—";
  if (isMoneyField(v)) {
    if (v.low === v.high) return `${formatMoney(v.low)}`;
    return `${formatMoney(v.low)} – ${formatMoney(v.high)}`;
  }
  if (Array.isArray(v)) return v.join(", ");
  return String(v);
}

export function monthWindow(a: Assumption): string {
  if (a.fromMonth && a.toMonth) return `months ${a.fromMonth}–${a.toMonth}`;
  if (a.fromMonth) return `from month ${a.fromMonth}`;
  if (a.toMonth) return `until month ${a.toMonth}`;
  return "";
}

export function describeAssumption(a: Assumption): string {
  const kind = a.kind === "income" ? "Income a month" : "Cost a month";
  const w = monthWindow(a);
  const range =
    a.low === a.high
      ? `${formatMoney(a.base)}`
      : `${formatMoney(a.low)} – ${formatMoney(a.high)}, usually ${formatMoney(a.base)}`;
  return `${kind}: ${range}${w ? ` (${w})` : ""}`;
}
