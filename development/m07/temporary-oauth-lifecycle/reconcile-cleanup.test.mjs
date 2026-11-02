import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash,randomUUID } from 'node:crypto';
import { generateKeyPair,exportJWK,SignJWT } from 'jose';
import { CleanupReconciliation,exactBaseline,live,READ_ENABLED } from './reconcile-cleanup.mjs';
import * as core from './core.mjs';
const principal='11111111-1111-4111-8111-111111111111',owned='22222222-2222-4222-8222-222222222222',now=1793611800000;
const copy=value=>globalThis.structuredClone(value);
const baseline={principal_id:principal,observed_at_ms:now-60000,count:5,truncated:false,sessions:Array.from({length:5},(_,index)=>({id:`33333333-3333-4333-8333-${String(index+1).padStart(12,'0')}`,oauth_client_id:'f2acafd5-d4b6-4176-b86c-067c57e45ecc',created_at:'2026-11-01T00:00:00.000Z',not_after:null}))};
test('exact cleanup inventory accepts only the original five complete projected rows',()=>{const current={...copy(baseline),observed_at_ms:now};assert.equal(exactBaseline(current,baseline,principal,owned,now),true);});
test('changed unrelated row or stale/incomplete inventory refuses before bearer probe',()=>{
 for(const change of[value=>{value.sessions[0].not_after='2026-11-01T01:00:00.000Z';},value=>{value.observed_at_ms=now-30001;},value=>{value.truncated=true;},value=>{value.sessions.push({...value.sessions[0],id:owned});value.count=6;}]){const current={...copy(baseline),observed_at_ms:now};change(current);assert.throws(()=>exactBaseline(current,baseline,principal,owned,now));}
});

