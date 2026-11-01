import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { mkdtemp, writeFile, readFile, lstat, realpath, rm, readdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { confirmGuest, openGuest, parseInput, LABEL, commentKey, commentBody, LIVE_WRITES_ENABLED } from './writer.mts';
import { GuestDeltaError, ORIGIN } from '../guest-summary-delta/probe.mts';
import { makeGuestWriteInbox } from './inbox.mts';

export const ids=Array.from({length:10},(_,i)=>`10000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`);
export const now=Date.parse('2026-11-02T00:00:00Z'),expiry=new Date(now+120000).toISOString();
export const reviewToken=Buffer.alloc(32,7).toString('base64url'),sessionToken=Buffer.alloc(32,8).toString('base64url');
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
export function summary(count=1){const counts={preferred:0,maybe:0,not_preferred:0,comment_count:count,unresolved_count:count};return{version_id:ids[0],per_slide:[{version_slide_id:ids[1],...counts}],totals:counts};}
export function input(runId=ids[2]){return{run_id:runId,review_link_id:ids[3],series_id:ids[4],version_id:ids[0],version_slide_id:ids[1],internal_comment_id:ids[5],link_expires_at:expiry,review_token:reviewToken,expected_guest_before:summary(),producer_before:summary(2)};}
export function mock(){
 const calls:Request[]=[],keys=new Map<string,unknown>();let named=false,lost=false,loseNext=false,created=0,denying=false;
 const base={series_id:ids[4],version_id:ids[0],version_slide_id:ids[1],guest_session_id:ids[6],author_display_name:LABEL,company:null,visibility:'external',parent_comment_id:null,resolved:false,row_version:1,created_at:new Date(now).toISOString(),updated_at:new Date(now).toISOString()};
 const old={...base,id:ids[7],guest_session_id:null,author_display_name:'Previous guest',body:'Synthetic existing feedback.'};
 const json=(data:unknown,status=200)=>Response.json({request_id:ids[9],data},{status,headers});
 const reject=()=>Response.json({request_id:ids[9],error:{code:'REVIEW_ACCESS_DENIED',message:'private untrusted diagnostics',details:{},retryable:false}},{status:401,headers});
 const fetcher=async(url:RequestInfo|URL,init?:RequestInit)=>{const request=new Request(url,init);calls.push(request);const path=new URL(request.url).pathname;
  if(denying)return reject();
  if(path==='/api/v1/review/open')return json({access_token:sessionToken,expires_at:expiry,series_id:ids[4],version_id:ids[0],download_enabled:false,display_name:null,guest_session_id:ids[6]});
  if(request.headers.get('x-review-session')!==sessionToken)return reject();
  if(path==='/api/v1/review/identity'){named=true;return json({access_token:sessionToken,expires_at:expiry,series_id:ids[4],version_id:ids[0],download_enabled:false,display_name:LABEL,guest_session_id:ids[6]});}
  if(path.endsWith('/comments')){assert(named);const body=await request.json() as{body:string};const key=request.headers.get('idempotency-key')!;if(!keys.has(key)){created++;keys.set(key,{...base,id:ids[8],body:body.body});}if(loseNext&&!lost){lost=true;throw Error(reviewToken);}return json(keys.get(key),201);}
  if(path.endsWith('/summary'))return json(summary(created+1));
  if(path.endsWith('/feedback'))return json({version_id:ids[0],comments:[old,...keys.values()],preferences:[],page:{next_cursor:null}});
  const slide={version_id:ids[0],assignment_id:null,candidate_id:null,role_label:null,role_category:null,slot_label:null,position:null,fields:null,requirements:null,frame_asset_ids:[],video_asset_id:null,logo_asset_id:null};
  const requirements={age_range:null,gender_requirement:null,appearance_performance:null,languages:[],accents:[],skills:[],scene_references:[],shoot_dates:[],location:null,availability_requirements:null,other_instructions:null};
  return json({id:ids[0],series_id:ids[4],version_no:1,title:'Synthetic version',output_type:'selection',status:'ready',slides:[{...slide,id:ids[9],order:0,kind:'cover'},{...slide,id:ids[1],order:1,kind:'pending',role_label:'Synthetic role',slot_label:'Synthetic slot',requirements}],created_at:new Date(now).toISOString(),download_enabled:false,cover:{project_name:'Synthetic project',client_name:null,title:'Synthetic version',output_type:'selection',logo_asset_id:null,logo_placement:'cover'},template_version:'synthetic',template_content_hash:'a'.repeat(64)});
 };
 return{fetcher,calls,created:()=>created,lose:()=>{loseNext=true;},deny:()=>{denying=true;},keys};
}

test('one real-shaped named anonymous post and exact replay preserve prior feedback and private note filtering',async()=>{
 const server=mock(),state=await openGuest(input(),{fetch:server.fetcher,now:()=>now});assert.equal(server.created(),0);
 const result=await confirmGuest(state,{fetch:server.fetcher,now:()=>now+1000});assert.equal(result.result,'passed');assert.equal(server.created(),1);assert.equal(result.summary_after.totals.comment_count,2);assert.equal(result.existing_feedback_preserved,true);
 const posts=server.calls.filter(r=>r.method==='POST'&&r.url.endsWith('/comments'));assert.equal(posts.length,2);assert(posts.every(r=>r.headers.get('idempotency-key')===commentKey(ids[2])));
 for(const call of server.calls){assert.equal(new URL(call.url).origin,ORIGIN);assert.equal(call.credentials,'omit');assert.equal(call.redirect,'error');assert(!call.headers.has('authorization')&&!call.headers.has('cookie'));assert(!call.url.includes(reviewToken)&&!call.url.includes(sessionToken));}
 const publicText=JSON.stringify(result);for(const raw of[reviewToken,sessionToken,commentBody(ids[2]),LABEL,'private untrusted diagnostics','Synthetic existing feedback.'])assert(!publicText.includes(raw));
});

test('accepted response lost stops once; explicit same-state confirmation reuses body/key and creates one comment',async()=>{
 const server=mock(),state=await openGuest(input(),{fetch:server.fetcher,now:()=>now});server.lose();
 await assert.rejects(confirmGuest(state,{fetch:server.fetcher,now:()=>now+1000}),GuestDeltaError);assert.equal(server.created(),1);assert.equal(server.calls.filter(r=>r.url.endsWith('/comments')).length,1);
 const reloaded=JSON.parse(JSON.stringify(state));const result=await confirmGuest(reloaded,{fetch:server.fetcher,now:()=>now+2000});assert.equal(result.one_comment_after_same_key_replay,true);assert.equal(server.created(),1);assert.equal(server.calls.filter(r=>r.url.endsWith('/comments')).length,3);
});

test('disabled real transport, malformed input, wrong internal count and expired state refuse before HTTP',async()=>{
 assert.equal(LIVE_WRITES_ENABLED,false);await assert.rejects(openGuest(input()),GuestDeltaError);
 for(const bad of[{...input(),extra:'private'},{...input(),review_token:reviewToken+'='},{...input(),producer_before:summary()},{...input(),version_id:ids[9]}])assert.throws(()=>parseInput(bad));
 const server=mock(),state=await openGuest(input(),{fetch:server.fetcher,now:()=>now});const count=server.calls.length;
 await assert.rejects(confirmGuest(state,{fetch:server.fetcher,now:()=>now+120001}),GuestDeltaError);assert.equal(server.calls.length,count);
});

test('internal-note disclosure, missing privacy headers, over-limit and duplicate-key JSON fail safely',async()=>{
 for(const kind of['internal','headers','oversize','duplicate']){const server=mock();const fetcher=async(url:RequestInfo|URL,init?:RequestInit)=>{if(String(url).includes('/feedback?')){if(kind==='internal'){const ordinary=await server.fetcher(url,init),body=await ordinary.json() as{data:{comments:{id:string}[]}};body.data.comments[0].id=ids[5];return Response.json(body,{headers});}if(kind==='headers')return Response.json({request_id:ids[9],data:{}});if(kind==='oversize')return new Response('x'.repeat(65537),{headers});return new Response(`{"request_id":"${ids[9]}","request_id":"${ids[9]}","data":{}}`,{headers});}return server.fetcher(url,init);};await assert.rejects(openGuest(input(),{fetch:fetcher,now:()=>now}),GuestDeltaError);assert.equal(server.created(),0);}
});

test('complete external feedback follows an empty first page and preserves records from later pages',async()=>{
 const server=mock();let later=0;
 const fetcher=async(url:RequestInfo|URL,init?:RequestInit)=>{const parsed=new URL(String(url));if(parsed.pathname.endsWith('/feedback')){if(!parsed.searchParams.has('cursor'))return Response.json({request_id:ids[9],data:{version_id:ids[0],comments:[],preferences:[],page:{next_cursor:'synthetic-second-page'}}},{headers});later++;}return server.fetcher(url,init);};
 const state=await openGuest(input(),{fetch:fetcher,now:()=>now});assert.equal(state.feedback_before.comments.length,1);const result=await confirmGuest(state,{fetch:fetcher,now:()=>now+1000});assert.equal(result.existing_feedback_preserved,true);assert.equal(later,2);assert.equal(server.created(),1);
});

async function temporary(t:TestContext){const root=await mkdtemp(path.join(os.tmpdir(),'eps-completion-guest-'));t.after(async()=>{assert.equal(path.dirname(root),path.resolve(os.tmpdir()));assert.match(path.basename(root),/^eps-completion-guest-[A-Za-z0-9]{6}$/u);assert.equal(await realpath(root),root);assert.equal((await lstat(root)).isSymbolicLink(),false);await rm(root,{recursive:true});});return root;}
const security={async protect(){},async verify(){}};
async function setup(t:TestContext){const root=await temporary(t),server=mock(),tool=makeGuestWriteInbox({workspaceRoot:root,security,fetch:server.fetcher,now:()=>now+1000}),prepared=await tool.prepare({version_id:ids[0],version_slide_id:ids[1],internal_comment_id:ids[5]});const handoff={schema_version:'1.0',run_id:prepared.run_id,nonce:prepared.nonce,manifest_sha256:prepared.manifest_sha256,guest:input(prepared.run_id)};const request={run_id:prepared.run_id,manifest_sha256:prepared.manifest_sha256};return{root,server,tool,prepared,handoff,request};}

test('new-purpose inbox persists session before first write; lost response resumes explicitly with same keys and exact cleanup',async t=>{
 const s=await setup(t);assert.equal(s.server.calls.length,0);await writeFile(s.prepared.handoff_file,JSON.stringify(s.handoff));await s.tool.open(s.request);await assert.rejects(lstat(s.prepared.handoff_file));const sessionFile=path.join(path.dirname(s.prepared.handoff_file),'session.json');assert((await readFile(sessionFile,'utf8')).includes(sessionToken));assert.equal(s.server.created(),0);
 s.server.lose();await assert.rejects(s.tool.confirm(s.request),GuestDeltaError);assert.equal(s.server.created(),1);const result=await s.tool.resume(s.request);assert.equal(result.result,'passed');assert.equal(s.server.created(),1);const count=s.server.calls.length;await assert.rejects(s.tool.confirm(s.request),GuestDeltaError);await assert.rejects(s.tool.resume(s.request),GuestDeltaError);assert.equal(s.server.calls.length,count);
 const publicText=await readFile(result.receipt_file,'utf8');for(const raw of[reviewToken,sessionToken,LABEL,commentBody(s.prepared.run_id),'Synthetic existing feedback.'])assert(!publicText.includes(raw));
 await assert.rejects(s.tool.deny({...s.request,reason:'expired'}),GuestDeltaError);assert.equal(s.server.calls.length,count);s.server.deny();const denial=await s.tool.deny({...s.request,reason:'revoked'});assert.equal(denial.private_session_file_removed,true);await assert.rejects(lstat(sessionFile));assert.equal(s.server.created(),1);
});

test('bad nonce and source seal, private ACL failure, and unconfirmed replay without original claim refuse before HTTP',async t=>{
 for(const kind of['nonce','source','acl','resume']){const s=await setup(t);if(kind==='nonce')s.handoff.nonce='mismatch';await writeFile(s.prepared.handoff_file,JSON.stringify(s.handoff));if(kind==='source'){const manifestFile=path.join(path.dirname(s.prepared.handoff_file),'manifest.json');const manifest=JSON.parse(await readFile(manifestFile,'utf8'));manifest.sources={};await writeFile(manifestFile,JSON.stringify(manifest));}
  if(kind==='acl'){const bad=makeGuestWriteInbox({workspaceRoot:s.root,security:{async protect(){},async verify(){throw Error(reviewToken);}},fetch:s.server.fetcher,now:()=>now+1000});await assert.rejects(bad.open(s.request),GuestDeltaError);}
  else if(kind==='resume'){await s.tool.open(s.request);const count=s.server.calls.length;await assert.rejects(s.tool.resume(s.request),GuestDeltaError);assert.equal(s.server.calls.length,count);continue;}
  else await assert.rejects(s.tool.open(s.request),GuestDeltaError);assert.equal(s.server.calls.length,0);assert.equal(s.server.created(),0);
 }
});

test('actual Windows ACL protection creates only a fresh synthetic empty handoff manifest',async t=>{
 const root=await temporary(t),tool=makeGuestWriteInbox({workspaceRoot:root,now:()=>now}),prepared=await tool.prepare({version_id:ids[0],version_slide_id:ids[1],internal_comment_id:ids[5]});assert.equal(prepared.live_writes_enabled,false);assert.deepEqual(await readdir(path.dirname(prepared.handoff_file)),['manifest.json']);
});
