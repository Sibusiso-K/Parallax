import { z } from 'zod';
import { simulate, editAssumption, type PathInput } from '../engine/simulate.js';
import { applySetback, drivers, lowestCash } from '../engine/analysis.js';
import { buildSnapshot, canonicalJson, fingerprint } from '../scene/room-model.js';
import type { Proposal, SwarmRequest } from './contracts.js';

export const inputKey = (req: SwarmRequest) => fingerprint(canonicalJson({ path: req.path, stressed: req.stressed, month: req.month }));
export const snapshotFor = (req: SwarmRequest) => buildSnapshot({ sessionId: 'swarm', profileRevision: 1, simulationVersion: 1, pathId: req.path.letter, pathName: req.path.name, path: req.path, case: 'likely', stress: req.stressed ? { id: 'late-payment' } : null });
const lowest = (path: PathInput) => lowestCash(simulate(path), 'likely').cash;

/** Delays all contract receipts, retaining their amounts and duration. No contract means not applicable. */
export function delayPath(path: PathInput, months: number): PathInput {
  return { ...path, assumptions: path.assumptions.map(a => a.role === 'contract' && a.kind === 'income' ? { ...a, fromMonth: (a.fromMonth ?? 1) + months, toMonth: (a.toMonth ?? path.months ?? 36) + months } : a) };
}
export function findBreakpoint(path: PathInput) {
  if (!path.assumptions.some(a => a.role === 'contract' && a.kind === 'income')) return { applicable: false, reason: 'No contract receipts on this path' };
  const cap = Math.min(36, path.months ?? 36);
  const survives = (delay: number) => simulate(delayPath(path, delay)).likely.shortfallMonths.length === 0;
  if (!survives(0)) return { applicable: true, longestDelayMonths: null, baselineAlreadyShort: true, horizonMonths: path.months ?? 36 };
  let lo = 0, hi = cap;
  // Non-negative recurring receipts make cumulative cash non-increasing as delay increases.
  while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); if (survives(mid)) lo = mid; else hi = mid - 1; }
  return { applicable: true, longestDelayMonths: lo, capped: lo === cap, horizonMonths: path.months ?? 36, rule: 'All contract receipts shift later; cash must remain non-negative throughout the horizon.' };
}

/** Candidates come from the founder's existing low/high bounds, never invented by a model. */
export function proposalCandidates(req: SwarmRequest): Proposal[] {
  const path = req.path;
  const active = (p: PathInput) => req.stressed ? applySetback(p, 'late-payment') : p;
  const beforeLowest = lowest(active(path));
  return [...path.assumptions].sort((a, b) => a.id.localeCompare(b.id)).flatMap(a => {
    if (a.role === 'setback') return [];
    const base = a.kind === 'income' ? a.high : a.low;
    if (base === a.base) return [];
    const values = { low: a.low, base, high: a.high };
    const edited = editAssumption(path, a.id, values);
    if (!edited.ok) return [];
    const afterLowest = lowest(active(edited.path));
    return [{ id: `bound:${a.id}`, assumptionId: a.id, label: a.label, values, beforeLowest, afterLowest, delta: afterLowest - beforeLowest, inputKey: inputKey(req) }];
  }).sort((a, b) => b.delta - a.delta || a.id.localeCompare(b.id)).slice(0, 6);
}

const toolArgs = z.object({ month: z.number().int().min(1).max(36).optional() }).strict();
export const TOOL_NAMES = ['inspect_month', 'run_stress', 'sensitivity', 'find_breakpoint'] as const;
export function executeTool(name: string, raw: unknown, req: SwarmRequest): unknown {
  const args = toolArgs.parse(raw);
  switch (name) {
    case 'inspect_month': { const snap = snapshotFor(req); const month = args.month ?? req.month; return { month, baseline: snap.baseline.rows[month - 1], active: snap.active.rows[month - 1] }; }
    case 'run_stress': { const snap = snapshotFor({ ...req, stressed: true }); return { lowest: snap.active.lowest, firstShortfall: snap.active.firstShortfall, rule: snap.terms.stressRule }; }
    case 'sensitivity': return drivers(req.path, 6);
    case 'find_breakpoint': return findBreakpoint(req.path);
    default: throw new Error('Unknown tool');
  }
}
export const toolDefinitions = TOOL_NAMES.map(name => ({ type: 'function', function: { name, description: `Engine-only ${name.replaceAll('_', ' ')}. Results are conditional projections.`, parameters: { type: 'object', properties: { month: { type: 'integer', minimum: 1, maximum: 36 } }, additionalProperties: false } } }));
