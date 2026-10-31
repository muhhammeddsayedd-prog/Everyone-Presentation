/** Owned disposable runtime hook. Import is inert; parent owns lock/cleanup. */
import assert from 'node:assert/strict';
import { readFile,writeFile } from 'node:fs/promises';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { sha } from '../../m07/recovery33/compiler.mjs';
import { ownedSql34,text34,FIXTURES34 } from './controller.mjs';

export function renderEnglish34Wire(sourceFiles,identity,seedSql){
 const adapted=ownedSql34(sourceFiles,identity);
 let version=text34(sourceFiles,FIXTURES34[1]);const audience="'m05-synthetic-internal','Synthetic internal','internal'";
 assert.equal(version.split(audience).length,2);version=version.replace(audience,"'english34-synthetic-external','Synthetic external','external'");
 const body='savepoint english34_source_proof;\n'+adapted.fragments['test-target.sql']+'\n'+text34(sourceFiles,FIXTURES34[0])+
  '\nset local role postgres;\n'+seedSql+'\n'+version+'\n'+text34(sourceFiles,FIXTURES34[2])+
  '\n'+adapted.fragments['before34.sql']+'\n'+adapted.migration+'\n'+adapted.fragments['validation-tests.sql']+'\n'+adapted.fragments['capture-tests.sql']+
  "\nset local role postgres;rollback to savepoint english34_source_proof;release savepoint english34_source_proof;\nselect jsonb_build_object('english34_transaction_rolled_back',true,'history_count',(select count(*)from supabase_migrations.schema_migrations),'english_table_absent',to_regclass('eps.presentation_video_english_transcripts')is null);";
 assert(!/insert into supabase_migrations/iu.test(body),'ENGLISH34_HISTORY_LABEL_FORBIDDEN');
 assert(!/alter table auth\./iu.test(body),'ENGLISH34_MANAGED_AUTH_CHANGE_FORBIDDEN');
 return {body,adapted};
}

export async function runEnglish34(ctx) {
 const {sourceFiles,sourceDb,report}=ctx;
 async function stable(){for(const[file,bytes]of sourceFiles)assert.equal(sha(await readFile(path.join(ctx.root,file))),sha(bytes),'ENGLISH34_SOURCE_CHANGED');}
 await stable();report.checkpoint='english34-owned-synthetic-rollback-proof';
 const observed=await ctx.databaseIdentity(sourceDb),identity={database:sourceDb,marker:ctx.marker(sourceDb),oid:observed.oid};
 const {body,adapted}=renderEnglish34Wire(sourceFiles,identity,ctx.recovery33.seedSql());
 const beforeCatalogue=await ctx.catalogue(sourceDb);
 const dataSql=text34(sourceFiles,'development/m07/db/data29.sql');
 const data=()=>ctx.value(sourceDb,dataSql+"select current_setting('eps.m07_readback.old_data')::jsonb;");
 const beforeData=await data();
 const beforeHistory=await ctx.value(sourceDb,"select jsonb_build_object('versions',(select jsonb_agg(version order by version)from supabase_migrations.schema_migrations));");
 assert.equal(beforeHistory.versions.length,33);assert.equal(beforeHistory.versions.at(-1),'20261031130207');
 await stable();
 assert(report.private_artifact_acl);
 await writeFile(path.join(ctx.privateRoot,'english34-owned-test-wire.sql'),body,{flag:'wx',mode:0o600});
 const execution=await ctx.sql(sourceDb,body);await stable();
 const markers=execution.stdout.split(/\r?\n/u).filter(value=>/^ENGLISH34_[A-Z0-9_]+_SYNTHETIC_ONLY$/u.test(value));
 assert.deepEqual(markers,['ENGLISH34_VALIDATOR_REGRESSIONS_PASSED_SYNTHETIC_ONLY','ENGLISH34_FUTURE_CAPTURE_LEGACY_REPLAY_IMMUTABLE_FIXED_VERSION_PASSED_SYNTHETIC_ONLY']);
 assert.deepEqual(ctx.rows(execution.stdout).at(-1),{english34_transaction_rolled_back:true,history_count:33,english_table_absent:true});
 assert(isDeepStrictEqual(await ctx.catalogue(sourceDb),beforeCatalogue),'ENGLISH34_CATALOGUE_ROLLBACK_UNCONFIRMED');
 assert(isDeepStrictEqual(await data(),beforeData),'ENGLISH34_DATA_ROLLBACK_UNCONFIRMED');
 assert.deepEqual(await ctx.value(sourceDb,"select jsonb_build_object('versions',(select jsonb_agg(version order by version)from supabase_migrations.schema_migrations));"),beforeHistory);
 report.english34_sql={result:'passed',wire_sha256:sha(body),migration_sha256:adapted.canonical_sql_sha256,adapted_migration_sha256:adapted.adapted_sql_sha256,
  admission_only_adapter:adapted.admission_only,actual_prior_migrations:report.actual_local_migrations_executed,
  synthetic_ordinary_session:true,managed_auth_policy_changed:false,validator_and_capture_markers:markers,
  ddl_data_catalogue_rolled_back:true,persistent_history_count:33,history34_inserted:false,
  native_pdf_executed:false,cloud_called:false,provider_called:false};
}
