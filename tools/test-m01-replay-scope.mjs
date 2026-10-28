// Fixed synthetic fixture in the fingerprinted local container. Never a cloud/Auth HTTP test.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFile, mkdir, open, unlink, writeFile } from 'node:fs/promises';
import process from 'node:process';
import { URL } from 'node:url';
import { runOwnedLocalSql, verifyLocalTarget } from './local-postgres.mjs';

const mode = process.argv[2]; const runId = randomUUID();
const lockFile = new URL('../.local/local-postgres/test-db.lock', import.meta.url);
assert(process.argv.length === 3 && ['baseline', 'fixed'].includes(mode), 'Use baseline or fixed; no target arguments.');
const migration = 'supabase/migrations/20261028162702_m01_replay_scope_refresh.sql';
const digest = value => createHash('sha256').update(value).digest('hex');
const migrationHash = digest(await readFile(migration));
assert.equal(migrationHash, '82a4f2ec03efc0787aa58e5f1e68ab626e5dddb5e4c645444103456757bf4251');
const ids = Object.fromEntries(['actor', 'client', 'project', 'workspace', 'asset', 'upload', 'cancelAsset', 'cancelUpload', 'preset'].map((key, index) => [key, `73000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`]));
const q = value => `'${String(value).replaceAll("'", "''")}'`;
const jb = value => `${q(JSON.stringify(value))}::jsonb`;
const actorSql = `set local role authenticated; select set_config('request.jwt.claim.sub',${q(ids.actor)},true); select set_config('request.jwt.claims',${jb({ sub: ids.actor, role: 'authenticated', is_anonymous: false })}::text,true);`;
const cached = { marker: 'local-synthetic-cache-only', workspace_id: ids.workspace };
const complete = { actual_size_bytes: 10, start_processing: false };
const projectInput = { row_version: 1, name: 'Synthetic replay correction' };
const clientInput = { row_version: 1, client_name: 'Synthetic replay client', expected_client_row_version: 1 };
const workspaceInput = { row_version: 1, logo_placement: 'every_slide' };
const cases = [
  ['project', 'update_project', { id: ids.project, input: projectInput }, key => `public.eps_update_project(${q(ids.project)},${jb(projectInput)},${q(key)})`, 'membership'],
  ['client', 'update_project', { id: ids.project, input: clientInput }, key => `public.eps_update_project(${q(ids.project)},${jb(clientInput)},${q(key)})`, 'client'],
  ['create-workspace', 'create_workspace', { project_id: ids.project, initial_output: 'selection' }, key => `public.eps_create_workspace(${jb({ project_id: ids.project, initial_output: 'selection' })},${q(key)})`, 'membership'],
  ['workspace', 'update_workspace', { id: ids.workspace, input: workspaceInput }, key => `public.eps_update_workspace(${q(ids.workspace)},${jb(workspaceInput)},${q(key)})`, 'membership'],
  ['reserve', 'create_upload_session', { workspace_id: ids.workspace, purpose: 'client_logo', filename: 'synthetic.png', mime_type: 'image/png', size_bytes: 10 }, key => `public.eps_reserve_logo_upload(${jb({ workspace_id: ids.workspace, purpose: 'client_logo', filename: 'synthetic.png', mime_type: 'image/png', size_bytes: 10 })},${q(key)})`, 'membership'],
  ['prepare', 'complete_upload', { id: ids.upload, input: complete }, key => `public.eps_prepare_logo_completion(${q(ids.upload)},${jb(complete)},${q(key)})`, 'membership'],
  ['finalize', 'complete_upload', { id: ids.upload, input: complete }, key => `public.eps_finalize_logo_completion(${q(ids.upload)},${jb(complete)},${q(key)},'unused-cached-path','unused-cached-path')`, 'membership'],
  ['cancel', 'cancel_upload', { id: ids.cancelUpload }, key => `public.eps_cancel_logo_upload(${q(ids.cancelUpload)},${q(key)})`, 'membership'],
  ['create-preset', 'create_audience_preset', { label: 'Synthetic replay preset', scope: 'external', settings: {} }, key => `public.eps_create_audience_preset(${jb({ label: 'Synthetic replay preset', scope: 'external', settings: {} })},${q(key)})`, 'settings'],
  ['update-preset', 'update_audience_preset', { id: ids.preset, input: { row_version: 1, label: 'Synthetic replay preset' } }, key => `public.eps_update_audience_preset(${q(ids.preset)},${jb({ row_version: 1, label: 'Synthetic replay preset' })},${q(key)})`, 'settings'],
  ['archive-preset', 'archive_audience_preset', { id: ids.preset, input: { row_version: 1 } }, key => `public.eps_archive_audience_preset(${q(ids.preset)},${jb({ row_version: 1 })},${q(key)})`, 'settings'],
];
const countsSql = `select jsonb_build_object('auth',(select count(*) from auth.users),'clients',(select count(*) from public.clients),'projects',(select count(*) from public.projects),'workspaces',(select count(*) from eps.workspaces),'media',(select count(*) from eps.media_assets),'uploads',(select count(*) from eps.upload_sessions),'idempotency',(select count(*) from eps.idempotency_records),'audit',(select count(*) from eps.audit_events),'presets',(select count(*) from eps.audience_presets)) as counts;`;
const jsonLines = result => result.stdout.split(/\r?\n/u).filter(line => line.startsWith('{')).map(line => JSON.parse(line));
async function sql(text) { return runOwnedLocalSql(text); }
const reset = `update public.project_memberships set active=true where project_id=${q(ids.project)} and principal_id=${q(ids.actor)}; update public.client_memberships set active=true where client_id=${q(ids.client)} and principal_id=${q(ids.actor)}; update public.app_capability_grants set active=true where principal_id=${q(ids.actor)};`;
const fixture = `begin;
do $guard$ begin if exists(select 1 from auth.users) or exists(select 1 from public.projects) or exists(select 1 from eps.workspaces) or exists(select 1 from eps.media_assets) or exists(select 1 from eps.idempotency_records) then raise exception 'REPLAY_FIXTURE_REQUIRES_EMPTY_LOCAL_BUSINESS_STATE'; end if; end $guard$;
insert into auth.users(id) values(${q(ids.actor)});
insert into public.clients(id,name) values(${q(ids.client)},'Synthetic replay client');
insert into public.projects(id,client_id,name) values(${q(ids.project)},${q(ids.client)},'Synthetic replay project');
insert into public.project_memberships(project_id,principal_id,can_write) values(${q(ids.project)},${q(ids.actor)},true);
insert into public.client_memberships(client_id,principal_id,can_write) values(${q(ids.client)},${q(ids.actor)},true);
insert into public.app_capability_grants(principal_id,capability) select ${q(ids.actor)},capability from unnest(array['projects.read','projects.write','workspaces.read','workspaces.write','settings.manage']) capability;
insert into eps.workspaces(id,project_id) values(${q(ids.workspace)},${q(ids.project)});
insert into eps.audience_presets(id,key,label,scope) values(${q(ids.preset)},'m01_replay_local_only','Synthetic replay preset','external');
insert into eps.media_assets(id,origin_workspace_id,purpose,filename,mime_type,bucket,object_key,size_bytes,sha256,width,height,status)
values(${q(ids.asset)},${q(ids.workspace)},'client_logo','synthetic.png','image/png','eps-brand-assets','local-replay/ready',10,repeat('a',64),1,1,'ready'),
(${q(ids.cancelAsset)},${q(ids.workspace)},'client_logo','synthetic.png','image/png','eps-brand-assets','local-replay/cancelled',10,null,null,null,'uploading');
insert into eps.upload_sessions(id,asset_id,principal_id,workspace_id,bucket,object_key,expected_size_bytes,expected_mime_type,status,completed_at)
values(${q(ids.upload)},${q(ids.asset)},${q(ids.actor)},${q(ids.workspace)},'eps-brand-assets','local-replay/ready',10,'image/png','completed',now()),
(${q(ids.cancelUpload)},${q(ids.cancelAsset)},${q(ids.actor)},${q(ids.workspace)},'eps-brand-assets','local-replay/cancelled',10,'image/png','cancelled',null);
${cases.map(([name, operation, payload]) => `insert into eps.idempotency_records(principal_id,operation,key,request_hash,response) values(${q(ids.actor)},${q(operation)},${q('replay-' + name)},encode(sha256(convert_to(${jb(payload)}::text,'UTF8')),'hex'),${jb(name === 'reserve' ? { ...cached, upload_id: ids.upload } : cached)});`).join('\n')}
commit;`;
const cleanup = `begin;
do $empty_specs$ begin if to_regclass('eps.specs') is not null then
  perform 1 from eps.workspaces where id=${q(ids.workspace)} for update;
  perform 1 from eps.specs where workspace_id=${q(ids.workspace)} order by id for update;
  if (select count(*) from eps.specs where workspace_id=${q(ids.workspace)})<>1
    or exists(select 1 from eps.roles where workspace_id=${q(ids.workspace)}) or exists(select 1 from eps.slots where workspace_id=${q(ids.workspace)})
    or exists(select 1 from eps.specs where workspace_id=${q(ids.workspace)} and
      (source_asset_id is not null or source_text is not null or normalized_instructions is not null or source_extraction is not null
        or clarifications<>'[]'::jsonb or source_language_codes<>array[]::text[] or processing_job_id is not null or row_version<>1 or source_row_version<>1))
  then raise exception 'REPLAY_NONEMPTY_SPECS_PRESERVE_DATA'; end if;
  delete from eps.specs where workspace_id=${q(ids.workspace)};
end if; end $empty_specs$;
delete from eps.idempotency_records where principal_id=${q(ids.actor)};
delete from eps.audit_events where principal_id=${q(ids.actor)};
delete from eps.upload_sessions where id in(${q(ids.upload)},${q(ids.cancelUpload)}) and principal_id=${q(ids.actor)};
delete from eps.media_assets where id in(${q(ids.asset)},${q(ids.cancelAsset)}) and origin_workspace_id=${q(ids.workspace)};
delete from eps.user_workspace_preferences where principal_id=${q(ids.actor)} and workspace_id=${q(ids.workspace)};
delete from eps.workspaces where id=${q(ids.workspace)} and project_id=${q(ids.project)};
delete from public.project_memberships where principal_id=${q(ids.actor)} and project_id=${q(ids.project)};
delete from public.client_memberships where principal_id=${q(ids.actor)} and client_id=${q(ids.client)};
delete from public.app_capability_grants where principal_id=${q(ids.actor)};
delete from public.projects where id=${q(ids.project)} and client_id=${q(ids.client)};
delete from public.clients where id=${q(ids.client)} and name='Synthetic replay client';
delete from eps.audience_presets where id=${q(ids.preset)} and key='m01_replay_local_only';
delete from auth.users where id=${q(ids.actor)};
commit;`;
const receipt = { started_at: new Date().toISOString(), mode, result: 'failed', migration, migration_sha256: migrationHash,
  harness_sha256: digest(await readFile(new URL(import.meta.url))), scope: 'fingerprinted owned local PostgreSQL; synthetic Auth catalog and directly seeded replay cache, no Auth/Storage HTTP',
  cloud_called: false, service_credentials_used: false, cases: [], cleanup: { attempted: false }, limitations: 'Tests idempotency wait/revocation only; no real media transfer, receipt MAC acceptance, later row-lock revocation, provider or UI claim.' };
