/** ROOT-EXECUTED public-only switch. Importing performs no IO. No private loader.
 * Official API: https://vercel.com/docs/rest-api/projects/create-one-or-more-environment-variables
 * https://vercel.com/docs/rest-api/projects/edit-an-environment-variable
 * Three creates precede mode PATCH. Unknown outcomes never resume or upsert. */
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, mkdir, open, realpath, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { TextDecoder } from 'node:util';
import { publicMcpEnvironment, publicOAuthPlan, HOST as HOST_ORIGIN, RESOURCE as MCP_RESOURCE, ISSUER as CENTRAL_ISSUER } from './hosted-oauth-plan.mjs';
import { environmentMetadata, createdEnvironmentMetadata } from './env-projection.mjs';
export const HOST=HOST_ORIGIN, RESOURCE=MCP_RESOURCE, ISSUER=CENTRAL_ISSUER;
const ROOT=path.resolve(import.meta.dirname,'../../..');
const PROJECT='prj_7xOsfRtvJ9voYi7rTEfra5ncOoA0',TEAM='team_gboXPxTevpCOZuaA8eY9PmR1',TARGET='pyibofyctwnqpvktepse';
const CLI=path.join(ROOT,'.local/m07-pilot/tooling/node_modules/vercel/dist/vc.js');
const GLOBAL='C:/Users/iway/AppData/Roaming/xdg.data/com.vercel.cli';
const DIRECTORY=path.join(ROOT,'.local/m07-pilot/hosted-web-oauth-env-final31');
// Draft: no operator path can execute until the independently reviewed guard is sealed.
export const OAUTH31_GUARD_SHA='';
const OAUTH31_GUARD='development/m07/controlled-pilot/hosted-oauth-final31-guard.py';
const PYTHON='C:/Users/iway/AppData/Local/Python/pythoncore-3.14-64/python.exe';
const PYTHON_SHA='4942b86a6597e5aee0128daa00050ed79bc21f6e709a78eb19cbfeb0c2f39ac9';
export const CORE_PATH='tracking/evidence/m07/controlled-pilot/HOSTED_CORE.json';
export const BASE_RECEIPT='tracking/evidence/m07/controlled-pilot/2026-10-30T20-51-32-676Z-web-owner-control.json';
export const CORE_CHECKS=['projects','settings','processing','specs_openai_n8n','video_openai_n8n','native_frames','selection_pdf','guest_feedback','guest_original_video'];
export const HOOK_CHECKS=['owner_and_body','auth_admin_execute','no_public_client_execute','auth_admin_schema','auth_admin_no_other_eps_execute','no_issuer_schema_create','registry_forced_rls','capability_forced_rls'];
export const HISTORY=['20261028010943','20261028013324','20261028013655','20261028024205','20261028072515','20261028162702','20261028162800','20261028172320','20261028184145','20261028222030','20261029001520','20261029003941','20261029070038','20261029090500','20261029090724','20261029094600','20261029100500','20261029133455','20261029135318','20261029174841','20261029180953','20261029202629','20261029203953','20261029215218','20261030002634','20261030004643','20261030013832','20261030030717','20261030111549','20261030154824','20261031010000'];
export const SOURCE_PINS={
  'supabase/.temp/project-ref':'f706303084a6135ca452a75e7c40e4746086e8cadc156c66e4e42af80b4c0ee5',
  'supabase/config.toml':'0a50cd9902ed3a31b57cde31171f725310ed8d0d3efbd7226f894d48272dfbb2',
  'development/m07/controlled-pilot/future-origin.py':'7d15c917bd781fd89a75e3efe36c561d9933ba64e3309b583c04b7ba5accee44',
  'development/m07/controlled-pilot/FUTURE_VERSION_ORIGIN.sql':'4dbea9c15d467feb8b969f7a13ccf5bfd5ae16c4859d727022b40447712fec15',
  'development/m07/controlled-pilot/FUTURE_VERSION_ORIGIN_READBACK.sql':'956698a0b9a671aed02f3a68ef6a5c47a4d261026c16a15e6a06e14cc3a752d7',
  'development/m07/controlled-pilot/hosted-oauth-client-final31.py':'d26badeda7ce44a9fc96636d47ada6a6de729b60ba83b5634abe9a525dfef3ed',
  'development/m07/controlled-pilot/hosted-oauth-plan.mjs':'f8c8b4cbf63b5a114f5f25810965c42d4c03d958b109ea490ba86ee8d22d27c8',
  'development/m07/controlled-pilot/hosted-binding-final31.py':'56651a07a12951175ab7b1a5c6546f51bd90ea8cc407408870f05b7670acb6b7',
  'development/m07/controlled-pilot/HOSTED_BINDING31.sql':'919867c3cfb9bd28ad41a063bbea9d127aacd34f21290caf55afa92336657877',
  'development/m07/controlled-pilot/HOSTED_BINDING31_READBACK.sql':'0f5bfc2a4fe68c3993824d0cd760316be154a654a3b74d169269c4b7b0d95af7',
  'development/m07/controlled-pilot/hosted-provider-final31.py':'1327650e4872fc1ebea6b9de6d5fc530d066939e442590a2142abbf45bb7b5fc',
  'development/m07/controlled-pilot/env-projection.mjs':'6accfb7ede26b2e0a0a184d9b60b77117fe611fe5b8405b56ecbf63fe4355b9b',
  [BASE_RECEIPT]:'0c0b8dae15c5ca5300cf8b8e8efb3815d5ce384b27570f07dedbbef396be7309',
};
export const BINDING_SOURCE_PINS={...Object.fromEntries(Object.entries(SOURCE_PINS).filter(([key])=>!['development/m07/controlled-pilot/hosted-provider-final31.py','development/m07/controlled-pilot/env-projection.mjs',BASE_RECEIPT].includes(key))),
  preflight_sql_sha256:'b66939e0feed102ad0b99157d726904f4c3a84fd6dfc2341ed749951badc6219'};
