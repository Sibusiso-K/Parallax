import type { RoomSnapshot } from '../../../../shared/scene/room-model';

export type StoryObject = 'contract' | 'fridge' | 'pan' | 'memo';
export type ReelPlan = {
  version: 1;
  snapshotKey: string;
  profileRevision: number;
  pathId: string;
  month: number;
  object: StoryObject;
  /** Timeline data only. No audio, video or image has been generated. */
  scenes: readonly { kind: 'context' | 'cash' | 'qualification'; durationSeconds: number; text: string }[];
};

const labels: Record<StoryObject, string> = { contract: 'Contract', fridge: 'Equipment', pan: 'Production', memo: 'Decision memo' };

/** Freeze facts and copy used by a future reel renderer; never accepts model-authored figures. */
export function buildReelPlan(snapshot: RoomSnapshot, month: number, object: StoryObject): ReelPlan {
  const row = snapshot.active.rows[month - 1];
  const baseline = snapshot.baseline.rows[month - 1];
  if (!Object.hasOwn(labels, object) || !Number.isInteger(month) || month < 1 || !row || !baseline || row.month !== month || baseline.month !== month || !Number.isFinite(row.cash) || !Number.isFinite(baseline.cash)) {
    throw new RangeError('Invalid object, month or snapshot values');
  }
  const money = (n: number) => new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(n);
  const stressed = snapshot.ref.setback !== null;
  const cash = stressed
    ? `At the end of month ${month}, baseline cash is ${money(baseline.cash)} and cash with the selected stress is ${money(row.cash)}.`
    : `At the end of month ${month}, baseline cash is ${money(row.cash)}.`;
  const scenes: ReelPlan['scenes'][number][] = [
    { kind: 'context', durationSeconds: 3, text: `${labels[object]} · ${snapshot.pathName} · ${snapshot.ref.case} case` },
    { kind: 'cash', durationSeconds: 6, text: cash },
  ];
  if (snapshot.active.firstShortfall !== null) scenes.push({ kind: 'qualification', durationSeconds: 5, text: `Cash first runs out in month ${snapshot.active.firstShortfall}. Later projections assume the business continues; funding and survival are not modelled.` });
  return { version: 1, snapshotKey: snapshot.key, profileRevision: snapshot.ref.profileRevision, pathId: snapshot.ref.pathId, month, object, scenes };
}
