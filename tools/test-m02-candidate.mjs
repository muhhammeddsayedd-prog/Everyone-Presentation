/** Reviewed M02 DDL + assertions in ONE owned local transaction, always rollback. */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { verifyLocalTarget } from './local-postgres.mjs';
const root = path.resolve(import.meta.dirname, '..');
const candidatePath = 'development/m02/jobs-outbox-candidate.sql';
const testPath = 'tests/db/m02-jobs-outbox.sql';
const hashes = {
  candidate: '6d11982be08f17c435196d60891844b5691a9375af25b7b3e440bf9353506281',
  assertions: 'd6c96529bf1588f9c053c8449b6f2f6bec5ae443263a441b47cbecbd091ff30b',
};
const sha256 = value => createHash('sha256').update(value).digest('hex');
function assert(condition, reason) { if (!condition) throw new Error(reason); }
async function localSql(sql) {
  const { config } = await verifyLocalTarget();
  return new Promise((resolve, reject) => {
    const child = spawn('docker', ['exec', '-i', '--user', 'postgres', config.container, 'psql', '--host', '/var/run/postgresql',
      '--username', 'postgres', '--dbname', 'postgres', '--no-psqlrc', '--set', 'ON_ERROR_STOP=1', '--tuples-only', '--no-align', '--quiet'],
    { cwd: root, shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = ''; let reason;
    const timer = setTimeout(() => { reason = 'Local candidate rehearsal exceeded its bounded timeout.'; child.kill(); }, 45_000);
    function collect(destination, value) {
      if (destination === 'stdout') stdout += value; else stderr += value;
      if (stdout.length + stderr.length > 256 * 1024) { reason = 'Local candidate output exceeded its bound.'; child.kill(); }
    }
    child.stdout.setEncoding('utf8').on('data', value => collect('stdout', value));
    child.stderr.setEncoding('utf8').on('data', value => collect('stderr', value));
    child.stdin.on('error', () => undefined);
    child.once('error', () => { clearTimeout(timer); reject(new Error('Owned local candidate process could not start.')); });
    child.once('close', code => {
      clearTimeout(timer);
      if (reason || code !== 0) reject(new Error(reason ?? stderr.replace(/[A-Za-z0-9_-]{43,}/gu, '[LONG_VALUE_REDACTED]').slice(0, 4000)));
      else resolve(stdout);
    });
    child.stdin.end(sql);
  });
}
const inspectionSql = `begin read only;
select jsonb_build_object(
 'versions',(select jsonb_agg(version order by version) from supabase_migrations.schema_migrations),
 'candidate_tables',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='eps' and c.relname in('jobs','job_events','outbox_events')),
 'candidate_roles',(select count(*) from pg_roles where rolname in('eps_jobs_owner','eps_jobs_dispatcher')),
 'candidate_functions',(select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='eps' and p.proname in('jobs_can_access','jobs_dispatch_mode','jobs_dto','jobs_remember','jobs_hash_v1','jobs_add_dispatch','m02_enqueue_specs_job','claim_job_outbox','finish_job_outbox') or n.nspname='public' and p.proname in('eps_get_job','eps_list_jobs','eps_retry_job','eps_cancel_job')),
 'app_policy_count',(select count(*) from pg_policy p join pg_class c on c.oid=p.polrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='eps' or n.nspname='public' and c.relname in('clients','projects','project_memberships','client_memberships','app_capability_grants')),
 'row_counts',jsonb_build_object('auth',(select count(*) from auth.users),'clients',(select count(*) from public.clients),'projects',(select count(*) from public.projects),
   'capabilities',(select count(*) from public.app_capability_grants),'project_memberships',(select count(*) from public.project_memberships),'client_memberships',(select count(*) from public.client_memberships),
   'workspaces',(select count(*) from eps.workspaces),'audit',(select count(*) from eps.audit_events),'idempotency',(select count(*) from eps.idempotency_records))
) as state; rollback;`;
async function inspect() {
  const output = await localSql(inspectionSql);
  const lines = output.split(/\r?\n/u).filter(line => line.startsWith('{'));
  assert(lines.length === 1, 'Candidate catalog inspection returned an unexpected shape.');
  return JSON.parse(lines[0]);
}
async function main() {
  assert(process.argv.length === 2 && /^v24\./u.test(process.version), 'Pinned Node24 and no target/file arguments are required.');
  const candidate = await readFile(path.join(root, candidatePath)); const assertions = await readFile(path.join(root, testPath));
  assert(sha256(candidate) === hashes.candidate && sha256(assertions) === hashes.assertions, 'Candidate/assertion bytes are not the reviewed sealed files.');
  const marker = '-- EPS_M02_CANDIDATE_SQL'; const text = assertions.toString('utf8');
  assert(text.split(marker).length === 2 && /\bbegin;\s*-- EPS_M02_CANDIDATE_SQL/u.test(text) && /\brollback;\s*$/iu.test(text), 'Candidate composition must remain one rollback transaction.');
  assert(!/^\s*(?:commit|rollback);/imu.test(candidate.toString('utf8')) && !/^\s*\\/mu.test(candidate.toString('utf8') + text), 'Transaction-control or psql commands are not allowed in the candidate.');
  const before = await inspect();
  assert(before.versions.join(',') === '20261028010943,20261028013324,20261028013655,20261028024205,20261028072515'
    && before.candidate_tables === 0 && before.candidate_roles === 0 && before.candidate_functions === 0, 'Require original five-version local target with no candidate objects to adopt.');
  let error;
  // A replacement callback preserves PostgreSQL $$ delimiters literally; using
  // a replacement string would interpret them as JavaScript substitution syntax.
  const composed = "set eps.local_fixture_tests='eps-presentation-canonical-pg17-local';\n" + text.replace(marker, () => candidate.toString('utf8'));
  try { await localSql(composed); }
  catch (failure) { error = failure; }
  const after = await inspect(); const restored = JSON.stringify(before) === JSON.stringify(after);
  const receipt = { observed_at: new Date().toISOString(), result: !error && restored ? 'passed' : 'failed',
    environment: 'owned isolated local PostgreSQL; synthetic Auth/Storage catalog', candidate_path: candidatePath, assertions_path: testPath, hashes, composed_sql_sha256: sha256(composed),
    rolled_back: !error, catalog_and_rows_restored: restored, before, after, cloud_called: false, concurrent_sessions_tested: false, restart_tested: false,
    worker_callbacks_tested: false, provider_called: false, ...(error ? { reason: error.message } : {}),
    limitations: 'Single transaction DDL/role/SQL assertions only; no persisted M02 migration, concurrent claims, process restart, stage callbacks, specs UI or provider acceptance.' };
  const directory = path.join(root, 'tracking/evidence/m02/candidate'); await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, receipt.observed_at.replace(/[:.]/gu, '-') + '-rollback.json'), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
  process.stdout.write(JSON.stringify(receipt, null, 2) + '\n');
  assert(receipt.result === 'passed', 'Candidate SQL assertions or catalog rollback failed.');
}
main().catch(error => { process.stderr.write(error.message + '\n'); process.exitCode = 1; });
