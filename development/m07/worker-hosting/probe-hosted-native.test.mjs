import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { validateProbeImage, validateProjectToken, validateBoundaryProof, validateNetworkProof, validateImageSourceSeal, readBoundedCommandOutput, observeFinalProbeResource, probePlan, canReleaseProbeLock, recordProbeSession, stableProbeSession, probeOwnership, SDK_TRANSPORT_POLICY, probeTransportObservation, presentationSmokeExpectations, presentationSmokeReview, probeNativeErrorCode, validatePresentationSmokeResult, hasAnyProbeItem } from '../../../tools/probe-hosted-native.mjs';
import { NATIVE_PROBE_RELEASE, nativeProbePrivilegeArguments } from './native-probe-release.mjs';
import { nativePrivilegeArguments } from '../../../apps/worker/src/native-identity.mjs';
const now = 1793394000;
const claims = { iss: 'https://oidc.vercel.com/muhammed-abdelrahman', aud: 'https://vercel.com/muhammed-abdelrahman', sub: 'owner:muhammed-abdelrahman:project:everyone-presentation-worker-pilot:environment:development', owner_id: 'team_gboXPxTevpCOZuaA8eY9PmR1', project_id: 'prj_I4SMkDzaDy0KHNgiF00v4Da5aLb6', environment: 'development', iat: now, exp: now + 43200 };
const token = (payload = claims, header = { alg: 'RS256', typ: 'JWT', kid: 'synthetic-key' }) => [Buffer.from(JSON.stringify(header)).toString('base64url'), Buffer.from(JSON.stringify(payload)).toString('base64url'), Buffer.alloc(256, 1).toString('base64url')].join('.');
test('the actual public image-bearing review fixture satisfies the live-review DTO before any native operation',async()=>{
  const {nativePresentation}=await import('../../../tests/worker/presentation-native-fixture.ts');
  const {reviewFromRenderSnapshot}=await import('../../../packages/domain/src/presentation.ts');
  const {workspaceReviewDto}=await import('../../../packages/central/src/review-dto.ts');
  const {snapshot}=nativePresentation();const frozen=reviewFromRenderSnapshot(snapshot),before=globalThis.structuredClone(frozen);assert.throws(()=>workspaceReviewDto(frozen));
  const supplied=presentationSmokeReview(frozen);assert.doesNotThrow(()=>workspaceReviewDto(supplied));assert.deepEqual(frozen,before);
  assert.equal(supplied.slides.length,4);assert.equal(supplied.slides.reduce((count,slide)=>count+slide.frames.length,0),6);assert.equal(supplied.cover.logo_placement,'every_slide');
  for(const slide of supplied.slides){assert.match(slide.workspace_candidate_id,/^a5080000-0000-4000-8000-\d{12}$/u);assert.equal(slide.assignment_row_version,1);assert.equal(slide.workspace_candidate_row_version,1);assert.equal(slide.candidate_row_version,1);}
  const changed=globalThis.structuredClone(frozen);changed.slides[0].workspace_candidate_id='unexpected';assert.throws(()=>presentationSmokeReview(changed));
});
test('native failed envelopes retain only a known FIT/PDF/NATIVE code and no payload',()=>{
  for(const code of ['FIT_TEMPLATE_MISMATCH','PDF_VALIDATION_FAILED','NATIVE_TASK_FAILED'])assert.equal(probeNativeErrorCode({ok:false,code}),code);
  for(const envelope of [{ok:false,code:'FIT_SYNTHETIC_PRIVATE'},{ok:false,code:'FIT_TEMPLATE_MISMATCH',private:'SYNTHETIC_PRIVATE'},{ok:true,code:'FIT_TEMPLATE_MISMATCH'},null])assert.equal(probeNativeErrorCode(envelope),null);
});
test('existence-only SDK iterable checks exhaust empty pages and close immediately after an item',async()=>{
  const {attachPaginator}=await import('../../../node_modules/@vercel/sandbox/dist/utils/paginator.js');let calls=0;
  const page=attachPaginator({items:[],pagination:{next:'next'}},{itemsKey:'items',fetchNext:async()=>{calls++;return{items:[{synthetic:true}],pagination:{next:null}};}});
  assert.equal(typeof page.next,'undefined');assert.equal(await hasAnyProbeItem(page),true);assert.equal(calls,1);
  assert.equal(await hasAnyProbeItem(attachPaginator({items:[],pagination:{next:null}},{itemsKey:'items',fetchNext:async()=>{throw Error('unexpected');}})),false);
  let closed=false;const iterable={async *[Symbol.asyncIterator](){try{yield{synthetic:true};throw Error('must stop after first item');}finally{closed=true;}}};assert.equal(await hasAnyProbeItem(iterable),true);assert.equal(closed,true);
  await assert.rejects(hasAnyProbeItem({[Symbol.asyncIterator](){return{next:async()=>{throw Error('synthetic unknown listing');}};}}));
});
test('presentation smoke refuses the old empty fixture and requires all0/1/2/3 frames and five client-logo draws',()=>{
  const snapshot={slides:[{kind:'cover',frames:[],logo_asset_id:'logo',video_asset_id:null},...[0,1,2,3].map((count,index)=>({kind:'candidate',frames:Array.from({length:count},(_,frame)=>({asset_id:`frame-${index}-${frame}`})),logo_asset_id:'logo',video_asset_id:`video-${index}`,fields:Object.fromEntries(Array.from({length:10},(_,i)=>['field'+i,'SYNTHETIC']))}))]};
  const images=new Map([['logo',Buffer.from('SYNTHETIC')],...snapshot.slides.flatMap(slide=>slide.frames.map(frame=>[frame.asset_id,Buffer.from('SYNTHETIC')]))]);
  assert.deepEqual(presentationSmokeExpectations(snapshot,images),{page_count:5,candidate_field_count:40,frame_draw_count:6,logo_draw_count:5,expected_image_draws:11,video_link_count:4,unique_image_count:7});
  assert.throws(()=>presentationSmokeExpectations({slides:snapshot.slides.slice(0,2)},new Map()));
  for(const change of [value=>value.slides[3].frames.pop(),value=>value.slides[0].logo_asset_id=null,value=>delete value.slides[1].fields.field0]){const value=globalThis.structuredClone(snapshot);change(value);assert.throws(()=>presentationSmokeExpectations(value,images));}
});
test('actual render and validation proof counts must cover six frames plus five logos, never a zero-image claim',()=>{
  const bytes=Buffer.from('%PDF-SYNTHETIC'),base64=bytes.toString('base64');
  const render={bytes:base64,proof:{page_count:5,candidate_field_count:40,frame_draw_count:6,logo_draw_count:5,video_link_count:4,overflow_count:0,fonts_ready:true,images_ready:true,renderer_version:'everyone-casting-pdf-v1'}};
  const renderProof=validatePresentationSmokeResult('presentation_render',render);assert.equal(renderProof.rendered_frame_draws,6);assert.equal(renderProof.rendered_logo_draws,5);
  for(const change of [{frame_draw_count:0},{logo_draw_count:0},{candidate_field_count:10},{page_count:2},{fonts_ready:false}])assert.throws(()=>validatePresentationSmokeResult('presentation_render',{...render,proof:{...render.proof,...change}}));
  const valid={page_count:5,pdf_sha256:createHash('sha256').update(bytes).digest('hex'),image_draws_checked:11,video_links_checked:4,text_regions_checked:80,embedded_font_count:6};
  for(const task of ['presentation_validate','presentation_export_validate'])assert.equal(validatePresentationSmokeResult(task,valid,base64).validated_image_draws,11);
  for(const change of [{image_draws_checked:0},{image_draws_checked:6},{page_count:2},{video_links_checked:0},{pdf_sha256:'a'.repeat(64)},{embedded_font_count:0}])assert.throws(()=>validatePresentationSmokeResult('presentation_validate',{...valid,...change},base64));
  assert.throws(()=>validatePresentationSmokeResult('presentation_validate',valid,base64+'garbage'));assert.throws(()=>validatePresentationSmokeResult('arbitrary',valid,base64));
});

