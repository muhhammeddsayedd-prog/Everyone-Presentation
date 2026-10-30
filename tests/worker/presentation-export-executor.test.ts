import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import type { JobEvent, JsonObject, StageLease } from '../../packages/jobs/src/types.ts';
import { presentationCanonicalHash, manifestFromSnapshot } from '../../packages/domain/src/presentation.ts';
import { executePresentationExportStage } from '../../apps/worker/src/presentation-export-executor.ts';
import { PresentationExecutionError } from '../../apps/worker/src/presentation-stage-executor.ts';
import { PresentationPdfError, renderPresentationExportPdf } from '../../apps/worker/src/presentation-pdf.ts';
import type { PresentationArtifact, PresentationStageAssets } from '../../apps/worker/src/presentation-assets.ts';
import { nativePresentation } from './presentation-native-fixture.ts';
const id=(n:number)=>`a6060000-0000-4000-8000-${String(n).padStart(12,'0')}`;
async function fixture(){
 const {snapshot,images}=nativePresentation([0],false);
 const small={schema_version:'1.0',workspace_id:snapshot.workspace_id,series_id:snapshot.series_id,version_id:snapshot.version_id,export_id:id(1),review_link_id:id(2),export_revision:1,token_generation:1,snapshot_sha256:await presentationCanonicalHash(snapshot),manifest_sha256:await presentationCanonicalHash(manifestFromSnapshot(snapshot)),inventory_sha256:await presentationCanonicalHash(snapshot.asset_inventory),configuration:snapshot.render_configuration};
 const input={...small,input_hash:await presentationCanonicalHash(small)};
 const lease:StageLease={job_id:id(3),attempt_id:id(4),stage:'render_export',lease_token:'b'.repeat(64),lease_expires_at:new Date(Date.now()+90000).toISOString(),already_completed:false,input:input as JsonObject};
 const grant={grant_id:id(5),grant_token:'g'.repeat(43),version_id:snapshot.version_id,review_link_id:id(2),export_id:id(1),export_revision:1,expires_at:new Date(Date.now()+86400000).toISOString()};
 const events:JobEvent[]=[];let mints=0;let writes=0;let bytes:Uint8Array|undefined;
 const gateway={async getInput(){return {...structuredClone(input),job_id:lease.job_id,attempt_id:lease.attempt_id,stage:lease.stage,snapshot:structuredClone(snapshot)};},async mintReviewMediaGrant(){mints++;return {...grant};},async recordEvent(event:JobEvent){events.push(structuredClone(event));return {event_id:event.event_id,applied:true,duplicate:false,stale:false,job_status:'succeeded' as const};}};
 const assets:PresentationStageAssets={async read(_scope,asset){const value=images.get(asset.asset_id);assert.ok(value);return value;},async write(_scope,value):Promise<PresentationArtifact>{writes++;assert.equal(value.purpose,'presentation_pdf');bytes=new Uint8Array(value.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),value.sha256);return {asset_id:id(6),sha256:value.sha256,size_bytes:bytes.length,mime_type:'application/pdf'};}};
 return {snapshot,lease,grant,events,gateway,assets,mints:()=>mints,writes:()=>writes,bytes:()=>bytes};
}
test('single export stage mints in memory, independently validates real PDF, and emits only closed safe references',{timeout:120000},async()=>{
 const f=await fixture();const before=await presentationCanonicalHash(f.snapshot);const result=await executePresentationExportStage(f.lease,f.gateway,{assets:f.assets});
 assert.equal(result.receipt?.applied,true);assert.equal(f.mints(),1);assert.equal(f.writes(),1);assert.equal(Buffer.from(f.bytes()!).subarray(0,5).toString(),'%PDF-');
 const event=f.events.at(-1)!;assert.equal(event.event_type,'succeeded');assert.equal(event.result_schema,'presentation-export-result.v1');assert.equal(event.result!.grant_id,f.grant.grant_id);
 assert.equal(JSON.stringify(f.events).includes(f.grant.grant_token),false);assert.equal(JSON.stringify(f.lease.input).includes(f.grant.grant_token),false);assert.equal(await presentationCanonicalHash(f.snapshot),before);
});
test('changed fixed snapshot, link generation, or unexpected input fails before grant issuance',async()=>{
 for(const change of ['snapshot','generation','extra']as const){const f=await fixture();const original=f.gateway.getInput;f.gateway.getInput=async()=>{const value=await original();if(change==='snapshot')value.snapshot.cover.project_name='Changed';if(change==='generation')value.token_generation=2;if(change==='extra')Object.assign(value,{grant_token:f.grant.grant_token});return value;};await assert.rejects(executePresentationExportStage(f.lease,f.gateway,{assets:f.assets}),PresentationExecutionError);assert.equal(f.mints(),0);assert.equal(f.writes(),0);}
});
test('wrong grant scope is safely failed without upload, raw credentials or provider diagnostics',async()=>{
 const f=await fixture();f.grant.export_id=id(999);await executePresentationExportStage(f.lease,f.gateway,{assets:f.assets});assert.equal(f.events.at(-1)!.event_type,'failed');assert.equal(f.writes(),0);assert.equal(JSON.stringify(f.events).includes(f.grant.grant_token),false);
});
test('render failure produces a redacted failure callback for database grant revocation',async()=>{
 const f=await fixture();await executePresentationExportStage(f.lease,f.gateway,{assets:f.assets,render:async()=>{throw new PresentationPdfError('PDF_OVERFLOW');}});assert.equal(f.events.at(-1)!.error?.code,'PDF_LAYOUT_OVERFLOW');assert.equal(f.events.at(-1)!.error?.retryable,false);assert.equal(f.writes(),0);assert.equal(f.mints(),1);assert.equal(JSON.stringify(f.events).includes(f.grant.grant_token),false);
});
test('unknown completion acknowledgement retries the identical event without reminting or rerendering',{timeout:120000},async()=>{
 const f=await fixture();let calls=0;let renders=0;f.gateway.recordEvent=async event=>{f.events.push(structuredClone(event));if(++calls===1)throw{code:'RUNTIME_UNAVAILABLE',outcome:'unknown',gateway_phase:'commit',transport_code:'ECONNRESET'};return{event_id:event.event_id,applied:false,duplicate:true,stale:false,job_status:'succeeded'};};
 const response=await executePresentationExportStage(f.lease,f.gateway,{assets:f.assets,render:async(...args)=>{renders++;return renderPresentationExportPdf(...args);}});assert.equal(response.receipt?.duplicate,true);assert.equal(renders,1);assert.equal(f.mints(),1);assert.equal(f.writes(),1);assert.deepEqual(f.events[0],f.events[1]);
});
test('completed, expired, missing mint port and cancelled leases do no export work',async()=>{
 const f=await fixture();assert.equal((await executePresentationExportStage({...f.lease,already_completed:true},f.gateway,{assets:f.assets})).already_completed,true);
 await assert.rejects(executePresentationExportStage({...f.lease,lease_expires_at:new Date(0).toISOString()},f.gateway,{assets:f.assets}),PresentationExecutionError);
 await assert.rejects(executePresentationExportStage(f.lease,{...f.gateway,mintReviewMediaGrant:undefined},{assets:f.assets}),PresentationExecutionError);
 const controller=new AbortController();controller.abort();await assert.rejects(executePresentationExportStage(f.lease,f.gateway,{assets:f.assets,signal:controller.signal}),PresentationExecutionError);assert.equal(f.mints(),0);assert.equal(f.writes(),0);
});
