/** Fixed533 forward cleanup. prepare is offline; apply is one-shot, guarded local SQL. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { staticControllerSql33, fullCatalogue33Sql, SOURCE_PINS } from './compiler.mjs';
import { RUN533, ROLES533, targetRoleSql533 } from './reconcile533.mjs';
import { verifyLocalTarget } from '../../../tools/local-postgres.mjs';

const ROOT = path.resolve(import.meta.dirname, '../../..');
const PREFIX = `.local/m07-recovery33-prepared/${RUN533}/`;
const LOCK = '.local/local-postgres/test-db.lock';
const SYSTEM = '7701520506262638626';
const EXPECTED_BASELINE = '89ce5bb54fa39dcb557ce0bf8cf10f98399ea82380357c867581dade24b1b8ee';
const LOCK_SHA = '466b9b9d98e340bee6df49f794a4862c7efd738758a73da35183940ec9ae2dc9';
const CONTROLLER = `${PREFIX}controller.mjs`;
const FAILED = 'tracking/evidence/m07/recovery33/2026-10-31T14-39-48-217Z-5332c86b.json';
const RECON = 'tracking/evidence/m07/recovery33/2026-10-31T14-49-51.508Z-533-read-only-reconciliation.json';
const PROOF = 'tracking/evidence/m07/recovery33/2026-10-31T14-55-00.036Z-533-baseline-context.json';
const PINS = Object.freeze({
  [CONTROLLER]: 'ed503574d408cb13494dc9b93abeb312977216137bee57496bed8f4f34c3a8ed',
  [FAILED]: 'a7db032931cd9ded5a40ab02a6bbd07967c47f00cc7c5a99075b55094b0d0b47',
  [RECON]: '874fdc8d27e8d7e1513d22f5249f4cb605c8e4f0ae62fc48abd5174dad6297cb',
  [PROOF]: '98e5603ea7efbee16ecdeb3060b80108ad5c558e53d66b25a49109bc37e576cc',
  'development/m07/db/catalog29.sql': SOURCE_PINS['development/m07/db/catalog29.sql'],
});
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const q = value => "'" + String(value).replaceAll("'", "''") + "'";
const literal = value => `${q(JSON.stringify(value))}::jsonb`;
const strip = value => { assert(value.startsWith('begin read only;') && /rollback;\s*$/u.test(value)); return value.slice(16).replace(/rollback;\s*$/u, '').trim(); };
const scalar = value => value.trim().replace(/;$/u, '');
const guard = (expression, expected, label) => `do $cleanup533_guard$begin if (${scalar(expression)}) is distinct from ${literal(expected)} then raise exception'CLEANUP533_${label}_MISMATCH';end if;end$cleanup533_guard$;\n`;
const DB_HEX = RUN533.replaceAll('-', '');
const DATABASES = [`eps_m07_r33_source_${DB_HEX}`, `eps_m07_r33_restore_${DB_HEX}`];
const keepCatalogue = `not(split_part(key,'|',1)='roles'and split_part(key,'|',2)in('eps_mcp_issuer_owner','eps_oauth_consent_owner'))
 and not(split_part(key,'|',1)='memberships'and regexp_split_to_array(split_part(key,'|',2),'[>/]')&&array['eps_mcp_issuer_owner','eps_oauth_consent_owner'])`;
function ownerAbsent() { try { process.kill(48928, 0); return false; } catch (error) { return error.code === 'ESRCH'; } }
function baselineGuard(sql, expected) {
  const body = strip(sql), at = body.lastIndexOf('select jsonb_build_object('); assert(at > 0);
  return "do $cleanup533_baseline_role$begin if current_user<>'postgres'then raise exception'CLEANUP533_ORIGINAL_BASELINE_ROLE_REQUIRED';end if;end$cleanup533_baseline_role$;\n" + body.slice(0, at) + '\n' + guard(body.slice(at), expected, 'ORIGINAL_BASELINE');
}
function contextSql(context) {
  const keys = { search_path: 'search_path', timezone: 'TimeZone', date_style: 'DateStyle', interval_style: 'IntervalStyle', extra_float_digits: 'extra_float_digits', bytea_output: 'bytea_output' };
  assert.equal(context.current_user, 'postgres'); assert.equal(context.session_user, 'postgres');
  return 'set local role postgres;\n' + Object.entries(keys).map(([field, setting]) => {
    assert(typeof context[field] === 'string' && context[field].length < 100 && !context[field].includes('\0'));
    return `do $cleanup533_context$begin perform set_config(${q(setting)},${q(context[field])},true);end$cleanup533_context$;`;
  }).join('\n') + '\n';
}
export function validateCleanupInputs533(data) {
  assert.equal(sha(data.controller), PINS[CONTROLLER]);
  assert.equal(data.before.run_id, RUN533); assert.equal(data.before.cleanup_unconfirmed, true);
  assert.equal(data.before.original_baseline_sha256, EXPECTED_BASELINE);
  assert.equal(data.proof.native_exact_original_baseline_match, true);
  assert.equal(data.proof.native_current_baseline_sha256, EXPECTED_BASELINE);
  assert.equal(sha(JSON.stringify(data.native.native_baseline)), EXPECTED_BASELINE);
  assert.deepEqual(data.native.native_context, data.proof.native_context);
  for (const key of ['original_full_catalogue_except_owned_roles_matches_before', 'original_roles_oids_attributes_memberships_except_owned_match_before',
    'both_task_databases_absent', 'owner_process_absent', 'target_roles_owned_and_dependency_free', 'target_role_memberships_match_expected_graph']) assert.equal(data.recon[key], true);
  assert.equal(data.recon.other_clients, 0); assert.deepEqual(data.recon.client_pids, []);
  assert.equal(data.recon.original_baseline_matches_before, false); // Retained historical context mismatch is never rewritten.
  assert.deepEqual(data.recon.target_roles.map(role => [role.name, String(role.oid)]), [[ROLES533[0], '185012'], [ROLES533[1], '185052']]);
  assert(data.recon.target_roles.every(role => role.marker_matches && role.marker === `eps-m07-recovery33:${RUN533}:${role.name === ROLES533[0] ? 'issuer' : 'consent'}`
    && role.dependencies.length === 0 && ['login','super','inherit','bypassrls','create_role','create_db','replication'].every(key => role[key] === false)));
  assert(data.before.existing_global_roles_before.roles.every(role => !ROLES533.includes(role.name)));
}
export function buildCleanupSql533(data, { after = false, readOnly = false } = {}) {
  validateCleanupInputs533(data);
  const constants = staticControllerSql33(data.controller.toString('utf8'));
  const globalQuery = strip(constants.rolesSql);
  const withoutOwnedGlobal = `select jsonb_build_object('roles',(select coalesce(jsonb_agg(value order by value->>'name'),'[]')from jsonb_array_elements(snapshot->'roles')where value->>'name'not in('eps_mcp_issuer_owner','eps_oauth_consent_owner')),
 'memberships',(select coalesce(jsonb_agg(value order by(value->>'role_oid')::oid,(value->>'member_oid')::oid,(value->>'grantor_oid')::oid),'[]')from jsonb_array_elements(snapshot->'memberships')where not(value->>'role_oid'in('185012','185052')or value->>'member_oid'in('185012','185052')or value->>'grantor_oid'in('185012','185052'))))from(${scalar(globalQuery)})g(snapshot)`;
  const withoutOwnedCatalogue = `select coalesce(jsonb_object_agg(key,value),'{}')from jsonb_each((${scalar(data.catalogueSql)}))where ${keepCatalogue}`;
  const baseline = contextSql(data.native.native_context) + baselineGuard(constants.baselineSql, data.native.native_baseline);
  const normalized = "set local role supabase_admin;set local search_path='';set local timezone='UTC';\n";
  const generalGuard = `do $cleanup533_identity$begin if current_database()<>'postgres'or session_user<>'supabase_admin'
 or(select system_identifier::text from pg_control_system())<>'${SYSTEM}'
 or(select count(*)from supabase_migrations.schema_migrations)<>29 or(select max(version)from supabase_migrations.schema_migrations)<>'20261030111549'
 or exists(select 1 from pg_database where datname in(${DATABASES.map(q).join(',')}))
 or exists(select 1 from pg_stat_activity where backend_type='client backend'and pid<>pg_backend_pid())
 then raise exception'CLEANUP533_ORIGINAL29_QUIET_DATABASE_REQUIRED';end if;end$cleanup533_identity$;\n`;
  const fullPost = baseline + normalized + generalGuard + guard(globalQuery, data.before.existing_global_roles_before, 'GLOBAL_ROLES_AFTER')
    + guard(data.catalogueSql, data.originalCatalogue, 'FULL_CATALOGUE_AFTER')
    + guard(`select ${targetRoleSql533()}`, [], 'OWNED_ROLES_ABSENT');
  let sql = `${readOnly ? 'begin read only;' : 'begin;'}set local standard_conforming_strings=on;set local lock_timeout='5s';set local statement_timeout='30s';
set local log_statement='none';set local log_min_error_statement='panic';\n${normalized}${generalGuard}`;
  if (after) sql += fullPost;
  else {
    sql += `lock table pg_catalog.pg_authid,pg_catalog.pg_auth_members,pg_catalog.pg_shdepend in share row exclusive mode;\n`
      + guard(`select ${targetRoleSql533()}`, data.recon.target_roles, 'EXACT_OWNED_ROLES')
      + guard(withoutOwnedGlobal, data.before.existing_global_roles_before, 'GLOBAL_ROLES_BEFORE')
      + guard(withoutOwnedCatalogue, data.originalCatalogue, 'FULL_CATALOGUE_BEFORE') + baseline + normalized;
    sql += 'drop role eps_oauth_consent_owner;\ndrop role eps_mcp_issuer_owner;\n' + fullPost;
  }
  sql += `select jsonb_build_object('scope','fixed533_guarded_direct_drop','run_id','${RUN533}','original_baseline_and_catalogue_exact',true,'global_roles_exact',true,'owned_roles_absent',true,'both_task_databases_absent',true,'other_clients',0);\n${readOnly ? 'rollback;' : 'commit;'}\n`;
  assert(!/^\s*(?:revoke|drop\s+owned|reassign\s+owned|drop\s+database)\b/imu.test(sql));
  assert(!/^\s*drop\s+role\b[^;]*\bcascade\b/imu.test(sql));
  assert(Buffer.byteLength(sql) < 16 * 1024 * 1024);
  return sql;
}
async function readInputs() {
  const bytes = new Map(); for (const [file, pin] of Object.entries(PINS)) { const value = await readFile(path.join(ROOT, file)); assert.equal(sha(value), pin); bytes.set(file, value); }
  const before = JSON.parse(bytes.get(FAILED)), recon = JSON.parse(bytes.get(RECON)), proof = JSON.parse(bytes.get(PROOF));
  const originalPath = `${before.private_artifact_directory}/original29-full-auth-storage-catalogue.json`;
  const originalBytes = await readFile(path.join(ROOT, originalPath)); assert.equal(sha(originalBytes), before.original29_full_auth_storage_catalogue_sha256);
  assert.equal(proof.private_baseline_artifact, `.local/m07-recovery/${RUN533}/native-baseline-diagnostic-2026-10-31T14-55-00.036Z.json`);
  const nativeBytes = await readFile(path.join(ROOT, proof.private_baseline_artifact));
  const data = { before, recon, proof, native: JSON.parse(nativeBytes), originalCatalogue: JSON.parse(originalBytes), controller: bytes.get(CONTROLLER),
    catalogueSql: fullCatalogue33Sql(bytes).sql };
  validateCleanupInputs533(data);
  const closure = ['development/m07/recovery33/cleanup533.mjs','development/m07/recovery33/compiler.mjs','development/m07/recovery33/ownership.mjs','development/m07/recovery33/reconcile533.mjs','development/m07/recovery29/identity.mjs','tools/local-postgres.mjs'];
  const sourceHashes = Object.fromEntries(await Promise.all(closure.map(async file => [file, sha(await readFile(path.join(ROOT, file)))])));
  return { data, sourceHashes, inputHashes: { ...PINS, [originalPath]: sha(originalBytes), [proof.private_baseline_artifact]: sha(nativeBytes) } };
}
async function verifyLock() {
  const file = path.join(ROOT, LOCK), stat = await lstat(file); assert(stat.isFile() && !stat.isSymbolicLink());
  const bytes = await readFile(file); assert.equal(sha(bytes), LOCK_SHA); assert.deepEqual(JSON.parse(bytes), { run_id: RUN533, pid: 48928 }); assert(ownerAbsent()); return bytes;
}
async function prepare() {
  const { data, sourceHashes, inputHashes } = await readInputs(); await verifyLock();
  const sql = buildCleanupSql533(data), post = buildCleanupSql533(data, { after: true, readOnly: true });
  const manifest = { schema_version: '1.0', run_id: RUN533, scope: 'fixed533_guarded_direct_drop', sql_sha256: sha(sql), post_sql_sha256: sha(post),
    retained_lock_sha256: LOCK_SHA, source_hashes: sourceHashes, input_hashes: inputHashes, permitted_role_oids: ['185012','185052'], replay_allowed: false, database_deletion: false };
  await writeFile(path.join(ROOT, PREFIX, 'cleanup533.sql'), sql, { flag: 'wx', mode: 0o600 });
  await writeFile(path.join(ROOT, PREFIX, 'cleanup533-post.sql'), post, { flag: 'wx', mode: 0o600 });
  await writeFile(path.join(ROOT, PREFIX, 'cleanup533-manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  process.stdout.write(JSON.stringify({ prepared: true, manifest: `${PREFIX}cleanup533-manifest.json`, sql_sha256: manifest.sql_sha256, post_sql_sha256: manifest.post_sql_sha256, source_hashes: sourceHashes, sql_bytes: Buffer.byteLength(sql) }) + '\n');
}
async function databaseCommand(sql, target) {
  const env = {}; for (const key of ['PATH','SystemRoot','WINDIR','USERPROFILE','APPDATA','LOCALAPPDATA','HOMEDRIVE','HOMEPATH','TEMP','TMP']) if (typeof process.env[key] === 'string') env[key] = process.env[key];
  const host = process.platform === 'win32' ? 'npipe:////./pipe/dockerDesktopLinuxEngine' : 'unix:///var/run/docker.sock';
  return new Promise((resolve, reject) => {
    const child = spawn('docker', ['--host', host, 'exec', '--user', 'postgres', '-i', target.container.Id, 'psql', '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-h', '/var/run/postgresql', '-U', 'supabase_admin', '-d', 'postgres'], { cwd: ROOT, env, shell: false, windowsHide: true, stdio: ['pipe','pipe','pipe'] });
    let length = 0, settled = false; const output = [];
    const stop = () => { if (settled) return; settled = true; clearTimeout(timer); child.kill(); reject(Error('CLEANUP533_SQL_UNCONFIRMED')); };
    const timer = setTimeout(stop, 40000); child.once('error', stop);
    child.stdout.on('data', chunk => { length += chunk.length; if (length > 2 * 1024 * 1024) stop(); else if (!settled) output.push(chunk); });
    child.stderr.on('data', chunk => { length += chunk.length; if (length > 2 * 1024 * 1024) stop(); });
    child.once('close', code => { if (settled) return; if (code !== 0) return stop(); settled = true; clearTimeout(timer); resolve(Buffer.concat(output).toString('utf8')); });
    child.stdin.on('error', () => {}); child.stdin.end(sql);
  });
}
function successOutput(text) {
  const rows = text.split(/\r?\n/u).filter(line => line.startsWith('{')).map(line => JSON.parse(line));
  assert.deepEqual(rows, [{ scope: 'fixed533_guarded_direct_drop', run_id: RUN533, original_baseline_and_catalogue_exact: true, global_roles_exact: true, owned_roles_absent: true, both_task_databases_absent: true, other_clients: 0 }]);
}
async function apply() {
  const { data, sourceHashes, inputHashes } = await readInputs(), lockBytes = await verifyLock();
  const manifestBytes = await readFile(path.join(ROOT, PREFIX, 'cleanup533-manifest.json')), manifest = JSON.parse(manifestBytes);
  assert.deepEqual(manifest.source_hashes, sourceHashes); assert.deepEqual(manifest.input_hashes, inputHashes); assert.equal(manifest.run_id, RUN533);
  const sql = await readFile(path.join(ROOT, PREFIX, 'cleanup533.sql')), post = await readFile(path.join(ROOT, PREFIX, 'cleanup533-post.sql'));
  assert.equal(sha(sql), manifest.sql_sha256); assert.equal(sha(post), manifest.post_sql_sha256);
  assert.equal(sql.toString(), buildCleanupSql533(data)); assert.equal(post.toString(), buildCleanupSql533(data, { after: true, readOnly: true }));
  const target = await verifyLocalTarget(); assert.equal(target.observed.system_identifier, SYSTEM); await verifyLock();
  await writeFile(path.join(ROOT, PREFIX, 'cleanup533-execution-claim.json'), JSON.stringify({ run_id: RUN533, claimed_at: new Date().toISOString(), manifest_sha256: sha(manifestBytes), dispatch_may_have_occurred: true, replay_allowed: false }) + '\n', { flag: 'wx', mode: 0o600 });
  successOutput(await databaseCommand(sql, target)); successOutput(await databaseCommand(post, target));
  assert((await verifyLock()).equals(lockBytes));
  const receipt = { schema_version: '1.0', observed_at: new Date().toISOString(), run_id: RUN533, scope: 'fixed533_guarded_direct_drop',
    manifest_sha256: sha(manifestBytes), sql_sha256: manifest.sql_sha256, post_sql_sha256: manifest.post_sql_sha256,
    original_baseline_exact: true, original_full_catalogue_exact: true, all_preexisting_global_roles_exact: true, role_oids_removed: ['185012','185052'],
    both_task_databases_absent: true, no_other_clients: true, independent_read_only_postcheck: true, retained_lock_sha256: LOCK_SHA, lock_released: false };
  // Only this exact owned lock is removed after the committed transaction and independent postcheck.
  await unlink(path.join(ROOT, LOCK)); receipt.lock_released = true;
  const file = `tracking/evidence/m07/recovery33/${receipt.observed_at.replaceAll(':','-')}-533-guarded-cleanup.json`;
  await writeFile(path.join(ROOT, file), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' }); process.stdout.write(JSON.stringify({ evidence: file, ...receipt }) + '\n');
}
async function main() { assert.equal(process.argv.length, 3); assert(!process.env.NODE_OPTIONS); if (process.argv[2] === 'prepare') await prepare(); else if (process.argv[2] === 'apply') await apply(); else throw Error('CLEANUP533_ARGUMENTS_INVALID'); }
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) main().catch(() => { process.stderr.write('CLEANUP533_UNCONFIRMED_RETAIN_CLAIM_AND_LOCK_DO_NOT_REPLAY\n'); process.exitCode = 1; });
