/** Inert on import. Only the parent controller can call this owned SQL hook. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { sha } from '../recovery33/compiler.mjs';
import { ownedPredicate33 } from '../recovery33/ownership.mjs';
import { summaryWireParts } from './controller.mjs';

export function renderSummary35Wire(sources,identity){
 const parts=summaryWireParts(sources,identity);
 const guard=`do $summary35_owned$begin if current_user<>'postgres' or ${ownedPredicate33(identity)} then raise exception 'SUMMARY35_OWNED_DATABASE_REQUIRED';end if;end$summary35_owned$;`;
 const body='savepoint summary35_source_proof;\n'+guard+'\n'+parts.english.migration+
  "\n-- Exact ephemeral history34 label, required only by canonical35 admission.\ninsert into supabase_migrations.schema_migrations(version) values('20261031143711');\n"+
  parts.summary.sql+'\n'+parts.fixture+
  "\nselect 'SUMMARY35_FIXTURE_ASSERTIONS_PASSED_SYNTHETIC_ONLY';\nset local role postgres;rollback to savepoint summary35_source_proof;release savepoint summary35_source_proof;\n"+
  "select jsonb_build_object('summary35_transaction_rolled_back',true,'history_count',(select count(*)from supabase_migrations.schema_migrations),'english_table_absent',to_regclass('eps.presentation_video_english_transcripts')is null,'summary_function_absent',to_regprocedure('public.eps_get_workspace_summary(uuid)')is null);";
 assert(!/^\s*(?:begin|commit|rollback)\s*;/imu.test(body),'SUMMARY35_OUTER_TRANSACTION_ESCAPE_FORBIDDEN');
 assert(!/alter table auth\./iu.test(body),'SUMMARY35_MANAGED_AUTH_CHANGE_FORBIDDEN');
 return {body,...parts};
}
export function verifySummary35Observation(stdout,rows,before,after){
 const markers=stdout.split(/\r?\n/u).filter(line=>/^SUMMARY35_[A-Z0-9_]+_SYNTHETIC_ONLY$/u.test(line));
 assert.deepEqual(markers,['SUMMARY35_FIXTURE_ASSERTIONS_PASSED_SYNTHETIC_ONLY']);
 assert.deepEqual(rows(stdout).at(-1),{summary35_transaction_rolled_back:true,history_count:33,english_table_absent:true,summary_function_absent:true});
 assert(isDeepStrictEqual(after.catalogue,before.catalogue),'SUMMARY35_CATALOGUE_ROLLBACK_UNCONFIRMED');
 assert(isDeepStrictEqual(after.data,before.data),'SUMMARY35_DATA_ROLLBACK_UNCONFIRMED');
 assert.deepEqual(after.history,before.history);
 return markers;
}
/** IO substitution is for inert unit tests; the exported hook uses Node FS. */
export function createSummary35Runtime(io={readFile,writeFile}){return async function(ctx){
 const {sourceFiles,sourceDb,report}=ctx;
 async function stable(){for(const[file,bytes]of sourceFiles)assert.equal(sha(await io.readFile(path.join(ctx.root,file))),sha(bytes),'SUMMARY35_SOURCE_CHANGED');}
 await stable();report.checkpoint='summary35-owned-synthetic-rollback-proof';
 const observed=await ctx.databaseIdentity(sourceDb),identity={database:sourceDb,marker:ctx.marker(sourceDb),oid:observed.oid};
 const wire=renderSummary35Wire(sourceFiles,identity),beforeCatalogue=await ctx.catalogue(sourceDb);
 const dataSql=sourceFiles.get('development/m07/db/data29.sql').toString('utf8');
 const data=()=>ctx.value(sourceDb,dataSql+"select current_setting('eps.m07_readback.old_data')::jsonb;");
 const history=()=>ctx.value(sourceDb,"select jsonb_build_object('versions',(select jsonb_agg(version order by version)from supabase_migrations.schema_migrations));");
 const beforeData=await data(),beforeHistory=await history();
 assert.equal(beforeHistory.versions.length,33);assert.equal(beforeHistory.versions.at(-1),'20261031130207');
 assert.equal(report.private_artifact_acl,process.platform==='win32'?'current-user-and-SYSTEM-only-verified':'mode0700');
 await io.writeFile(path.join(ctx.privateRoot,'summary35-owned-test-wire.sql'),wire.body,{flag:'wx',mode:0o600});
 await stable();const execution=await ctx.sql(sourceDb,wire.body);await stable();
 const markers=verifySummary35Observation(execution.stdout,ctx.rows,{catalogue:beforeCatalogue,data:beforeData,history:beforeHistory},
  {catalogue:await ctx.catalogue(sourceDb),data:await data(),history:await history()});
 report.summary35_sql={result:'passed',wire_sha256:sha(wire.body),actual34_sha256:wire.actual34_sha256,
  actual35_sha256:wire.summary.canonical_sha256,adapted35_sha256:wire.summary.adapted_sha256,
  admission_only_adapter:true,fixture_outer_fence_only:true,actual_prior_migrations:report.actual_local_migrations_executed,
  fixture_markers:markers,ddl_data_catalogue_rolled_back:true,persistent_history_count:33,history34_row_ephemeral:true,history35_inserted:false,
  managed_auth_policy_changed:false,native_pdf_executed:false,cloud_called:false,provider_called:false,hosted_acceptance:false};
};}
export const runSummary35=createSummary35Runtime();
