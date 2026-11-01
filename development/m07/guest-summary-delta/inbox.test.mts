import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { mkdtemp, readFile, writeFile, lstat, readdir, realpath, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { makeGuestDeltaInbox, safeResult } from './inbox.mts';
import { GuestDeltaError } from './probe.mts';
const version='10000000-0000-4000-8000-000000000001', denied='10000000-0000-4000-8000-000000000002';
const now=Date.parse('2026-11-02T00:00:00Z'), secret=Buffer.alloc(32,7).toString('base64url'), session=Buffer.alloc(32,8).toString('base64url');
const ids=['20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001'];
const counts={preferred:0,maybe:0,not_preferred:0,comment_count:0,unresolved_count:0};
const summary={version_id:version,per_slide:[{version_slide_id:ids[2],...counts}],totals:counts};
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
function value(prepared:{run_id:string;nonce:string;manifest_sha256:string}){return{schema_version:'1.0',run_id:prepared.run_id,nonce:prepared.nonce,manifest_sha256:prepared.manifest_sha256,probe:{schema_version:'1.0',review_link_id:ids[1],series_id:ids[0],version_id:version,denied_version_id:denied,denied_version_kind:'internal_audience',link_expires_at:new Date(now+120000).toISOString(),review_token:secret,expected_guest_summary:summary,producer_summary:summary}};}
async function ownTemporaryDirectory(t:TestContext,prefix='eps-guest-delta-'){
 const root=await mkdtemp(path.join(os.tmpdir(),prefix));t.after(async()=>{assert.equal(path.dirname(root),path.resolve(os.tmpdir()));assert.match(path.basename(root),/^eps-guest-delta-(?:acl-)?[A-Za-z0-9]{6}$/u);assert.equal(await realpath(root),root);assert.equal((await lstat(root)).isSymbolicLink(),false);await rm(root,{recursive:true});});return root;
}
async function setup(t:TestContext){const root=await ownTemporaryDirectory(t);const security={async protect(){},async verify(){}};let calls=0,denying=false;const fetcher=async(url:RequestInfo|URL,init?:RequestInit)=>{calls++;const r=new Request(url,init);const pathname=new URL(r.url).pathname;if(!denying&&pathname==='/api/v1/review/open')return Response.json({request_id:ids[3],data:{access_token:session,guest_session_id:ids[3],expires_at:new Date(now+120000).toISOString(),series_id:ids[0],version_id:version,download_enabled:false,display_name:null}},{headers});if(denying||!r.headers.has('x-review-session')||pathname.includes(denied)||new URL(r.url).search)return Response.json({request_id:ids[3],error:{code:new URL(r.url).search?'INVALID_REQUEST':'REVIEW_ACCESS_DENIED',message:'safe',details:{},retryable:false}},{status:new URL(r.url).search?400:!r.headers.has('x-review-session')&&pathname!=='/api/v1/review/open'?401:403,headers});return Response.json({request_id:ids[3],data:summary},{headers});};const tool=makeGuestDeltaInbox({workspaceRoot:root,security,fetch:fetcher,now:()=>now+1000});return{root,tool,calls:()=>calls,deny:()=>{denying=true;}};}

test('nonce/manifest bound private handoff is consumed once; denial clears stored capabilities',async t=>{
 const s=await setup(t),prepared=await s.tool.prepare({version_id:version,denied_version_id:denied});assert.equal(s.calls(),0);
 await writeFile(prepared.handoff_file,JSON.stringify(value(prepared)));const request={run_id:prepared.run_id,manifest_sha256:prepared.manifest_sha256};
 const result=await s.tool.probe(request);assert.equal(result.result,'passed');assert.equal(s.calls(),6);await assert.rejects(lstat(prepared.handoff_file));
 const receipt=await readFile(result.receipt_file,'utf8');assert(!receipt.includes(secret)&&!receipt.includes(session));
 await assert.rejects(s.tool.deny({...request,reason:'expired'}),GuestDeltaError);assert.equal(s.calls(),6);await assert.rejects(lstat(path.join(path.dirname(prepared.handoff_file),'deny-expired-claim.json')));
 await assert.rejects(s.tool.probe(request),GuestDeltaError);assert.equal(s.calls(),6);s.deny();const deniedResult=await s.tool.deny({...request,reason:'revoked'});assert.equal(deniedResult.result,'passed');assert.equal(s.calls(),8);
 await assert.rejects(lstat(path.join(path.dirname(prepared.handoff_file),'session.json')));await assert.rejects(s.tool.deny({...request,reason:'revoked'}),GuestDeltaError);assert.equal(s.calls(),8);
});

test('bad nonce, duplicate key, bound version and expired link refuse before claim or HTTP',async t=>{
 for(const kind of['nonce','duplicate','version','expired']){const s=await setup(t),p=await s.tool.prepare({version_id:version,denied_version_id:denied});const body=value(p);if(kind==='nonce')body.nonce='mismatch';if(kind==='version')body.probe.version_id=denied;if(kind==='expired')body.probe.link_expires_at=new Date(now).toISOString();let raw=JSON.stringify(body);if(kind==='duplicate')raw=raw.replace('"schema_version":"1.0"','"schema_version":"1.0","schema_version":"1.0"');await writeFile(p.handoff_file,raw);await assert.rejects(s.tool.probe({run_id:p.run_id,manifest_sha256:p.manifest_sha256}),GuestDeltaError);assert.equal(s.calls(),0);assert((await lstat(p.handoff_file)).isFile());await assert.rejects(lstat(path.join(path.dirname(p.handoff_file),'probe-claim.json')));}
});

test('private ACL failure and expired preparation stop before capability dispatch',async t=>{
 const s=await setup(t),p=await s.tool.prepare({version_id:version,denied_version_id:denied});await writeFile(p.handoff_file,JSON.stringify(value(p)));
 const tool=makeGuestDeltaInbox({workspaceRoot:s.root,security:{async protect(){},async verify(){throw Error(secret);}},now:()=>now});await assert.rejects(tool.probe({run_id:p.run_id,manifest_sha256:p.manifest_sha256}),GuestDeltaError);
 const late=makeGuestDeltaInbox({workspaceRoot:s.root,security:{async protect(){},async verify(){}},now:()=>now+3600000});await assert.rejects(late.probe({run_id:p.run_id,manifest_sha256:p.manifest_sha256}),GuestDeltaError);assert.equal(s.calls(),0);
 assert(!JSON.stringify(safeResult(Error(secret))).includes(secret));
});

test('real Windows owner/SYSTEM ACLs protect a newly prepared empty inbox',async t=>{
 const root=await ownTemporaryDirectory(t,'eps-guest-delta-acl-');const tool=makeGuestDeltaInbox({workspaceRoot:root,now:()=>now});const prepared=await tool.prepare({version_id:version,denied_version_id:denied});assert.equal(prepared.result,'prepared');assert.deepEqual((await readdir(path.dirname(prepared.handoff_file))).sort(),['manifest.json']);
});
