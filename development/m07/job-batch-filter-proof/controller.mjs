/** New inert compiler; historical sources and claims are never rewritten. */
import assert from 'node:assert/strict';
import {readFile,lstat,realpath} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {compileFeedback37,validateSources as validate37,ROOT,sha} from '../feedback-summary37-proof/controller.mjs';
export {ROOT,sha};
export const PURPOSE='development/m07/job-batch-filter-proof/';
export const EXECUTION_ENABLED=true;
export const OWN=['controller.mjs','runtime.mjs','run.mjs','proof.test.mjs','frozen-inputs.json','README.md'].map(f=>PURPOSE+f);
export const DRAFT='development/m07/job-batch-filter/';
export const DRAFT_FILES=['build_candidate.py','candidate.sql.txt','fixture.sql','test_candidate.py','README.md'].map(f=>DRAFT+f);
export const PRIOR='tracking/evidence/m07/feedback-summary37-proof/2026-11-01T09-45-45-482Z-e109a4d1.json';
export const PRIOR_SHA='3a98d0dabac723e8c599f200a30e6849596b41281c0828868a64a313d008b1b9';
export const MANIFEST_SHA='c54fa84820379a70d9ec877c77361080e48b841f400de48fc0415fe2df34c7b4';
export async function checked(file){
 assert(typeof file==='string'&&!path.isAbsolute(file)&&!file.includes('\\')&&!file.startsWith('.local/')&&!file.split('/').some(v=>!v||v==='.'||v==='..'));
 const target=path.join(ROOT,file),s=await lstat(target);assert(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1&&s.size<8*1024*1024&&await realpath(target)===target);return readFile(target);
}
export function validateSources(sources){
 assert.equal(sha(sources.get(PURPOSE+'frozen-inputs.json')),MANIFEST_SHA,'BATCH_PROOF_INPUTS_CHANGED');
 const manifest=JSON.parse(sources.get(PURPOSE+'frozen-inputs.json'));assert.equal(manifest.schema_version,'1.0');assert.equal(manifest.preserved_recovery37_sources,365);
 assert.deepEqual([...sources.keys()].sort(),[...new Set([...Object.keys(manifest.pins),...OWN])].sort());
 for(const[f,h]of Object.entries(manifest.pins))assert.equal(sha(sources.get(f)),h,'BATCH_PROOF_FROZEN_SOURCE_CHANGED');
 assert.equal(sha(sources.get(PRIOR)),PRIOR_SHA);const proof=JSON.parse(sources.get(PRIOR));
 assert.equal(proof.result,'passed');assert.equal(proof.checkpoint,'complete');assert.equal(Object.keys(proof.source_seals).length,217);
 for(const k of ['disposable_databases_removed','new33_roles_removed','original_local_database_unchanged','original29_full_auth_storage_catalogue_unchanged','original29_exact_profile_and_settings_state_unchanged','existing_global_role_oids_attributes_memberships_unchanged','shared_test_lock_released'])assert.equal(proof[k],true);
 assert.equal(proof.feedback37_sql.actual37_sha256,'14bb7f74e597b9a1a9b49df6fe047b16a788efa703e5d7a849ed254c3cbe98b3');
 const base=new Map();for(const[f,h]of Object.entries(proof.source_seals)){assert.equal(sha(sources.get(f)),h);base.set(f,sources.get(f));}validate37(base);
 for(const f of DRAFT_FILES)assert(Object.hasOwn(manifest.pins,f));return{manifest,base,proof};
}
export async function loadSources(){
 const raw=await checked(PURPOSE+'frozen-inputs.json');assert.equal(sha(raw),MANIFEST_SHA);
 const m=JSON.parse(raw),sources=new Map();for(const f of new Set([...Object.keys(m.pins),...OWN]))sources.set(f,await checked(f));validateSources(sources);return sources;
}
export function compileBatchProof(sources,{root=ROOT,runId}){
 const{base,proof}=validateSources(sources);assert(path.isAbsolute(root));assert(/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(runId));assert.notEqual(runId,proof.run_id);
 let source=compileFeedback37(base,{root,runId}).source;const changes=[];
 const once=(a,b,label)=>{assert.equal(source.split(a).length,2,'BATCH_PROOF_FIXED_COMPILER_SEAM_REQUIRED');source=source.replace(a,()=>b);changes.push({label,before_sha256:sha(a),after_sha256:sha(b)});};
 once(`import { runFeedback37 } from '${pathToFileURL(path.join(root,'development/m07/feedback-summary37-proof/runtime.mjs')).href}';`,`import { runBatchProof } from '${pathToFileURL(path.join(root,PURPOSE,'runtime.mjs')).href}';`,'new-runtime');
 once('await runFeedback37({','await runBatchProof({','new-hook');
 once(`const ROOT = ${JSON.stringify(root)};`,`const ROOT = ${JSON.stringify(root)};\nif(!${EXECUTION_ENABLED})throw Error('BATCH_PROOF_EXECUTION_DISABLED');`,'closed-before-target-lock');
 once("scope: 'Owned local29->33 plus actual34-37 feedback summary SQL rollback proof; no native/provider/hosted/restore acceptance'","scope: 'Owned local29->33 and ephemeral34-37 nested batch SQL authority proof; no native-media/HTTP/MCP/provider/hosted/restore acceptance'",'truthful-scope');
 once("'tracking/evidence/m07/feedback-summary37-proof'","'tracking/evidence/m07/job-batch-filter-proof'",'new-evidence');
 once("'.local/m07-feedback-summary37-tests'","'.local/m07-job-batch-filter-tests'",'new-private-purpose');
 const at=source.indexOf('sourcePaths.push(...');assert(at>0);source=source.slice(0,at)+`sourcePaths.push(...${JSON.stringify([...sources.keys()])});\n  `+source.slice(at);
 const seal='report.source_seals = Object.fromEntries([...sourceFiles].map(([file, bytes]) => [file, sha(bytes)]));';
 once(seal,seal+`\nfor(const[f,h]of Object.entries(${JSON.stringify(Object.fromEntries([...sources].map(([f,b])=>[f,sha(b)])))}))assert.equal(sha(sourceFiles.get(f)),h,'BATCH_PROOF_PREPARED_SOURCE_CHANGED');`,'complete-source-closure');
 return{source,manifest:{schema_version:'1.0',run_id:runId,purpose:'nested-batch-sql-proof',execution_enabled:EXECUTION_ENABLED,source_sha256:sha(source),source_pins:Object.fromEntries([...sources].map(([f,b])=>[f,sha(b)])),changes,prior217_unchanged:true,prior365_unchanged:true,database_executed:false,cloud_called:false,provider_called:false}};
}
