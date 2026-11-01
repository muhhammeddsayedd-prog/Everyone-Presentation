import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Buffer } from 'node:buffer';
import { PREPARATION_ENABLED, MAIN, READY_REFERENCE, BASE_OPERATOR_SHA256, RELEASE_DATA_SHA256, PRIOR_NATIVE_DIGEST, PUBLIC_HELPER_PINS, compileSource, replaceOnce, sha, validateImage, validateNativeReady, validateContextProof } from './compile-native-probe.mjs';
import { NATIVE_PROBE_RELEASE } from './native-probe-release.mjs';
import { admitNativeProbe } from './admit-native-probe.mjs';
const ROOT = path.resolve(import.meta.dirname, '../../..');
const image = 'muhammed-abdelrahman/everyone-presentation-worker-pilot/native@sha256:' + '46de2f0c0772e10d712fba514788d24041d6741faa8966b6fe9c554fe47e4af4';
const base = await readFile(path.join(MAIN, 'tools/probe-hosted-native.mjs'));
const release = await readFile(path.join(import.meta.dirname, 'native-probe-release.mjs'));
const readyReference = structuredClone(READY_REFERENCE);
const transformation = compileSource(base, MAIN, image, sha(release), 'b'.repeat(64), readyReference);
const compiled = transformation.source;
function plan() {
  return { schema_version:'1.0', preparation_enabled:true, mode:'smoke', image,
    source_sha256:NATIVE_PROBE_RELEASE.source_sha256, file_count:165, context_relative:NATIVE_PROBE_RELEASE.context_relative,
    context_proof:structuredClone(NATIVE_PROBE_RELEASE.context_proof),native_ready:structuredClone(readyReference),
    base_operator_sha256:BASE_OPERATOR_SHA256,release_sha256:sha(release),compiler_sha256:'b'.repeat(64),generated_operator_sha256:sha(compiled) };
}
function ready() {
  return { read_only:true,provider_mutations:false,team_id:'team_gboXPxTevpCOZuaA8eY9PmR1',
    repository:{id:'repo_OpIvBNiZ8vPVROs68HxcMb39W6yz',name:'native',project_id:'prj_I4SMkDzaDy0KHNgiF00v4Da5aLb6',public:false},
    images:{images:[{repository_id:'repo_OpIvBNiZ8vPVROs68HxcMb39W6yz',kind:'manifest',manifest_digest:image.split('@')[1],status:'ready',architecture:'amd64',platform:'linux'}]} };
}
test('compiler pins frozen operator and rejects drift or ambiguous seams', () => {
  assert.equal(sha(base), BASE_OPERATOR_SHA256);
  assert.throws(() => compileSource(Buffer.concat([base,Buffer.from('\n')]),MAIN,image,sha(release),'b'.repeat(64),readyReference));
  assert.throws(() => compileSource(base,MAIN,image,'c'.repeat(64),'b'.repeat(64),readyReference));
  assert.throws(() => replaceOnce('twice twice','twice','replacement'));
  assert.throws(() => replaceOnce('absent','missing','replacement'));
  assert.throws(() => validateImage(image.replace('worker-pilot','other')));
  assert.throws(() => validateImage(image.replace(/46de[0-9a-f]{60}$/u,'a'.repeat(64))));
  assert.throws(() => compileSource(base,MAIN,image,sha(release),'b'.repeat(64),{...readyReference,sha256:'0'.repeat(64)}));
});
test('new compiler changes only bounded admission/import/release/receipt/claim seams', () => {
  const text = compiled.toString('utf8');
  assert.match(text,/completion-native\/native-probe-release\.mjs/u);
  assert.match(text,/tracking\/evidence\/m07\/completion-native/u);
  assert.match(text,/completion-native46de-image-smoke/u);
  assert.match(text,/plan\.mode !== 'smoke'/u);
  for (const preserved of ['deleteOrphanSnapshots: false',"resume: false",'initial_current_cleanup_sessions_equal','observeFinalProbeResource',
    'PROBE_OUTSTANDING_RESOURCE','PROBE_SNAPSHOT_UNEXPECTED',"networkPolicy: 'deny-all'",'maximum_named_resources: mode === \'smoke\' ? 10 : 1',
    "cliPackage.version !== '65.8.0'","version !== '3.9.1'",'SDK_SOURCE_PINS','verifyNativeSourceSeal','canReleaseProbeLock']) assert.ok(text.includes(preserved),preserved);
  assert.ok(text.includes("const LOCK = path.join(ROOT, '.local/m07-pilot/native-probe.lock.json');"));
});
test('compiled module is import-only safe and validators admit the new source and deny old source', async () => {
  const generated = await import('data:text/javascript;base64,' + compiled.toString('base64'));
  const current = { source_sha256:NATIVE_PROBE_RELEASE.source_sha256,files:[] };
  assert.doesNotThrow(() => generated.validateImageSourceSeal(current,current));
  assert.throws(() => generated.validateImageSourceSeal({...current,source_sha256:'09b6d4b881594dc7664953409f6e0bdeb925c19bf19fb3a4331787abf09c921f'},current));
  assert.deepEqual(generated.probePlan('smoke'),{mode:'smoke',maximum_named_resources:10,overall_timeout_ms:600000,cleanup_timeout_ms:30000,maximum_http_calls:240});
  assert.equal(generated.canReleaseProbeLock([{name:'owned',attempted:true,identity_observed:true,absence_verified:true,snapshot_absence_verified:false}]),false);
});

