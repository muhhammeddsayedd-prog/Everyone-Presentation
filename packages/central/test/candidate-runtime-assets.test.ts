import test from 'node:test';
import assert from 'node:assert/strict';
import { createCandidateRuntimeAssets, type CandidateOutputInput } from '../src/candidate-runtime-assets';
const job='78900000-0000-4000-8000-000000000001';const attempt='78900000-0000-4000-8000-000000000002';const assetId='78900000-0000-4000-8000-000000000003';
const sourceId='78900000-0000-4000-8000-000000000004';const prior='78900000-0000-4000-8000-000000000005';
const scope={job_id:job,attempt_id:attempt,lease_token:'a'.repeat(64)};const signal=AbortSignal.timeout(5000);
const config={storageOrigin:'https://pyibofyctwnqpvktepse.supabase.co',publishableKey:'sb_publishable_synthetic_candidate_public_key'};
function access(overrides:Record<string,unknown>={}){return {asset_id:assetId,bucket:'eps-candidate-assets',object_key:`assets/${assetId}/original.mp4`,permission:'read',grant_token:'b'.repeat(43),
 expires_at:new Date(Date.now()+60000).toISOString(),mime_type:'video/mp4',size_bytes:100,sha256:null,...overrides};}
test('candidate original capability permits null pre-verification checksum with exact object and publishable headers only',async()=>{
 const calls:unknown[][]=[];const port=createCandidateRuntimeAssets(config,async(...args)=>{calls.push(args);return access();});
 const value=await port.getAssetAccess({...scope,asset_id:assetId},signal);
 assert.equal(value.method,'GET');assert.equal(value.sha256,null);assert.equal(value.url,`${config.storageOrigin}/storage/v1/object/authenticated/eps-candidate-assets/assets/${assetId}/original.mp4`);
 assert.equal(value.headers.Authorization,`Bearer ${config.publishableKey}`);assert.equal(value.headers['x-eps-asset-grant'],'b'.repeat(43));assert.deepEqual(calls[0].slice(0,2),['access',{...scope,asset_id:assetId}]);
});
test('prior completed derivative reads retain exact same-job/asset scope; cross-job and original writes are rejected',async()=>{
 const good=access({bucket:'eps-candidate-outputs',object_key:`jobs/${job}/attempts/${prior}/${assetId}.jpg`,mime_type:'image/jpeg',sha256:'c'.repeat(64)});
 const port=createCandidateRuntimeAssets(config,async()=>good);assert.ok((await port.getAssetAccess({...scope,asset_id:assetId},signal)).url.endsWith(`${assetId}.jpg`));
 for(const changed of [{object_key:`jobs/${prior}/attempts/${attempt}/${assetId}.jpg`},{expires_at:'invalid'},{bucket:'unrelated-private'},{size_bytes:20971521}]){
  await assert.rejects(createCandidateRuntimeAssets(config,async()=>({...good,...changed})).getAssetAccess({...scope,asset_id:assetId},signal));
 }
 await assert.rejects(createCandidateRuntimeAssets(config,async()=>access({permission:'write'})).getAssetAccess({...scope,asset_id:assetId,access:'write'},signal));
});
test('candidate frame reservation returns immutable scoped POST and completion checks all returned metadata',async()=>{
 const input:CandidateOutputInput={...scope,output_key:'frame_0',asset_kind:'candidate_frame',filename:'frame-0.jpg',mime_type:'image/jpeg',expected_size_bytes:100,parent_asset_id:sourceId,time_offset_ms:500};
 const item={id:assetId,purpose:'candidate_frame',filename:input.filename,mime_type:input.mime_type,size_bytes:100,sha256:null,status:'uploading',duration_ms:null,width:null,height:null,source_asset_id:sourceId,source_timestamp_ms:500,created_at:new Date().toISOString()};
 const port=createCandidateRuntimeAssets(config,async(operation)=>operation==='reserve'?{asset:item,bucket:'eps-candidate-outputs',object_key:`jobs/${job}/attempts/${attempt}/${assetId}.jpg`}:operation==='access'?
  access({bucket:'eps-candidate-outputs',object_key:`jobs/${job}/attempts/${attempt}/${assetId}.jpg`,permission:'write',mime_type:'image/jpeg'}):{...item,status:'ready',sha256:'d'.repeat(64),width:640,height:480});
 const reserved=await port.reserveOutput(input,signal);assert.equal(reserved.access.method,'POST');assert.equal(reserved.access.headers['Content-Type'],'image/jpeg');assert.equal(reserved.access.headers['x-upsert'],'false');
 const completed=await port.completeOutput({...scope,asset_id:assetId,sha256:'d'.repeat(64),actual_size_bytes:100,width:640,height:480,duration_ms:null},signal);assert.equal(completed.status,'ready');
 await assert.rejects(port.completeOutput({...scope,asset_id:assetId,sha256:'d'.repeat(64),actual_size_bytes:100,width:641,height:480,duration_ms:null},signal));
});
