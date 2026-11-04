import type { ObjectId } from './manifest';

// Where a walker can go without a key held: the courtyard's terraces meet only across the front terrace and the
// bridge, so a walk between two places follows these points. The rails and counters stay real colliders, so a route
// that hits something stops there rather than passing through it.
type Point = readonly [x: number, z: number];

const POINTS = {
  spawn: [0, 9],
  frontLeft: [-2.95, 8.2],
  offer: [-2.95, 5.0],
  intake: [-2.95, -0.9],
  bridgeLeft: [-2.95, -3],
  bridge: [0, -3],
  bridgeRight: [2.95, -3],
  frontRight: [2.95, 8.2],
  memo: [4, -7.6],
  fridge: [-4.0, 3.0],
} satisfies Record<string, Point>;

export type Stop = keyof typeof POINTS;

/** Where to stand to reach each object. The fridge sits well back from its place, so it has a stop of its own. */
const OBJECT_STOPS: Record<ObjectId, Stop> = { contract: 'offer', pan: 'offer', fridge: 'fridge', intake_desk: 'intake', memo: 'memo' };

export const stopForObject = (id: ObjectId): Stop => OBJECT_STOPS[id];

const LINKS: readonly (readonly [Stop, Stop])[] = [
  ['spawn', 'frontLeft'],
  ['spawn', 'frontRight'],
  ['frontLeft', 'offer'],
  ['offer', 'intake'],
  ['offer', 'fridge'],
  ['fridge', 'intake'],
  ['intake', 'bridgeLeft'],
  ['bridgeLeft', 'bridge'],
  ['bridge', 'bridgeRight'],
  ['bridgeRight', 'frontRight'],
  ['bridgeRight', 'memo'],
];

function neighbours(stop: Stop): Stop[] {
  return LINKS.flatMap(([a, b]) => (a === stop ? [b] : b === stop ? [a] : [])).sort();
}

const distance = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** The stop closest to a point on the floor; ties go to the first name, so the answer never depends on order. */
function nearestStop(at: Point): Stop {
  return (Object.keys(POINTS) as Stop[]).sort((a, b) => distance(at, POINTS[a]) - distance(at, POINTS[b]) || a.localeCompare(b))[0]!;
}

/** The floor points to walk through, from where the walker stands to a stop (every place is one), fewest hops first. */
export function routeTo(from: { x: number; z: number }, goal: Stop): { x: number; z: number }[] {
  const start = nearestStop([from.x, from.z]);
  const cameFrom = new Map<Stop, Stop | null>([[start, null]]);
  const queue: Stop[] = [start];
  while (queue.length > 0) {
    const stop = queue.shift()!;
    if (stop === goal) break;
    for (const next of neighbours(stop)) {
      if (cameFrom.has(next)) continue;
      cameFrom.set(next, stop);
      queue.push(next);
    }
  }
  const stops: Stop[] = [];
  for (let at: Stop | null = goal; at; at = cameFrom.get(at) ?? null) stops.unshift(at);
  return stops.map((stop) => ({ x: POINTS[stop][0], z: POINTS[stop][1] }));
}

/** The heading that faces a point on the floor: yaw 0 looks along -Z. */
export function yawToward(from: { x: number; z: number }, to: { x: number; z: number }): number {
  return Math.atan2(-(to.x - from.x), -(to.z - from.z));
}

/** Turns one heading toward another by at most `step` radians, the short way round. */
export function turnToward(yaw: number, target: number, step: number): number {
  const delta = Math.atan2(Math.sin(target - yaw), Math.cos(target - yaw));
  return Math.abs(delta) <= step ? target : yaw + Math.sign(delta) * step;
}