function receipt() {
  const phases = Object.entries({ image_source_seal:1,boundary:1,image_control_user:1,network_denial:1,smoke_document:2,smoke_pdf_raster:1,
    smoke_video:1,smoke_review_fit:1,smoke_presentation_render:1,smoke_presentation_validate:1,smoke_presentation_export_render:1,smoke_presentation_export_validate:1 })
    .flatMap(([phase,count])=>Array.from({length:count},()=>({phase,result:'passed'})));
  phases.find(row=>row.phase==='image_source_seal').source_sha256=NATIVE_PROBE_RELEASE.source_sha256;
  phases.find(row=>row.phase==='boundary').proof={protocol:'eps-native-boundary-v1',uid:65432,gid:65432,capabilities_empty:true,no_new_privileges:true,known_write_denials:10,writable_outside_tmp:0,checked_paths:100};
  phases.find(row=>row.phase==='image_control_user').uid=0;
  phases.find(row=>row.phase==='network_denial').proof={protocol:'eps-native-network-v1',dns_denied:true,ip_denied:true};
  return {schema_version:'1.0',result:'passed',source_sha256:NATIVE_PROBE_RELEASE.source_sha256,image,project_id:'prj_I4SMkDzaDy0KHNgiF00v4Da5aLb6',team_id:'team_gboXPxTevpCOZuaA8eY9PmR1',
    probe_release:structuredClone(NATIVE_PROBE_RELEASE),plan:{mode:'smoke',maximum_named_resources:10,maximum_http_calls:240},cleanup_confirmed:true,initial_current_cleanup_sessions_equal:true,
    lock_released:true,permanent_completion_native_claim_created:true,token_persisted:false,private_media_used:false,worker_polling:false,db_jobs_or_openai_n8n_calls:false,
    provider_control_plane_called:true,cli_mint_commands:1,sdk_http_calls:180,completion_native_admission:{base_operator_sha256:BASE_OPERATOR_SHA256,release_sha256:sha(release),compiler_sha256:'b'.repeat(64),mode:'smoke',image,source_sha256:NATIVE_PROBE_RELEASE.source_sha256,context_proof:structuredClone(NATIVE_PROBE_RELEASE.context_proof),native_ready:structuredClone(readyReference)},
    resources:Array.from({length:10},(_,i)=>({name:'owned-'+i,attempted:true,identity_observed:true,absence_verified:true,snapshot_absence_verified:true,session_consistency_failed:false,
      initial_current_cleanup_session_equal:true,session_id:'session-'+i,initial_session_id:'session-'+i,current_session_id:'session-'+i,cleanup_session_id:'session-'+i})),phases,
    presentation_checks:['presentation_render','presentation_validate','presentation_export_render','presentation_export_validate'].map(task=>({task,page_count:5,video_links:4,pdf_bytes:100,
      rendered_candidate_fields:task.endsWith('render')?40:null,rendered_frame_draws:task.endsWith('render')?6:null,rendered_logo_draws:task.endsWith('render')?5:null,validated_image_draws:task.endsWith('render')?null:11}))};
}
test('receipt admission is source/image/job-scope specific and keeps app acceptance separate',()=>{
  assert.equal(admitNativeProbe(receipt(),plan()).native_tasks_passed,9);
  assert.equal(admitNativeProbe(receipt(),plan()).actual_worker_ready_or_specs_AI_app_acceptance,false);
  for(const change of [r=>r.source_sha256='c'.repeat(64),r=>r.probe_release.file_count=160,r=>r.image=image.replace(/46de[0-9a-f]{60}$/u,'c'.repeat(64)),r=>r.resources.pop(),r=>r.phases.pop()]){
    const value=receipt();change(value);assert.throws(()=>admitNativeProbe(value,plan()));
  }
});
test('receipt admission refuses failed ownership/session/cleanup/snapshot/network proofs',()=>{
  for(const change of [r=>r.lock_released=false,r=>r.cleanup_confirmed=false,r=>r.resources[0].snapshot_absence_verified=false,r=>r.resources[0].current_session_id='other',
    r=>r.resources[0].identity_observed=false,r=>r.resources[0].session_consistency_failed=true,r=>r.phases.find(p=>p.phase==='network_denial').proof.ip_denied=false,
    r=>r.phases.find(p=>p.phase==='boundary').proof.uid=65534,r=>r.permanent_completion_native_claim_created=false,r=>r.failed_phase='smoke_video']){
    const value=receipt();change(value);assert.throws(()=>admitNativeProbe(value,plan()));
  }
});


