/** Fixed read-only reconciliation of one committed local10 promotion.
 * Never applies/reverts SQL or rewrites the original failed receipt/driver.
 */
import { Buffer } from 'node:buffer';
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, realpath, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { clearTimeout, setTimeout } from 'node:timers';
import { isDeepStrictEqual } from 'node:util';
const ROOT=path.resolve(import.meta.dirname,'..');
const LOCK=path.join(ROOT,'.local/local-postgres/test-db.lock');
const CLAIM=path.join(ROOT,'.local/local-postgres/reconcile-b32c1d2d.lock');
const ENDPOINT=process.platform==='win32'?'npipe:////./pipe/dockerDesktopLinuxEngine':'unix:///var/run/docker.sock';
const ORIGINAL_RUN='b32c1d2d-5a10-4743-ba10-896dd5ff3424';
const ORIGINAL_PID=2384;
const ORIGINAL_LOCK_SHA='e6dfc556d20b93cfc501d7206b974b5fd83876597330421224af585f049f1d79';
const FAILURE='tracking/evidence/m02/specs-pipeline-local-promotion/2026-10-28T22-26-28-140Z-b32c1d2d.json';
const MIGRATION='supabase/migrations/20261028222030_m02_specs_pipeline.sql';
const VERSION='20261028222030';
const BASE_VERSIONS=['20261028010943','20261028013324','20261028013655','20261028024205','20261028072515','20261028162702','20261028162800','20261028172320','20261028184145'];
const SEALS={
 failure:'9b9eea7c3c105fcf7333faebcb6ab5f2131f192f6f7720022039c4957d6ccad6',
 original_apply:'af142805ed2d8766813a5c4f0cb857eda48464c8dadc40f91b06db3dc8b328cb',
 migration:'1e5319bb81be1f12896f7efb5a2cb7706653b79eb440a4dc1aaaca4ed9556895',
 manifest:'001d5e7992a2a475a2213f56eaac7a3d5d98da0fd720687ae8380c0c7eda6e81',
 target_helper:'9fdcc8f78a654cedd35821305564ab821ec3bf837c119c592d3ecd2c2ec14968',
 legacy_target_helper:'49929bce8eb51194d9299cfd9639e537eb237daaec76c15740cb88059604e2de',
};
const sha=value=>createHash('sha256').update(value).digest('hex');
function check(value,code){if(!value)throw new Error(code);}
async function sealed(file,expected){const absolute=path.resolve(ROOT,file);check(await realpath(absolute)===absolute,'RECONCILE_SOURCE_LINK_REJECTED');const bytes=await readFile(absolute);check(sha(bytes)===expected,'RECONCILE_SOURCE_SEAL_CHANGED');return bytes;}

