/** New disabled purpose. No old controller or consumed claim is replayed. */
import assert from 'node:assert/strict';
import {lstat,readFile,realpath,writeFile}from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL,URL}from 'node:url';
import {sha}from '../presentation-lock-source-proof/proof.mjs';
import {qualifyFit}from '../presentation-lock-source-dedupe-proof/entry.mjs';
import {preserveFirstOwnedError}from '../presentation-generation-data-diagnostics/capture.mjs';
import {admitTiming,PRIOR_PATH}from '../presentation-lock-source-oracle-proof/admit.mjs';
import {admitCarry,freshCarry}from './admit.mjs';
export const EXECUTION_ENABLED=true;
const UUID='[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}';
const BEFORE=['4d46151993a60d8c6ac9d36e48781fee34c12c3e1dede727ac1ed4d31a953ab7','f0815e014144f1345b4679d96114aab6b358d95df317e3cfe6ac6b59989813cb','b20fef7adc8dee0da91db1508b30d4116855bb3e9be9e881072a7e8d55fcee08','ed4a3469971fa410078b546b13aa0a875b4867efdda4b134dc729563dd887187'];
export async function runCases(ctx){
 assert(EXECUTION_ENABLED,'ASSIGNMENT_PROOF_EXECUTION_DISABLED');
 assert.notEqual(ctx.system,'7701520506262638626');assert(new RegExp('^'+UUID+'$','u').test(ctx.runId));
 assert.equal(ctx.report.private_acl_verified,true);assert.equal(ctx.report.dispatch_once_claim_created,true);
 const privateRoot=path.join(ctx.root,'.local/presentation-generation-assignment-proof',ctx.runId);
 assert.equal(await realpath(privateRoot),privateRoot);assert((await lstat(privateRoot)).isDirectory());
 assert.deepEqual(JSON.parse(await readFile(path.join(privateRoot,'claim.json'),'utf8')),{run_id:ctx.runId,automatic_retry:false});
 const folder=path.join(ctx.root,'.local/presentation-generation-assignment-proof-compiled');
 for(const [label,kind]of[['projectedCallback','callback'],['projectedCases','cases']]){
  const file=path.resolve(ctx.bindings[label]);assert.equal(path.dirname(file),folder);assert(new RegExp('^'+kind+'-'+UUID+'\\.mjs$','u').test(path.basename(file)));
  const stat=await lstat(file);assert(stat.isFile()&&!stat.isSymbolicLink()&&stat.nlink===1&&stat.size>0&&stat.size<=512*1024);
  assert.equal(sha(await readFile(file)),ctx.bindings[label+'Sha']);
 }
 assert.deepEqual(ctx.bindings.beforeBodies.map(x=>x.sha),BEFORE);assert.deepEqual(ctx.bindings.afterBodies.map(x=>x.sha),["0dba1d407199191d3bbb4d84ddab94d9f4e33da6a0172738b86133e8c7bf61fd", "c6f93795e1926bcbb2e550b428f2e76a9ffe04dc29199e799c3d3a0e7b73cd10", "a5e5c60d3f94d9e05c62fc1cfc76ac4552713000b72b1efe4eac028da15c0d40", "afe33691e2bb1dad42999b49c8c5ba9d583d68bfc6cced60bfbea0adadc37dd7"]);
 for(const key of['beforeBodies','afterBodies'])for(const item of ctx.bindings[key])assert.equal(sha(item.sql),item.definition_sha256);
 assert.equal(ctx.bindings.baseSha,'280244090e5350b912dec5b23b74bb5d260e9e21df497c8ddfc2ae322fb774c4');assert.equal(ctx.bindings.candidateSha,'280244090e5350b912dec5b23b74bb5d260e9e21df497c8ddfc2ae322fb774c4');
 assert.equal(sha(await readFile(new URL('../presentation-generation-data-diagnostics/capture.mjs',import.meta.url))),'9766a654f319f740fa37aef4c79a025f8f977c44f3a89220c2aedf39e311c407');
 const priorTiming=admitTiming(await readFile(path.join(ctx.root,PRIOR_PATH)));
 const carried=await admitCarry(ctx.root);
 ctx.report.scope='owned synthetic whole-generation8s and exact assignment/data/companion/security comparison: helper280 both sides, original four versus bounded-assignment candidate four; completed helper scopes carried only; no provider/production acceptance';
 ctx.report.data_reuse_body_installations=[];ctx.report.data_reuse_fixture_fit_dispatches=[];
 const counts={control:0,large:0};
 const sessions=preserveFirstOwnedError(ctx.sessions,async value=>writeFile(path.join(privateRoot,'first-owned-native-error.json'),JSON.stringify(value),{flag:'wx',mode:0o600}),ctx.report);
 const captureError=async(name,error)=>{
  assert(/^[a-z0-9_-]{1,100}$/u.test(name));const basename='case-'+name+'-error.json';
  const value={schema_version:'oracle-proof-private-case-error.v1',case_id:name,message:typeof error?.message==='string'?error.message:null,diagnostic:error?.diagnostic??null};
  try{await writeFile(path.join(privateRoot,basename),JSON.stringify(value),{flag:'wx',mode:0o600});return{private_file:basename,normal_return:true};}catch{return{private_file:basename,normal_return:false,private_capture_failed:true};}
 };
 const projected=await import(pathToFileURL(ctx.bindings.projectedCallback).href);
 await projected.runCases({...ctx,priorTiming,captureError,sessions,admitFreshCarry:fresh=>freshCarry(fresh,carried),
  psqlArgs:()=>{const args=ctx.psqlArgs();assert(!args.some(x=>typeof x==='string'&&x.includes('VERBOSITY=')));return[...args,'-v','VERBOSITY=verbose'];},
  sql:async(text,...args)=>{
   for(const label of['control','large']){const qualified=qualifyFit(text,ctx.runId,label);if(qualified!==null){assert.equal(++counts[label],1);const record={label,before_sha256:sha(text),after_sha256:sha(qualified),dispatch_started:true,normal_return:false};ctx.report.data_reuse_fixture_fit_dispatches.push(record);const result=await ctx.sql(qualified,...args);record.normal_return=true;return result;}}
   return ctx.sql(text,...args);
  }});
 assert.deepEqual(counts,{control:1,large:1});
}
