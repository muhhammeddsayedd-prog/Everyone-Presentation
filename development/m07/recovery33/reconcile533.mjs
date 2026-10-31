/** Fixed533 reconciliation only. Import/build/project perform no database IO.
 * inspect is READ ONLY and never drops roles, replays a run or removes a lock. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { verifyLocalTarget } from '../../../tools/local-postgres.mjs';
import { staticControllerSql33, fullCatalogue33Sql, SOURCE_PINS } from './compiler.mjs';
import { normalizeDatabaseOid } from '../recovery29/identity.mjs';

const ROOT = path.resolve(import.meta.dirname, '../../..');
export const RUN533 = '5332c86b-b1f9-410e-8702-647031182b17';
export const ROLES533 = ['eps_mcp_issuer_owner', 'eps_oauth_consent_owner'];
const CONTROLLER = `.local/m07-recovery33-prepared/${RUN533}/controller.mjs`;
const CONTROLLER_SHA = 'ed503574d408cb13494dc9b93abeb312977216137bee57496bed8f4f34c3a8ed';
const FAILED = 'tracking/evidence/m07/recovery33/2026-10-31T14-39-48-217Z-5332c86b.json';
const LOCK = '.local/local-postgres/test-db.lock';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const q = value => "'" + String(value).replaceAll("'", "''") + "'";
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const stripTransaction = value => { assert(value.startsWith('begin read only;') && /rollback;\s*$/u.test(value)); return value.slice('begin read only;'.length).replace(/rollback;\s*$/u, ''); };
export function targetRoleSql533() {
  const marker = `case r.rolname when 'eps_mcp_issuer_owner'then 'eps-m07-recovery33:${RUN533}:issuer'else 'eps-m07-recovery33:${RUN533}:consent'end`;
  return `(select coalesce(jsonb_agg(jsonb_build_object('name',r.rolname,'oid',r.oid,'marker_matches',shobj_description(r.oid,'pg_authid')=${marker},
 'marker',case when shobj_description(r.oid,'pg_authid')=${marker} then ${marker} else null end,
 'login',r.rolcanlogin,'super',r.rolsuper,'inherit',r.rolinherit,'bypassrls',r.rolbypassrls,'create_role',r.rolcreaterole,'create_db',r.rolcreatedb,'replication',r.rolreplication,'connection_limit',r.rolconnlimit,'valid_until',r.rolvaliduntil,
 'memberships',(select coalesce(jsonb_agg(jsonb_build_object('role_oid',roleid,'member_oid',member,'grantor_oid',grantor,'admin',admin_option,'inherit',inherit_option,'set',set_option)order by roleid,member,grantor),'[]')from pg_auth_members where roleid=r.oid or member=r.oid or grantor=r.oid),
 'dependencies',(select coalesce(jsonb_agg(jsonb_build_object('dbid',dbid,'classid',classid,'objid',objid,'objsubid',objsubid,'deptype',deptype)order by dbid,classid,objid,objsubid),'[]')from pg_shdepend where refclassid='pg_authid'::regclass and refobjid=r.oid))order by r.rolname),'[]')from pg_roles r where r.rolname in('eps_mcp_issuer_owner','eps_oauth_consent_owner'))`;
}
export function buildReconciliationSql533(controller, catalogueSql) {
  assert.equal(sha(controller), CONTROLLER_SHA);
  const constants = staticControllerSql33(Buffer.from(controller).toString('utf8'));
  const hex = RUN533.replaceAll('-', ''), databases = [`eps_m07_r33_source_${hex}`, `eps_m07_r33_restore_${hex}`];
  return `begin read only;
set local search_path='';set local timezone='UTC';set local lock_timeout='5s';set local statement_timeout='20s';
do $fixed533$begin if current_database()<>'postgres' or(select system_identifier::text from pg_control_system())<>'7701520506262638626'
 or(select count(*)from supabase_migrations.schema_migrations)<>29 or(select max(version)from supabase_migrations.schema_migrations)<>'20261030111549'
 then raise exception'RECONCILE533_EXACT_ORIGINAL29_REQUIRED';end if;end$fixed533$;
${stripTransaction(constants.baselineSql)}
${stripTransaction(constants.rolesSql)}
${catalogueSql}
select jsonb_build_object('scope','fixed533_read_only_reconciliation','run_id','${RUN533}',
 'target_roles',${targetRoleSql533()},
 'database_exists',jsonb_build_object('${databases[0]}',exists(select 1 from pg_database where datname='${databases[0]}'),'${databases[1]}',exists(select 1 from pg_database where datname='${databases[1]}')),
 'other_clients',(select count(*)from pg_stat_activity where backend_type='client backend'and pid<>pg_backend_pid()),
 'client_pids',(select coalesce(jsonb_agg(pid order by pid),'[]')from pg_stat_activity where backend_type='client backend'and pid<>pg_backend_pid()));
rollback;
`;
}
function withoutOwnedCatalogue(value) {
  return Object.fromEntries(Object.entries(value).filter(([key]) => {
    const [category, name] = key.split('|');
    return category === 'roles' ? !ROLES533.includes(name) : category === 'memberships' ? !name.split(/[>/]/u).some(part => ROLES533.includes(part)) : true;
  }));
}
export function projectReconciliation533(rows, { before, originalCatalogue, ownerProcessAbsent }) {
  assert.equal(rows.length, 4);
  const [baseline, global, catalogue, current] = rows;
  assert(object(baseline) && Object.keys(baseline).sort().join(',') === 'functions,grants,table_rows');
  assert(object(global) && Array.isArray(global.roles) && Array.isArray(global.memberships));
  assert.equal(current.scope, 'fixed533_read_only_reconciliation'); assert.equal(current.run_id, RUN533);
  const targetRoles = current.target_roles; assert(Array.isArray(targetRoles) && targetRoles.length <= 2);
  const roleKeys = ['name','oid','marker_matches','marker','login','super','inherit','bypassrls','create_role','create_db','replication','connection_limit','valid_until','memberships','dependencies'];
  for (const role of targetRoles) {
    assert(object(role) && isDeepStrictEqual(Object.keys(role).sort(), [...roleKeys].sort())); normalizeDatabaseOid(role.oid);
    assert(ROLES533.includes(role.name)); assert(typeof role.marker_matches === 'boolean');
    assert(role.marker === null || role.marker === `eps-m07-recovery33:${RUN533}:${role.name === ROLES533[0] ? 'issuer' : 'consent'}`);
    assert(Array.isArray(role.memberships) && role.memberships.length <= 4 && Array.isArray(role.dependencies) && role.dependencies.length <= 100);
    for (const row of role.memberships) {
      assert(object(row) && Object.keys(row).sort().join(',') === 'admin,grantor_oid,inherit,member_oid,role_oid,set');
      for (const key of ['role_oid','member_oid','grantor_oid']) normalizeDatabaseOid(row[key]);
      for (const key of ['admin','inherit','set']) assert(typeof row[key] === 'boolean');
    }
    for (const row of role.dependencies) {
      assert(object(row) && Object.keys(row).sort().join(',') === 'classid,dbid,deptype,objid,objsubid');
      for (const key of ['classid','dbid','objid','objsubid']) assert(/^(?:0|[1-9][0-9]{0,9})$/u.test(String(row[key])));
      assert(typeof row.deptype === 'string' && /^[A-Za-z]$/u.test(row.deptype));
    }
  }
  const hex = RUN533.replaceAll('-', ''), expectedDbKeys = [`eps_m07_r33_source_${hex}`,`eps_m07_r33_restore_${hex}`].sort();
  assert(object(current.database_exists) && isDeepStrictEqual(Object.keys(current.database_exists).sort(), expectedDbKeys));
  assert(Object.values(current.database_exists).every(value => typeof value === 'boolean'));
  assert(Number.isSafeInteger(current.other_clients) && current.other_clients >= 0 && Array.isArray(current.client_pids) && current.client_pids.length <= 1000
    && current.client_pids.every(value => Number.isSafeInteger(value) && value > 0));
  const roleIds = new Set(targetRoles.map(role => String(role.oid)));
  assert(targetRoles.every(role => ROLES533.includes(role.name)) && new Set(targetRoles.map(role => role.name)).size === targetRoles.length);
  const remaining = { roles: global.roles.filter(role => !ROLES533.includes(role.name)),
    memberships: global.memberships.filter(row => !['role_oid', 'member_oid', 'grantor_oid'].some(key => roleIds.has(String(row[key])))) };
  const baselineMatches = sha(JSON.stringify(baseline)) === before.original_baseline_sha256;
  const rolesMatch = isDeepStrictEqual(remaining, before.existing_global_roles_before);
  const catalogueMatches = isDeepStrictEqual(withoutOwnedCatalogue(catalogue), originalCatalogue);
  const dbAbsent = Object.values(current.database_exists).length === 2 && Object.values(current.database_exists).every(value => value === false);
  const rolesOwned = targetRoles.every(role => role.marker_matches === true && role.marker === `eps-m07-recovery33:${RUN533}:${role.name === ROLES533[0] ? 'issuer' : 'consent'}`
    && ['login', 'super', 'inherit', 'bypassrls', 'create_role', 'create_db', 'replication'].every(key => role[key] === false)
    && role.connection_limit === -1 && role.valid_until === null && Array.isArray(role.dependencies) && role.dependencies.length === 0);
  const postgresOid = String(before.existing_global_roles_before.roles.find(role => role.name === 'postgres')?.oid);
  const adminOid = String(before.existing_global_roles_before.roles.find(role => role.name === 'supabase_admin')?.oid);
  const membershipsExpected = targetRoles.every(role => role.memberships.length <= 2 && role.memberships.every(row => String(row.role_oid) === String(role.oid)
    && String(row.member_oid) === postgresOid && [postgresOid,adminOid].includes(String(row.grantor_oid))));
  return { schema_version: '1.0', read_only: true, scope: current.scope, run_id: RUN533,
    original_baseline_matches_before: baselineMatches, original_full_catalogue_except_owned_roles_matches_before: catalogueMatches,
    original_roles_oids_attributes_memberships_except_owned_match_before: rolesMatch,
    both_task_databases_absent: dbAbsent, database_exists: current.database_exists, other_clients: current.other_clients, client_pids: current.client_pids,
    owner_process_absent: ownerProcessAbsent, target_roles_owned_and_dependency_free: rolesOwned, target_role_memberships_match_expected_graph: membershipsExpected, target_roles: targetRoles,
    eligible_for_reviewed_cleanup: baselineMatches && catalogueMatches && rolesMatch && dbAbsent && rolesOwned && membershipsExpected && current.other_clients === 0 && ownerProcessAbsent === true };
}
async function inputs() {
  const controller = await readFile(path.join(ROOT, CONTROLLER)); assert.equal(sha(controller), CONTROLLER_SHA);
  const failedBytes = await readFile(path.join(ROOT, FAILED)), before = JSON.parse(failedBytes); assert.equal(before.run_id, RUN533); assert.equal(before.cleanup_unconfirmed, true);
  const originalBytes = await readFile(path.join(ROOT, before.private_artifact_directory, 'original29-full-auth-storage-catalogue.json'));
  assert.equal(sha(originalBytes), before.original29_full_auth_storage_catalogue_sha256);
  const sources = new Map([['development/m07/db/catalog29.sql', await readFile(path.join(ROOT, 'development/m07/db/catalog29.sql'))]]);
  assert.equal(sha(sources.get('development/m07/db/catalog29.sql')), SOURCE_PINS['development/m07/db/catalog29.sql']);
  const sql = buildReconciliationSql533(controller, fullCatalogue33Sql(sources).sql);
  return { sql, before, failedSha: sha(failedBytes), originalCatalogue: JSON.parse(originalBytes) };
}
function ownerAbsent(pid) { try { process.kill(pid, 0); return false; } catch (error) { return error.code === 'ESRCH' ? true : null; } }
async function inspect() {
  const data = await inputs(), lockBytes = await readFile(path.join(ROOT, LOCK)), lock = JSON.parse(lockBytes);
  assert.equal(lock.run_id, RUN533); assert.equal(lock.pid, 48928);
  const target = await verifyLocalTarget(); assert.equal(target.observed.system_identifier, '7701520506262638626');
  const host = process.platform === 'win32' ? 'npipe:////./pipe/dockerDesktopLinuxEngine' : 'unix:///var/run/docker.sock';
  const text = await new Promise((resolve, reject) => {
    const env = {}; for (const key of ['PATH', 'SystemRoot', 'WINDIR', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'HOMEDRIVE', 'HOMEPATH', 'TEMP', 'TMP']) if (typeof process.env[key] === 'string') env[key] = process.env[key];
    const child = spawn('docker', ['--host', host, 'exec', '--user', 'postgres', '-i', target.container.Id, 'psql', '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-h', '/var/run/postgresql', '-U', 'supabase_admin', '-d', 'postgres'],
      { cwd: ROOT, env, windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe'] });
    const chunks = []; let size = 0, settled = false;
    const stop = () => { if (settled) return; settled = true; clearTimeout(timer); child.kill(); reject(Error('RECONCILE533_READ_UNCONFIRMED')); };
    const timer = setTimeout(stop, 30000); child.once('error', stop);
    child.stdout.on('data', chunk => { size += chunk.length; if (size > 8 * 1024 * 1024) stop(); else if (!settled) chunks.push(chunk); });
    child.stderr.on('data', chunk => { size += chunk.length; if (size > 8 * 1024 * 1024) stop(); });
    child.once('close', code => { if (settled) return; if (code !== 0) return stop(); settled = true; clearTimeout(timer); resolve(Buffer.concat(chunks).toString('utf8')); });
    child.stdin.on('error', () => {}); child.stdin.end(data.sql);
  });
  assert((await readFile(path.join(ROOT, LOCK))).equals(lockBytes));
  const rows = text.split(/\r?\n/u).filter(line => line.startsWith('{')).map(line => JSON.parse(line));
  const receipt = { observed_at: new Date().toISOString(), query_sha256: sha(data.sql), failed_receipt_sha256: data.failedSha,
    retained_lock_sha256: sha(lockBytes), retained_lock_pid: lock.pid, ...projectReconciliation533(rows, { ...data, ownerProcessAbsent: ownerAbsent(lock.pid) }) };
  const file = `tracking/evidence/m07/recovery33/${receipt.observed_at.replaceAll(':', '-')}-533-read-only-reconciliation.json`;
  await writeFile(path.join(ROOT, file), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
  process.stdout.write(JSON.stringify({ evidence: file, ...receipt }) + '\n');
}
async function main() {
  assert.equal(process.argv.length, 3); assert(!process.env.NODE_OPTIONS);
  if (process.argv[2] === 'write-query') { const { sql } = await inputs(); await writeFile(path.join(ROOT, 'development/m07/recovery33/reconcile533-query.sql'), sql, { flag: 'wx' }); process.stdout.write('RECONCILE533_READ_ONLY_QUERY_WRITTEN\n'); }
  else if (process.argv[2] === 'inspect') await inspect();
  else throw Error('RECONCILE533_ARGUMENTS_INVALID');
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) main().catch(() => { process.stderr.write('RECONCILE533_UNCONFIRMED\n'); process.exitCode = 1; });