// Explicit13 reviewed old routines /17 EXEC additions. No wildcard ACL exception.
const ALLOWED_OLD_ACL={
  "eps.jobs_dto(p_job uuid)": {
    "grant_signature": "eps.jobs_dto(uuid)",
    "grants": [
      {
        "grantee": "eps_specs_submit_owner",
        "grantor": "eps_jobs_owner",
        "privilege": "X",
        "grant_option": false
      }
    ]
  },
  "eps.input_uuid(p_value text)": {
    "grant_signature": "eps.input_uuid(text)",
    "grants": [
      {
        "grantee": "eps_specs_submit_owner",
        "grantor": "eps_api_owner",
        "privilege": "X",
        "grant_option": false
      }
    ]
  },
  "eps.jobs_hash_v1(p_input jsonb)": {
    "grant_signature": "eps.jobs_hash_v1(jsonb)",
    "grants": [
      {
        "grantee": "eps_specs_apply_owner",
        "grantor": "eps_jobs_owner",
        "privilege": "X",
        "grant_option": false
      },
      {
        "grantee": "eps_specs_stage_owner",
        "grantor": "eps_jobs_owner",
        "privilege": "X",
        "grant_option": false
      },
      {
        "grantee": "eps_specs_submit_owner",
        "grantor": "eps_jobs_owner",
        "privilege": "X",
        "grant_option": false
      }
    ]
  },
  "eps.specs_changed(p_workspace uuid)": {
    "grant_signature": "eps.specs_changed(uuid)",
    "grants": [
      {
        "grantee": "eps_specs_submit_owner",
        "grantor": "eps_specs_owner",
        "privilege": "X",
        "grant_option": false
      }
    ]
  },
  "eps.require_capability(p_capability text)": {
    "grant_signature": "eps.require_capability(text)",
    "grants": [
      {
        "grantee": "eps_specs_submit_owner",
        "grantor": "eps_api_owner",
        "privilege": "X",
        "grant_option": false
      }
    ]
  },
  "eps.specs_lock_workspace(p_workspace uuid)": {
    "grant_signature": "eps.specs_lock_workspace(uuid)",
    "grants": [
      {
        "grantee": "eps_specs_submit_owner",
        "grantor": "eps_specs_owner",
        "privilege": "X",
        "grant_option": false
      }
    ]
  },
  "eps.expected_version(p_input jsonb, p_key text)": {
    "grant_signature": "eps.expected_version(jsonb,text)",
    "grants": [
      {
        "grantee": "eps_specs_submit_owner",
        "grantor": "eps_api_owner",
        "privilege": "X",
        "grant_option": false
      }
    ]
  },
  "eps.check_input(p_input jsonb, p_allowed text[])": {
    "grant_signature": "eps.check_input(jsonb,text[])",
    "grants": [
      {
        "grantee": "eps_specs_submit_owner",
        "grantor": "eps_api_owner",
        "privilege": "X",
        "grant_option": false
      }
    ]
  },
  "eps.specs_scope(p_workspace uuid, p_write boolean)": {
    "grant_signature": "eps.specs_scope(uuid,boolean)",
    "grants": [
      {
        "grantee": "eps_specs_submit_owner",
        "grantor": "eps_specs_owner",
        "privilege": "X",
        "grant_option": false
      }
    ]
  },
  "eps.specs_assert_rows(p_actual bigint, p_expected bigint)": {
    "grant_signature": "eps.specs_assert_rows(bigint,bigint)",
    "grants": [
      {
        "grantee": "eps_specs_submit_owner",
        "grantor": "eps_specs_owner",
        "privilege": "X",
        "grant_option": false
      }
    ]
  },
  "eps.idempotency_begin(p_operation text, p_key text, p_input jsonb)": {
    "grant_signature": "eps.idempotency_begin(text,text,jsonb)",
    "grants": [
      {
        "grantee": "eps_specs_submit_owner",
        "grantor": "eps_api_owner",
        "privilege": "X",
        "grant_option": false
      }
    ]
  },
  "eps.fail(p_code text, p_message text, p_status integer, p_current_version bigint)": {
    "grant_signature": "eps.fail(text,text,integer,bigint)",
    "grants": [
      {
        "grantee": "eps_specs_apply_owner",
        "grantor": "eps_api_owner",
        "privilege": "X",
        "grant_option": false
      },
      {
        "grantee": "eps_specs_stage_owner",
        "grantor": "eps_api_owner",
        "privilege": "X",
        "grant_option": false
      },
      {
        "grantee": "eps_specs_submit_owner",
        "grantor": "eps_api_owner",
        "privilege": "X",
        "grant_option": false
      }
    ]
  },
  "eps.m02_enqueue_specs_job(p_workspace_id uuid, p_input jsonb, p_idempotency_key text)": {
    "grant_signature": "eps.m02_enqueue_specs_job(uuid,jsonb,text)",
    "grants": [
      {
        "grantee": "eps_specs_submit_owner",
        "grantor": "eps_jobs_owner",
        "privilege": "X",
        "grant_option": false
      }
    ]
  }
};
async function sql(containerId, text) {
  return await new Promise((resolve, reject) => {
    const child = spawn('docker', ['--host',ENDPOINT,'exec','--user','postgres','-i',containerId,
      'env','-i','PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin','HOME=/tmp','PGPASSFILE=/dev/null',
      'psql','-X','-q','-A','-t','-w','-v','ON_ERROR_STOP=1','-v','VERBOSITY=sqlstate','-v','SHOW_CONTEXT=never',
      '-h','/var/run/postgresql','-U','postgres','-d','postgres'], { shell:false,windowsHide:true,stdio:['pipe','pipe','pipe'] });
    let stdout=''; let uncertain=false; const timer=setTimeout(()=>{uncertain=true;child.kill();},60000);
    child.stdin.on('error',()=>{}); child.stderr.resume();
    child.stdout.on('data',chunk=>{if(stdout.length+chunk.length>512*1024){uncertain=true;child.kill();}else stdout+=chunk.toString('utf8');});
    child.on('error',()=>{uncertain=true;});
    child.on('close',code=>{clearTimeout(timer);if(uncertain||code!==0)reject(new Error('PIPELINE_LOCAL_OPERATION_UNCONFIRMED'));else resolve(stdout);});
    child.stdin.end(text);
  });
}
function one(output) {
  const rows=output.split(/\r?\n/u).filter(line=>line.startsWith('{'));check(rows.length===1,'PIPELINE_LOCAL_READBACK_UNCONFIRMED');return JSON.parse(rows[0]);
}

