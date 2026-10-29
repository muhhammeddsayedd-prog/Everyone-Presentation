import assert from 'node:assert/strict';import test from 'node:test';
import {signSupportReceipt,verifySupportReceipt,SupportReceiptError,type SupportReceiptClaims} from '../src/support-receipt.ts';
const claims:SupportReceiptClaims={schema_version:'candidate-support-verification.v1',audience:'eps.candidate-support-verification',purpose:'candidate_support',key_id:'support-synthetic',verification_id:'10000000-0000-4000-8000-000000000001',upload_id:'20000000-0000-4000-8000-000000000001',asset_id:'30000000-0000-4000-8000-000000000001',principal_id:'40000000-0000-4000-8000-000000000001',workspace_id:'50000000-0000-4000-8000-000000000001',candidate_id:'60000000-0000-4000-8000-000000000001',width:3,height:2,reservation_revision:1,bucket:'eps-candidate-support',object_key:'assets/30000000-0000-4000-8000-000000000001/original.png',size_bytes:50,sha256:'a'.repeat(64),mime_type:'image/png',verified_format:'png',issued_at:100,expires_at:220};
const key=new Uint8Array(32).fill(7);const scope=()=>Object.fromEntries(Object.entries(claims).filter(([key])=>!['schema_version','audience','purpose','issued_at','expires_at'].includes(key))) as import('../src/support-receipt.ts').SupportReceiptScope;
test('support proof is candidate/purpose/size/dimensions/time/key bound',()=>{
 const receipt=signSupportReceipt(claims,key,{now:101});assert.deepEqual(verifySupportReceipt(receipt,key,scope(),{now:102}),claims);
 for(const changed of [{candidate_id:claims.upload_id},{width:4},{reservation_revision:2},{sha256:'b'.repeat(64)}])assert.throws(()=>verifySupportReceipt(receipt,key,{...scope(),...changed},{now:102}),SupportReceiptError);
 assert.throws(()=>verifySupportReceipt(receipt,new Uint8Array(32).fill(8),scope(),{now:102}),SupportReceiptError);
 assert.throws(()=>verifySupportReceipt(receipt,key,scope(),{now:220}),SupportReceiptError);
 assert.throws(()=>signSupportReceipt({...claims,purpose:'specs'} as never,key,{now:101}),SupportReceiptError);
 assert.throws(()=>signSupportReceipt({...claims,width:40000000,height:2},key,{now:101}),SupportReceiptError);
});
