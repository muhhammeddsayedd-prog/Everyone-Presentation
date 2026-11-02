/** New disabled cohort-only purpose. Exact old queries/8s; private diagnostics. */
import assert from 'node:assert/strict';
import { lstat,readFile,realpath,writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL,URL } from 'node:url';
import { sha } from '../presentation-lock-source-proof/proof.mjs';
import { qualifyFit } from '../presentation-lock-source-dedupe-proof/entry.mjs';
import { trackedSessions,PROBE_SHA } from '../presentation-lock-source-edge-proof/entry.mjs';
import { preserveFirstOwnedError } from './capture.mjs';
export const EXECUTION_ENABLED=true;
const UUID='[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}';

export async function runCases(ctx){
 assert(EXECUTION_ENABLED,'COHORT_DIAGNOSTIC_EXECUTION_DISABLED');
 assert.notEqual(ctx.system,'7701520506262638626');assert(new RegExp('^'+UUID+'$','u').test(ctx.runId));
 assert.equal(ctx.report.private_acl_verified,true);
 const privateRoot=path.join(ctx.root,'.local/presentation-generation-data-diagnostics',ctx.runId);
 assert.equal(await realpath(privateRoot),privateRoot);assert((await lstat(privateRoot)).isDirectory());
 const claim=JSON.parse(await readFile(path.join(privateRoot,'claim.json'),'utf8'));assert.deepEqual(claim,{run_id:ctx.runId,automatic_retry:false});
 const callback=path.resolve(ctx.bindings.projectedCallback),folder=path.join(ctx.root,'.local/presentation-generation-data-diagnostics-compiled');
 assert.equal(path.dirname(callback),folder);assert(new RegExp('^callback-'+UUID+'\\.mjs$','u').test(path.basename(callback)));
 const stat=await lstat(callback);assert(stat.isFile()&&!stat.isSymbolicLink()&&stat.nlink===1&&stat.size>0&&stat.size<=512*1024);
 assert.equal(sha(await readFile(callback)),ctx.bindings.projectedCallbackSha);
 assert.equal(sha(await readFile(new URL('../presentation-lock-source-proof/probes.mjs',import.meta.url))),PROBE_SHA);
 ctx.report.scope='one owned local original source-cohort diagnosis; no candidate or full performance/equality acceptance';
 ctx.report.edge_template_qualification={frozen_probe_sha256:PROBE_SHA,only_three_whitespace_sites_in_two_templates:true,acceptance_and_SQL_semantics_unchanged:true,actual_requests:[]};
 ctx.report.data_reuse_body_installations=[];ctx.report.data_reuse_cases={};ctx.report.data_reuse_fixture_fit_dispatches=[];
 const captured=preserveFirstOwnedError(ctx.sessions,async value=>{
  await writeFile(path.join(privateRoot,'first-owned-native-error.json'),JSON.stringify(value),{flag:'wx',mode:0o600});
 },ctx.report);
 const counts={control:0,large:0};
 const callbackModule=await import(pathToFileURL(callback).href);
 await callbackModule.runCases({...ctx,sessions:trackedSessions(captured,ctx.report,ctx.runId),
  psqlArgs:()=>{const args=ctx.psqlArgs();assert(!args.some(value=>typeof value==='string'&&value.includes('VERBOSITY=')));return [...args,'-v','VERBOSITY=verbose'];},
  sql:async(text,...args)=>{
   for(const label of['control','large']){
    const qualified=qualifyFit(text,ctx.runId,label);
    if(qualified!==null){assert.equal(++counts[label],1);const record={label,before_sha256:sha(text),after_sha256:sha(qualified),dispatch_started:true,normal_return:false};ctx.report.data_reuse_fixture_fit_dispatches.push(record);const result=await ctx.sql(qualified,...args);record.normal_return=true;return result;}
   }
   return ctx.sql(text,...args);
  }});
 assert.deepEqual(counts,{control:1,large:1});
}
