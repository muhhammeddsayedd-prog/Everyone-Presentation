import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { exportJWK, generateKeyPair, SignJWT, type JWTPayload } from 'jose';
import { createMcpResourceGate, type McpSessionCheck, type McpVerifiedTokenTrace, type McpAuthorizationStageTrace } from '../../apps/web/lib/mcp-auth.ts';
import { readMcpAuthConfig, type McpOAuthConfig } from '../../apps/web/lib/mcp-auth-config.ts';

const origin='https://studio.synthetic.invalid',central='https://central.synthetic.invalid',resource=`${origin}/mcp`,issuer=`${central}/auth/v1`;
const principal='10000000-0000-4000-8000-000000000001',session='20000000-0000-4000-8000-000000000001',otherSession='20000000-0000-4000-8000-000000000002';
const client='f2acafd5-d4b6-4176-b86c-067c57e45ecc',otherClient='30000000-0000-4000-8000-000000000002',trace='40000000-0000-4000-8000-000000000001';
const config=readMcpAuthConfig({MCP_AUTH_MODE:'oauth',MCP_RESOURCE_URL:resource,MCP_AUTH_ISSUER:issuer,MCP_AUTH_CLIENT_IDS:`${client},${otherClient}`},{adapterMode:'supabase',environment:'test',baseUrl:origin},central) as McpOAuthConfig;
const signing=generateKeyPair('ES256').then(async pair=>({...pair,jwk:{...await exportJWK(pair.publicKey),kid:'synthetic-key',alg:'ES256',use:'sig'}}));
const fetcher:typeof fetch=async()=>Response.json({keys:[(await signing).jwk]});
const active:McpSessionCheck=async value=>({active:true,principalId:value.principalId,sessionId:value.sessionId,clientId:value.clientId,capabilities:['projects.read']});
async function token(patch:JWTPayload={},key?:CryptoKey){const now=Math.floor(Date.now()/1000);return new SignJWT({sub:principal,iss:issuer,aud:resource,iat:now,exp:now+300,role:'authenticated',is_anonymous:false,client_id:client,session_id:session,scope:'openid',eps_delegation:{v:1,resource,client_id:client,capabilities:['projects.read']},private_payload:'synthetic-private-payload',...patch}).setProtectedHeader({alg:'ES256',kid:'synthetic-key'}).sign(key??(await signing).privateKey);}
const incoming=(credential?:string)=>new Request(resource,{headers:{host:new URL(origin).host,...(credential?{authorization:`Bearer ${credential}`}:{})}});
const sessionHash=(value:string)=>createHash('sha256').update(value).digest('hex');

test('verified-token event follows signed delegation and live session acceptance with exact privacy projection',async()=>{
 const events:McpVerifiedTokenTrace[]=[],stages:McpAuthorizationStageTrace[]=[];let sessionAccepted=false;
 const iat=Math.floor(Date.now()/1000)-60,exp=iat+300,credential=await token({iat,exp});
 const gate=createMcpResourceGate(config,{fetch:fetcher,checkSession:async input=>{const result=await active(input);sessionAccepted=true;return result;},authorizationTrace:{traceId:trace,log:value=>stages.push(value)},verifiedTokenLog:value=>{assert(sessionAccepted);events.push(value);}});
 assert(!(await gate(incoming(credential)) instanceof Response));assert.deepEqual(events,[{event:'eps.mcp.verified_token',trace_id:trace,client_id:client,session_sha256:sessionHash(session),iat,exp}]);
 assert(stages.every(value=>value.event==='eps.mcp.authorization_stage'&&!Object.hasOwn(value,'session_sha256')));
 const serialized=JSON.stringify(events);for(const secret of[credential,principal,session,'private_payload','synthetic-private-payload',resource,'authorization','eps_delegation'])assert(!serialized.includes(secret));
});