test('transport telemetry closes endpoint/method/phase/error metadata and excludes URLs, headers and private messages', () => {
  const row = probeTransportObservation('https://vercel.com/api/v2/sandboxes/eps-native-SYNTHETIC_PRIVATE?token=SYNTHETIC_PRIVATE', 'DELETE', 429, 5, 'boundary_cleanup');
  assert.deepEqual(row, { endpoint_class: 'named_sandbox', method: 'DELETE', http_status: 429, elapsed_ms: 5, phase: 'boundary_cleanup', network_error_name: null, network_error_code: null });
  const failed = probeTransportObservation('https://vercel.com/api/v2/sandboxes/sessions/private/fs/read', 'GET', 0, 30000, 'SYNTHETIC_PRIVATE', { name: 'TypeError', message: 'SYNTHETIC_PRIVATE', cause: { code: 'UND_ERR_CONNECT_TIMEOUT' } });
  assert.equal(failed.endpoint_class, 'session_files'); assert.equal(failed.phase, 'other_phase'); assert.equal(failed.network_error_code, 'UND_ERR_CONNECT_TIMEOUT');
  assert(!JSON.stringify([row, failed]).includes('SYNTHETIC_PRIVATE'));
  const unknown = probeTransportObservation('not-a-url-SYNTHETIC_PRIVATE', 'SYNTHETIC_PRIVATE', -1, Infinity, 'SYNTHETIC_PRIVATE', { name: 'SYNTHETIC_PRIVATE', code: 'SYNTHETIC_PRIVATE' });
  assert.equal(unknown.method, 'OTHER'); assert.equal(unknown.http_status, 0); assert.equal(unknown.elapsed_ms, null); assert.equal(unknown.network_error_name, 'OTHER'); assert.equal(unknown.network_error_code, 'OTHER');
});
test('only fixed worker native repository digest is admitted before any provider action', () => {
  assert.equal(validateProbeImage('muhammed-abdelrahman/everyone-presentation-worker-pilot/native@sha256:' + 'a'.repeat(64)).length > 64, true);
  for (const image of ['native:latest', 'other/team/native@sha256:' + 'a'.repeat(64), 'muhammed-abdelrahman/everyone-presentation-worker-pilot/daemon.worker@sha256:' + 'a'.repeat(64)]) assert.throws(() => validateProbeImage(image));
});
test('current probe release fixes one156-record graph and shares the dedicated native identity arguments', () => {
  assert.equal(NATIVE_PROBE_RELEASE.source_sha256, '09b6d4b881594dc7664953409f6e0bdeb925c19bf19fb3a4331787abf09c921f');
  assert.equal(NATIVE_PROBE_RELEASE.context_relative, '.local/worker-hosting/b488b456-d84e-4515-99f9-476b3196cd64/context');
  assert.equal(NATIVE_PROBE_RELEASE.native_task_limits_sha256, 'f648ae3a0c82c7d8cdc5d8c553d34014f8b20319ce7ff569eea8ae04185a9df0');
  assert.equal(NATIVE_PROBE_RELEASE.native_launcher_sha256, '3efb0a965fb23dc5d8a07dae7b8a590238a7172ca7606aadf3b8c40f2baaac23');
  assert.equal(NATIVE_PROBE_RELEASE.file_count, 156); assert.equal(NATIVE_PROBE_RELEASE.native_uid, 65432); assert.equal(NATIVE_PROBE_RELEASE.native_gid, 65432);
  assert.equal(NATIVE_PROBE_RELEASE.native_identity_sha256, 'f3b55692bdc48ab05b108915692509d124f50ea4d32153ebf39d87f0ff5d3aa0');
  assert.equal(NATIVE_PROBE_RELEASE.diagnostic_modes_enabled, false);
  assert.equal(NATIVE_PROBE_RELEASE.seal_validator_sha256, 'ce7b9c4fa9c0d557d0d28784f6caca7b6752379dcfd218e4d9d526cf4ee94cc6');
  assert.deepEqual(Object.keys(NATIVE_PROBE_RELEASE.runtime_contract_sha256).sort(), ['candidate-extraction','frame-selection','slide-wording','specs-extraction'].map(stem=>'contracts/json-schema/'+stem+'.schema.json'));
  assert(Object.isFrozen(NATIVE_PROBE_RELEASE.runtime_contract_sha256));
  assert.deepEqual(nativeProbePrivilegeArguments(), nativePrivilegeArguments()); assert(Object.isFrozen(NATIVE_PROBE_RELEASE));
});
test('mint response and project claims are closed before publication; token stays out of returned metadata', () => {
  const metadata = validateProjectToken({ token: token() }, now);
  assert.equal(metadata.token_ttl_seconds, 43200); assert(!JSON.stringify(metadata).includes(token()));
  for (const mutation of [{ project_id: 'foreign' }, { owner_id: 'foreign' }, { aud: 'foreign' }, { environment: 'production' }, { exp: now - 1 }, { iat: now - 300 }, { exp: now + 86400 }]) assert.throws(() => validateProjectToken({ token: token({ ...claims, ...mutation }) }, now));
  assert.throws(() => validateProjectToken({ token: token(), access_token: 'PRIVATE_SENTINEL' }, now));
  assert.throws(() => validateProjectToken({ token: token(claims, { alg: 'none' }) }, now));
});
test('boundary and network proof require exact safe fields, complete denials and bounded counters', () => {
  const boundary = { protocol: 'eps-native-boundary-v1', uid: 65432, gid: 65432, capabilities_empty: true, no_new_privileges: true, known_write_denials: 10, checked_paths: 100, writable_outside_tmp: 0 };
  assert.doesNotThrow(() => validateBoundaryProof(boundary));
  for (const patch of [{ uid: 0 }, { uid: 1000, gid: 1000 }, { writable_outside_tmp: 1 }, { known_write_denials: 9 }, { secret: 'PRIVATE' }]) assert.throws(() => validateBoundaryProof({ ...boundary, ...patch }));
  assert.doesNotThrow(() => validateNetworkProof({ protocol: 'eps-native-network-v1', dns_denied: true, ip_denied: true }));
  assert.throws(() => validateNetworkProof({ protocol: 'eps-native-network-v1', dns_denied: false, ip_denied: true }));
});
test('probe plan is capped and an unknown creation outcome cannot release its ownership lock', () => {
  assert.equal(probePlan('boundary').maximum_named_resources, 1); assert.equal(probePlan('smoke').maximum_named_resources, 10);
  for (const historical of ['diagnose', 'diagnose-boundary', 'diagnose-chromium']) assert.throws(() => probePlan(historical));
  assert.equal(Object.hasOwn(probePlan('boundary'), 'maximum_vms'), false);
  assert.throws(() => probePlan('arbitrary'));
  assert.equal(canReleaseProbeLock([{ name: 'eps-native-synthetic', attempted: true, identity_observed: true, absence_verified: true, snapshot_absence_verified: true }]), true);
  assert.equal(canReleaseProbeLock([{ name: 'eps-native-synthetic', attempted: true, identity_observed: false, absence_verified: true, snapshot_absence_verified: true }]), false);
  assert.equal(canReleaseProbeLock([{ name: 'eps-native-synthetic', attempted: true, identity_observed: true, absence_verified: true, snapshot_absence_verified: false }]), false);
  assert.equal(canReleaseProbeLock([{ name: 'eps-native-synthetic', attempted: true, absence_verified: false }]), false);
});
test('SDK qualification separates named-resource retries from no-retry commands and forbids VM-count credit', () => {
  assert.equal(SDK_TRANSPORT_POLICY.sdk_default_retries_maximum, 2);
  assert.equal(SDK_TRANSPORT_POLICY.sdk_default_retry_loop_attempts_maximum, 3);
  assert.equal(SDK_TRANSPORT_POLICY.non_detached_command_http_retries, 0);
  assert.equal(SDK_TRANSPORT_POLICY.sandbox_auto_resume_possible, true);
  assert.equal(SDK_TRANSPORT_POLICY.exact_wire_or_vm_count_proven, false);
});
test('LIST identity cannot mask a changed active SDK GET/operation session or release its later absent resource', () => {
  const source = '09b6d4b881594dc7664953409f6e0bdeb925c19bf19fb3a4331787abf09c921f';
  const marker = { name: 'eps-native-synthetic', image: 'SYNTHETIC_IMAGE', tags: { owner: 'eps-native', run: 'SYNTHETIC_RUN', source },
    session_id: 'session_SYNTHETIC_INITIAL', initial_session_id: 'session_SYNTHETIC_INITIAL', cleanup_session_id: 'session_SYNTHETIC_INITIAL',
    attempted: true, identity_observed: true, absence_verified: true, snapshot_absence_verified: true, session_consistency_failed: false };
  const handle = { name: marker.name, image: marker.image, tags: marker.tags, persistent: false, networkPolicy: 'deny-all', region: 'dub1',
    vcpus: 1, memory: 2048, failoverRegions: [], mounts: {}, routes: [], currentSession: () => ({ sessionId: 'session_SYNTHETIC_CHANGED' }) };
  assert.throws(() => probeOwnership(handle, marker, true));
  assert.equal(marker.session_consistency_failed, true);
  handle.currentSession = () => ({ sessionId: 'session_SYNTHETIC_INITIAL' });
  probeOwnership(handle, marker, true);
  assert.equal(stableProbeSession(marker), false);
  assert.equal(canReleaseProbeLock([marker]), false);
});
test('current and cleanup sessions must equal the successful creation session; drift never overwrites its evidence', () => {
  const marker = { session_id: null, initial_session_id: null, cleanup_session_id: null };
  assert.equal(stableProbeSession(marker), false);
  recordProbeSession(marker, 'session_SYNTHETIC_INITIAL', 'created');
  recordProbeSession(marker, 'session_SYNTHETIC_INITIAL', 'cleanup');
  assert.equal(stableProbeSession(marker), true);
  const original = globalThis.structuredClone(marker);
  assert.throws(() => recordProbeSession(marker, 'session_SYNTHETIC_RESUMED', 'cleanup'));
  assert.equal(stableProbeSession(marker), false);
  assert.equal(marker.initial_session_id, original.initial_session_id);
  assert.equal(marker.cleanup_session_id, original.cleanup_session_id);
  recordProbeSession(marker, 'session_SYNTHETIC_INITIAL', 'cleanup');
  assert.equal(stableProbeSession(marker), false);
  assert.equal(canReleaseProbeLock([{ ...marker, name: 'eps-native-synthetic', attempted: true, identity_observed: true, absence_verified: true, snapshot_absence_verified: true }]), false);
  assert.throws(() => recordProbeSession(marker, 'session_SYNTHETIC_RESUMED', 'created'));
  const unknown = { session_id: null, initial_session_id: null, cleanup_session_id: null };
  recordProbeSession(unknown, 'session_SYNTHETIC_DISCOVERED', 'cleanup');
  assert.equal(stableProbeSession(unknown), false);
});
test('same-repository historical image cannot be mislabeled as the patched reviewed source graph', () => {
  const expected = { source_sha256: '09b6d4b881594dc7664953409f6e0bdeb925c19bf19fb3a4331787abf09c921f', files: [{ path: 'package.json', sha256: 'a'.repeat(64), bytes: 1 }] };
  assert.doesNotThrow(() => validateImageSourceSeal(globalThis.structuredClone(expected), expected));
  assert.throws(() => validateImageSourceSeal({ ...expected, source_sha256: '973030386fc0fe2d591bb727a9b77d43a6ee474f5a7eac8ce45918c588ba2516' }, expected));
  assert.throws(() => validateImageSourceSeal({ ...expected, source_sha256: '0ddf519a91a23a11904dbd9880f48d24a2d543a8249f9ab267dbab323d6fb297' }, expected));
  assert.throws(() => validateImageSourceSeal({ ...expected, source_sha256: '5f9114a20cfa195282b53a89b3e3614e706f16fb1e4ed986d477e451086c5558' }, expected));
  assert.throws(() => validateImageSourceSeal({ ...expected, source_sha256: 'bc774c88083d106fd522ee6277fc8a81033a6b94ff05e9debdfe1d6ee661a735' }, expected));
  assert.throws(() => validateImageSourceSeal({ ...expected, source_sha256: '3790b2b327da7eca18b1aad3a0dfaae02892b0130647e4527a25dd24aa3d54a3' }, expected));
  assert.throws(() => validateImageSourceSeal({ ...expected, extra: 'PRIVATE_SENTINEL' }, expected));
});
test('SDK command log reads receive the overall abort signal and reject excessive output', async () => {
  const controller = new globalThis.AbortController(); let received;
  assert.equal(await readBoundedCommandOutput({ stdout: async options => { received = options.signal; return '0\n'; } }, 16, controller.signal), '0\n');
  assert.equal(received, controller.signal);
  await assert.rejects(readBoundedCommandOutput({ stdout: async () => 'x'.repeat(17) }, 16, controller.signal));
});
test('final extant or uncertain observation replaces an earlier absence proof and retains the lock', async () => {
  const signal = new globalThis.AbortController().signal;
  for (const find of [async () => ({ handle: 'synthetic-existing-resource' }), async () => { throw new Error('synthetic-read-uncertain'); }]) {
    const marker = { name: 'eps-native-synthetic', attempted: true, identity_observed: true, absence_verified: true, snapshot_absence_verified: true };
    await observeFinalProbeResource(marker, find, async () => {}, signal);
    assert.equal(marker.absence_verified, false); assert.equal(canReleaseProbeLock([marker]), false);
  }
  const marker = { name: 'eps-native-synthetic', attempted: true, identity_observed: true, absence_verified: false, snapshot_absence_verified: true };
  await observeFinalProbeResource(marker, async () => null, async () => { throw new Error('snapshot-read-uncertain'); }, signal);
  assert.equal(marker.absence_verified, true); assert.equal(marker.snapshot_absence_verified, false); assert.equal(canReleaseProbeLock([marker]), false);
  await observeFinalProbeResource(marker, async () => null, async () => {}, signal);
  assert.equal(canReleaseProbeLock([marker]), true);
});
