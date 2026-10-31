/** Pure synthetic fixtures only. No local config, CLI, provider or filesystem IO. */
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { rootCertificates } from 'node:tls';
import test from 'node:test';
import { workerEnvironmentValues, workerEnvironmentMetadata, validateWorkerProject,
  applyWorkerEnvironment, composeWorkerEnvironment, inspectWorkerMetadata } from './worker-environment.mjs';

const SOURCE = 'bc774c88083d106fd522ee6277fc8a81033a6b94ff05e9debdfe1d6ee661a735';
const PROJECT = 'prj_I4SMkDzaDy0KHNgiF00v4Da5aLb6';
const TEAM = 'team_gboXPxTevpCOZuaA8eY9PmR1';
const flags = ['EPS_SPECS_FILES_ENABLED', 'EPS_CANDIDATE_MEDIA_ENABLED', 'EPS_FRAME_EXTRACTION_ENABLED',
  'EPS_PDF_VISION_ENABLED', 'EPS_REVIEW_ENABLED', 'EPS_PRESENTATION_ENABLED', 'EPS_GUEST_EXPORTS_ENABLED'];
const manifest = () => Buffer.from(JSON.stringify({ schema_version:'1.0', transport:'vercel_sandbox',
  protocol:'eps-native-files-v1', image:`muhammed-abdelrahman/everyone-presentation-worker-pilot/native@sha256:${'a'.repeat(64)}`,
  region:'dub1', source_sha256:SOURCE }) + '\n');
const fixture = () => ({ OPENAI_API_KEY:'synthetic-openai-key-never-real', OPENAI_EXTRACTION_MODEL:'synthetic-extraction-v1',
  OPENAI_TRANSCRIPTION_MODEL:'synthetic-transcription-v1', EPS_SPECS_PG_HOST:'aws-0-eu-west-1.pooler.supabase.com',
  EPS_SPECS_PG_PASSWORD:'synthetic-password-not-real-0123456789', EPS_SPECS_PG_CA_BASE64:Buffer.from(rootCertificates[0]).toString('base64'),
  N8N_DISPATCH_URL:'https://synthetic.app.n8n.cloud/webhook/eps-wf01-specs-stage-v1', N8N_DISPATCH_SECRET:'1'.repeat(64),
  N8N_CANDIDATE_DISPATCH_URL:'https://synthetic.app.n8n.cloud/webhook/eps-wf02-candidate-stage-v1', N8N_CANDIDATE_DISPATCH_SECRET:'2'.repeat(64),
  N8N_REVIEW_DISPATCH_URL:'https://synthetic.app.n8n.cloud/webhook/eps-wf05-review-suggestion-stage-v1', N8N_REVIEW_DISPATCH_SECRET:'3'.repeat(64),
  N8N_PRESENTATION_DISPATCH_URL:'https://synthetic.app.n8n.cloud/webhook/eps-wf03-presentation-stage-v1', N8N_PRESENTATION_DISPATCH_SECRET:'4'.repeat(64),
  SUPABASE_URL:'https://pyibofyctwnqpvktepse.supabase.co', SUPABASE_PUBLISHABLE_KEY:'sb_publishable_synthetic_fixture',
  ...Object.fromEntries(flags.map(key => [key,'true'])) });
const project = () => ({id:PROJECT,accountId:TEAM,name:'everyone-presentation-worker-pilot',nodeVersion:'24.x',rootDirectory:null,oidcTokenConfig:{enabled:true}});
const copy = value => JSON.parse(JSON.stringify(value));

test('closed hosted projection selects28fields, public manifest hash, seven true flags and no ambient secrets/images/OS fields', () => {
  const input = {...fixture(), N8N_API_KEY:'SYNTHETIC_MANAGEMENT_SENTINEL', N8N_BASE_URL:'https://management.invalid',
    VERCEL_TOKEN:'SYNTHETIC_PERSONAL_SENTINEL', DATABASE_URL:'SYNTHETIC_DB_SENTINEL', EPS_MEDIA_IMAGE_ID:'sha256:local',
    EPS_FRAME_IMAGE_ID:'sha256:local', EPS_PDF_RASTER_IMAGE_ID:'sha256:local', PATH:'synthetic', TEMP:'synthetic',SystemRoot:'synthetic',
    VERCEL:'1',VERCEL_OIDC_TOKEN_FILE:'/synthetic/token',SUPABASE_SERVICE_ROLE_KEY:'SYNTHETIC_SERVICE_SENTINEL'};
  const output = workerEnvironmentValues(input,manifest());
  assert.equal(Object.keys(output).length,28);
  assert.equal(output.EPS_NATIVE_MANIFEST_SHA256,createHash('sha256').update(manifest()).digest('hex'));
  assert.equal(output.EPS_PILOT_OWNER_CONTROLLED,'true'); assert.equal(output.EPS_PILOT_EXPIRES_AT,undefined);
  for(const key of flags) assert.equal(output[key],'true');
  for(const key of Object.keys(input).filter(key=>!Object.hasOwn(fixture(),key))) assert.equal(output[key],undefined);
  assert(!JSON.stringify(output).includes('SENTINEL'));
});