export const PROVIDER_SOURCE_KEYS=['supabase/.temp/project-ref','supabase/config.toml','development/m07/controlled-pilot/hosted-provider-final31.py','development/m07/controlled-pilot/test_hosted_provider_final31.py','development/m07/controlled-pilot/HOSTED_PROVIDER_FINAL31.md'];
// CLI65 api supplies no retry override. Client.retry defaults to three retries;
// fetchWithAuthHeaders can additionally resend a DPoP nonce challenge once.
export const CLI_TRANSPORT_POLICY={helper_write_retry:false,cli_network_5xx_retries_maximum:3,cli_request_attempts_maximum_per_operation:4,
  cli_dpop_nonce_resends_maximum_per_request_attempt:1,
  cli_request_attempt_scope:'Retry-loop attempts (initial plus three retries); DPoP nonce correction and authentication maintenance can add wire requests. No exact wire-count claim.'};
const CLI_SOURCE_PINS={
  '.local/m07-pilot/tooling/node_modules/vercel/dist/chunks/chunk-YIOT5B5Z.js':'36a7d817e495b18babf431a5380e530f3f6ceb262120bafc56b3d9163aaae661',
  '.local/m07-pilot/tooling/node_modules/vercel/dist/chunks/chunk-QZEZCUUZ.js':'d81dab4301ba45c2d3c786bbca5c29a5027e98976118102de7aa8e99b607d23a'};
const MODES=['preview','production'], NEW_KEYS=['MCP_AUTH_CLIENT_IDS','MCP_AUTH_ISSUER','MCP_RESOURCE_URL'];
const CAPABILITIES=['projects.read','projects.write','workspaces.read','workspaces.write','cast.read','cast.upload','cast.write','cast.review','presentations.generate','review_links.manage','settings.manage','operations.read','operations.retry'];
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const fail=()=>{throw new Error('HOSTED_WEB_OAUTH_ENV_UNCONFIRMED');};
const require=v=>{if(!v)fail();};
const exact=(v,keys)=>require(object(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(','));
const sha=v=>createHash('sha256').update(v).digest('hex');
const digest=v=>require(typeof v==='string'&&/^[a-f0-9]{64}$/u.test(v));
const uuid=v=>require(typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u.test(v)&&v!=='00000000-0000-0000-0000-000000000000');
const integer=(v,min=0)=>require(Number.isSafeInteger(v)&&v>=min);
const canonical=v=>JSON.stringify(v,(_key,value)=>object(value)?Object.fromEntries(Object.keys(value).sort().map(key=>[key,value[key]])):value);
const equal=(a,b)=>canonical(a)===canonical(b);
const fresh=(v,now)=>{require(typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|\+00:00)$/u.test(v));const t=Date.parse(v);require(Number.isFinite(t)&&new Date(t).toISOString().slice(0,19)===v.slice(0,19)&&now>=t&&now-t<=3600000);return t;};
function receiptPath(v){require(typeof v==='string'&&v.length<=300&&/^tracking\/evidence\/m07\/controlled-pilot\/[A-Za-z0-9_./+-]+\.json$/u.test(v)&&!v.split('/').includes('..')&&!v.includes('\\'));return v;}
function fingerprint(v,min=0){exact(v,['count','sha256']);integer(v.count,min);digest(v.sha256);}
function business(v){exact(v,['versions','slides','pins','ready_asset_metadata','grants','settings','protected_m02']);for(const key of ['versions','slides','pins','ready_asset_metadata'])fingerprint(v[key]);for(const key of ['grants','settings'])fingerprint(v[key],1);
  const j=v.protected_m02;exact(j,['id','status','stage','attempt','row_version','resource_id','manual_note_retained','spec_sha256']);require(j.id==='b3f90268-147d-41d4-8875-2a6435df1496'&&['queued','running','waiting_for_input','succeeded','failed','cancelled'].includes(j.status)&&j.manual_note_retained===true);
  require(j.stage===null||typeof j.stage==='string'&&/^[a-z_]{1,100}$/u.test(j.stage));integer(j.attempt);integer(j.row_version,1);uuid(j.resource_id);digest(j.spec_sha256);}
function state(v,clientId,actorId,empty=false){exact(v,['database','operator','history','registry_trigger_count','bindings','acting_user_id','producer_capabilities','hook_security','protected_metadata']);
  require(v.database==='postgres'&&v.operator==='postgres'&&equal(v.history,HISTORY)&&v.registry_trigger_count===0&&v.acting_user_id===actorId);
  require(equal(v.bindings,empty?[]:[{resource:RESOURCE,client_id:clientId,enabled:true}]));exact(v.hook_security,HOOK_CHECKS);require(Object.values(v.hook_security).every(flag=>flag===true));
  require(Array.isArray(v.producer_capabilities)&&v.producer_capabilities.every(k=>CAPABILITIES.includes(k))&&equal(v.producer_capabilities,[...new Set(v.producer_capabilities)].sort())&&['cast.read','workspaces.read'].every(k=>v.producer_capabilities.includes(k)));business(v.protected_metadata);}