test('explicitly disabled preparation refuses before reading any input or writing files',async()=>{
  assert.equal(typeof PREPARATION_ENABLED,'boolean');let touched=0;
  // Exercise a disabled copy in memory even after Root arms the source. This
  // never enables execution and adds no runtime override to the real compiler.
  let disabledSource=(await readFile(path.join(import.meta.dirname,'compile-native-probe.mjs'))).toString('utf8');
  disabledSource=replaceOnce(disabledSource,`export const PREPARATION_ENABLED = ${PREPARATION_ENABLED};`,'export const PREPARATION_ENABLED = false;');
  disabledSource=replaceOnce(disabledSource,"'./native-probe-release.mjs'",JSON.stringify(new URL('./native-probe-release.mjs',import.meta.url).href));
  disabledSource=replaceOnce(disabledSource,"const ROOT = path.resolve(import.meta.dirname, '../../..');",`const ROOT = ${JSON.stringify(ROOT)};`);
  const disabled=await import('data:text/javascript;base64,'+Buffer.from(disabledSource).toString('base64'));
  assert.equal(disabled.PREPARATION_ENABLED,false);
  const port=async()=>{touched++;throw Error('must not run');};
  await assert.rejects(disabled.prepareNativeProbe(['synthetic-input'],{regular:port,mkdir:port,realpath:port,writeFile:port}));
  assert.equal(touched,0);
});

