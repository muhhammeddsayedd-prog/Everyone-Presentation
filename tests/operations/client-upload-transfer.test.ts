import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {mkdtemp,writeFile,rm,symlink,realpath} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {ClientUploadError,parseTransferInput,transferLocalUpload,readPrivateInput,runCli,STORAGE_ORIGIN,API_ORIGIN,type ResumeCheckpoint} from '../../tools/client-upload-transfer.mts';

const upload='10000000-0000-4000-8000-000000000001',asset='20000000-0000-4000-8000-000000000001';
const version='30000000-0000-4000-8000-000000000001';
const hash=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
const identifier=(bucket:string,ext:string)=>Buffer.from(`${bucket}/assets/${asset}/original.${ext}/${version}`).toString('base64url');
async function fixture(bytes=new Uint8Array([1,2,3,4]),purpose='candidate_video'){
 const root=await mkdtemp(path.join(tmpdir(),'eps-client-transfer-')),ext=purpose==='specs'?'pdf':purpose==='client_logo'?'png':'mp4',file=path.join(root,`synthetic.${ext}`);
 await writeFile(file,bytes);const mime=ext==='pdf'?'application/pdf':ext==='png'?'image/png':'video/mp4';
 const bucket=purpose==='specs'?'eps-specs-assets':purpose==='client_logo'?'eps-brand-assets':'eps-candidate-assets';
 const tus=purpose==='candidate_video',session={id:upload,asset_id:asset,protocol:tus?'tus':'signed_put',
  upload_url:tus?`${STORAGE_ORIGIN}/storage/v1/upload/resumable/sign`:`${API_ORIGIN}/storage/v1/object/upload/sign/${bucket}/assets/${asset}/original.${ext}?token=synthetic-signed-token`,
  upload_headers:tus?{'x-signature':'synthetic-signature','x-upsert':'false'}:{'Content-Type':mime,'x-upsert':'false'},
  expires_at:'2099-01-01T00:00:00Z',status:'open',maximum_bytes:purpose==='client_logo'?5242880:purpose==='specs'?20971520:268435456,
  ...(tus?{upload_metadata:{bucketName:bucket,objectName:`assets/${asset}/original.${ext}`,contentType:mime,cacheControl:'3600'},chunk_size:6291456}:{})};
 const input={schema_version:'1.0',local_file_path:file,purpose,mime_type:mime,expected_upload_id:upload,expected_asset_id:asset,
  expected_size_bytes:bytes.length,expected_sha256:hash(bytes),start_processing:tus,session,resume:null};
 return {root,file,input,bytes,resource:identifier(bucket,ext),async close(){assert.equal(await realpath(root),root);assert.equal(path.dirname(root),tmpdir());assert.ok(path.basename(root).startsWith('eps-client-transfer-'));await rm(root,{recursive:true,force:true});}};
}
const typed=(code:string)=>(error:unknown)=>error instanceof ClientUploadError&&error.code===code;

test('closed input rejects auth fields, getters, wrong identity, MIME and policy before any transfer',async()=>{
 const f=await fixture();try{
  parseTransferInput(f.input);
  for(const input of [{...f.input,access_token:'private'},{...f.input,expected_asset_id:upload},
   {...f.input,mime_type:'text/plain'},{...f.input,start_processing:false},
   {...f.input,session:{...f.input.session,maximum_bytes:268435457}},
   {...f.input,session:{...f.input.session,upload_headers:{...f.input.session.upload_headers,Authorization:'Bearer private'}}},
   {...f.input,session:{...f.input.session,status:'completed'}},
   {...f.input,session:{...f.input.session,expires_at:'2000-01-01T00:00:00Z'}}])assert.throws(()=>parseTransferInput(input),ClientUploadError);
  let called=false;const hostile={...f.input};Object.defineProperty(hostile,'session',{get(){called=true;throw Error('private');},enumerable:true});
  assert.throws(()=>parseTransferInput(hostile),ClientUploadError);assert.equal(called,false);
 }finally{await f.close();}
});

test('signed PUT sends exact file-backed bytes once and outputs no transfer capability or local path',async()=>{
 const f=await fixture(undefined,'specs');try{
  let calls=0;const result=await transferLocalUpload(f.input,{allowedRoot:f.root,fetch:async(url,init)=>{
   calls++;assert.equal(new URL(String(url)).origin,API_ORIGIN);assert.equal(init?.method,'PUT');assert.equal(init?.redirect,'error');assert.equal(init?.credentials,'omit');
   assert.deepEqual(Object.fromEntries(new Headers(init?.headers)),{'content-type':'application/pdf','x-upsert':'false'});
   assert.deepEqual(new Uint8Array(await(init!.body as Blob).arrayBuffer()),f.bytes);return new Response(null,{status:200});
  }});
  assert.equal(calls,1);assert.equal(result.confirmed_bytes,f.bytes.length);assert.deepEqual(result.completion_body,{actual_size_bytes:f.bytes.length,sha256:hash(f.bytes),start_processing:false});
  assert.doesNotMatch(JSON.stringify(result),/synthetic-signed-token|upload_url|x-signature|local_file_path|https:|token=|synthetic\.pdf/);
 }finally{await f.close();}
});

