import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { simulate, type PathInput } from '../shared/engine/simulate.js';
import { applySetback, figureTable } from '../shared/engine/analysis.js';
import { guardText, guardSentences, formatRand } from '../shared/guard/figures.js';
import { advisorFigures, checkAdvisorText } from '../shared/scene/advisor-model.js';
import { canonicalJson } from '../shared/scene/room-model.js';
import { runSwarm } from '../shared/swarm/run.js';
import { findBreakpoint, proposalCandidates, snapshotFor } from '../shared/swarm/engine-tools.js';
import { swarmRequest } from '../shared/swarm/contracts.js';
import { AGENTS, buildDecisionGraph, estimateTokens } from '../shared/graph/decision-graph.js';
import { proposalFor } from '../shared/world/document.js';
import { templatePaths } from '../shared/paths/templates.js';
import { buildProfile } from '../shared/profile/profile.js';
import { DEMO_EXTRACTION } from '../shared/intake/fixture.js';
import { attacks } from './attacks.js';
import { clauses } from './clauses.js';

const hash = (value: unknown) => createHash('sha256').update(canonicalJson(value)).digest('hex');
const fileHash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const median = (values: number[]) => {
  const xs = [...values].sort((a, b) => a - b), middle = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[middle]! : (xs[middle - 1]! + xs[middle]!) / 2;
};
// The demo leaves payroll unanswered. This is an explicit authored fixture,
// not a claim that a founder confirmed it or that a model extracted it.
const sim_payroll = 21000;
const paths = templatePaths(buildProfile({ ...DEMO_EXTRACTION,
  payroll: { low: sim_payroll, high: sim_payroll, quote: 'sim_fixture payroll assumption' },
}));
const requestFor = (path: typeof paths[number], stressed: boolean) => swarmRequest.parse({
  path, stressed, month: 4, event: 'Review this hypothetical cash plan.', context: {},
});

function guardAttacks() {
  const path = paths.find(p => p.letter === 'B')!;
  const snap = snapshotFor(requestFor(path, true));
  const months = [1, 2, 4, 12, 24, 36];
  const room = advisorFigures(path.letter, snap, months);
  const future = figureTable(path);
  const wrongSign = formatRand(-snap.active.lowest.cash);
  if (snap.active.lowest.cash === 0 || snap.baseline.rows[0]!.cash === snap.baseline.rows[1]!.cash ||
      simulate(path).likely.rows[11]!.cash === simulate(path).likely.rows[1]!.cash) {
    throw new Error('Attack fixture must contain a nonzero balance and unequal comparison months');
  }
  const surfaces = ['advisor', 'guardText', 'futureSelf_guardSentences'] as const;
  const results = surfaces.map(surface => {
    const advisor = surface === 'advisor';
    const table = advisor ? room.table : future;
    const valid = advisor ? 'B.room.baseline.cash.m1' : 'B.cash.m12.likely';
    // Include a real foreign key in the table to test path isolation independently
    // from missing-key rejection. The advisor metadata is foreign too.
    const foreign = advisorFigures('C', snap, months);
    const guardedTable = { ...table, ...(advisor ? foreign.table : figureTable(paths.find(p => p.letter === 'C')!)) };
    const figures = new Map([...room.figures, ...foreign.figures]);
    const corpus = attacks({ valid, wrongPath: valid.replace(/^B/, 'C'), unknown: 'B.does.not.exist', wrongSign });
    if (corpus.length < 120) throw new Error('Attack corpus below minimum');
    const check = (input: string, echo = false) => {
      const userNumbers = echo ? [Math.abs(snap.active.lowest.cash)] : [];
      if (advisor) {
        const result = checkAdvisorText(input, { letter: 'B', table: guardedTable, figures, months, userNumbers });
        return { text: result.segments.map(s => s.text).join(''), flagged: result.dropped > 0 };
      }
      const result = (surface === 'guardText' ? guardText : guardSentences)(input, {
        pathId: 'B', table: guardedTable, userNumbers, allowedIds: path.assumptions.map(a => a.id),
      });
      // Future-self returns guarded text even when clean=false. A flag alone
      // must not be scored as blocking text which the caller still returns.
      return { text: result.withheld ? '' : result.text, flagged: !result.clean };
    };
    const rows = corpus.map((attack, index) => {
      const result = check(attack.sim_input, attack.echoUserNumber);
      let leaked = result.text.includes(attack.sim_target);
      if (attack.requiresFigure) leaked &&= result.text.includes(formatRand(table[valid]!));
      if (attack.category.endsWith('_placeholder')) leaked ||= /-?R\d/.test(result.text);
      return { id: `sim_${surface}_${index + 1}`, category: attack.category, sim_input: attack.sim_input,
        sim_output: result.text, leaked, flagged: result.flagged, sim_user_numbers: attack.echoUserNumber ? [Math.abs(snap.active.lowest.cash)] : [] };
    });
    const categories = Object.fromEntries([...new Set(rows.map(r => r.category))].sort().map(category => {
      const subset = rows.filter(r => r.category === category);
      return [category, { attempts: subset.length, blocked: subset.filter(r => !r.leaked).length,
        leaked: subset.filter(r => r.leaked).length, leaks: subset.filter(r => r.leaked) }];
    }));
    const controls = ['This is a possible future.', `Projected cash is {{fig:${valid}}}.`].map(sim_input => {
      const result = check(sim_input);
      return { sim_input, sim_output: result.text, passed: !result.flagged && result.text.length > 0 &&
        (!sim_input.includes('{{fig:') || result.text.includes(formatRand(table[valid]!))) };
    });
    return { surface, attempts: rows.length, blocked: rows.filter(r => !r.leaked).length,
      leaked: rows.filter(r => r.leaked).length, categories, controls,
      control_mismatches: controls.filter(c => !c.passed).length, corpus_hash: hash(corpus) };
  });
  return { attempts: results.reduce((n, r) => n + r.attempts, 0), blocked: results.reduce((n, r) => n + r.blocked, 0),
    leaked: results.reduce((n, r) => n + r.leaked, 0), control_mismatches: results.reduce((n, r) => n + r.control_mismatches, 0),
    results, limitations: [
      'Authored hostile replies, not sampled model responses; no live model was called.',
      'A leak means the targeted hostile span or false figure claim survives in returned text; flags alone do not block it.',
      'Advice and guarantees are separate categories from numeric leaks; this is not a universal semantic scorer.',
      'The advisor uses its real figure metadata; future-self uses the real guardSentences called by answerAsFutureSelf.',
      'Prompt-injection cases measure output filtering, not model resistance to following instructions.',
      'Coverage is finite; correct placeholders can still support bad reasoning or a false claim.',
    ] };
}

