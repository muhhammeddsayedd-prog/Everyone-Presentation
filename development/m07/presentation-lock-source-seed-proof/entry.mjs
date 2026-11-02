/** New disabled purpose; the consumed proof is a pinned library, never its CLI. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';
import * as previous from '../presentation-lock-source-proof/proof.mjs';
export const EXECUTION_ENABLED=false;
export const SEED_SHA='0a74ce47ff97339b4e63cf8df3aa3801321e2099588ed22367e5fe4317acaa7f';
export const BEFORE="if(select candidates<>3 or media<>1 or frames<>0 or assets<>4 or ready<>1 or slides<>16 or pins<>4 from locksource41_proof.seed_counts)then";
export const AFTER="if(select seed.candidates<>3 or seed.media<>1 or seed.frames<>0 or seed.assets<>4 or seed.ready<>1 or seed.slides<>16 or seed.pins<>4 from locksource41_proof.seed_counts seed)then";
export function qualifySeed(source){
 assert.equal(previous.sha(source),SEED_SHA);assert.equal(source.split(BEFORE).length,2);
 const qualified=source.replace(BEFORE,AFTER);assert.equal(qualified.replace(AFTER,BEFORE),source);
 return qualified;
}
export async function runCases(ctx){
 assert(EXECUTION_ENABLED,'LOCKSOURCE41_SEED_EXECUTION_DISABLED');
 const before=await readFile(new URL('../presentation-lock-source-proof/scale.sql',import.meta.url),'utf8'),after=qualifySeed(before);
 const prefix='set session authorization postgres;begin;set local eps.locksource41.run='+previous.literal(ctx.runId)+';';
 const evidence=ctx.report.seed_alias_qualification={original_scale_sha256:SEED_SHA,qualified_scale_sha256:previous.sha(after),only_seven_seed_columns_qualified:true,thresholds_unchanged:true,inverse_byte_equal:true,dispatch_started:false,normal_return:false};
 let count=0;
 await previous.runCases({...ctx,sql:async(text,...args)=>{
  if(text.includes(BEFORE)){
   assert.equal(text,prefix+before+'commit;');assert.equal(++count,1);evidence.dispatch_started=true;
   const result=await ctx.sql(prefix+after+'commit;',...args);evidence.normal_return=true;return result;
  }
  return ctx.sql(text,...args);
 }});
 assert.equal(count,1);
}