const INSPECTION = `begin read only;
do $snapshot$ declare relation record; counts jsonb:='{}'; digests jsonb:='{}'; amount bigint; digest text; begin
 for relation in select namespace.nspname,table_row.relname from pg_class table_row join pg_namespace namespace on namespace.oid=table_row.relnamespace
  where namespace.nspname in('eps','public','auth','storage','eps_local_guard','supabase_migrations') and table_row.relkind in('r','p') order by namespace.nspname,table_row.relname loop
  execute format('select count(*),encode(sha256(convert_to(coalesce(string_agg(row_value::text,E''\\n'' order by row_value::text),''''),''UTF8'')),''hex'') from (select to_jsonb(item)-''source_extraction_job_id''-''source_job_id'' as row_value from %I.%I item) rows',relation.nspname,relation.relname) into amount,digest;
  counts:=counts||jsonb_build_object(relation.nspname||'.'||relation.relname,amount); digests:=digests||jsonb_build_object(relation.nspname||'.'||relation.relname,digest);
 end loop;
 perform set_config('eps.pipeline.promotion.counts',counts::text,true);perform set_config('eps.pipeline.promotion.digests',digests::text,true);
end $snapshot$;
select jsonb_build_object('query_role',current_user,'database',current_database(),
 'system_identifier',(pg_control_system()).system_identifier::text,
 'versions',(select jsonb_agg(version order by version) from supabase_migrations.schema_migrations),
 'ledger',(select jsonb_object_agg(path,sha256) from eps_local_guard.migration_replay),
 'counts',current_setting('eps.pipeline.promotion.counts')::jsonb,'digests',current_setting('eps.pipeline.promotion.digests')::jsonb,
 'functions',(select jsonb_object_agg(namespace.nspname||'.'||routine.proname||'('||pg_get_function_identity_arguments(routine.oid)||')',
  jsonb_build_array(routine.proowner,routine.prosecdef,routine.provolatile,routine.proconfig,routine.proacl,encode(sha256(convert_to(routine.prosrc,'UTF8')),'hex')))
  from pg_proc routine join pg_namespace namespace on namespace.oid=routine.pronamespace where namespace.nspname='eps' or namespace.nspname='public' and routine.proname like 'eps\\_%' escape '\\'));
rollback;`;

