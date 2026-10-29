/** Function-only candidate12 against exact local11; root owns execution. */
import { Buffer } from 'node:buffer';
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { mkdir, open, readFile, realpath, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { clearTimeout, setTimeout } from 'node:timers';
import { URL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { runOwnedLocalSql, verifyLocalTarget } from './local-postgres.mjs';

const ROOT = realpathSync(path.resolve(import.meta.dirname, '..'));
const LOCK = path.join(ROOT, '.local/local-postgres/test-db.lock');
const CONTAINER = 'eps-presentation-canonical-pg17-local';
const SYSTEM_IDENTIFIER = '7701520506262638626';
const DOCKER_ENDPOINT = process.platform === 'win32' ? 'npipe:////./pipe/dockerDesktopLinuxEngine' : 'unix:///var/run/docker.sock';
const DOCKER_CONTEXT = process.platform === 'win32' ? 'desktop-linux' : 'default';
const CANDIDATE = 'development/m02/specs-mime-guard-candidate.sql';
const MIGRATION = 'supabase/migrations/20261029001520_m02_specs_assets.sql';
const MIGRATION_VERSION = '20261029001520';
const APPROVED_MIGRATION_SHA256 = '9b35e8efdfc5184252ab4ecfe1a50861c8991dadf2b20544d481b51b3b7fb288';
const APPROVED_MANIFEST_SHA256 = '921ba61281a33f20b41d0994cc776ad826d0ac770858ef3973632bf57651ce98';
const ASSERTIONS = 'tests/db/m02-specs-mime-guard.sql';
const HASHES = {
  candidate: 'f190c27fbd2ccc851b17303df598644aeb983f05dd3ca28dc6a2323becf023e8',
  assertions: '1a9d280b5bb0d6c8d6d1eeca6d57b3f69d6ff9604f782590f265945e70acadc6',
};
const BASE_VERSIONS = ['20261028010943','20261028013324','20261028013655','20261028024205','20261028072515','20261028162702','20261028162800','20261028172320','20261028184145','20261028222030'];
const VERSIONS = [...BASE_VERSIONS,MIGRATION_VERSION];
const APPLIED_BASE_SOURCES = {
  "supabase/migrations/20261028222030_m02_specs_pipeline.sql": "1e5319bb81be1f12896f7efb5a2cb7706653b79eb440a4dc1aaaca4ed9556895",
  "supabase/migrations/20261028010943_m01_canonical_foundation.sql": "8a5f3ed7727a72051e630307d2daecab8c4a74054398a6425e73bd85e17568b9",
  "supabase/migrations/20261028013324_m01_identity_role_inheritance.sql": "5382efe9fbdf9c194010257e0ac0024dcb447207522036560056d5d1a4e20e30",
  "supabase/migrations/20261028013655_m01_workspace_scope_alias.sql": "67ddb2cff9fed9c42d34657e833c613aec4afd2769543a991bbac84da355db64",
  "supabase/migrations/20261028024205_m01_private_logo_boundary.sql": "b04af5119b4e384bd96136573eec39e69f21a0ffb7d9f4aeb07bbf48f2976b9d",
  "supabase/migrations/20261028072515_m01_logo_upload_capability.sql": "4dbd400092d7743b02dd0769ae511c208e6f4f349428fc0e7f0fb9c573ba4b24",
  "supabase/migrations/20261028162702_m01_replay_scope_refresh.sql": "82a4f2ec03efc0787aa58e5f1e68ab626e5dddb5e4c645444103456757bf4251",
  "supabase/migrations/20261028162800_m02_jobs_outbox.sql": "f619b3dfb9d964ab5902d04941b8cd59b44e9da36f1ab3f7b10bd45298ff4013",
  "supabase/migrations/20261028172320_m02_manual_specs_draft.sql": "8ab866a49cb2e01eabf3b83076fe4519a60255263d0a1a170ef3ba9718a2349c",
  "supabase/migrations/20261028184145_m02_role_order.sql": "14f96c7e635fe46cb11393a881bca26068d696c32f5e454df8655299702b1efa"
};
const sha256 = value => createHash('sha256').update(value).digest('hex');
function assert(condition, message) { if (!condition) throw new Error(message); }
function diagnostic(error) { return String(error instanceof Error ? error.message : 'Local specs-pipeline rehearsal failed.').replace(/[A-Za-z0-9_-]{43,}/gu, '[LONG_VALUE_REDACTED]').slice(0, 4000); }
async function readDocker(args) {
  return await new Promise((resolve,reject)=>{
    const child=spawn('docker',args,{ cwd:ROOT,shell:false,windowsHide:true,stdio:['ignore','pipe','pipe'] });
    let stdout=''; let bounded=true;
    const timer=setTimeout(()=>{ bounded=false;child.kill(); },10000);
    child.stdout.on('data',chunk=>{ stdout+=chunk.toString('utf8');if(stdout.length>65536){bounded=false;child.kill();} });
    child.stderr.resume();
    child.on('error',()=>{clearTimeout(timer);reject(new Error('Fixed local Docker metadata inspection could not start.'));});
    child.on('close',code=>{clearTimeout(timer);if(code!==0||!bounded)reject(new Error('Fixed local Docker metadata inspection failed.'));else resolve(stdout.trim());});
  });
}
async function pinnedTarget() {
  assert(['win32','linux'].includes(process.platform),'This fixed local Docker transport supports Windows/Linux only.');
  assert(!['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH','DOCKER_CONFIG'].some(key=>process.env[key]),'Docker host/context/TLS overrides are prohibited.');
  assert(await readDocker(['context','show'])===DOCKER_CONTEXT,'The reviewed local Docker context is required.');
  assert(await readDocker(['context','inspect',DOCKER_CONTEXT,'--format','{{.Endpoints.docker.Host}}'])===DOCKER_ENDPOINT,'Only the exact reviewed local Docker socket is permitted; UNC/remote pipes are denied.');
  const target=await verifyLocalTarget();
  assert(target.config.container===CONTAINER&&target.observed.system_identifier===SYSTEM_IDENTIFIER&&/^[a-f0-9]{64}$/u.test(target.container.Id),'The exact owned local target is required.');
  const format='{"Id":{{json .Id}},"Image":{{json .Image}},"Labels":{{json .Config.Labels}},"Mounts":{{json .Mounts}},"Bindings":{{json .HostConfig.PortBindings}},"Ports":{{json .NetworkSettings.Ports}},"Running":{{json .State.Running}}}';
  const pinned=JSON.parse(await readDocker(['--host',DOCKER_ENDPOINT,'container','inspect',target.container.Id,'--format',format]));
  assert(pinned.Id===target.container.Id&&pinned.Image===target.container.Image&&pinned.Running===true
    &&isDeepStrictEqual(pinned.Labels,target.container.Config.Labels)&&isDeepStrictEqual(pinned.Mounts,target.container.Mounts)
    &&isDeepStrictEqual(pinned.Bindings,target.container.HostConfig.PortBindings)&&isDeepStrictEqual(pinned.Ports,target.container.NetworkSettings.Ports),
    'The pinned local daemon/container must match the verified ownership, image, volume and loopback publication.');
  assert(await readDocker(['context','show'])===DOCKER_CONTEXT&&await readDocker(['context','inspect',DOCKER_CONTEXT,'--format','{{.Endpoints.docker.Host}}'])===DOCKER_ENDPOINT,'Docker context targeting drifted during verification.');
  return target;
}

/** Fixed-source outer-statement accident guard, not a general-purpose SQL parser. */
function guardSource(sql) {
  const outer = sql.replace(/\$([A-Za-z_][A-Za-z0-9_]*|)\$[\s\S]*?\$\1\$/gu, () => ' ')
    .replace(/--[^\r\n]*/gu, ' ').replace(/\/\*[\s\S]*?\*\//gu, ' ')
    .replace(/'(?:''|[^'])*'/gu, ' ').replace(/"(?:""|[^"])*"/gu, ' ');
  assert(!outer.includes('\\'), 'Reviewed SQL may not contain psql metacommands.');
  for (const statement of outer.split(';')) {
    assert(!/^\s*(?:begin\b|start\s+transaction\b|commit\b|end\b|rollback\b|abort\b|savepoint\b|release\b|prepare\s+transaction\b|set\s+transaction\b)/iu.test(statement),
      'Candidate/assertions must not control transactions; the harness owns BEGIN/ROLLBACK.');
  }
}
function configuredSeals() {
  assert(typeof MIGRATION==='string'&&/^supabase\/migrations\/[0-9]{14}_m02_specs_assets\.sql$/u.test(MIGRATION)&&typeof MIGRATION_VERSION==='string'&&/^[0-9]{14}$/u.test(MIGRATION_VERSION)
    &&typeof APPROVED_MIGRATION_SHA256==='string'&&/^[a-f0-9]{64}$/u.test(APPROVED_MIGRATION_SHA256)
    &&typeof APPROVED_MANIFEST_SHA256==='string'&&/^[a-f0-9]{64}$/u.test(APPROVED_MANIFEST_SHA256),
    'Persistent local11 migration/manifest seals are unfilled; no Docker or SQL execution is allowed.');
  assert(Object.values(HASHES).every(value=>typeof value==='string'&&/^[a-f0-9]{64}$/u.test(value)), 'Historical candidate/assertion seals are unfilled; no Docker or SQL execution is allowed.');
}
async function verifyMigrationSeals() {
  configuredSeals();
  const manifestFile=path.join(ROOT,'development/local-db/reviewed.json');
  const manifestBytes=await readFile(manifestFile);
  assert(sha256(manifestBytes)===APPROVED_MANIFEST_SHA256,'Reviewed local11 manifest bytes changed.');
  const manifest=JSON.parse(manifestBytes.toString('utf8'));
  const expected={...APPLIED_BASE_SOURCES,[MIGRATION]:APPROVED_MIGRATION_SHA256};
  assert(manifest.version===1&&Array.isArray(manifest.migrations)&&manifest.migrations.length===11,'Require exact reviewed eleven-migration manifest.');
  for(const [file,hash] of Object.entries(expected)) {
    const entry=manifest.migrations.find(item=>item.path===file);
    assert(entry&&entry.sha256===hash&&typeof entry.reviewed_by==='string'&&entry.reviewed_by.trim(),'Exact migration approval is required.');
    const absolute=await realpath(path.join(ROOT,file));
    assert(absolute===path.resolve(ROOT,file)&&sha256(await readFile(absolute))===hash,'An applied migration source changed or resolves through a link.');
  }
  // The root-approved assertion hash below is independently checked by
  // sealedSource. It need not duplicate an entry in the promotion manifest.
}
async function sealedSource(file, expected) {
  const absolute = await realpath(path.join(ROOT, file));
  assert(absolute === path.resolve(ROOT, file), 'Reviewed SQL may not resolve through a symbolic link.');
  const bytes = await readFile(absolute);
  assert(sha256(bytes) === expected, 'Candidate/assertion bytes changed after independent review.');
  const sql = bytes.toString('utf8'); guardSource(sql); return sql;
}
const INSPECTION = `begin read only;
do $snapshot$ declare item record; amount bigint; counts jsonb:='{}'; row_digests jsonb:='{}'; digest_value text; snapshot jsonb; begin
  for item in select namespace.nspname,relation.relname from pg_class relation join pg_namespace namespace on namespace.oid=relation.relnamespace
    where namespace.nspname in('public','eps','auth','storage','eps_local_guard','supabase_migrations') and relation.relkind in('r','p') order by namespace.nspname,relation.relname loop
    execute format('select count(*) from %I.%I',item.nspname,item.relname) into amount;
    counts:=counts||jsonb_build_object(item.nspname||'.'||item.relname,amount);
    execute format('select encode(sha256(convert_to(coalesce(string_agg(to_jsonb(row_value)::text,E''\\n'' order by to_jsonb(row_value)::text),''''),''UTF8'')),''hex'') from %I.%I row_value',item.nspname,item.relname) into digest_value;
    row_digests:=row_digests||jsonb_build_object(item.nspname||'.'||item.relname,digest_value);
  end loop;
  select jsonb_build_object('query_role',current_user,'database',current_database(),
    'unrestricted_visibility',(select rolsuper or rolbypassrls from pg_roles where rolname=current_user),
    'versions',(select jsonb_agg(version order by version) from supabase_migrations.schema_migrations),
    'replay_ledger',(select jsonb_agg(jsonb_build_object('path',path,'sha256',sha256) order by path) from eps_local_guard.migration_replay),'all_business_counts',counts,'all_row_digests',row_digests,
    'asset_relations',(select count(*) from pg_class r join pg_namespace n on n.oid=r.relnamespace where n.nspname='eps' and r.relname in('specs_asset_config','specs_upload_sessions','specs_verification_keys','specs_asset_grants','specs_file_preparations')),
    'asset_roles',(select count(*) from pg_roles where rolname in('eps_specs_upload_owner','eps_specs_verify_owner','eps_specs_assets_owner','eps_specs_assets_executor')),
    'asset_forced_rls',(select count(*) from pg_class r join pg_namespace n on n.oid=r.relnamespace where n.nspname='eps' and r.relname in('specs_asset_config','specs_upload_sessions','specs_verification_keys','specs_asset_grants','specs_file_preparations') and r.relrowsecurity and r.relforcerowsecurity),
    'asset_keys',(select count(*) from eps.specs_verification_keys),'asset_config',(select jsonb_build_object('uploads_enabled',uploads_enabled,'capabilities_enabled',capabilities_enabled,'file_pipeline_enabled',file_pipeline_enabled) from eps.specs_asset_config where id=1),
    'candidate_relations',(select count(*) from pg_class relation join pg_namespace namespace on namespace.oid=relation.relnamespace where namespace.nspname='eps' and relation.relname in('specs','roles','slots','assignments')),
    'candidate_roles',(select count(*) from pg_roles where rolname in('eps_specs_owner','eps_specs_initializer')),
    'stage_payloads',(select count(*) from pg_class relation join pg_namespace ns on ns.oid=relation.relnamespace where ns.nspname='eps' and relation.relname='specs_stage_payloads'),
    'pipeline_relations',(select count(*) from pg_class relation join pg_namespace ns on ns.oid=relation.relnamespace where ns.nspname='eps' and relation.relname in('specs_pipeline_config','specs_source_inputs')),
    'provenance_columns',(select count(*) from pg_attribute where attrelid in('eps.specs'::regclass,'eps.roles'::regclass) and attname in('source_extraction_job_id','source_job_id') and not attisdropped),
    'submit_routines',(select count(*) from pg_proc proc join pg_namespace ns on ns.oid=proc.pronamespace where ns.nspname='eps' and proc.proname like 'specs_submit\\_%' escape '\\' or ns.nspname='public' and proc.proname='eps_submit_specs'),
    'stage_roles',(select count(*) from pg_roles where rolname in('eps_specs_submit_owner','eps_specs_stage_owner','eps_specs_apply_owner','eps_jobs_executor')),
    'stage_routines',(select count(*) from pg_proc proc join pg_namespace ns on ns.oid=proc.pronamespace where ns.nspname='eps' and (proc.proname like 'specs_stage\\_%' escape '\\' or proc.proname in('claim_job_stage','record_job_event','get_specs_stage_input','recover_job_stages','job_requester_active'))),
    'stage_policies',(select count(*) from pg_policy where polname like 'specs_stage\\_%' escape '\\'),
    'candidate_routines',(select count(*) from pg_proc proc join pg_namespace ns on ns.oid=proc.pronamespace where ns.nspname='eps' and proc.proname like 'specs\\_%' escape '\\'
      or ns.nspname='public' and proc.proname in('eps_get_specs','eps_update_specs','eps_list_roles','eps_create_role','eps_update_role','eps_list_slots','eps_resize_role_slots','eps_archive_role','eps_update_slot')),
    'catalog',jsonb_build_object(
      'relations',(select jsonb_agg(jsonb_build_array(relation.oid,namespace.nspname,relation.relname,relation.relkind,relation.relowner,relation.relrowsecurity,relation.relforcerowsecurity,relation.relacl) order by relation.oid)
        from pg_class relation join pg_namespace namespace on namespace.oid=relation.relnamespace where namespace.nspname in('public','eps','auth','storage','eps_local_guard','supabase_migrations')),
      'columns',(select jsonb_agg(jsonb_build_array(attribute.attrelid,attribute.attnum,attribute.attname,attribute.atttypid,attribute.attnotnull,attribute.attisdropped,attribute.attacl,pg_get_expr(default_value.adbin,default_value.adrelid)) order by attribute.attrelid,attribute.attnum)
        from pg_attribute attribute join pg_class relation on relation.oid=attribute.attrelid join pg_namespace namespace on namespace.oid=relation.relnamespace
        left join pg_attrdef default_value on default_value.adrelid=attribute.attrelid and default_value.adnum=attribute.attnum
        where attribute.attnum>0 and namespace.nspname in('public','eps','auth','storage','eps_local_guard','supabase_migrations')),
      'functions',(select jsonb_agg(jsonb_build_array(proc.oid,namespace.nspname,proc.proname,pg_get_function_identity_arguments(proc.oid),pg_get_function_result(proc.oid),proc.proowner,proc.prosecdef,proc.provolatile,proc.proconfig,proc.proacl,encode(sha256(convert_to(proc.prosrc,'UTF8')),'hex')) order by proc.oid)
        from pg_proc proc join pg_namespace namespace on namespace.oid=proc.pronamespace where namespace.nspname in('public','eps','auth','storage')),
      'policies',(select jsonb_agg(jsonb_build_array(policy.oid,policy.polrelid,policy.polname,policy.polroles,policy.polcmd,policy.polpermissive,pg_get_expr(policy.polqual,policy.polrelid),pg_get_expr(policy.polwithcheck,policy.polrelid)) order by policy.oid)
        from pg_policy policy join pg_class relation on relation.oid=policy.polrelid join pg_namespace namespace on namespace.oid=relation.relnamespace where namespace.nspname in('public','eps','auth','storage')),
      'triggers',(select jsonb_agg(jsonb_build_array(trigger.oid,trigger.tgrelid,trigger.tgname,trigger.tgenabled,pg_get_triggerdef(trigger.oid)) order by trigger.oid)
        from pg_trigger trigger join pg_class relation on relation.oid=trigger.tgrelid join pg_namespace namespace on namespace.oid=relation.relnamespace where not trigger.tgisinternal and namespace.nspname in('public','eps','auth','storage')),
      'constraints',(select jsonb_agg(jsonb_build_array(constraint_row.oid,constraint_row.conrelid,constraint_row.conname,pg_get_constraintdef(constraint_row.oid)) order by constraint_row.oid)
        from pg_constraint constraint_row join pg_namespace namespace on namespace.oid=constraint_row.connamespace where namespace.nspname in('public','eps','auth','storage','eps_local_guard','supabase_migrations')),
      'roles',(select jsonb_agg(jsonb_build_array(oid,rolname,rolcanlogin,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolbypassrls) order by oid) from pg_roles),
      'memberships',(select jsonb_agg(jsonb_build_array(roleid,member,grantor,admin_option,inherit_option,set_option) order by roleid,member,grantor) from pg_auth_members)
    )) into snapshot;
  perform set_config('eps.specs_probe.snapshot',snapshot::text,true);
end $snapshot$;
select current_setting('eps.specs_probe.snapshot')::jsonb as state;
rollback;`;
async function inspect() {
  const result = await runOwnedLocalSql(INSPECTION);
  const values = result.stdout.split(/\r?\n/u).filter(line => line.startsWith('{')).map(line => JSON.parse(line));
  assert(values.length === 1 && values[0].query_role === 'postgres' && values[0].database === 'postgres' && values[0].unrestricted_visibility === true, 'Unrestricted owned-local catalog/count inspection is required.');
  return values[0];
}
/** Fixed owned-local postgres transport for these two sealed sources only.
 * No managed Auth DDL, alternate role, target, mode or caller SQL is accepted. */
async function rehearseOwned(candidate, assertions, runId, receipt) {
  const target = await pinnedTarget();
  assert(target.config.container === CONTAINER && target.observed.system_identifier === SYSTEM_IDENTIFIER, 'The exact owned local target is required.');
  assert(/^[a-f0-9-]{36}$/u.test(runId), 'Invalid fixed rehearsal run identity.');
  const sql = `begin; set local lock_timeout='5s'; set local statement_timeout='30s'; set local application_name='eps-mime-guard-${runId}';
set local eps.local_fixture_tests='eps-presentation-canonical-pg17-local'; set local eps.specs_mime_guard_rehearsal='rollback-only-v1';
${candidate}\n${assertions}\nrollback;\n`;
  assert(Buffer.byteLength(sql,'utf8') <= 384*1024, 'The fixed composed SQL exceeds its local bound.');
  Object.assign(receipt,{ composed_sql_sha256: sha256(sql), query_role: 'postgres', auth_rls_simulation: 'none; function-only MIME validation needs no managed Auth DDL' });
  await verifyMigrationSeals();
  const finalTarget=await pinnedTarget();
  assert(finalTarget.container.Id===target.container.Id,'Owned local container changed during verification.');
  Object.assign(receipt,{docker_endpoint_kind:process.platform==='win32'?'npipe':'unix',container_id:target.container.Id});
  return await new Promise((resolve, reject) => {
    const child = spawn('docker', ['--host',DOCKER_ENDPOINT,'exec','--user','postgres','-i',target.container.Id,'psql','-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-h','/var/run/postgresql','-U','postgres','-d','postgres'],
      { shell: false, windowsHide: true, stdio: ['pipe','pipe','pipe'] });
    let stderr = ''; let stdoutBytes = 0; let exceeded = false; let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, 90000);
    child.stdout.on('data', chunk => { stdoutBytes += chunk.length; if (stdoutBytes > 1024*1024) { exceeded = true; child.kill(); } });
    child.stderr.on('data', chunk => { if (stderr.length < 32768) stderr += chunk.toString('utf8'); });
    child.stdin.on('error', () => {});
    child.on('error', () => { clearTimeout(timer); reject(new Error('Owned-local rehearsal process could not start.')); });
    child.on('close', code => { clearTimeout(timer);
      if (code !== 0 || exceeded || timedOut) reject(new Error(timedOut ? 'Owned-local rehearsal exceeded its process deadline.' : exceeded ? 'Owned-local rehearsal exceeded its output bound.' : diagnostic(new Error(stderr))));
      else resolve({});
    });
    child.stdin.end(sql);
  });
}
async function ownBackendSettled(runId) {
  const sql = `begin read only; select jsonb_build_object('remaining',count(*)) from pg_stat_activity where application_name='eps-mime-guard-${runId}'; rollback;`;
  for (let attempt = 0; attempt < 20; attempt++) {
    const result = await runOwnedLocalSql(sql);
    const rows = result.stdout.split(/\r?\n/u).filter(line=>line.startsWith('{')).map(line=>JSON.parse(line));
    if (rows.length === 1 && rows[0].remaining === 0) return true;
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  return false;
}
async function main() {
  configuredSeals(); // Must precede even receipt/lock/transport setup.
  await verifyMigrationSeals();
  assert(process.argv.length === 2 && /^v24\./u.test(process.version), 'Use pinned Node24 without target/file/mode arguments.');
  const runId = randomUUID(); let ownsLock = false; let before; let after;
  const receipt = { schema_version: '1.0', run_id: runId, started_at: new Date().toISOString(), result: 'failed',
    candidate: CANDIDATE, migration: MIGRATION, migration_sha256: APPROVED_MIGRATION_SHA256, reviewed_manifest_sha256: APPROVED_MANIFEST_SHA256, assertions: ASSERTIONS, hashes: HASHES, harness_sha256: sha256(await readFile(new URL(import.meta.url))),
    cloud_called: false, provider_called: false, assignments_integrated: false, concurrent_sessions_tested: false,
    persisted_schema_assertions_tested: false, candidate_ddl_executed: false, source_submission_tested: false, storage_http_tested:false, native_files_tested:false, machine_replacement_tested:false, retained_source_correction_tested: false, pipeline_config_enabled: false, service_identity_provisioned: false, job_callbacks_tested: false, promotion_performed: false,
    scope: 'Only MIME scalar guard replacement and direct authenticated RPC malformed-input regressions, rolled back against exact local11. No managed Auth DDL, file transfer, provider or cloud acceptance.' };
  try {
    const target = await pinnedTarget();
    receipt.environment = { container: target.config.container, system_identifier: target.observed.system_identifier, host_ip: '127.0.0.1', host_port: '55433', image_digest: target.config.image_digest };
    await mkdir(path.dirname(LOCK), { recursive: true }); const handle = await open(LOCK, 'wx', 0o600);
    try { await handle.writeFile(JSON.stringify({ run_id: runId, pid: process.pid })); await handle.sync(); ownsLock = true; } finally { await handle.close(); }
    const candidate = await sealedSource(CANDIDATE, HASHES.candidate); const assertions = await sealedSource(ASSERTIONS, HASHES.assertions);
    await verifyMigrationSeals();
    before = await inspect();
    const expectedLedger=Object.entries({...APPLIED_BASE_SOURCES,[MIGRATION]:APPROVED_MIGRATION_SHA256})
      .sort(([left],[right])=>left<right?-1:left>right?1:0).map(([file,hash])=>({path:file,sha256:hash}));
    assert(isDeepStrictEqual(before.replay_ledger,expectedLedger),'Applied DB replay markers must equal all eleven reviewed migration path/hash seals.');
    receipt.db_replay_source_seals_verified_before=true;
    assert(JSON.stringify(before.versions) === JSON.stringify(VERSIONS) && before.candidate_relations === 3 && before.candidate_roles === 2 && before.candidate_routines === 71
      && before.stage_payloads === 1 && before.pipeline_relations === 2 && before.provenance_columns === 2 && before.submit_routines === 7 && before.stage_roles === 4 && before.stage_routines === 24 && before.stage_policies > 0 && before.asset_relations===5 && before.asset_roles===4 && before.asset_forced_rls===5 && before.asset_keys===0
      && isDeepStrictEqual(before.asset_config,{uploads_enabled:false,capabilities_enabled:false,file_pipeline_enabled:false}),
      'Require exact persisted eleven-version asset pipeline with default-disabled flags and no verifier key.');
    receipt.before = before;
    receipt.execution_attempted = true;
    Object.assign(receipt, await rehearseOwned(candidate,assertions,runId,receipt));
    receipt.transaction_completed_to_rollback = true; receipt.candidate_ddl_executed=true; receipt.job_callbacks_tested = false; receipt.persisted_schema_assertions_tested = true; receipt.source_submission_tested = false; receipt.retained_source_correction_tested = false; receipt.machine_replacement_tested=false; receipt.mime_scalar_guard_tested=true;
  } catch (error) { receipt.error = diagnostic(error); }
  finally {
    if (before) {
      try {
        receipt.owned_backend_settled = false;
        receipt.owned_backend_settled = await ownBackendSettled(runId);
        assert(receipt.owned_backend_settled, 'Own rehearsal backend did not settle; retaining shared DB lock.');
        await verifyMigrationSeals();
        after = await inspect(); receipt.after = after;
        const expectedLedger=Object.entries({...APPLIED_BASE_SOURCES,[MIGRATION]:APPROVED_MIGRATION_SHA256})
          .sort(([left],[right])=>left<right?-1:left>right?1:0).map(([file,hash])=>({path:file,sha256:hash}));
        assert(isDeepStrictEqual(after.replay_ledger,expectedLedger),'Applied DB replay markers changed during the assertion transaction.');
        receipt.db_replay_source_seals_verified_after=true;
        receipt.catalog_and_all_counts_restored = JSON.stringify(before) === JSON.stringify(after);
        receipt.rollback_verified = receipt.catalog_and_all_counts_restored;
        if (receipt.transaction_completed_to_rollback && receipt.rollback_verified) receipt.result = 'passed';
      } catch (error) { receipt.verification_error = diagnostic(error); receipt.rollback_verified = false; }
    }
    if (ownsLock && receipt.owned_backend_settled !== false) { try { const owner = JSON.parse(await readFile(LOCK,'utf8')); assert(owner.run_id === runId && owner.pid === process.pid, 'Shared DB test lock owner changed; refusing removal.'); await unlink(LOCK); }
      catch (error) { receipt.result = 'failed'; receipt.lock_error = diagnostic(error); } }
    receipt.finished_at = new Date().toISOString();
    const directory = path.join(ROOT,'tracking/evidence/m02/specs-mime-guard'); await mkdir(directory,{ recursive:true });
    const file = path.join(directory,`${receipt.finished_at.replace(/[:.]/gu,'-')}-${runId.slice(0,8)}-rollback.json`);
    await writeFile(file,JSON.stringify(receipt,null,2)+'\n',{ flag:'wx' });
    process.stdout.write(`M02 MIME scalar guard: ${receipt.result}\nReceipt: ${path.relative(ROOT,file).replaceAll('\\','/')}\n`);
    if (receipt.result !== 'passed') { process.stderr.write(`${receipt.error ?? receipt.verification_error ?? receipt.lock_error ?? 'Catalog/count rollback was not verified.'}\n`); process.exitCode=1; }
  }
}
main().catch(error=>{ process.stderr.write(diagnostic(error)+'\n'); process.exitCode=1; });