test('manifest requires exact frozen source/private project digest and closed shape; absent/malformed is denied', () => {
  const valid=JSON.parse(manifest());
  for(const bad of [undefined,Buffer.from('{}'),Buffer.from('not-json'),Buffer.from(JSON.stringify({...valid,source_sha256:'b'.repeat(64)})),
    Buffer.from(JSON.stringify({...valid,image:valid.image.replace('/native@','/other@')})),Buffer.from(JSON.stringify({...valid,extra:true}))])
    assert.throws(()=>workerEnvironmentValues(fixture(),bad));
});

test('all enabled fields, scoped PG certificate/password, same production n8n origin and separate secrets are enforced', () => {
  for(const key of flags) assert.throws(()=>workerEnvironmentValues({...fixture(),[key]:'false'},manifest()));
  for(const change of [{OPENAI_API_KEY:''},{OPENAI_EXTRACTION_MODEL:'bad\nmodel'}, {EPS_SPECS_PG_HOST:'127.0.0.1'},
    {EPS_SPECS_PG_PASSWORD:'short'},{EPS_SPECS_PG_CA_BASE64:'bm90LWEtdHJ1c3QtY2VydGlmaWNhdGU='},
    {N8N_DISPATCH_URL:'https://synthetic.app.n8n.cloud/webhook-test/eps-wf01-specs-stage-v1'},
    {N8N_REVIEW_DISPATCH_URL:'https://other.app.n8n.cloud/webhook/eps-wf05-review-suggestion-stage-v1'},
    {N8N_CANDIDATE_DISPATCH_SECRET:'1'.repeat(64)}, {SUPABASE_PUBLISHABLE_KEY:'sb_secret_synthetic_fixture'}])
    assert.throws(()=>workerEnvironmentValues({...fixture(),...change},manifest()));
});

test('WF01 accepts its existing opaque dispatch credential contract while the other three remain strict hex64', () => {
  const opaque = 'synthetic-wf01:opaque+dispatch/token_=never-real';
  const output = workerEnvironmentValues({...fixture(),N8N_DISPATCH_SECRET:opaque},manifest());
  assert.equal(output.N8N_DISPATCH_SECRET,opaque);
  for(const invalid of ['x'.repeat(31),' '.repeat(64),'x'.repeat(32)+'\r','x'.repeat(32)+'\n'])
    assert.throws(()=>workerEnvironmentValues({...fixture(),N8N_DISPATCH_SECRET:invalid},manifest()));
  for(const key of ['N8N_CANDIDATE_DISPATCH_SECRET','N8N_REVIEW_DISPATCH_SECRET','N8N_PRESENTATION_DISPATCH_SECRET'])
    for(const invalid of [opaque,'a'.repeat(63),'A'.repeat(64),'x'.repeat(64)])
      assert.throws(()=>workerEnvironmentValues({...fixture(),[key]:invalid},manifest()));
  assert.throws(()=>workerEnvironmentValues({...fixture(),N8N_DISPATCH_SECRET:'2'.repeat(64)},manifest()));
  assert.throws(()=>workerEnvironmentValues({...fixture(),N8N_DISPATCH_SECRET:' '+'2'.repeat(64)+' '},manifest()));
  const padded = ' '+opaque+' '; assert.equal(workerEnvironmentValues({...fixture(),N8N_DISPATCH_SECRET:padded},manifest()).N8N_DISPATCH_SECRET,padded);
});

