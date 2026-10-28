/** Exact reviewed specs-pipeline candidate; one owned-local rollback only. */
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
const CANDIDATE = 'development/m02/specs-pipeline-candidate.sql';
const ASSERTIONS = 'tests/db/m02-specs-pipeline-candidate.sql';
const HASHES = {
  candidate: 'bf1fdb9e0de61098a17fbec91ae53eaa7265dcbad5796cb73c936d67a09e552e',
  assertions: '0a6449957c40d1dd925b22903884b1c46478730329531e6e2c054f162d26846e',
};
const VERSIONS = ['20261028010943','20261028013324','20261028013655','20261028024205','20261028072515','20261028162702','20261028162800','20261028172320','20261028184145'];
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
async function sealedSource(file, expected) {
  const absolute = await realpath(path.join(ROOT, file));
  assert(absolute === path.resolve(ROOT, file), 'Reviewed SQL may not resolve through a symbolic link.');
  const bytes = await readFile(absolute);
  assert(sha256(bytes) === expected, 'Candidate/assertion bytes changed after independent review.');
  const sql = bytes.toString('utf8'); guardSource(sql); return sql;
}
const INSPECTION = `begin read only;
do $snapshot$ declare item record; amount bigint; counts jsonb:='{}'; snapshot jsonb; begin
  for item in select namespace.nspname,relation.relname from pg_class relation join pg_namespace namespace on namespace.oid=relation.relnamespace
    where namespace.nspname in('public','eps','auth','storage','eps_local_guard','supabase_migrations') and relation.relkind in('r','p') order by namespace.nspname,relation.relname loop
    execute format('select count(*) from %I.%I',item.nspname,item.relname) into amount;
    counts:=counts||jsonb_build_object(item.nspname||'.'||item.relname,amount);
  end loop;
  select jsonb_build_object('query_role',current_user,'database',current_database(),
    'unrestricted_visibility',(select rolsuper or rolbypassrls from pg_roles where rolname=current_user),
    'versions',(select jsonb_agg(version order by version) from supabase_migrations.schema_migrations),'all_business_counts',counts,
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
/** This fixed admin seam exists only for the reviewed local Auth-RLS simulation.
 * It cannot accept caller SQL, a path, target, role, mode or connection string. */
async function rehearseAsLocalAdmin(candidate, assertions, runId, receipt) {
  const target = await pinnedTarget();
  assert(target.config.container === CONTAINER && target.observed.system_identifier === SYSTEM_IDENTIFIER, 'The exact owned local target is required.');
  const administrator = await runOwnedLocalSql("begin read only; select jsonb_build_object('role',rolname,'superuser',rolsuper) from pg_roles where rolname='supabase_admin'; rollback;");
  const rows = administrator.stdout.split(/\r?\n/u).filter(line => line.startsWith('{')).map(line => JSON.parse(line));
  assert(rows.length === 1 && rows[0].role === 'supabase_admin' && rows[0].superuser === true, 'Existing owned-local baseline administrator required.');
  assert(/^[a-f0-9-]{36}$/u.test(runId), 'Invalid fixed rehearsal run identity.');
  const sql = `begin; set local lock_timeout='5s'; set local statement_timeout='30s'; set local application_name='eps-stage-candidate-${runId}';