/** Four closed receipts only; return the four public variables, never receipt payloads. */
export function validateGateBundle(bundle,now=Date.now()){
  exact(bundle,['core','provider','client','binding','coreHash','clientPath','clientHash','expectedQueries']);integer(now);digest(bundle.coreHash);digest(bundle.clientHash);receiptPath(bundle.clientPath);
  const {core,provider,client,binding}=bundle;
  exact(core,['schema_version','result','target','origin','web_project_id','web_deployment_id','acting_user_id','core_checks','evidence_receipts']);
  require(core.schema_version==='1.0'&&core.result==='passed'&&core.target===TARGET&&core.origin===HOST&&core.web_project_id===PROJECT&&/^dpl_[A-Za-z0-9]{8,100}$/u.test(core.web_deployment_id));uuid(core.acting_user_id);
  exact(core.core_checks,CORE_CHECKS);require(Object.values(core.core_checks).every(v=>v==='passed')&&Array.isArray(core.evidence_receipts)&&core.evidence_receipts.length>=1&&core.evidence_receipts.length<=128&&new Set(core.evidence_receipts).size===core.evidence_receipts.length);
  for(const ref of core.evidence_receipts){receiptPath(ref);require(ref!==CORE_PATH);}
  const clientFields=['schema_version','evidence_kind','target','origin','resource','issuer','action','observed_at','finished_at','result','client','matching_client_count','provider_client_observed','independent_readback_equal','client_secret_observed','original_client_baseline_available','other_existing_clients_equal','creation_dispatched','post_outcome','repeat_create_prevented','automatic_post_retry','application_resource_binding_observed','provider_configuration_observed','credentials_logged_or_persisted','service_role_sent_outside_fixed_auth_admin','claude_configuration_login_or_model_call','configuration_or_database_mutations','source_pins'];exact(client,clientFields);
  require(client.schema_version==='1.0'&&client.evidence_kind==='actual_provider_observation'&&client.result==='passed'&&client.target===TARGET&&client.origin===HOST&&client.resource===RESOURCE&&client.issuer===ISSUER&&['inspect','create','readback'].includes(client.action)&&bundle.clientPath.endsWith(`-hosted-oauth-client-final31-${client.action}.json`));
  const started=fresh(client.observed_at,now),finished=fresh(client.finished_at,now);require(finished>=started&&finished-started<=900000&&client.matching_client_count===1&&client.provider_client_observed===true&&client.independent_readback_equal===true);
  for(const key of ['original_client_baseline_available','other_existing_clients_equal','creation_dispatched','repeat_create_prevented'])require(typeof client[key]==='boolean');
  for(const key of ['client_secret_observed','automatic_post_retry','application_resource_binding_observed','provider_configuration_observed','credentials_logged_or_persisted','service_role_sent_outside_fixed_auth_admin','claude_configuration_login_or_model_call','configuration_or_database_mutations'])require(client[key]===false);
  require(['not_attempted','unknown','response_validated'].includes(client.post_outcome)&&(!client.creation_dispatched||client.original_client_baseline_available&&client.other_existing_clients_equal));
  exact(client.source_pins,['helper_sha256','plan_sha256']);require(client.source_pins.helper_sha256===SOURCE_PINS['development/m07/controlled-pilot/hosted-oauth-client-final31.py']&&client.source_pins.plan_sha256===SOURCE_PINS['development/m07/controlled-pilot/hosted-oauth-plan.mjs']);
  exact(client.client,['client_id','client_name','client_type','token_endpoint_auth_method','redirect_uris','grant_types','response_types','registration_type']);uuid(client.client.client_id);const clientId=client.client.client_id,actorId=core.acting_user_id;
  require(equal(client.client,{client_id:clientId,client_name:'Everyone Presentation Studio Hosted Pilot — Claude Code',client_type:'public',token_endpoint_auth_method:'none',redirect_uris:['http://localhost:3118/callback'],grant_types:['authorization_code','refresh_token'],response_types:['code'],registration_type:'manual'}));
  const providerFields=['schema_version','target','desired_auth_fields','preserved_exact_redirects','result','dispatch_attempted','push_outcome','automatic_push_retry','provider_configuration_observed','application_verified_by_readback','original_baseline_available','nonselected_returned_comparator_preserved','independent_readback_equal','database_hook_acl_verified_by_this_operator','unreturned_or_secret_plaintext_preservation_proven','raw_provider_values_or_hashes_persisted','claim_retained','cli_patch_unknown_transport_or_5xx_retry','cli_patch_429_retries_maximum','process_cleanup_unconfirmed','planned_single_auth_patch','repository_link_and_config_preserved','action','evidence_kind','source_and_core_pins','observed_at','logical_reads','config_pull_requests','prepared_directory'];exact(provider,providerFields);
  require(provider.schema_version==='1.0'&&provider.target===TARGET&&provider.result==='passed'&&provider.action==='apply'&&provider.evidence_kind==='actual_provider_observation');fresh(provider.observed_at,now);
  for(const key of ['dispatch_attempted','provider_configuration_observed','application_verified_by_readback','original_baseline_available','nonselected_returned_comparator_preserved','independent_readback_equal','claim_retained','repository_link_and_config_preserved'])require(provider[key]===true);
  for(const key of ['automatic_push_retry','database_hook_acl_verified_by_this_operator','unreturned_or_secret_plaintext_preservation_proven','raw_provider_values_or_hashes_persisted','cli_patch_unknown_transport_or_5xx_retry','process_cleanup_unconfirmed'])require(provider[key]===false);
  require(['command_succeeded','unknown'].includes(provider.push_outcome)&&provider.cli_patch_429_retries_maximum===5&&equal(provider.desired_auth_fields,publicOAuthPlan().provider_patch)&&equal(provider.preserved_exact_redirects,['http://127.0.0.1:3000/api/auth/callback',HOST+'/api/auth/callback']));
  require(object(provider.planned_single_auth_patch)&&Object.keys(provider.planned_single_auth_patch).length>=1&&Object.entries(provider.planned_single_auth_patch).every(([key,value])=>Object.hasOwn(provider.desired_auth_fields,key)&&provider.desired_auth_fields[key]===value));
  integer(provider.logical_reads,2);require(provider.config_pull_requests===provider.logical_reads*3&&typeof provider.prepared_directory==='string'&&/^\.local\/m07-pilot\/hosted-provider-final31\/[0-9TZ-]+-[a-f0-9]{8}$/u.test(provider.prepared_directory));
  exact(provider.source_and_core_pins,[...PROVIDER_SOURCE_KEYS,CORE_PATH,...core.evidence_receipts]);
  for(const [key,pin]of Object.entries(provider.source_and_core_pins)){exact(pin,['sha256','size','mtime_ns','device','inode']);digest(pin.sha256);integer(pin.size,1);for(const field of ['mtime_ns','device','inode'])require(Number.isInteger(pin[field])&&pin[field]>=0);if(SOURCE_PINS[key])require(pin.sha256===SOURCE_PINS[key]);}
  require(provider.source_and_core_pins[CORE_PATH].sha256===bundle.coreHash);
  const bindingCommon=['schema_version','observed_at','action','target','resource','client_id','acting_user_id','provider_receipt','sources','rendered_queries','write_process_returned','process_cleanup_unconfirmed','result','binding_observed','application_verified_by_readback','business_and_hook_state_preserved','original_baseline_available','independent_readback_equal','after','independent_readback','automatic_dispatch_retry','dispatch_attempted','auth_enrollment_capability_or_provider_configuration_writes','raw_cli_or_credentials_persisted','oauth_issuance_or_claude_login_proved'];
  require(binding?.action==='apply'||binding?.action==='readback');exact(binding,[...bindingCommon,...(binding.action==='apply'?['before','dispatch_outcome','update_result_verified','claim_retained']:[])]);
  require(binding.schema_version==='1.0'&&binding.target===TARGET&&binding.resource===RESOURCE&&binding.client_id===clientId&&binding.acting_user_id===actorId&&binding.provider_receipt===bundle.clientPath&&binding.result==='passed');fresh(binding.observed_at,now);
  for(const key of ['binding_observed','application_verified_by_readback','business_and_hook_state_preserved','original_baseline_available','independent_readback_equal','write_process_returned'])require(binding[key]===true);
  for(const key of ['automatic_dispatch_retry','auth_enrollment_capability_or_provider_configuration_writes','raw_cli_or_credentials_persisted','oauth_issuance_or_claude_login_proved','process_cleanup_unconfirmed'])require(binding[key]===false);
  require(typeof binding.dispatch_attempted==='boolean');state(binding.after,clientId,actorId);state(binding.independent_readback,clientId,actorId);require(equal(binding.after,binding.independent_readback));
  if(binding.action==='apply'){require(binding.dispatch_attempted&&binding.claim_retained===true&&typeof binding.update_result_verified==='boolean'&&['command_succeeded','unconfirmed'].includes(binding.dispatch_outcome));state(binding.before,clientId,actorId,true);const expected={...binding.before,bindings:binding.after.bindings};require(equal(expected,binding.after));}
  else require(binding.dispatch_attempted===false);
  exact(binding.rendered_queries,['update','readback']);exact(bundle.expectedQueries,['update','readback']);for(const value of Object.values(bundle.expectedQueries))digest(value);require(equal(binding.rendered_queries,bundle.expectedQueries));
  exact(binding.sources,[...Object.keys(BINDING_SOURCE_PINS),CORE_PATH,...core.evidence_receipts,bundle.clientPath]);
  for(const [key,value]of Object.entries(binding.sources)){digest(value);if(BINDING_SOURCE_PINS[key])require(value===BINDING_SOURCE_PINS[key]);}
  require(binding.sources[CORE_PATH]===bundle.coreHash&&binding.sources[bundle.clientPath]===bundle.clientHash);
  for(const ref of core.evidence_receipts)require(binding.sources[ref]===provider.source_and_core_pins[ref].sha256);
  return {clientId,actorId,values:publicMcpEnvironment(clientId)};
}

