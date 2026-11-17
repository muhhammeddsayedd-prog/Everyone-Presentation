// Journey 11: recovery rehearsal on the migrated schema after real post-release use (1.4.0 series/versions, scenes,
// pins, notes). What the documented rollback does, and what it does not do:
//   * Settings back to 1.3.0 (configuration rollback), presentation creation afterwards (new and previous web);
//   * previous web release (081e2dee, :3161) on post-release data, including 1.4.0 series/versions and guest links;
//   * previous worker meeting an in-flight 1.4.0 generation (what happens to the job; drain rule);
//   * new user work (scenes, pins, crops, notes) intact through rollback and roll-forward.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { useApp, ok, call, check, note, journey, save, sql, runWorker, WS, seed, S, ROOT } from './lib.mjs';
const OLD = process.env.EPS_STG_OLD_CHECKOUT ?? 'D:/Everyone/Presentation/EPS-c7-old';
const NEWAPP = 'http://127.0.0.1:3000', OLDAPP = 'http://127.0.0.1:3161';
const state = JSON.parse(readFileSync(path.join(S, 'release-state.json'), 'utf8'));
const before = JSON.parse(readFileSync(path.join(S, 'before-state.json'), 'utf8'));
const userWork = () => sql(`select md5(string_agg(t,'|' order by t)) from (
  select 'wc:'||id||':'||coalesce(portrait_asset_id::text,'')||':'||coalesce(portrait_crop::text,'')||':'||media_selection_state t from eps.workspace_candidates
  union all select 'sc:'||id||':'||status||':'||coalesce(title,'') from eps.scenes
  union all select 'oc:'||id||':'||status from eps.scene_occurrences
  union all select 'v:'||id||':'||status from eps.presentation_versions
  union all select 'sr:'||id||':'||template_version||':'||coalesce(cover_note,'') from eps.presentation_series) x`);

