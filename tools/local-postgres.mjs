import { spawn } from 'node:child_process';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { existsSync, realpathSync } from 'node:fs';
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { clearTimeout, setTimeout } from 'node:timers';
import { fileURLToPath, pathToFileURL, URL } from 'node:url';

const ROOT = realpathSync(fileURLToPath(new URL('../', import.meta.url)));
const CONFIG_DIRECTORY = path.join(ROOT, 'development', 'local-db');
const PRIVATE_DIRECTORY = path.join(ROOT, '.local', 'local-postgres');
const OWNER_FILE = path.join(PRIVATE_DIRECTORY, 'owner.json');
const IDENTITY_FILE = path.join(PRIVATE_DIRECTORY, 'database-identity.json');
const ENV_FILE = path.join(PRIVATE_DIRECTORY, 'instance.env');
const WORKSPACE_KEY = createHash('sha256').update(ROOT.toLowerCase()).digest('hex').slice(0, 24);
const LABEL_OWNER = 'com.everyone.presentation.owner';
const LABEL_WORKSPACE = 'com.everyone.presentation.workspace';
const LABEL_PURPOSE = 'com.everyone.presentation.purpose';
const LABEL_INSTANCE = 'com.everyone.presentation.instance';
let secrets = [];

function safeOutput(value) {
  let result = String(value);
  for (const secret of secrets) if (secret) result = result.split(secret).join('[REDACTED]');
  return result.replace(/(postgres(?:ql)?:\/\/[^:\s/]+:)[^@\s]+@/giu, '$1[REDACTED]@');
}
function fail(message) { throw new Error(message); }
async function jsonFile(file) { return JSON.parse(await readFile(file, 'utf8')); }
async function configuration() {
  const config = await jsonFile(path.join(CONFIG_DIRECTORY, 'instance.json'));
  if (config.version !== 1 || config.purpose !== 'isolated-canonical-sql-replay'
    || config.container !== 'eps-presentation-canonical-pg17-local'
    || config.volume !== 'eps-presentation-canonical-pg17-data-v1'
    || config.network !== 'eps-presentation-canonical-pg17-bridge-v1'
    || config.host_ip !== '127.0.0.1' || config.host_port !== '55433'
    || config.container_port !== '5432/tcp' || config.database !== 'postgres'
    || config.data_path !== '/var/lib/postgresql/data'
    || !/^public\.ecr\.aws\/supabase\/postgres@sha256:[a-f0-9]{64}$/u.test(config.image_digest)) fail('Local container configuration does not match the reviewed isolated target.');
  return config;
}
async function command(args, { input, timeout = 30_000, allowFailure = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', args, { cwd: ROOT, shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = ''; let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, timeout);
    child.stdout.setEncoding('utf8').on('data', value => { stdout += value; });
    child.stderr.setEncoding('utf8').on('data', value => { stderr += value; });
    child.once('error', error => { clearTimeout(timer); reject(new Error(safeOutput(error.message))); });
    child.once('close', code => {
      clearTimeout(timer);
      const result = { code, stdout, stderr };
      if (timedOut) reject(new Error('The local Docker command exceeded its bounded timeout.'));
      else if (code !== 0 && !allowFailure) reject(new Error(safeOutput(stderr || stdout || 'The local Docker command failed.')));
      else resolve(result);
    });
    child.stdin.on('error', () => undefined);
    child.stdin.end(input);
  });
}
async function dockerJson(args) { const result = await command(args); return JSON.parse(result.stdout); }
async function ensureLocalEngine() {
  if (process.env.DOCKER_HOST && !/^(?:npipe|unix):\/\//u.test(process.env.DOCKER_HOST)) fail('Remote Docker hosts are prohibited for this local replay runner.');
  const current = (await command(['context', 'show'])).stdout.trim();
  const contexts = await dockerJson(['context', 'inspect', current]);
  const endpoint = contexts[0]?.Endpoints?.docker?.Host;
  if (typeof endpoint !== 'string' || !/^(?:npipe|unix):\/\//u.test(endpoint)) fail('A local Docker named-pipe or Unix-socket engine is required.');
  return { context: current, endpoint_kind: endpoint.split(':')[0] };
}
async function owner(create = false) {
  await mkdir(PRIVATE_DIRECTORY, { recursive: true, mode: 0o700 });
  if (!existsSync(OWNER_FILE)) {
    if (!create || existsSync(ENV_FILE)) fail('Local runtime ownership marker is missing. Existing secret/data files will not be adopted.');
    await writeFile(OWNER_FILE, JSON.stringify({ workspace: ROOT, workspace_key: WORKSPACE_KEY, instance_id: randomUUID() }, null, 2), { flag: 'wx', mode: 0o600 });
  }
  const owned = await jsonFile(OWNER_FILE);
  if (owned.workspace !== ROOT || owned.workspace_key !== WORKSPACE_KEY || !/^[a-f0-9-]{36}$/u.test(owned.instance_id)) fail('Local runtime ownership does not match this workspace.');
  if (existsSync(ENV_FILE)) {
    const values = await readFile(ENV_FILE, 'utf8');
    secrets = values.split(/\r?\n/u).filter(line => /^(?:POSTGRES_PASSWORD|PGPASSWORD)=/u.test(line)).map(line => line.slice(line.indexOf('=') + 1));
  } else if (create) {
    const password = randomBytes(32).toString('base64url'); secrets = [password];
    await writeFile(ENV_FILE, `POSTGRES_PASSWORD=${password}\nPGPASSWORD=${password}\nPOSTGRES_DB=postgres\nPGDATA=/var/lib/postgresql/data\n`, { flag: 'wx', mode: 0o600 });
  } else fail('The ignored local runtime secret file is missing.');
  return owned;
}
function labels(owned) { return { [LABEL_OWNER]: WORKSPACE_KEY, [LABEL_WORKSPACE]: ROOT, [LABEL_PURPOSE]: 'isolated-canonical-sql-replay', [LABEL_INSTANCE]: owned.instance_id }; }
function checkLabels(observed, owned) { for (const [key, value] of Object.entries(labels(owned))) if (observed?.[key] !== value) fail('Docker resource ownership differs from the workspace marker. No resource was adopted or removed.'); }
function labelArguments(owned) { return Object.entries(labels(owned)).flatMap(([key, value]) => ['--label', `${key}=${value}`]); }
async function inspectContainer(config, required = true) {
  const result = await command(['container', 'inspect', config.container], { allowFailure: true });
  if (result.code !== 0) { if (required) fail('The owned local Postgres container does not exist. Run start.'); return null; }
  return JSON.parse(result.stdout)[0];
}
async function inspectOwnedRuntime({ running = true } = {}) {
  await ensureLocalEngine(); const config = await configuration(); const owned = await owner();
  const container = await inspectContainer(config); checkLabels(container.Config.Labels, owned);
  const image = (await dockerJson(['image', 'inspect', config.image_digest]))[0];
  if (container.Image !== image.Id) fail('The local container image differs from the pinned reviewed digest.');
  const volume = (await dockerJson(['volume', 'inspect', config.volume]))[0]; checkLabels(volume.Labels, owned);
  const network = (await dockerJson(['network', 'inspect', config.network]))[0]; checkLabels(network.Labels, owned);
  if (network.Driver !== 'bridge' || network.Internal) fail('The local replay target requires the exact dedicated bridge supporting loopback publication.');
  const mounts = container.Mounts ?? [];
  if (mounts.length !== 1 || mounts[0].Type !== 'volume' || mounts[0].Name !== config.volume || mounts[0].Destination !== config.data_path) fail('Local container mounts differ from the exact owned database volume.');
  const configuredPorts = Object.entries(container.HostConfig.PortBindings ?? {}).flatMap(([port, bindings]) => (bindings ?? []).map(binding => ({ port, ...binding })));
  if (configuredPorts.length !== 1 || configuredPorts[0].port !== config.container_port || configuredPorts[0].HostIp !== config.host_ip || configuredPorts[0].HostPort !== config.host_port) fail('Local port configuration is not the exact reviewed IPv4 loopback binding.');
  if (running && !container.State.Running) fail('The owned local Postgres container is stopped. Run start.');
  if (container.State.Running) {
    const published = Object.entries(container.NetworkSettings.Ports ?? {}).flatMap(([port, bindings]) => (bindings ?? []).map(binding => ({ port, ...binding })));
    if (published.length !== 1 || published[0].port !== config.container_port || published[0].HostIp !== '127.0.0.1' || published[0].HostPort !== config.host_port) fail('Observed Docker publication includes a non-loopback or unexpected binding. SQL is prohibited.');
    const networks = Object.keys(container.NetworkSettings.Networks ?? {});
    if (networks.length !== 1 || networks[0] !== config.network) fail('The database container has an unexpected network attachment.');
  }
  return { config, owned, container, image };
}
async function psql(container, sql, databaseRole = 'postgres') {
  if (!['postgres', 'supabase_admin'].includes(databaseRole)) fail('Unsupported local database role.');
  return command(['exec', '-i', '--user', 'postgres', container, 'psql', '--host', '/var/run/postgresql', '--username', databaseRole, '--dbname', 'postgres', '--no-psqlrc', '--set', 'ON_ERROR_STOP=1', '--tuples-only', '--no-align', '--quiet'], { input: sql, timeout: 60_000 });
}
async function observeDatabase(config) {
  const result = await psql(config.container, `begin read only; select json_build_object('database',current_database(),'user',current_user,'server_version',current_setting('server_version'),'system_identifier',(pg_control_system()).system_identifier::text,'connection','container_unix_socket','auth_users_present',to_regclass('auth.users') is not null,'auth_uid_present',to_regprocedure('auth.uid()') is not null,'auth_jwt_present',to_regprocedure('auth.jwt()') is not null,'managed_roles',(select json_agg(rolname order by rolname) from pg_roles where rolname in ('postgres','anon','authenticated','service_role'))); commit;\n`);
  const resultLine = result.stdout.split(/\r?\n/u).find(line => line.trim().startsWith('{'));
  if (!resultLine) fail('Read-only local target inspection did not return an identity.');
  const identity = JSON.parse(resultLine);
  if (identity.database !== 'postgres' || identity.user !== 'postgres' || typeof identity.system_identifier !== 'string' || !/^17\./u.test(identity.server_version)) fail('The local database identity/version differs from the reviewed target.');
  return identity;
}
export async function verifyLocalTarget() {
  const runtime = await inspectOwnedRuntime(); const observed = await observeDatabase(runtime.config);
  if (!existsSync(IDENTITY_FILE)) fail('Database identity has not been established by the owned start command.');
  const expected = await jsonFile(IDENTITY_FILE);
  if (expected.system_identifier !== observed.system_identifier || expected.workspace_key !== WORKSPACE_KEY || expected.instance_id !== runtime.owned.instance_id) fail('Database fingerprint differs from the recorded owned local volume.');
  return { ...runtime, observed };
}
async function inspectManagedAuthPrivileges() {
  const { config } = await verifyLocalTarget();
  const sql = "begin read only; select json_build_object('query_role',current_user,'auth_schema_owner',(select pg_get_userbyid(nspowner) from pg_namespace where nspname='auth'),'anon_auth_usage',has_schema_privilege('anon','auth','USAGE'),'authenticated_auth_usage',has_schema_privilege('authenticated','auth','USAGE'),'postgres_auth_usage',has_schema_privilege('postgres','auth','USAGE'),'eps_api_owner_auth_usage',case when exists(select 1 from pg_roles where rolname='eps_api_owner') then has_schema_privilege('eps_api_owner','auth','USAGE') else null end,'postgres_auth_grant_option',has_schema_privilege('postgres','auth','USAGE WITH GRANT OPTION'),'postgres_uid_grant_option',has_function_privilege('postgres','auth.uid()','EXECUTE WITH GRANT OPTION'),'postgres_jwt_grant_option',has_function_privilege('postgres','auth.jwt()','EXECUTE WITH GRANT OPTION'),'postgres_authenticated_membership',(select json_build_object('admin',m.admin_option,'inherit',m.inherit_option,'set',m.set_option) from pg_auth_members m join pg_roles parent on parent.oid=m.roleid join pg_roles child on child.oid=m.member where parent.rolname='authenticated' and child.rolname='postgres'),'existing_app_tables',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='eps' and c.relkind='r')); commit;\n";
  const result = await psql(config.container, sql);
  const line = result.stdout.split(/\r?\n/u).find(value => value.trim().startsWith('{'));
  if (!line) fail('The managed-auth privilege inspection did not return a result.');
  return receipt('auth-privileges', { container: config.container, operation: 'read-only catalog inspection', privileges: JSON.parse(line), baseline_changes: 'none; inspection performed no grants, schema changes or data writes' });
}
async function inspectStorageBaseline() {
  const { config } = await verifyLocalTarget();
  const sql = await readFile(path.join(ROOT, 'tools/sql/discover-storage-release-privileges.sql'), 'utf8');
  const result = await psql(config.container, sql);
  const line = result.stdout.split(/\r?\n/u).find(value => value.trim().startsWith('{'));
  if (!line) fail('Storage metadata query returned no result.');
  return receipt('storage-privileges', { container: config.container, operation: 'read-only fixed catalog inspection',
    privileges: JSON.parse(line), baseline_changes: 'none; no hosted Storage acceptance' });
}
const STORAGE_BASELINE_FILE = 'development/local-db/local-storage-baseline.sql';
const STORAGE_BASELINE_CATALOG_SQL = `jsonb_build_object(
  'schema',(select jsonb_build_object('oid',oid,'owner',pg_get_userbyid(nspowner)) from pg_namespace where nspname='storage'),
  'relations',(select jsonb_agg(jsonb_build_object('oid',c.oid,'name',c.relname,'kind',c.relkind,'owner',pg_get_userbyid(c.relowner),'rls',c.relrowsecurity,'force',c.relforcerowsecurity) order by c.relname)
    from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='storage'),
  'columns',(select jsonb_agg(jsonb_build_object('table',c.relname,'name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid)) order by c.relname,a.attnum)
    from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
    where n.nspname='storage' and c.relkind='r' and a.attnum>0 and not a.attisdropped),
  'functions',(select jsonb_agg(jsonb_build_object('oid',p.oid,'identity',p.oid::regprocedure::text,'owner',pg_get_userbyid(p.proowner),'definition',pg_get_functiondef(p.oid)) order by p.oid::regprocedure::text)
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='storage')
)`;
async function localStoragePrerequisites(config, owned) {
  const sql = `begin read only; ${localGuardSql(owned)} select jsonb_build_object(
    'query_role',current_user,
    'roles',(select jsonb_agg(jsonb_build_object('name',rolname,'superuser',rolsuper,'inherit',rolinherit,'login',rolcanlogin,'create_role',rolcreaterole,'bypass_rls',rolbypassrls) order by rolname) from pg_roles where rolname in ('postgres','supabase_admin','supabase_storage_admin','anon','authenticated','service_role')),
    'postgres_storage_owner_membership',pg_has_role('postgres','supabase_storage_admin','MEMBER'),
    'policy_grants',current_setting('supautils.policy_grants',true)::jsonb,
    'privileged_role',current_setting('supautils.privileged_role',true),
    'storage_catalog',${STORAGE_BASELINE_CATALOG_SQL},
    'marker_present',to_regclass('eps_local_guard.storage_baseline') is not null
  ); rollback;\n`;
  const result = await psql(config.container, sql);
  const line = result.stdout.split(/\r?\n/u).find(value => value.trim().startsWith('{'));
  if (!line) fail('Local Storage prerequisite inspection returned no result.');
  return JSON.parse(line);
}
export async function storageBaseline({ inspect = false } = {}) {
  const { config, owned } = await verifyLocalTarget();
  const before = await localStoragePrerequisites(config, owned);
  if (inspect) return receipt('storage-baseline-inspect', { container: config.container, operation: 'read-only local catalog inspection', prerequisites: before, baseline_changes: 'none; no Auth/Storage HTTP or byte-storage implementation' });
  const manifest = await jsonFile(path.join(CONFIG_DIRECTORY, 'reviewed.json'));
  const entry = manifest.version === 1 && Array.isArray(manifest.local_baselines)
    ? manifest.local_baselines.find(value => value.path === STORAGE_BASELINE_FILE) : undefined;
  if (!entry || !/^[a-f0-9]{64}$/u.test(entry.sha256) || typeof entry.reviewed_by !== 'string' || !entry.reviewed_by.trim()) fail('This fixed local Storage simulation has no explicit reviewed hash. Root must review and record reviewed.json.local_baselines first.');
  const absolute = await realpath(path.join(ROOT, STORAGE_BASELINE_FILE));
  if (absolute !== path.resolve(ROOT, STORAGE_BASELINE_FILE)) fail('The fixed local Storage baseline may not resolve through a symbolic link.');
  const bytes = await readFile(absolute); const hash = createHash('sha256').update(bytes).digest('hex');
  if (hash !== entry.sha256) fail('Local Storage baseline bytes changed after review. No SQL was executed.');
  const sql = bytes.toString('utf8');
  if (/^\s*\\/mu.test(sql) || /^\s*(?:begin\s*;|commit\s*;|rollback\s*;|start\s+transaction\b)/imu.test(sql)) fail('Local Storage baseline may not contain psql metacommands or transaction control.');
  if (before.postgres_storage_owner_membership || !before.policy_grants?.postgres?.includes('storage.buckets') || !before.policy_grants?.postgres?.includes('storage.objects')) fail('The observed narrow managed Storage ownership/policy boundary differs. No role/configuration grant will be invented.');
  if (before.marker_present) {
    const result = await psql(config.container, `begin read only; ${localGuardSql(owned)} select jsonb_build_object('version',version,'sha256',sha256,'catalog_matches',catalog=${STORAGE_BASELINE_CATALOG_SQL}) from eps_local_guard.storage_baseline where id=1; rollback;\n`);
    const line = result.stdout.split(/\r?\n/u).find(value => value.trim().startsWith('{'));
    const existing = line ? JSON.parse(line) : null;
    if (existing?.version !== 1 || existing.sha256 !== hash || existing.catalog_matches !== true) fail('Existing local Storage simulation marker/hash/catalog differs. No Storage object will be overwritten or adopted.');
    return receipt('storage-baseline', { container: config.container, file: STORAGE_BASELINE_FILE, sha256: hash, result: 'already_applied', baseline: 'SIMULATED SQL policy catalog only; no Auth/Storage HTTP, signed tokens, or bytes', prerequisites: before });
  }
  const adminCheck = await psql(config.container, "begin read only; select json_build_object('role',current_user,'superuser',(select rolsuper from pg_roles where rolname=current_user)); rollback;\n", 'supabase_admin');
  const adminLine = adminCheck.stdout.split(/\r?\n/u).find(value => value.trim().startsWith('{'));
  const admin = adminLine ? JSON.parse(adminLine) : null;
  if (admin?.role !== 'supabase_admin' || admin.superuser !== true) fail('The existing local managed-baseline administrator could not be verified.');
  const transaction = `begin; set local lock_timeout='5s'; set local statement_timeout='30s'; select pg_advisory_xact_lock(166824721,702); ${localGuardSql(owned)} select set_config('eps.local_fixture_tests','${config.container}',true),set_config('eps.local_storage_baseline_sha256','${hash}',true);\n${sql}\ncommit;\n`;
  const applied = await psql(config.container, transaction, 'supabase_admin');
  const after = await localStoragePrerequisites(config, owned);
  return receipt('storage-baseline', { container: config.container, file: STORAGE_BASELINE_FILE, sha256: hash, result: 'applied', baseline_administrator: admin, baseline: 'SIMULATED SQL policy catalog only; no Auth/Storage HTTP, signed tokens, or bytes; no app migration ledger entry', prerequisites: before, after, warnings: safeOutput(applied.stderr) });
}
async function receipt(action, data) {
  const directory = path.join(CONFIG_DIRECTORY, 'receipts'); await mkdir(directory, { recursive: true });
  const at = new Date().toISOString(); const filename = `${at.replace(/[:.]/gu, '-')}-${action}.json`;
  const result = { action, observed_at: at, workspace_key: WORKSPACE_KEY, scope: 'owned local Docker container only; no cloud operations', ...data };
  await writeFile(path.join(directory, filename), safeOutput(JSON.stringify(result, null, 2)) + '\n');
  return { receipt: path.relative(ROOT, path.join(directory, filename)).replaceAll('\\', '/'), ...result };
}
async function start() {
  const engine = await ensureLocalEngine(); const config = await configuration(); const owned = await owner(true);
  const image = (await dockerJson(['image', 'inspect', config.image_digest]))[0];
  for (const [type, name] of [['volume', config.volume], ['network', config.network]]) {
    const result = await command([type, 'inspect', name], { allowFailure: true });
    if (result.code === 0) checkLabels(JSON.parse(result.stdout)[0].Labels, owned);
    else await command([type, 'create', ...labelArguments(owned), name]);
  }
  let container = await inspectContainer(config, false);
  if (container) {
    await inspectOwnedRuntime({ running: false });
    if (!container.State.Running) await command(['start', config.container]);
  } else {
    await command(['run', '--detach', '--pull=never', '--name', config.container, ...labelArguments(owned), '--network', config.network, '--publish', '127.0.0.1:55433:5432', '--env-file', ENV_FILE, '--mount', `type=volume,source=${config.volume},target=${config.data_path}`, config.image_digest]);
  }
  await inspectOwnedRuntime();
  let ready = false;
  for (let attempt = 0; attempt < 90; attempt++) {
    const result = await command(['exec', config.container, 'pg_isready', '-U', 'postgres', '-d', 'postgres'], { allowFailure: true, timeout: 5000 });
    if (result.code === 0) { ready = true; break; }
    await new Promise(done => setTimeout(done, 1000));
  }
  const logs = await command(['logs', '--tail', '200', config.container], { allowFailure: true });
  await writeFile(path.join(CONFIG_DIRECTORY, 'startup-latest.log'), safeOutput(logs.stdout + logs.stderr));
  if (!ready) fail('Owned local Postgres did not become ready. Inspect sanitized startup-latest.log; no reset or volume removal was attempted.');
  const observed = await observeDatabase(config);
  const identity = { workspace_key: WORKSPACE_KEY, instance_id: owned.instance_id, system_identifier: observed.system_identifier };
  if (existsSync(IDENTITY_FILE)) {
    const existing = await jsonFile(IDENTITY_FILE);
    if (existing.system_identifier !== identity.system_identifier || existing.instance_id !== identity.instance_id) fail('Existing database identity changed. Refusing automatic adoption.');
  } else await writeFile(IDENTITY_FILE, JSON.stringify(identity, null, 2), { flag: 'wx', mode: 0o600 });
  return receipt('start', { engine, container: config.container, image_tag: config.image_tag, image_digest: config.image_digest, image_id: image.Id, volume: config.volume, bindings: [{ host_ip: '127.0.0.1', host_port: '55433', container_port: '5432/tcp' }], database: observed });
}
async function bootstrap() {
  const { config, owned, observed } = await verifyLocalTarget();
  const sql = await readFile(path.join(CONFIG_DIRECTORY, 'local-bootstrap.sql'), 'utf8');
  // The official image's postgres is not superuser and does not own managed auth.
  // The already-verified local supabase_admin owns auth and is used ONLY here.
  const adminInspection = await psql(config.container, "begin read only; select json_build_object('role',current_user,'superuser',(select rolsuper from pg_roles where rolname=current_user),'auth_schema_owner',(select pg_get_userbyid(nspowner) from pg_namespace where nspname='auth')); commit;\n", 'supabase_admin');
  const adminLine = adminInspection.stdout.split(/\r?\n/u).find(line => line.trim().startsWith('{'));
  const admin = adminLine ? JSON.parse(adminLine) : null;
  if (admin?.role !== 'supabase_admin' || admin.superuser !== true || admin.auth_schema_owner !== 'supabase_admin') fail('The known local managed-auth administrator could not be verified.');
  await psql(config.container, sql, 'supabase_admin');
  await psql(config.container, `begin; create schema if not exists eps_local_guard; revoke all on schema eps_local_guard from public,anon,authenticated,service_role; create table if not exists eps_local_guard.instance(id integer primary key check(id=1),workspace_key text not null,instance_id uuid not null); insert into eps_local_guard.instance values(1,'${WORKSPACE_KEY}','${owned.instance_id}') on conflict(id) do nothing; do $guard$ begin if not exists(select 1 from eps_local_guard.instance where id=1 and workspace_key='${WORKSPACE_KEY}' and instance_id='${owned.instance_id}'::uuid) then raise exception 'LOCAL_OWNER_MISMATCH'; end if; end $guard$; create table if not exists eps_local_guard.migration_replay(path text primary key, sha256 text not null, applied_at timestamptz not null default now()); create schema if not exists supabase_migrations; create table if not exists supabase_migrations.schema_migrations(version text primary key, statements text[], name text); commit;\n`);
  const after = await observeDatabase(config);
  await psql(config.container, `begin read only; set local role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true); select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","is_anonymous":false}',true); do $verify$ begin if auth.jwt()->>'sub' is distinct from '00000000-0000-4000-8000-000000000001' or auth.uid() is distinct from '00000000-0000-4000-8000-000000000001'::uuid then raise exception 'LOCAL_AUTH_HELPER_CHECK_FAILED'; end if; end $verify$; rollback;\n`);
  return receipt('bootstrap', { container: config.container, database: after, bootstrap_administrator: admin, minimal_auth_users_created: !observed.auth_users_present && after.auth_users_present, minimal_auth_uid_created: !observed.auth_uid_present && after.auth_uid_present, minimal_auth_jwt_created: !observed.auth_jwt_present && after.auth_jwt_present, helper_check: 'authenticated role reads synthetic request.jwt.claims through jwt and request.jwt.claim.sub through uid; transaction rolled back', baseline: 'Official local image auth objects plus only missing synthetic prerequisites; no hosted Auth acceptance.' });
}
async function reviewedFile(relative, kind, reviewGroup = kind) {
  const manifest = await jsonFile(path.join(CONFIG_DIRECTORY, 'reviewed.json'));
  if (manifest.version !== 1 || !Array.isArray(manifest[reviewGroup])) fail('The reviewed SQL manifest is invalid.');
  const normalized = relative.replaceAll('\\', '/');
  const pattern = kind === 'migrations' ? /^supabase\/migrations\/\d{14}_[a-z0-9_]+\.sql$/u : /^tests\/db\/[a-z0-9_./-]+\.sql$/u;
  if (!pattern.test(normalized) || normalized.includes('..')) fail('Only root migration files or explicit reviewed DB tests are allowed.');
  const entry = manifest[reviewGroup].find(value => value.path === normalized);
  if (!entry || !/^[a-f0-9]{64}$/u.test(entry.sha256) || typeof entry.reviewed_by !== 'string' || !entry.reviewed_by.trim()) fail('This SQL file has no explicit reviewed hash. Root must review and record the exact file first.');
  const absolute = await realpath(path.join(ROOT, normalized));
  if (absolute !== path.resolve(ROOT, normalized)) fail('Reviewed SQL may not resolve through a symbolic link.');
  const bytes = await readFile(absolute); const hash = createHash('sha256').update(bytes).digest('hex');
  if (hash !== entry.sha256) fail('SQL bytes changed after review. Review the current file and update its manifest hash.');
  const sql = bytes.toString('utf8');
  if (/^\s*\\/mu.test(sql)) fail('Reviewed SQL may not execute psql metacommands.');
  if (kind === 'migrations' && /^\s*(?:begin\s*;|commit\s*;|rollback\s*;|start\s+transaction\b)/imu.test(sql)) fail('Replay migrations must not contain their own transaction control. The runner owns the atomic boundary.');
  return { entry, sql, normalized };
}
function localGuardSql(owned) { return `do $guard$ begin if current_database()<>'postgres' or not exists(select 1 from eps_local_guard.instance where id=1 and workspace_key='${WORKSPACE_KEY}' and instance_id='${owned.instance_id}'::uuid) then raise exception 'VERIFIED_LOCAL_TARGET_REQUIRED'; end if; end $guard$;\n`; }
async function probeLogoBoundary() {
  const { config, owned } = await verifyLocalTarget();
  const migration = await reviewedFile('supabase/migrations/20261028024205_m01_private_logo_boundary.sql', 'migrations', 'candidate_reviews');
  const test = await reviewedFile('tests/db/m01-logo-boundary.sql', 'tests', 'candidate_reviews');
  const controls = [...test.sql.matchAll(/^\s*(begin|commit|rollback|start\s+transaction)\s*;\s*$/gimu)].map(value => value[1].toLowerCase());
  if (controls.length !== 2 || controls[0] !== 'begin' || controls[1] !== 'rollback' || !/rollback;\s*$/iu.test(test.sql)) fail('Logo probe requires exactly the reviewed test BEGIN and final ROLLBACK, with no commit.');
  const body = test.sql.replace(/^\s*begin\s*;\s*$/imu, '');
  const sql = `begin; set local lock_timeout='5s'; set local statement_timeout='45s'; ${localGuardSql(owned)}
select set_config('eps.local_fixture_tests','${config.container}',true);
do $pending$ begin if to_regclass('eps.upload_sessions') is not null or exists(select 1 from pg_roles where rolname='eps_logo_verify_owner') then raise exception 'LOGO_PROBE_REQUIRES_UNAPPLIED_CANDIDATE'; end if; end $pending$;
${migration.sql}\n${body}`;
  const evidence = { container: config.container, migration: migration.normalized, migration_sha256: migration.entry.sha256,
    test: test.normalized, test_sha256: test.entry.sha256, scope: 'candidate DDL plus synthetic role/policy/receipt assertions in one rolled-back transaction; no migration history write; Storage GUC/catalog simulation, not HTTP' };
  async function verifyRollback() {
    const result = await psql(config.container, `begin read only; ${localGuardSql(owned)} select jsonb_build_object(
      'candidate_tables_absent',to_regclass('eps.upload_sessions') is null and to_regclass('eps.logo_verification_keys') is null,
      'candidate_role_absent',not exists(select 1 from pg_roles where rolname='eps_logo_verify_owner'),
      'candidate_migration_absent',not exists(select 1 from supabase_migrations.schema_migrations where version='20261028024205')); rollback;`);
    const value = JSON.parse(result.stdout.split(/\r?\n/u).find(line => line.startsWith('{')) ?? '{}');
    return { ...value, verified: value.candidate_tables_absent === true && value.candidate_role_absent === true && value.candidate_migration_absent === true };
  }
  try {
    const result = await psql(config.container, sql);
    const rollback = await verifyRollback();
    if (!rollback.verified) fail('Logo candidate rollback was not verified. Preserve local state for inspection.');
    return receipt('logo-probe', { ...evidence, result: 'passed', rollback, output: safeOutput(result.stdout), warnings: safeOutput(result.stderr) });
  } catch (error) {
    const rollback = await verifyRollback().catch(() => ({ verified: false }));
    await receipt('logo-probe', { ...evidence, result: 'failed', rollback, error: safeOutput(error.message) });
    throw error;
  }
}
export async function runReviewedSqlFile(relative, { test = false } = {}) {
  const { config, owned, observed } = await verifyLocalTarget();
  if (!observed.auth_users_present || !observed.auth_uid_present || !observed.auth_jwt_present) fail('Local managed-auth prerequisites are incomplete. Run the guarded local bootstrap before replay/tests.');
  const file = await reviewedFile(relative, test ? 'tests' : 'migrations');
  if (test) {
    const result = await psql(config.container, localGuardSql(owned) + `select set_config('eps.local_fixture_tests','${config.container}',false);\n` + file.sql);
    return receipt('test', { container: config.container, file: file.normalized, sha256: file.entry.sha256, result: 'passed', output: safeOutput(result.stdout), warnings: safeOutput(result.stderr) });
  }
  const current = await psql(config.container, `begin read only; ${localGuardSql(owned)} select sha256 from eps_local_guard.migration_replay where path='${file.normalized}'; commit;\n`);
  const existing = current.stdout.trim();
  if (existing) {
    if (existing !== file.entry.sha256) fail('Previously replayed migration has changed. Add a forward migration; do not overwrite local history.');
    return receipt('replay', { container: config.container, file: file.normalized, sha256: file.entry.sha256, result: 'already_applied' });
  }
  const basename = path.basename(file.normalized, '.sql'); const version = basename.slice(0, 14); const name = basename.slice(15);
  const sql = `begin; set local lock_timeout='5s'; set local statement_timeout='45s'; select pg_advisory_xact_lock(166824721,701); ${localGuardSql(owned)} do $ledger$ begin if exists(select 1 from supabase_migrations.schema_migrations where version='${version}') or exists(select 1 from eps_local_guard.migration_replay where path='${file.normalized}') then raise exception 'MIGRATION_ALREADY_RECORDED'; end if; end $ledger$;\n${file.sql}\ninsert into supabase_migrations.schema_migrations(version,statements,name) values('${version}',array[]::text[],'${name}'); insert into eps_local_guard.migration_replay(path,sha256) values('${file.normalized}','${file.entry.sha256}'); commit;\n`;
  const result = await psql(config.container, sql);
  return receipt('replay', { container: config.container, file: file.normalized, sha256: file.entry.sha256, result: 'applied', warnings: safeOutput(result.stderr) });
}
async function main() {
  const [action, flag, selectedFile] = process.argv.slice(2);
  let result;
  if (action === 'start') result = await start();
  else if (action === 'status') { const target = await verifyLocalTarget(); result = await receipt('status', { container: target.config.container, database: target.observed, bindings: [{ host_ip: '127.0.0.1', host_port: '55433' }] }); }
  else if (action === 'privileges') result = await inspectManagedAuthPrivileges();
  else if (action === 'storage-privileges') result = await inspectStorageBaseline();
  else if (action === 'storage-baseline' && (!flag || flag === '--inspect')) result = await storageBaseline({ inspect: flag === '--inspect' });
  else if (action === 'probe-logo' && !flag) result = await probeLogoBoundary();
  else if (action === 'bootstrap') result = await bootstrap();
  else if (action === 'replay' && flag === '--file' && selectedFile) result = await runReviewedSqlFile(selectedFile);
  else if (action === 'test' && flag === '--file' && selectedFile) result = await runReviewedSqlFile(selectedFile, { test: true });
  else fail('Usage: node tools/local-postgres.mjs start|status|privileges|storage-privileges|storage-baseline [--inspect]|probe-logo|bootstrap|replay --file supabase/migrations/<reviewed>.sql|test --file tests/db/<reviewed>.sql');
  process.stdout.write(safeOutput(JSON.stringify(result, null, 2)) + '\n');
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => { process.stderr.write(safeOutput(error.message) + '\n'); process.exitCode = 1; });
}
