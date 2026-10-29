/** Current-source offline gates. Logs are ignored; receipts contain hashes/counts only. */
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { clearTimeout, setTimeout } from 'node:timers';
import { isDeepStrictEqual } from 'node:util';

const ROOT = path.resolve(import.meta.dirname, '..');
const runId = randomUUID();
const hash = value => createHash('sha256').update(value).digest('hex');
const SOURCE_ROOTS = ['apps', 'packages', 'contracts', 'tests'];
const CONTROL_FILES = ['package.json', 'package-lock.json', 'tsconfig.json', 'eslint.config.mjs', 'tools/run-tests.mjs'];
const SKIP = new Set(['node_modules', '.next', '.next-e2e', 'dist', 'coverage', '.local', '__pycache__']);
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json', '.yaml', '.yml', '.css', '.sql', '.svg', '.html', '.md']);

async function sourceSnapshot() {
  const files = [...CONTROL_FILES];
  async function visit(relative) {
    for (const entry of await readdir(path.join(ROOT, relative), { withFileTypes: true })) {
      if (entry.isSymbolicLink()) throw new Error('SOURCE_SYMLINK_UNCONFIRMED');
      if (SKIP.has(entry.name) || entry.name.startsWith('.env') || entry.name === 'next-env.d.ts' || entry.name.endsWith('.tsbuildinfo')) continue;
      const file = `${relative}/${entry.name}`;
      if (entry.isDirectory()) await visit(file);
      else if (entry.isFile() && (SOURCE_EXTENSIONS.has(path.extname(entry.name)) || entry.name.startsWith('Dockerfile'))) files.push(file);
    }
  }
  for (const directory of SOURCE_ROOTS) await visit(directory);
  return Object.fromEntries(await Promise.all([...new Set(files)].sort().map(async file => [file, hash(await readFile(path.join(ROOT, file)))])));
}

function testCounts(stdout, stderr) {
  const metrics = Object.fromEntries(['tests', 'pass', 'fail', 'skipped', 'cancelled', 'todo'].map(name => [name, []]));
  // Node's reporter writes summaries to stderr; its prefix may be Unicode or TAP '#'.
  // Only punctuation/whitespace may precede the fixed ASCII metric, avoiding test titles.
  const ansi = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'gu');
  const text = Buffer.concat([stdout, Buffer.from('\n'), stderr]).toString('utf8').replace(ansi, '');
  for (const match of text.matchAll(/^[^A-Za-z0-9_\r\n]*(tests|pass|fail|skipped|cancelled|todo)[ \t]+([0-9]+)[ \t]*$/gmu)) metrics[match[1]].push(Number(match[2]));
  for (const name of ['tests', 'pass', 'fail', 'skipped', 'cancelled']) assert.equal(metrics[name].length, 6, `SIX_REQUIRED_TEST_SUMMARIES:${name}`);
  assert(metrics.tests.every(value => value > 0));
  const totals = Object.fromEntries(Object.entries(metrics).map(([name, values]) => [name, values.reduce((total, value) => total + value, 0)]));
  assert(totals.tests >= 443); assert.equal(totals.pass, totals.tests); assert.equal(totals.fail + totals.skipped + totals.cancelled + totals.todo, 0);
  return { ...totals, suites: 6 };
}