test('actual compiled wire reverses exactly to the frozen operator and retains its safety bodies',()=>{
  let reverted=compiled.toString('utf8');
  assert.equal(transformation.changes.length,12);
  for(const change of [...transformation.changes].reverse()){
    assert.equal(sha(change.before),change.before_sha256);assert.equal(sha(change.after),change.after_sha256);
    reverted=replaceOnce(reverted,change.after,change.before);
  }
  assert.equal(reverted,base.toString('utf8'));assert.equal(sha(Buffer.from(reverted)),BASE_OPERATOR_SHA256);
  const releasePath=JSON.parse(compiled.toString('utf8').match(/const releaseFile = path.join\(ROOT, ("[^"\n]+")\);/u)[1]);
  assert.equal(path.resolve(MAIN,releasePath),path.join(ROOT,'development/m07/completion-native/native-probe-release.mjs'));
  const text=compiled.toString('utf8');
  for(const fragment of ['SDK_SOURCE_PINS','apiCalls > plan.maximum_http_calls',"resume: false",'initial_current_cleanup_sessions_equal',
    'observeFinalProbeResource','canReleaseProbeLock','deleteOrphanSnapshots: false',"networkPolicy: 'deny-all'",'verifyNativeSourceSeal',
    'plan.maximum_named_resources','source.files?.length !== NATIVE_PROBE_RELEASE.file_count',"zod/package.json'","4.6.7"]){assert.ok(text.includes(fragment),fragment);}
  assert.ok(text.includes(`if (!${PREPARATION_ENABLED} || plan.mode`));
  assert.ok(text.includes('completion-native46de-'+image.split(':').at(-1)+'.claim.json'));
  assert.equal(text.includes('native-probe34-'),false);
});

test('Ready gate requires explicit actual native registry readiness and refuses the old image',()=>{
  assert.equal(validateNativeReady(ready(),image).registry_native_ready,true);
  assert.throws(()=>validateImage(image.replace('sha256:'+'46de2f0c0772e10d712fba514788d24041d6741faa8966b6fe9c554fe47e4af4',PRIOR_NATIVE_DIGEST)));
  for(const change of [r=>r.read_only=false,r=>r.provider_mutations=true,r=>r.repository.public=true,
    r=>r.repository.project_id='another',r=>r.repository.id='another',r=>r.repository.name='daemon',
    r=>r.images.images[0].repository_id='another',r=>r.images.images[0].kind='index',
    r=>r.images.images[0].status='pending',r=>r.images.images[0].architecture='arm64',
    r=>r.images.images[0].manifest_digest='sha256:'+'c'.repeat(64),r=>r.images.images.push(structuredClone(r.images.images[0]))]){
    const value=ready();change(value);assert.throws(()=>validateNativeReady(value,image));
  }
});

test('fixed actual public context proof and all165-row manifest are bound without claiming hosted execution',async()=>{
  assert.equal(sha(release),RELEASE_DATA_SHA256);
  const proofBytes=await readFile(path.join(ROOT,NATIVE_PROBE_RELEASE.context_proof.path));
  assert.equal(sha(proofBytes),NATIVE_PROBE_RELEASE.context_proof.sha256);
  const proof=JSON.parse(proofBytes);const source=JSON.parse(await readFile(path.join(MAIN,NATIVE_PROBE_RELEASE.context_relative,'apps/worker/native-source.json')));
  assert.equal(validateContextProof(proof,source).file_count,165);
  assert.equal(validateContextProof(proof,source).native_guard_and_contract_pins,8);
  for(const [relative,digest]of Object.entries(PUBLIC_HELPER_PINS))assert.equal(sha(await readFile(path.join(MAIN,relative))),digest);
  for(const change of [r=>r.file_count=160,r=>r.source_sha256='b'.repeat(64),r=>r.private_hits=1,r=>r.worker_deployed=true,r=>r.private_value_families=6,r=>r.private_inputs=0,r=>r.private_input_stable=false]){
    const value=structuredClone(proof);change(value);assert.throws(()=>validateContextProof(value,source));
  }
  const changed=structuredClone(source);changed.files[0].sha256='0'.repeat(64);assert.throws(()=>validateContextProof(proof,changed));
});

test('pure admission binds exact new preparation provenance and all terminal phases',()=>{
  assert.equal(admitNativeProbe(receipt(),plan()).native_tasks_passed,9);
  for(const change of [r=>r.completion_native_admission.compiler_sha256='c'.repeat(64),r=>r.completion_native_admission.release_sha256='c'.repeat(64),
    r=>r.completion_native_admission.native_ready.sha256='c'.repeat(64),r=>r.completion_native_admission.context_proof.sha256='c'.repeat(64),
    r=>r.phases.push({phase:'unrecognized',result:'passed'}),r=>r.phases.reverse()]){
    const value=receipt();change(value);assert.throws(()=>admitNativeProbe(value,plan()));
  }
  const disabled=plan();disabled.preparation_enabled=false;assert.throws(()=>admitNativeProbe(receipt(),disabled));
  assert.throws(()=>admitNativeProbe(receipt(),undefined));
});