test('caller mutation after validation cannot replace the scoped PUT destination',async()=>{
 const f=await fixture(undefined,'specs');try{
  let calls=0;const result=transferLocalUpload(f.input,{allowedRoot:f.root,fetch:async(url)=>{calls++;assert.equal(new URL(String(url)).origin,API_ORIGIN);return new Response(null,{status:200});}});
  f.input.session.upload_url='https://evil.invalid?token=private';
  await result;assert.equal(calls,1);
 }finally{await f.close();}
});

test('foreign, redirecting, credential-bearing, wrong-bucket and wrong-asset PUT destinations fail closed',async()=>{
 const f=await fixture(undefined,'client_logo');try{
  for(const url of [f.input.session.upload_url.replace(API_ORIGIN,'https://evil.invalid'),f.input.session.upload_url.replace(asset,upload),
   f.input.session.upload_url.replace('eps-brand-assets','eps-specs-assets'),f.input.session.upload_url+'&other=private',
   f.input.session.upload_url.replace('https://','https://user:password@')]){
   let called=false;await assert.rejects(transferLocalUpload({...f.input,session:{...f.input.session,upload_url:url}},{allowedRoot:f.root,fetch:async()=>{called=true;throw Error();}}),ClientUploadError);assert.equal(called,false);
  }
  let calls=0;await assert.rejects(transferLocalUpload(f.input,{allowedRoot:f.root,fetch:async()=>{calls++;return new Response(null,{status:307,headers:{Location:'https://evil.invalid'}});}}),typed('CLIENT_UPLOAD_PROTOCOL_INVALID'));assert.equal(calls,1);
 }finally{await f.close();}
});

test('TUS lost PATCH acknowledgement resumes by actual HEAD offset with credential-free checkpoint',async()=>{
 const bytes=new Uint8Array(6291456+10),f=await fixture(bytes);try{
  let offset=0,lost=true,checkpoint:ResumeCheckpoint|undefined;const patches:number[]=[];
  const fetcher:typeof fetch=async(_url,init)=>{
   if(init?.method==='POST')return new Response(null,{status:201,headers:{Location:`/storage/v1/upload/resumable/sign/${f.resource}`}});
   if(init?.method==='HEAD')return new Response(null,{headers:{'Upload-Length':String(bytes.length),'Upload-Offset':String(offset)}});
   assert.equal(init?.method,'PATCH');patches.push(Number(new Headers(init?.headers).get('Upload-Offset')));offset+=(init.body as Blob).size;
   if(lost){lost=false;throw Error('private-network-token');}return new Response(null,{status:204,headers:{'Upload-Offset':String(offset)}});
  };
  await assert.rejects(transferLocalUpload(f.input,{allowedRoot:f.root,fetch:fetcher,onCheckpoint:v=>{checkpoint=v;}}),typed('CLIENT_UPLOAD_INTERRUPTED'));
  assert.ok(checkpoint);assert.equal(checkpoint.offset,0);assert.equal(checkpoint.resource_id,f.resource);assert.doesNotMatch(JSON.stringify(checkpoint),/signature|token|https:|\?/);
  const result=await transferLocalUpload({...f.input,resume:checkpoint},{allowedRoot:f.root,fetch:fetcher,onCheckpoint:v=>{checkpoint=v;}});
  assert.deepEqual(patches,[0,6291456]);assert.equal(result.confirmed_bytes,bytes.length);assert.equal(checkpoint.offset,bytes.length);
 }finally{await f.close();}
});

test('TUS checkpoint identity, path, query, size and hash cannot redirect or cross an asset',async()=>{
 const f=await fixture();try{
  const good={schema_version:'1.0',upload_id:upload,asset_id:asset,size_bytes:f.bytes.length,sha256:hash(f.bytes),resource_id:f.resource,offset:0};
  for(const resume of [{...good,upload_id:asset},{...good,resource_id:'https://evil.invalid?token=x'},
   {...good,resource_id:f.resource+'?token=x'},{...good,resource_id:identifier('eps-candidate-support','mp4')},
   {...good,size_bytes:5},{...good,sha256:'a'.repeat(64)},{...good,offset:99},{...good,authorization:'private'}]){
   let calls=0;await assert.rejects(transferLocalUpload({...f.input,resume},{allowedRoot:f.root,fetch:async()=>{calls++;throw Error();}}),ClientUploadError);assert.equal(calls,0);
  }
 }finally{await f.close();}
});

