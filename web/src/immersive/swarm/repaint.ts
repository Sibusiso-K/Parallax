import { callWorld } from '../studio/live-world';
import { compactImage } from '../studio/masks';

export interface RepaintStep { stage: 'painting' | 'reviewing' | 'rejected' | 'done' | 'unavailable'; attempt: number; note?: string; ms?: number }
export interface Repainted { src: string; note: string; attempts: number }

/**
 * Muse Image repaints the room the founder is looking at, then Muse Spark looks at the result.
 * A repaint with any text, numeral or logo in it is thrown away, so no figure can reach the founder through a picture.
 * Returns null with no key, or when no attempt passes. The room then stays as it is.
 */
export async function repaintRoom(src: string, prompt: string, onStep: (step: RepaintStep) => void, signal: AbortSignal, attempts = 2): Promise<Repainted | null> {
  const reference = (await compactImage(src, signal)).dataUrl;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const began = performance.now();
    onStep({ stage: 'painting', attempt });
    const painted = await callWorld({ action: 'edit', prompt, references: [reference] }, signal);
    if (painted.mode !== 'model' || typeof painted.dataUrl !== 'string') { onStep({ stage: 'unavailable', attempt }); return null; }
    const paintedMs = Math.round(performance.now() - began);
    onStep({ stage: 'reviewing', attempt, ms: paintedMs });
    const compact = (await compactImage(painted.dataUrl, signal)).dataUrl;
    // One flaky look should not cost a good painting, so the look gets a second try. An image never passes unchecked.
    let review: { pass: boolean; seen: { note: string } } | undefined;
    for (let look = 0; look < 2 && !review; look++) {
      try { review = (await callWorld({ action: 'inspect', image: compact, change: prompt }, signal)).review as typeof review; }
      catch (error) { if (signal.aborted) throw error; }
    }
    if (review?.pass) {
      onStep({ stage: 'done', attempt, note: review.seen.note, ms: paintedMs });
      return { src: painted.dataUrl, note: review.seen.note, attempts: attempt };
    }
    onStep({ stage: 'rejected', attempt, note: review?.seen.note ?? 'Could not be checked' });
  }
  return null;
}
