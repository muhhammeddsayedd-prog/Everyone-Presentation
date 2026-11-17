// Phase 2: the new release (web on :3000, worker from this checkout) on the migrated staging database.
// Journeys: Client default (reuse), template 1.4.0 explicit generation then default switch, picture repair and pins,
// photo-only and video-frame portraits with crops through review, layout measurement, PDF/PPTX, saved version,
// guest access, denials, internal series/comment privacy, distinct picture states.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { useApp, ok, call, check, note, journey, save, sql, runWorker, WS, seed, S, ROOT } from './lib.mjs';

const NEW = ROOT; useApp('http://127.0.0.1:3000');
const before = JSON.parse(readFileSync(path.join(S, 'before-state.json'), 'utf8'));
const ART = path.join(S, 'artifacts'); mkdirSync(ART, { recursive: true });
const state = (() => { try { return JSON.parse(readFileSync(path.join(S, 'release-state.json'), 'utf8')); } catch { return {}; } })();
const persist = () => writeFileSync(path.join(S, 'release-state.json'), JSON.stringify(state, null, 1));
const sha = b => createHash('sha256').update(b).digest('hex');
const members = async () => (await ok('GET', `/workspaces/${WS}/candidates?limit=50`)).data;
const only = process.argv.slice(2);
const run = name => only.length === 0 || only.some(o => name.startsWith(o));

if (run('2')) await journey('2-client-default-audience', async () => {
  const presets = (await ok('GET', '/audience-presets')).data;
  const clients = presets.filter(p => p.label === 'Client' && p.scope === 'external' && !p.archived);
  check('existing_client_preset_found_once', clients.length === 1, presets.map(p => [p.label, p.scope, p.archived]));
  const client = clients[0]; state.client = client.id; state.internal = presets.find(p => p.label === 'Internal Production')?.id;
  const presetsBefore = JSON.stringify(presets.map(p => [p.id, p.label, p.scope, p.row_version]));
  let settings = (await ok('GET', '/settings')).data;
  const noDefault = await call('POST', '/presentation-series', { workspace_id: WS, output_type: 'selection' });
  check('without_default_new_path_refuses_clearly', noDefault.status === 409 && noDefault.body?.error?.code === 'AUDIENCE_DEFAULT_REQUIRED', noDefault.body);
  if (settings.default_audience_preset_id !== client.id) settings = (await ok('PATCH', '/settings', { row_version: settings.row_version, default_audience_preset_id: client.id })).data;
  check('client_default_set_by_reuse', settings.default_audience_preset_id === client.id && settings.template_version === '1.3.0', settings);
  check('presets_unchanged', JSON.stringify((await ok('GET', '/audience-presets')).data.map(p => [p.id, p.label, p.scope, p.row_version])) === presetsBefore);
  const oldSeries = (await ok('GET', `/presentation-series/${before.series.id}`)).data;
  check('pre_release_series_untouched', oldSeries.template_version === '1.3.0' && oldSeries.audience_preset_id === before.series.audience_preset_id);
  persist();
});

