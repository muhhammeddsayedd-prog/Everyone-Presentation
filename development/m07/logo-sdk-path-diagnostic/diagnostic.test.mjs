/** Actual installed SDK and production logo adapter; synthetic HTTP/RPC only. */
import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash}from'node:crypto';
import {createRequire}from'node:module';
import {readFileSync,realpathSync}from'node:fs';
import path from'node:path';
import {pathToFileURL}from'node:url';

const root='D:/Everyone/Presentation/Everyone-Presentation-Studio';
const require=createRequire(path.join(root,'packages/central/src/client.ts'));
const sdkPackage=require.resolve('@supabase/supabase-js/package.json');
const storagePackage=require.resolve('@supabase/storage-js/package.json');
assert.equal(realpathSync(sdkPackage).replaceAll('\\','/'),root+'/node_modules/@supabase/supabase-js/package.json');
assert.equal(realpathSync(storagePackage).replaceAll('\\','/'),root+'/node_modules/@supabase/storage-js/package.json');
assert.equal(JSON.parse(readFileSync(sdkPackage,'utf8')).version,'2.118.0');
assert.equal(JSON.parse(readFileSync(storagePackage,'utf8')).version,'2.118.0');
const {createClient}=await import(pathToFileURL(path.join(path.dirname(sdkPackage),'dist/index.mjs')).href);
const {createBearerUserClient}=await import(pathToFileURL(root+'/packages/central/src/client.ts').href);
const {createLogoStorageAdapter}=await import(pathToFileURL(root+'/packages/central/src/logo-storage.ts').href);
const {createCentralStudio}=await import(pathToFileURL(root+'/packages/central/src/studio.ts').href);
const origin='https://logo-sdk.synthetic.invalid',bucket='eps-brand-assets';
const principal='98000000-0000-4000-8000-000000000001',asset='98000000-0000-4000-8000-000000000002';
const upload='98000000-0000-4000-8000-000000000003',workspace='98000000-0000-4000-8000-000000000004';
const key=`assets/${asset}/original.png`,bytes=Uint8Array.from([137,80,78,71,13,10,26,10]);
const digest=createHash('sha256').update(bytes).digest('hex');
function sdk(fetch){return createClient(origin,'sb_publishable_synthetic_sdk',{
 auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
 global:{fetch,headers:{Authorization:'Bearer synthetic-not-real'}},
});}

test('actual SDK download.asStream issues exactly one object GET and no info preflight',async()=>{
 const calls=[];const client=sdk(async(input,init)=>{
  const request=new Request(input,init),url=new URL(request.url);
  assert.equal(url.origin,origin);assert.equal(request.headers.get('authorization'),'Bearer synthetic-not-real');
  calls.push([request.method,url.pathname]);return new Response(bytes,{status:200});
 });
 const response=await client.storage.from(bucket).download(key,{}, {cache:'no-store'}).asStream();
 assert.equal(response.error,null);assert.deepEqual(new Uint8Array(await new Response(response.data).arrayBuffer()),bytes);
 assert.deepEqual(calls,[['GET',`/storage/v1/object/${bucket}/${key}`]]);
});

test('actual SDK info is a separate explicit metadata call, not an automatic download step',async()=>{
 const calls=[];const client=sdk(async(input,init)=>{
  const request=new Request(input,init),url=new URL(request.url);assert.equal(url.origin,origin);
  calls.push([request.method,url.pathname]);return Response.json({size:8,content_type:'image/png'});
 });
 const result=await client.storage.from(bucket).info(key);assert.equal(result.error,null);assert.equal(result.data.size,8);
 assert.deepEqual(calls,[['GET',`/storage/v1/object/info/${bucket}/${key}`]]);
});

