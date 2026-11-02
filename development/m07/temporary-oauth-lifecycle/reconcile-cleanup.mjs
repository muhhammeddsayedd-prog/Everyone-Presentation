/** New read-only purpose; frozen lifecycle source and claims remain untouched. */
import { Buffer } from 'node:buffer';
import { createHash,randomUUID } from 'node:crypto';
import { lstat,mkdir,readFile,realpath,writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath,pathToFileURL } from 'node:url';
import { createLocalJWKSet,jwtVerify } from 'jose';
import { Coordinator,nativePorts,preflight } from './coordinator.mjs';
import * as core from './core.mjs';
export const READ_ENABLED=true;
const {Headers}=globalThis;
const ROOT='D:/Everyone/Presentation/Everyone-Presentation-Studio',ENTRY='development/m07/temporary-oauth-lifecycle/reconcile-cleanup.mjs';
const RUN='402aca12-60e1-464e-8573-c48958c3ab1f',DEPLOYMENT='dpl_J3hmctcHndRp8zDVAPYfcnjEgpzG',SOURCE='c88f58c00820169f7396d72def77a74f1443594e',MANIFEST='f947fb53479d991b382bd50bf39e32a4e56dd17598470b209f2a185ed9f58d0a';
const PIN_KEYS=['entry_sha256','coordinator_sha256','core_sha256','jose_entry_sha256','jose_verify_sha256','jose_local_jwks_sha256','jose_package_sha256'];
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/u,NONZERO=value=>typeof value==='string'&&UUID.test(value)&&value!=='00000000-0000-0000-0000-000000000000';
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const need=value=>{if(!value)throw Error('TEMP_OAUTH_CLEANUP_RECONCILIATION_UNCONFIRMED');};
const exact=(value,keys)=>object(value)&&Object.keys(value).sort().join(',')===[...keys].sort().join(',');
const canonical=value=>JSON.stringify(value,(_,item)=>object(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a<b?-1:a>b?1:0)):item);
const sha=value=>createHash('sha256').update(value).digest('hex'),digest=value=>sha(canonical(value));
const equal=(a,b)=>need(canonical(a)===canonical(b));
const rows=value=>[...value.sessions].sort((a,b)=>a.id.localeCompare(b.id));
const opaque=value=>typeof value==='string'&&value.length>=1&&value.length<=16384&&!/[\r\n\0]/u.test(value);

