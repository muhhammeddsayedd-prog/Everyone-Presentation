/** All provider/core/client/DB receipts and environment rows are synthetic.
 * No CLI, private configuration, auth, provider, DB or real environment write. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { validateGateBundle, applyWebOAuth, environmentSnapshot, validateWebProject,
  CORE_CHECKS, HOOK_CHECKS, HISTORY, SOURCE_PINS, BINDING_SOURCE_PINS, PROVIDER_SOURCE_KEYS, BASE_RECEIPT,
  HOST, RESOURCE, ISSUER, CORE_PATH, CLI_TRANSPORT_POLICY } from './hosted-web-oauth-env.mjs';
import { publicMcpEnvironment, publicOAuthPlan } from './hosted-oauth-plan.mjs';
const CLIENT='ab100000-0000-4000-8000-000000000001', ACTOR='ab100000-0000-4000-8000-000000000002';
const NOW=Date.parse('2026-10-31T00:00:00Z');
const CLIENT_PATH='tracking/evidence/m07/controlled-pilot/2026-10-30T23-59-00-123456+00-00-1234abcd-hosted-oauth-client-create.json';
const LEAF='tracking/evidence/m07/controlled-pilot/synthetic-core.json';
const hash='a'.repeat(64), coreHash='b'.repeat(64), clientHash='c'.repeat(64);
const clone=x=>JSON.parse(JSON.stringify(x));
function state(bound=true){return {database:'postgres',operator:'postgres',history:[...HISTORY],registry_trigger_count:0,
  bindings:bound?[{resource:RESOURCE,client_id:CLIENT,enabled:true}]:[],acting_user_id:ACTOR,
  producer_capabilities:['cast.read','settings.manage','workspaces.read'],hook_security:Object.fromEntries(HOOK_CHECKS.map(k=>[k,true])),
  protected_metadata:{...Object.fromEntries(['versions','slides','pins','ready_asset_metadata','grants','settings'].map(k=>[k,{count:2,sha256:hash}])),
    protected_m02:{id:'b3f90268-147d-41d4-8875-2a6435df1496',status:'failed',stage:'extract_specs',attempt:1,row_version:3,
      resource_id:'ab100000-0000-4000-8000-000000000003',manual_note_retained:true,spec_sha256:hash}}};}
function bundle(){
  const core={schema_version:'1.0',result:'passed',target:'pyibofyctwnqpvktepse',origin:HOST,web_project_id:'prj_7xOsfRtvJ9voYi7rTEfra5ncOoA0',
    web_deployment_id:'dpl_SYNTHETICFIXTURE',acting_user_id:ACTOR,core_checks:Object.fromEntries(CORE_CHECKS.map(k=>[k,'passed'])),evidence_receipts:[LEAF]};
  const provider={schema_version:'1.0',target:core.target,desired_auth_fields:publicOAuthPlan().provider_patch,
    preserved_exact_redirects:['http://127.0.0.1:3000/api/auth/callback',HOST+'/api/auth/callback'],result:'passed',dispatch_attempted:true,
    push_outcome:'command_succeeded',automatic_push_retry:false,provider_configuration_observed:true,application_verified_by_readback:true,
    original_baseline_available:true,nonselected_returned_comparator_preserved:true,independent_readback_equal:true,
    database_hook_acl_verified_by_this_operator:false,unreturned_or_secret_plaintext_preservation_proven:false,
    raw_provider_values_or_hashes_persisted:false,claim_retained:true,cli_patch_unknown_transport_or_5xx_retry:false,
    cli_patch_429_retries_maximum:5,process_cleanup_unconfirmed:false,planned_single_auth_patch:publicOAuthPlan().provider_patch,
    repository_link_and_config_preserved:true,action:'apply',evidence_kind:'actual_provider_observation',
    source_and_core_pins:Object.fromEntries([...PROVIDER_SOURCE_KEYS,CORE_PATH,LEAF].map(k=>[k,{sha256:k===CORE_PATH?coreHash:SOURCE_PINS[k]??hash,size:10,mtime_ns:1700000000000000000,device:1,inode:2}])),
    observed_at:'2026-10-30T23:59:20+00:00',logical_reads:4,config_pull_requests:12,prepared_directory:'.local/m07-pilot/hosted-provider/2026-10-30T23-59-00-123456Z-1234abcd'};
  const client={schema_version:'1.0',evidence_kind:'actual_provider_observation',target:core.target,origin:HOST,resource:RESOURCE,issuer:ISSUER,
    action:'create',observed_at:'2026-10-30T23:59:00+00:00',finished_at:'2026-10-30T23:59:10+00:00',result:'passed',
    client:{client_id:CLIENT,client_name:'Everyone Presentation Studio Hosted Pilot — Claude Code',client_type:'public',token_endpoint_auth_method:'none',
      redirect_uris:['http://localhost:3118/callback'],grant_types:['authorization_code','refresh_token'],response_types:['code'],registration_type:'manual'},
    matching_client_count:1,provider_client_observed:true,independent_readback_equal:true,client_secret_observed:false,
    original_client_baseline_available:true,other_existing_clients_equal:true,creation_dispatched:true,post_outcome:'response_validated',repeat_create_prevented:false,
    automatic_post_retry:false,application_resource_binding_observed:false,provider_configuration_observed:false,credentials_logged_or_persisted:false,
    service_role_sent_outside_fixed_auth_admin:false,claude_configuration_login_or_model_call:false,configuration_or_database_mutations:false,
    source_pins:{helper_sha256:SOURCE_PINS['development/m07/controlled-pilot/hosted-oauth-client.py'],plan_sha256:SOURCE_PINS['development/m07/controlled-pilot/hosted-oauth-plan.mjs']}};
  const binding={schema_version:'1.0',observed_at:'2026-10-30T23:59:30+00:00',action:'apply',target:core.target,resource:RESOURCE,client_id:CLIENT,
    acting_user_id:ACTOR,provider_receipt:CLIENT_PATH,sources:{...BINDING_SOURCE_PINS,[CORE_PATH]:coreHash,[LEAF]:hash,[CLIENT_PATH]:clientHash},
    rendered_queries:{update:hash,readback:hash},result:'passed',binding_observed:true,application_verified_by_readback:true,
    business_and_hook_state_preserved:true,original_baseline_available:true,independent_readback_equal:true,after:state(),independent_readback:state(),
    automatic_dispatch_retry:false,before:state(false),dispatch_attempted:true,dispatch_outcome:'command_succeeded',update_result_verified:true,claim_retained:true,
    auth_enrollment_capability_or_provider_configuration_writes:false,raw_cli_or_credentials_persisted:false,oauth_issuance_or_claude_login_proved:false};
  return {core,provider,client,binding,coreHash,clientPath:CLIENT_PATH,clientHash,expectedQueries:{update:hash,readback:hash}};
}
function rows(){
  const publicValues={MCP_AUTH_MODE:'disabled',APP_BASE_URL:HOST,APP_ENV:'staging',CENTRAL_ADAPTER_MODE:'supabase',NODE_ENV:'production',EPS_PILOT_OWNER_CONTROLLED:'true',EPS_PILOT_EXPIRES_AT:''};
  return [...Object.keys(publicValues),...Array.from({length:18},(_,i)=>`SYNTHETIC_FIELD_${i}`)].map((key,i)=>({key,id:`synthetic_env_${i}`,createdAt:1000,updatedAt:1000,
    type:Object.hasOwn(publicValues,key)?'plain':'sensitive',target:['preview','production'],value:publicValues[key]??'SYNTHETIC_PRIVATE_SENTINEL',comment:'Synthetic row',createdBy:'synthetic-owner'}));
}
const base=()=>rows().map(({key,type,target})=>({key,type,target:[...target].sort()}));
function io(options={}){
  const s={rows:rows(),writes:[],journals:[],claims:0,reads:0,verifications:0};
  const effects={verify:async()=>{s.verifications++;if(options.badGate)throw new Error('synthetic-gate-failure');},
    read:async()=>{s.reads++;const value=clone(s.rows);if(options.changedOther&&s.writes.length>0)value.find(r=>r.key==='SYNTHETIC_FIELD_0').updatedAt++;return {envs:value};},
    claim:async()=>{s.claims++;if(options.claimCollision)throw new Error('synthetic-existing-claim');},journal:async value=>{s.journals.push(clone(value));},
    create:async body=>{assert(!Array.isArray(body));s.writes.push({kind:'create',body:clone(body)});const row={...clone(body),id:`synthetic_new_${s.writes.length}`,createdAt:2000,updatedAt:2000,createdBy:'synthetic-owner'};s.rows.push(row);
      if(options.unknownCreate===s.writes.length)throw new Error('SYNTHETIC_PRIVATE_ERROR');return {created:s.writes.length%2?clone(row):[clone(row)],failed:[]};},
    patch:async(id,body)=>{s.writes.push({kind:'patch',id,body:clone(body)});const row=s.rows.find(r=>r.id===id);assert.equal(row.key,'MCP_AUTH_MODE');Object.assign(row,body,{updatedAt:3000,updatedBy:'synthetic-owner'});
      if(options.unknownPatch)throw new Error('SYNTHETIC_PRIVATE_ERROR');return clone(row);}};
  return {s,effects};
}

test('all four actual receipt gates bind the same core actor/current public client/hook and produce exact app AUTH names',()=>{
  const result=validateGateBundle(bundle(),NOW);assert.deepEqual(result.values,publicMcpEnvironment(CLIENT));assert.equal(result.actorId,ACTOR);
  assert.deepEqual(Object.keys(result.values).sort(),['MCP_AUTH_CLIENT_IDS','MCP_AUTH_ISSUER','MCP_AUTH_MODE','MCP_RESOURCE_URL']);
});
test('missing core checks, synthetic/secret/stale client, unknown provider process and changed hook/registry cannot admit writes',()=>{
  for(const mutate of [v=>v.core.core_checks.native_frames='pending',v=>v.client.evidence_kind='synthetic',v=>v.client.client_secret_observed=true,
    v=>v.client.finished_at='2026-10-30T21:00:00+00:00',v=>v.provider.process_cleanup_unconfirmed=true,
    v=>v.provider.desired_auth_fields.hook_custom_access_token_uri='https://foreign.invalid',v=>v.binding.after.hook_security.owner_and_body=false,
    v=>v.binding.after.bindings[0].client_id=ACTOR,v=>v.binding.acting_user_id=CLIENT,v=>v.binding.sources[CORE_PATH]='d'.repeat(64),
    v=>v.client.token='SYNTHETIC_PRIVATE_SENTINEL']){const value=bundle();mutate(value);assert.throws(()=>validateGateBundle(value,NOW));}
});
test('closed current25 snapshot preserves IDs/timestamps and never projects sensitive response values',()=>{
  const snapshot=environmentSnapshot({envs:rows()});assert.equal(snapshot.rows.length,25);
  assert(!JSON.stringify(snapshot.publicMetadata).includes('SYNTHETIC_PRIVATE_SENTINEL'));
  for(const invalid of [rows().map((r,i)=>i?r:{...r,id:undefined}),rows().map((r,i)=>i?r:{...r,updatedAt:undefined}),[...rows(),rows()[0]],rows().map((r,i)=>i?r:{...r,gitBranch:'synthetic'})])
    assert.throws(()=>environmentSnapshot({envs:invalid}));
});
test('four writes are exactly three creates then existingmode PATCH last, all other metadata preserved',async()=>{
  const {s,effects}=io();const result=await applyWebOAuth(publicMcpEnvironment(CLIENT),base(),effects);
  assert.equal(result.result,'passed');assert.equal(s.claims,1);assert.deepEqual(s.writes.map(w=>w.kind),['create','create','create','patch']);
  assert.deepEqual(s.writes.at(-1).body,{value:'oauth'});assert.equal(s.writes.at(-1).id,'synthetic_env_0');
  assert.equal(result.other_variable_metadata_preserved,true);assert.equal(result.runtime_verified,false);assert.equal(result.helper_write_retry,false);
  assert(!JSON.stringify({result,journals:s.journals}).includes('SYNTHETIC_PRIVATE'));
  for(const w of s.writes.slice(0,3)){assert.equal(w.body.type,'plain');assert.deepEqual(w.body.target,['preview','production']);}
});
test('failed gate or permanent claim collision prevents every create/PATCH',async()=>{
  for(const options of [{badGate:true},{claimCollision:true}]){const {s,effects}=io(options);await assert.rejects(()=>applyWebOAuth(publicMcpEnvironment(CLIENT),base(),effects));assert.equal(s.writes.length,0);}
});
test('preexisting newkey or enabledmode refuses initial operation rather than resuming/upserting',async()=>{
  for(const change of [s=>s.rows.push({key:'MCP_AUTH_ISSUER',id:'synthetic_extra',createdAt:1,updatedAt:1,type:'plain',target:['preview','production'],value:ISSUER}),
    s=>s.rows.find(r=>r.key==='MCP_AUTH_MODE').value='oauth']){const {s,effects}=io();change(s);await assert.rejects(()=>applyWebOAuth(publicMcpEnvironment(CLIENT),base(),effects));assert.equal(s.writes.length,0);}
});
test('lost create reply stops all remaining writes and leaves mode disabled, using readback only',async()=>{
  const {s,effects}=io({unknownCreate:1});const result=await applyWebOAuth(publicMcpEnvironment(CLIENT),base(),effects);
  assert.equal(result.result,'unconfirmed');assert.equal(s.writes.length,1);assert.equal(s.rows.find(r=>r.key==='MCP_AUTH_MODE').value,'disabled');
  assert.equal(result.helper_write_retry,false);assert.equal(result.claim_retained,true);
});
test('unrelated row updatedAt change stops before enabling mode',async()=>{
  const {s,effects}=io({changedOther:true});const result=await applyWebOAuth(publicMcpEnvironment(CLIENT),base(),effects);
  assert.equal(result.result,'unconfirmed');assert.equal(s.writes.filter(w=>w.kind==='patch').length,0);
});
test('selected public baseline values cannot change even if provider metadata timestamps remain identical',async()=>{
  const {s,effects}=io();const read=effects.read;effects.read=async()=>{const value=await read();if(s.writes.length>0)value.envs.find(r=>r.key==='APP_BASE_URL').value='https://foreign.invalid';return value;};
  const result=await applyWebOAuth(publicMcpEnvironment(CLIENT),base(),effects);
  assert.equal(result.result,'unconfirmed');assert.equal(s.writes.filter(w=>w.kind==='patch').length,0);
});
test('lost mode PATCH reply remains unconfirmed even when mode is observed oauth and never repeats',async()=>{
  const {s,effects}=io({unknownPatch:true});const result=await applyWebOAuth(publicMcpEnvironment(CLIENT),base(),effects);
  assert.equal(result.result,'unconfirmed');assert.equal(s.writes.filter(w=>w.kind==='patch').length,1);assert.equal(result.mode_oauth_observed,true);
});
test('CLI duplicate create after a lost reply stops logical progress; same-ID/value PATCH replays keep the exact public intent',async()=>{
  assert.equal(CLI_TRANSPORT_POLICY.helper_write_retry,false);assert.equal(CLI_TRANSPORT_POLICY.cli_network_5xx_retries_maximum,3);
  assert.equal(CLI_TRANSPORT_POLICY.cli_request_attempts_maximum_per_operation,4);assert.match(CLI_TRANSPORT_POLICY.cli_request_attempt_scope,/No exact wire-count claim/u);
  const first=io();let createWire=0;const create=first.effects.create;
  first.effects.create=async body=>{createWire++;await create(body);createWire++;assert(first.s.rows.some(r=>r.key===body.key));throw new Error('synthetic-duplicate-key-upsert-false');};
  const unknown=await applyWebOAuth(publicMcpEnvironment(CLIENT),base(),first.effects);
  assert.equal(createWire,2);assert.equal(first.s.writes.length,1);assert.equal(first.s.rows.filter(r=>r.key==='MCP_AUTH_CLIENT_IDS').length,1);
  assert.equal(unknown.result,'unconfirmed');assert.equal(first.s.writes.filter(w=>w.kind==='patch').length,0);
  const second=io();let patchWire=0;
  second.effects.patch=async(id,body)=>{second.s.writes.push({kind:'patch',id,body:clone(body)});const value=second.s.rows.find(r=>r.id===id);
    for(let attempt=0;attempt<4;attempt++){patchWire++;assert.equal(value.key,'MCP_AUTH_MODE');Object.assign(value,body,{updatedAt:3000+attempt,updatedBy:'synthetic-owner'});}return clone(value);};
  const complete=await applyWebOAuth(publicMcpEnvironment(CLIENT),base(),second.effects);
  assert.equal(patchWire,4);assert.equal(complete.result,'passed');assert.equal(complete.helper_write_operations_attempted,4);
  assert.equal(second.s.rows.find(r=>r.key==='MCP_AUTH_MODE').value,'oauth');assert.equal(complete.other_variable_metadata_preserved,true);
});
test('operator project binding includes exact team/name/root/Node24, no guessed target',()=>{
  const value={id:'prj_7xOsfRtvJ9voYi7rTEfra5ncOoA0',accountId:'team_gboXPxTevpCOZuaA8eY9PmR1',name:'everyone-presentation-pilot',rootDirectory:'apps/web',nodeVersion:'24.x',sourceFilesOutsideRootDirectory:true};
  validateWebProject(value);for(const change of [{id:'prj_foreign'},{accountId:'team_foreign'},{rootDirectory:null},{nodeVersion:'26.x'}])assert.throws(()=>validateWebProject({...value,...change}));
  assert(BASE_RECEIPT.endsWith('web-owner-control.json'));
});
