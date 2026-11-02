/** Inert OAuth lifecycle primitives. HTTP/durable ports must be supplied explicitly. */
import { Buffer } from 'node:buffer';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { clearTimeout, setTimeout } from 'node:timers';
import { URL, URLSearchParams } from 'node:url';
import { exchangeAuthorization, refreshAuthorization, startAuthorization } from '@modelcontextprotocol/client';
import { createLocalJWKSet, errors, jwtVerify } from 'jose';

const issuer='https://pyibofyctwnqpvktepse.supabase.co/auth/v1';
export const SCOPE=Object.freeze({issuer,authorize:issuer+'/oauth/authorize',token:issuer+'/oauth/token',jwks:issuer+'/.well-known/jwks.json',
 client:'f2acafd5-d4b6-4176-b86c-067c57e45ecc',callback:'http://localhost:3118/callback',resource:'https://everyone-presentation-pilot.vercel.app/mcp',project:'6da14b82-8458-451f-aa21-28cb6c85bdc5'});
const CLIENT=Object.freeze({client_id:SCOPE.client,token_endpoint_auth_method:'none'}),MAX=65536;
const {Response,AbortController}=globalThis;
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/u,NONZERO=value=>typeof value==='string'&&UUID.test(value)&&value!=='00000000-0000-0000-0000-000000000000';
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const exact=(value,keys)=>object(value)&&Object.keys(value).sort().join(',')===[...keys].sort().join(',');
const need=value=>{if(!value)throw Error('TEMP_OAUTH_ADMISSION_REFUSED');};
const cleanError=()=>Error('TEMP_OAUTH_PHASE_UNCONFIRMED');
const secrets=new WeakSet(),beginnings=new WeakSet(),baselines=new WeakMap();
const sameRow=(a,b)=>a?.id===b?.id&&a?.oauth_client_id===b?.oauth_client_id&&a?.created_at===b?.created_at&&a?.not_after===b?.not_after;
const sameSecret=(a,b)=>typeof a==='string'&&typeof b==='string'&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
const opaque=value=>typeof value==='string'&&value.length>=1&&value.length<=16384&&!/[\r\n\0]/u.test(value);