const {Response,Headers}=globalThis;
const key=await generateKeyPair('ES256'),jwks={keys:[{...await exportJWK(key.publicKey),kid:'cleanup-synthetic',alg:'ES256',use:'sig'}]};
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value),canonical=value=>JSON.stringify(value,(_,item)=>object(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a<b?-1:a>b?1:0)):item);
const digest=value=>createHash('sha256').update(canonical(value)).digest('hex'),sidSha=createHash('sha256').update(owned).digest('hex');
async function harness(change={}){
 const run=randomUUID(),purpose=randomUUID(),files=new Map(),counts={context:0,source:0,jwks:0,probe:0,inventory:0,forbidden:0,writes:0};let clock=now,drift=false;
 const sourcePins={'coordinator.mjs':'a'.repeat(64),'core.mjs':'b'.repeat(64),...Object.fromEntries(Array.from({length:37},(_,index)=>['source-'+index,'c'.repeat(64)]))};
 const execution={entry_sha256:'d'.repeat(64),coordinator_sha256:sourcePins['coordinator.mjs'],core_sha256:sourcePins['core.mjs'],jose_entry_sha256:'e'.repeat(64),jose_verify_sha256:'f'.repeat(64),jose_local_jwks_sha256:'1'.repeat(64),jose_package_sha256:'2'.repeat(64)};
 const ctx={run,principal,publishable_key:'sb_publishable_SYNTHETIC_PUBLIC_VALUE',source_pins:sourcePins,deployment:{id:'dpl_J3hmctcHndRp8zDVAPYfcnjEgpzG',state:'READY',meta:{epsSourceCommit:'c88f58c00820169f7396d72def77a74f1443594e',epsSourceManifest:'f947fb53479d991b382bd50bf39e32a4e56dd17598470b209f2a185ed9f58d0a'}}};
 const metadata={issuer:core.SCOPE.issuer,authorization_endpoint:core.SCOPE.authorize,token_endpoint:core.SCOPE.token,jwks_uri:core.SCOPE.jwks,response_types_supported:['code'],grant_types_supported:['authorization_code','refresh_token'],code_challenge_methods_supported:['S256'],token_endpoint_auth_methods_supported:['none'],scopes_supported:['openid']};
 const payload={iss:core.SCOPE.issuer,sub:principal,aud:core.SCOPE.resource,client_id:core.SCOPE.client,session_id:owned,iat:now/1000-60,exp:now/1000+3600,role:'authenticated',is_anonymous:false,scope:'openid',eps_delegation:{v:1,client_id:core.SCOPE.client,resource:core.SCOPE.resource,capabilities:['projects.read']},...change.payload};
 const access=await new SignJWT(payload).setProtectedHeader({alg:'ES256',kid:'cleanup-synthetic'}).sign(key.privateKey);
 const stored={v:1,run,phase:'refresh',claim:randomUUID(),tokens:{access_token:access,refresh_token:'PRIVATE_REFRESH_NEVER_SEND',token_type:'Bearer'}};
 const claims={client_id:core.SCOPE.client,session_sha256:sidSha,iat:now/1000-60,exp:now/1000+3600},oldClaims={...claims,iat:now/1000-3660,exp:now/1000-60};
 const initial={session_id:owned,principal_id:principal,claims:oldClaims,original_baseline_sha256:digest(baseline)};
 files.set('plan',{v:1,run,context_sha256:digest(ctx),metadata,jwks,baseline:copy(baseline)});files.set('initial',initial);files.set('refreshed',{session_id:owned,claims});
 for(const phase of['prepare','authorize','expiry','refresh']){const claim={v:1,run,phase,id:randomUUID(),context_sha256:digest(ctx),automatic_retry:false},proof={result:phase,...(phase==='authorize'?{claims:oldClaims}:phase==='refresh'?{claims}:{} )};files.set(phase+'.claim',claim);files.set(phase+'.normal',{...claim,normal_return:true,proof});}
 files.set('logout.claim',{v:1,run,phase:'logout',id:randomUUID(),context_sha256:digest(ctx),automatic_retry:false});if(change.outerNormal)files.set('logout.normal',{});
 const ports={now:()=>clock,context:async()=>{counts.context++;return copy(ctx);},seal:async()=>{counts.source++;return change.sourceDrift||drift?{...sourcePins,'core.mjs':'0'.repeat(64)}:copy(sourcePins);},read:async name=>{assert(files.has(name),name);return copy(files.get(name));},exists:async name=>files.has(name),create:async()=>{counts.writes++;throw Error('PRIVATE_WRITE_ATTEMPT');},
  deployment:async()=>copy(ctx.deployment),preflight:async()=>({database:'postgres',operator:'postgres',history39:true,client_id:core.SCOPE.client,client_count:1,public_none:true,callback:true,grants:true,resource:true,enabled_resources:1,owner:true,capability:true,membership:true}),
  native:async(method,value)=>{if(method==='read'){assert.equal(value.name,'generation-2.json');return copy(stored);}if(method==='inspect')return{phase:value.phase,state:value.phase==='logout'?(change.logoutUnknown?'unknown_no_replay':'normal_return_recorded'):(change.denialsNormal?'normal_return_recorded':'unknown_no_replay')};counts.forbidden++;throw Error('PRIVATE_NATIVE_MUTATION');},
  latestTokens:async()=>change.gen3?{...copy(stored),phase:'denials'}:copy(stored),
  inventory:async()=>{counts.inventory++;const result={...copy(baseline),observed_at_ms:clock};if(change.stale&&counts.inventory===1)result.observed_at_ms-=30001;if(change.changedSecond&&counts.inventory===2)result.sessions[0].not_after='2026-11-01T01:00:00.000Z';if(change.changedFinal&&counts.inventory===3)result.sessions[0].created_at='2026-11-01T00:01:00.000Z';if(change.ownedPresent){result.sessions.push({id:owned,oauth_client_id:core.SCOPE.client,created_at:'2026-11-02T09:00:00.000Z',not_after:null});result.count=6;}return result;},
  http:async(url,init)=>{if(String(url)===core.SCOPE.jwks){counts.jwks++;assert.equal(init.method,'GET');return new Response(JSON.stringify(change.wrongJwks?{keys:[]}:jwks),{status:200,headers:{'Content-Type':'application/json'}});}if(String(url)===core.SCOPE.resource){counts.probe++;assert.equal(init.method,'POST');assert.equal(new Headers(init.headers).get('authorization'),'Bearer '+access);const body=JSON.parse(init.body);assert.equal(body.method,'tools/call');assert.deepEqual(body.params,{name:'get_project',arguments:{project_id:core.SCOPE.project}});if(change.expireDuringProbe)clock=(payload.exp+1)*1000;if(change.driftAfterProbe)drift=true;return new Response('PRIVATE_DENIAL_BODY_NEVER_RETAIN',{status:change.accepted?200:401,headers:{'WWW-Authenticate':change.badChallenge?'Bearer error="invalid_request"':'Bearer error="invalid_token"'}});}counts.forbidden++;throw Error('PRIVATE_TOKEN_OR_LOGOUT_ENDPOINT');}
 };
 const pins=async()=>change.secretPins?{...execution,private:'PRIVATE_EXECUTION_SECRET'}:copy(execution);
 return{controller:new CleanupReconciliation(run,purpose,ports,pins),counts,access,ctx,files,ports,stored};
}
test('disabled public entry refuses before any private or provider port',async()=>{assert.equal(READ_ENABLED,false);let calls=0;await assert.rejects(()=>live('402aca12-60e1-464e-8573-c48958c3ab1f',randomUUID(),{context:async()=>{calls++;}}));assert.equal(calls,0);});
test('new purpose verifies actual signed claims, exact five rows three times and one denial without writes or secret output',async()=>{
 const h=await harness(),result=await h.controller.execute();assert.equal(result.result,'passed');assert.equal(result.scope,'cleanup_and_bearer_denial_verified');assert.deepEqual(result.complete_current_inventory_counts,[5,5,5]);assert.equal(result.native_logout_normal_recorded,true);assert.equal(result.native_denials_state,'unknown_no_replay');assert.equal(result.refresh_denial_unconfirmed,true);assert.equal(result.full_protocol_verified,false);assert.equal(result.frozen_source_pin_count,39);assert.equal(result.bearer_probe.before_signed_expiry,true);
 assert.equal(h.counts.jwks,1);assert.equal(h.counts.probe,1);assert.equal(h.counts.inventory,3);assert.equal(h.counts.forbidden,0);assert.equal(h.counts.writes,0);assert(!h.files.has('logout.normal'));const output=JSON.stringify(result);for(const secret of[principal,owned,'PRIVATE_',h.access,'sb_publishable_'])assert(!output.includes(secret),secret);
});
test('unknown or inconsistent phase state and generation3 refuse without token/logout/probe replay',async()=>{
 for(const change of[{logoutUnknown:true},{denialsNormal:true},{outerNormal:true},{gen3:true}]){const h=await harness(change),result=await h.controller.execute();assert.equal(result.result,'unconfirmed');assert.equal(result.stage,'phase_records');assert.equal(h.counts.probe,0);assert.equal(h.counts.jwks,0);assert.equal(h.counts.forbidden,0);assert.equal(h.counts.writes,0);}
});
test('source drift, expired/foreign signed claim, stale or changed inventory and secret pin injection refuse before probe',async()=>{
 for(const change of[{sourceDrift:true},{payload:{exp:now/1000-1}},{payload:{session_id:baseline.sessions[0].id}},{payload:{aud:'https://unrelated.invalid'}},{payload:{sub:owned}},{wrongJwks:true},{stale:true},{changedSecond:true},{ownedPresent:true},{secretPins:true}]){const h=await harness(change),result=await h.controller.execute();assert.equal(result.result,'unconfirmed');assert.equal(h.counts.probe,0);assert.equal(h.counts.forbidden,0);assert.equal(h.counts.writes,0);assert(!JSON.stringify(result).includes('PRIVATE_'));}
});
test('accepted bearer, wrong challenge, expiry during request, final row or source drift cannot become a pass or a retry',async()=>{
 for(const change of[{accepted:true},{badChallenge:true},{expireDuringProbe:true},{changedFinal:true},{driftAfterProbe:true}]){const h=await harness(change),result=await h.controller.execute();assert.equal(result.result,'unconfirmed');assert.equal(h.counts.probe,1);assert.equal(h.counts.forbidden,0);assert.equal(h.counts.writes,0);assert.equal(result.full_protocol_verified,false);assert(!JSON.stringify(result).includes('PRIVATE_'));}
});
test('readonly facade rejects any attempt to create a marker or dispatch native auth phase',async()=>{const h=await harness();assert.throws(()=>h.controller.c.p.create('logout.normal',{}));assert.throws(()=>h.controller.c.p.native('claim',{phase:'denials'}));assert.equal(h.counts.writes,0);assert.equal(h.counts.forbidden,0);});
test('a consumed read-only execution instance cannot probe or read again',async()=>{const h=await harness();assert.equal((await h.controller.execute()).result,'passed');const before=copy(h.counts),again=await h.controller.execute();assert.equal(again.result,'unconfirmed');assert.equal(again.stage,'execution_already_attempted');assert.deepEqual(h.counts,before);});
