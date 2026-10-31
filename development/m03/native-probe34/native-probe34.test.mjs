import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Buffer } from 'node:buffer';
import { BASE_OPERATOR_SHA256, compileSource, replaceOnce, sha, validateImage } from './compile-native-probe34.mjs';
import { NATIVE_PROBE_RELEASE } from './native-probe34-release.mjs';
import { admitNativeProbe34 } from './admit-native-probe34.mjs';
const ROOT = path.resolve(import.meta.dirname, '../../..');
const image = 'muhammed-abdelrahman/everyone-presentation-worker-pilot/native@sha256:' + 'a'.repeat(64);
const base = await readFile(path.join(ROOT, 'tools/probe-hosted-native.mjs'));
const release = await readFile(path.join(import.meta.dirname, 'native-probe34-release.mjs'));
const compiled = compileSource(base, ROOT, image, sha(release), 'b'.repeat(64));
test('compiler pins frozen operator and rejects drift or ambiguous seams', () => {
  assert.equal(sha(base), BASE_OPERATOR_SHA256);
  assert.throws(() => compileSource(Buffer.concat([base,Buffer.from('\n')]),ROOT,image,sha(release),'b'.repeat(64)));
  assert.throws(() => compileSource(base,ROOT,image,'c'.repeat(64),'b'.repeat(64)));
  assert.throws(() => replaceOnce('twice twice','twice','replacement'));
  assert.throws(() => replaceOnce('absent','missing','replacement'));
  assert.throws(() => validateImage(image.replace('worker-pilot','other')));
});
test('new compiler changes only bounded admission/import/release/receipt/claim seams', () => {
  const text = compiled.toString('utf8');
  assert.match(text,/native-probe34-release\.mjs/u);
  assert.match(text,/tracking\/evidence\/m03\/native-probe34/u);
  assert.match(text,/new-English34-image-native-smoke/u);
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
    lock_released:true,permanent_probe34_claim_created:true,token_persisted:false,private_media_used:false,worker_polling:false,db_jobs_or_openai_n8n_calls:false,
    provider_control_plane_called:true,cli_mint_commands:1,sdk_http_calls:180,probe34_admission:{base_operator_sha256:BASE_OPERATOR_SHA256,release_sha256:sha(release),compiler_sha256:'b'.repeat(64),mode:'smoke',image,source_sha256:NATIVE_PROBE_RELEASE.source_sha256},
    resources:Array.from({length:10},(_,i)=>({name:'owned-'+i,attempted:true,identity_observed:true,absence_verified:true,snapshot_absence_verified:true,session_consistency_failed:false,
      initial_current_cleanup_session_equal:true,session_id:'session-'+i,initial_session_id:'session-'+i,current_session_id:'session-'+i,cleanup_session_id:'session-'+i})),phases,
    presentation_checks:['presentation_render','presentation_validate','presentation_export_render','presentation_export_validate'].map(task=>({task,page_count:5,video_links:4,pdf_bytes:100,
      rendered_candidate_fields:task.endsWith('render')?40:null,rendered_frame_draws:task.endsWith('render')?6:null,rendered_logo_draws:task.endsWith('render')?5:null,validated_image_draws:task.endsWith('render')?null:11}))};
}
test('receipt admission is source/image/job-scope specific and keeps app acceptance separate',()=>{
  assert.equal(admitNativeProbe34(receipt(),image).native_tasks_passed,9);
  assert.equal(admitNativeProbe34(receipt(),image).actual_hosted_job_or_english_app_acceptance,false);
  for(const change of [r=>r.source_sha256='c'.repeat(64),r=>r.probe_release.file_count=156,r=>r.image=image.replace(/a{64}$/u,'c'.repeat(64)),r=>r.resources.pop(),r=>r.phases.pop()]){
    const value=receipt();change(value);assert.throws(()=>admitNativeProbe34(value,image));
  }
});
test('receipt admission refuses failed ownership/session/cleanup/snapshot/network proofs',()=>{
  for(const change of [r=>r.lock_released=false,r=>r.cleanup_confirmed=false,r=>r.resources[0].snapshot_absence_verified=false,r=>r.resources[0].current_session_id='other',
    r=>r.resources[0].identity_observed=false,r=>r.resources[0].session_consistency_failed=true,r=>r.phases.find(p=>p.phase==='network_denial').proof.ip_denied=false,
    r=>r.phases.find(p=>p.phase==='boundary').proof.uid=65534,r=>r.permanent_probe34_claim_created=false,r=>r.failed_phase='smoke_video']){
    const value=receipt();change(value);assert.throws(()=>admitNativeProbe34(value,image));
  }
});
