import assert from 'node:assert/strict';import test from 'node:test';
import {restoreCandidateTransferIntents,saveCandidateTransferIntents,type CandidateTransferIntent} from '../../apps/web/lib/candidate-transfer-intent.ts';
const intent:CandidateTransferIntent={id:'10000000-0000-4000-8000-000000000001',name:'synthetic.mp4',mime:'video/mp4',size:6291466,lastModified:1,reserveKey:'20000000-0000-4000-8000-000000000001',completeKey:'30000000-0000-4000-8000-000000000001',cancelKey:'40000000-0000-4000-8000-000000000001',sha256:'a'.repeat(64),offset:6291456,status:'paused',resource:'/storage/v1/upload/resumable/sign/Ym91bmQ'};
test('reload metadata preserves offsets and stable keys while discarding runtime credentials and bytes',()=>{
 const saved=saveCandidateTransferIntents([{...intent,upload_headers:{'x-signature':'private-never-save'},upload_url:'https://storage.invalid/?token=private-never-save',file:new Blob(['private-bytes'])} as never]);
 assert.deepEqual(restoreCandidateTransferIntents(saved),[intent]);assert.doesNotMatch(saved,/private|upload_headers|upload_url|file"/u);
 assert.deepEqual(restoreCandidateTransferIntents(JSON.stringify([{...intent,resource:'https://storage.invalid/resource?token=secret'}])),[]);
 assert.deepEqual(restoreCandidateTransferIntents(JSON.stringify([{...intent,upload_headers:{}}])),[]);
 assert.deepEqual(restoreCandidateTransferIntents(JSON.stringify([{...intent,offset:intent.size+1}])),[]);
});