test('denied or insufficient-scope tokens never produce verified-token events',async()=>{
 const events:McpVerifiedTokenTrace[]=[],now=Math.floor(Date.now()/1000);
 const gate=createMcpResourceGate(config,{fetch:fetcher,checkSession:active,authorizationTrace:{traceId:trace,log:()=>{}},verifiedTokenLog:value=>{events.push(value);}});
 const patches:JWTPayload[]=[{exp:now-1},{iat:now+60},{aud:'authenticated'},{iss:'https://attacker.invalid'},{is_anonymous:true},{role:'service_role'},{session_id:'invalid'},{eps_delegation:undefined},{scope:'email'},{client_id:otherClient}];
 for(const patch of patches)assert(await gate(incoming(await token(patch))) instanceof Response);
 assert(await gate(incoming()) instanceof Response);
 assert(await gate(incoming(await token({},(await generateKeyPair('ES256')).privateKey))) instanceof Response);
 assert.deepEqual(events,[]);
});

test('inactive, unavailable, mismatched or malformed current session checks never emit the event',async()=>{
 for(const checkSession of[undefined,async()=>{throw Error('synthetic-private-database-error');},async()=>({active:false,principalId:null,sessionId:null,clientId:null,capabilities:[]}),async(value:Parameters<McpSessionCheck>[0])=>({...await active(value),sessionId:otherSession}),async(value:Parameters<McpSessionCheck>[0])=>({...await active(value),capabilities:['unrecognized.capability']})]){
  const events:unknown[]=[];const gate=createMcpResourceGate(config,{fetch:fetcher,checkSession,authorizationTrace:{traceId:trace,log:()=>{}},verifiedTokenLog:value=>{events.push(value);}});
  assert(await gate(incoming(await token())) instanceof Response);assert.deepEqual(events,[]);
 }
});

test('throwing and rejected observers cannot change successful authorization or disclose sink errors',async()=>{
 for(const verifiedTokenLog of[()=>{throw Error('synthetic-private-sink-error');},async()=>{throw Error('synthetic-private-rejection');}]){
  const gate=createMcpResourceGate(config,{fetch:fetcher,checkSession:active,authorizationTrace:{traceId:trace,log:()=>{}},verifiedTokenLog});
  assert(!(await gate(incoming(await token())) instanceof Response));
 }
 await new Promise(resolve=>setImmediate(resolve));
});

test('session pseudonym and signed times stay request-local when one gate authorizes concurrent sessions',async()=>{
 const events:McpVerifiedTokenTrace[]=[],now=Math.floor(Date.now()/1000);
 const gate=createMcpResourceGate(config,{fetch:fetcher,checkSession:async value=>{await new Promise(resolve=>setImmediate(resolve));return active(value);},authorizationTrace:{traceId:trace,log:()=>{}},verifiedTokenLog:value=>{events.push(value);}});
 const credentials=await Promise.all([token({session_id:session,iat:now-60,exp:now+300}),token({session_id:otherSession,iat:now-30,exp:now+600})]);
 const results=await Promise.all(credentials.map(value=>gate(incoming(value))));assert(results.every(value=>!(value instanceof Response)));
 assert.deepEqual(events.sort((a,b)=>a.iat-b.iat),[{event:'eps.mcp.verified_token',trace_id:trace,client_id:client,session_sha256:sessionHash(session),iat:now-60,exp:now+300},{event:'eps.mcp.verified_token',trace_id:trace,client_id:client,session_sha256:sessionHash(otherSession),iat:now-30,exp:now+600}]);
});

test('another approved client and an absent or malformed trace ID keep normal authorization without lifecycle observation',async()=>{
 const events:unknown[]=[];
 for(const traceId of[undefined,'private-invalid-trace',trace]){
  const gate=createMcpResourceGate(config,{fetch:fetcher,checkSession:active,...(traceId?{authorizationTrace:{traceId,log:()=>{}}}:{}),verifiedTokenLog:value=>{events.push(value);}});
  const credential=traceId===trace?await token({client_id:otherClient,eps_delegation:{v:1,resource,client_id:otherClient,capabilities:['projects.read']}}):await token();
  assert(!(await gate(incoming(credential)) instanceof Response));
 }
 assert.deepEqual(events,[]);
});