async function determinism(networkCount: () => number) {
  const runs = [];
  for (const path of paths) for (const stressed of [false, true]) {
    const req = requestFor(path, stressed);
    const active = () => stressed ? applySetback(structuredClone(path), 'late-payment') : structuredClone(path);
    const engines = [simulate(active()), simulate(active())];
    const swarms = [];
    // Sequential: each fixture invocation completes before another starts.
    for (const _ of [false, true]) {
      void _;
      swarms.push(await runSwarm(structuredClone(req), () => {}, { config: null, now: () => 0, fetch: globalThis.fetch }));
    }
    const pair = (values: unknown[]) => ({ identical: canonicalJson(values[0]) === canonicalJson(values[1]),
      hash: hash(values[0]), repeat_hash: hash(values[1]) });
    runs.push({ sim_path: path.letter, sim_stressed: stressed, engine: pair(engines), swarm: pair(swarms),
      fixture_complete: swarms.every(s => s.mode === 'fixture' && s.traces.every(t => t.status === 'done') && s.verification.every(v => v.pass)) });
  }
  return { runs, comparisons: runs.length * 2, mismatches: runs.filter(r => !r.engine.identical || !r.swarm.identical || !r.fixture_complete),
    network_attempts: networkCount(), limitations: ['Only authored fixture mode is checked, not live provider determinism.',
      'Full canonical engine and swarm results are hashed, including fixture trace fields; no fields are dropped before hashing.'] };
}

function contextEngineering() {
  const rows: { agent: typeof AGENTS[number]; sim_path: string; sim_focus_month: number; hops: number; budget: number;
    nodes: number; full_nodes: number; estimated_tokens: number; full_estimated_tokens: number;
    estimated_tokens_saved: number; saving_percent: number; truncated: boolean; estimate_matches: boolean }[] = [];
  const budget = 1400, hops = 2;
  for (const path of paths) {
    const graph = buildDecisionGraph(path);
    for (const agent of AGENTS) for (const row of simulate(path).likely.rows) {
      const context = graph.contextFor(agent, `month:${row.month}`, budget, hops);
      const independent = estimateTokens({ nodes: context.nodes, edges: context.edges });
      const full = estimateTokens({ nodes: graph.nodes, edges: graph.edges });
      rows.push({ agent, sim_path: path.letter, sim_focus_month: row.month, hops, budget,
        nodes: context.nodes.length, full_nodes: graph.nodes.length, estimated_tokens: context.estimatedTokens,
        full_estimated_tokens: context.fullEstimatedTokens, estimated_tokens_saved: context.estimatedTokensSaved,
        saving_percent: 100 * (full - independent) / full, truncated: context.truncated,
        estimate_matches: independent === context.estimatedTokens && full === context.fullEstimatedTokens && context.estimatedTokensSaved === Math.max(0, full - independent) });
    }
  }
  const agents = AGENTS.map(agent => {
    const selected = rows.filter(r => r.agent === agent);
    return { agent, contexts: selected.length, median_saving_percent: median(selected.map(r => r.saving_percent)),
      median_estimated_tokens_saved: median(selected.map(r => r.estimated_tokens_saved)),
      paths: paths.map(path => { const subset = selected.filter(r => r.sim_path === path.letter); return {
        sim_path: path.letter, contexts: subset.length, median_saving_percent: median(subset.map(r => r.saving_percent)),
        median_estimated_tokens_saved: median(subset.map(r => r.estimated_tokens_saved)),
      }; }) };
  });
  return { contexts: rows.length, agents, rows, mismatches: rows.filter(r => !r.estimate_matches),
    limitations: ['Character-based estimate: ceiling of canonical JSON string length divided by four, exactly as the graph module uses.',
      'Covers every specialist agent and every month focus on each baseline demo path, using the swarm context budget and hop count.',
      'Savings cover serialized graph context only, not full prompts, billed tokens, answer quality or runtime speed.'] };
}