const selected=new Set(['MCP_AUTH_MODE',...NEW_KEYS,'APP_BASE_URL','APP_ENV','CENTRAL_ADAPTER_MODE','NODE_ENV','EPS_PILOT_OWNER_CONTROLLED','EPS_PILOT_EXPIRES_AT']);
/** Values/vsmValue never enter preservation metadata or public journals. */
export function environmentSnapshot(response){require(object(response)&&Array.isArray(response.envs)&&response.envs.length<=64&&!response.pagination?.next);const metadata=environmentMetadata(response.envs);const ids=new Set();
  const rows=response.envs.map(v=>{require(typeof v.id==='string'&&/^[A-Za-z0-9_-]{1,200}$/u.test(v.id)&&!ids.has(v.id));ids.add(v.id);integer(v.createdAt);integer(v.updatedAt);require(v.updatedAt>=v.createdAt&&v.gitBranch==null&&(v.customEnvironmentIds===undefined||Array.isArray(v.customEnvironmentIds)&&v.customEnvironmentIds.length===0));
    const target=[...v.target].sort();const preservation=Object.fromEntries(Object.entries(v).filter(([key])=>!['value','vsmValue'].includes(key)));preservation.target=target;
    return {key:v.key,id:v.id,type:v.type,target,createdAt:v.createdAt,updatedAt:v.updatedAt,preservation,...(selected.has(v.key)?{publicValue:v.value}:{})};}).sort((a,b)=>a.key.localeCompare(b.key));
  return {rows,metadata,publicMetadata:rows.map(({key,id,type,target,createdAt,updatedAt})=>({key,id,type,target,createdAt,updatedAt}))};}
