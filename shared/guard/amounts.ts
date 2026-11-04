// Rand amounts as a reply writes them: "R33,000", "R120 000", "R1,500", "R7000". A separator is only read when exactly
// three digits follow it, so "R120 000 in 2 months" gives 120000 and not 1200002.
const AMOUNT = /R\s?(\d{1,3}(?:[ ,]\d{3})+|\d+)(?!\d)/g;

export function amountsIn(text: string): number[] {
  return [...text.matchAll(AMOUNT)].map((m) => Number(m[1]!.replace(/[ ,]/g, '')));
}
