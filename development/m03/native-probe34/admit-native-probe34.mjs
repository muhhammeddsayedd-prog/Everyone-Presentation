/** Pure admission of an actual fresh probe receipt. No I/O, CLI or provider call. */
import { NATIVE_PROBE_RELEASE } from './native-probe34-release.mjs';
const need = value => { if (!value) throw new Error('NATIVE_PROBE34_RECEIPT_UNCONFIRMED'); };
const safeId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,200}$/u.test(value);
export function admitNativeProbe34(receipt, expectedImage) {
  need(receipt && typeof receipt === 'object' && receipt.schema_version === '1.0' && receipt.result === 'passed'
    && receipt.source_sha256 === NATIVE_PROBE_RELEASE.source_sha256 && receipt.image === expectedImage
    && /^muhammed-abdelrahman\/everyone-presentation-worker-pilot\/native@sha256:[a-f0-9]{64}$/u.test(expectedImage)
    && receipt.project_id === 'prj_I4SMkDzaDy0KHNgiF00v4Da5aLb6' && receipt.team_id === 'team_gboXPxTevpCOZuaA8eY9PmR1'
    && JSON.stringify(receipt.probe_release) === JSON.stringify(NATIVE_PROBE_RELEASE)
    && receipt.plan?.mode === 'smoke' && receipt.plan.maximum_named_resources === 10 && receipt.plan.maximum_http_calls === 240
    && receipt.cleanup_confirmed === true && receipt.initial_current_cleanup_sessions_equal === true && receipt.lock_released === true
    && receipt.permanent_probe34_claim_created === true && receipt.token_persisted === false && receipt.private_media_used === false
    && receipt.worker_polling === false && receipt.db_jobs_or_openai_n8n_calls === false && receipt.provider_control_plane_called === true
    && receipt.cli_mint_commands === 1 && Number.isSafeInteger(receipt.sdk_http_calls) && receipt.sdk_http_calls > 0 && receipt.sdk_http_calls <= 240
    && receipt.code === undefined && receipt.failed_phase === undefined);
  const admission = receipt.probe34_admission;
  need(admission && admission.source_sha256 === NATIVE_PROBE_RELEASE.source_sha256 && admission.image === expectedImage && admission.mode === 'smoke'
    && ['base_operator_sha256','release_sha256','compiler_sha256'].every(key => /^[a-f0-9]{64}$/u.test(admission[key]))
    && admission.base_operator_sha256 === '84630e42f2e5277fe8865721d00779939802cc73d059bf795cffb9915e5cb3ab');
  const resources = receipt.resources;
  need(Array.isArray(resources) && resources.length === 10 && new Set(resources.map(row => row.name)).size === 10);
  for (const row of resources) need(safeId(row.name) && row.attempted === true && row.identity_observed === true
    && row.absence_verified === true && row.snapshot_absence_verified === true && row.session_consistency_failed === false
    && row.initial_current_cleanup_session_equal === true && safeId(row.session_id) && row.session_id === row.initial_session_id
    && row.current_session_id === row.initial_session_id && row.cleanup_session_id === row.initial_session_id);
  const phases = receipt.phases;
  need(Array.isArray(phases));
  for (const [phase, count] of Object.entries({ image_source_seal:1,boundary:1,image_control_user:1,network_denial:1,
    smoke_document:2,smoke_pdf_raster:1,smoke_video:1,smoke_review_fit:1,smoke_presentation_render:1,smoke_presentation_validate:1,
    smoke_presentation_export_render:1,smoke_presentation_export_validate:1 })) {
    const found = phases.filter(row => row.phase === phase);
    need(found.length === count && found.every(row => row.result === 'passed'));
  }
  need(phases.find(row => row.phase === 'image_source_seal').source_sha256 === NATIVE_PROBE_RELEASE.source_sha256);
  const boundary = phases.find(row => row.phase === 'boundary').proof;
  need(boundary?.protocol === 'eps-native-boundary-v1' && boundary.uid === 65432 && boundary.gid === 65432
    && boundary.capabilities_empty === true && boundary.no_new_privileges === true && boundary.known_write_denials === 10 && boundary.writable_outside_tmp === 0
    && Number.isSafeInteger(boundary.checked_paths) && boundary.checked_paths > 0 && boundary.checked_paths <= 200000);
  need(phases.find(row => row.phase === 'image_control_user').uid === 0);
  const network = phases.find(row => row.phase === 'network_denial').proof;
  need(network?.protocol === 'eps-native-network-v1' && network.dns_denied === true && network.ip_denied === true);
  need(Array.isArray(receipt.presentation_checks) && receipt.presentation_checks.length === 4);
  for (const task of ['presentation_render','presentation_validate','presentation_export_render','presentation_export_validate']) {
    const checks = receipt.presentation_checks.filter(row => row.task === task);
    need(checks.length === 1);
    const check = checks[0];
    need(check.page_count === 5 && check.video_links === 4 && Number.isSafeInteger(check.pdf_bytes) && check.pdf_bytes >= 5 && check.pdf_bytes <= 64 * 1024 ** 2);
    if (task.endsWith('render')) need(check.rendered_candidate_fields === 40 && check.rendered_frame_draws === 6 && check.rendered_logo_draws === 5);
    else need(check.validated_image_draws === 11);
  }
  return { result:'passed', source_sha256:NATIVE_PROBE_RELEASE.source_sha256, image:expectedImage, native_tasks_passed:9,
    named_resources_observed_and_absent:10, source_seal_uid_network_verified:true, session_equality_and_no_snapshots_verified:true,
    cleanup_confirmed:true, lock_released:true, actual_hosted_job_or_english_app_acceptance:false };
}
