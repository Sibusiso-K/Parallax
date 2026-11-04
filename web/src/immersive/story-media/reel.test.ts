import { describe, expect, it } from 'vitest';
import { formatRand } from '../../../../shared/guard/figures';
import { createSession } from '../session';
import { cashMonthAt, reelDuration, reelFormat, reelTimeline } from './reel';
import { buildReelPlan } from './reel-plan';

describe('the reel timeline', () => {
  const snapshot = createSession('reel-timeline').snapshotFor('B', true);
  const plan = buildReelPlan(snapshot, 4, 'contract');

  it('plays every scene in the plan, in order, without gaps, and always ends on the caveat', () => {
    const timeline = reelTimeline(plan);
    expect(timeline.map((e) => e.kind)).toEqual(['context', 'cash', 'qualification', 'outro']);
    timeline.slice(1).forEach((entry, i) => expect(entry.start).toBe(timeline[i]!.end));
    expect(timeline.at(-1)!.text).toBe('One possible future, not a prediction.');
    expect(reelDuration(plan)).toBe(timeline.at(-1)!.end);
  });

  it('carries the engine figures for the selected month, and the shortfall warning', () => {
    const timeline = reelTimeline(plan);
    const cash = timeline.find((e) => e.kind === 'cash')!;
    expect(cash.text).toContain(formatRand(snapshot.active.rows[3]!.cash));
    expect(cash.text).toContain(formatRand(snapshot.baseline.rows[3]!.cash));
    expect(timeline.find((e) => e.kind === 'qualification')!.text).toContain('funding and survival are not modelled');
  });

  it('skips the warning scene when cash never runs out', () => {
    const safe = createSession('reel-timeline').snapshotFor('A', false);
    expect(safe.active.firstShortfall).toBeNull();
    expect(reelTimeline(buildReelPlan(safe, 4, 'contract')).map((e) => e.kind)).toEqual(['context', 'cash', 'outro']);
  });
});

describe('the month the reel shows', () => {
  it('walks every month while the line draws, then rests on the selected month', () => {
    expect(cashMonthAt(0, 4, 36)).toBe(1);
    expect(cashMonthAt(0.275, 4, 36)).toBe(18);
    expect(cashMonthAt(0.549, 4, 36)).toBe(36);
    expect(cashMonthAt(0.55, 4, 36)).toBe(4);
    expect(cashMonthAt(1, 4, 36)).toBe(4);
  });
});

describe('reelFormat', () => {
  it('prefers MP4, falls back to WebM, and admits when neither works', () => {
    expect(reelFormat(() => true)).toEqual({ mime: 'video/mp4;codecs=avc1.42E01E', extension: 'mp4' });
    expect(reelFormat((m) => m.startsWith('video/webm'))).toEqual({ mime: 'video/webm;codecs=vp9', extension: 'webm' });
    expect(reelFormat(() => false)).toBeNull();
  });
});
