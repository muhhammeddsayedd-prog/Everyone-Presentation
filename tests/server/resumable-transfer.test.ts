import assert from 'node:assert/strict';
import test from 'node:test';
import type {UploadSession} from '@eps/domain';
import {transferTus,terminateTus,TusTransferError} from '../../apps/web/lib/resumable-transfer.ts';
const bucket='eps-candidate-assets',key='assets/30000000-0000-4000-8000-000000000001/original.mp4';
const endpoint='https://synthetic.storage.supabase.co/storage/v1/upload/resumable/sign';
const resource=`/storage/v1/upload/resumable/sign/${Buffer.from(`${bucket}/${key}/10000000-0000-4000-8000-000000000001`).toString('base64url')}`;
const session:UploadSession={id:'20000000-0000-4000-8000-000000000001',asset_id:'30000000-0000-4000-8000-000000000001',protocol:'tus',upload_url:endpoint,upload_headers:{'x-signature':'synthetic-scoped-signature','x-upsert':'false'},status:'open',expires_at:'2099-01-01T00:00:00Z',maximum_bytes:20*1024*1024,chunk_size:6291456,upload_metadata:{bucketName:bucket,objectName:key,contentType:'video/mp4',cacheControl:'3600'}};
const file=new Blob([new Uint8Array(6291456+10)]);
test('reload HEAD resumes actual offset after lost PATCH acknowledgement without resending accepted bytes',async()=>{
 let offset=0,lost=true;const patches:number[]=[];let location:string|undefined;const progress:number[]=[];
 const fetcher:typeof fetch=async(input,init)=>{const url=String(input),headers=new Headers(init?.headers);assert.equal(init?.redirect,'error');assert.equal(init?.credentials,'omit');assert.equal(headers.get('x-signature'),'synthetic-scoped-signature');
  if(init?.method==='POST'){assert.equal(headers.get('Upload-Length'),String(file.size));return new Response(null,{status:201,headers:{Location:resource}});}
  assert.equal(new URL(url).pathname,resource);
  if(init?.method==='HEAD')return new Response(null,{status:200,headers:{'Upload-Offset':String(offset),'Upload-Length':String(file.size)}});
  assert.equal(init?.method,'PATCH');patches.push(Number(headers.get('Upload-Offset')));assert.equal(patches.at(-1),offset);offset+=(init!.body as Blob).size;
  if(lost){lost=false;throw new TypeError('synthetic transport interruption');}return new Response(null,{status:204,headers:{'Upload-Offset':String(offset)}});
 };
 await assert.rejects(transferTus({session,file,expectedStorageOrigin:'https://synthetic.supabase.co',fetch:fetcher,onCheckpoint:v=>{location=v.resource;progress.push(v.offset);}}),e=>e instanceof TusTransferError&&e.code==='TRANSFER_INTERRUPTED');
 assert.equal(location,resource);assert.equal(offset,6291456);assert.equal(progress.at(-1),0);
 await transferTus({session,file,expectedStorageOrigin:'https://synthetic.supabase.co',resource:location,fetch:fetcher,onCheckpoint:v=>progress.push(v.offset)});
 assert.deepEqual(patches,[0,6291456]);assert.deepEqual(progress,[0,6291456,file.size]);
});
test('credential-bearing or foreign-scope locations fail before a credentialed second request',async()=>{
 for(const location of ['https://evil.invalid/sign/private','/storage/v1/upload/resumable/sign/abc?token=secret',resource.replace(resource.split('/').at(-1)!,Buffer.from(`${bucket}/assets/other/original.mp4/10000000-0000-4000-8000-000000000001`).toString('base64url'))]){
  let calls=0;await assert.rejects(transferTus({session,file,expectedStorageOrigin:'https://synthetic.supabase.co',fetch:async()=>{calls++;return new Response(null,{status:201,headers:{Location:location}});}}),e=>e instanceof TusTransferError&&e.code==='TRANSFER_SCOPE_INVALID');assert.equal(calls,1);
 }
});
test('HEAD length and PATCH offsets are verified, not trusted from persisted progress',async()=>{
 await assert.rejects(transferTus({session,file,expectedStorageOrigin:'https://synthetic.supabase.co',resource,fetch:async()=>new Response(null,{status:200,headers:{'Upload-Offset':'1','Upload-Length':String(file.size+1)}})}),e=>e instanceof TusTransferError&&e.code==='TRANSFER_PROTOCOL_INVALID');
 await assert.rejects(transferTus({session,file,expectedStorageOrigin:'https://synthetic.supabase.co',resource,fetch:async(_u,i)=>i?.method==='HEAD'?new Response(null,{headers:{'Upload-Offset':'0','Upload-Length':String(file.size)}}):new Response(null,{status:204,headers:{'Upload-Offset':'1'}})}),e=>e instanceof TusTransferError&&e.code==='TRANSFER_PROTOCOL_INVALID');
});
test('per-file abort stops PATCH and scoped termination never deletes a completed object',async()=>{
 const controller=new AbortController();controller.abort();let calls=0;await assert.rejects(transferTus({session,file,expectedStorageOrigin:'https://synthetic.supabase.co',resource,signal:controller.signal,fetch:async()=>{calls++;throw Error();}}),e=>e instanceof TusTransferError&&e.code==='TRANSFER_PAUSED');assert.equal(calls,0);
 const methods:string[]=[];await terminateTus({session,file,expectedStorageOrigin:'https://synthetic.supabase.co',resource,fetch:async(_u,i)=>{methods.push(i!.method!);return new Response(null,{headers:{'Upload-Offset':String(file.size),'Upload-Length':String(file.size)}});}});assert.deepEqual(methods,['HEAD']);
});

test('untrusted HTTPS endpoint and missing configured origin fail before sending scoped credentials',async()=>{let calls=0;for(const expectedStorageOrigin of ['', 'https://another.supabase.co'])await assert.rejects(transferTus({session,file,expectedStorageOrigin,fetch:async()=>{calls++;throw Error();}}),e=>e instanceof TusTransferError&&e.code==='TRANSFER_SCOPE_INVALID');await assert.rejects(transferTus({session:{...session,upload_url:'https://evil.invalid/storage/v1/upload/resumable/sign'},file,expectedStorageOrigin:'https://synthetic.supabase.co',fetch:async()=>{calls++;throw Error();}}),e=>e instanceof TusTransferError&&e.code==='TRANSFER_SCOPE_INVALID');assert.equal(calls,0);});