export function exactBaseline(value,baseline,principal,owned,now){
 core.inventory(baseline,principal);core.inventory(value,principal);need(NONZERO(owned)&&Number.isSafeInteger(now));
 need(baseline.count===5&&value.count===5&&value.observed_at_ms<=now+1000&&now-value.observed_at_ms<=30000);
 need(!baseline.sessions.some(row=>row.id===owned)&&!value.sessions.some(row=>row.id===owned));equal(rows(value),rows(baseline));return true;
}
function readonlyPorts(ports,state){
 const output={};for(const key of['now','context','seal','read','exists','preflight','inventory','deployment','latestTokens']){need(typeof ports[key]==='function');output[key]=(...args)=>ports[key](...args);}
 output.native=(method,value)=>{need(['read','inspect'].includes(method));if(method==='read')need(exact(value,['name'])&&value.name==='generation-2.json');else need(exact(value,['phase'])&&['logout','denials'].includes(value.phase));return ports.native(method,value);};
 output.http=(url,init)=>{
  const target=String(url);need(init&&init.redirect==='error'&&init.credentials==='omit');
  if(target===core.SCOPE.jwks&&init.method==='GET'){need(++state.jwks===1);return ports.http(url,init);}
  need(target===core.SCOPE.resource&&init.method==='POST'&&opaque(state.accessToken)&&++state.probe===1);
  const headers=new Headers(init.headers);need(headers.get('authorization')==='Bearer '+state.accessToken&&headers.get('content-type')==='application/json'&&!headers.has('cookie')&&!headers.has('apikey'));
  need(typeof init.body==='string'&&Buffer.byteLength(init.body)<=16384);const body=JSON.parse(init.body);
  need(exact(body,['jsonrpc','id','method','params'])&&body.jsonrpc==='2.0'&&UUID.test(body.id)&&body.method==='tools/call'&&exact(body.params,['name','arguments'])&&body.params.name==='get_project'&&exact(body.params.arguments,['project_id'])&&body.params.arguments.project_id===core.SCOPE.project);
  state.requestId=body.id;return ports.http(url,init);
 };
 for(const key of['create','ownerCallback','ownerReady'])output[key]=()=>{throw Error('TEMP_OAUTH_CLEANUP_MUTATION_FORBIDDEN');};return output;
}
export class CleanupReconciliation{
 constructor(run,purpose,ports,executionPins){need(UUID.test(run)&&UUID.test(purpose)&&purpose!==run&&typeof executionPins==='function');this.run=run;this.purpose=purpose;this.state={jwks:0,probe:0,accessToken:null};this.executionPins=executionPins;this.c=new Coordinator(run,readonlyPorts(ports,this.state));this.stage='source_admission';this.started=false;}
 async execute(){
  if(this.started)return{schema_version:'1.0',scope:'cleanup_and_bearer_denial_reconciliation',result:'unconfirmed',purpose_id:this.purpose,run:this.run,stage:'execution_already_attempted',automatic_retry:false,auth_token_logout_requests:0,claims_or_private_generations_written:0,full_protocol_verified:false};this.started=true;
  try{
   const c=this.c,p=c.p,execution=await this.executionPins();need(exact(execution,PIN_KEYS)&&Object.values(execution).every(value=>typeof value==='string'&&/^[a-f0-9]{64}$/u.test(value)));
   await c.verify();need(Object.keys(c.context.source_pins).length===39&&Object.values(c.context.source_pins).every(value=>/^[a-f0-9]{64}$/u.test(value)));need(execution.coordinator_sha256===c.context.source_pins['coordinator.mjs']&&execution.core_sha256===c.context.source_pins['core.mjs']);
   need(c.context.deployment.id===DEPLOYMENT&&c.context.deployment.meta.epsSourceCommit===SOURCE&&c.context.deployment.meta.epsSourceManifest===MANIFEST);
   this.stage='phase_records';await c.prior('prepare');const authorized=await c.prior('authorize');await c.prior('expiry');const refreshedNormal=await c.prior('refresh');
   need(await p.exists('logout.claim')&&!await p.exists('logout.normal'));const outer=await p.read('logout.claim');need(outer.run===this.run&&outer.phase==='logout'&&outer.context_sha256===digest(c.context)&&outer.automatic_retry===false&&UUID.test(outer.id));
   equal(await c.native('inspect',{phase:'logout'}),{phase:'logout',state:'normal_return_recorded'});equal(await c.native('inspect',{phase:'denials'}),{phase:'denials',state:'unknown_no_replay'});
   const stored=await c.native('read',{name:'generation-2.json'}),latest=await p.latestTokens();need(stored.run===this.run&&stored.phase==='refresh'&&latest.phase==='refresh');equal(stored,latest);
   const plan=await c.plan(),initial=await p.read('initial'),refreshed=await p.read('refreshed');need(plan.baseline.count===5&&NONZERO(initial.session_id)&&initial.principal_id===c.context.principal&&refreshed.session_id===initial.session_id);
   this.stage='serving_preflight';await c.serving();preflight(await p.preflight());
   this.stage='fresh_jwks';const jwks=await c.publicJSON(core.SCOPE.jwks);need(object(jwks)&&Array.isArray(jwks.keys)&&jwks.keys.length>=1&&jwks.keys.length<=16);
   this.stage='signed_generation2';const tokens=stored.tokens;need(object(tokens)&&opaque(tokens.access_token)&&opaque(tokens.refresh_token)&&typeof tokens.token_type==='string'&&tokens.token_type.toLowerCase()==='bearer');const now=p.now();need(Number.isSafeInteger(now));
   const {payload}=await jwtVerify(tokens.access_token,createLocalJWKSet(jwks),{algorithms:['ES256','RS256'],issuer:core.SCOPE.issuer,audience:core.SCOPE.resource,currentDate:new Date(now),requiredClaims:['iss','sub','aud','iat','exp','client_id','session_id']});
   need(payload.iss===core.SCOPE.issuer&&payload.sub===c.context.principal&&payload.aud===core.SCOPE.resource&&payload.client_id===core.SCOPE.client&&NONZERO(payload.session_id)&&payload.session_id===initial.session_id&&payload.session_id===refreshed.session_id&&payload.role==='authenticated'&&payload.is_anonymous===false);
   need(Number.isSafeInteger(payload.iat)&&Number.isSafeInteger(payload.exp)&&payload.iat<=now/1000&&payload.exp>payload.iat&&payload.exp>now/1000&&typeof payload.scope==='string'&&payload.scope.split(' ').includes('openid'));
   const d=payload.eps_delegation;need(exact(d,['v','resource','client_id','capabilities'])&&d.v===1&&d.resource===core.SCOPE.resource&&d.client_id===core.SCOPE.client&&Array.isArray(d.capabilities)&&d.capabilities.length<=128&&new Set(d.capabilities).size===d.capabilities.length&&d.capabilities.every(cap=>typeof cap==='string'&&/^[a-z][a-z0-9._]{0,79}$/u.test(cap))&&d.capabilities.includes('projects.read'));
   const claims={client_id:core.SCOPE.client,session_sha256:sha(payload.session_id),iat:payload.iat,exp:payload.exp};equal(claims,refreshed.claims);equal(claims,refreshedNormal.claims);equal(initial.claims,authorized.claims);need(initial.claims.session_sha256===claims.session_sha256&&initial.claims.iat<claims.iat&&initial.claims.exp<claims.exp);need(initial.original_baseline_sha256===digest(plan.baseline));
   this.stage='two_complete_inventories';const first=await c.current();exactBaseline(first,plan.baseline,c.context.principal,payload.session_id,p.now());const second=await c.current();exactBaseline(second,plan.baseline,c.context.principal,payload.session_id,p.now());need(second.observed_at_ms>=first.observed_at_ms);equal(rows(first),rows(second));
   this.stage='one_bearer_probe';need(p.now()<payload.exp*1000);this.state.accessToken=tokens.access_token;const probeStarted=p.now();const denial=await c.probe({url:core.SCOPE.resource,method:'POST',headers:{Authorization:'Bearer '+tokens.access_token,'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:randomUUID(),method:'tools/call',params:{name:'get_project',arguments:{project_id:core.SCOPE.project}}}),redirect:'error',credentials:'omit'});const probeFinished=p.now();need(probeFinished<payload.exp*1000&&this.state.probe===1);
   this.stage='final_complete_inventory';const final=await c.current();exactBaseline(final,plan.baseline,c.context.principal,payload.session_id,p.now());need(final.observed_at_ms>=second.observed_at_ms);equal(rows(second),rows(final));
   this.stage='final_source_and_serving';await c.serving();await c.verify();equal(execution,await this.executionPins());equal(await c.native('inspect',{phase:'logout'}),{phase:'logout',state:'normal_return_recorded'});equal(await c.native('inspect',{phase:'denials'}),{phase:'denials',state:'unknown_no_replay'});need(!await p.exists('logout.normal'));
   return{schema_version:'1.0',scope:'cleanup_and_bearer_denial_verified',result:'passed',purpose_id:this.purpose,run:this.run,...c.binding(),claims,execution_source_file:ENTRY,execution_source_pins:execution,frozen_source_pins:c.context.source_pins,frozen_source_pin_count:39,fresh_jwks_sha256:digest(jwks),fresh_jwks_key_count:jwks.keys.length,native_logout_normal_recorded:true,native_denials_state:'unknown_no_replay',latest_tokens_phase:'refresh',generation3_absent:true,original_outer_logout_unknown_retained:true,original_baseline_sessions:5,complete_current_inventory_counts:[first.count,second.count,final.count],inventory_observed_at_ms:[first.observed_at_ms,second.observed_at_ms,final.observed_at_ms],exact_original_five_rows_preserved:true,owned_session_absent:true,bearer_probe:{...denial,jsonrpc_id:this.state.requestId,project_id:core.SCOPE.project,started_at:new Date(probeStarted).toISOString(),finished_at:new Date(probeFinished).toISOString(),before_signed_expiry:true},public_jwks_gets:1,fixed_mcp_probes:1,auth_token_logout_requests:0,claims_or_private_generations_written:0,automatic_retry:false,refresh_denial_unconfirmed:true,full_protocol_verified:false,actual_Claude_observed:false};
  }catch{return{schema_version:'1.0',scope:'cleanup_and_bearer_denial_reconciliation',result:'unconfirmed',purpose_id:this.purpose,run:this.run,stage:this.stage,safe_error_code:'TEMP_OAUTH_CLEANUP_RECONCILIATION_UNCONFIRMED',public_jwks_gets:this.state.jwks,fixed_mcp_probes:this.state.probe,auth_token_logout_requests:0,claims_or_private_generations_written:0,automatic_retry:false,refresh_denial_unconfirmed:true,original_outer_logout_not_repaired:true,full_protocol_verified:false};}finally{this.state.accessToken=null;}
 }
}
async function hashFile(file){const stat=await lstat(file);need(stat.isFile()&&!stat.isSymbolicLink()&&stat.nlink===1&&stat.size<=1024*1024&&path.resolve(await realpath(file)).toLowerCase()===path.resolve(file).toLowerCase());return sha(await readFile(file));}
export async function sourcePins(){const joseEntry=fileURLToPath(import.meta.resolve('jose'));return{entry_sha256:await hashFile(fileURLToPath(import.meta.url)),coordinator_sha256:await hashFile(path.join(import.meta.dirname,'coordinator.mjs')),core_sha256:await hashFile(path.join(import.meta.dirname,'core.mjs')),jose_entry_sha256:await hashFile(joseEntry),jose_verify_sha256:await hashFile(path.join(path.dirname(joseEntry),'jwt/verify.js')),jose_local_jwks_sha256:await hashFile(path.join(path.dirname(joseEntry),'jwks/local.js')),jose_package_sha256:await hashFile(path.join(path.dirname(joseEntry),'../../package.json'))};}
export async function live(run,purpose,ports){need(READ_ENABLED&&run===RUN);return new CleanupReconciliation(run,purpose,ports??nativePorts(run),sourcePins).execute();}
async function main(){const[run,purpose,...extra]=process.argv.slice(2);need(!extra.length&&UUID.test(run)&&UUID.test(purpose));const result=await live(run,purpose);const directory=path.join(ROOT,'tracking/evidence/m07/temporary-oauth-cleanup-reconciliation');await mkdir(directory,{recursive:true});need((await lstat(directory)).isDirectory()&&!(await lstat(directory)).isSymbolicLink()&&await realpath(directory)===directory);const name=new Date().toISOString().replaceAll(':','-')+'-'+purpose+'-cleanup-reconciliation.json';await writeFile(path.join(directory,name),JSON.stringify(result,null,2)+'\n',{flag:'wx'});process.stdout.write(JSON.stringify({result:result.result,receipt:'tracking/evidence/m07/temporary-oauth-cleanup-reconciliation/'+name})+'\n');if(result.result!=='passed')process.exitCode=1;}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)main().catch(()=>{process.stderr.write('TEMP_OAUTH_CLEANUP_RECONCILIATION_UNCONFIRMED\n');process.exitCode=1;});
