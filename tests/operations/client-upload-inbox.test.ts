import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp,writeFile,readFile,readdir,rm,symlink,link,realpath,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {makeUploadInbox,ClientInboxError,windowsInboxSecurity,type Preparation,type InboxSecurity} from '../../tools/client-upload-inbox.mts';
const upload='10000000-0000-4000-8000-000000000001',asset='20000000-0000-4000-8000-000000000001';
const version='30000000-0000-4000-8000-000000000001';
const sha=(v:Uint8Array|string)=>createHash('sha256').update(v).digest('hex');
const typed=(code:string)=>(e:unknown)=>e instanceof ClientInboxError&&e.code===code;
async function fixture(purpose:'candidate_video'|'specs'='candidate_video',fetcher:typeof fetch=async()=>new Response(null,{status:200})){
 const root=await mkdtemp(path.join(tmpdir(),'eps-client-inbox-')),source=path.join(root,'source'),workspace=path.join(root,'workspace');
 const{mkdir}=await import('node:fs/promises');await mkdir(source);await mkdir(workspace);const bytes=new Uint8Array([1,2,3,4]),file=path.join(source,purpose==='specs'?'synthetic.pdf':'synthetic.mp4');await writeFile(file,bytes);
 const events:string[]=[];const security:InboxSecurity={async protect(dir){events.push('protect');assert.deepEqual(await readdir(dir),[]);},async verify(target,kind){events.push('verify:'+kind+':'+path.basename(target));}};
 let now=Date.now();const tool=makeUploadInbox({workspaceRoot:workspace,security,fetch:fetcher,now:()=>now});
 const input:Preparation={schema_version:'1.0',allowed_root:source,local_file_path:file,purpose,mime_type:purpose==='specs'?'application/pdf':'video/mp4',expected_size_bytes:bytes.length,expected_sha256:sha(bytes),start_processing:purpose==='candidate_video',resume_from:null,expected_upload_id:null,expected_asset_id:null};
 return{root,workspace,source,file,bytes,input,tool,events,advance(ms:number){now+=ms;},async close(){assert.equal(await realpath(root),root);assert.equal(path.dirname(root),tmpdir());assert(path.basename(root).startsWith('eps-client-inbox-'));await rm(root,{recursive:true,force:true});}};
}
function session(purpose='candidate_video'){
 const tus=purpose==='candidate_video',ext=tus?'mp4':'pdf',bucket=tus?'eps-candidate-assets':'eps-specs-assets',mime=tus?'video/mp4':'application/pdf';
 return{id:upload,asset_id:asset,protocol:tus?'tus':'signed_put',upload_url:tus?'https://pyibofyctwnqpvktepse.storage.supabase.co/storage/v1/upload/resumable/sign':`https://pyibofyctwnqpvktepse.supabase.co/storage/v1/object/upload/sign/${bucket}/assets/${asset}/original.${ext}?token=synthetic-token`,upload_headers:tus?{'x-signature':'synthetic-signature','x-upsert':'false'}:{'Content-Type':mime,'x-upsert':'false'},expires_at:'2099-01-01T00:00:00Z',status:'open',maximum_bytes:tus?268435456:20971520,...(tus?{upload_metadata:{bucketName:bucket,objectName:`assets/${asset}/original.${ext}`,contentType:mime,cacheControl:'3600'},chunk_size:6291456}:{})};
}
async function handoff(f:Awaited<ReturnType<typeof fixture>>,prepared:Awaited<ReturnType<typeof f.tool.prepare>>,patch:Record<string,unknown>={}){
 const envelope={schema_version:'1.0',handoff_id:prepared.handoff_id,nonce:prepared.nonce,manifest_sha256:prepared.manifest_sha256,expected_upload_id:upload,expected_asset_id:asset,session:session(f.input.purpose),...patch};
 await writeFile(prepared.handoff_file,JSON.stringify(envelope),{flag:'wx'});return envelope;
}
const request=(p:{handoff_id:string;manifest_sha256:string})=>({handoff_id:p.handoff_id,manifest_sha256:p.manifest_sha256,expected_upload_id:upload,expected_asset_id:asset});
test('prepare protects fresh inbox before metadata and binds explicit source; session file stays absent',async()=>{
 const f=await fixture();try{const p=await f.tool.prepare(f.input);assert.equal(f.events[0],'protect');assert.equal(p.result,'prepared');assert.match(p.nonce,/^[A-Za-z0-9_-]{43}$/u);assert.match(p.manifest_sha256,/^[a-f0-9]{64}$/u);assert(!(await readdir(path.dirname(p.handoff_file))).includes('handoff.json'));const m=JSON.parse(await readFile(p.manifest_file,'utf8'));assert.equal(m.preparation.expected_sha256,f.input.expected_sha256);assert.equal(m.preparation.local_file_path,f.file);assert(!JSON.stringify(p).includes('synthetic-signature'));}finally{await f.close();}
});
test('signed PUT private file consumed once; safe output and durable claim contain no capabilities',async()=>{
 let calls=0;const f=await fixture('specs',async(_url,init)=>{calls++;assert.equal(init?.redirect,'error');return new Response(null,{status:200});});try{const p=await f.tool.prepare(f.input);await handoff(f,p);const result=await f.tool.transfer(request(p));assert.equal(result.result,'transferred');assert.equal(calls,1);const files=await readdir(path.dirname(p.handoff_file));assert(!files.includes('handoff.json'));const claim=await readFile(path.join(path.dirname(p.handoff_file),'transfer-claim.json'),'utf8');assert(!/synthetic-token|upload_url|upload_headers/u.test(claim+JSON.stringify(result)));await assert.rejects(f.tool.transfer(request(p)));assert.equal(calls,1);}finally{await f.close();}
});
test('nonce, manifest CLI hash, identity, extra/duplicate fields reject before fetch',async()=>{
 for(const patch of [{nonce:'wrong'},{handoff_id:upload},{expected_asset_id:upload},{extra:'synthetic-secret'}]){let calls=0;const f=await fixture('specs',async()=>{calls++;return new Response();});try{const p=await f.tool.prepare(f.input);await handoff(f,p,patch);await assert.rejects(f.tool.transfer(request(p)));assert.equal(calls,0);}finally{await f.close();}}
 const f=await fixture('specs');try{const p=await f.tool.prepare(f.input);await handoff(f,p);await assert.rejects(f.tool.transfer({...request(p),manifest_sha256:'0'.repeat(64)}),typed('CLIENT_INBOX_BINDING_INVALID'));}finally{await f.close();}
});
test('expired inbox and changed source refuse without any network',async()=>{
 for(const change of ['expiry','source']){let calls=0;const f=await fixture('specs',async()=>{calls++;return new Response();});try{const p=await f.tool.prepare(f.input);await handoff(f,p);if(change==='expiry')f.advance(16*60*1000);else await writeFile(f.file,new Uint8Array([4,3,2,1]));await assert.rejects(f.tool.transfer(request(p)));assert.equal(calls,0);}finally{await f.close();}}
});
test('TUS persists safe checkpoints synchronously and fresh inbox resumes via authoritative HEAD',async()=>{
 let phase='first',post=0,patch=0,head=0;const resource=Buffer.from(`eps-candidate-assets/assets/${asset}/original.mp4/${version}`).toString('base64url');
 const f=await fixture('candidate_video',async(_url,init)=>{if(init?.method==='POST'){post++;return new Response(null,{status:201,headers:{Location:`/storage/v1/upload/resumable/sign/${resource}`,'Tus-Resumable':'1.0.0'}});}if(init?.method==='HEAD'){head++;return new Response(null,{status:200,headers:{'Upload-Offset':phase==='first'?'0':'4','Upload-Length':'4','Tus-Resumable':'1.0.0'}});}if(init?.method==='PATCH'){patch++;throw Error('synthetic-secret-network');}throw Error();});
 try{const first=await f.tool.prepare(f.input);await handoff(f,first);await assert.rejects(f.tool.transfer(request(first)));const names=await readdir(path.dirname(first.handoff_file));assert(names.some(n=>/^checkpoint-\d{6}\.json$/u.test(n)));phase='resume';f.advance(16*60*1000);const next=await f.tool.prepare({...f.input,resume_from:first.handoff_id,expected_upload_id:upload,expected_asset_id:asset});assert.notEqual(next.handoff_id,first.handoff_id);await handoff(f,next);const result=await f.tool.transfer(request(next));assert.equal(result.confirmed_bytes,4);assert.equal(post,1);assert.equal(head,1);assert.equal(patch,1);const cp=JSON.parse(await readFile(path.join(path.dirname(first.handoff_file),names.find(n=>n.startsWith('checkpoint-'))!),'utf8'));assert(!JSON.stringify(cp).includes('signature')&&!JSON.stringify(cp).includes('http'));}finally{await f.close();}
});
test('resume requires old claimed TUS checkpoint with identical reservation and source',async()=>{
 const f=await fixture();try{const first=await f.tool.prepare(f.input);await assert.rejects(f.tool.prepare({...f.input,resume_from:first.handoff_id,expected_upload_id:upload,expected_asset_id:asset}));await assert.rejects(f.tool.prepare({...f.input,resume_from:first.handoff_id,expected_upload_id:asset,expected_asset_id:upload}));}finally{await f.close();}
 const put=await fixture('specs');try{const first=await put.tool.prepare(put.input);await assert.rejects(put.tool.prepare({...put.input,resume_from:first.handoff_id,expected_upload_id:upload,expected_asset_id:asset}));}finally{await put.close();}
});
test('unknown exception and capability values never enter CLI failure output',async()=>{const{safeInboxError}=await import('../../tools/client-upload-inbox.mts');const result=safeInboxError(Error('synthetic-token https://private.invalid?token=secret'));assert.deepEqual(result,{schema_version:'1.0',result:'failed',code:'CLIENT_INBOX_UNCONFIRMED'});});
test('hardlinked and redirected inbox files are refused before transfer',async()=>{
 const f=await fixture('specs');try{const p=await f.tool.prepare(f.input);await handoff(f,p);await link(p.handoff_file,path.join(f.root,'other-link.json'));await assert.rejects(f.tool.transfer(request(p)));}finally{await f.close();}
 const g=await fixture('specs');try{const p=await g.tool.prepare(g.input);const outside=path.join(g.root,'outside-inbox');await rename(path.dirname(p.handoff_file),outside);await symlink(outside,path.dirname(p.handoff_file),'junction');await assert.rejects(g.tool.transfer(request(p)));}finally{await g.close();}
});
test('actual Windows security adapter protects and verifies only a synthetic owned directory/file',async()=>{
 if(process.platform!=='win32')return;const root=await mkdtemp(path.join(tmpdir(),'eps-inbox-acl-'));try{const sec=windowsInboxSecurity();await sec.protect(root);await sec.verify(root,'directory');const file=path.join(root,'synthetic.json');await writeFile(file,'{}',{flag:'wx'});await sec.verify(file,'file');}finally{assert.equal(path.dirname(root),tmpdir());assert(path.basename(root).startsWith('eps-inbox-acl-'));await rm(root,{recursive:true,force:true});}
});

