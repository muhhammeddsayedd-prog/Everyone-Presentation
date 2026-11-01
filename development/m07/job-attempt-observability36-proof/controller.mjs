/** Pure source compiler. All prior proof bytes and old claims remain untouched. */
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { compileSummary35,ownedSummary35 } from '../workspace-summary35-proof/controller.mjs';
import { ownedSql34,MIGRATION34 } from '../../m03/english-transcript34/controller.mjs';
import { ownedPredicate33 } from '../recovery33/ownership.mjs';
import { sha } from '../recovery33/compiler.mjs';
import { validateSources,PURPOSE,PRIOR_RECEIPT,PRIOR_RECEIPT_SHA } from './sources.mjs';

export const EXECUTION_ENABLED=true;
export const CANDIDATE='development/m07/job-attempt-observability36/candidate.sql';
export const DIRECT_FIXTURE='development/m07/job-attempt-observability36/fixture.sql';
export const FIXTURE04='tests/db/m04-assignments-fixture.sql';
export const FIXTURE05='tests/db/m05-versions-fixture.sql';
export const SERVICE_FIXTURE=PURPOSE+'service-fixture.sql';
export const text=(sources,file)=>{const bytes=sources.get(file);assert(bytes instanceof Uint8Array,'ATTEMPT36_SOURCE_REQUIRED');return bytes.toString('utf8');};
export function ownedTrace36(sources,identity){
 validateSources(sources);const predicate=ownedPredicate33(identity),guard="current_database()<>'postgres'";
 const adapt=file=>{const original=text(sources,file);assert.equal(original.split(guard).length,2,'ATTEMPT36_FIXED_ADMISSION_REQUIRED');
  const sql=original.replace(guard,'('+predicate+')');
  assert.equal(sql.slice(sql.indexOf('end$$;')+7),original.slice(original.indexOf('end$$;')+7),'ATTEMPT36_FUNCTIONAL_SQL_CHANGED');
  return {sql,source_sha256:sha(original),adapted_sha256:sha(sql),admission_only:true};};
 return {candidate:adapt(CANDIDATE),direct:adapt(DIRECT_FIXTURE)};
}
export function wireParts(sources,identity){
 validateSources(sources);return {...ownedTrace36(sources,identity),english:ownedSql34(sources,identity),summary:ownedSummary35(sources,identity),
  assignments:text(sources,FIXTURE04),seed:text(sources,'development/m07/recovery33/seed-auth.sql'),
  versions:text(sources,FIXTURE05),service:text(sources,SERVICE_FIXTURE),actual34_sha256:sha(sources.get(MIGRATION34))};
}
export function compileAttempt36(sources,{root,runId}){
 validateSources(sources);const base=compileSummary35(sources,{root,runId});let source=base.source;const substitutions=[];
 const url=file=>pathToFileURL(path.join(root,file)).href;
 const change=(old,value,label)=>{assert.equal(source.split(old).length,2,'ATTEMPT36_FIXED_CONTROLLER_SEAM_REQUIRED');
  source=source.replace(old,value);substitutions.push({label,removed_sha256:sha(old),inserted_sha256:sha(value)});};
 change(`import { runSummary35 } from '${url('development/m07/workspace-summary35-proof/runtime.mjs')}';`,
  `import { runAttempt36 } from '${url(PURPOSE+'runtime.mjs')}';`,'dedicated-attempt-runtime');
 change('await runSummary35({','await runAttempt36({','dedicated-attempt-invocation');
 change(`const ROOT = ${JSON.stringify(root)};`,`const ROOT = ${JSON.stringify(root)};\nif(!${EXECUTION_ENABLED})throw Error('ATTEMPT36_ROOT_REVIEW_REQUIRED');`,'closed-before-target-or-lock');
 change("scope: 'Owned local29->33 plus actual34/35 Summary synthetic SQL rollback proof; no restore/native/provider/hosted acceptance'",
  "scope: 'Owned local29->33 plus ephemeral actual34/35 and future attempt36 local SQL rollback proof; no native/provider/hosted acceptance'",'truthful-attempt-scope');
 change("'tracking/evidence/m07/workspace-summary35-proof'","'tracking/evidence/m07/job-attempt-observability36-proof'",'new-evidence-purpose');
 change("'.local/m07-workspace-summary35-tests'","'.local/m07-attempt36-tests'",'new-private-purpose');
 change("'SUMMARY35_PREPARED_SOURCE_CHANGED'","'ATTEMPT36_PREPARED_SOURCE_CHANGED'",'complete-source-guard');
 return {source,manifest:{schema_version:'1.0',run_id:runId,execution_enabled:EXECUTION_ENABLED,database_executed:false,
  source_sha256:Object.fromEntries([...sources].map(([file,bytes])=>[file,sha(bytes)])),generated_source_sha256:sha(source),
  inherited_summary35_manifest:base.manifest,substitutions,required_prior_proof:{receipt:PRIOR_RECEIPT,sha256:PRIOR_RECEIPT_SHA,run_id:'ef4cb6c2-3f4a-4869-a71a-d747f1db99ca',result:'passed',cleanup_required:true},
  actual30_to33_required:true,actual34_and35_required:true,history34_and35_ephemeral:true,candidate36_history_inserted:false,
  direct_fixture_required:true,actual_claim_callback_manual_retry_required:true,all34_35_36_rollback_required:true,source_only:true}};
}
