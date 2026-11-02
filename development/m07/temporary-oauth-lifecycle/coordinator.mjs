/** Concrete phase coordinator. CLI/live entry is disabled before any private/provider access. */
import { Buffer } from 'node:buffer';
import { spawn } from 'node:child_process';
import { createHash,randomUUID } from 'node:crypto';
import { mkdir,writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { clearTimeout,setTimeout } from 'node:timers';
import { pathToFileURL,URL } from 'node:url';
import { Client,StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import * as core from './core.mjs';
import { ownerCallback } from './coordinator_callback.mjs';
export const LIVE_ENABLED=false;
const {Response,Request,Headers,AbortController}=globalThis;
const ROOT='D:/Everyone/Presentation/Everyone-Presentation-Studio',HERE=import.meta.dirname;
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/u;
const PHASES=['prepare','authorize','expiry','refresh','logout','cleanup'];
const DISCOVERY='https://pyibofyctwnqpvktepse.supabase.co/.well-known/oauth-authorization-server/auth/v1';
const RESOURCE_METADATA='https://everyone-presentation-pilot.vercel.app/.well-known/oauth-protected-resource/mcp';
const need=value=>{if(!value)throw Error('TEMP_OAUTH_COORDINATOR_REFUSED');};
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const canonical=value=>JSON.stringify(value,(_,item)=>record(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a<b?-1:a>b?1:0)):item);
const digest=value=>createHash('sha256').update(canonical(value)).digest('hex');
const equal=(a,b)=>need(canonical(a)===canonical(b));
const exact=(value,keys)=>record(value)&&Object.keys(value).sort().join(',')===[...keys].sort().join(',');
async function bounded(action,milliseconds=10000){let timer;const controller=new AbortController();try{return await Promise.race([action(controller.signal),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('TEMP_OAUTH_COORDINATOR_UNCONFIRMED'));},milliseconds);})]);}finally{clearTimeout(timer);}}
async function wire(response,maximum=65536){need(response instanceof Response&&!response.redirected&&response.body);const reader=response.body.getReader();let bytes=0;const chunks=[];try{for(;;){const next=await reader.read();if(next.done)break;bytes+=next.value.byteLength;need(bytes<=maximum);chunks.push(next.value);}return Buffer.concat(chunks);}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}}
function tokenFields(tokens){return Object.fromEntries(['access_token','refresh_token','token_type','expires_in','scope','id_token'].filter(key=>tokens[key]!==undefined).map(key=>[key,tokens[key]]));}
function rows(value){return [...value.sessions].sort((a,b)=>a.id.localeCompare(b.id));}

export function preflight(value){
 need(exact(value,['database','operator','history39','client_id','client_count','public_none','callback','grants','resource','enabled_resources','owner','capability','membership']));
 need(value.database==='postgres'&&value.operator==='postgres'&&value.client_id===core.SCOPE.client&&value.client_count===1&&value.enabled_resources===1);
 for(const key of['history39','public_none','callback','grants','resource','owner','capability','membership'])need(value[key]===true);return true;
}