test('duplicate JSON and manifest/helper tampering fail before HTTP with safe errors',async()=>{
 for(const change of ['duplicate','manifest','helper']){let calls=0;const f=await fixture('specs',async()=>{calls++;return new Response();});try{const p=await f.tool.prepare(f.input),envelope=await handoff(f,p);let req=request(p);
  if(change==='duplicate')await writeFile(p.handoff_file,JSON.stringify(envelope).slice(0,-1)+',"nonce":"'+p.nonce+'"}');
  else{const m=JSON.parse(await readFile(p.manifest_file,'utf8'));if(change==='manifest')m.preparation.expected_sha256='0'.repeat(64);else m.helper_sha256='0'.repeat(64);const raw=JSON.stringify(m);await writeFile(p.manifest_file,raw);if(change==='helper')req={...req,manifest_sha256:sha(raw)};}
  await assert.rejects(f.tool.transfer(req),(e:unknown)=>e instanceof ClientInboxError&&!e.message.includes('synthetic-token'));assert.equal(calls,0);
 }finally{await f.close();}}
});
test('checkpoint durability failure aborts before PATCH and claim prevents dispatch replay',async()=>{
 let calls=0,patches=0;const resource=Buffer.from(`eps-candidate-assets/assets/${asset}/original.mp4/${version}`).toString('base64url');const f=await fixture('candidate_video',async(_url,init)=>{calls++;if(init?.method==='POST')return new Response(null,{status:201,headers:{Location:`/storage/v1/upload/resumable/sign/${resource}`,'Tus-Resumable':'1.0.0'}});patches++;throw Error('synthetic-secret');});try{const p=await f.tool.prepare(f.input);await handoff(f,p);const{mkdir}=await import('node:fs/promises');await mkdir(path.join(path.dirname(p.handoff_file),'checkpoint-000001.json'));await assert.rejects(f.tool.transfer(request(p)));assert.equal(calls,1);assert.equal(patches,0);await assert.rejects(f.tool.transfer(request(p)));assert.equal(calls,1);}finally{await f.close();}
});
test('resume validates resource binding and unchanged source before fresh inbox allocation',async()=>{
 const resource=Buffer.from(`eps-candidate-assets/assets/${asset}/original.mp4/${version}`).toString('base64url');const f=await fixture('candidate_video',async(_url,init)=>{if(init?.method==='POST')return new Response(null,{status:201,headers:{Location:`/storage/v1/upload/resumable/sign/${resource}`,'Tus-Resumable':'1.0.0'}});throw Error('synthetic-network');});try{const first=await f.tool.prepare(f.input);await handoff(f,first);await assert.rejects(f.tool.transfer(request(first)));const directory=path.dirname(first.handoff_file),file=path.join(directory,'checkpoint-000001.json'),cp=JSON.parse(await readFile(file,'utf8'));cp.resource_id=Buffer.from(`eps-candidate-assets/assets/${upload}/original.mp4/${version}`).toString('base64url');await writeFile(file,JSON.stringify(cp));const before=await readdir(path.dirname(directory));await assert.rejects(f.tool.prepare({...f.input,resume_from:first.handoff_id,expected_upload_id:upload,expected_asset_id:asset}));assert.deepEqual(await readdir(path.dirname(directory)),before);}finally{await f.close();}
});
test('CLI rejects credential-bearing arguments and arbitrary workspace overrides without using them',async()=>{const{runInboxCli}=await import('../../tools/client-upload-inbox.mts');for(const args of [[],['transfer','--token','synthetic-token'],['prepare','--workspace-root','C:\\private'],['transfer','--handoff-id','bad','--manifest-sha','secret','--upload-id',upload,'--asset-id',asset]]){const result=await runInboxCli(args);assert.equal(result.result,'failed');assert(!JSON.stringify(result).includes('synthetic-token')&&!JSON.stringify(result).includes('C:\\private'));}});
