export type Viseme = 'rest' | 'ah' | 'ee' | 'oo' | 'fv' | 'mm';
export interface VisemeCue { at: number; end: number; shape: Viseme; char: number }
/** Estimated articulation, not phoneme recognition. Boundary events re-anchor this clock. */
export function visemeFor(character: string): Viseme {
  const c = character.toLowerCase();
  if (/[mbp]/.test(c)) return 'mm';
  if (/[fv]/.test(c)) return 'fv';
  if (/[ouwq]/.test(c)) return 'oo';
  if (/[eiy]/.test(c)) return 'ee';
  if (/[ah]/.test(c)) return 'ah';
  return 'rest';
}
export function buildVisemeTimeline(text: string, rate = 1): VisemeCue[] {
  const speed = Number.isFinite(rate) ? Math.min(2,Math.max(.5,rate)) : 1;
  let at = 0;
  return Array.from(text.slice(0,5000)).map((c,char) => {
    const duration = (/[.!?]/.test(c) ? 260 : /[,;:]/.test(c) ? 160 : /\s/.test(c) ? 65 : 58) / speed;
    const cue = { at, end: at+duration, shape: visemeFor(c), char }; at += duration; return cue;
  });
}
export function cueAt(cues: readonly VisemeCue[], elapsed: number): Viseme {
  if (!Number.isFinite(elapsed) || elapsed < 0) return 'rest';
  return cues.find(c => elapsed >= c.at && elapsed < c.end)?.shape ?? 'rest';
}
export function boundaryOffset(cues: readonly VisemeCue[], charIndex: number, elapsed: number): number {
  const cue = cues.find(c=>c.char >= charIndex);
  return cue ? elapsed-cue.at : 0;
}
export const futureSelfIntro = { A: 'I stayed small. I want to understand what that leaves me room to do.', B: 'I took the contract. I want to understand the gap before the client pays.', C: 'I asked for safer terms. I want to see how much breathing room that gives me.' } as const;
