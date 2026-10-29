/** Compose exact proved fragments into additive17; no SQL, cloud or flag IO. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
const ROOT=path.resolve(import.meta.dirname,'..');
const PROOF='tracking/evidence/m03/kernel-local/2026-10-29T09-57-52-726Z-e814d619.json';
const MIGRATION='supabase/migrations/20261029100500_m03_candidate_pipeline.sql';
const FILES=['development/m03/candidate-kernel-tables.sql','development/m03/candidate-user-assets.sql','development/m03/candidate-kernel.sql',
 'development/m03/candidate-kernel-enqueue.sql','development/m03/candidates-apply-candidate.sql','development/m03/candidate-kernel-events.sql',
 'development/m03/candidate-kernel-assets.sql','development/m03/candidate-kernel-dispatch.sql','development/m03/candidate-storage-policies.sql','development/m03/candidate-library-lifecycle-forward.sql'];
const hash=value=>createHash('sha256').update(value).digest('hex');
assert.equal(process.argv.length,2);const proof=JSON.parse(await readFile(path.join(ROOT,PROOF),'utf8'));
assert(proof.result==='passed'&&proof.rollback_verified&&proof.sources_stable&&proof.cloud_called===false&&proof.provider_called===false);
const manifest=JSON.parse(await readFile(path.join(ROOT,'development/local-db/reviewed.json'),'utf8'));assert.equal(manifest.migrations.length,16);
const versions=manifest.migrations.map(row=>path.basename(row.path).slice(0,14));
const header=`-- M03 coordinated candidate pipeline17 after exact reviewed16.\n-- Private native/provider stages, reusable facts/media and scoped uploads.\n-- No source fixture, identity, provider credential or runtime enablement.\nset local lock_timeout='5s';set local statement_timeout='30s';set local search_path='';\ndo $baseline$begin\n if current_user<>'postgres' or current_database()<>'postgres' or\n (select array_agg(version order by version) from supabase_migrations.schema_migrations) is distinct from array[${versions.map(value=>`'${value}'`).join(',')}]::text[]\n then raise exception 'CANDIDATE_PIPELINE_REVIEWED_SIXTEEN_REQUIRED';end if;\nend $baseline$;\n`;
const sources=[];const sourceSeals={};
for(const file of FILES){let source=await readFile(path.join(ROOT,file),'utf8');assert.equal(hash(source),proof.source_seals[file]);sourceSeals[file]=hash(source);
 if(file==='development/m03/candidates-apply-candidate.sql'){
  const marker="  or current_setting('eps.m03_candidate_rehearsal',true) is distinct from 'rollback-only-v1'\n";assert.equal(source.split(marker).length,2);source=source.replace(marker,'');
 }
 sources.push(`\n-- Exact reviewed fragment: ${file}\n${source}`);
}
const migration=header+sources.join('\n');
await writeFile(path.join(ROOT,MIGRATION),migration,{flag:'wx'});
const directory=path.join(ROOT,'tracking/evidence/m03/kernel-preparation');await mkdir(directory,{recursive:true});
const report={observed_at:new Date().toISOString(),migration:MIGRATION,migration_sha256:hash(migration),proof:PROOF,proof_sha256:hash(await readFile(path.join(ROOT,PROOF))),
 source_seals:sourceSeals,only_guard_adaptation:'One local rehearsal condition removed from apply composition; strict16-history migration guard replaces it.',sql_executed:false,cloud_called:false,runtime_enabled:false};
await writeFile(path.join(directory,'migration17-source.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
process.stdout.write(JSON.stringify(report)+'\n');
