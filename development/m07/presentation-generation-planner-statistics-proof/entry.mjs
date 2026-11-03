/** Disabled new purpose. Importing does not start the owned transport. */
import assert from 'node:assert/strict';
import {lstat,readFile,realpath,writeFile}from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL}from 'node:url';
import {sha}from 'file:///D:/Everyone/Presentation/Everyone-Presentation-Studio/development/m07/presentation-lock-source-proof/proof.mjs';
import {qualifyFit}from 'file:///D:/Everyone/Presentation/Everyone-Presentation-Studio/development/m07/presentation-lock-source-dedupe-proof/entry.mjs';
import {preserveFirstOwnedError}from 'file:///D:/Everyone/Presentation/Everyone-Presentation-Studio/development/m07/presentation-generation-data-diagnostics/capture.mjs';
export const EXECUTION_ENABLED=false;
const NAMESPACE='presentation-generation-planner-statistics-proof';
const UUID='[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}';
export async function runCases(ctx){
 assert(EXECUTION_ENABLED,'PLANNER_STATS_EXECUTION_DISABLED');
 assert(['control','analyzed'].includes(ctx.bindings.statsArm));
 assert.notEqual(ctx.system,'7701520506262638626');assert(new RegExp('^'+UUID+'$','u').test(ctx.runId));
 assert.equal(ctx.report.private_acl_verified,true);assert.equal(ctx.report.dispatch_once_claim_created,true);
 const privateRoot=path.join(ctx.root,'.local/'+NAMESPACE+'-'+ctx.bindings.statsArm,ctx.runId);
 assert.equal(await realpath(privateRoot),privateRoot);assert((await lstat(privateRoot)).isDirectory());
 assert.deepEqual(JSON.parse(await readFile(path.join(privateRoot,'claim.json'),'utf8')),{run_id:ctx.runId,automatic_retry:false});
 const folder=path.join(ctx.root,'.local/'+NAMESPACE+'-compiled');
 for(const[label,kind]of[['projectedCallback','callback'],['projectedCases','cases']]){
  const file=path.resolve(ctx.bindings[label]);assert.equal(path.dirname(file),folder);
  assert(new RegExp('^'+kind+'-'+ctx.bindings.statsArm+'-'+UUID+'\\.mjs$','u').test(path.basename(file)));
  const stat=await lstat(file);assert(stat.isFile()&&!stat.isSymbolicLink()&&stat.nlink===1&&stat.size>0&&stat.size<=512*1024);
  assert.equal(sha(await readFile(file)),ctx.bindings[label+'Sha']);
 }
 assert.equal(Object.keys(ctx.bindings.canonicalTargets).length,8);
 assert.equal(ctx.bindings.canonicalTargets['eps.presentation_lock_sources'],'4107c87b1a51d2c5ed506a64c81378026068406a5136b202779767efb30264e7');
 ctx.report.scope='one original-production-graph MCP-large8s call in a fresh owned arm; controlled planner-statistics diagnostic, no matrix/security/performance/hosted acceptance';
 ctx.report.planner_statistics_canonical_reference=ctx.bindings.canonicalStatsReference;
 ctx.report.data_reuse_fixture_fit_dispatches=[];const counts={control:0,large:0};
 const sessions=preserveFirstOwnedError(ctx.sessions,async value=>writeFile(path.join(privateRoot,'first-owned-native-error.json'),JSON.stringify(value),{flag:'wx',mode:0o600}),ctx.report);
 const captureError=async(name,error)=>{
  assert(/^[a-z0-9_-]{1,100}$/u.test(name));const basename='case-'+name+'-error.json';
  const value={schema_version:'planner-statistics-private-error.v1',case_id:name,message:typeof error?.message==='string'?error.message:null,diagnostic:error?.diagnostic??null};
  try{await writeFile(path.join(privateRoot,basename),JSON.stringify(value),{flag:'wx',mode:0o600});return{private_file:basename,normal_return:true};}
  catch{return{private_file:basename,normal_return:false,private_capture_failed:true};}
 };
 const projected=await import(pathToFileURL(ctx.bindings.projectedCallback).href);
 await projected.runCases({...ctx,captureError,sessions,
  psqlArgs:()=>{const args=ctx.psqlArgs();assert(!args.some(x=>typeof x==='string'&&x.includes('VERBOSITY=')));return[...args,'-v','VERBOSITY=verbose'];},
  sql:async(text,...args)=>{
   for(const label of['control','large']){const qualified=qualifyFit(text,ctx.runId,label);if(qualified!==null){assert.equal(++counts[label],1);const record={label,before_sha256:sha(text),after_sha256:sha(qualified),dispatch_started:true,normal_return:false};ctx.report.data_reuse_fixture_fit_dispatches.push(record);const result=await ctx.sql(qualified,...args);record.normal_return=true;return result;}}
   return ctx.sql(text,...args);
  }});
 assert.deepEqual(counts,{control:1,large:1});
}
