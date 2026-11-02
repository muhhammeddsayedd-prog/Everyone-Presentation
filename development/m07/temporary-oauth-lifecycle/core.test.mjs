/** Offline synthetic OAuth/session proofs only; injected HTTP never reaches a provider. */
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { randomUUID, webcrypto } from 'node:crypto';
import { test } from 'node:test';
import { URL,URLSearchParams } from 'node:url';
import { TextEncoder } from 'node:util';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import * as m from './core.mjs';
const {Response}=globalThis;

const principal='11111111-1111-4111-8111-111111111111',session='22222222-2222-4222-8222-222222222222';
const existing='33333333-3333-4333-8333-333333333333',now=1793580000000;
const metadata={issuer:m.SCOPE.issuer,authorization_endpoint:m.SCOPE.authorize,token_endpoint:m.SCOPE.token,jwks_uri:m.SCOPE.jwks,
 response_types_supported:['code'],grant_types_supported:['authorization_code','refresh_token'],code_challenge_methods_supported:['S256'],token_endpoint_auth_methods_supported:['none'],scopes_supported:['openid'],authorization_response_iss_parameter_supported:true};
const key=await generateKeyPair('ES256'),jwks={keys:[{...await exportJWK(key.publicKey),kid:'test-key',alg:'ES256',use:'sig'}]};
const claims=overrides=>({iss:m.SCOPE.issuer,sub:principal,aud:m.SCOPE.resource,exp:now/1000+300,iat:now/1000-30,client_id:m.SCOPE.client,session_id:session,role:'authenticated',is_anonymous:false,scope:'openid',
 eps_delegation:{v:1,client_id:m.SCOPE.client,resource:m.SCOPE.resource,capabilities:['projects.read']},...overrides});
const signed=async(overrides={})=>new SignJWT(claims(overrides)).setProtectedHeader({alg:'ES256',kid:'test-key'}).sign(key.privateKey);
const inventory=(ids=[existing])=>({principal_id:principal,observed_at_ms:now,sessions:ids.map(id=>({id,oauth_client_id:id===session?m.SCOPE.client:null,created_at:'2026-11-01T00:00:00.000Z',not_after:null})),count:ids.length,truncated:false});
const response=value=>new Response(JSON.stringify(value),{status:200,headers:{'content-type':'application/json'}});

test('actual official SDK produces fixed existing public-client PKCE with fresh state',async()=>{
 const begin=await m.authorization(metadata);const u=begin.authorizationUrl;assert.equal(u.origin+u.pathname,m.SCOPE.authorize);assert.equal(u.searchParams.get('client_id'),m.SCOPE.client);assert.equal(u.searchParams.get('redirect_uri'),m.SCOPE.callback);assert.equal(u.searchParams.get('resource'),m.SCOPE.resource);assert.equal(u.searchParams.get('code_challenge_method'),'S256');assert.equal(u.searchParams.get('state'),begin.state);
 const digest=Buffer.from(await webcrypto.subtle.digest('SHA-256',new TextEncoder().encode(begin.codeVerifier))).toString('base64url');assert.equal(u.searchParams.get('code_challenge'),digest);
 assert.notEqual((await m.authorization(metadata)).state,begin.state);assert.throws(()=>m.validateMetadata({...metadata,token_endpoint:'https://example.org/token'}),/TEMP_OAUTH_/u);
 const code=m.callback(new URL(m.SCOPE.callback+'?state='+begin.state+'&code=synthetic_code&iss='+encodeURIComponent(m.SCOPE.issuer)),begin);assert.equal(code.code,'synthetic_code');
 for(const query of['?state=wrong&code=synthetic','?state='+begin.state+'&code=a&code=b','?state='+begin.state+'&code=a&iss=https%3A%2F%2Fevil.example'])assert.throws(()=>m.callback(new URL(m.SCOPE.callback+query),begin),/TEMP_OAUTH_/u);
});

