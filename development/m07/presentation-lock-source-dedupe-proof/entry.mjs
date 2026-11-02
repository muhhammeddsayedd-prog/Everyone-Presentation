/** Disabled finite fixture correction; consumed controllers are never invoked. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';
import * as seed from '../presentation-lock-source-seed-proof/entry.mjs';
import { sha,literal } from '../presentation-lock-source-proof/proof.mjs';
export const EXECUTION_ENABLED=true;
export const SCALE_SHA='aee1e6dfbe072ebd7f971f7534b76c11cbf78eb7b5bf5b73f04c29edaef83da1';
export const BACKGROUND_SHA='e8d61b12ebf4d25a57ba10944bd91d65494cdcfe79b9230a4c785bfe4484b544';
export const digest=expression=>`encode(sha256(convert_to(${expression},'UTF8')),'hex')`;
const replaceOnce=(source,before,after)=>{assert.equal(source.split(before).length,2);const result=source.replace(before,after);assert.equal(result.replace(after,before),source);return result;};
export function qualifyScale(source){
 assert.equal(sha(source),SCALE_SHA);
 return replaceOnce(source,"repeat('a',64),'synthetic-lock-media-'||i,'succeeded'",`repeat('a',64),${digest("'synthetic-lock-media-'||i")},'succeeded'`);
}
export function qualifyBackground(source){
 assert.equal(sha(source),BACKGROUND_SHA);
 return replaceOnce(source,"repeat('c',64),'synthetic-retained-'||i,'succeeded'",`repeat('c',64),${digest("'synthetic-retained-'||i")},'succeeded'`);
}
export function qualifyFit(text,run,label){
 assert(/^[a-f0-9-]{36}$/u.test(run)&&['control','large'].includes(label));
 const key=literal('locksource41-'+run+'-'+label+'-fit');
 const before=`repeat('f',64),${key},'succeeded','measure_review_fit',${key}`;
 if(!text.includes(before))return null;
 assert(text.startsWith('set session authorization postgres;begin;insert into eps.jobs(id,workspace_id,requested_by,kind,resource_id,input,input_hash,dedupe_key,status,stage,correlation_id)values('));
 assert(text.includes(');insert into eps.review_fit_results(job_id,workspace_id,series_id,input_fingerprint,status,result)values(')&&text.endsWith('commit;'));
 return replaceOnce(text,before,`repeat('f',64),${digest(key)},'succeeded','measure_review_fit',${key}`);
}
export async function runCases(ctx){
 assert(EXECUTION_ENABLED,'LOCKSOURCE41_DEDUPE_EXECUTION_DISABLED');
 const scale=seed.qualifySeed(await readFile(new URL('../presentation-lock-source-proof/scale.sql',import.meta.url),'utf8'));
 const background=await readFile(new URL('../presentation-lock-source-proof/background.sql',import.meta.url),'utf8');
 const correctedScale=qualifyScale(scale),correctedBackground=qualifyBackground(background);
 const prefix='set session authorization postgres;begin;set local eps.locksource41.run='+literal(ctx.runId)+';';
 const evidence=ctx.report.fixture_dedupe_qualification={only_three_declared_fixture_job_dedupe_expressions_changed:true,existing_64_hex_CHECK_and_uniqueness_retained:true,scale_before_sha256:sha(scale),scale_after_sha256:sha(correctedScale),background_before_sha256:sha(background),background_after_sha256:sha(correctedBackground),inverse_byte_equal:true,dispatches:[]};
 const counts={scale:0,background:0,fit_control:0,fit_large:0};
 await seed.runCases({...ctx,sql:async(text,...args)=>{
  let kind,corrected;
  if(text===prefix+scale+'commit;'){kind='scale';corrected=prefix+correctedScale+'commit;';}
  else if(text===prefix+background+'commit;'){kind='background';corrected=prefix+correctedBackground+'commit;';}
  else for(const label of['control','large']){const fit=qualifyFit(text,ctx.runId,label);if(fit!==null){kind='fit_'+label;corrected=fit;break;}}
  if(kind===undefined)return ctx.sql(text,...args);
  assert.equal(++counts[kind],1);const record={kind,before_sha256:sha(text),after_sha256:sha(corrected),dispatch_started:true,normal_return:false};evidence.dispatches.push(record);
  const result=await ctx.sql(corrected,...args);record.normal_return=true;return result;
 }});
 assert.deepEqual(counts,{scale:1,background:1,fit_control:1,fit_large:1});
}