export class Coordinator{
 constructor(run,ports){need(UUID.test(run)&&record(ports));this.run=run;this.p=ports;}
 async verify(){
  const context=await this.p.context();need(context.run===this.run&&UUID.test(context.principal)&&/^sb_publishable_[A-Za-z0-9_-]{8,4096}$/u.test(context.publishable_key)&&record(context.source_pins));equal(context.source_pins,await this.p.seal());
  if(this.context)equal(this.context,context);else this.context=context;return context;
 }
 binding(){const d=this.context.deployment;return{client_id:core.SCOPE.client,resource:core.SCOPE.resource,project_id:core.SCOPE.project,app_deployment_id:d.id,app_source_commit:d.meta.epsSourceCommit,app_source_manifest:d.meta.epsSourceManifest,coordinator_source_sha256:digest(this.context.source_pins),session_source:'temporary_operator_SDK'};}
 async current(){const value=await this.p.inventory();core.inventory(value,this.context.principal);return value;}
 async serving(){const a=await this.p.deployment('everyone-presentation-pilot.vercel.app'),b=await this.p.deployment(this.context.deployment.id);equal(a,this.context.deployment);equal(b,a);}
 async claim(phase){need(PHASES.includes(phase)&&!await this.p.exists(phase+'.claim'));const value={v:1,run:this.run,phase,id:randomUUID(),context_sha256:digest(this.context),automatic_retry:false};await this.p.create(phase+'.claim',value);return value;}
 async normal(claim,proof){await this.verify();await this.p.create(claim.phase+'.normal',{...claim,normal_return:true,proof});return proof;}
 async prior(phase){const c=await this.p.read(phase+'.claim'),n=await this.p.read(phase+'.normal');need(c.run===this.run&&c.phase===phase&&c.context_sha256===digest(this.context));equal({...c,normal_return:true,proof:n.proof},n);return n.proof;}
 native(method,value={}){return this.p.native(method,value);}
 async transport(url,init){await this.verify();return this.p.http(url,init);}
 grantPorts(){return{transport:(url,init)=>this.transport(url,init),claim:phase=>this.native('claim',{phase}),persist:(tokens,{phase,claim})=>this.native('persist',{phase,claim,tokens:tokenFields(tokens)}),complete:(claim,safe)=>this.native('normal',{phase:safe.phase,claim,generation:safe.phase==='exchange'?'generation-1.json':'generation-2.json'})};}
 async publicJSON(url){return bounded(async signal=>{const r=await this.transport(url,{method:'GET',redirect:'error',credentials:'omit',cache:'no-store',signal});need(r.status===200&&/application\/json/iu.test(r.headers.get('content-type')??''));return JSON.parse((await wire(r)).toString('utf8'));});}
 async prepare(){
  await this.verify();const claim=await this.claim('prepare');await this.serving();preflight(await this.p.preflight());
  const metadata=core.validateMetadata(await this.publicJSON(DISCOVERY)),resource=await this.publicJSON(RESOURCE_METADATA),jwks=await this.publicJSON(core.SCOPE.jwks);
  need(resource.resource===core.SCOPE.resource&&Array.isArray(resource.authorization_servers)&&resource.authorization_servers.length===1&&resource.authorization_servers[0]===core.SCOPE.issuer&&Array.isArray(resource.scopes_supported)&&resource.scopes_supported.length===1&&resource.scopes_supported[0]==='openid'&&record(jwks)&&Array.isArray(jwks.keys)&&jwks.keys.length>=1&&jwks.keys.length<=16);
  const baseline=await this.current();await this.p.create('plan',{v:1,run:this.run,context_sha256:digest(this.context),metadata,jwks,baseline});
  return this.normal(claim,{result:'prepared',...this.binding(),baseline_sessions:baseline.count,provider_mutations:false});
 }
 async plan(){const value=await this.p.read('plan');need(value.run===this.run&&value.context_sha256===digest(this.context));core.validateMetadata(value.metadata);core.inventory(value.baseline,this.context.principal);return value;}
 async admitted(tokens,plan,phase='baseline',current){return core.admitTokens(tokens,{jwks:plan.jwks,principal:this.context.principal,baseline:plan.baseline,current:current??await this.current(),phase,now:this.p.now()});}
 async readProject(owned){
  let calls=0;const methods=new Set();const client=new Client({name:'eps-temporary-oauth-lifecycle',version:'1.0.0'},{versionNegotiation:{mode:'legacy'}});
  const fetch=async(input,init)=>bounded(async signal=>{
   const req=new Request(input,init);need(req.url===core.SCOPE.resource&&req.method==='POST'&&req.headers.get('authorization')==='Bearer '+owned.accessToken&&++calls<=3);const raw=await req.text();need(Buffer.byteLength(raw)<=16384);const body=JSON.parse(raw);need(['initialize','notifications/initialized','tools/call'].includes(body.method)&&!methods.has(body.method));methods.add(body.method);
   if(body.method==='tools/call')need(body.params.name==='get_project'&&exact(body.params.arguments,['project_id'])&&body.params.arguments.project_id===core.SCOPE.project);
   const response=await this.transport(core.SCOPE.resource,{method:'POST',headers:req.headers,body:raw,redirect:'error',credentials:'omit',signal});need(!response.headers.has('mcp-session-id'));
   if(response.status===202||response.status===204)return new Response(null,{status:response.status,headers:response.headers});const bytes=await wire(response,1024*1024);return new Response(bytes,{status:response.status,headers:response.headers});
  });
  const transport=new StreamableHTTPClientTransport(new URL(core.SCOPE.resource),{requestInit:{headers:{authorization:'Bearer '+owned.accessToken}},fetch});
  try{await client.connect(transport);const result=await client.callTool({name:'get_project',arguments:{project_id:core.SCOPE.project}});const value=result.structuredContent;need(!result.isError&&record(value)&&UUID.test(value.request_id)&&record(value.data)&&value.data.id===core.SCOPE.project&&methods.has('tools/call'));return{request_id:value.request_id,project_id:core.SCOPE.project,success:true};}finally{await client.close();}
 }
 async authorize(){
  await this.verify();await this.prior('prepare');const ready=await this.p.read('ready');need(exact(ready,['run','owner_ready','context_sha256'])&&ready.run===this.run&&ready.owner_ready===true&&ready.context_sha256===digest(this.context));await this.serving();preflight(await this.p.preflight());const plan=await this.plan(),claim=await this.claim('authorize'),begin=await core.authorization(plan.metadata);
  await this.p.create('ownership',{v:1,run:this.run,source:'pending_owner_controlled_consent',code_verifier:begin.codeVerifier,state:begin.state});
  const result=await this.p.ownerCallback({begin,claim:phase=>this.native('claim',{phase}),onReady:url=>this.p.ownerReady(url),onCode:async code=>{
   const grant=await core.grant({phase:'exchange',metadata:plan.metadata,...this.grantPorts(),code:code.code,iss:code.iss,verifier:code.verifier});const owned=await this.admitted(grant.tokens,plan);const read=await this.readProject(owned);const proof={session_id:owned.sessionId,principal_id:owned.principalId,claims:core.safeClaims(owned),read,original_baseline_sha256:digest(plan.baseline)};await this.p.create('initial',proof);return proof;
  }});
  await this.native('normal',{phase:'authorize',claim:result.authorize_claim});const proof=result.value;
  return this.normal(claim,{result:'authorized',...this.binding(),claims:proof.claims,read:proof.read,wait_until:new Date((proof.claims.exp+1)*1000).toISOString()});
 }
 async probe(request){return bounded(async signal=>{const {url,...init}=request;const response=await this.transport(url,{...init,signal});need(response.status===401&&/\bBearer\b/iu.test(response.headers.get('www-authenticate')??'')&&/error="invalid_token"/u.test(response.headers.get('www-authenticate')??''));if(response.body)await wire(response);return{status:401,error:'invalid_token',automatic_refresh:false};});}
 async expiry(){
  await this.verify();const initial=await this.prior('authorize');if(this.p.now()<(initial.claims.exp+1)*1000)return{result:'waiting',...this.binding(),wait_until:new Date((initial.claims.exp+1)*1000).toISOString(),phase_claim_created:false};
  await this.serving();preflight(await this.p.preflight());const plan=await this.plan(),stored=await this.native('read',{name:'generation-1.json'}),owned=await this.admitted(stored.tokens,plan,'expiry');equal(core.safeClaims(owned),initial.claims);const claim=await this.claim('expiry'),id=await this.native('claim',{phase:'expiry'});const denial=await this.probe(core.expiredBearerRequest(owned,this.p.now()));await this.native('normal',{phase:'expiry',claim:id});return this.normal(claim,{result:'expired_bearer_denied',...this.binding(),claims:initial.claims,denial,observed_at:new Date(this.p.now()).toISOString()});
 }
 async refresh(){
  await this.verify();await this.prior('expiry');await this.serving();preflight(await this.p.preflight());const plan=await this.plan(),initial=await this.p.read('initial'),stored=await this.native('read',{name:'generation-1.json'}),owned=await this.admitted(stored.tokens,plan,'refresh');equal(core.safeClaims(owned),initial.claims);const claim=await this.claim('refresh');
  const grant=await core.grant({phase:'refresh',metadata:plan.metadata,...this.grantPorts(),refreshToken:owned.refreshToken,previousAccess:owned.accessToken});const next=await core.admitRefreshed(owned,grant.tokens,{jwks:plan.jwks,principal:this.context.principal,baseline:plan.baseline,current:await this.current(),now:this.p.now()});need(grant.rotation.proven);const read=await this.readProject(next),proof={session_id:next.sessionId,claims:core.safeClaims(next),read,rotation:grant.rotation};await this.p.create('refreshed',proof);
  return this.normal(claim,{result:'refreshed',...this.binding(),claims:proof.claims,read,rotation_proven:true});
 }
 async logout(){
  await this.verify();const refreshed=await this.prior('refresh');await this.serving();preflight(await this.p.preflight());const plan=await this.plan(),tokens=await this.native('read',{name:'generation-2.json'}),before=await this.current(),owned=await this.admitted(tokens.tokens,plan,'logout',before);equal(core.safeClaims(owned),refreshed.claims);const claim=await this.claim('logout');
  await core.localLogout({owned,current:before,now:this.p.now(),transport:(url,init)=>this.transport(url,init),claim:phase=>this.native('claim',{phase}),complete:id=>this.native('normal',{phase:'logout',claim:id})});
  const first=await this.current(),second=await this.current();equal(rows(first),rows(second));const preservation=core.preservation(owned,before,second);const refreshDenial=await core.invalidatedRefresh({owned,current:second,metadata:plan.metadata,now:this.p.now(),transport:(url,init)=>this.transport(url,init),claim:phase=>this.native('claim',{phase}),persist:(value,{phase,claim:id})=>this.native('persist',{phase,claim:id,tokens:tokenFields(value)}),complete:id=>this.native('normal',{phase:'denials',claim:id})});
  const bearerDenial=await this.probe(core.revokedBearerRequest(owned,await this.current(),this.p.now()));const last=await this.current();core.preservation(owned,before,last);equal(rows(second),rows(last));const proof={result:'protocol_passed',...this.binding(),claims:core.safeClaims(owned),owned_local_logout:true,two_independent_absence_readbacks:true,preservation,refresh_denial:refreshDenial,bearer_denial:bearerDenial,actual_Claude_observed:false,unrelated_Claude_access_requires_separate_owner_read:true};await this.p.create('complete',proof);return this.normal(claim,proof);
 }
 async cleanup(){
  await this.verify();await this.prior('prepare');await this.serving();preflight(await this.p.preflight());const plan=await this.plan(),stored=await this.p.latestTokens(),before=await this.current();
  // A current, signature-verified new session is required. Lost/expired tokens
  // and consumed logout claims never gain a replay or a broader fallback.
  const owned=await this.admitted(stored.tokens,plan,'logout',before);if(await this.p.exists('initial'))need((await this.p.read('initial')).session_id===owned.sessionId);const status=await this.native('inspect',{phase:'logout'});need(status.state==='not_dispatched');const claim=await this.claim('cleanup');
  await core.localLogout({owned,current:before,now:this.p.now(),transport:(url,init)=>this.transport(url,init),claim:phase=>this.native('claim',{phase}),complete:id=>this.native('normal',{phase:'logout',claim:id})});const first=await this.current(),second=await this.current();equal(rows(first),rows(second));const preservation=core.preservation(owned,before,second);return this.normal(claim,{result:'cleanup_passed',...this.binding(),owned_session_absent:true,preservation,protocol_acceptance:false,original_failed_phase_not_repaired:true});
 }
 async reconcile(){
  await this.verify();const phases=[];for(const phase of PHASES){const hasClaim=await this.p.exists(phase+'.claim'),hasNormal=await this.p.exists(phase+'.normal');need(hasClaim||!hasNormal);if(hasNormal)await this.prior(phase);phases.push({phase,state:hasNormal?'normal_return_recorded':hasClaim?'unknown_no_replay':'not_dispatched'});}
  await this.serving();preflight(await this.p.preflight());const current=await this.current();let absence=null;if(await this.p.exists('initial')){const initial=await this.p.read('initial');need(UUID.test(initial.session_id)&&initial.principal_id===this.context.principal);const plan=await this.plan();need(!plan.baseline.sessions.some(row=>row.id===initial.session_id));absence=!current.sessions.some(row=>row.id===initial.session_id);}
  return{result:'observed_only',...this.binding(),phases,owned_session_absent:absence,normal_return_not_inferred:true,automatic_retry:false,mutation_dispatched:false};
 }
 async execute(action){try{need([...PHASES,'reconcile'].includes(action));return await this[action]();}catch{return{result:'unconfirmed',action,safe_error_code:'TEMP_OAUTH_COORDINATOR_UNCONFIRMED',automatic_retry:false,normal_return_not_inferred:true,session_source:'temporary_operator_SDK'};}}
}