set local role supabase_auth_admin; alter table auth.users enable row level security;
reset role; set local role postgres;
set local eps.local_fixture_tests='eps-presentation-canonical-pg17-local'; set local eps.specs_pipeline_candidate_rehearsal='rollback-only-v1';
${candidate}\n${assertions}\nrollback;\n`;
  assert(Buffer.byteLength(sql,'utf8') <= 256*1024, 'The fixed composed SQL exceeds its local bound.');
  Object.assign(receipt,{ composed_sql_sha256: sha256(sql), baseline_administrator: 'supabase_admin', auth_rls_simulation: 'transaction-local managed Auth RLS=true; no policy added; rollback mandatory' });
  const finalTarget=await pinnedTarget();
  assert(finalTarget.container.Id===target.container.Id,'Owned local container changed during verification.');
  Object.assign(receipt,{docker_endpoint_kind:process.platform==='win32'?'npipe':'unix',container_id:target.container.Id});
  return await new Promise((resolve, reject) => {
    const child = spawn('docker', ['--host',DOCKER_ENDPOINT,'exec','--user','postgres','-i',target.container.Id,'psql','-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-h','/var/run/postgresql','-U','supabase_admin','-d','postgres'],
      { shell: false, windowsHide: true, stdio: ['pipe','pipe','pipe'] });
    let stderr = ''; let stdoutBytes = 0; let exceeded = false; let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, 90000);
    child.stdout.on('data', chunk => { stdoutBytes += chunk.length; if (stdoutBytes > 1024*1024) { exceeded = true; child.kill(); } });
    child.stderr.on('data', chunk => { if (stderr.length < 32768) stderr += chunk.toString('utf8'); });
    child.stdin.on('error', () => {});
    child.on('error', () => { clearTimeout(timer); reject(new Error('Owned-local admin rehearsal process could not start.')); });
    child.on('close', code => { clearTimeout(timer);
      if (code !== 0 || exceeded || timedOut) reject(new Error(timedOut ? 'Owned-local rehearsal exceeded its process deadline.' : exceeded ? 'Owned-local rehearsal exceeded its output bound.' : diagnostic(new Error(stderr))));
      else resolve({});
    });
    child.stdin.end(sql);
  });
}
async function ownBackendSettled(runId) {
  const sql = `begin read only; select jsonb_build_object('remaining',count(*)) from pg_stat_activity where application_name='eps-stage-candidate-${runId}'; rollback;`;
  for (let attempt = 0; attempt < 20; attempt++) {
    const result = await runOwnedLocalSql(sql);
    const rows = result.stdout.split(/\r?\n/u).filter(line=>line.startsWith('{')).map(line=>JSON.parse(line));
    if (rows.length === 1 && rows[0].remaining === 0) return true;
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  return false;
}
async function main() {
  assert(process.argv.length === 2 && /^v24\./u.test(process.version), 'Use pinned Node24 without target/file/mode arguments.');
  const runId = randomUUID(); let ownsLock = false; let before; let after;
  const receipt = { schema_version: '1.0', run_id: runId, started_at: new Date().toISOString(), result: 'failed',
    candidate: CANDIDATE, assertions: ASSERTIONS, hashes: HASHES, harness_sha256: sha256(await readFile(new URL(import.meta.url))),
    cloud_called: false, provider_called: false, assignments_integrated: false, concurrent_sessions_tested: false,
    persisted_kernel_tested: false, source_submission_tested: false, retained_source_correction_tested: false, pipeline_config_enabled: false, service_identity_provisioned: false, job_callbacks_tested: false, promotion_performed: false,
    scope: 'Combined source retention, ordinary pasted-source correction and initial stage publication in one owned-local rollback transaction. One SQL transaction only; no multi-backend, HTTP, provider, native executor, n8n or deployed pipeline acceptance.' };
  try {
    const target = await pinnedTarget();
    receipt.environment = { container: target.config.container, system_identifier: target.observed.system_identifier, host_ip: '127.0.0.1', host_port: '55433', image_digest: target.config.image_digest };
    await mkdir(path.dirname(LOCK), { recursive: true }); const handle = await open(LOCK, 'wx', 0o600);
    try { await handle.writeFile(JSON.stringify({ run_id: runId, pid: process.pid })); await handle.sync(); ownsLock = true; } finally { await handle.close(); }
    const candidate = await sealedSource(CANDIDATE, HASHES.candidate); const assertions = await sealedSource(ASSERTIONS, HASHES.assertions);
    before = await inspect();
    assert(JSON.stringify(before.versions) === JSON.stringify(VERSIONS) && before.candidate_relations === 3 && before.candidate_roles === 2 && before.candidate_routines === 27
      && before.stage_payloads === 0 && before.pipeline_relations === 0 && before.provenance_columns === 0 && before.submit_routines === 0 && before.stage_roles === 0 && before.stage_routines === 0 && before.stage_policies === 0,
      'Require exact nine-version local baseline without stage-kernel objects to adopt.');
    receipt.before = before;
    receipt.execution_attempted = true;
    Object.assign(receipt, await rehearseAsLocalAdmin(candidate,assertions,runId,receipt));
    receipt.transaction_completed_to_rollback = true; receipt.job_callbacks_tested = true; receipt.source_submission_tested = true; receipt.retained_source_correction_tested = true;
  } catch (error) { receipt.error = diagnostic(error); }
  finally {
    if (before) {
      try {
        receipt.owned_backend_settled = false;
        receipt.owned_backend_settled = await ownBackendSettled(runId);
        assert(receipt.owned_backend_settled, 'Own rehearsal backend did not settle; retaining shared DB lock.');
        after = await inspect(); receipt.after = after;
        receipt.catalog_and_all_counts_restored = JSON.stringify(before) === JSON.stringify(after);
        receipt.rollback_verified = receipt.catalog_and_all_counts_restored;
        if (receipt.transaction_completed_to_rollback && receipt.rollback_verified) receipt.result = 'passed';
      } catch (error) { receipt.verification_error = diagnostic(error); receipt.rollback_verified = false; }
    }
    if (ownsLock && receipt.owned_backend_settled !== false) { try { const owner = JSON.parse(await readFile(LOCK,'utf8')); assert(owner.run_id === runId && owner.pid === process.pid, 'Shared DB test lock owner changed; refusing removal.'); await unlink(LOCK); }
      catch (error) { receipt.result = 'failed'; receipt.lock_error = diagnostic(error); } }
    receipt.finished_at = new Date().toISOString();
    const directory = path.join(ROOT,'tracking/evidence/m02/specs-pipeline-candidate'); await mkdir(directory,{ recursive:true });
    const file = path.join(directory,`${receipt.finished_at.replace(/[:.]/gu,'-')}-${runId.slice(0,8)}-rollback.json`);
    await writeFile(file,JSON.stringify(receipt,null,2)+'\n',{ flag:'wx' });
    process.stdout.write(`M02 specs-pipeline candidate: ${receipt.result}\nReceipt: ${path.relative(ROOT,file).replaceAll('\\','/')}\n`);
    if (receipt.result !== 'passed') { process.stderr.write(`${receipt.error ?? receipt.verification_error ?? receipt.lock_error ?? 'Catalog/count rollback was not verified.'}\n`); process.exitCode=1; }
  }
}
main().catch(error=>{ process.stderr.write(diagnostic(error)+'\n'); process.exitCode=1; });