async function gate(name, args, directory) {
  const started = new Date().toISOString(); const npm = path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
  await readFile(npm);
  const result = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [npm, ...args], { cwd: ROOT, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const stdout = []; const stderr = []; let size = 0; let exceeded = false;
    const timer = setTimeout(() => { exceeded = true; child.kill(); }, name === 'build' ? 240_000 : 180_000);
    const record = (chunks, chunk) => { chunks.push(Buffer.from(chunk)); size += chunk.length; if (size > 16 * 1024 * 1024) { exceeded = true; child.kill(); } };
    child.stdout.on('data', chunk => record(stdout, chunk)); child.stderr.on('data', chunk => record(stderr, chunk));
    child.once('error', () => { clearTimeout(timer); reject(new Error('OFFLINE_GATE_TRANSPORT_UNCONFIRMED')); });
    child.once('close', code => { clearTimeout(timer); resolve({ code, exceeded, stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr) }); });
  });
  await Promise.all([writeFile(path.join(directory, `${name}.stdout.log`), result.stdout, { flag: 'wx' }), writeFile(path.join(directory, `${name}.stderr.log`), result.stderr, { flag: 'wx' })]);
  const record = { name, command: `npm.cmd ${args.join(' ')}`, started_at: started, finished_at: new Date().toISOString(), exit_code: result.code,
    result: result.code === 0 && !result.exceeded ? 'passed' : 'failed', stdout_sha256: hash(result.stdout), stderr_sha256: hash(result.stderr), stdout_bytes: result.stdout.length, stderr_bytes: result.stderr.length };
  if (name === 'npm-test' && record.result === 'passed') {
    try { record.counts = testCounts(result.stdout, result.stderr); }
    catch { record.result = 'unconfirmed'; record.counts_unconfirmed = true; }
  }
  process.stdout.write(JSON.stringify({ group: name, result: record.result, exit_code: record.exit_code, ...(record.counts ? { counts: record.counts } : {}) }) + '\n');
  return record;
}

async function main() {
  assert.equal(process.argv.length, 2);
  const report = { run_id: runId, observed_at: new Date().toISOString(), result: 'failed', scope: 'Current app/package/contract/test source offline test/lint/production build gates. No browser, cloud, SQL, native media, provider, hosting or private-configuration acceptance.',
    cloud_called: false, provider_called: false, sql_called: false, capture_tool_read_private_configuration_files: false, private_configuration_files_modified: false, source_roots: SOURCE_ROOTS,
    excluded_generated_directories: [...SKIP], excluded_generated_file: 'apps/web/next-env.d.ts', control_files: CONTROL_FILES,
    unrelated_tools_in_source_stability_claim: false, harness_sha256: hash(await readFile(import.meta.filename)), groups: [] };
  const directory = path.join(ROOT, '.local/m03-quality', runId); await mkdir(directory, { recursive: true });
  report.source_sha256 = await sourceSnapshot(); report.source_count = Object.keys(report.source_sha256).length;
  report.generated_next_env_before_sha256 = hash(await readFile(path.join(ROOT, 'apps/web/next-env.d.ts')));
  try {
    const settled = await Promise.allSettled([gate('npm-test', ['test'], directory), gate('lint', ['run', 'lint'], directory)]);
    for (const result of settled) { if (result.status === 'fulfilled') report.groups.push(result.value); else report.transport_unconfirmed = true; }
    assert(report.groups.length === 2 && report.groups.every(group => group.result === 'passed'));
    assert.deepEqual(await sourceSnapshot(), report.source_sha256, 'SOURCE_CHANGED_DURING_TEST_AND_LINT');
    const build = await gate('build', ['run', 'build'], directory); report.groups.push(build); assert.equal(build.result, 'passed');
    report.source_after_sha256 = await sourceSnapshot(); report.sources_stable = isDeepStrictEqual(report.source_sha256, report.source_after_sha256);
    assert.equal(report.sources_stable, true); report.result = 'passed';
  } catch {
    report.diagnostic = 'CURRENT_OFFLINE_GATES_UNCONFIRMED';
    report.source_after_sha256 = await sourceSnapshot(); report.sources_stable = isDeepStrictEqual(report.source_sha256, report.source_after_sha256);
  } finally {
    report.generated_next_env_after_sha256 = hash(await readFile(path.join(ROOT, 'apps/web/next-env.d.ts')));
    report.finished_at = new Date().toISOString(); const evidence = path.join(ROOT, 'tracking/evidence/m03/remaining-current-quality'); await mkdir(evidence, { recursive: true });
    const file = path.join(evidence, `${report.finished_at.replace(/[:.]/gu, '-')}-${runId.slice(0, 8)}.json`); await writeFile(file, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
    process.stdout.write(JSON.stringify({ result: report.result, receipt: path.relative(ROOT, file).replaceAll('\\', '/'), sources_stable: report.sources_stable, source_count: report.source_count }) + '\n');
    if (report.result !== 'passed') process.exitCode = 1;
  }
}
main().catch(() => { process.stderr.write('Current quality capture stopped; no service fallback.\n'); process.exitCode = 1; });