export function nativePorts(run){
 const requireCleanEnvironment=()=>{for(const key of['DEBUG','NODE_DEBUG','NODE_DEBUG_NATIVE','NODE_OPTIONS','NODE_TLS_REJECT_UNAUTHORIZED','NODE_EXTRA_CA_CERTS','SUPABASE_ACCESS_TOKEN','SUPABASE_DB_PASSWORD','VERCEL_TOKEN','DATABASE_URL','PGPASSWORD'])need(!process.env[key]);};
 const environment=Object.fromEntries(['PATH','PATHEXT','COMSPEC','SystemRoot','WINDIR','USERPROFILE','APPDATA','LOCALAPPDATA','HOMEDRIVE','HOMEPATH','TEMP','TMP','LANG'].filter(key=>process.env[key]!==undefined).map(key=>[key,process.env[key]]));
 const bridge=async(operation,value={})=>new Promise((resolve,reject)=>{
  if(operation!=='seal')requireCleanEnvironment();
  const child=spawn(path.join(ROOT,'.venv-skills/Scripts/python.exe'),['-X','utf8','-B',path.join(HERE,'coordinator_bridge.py')],{cwd:ROOT,env:environment,windowsHide:true,shell:false,stdio:['pipe','pipe','pipe']});let output='',errorBytes=0,failed=false;const timer=setTimeout(()=>{failed=true;child.kill();},90000);
  child.on('error',()=>{failed=true;});child.stdout.on('data',raw=>{output+=raw;if(Buffer.byteLength(output)>2*1024*1024){failed=true;child.kill();}});child.stderr.on('data',raw=>{errorBytes+=raw.length;if(errorBytes>65536){failed=true;child.kill();}});child.stdin.on('error',()=>{failed=true;});
  child.on('close',code=>{clearTimeout(timer);try{need(!failed&&code===0);const result=JSON.parse(output);need(exact(result,['ok','value'])&&result.ok===true);resolve(result.value);}catch{reject(Error('TEMP_OAUTH_PRIVATE_BRIDGE_UNCONFIRMED'));}});child.stdin.end(JSON.stringify({operation,...(operation==='seal'?{}:{run}),...value}));
 });
 let context;return{now:()=>Date.now(),context:async()=>context=await bridge('context'),seal:()=>bridge('seal'),read:name=>bridge('read',{name}),exists:name=>bridge('exists',{name}),create:(name,value)=>bridge('create',{name,value}),native:(method,value)=>bridge('native',{method,...value}),latestTokens:()=>bridge('latest_tokens'),preflight:()=>bridge('preflight'),inventory:()=>bridge('inventory'),deployment:identity=>bridge('deployment',{identity}),ownerCallback,ownerReady:url=>{need(url==='http://localhost:3118/start');process.stderr.write('Owner browser handoff: http://localhost:3118/start\n');},
  http:(url,init)=>{need(context&&[DISCOVERY,RESOURCE_METADATA,core.SCOPE.jwks,core.SCOPE.token,core.SCOPE.resource,core.SCOPE.issuer+'/logout?scope=local'].includes(String(url)));const headers=new Headers(init.headers);if(String(url)===core.SCOPE.issuer+'/logout?scope=local')headers.set('apikey',context.publishable_key);return globalThis.fetch(url,{...init,headers,redirect:'error',credentials:'omit',cache:'no-store'});}};
}
export async function live(action,run,ports){need(LIVE_ENABLED);return new Coordinator(run,ports??nativePorts(run)).execute(action);}
async function main(){
 const [action,run]=process.argv.slice(2);if(action==='seal'&&run===undefined){const pins=await nativePorts('').seal();process.stdout.write(JSON.stringify({source_pins:pins})+'\n');return;}
 need(process.argv.length===4&&[...PHASES,'reconcile'].includes(action)&&UUID.test(run));const value=await live(action,run);const directory=path.join(ROOT,'tracking/evidence/m07/temporary-oauth-lifecycle-coordinator');await mkdir(directory,{recursive:true});const name=new Date().toISOString().replaceAll(':','-')+'-'+run.slice(0,8)+'-'+action+'.json';await writeFile(path.join(directory,name),JSON.stringify({schema_version:'1.0',run,observed_at:new Date().toISOString(),action,...value},null,2)+'\n',{flag:'wx'});process.stdout.write(JSON.stringify({result:value.result,receipt:'tracking/evidence/m07/temporary-oauth-lifecycle-coordinator/'+name})+'\n');if(value.result==='unconfirmed')process.exitCode=1;
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)main().catch(()=>{process.stderr.write('TEMP_OAUTH_COORDINATOR_UNCONFIRMED\n');process.exitCode=1;});
