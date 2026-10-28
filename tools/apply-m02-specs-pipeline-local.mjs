/** One reviewed forward migration, on the fingerprinted owned-local DB only.
 * No cloud/reset/seed/target/file/role options. Earlier history stays immutable.
 */
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, realpath, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { clearTimeout, setTimeout } from 'node:timers';
import { isDeepStrictEqual } from 'node:util';
import { verifyNativeSpecsLocalTarget } from './lib/native-specs-local-transport.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const LOCK = path.join(ROOT, '.local/local-postgres/test-db.lock');
const ENDPOINT = process.platform === 'win32' ? 'npipe:////./pipe/dockerDesktopLinuxEngine' : 'unix:///var/run/docker.sock';
const MIGRATION = 'supabase/migrations/20261028222030_m02_specs_pipeline.sql';
const VERSION = '20261028222030';
const VERSIONS = ['20261028010943','20261028013324','20261028013655','20261028024205','20261028072515','20261028162702','20261028162800','20261028172320','20261028184145'];
// Populated only after actual candidate rollback proof and exact-core promotion.
const SEALS = {
  migration: '1e5319bb81be1f12896f7efb5a2cb7706653b79eb440a4dc1aaaca4ed9556895',
  manifest: '001d5e7992a2a475a2213f56eaac7a3d5d98da0fd720687ae8380c0c7eda6e81',
  rollback: { path: 'tracking/evidence/m02/specs-pipeline-candidate/2026-10-28T22-23-06-800Z-0b783b98-rollback.json',
    sha256: '9be43f96f01ab88f701b522d2feb034a4f75e0d3bb541e9914b7e07a472e6caf' },
};
const sha = value => createHash('sha256').update(value).digest('hex');
function check(value, code) { if (!value) throw new Error(code); }
async function sealed(file, expected) {
  check(typeof expected === 'string' && /^[a-f0-9]{64}$/u.test(expected), 'PIPELINE_LOCAL_REVIEW_REQUIRED');
  const absolute = path.resolve(ROOT, file); check(await realpath(absolute) === absolute, 'PIPELINE_LOCAL_SOURCE_LINK_REJECTED');
  const bytes = await readFile(absolute); check(sha(bytes) === expected, 'PIPELINE_LOCAL_SOURCE_CHANGED'); return bytes;
}
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
async function inspect(containerId) { return one(await sql(containerId, INSPECTION)); }
async function settled(containerId, runId) {
  for(let attempt=0;attempt<20;attempt++) {
    const observed=one(await sql(containerId,`begin read only;select jsonb_build_object('count',count(*)) from pg_stat_activity where application_name='eps-pipeline-promotion-${runId}';rollback;`));
    if(observed.count===0)return true; await new Promise(resolve=>setTimeout(resolve,250));
  }return false;
}
async function main() {
  check(process.argv.length===2&&/^v24\./u.test(process.version),'PIPELINE_FIXED_NODE24_COMMAND_REQUIRED');
  const migration=await sealed(MIGRATION,SEALS.migration);
  const manifest=JSON.parse((await sealed('development/local-db/reviewed.json',SEALS.manifest)).toString('utf8'));
  const proof=JSON.parse((await sealed(SEALS.rollback?.path,SEALS.rollback?.sha256)).toString('utf8'));
  check(proof.result==='passed'&&proof.rollback_verified===true&&proof.catalog_and_all_counts_restored===true,'PIPELINE_ROLLBACK_PROOF_REQUIRED');
  check(manifest.migrations.length===10&&manifest.migrations.at(-1).path===MIGRATION&&manifest.migrations.at(-1).sha256===SEALS.migration,'PIPELINE_EXACT_TEN_MANIFEST_REQUIRED');
  for(const entry of manifest.migrations)await sealed(entry.path,entry.sha256);
  const runId=randomUUID();let ownsLock=false;let before;let containerId;let operationAttempted=false;
  const receipt={schema_version:'1.0',run_id:runId,started_at:new Date().toISOString(),result:'failed',
    migration:MIGRATION,migration_sha256:SEALS.migration,manifest_sha256:SEALS.manifest,rollback_proof:SEALS.rollback,
    harness_sha256:sha(await readFile(import.meta.filename)),cloud_called:false,reset_called:false,seed_called:false,
    pipeline_enabled:false,service_login_provisioned:false,scope:'Fixed owned-local forward migration10 only; no hosted application or native/provider/HTTP acceptance.'};
  try {
    const target=await verifyNativeSpecsLocalTarget();containerId=target.container.Id;
    await mkdir(path.dirname(LOCK),{recursive:true});const handle=await open(LOCK,'wx',0o600);
    try{await handle.writeFile(JSON.stringify({run_id:runId,pid:process.pid}));await handle.sync();ownsLock=true;}finally{await handle.close();}
    before=await inspect(containerId);receipt.before=before;
    check(before.query_role==='postgres'&&before.database==='postgres'&&before.system_identifier==='7701520506262638626'
      &&isDeepStrictEqual(before.versions,VERSIONS),'PIPELINE_EXACT_NINE_LOCAL_REQUIRED');
    const expectedLedger=Object.fromEntries(manifest.migrations.slice(0,9).map(entry=>[entry.path,entry.sha256]));
    check(isDeepStrictEqual(before.ledger,expectedLedger),'PIPELINE_NINE_SOURCE_LEDGER_REQUIRED');
    const pinned=await verifyNativeSpecsLocalTarget();check(pinned.container.Id===containerId,'PIPELINE_TARGET_CHANGED');
    check(/^[a-f0-9]{24}$/u.test(target.owned.workspace_key)&&/^[a-f0-9-]{36}$/u.test(target.owned.instance_id),'PIPELINE_OWNERSHIP_REQUIRED');
    const transaction=`begin;set local application_name='eps-pipeline-promotion-${runId}';set local lock_timeout='5s';set local statement_timeout='45s';select pg_advisory_xact_lock(166824721,701);
do $owner$ begin if current_database()<>'postgres' or (select system_identifier::text from pg_control_system())<>'7701520506262638626'
 or not exists(select 1 from eps_local_guard.instance where id=1 and workspace_key='${target.owned.workspace_key}' and instance_id='${target.owned.instance_id}'::uuid)
 or exists(select 1 from eps_local_guard.migration_replay where path='${MIGRATION}') then raise exception 'OWNED_LOCAL_PIPELINE_PROMOTION_REQUIRED';end if;end $owner$;
${migration.toString('utf8')}
insert into supabase_migrations.schema_migrations(version,statements,name) values('${VERSION}',array[]::text[],'m02_specs_pipeline');
insert into eps_local_guard.migration_replay(path,sha256) values('${MIGRATION}','${SEALS.migration}');commit;`;
    operationAttempted=true;receipt.operation_attempted=true;await sql(containerId,transaction);receipt.commit_returned=true;
  } catch { receipt.failure_code='PIPELINE_LOCAL_PROMOTION_UNCONFIRMED'; }
  finally {
    try {
      if(containerId) {
        check((await verifyNativeSpecsLocalTarget()).container.Id===containerId,'PIPELINE_TARGET_CHANGED');
        receipt.owned_backend_settled=await settled(containerId,runId);check(receipt.owned_backend_settled,'PIPELINE_BACKEND_UNSETTLED');
      }
      if(before) {
        const after=await inspect(containerId);receipt.after=after;
        const expectedVersions=[...VERSIONS,VERSION];
        const committed=isDeepStrictEqual(after.versions,expectedVersions)&&after.ledger[MIGRATION]===SEALS.migration;
        receipt.commit_observed=committed;
        if(committed) {
          const excluded=['eps_local_guard.migration_replay','supabase_migrations.schema_migrations'];
          receipt.prior_business_data_unchanged=Object.keys(before.digests).filter(key=>!excluded.includes(key)).every(key=>before.counts[key]===after.counts[key]&&before.digests[key]===after.digests[key]);
          receipt.prior_function_contracts_unchanged=Object.keys(before.functions).every(key=>isDeepStrictEqual(before.functions[key],after.functions[key]));
          const state=one(await sql(containerId,"begin read only;select jsonb_build_object('disabled',count(*)=1 and bool_and(not enabled),'model_unset',bool_and(model_version is null),'private_inputs',(select count(*) from eps.specs_source_inputs),'private_payloads',(select count(*) from eps.specs_stage_payloads)) from eps.specs_pipeline_config;rollback;"));
          receipt.default_pipeline=state;
          check(receipt.prior_business_data_unchanged&&receipt.prior_function_contracts_unchanged&&state.disabled&&state.model_unset&&state.private_inputs===0&&state.private_payloads===0,'PIPELINE_POSTCONDITIONS_UNCONFIRMED');
          receipt.result='passed';
        }else{receipt.rollback_verified=isDeepStrictEqual(before,after);check(!operationAttempted||receipt.rollback_verified,'PIPELINE_UNKNOWN_STATE_PRESERVED');}
      }
      if(ownsLock){const lock=JSON.parse(await readFile(LOCK,'utf8'));check(lock.run_id===runId&&lock.pid===process.pid,'PIPELINE_LOCK_CHANGED');await unlink(LOCK);ownsLock=false;}
    }catch{receipt.result='failed';receipt.verification_unconfirmed=true;receipt.shared_db_lock_retained=ownsLock;}
    receipt.finished_at=new Date().toISOString();const directory=path.join(ROOT,'tracking/evidence/m02/specs-pipeline-local-promotion');await mkdir(directory,{recursive:true});
    const file=path.join(directory,`${receipt.finished_at.replace(/[:.]/gu,'-')}-${runId.slice(0,8)}.json`);await writeFile(file,JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
    process.stdout.write(`M02 owned-local pipeline promotion: ${receipt.result}\nReceipt: ${path.relative(ROOT,file).replaceAll('\\','/')}\n`);if(receipt.result!=='passed')process.exitCode=1;
  }
}
main().catch(()=>{process.stderr.write('Reviewed exact local migration/proof seals are required; no fallback or cloud target is permitted.\n');process.exitCode=1;});
