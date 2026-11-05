// Combines every saved live run in evals/runs/ into evals/RESULTS.md: how often each case passed across runs, and the
// detail from the latest run. No model calls; it only reads files. Run: npm run eval:summary.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

const dir = 'evals/runs';
const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
if (files.length === 0) {
  console.error('No runs yet: run npm run eval:live first.');
  process.exit(1);
}
const runs = files.map((f) => JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')));

const cases = new Map();
for (const run of runs) {
  for (const r of run.rows) {
    const key = `${r.feature}\u0000${r.case}`;
    const c = cases.get(key) ?? { feature: r.feature, case: r.case, passes: 0, total: 0, latest: '', ms: [] };
    c.total++;
    if (r.pass) c.passes++;
    c.latest = r.detail;
    c.ms.push(r.ms);
    cases.set(key, c);
  }
}

const totalPasses = runs.reduce((n, run) => n + run.rows.filter((r) => r.pass).length, 0);
const totalCases = runs.reduce((n, run) => n + run.rows.length, 0);
const perRun = runs.map((run) => `${run.rows.filter((r) => r.pass).length}/${run.rows.length}`).join(', ');
const latest = runs[runs.length - 1];
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] / 1000;
};

const lines = [
  '# Live evaluation of the Meta features',
  '',
  `${runs.length} live run${runs.length === 1 ? '' : 's'} against ${latest.model}, ${totalPasses} of ${totalCases} case results passed (per run: ${perRun}).`,
  'Each case has a pass rule that does not depend on wording (see `evals/live.eval.ts`). The model is not deterministic, so a case can pass in one run and fail in another; the table shows how often each case passed.',
  'Each run makes real, billed calls. Run with `npm run eval:live` (repeat for more runs), then `npm run eval:summary`.',
  '',
  '| Feature | Case | Passed | Typical time | Latest detail |',
  '|---|---|---|---|---|',
  ...[...cases.values()].map(
    (c) => `| ${c.feature} | ${c.case.replace(/\|/g, '/')} | ${c.passes}/${c.total} | ${median(c.ms).toFixed(1)} s | ${c.latest.replace(/\|/g, '/')} |`,
  ),
  '',
  `Runs: ${files.map((f) => f.replace('.json', '')).join(', ')}.`,
  '',
];
writeFileSync('evals/RESULTS.md', lines.join('\n'));
console.log(`Wrote evals/RESULTS.md from ${runs.length} run(s): ${totalPasses}/${totalCases} case results passed.`);
