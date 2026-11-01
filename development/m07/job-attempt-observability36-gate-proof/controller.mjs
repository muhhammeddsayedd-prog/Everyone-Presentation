/** Pure wrapper around the actual7cff compiler; no old source/claim is written. */
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { compileAttempt36 } from '../job-attempt-observability36-proof/controller.mjs';
import { sha } from '../recovery33/compiler.mjs';
import { validateSources,PURPOSE,PRIOR_RECEIPT,PRIOR_RECEIPT_SHA,FAILED_RECEIPT,FAILED_RECEIPT_SHA,FAILED_ARCHIVE,FAILED_ARCHIVE_SHA } from './sources.mjs';
export const EXECUTION_ENABLED=true;
export function compileGate36(sources,{root,runId}){
 assert(!['207731a6-8462-4eec-8d27-f2fc8f34f2fd','7cff5c7d-8329-4abd-ba27-a6e390a7208d'].includes(runId),'ATTEMPT36_GATE_FRESH_RUN_ID_REQUIRED');
 validateSources(sources);const base=compileAttempt36(sources,{root,runId});let source=base.source;const substitutions=[];
 const url=file=>pathToFileURL(path.join(root,file)).href;
 function change(old,replacement,label){assert.equal(source.split(old).length,2,'ATTEMPT36_GATE_FIXED_SEAM_REQUIRED');
  source=source.replace(old,replacement);substitutions.push({label,removed_sha256:sha(old),inserted_sha256:sha(replacement)});}
 change(`import { runAttempt36 } from '${url('development/m07/job-attempt-observability36-proof/runtime.mjs')}';`,
  `import { runGate36 } from '${url(PURPOSE+'runtime.mjs')}';`,'dedicated-gate-runtime');
 change('await runAttempt36({','await runGate36({','dedicated-gate-invocation');
 change(`const ROOT = ${JSON.stringify(root)};`,`const ROOT = ${JSON.stringify(root)};\nif(!${EXECUTION_ENABLED})throw Error('ATTEMPT36_GATE_ROOT_REVIEW_REQUIRED');`,'closed-before-target-or-lock');
 change("scope: 'Owned local29->33 plus ephemeral actual34/35 and future attempt36 local SQL rollback proof; no native/provider/hosted acceptance'",
  "scope: 'Owned local29->33 plus actual34/35 and candidate36 release-query+real-routine rollback proof; no canonical/provider/hosted acceptance'",'truthful-gate-scope');
 change("'tracking/evidence/m07/job-attempt-observability36-proof'","'tracking/evidence/m07/job-attempt-observability36-gate-proof'",'new-evidence-purpose');
 change("'.local/m07-attempt36-tests'","'.local/m07-attempt36-gate-tests'",'new-private-purpose');
 change("'ATTEMPT36_PREPARED_SOURCE_CHANGED'","'ATTEMPT36_GATE_PREPARED_SOURCE_CHANGED'",'full-source-guard');
 return {source,manifest:{schema_version:'1.0',run_id:runId,execution_enabled:EXECUTION_ENABLED,database_executed:false,
  generated_source_sha256:sha(source),source_sha256:Object.fromEntries([...sources].map(([file,bytes])=>[file,sha(bytes)])),
  inherited_attempt36_manifest:base.manifest,substitutions,required_prior_proof:{receipt:PRIOR_RECEIPT,sha256:PRIOR_RECEIPT_SHA,
   run_id:'7cff5c7d-8329-4abd-ba27-a6e390a7208d',result:'passed',cleanup_required:true},
  required_failed207_cleanup:{receipt:FAILED_RECEIPT,sha256:FAILED_RECEIPT_SHA,run_id:'207731a6-8462-4eec-8d27-f2fc8f34f2fd',
   result:'failed',cleanup_verified:true,archive:FAILED_ARCHIVE,archive_sha256:FAILED_ARCHIVE_SHA,all229_executed_sources_preserved:true},
  unchanged_candidate_and_real_fixtures_required:true,actual_release_queries_before_after_empty_trace_required:true,
  python_delta_and_schema_gates_required:true,history36_ephemeral:true,history36_persisted:false,
  actual_history_insert_then_postcondition_order_required:true,all_hook_sql_rollback_required:true,source_only:true}};
}
