import { describe, expect, it } from 'vitest';
import { CASES, SETBACK_IDS, drivers, figureTable, milestones, runwayMonths, setbackImpact, worstSetback } from './analysis.js';
import { editAssumption, simulate, type Assumption, type PathInput, type Role } from './simulate.js';
import { DEMO_EXTRACTION } from '../intake/fixture.js';
import { templatePaths } from '../paths/templates.js';
import { buildProfile } from '../profile/profile.js';
import { int, pick, rng } from '../testing/random.js';

// Stress tests for the simulation engine (F7). Seeded, so any failure replays. The default run is quick; for a longer
// soak set STRESS_RUNS, for example: STRESS_RUNS=20000 npm run stress
const RUNS = Number(process.env.STRESS_RUNS ?? 400);
const SCALES = [0, 1, 50, 5_000, 200_000, 5_000_000];
// Roles let the setback library size itself from the path (late payment from the contract, a lost client from sales).
const ROLES: Role[] = ['sales', 'contract', 'direct', 'overhead', 'payroll', 'founder', 'debt', 'equipment', 'other'];

function randomPath(r: () => number): PathInput {
  const assumptions: Assumption[] = [];
  const n = int(r, 0, 8);
  for (let i = 0; i < n; i++) {
    const scale = pick(r, SCALES);
    const low = int(r, 0, scale);
    const base = int(r, low, scale);
    const high = int(r, base, scale);
    const a: Assumption = { id: `P${i + 1}`, label: `line ${i + 1}`, kind: r() < 0.5 ? 'income' : 'cost', low, base, high };
    if (r() < 0.6) a.role = pick(r, ROLES);
    if (r() < 0.3) a.fromMonth = int(r, 1, 40);
    if (r() < 0.3) a.toMonth = int(r, 1, 40);
    if (a.fromMonth !== undefined && a.toMonth !== undefined && a.fromMonth > a.toMonth) delete a.toMonth;
    assumptions.push(a);
  }
  return { id: 'R', startingCash: int(r, 0, 1_000_000), assumptions, months: r() < 0.5 ? undefined : int(r, 1, 60) };
}