function row(snapshot,key){const v=snapshot.rows.find(value=>value.key===key);require(v);return v;}
function validateValues(values){require(object(values));uuid(values.MCP_AUTH_CLIENT_IDS);require(equal(values,publicMcpEnvironment(values.MCP_AUTH_CLIENT_IDS)));}
function baseline(snapshot,expected){require(snapshot.rows.length===25&&equal(snapshot.metadata,environmentMetadata(expected))&&NEW_KEYS.every(key=>!snapshot.rows.some(v=>v.key===key)));require(row(snapshot,'MCP_AUTH_MODE').publicValue==='disabled'&&row(snapshot,'MCP_AUTH_MODE').type==='plain'&&equal(row(snapshot,'MCP_AUTH_MODE').target,MODES));
  for(const [key,value]of Object.entries({APP_BASE_URL:HOST,APP_ENV:'staging',CENTRAL_ADAPTER_MODE:'supabase',NODE_ENV:'production',EPS_PILOT_OWNER_CONTROLLED:'true',EPS_PILOT_EXPIRES_AT:''}))require(row(snapshot,key).publicValue===value);}
function unchanged(before,current,modeChanged=false){for(const prior of before.rows){const next=row(current,prior.key);if(prior.key==='MCP_AUTH_MODE'&&modeChanged){const strip=v=>Object.fromEntries(Object.entries(v.preservation).filter(([k])=>!['updatedAt','updatedBy'].includes(k)));require(equal(strip(prior),strip(next))&&next.updatedAt>=prior.updatedAt);}else{require(equal(prior.preservation,next.preservation));if(selected.has(prior.key))require(prior.publicValue===next.publicValue);}}}
function progress(before,current,created,values,oauth=false){require(current.rows.length===25+created.length);unchanged(before,current,oauth);require(row(current,'MCP_AUTH_MODE').publicValue===(oauth?'oauth':'disabled'));
  for(const key of created){const v=row(current,key);require(v.type==='plain'&&equal(v.target,MODES)&&v.publicValue===values[key]);}
  require(current.rows.every(v=>before.rows.some(old=>old.key===v.key)||created.includes(v.key)));}
function publicRow(v){return {key:v.key,id:v.id,type:v.type,target:v.target,createdAt:v.createdAt,updatedAt:v.updatedAt};}