test('fixed worker project denies foreign owner/name, Node26, nonnull root and absent/disabled OIDC', () => {
  validateWorkerProject(project());
  for(const change of [{id:'prj_foreign'},{accountId:'team_foreign'},{name:'other'},{nodeVersion:'26.x'},
    {rootDirectory:'apps/web'},{oidcTokenConfig:undefined},{oidcTokenConfig:{enabled:false}}])
    assert.throws(()=>validateWorkerProject({...project(),...change}));
});

test('expected metadata marks PG host/password/CA, OpenAI key and every n8n URL/secret sensitive; production only', () => {
  const metadata=workerEnvironmentMetadata(); assert.equal(metadata.length,28);
  const secrets=metadata.filter(row=>row.type==='sensitive'); assert.equal(secrets.length,12);
  assert(secrets.some(row=>row.key==='EPS_SPECS_PG_HOST'));
  for(const row of metadata) {assert.deepEqual(row.target,['production']);assert.deepEqual(Object.keys(row).sort(),['key','target','type']);}
});

test('metadata read strips private values and denies scoped, duplicate, downgraded or extra fields in expected readback', () => {
  const expected=workerEnvironmentMetadata();
  const response={envs:expected.map(row=>({...row,value:'SYNTHETIC_PRIVATE_RESPONSE',id:'ignored'}))};
  assert.deepEqual(inspectWorkerMetadata(response,{expected:true}),expected);
  assert(!JSON.stringify(inspectWorkerMetadata(response)).includes('SYNTHETIC_PRIVATE_RESPONSE'));
  for(const rows of [[...response.envs,response.envs[0]],response.envs.map(row=>row.key==='OPENAI_API_KEY'?{...row,type:'plain'}:row),
    response.envs.map((row,index)=>index?row:{...row,target:['preview']}),
    response.envs.map((row,index)=>index?row:{...row,customEnvironmentIds:['synthetic-scope']}),
    response.envs.map((row,index)=>index?row:{...row,gitBranch:'synthetic-branch'}),
    [...response.envs,{key:'N8N_API_KEY',type:'sensitive',target:['production']}],response.envs.slice(1)])
    assert.throws(()=>inspectWorkerMetadata({envs:rows},{expected:true}));
});

function transport({unknownAt=null,wrongAt=null,claimFails=false,secondRead=[]}={}) {
  const state={rows:[],claims:0,posts:[],journals:[],reads:0};
  const io={
    readMetadata:async()=>{state.reads++;return {envs:copy(state.reads===2?secondRead:state.rows)};},
    claim:async value=>{state.claims++; if(claimFails)throw new Error('SYNTHETIC_PRIVATE_ERROR');state.claim=copy(value);},
    journal:async value=>{state.journals.push(copy(value));},
    create:async body=>{assert(!Array.isArray(body));state.posts.push(copy(body));state.rows.push({key:body.key,type:body.type,target:body.target,value:'SYNTHETIC_PRIVATE_RESPONSE'});
      if(state.posts.length===unknownAt) throw new Error('SYNTHETIC_PRIVATE_ERROR');
      return {created:state.posts.length===wrongAt?{...state.rows.at(-1),type:'system'}:state.posts.length%2?state.rows.at(-1):[state.rows.at(-1)],failed:[]};},
  };
  return {state,io};
}

test('single-use apply sends exactly one variable per call, validates object/array creates and independent complete metadata', async()=>{
  const {state,io}=transport();const result=await applyWorkerEnvironment(workerEnvironmentValues(fixture(),manifest()),io);
  assert.equal(result.result,'passed');assert.equal(state.posts.length,28);assert.equal(state.claims,1);assert.equal(state.reads,4);
  assert.equal(state.journals.filter(row=>row.phase==='attempted').length,28);assert.equal(state.journals.filter(row=>row.phase==='created').length,28);
  assert.deepEqual(result.observed_metadata,workerEnvironmentMetadata());assert.equal(result.independent_metadata_equal,true);
  assert(!JSON.stringify({...result,claim:state.claim,journals:state.journals}).includes('SYNTHETIC_PRIVATE'));
  for(const body of state.posts)assert.deepEqual(body.target,['production']);
});

test('nonempty initial metadata or a concurrent variable after claim denies all POSTs',async()=>{
  for(const late of [false,true]){const {state,io}=transport({secondRead:late?[{key:'OTHER',type:'plain',target:['production']}]:[]});
    if(!late)state.rows=[{key:'OTHER',type:'plain',target:['production']}];
    await assert.rejects(()=>applyWorkerEnvironment(workerEnvironmentValues(fixture(),manifest()),io));assert.equal(state.posts.length,0);}
});