function reservation(){return{
 upload_id:upload,asset:{id:asset,purpose:'client_logo',filename:'synthetic.png',mime_type:'image/png',size_bytes:8,
  sha256:null,status:'uploading',duration_ms:null,width:null,height:null,source_asset_id:null,source_timestamp_ms:null,created_at:'2026-11-01T00:00:00Z'},
 principal_id:principal,workspace_id:workspace,reservation_revision:1,verification_id:'98000000-0000-4000-8000-000000000005',
 bucket,object_key:key,expected_size_bytes:8,expected_mime_type:'image/png',expected_sha256:digest,expires_at:'2099-01-01T00:00:00Z',status:'open',
};}
async function logo(responseFactory){
 const calls=[],sideEffects={decode:0,finalize:0};
 const client=createBearerUserClient({url:origin,publishableKey:'sb_publishable_synthetic_sdk',accessToken:'synthetic-not-real'},{fetch:async(input,init)=>{
  const request=new Request(input,init),url=new URL(request.url);assert.equal(url.origin,origin);
  assert.equal(request.redirect,'error');assert.equal(request.cache,'no-store');
  calls.push([request.method,url.pathname]);
  if(url.pathname==='/auth/v1/user')return Response.json({id:principal,role:'authenticated',is_anonymous:false});
  assert.equal(request.headers.get('authorization'),'Bearer synthetic-not-real');return responseFactory();
 }});
 const fail=()=>{throw Error('Unexpected synthetic RPC');};
 const adapter=await createLogoStorageAdapter({client,storageOrigin:origin,brandBucket:bucket,
  rpc:{reserveUpload:fail,getUpload:fail,cancelUpload:fail,getMedia:fail,
   async prepareCompletion(){return{reservation:reservation(),replay:null};},
   async finalizeCompletion(){sideEffects.finalize++;return{asset:{...reservation().asset,status:'ready',sha256:digest,width:1,height:1},processing_job_id:null,status:'ready'};},
  },
  async decodeLogo(){sideEffects.decode++;return{mimeType:'image/png',width:1,height:1};},
  signReceipt(){return{payload:'synthetic-payload',mac:'synthetic-mac'};},
 });
 return{adapter,calls,sideEffects};
}

test('production logo completion plus actual SDK propagates legacy object GET 400/body404 safely, without info',async()=>{
 const c=await logo(()=>Response.json({statusCode:'404',code:'NoSuchKey',message:'SYNTHETIC_PRIVATE_BODY'},{status:400}));
 await assert.rejects(()=>c.adapter.completeUpload({principal_id:principal},upload,{actual_size_bytes:8,sha256:digest,start_processing:false}),error=>{
  assert.equal(error.code,'UPLOAD_INCOMPLETE');assert.equal(error.status,409);
  assert.deepEqual(error.details,{logo_phase:'download',storage_http_status:400,storage_body_status:404,storage_code:'NoSuchKey'});
  assert(!JSON.stringify(error.details).includes('SYNTHETIC_PRIVATE'));return true;
 });
 assert.deepEqual(c.calls,[['GET','/auth/v1/user'],['GET',`/storage/v1/object/${bucket}/${key}`]]);
 assert.deepEqual(c.sideEffects,{decode:0,finalize:0});
});

test('production logo completion reaches verifier after the single actual SDK object GET succeeds',async()=>{
 const c=await logo(()=>new Response(bytes,{status:200}));
 const result=await c.adapter.completeUpload({principal_id:principal},upload,{actual_size_bytes:8,sha256:digest,start_processing:false});
 assert.equal(result.status,'ready');assert.equal(result.asset.sha256,digest);
 assert.deepEqual(c.calls,[['GET','/auth/v1/user'],['GET',`/storage/v1/object/${bucket}/${key}`]]);
 assert.deepEqual(c.sideEffects,{decode:1,finalize:1});
});

test('complete central studio routing and real SDK RPC still produce no info preflight',async()=>{
 const calls=[];let finalized=false;
 const client=createBearerUserClient({url:origin,publishableKey:'sb_publishable_synthetic_sdk',accessToken:'synthetic-not-real'},{fetch:async(input,init)=>{
  const request=new Request(input,init),url=new URL(request.url);assert.equal(url.origin,origin);calls.push([request.method,url.pathname]);
  if(url.pathname==='/auth/v1/user')return Response.json({id:principal,role:'authenticated',is_anonymous:false});
  if(url.pathname==='/rest/v1/rpc/eps_get_logo_upload')return Response.json(reservation());
  if(url.pathname==='/rest/v1/rpc/eps_prepare_logo_completion')return Response.json({reservation:reservation(),replay:null});
  if(url.pathname===`/storage/v1/object/${bucket}/${key}`)return Response.json({statusCode:'404',code:'NoSuchKey',message:'SYNTHETIC_PRIVATE'},{status:400});
  if(url.pathname==='/rest/v1/rpc/eps_finalize_logo_completion')finalized=true;
  throw Error('Unexpected synthetic request');
 }});
 const studio=await createCentralStudio(client,{logo:{storageOrigin:origin,brandBucket:bucket,
  async decodeLogo(){throw Error('Must not decode missing bytes');},signReceipt(){throw Error('Must not sign missing bytes');},
 }});
 await assert.rejects(()=>studio.completeUpload({principal_id:principal},upload,{actual_size_bytes:8,sha256:digest,start_processing:false},{idempotencyKey:'synthetic-logo-once',requestId:'synthetic-request',clientType:'mcp'}),error=>error.code==='UPLOAD_INCOMPLETE');
 assert.deepEqual(calls.filter(([,p])=>p.startsWith('/storage/')),[['GET',`/storage/v1/object/${bucket}/${key}`]]);
 assert.equal(finalized,false);assert(!calls.some(([,p])=>p.includes('/info/')));
});