const DEFAULT_STATE="begin read only;select jsonb_build_object('disabled',count(*)=1 and bool_and(not enabled),'model_unset',bool_and(model_version is null),'private_inputs',(select count(*) from eps.specs_source_inputs),'private_payloads',(select count(*) from eps.specs_stage_payloads)) from eps.specs_pipeline_config;rollback;";
const sortedACL=items=>{check(Array.isArray(items)&&new Set(items).size===items.length,'RECONCILE_ACL_SHAPE_INVALID');return [...items].sort();};
export function validateOldFunctions(before,after){
 let affected=0;let additions=0;
 for(const [signature,oldFields]of Object.entries(before)){
  const next=after[signature];check(Array.isArray(oldFields)&&oldFields.length===6&&Array.isArray(next)&&next.length===6,'RECONCILE_OLD_ROUTINE_MISSING');
  check(isDeepStrictEqual(oldFields.slice(0,4),next.slice(0,4))&&isDeepStrictEqual(oldFields.slice(5),next.slice(5)),'RECONCILE_NON_ACL_FUNCTION_DRIFT');
  const allowed=ALLOWED_OLD_ACL[signature];const original=sortedACL(oldFields[4]);
  const extra=allowed?allowed.grants.map(item=>{check(item.privilege==='X'&&item.grant_option===false,'RECONCILE_EXECUTE_ONLY_MAP_REQUIRED');return `${item.grantee}=X/${item.grantor}`;}):[];
  check(extra.every(item=>!original.includes(item)),'RECONCILE_EXPECTED_ADDITIONS_ALREADY_PRESENT');
  check(isDeepStrictEqual(sortedACL([...original,...extra]),sortedACL(next[4])),'RECONCILE_UNREVIEWED_ACL_DRIFT');
  if(allowed){affected++;additions+=extra.length;}
 }
 check(affected===13&&additions===17&&Object.keys(ALLOWED_OLD_ACL).every(key=>Object.hasOwn(before,key)),'RECONCILE_EXACT_13_ROUTINES_17_EXEC_REQUIRED');
 return {old_routines:Object.keys(before).length,reviewed_acl_routines:affected,reviewed_execute_additions:additions};
}
export function validateReviewedGrants(migration){
 const observed=new Set();const known=new Set(Object.values(ALLOWED_OLD_ACL).map(item=>item.grant_signature));
 for(const match of migration.matchAll(/^grant execute on function\s+([^;]+?)\s+to\s+(eps_specs_(?:submit|stage|apply)_owner)\s*;/gmu)){
  for(const routine of match[1].matchAll(/(?:eps|public)\.[a-z_][a-z0-9_]*\([^)]*\)/gu)){
   const signature=routine[0].replace(/\s/gu,'');if(known.has(signature))observed.add(`${signature}:${match[2]}`);
  }
 }
 const expected=new Set(Object.values(ALLOWED_OLD_ACL).flatMap(item=>item.grants.map(grant=>`${item.grant_signature}:${grant.grantee}`)));
 check(isDeepStrictEqual([...observed].sort(),[...expected].sort()),'RECONCILE_ACL_MAP_NOT_IN_REVIEWED_MIGRATION');
 return observed.size;
}
export function validateSnapshots(failed,current,defaultState,expectedLedger){
 check(failed.result==='failed'&&failed.run_id===ORIGINAL_RUN&&failed.commit_returned===true&&failed.commit_observed===true
  &&failed.owned_backend_settled===true&&failed.prior_business_data_unchanged===true&&failed.prior_function_contracts_unchanged===false
  &&failed.shared_db_lock_retained===true,'RECONCILE_EXACT_COMMITTED_FAILURE_REQUIRED');
 check(isDeepStrictEqual(failed.before.versions,BASE_VERSIONS)&&isDeepStrictEqual(current.versions,[...BASE_VERSIONS,VERSION])
  &&isDeepStrictEqual(current.ledger,expectedLedger)&&current.query_role==='postgres'&&current.database==='postgres'
  &&current.system_identifier==='7701520506262638626','RECONCILE_EXACT_LOCAL_TEN_REQUIRED');
 check(isDeepStrictEqual(current,failed.after),'RECONCILE_CURRENT_STATE_CHANGED_SINCE_FAILURE');
 for(const key of Object.keys(failed.before.digests)){
  if(['eps_local_guard.migration_replay','supabase_migrations.schema_migrations'].includes(key))continue;
  check(current.counts[key]===failed.before.counts[key]&&current.digests[key]===failed.before.digests[key],'RECONCILE_PRIOR_BUSINESS_DATA_CHANGED');
 }
 check(isDeepStrictEqual(defaultState,failed.default_pipeline)&&defaultState.disabled===true&&defaultState.model_unset===true
  &&defaultState.private_inputs===0&&defaultState.private_payloads===0,'RECONCILE_DEFAULT_DISABLED_EMPTY_INPUTS_REQUIRED');
 return validateOldFunctions(failed.before.functions,current.functions);
}
function originalProcessDead(){
 try{process.kill(ORIGINAL_PID,0);}catch(error){check(error?.code==='ESRCH','RECONCILE_ORIGINAL_PID_DEATH_UNCONFIRMED');return;}
 throw new Error('RECONCILE_ORIGINAL_PROCESS_STILL_EXISTS');
}
export function validateOriginalLockBytes(bytes){
 check(Buffer.isBuffer(bytes)&&sha(bytes)===ORIGINAL_LOCK_SHA,'RECONCILE_ORIGINAL_LOCK_BYTES_CHANGED');
 const value=JSON.parse(bytes.toString('utf8'));check(value.run_id===ORIGINAL_RUN&&value.pid===ORIGINAL_PID,'RECONCILE_ORIGINAL_LOCK_OWNER_CHANGED');
}
async function originalLock(){
 check(await realpath(LOCK)===LOCK,'RECONCILE_ORIGINAL_LOCK_LINK_REJECTED');
 const bytes=await readFile(LOCK);validateOriginalLockBytes(bytes);return bytes;
}
async function sources(){
 const failed=JSON.parse((await sealed(FAILURE,SEALS.failure)).toString('utf8'));
 await sealed('tools/apply-m02-specs-pipeline-local.mjs',SEALS.original_apply);
 const migration=await sealed(MIGRATION,SEALS.migration);
 const manifest=JSON.parse((await sealed('development/local-db/reviewed.json',SEALS.manifest)).toString('utf8'));
 await sealed('tools/lib/native-specs-local-transport.mjs',SEALS.target_helper);
 await sealed('tools/local-postgres.mjs',SEALS.legacy_target_helper);
 check(failed.harness_sha256===SEALS.original_apply&&failed.migration===MIGRATION&&failed.migration_sha256===SEALS.migration
  &&failed.manifest_sha256===SEALS.manifest&&manifest.version===1&&manifest.migrations.length===10,'RECONCILE_ORIGINAL_SOURCE_BINDING_REQUIRED');
 const ledger={};for(const entry of manifest.migrations){check(typeof entry.reviewed_by==='string'&&entry.reviewed_by.trim(),'RECONCILE_MIGRATION_APPROVAL_REQUIRED');await sealed(entry.path,entry.sha256);ledger[entry.path]=entry.sha256;}
 check(ledger[MIGRATION]===SEALS.migration,'RECONCILE_EXACT_MIGRATION_REQUIRED');validateReviewedGrants(migration.toString('utf8'));
 return {failed,ledger};
}
async function readOnly(containerId,statement,runId){
 check(statement.startsWith('begin read only;')&&statement.trimEnd().endsWith('rollback;'),'RECONCILE_READ_ONLY_QUERY_REQUIRED');
 return one(await sql(containerId,statement.replace('begin read only;',`begin read only;set local application_name='eps-pipeline-reconciliation-${runId}';`)));
}
async function noOwnedBackends(containerId,runId){
 const value=await readOnly(containerId,`begin read only;select jsonb_build_object('count',count(*)) from pg_stat_activity where pid<>pg_backend_pid() and application_name in('eps-pipeline-promotion-${ORIGINAL_RUN}','eps-pipeline-reconciliation-${runId}');rollback;`,runId);
 check(value.count===0,'RECONCILE_OWNED_BACKEND_REMAINS');
}
async function main(){
 check(process.argv.length===2&&/^v24\./u.test(process.version),'RECONCILE_FIXED_NODE24_COMMAND_REQUIRED');
 const prepared=await sources();originalProcessDead();const lockBytes=await originalLock();
 const runId=randomUUID();const receipt={schema_version:'1.0',run_id:runId,started_at:new Date().toISOString(),result:'failed',
  original_failed_receipt:FAILURE,original_failed_receipt_sha256:SEALS.failure,original_apply_source_sha256:SEALS.original_apply,
  original_result:'failed',original_result_rewritten:false,migration:MIGRATION,migration_sha256:SEALS.migration,manifest_sha256:SEALS.manifest,
  harness_sha256:sha(await readFile(import.meta.filename)),database_mutated:false,migration_applied_this_run:false,cloud_called:false,
  reset_called:false,seed_called:false,lock_released:false,scope:'Read-only reconciliation of committed owned-local10 and exact reviewed additive old-routine EXEC ACLs; release only the sealed dead original promotion lock. No pipeline/native/provider/concurrency acceptance.'};
 let claimBytes;let claimHandle;let ownsClaim=false;
 try{
  claimHandle=await open(CLAIM,'wx',0o600);ownsClaim=true;claimBytes=Buffer.from(JSON.stringify({run_id:runId,pid:process.pid,original_run:ORIGINAL_RUN}));
  await claimHandle.writeFile(claimBytes);await claimHandle.sync();
  const {verifyNativeSpecsLocalTarget}=await import('./lib/native-specs-local-transport.mjs');
  const target=await verifyNativeSpecsLocalTarget();const containerId=target.container.Id;
  receipt.container_id=containerId;receipt.endpoint_kind=process.platform==='win32'?'npipe':'unix';
  await noOwnedBackends(containerId,runId);
  const current=await readOnly(containerId,INSPECTION,runId);const defaults=await readOnly(containerId,DEFAULT_STATE,runId);
  receipt.validation=validateSnapshots(prepared.failed,current,defaults,prepared.ledger);
  check((await verifyNativeSpecsLocalTarget()).container.Id===containerId,'RECONCILE_TARGET_CHANGED');
  const confirmed=await readOnly(containerId,INSPECTION,runId);check(isDeepStrictEqual(current,confirmed),'RECONCILE_STATE_CHANGED_DURING_READBACK');
  await noOwnedBackends(containerId,runId);await sources();originalProcessDead();
  check((await originalLock()).equals(lockBytes),'RECONCILE_LOCK_CHANGED_BEFORE_RELEASE');
  // This separate exclusive claim prevents concurrent reconcilers from deleting
  // a later test owner's lock. Cooperating test runners never overwrite a lock.
  await unlink(LOCK);receipt.lock_released=true;receipt.original_pid_esrch_confirmed=true;
  receipt.current_state_matches_failed_after=true;receipt.prior_data_unchanged=true;receipt.default_pipeline=defaults;
  receipt.versions=current.versions;receipt.ledger=current.ledger;receipt.current_snapshot_sha256=sha(JSON.stringify(current));
  receipt.owned_backend_settled=true;receipt.result='passed';
 }catch(error){receipt.failure_code=typeof error?.message==='string'&&/^RECONCILE_[A-Z0-9_]+$/u.test(error.message)?error.message:'RECONCILE_UNCONFIRMED';}
 finally{
  if(claimHandle)await claimHandle.close();
  if(ownsClaim){try{check((await readFile(CLAIM)).equals(claimBytes),'RECONCILE_CLAIM_OWNER_CHANGED');await unlink(CLAIM);}catch{receipt.result='failed';receipt.claim_cleanup_unconfirmed=true;}}
  receipt.finished_at=new Date().toISOString();
  const directory=path.join(ROOT,'tracking/evidence/m02/specs-pipeline-local-reconciliation');await mkdir(directory,{recursive:true});
  const file=path.join(directory,`${receipt.finished_at.replace(/[:.]/gu,'-')}-${runId.slice(0,8)}.json`);await writeFile(file,JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
  process.stdout.write(`M02 owned-local10 read-only reconciliation: ${receipt.result}\nReceipt: ${path.relative(ROOT,file).replaceAll('\\','/')}\n`);if(receipt.result!=='passed')process.exitCode=1;
 }
}
if(path.resolve(process.argv[1]??'')===import.meta.filename)main().catch(()=>{process.stderr.write('Exact reviewed reconciliation sources/dead original owner/lock are required; no fallback, database mutation or cloud target is permitted.\n');process.exitCode=1;});