export async function applyWebOAuth(values,expectedBase,io){validateValues(values);await io.verify();const before=environmentSnapshot(await io.read());baseline(before,expectedBase);
  await io.claim({project_id:PROJECT,team_id:TEAM,public_values:values,mode_id:row(before,'MCP_AUTH_MODE').id,baseline_metadata:before.publicMetadata,...CLI_TRANSPORT_POLICY});
  const freshState=environmentSnapshot(await io.read());baseline(freshState,expectedBase);unchanged(before,freshState);await io.verify();
  let phase='create_public_variables',unknown=false,attempts=0;const created=[];let allCreated;
  try{for(const key of NEW_KEYS){await io.verify();await io.journal({phase:'attempted',key});attempts++;const body={key,value:values[key],type:'plain',target:MODES,comment:'Controlled Studio OAuth public configuration'};
      const response=await io.create(body);require(equal(createdEnvironmentMetadata(response),[{key,type:'plain',target:MODES}]));
      created.push(key);const observed=environmentSnapshot(await io.read());progress(before,observed,created,values);await io.journal({phase:'created',key,metadata:publicRow(row(observed,key))});}
    phase='verify_three_before_mode';allCreated=environmentSnapshot(await io.read());progress(before,allCreated,created,values);const independent=environmentSnapshot(await io.read());progress(before,independent,created,values);require(equal(allCreated.rows,independent.rows));
    await io.verify();phase='patch_mode_last';await io.journal({phase:'attempted',key:'MCP_AUTH_MODE',metadata:publicRow(row(before,'MCP_AUTH_MODE'))});attempts++;
    const mode=await io.patch(row(before,'MCP_AUTH_MODE').id,{value:'oauth'});const modeSnapshot=environmentSnapshot({envs:[mode]});require(row(modeSnapshot,'MCP_AUTH_MODE').id===row(before,'MCP_AUTH_MODE').id&&row(modeSnapshot,'MCP_AUTH_MODE').publicValue==='oauth');
    await io.journal({phase:'enabled',key:'MCP_AUTH_MODE',metadata:publicRow(row(modeSnapshot,'MCP_AUTH_MODE'))});phase='final_readback';
  }catch{unknown=true;}
  let after=null,independent=null,complete=false,modeObserved=false,metadataPreserved=false;
  try{after=environmentSnapshot(await io.read());modeObserved=row(after,'MCP_AUTH_MODE').publicValue==='oauth';}catch{/* metadata only */}
  try{independent=environmentSnapshot(await io.read());}catch{/* no replay */}
  try{require(after&&independent);progress(before,after,NEW_KEYS,values,true);progress(before,independent,NEW_KEYS,values,true);require(equal(after.rows,independent.rows));if(allCreated)for(const key of NEW_KEYS)require(equal(row(allCreated,key),row(after,key)));complete=true;metadataPreserved=true;}catch{/* no success credit */}
  try{await io.verify();}catch{unknown=true;}
  return {result:!unknown&&complete?'passed':'unconfirmed',failed_or_last_phase:phase,helper_write_operations_attempted:attempts,...CLI_TRANSPORT_POLICY,claim_retained:true,
    mode_oauth_observed:modeObserved,independent_metadata_equal:after!==null&&independent!==null&&equal(after.rows,independent.rows),
    other_variable_metadata_preserved:metadataPreserved,public_values:values,touched_metadata:after?.publicMetadata.filter(v=>['MCP_AUTH_MODE',...NEW_KEYS].includes(v.key))??[],
    source_and_gate_verified:!unknown,runtime_verified:false,redeploy_performed:false,private_values_or_digests_recorded:false,
    scope:'Public Vercel environment configuration only; current deployment/OAuth issuance/Claude login not verified. CLI transport may retry the same unique-key create or same-ID/value PATCH. Unknown outer outcomes stop later writes; inspect only.'};
}

export function validateWebProject(v){require(object(v)&&v.id===PROJECT&&v.accountId===TEAM&&v.name==='everyone-presentation-pilot'&&v.rootDirectory==='apps/web'&&v.nodeVersion==='24.x'&&v.sourceFilesOutsideRootDirectory===true);}
async function publicFile(relative,maximum=2*1024*1024){require(typeof relative==='string'&&!relative.includes('\\')&&!relative.includes(':')&&!relative.split('/').includes('..')&&!path.isAbsolute(relative));const file=path.join(ROOT,relative);require(file.startsWith(ROOT+path.sep));
  const initial=await lstat(file,{bigint:true});require(initial.isFile()&&!initial.isSymbolicLink()&&initial.size>0n&&initial.size<=BigInt(maximum)&&path.resolve(await realpath(file)).toLowerCase()===file.toLowerCase());
  const handle=await open(file,constants.O_RDONLY|(constants.O_NOFOLLOW??0));try{const opened=await handle.stat({bigint:true});const bytes=await handle.readFile();const end=await handle.stat({bigint:true});const current=await lstat(file,{bigint:true});
    const identity=v=>[v.dev,v.ino,v.size,v.mtimeNs,v.ctimeNs].map(String).join(',');require(identity(initial)===identity(opened)&&identity(opened)===identity(end)&&identity(end)===identity(current)&&BigInt(bytes.length)===initial.size&&bytes.length<=maximum);
    require(path.resolve(await realpath(file)).toLowerCase()===file.toLowerCase());return {bytes,pin:{sha256:sha(bytes),identity:identity(initial)}};}finally{await handle.close();}}
async function loadInputs(providerPath,clientPath,bindingPath){await admit31Guard();for(const value of [providerPath,clientPath,bindingPath])receiptPath(value);require(providerPath.endsWith('-hosted-provider-final31-apply.json')&&/-hosted-oauth-client-final31-(?:inspect|create|readback)\.json$/u.test(clientPath)&&/-hosted-binding-final31-(?:apply|readback)\.json$/u.test(bindingPath));
  const pins={};const read=async relative=>{const value=await publicFile(relative);pins[relative]=value.pin;return value.bytes;};
  for(const [relative,expected]of Object.entries(SOURCE_PINS))require(sha(await read(relative))===expected);
  for(const [relative,expected]of Object.entries(CLI_SOURCE_PINS))require(sha(await read(relative))===expected);
  await read('development/m07/controlled-pilot/hosted-web-oauth-env-final31.mjs');
  const decode=data=>JSON.parse(new TextDecoder('utf8',{fatal:true}).decode(data));
  const coreBytes=await read(CORE_PATH),clientBytes=await read(clientPath);const core=decode(coreBytes),client=decode(clientBytes),provider=decode(await read(providerPath)),binding=decode(await read(bindingPath));
  require(object(core)&&Array.isArray(core.evidence_receipts));for(const relative of core.evidence_receipts){receiptPath(relative);require(object(decode(await read(relative))));}
  const render=(template,update)=>{require(template.split('__ACTING_USER_UUID__').length===2&&template.split('__CLIENT_UUID__').length===(update?2:1));uuid(core.acting_user_id);uuid(client?.client?.client_id);return template.replace('__ACTING_USER_UUID__',core.acting_user_id).replace('__CLIENT_UUID__',client.client.client_id);};
  const expectedQueries={update:sha(render((await read('development/m07/controlled-pilot/HOSTED_BINDING31.sql')).toString('utf8'),true)),readback:sha(render((await read('development/m07/controlled-pilot/HOSTED_BINDING31_READBACK.sql')).toString('utf8'),false))};
  const bundle={core,provider,client,binding,coreHash:sha(coreBytes),clientPath,clientHash:sha(clientBytes),expectedQueries};const gates=validateGateBundle(bundle);
  for(const [relative,pin]of Object.entries(provider.source_and_core_pins))require(sha(await read(relative))===pin.sha256);
  for(const [relative,digest]of Object.entries(binding.sources)){if(relative==='preflight_sql_sha256')require(digest===BINDING_SOURCE_PINS[relative]);else require(sha(await read(relative))===digest);}
  const base=decode(await read(BASE_RECEIPT));require(base.result==='passed'&&base.project===PROJECT&&base.team===TEAM&&base.owner_controlled===true&&base.expiry_blank===true&&base.other_variable_metadata_preserved===true&&base.private_values_or_digests_recorded===false);
  const expectedBase=environmentMetadata(base.observed_metadata);require(expectedBase.length===25);
  return {gates,expectedBase,pins};}