test('real JOSE verification admits only a fresh owned session and exact signed binding',async()=>{
 const token=await signed();const owned=await m.admitTokens({access_token:token,refresh_token:'refresh_original',token_type:'Bearer'},{jwks,principal,baseline:inventory(),current:inventory([existing,session]),now});
 assert.equal(owned.sessionId,session);assert.equal(m.safeClaims(owned).session_sha256.length,64);assert(!JSON.stringify(m.safeClaims(owned)).includes(principal));
 // Each signed invalid claim must also be rejected, independently of malformed-token denial.
 for(const override of[{session_id:existing},{session_id:''},{session_id:'00000000-0000-0000-0000-000000000000'},{aud:'https://example.org/mcp'},{client_id:randomUUID()},{exp:now/1000-1},{sub:existing},{scope:'email'},{eps_delegation:{v:1,client_id:m.SCOPE.client,resource:m.SCOPE.resource,capabilities:[]}}]){const invalid=await signed(override);await assert.rejects(()=>m.admitTokens({access_token:invalid,refresh_token:'refresh_original',token_type:'Bearer'},{jwks,principal,baseline:inventory(),current:inventory([existing,session]),now}),/TEMP_OAUTH_/u);}
 await assert.rejects(()=>m.admitTokens({access_token:token,refresh_token:'refresh_original',token_type:'Bearer'},{jwks,principal,baseline:inventory([session]),current:inventory([session]),now}),/TEMP_OAUTH_/u);
 await assert.rejects(()=>m.admitTokens({access_token:token,refresh_token:'refresh_original',token_type:'Bearer'},{jwks,principal,baseline:inventory(),current:inventory(),now}),/TEMP_OAUTH_/u);
});

test('actual SDK refresh response is observed before old-token fallback; durable persistence precedes return',async()=>{
 for(const replacement of[undefined,'refresh_original','refresh_rotated']){
  const order=[];let calls=0;const access=await signed({iat:now/1000,exp:now/1000+600});
  const result=await m.grant({phase:'refresh',metadata,refreshToken:'refresh_original',previousAccess:'old_access',transport:async(url,init)=>{calls++;order.push('dispatch');assert.equal(String(url),m.SCOPE.token);assert.equal(init.redirect,'error');assert.equal(init.credentials,'omit');const body=new URLSearchParams(init.body);assert.equal(body.get('client_id'),m.SCOPE.client);assert.equal(body.get('resource'),m.SCOPE.resource);assert.equal(body.get('grant_type'),'refresh_token');return response({access_token:access,token_type:'Bearer',...(replacement===undefined?{}:{refresh_token:replacement})});},
   claim:async()=>{order.push('claim');return 'claim1';},persist:async tokens=>{order.push('persist');assert.equal(tokens.refresh_token,replacement??'refresh_original');},complete:async()=>order.push('normal')});
  assert.equal(calls,1);assert.deepEqual(order,['claim','dispatch','persist','normal']);assert.equal(result.rotation.new_refresh_present,replacement!==undefined);assert.equal(result.rotation.refresh_changed,replacement==='refresh_rotated');assert.equal(result.rotation.proven,replacement==='refresh_rotated');assert(!JSON.stringify(result.safe).includes('refresh_original'));assert(!JSON.stringify(result.safe).includes('refresh_rotated'));
 }
});

test('refresh requires the actual previous access token before claiming or dispatching',async()=>{
 let claims=0,calls=0;await assert.rejects(()=>m.grant({phase:'refresh',metadata,refreshToken:'owned_refresh',transport:async()=>{calls++;return response({access_token:'new_access',refresh_token:'new_refresh',token_type:'Bearer'});},claim:async()=>{claims++;return 'claim';},persist:async()=>{},complete:async()=>{}}),/TEMP_OAUTH_/u);assert.equal(claims,0);assert.equal(calls,0);
});

