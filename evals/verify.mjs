// Two fresh key-free processes, one at a time. Expected findings still exit 1.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const env = Object.fromEntries(Object.entries(process.env).filter(([name]) =>
  !/key|token|secret|password|credential|^NODE_OPTIONS$|^DOTENV/i.test(name)));
const root = fileURLToPath(new URL('../', import.meta.url));
const hashes = [], exits = [], counts = [];
for (const run of [1, 2]) {
  const result = spawnSync(process.platform === 'win32' ? process.execPath : 'npm',
    process.platform === 'win32' ? [join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'), 'run', 'eval'] : ['run', 'eval'], {
    cwd: root, env, encoding: 'utf8', windowsHide: true,
  });
  if (result.error) throw result.error;
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  if (result.status !== 0 && result.status !== 1) throw new Error(`Run ${run} did not finish: exit ${result.status}`);
  if (!result.stdout.includes('SHA-256: ')) throw new Error(`Run ${run} did not write evidence`);
  const bytes = readFileSync(new URL('../docs/immersive/evidence/evals.json', import.meta.url));
  const report = JSON.parse(bytes);
  if (result.status !== (report.status === 'FAIL' ? 1 : 0)) throw new Error('Exit status does not match evidence');
  const lines = result.stdout.trim().split(/\r?\n/).length;
  if (lines > 25) throw new Error(`Summary exceeds limit: ${lines} lines`);
  hashes.push(createHash('sha256').update(bytes).digest('hex'));
  exits.push(result.status);
  counts.push(lines);
}
const identical = hashes[0] === hashes[1];
console.log(JSON.stringify({ byte_identical: identical, hashes, exits, stdout_lines: counts }));
process.exitCode = identical && exits[0] === exits[1] ? 0 : 1;