function cliEnvironment(){const env={NODE_ENV:'production',PATH:'',CI:'1',VERCEL_TELEMETRY_DISABLED:'1',VERCEL_CLI_USE_NATIVE_BINARY:'0'};for(const key of ['SystemRoot','WINDIR','USERPROFILE','APPDATA','LOCALAPPDATA','HOMEDRIVE','HOMEPATH','TEMP','TMP','LANG'])if(process.env[key])env[key]=process.env[key];return env;}
async function api(endpoint,method='GET',body){await admit31Guard();const args=[CLI,'api',endpoint,'--scope','muhammed-abdelrahman','--raw','--global-config',GLOBAL,'--method',method];if(body!==undefined)args.push('--input','-');
  try{return JSON.parse(execFileSync(process.execPath,args,{cwd:ROOT,env:cliEnvironment(),input:body===undefined?undefined:JSON.stringify(body),stdio:['pipe','pipe','pipe'],windowsHide:true,shell:false,timeout:60000,maxBuffer:2*1024*1024}).toString('utf8'));}catch{return fail();}}
async function checkedOperator(){require(process.platform==='win32'&&/^v24\./u.test(process.version)&&!process.env.NODE_OPTIONS);for(const [file,directory]of [[CLI,false],[GLOBAL,true]]){const info=await lstat(file);require((directory?info.isDirectory():info.isFile())&&!info.isSymbolicLink()&&path.resolve(await realpath(file)).toLowerCase()===path.resolve(file).toLowerCase());}
  const pkg=JSON.parse((await publicFile('.local/m07-pilot/tooling/node_modules/vercel/package.json',65536)).bytes);require(pkg.version==='65.8.0');for(const [relative,expected]of Object.entries(CLI_SOURCE_PINS))require(sha((await publicFile(relative)).bytes)===expected);}