function engineTruth() {
  const proposals = [];
  for (const path of paths) for (const stressed of [false, true]) {
    for (const candidate of proposalCandidates(requestFor(path, stressed))) {
      // Apply values independently: do not call editAssumption or reuse candidate arithmetic.
      const edited = { ...path, assumptions: path.assumptions.map(a => a.id === candidate.assumptionId ? { ...a, ...candidate.values, source: 'you' as const } : { ...a }) };
      const after = simulate(stressed ? applySetback(edited, 'late-payment') : edited);
      const before = simulate(stressed ? applySetback(path, 'late-payment') : path);
      const afterLowest = Math.min(...after.likely.rows.map(r => r.cash));
      const beforeLowest = Math.min(...before.likely.rows.map(r => r.cash));
      proposals.push({ sim_path: path.letter, sim_stressed: stressed, candidate: candidate.id,
        sim_after_lowest: candidate.afterLowest, sim_independent_after_lowest: afterLowest,
        matches: candidate.afterLowest === afterLowest && candidate.beforeLowest === beforeLowest && candidate.delta === afterLowest - beforeLowest });
    }
  }
  const breakpointInputs: { label: string; path: PathInput }[] = paths.map(path => ({ label: path.letter, path }));
  const contract = paths.find(p => p.letter === 'B')!;
  breakpointInputs.push({ label: 'baseline_already_short', path: { ...contract, startingCash: -1e6 } },
    { label: 'capped', path: { ...contract, startingCash: 1e9 } });
  const breakpoints = breakpointInputs.map(({ label, path }) => {
    const result = findBreakpoint(path);
    const cap = Math.min(36, path.months ?? 36);
    const hasContract = path.assumptions.some(a => a.kind === 'income' && a.role === 'contract');
    // Independent receipt shift and exhaustive sweep, not delayPath or binary search.
    const sweep = Array.from({ length: cap + 1 }, (_, delay) => {
      const shifted = { ...path, assumptions: path.assumptions.map(a => a.kind === 'income' && a.role === 'contract' ? {
        ...a, fromMonth: (a.fromMonth ?? 1) + delay, toMonth: (a.toMonth ?? path.months ?? 36) + delay,
      } : { ...a }) };
      return { sim_delay_months: delay, survives: simulate(shifted).likely.rows.every(r => r.cash >= 0) };
    });
    const expected = hasContract ? sweep.filter(r => r.survives).at(-1)?.sim_delay_months ?? null : null;
    const delay = result.applicable ? result.longestDelayMonths : undefined;
    const survivesAt = typeof delay === 'number' ? sweep[delay]?.survives ?? false : null;
    const survivesNext = typeof delay === 'number' && delay < cap ? sweep[delay + 1]!.survives : null;
    const matches = !hasContract ? result.applicable === false : !sweep[0]!.survives
      ? result.applicable === true && result.baselineAlreadyShort === true && delay === null
      : result.applicable === true && delay === expected && survivesAt === true &&
        (delay === cap ? result.capped === true : result.capped === false && survivesNext === false);
    return { sim_path: label, sim_result: result, sim_expected_delay: expected, survives_at_returned_delay: survivesAt,
      survives_one_month_more: survivesNext, matches, sweep };
  });
  return { candidates_checked: proposals.length, breakpoints_checked: breakpoints.length, proposals, breakpoints,
    mismatches: [...proposals.filter(p => !p.matches), ...breakpoints.filter(b => !b.matches)],
    limitations: ['Independent reapplication and exhaustive delay search use the same cash engine; this does not independently validate its economics.',
      'Survival means non-negative month-end likely-case cash within the horizon; it is not real business survival.',
      'Checks every returned proposal candidate, including baseline and late-payment scenarios; the proposal module itself caps its menu.'] };
}