test('candidate-support images use the actual5MiB policy and transfer through their own TUS bucket',async()=>{
 const f=await fixture();try{
  const image=path.join(f.root,'support.png');await writeFile(image,f.bytes);
  const input={...f.input,local_file_path:image,purpose:'candidate_support',mime_type:'image/png',start_processing:false,
   session:{...f.input.session,maximum_bytes:5242880,upload_metadata:{bucketName:'eps-candidate-support',objectName:`assets/${asset}/original.png`,contentType:'image/png',cacheControl:'3600'}}};
  parseTransferInput(input);
  for(const bad of [{...input,session:{...input.session,maximum_bytes:20971520}},
   {...input,expected_size_bytes:6291456,session:{...input.session,maximum_bytes:20971520}}])assert.throws(()=>parseTransferInput(bad),ClientUploadError);
  const document={...input,local_file_path:path.join(f.root,'support.pdf'),mime_type:'application/pdf',session:{...input.session,maximum_bytes:20971520,
   upload_metadata:{...input.session.upload_metadata,objectName:`assets/${asset}/original.pdf`,contentType:'application/pdf'}}};
  parseTransferInput(document);
  const resource=identifier('eps-candidate-support','png');const methods:string[]=[];
  const result=await transferLocalUpload(input,{allowedRoot:f.root,onCheckpoint:()=>{},fetch:async(_url,init)=>{
   methods.push(init!.method!);return init?.method==='POST'?new Response(null,{status:201,headers:{Location:`/storage/v1/upload/resumable/sign/${resource}`}})
    :new Response(null,{status:204,headers:{'Upload-Offset':String(f.bytes.length)}});
  }});
  assert.deepEqual(methods,['POST','PATCH']);assert.equal(result.completion_body.start_processing,false);
 }finally{await f.close();}
});

test('outside-root, symlink/reparse and changed/hash-mismatched files never start transfer',async()=>{
 const f=await fixture(),other=await fixture();try{
  let calls=0;const fetcher:typeof fetch=async()=>{calls++;throw Error();};
  await assert.rejects(transferLocalUpload({...f.input,local_file_path:other.file},{allowedRoot:f.root,fetch:fetcher}),typed('CLIENT_UPLOAD_FILE_UNAVAILABLE'));
  await assert.rejects(transferLocalUpload({...f.input,expected_sha256:'a'.repeat(64)},{allowedRoot:f.root,fetch:fetcher}),typed('CLIENT_UPLOAD_HASH_MISMATCH'));
  const link=path.join(f.root,'linked.mp4');
  if(process.platform==='win32'){
   const junction=path.join(f.root,'junction');await symlink(other.root,junction,'junction');
   await assert.rejects(transferLocalUpload({...f.input,local_file_path:path.join(junction,path.basename(other.file))},{allowedRoot:f.root,fetch:fetcher}),typed('CLIENT_UPLOAD_FILE_UNAVAILABLE'));
  }else{await symlink(f.file,link);await assert.rejects(transferLocalUpload({...f.input,local_file_path:link},{allowedRoot:f.root,fetch:fetcher}),typed('CLIENT_UPLOAD_FILE_UNAVAILABLE'));}
  assert.equal(calls,0);
 }finally{await f.close();await other.close();}
});

test('file mutation during transfer returns a safe error and never completion metadata',async()=>{
 const f=await fixture(undefined,'specs');try{
  await assert.rejects(transferLocalUpload(f.input,{allowedRoot:f.root,fetch:async()=>{await writeFile(f.file,new Uint8Array([9,9,9,9]));return new Response(null,{status:200});}}),typed('CLIENT_UPLOAD_FILE_CHANGED'));
 }finally{await f.close();}
});

test('private stdin is bounded, rejects duplicate JSON fields and exposes only safe errors',async()=>{
 async function* chunks(text:string){yield Buffer.from(text);}
 for(const text of ['{"session":"private","session":"private"}', 'x'.repeat(65537), '{"token":'])await assert.rejects(readPrivateInput(chunks(text)),ClientUploadError);
 const f=await fixture();try{assert.deepEqual(await readPrivateInput(chunks(JSON.stringify(f.input))),f.input);}finally{await f.close();}
});

test('CLI invalid arguments refuse before stdin and actual executable emits only a safe envelope',async()=>{
 let consumed=false;async function* input(){consumed=true;yield Buffer.from('private-input-must-not-be-read');}
 const result=await runCli(['--token','private'],input());assert.equal(consumed,false);assert.deepEqual(result,{schema_version:'1.0',result:'failed',code:'CLIENT_UPLOAD_INPUT_INVALID'});
 const tty=Object.assign(input(),{isTTY:true});assert.deepEqual(await runCli(['--allowed-root',tmpdir()],tty),result);assert.equal(consumed,false);
 const child=spawnSync(process.execPath,['--import','tsx','tools/client-upload-transfer.mts'],{cwd:process.cwd(),encoding:'utf8',timeout:10000,windowsHide:true,input:'private-input-must-not-be-read'});
 assert.equal(child.status,1);assert.equal(child.stderr,'');assert.deepEqual(JSON.parse(child.stdout),result);
 assert.doesNotMatch(child.stdout,/private|token|https:|Error:|stack/);
});
