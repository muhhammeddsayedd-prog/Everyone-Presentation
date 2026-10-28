/** Fixed synthetic rehearsal of administrative setup; no target/file overrides. */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { verifyLocalTarget } from './local-postgres.mjs';

const root = path.resolve(import.meta.dirname, '..');
const sqlHashes = {
  inspect: '40211c94d836bf9dfc9234b0c936c5fd3712e016b94b481bfacf57f3545cab6f',
  records: '53104c72a358082bf4745cbb5e6cb87dacc2a6f8bd3229826915d292dc85e610',
  grants: '6ae3ef321c1103b2f19473fe377a5e9fcaee753535b9c09fa05231624263daff',
};
const testPath = 'tests/db/m01-producer-bootstrap.sql';
const testHash = '5cb7368d90428f094a1f14666cb3511fb4eb0e6add6d049e516bf635c76bf213';
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
function require(condition, message) { if (!condition) throw new Error(message); }
async function psql(sql) {
  const { config } = await verifyLocalTarget();
  return new Promise((resolve, reject) => {
    const child = spawn('docker', ['exec', '-i', '--user', 'postgres', config.container, 'psql', '--host', '/var/run/postgresql',
      '--username', 'postgres', '--dbname', 'postgres', '--no-psqlrc', '--set', 'ON_ERROR_STOP=1', '--tuples-only', '--no-align', '--quiet'],
    { cwd: root, shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = ''; let reason;
    const timer = setTimeout(() => { reason = 'Synthetic setup SQL timed out.'; child.kill(); }, 45_000);
    const collect = (destination, value) => {
      if (destination === 'stdout') stdout += value; else stderr += value;
      if (stdout.length + stderr.length > 256 * 1024) { reason = 'Synthetic setup output exceeded its bound.'; child.kill(); }
    };
    child.stdout.setEncoding('utf8').on('data', value => collect('stdout', value));
    child.stderr.setEncoding('utf8').on('data', value => collect('stderr', value));
    child.stdin.on('error', () => undefined);
    child.once('error', () => { clearTimeout(timer); reject(new Error('Owned local test process could not start.')); });
    child.once('close', code => {
      clearTimeout(timer);
      if (reason || code !== 0) reject(new Error(reason ?? stderr.slice(0, 3000) ?? 'Synthetic setup SQL failed.'));
      else resolve(stdout);
    });
    child.stdin.end(sql);
  });
}
const countsSql = `begin read only;
select jsonb_build_object('auth',(select count(*) from auth.users),
 'clients',(select count(*) from public.clients),'projects',(select count(*) from public.projects),
 'capabilities',(select count(*) from public.app_capability_grants),
 'project_memberships',(select count(*) from public.project_memberships),
 'client_memberships',(select count(*) from public.client_memberships),
 'workspaces',(select count(*) from eps.workspaces)) as counts; rollback;`;
async function counts() {
  const output = await psql(countsSql);
  const lines = output.split(/\r?\n/u).filter(line => line.startsWith('{'));
  require(lines.length === 1, 'Local setup cleanup inspection failed.');
  return JSON.parse(lines[0]);
}
async function main() {
  require(process.argv.length === 2, 'Use node tools/test-producer-bootstrap.mjs without arguments.');
  require(/^v24\./u.test(process.version), 'Pinned Node 24 is required.');
  require(Object.keys(sqlHashes).sort().join(',') === 'grants,inspect,records' && /^[a-f0-9]{64}$/u.test(testHash), 'Synthetic setup test is not sealed.');
  const blocks = {};
  for (const [action, hash] of Object.entries(sqlHashes)) {
    const bytes = await readFile(path.join(root, `tools/sql/producer-bootstrap-${action}.sql`));
    require(sha256(bytes) === hash, 'Reviewed setup template changed.');
    const text = bytes.toString('utf8');
    const match = text.match(/-- EPS_BOOTSTRAP_ACTION_BEGIN\r?\n([\s\S]*?)\r?\n-- EPS_BOOTSTRAP_ACTION_END/u);
    require(match && (match[1].match(/__EPS_BOOTSTRAP_REQUEST_HEX__/gu) ?? []).length === 1 && !/^\s*\\/mu.test(match[1]), 'Fixed test composition seam is invalid.');
    blocks[action] = match[1];
  }
  const bytes = await readFile(path.join(root, testPath));
  require(sha256(bytes) === testHash, 'Reviewed setup assertions changed.');
  let includes = 0;
  const sql = bytes.toString('utf8').replace(/^([ \t]*)-- EPS_BOOTSTRAP_INCLUDE (inspect|records|grants) (\{[^\r\n]*\})\r?$/gmu, (_, indentation, action, input) => {
    const request = JSON.parse(input);
    require(Object.keys(request).sort().join(',') === 'client_id,client_name,principal_id,producer_email,project_id,project_name,request_id,schema_version'
      && request.schema_version === '1.0' && /^[^@\s]+@example\.invalid$/u.test(request.producer_email), 'Only exact synthetic envelopes may enter local test SQL.');
    for (const key of ['request_id', 'client_id', 'project_id', 'principal_id']) require(request[key] === null && key === 'principal_id'
      || /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u.test(request[key]), 'Synthetic test identifiers are invalid.');
    includes += 1;
    return indentation + blocks[action].replace('__EPS_BOOTSTRAP_REQUEST_HEX__', Buffer.from(JSON.stringify(request), 'utf8').toString('hex'));
  });
  require(includes > 0 && !/^\s*-- EPS_BOOTSTRAP_INCLUDE (inspect|records|grants) /mu.test(sql) && !sql.includes("'__EPS_BOOTSTRAP_REQUEST_HEX__'")
    && /\brollback;\s*$/iu.test(sql) && !/^\s*\\/mu.test(sql), 'Local setup SQL must be fully composed and rollback-only.');
  const before = await counts();
  let error;
  try { await psql("set eps.local_fixture_tests='eps-presentation-canonical-pg17-local';\n" + sql); } catch (failure) { error = failure; }
  const after = await counts();
  const cleanup = JSON.stringify(before) === JSON.stringify(after);
  const receipt = { observed_at: new Date().toISOString(), result: !error && cleanup ? 'passed' : 'failed',
    environment: 'owned isolated local PostgreSQL; synthetic auth/catalog only', sql_hashes: sqlHashes,
    test_path: testPath, test_sha256: testHash, included_actions: includes, rolled_back: !error, cleanup_confirmed: cleanup,
    before_counts: before, after_counts: after, cloud_called: false, ...(error ? { reason: error.message } : {}) };
  const directory = path.join(root, 'tracking/evidence/m01');
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, receipt.observed_at.replace(/[:.]/gu, '-') + '-producer-bootstrap-local.json'), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
  await writeFile(path.join(directory, 'producer-bootstrap-local.json'), JSON.stringify(receipt, null, 2) + '\n');
  process.stdout.write(JSON.stringify(receipt, null, 2) + '\n');
  require(receipt.result === 'passed', 'Synthetic setup assertions or rollback cleanup failed.');
}
main().catch(error => { process.stderr.write(error.message + '\n'); process.exitCode = 1; });
