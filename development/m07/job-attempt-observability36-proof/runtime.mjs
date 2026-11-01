/** Inert on import. Only the parent-owned controller may call this SQL hook. */
import assert from 'node:assert/strict';
import { readFile,writeFile } from 'node:fs/promises';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { sha } from '../recovery33/compiler.mjs';
import { ownedPredicate33 } from '../recovery33/ownership.mjs';
import { wireParts } from './controller.mjs';

export const MARKERS=['ATTEMPT36_DIRECT_TRIGGER_ASSERTIONS_PASSED_SYNTHETIC_ONLY','ATTEMPT36_REAL_CLAIM_CALLBACK_RETRY_ASSERTIONS_PASSED_SYNTHETIC_ONLY'];
export const ROLLED_BACK={attempt36_transaction_rolled_back:true,history_count:33,english_table_absent:true,summary_function_absent:true,
 trace_table_absent:true,trace_function_absent:true,trace_role_absent:true};
export function renderAttempt36Wire(sources,identity){
 const parts=wireParts(sources,identity);
 const guard=`do $attempt36_owned$begin if current_user<>'postgres' or ${ownedPredicate33(identity)} then raise exception 'ATTEMPT36_OWNED_DATABASE_REQUIRED';end if;end$attempt36_owned$;`;
 const body='savepoint attempt36_source_proof;\n'+guard+'\n'+parts.english.migration+
  "\ninsert into supabase_migrations.schema_migrations(version) values('20261031143711');\n"+parts.summary.sql+
  "\ninsert into supabase_migrations.schema_migrations(version) values('20261031182038');\n"+
  "set local eps.job_attempt_trace_candidate='owned-local-source-only-v1';\n"+parts.candidate.sql+
  '\nsavepoint attempt36_direct_fixture;\n'+parts.direct.sql+
  "\nselect '"+MARKERS[0]+"';\nset local role postgres;rollback to savepoint attempt36_direct_fixture;release savepoint attempt36_direct_fixture;\n"+
  parts.assignments+'\nset local role postgres;\n'+parts.seed+'\n'+parts.versions+'\n'+parts.service+
  "\nselect '"+MARKERS[1]+"';\nset local role postgres;rollback to savepoint attempt36_source_proof;release savepoint attempt36_source_proof;\n"+
  "select jsonb_build_object('attempt36_transaction_rolled_back',true,'history_count',(select count(*)from supabase_migrations.schema_migrations),"+
  "'english_table_absent',to_regclass('eps.presentation_video_english_transcripts')is null,'summary_function_absent',to_regprocedure('public.eps_get_workspace_summary(uuid)')is null,"+
  "'trace_table_absent',to_regclass('eps.job_stage_attempts')is null,'trace_function_absent',to_regprocedure('eps.capture_job_stage_attempt()')is null,"+
  "'trace_role_absent',not exists(select 1 from pg_roles where rolname='eps_job_trace_owner'));";
 assert(!/^\s*(?:begin|commit|rollback)\s*;/imu.test(body),'ATTEMPT36_OUTER_TRANSACTION_ESCAPE_FORBIDDEN');
 assert(!/alter table auth\./iu.test(body),'ATTEMPT36_MANAGED_AUTH_CHANGE_FORBIDDEN');
 return {body,...parts};
}
export function verifyObservation(stdout,rows,before,after){
 const markers=stdout.split(/\r?\n/u).filter(line=>/^ATTEMPT36_[A-Z0-9_]+_SYNTHETIC_ONLY$/u.test(line));assert.deepEqual(markers,MARKERS);
 assert.deepEqual(rows(stdout).at(-1),ROLLED_BACK);
 for(const key of ['catalogue','data','history'])assert(isDeepStrictEqual(after[key],before[key]),'ATTEMPT36_'+key.toUpperCase()+'_ROLLBACK_UNCONFIRMED');
 return markers;
}
export function createAttempt36Runtime(io={readFile,writeFile}){return async function(ctx){
 const {sourceFiles,sourceDb,report}=ctx;
 async function stable(){for(const[file,bytes]of sourceFiles)assert.equal(sha(await io.readFile(path.join(ctx.root,file))),sha(bytes),'ATTEMPT36_SOURCE_CHANGED');}
 await stable();report.checkpoint='attempt36-owned-local-rollback-proof';
 const observed=await ctx.databaseIdentity(sourceDb),identity={database:sourceDb,marker:ctx.marker(sourceDb),oid:observed.oid};
 const wire=renderAttempt36Wire(sourceFiles,identity),beforeCatalogue=await ctx.catalogue(sourceDb);
 const dataSql=sourceFiles.get('development/m07/db/data29.sql').toString('utf8');
 const data=()=>ctx.value(sourceDb,dataSql+"select current_setting('eps.m07_readback.old_data')::jsonb;");
 const history=()=>ctx.value(sourceDb,"select jsonb_build_object('versions',(select jsonb_agg(version order by version)from supabase_migrations.schema_migrations));");
 const beforeData=await data(),beforeHistory=await history();assert.equal(beforeHistory.versions.length,33);assert.equal(beforeHistory.versions.at(-1),'20261031130207');
 assert.equal(report.private_artifact_acl,process.platform==='win32'?'current-user-and-SYSTEM-only-verified':'mode0700');
 await io.writeFile(path.join(ctx.privateRoot,'attempt36-owned-test-wire.sql'),wire.body,{flag:'wx',mode:0o600});
 await stable();const executed=await ctx.sql(sourceDb,wire.body);await stable();
 const markers=verifyObservation(executed.stdout,ctx.rows,{catalogue:beforeCatalogue,data:beforeData,history:beforeHistory},
  {catalogue:await ctx.catalogue(sourceDb),data:await data(),history:await history()});
 report.attempt36_sql={result:'passed',wire_sha256:sha(wire.body),actual34_sha256:wire.actual34_sha256,actual35_sha256:wire.summary.canonical_sha256,
  candidate36_sha256:wire.candidate.source_sha256,adapted_candidate_sha256:wire.candidate.adapted_sha256,direct_fixture_sha256:wire.direct.source_sha256,
  functional_sql_unchanged:true,actual_prior_migrations:report.actual_local_migrations_executed,fixture_markers:markers,
  actual_claim_callback_manual_retry:true,ddl_data_catalogue_rolled_back:true,trace_role_rolled_back:true,persistent_history_count:33,
  history34_and35_ephemeral:true,candidate36_history_inserted:false,managed_auth_policy_changed:false,native_executed:false,
  cloud_called:false,provider_called:false,hosted_acceptance:false};
};}
export const runAttempt36=createAttempt36Runtime();