export function validateMetadata(value){
 need(object(value)&&value.issuer===issuer&&value.authorization_endpoint===SCOPE.authorize&&value.token_endpoint===SCOPE.token&&value.jwks_uri===SCOPE.jwks);
 for(const [key,required]of Object.entries({response_types_supported:['code'],grant_types_supported:['authorization_code','refresh_token'],code_challenge_methods_supported:['S256'],token_endpoint_auth_methods_supported:['none'],scopes_supported:['openid']}))need(Array.isArray(value[key])&&required.every(item=>value[key].includes(item)));
 need(value.authorization_response_iss_parameter_supported===undefined||typeof value.authorization_response_iss_parameter_supported==='boolean');return value;
}
export async function authorization(metadata){
 try{validateMetadata(metadata);const state=randomBytes(32).toString('base64url');const result=await startAuthorization(issuer,{metadata,clientInformation:CLIENT,redirectUrl:SCOPE.callback,scope:'openid',state,resource:SCOPE.resource});
  const value=Object.freeze({...result,state,issuerRequired:metadata.authorization_response_iss_parameter_supported===true});beginnings.add(value);return value;
 }catch{throw cleanError();}
}
export function authorizationTarget(begin){need(beginnings.has(begin));return begin.authorizationUrl.href;}
export function callback(url,begin){
 need(beginnings.has(begin)&&url instanceof URL&&url.origin+url.pathname===SCOPE.callback&&!url.hash&&url.href.length<=8192);
 const keys=[...url.searchParams.keys()];need(new Set(keys).size===keys.length&&keys.every(key=>['code','state','iss','error','error_description','error_uri'].includes(key)));
 need(!url.searchParams.has('error')&&sameSecret(url.searchParams.get('state'),begin.state));const code=url.searchParams.get('code'),iss=url.searchParams.get('iss');
 need(opaque(code)&&(!begin.issuerRequired||iss===issuer)&&(iss===null||iss===issuer));return{code,iss:iss??undefined,verifier:begin.codeVerifier};
}
export function inventory(value,principal){
 need(NONZERO(principal)&&exact(value,['principal_id','sessions','count','truncated','observed_at_ms'])&&value.principal_id===principal&&value.truncated===false&&Number.isSafeInteger(value.observed_at_ms)&&value.observed_at_ms>0&&Array.isArray(value.sessions)&&value.sessions.length<=1024&&value.count===value.sessions.length);
 const ids=new Set();for(const row of value.sessions){need(exact(row,['id','oauth_client_id','created_at','not_after'])&&NONZERO(row.id)&&!ids.has(row.id)&&(row.oauth_client_id===null||NONZERO(row.oauth_client_id))&&typeof row.created_at==='string'&&Number.isFinite(Date.parse(row.created_at))&&(row.not_after===null||typeof row.not_after==='string'&&Number.isFinite(Date.parse(row.not_after))));ids.add(row.id);}return value;
}
export function inventorySql(principal){
 need(NONZERO(principal));return"begin isolation level repeatable read read only;set local search_path='';set local timezone='UTC';set local statement_timeout='15s';select jsonb_build_object('principal_id','"+principal+"','observed_at_ms',floor(extract(epoch from statement_timestamp())*1000)::bigint,'count',count(*),'truncated',count(*)>1024,'sessions',coalesce(jsonb_agg(jsonb_build_object('id',id,'oauth_client_id',oauth_client_id,'created_at',created_at,'not_after',not_after)order by id),'[]'::jsonb))as temporary_oauth_inventory from(select id,oauth_client_id,created_at,not_after from auth.sessions where user_id='"+principal+"'::uuid order by id limit 1025)s;rollback;";
}
const recent=(value,now)=>need(value.observed_at_ms<=now+1000&&now-value.observed_at_ms<=30000);
export async function admitTokens(tokens,{jwks,principal,baseline,current,phase='baseline',now=Date.now()}){
 try{
  need(object(tokens)&&opaque(tokens.access_token)&&opaque(tokens.refresh_token)&&typeof tokens.token_type==='string'&&tokens.token_type.toLowerCase()==='bearer'&&Number.isSafeInteger(now));inventory(baseline,principal);inventory(current,principal);
  need(['baseline','expiry','refresh','logout'].includes(phase));recent(current,now);let p;
  try{({payload:p}=await jwtVerify(tokens.access_token,createLocalJWKSet(jwks),{algorithms:['ES256','RS256'],issuer,audience:SCOPE.resource,currentDate:new Date(now),requiredClaims:['iss','sub','aud','exp','iat','client_id','session_id']}));}
  catch(error){if(['expiry','refresh'].includes(phase)&&error instanceof errors.JWTExpired&&error.claim==='exp')p=error.payload;else throw cleanError();}
  const d=p.eps_delegation;need(p.iss===issuer&&p.sub===principal&&p.aud===SCOPE.resource&&p.client_id===SCOPE.client&&NONZERO(p.session_id)&&p.role==='authenticated'&&p.is_anonymous===false&&Number.isSafeInteger(p.iat)&&Number.isSafeInteger(p.exp)&&p.iat<=now/1000&&p.exp>p.iat&&typeof p.scope==='string'&&p.scope.split(' ').includes('openid'));
  need(exact(d,['v','resource','client_id','capabilities'])&&d.v===1&&d.resource===SCOPE.resource&&d.client_id===SCOPE.client&&Array.isArray(d.capabilities)&&d.capabilities.length<=128&&new Set(d.capabilities).size===d.capabilities.length&&d.capabilities.every(cap=>typeof cap==='string'&&/^[a-z][a-z0-9._]{0,79}$/u.test(cap))&&d.capabilities.includes('projects.read'));
  need(!baseline.sessions.some(row=>row.id===p.session_id));const row=current.sessions.find(item=>item.id===p.session_id);need(row?.oauth_client_id===SCOPE.client&&(row.not_after===null||Date.parse(row.not_after)>now));
  const value=Object.freeze({accessToken:tokens.access_token,refreshToken:tokens.refresh_token,principalId:principal,sessionId:p.session_id,issuedAt:p.iat,expiresAt:p.exp});secrets.add(value);baselines.set(value,baseline.sessions.map(row=>Object.freeze({...row})));return value;
 }catch{throw cleanError();}
}
export function safeClaims(owned){need(secrets.has(owned));return{client_id:SCOPE.client,session_sha256:createHash('sha256').update(owned.sessionId).digest('hex'),iat:owned.issuedAt,exp:owned.expiresAt};}
export async function admitRefreshed(owned,tokens,options){need(secrets.has(owned));inventory(options.baseline,owned.principalId);const prior=baselines.get(owned);need(prior.length===options.baseline.sessions.length&&prior.every(row=>sameRow(row,options.baseline.sessions.find(next=>next.id===row.id))));const next=await admitTokens(tokens,{...options,phase:'baseline'});need(next.principalId===owned.principalId&&next.sessionId===owned.sessionId&&next.issuedAt>owned.issuedAt&&next.expiresAt>owned.expiresAt&&next.accessToken!==owned.accessToken);return next;}

