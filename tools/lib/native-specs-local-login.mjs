/** Fixed owned-local test identity. Never imported by the app or production worker.
 * Provisioning is separate from transport; no runtime admin fallback exists.
 */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { clearTimeout, setTimeout } from 'node:timers';
import { verifyNativeSpecsLocalTarget } from './native-specs-local-transport.mjs';

const ROOT = path.resolve(import.meta.dirname, '../..');
const ENDPOINT = process.platform === 'win32' ? 'npipe:////./pipe/dockerDesktopLinuxEngine' : 'unix:///var/run/docker.sock';
const ROLE = 'eps_native_specs_local_probe';
const HBA_SHA256 = '05a3001844d0d4c02690e4a7091f0cb73dcd29d8b5c5df940f493901f9eca40d';
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u;
const SOURCES = Object.freeze({
  create: { path: 'tools/sql/local-native-specs-login-create.sql', sha256: 'c666593d7122dccec120bfdaa3ded384b9c2fdeaf14638c4949fb0ac8b40e665' },
  drop: { path: 'tools/sql/local-native-specs-login-drop.sql', sha256: 'db4a4e74022bc559a6204af4addb21d0870579989223404b6891c43913a9f4bd' },
});
export const LOCAL_NATIVE_LOGIN_SETTINGS = Object.freeze({
  log_parameter_max_length: '0', log_parameter_max_length_on_error: '0', log_statement: 'none',
  log_min_duration_statement: '-1', log_min_duration_sample: '-1', log_transaction_sample_rate: '0',
  'auto_explain.log_min_duration': '-1', 'auto_explain.log_parameter_max_length': '0',
  'pgaudit.log': 'none', 'pgaudit.log_parameter': 'off', 'pgaudit.role': '',
});
function assert(value, code) { if (!value) throw new Error(code); }
function validateRun(runId) { assert(typeof runId === 'string' && UUID.test(runId), 'LOCAL_LOGIN_RUN_REQUIRED'); }
async function requireLock(runId) {
  validateRun(runId);
  const file = path.join(ROOT, '.local/local-postgres/test-db.lock');
  const info = await lstat(file);
  assert(info.isFile() && !info.isSymbolicLink() && info.size <= 1024, 'LOCAL_LOGIN_OWNED_LOCK_REQUIRED');
  const lock = JSON.parse(await readFile(file, 'utf8'));
  assert(lock.run_id === runId && lock.pid === process.pid, 'LOCAL_LOGIN_OWNED_LOCK_REQUIRED');
}
async function command(containerId, role, sql, { tcp = false } = {}) {
  assert(['supabase_admin', ROLE].includes(role), 'LOCAL_LOGIN_ROLE_REJECTED');
  return await new Promise((resolve, reject) => {
    const child = spawn('docker', ['--host', ENDPOINT, 'exec', '--user', role === ROLE ? '65534:65534' : 'postgres', '-i', containerId,
      'env', '-i', 'PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin', 'HOME=/tmp',
      'PGPASSFILE=/dev/null', 'PGCONNECT_TIMEOUT=3', 'PGSSLMODE=disable', 'PGAPPNAME=eps-native-specs-login-fixture',
      'psql', '-X', '-q', '-A', '-t', '-w', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=sqlstate', '-v', 'SHOW_CONTEXT=never',
      '-h', tcp ? '127.0.0.1' : '/var/run/postgresql', '-p', '5432', '-U', role, '-d', 'postgres'],
    { cwd: ROOT, shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = ''; let errors = 0; let uncertain = false;
    const timer = setTimeout(() => { uncertain = true; child.kill(); }, 12000);
    child.stdin.on('error', () => {});
    child.stdout.on('data', chunk => { if (stdout.length + chunk.length > 65536) { uncertain = true; child.kill(); } else stdout += chunk.toString('utf8'); });
    child.stderr.on('data', chunk => { errors += chunk.length; if (errors > 65536) { uncertain = true; child.kill(); } });
    child.on('error', () => { uncertain = true; });
    child.on('close', code => {
      clearTimeout(timer);
      if (uncertain) reject(new Error('LOCAL_LOGIN_OPERATION_UNCONFIRMED'));
      else resolve({ code, stdout });
    });
    child.stdin.end(sql);
  });
}
async function source(operation) {
  const entry = SOURCES[operation];
  const absolute = path.resolve(ROOT, entry.path);
  assert(await realpath(absolute) === absolute, 'LOCAL_LOGIN_SOURCE_LINK_REJECTED');
  const bytes = await readFile(absolute);
  assert(createHash('sha256').update(bytes).digest('hex') === entry.sha256, 'LOCAL_LOGIN_SOURCE_CHANGED');
  return bytes.toString('utf8');
}
function row(output) {
  const rows = output.split(/\r?\n/u).filter(line => line.startsWith('{'));
  assert(rows.length === 1, 'LOCAL_LOGIN_INSPECTION_UNCONFIRMED');
  try { return JSON.parse(rows[0]); } catch { throw new Error('LOCAL_LOGIN_INSPECTION_UNCONFIRMED'); }
}
const inspectSql = `begin read only;
select jsonb_build_object('session_user',session_user,'current_user',current_user,
 'client_address',host(inet_client_addr()),'server_address',host(inet_server_addr()),'server_port',inet_server_port(),
 'settings',(select jsonb_object_agg(name,current_setting(name)) from unnest(array[${Object.keys(LOCAL_NATIVE_LOGIN_SETTINGS).map(key => `'${key}'`).join(',')}]) name),
 'member',pg_has_role(current_user,'eps_jobs_executor','USAGE'),
 'attributes',(select jsonb_build_object('login',rolcanlogin,'superuser',rolsuper,'bypassrls',rolbypassrls,'createdb',rolcreatedb,'createrole',rolcreaterole,'replication',rolreplication) from pg_roles where rolname=current_user),
 'no_business_table_access',not exists(select 1 from pg_class relation join pg_namespace namespace on namespace.oid=relation.relnamespace
  where relation.relkind in('r','p') and (namespace.nspname='eps' or namespace.nspname='public' and relation.relname in('projects','clients','project_memberships','app_capability_grants')
   or namespace.nspname='auth' and relation.relname='users')
  and (has_table_privilege(current_user,relation.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
   or has_any_column_privilege(current_user,relation.oid,'SELECT,INSERT,UPDATE,REFERENCES'))),
 'only_four_stage_routines',(select count(*)=4 and bool_and(namespace.nspname='eps' and routine.oid=any(array[
  'eps.claim_job_stage(jsonb)'::regprocedure,'eps.get_specs_stage_input(uuid,uuid,text)'::regprocedure,
  'eps.record_job_event(jsonb)'::regprocedure,'eps.recover_job_stages(integer)'::regprocedure]))
  from pg_proc routine join pg_namespace namespace on namespace.oid=routine.pronamespace
  where (namespace.nspname='eps' or namespace.nspname='public' and routine.proname like 'eps\\_%' escape '\\')
  and has_function_privilege(current_user,routine.oid,'EXECUTE')),
 'marker',shobj_description((select oid from pg_roles where rolname=current_user),'pg_authid'));
rollback;`;

/** Observed managed-image HBA only. No HBA write or credential-auth claim. */
export async function readNativeSpecsLocalHba(runId) {
  await requireLock(runId); const target = await verifyNativeSpecsLocalTarget();
  const result = await command(target.container.Id, 'supabase_admin', `begin read only;
select jsonb_build_object('hba_sha256',(select encode(sha256(convert_to(jsonb_agg(to_jsonb(rule) order by rule_number)::text,'UTF8')),'hex') from pg_hba_file_rules rule),
 'loopback_rule',(select jsonb_build_object('type',type,'address',address,'netmask',netmask,'database',database,'user_name',user_name,'auth_method',auth_method,'options',options,'error',error) from pg_hba_file_rules where rule_number=3));
rollback;`);
  assert(result.code === 0, 'LOCAL_LOGIN_HBA_UNCONFIRMED'); const observed = row(result.stdout);
  const expected = { type: 'host', address: '127.0.0.1', netmask: '255.255.255.255', database: ['all'],
    user_name: ['all'], auth_method: 'trust', options: null, error: null };
  assert(observed.hba_sha256 === HBA_SHA256 && observed.loopback_rule
    && Object.keys(expected).length === Object.keys(observed.loopback_rule).length
    && Object.keys(expected).every(key => JSON.stringify(observed.loopback_rule[key]) === JSON.stringify(expected[key])), 'LOCAL_LOGIN_HBA_CHANGED');
  return { hba_sha256: HBA_SHA256, auth_method: 'trust', connection: 'container_ipv4_loopback', credential_authentication_verified: false };
}

/** Direct trusted-loopback authorization test. This does not authenticate credentials. */
export async function probeNativeSpecsLocalLogin(runId) {
  await requireLock(runId); const target = await verifyNativeSpecsLocalTarget();
  const hba = await readNativeSpecsLocalHba(runId);
  const ownership = await inspectNativeSpecsLocalLogin(runId);
  assert(ownership.present && ownership.owned && ownership.active_sessions === 0, 'LOCAL_LOGIN_SCOPE_REJECTED');
  const observed = await command(target.container.Id, ROLE, inspectSql, { tcp: true });
  assert(observed.code === 0, 'LOCAL_LOGIN_TRUSTED_LOOPBACK_REJECTED');
  const result = row(observed.stdout);
  assert(result.current_user === ROLE && result.session_user === ROLE && result.member === true
    && result.client_address === '127.0.0.1' && result.server_address === '127.0.0.1' && result.server_port === 5432
    && result.marker === `everyone-presentation-local-native-specs:${runId}`
    && result.no_business_table_access === true && result.only_four_stage_routines === true
    && result.attributes?.login === true
    && ['superuser','bypassrls','createdb','createrole','replication'].every(key => result.attributes[key] === false), 'LOCAL_LOGIN_SCOPE_REJECTED');
  assert(Object.keys(LOCAL_NATIVE_LOGIN_SETTINGS).every(key => result.settings[key] === LOCAL_NATIVE_LOGIN_SETTINGS[key]), 'LOCAL_LOGIN_LOGGING_REJECTED');
  return { ...result, local_direct_role_authorization_verified: true, role: ROLE, hba,
    credential_authentication_verified: false, local_auth_method: 'trust',
    limits: 'Synthetic local DB-role authorization only. Internal TRUST permits role impersonation; OS nobody is not an authentication boundary. No hosted identity, HBA change or production transport.' };
}

/** Caller owns the shared local DB lock and must review setup bytes first. */
export async function createNativeSpecsLocalLogin(runId) {
  await requireLock(runId); const target = await verifyNativeSpecsLocalTarget();
  await readNativeSpecsLocalHba(runId);
  const sql = await source('create');
  const result = await command(target.container.Id, 'supabase_admin',
    `begin; set local lock_timeout='2s'; set local statement_timeout='8s'; set local eps.native_specs.run_id='${runId}';\n${sql}\ncommit;`);
  assert(result.code === 0, 'LOCAL_LOGIN_CREATE_UNCONFIRMED');
  return { role: ROLE, setup_sha256: SOURCES.create.sha256, marker: `everyone-presentation-local-native-specs:${runId}` };
}

/** Independent read after an unknown setup result. Never adopts a collision. */
export async function inspectNativeSpecsLocalLogin(runId) {
  await requireLock(runId); const target = await verifyNativeSpecsLocalTarget();
  const result = await command(target.container.Id, 'supabase_admin', `begin read only;
select jsonb_build_object('present',exists(select 1 from pg_roles where rolname='${ROLE}'),
 'owned',coalesce((select shobj_description(oid,'pg_authid')='everyone-presentation-local-native-specs:${runId}' from pg_roles where rolname='${ROLE}'),false),
 'scope',coalesce((select rolcanlogin and not rolinherit and not rolsuper and not rolbypassrls and not rolcreatedb
  and not rolcreaterole and not rolreplication and rolconnlimit=4 and rolvaliduntil is null and rolpassword is null
  from pg_authid where rolname='${ROLE}'),false),
 'membership',(select count(*)=1 and bool_and(granted.rolname='eps_jobs_executor' and membership.inherit_option
  and not membership.set_option and not membership.admin_option) from pg_auth_members membership
  join pg_roles granted on granted.oid=membership.roleid where membership.member=(select oid from pg_roles where rolname='${ROLE}')
  or membership.roleid=(select oid from pg_roles where rolname='${ROLE}')),
 'defaults',(select jsonb_object_agg(split_part(entry,'=',1),substr(entry,strpos(entry,'=')+1)) from pg_db_role_setting settings,
  lateral unnest(settings.setconfig) entry where settings.setrole=(select oid from pg_roles where rolname='${ROLE}') and settings.setdatabase=0),
 'database_defaults',exists(select 1 from pg_db_role_setting where setrole=(select oid from pg_roles where rolname='${ROLE}') and setdatabase<>0),
 'owned_objects',exists(select 1 from pg_shdepend where refclassid='pg_authid'::regclass and refobjid=(select oid from pg_roles where rolname='${ROLE}') and deptype='o'),
 'active_sessions',(select count(*) from pg_stat_activity where usename='${ROLE}'));
rollback;`);
  assert(result.code === 0, 'LOCAL_LOGIN_STATE_UNCONFIRMED');
  const observed = row(result.stdout);
  assert(typeof observed.present === 'boolean' && typeof observed.owned === 'boolean'
    && Number.isSafeInteger(observed.active_sessions) && observed.active_sessions >= 0, 'LOCAL_LOGIN_STATE_UNCONFIRMED');
  assert(!observed.present || observed.owned, 'LOCAL_LOGIN_COLLISION_PRESERVED');
  if (observed.present) assert(observed.scope === true && observed.membership === true
    && observed.database_defaults === false && observed.owned_objects === false
    && observed.defaults && Object.keys(observed.defaults).length === Object.keys(LOCAL_NATIVE_LOGIN_SETTINGS).length
    && Object.keys(LOCAL_NATIVE_LOGIN_SETTINGS).every(key => observed.defaults[key] === LOCAL_NATIVE_LOGIN_SETTINGS[key]), 'LOCAL_LOGIN_SCOPE_CHANGED');
  return observed;
}

/** Drop refuses changed privileges/settings/ownership or any unsettled session. */
export async function dropNativeSpecsLocalLogin(runId) {
  await requireLock(runId); const target = await verifyNativeSpecsLocalTarget();
  const sql = await source('drop');
  const result = await command(target.container.Id, 'supabase_admin',
    `begin; set local lock_timeout='2s'; set local statement_timeout='8s'; set local eps.native_specs.run_id='${runId}';\n${sql}\ncommit;`);
  assert(result.code === 0, 'LOCAL_LOGIN_DROP_UNCONFIRMED');
  const check = await command(target.container.Id, 'supabase_admin',
    `begin read only; select jsonb_build_object('absent',not exists(select 1 from pg_roles where rolname='${ROLE}')); rollback;`);
  assert(check.code === 0 && row(check.stdout).absent === true, 'LOCAL_LOGIN_REMOVAL_UNCONFIRMED');
  return { absent: true, cleanup_sha256: SOURCES.drop.sha256 };
}