function documentParsing() {
  if (clauses.length < 30) throw new Error('Clause corpus below minimum');
  const rows = clauses.map((entry, i) => {
    const actual = proposalFor({ kind: entry.kind, quote: entry.sim_quote, page: 1, box: [0, 0, 100, 100] });
    const normalized = actual ? { kind: actual.kind, sim_value: actual.value } : null;
    const correct = canonicalJson(normalized) === canonicalJson(entry.expected) && (!actual ||
      actual.quote === entry.sim_quote && actual.page === 1 && actual.source === 'document-unverified');
    return { id: `sim_clause_${i + 1}`, ...entry, sim_actual: normalized, correct };
  });
  return { attempts: rows.length, correct: rows.filter(r => r.correct).length, wrong: rows.filter(r => !r.correct).length,
    wrong_cases: rows.filter(r => !r.correct), cases: rows,
    limitations: ['Hand-written text clauses with authored expectations, not OCR, vision, PDFs or a legal accuracy benchmark.',
      'Expected policy is literal unambiguous calendar days or one explicit rand amount; ambiguous or conditional terms should abstain.',
      'A parsed proposal remains unverified document text and requires founder confirmation; this suite does not apply it to the engine.'] };
}

async function main() {
  let networkAttempts = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { networkAttempts++; throw new Error('Offline eval forbids network'); };
  try {
    const guard_attacks = guardAttacks();
    const deterministic = await determinism(() => networkAttempts);
    const context_engineering = contextEngineering();
    const engine_truth = engineTruth();
    const document_parsing = documentParsing();
    const failed = guard_attacks.leaked > 0 || guard_attacks.control_mismatches > 0 || deterministic.mismatches.length > 0 ||
      context_engineering.mismatches.length > 0 || engine_truth.mismatches.length > 0 || document_parsing.wrong > 0 || networkAttempts > 0;
    const report = { status: failed ? 'FAIL' : 'PASS', evidence_kind: 'offline authored fixtures; not live model or founder validation',
      sim_fixture: { source: 'DEMO_EXTRACTION plus explicit payroll', sim_payroll, sim_paths: paths },
      network_attempts: networkAttempts, suites: { guard_attacks, determinism: deterministic, context_engineering, engine_truth, document_parsing },
      limitations: ['No API key is read and no environment file is loaded by this runner.',
        'sim_ fields identify authored inputs and projected monetary results; counts, checks and hashes are measured by code.',
        'No browser, device, human, deployed service, live model, OCR or financial outcome is evaluated.',
        'The guard does not prove sound reasoning; business assumptions can still be wrong.'] };
    const destination = new URL('../docs/immersive/evidence/evals.json', import.meta.url);
    // No timestamps, timings or host paths. Recursively canonicalize before pretty printing.
    const bytes = JSON.stringify(JSON.parse(canonicalJson(report)), null, 2) + '\n';
    await mkdir(new URL('.', destination), { recursive: true });
    await writeFile(destination, bytes, 'utf8');
    const evidenceHash = fileHash(await readFile(destination));
    console.log('Suite                  Result   Measured');
    console.log(`guard_attacks          ${guard_attacks.leaked || guard_attacks.control_mismatches ? 'FAIL' : 'PASS'}     ${guard_attacks.attempts} attempts; ${guard_attacks.blocked} blocked; ${guard_attacks.leaked} leaked`);
    console.log(`determinism            ${deterministic.mismatches.length ? 'FAIL' : 'PASS'}     ${deterministic.comparisons} comparisons; ${deterministic.mismatches.length} mismatches`);
    console.log(`context_engineering    ${context_engineering.mismatches.length ? 'FAIL' : 'PASS'}     ${context_engineering.contexts} slices; character-based estimates`);
    console.log(`engine_truth           ${engine_truth.mismatches.length ? 'FAIL' : 'PASS'}     ${engine_truth.candidates_checked} candidates; ${engine_truth.breakpoints_checked} breakpoints; ${engine_truth.mismatches.length} mismatches`);
    console.log(`document_parsing       ${document_parsing.wrong ? 'FAIL' : 'PASS'}     ${document_parsing.correct} correct; ${document_parsing.wrong} wrong`);
    console.log(`Network attempts: ${networkAttempts}. Authored sim_ fixtures; no live model or OCR.`);
    console.log('Limits: finite attack coverage; guards do not prove reasoning or business assumptions.');
    console.log(`Evidence: ${fileURLToPath(destination)}`);
    console.log(`SHA-256: ${evidenceHash}`);
    process.exitCode = failed ? 1 : 0;
  } finally { globalThis.fetch = originalFetch; }
}

main().catch(error => { console.error(`Eval could not complete: ${error instanceof Error ? error.message : String(error)}`); process.exitCode = 2; });