async function permanentClaim(value){await mkdir(DIRECTORY,{recursive:true});require(path.resolve(await realpath(DIRECTORY)).toLowerCase()===DIRECTORY.toLowerCase());const handle=await open(path.join(DIRECTORY,'apply.claim.json'),'wx',0o600);try{await handle.writeFile(JSON.stringify({...value,claimed_at:new Date().toISOString()})+'\n');await handle.sync();}finally{await handle.close();}}
async function journal(value){require(['MCP_AUTH_MODE',...NEW_KEYS].includes(value.key)&&['attempted','created','enabled'].includes(value.phase));const handle=await open(path.join(DIRECTORY,`${value.key}.${value.phase}.json`),'wx',0o600);try{await handle.writeFile(JSON.stringify({...value,observed_at:new Date().toISOString()})+'\n');await handle.sync();}finally{await handle.close();}}
const envEndpoint=`/v10/projects/${PROJECT}/env?teamId=${TEAM}&decrypt=false`;
export function validateOAuth31Gate(value){
  exact(value,['schema_version','evidence_kind','result','target','history','guard_plan_sha256','canonical_release_receipt_sha256','hosted_core_sha256','source_pins','database_state']);
  require(value.schema_version==='1.0'&&value.evidence_kind==='actual_canonical_readonly_guard'&&value.result==='passed'&&value.target===TARGET&&equal(value.history,HISTORY));
  for(const key of ['guard_plan_sha256','canonical_release_receipt_sha256','hosted_core_sha256'])digest(value[key]);
  require(object(value.source_pins)&&Object.keys(value.source_pins).length>=1&&Object.keys(value.source_pins).length<=256);
  for(const [relative,hash]of Object.entries(value.source_pins)){require(typeof relative==='string'&&relative.length<=240&&/^(?:development|tracking|supabase|tools)\//u.test(relative)&&!relative.includes('..')&&!relative.includes('\\')&&!relative.includes(':'));digest(hash);}
  const state=value.database_state;exact(state,['database','operator','history','hook_security','ack_security','hook_body_sha256','ack_body_sha256']);
  require(state.database==='postgres'&&state.operator==='postgres'&&equal(state.history,HISTORY));exact(state.hook_security,HOOK_CHECKS);require(Object.values(state.hook_security).every(v=>v===true));
  exact(state.ack_security,['owner_body','owner_execute','public_execute_denied','column_selects','whole_job_select_denied']);require(Object.values(state.ack_security).every(v=>v===true));
  require(state.hook_body_sha256==='b6e422c7df5cb146e9d0c0aaaad6dfa7fc5373a36179d82284438cf599fd218c'&&state.ack_body_sha256==='e0a7c7be311e6b2139faf08238121f4687d379844a26dd602ff8331b54231481');
  return JSON.parse(JSON.stringify(value));
}
export async function admit31Guard(){
  // Validate the blank/final seal before even reading or launching the guard.
  digest(OAUTH31_GUARD_SHA);require(sha((await publicFile(OAUTH31_GUARD)).bytes)===OAUTH31_GUARD_SHA);
  const info=await lstat(PYTHON);require(info.isFile()&&!info.isSymbolicLink()&&info.size>0&&info.size<=16*1024*1024&&path.resolve(await realpath(PYTHON)).toLowerCase()===path.resolve(PYTHON).toLowerCase());
  require(sha(await readFile(PYTHON))===PYTHON_SHA);
  const env=cliEnvironment();env.PATH='C:/Program Files/nodejs;C:/Windows/System32';
  try{const stdout=execFileSync(PYTHON,['-I','-B','-X','utf8',path.join(ROOT,OAUTH31_GUARD),'admit'],{cwd:ROOT,env,stdio:['pipe','pipe','pipe'],windowsHide:true,shell:false,timeout:60000,maxBuffer:256*1024});return validateOAuth31Gate(JSON.parse(new TextDecoder('utf8',{fatal:true}).decode(stdout)));}
  catch{return fail();}
}
async function main(){const action=process.argv[2];require(['inspect','preflight','apply'].includes(action)&&process.argv.length===(action==='inspect'?3:6));
  await admit31Guard();let loaded;if(action!=='inspect')loaded=await loadInputs(...process.argv.slice(3));else for(const [relative,expected]of Object.entries(SOURCE_PINS))require(sha((await publicFile(relative)).bytes)===expected);
  await checkedOperator();validateWebProject(await api(`/v9/projects/${PROJECT}?teamId=${TEAM}`));
  let result;if(action==='inspect'){const snapshot=environmentSnapshot(await api(envEndpoint));const values={};for(const key of ['MCP_AUTH_MODE',...NEW_KEYS]){const v=snapshot.rows.find(value=>value.key===key);if(v){require(v.type==='plain'&&equal(v.target,MODES));values[key]=v.publicValue;}}
    require(['disabled','oauth'].includes(values.MCP_AUTH_MODE));if(values.MCP_AUTH_CLIENT_IDS!==undefined)uuid(values.MCP_AUTH_CLIENT_IDS);if(values.MCP_AUTH_ISSUER!==undefined)require(values.MCP_AUTH_ISSUER===ISSUER);if(values.MCP_RESOURCE_URL!==undefined)require(values.MCP_RESOURCE_URL===RESOURCE);
    result={result:'observed',public_values:values,variable_count:snapshot.rows.length,touched_metadata:snapshot.publicMetadata.filter(v=>['MCP_AUTH_MODE',...NEW_KEYS].includes(v.key)),source_and_gate_verified:false,runtime_verified:false};
  }else{const initial=loaded;const verify=async()=>require(equal(await loadInputs(...process.argv.slice(3)),initial));
    const io={verify,read:async()=>api(envEndpoint),claim:async value=>permanentClaim({...value,public_evidence_and_source_pins:initial.pins}),journal,
      create:async body=>api(`/v10/projects/${PROJECT}/env?teamId=${TEAM}&upsert=false`,'POST',body),
      patch:async(id,body)=>api(`/v9/projects/${PROJECT}/env/${encodeURIComponent(id)}?teamId=${TEAM}`,'PATCH',body)};
    if(action==='preflight'){await verify();const snapshot=environmentSnapshot(await io.read());baseline(snapshot,initial.expectedBase);result={result:'passed',public_values:initial.gates.values,initial_variable_count:25,source_and_gate_verified:true,runtime_verified:false,variables_written:false};}
    else result=await applyWebOAuth(initial.gates.values,initial.expectedBase,io);
  }
  const report={schema_version:'1.0',observed_at:new Date().toISOString(),action,project_id:PROJECT,team_id:TEAM,origin:HOST,...result,...CLI_TRANSPORT_POLICY,private_values_or_digests_recorded:false};
  if(action==='apply'){const area=path.join(ROOT,'tracking/evidence/m07/controlled-pilot');await mkdir(area,{recursive:true});const file=path.join(area,`${new Date().toISOString().replaceAll(':','-')}-${randomUUID().slice(0,8)}-hosted-web-oauth-env-final31-apply.json`);await writeFile(file,JSON.stringify(report,null,2)+'\n',{flag:'wx'});process.stdout.write(JSON.stringify({receipt:path.relative(ROOT,file),...report})+'\n');}
  else process.stdout.write(JSON.stringify(report)+'\n');
  if(report.result==='unconfirmed')process.exitCode=1;
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)main().catch(()=>{process.stderr.write('HOSTED_WEB_OAUTH_ENV_UNCONFIRMED: retain claim; inspect only, no automatic resume or upsert.\n');process.exitCode=1;});
