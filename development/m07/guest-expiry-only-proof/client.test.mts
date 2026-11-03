import assert from 'node:assert/strict';
import test,{type TestContext}from 'node:test';
import {mkdtemp,readFile,writeFile,realpath,rm}from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {presentationFixture,presentationVersionFixture}from '../../../tests/fixtures/presentation.ts';
import {beforeExpiry,afterExpiry,exportKey,parseInput,ExpiryError,SERIES,VERSION,LIVE_HTTP_ENABLED,type Ports}from './client.mts';
import {makeExpiryInbox}from './inbox.mts';
import {ORIGIN}from '../guest-summary-delta/probe.mts';

const ids=Array.from({length:8},(_,i)=>'70000000-0000-4000-8000-'+String(i+1).padStart(12,'0'));
const start=Date.parse('2026-11-03T10:00:00Z'),expiry=new Date(start+900000).toISOString();
const review=Buffer.alloc(32,17).toString('base64url'),session=Buffer.alloc(32,18).toString('base64url');
const input=()=>({schema_version:'1.0',run_id:ids[0],review_link_id:ids[1],review_url:ORIGIN+'/r/'+review,expires_at:expiry,no_revoke_before_expiry_probes:true});
const jsonHeaders={'Cache-Control':'private, no-store','Content-Type':'application/json','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};
function fixture(){
 let clock=start,polls=0,lose=false;const calls:Request[]=[],saved=new Map<string,unknown>(),savedBytes=new Map<string,Uint8Array>();
 const source=presentationFixture({frames:1}),slides=presentationVersionFixture(source).slides.map(s=>({...s,version_id:VERSION}));const candidate=slides.find(s=>s.kind==='candidate')!;candidate.video_asset_id=ids[4];
 const version={id:VERSION,series_id:SERIES,version_no:2,title:source.cover.title,output_type:'selection',status:'ready',slides,created_at:new Date(start).toISOString(),download_enabled:true,cover:source.cover,template_version:'1.1.0',template_content_hash:'a'.repeat(64)};
 const counts={preferred:0,maybe:0,not_preferred:0,comment_count:0,unresolved_count:0};
 const json=(data:unknown,status=200)=>Response.json({request_id:ids[7],data},{status,headers:jsonHeaders});
 const deny=()=>Response.json({request_id:ids[7],error:{code:'REVIEW_UNAVAILABLE',message:'PRIVATE_PROVIDER_CANARY',details:{url:'PRIVATE_CAPABILITY_CANARY'},retryable:false}},{status:404,headers:jsonHeaders});
 const exported=()=>({id:ids[2],version_id:VERSION,review_link_id:ids[1],template_version:'1.1.0',export_revision:1,status:polls>=2?'ready':'queued',pdf_asset_id:polls>=2?ids[5]:null,job_id:ids[3],created_at:new Date(start).toISOString(),ready_at:polls>=2?new Date(start+1000).toISOString():null,failure_code:null});
 const fetcher:typeof fetch=async(url,init)=>{
  const r=new Request(url,init);calls.push(r);const u=new URL(r.url),p=u.pathname;
  assert.equal(u.origin,ORIGIN);assert.equal(r.credentials,'omit');assert.equal(r.redirect,'error');assert(!r.headers.has('Authorization')&&!r.headers.has('Cookie'));
  if(p.startsWith('/r/'))return new Response('<html>Public shell PRIVATE_PAGE_CANARY</html>',{headers:{'Content-Type':'text/html'}});
  if(clock>=Date.parse(expiry))return deny();
  if(p.endsWith('/open'))return json({access_token:session,expires_at:expiry,series_id:SERIES,version_id:VERSION,download_enabled:true,display_name:null,guest_session_id:ids[6]});
  assert.equal(r.headers.get('X-Review-Session'),session);
  if(p.endsWith('/session'))return json({expires_at:expiry,series_id:SERIES,version_id:VERSION,download_enabled:true,display_name:null,guest_session_id:ids[6]});
  if(p.endsWith('/presentation')||p===`/api/v1/review/versions/${VERSION}`)return json(version);
  if(p.endsWith('/summary'))return json({version_id:VERSION,totals:counts,per_slide:slides.map(s=>({version_slide_id:s.id,...counts}))});
  if(p.endsWith('/feedback'))return json({version_id:VERSION,comments:[],preferences:[],page:{next_cursor:null}});
  if(p.endsWith('/pdf-exports')){assert.equal(r.method,'POST');assert.equal(r.headers.get('Idempotency-Key'),exportKey(ids[0]));if(lose)throw Error(review);return json({export:exported(),job_id:ids[3],cached:false},202);}
  if(p===`/api/v1/review/pdf-exports/${ids[2]}`){polls++;return json(exported());}
  if(p.includes('/pdf-exports/')&&p.endsWith('/content')){const b=Buffer.from('%PDF-1.7\nSynthetic offline bytes\n%%EOF\n');return new Response(b,{headers:{...jsonHeaders,'Content-Type':'application/pdf','Content-Length':String(b.length)}});}
  if(p.includes('/media/')&&p.endsWith('/content')){assert.equal(r.headers.get('Range'),'bytes=0-1023');return new Response(Buffer.alloc(16,2),{status:206,headers:{...jsonHeaders,'Content-Type':'video/mp4','Content-Length':'16','Content-Range':'bytes 0-15/16'}});}
  throw Error('UNEXPECTED_FAKE_ROUTE');
 };
 const ports:Ports={fetch:fetcher,now:()=>clock,sleep:async ms=>{clock+=ms;},save:async(name,v)=>{assert(!saved.has(name));saved.set(name,structuredClone(v));},saveBytes:async(name,bytes)=>{assert(!savedBytes.has(name));savedBytes.set(name,new Uint8Array(bytes));}};
 return{ports,calls,saved,savedBytes,fetcher,now:()=>clock,sleep:ports.sleep,expire:()=>{clock=Date.parse(expiry)+2001;},lose:()=>{lose=true;}};
}

test('one open/export job request, bounded polls and private PDF/range bytes precede expiry-only denials',async()=>{
 const f=fixture(),before=await beforeExpiry(input(),f.ports);assert.equal(before.evidence.export_prepare_posts,1);assert.equal(before.evidence.polls,2);assert.equal(before.evidence.pdf.full_pdf_bytes_verified,true);assert.equal(before.evidence.original_media.full_original_file_hash_verified,false);
 assert(f.saved.has('opened-state.json')&&f.saved.has('before-state.json')&&f.saved.has('export-dispatched.json'));assert(f.savedBytes.has('guest.pdf')&&f.savedBytes.has('original-video-prefix.bin'));
 const publicText=JSON.stringify(before.evidence);for(const secret of[review,session,'PRIVATE_PAGE_CANARY',sourceText(f.saved)])assert(!publicText.includes(secret));
 f.expire();const after=await afterExpiry(before.state,{...f.ports,save:async()=>{},saveBytes:async()=>{}});
 assert.equal(after.deadline_elapsed,true);assert.equal(after.page.status,200);assert.equal(after.page.guest_authorization_proven,false);assert.equal(Object.keys(after.denials).length,11);assert.equal(after.browser_visible_unavailable_UI_verified,false);
 for(const r of f.calls.filter(r=>r.method!=='GET'))assert(r.url.endsWith('/open')||r.url.endsWith('/pdf-exports'));
 assert.equal(f.calls.filter(r=>r.method==='POST'&&r.url.endsWith('/pdf-exports')).length,1);
 assert(!JSON.stringify(after).includes('PRIVATE_PROVIDER_CANARY')&&!JSON.stringify(after).includes('PRIVATE_CAPABILITY_CANARY'));
});
function sourceText(saved:Map<string,unknown>){return (saved.get('opened-state.json')as{input:{review_url:string}}).input.review_url;}
test('unknown prepare return stops after one same-key POST and preserves private session/key',async()=>{
 const f=fixture();f.lose();await assert.rejects(beforeExpiry(input(),f.ports),ExpiryError);
 assert(f.saved.has('opened-state.json')&&f.saved.has('export-dispatched.json'));assert.equal(f.calls.filter(r=>r.method==='POST'&&r.url.endsWith('/pdf-exports')).length,1);assert(!f.saved.has('before-state.json'));
});
test('default-off real entry, malformed host and early after-expiry phase refuse without HTTP',async()=>{
 assert.equal(LIVE_HTTP_ENABLED,false);await assert.rejects(beforeExpiry(input(),{save:async()=>{},saveBytes:async()=>{}}),ExpiryError);
 assert.throws(()=>parseInput({...input(),review_url:'https://other.invalid/r/'+review}));
 const f=fixture(),before=await beforeExpiry(input(),f.ports),count=f.calls.length;await assert.rejects(afterExpiry(before.state,f.ports),ExpiryError);assert.equal(f.calls.length,count);
});
test('response custody failure stops before another mutation and has no secret error output',async()=>{
 const f=fixture();const original=f.ports.saveBytes;f.ports.saveBytes=async(name,bytes)=>{if(name==='response-002.bin')throw Error(review);await original(name,bytes);};
 await assert.rejects(beforeExpiry(input(),f.ports),e=>e instanceof ExpiryError&&e.message==='GUEST_EXPIRY_PROOF_UNCONFIRMED');assert.equal(f.calls.filter(r=>r.url.endsWith('/pdf-exports')).length,0);
});
test('wrong saved version, excessive range body and explicit revoked code cannot pass this expiry scope',async()=>{
 const wrong=fixture(),fetcher:typeof fetch=async(url,init)=>{const r=await wrong.fetcher(url,init);if(new URL(String(url)).pathname.endsWith('/presentation')){const body=await r.json()as{data:{id:string}};body.data.id=ids[0];return Response.json(body,{headers:jsonHeaders});}return r;};
 await assert.rejects(beforeExpiry(input(),{...wrong.ports,fetch:fetcher}),ExpiryError);assert.equal(wrong.calls.filter(r=>r.method==='POST'&&r.url.endsWith('/pdf-exports')).length,0);
 const large=fixture(),oversized:typeof fetch=async(url,init)=>{const r=await large.fetcher(url,init);return new URL(String(url)).pathname.includes('/media/')?new Response(Buffer.alloc(2000,3),{status:206,headers:{...jsonHeaders,'Content-Type':'video/mp4','Content-Length':'16','Content-Range':'bytes 0-15/16'}}):r;};
 await assert.rejects(beforeExpiry(input(),{...large.ports,fetch:oversized}),ExpiryError);assert(!large.savedBytes.has('original-video-prefix.bin')&&!large.saved.has('before-state.json'));
 const revoked=fixture(),before=await beforeExpiry(input(),revoked.ports);revoked.expire();
 const explicit:typeof fetch=async(url,init)=>{const r=await revoked.fetcher(url,init);if(!new URL(String(url)).pathname.startsWith('/r/')){const body=await r.json()as{error:{code:string}};body.error.code='REVIEW_LINK_REVOKED';return Response.json(body,{status:404,headers:jsonHeaders});}return r;};
 await assert.rejects(afterExpiry(before.state,{...revoked.ports,fetch:explicit,save:async()=>{},saveBytes:async()=>{}}),ExpiryError);
});
async function temporary(t:TestContext){const root=await mkdtemp(path.join(os.tmpdir(),'eps-expiry-only-'));t.after(async()=>{assert.equal(await realpath(root),root);assert.equal(path.dirname(root),path.resolve(os.tmpdir()));assert.match(path.basename(root),/^eps-expiry-only-[a-zA-Z0-9]{6}$/u);await rm(root,{recursive:true});});return root;}
test('new protected-family once claims prevent POST replay after unknown result; private files stay private',async t=>{
 const root=await temporary(t),f=fixture(),security={protect:async()=>{},verify:async()=>{}},tool=makeExpiryInbox({workspaceRoot:root,security,fetch:f.fetcher,now:f.now,sleep:f.sleep});
 const p=await tool.prepare();await writeFile(p.input_file,JSON.stringify({...input(),run_id:p.run_id}));f.lose();
 // The fake's expected stable key follows the newly prepared public run ID.
 let posts=0;const fetcher:typeof fetch=async(url,init)=>{if(String(url).endsWith('/pdf-exports')){posts++;assert.equal(new Headers(init?.headers).get('Idempotency-Key'),exportKey(p.run_id));throw Error(review);}return f.fetcher(url,init);};
 const live=makeExpiryInbox({workspaceRoot:root,security,fetch:fetcher,now:f.now,sleep:f.sleep}),request={run_id:p.run_id,manifest_sha256:p.manifest_sha256};
 const unknown=await live.before(request);assert.equal(unknown.result,'unconfirmed');assert.equal(posts,1);const count=f.calls.length;await assert.rejects(live.before(request));assert.equal(f.calls.length,count);assert.equal(posts,1);
 const claim=await readFile(path.join(path.dirname(p.input_file),'before-dispatched.json'),'utf8');assert(!claim.includes(review)&&!claim.includes(session));
 const receipt=await readFile(path.join(root,unknown.receipt_file!),'utf8');assert(!receipt.includes(review)&&!receipt.includes(session));
});