async function readBody(response,signal){
 need(response instanceof Response&&!response.redirected&&response.type!=='opaqueredirect'&&/application\/json(?:\s*;|$)/iu.test(response.headers.get('content-type')??''));const declared=response.headers.get('content-length');need(declared===null||/^\d+$/u.test(declared)&&Number(declared)<=MAX);need(response.body);
 const reader=response.body.getReader(),chunks=[];let bytes=0;try{for(;;){if(signal.aborted)throw cleanError();const part=await reader.read();if(part.done)break;bytes+=part.value.length;need(bytes<=MAX);chunks.push(part.value);}need(bytes>0);return Buffer.concat(chunks).toString('utf8');}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
/** One durable grant claim; SDK receives one bounded response and cannot redispatch. */
export async function grant({phase,metadata,code,iss,verifier,refreshToken,previousAccess,transport,claim,persist,complete}){
 let timer;try{
  validateMetadata(metadata);need(['exchange','refresh'].includes(phase)&&[transport,claim,persist,complete].every(value=>typeof value==='function'));
  if(phase==='refresh')need(opaque(refreshToken)&&opaque(previousAccess));else need(opaque(code)&&typeof verifier==='string'&&/^[A-Za-z0-9._~-]{43,128}$/u.test(verifier));
  const claimed=await claim(phase);need(opaque(claimed));let calls=0,observation;const controller=new AbortController();
  const fetchFn=async(url,init)=>{
   need(++calls===1&&String(url)===SCOPE.token&&init?.method==='POST');const body=new URLSearchParams(init.body),entries=[...body];need(new Set(entries.map(([key])=>key)).size===entries.length);
   const expected=phase==='refresh'?{grant_type:'refresh_token',refresh_token:refreshToken,client_id:SCOPE.client,resource:SCOPE.resource}:{grant_type:'authorization_code',code,code_verifier:verifier,redirect_uri:SCOPE.callback,client_id:SCOPE.client,resource:SCOPE.resource};
   need(exact(Object.fromEntries(entries),Object.keys(expected))&&entries.every(([key,value])=>expected[key]===value));
   const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(cleanError());},10000);});
   const response=await Promise.race([(async()=>{const r=await transport(SCOPE.token,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json'},body:new URLSearchParams(expected),redirect:'error',credentials:'omit',signal:controller.signal});need(r.status>=200&&r.status<300);const raw=await readBody(r,controller.signal),value=JSON.parse(raw);need(object(value));observation={new_refresh_present:Object.hasOwn(value,'refresh_token')&&opaque(value.refresh_token),refresh_changed:opaque(value.refresh_token)&&!sameSecret(value.refresh_token,refreshToken),access_changed:opaque(value.access_token)&&!sameSecret(value.access_token,previousAccess)};return new Response(raw,{status:r.status,headers:{'Content-Type':'application/json'}});})(),deadline]);clearTimeout(timer);return response;
  };
  const options={metadata,clientInformation:CLIENT,resource:SCOPE.resource,fetchFn};const tokens=phase==='refresh'?await refreshAuthorization(issuer,{...options,refreshToken}):await exchangeAuthorization(issuer,{...options,authorizationCode:code,iss,codeVerifier:verifier,redirectUri:SCOPE.callback});
  need(calls===1&&observation);await persist(tokens,{phase,claim:claimed});const rotation=Object.freeze({...observation,proven:phase==='refresh'&&observation.new_refresh_present&&observation.refresh_changed&&observation.access_changed});const safe={phase,normal_return:true,rotation_proven:rotation.proven};await complete(claimed,safe);return{tokens,rotation,safe};
 }catch{throw cleanError();}finally{clearTimeout(timer);}
}
function stillOwned(owned,current,now){need(secrets.has(owned)&&Number.isSafeInteger(now)&&owned.expiresAt>now/1000);inventory(current,owned.principalId);recent(current,now);const row=current.sessions.find(item=>item.id===owned.sessionId);need(row?.oauth_client_id===SCOPE.client&&(row.not_after===null||Date.parse(row.not_after)>now));need(baselines.get(owned).every(prior=>sameRow(prior,current.sessions.find(next=>next.id===prior.id))));}
export function logoutRequest(owned,current,now=Date.now()){
 stillOwned(owned,current,now);return{url:issuer+'/logout?scope=local',method:'POST',headers:{Authorization:'Bearer '+owned.accessToken},redirect:'error',credentials:'omit'};
}
async function deadline(action){let timer;const controller=new AbortController();try{return await Promise.race([action(controller.signal),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(cleanError());},10000);})]);}finally{clearTimeout(timer);}}
export async function localLogout({owned,current,now=Date.now(),transport,claim,complete}){
 try{const {url,...request}=logoutRequest(owned,current,now);need([transport,claim,complete].every(value=>typeof value==='function'));const id=await claim('logout');need(opaque(id));
  const response=await deadline(signal=>transport(url,{...request,signal}));need(response instanceof Response&&!response.redirected&&response.status===204);const safe={owned_local_logout_returned:true,normal_return:true};await complete(id,safe);return safe;
 }catch{throw cleanError();}
}
/** Never reuse a token until current metadata proves this one owned session absent. */
export async function invalidatedRefresh({owned,current,metadata,now=Date.now(),transport,claim,persist,complete}){
 try{need(secrets.has(owned));inventory(current,owned.principalId);recent(current,now);need(!current.sessions.some(row=>row.id===owned.sessionId));validateMetadata(metadata);need([transport,claim,persist,complete].every(value=>typeof value==='function'));
  const id=await claim('denials');need(opaque(id));let calls=0,denied=false;
  const fetchFn=async(url,init)=>{need(++calls===1&&String(url)===SCOPE.token&&init?.method==='POST');const body=new URLSearchParams(init.body);need(body.size===4&&body.get('grant_type')==='refresh_token'&&body.get('refresh_token')===owned.refreshToken&&body.get('client_id')===SCOPE.client&&body.get('resource')===SCOPE.resource);
   return deadline(async signal=>{const response=await transport(SCOPE.token,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json'},body,redirect:'error',credentials:'omit',signal});const raw=await readBody(response,signal),value=JSON.parse(raw);need(object(value));
    if(response.status===400&&value.error==='invalid_grant'){denied=true;return new Response('{"error":"invalid_grant"}',{status:400,headers:{'Content-Type':'application/json'}});}need(response.status>=200&&response.status<300);return new Response(raw,{status:response.status,headers:{'Content-Type':'application/json'}});
   });
  };
  try{const tokens=await refreshAuthorization(issuer,{metadata,clientInformation:CLIENT,refreshToken:owned.refreshToken,resource:SCOPE.resource,fetchFn});await persist(tokens,{phase:'denials',claim:id});throw cleanError();}catch{need(denied&&calls===1);}
  const safe={owned_refresh_denied:true,error:'invalid_grant',normal_return:true};await complete(id,safe);return safe;
 }catch{throw cleanError();}
}
function bearerRequest(owned){need(secrets.has(owned));return{url:SCOPE.resource,method:'POST',headers:{Authorization:'Bearer '+owned.accessToken,'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:randomUUID(),method:'tools/call',params:{name:'get_project',arguments:{project_id:SCOPE.project}}}),redirect:'error',credentials:'omit'};}
export function expiredBearerRequest(owned,now=Date.now()){need(Number.isSafeInteger(now)&&now>=owned.expiresAt*1000+1000);return bearerRequest(owned);}
export function revokedBearerRequest(owned,current,now=Date.now()){need(secrets.has(owned)&&owned.expiresAt>now/1000);inventory(current,owned.principalId);recent(current,now);need(!current.sessions.some(row=>row.id===owned.sessionId));return bearerRequest(owned);}
export function preservation(owned,before,after){
 need(secrets.has(owned));inventory(before,owned.principalId);inventory(after,owned.principalId);need(before.sessions.some(row=>row.id===owned.sessionId)&&!after.sessions.some(row=>row.id===owned.sessionId));
 const unrelated=before.sessions.filter(row=>row.id!==owned.sessionId);need(baselines.get(owned).every(row=>sameRow(row,unrelated.find(next=>next.id===row.id))));need(unrelated.every(row=>sameRow(row,after.sessions.find(next=>next.id===row.id))));return{owned_session_absent:true,unrelated_sessions_retained:true,unrelated_sessions:unrelated.length};
}
