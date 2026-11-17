// Phase 0 (current production state): previous release web (081e2dee on :3161) + previous worker on history 50.
// Creates the live-shaped audience presets and a 1.3.0 presentation with a guest link, so later phases can prove
// that pre-release work survives the migrations, the new release and a rollback.
import { useApp, ok, call, check, note, journey, save, sql, runWorker, WS, seed, sleep, signIn } from './lib.mjs';
const OLD = process.env.EPS_STG_OLD_CHECKOUT ?? 'D:/Everyone/Presentation/EPS-c7-old';
useApp('http://127.0.0.1:3161');
const state = {};

await journey('0-baseline-previous-release', async () => {
  const outsider = await signIn('outsider');
  check('real_password_sign_in', typeof outsider.access_token === 'string' && outsider.user?.email === seed.users.outsider.email);
  const anon = await call('GET', '/capabilities', undefined, { anonymous: true });
  check('anonymous_refused', anon.status === 401, anon.status);
  const outsiderProject = await call('GET', `/workspaces/${WS}/candidates?limit=5`, undefined, { user: 'outsider' });
  check('outsider_cannot_read_workspace', [403, 404].includes(outsiderProject.status), outsiderProject.status);

  for (const [label, scope] of [['Agency', 'external'], ['Client', 'external'], ['Internal Production', 'internal']]) {
    const existing = (await ok('GET', '/audience-presets')).data.find(p => p.label === label);
    state[label] = existing ?? (await ok('POST', '/audience-presets', { label, scope, settings: {} })).data;
  }
  check('presets_like_live', ['Agency', 'Client', 'Internal Production'].every(l => state[l]?.id));

  const members = (await ok('GET', `/workspaces/${WS}/candidates?limit=50`)).data;
  const add = async id => members.find(m => m.candidate_id === id) ?? (await ok('POST', `/workspaces/${WS}/candidates`, { candidate_id: id })).data;
  state.frame = await add(seed.ids.framePerson); state.photo = await add(seed.ids.photoPerson);
  check('people_added_by_previous_release', state.frame.id && state.photo.id);

  const req = { age_range: '25-35', gender_requirement: null, appearance_performance: null, languages: [], accents: [], skills: [], scene_references: [], shoot_dates: [], location: null, availability_requirements: null, other_instructions: null };
  const roles = (await ok('GET', `/workspaces/${WS}/roles?limit=50`).catch(() => ({ data: [] }))).data ?? [];
  const role = async name => roles.find(r => r.name === name) ?? (await ok('POST', `/workspaces/${WS}/roles`, { name, headcount: 1, category: null, requirements: req })).data;
  state.lead = await role('Lead'); state.neighbour = await role('Neighbour');
  const assign = async (r, member) => {
    const slot = (await ok('GET', `/roles/${r.id}/slots`)).data[0];
    const existing = (await ok('GET', `/workspaces/${WS}/assignments?limit=100`)).data.find(a => a.slot_id === slot.id);
    const a = existing ?? (await ok('POST', `/workspaces/${WS}/assignments`, { slot_id: slot.id, workspace_candidate_id: member.id, expected_slot_row_version: slot.row_version, shortlist_included: true })).data;
    const fresh = (await ok('GET', `/roles/${r.id}/slots`)).data[0];
    if (!existing) await ok('PUT', `/slots/${fresh.id}/main`, { assignment_id: a.id, expected_slot_row_version: fresh.row_version, replacement_behavior: 'move_previous_to_backup' });
    return a;
  };
  await assign(state.lead, state.frame); await assign(state.neighbour, state.photo);

  const seriesList = (await ok('GET', `/presentation-series?workspace_id=${WS}`)).data;
  state.series = seriesList.find(s => s.audience_preset_id === state.Client.id) ?? (await ok('POST', '/presentation-series', { workspace_id: WS, output_type: 'shortlist', audience_preset_id: state.Client.id })).data;
  check('series_on_1_3', state.series.template_version === '1.3.0', state.series.template_version);
  let review = (await ok('GET', `/workspaces/${WS}/review?series_id=${state.series.id}`)).data;
  note('review_keys', Object.keys(review));
  note('fit_before', review.fit ?? null);
  if (review.fit?.status !== 'measured') {
    const fitRequest = await call('POST', `/workspaces/${WS}/review/fit`, { series_id: state.series.id, expected_input_fingerprint: review.input_fingerprint });
    note('fit_request', { status: fitRequest.status, body: JSON.stringify(fitRequest.body).slice(0, 300) });
    const notices = runWorker(OLD); note('fit_worker', notices.filter(n => n.event !== 'idle').slice(-6));
    review = (await ok('GET', `/workspaces/${WS}/review?series_id=${state.series.id}`)).data;
  }
  note('fit_after', review.fit ?? null);
  check('fit_measured_by_previous_worker', review.fit?.status === 'measured' && review.fit.overflows.length === 0, review.fit);
  const existingReady = (await ok('GET', `/presentation-series/${state.series.id}/versions`)).data.find(v => v.status === 'ready');
  const workspace = (await ok('GET', `/workspaces/${WS}`)).data; note('workspace_keys', Object.keys(workspace));
  const generated = existingReady ? { status: 'skipped_existing' } : await call('POST', `/presentation-series/${state.series.id}/versions`, { expected_input_fingerprint: review.input_fingerprint,
    expected_workspace_row_version: workspace.row_version, expected_draft_revision: review.draft_revision });
  note('generate', { status: generated.status, body: JSON.stringify(generated.body ?? null).slice(0, 400) });
  const notices = runWorker(OLD); note('render_worker', notices.filter(n => n.event !== 'idle').slice(-8));
  const versions = (await ok('GET', `/presentation-series/${state.series.id}/versions`)).data;
  state.version = versions[0];
  check('previous_release_version_ready', state.version?.status === 'ready', versions.map(v => [v.version_number, v.status]));
  const pdf = await call('GET', `/versions/${state.version?.id}/pdf/content`, undefined, { raw: true });
  const bytes = Buffer.from(await pdf.arrayBuffer());
  check('pdf_downloads', pdf.status === 200 && bytes.subarray(0, 5).toString() === '%PDF-', pdf.status);
  note('pdf_bytes', bytes.length);
  const link = (await ok('POST', '/review-links', { series_id: state.series.id, label: 'Pre-release guest link' })).data;
  state.link = { id: link.link?.id, url: link.url, token: link.token };
  note('link_keys', Object.keys(link));
  check('guest_link_created', Boolean(state.link.id));
  sql(`select 1`);
});
await sleep(10);
save('staging-journeys.json');
import('node:fs').then(fs => fs.writeFileSync(new URL('../../../.local/cycle7/stg/before-state.json', import.meta.url), JSON.stringify(state, null, 1)));
