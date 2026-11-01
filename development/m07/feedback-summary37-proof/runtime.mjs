/** Only a new root-owned compiled controller may invoke this SQL hook. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {ownedSql34,MIGRATION34} from '../../m03/english-transcript34/controller.mjs';
import {ownedSummary35} from '../workspace-summary35-proof/controller.mjs';
import {adapters36} from '../recovery36/compiler.mjs';
import {ownedIdentity33,ownedPredicate33} from '../recovery33/ownership.mjs';
import {sha} from '../recovery33/compiler.mjs';
import {validateSources,FIXTURE37} from './controller.mjs';
export const MARKER='FEEDBACK37_COUNTS_AUTHORITY_ASSERTIONS_PASSED_SYNTHETIC_ONLY';
export const ROLLED_BACK={feedback37_transaction_rolled_back:true,history_count:33,english_table_absent:true,summary35_function_absent:true,
 trace_table_absent:true,trace_function_absent:true,trace_role_absent:true,feedback_summary_function_absent:true,feedback_summary_RPC_absent:true};
const text=(sources,file)=>{assert(sources.get(file)instanceof Uint8Array);return sources.get(file).toString('utf8');};
export function ownedMigration37(original,identity){
 assert.equal(ownedIdentity33(identity).kind,'source');
 assert.equal(original.split('\nbegin;\n').length,2);assert(original.endsWith('\ncommit;\n'));
 let sql=original.replace('\nbegin;\n','\n').slice(0,-'commit;\n'.length);
 const guard="current_database()<>'postgres'";assert.equal(sql.split(guard).length,2);
 sql=sql.replace(guard,'('+ownedPredicate33(identity)+')');
 const anchor='\ncreate function eps.feedback_summary';
 assert.equal(sql.slice(sql.indexOf(anchor)),original.slice(original.indexOf(anchor),-'commit;\n'.length));
 return{sql,canonical_sha256:sha(original),adapted_sha256:sha(sql),outer_fence_and_owned_admission_only:true};
}
export function renderFeedback37Wire(sources,identity){
 const{base,migration}=validateSources(sources);
 const english=ownedSql34(base,identity),summary=ownedSummary35(base,identity),trace=adapters36(sources,identity)[2];
 const feedback=ownedMigration37(text(sources,migration),identity),version=path.basename(migration).slice(0,14);
 assert(/^[0-9]{14}$/u.test(version));
 const fixture=text(sources,FIXTURE37);assert(!/^\s*(?:begin|commit|rollback)\s*;/imu.test(fixture));
 const guard=`do $feedback37_owned$begin if current_user<>'postgres' or ${ownedPredicate33(identity)} then raise exception'FEEDBACK37_EXACT_OWNED_SOURCE_REQUIRED';end if;end$feedback37_owned$;`;
 const body=`savepoint feedback37_source_proof;\n${guard}\n${english.migration}
insert into supabase_migrations.schema_migrations(version)values('20261031143711');
${summary.sql}
insert into supabase_migrations.schema_migrations(version)values('20261031182038');
${trace.sql}
insert into supabase_migrations.schema_migrations(version)values('20261101012057');
${feedback.sql}
insert into supabase_migrations.schema_migrations(version)values('${version}');
set local eps.feedback_summary37.proof='owned-local-rollback-v1';
${fixture}
set local role postgres;rollback to savepoint feedback37_source_proof;release savepoint feedback37_source_proof;
select jsonb_build_object('feedback37_transaction_rolled_back',true,'history_count',(select count(*)from supabase_migrations.schema_migrations),
 'english_table_absent',to_regclass('eps.presentation_video_english_transcripts')is null,
 'summary35_function_absent',to_regprocedure('public.eps_get_workspace_summary(uuid)')is null,
 'trace_table_absent',to_regclass('eps.job_stage_attempts')is null,'trace_function_absent',to_regprocedure('eps.capture_job_stage_attempt()')is null,
 'trace_role_absent',not exists(select 1 from pg_roles where rolname='eps_job_trace_owner'),
 'feedback_summary_function_absent',to_regprocedure('eps.feedback_summary(uuid,boolean)')is null,
 'feedback_summary_RPC_absent',to_regprocedure('public.eps_get_feedback_summary(uuid)')is null);`;
 assert(!/^\s*(?:begin|commit|rollback)\s*;/imu.test(body),'FEEDBACK37_OUTER_TRANSACTION_ESCAPE_FORBIDDEN');
 assert(!/alter table auth\./iu.test(body));
 return{body,english,summary,trace,feedback,migration,fixture_sha256:sha(fixture),actual34_sha256:sha(sources.get(MIGRATION34))};
}
export function verifyFeedback37Observation(stdout,rows,before,after){
 const markers=stdout.split(/\r?\n/u).filter(s=>/^FEEDBACK37_[A-Z0-9_]+_SYNTHETIC_ONLY$/u.test(s));assert.deepEqual(markers,[MARKER]);
 assert.deepEqual(rows(stdout).at(-1),ROLLED_BACK);
 for(const k of ['catalogue','data','history'])assert(isDeepStrictEqual(after[k],before[k]),'FEEDBACK37_'+k.toUpperCase()+'_ROLLBACK_UNCONFIRMED');
 return markers;
}
export function createFeedback37Runtime(io={readFile,writeFile}){return async function(ctx){
 const{sourceFiles,sourceDb,report}=ctx;
 async function stable(){for(const[f,b]of sourceFiles)assert.equal(sha(await io.readFile(path.join(ctx.root,f))),sha(b),'FEEDBACK37_SOURCE_CHANGED');}
 await stable();report.checkpoint='feedback37-owned-local-rollback-proof';
 const observed=await ctx.databaseIdentity(sourceDb),identity={database:sourceDb,marker:ctx.marker(sourceDb),oid:observed.oid};
 const wire=renderFeedback37Wire(sourceFiles,identity),beforeCatalogue=await ctx.catalogue(sourceDb);
 const dataSql=text(sourceFiles,'development/m07/db/data29.sql');
 const data=()=>ctx.value(sourceDb,dataSql+"select current_setting('eps.m07_readback.old_data')::jsonb;");
 const history=()=>ctx.value(sourceDb,"select jsonb_build_object('versions',(select jsonb_agg(version order by version)from supabase_migrations.schema_migrations));");
 const beforeData=await data(),beforeHistory=await history();assert.equal(beforeHistory.versions.length,33);assert.equal(beforeHistory.versions.at(-1),'20261031130207');
 assert.equal(report.private_artifact_acl,process.platform==='win32'?'current-user-and-SYSTEM-only-verified':'mode0700');
 await io.writeFile(path.join(ctx.privateRoot,'feedback37-owned-test-wire.sql'),wire.body,{flag:'wx',mode:0o600});
 await stable();const executed=await ctx.sql(sourceDb,wire.body);await stable();
 const markers=verifyFeedback37Observation(executed.stdout,ctx.rows,{catalogue:beforeCatalogue,data:beforeData,history:beforeHistory},
  {catalogue:await ctx.catalogue(sourceDb),data:await data(),history:await history()});
 report.feedback37_sql={result:'passed',wire_sha256:sha(wire.body),actual34_sha256:wire.actual34_sha256,actual35_sha256:wire.summary.canonical_sha256,
  actual36_sha256:wire.trace.source_sha256,actual37_sha256:wire.feedback.canonical_sha256,adapted37_sha256:wire.feedback.adapted_sha256,
  migration37:wire.migration,fixture_sha256:wire.fixture_sha256,fixture_markers:markers,actual34_to37_functional_DDL:true,
  full_counts_internal_and_guest_authority_assertions:true,history34_to37_ephemeral:true,ddl_data_catalogue_roles_rolled_back:true,persistent_history_count:33,
  original_AT074_fixture_replayed:false,native_executed:false,cloud_called:false,provider_called:false,hosted_acceptance:false,restore_acceptance:false};
};}
export const runFeedback37=createFeedback37Runtime();