test('overflow, redirect, invalid grant and persistence errors never retry or leak bodies',async()=>{
 for(const behavior of['lost','overflow','redirect','denied','persist']){
  let calls=0,normals=0;const secret='DO_NOT_EXPOSE_PRIVATE_TOKEN';
  const transport=async()=>{calls++;if(behavior==='lost')throw Error(secret);if(behavior==='overflow')return new Response('x'.repeat(65537),{headers:{'content-type':'application/json'}});if(behavior==='redirect')return new Response(null,{status:302,headers:{location:'https://evil.example'}});if(behavior==='denied')return new Response(JSON.stringify({error:'invalid_grant',error_description:secret}),{status:400,headers:{'content-type':'application/json'}});return response({access_token:'synthetic_access',refresh_token:'rotated',token_type:'Bearer'});};
  await assert.rejects(()=>m.grant({phase:'refresh',metadata,refreshToken:secret,previousAccess:'old',transport,claim:async()=> 'c',persist:async()=>{if(behavior==='persist')throw Error(secret);},complete:async()=>normals++}),error=>{assert.match(error.message,/^TEMP_OAUTH_[A-Z_]+$/u);assert(!JSON.stringify(error).includes(secret));return true;});assert.equal(calls,1);assert.equal(normals,0);
 }
 let calls=0;await assert.rejects(()=>m.grant({phase:'refresh',metadata,refreshToken:'old',previousAccess:'previous_access',transport:async()=>{calls++;return response({});},claim:async()=>{throw Error('consumed');},persist:async()=>{},complete:async()=>{}}),/TEMP_OAUTH_/u);assert.equal(calls,0);
});

test('real bounded timeout consumes one dispatch and never writes a normal marker',async()=>{
 let calls=0,normals=0;const began=Date.now();await assert.rejects(()=>m.grant({phase:'refresh',metadata,refreshToken:'synthetic_original',previousAccess:'previous_access',transport:async()=>{calls++;return new Promise(()=>{});},claim:async()=> 'one',persist:async()=>{},complete:async()=>normals++}),/^Error: TEMP_OAUTH_PHASE_UNCONFIRMED$/u);assert.equal(calls,1);assert.equal(normals,0);assert(Date.now()-began>=9900&&Date.now()-began<20000);
});

test('stored expired bearer is signature-verified for expiry/refresh only, without changing its claims or wall clock',async()=>{
 const expired=await signed({exp:now/1000-2,iat:now/1000-300}),options={jwks,principal,baseline:inventory(),current:inventory([existing,session]),now};
 await assert.rejects(()=>m.admitTokens({access_token:expired,refresh_token:'old_refresh',token_type:'Bearer'},options),/TEMP_OAUTH_/u);
 const owned=await m.admitTokens({access_token:expired,refresh_token:'old_refresh',token_type:'Bearer'},{...options,phase:'expiry'});assert.equal(owned.accessToken,expired);assert.equal(m.expiredBearerRequest(owned,now).headers.Authorization,'Bearer '+expired);
 const fresh=await signed({iat:now/1000,exp:now/1000+600});assert.equal((await m.admitRefreshed(owned,{access_token:fresh,refresh_token:'new_refresh',token_type:'Bearer'},options)).sessionId,session);
 const other=await signed({session_id:existing,iat:now/1000,exp:now/1000+600});await assert.rejects(()=>m.admitRefreshed(owned,{access_token:other,refresh_token:'new_refresh',token_type:'Bearer'},options),/TEMP_OAUTH_/u);
 await assert.rejects(()=>m.admitTokens({access_token:expired.slice(0,-4)+'aaaa',refresh_token:'old_refresh',token_type:'Bearer'},{...options,phase:'expiry'}),/TEMP_OAUTH_/u);
});

