/** Full coordinator offline: real SDK+JOSE, synthetic HTTP, in-memory durable ports. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import { test } from 'node:test';
import { URL,URLSearchParams } from 'node:url';
import { decodeJwt,exportJWK,generateKeyPair,SignJWT } from 'jose';
import { Coordinator,live,LIVE_ENABLED,nativePorts } from './coordinator.mjs';
import * as core from './core.mjs';
import { ownerCallback as disabledOwnerCallback,LIVE_ENABLED as CALLBACK_ENABLED } from './coordinator_callback.mjs';
const {Response,Headers}=globalThis;
const principal='11111111-1111-4111-8111-111111111111',session='22222222-2222-4222-8222-222222222222',existing='33333333-3333-4333-8333-333333333333',lateSession='66666666-6666-4666-8666-666666666666';
const key=await generateKeyPair('ES256'),jwks={keys:[{...await exportJWK(key.publicKey),kid:'coordinator-synthetic',alg:'ES256',use:'sig'}]};
const metadata={issuer:core.SCOPE.issuer,authorization_endpoint:core.SCOPE.authorize,token_endpoint:core.SCOPE.token,jwks_uri:core.SCOPE.jwks,response_types_supported:['code'],grant_types_supported:['authorization_code','refresh_token'],code_challenge_methods_supported:['S256'],token_endpoint_auth_methods_supported:['none'],scopes_supported:['openid'],authorization_response_iss_parameter_supported:true};
const copy=value=>globalThis.structuredClone(value),json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});

function harness(){
 const run=randomUUID(),files=new Map(),native=new Map(),events=[];let now=1793580000000,active=false,drift=false,reuse=false,lostRefresh=false,failPersist=false,lostLogout=false,late=false;
 const counts={http:0,exchange:0,refresh:0,logout:0,denied_refresh:0,owner:0,metadata:0,reads:0};
 const ctx={run,principal,publishable_key:'sb_publishable_PRIVATE_SYNTHETIC_KEY',source_pins:{'coordinator.mjs':'a'.repeat(64)},deployment:{id:'dpl_SyntheticOAuth123456789',state:'READY',url:'everyone-presentation-pilot-synthetic.vercel.app',project_id:'prj_7xOsfRtvJ9voYi7rTEfra5ncOoA0',team_id:'team_gboXPxTevpCOZuaA8eY9PmR1',meta:{epsSourceCommit:'c'.repeat(40),epsSourceManifest:'d'.repeat(64)}}};
 const inv=()=>({principal_id:principal,observed_at_ms:now,count:1+(late?1:0)+(active&&!reuse&&!late?1:0),truncated:false,sessions:[{id:existing,oauth_client_id:core.SCOPE.client,created_at:'2026-11-01T00:00:00Z',not_after:null},...(late?[{id:lateSession,oauth_client_id:core.SCOPE.client,created_at:'2026-11-01T01:00:00Z',not_after:null}]:[]),...(active&&!reuse&&!late?[{id:session,oauth_client_id:core.SCOPE.client,created_at:new Date(1793580000000).toISOString(),not_after:null}]:[])]});
 const access=async lifetime=>new SignJWT({iss:core.SCOPE.issuer,sub:principal,aud:core.SCOPE.resource,iat:now/1000,exp:now/1000+lifetime,client_id:core.SCOPE.client,session_id:reuse?existing:late?lateSession:session,role:'authenticated',is_anonymous:false,scope:'openid',eps_delegation:{v:1,client_id:core.SCOPE.client,resource:core.SCOPE.resource,capabilities:['projects.read']}}).setProtectedHeader({alg:'ES256',kid:'coordinator-synthetic'}).sign(key.privateKey);
 const ports={now:()=>now,context:async()=>copy(ctx),seal:async()=>drift?{'coordinator.mjs':'b'.repeat(64)}:copy(ctx.source_pins),exists:async name=>files.has(name),read:async name=>{assert(files.has(name));return copy(files.get(name));},create:async(name,value)=>{assert(!files.has(name));files.set(name,copy(value));events.push('create:'+name);},
  preflight:async()=>{counts.metadata++;return{database:'postgres',operator:'postgres',history39:true,client_id:core.SCOPE.client,client_count:1,public_none:true,callback:true,grants:true,resource:true,enabled_resources:1,owner:true,capability:true,membership:true};},inventory:async()=>{counts.metadata++;return inv();},deployment:async()=>copy(ctx.deployment),ownerReady:()=>{},
  ownerCallback:async({begin,claim,onCode,onReady})=>{counts.owner++;const id=await claim('authorize');onReady('http://localhost:3118/start');const code=core.callback(new URL(core.SCOPE.callback+'?code=PRIVATE_ONE_TIME_CODE&state='+begin.state+'&iss='+encodeURIComponent(core.SCOPE.issuer)),begin);return{authorize_claim:id,value:await onCode(code)};},
  native:async(method,value)=>{
   if(method==='claim'){const name=value.phase+'.claim';assert(!native.has(name));native.set(name,{claim:randomUUID()});events.push('claim:'+value.phase);return native.get(name).claim;}
   if(method==='normal'){assert.equal(native.get(value.phase+'.claim')?.claim,value.claim);assert(!native.has(value.phase+'.normal'));if(['exchange','refresh'].includes(value.phase))assert(native.has(value.generation));native.set(value.phase+'.normal',copy(value));events.push('normal:'+value.phase);return{phase:value.phase,normal_return:true};}
   if(method==='persist'){assert.equal(native.get(value.phase+'.claim')?.claim,value.claim);const name='generation-'+({exchange:1,refresh:2,denials:3}[value.phase])+'.json';assert(!native.has(name));native.set(name,copy(value));events.push('persist:'+value.phase);if(failPersist&&value.phase==='refresh')throw Error('PRIVATE_LOST_PERSIST_RETURN');return name;}
   if(method==='read'){assert(native.has(value.name));return copy(native.get(value.name));}
   if(method==='inspect')return{phase:value.phase,state:native.has(value.phase+'.normal')?'normal_return_recorded':native.has(value.phase+'.claim')?'unknown_no_replay':'not_dispatched'};throw Error('unexpected native method');
  },latestTokens:async()=>copy(native.get(['generation-3.json','generation-2.json','generation-1.json'].find(name=>native.has(name)))),http:async(url,init)=>{
   counts.http++;const u=String(url);
   if(init.method==='GET'){
    if(u.endsWith('/.well-known/oauth-authorization-server/auth/v1'))return json(metadata);
    if(u.endsWith('/.well-known/oauth-protected-resource/mcp'))return json({resource:core.SCOPE.resource,authorization_servers:[core.SCOPE.issuer],scopes_supported:['openid']});
    if(u===core.SCOPE.jwks)return json(jwks);throw Error('unexpected GET');
   }
   if(u===core.SCOPE.token){const body=new URLSearchParams(init.body);assert.equal(body.get('client_id'),core.SCOPE.client);assert.equal(body.get('resource'),core.SCOPE.resource);
    if(body.get('grant_type')==='authorization_code'){counts.exchange++;events.push('http:exchange');assert.equal(body.get('code'),'PRIVATE_ONE_TIME_CODE');active=true;return json({access_token:await access(2),refresh_token:'PRIVATE_REFRESH_FIRST',token_type:'Bearer'});}
    if(!active){counts.denied_refresh++;assert.equal(body.get('refresh_token'),'PRIVATE_REFRESH_ROTATED');return json({error:'invalid_grant',error_description:'PRIVATE_ERROR_DESCRIPTION'},400);}
    counts.refresh++;events.push('http:refresh');assert.equal(body.get('refresh_token'),'PRIVATE_REFRESH_FIRST');if(lostRefresh)throw Error('PRIVATE_UNKNOWN_REFRESH_RETURN');return json({access_token:await access(300),refresh_token:'PRIVATE_REFRESH_ROTATED',token_type:'Bearer'});
   }
   if(u===core.SCOPE.issuer+'/logout?scope=local'){counts.logout++;assert(active&&!reuse);const payload=decodeJwt(new Headers(init.headers).get('authorization').slice(7));assert.equal(payload.session_id,session);active=false;if(lostLogout)throw Error('PRIVATE_UNKNOWN_LOGOUT_RETURN');return new Response(null,{status:204});}
   if(u===core.SCOPE.resource){const headers=new Headers(init.headers),token=headers.get('authorization').slice(7),payload=decodeJwt(token);if(!active||payload.exp<=now/1000)return new Response('denied',{status:401,headers:{'WWW-Authenticate':'Bearer error="invalid_token"'}});
    const body=JSON.parse(init.body);if(body.method==='notifications/initialized')return new Response(null,{status:202});if(body.method==='initialize')return json({jsonrpc:'2.0',id:body.id,result:{protocolVersion:'2025-11-25',capabilities:{tools:{}},serverInfo:{name:'synthetic',version:'1.0.0'}}});
    assert.equal(body.method,'tools/call');counts.reads++;return json({jsonrpc:'2.0',id:body.id,result:{content:[{type:'text',text:'PRIVATE_PROJECT_NAME'}],structuredContent:{request_id:randomUUID(),data:{id:core.SCOPE.project,name:'PRIVATE_PROJECT_NAME'}}}});
   }throw Error('unexpected HTTP');
  }};
 const controller=new Coordinator(run,ports);const ready=async()=>{const prepared=await controller.execute('prepare');assert.equal(prepared.result,'prepared');files.set('ready',{run,owner_ready:true,context_sha256:files.get('prepare.claim').context_sha256});return controller.execute('authorize');};
 return{controller,ready,ports,files,native,events,counts,ctx,advance:()=>{now+=3000;},drift:()=>{drift=true;},reuse:()=>{reuse=true;},lateSession:()=>{late=true;},loseRefresh:()=>{lostRefresh=true;},failPersist:()=>{failPersist=true;},loseLogout:()=>{lostLogout=true;},active:()=>active};
}

test('disabled public live entry and new callback refuse before private/provider/listener ports',async()=>{assert.equal(LIVE_ENABLED,false);assert.equal(CALLBACK_ENABLED,false);let reads=0;await assert.rejects(()=>live('prepare',randomUUID(),{context:async()=>{reads++;}}),/TEMP_OAUTH_COORDINATOR_REFUSED/u);assert.equal(reads,0);await assert.rejects(()=>disabledOwnerCallback({claim:async()=>{reads++;}}),/TEMP_OAUTH_OWNER_CALLBACK_REFUSED/u);assert.equal(reads,0);});
test('source-only port construction tolerates shell DEBUG while every private/live operation still refuses',async()=>{
 const original=process.env.DEBUG;process.env.DEBUG='synthetic_source_test';try{const ports=nativePorts('');await assert.rejects(()=>ports.context(),/TEMP_OAUTH_COORDINATOR_REFUSED/u);}finally{if(original===undefined)delete process.env.DEBUG;else process.env.DEBUG=original;}
});
test('complete coordinator uses actual SDK/JOSE through expiry/rotation/read/local logout/denials without secret output',async()=>{
 const h=harness(),results=[];results.push(await h.ready());assert.equal(results[0].result,'authorized');assert.equal(h.counts.exchange,1);
 const waiting=await h.controller.execute('expiry');assert.equal(waiting.result,'waiting');assert(!h.files.has('expiry.claim'));h.advance();results.push(await h.controller.execute('expiry'));assert.equal(results[1].result,'expired_bearer_denied');
 results.push(await h.controller.execute('refresh'));assert.equal(results[2].result,'refreshed');results.push(await h.controller.execute('logout'));assert.equal(results[3].result,'protocol_passed');assert.equal(h.counts.logout,1);assert.equal(h.counts.denied_refresh,1);assert.equal(h.counts.reads,2);assert.equal(h.active(),false);
 const publicJSON=JSON.stringify(results);for(const secret of['PRIVATE_',principal,session,existing])assert(!publicJSON.includes(secret));assert(h.events.indexOf('claim:refresh')<h.events.indexOf('http:refresh'));assert(h.events.indexOf('persist:refresh')<h.events.indexOf('normal:refresh'));
 assert.equal((await h.controller.execute('logout')).result,'unconfirmed');assert.equal(h.counts.logout,1);assert.equal(h.counts.denied_refresh,1);
});
test('source drift refuses before provider reads or phase claims',async()=>{const h=harness();h.drift();const result=await h.controller.execute('prepare');assert.equal(result.result,'unconfirmed');assert.equal(h.counts.http,0);assert.equal(h.counts.metadata,0);assert.equal(h.files.size,0);});
test('an unrelated same-client session arriving after prepare refuses before consent listener or code grant',async()=>{
 const h=harness();assert.equal((await h.controller.execute('prepare')).result,'prepared');h.files.set('ready',{run:h.ctx.run,owner_ready:true,context_sha256:h.files.get('prepare.claim').context_sha256});h.lateSession();const result=await h.controller.execute('authorize');assert.equal(result.result,'unconfirmed');assert.equal(h.counts.owner,0);assert.equal(h.counts.exchange,0);assert(!h.files.has('authorize.claim'));assert.equal(h.counts.logout,0);
});
test('stale or future pre-consent snapshots refuse before listener or exchange using existing recency limits',async()=>{
 for(const offset of[-30001,1001]){const h=harness();assert.equal((await h.controller.execute('prepare')).result,'prepared');h.files.set('ready',{run:h.ctx.run,owner_ready:true,context_sha256:h.files.get('prepare.claim').context_sha256});const collect=h.ports.inventory;h.ports.inventory=async()=>({...await collect(),observed_at_ms:h.ports.now()+offset});assert.equal((await h.controller.execute('authorize')).result,'unconfirmed');assert.equal(h.counts.owner,0);assert.equal(h.counts.exchange,0);assert(!h.files.has('authorize.claim'));}
});
test('unknown refresh outcome and persistence failure retain claims and permit only readonly reconciliation',async()=>{
 for(const failure of['lost','persist']){const h=harness();assert.equal((await h.ready()).result,'authorized');h.advance();assert.equal((await h.controller.execute('expiry')).result,'expired_bearer_denied');if(failure==='lost')h.loseRefresh();else h.failPersist();const failed=await h.controller.execute('refresh');assert.equal(failed.result,'unconfirmed');assert(h.files.has('refresh.claim'));assert(!h.files.has('refresh.normal'));assert(!h.native.has('refresh.normal'));
  assert.equal((await h.controller.execute('refresh')).result,'unconfirmed');assert.equal(h.counts.refresh,1);const before={...h.counts};const observed=await h.controller.execute('reconcile');assert.equal(observed.result,'observed_only');assert.equal(observed.phases.find(row=>row.phase==='refresh').state,'unknown_no_replay');assert.equal(h.counts.refresh,before.refresh);assert.equal(h.counts.logout,before.logout);assert.equal(h.counts.owner,before.owner);assert(!JSON.stringify([failed,observed]).includes('PRIVATE_'));}
});
test('preexisting same-client session cannot become owned or be locally signed out',async()=>{const h=harness();h.reuse();const result=await h.ready();assert.equal(result.result,'unconfirmed');assert.equal(h.counts.logout,0);assert.equal(h.active(),true);assert.equal((await h.controller.execute('logout')).result,'unconfirmed');assert.equal(h.counts.logout,0);});
test('targeted cleanup can use a persisted known new session without repairing or replaying a failed refresh',async()=>{
 const h=harness();assert.equal((await h.ready()).result,'authorized');h.advance();assert.equal((await h.controller.execute('expiry')).result,'expired_bearer_denied');h.failPersist();assert.equal((await h.controller.execute('refresh')).result,'unconfirmed');const cleanup=await h.controller.execute('cleanup');assert.equal(cleanup.result,'cleanup_passed');assert.equal(cleanup.protocol_acceptance,false);assert.equal(h.counts.refresh,1);assert.equal(h.counts.logout,1);assert.equal(h.active(),false);assert(!h.files.has('refresh.normal'));assert.equal((await h.controller.execute('cleanup')).result,'unconfirmed');assert.equal(h.counts.logout,1);
});
test('lost local logout return remains unknown after observed absence and never signs out or refreshes again',async()=>{
 const h=harness();assert.equal((await h.ready()).result,'authorized');h.advance();assert.equal((await h.controller.execute('expiry')).result,'expired_bearer_denied');assert.equal((await h.controller.execute('refresh')).result,'refreshed');h.loseLogout();assert.equal((await h.controller.execute('logout')).result,'unconfirmed');assert.equal(h.active(),false);assert(!h.native.has('logout.normal'));assert(!h.files.has('logout.normal'));
 const observed=await h.controller.execute('reconcile');assert.equal(observed.result,'observed_only');assert.equal(observed.owned_session_absent,true);assert.equal(observed.phases.find(row=>row.phase==='logout').state,'unknown_no_replay');assert.equal((await h.controller.execute('logout')).result,'unconfirmed');assert.equal((await h.controller.execute('cleanup')).result,'unconfirmed');assert.equal(h.counts.logout,1);assert.equal(h.counts.denied_refresh,0);
});