test('permanent claim collision denies all writes and never adopts a previous partial batch',async()=>{
  const {state,io}=transport({claimFails:true});await assert.rejects(()=>applyWorkerEnvironment(workerEnvironmentValues(fixture(),manifest()),io));
  assert.equal(state.posts.length,0);assert.equal(state.claims,1);
});

test('lost create reply stops after one logical helper operation and only reads metadata; it cannot resume or replay',async()=>{
  const {state,io}=transport({unknownAt:1});const result=await applyWorkerEnvironment(workerEnvironmentValues(fixture(),manifest()),io);
  assert.equal(state.posts.length,1);assert.equal(state.reads,4);assert.equal(result.result,'unconfirmed');assert.equal(result.helper_write_retry,false);
  assert.equal(result.observed_metadata.length,1);assert(!JSON.stringify(result).includes('SYNTHETIC_PRIVATE'));
});

test('CLI unique-key retry after a lost create reply stops helper progress and qualifies transport attempts in claim/receipt',async()=>{
  const {state,io}=transport();const create=io.create;let wireAttempts=0;
  io.create=async body=>{wireAttempts++;await create(body);wireAttempts++;
    assert.equal(state.rows.filter(row=>row.key===body.key).length,1);throw new Error('SYNTHETIC_DUPLICATE_KEY_UPSERT_FALSE');};
  const result=await applyWorkerEnvironment(workerEnvironmentValues(fixture(),manifest()),io);
  assert.equal(wireAttempts,2);assert.equal(state.posts.length,1);assert.equal(state.rows.length,1);assert.equal(result.result,'unconfirmed');
  for(const value of [result,state.claim]){
    assert.equal(value.helper_write_retry,false);assert.equal(value.cli_network_5xx_retries_maximum,3);
    assert.equal(value.cli_request_attempts_maximum_per_operation,4);assert.equal(value.cli_dpop_nonce_resends_maximum_per_request_attempt,1);
    assert.match(value.cli_request_attempt_scope,/No exact wire-count claim/u);assert.equal(Object.hasOwn(value,'automatic_write_retry'),false);
  }
  assert(!JSON.stringify({result,claim:state.claim,journals:state.journals}).includes('SYNTHETIC_PRIVATE'));
});

test('malformed success response or later independent mismatch denies success without another POST',async()=>{
  const first=transport({wrongAt:1});const bad=await applyWorkerEnvironment(workerEnvironmentValues(fixture(),manifest()),first.io);
  assert.equal(bad.result,'unconfirmed');assert.equal(first.state.posts.length,1);
  const last=transport();const read=last.io.readMetadata;last.io.readMetadata=async()=>{const value=await read();if(last.state.reads===4)value.envs.pop();return value;};
  const result=await applyWorkerEnvironment(workerEnvironmentValues(fixture(),manifest()),last.io);
  assert.equal(result.result,'unconfirmed');assert.equal(last.state.posts.length,28);assert.equal(result.independent_metadata_equal,false);
});

test('reviewed loader composition explicitly enables files, strips management fields through createSpecs and never uploads OS/images',async()=>{
  const input=fixture();let filesCalls=0;let createCalls=0;
  const loaders={provider:async options=>{assert.deepEqual(options,{environment:{}});return {...input,N8N_API_KEY:'SYNTHETIC_MANAGEMENT'};},runtime:async()=>input,
    files:async options=>{filesCalls++;assert.deepEqual(options,{environment:{EPS_SPECS_FILES_ENABLED:'true'}});return input;},
    candidate:async()=>input,frames:async()=>input,pdfVision:async()=>input,review:async()=>input,presentation:async()=>input,
    create:(provider,runtime,environment,files)=>{createCalls++;assert.deepEqual(environment,{});assert.equal(provider.N8N_API_KEY,'SYNTHETIC_MANAGEMENT');assert.equal(files.EPS_SPECS_FILES_ENABLED,'true');
      return {...runtime,...files,OPENAI_API_KEY:provider.OPENAI_API_KEY};}};
  const result=workerEnvironmentValues(await composeWorkerEnvironment(loaders),manifest());assert.equal(result.N8N_API_KEY,undefined);
  assert.equal(filesCalls,1);assert.equal(createCalls,1);assert.equal(result.EPS_GUEST_EXPORTS_ENABLED,'true');
});