let setup = false; let ownsLock = false; const pending = [];
try {
  await verifyLocalTarget();
  const handle = await open(lockFile, 'wx', 0o600);
  try { await handle.writeFile(JSON.stringify({ run_id: runId, pid: process.pid })); await handle.sync(); ownsLock = true; }
  finally { await handle.close(); }
  const before = jsonLines(await sql(countsSql))[0]; receipt.before = before;
  const history = jsonLines(await sql(`select jsonb_build_object('applied',exists(select 1 from supabase_migrations.schema_migrations where version='20261028162702'));`))[0];
  assert.equal(history.applied, mode === 'fixed', 'Baseline/fixed mode differs from actual local migration history.');
  await sql(fixture); setup = true;
  for (const [name, operation, payload, call, revoke] of cases) {
    await sql(`begin; ${reset} commit;`);
    const key = 'replay-' + name;
    // Positive control: the seeded closed/completed cache is readable with current
    // permissions, including completed/cancelled state. No effect is applied.
    const control = await sql(`begin; ${actorSql} select jsonb_build_object('cached',(${call(key)}) is not null); rollback;`);
    assert.equal(jsonLines(control).at(-1)?.cached, true, `${name}: legitimate replay failed`);
    const lock = `hashtextextended(${q(ids.actor + ':' + operation + ':' + key)},0)`;
    const app = `eps-replay-${name}`;
    const revocation = revoke === 'membership' ? `update public.project_memberships set active=false where project_id=${q(ids.project)} and principal_id=${q(ids.actor)};`
      : revoke === 'client' ? `update public.client_memberships set active=false where client_id=${q(ids.client)} and principal_id=${q(ids.actor)};`
      : `update public.app_capability_grants set active=false where principal_id=${q(ids.actor)} and capability='settings.manage';`;
    const holder = sql(`begin; select pg_advisory_xact_lock(${lock});
      do $wait$ declare deadline timestamptz:=clock_timestamp()+interval '18 seconds'; waiter_pid integer; begin loop
        select waiting.pid into waiter_pid from pg_locks held join pg_locks waiting on waiting.locktype=held.locktype and waiting.database=held.database and waiting.classid=held.classid and waiting.objid=held.objid and waiting.objsubid=held.objsubid
          join pg_stat_activity activity on activity.pid=waiting.pid where held.pid=pg_backend_pid() and held.granted and not waiting.granted and activity.application_name=${q(app)};
        if found then perform set_config('eps.replay_waiter_pid',waiter_pid::text,true); exit; end if;
        if clock_timestamp()>deadline then raise exception 'EXACT_REPLAY_WAITER_NOT_OBSERVED'; end if;
        perform pg_stat_clear_snapshot(); perform pg_sleep(0.03);
      end loop; end $wait$;
      ${revocation}
      select jsonb_build_object('holder_pid',pg_backend_pid(),'waiter_pid',current_setting('eps.replay_waiter_pid')::integer,'exact_advisory_wait_observed',true,'revocation_committed_before_unlock',true); commit;`);
    pending.push(holder); holder.catch(() => undefined);
    // Poll only the known lock; ensure the holder acquired it before starting RPC.
    let locked = false;
    for (let attempt = 0; attempt < 20 && !locked; attempt++) {
      locked = jsonLines(await sql(`select jsonb_build_object('locked',exists(select 1 from pg_locks where locktype='advisory' and granted and objsubid=1 and classid=(((${lock})>>32)&4294967295)::oid and objid=((${lock})&4294967295)::oid));`))[0]?.locked === true;
    }
    assert(locked, 'The intended local holder lock was not observed.');
    let denied = false; let failureCode = null;
    const waiter = sql(`set application_name=${q(app)}; begin; ${actorSql} select ${call(key)}; commit;`)
      .catch(error => { if (/RESOURCE_NOT_FOUND|CAPABILITY_REQUIRED/u.test(error.message)) { denied = true; failureCode = /CAPABILITY_REQUIRED/u.test(error.message) ? 'CAPABILITY_REQUIRED' : 'RESOURCE_NOT_FOUND'; return null; } throw error; });
    const settled = await Promise.allSettled([holder, waiter]);
    for (const value of settled) if (value.status === 'rejected') throw value.reason;
    const proof = jsonLines(settled[0].value).at(-1);
    assert.equal(proof.exact_advisory_wait_observed, true);
    assert.notEqual(proof.holder_pid, proof.waiter_pid);
    receipt.cases.push({ name, operation, revoke, holder_pid: proof.holder_pid, waiter_pid: proof.waiter_pid, exact_advisory_wait_observed: true, legitimate_replay_passed: true,
      denied_after_concurrent_revocation: denied, code: failureCode, composed_input_sha256: digest(JSON.stringify(payload)) });
    assert.equal(denied, mode === 'fixed' || name === 'reserve', `${name}: expected ${mode === 'fixed' || name === 'reserve' ? 'denial' : 'vulnerable baseline reproduction'}`);
    process.stdout.write(`${name}: ${denied ? 'denied' : 'baseline cache exposed'}\n`);
  }
  receipt.result = mode === 'fixed' ? 'passed' : 'vulnerability_reproduced';
} catch (error) {
  receipt.reason = error.message.replace(/[A-Za-z0-9_-]{43,}/gu, '[LONG_VALUE_REDACTED]').slice(0, 2000);
} finally {
  await Promise.allSettled(pending);
  if (setup) {
    receipt.cleanup.attempted = true;
    try { await sql(cleanup); const after = jsonLines(await sql(countsSql))[0]; receipt.after = after; assert.deepEqual(after, receipt.before); receipt.cleanup.result = 'passed'; }
    catch (error) { receipt.cleanup.result = 'failed'; receipt.result = 'failed'; receipt.cleanup.reason = error.message.slice(0, 1000); }
  }
  if (ownsLock) {
    try { const owner = JSON.parse(await readFile(lockFile, 'utf8')); assert.equal(owner.run_id, runId); assert.equal(owner.pid, process.pid); await unlink(lockFile); }
    catch (error) { receipt.result = 'failed'; receipt.lock_error = error.message.slice(0, 500); }
  }
  receipt.finished_at = new Date().toISOString();
  const directory = 'tracking/evidence/m01/replay-scope'; await mkdir(directory, { recursive: true });
  const file = `${directory}/${receipt.finished_at.replace(/[:.]/gu, '-')}-${mode}.json`;
  await writeFile(file, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
  process.stdout.write(JSON.stringify({ result: receipt.result, cases: receipt.cases.length, cleanup: receipt.cleanup.result, receipt: file, reason: receipt.reason }) + '\n');
  if (receipt.result === 'failed') process.exitCode = 1;
}
