/** Fresh disabled data-reuse purpose. No historical controller/claim is called. */
import assert from 'node:assert/strict';
import { lstat,readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL,URL } from 'node:url';
import { sha } from '../presentation-lock-source-proof/proof.mjs';
import { qualifyFit } from '../presentation-lock-source-dedupe-proof/entry.mjs';
import { trackedSessions,PROBE_SHA } from '../presentation-lock-source-edge-proof/entry.mjs';
export const EXECUTION_ENABLED=false;
const UUID='[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}';

export async function runCases(ctx){
 assert(EXECUTION_ENABLED,'GENERATION_DATA_REUSE_EXECUTION_DISABLED');
 assert.notEqual(ctx.system,'7701520506262638626');
 assert(new RegExp('^'+UUID+'$','u').test(ctx.runId));
 const callback=path.resolve(ctx.bindings.projectedCallback),folder=path.join(ctx.root,'.local/presentation-generation-data-proof-compiled');
 assert.equal(path.dirname(callback),folder);
 assert(new RegExp('^callback-'+UUID+'\\.mjs$','u').test(path.basename(callback)));
 const stat=await lstat(callback);assert(stat.isFile()&&!stat.isSymbolicLink()&&stat.nlink===1&&stat.size>0&&stat.size<=512*1024);
 const bytes=await readFile(callback);assert.equal(sha(bytes),ctx.bindings.projectedCallbackSha);
 const names=['eps.review_snapshot_data','eps.review_snapshot','public.eps_generate_version','eps.capture_presentation_video_transcripts'];
 for(const key of['beforeBodies','afterBodies']){
  assert.deepEqual(ctx.bindings[key].map(item=>item.name),names);
  for(const item of ctx.bindings[key]){assert(/^[a-f0-9]{64}$/u.test(item.sha));assert.equal(sha(item.sql),item.definition_sha256);}
 }
 assert.equal(sha(await readFile(new URL('../presentation-lock-source-proof/probes.mjs',import.meta.url))),PROBE_SHA);
 ctx.report.edge_template_qualification={frozen_probe_sha256:PROBE_SHA,only_three_whitespace_sites_in_two_templates:true,acceptance_and_SQL_semantics_unchanged:true,actual_requests:[]};
 ctx.report.data_reuse_body_installations=[];
 ctx.report.data_reuse_cases={};
 ctx.report.data_reuse_fixture_fit_dispatches=[];
 const counts={control:0,large:0};
 const callbackModule=await import(pathToFileURL(callback).href);
 await callbackModule.runCases({...ctx,sessions:trackedSessions(ctx.sessions,ctx.report,ctx.runId),sql:async(text,...args)=>{
  for(const label of['control','large']){
   const qualified=qualifyFit(text,ctx.runId,label);
   if(qualified!==null){
    assert.equal(++counts[label],1);const record={label,before_sha256:sha(text),after_sha256:sha(qualified),dispatch_started:true,normal_return:false};
    ctx.report.data_reuse_fixture_fit_dispatches.push(record);
    const result=await ctx.sql(qualified,...args);record.normal_return=true;return result;
   }
  }
  return ctx.sql(text,...args);
 }});
 assert.deepEqual(counts,{control:1,large:1});
}
