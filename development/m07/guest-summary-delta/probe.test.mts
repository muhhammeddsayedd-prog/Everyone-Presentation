import assert from 'node:assert/strict';
import test from 'node:test';
import { probeGuestSummary, verifyGuestDenial, parseProbeInput, GuestDeltaError, ORIGIN } from './probe.mts';

const version='10000000-0000-4000-8000-000000000001', denied='10000000-0000-4000-8000-000000000002';
const series='20000000-0000-4000-8000-000000000001', link='30000000-0000-4000-8000-000000000001';
const slide='40000000-0000-4000-8000-000000000001', session='50000000-0000-4000-8000-000000000001';
const requestId='60000000-0000-4000-8000-000000000001';
const raw=Buffer.alloc(32,7).toString('base64url'), access=Buffer.alloc(32,8).toString('base64url');
const now=Date.parse('2026-11-02T00:00:00Z'), expiry=new Date(now+120000).toISOString();
function summary(comments=1){const counts={preferred:1,maybe:0,not_preferred:0,comment_count:comments,unresolved_count:comments};return{version_id:version,per_slide:[{version_slide_id:slide,...counts}],totals:counts};}
function input(){return{schema_version:'1.0',review_link_id:link,series_id:series,version_id:version,denied_version_id:denied,denied_version_kind:'foreign_series',link_expires_at:expiry,review_token:raw,expected_guest_summary:summary(),producer_summary:summary(2)};}
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
function ok(data:unknown){return Response.json({request_id:requestId,data},{headers});}
function deniedResponse(code='REVIEW_ACCESS_DENIED',status=403){return Response.json({request_id:requestId,error:{code,message:'private untrusted body',details:{},retryable:false}},{status,headers});}
function transport(log:Request[]){return async(url:RequestInfo|URL,init?:RequestInit)=>{const request=new Request(url,init);log.push(request);const pathname=new URL(request.url).pathname;
 if(pathname==='/api/v1/review/open')return ok({access_token:access,guest_session_id:session,expires_at:expiry,series_id:series,version_id:version,download_enabled:false,display_name:null});
 if(!request.headers.has('x-review-session'))return deniedResponse('REVIEW_ACCESS_DENIED',401);
 if(new URL(request.url).search)return deniedResponse('INVALID_REQUEST',400);
 if(pathname.includes(denied))return deniedResponse();return ok(summary());};}

test('fresh anonymous summary probe preserves exact version, external counts and reload without credentials',async()=>{
 const log:Request[]=[];const result=await probeGuestSummary(input(),{fetch:transport(log),now:()=>now});
 assert.equal(result.evidence.result,'passed');assert.equal(result.evidence.internal_count_filtering_verified,true);assert.equal(result.evidence.producer_snapshot_source,'owner_supplied_MCP_or_API_snapshot');
 assert.equal(result.evidence.nonzero_external_counts,true);assert.equal(log.length,6);assert.equal(result.privateSession.session_token,access);
 for(const request of log){assert.equal(new URL(request.url).origin,ORIGIN);assert.equal(request.credentials,'omit');assert.equal(request.redirect,'error');assert.equal(request.headers.has('authorization'),false);assert.equal(request.headers.has('cookie'),false);}
 const publicText=JSON.stringify(result.evidence);for(const secret of[raw,access,'private untrusted body'])assert(!publicText.includes(secret));
 assert(log.every(request=>!request.url.includes(raw)&&!request.url.includes(access)));
});

test('no internal-count difference reports filtering unverified rather than false acceptance',async()=>{
 const value=input();value.producer_summary=summary();const result=await probeGuestSummary(value,{fetch:transport([]),now:()=>now});assert.equal(result.evidence.internal_count_filtering_verified,false);
});

test('wrong version, malformed counts and unknown private input fields refuse before dispatch',async()=>{
 for(const value of[{...input(),version_id:denied},{...input(),review_token:raw+'='},{...input(),authorization:'secret'},{...input(),denied_version_id:version},{...input(),expected_guest_summary:{...summary(),totals:{...summary().totals,comment_count:9}}}])assert.throws(()=>parseProbeInput(value),GuestDeltaError);
 let calls=0;await assert.rejects(probeGuestSummary({...input(),link_expires_at:new Date(now).toISOString()},{fetch:async()=>{calls++;throw Error('secret');},now:()=>now}),GuestDeltaError);assert.equal(calls,0);
});

test('unexpected guest counts, missing privacy headers and redirects fail safely',async()=>{
 for(const kind of['counts','headers','redirect','network']){let calls=0;const good=transport([]);
  const fetcher=async(url:RequestInfo|URL,init?:RequestInit)=>{calls++;if(kind==='network')throw Error(raw);if(kind==='redirect')return Response.redirect('https://untrusted.invalid/'+raw);if(calls===3){if(kind==='counts')return ok(summary(2));if(kind==='headers')return Response.json({request_id:requestId,data:summary()});}return good(url,init);};
  await assert.rejects(probeGuestSummary(input(),{fetch:fetcher,now:()=>now}),(error:unknown)=>error instanceof GuestDeltaError&&!String(error).includes(raw));
 }
});

test('foreign scope success and unsupported query acceptance cannot pass',async()=>{
 for(const target of[denied,'?limit=1']){const good=transport([]);const fetcher=async(url:RequestInfo|URL,init?:RequestInit)=>String(url).includes(target)?ok(summary()):good(url,init);await assert.rejects(probeGuestSummary(input(),{fetch:fetcher,now:()=>now}),GuestDeltaError);}
});

test('revocation proves old session and original link both deny, only before natural expiry',async()=>{
 const opened=await probeGuestSummary(input(),{fetch:transport([]),now:()=>now});let calls=0;
 const result=await verifyGuestDenial(opened.privateSession,'revoked',{fetch:async()=>{calls++;return deniedResponse();},now:()=>now+1000});assert.equal(calls,2);assert.equal(result.result,'passed');assert.equal(result.producer_lifecycle_change_independently_verified,false);assert(!JSON.stringify(result).includes(raw));
 await assert.rejects(verifyGuestDenial(opened.privateSession,'revoked',{fetch:async()=>{throw Error('never');},now:()=>now+120001}),GuestDeltaError);
});

test('expiry waits for known link deadline and rejects a still-valid original link',async()=>{
 const opened=await probeGuestSummary(input(),{fetch:transport([]),now:()=>now});let calls=0;
 await assert.rejects(verifyGuestDenial(opened.privateSession,'expired',{fetch:async()=>{calls++;return deniedResponse();},now:()=>now+1}),GuestDeltaError);assert.equal(calls,0);
 const result=await verifyGuestDenial(opened.privateSession,'expired',{fetch:async()=>deniedResponse(),now:()=>now+120001});assert.equal(result.result,'passed');assert.equal(result.known_link_deadline_elapsed,true);
 await assert.rejects(verifyGuestDenial(opened.privateSession,'expired',{fetch:async()=>ok({}),now:()=>now+120001}),GuestDeltaError);
});

test('oversize and duplicate-key response payloads are rejected without leaking raw content',async()=>{
 for(const body of['x'.repeat(270000),`{"request_id":"${requestId}","error":{"code":"REVIEW_ACCESS_DENIED","code":"PRIVATE"}}`]){
  await assert.rejects(probeGuestSummary(input(),{fetch:async()=>new Response(body,{status:401,headers}),now:()=>now}),GuestDeltaError);
 }
});
