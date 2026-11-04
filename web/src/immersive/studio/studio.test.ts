import { describe, expect, it, vi } from 'vitest';
import { buildSnapshot } from '../../../../shared/scene/room-model';
import { filmPlanSchema } from '../../../../shared/world/film-plan';
import { chordForCash, demoFilm, drawFilmFrame, filmFormat, filmMoment, SHOT_SECONDS } from './film';
import { buildLiveWorld } from './live-world';
import { maskRect } from './masks';
import type { SamMask } from '../../../../shared/providers/sam';

describe('film timeline and figure source', () => {
  it('covers the final engine month and clamps the end to the last shot', () => {
    expect(filmMoment(0, 6, 36)).toEqual({ index: 0, progress: 0, month: 1 });
    expect(filmMoment(6 * SHOT_SECONDS, 6, 36)).toEqual({ index: 5, progress: 1, month: 36 });
    expect(() => filmMoment(1, 0, 36)).toThrow();
  });
  it('selects a minor third only below zero and records an audio-capable format', () => {
    expect(chordForCash(-1)[1]).toBeLessThan(chordForCash(0)[1]!);
    expect(filmFormat(m => m.includes('mp4a'))?.extension).toBe('mp4');
    expect(filmFormat(m => m.includes('opus'))?.extension).toBe('webm');
    expect(filmFormat(() => false)).toBeNull();
  });
  it('rejects numeric director prompts and duplicate story beats', () => {
    const shots = demoFilm.shots.map(s => ({ focus: s.focus, camera: s.camera, prompt: 'A fictional adult at work.' }));
    expect(filmPlanSchema.safeParse({ shots }).success).toBe(true);
    expect(filmPlanSchema.safeParse({ shots: shots.map(s => ({ ...s, focus: 'founder' })) }).success).toBe(false);
    expect(filmPlanSchema.safeParse({ shots: shots.map(s => ({ ...s, prompt: 'R5000 profit' })) }).success).toBe(false);
  });
  it('draws snapshot cash and the shortfall qualification, not figures supplied by a model', () => {
    const snapshot = buildSnapshot({ sessionId: 'film-test', profileRevision: 1, simulationVersion: 1, pathId: 'A', pathName: 'Stay', case: 'likely', path: { id: 'A', startingCash: 100, months: 6, assumptions: [{ id: 'cost', label: 'Cost', kind: 'cost', low: 50, base: 50, high: 50 }] } });
    const text: string[] = [];
    const ctx = { clearRect: vi.fn(), drawImage: vi.fn(), createLinearGradient: () => ({ addColorStop: vi.fn() }), fillRect: vi.fn(), fillText: (s: string) => text.push(s) } as unknown as CanvasRenderingContext2D;
    const loaded = demoFilm.shots.map(() => ({ image: { naturalWidth: 2240, naturalHeight: 1120 } as HTMLImageElement, subject: null }));
    drawFilmFrame(ctx, demoFilm, loaded, snapshot, 16, true);
    expect(text.some(t => t.includes('Cash') && t.includes('200'))).toBe(true);
    expect(text).toContain('Cash first below zero: month 3');
    expect(text.some(t => t.includes('not a prediction'))).toBe(true);
  });
  it('normalises SAM source bounds, not mask raster size', () => {
    expect(maskRect({ bounds: { left: 100, top: 50, right: 300, bottom: 150 } } as SamMask, 1000, 500)).toEqual({ x: .1, y: .1, width: .2, height: .2 });
  });
  it('cancelled world generation does not silently load the demo', async () => {
    const controller = new AbortController(); controller.abort(); const call = vi.fn();
    await expect(buildLiveWorld('A bakery', { signal: controller.signal, onProgress: vi.fn(), call })).rejects.toThrow();
    expect(call).not.toHaveBeenCalled();
  });
});