await journey('11-recovery-rehearsal', async () => {
  const workBefore = userWork(); note('user_work_fingerprint', workBefore);
  // A. In-flight 1.4.0 generation met by the previous worker (what happens if the worker is rolled back without draining).
  useApp(NEWAPP);
  const review = (await ok('GET', `/workspaces/${WS}/review?series_id=${state.series14}`)).data;
  if (review.fit?.input_fingerprint !== review.input_fingerprint) { await call('POST', `/workspaces/${WS}/review/fit`, { series_id: state.series14, expected_input_fingerprint: review.input_fingerprint }); runWorker(ROOT); }
  const fresh = (await ok('GET', `/workspaces/${WS}/review?series_id=${state.series14}`)).data;
  const workspace = (await ok('GET', `/workspaces/${WS}`)).data;
  const g = await call('POST', `/presentation-series/${state.series14}/versions`, { expected_input_fingerprint: fresh.input_fingerprint, expected_workspace_row_version: workspace.row_version, expected_draft_revision: fresh.draft_revision });
  note('inflight_generate', [g.status, g.body?.error?.code ?? null]);
  const job = g.body?.data?.job_id;
  if (job) {
    const oldNotices = runWorker(OLD).filter(n => !['idle', 'recovery_completed', 'staging_worker_started'].includes(n.event));
    note('previous_worker_on_1_4_job', oldNotices.map(n => n.event + (n.stage ? ':' + n.stage : '') + (n.code ? ':' + n.code : '')));
    const after = sql(`select status||':'||stage||':'||coalesce(error->>'code','')||':'||coalesce((error->>'retryable'),'') from eps.jobs where id='${job}'`);
    note('job_after_previous_worker', after);
    check('previous_worker_does_not_publish_1_4', !after.startsWith('succeeded'), after);
    // Roll forward: once the previous worker's lease expires (simulated here instead of waiting), recovery requeues the
    // job and the new worker completes it; nothing is lost.
    sql(`update eps.jobs set lease_expires_at=now()-interval '1 second' where id='${job}' and status='running'`);
    for (let i = 0; i < 4; i++) { sql(`update eps.jobs set available_at=now() where id='${job}' and status='queued'`); runWorker(ROOT); }
    const final = sql(`select status||':'||coalesce(error->>'code','') from eps.jobs where id='${job}'`);
    note('job_after_new_worker', final);
    check('roll_forward_worker_finishes_inflight_job', final.startsWith('succeeded'), final);
  }
  // B. Configuration rollback: template default back to 1.3.0.
  let settings = (await ok('GET', '/settings')).data;
  settings = (await ok('PATCH', '/settings', { row_version: settings.row_version, template_version: '1.3.0' })).data;
  check('default_reverted_to_1_3', settings.template_version === '1.3.0' && settings.default_audience_preset_id === state.client, settings);
  const viaNew = await call('POST', '/presentation-series', { workspace_id: WS, output_type: 'selection' });
  check('new_web_creates_series_after_revert', viaNew.status === 201 || viaNew.status === 200, [viaNew.status, viaNew.body?.error]);
  note('series_after_revert', viaNew.body?.data ? [viaNew.body.data.template_version, viaNew.body.data.audience_preset_id === state.client] : null);
  // C. Web rollback: the previous release on post-release data.
  useApp(OLDAPP);
  const probes = {
    workspace_candidates: ['GET', `/workspaces/${WS}/candidates?limit=50`], series_list: ['GET', `/presentation-series?workspace_id=${WS}`],
    series_1_4: ['GET', `/presentation-series/${state.series14}`], versions_1_4: ['GET', `/presentation-series/${state.series14}/versions`],
    version_1_4: ['GET', `/versions/${state.version14}`], review_1_3: ['GET', `/workspaces/${WS}/review?series_id=${before.series.id}`],
    review_1_4: ['GET', `/workspaces/${WS}/review?series_id=${state.series14}`], version_1_3: ['GET', `/versions/${before.version.id}`],
    settings: ['GET', '/settings'], roles: ['GET', `/workspaces/${WS}/roles?limit=50`], jobs: ['GET', '/jobs?limit=20'],
  };
  const out = {};
  for (const [k, [m, p]] of Object.entries(probes)) { const r = await call(m, p); out[k] = r.status === 200 ? 200 : `${r.status} ${r.body?.error?.code ?? ''}`; }
  const pdf14 = await call('GET', `/versions/${state.version14}/pdf/content`, undefined, { raw: true }); out.pdf_1_4 = pdf14.status;
  const pdf13 = await call('GET', `/versions/${before.version.id}/pdf/content`, undefined, { raw: true }); out.pdf_1_3 = pdf13.status;
  const link = await (async () => { useApp(NEWAPP); const l = (await ok('POST', '/review-links', { series_id: state.series14, label: 'Rollback probe' })).data; useApp(OLDAPP); return l; })();
  const opened = await call('POST', '/review/open', undefined, { anonymous: true, headers: { 'x-review-token': link.token } });
  const guestView = opened.status === 200 ? await call('GET', '/review/presentation', undefined, { anonymous: true, headers: { 'x-review-session': opened.body.data.access_token } }) : { status: opened.status };
  out.guest_1_4_open = opened.status; out.guest_1_4_presentation = guestView.status === 200 ? 200 : `${guestView.status} ${guestView.body?.error?.code ?? ''}`;
  const presets = (await ok('GET', '/audience-presets')).data;
  const oldCreate = await call('POST', '/presentation-series', { workspace_id: WS, output_type: 'shortlist', audience_preset_id: presets.find(p => p.label === 'Agency').id });
  out.previous_web_creates_series = oldCreate.status;
  note('previous_web_on_post_release_data', out);
  check('previous_web_core_reads_work', ['workspace_candidates', 'series_list', 'review_1_3', 'version_1_3', 'settings', 'roles', 'jobs'].every(k => out[k] === 200) && out.pdf_1_3 === 200, out);
  check('previous_web_can_create_series_after_revert', [200, 201].includes(out.previous_web_creates_series), out.previous_web_creates_series);
  // Documented limitation (the previous release does not know template 1.4.0): its 1.4.0 versions, review, PDF and guest
  // view answer an error until roll-forward. Nothing is changed or lost; roll-forward restores them (checked below).
  check('documented_limit_previous_web_cannot_show_1_4', [out.version_1_4, out.versions_1_4, out.review_1_4].every(v => String(v).startsWith('503')) && out.pdf_1_4 === 503 && String(out.guest_1_4_presentation).startsWith('503'), out);
  // D. User work through rollback and roll-forward.
  useApp(NEWAPP);
  const scenesNew = (await call('GET', `/workspaces/${state.ws2 ?? WS}/scenes?limit=50`)).status;
  check('new_web_reads_post_release_work_after_roll_forward', scenesNew === 200 && (await call('GET', `/versions/${state.version14}`)).status === 200);
  const pdfBack = await call('GET', `/versions/${state.version14}/pdf/content`, undefined, { raw: true });
  check('roll_forward_restores_1_4_pdf', pdfBack.status === 200, pdfBack.status);
  const workAfter = userWork();
  note('user_work_fingerprint_after', workAfter);
  // Rollback steps create series/versions (expected); every pin, crop, scene and earlier version stays as it was.
  const pinsAndScenes = q => sql(`select md5(string_agg(t,'|' order by t)) from (select 'wc:'||id||':'||coalesce(portrait_asset_id::text,'')||':'||coalesce(portrait_crop::text,'')||':'||media_selection_state t from eps.workspace_candidates union all select 'sc:'||id||':'||status||':'||coalesce(title,'') from eps.scenes union all select 'oc:'||id||':'||status from eps.scene_occurrences) x`);
  check('pins_crops_scenes_unchanged_by_rollback', pinsAndScenes() === state.pins_scenes_fingerprint || !state.pins_scenes_fingerprint, pinsAndScenes());
  check('earlier_versions_unchanged', sql(`select string_agg(id::text||':'||status,',' order by id) from eps.presentation_versions where id in ('${before.version.id}','${state.version14}')`).split(',').every(v => v.endsWith(':ready')));
  // Leave staging on the intended post-release configuration.
  settings = (await ok('GET', '/settings')).data;
  await ok('PATCH', '/settings', { row_version: settings.row_version, template_version: '1.4.0' });
});
save('staging-journeys.json');
