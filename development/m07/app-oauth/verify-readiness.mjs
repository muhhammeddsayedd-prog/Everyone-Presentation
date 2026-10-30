/** Fixed public app-side probes. No OAuth authorization, consent or token call. */
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT=path.resolve(import.meta.dirname,'../../..');
const BASE='http://127.0.0.1:3000';
const CENTRAL='https://pyibofyctwnqpvktepse.supabase.co';
const ISSUER=`${CENTRAL}/auth/v1`;
const RESOURCE=`${BASE}/mcp`;
const PRM=`${BASE}/.well-known/oauth-protected-resource/mcp`;
const DISCOVERY=`${CENTRAL}/.well-known/oauth-authorization-server/auth/v1`;
const hash=b=>createHash('sha256').update(b).digest('hex');
const mode=process.argv[2];
assert(process.argv.length===3&&['baseline','ready'].includes(mode));
let phase='start';
const report={schema_version:'1.0',observed_at:new Date().toISOString(),mode,result:'unverified',scope:'Public fixed-origin metadata, MCP challenge, malformed consent input and consent HTML only; no authorization request, details, approval, token or login',real_credentials_sent:false,claude_code_configuration_or_login:false,provider_mutations:false,hosting_deferred:true,requests:[]};
async function request(label,url,options={}){
 phase=label;
 const response=await fetch(url,{...options,redirect:'manual',signal:AbortSignal.timeout(12000)});
 let bytes=0;const chunks=[];
 if(response.body){const reader=response.body.getReader();try{for(;;){const next=await reader.read();if(next.done)break;bytes+=next.value.length;if(bytes>96*1024)throw Error();chunks.push(next.value);}}finally{await reader.cancel().catch(()=>{});}}
 const raw=Buffer.concat(chunks.map(x=>Buffer.from(x)));
 const contentType=response.headers.get('content-type')?.split(';')[0];
 const entry={label,status:response.status,bytes:raw.length,content_type:['application/json','text/html','text/event-stream'].includes(contentType)?contentType:'other',no_store:(response.headers.get('cache-control')??'').includes('no-store'),set_cookie:response.headers.has('set-cookie')};
 report.requests.push(entry);
 return {response,entry,raw};
}
function json(result){assert((result.response.headers.get('content-type')??'').includes('application/json'));return JSON.parse(result.raw.toString('utf8'));}
function metadata(value){
 assert(value&&typeof value==='object'&&!Array.isArray(value));
 assert.equal(value.issuer,ISSUER);assert.equal(value.authorization_endpoint,`${ISSUER}/oauth/authorize`);assert.equal(value.token_endpoint,`${ISSUER}/oauth/token`);assert.equal(value.jwks_uri,`${ISSUER}/.well-known/jwks.json`);
 assert(Array.isArray(value.response_types_supported)&&value.response_types_supported.includes('code'));assert(Array.isArray(value.code_challenge_methods_supported)&&value.code_challenge_methods_supported.includes('S256'));assert(Array.isArray(value.scopes_supported)&&value.scopes_supported.includes('openid'));
 assert(!value.scopes_supported.includes('offline_access'));
 return {issuer:ISSUER,authorization_endpoint:`${ISSUER}/oauth/authorize`,token_endpoint:`${ISSUER}/oauth/token`,jwks_uri:`${ISSUER}/.well-known/jwks.json`,response_types_supported:['code'],code_challenge_methods_supported:['S256'],scopes_supported:['openid'],offline_access_advertised:false};
}
try{
 const provider=await request('central-discovery',DISCOVERY);
 const resource=await request('protected-resource',PRM);
 const mirrored=await request('app-discovery',`${BASE}/.well-known/oauth-authorization-server`);
 if(mode==='baseline'){
  assert.equal(provider.response.status,404);assert.equal(resource.response.status,404);assert.equal(mirrored.response.status,404);
 }else{
  assert.equal(provider.response.status,200);report.central_metadata=metadata(json(provider));
  assert.equal(resource.response.status,200);const value=json(resource);assert.equal(value.resource,RESOURCE);assert.deepEqual(value.authorization_servers,[ISSUER]);assert.deepEqual(value.scopes_supported,['openid']);assert(resource.entry.no_store&&!resource.entry.set_cookie);report.protected_resource={resource:value.resource,authorization_servers:value.authorization_servers,scopes_supported:value.scopes_supported};
  assert.equal(mirrored.response.status,200);const mirror=json(mirrored);report.app_metadata=metadata(mirror);assert.equal(mirror.registration_endpoint,undefined);assert.deepEqual(mirror.scopes_supported,['openid']);assert(mirrored.entry.no_store&&!mirrored.entry.set_cookie);
  const keys=await request('central-public-jwks',`${ISSUER}/.well-known/jwks.json`);assert.equal(keys.response.status,200);const jwks=json(keys);assert(Array.isArray(jwks.keys)&&jwks.keys.length>0&&jwks.keys.length<=10);report.signing_keys=jwks.keys.map(k=>{assert(k.alg==='ES256'&&k.kty==='EC'&&k.crv==='P-256'||k.alg==='RS256'&&k.kty==='RSA');assert(typeof k.kid==='string'&&/^[A-Za-z0-9_-]{1,200}$/u.test(k.kid));return {kid:k.kid,alg:k.alg,kty:k.kty,...(k.alg==='ES256'?{crv:'P-256'}:{})};});
 }
 const initialize={jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2026-07-28',capabilities:{},clientInfo:{name:'Studio-public-readiness',version:'1'}}};
 const headers={'Content-Type':'application/json',Accept:'application/json, text/event-stream',Origin:BASE,'MCP-Protocol-Version':'2026-07-28'};
 const challenged=await request('unauthenticated-mcp',RESOURCE,{method:'POST',headers,body:JSON.stringify(initialize)});assert.equal(challenged.response.status,401);assert(challenged.entry.no_store&&!challenged.entry.set_cookie);
 if(mode==='ready'){
  const challenge=challenged.response.headers.get('www-authenticate')??'';assert(challenge.includes('Bearer')&&challenge.includes(`resource_metadata="${PRM}"`));report.mcp_challenge={status:401,resource_metadata:PRM};
  const getChallenge=await request('unauthenticated-mcp-get',RESOURCE,{headers:{Accept:'application/json, text/event-stream'}});assert.equal(getChallenge.response.status,401);assert((getChallenge.response.headers.get('www-authenticate')??'').includes(`resource_metadata="${PRM}"`));
  const wrongHost=await request('wrong-host-mcp',RESOURCE,{method:'POST',headers:{...headers,Host:'localhost:3000'},body:JSON.stringify(initialize)});assert.equal(wrongHost.response.status,403);
  const bad=await request('malformed-bearer-mcp',RESOURCE,{method:'POST',headers:{...headers,Authorization:'Bearer synthetic.invalid'},body:JSON.stringify(initialize)});assert.equal(bad.response.status,401);assert((bad.response.headers.get('www-authenticate')??'').includes('invalid_token'));
  const input=await request('invalid-consent-selector',`${BASE}/api/oauth/authorization`,{method:'POST',headers:{'Content-Type':'application/json',Origin:BASE},body:JSON.stringify({authorization_id:'not-a-uuid',request_id:randomUUID(),action:'details'})});assert.equal(input.response.status,400);assert.equal(json(input).error?.code,'VALIDATION_FAILED');
  const csrf=await request('cross-origin-consent-denial',`${BASE}/api/oauth/authorization`,{method:'POST',headers:{'Content-Type':'application/json',Origin:'http://localhost:3118'},body:'{}'});assert.equal(csrf.response.status,403);assert.equal(json(csrf).error?.code,'ACCESS_DENIED');
  const page=await request('consent-page',`${BASE}/oauth/consent`);assert.equal(page.response.status,200);assert((page.entry.content_type??'').includes('text/html'));
 }
 report.result='passed';
}catch{report.failed_phase=phase;report.diagnostic='PUBLIC_APP_READINESS_UNCONFIRMED';process.exitCode=1;}
report.harness_sha256=hash(await readFile(import.meta.filename));report.finished_at=new Date().toISOString();
const directory=path.join(ROOT,'tracking/evidence/m07/app-oauth');await mkdir(directory,{recursive:true});
const file=path.join(directory,`${report.finished_at.replace(/[:.]/gu,'-')}-${randomUUID().slice(0,8)}-${mode}.json`);await writeFile(file,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
process.stdout.write(JSON.stringify({result:report.result,mode,receipt:path.relative(ROOT,file).replaceAll('\\','/'),requests:report.requests.map(x=>({label:x.label,status:x.status})),...(report.failed_phase?{failed_phase:report.failed_phase}:{})})+'\n');