if (run('3')) await journey('3-pictures-repair-pins-crops', async () => {
  // Older project rows: suggested repairs, applied explicitly (never automatic).
  const suggestions = (await ok('GET', `/workspaces/${WS}/media-repairs`)).data;
  note('suggestions', suggestions.map(s => [s.candidate_id.slice(-4), s.reason, s.suggestion?.portrait_source]));
  check('repairs_suggested_for_pre_release_rows', suggestions.length === 2 && suggestions.every(s => s.reason === 'default_available'), suggestions);
  if (suggestions.length) {
    const applied = await ok('POST', `/workspaces/${WS}/media-repairs`, { items: suggestions.map(s => ({ workspace_candidate_id: s.workspace_candidate_id, row_version: s.row_version })) });
    note('repair_result', JSON.stringify(applied.data).slice(0, 300));
  }
  let rows = await members();
  const frame = rows.find(m => m.candidate_id === seed.ids.framePerson), photo = rows.find(m => m.candidate_id === seed.ids.photoPerson);
  check('frame_row_pinned_to_frame', frame.media_selection_state === 'pinned' && frame.portrait_source === 'frame' && frame.portrait_asset_id === seed.ids.f2, frame);
  check('photo_row_pinned_to_cover_photo', photo.media_selection_state === 'pinned' && photo.portrait_source === 'photo' && photo.portrait_asset_id === seed.ids.p2, photo);
  // Choose a different archive photo and a crop for the photo-only person; a crop for the frame person.
  await ok('PATCH', `/workspace-candidates/${photo.id}`, { row_version: photo.row_version, portrait_source: 'photo', portrait_asset_id: seed.ids.p1, portrait_crop: { focal_x: 0.5, focal_y: 0.3 } });
  await ok('PATCH', `/workspace-candidates/${frame.id}`, { row_version: frame.row_version, portrait_crop: { focal_x: 0.5, focal_y: 0.3 } });
  // A photo-only person added through the new app gets the default pin (cover photo) without any repair.
  const already = (await members()).find(m => m.candidate_id === seed.ids.photoPerson2);
  const added = already ?? (await ok('POST', `/workspaces/${WS}/candidates`, { candidate_id: seed.ids.photoPerson2 })).data;
  check('photo_only_add_pins_cover_photo', added.portrait_source === 'photo' && added.portrait_asset_id === seed.ids.p3 && added.media_selection_state === 'pinned', added);
  const broken = (await members()).find(m => m.candidate_id === seed.ids.brokenPerson) ?? (await ok('POST', `/workspaces/${WS}/candidates`, { candidate_id: seed.ids.brokenPerson })).data;
  const none = (await members()).find(m => m.candidate_id === seed.ids.nonePerson) ?? (await ok('POST', `/workspaces/${WS}/candidates`, { candidate_id: seed.ids.nonePerson })).data;
  check('no_media_person_stays_unset', none.media_selection_state === 'unset' && none.portrait_asset_id === null, none);
  rows = await members();
  state.members = Object.fromEntries(rows.map(m => [m.candidate_id, m.id])); persist();
  const photoRow = rows.find(m => m.id === photo.id);
  check('photo_crop_saved', photoRow.portrait_asset_id === seed.ids.p1 && photoRow.portrait_crop?.focal_x === 0.5 && photoRow.portrait_crop?.focal_y === 0.3, photoRow);
  note('broken_row', [broken.portrait_source, broken.portrait_asset_id]);
});

if (run('4')) await journey('4-review-1-4-explicit', async () => {
  const req = { age_range: null, gender_requirement: null, appearance_performance: null, languages: [], accents: [], skills: [], scene_references: [], shoot_dates: [], location: null, availability_requirements: null, other_instructions: null };
  const roles = (await ok('GET', `/workspaces/${WS}/roles?limit=50`)).data;
  const role = async (name, headcount) => roles.find(r => r.name === name) ?? (await ok('POST', `/workspaces/${WS}/roles`, { name, headcount, category: null, requirements: req })).data;
  const friends = await role('Friends', 3);
  const slots = (await ok('GET', `/roles/${friends.id}/slots`)).data;
  const assignments = (await ok('GET', `/workspaces/${WS}/assignments?limit=100`)).data;
  const want = [seed.ids.photoPerson2, seed.ids.brokenPerson, seed.ids.nonePerson];
  for (let i = 0; i < 3; i++) if (!assignments.some(a => a.slot_id === slots[i].id))
    await ok('POST', `/workspaces/${WS}/assignments`, { slot_id: slots[i].id, workspace_candidate_id: state.members[want[i]], expected_slot_row_version: slots[i].row_version, shortlist_included: true });
  // Explicit 1.4.0: switch the default only for this creation, then restore 1.3.0 (production keeps 1.3.0 until web+worker are released).
  let settings = (await ok('GET', '/settings')).data;
  if (!state.series14) {
    settings = (await ok('PATCH', '/settings', { row_version: settings.row_version, template_version: '1.4.0' })).data;
    state.series14 = (await ok('POST', '/presentation-series', { workspace_id: WS, output_type: 'shortlist' })).data.id;
    settings = (await ok('PATCH', '/settings', { row_version: settings.row_version, template_version: '1.3.0' })).data;
    persist();
  }
  const series = (await ok('GET', `/presentation-series/${state.series14}`)).data;
  check('series_on_1_4_with_client_default', series.template_version === '1.4.0' && series.audience_preset_id === state.client, series);
  check('default_restored_to_1_3', (await ok('GET', '/settings')).data.template_version === '1.3.0');
  const review = (await ok('GET', `/workspaces/${WS}/review?series_id=${state.series14}`)).data;
  writeFileSync(path.join(ART, 'review-1-4.json'), JSON.stringify(review, null, 1));
  note('issues', review.issues.map(i => [i.code, i.workspace_candidate_id?.slice(-4) ?? i.slot_id?.slice(-4) ?? null]));
  note('portraits', (review.presentation?.slides ?? []).map(s => s.portrait));
  note('fit', review.fit);
});
const { more } = await import('./release-more.mjs');
await more({ ok, call, check, note, journey, runWorker, WS, seed, state, persist, before, ART, sha, members, run, NEW });
save('staging-journeys.json');