test('only owned still-current unexpired session can form exact local logout; all unrelated sessions must survive',async()=>{
 const owned=await m.admitTokens({access_token:await signed(),refresh_token:'original',token_type:'Bearer'},{jwks,principal,baseline:inventory(),current:inventory([existing,session]),now});
 const request=m.logoutRequest(owned,inventory([existing,session]),now);assert.equal(request.url,m.SCOPE.issuer+'/logout?scope=local');assert.equal(request.method,'POST');assert.equal(request.headers.Authorization,'Bearer '+owned.accessToken);assert.equal(request.redirect,'error');assert.equal(request.credentials,'omit');
 assert.throws(()=>m.logoutRequest(owned,inventory([existing]),now),/TEMP_OAUTH_/u);assert.throws(()=>m.logoutRequest(owned,inventory([existing,session]),(owned.expiresAt+1)*1000),/TEMP_OAUTH_/u);assert.throws(()=>m.logoutRequest({...owned,sessionId:''},inventory([existing,session]),now),/TEMP_OAUTH_/u);
 assert.throws(()=>m.logoutRequest(owned,inventory([session]),now),/TEMP_OAUTH_/u);
 assert.deepEqual(m.preservation(owned,inventory([existing,session]),inventory([existing])),{owned_session_absent:true,unrelated_sessions_retained:true,unrelated_sessions:1});
 assert.throws(()=>m.preservation(owned,inventory([existing,session]),inventory([])),/TEMP_OAUTH_/u);assert.throws(()=>m.preservation(owned,inventory([existing,session]),inventory([existing,session])),/TEMP_OAUTH_/u);
 const shortened=inventory([existing]);shortened.sessions[0].not_after='2026-10-01T00:00:00.000Z';assert.throws(()=>m.preservation(owned,inventory([existing,session]),shortened),/TEMP_OAUTH_/u);
 assert.throws(()=>m.preservation(owned,inventory([session]),inventory([])),/TEMP_OAUTH_/u);
 assert.throws(()=>m.expiredBearerRequest(owned,owned.expiresAt*1000-1),/TEMP_OAUTH_/u);assert.equal(m.expiredBearerRequest(owned,owned.expiresAt*1000+1000).headers.Authorization,'Bearer '+owned.accessToken);
});

test('metadata inventory query is bounded read-only and rejects arbitrary principals/truncated/unknown fields',()=>{
 const sql=m.inventorySql(principal);assert(sql.startsWith('begin isolation level repeatable read read only;'));assert(sql.includes('from auth.sessions'));assert(!/refresh_tokens|encrypted|metadata|email|insert|update|delete/iu.test(sql));assert(sql.includes('limit 1025'));assert.throws(()=>m.inventorySql("x';drop table auth.sessions;--"),/TEMP_OAUTH_/u);
 for(const value of[{...inventory(),truncated:true},{...inventory(),count:4},{...inventory(),token:'private'},{...inventory(),sessions:[...inventory().sessions,...inventory().sessions]}])assert.throws(()=>m.inventory(value,principal),/TEMP_OAUTH_/u);
});

test('logout dispatch is permanently claimed and invalidated refresh is attempted only after exact owned-session absence',async()=>{
 const owned=await m.admitTokens({access_token:await signed(),refresh_token:'only_owned_refresh',token_type:'Bearer'},{jwks,principal,baseline:inventory(),current:inventory([existing,session]),now});
 const order=[];await m.localLogout({owned,current:inventory([existing,session]),now,claim:async()=>{order.push('claim');return 'local_claim';},transport:async(url,init)=>{order.push('dispatch');assert.equal(url,m.SCOPE.issuer+'/logout?scope=local');assert.equal(init.headers.Authorization,'Bearer '+owned.accessToken);return new Response(null,{status:204});},complete:async()=>order.push('normal')});assert.deepEqual(order,['claim','dispatch','normal']);
 let calls=0;const ports={owned,current:inventory([existing]),now,metadata,claim:async()=> 'deny_claim',transport:async(url,init)=>{calls++;assert.equal(new URLSearchParams(init.body).get('refresh_token'),owned.refreshToken);return new Response(JSON.stringify({error:'invalid_grant',error_description:'do not expose'}),{status:400,headers:{'content-type':'application/json'}});},persist:async()=>{throw Error('unexpected success');},complete:async()=>{}};
 assert.deepEqual(await m.invalidatedRefresh(ports),{owned_refresh_denied:true,error:'invalid_grant',normal_return:true});assert.equal(calls,1);
 await assert.rejects(()=>m.invalidatedRefresh({...ports,current:inventory([existing,session])}),/TEMP_OAUTH_/u);assert.equal(calls,1);
 assert.throws(()=>m.revokedBearerRequest(owned,inventory([existing,session]),now),/TEMP_OAUTH_/u);assert.equal(m.revokedBearerRequest(owned,inventory([existing]),now).headers.Authorization,'Bearer '+owned.accessToken);
});
