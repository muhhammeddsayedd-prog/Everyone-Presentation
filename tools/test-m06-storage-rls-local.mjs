/** Fixed owned-local26 composed Storage RLS RED/GREEN; all DDL/data rolls back.
 * No app/worker/provider secret file or cloud CLI is used. Readback excludes
 * every credential column BEFORE serialization or hashing. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, unlink, writeFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import { runOwnedLocalSql, verifyLocalTarget } from './local-postgres.mjs';
const sha = value => createHash('sha256').update(value).digest('hex'), read = file => readFile(file, 'utf8');
const rows = value => value.split(/\r?\n/u).filter(line => line.startsWith('{')).map(line => JSON.parse(line));
assert(process.argv.length <= 3 && (!process.argv[2] || process.argv[2] === '--red26'));
const red = process.argv[2] === '--red26', id = randomUUID(), application = `eps-m06-storage-${id}`;
const CANDIDATE = 'development/m06/storage-rls-forward.sql', SNAPSHOT = 'tools/sql/m06-forward26-readback.sql';
const fixtures = ['tests/db/m04-assignments-fixture.sql', 'tests/db/m05-versions-fixture.sql', 'tests/db/m05-versions.sql', 'tests/db/m05-processing.sql', 'tests/db/m06-credential-admission.sql'];
const files = [CANDIDATE, SNAPSHOT, ...fixtures, 'tests/db/m06-storage-rls.sql', 'tests/db/m06-storage-worker-hook.sql', 'tools/test-m06-storage-rls-local.mjs', 'tools/local-postgres.mjs', 'development/local-db/instance.json', 'development/m06/baseline26-reviewed.json'];
let locked = false, original;
const report = { schema_version: '1.0', run_id: id, started_at: new Date().toISOString(), result: 'failed', mode: red ? 'red26' : 'candidate27', scope: 'Owned isolated local26; synthetic asset/Storage metadata and real anon/authenticated composed SELECT, all candidate DDL/data rolled back', cloud_called: false, provider_called: false, application_worker_guest_configuration_loaded: false, secret_columns_excluded_before_readback_hashing: true };
async function execute(sql, target) { return new Promise((resolve, reject) => {
  const child = spawn('docker', ['--host', process.platform === 'win32' ? 'npipe:////./pipe/dockerDesktopLinuxEngine' : 'unix:///var/run/docker.sock', 'exec', '--user', 'postgres', '-i', target.container.Id, 'psql', '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-h', '/var/run/postgresql', '-U', 'supabase_admin', '-d', 'postgres'], { shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  let stdout = '', stderr = '', size = 0; const timer = setTimeout(() => child.kill(), 60000);
  child.stdout.on('data', value => { stdout += value; size += value.length; if (size > 16 * 1024 * 1024) child.kill(); });
  child.stderr.on('data', value => { stderr += value; size += value.length; if (size > 16 * 1024 * 1024) child.kill(); });
  child.once('error', () => reject(Error('LOCAL_STORAGE_RLS_UNCONFIRMED'))); child.once('close', code => { clearTimeout(timer); if (code) reject(Object.assign(Error('LOCAL_STORAGE_RLS_UNCONFIRMED'), { privateDiagnostic: stderr })); else resolve({ stdout, stderr }); }); child.stdin.end(sql);
}); }
try {
  const source = Object.fromEntries(await Promise.all(files.map(async file => [file, await read(file)]))); report.source_seals = Object.fromEntries(files.map(file => [file, sha(source[file])]));
  const target = await verifyLocalTarget(); assert.equal(target.observed.system_identifier, '7701520506262638626');
  const handle = await open('.local/local-postgres/test-db.lock', 'wx', 0o600); await handle.writeFile(JSON.stringify({ run_id: id, pid: process.pid })); await handle.close(); locked = true;
  original = rows((await runOwnedLocalSql(source[SNAPSHOT])).stdout)[0]; assert.equal(original.old_data.versions.length, 26); assert.equal(original.old_data.versions.at(-1), '20261030004643');
  const texts = fixtures.map(file => source[file]); const external = "'m05-synthetic-internal','Synthetic internal','internal'"; assert.equal(texts[1].split(external).length, 2); texts[1] = texts[1].replace(external, "'m06-storage-synthetic-external','Synthetic external','external'");
  const workerAnchor = "if grant_value->>'sha256'<>pdf_asset->>'sha256'then raise exception'M05_PRIOR_ATTEMPT_OUTPUT_READ_FAILED';end if;";
  assert.equal(texts[3].split(workerAnchor).length, 2); texts[3] = texts[3].replace(workerAnchor, workerAnchor + '\n' + source['tests/db/m06-storage-worker-hook.sql']);
  const sql = `begin;set local role postgres;set local search_path='';set local application_name='${application}';${red ? '' : source[CANDIDATE]}set local role supabase_auth_admin;alter table auth.users enable row level security;set local role postgres;${texts.join('\n')}\n${source['tests/db/m06-storage-rls.sql']}rollback;`;
  const output = await execute(sql, target); report.markers = output.stdout.split(/\r?\n/u).filter(line => /^M06_STORAGE_.*_PASSED$/u.test(line)); assert.equal(report.markers.length, 4);
  report.behavior_passed = true; report.stdout_sha256 = sha(output.stdout); report.sources_stable = (await Promise.all(files.map(async file => sha(await read(file)) === report.source_seals[file]))).every(Boolean); assert(report.sources_stable);
} catch (error) {
  const folder = `.local/m06-storage-rls/${id}`; await mkdir(folder, { recursive: true }); await writeFile(`${folder}/diagnostic.txt`, error.privateDiagnostic ?? String(error.stack ?? error)); report.private_diagnostic = `${folder}/diagnostic.txt`;
  report.meaningful_composed_select_red = String(error.privateDiagnostic ?? '').includes('M06_STORAGE_COMPOSED_SELECT_MISMATCH:anon:frame:object.get_authenticated:0');
} finally {
  if (locked) { report.backend_settled = rows((await runOwnedLocalSql(`begin read only;select jsonb_build_object('count',count(*))from pg_stat_activity where application_name='${application}';rollback;`)).stdout)[0].count === 0;
    if (report.backend_settled && original) { const after = rows((await runOwnedLocalSql(await read(SNAPSHOT))).stdout)[0]; report.rollback_verified = isDeepStrictEqual(original, after); report.original_safe_snapshot_sha256 = sha(JSON.stringify(original)); report.after_safe_snapshot_sha256 = sha(JSON.stringify(after));
      if (report.rollback_verified) { assert.equal(JSON.parse(await read('.local/local-postgres/test-db.lock')).run_id, id); await unlink('.local/local-postgres/test-db.lock'); }
    }
  }
  if (report.behavior_passed && report.backend_settled && report.rollback_verified && report.sources_stable) report.result = 'passed'; report.finished_at = new Date().toISOString();
  await mkdir('tracking/evidence/m06/storage-rls-local', { recursive: true }); const file = `tracking/evidence/m06/storage-rls-local/${report.finished_at.replace(/[:.]/gu, '-')}-${id.slice(0, 8)}.json`; await writeFile(file, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  process.stdout.write(JSON.stringify({ result: report.result, receipt: file, red: report.meaningful_composed_select_red, rollback: report.rollback_verified, diagnostic: report.private_diagnostic }) + '\n'); if (report.result !== 'passed') process.exitCode = 1;
}