describe('simulate on random paths', () => {
  it('keeps the books: each month, cash is the start plus the running net', () => {
    const r = rng(1);
    for (let k = 0; k < RUNS; k++) {
      const path = randomPath(r);
      const sim = simulate(path);
      for (const c of CASES) {
        let cash = path.startingCash;
        for (const row of sim[c].rows) {
          cash += row.net;
          expect(row.net).toBe(row.income - row.costs);
          expect(row.cash).toBe(cash);
        }
      }
    }
  });

  it('orders the cases bad <= likely <= good in every month', () => {
    const r = rng(2);
    for (let k = 0; k < RUNS; k++) {
      const sim = simulate(randomPath(r));
      sim.bad.rows.forEach((row, i) => {
        expect(row.cash).toBeLessThanOrEqual(sim.likely.rows[i]!.cash);
        expect(sim.likely.rows[i]!.cash).toBeLessThanOrEqual(sim.good.rows[i]!.cash);
      });
    }
  });

  it('flags exactly the months where cash is negative', () => {
    const r = rng(3);
    for (let k = 0; k < RUNS; k++) {
      const sim = simulate(randomPath(r));
      for (const c of CASES) {
        const negative = sim[c].rows.filter((row) => row.cash < 0).map((row) => row.month);
        expect(sim[c].shortfallMonths).toEqual(negative);
      }
    }
  });

  it('gives the same figures twice, with every figure finite', () => {
    const r = rng(4);
    for (let k = 0; k < RUNS; k++) {
      const path = randomPath(r);
      const first = simulate(path);
      expect(simulate(path)).toEqual(first);
      for (const c of CASES) for (const row of first[c].rows) expect(Number.isFinite(row.cash)).toBe(true);
    }
  });

  it('ranks drivers by swing, largest first, and keeps only lines that move the result', () => {
    const r = rng(5);
    for (let k = 0; k < RUNS; k++) {
      const d = drivers(randomPath(r));
      expect(d.length).toBeLessThanOrEqual(3);
      d.forEach((x, i) => {
        expect(x.swing).toBeGreaterThan(0);
        if (i > 0) expect(x.swing).toBeLessThanOrEqual(d[i - 1]!.swing);
      });
    }
  });

  it('keeps milestone months inside the run, and runway a whole number of months', () => {
    const r = rng(6);
    for (let k = 0; k < RUNS; k++) {
      const path = randomPath(r);
      const months = path.months ?? 36;
      const ms = milestones(path, simulate(path));
      for (const c of CASES) {
        for (const m of ms[c]) if (m.month !== null) expect(m.month).toBeLessThanOrEqual(months);
      }
      const runway = runwayMonths(path);
      if (runway !== null) expect(Number.isInteger(runway) && runway >= 0).toBe(true);
    }
  });

  it('never has a setback help: every one lowers cash or leaves it, at its lowest point and at the end', () => {
    const r = rng(7);
    for (let k = 0; k < RUNS / 4; k++) {
      const path = randomPath(r);
      for (const id of SETBACK_IDS) {
        const impact = setbackImpact(path, id);
        expect(impact.lowest, id).toBeLessThanOrEqual(0);
        expect(impact.end, id).toBeLessThanOrEqual(0);
      }
      expect(worstSetback(path).lowest).toBeLessThanOrEqual(0);
    }
  });

  it('builds a finite figure table for every random path', () => {
    const r = rng(8);
    for (let k = 0; k < RUNS / 4; k++) {
      for (const [key, value] of Object.entries(figureTable(randomPath(r)))) {
        expect(Number.isFinite(value), key).toBe(true);
      }
    }
  });

  it('refuses NaN, infinite, negative, reversed and empty-run inputs', () => {
    const base = randomPath(rng(9));
    const broken: Assumption[] = [
      { id: 'X1', label: 'x', kind: 'cost', low: Number.NaN, base: 1, high: 2 },
      { id: 'X2', label: 'x', kind: 'cost', low: 1, base: Number.POSITIVE_INFINITY, high: Number.POSITIVE_INFINITY },
      { id: 'X3', label: 'x', kind: 'cost', low: -1, base: 0, high: 1 },
      { id: 'X4', label: 'x', kind: 'cost', low: 5, base: 3, high: 4 },
    ];
    for (const a of broken) expect(() => simulate({ ...base, assumptions: [a] })).toThrow();
    expect(() => simulate({ ...base, months: 0 })).toThrow('months');
    expect(() => simulate({ ...base, months: 1.5 })).toThrow('months');
    expect(() => simulate({ ...base, startingCash: Number.NaN })).toThrow('startingCash');
  });

  it('applies an edit only when it is valid, and never touches the original path', () => {
    const r = rng(10);
    const path = templatePaths(buildProfile(DEMO_EXTRACTION))[0]!;
    const before = JSON.stringify(path);
    for (let k = 0; k < RUNS; k++) {
      const values = { low: int(r, -5, 20000), base: int(r, -5, 20000), high: int(r, -5, 20000) };
      const valid = values.low >= 0 && values.low <= values.base && values.base <= values.high;
      const res = editAssumption(path, 'A1', values);
      expect(res.ok).toBe(valid);
      if (res.ok) expect(() => simulate(res.path)).not.toThrow();
      expect(JSON.stringify(path)).toBe(before);
    }
  });

  it('builds a full figure table fast enough for instant what-ifs', () => {
    const paths = templatePaths(buildProfile(DEMO_EXTRACTION));
    const started = performance.now();
    for (let k = 0; k < 20; k++) for (const p of paths) figureTable(p);
    const perTable = (performance.now() - started) / (20 * paths.length);
    expect(perTable).toBeLessThan(100); // milliseconds; F8 asks for a re-run that redraws in under a second
  });
});
