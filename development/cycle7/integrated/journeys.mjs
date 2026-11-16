// Cycle-7 integrated local journeys: the REAL web app (Next dev, CENTRAL_ADAPTER_MODE=supabase) and its HTTP
// handlers (the same handlers MCP uses) against the disposable replica through PostgREST. Worker stages are
// driven through eps.record_job_event with controlled provider results (c7sim.*). No mocks in the app path.
//
// Prereqs: replica container (EPS_INT_CONTAINER, default eps-cycle7-full) seeded with seed.sql + auth-stub.sql,
// PostgREST on 55480, gateway.mjs on 55481, app on EPS_INT_APP (default http://127.0.0.1:3110),
// EPS_INT_JWT_SECRET set. Usage: node development/cycle7/integrated/journeys.mjs [journey ...]
import { createHmac, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';

const APP = process.env.EPS_INT_APP ?? 'http://127.0.0.1:3110';
const GATEWAY = 'http://127.0.0.1:55481';
const CONTAINER = process.env.EPS_INT_CONTAINER ?? 'eps-cycle7-full';
const secret = process.env.EPS_INT_JWT_SECRET; if (!secret) throw new Error('EPS_INT_JWT_SECRET required');
const WS = 'c7000000-0000-4000-8000-00000000d001';
const USERS = { a: ['c7000000-0000-4000-8000-0000000000a1', 'producer-a@example.invalid'], b: ['c7000000-0000-4000-8000-0000000000a2', 'producer-b@example.invalid'] };
const b64 = v => Buffer.from(JSON.stringify(v)).toString('base64url');
function token(user = 'a') {
  const [sub, email] = USERS[user];
  const head = b64({ alg: 'HS256', typ: 'JWT' }); const body = b64({ sub, email, role: 'authenticated', aud: 'authenticated', is_anonymous: false, exp: Math.floor(Date.now() / 1000) + 3600 });
  return `${head}.${body}.${createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url')}`;
}
async function call(method, path, body, { user = 'a', key } = {}) {
  const headers = { Authorization: `Bearer ${token(user)}`, Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (method !== 'GET') headers['Idempotency-Key'] = key ?? `c7-int-${randomUUID()}`;
  const res = await fetch(`${APP}/api/v1${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text(); let json; try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 300) }; }
  return { status: res.status, body: json };
}
async function ok(method, path, body, options) {
  const r = await call(method, path, body, options);
  if (r.status >= 300) throw new Error(`${method} ${path} -> ${r.status} ${JSON.stringify(r.body).slice(0, 400)}`);
  return r.body;
}
function sql(text) {
  return execFileSync('docker', ['exec', '-i', CONTAINER, 'psql', '-U', 'supabase_admin', '-h', 'localhost', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At'], { input: text, encoding: 'utf8' }).trim();
}
async function registerObject(bucket, key, size, contentType) {
  await fetch(`${GATEWAY}/__c7/objects`, { method: 'POST', body: JSON.stringify({ bucket, key, size, content_type: contentType }) });
}
const results = []; let current;
function check(name, condition, detail) {
  current.checks.push({ name, ok: Boolean(condition), ...(condition ? {} : { detail }) });
  if (!condition) throw new Error(`${current.journey}: ${name} failed ${detail ? JSON.stringify(detail).slice(0, 400) : ''}`);
}
async function journey(name, run) {
  current = { journey: name, checks: [] }; results.push(current);
  try { await run(); current.result = 'passed'; } catch (error) { current.result = 'failed'; current.error = String(error.message ?? error).slice(0, 800); }
  console.log(`${current.result === 'passed' ? 'PASS' : 'FAIL'} ${name} (${current.checks.length} checks)${current.error ? ' — ' + current.error : ''}`);
}

const sha = () => randomUUID().replace(/-/g, '').padEnd(64, 'a').slice(0, 64);
async function reserveAndComplete(filename, extra = {}) {
  const size = 2048; const mime = 'video/mp4';
  const reserved = (await ok('POST', '/uploads', { workspace_id: WS, purpose: 'candidate_video', filename, mime_type: mime, size_bytes: size, sha256: sha(), ...extra })).data;
  await registerObject(reserved.upload_metadata.bucketName, reserved.upload_metadata.objectName, size, mime);
  const completeKey = `c7-int-complete-${randomUUID()}`;
  const completed = (await ok('POST', `/uploads/${reserved.upload_id ?? reserved.id}/complete`, { actual_size_bytes: size, start_processing: true }, { key: completeKey })).data;
  return { reserved, completed, completeKey, uploadId: reserved.upload_id ?? reserved.id, jobId: completed.processing_job_id };
}
const uploads = async () => (await ok('GET', `/workspaces/${WS}/candidate-uploads?limit=50`)).data;
const members = async () => {
  const all = []; let cursor = null;
  do { const page = await ok('GET', `/workspaces/${WS}/candidates?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`); all.push(...page.data); cursor = page.next_cursor ?? page.page?.next_cursor ?? null; } while (cursor);
  return all;
};

const JOURNEYS = {
  async upload() {
    await journey('1-upload-to-project', async () => {
      const before = await members();
      const { jobId, uploadId } = await reserveAndComplete('j1-new-person.mp4');
      check('job_created', jobId);
      const row = (await uploads()).find(item => item.upload_id === uploadId || item.id === uploadId);
      check('upload_row_processing', row && /processing|queued/u.test(String(row.state ?? row.status)), row);
      check('worker_completes', sql(`select c7sim.advance('${jobId}')`) === 'succeeded');
      const job = (await ok('GET', `/jobs/${jobId}`)).data;
      check('job_result_names_candidate_and_membership', job.candidate_result?.candidate_id && job.candidate_result?.workspace_candidate_id, job.candidate_result);
      const after = await members();
      const added = after.find(item => item.id === job.candidate_result.workspace_candidate_id);
      check('membership_visible_in_project', added && after.length === before.length + 1, { before: before.length, after: after.length });
      const library = (await ok('GET', `/candidates?limit=5&workspace_id=${WS}`)).data;
      const person = library.find(item => item.id === job.candidate_result.candidate_id);
      check('newest_in_library_with_membership', person && library[0].id === person.id && person.membership?.workspace_candidate_id === added.id, library[0]);
      const restored = (await uploads()).find(item => item.upload_id === uploadId || item.id === uploadId);
      check('upload_row_ready_after_reload', restored && restored.workspace_candidate_id === added.id, restored);
    });
  },
  async reload() {
    await journey('2-reload-during-processing', async () => {
      const { jobId, uploadId } = await reserveAndComplete('j2-slow-person.mp4');
      sql(`select c7sim.advance('${jobId}', false)`); sql(`select c7sim.advance('${jobId}', false)`);
      const mid = (await uploads()).find(item => item.upload_id === uploadId || item.id === uploadId);
      check('restored_while_processing', mid && /processing|queued|running/u.test(String(mid.state ?? mid.status)) && !mid.workspace_candidate_id, mid);
      const job = (await ok('GET', `/jobs/${jobId}`)).data;
      check('job_not_terminal_mid_way', !['succeeded', 'failed'].includes(job.status), job.status);
      check('worker_finishes_later', sql(`select c7sim.advance('${jobId}')`) === 'succeeded');
      const done = (await uploads()).find(item => item.upload_id === uploadId || item.id === uploadId);
      check('restored_ready_after_completion', done?.workspace_candidate_id, done);
    });
  },
  async retry() {
    await journey('3-failure-retry-no-duplicates', async () => {
      const people = Number(sql('select count(*) from eps.candidates'));
      // a) Transient worker failures are retried by the job kernel (bounded), then the scan succeeds once.
      const { jobId, uploadId, completeKey } = await reserveAndComplete('j3-flaky.mp4');
      check('first_transient_failure_requeued', sql(`select c7sim.fail('${jobId}','DEPENDENCY_UNAVAILABLE',true)`) === 'queued');
      const auto = (await uploads()).find(item => item.upload_id === uploadId);
      check('row_processing_with_error_code_during_retry', auto?.state === 'processing' && auto.job?.error_code === 'DEPENDENCY_UNAVAILABLE', auto);
      check('second_transient_failure_requeued', sql(`select c7sim.fail('${jobId}','DEPENDENCY_UNAVAILABLE',true)`) === 'queued');
      const replay = await call('POST', `/uploads/${uploadId}/complete`, { actual_size_bytes: 2048, start_processing: true }, { key: completeKey });
      check('complete_replay_is_inert', replay.status < 300 && replay.body.data?.processing_job_id === jobId, replay);
      check('third_attempt_succeeds', sql(`select c7sim.advance('${jobId}')`) === 'succeeded');
      const job = (await ok('GET', `/jobs/${jobId}`)).data;
      check('one_new_person', sql('select count(*) from eps.candidates') === String(people + 1));
      check('single_active_membership', sql(`select count(*) from eps.workspace_candidates where candidate_id='${job.candidate_result.candidate_id}' and archived_at is null`) === '1');
      check('single_tape', sql(`select count(*) from eps.candidate_media where candidate_id='${job.candidate_result.candidate_id}'`) === '1');
      check('duplicate_apply_callback_inert', sql(`select count(*) from eps.workspace_candidates where candidate_id='${job.candidate_result.candidate_id}'`) === '1');
      // b) Exhausted budget: needs attention, no manual retry, nobody created.
      const exhausted = await reserveAndComplete('j3-broken.mp4');
      let status = 'queued'; for (let attempt = 0; attempt < 5 && status !== 'failed'; attempt++) status = sql(`select c7sim.fail('${exhausted.jobId}','DEPENDENCY_UNAVAILABLE',true)`);
      check('budget_exhausted_fails', status === 'failed');
      const row = (await uploads()).find(item => item.upload_id === exhausted.uploadId);
      check('row_needs_attention_not_retryable', row && row.state !== 'processing' && row.job?.retryable === false, row);
      const failedJob = (await ok('GET', `/jobs/${exhausted.jobId}`)).data;
      const refused = await call('POST', `/jobs/${exhausted.jobId}/retry`, { row_version: failedJob.row_version });
      check('manual_retry_refused_after_exhaustion', refused.status === 409, refused.status);
      check('no_person_from_failed_upload', sql('select count(*) from eps.candidates') === String(people + 1));
    });
  },
  async tape() {
    await journey('4-extra-tape-while-facts-edited', async () => {
      const person = 'c7000000-0000-4000-8000-000000000005';
      const before = (await ok('GET', `/candidates/${person}`)).data;
      const reserved = (await ok('POST', '/uploads', { workspace_id: WS, candidate_id: person, purpose: 'candidate_video', filename: 'j4-second-tape.mp4', mime_type: 'video/mp4', size_bytes: 2048, sha256: sha() })).data;
      await registerObject(reserved.upload_metadata.bucketName, reserved.upload_metadata.objectName, 2048, 'video/mp4');
      const done = (await ok('POST', `/uploads/${reserved.upload_id ?? reserved.id}/complete`, { actual_size_bytes: 2048, start_processing: true })).data;
      sql(`select c7sim.advance('${done.processing_job_id}', false)`);
      const facts = { ...before.facts, city: 'Alexandria', skills_experience: 'Edited during processing' };
      await ok('PATCH', `/candidates/${person}`, { row_version: before.row_version, facts });
      check('apply_succeeds_after_edit', sql(`select c7sim.advance('${done.processing_job_id}')`) === 'succeeded');
      const after = (await ok('GET', `/candidates/${person}`)).data;
      check('edited_facts_intact', after.facts.city === 'Alexandria' && after.facts.skills_experience === 'Edited during processing', after.facts);
      check('tape_attached', sql(`select count(*) from eps.candidate_media where candidate_id='${person}'`) === '1');
    });
  },
  async add() {
    await journey('5-add-concurrent-remove-readd', async () => {
      const person = 'c7000000-0000-4000-8000-000000000007';
      const key = `c7-int-add-${randomUUID()}`;
      const [first, second, third] = await Promise.all([
        call('POST', `/workspaces/${WS}/candidates`, { candidate_id: person }, { key }),
        call('POST', `/workspaces/${WS}/candidates`, { candidate_id: person }, { key }),
        call('POST', `/workspaces/${WS}/candidates`, { candidate_id: person }, { user: 'b' }),
      ]);
      check('all_succeed', [first, second, third].every(r => r.status < 300), [first.status, second.status, third.status, third.body]);
      const ids = new Set([first, second, third].map(r => r.body.data.id));
      check('converge_on_one_membership', ids.size === 1 && sql(`select count(*) from eps.workspace_candidates where candidate_id='${person}' and archived_at is null`) === '1');
      check('another_user_sees_already_member', third.body.data.already_member === true || first.body.data.already_member === true || second.body.data.already_member === true);
      const membership = [...ids][0];
      const row = (await ok('GET', `/workspace-candidates/${membership}`).catch(() => null))?.data ?? (await members()).find(m => m.id === membership);
      await ok('POST', `/workspace-candidates/${membership}/remove`, { row_version: row.row_version, reason: 'Integrated check removal' });
      const library = (await ok('GET', `/candidates?limit=100&workspace_id=${WS}`)).data.find(c => c.id === person);
      check('library_membership_cleared', library && !library.membership, library?.membership);
      const replay = await call('POST', `/workspaces/${WS}/candidates`, { candidate_id: person }, { key });
      check('old_key_does_not_replay_archived', replay.status < 300 && replay.body.data.id !== membership && !replay.body.data.archived, replay.body);
      check('readd_one_active', sql(`select count(*) from eps.workspace_candidates where candidate_id='${person}' and archived_at is null`) === '1');
    });
  },
  async order() {
    await journey('6-newest-first-pages-filters', async () => {
      const pages = []; let cursor = null;
      do { const page = await ok('GET', `/candidates?limit=7${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`); pages.push(page.data); cursor = page.next_cursor ?? null;
        if (pages.length === 1) { await ok('POST', '/candidates', { facts: { name: 'Arrives Between Pages', casting_id: null, age_or_range: null, stated_gender: null, height_measurements: null, languages: [], accents: [], skills_experience: null, city: null, previous_projects_roles: null, classification: null } }); }
      } while (cursor);
      const flat = pages.flat(); const ids = flat.map(c => c.id);
      check('no_duplicates_across_pages', new Set(ids).size === ids.length, ids.length);
      const stamps = flat.map(c => [c.created_at, c.id]);
      check('descending_created_then_id', stamps.every((v, i) => i === 0 || v[0] < stamps[i - 1][0] || (v[0] === stamps[i - 1][0] && v[1] < stamps[i - 1][1])));
      check('new_arrival_not_injected_into_later_pages', !flat.some(c => c.facts.name === 'Arrives Between Pages'));
      const old = 'c7000000-0000-4000-8000-000000000002'; const current = (await ok('GET', `/candidates/${old}`)).data;
      await ok('PATCH', `/candidates/${old}`, { row_version: current.row_version, facts: { ...current.facts, skills_experience: 'edited later' } });
      const top = (await ok('GET', '/candidates?limit=3')).data;
      check('older_edit_not_moved_to_top', !top.some(c => c.id === old), top.map(c => c.facts.name));
      const filtered = []; cursor = null;
      do { const page = await ok('GET', `/candidates?limit=4&city=Cairo&include_unknown=false${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`); filtered.push(...page.data); cursor = page.next_cursor ?? null; } while (cursor);
      check('filtered_pages_only_matches_and_ordered', filtered.length > 0 && filtered.every(c => c.facts.city === 'Cairo') && filtered.every((c, i) => i === 0 || c.created_at <= filtered[i - 1].created_at));
    });
  },
  async setup() {
    // Shared casting fixture for journeys 8-13: Father (role A) across scenes 1, 3, 5; an unrelated Father (role B).
    await journey('0-casting-setup', async () => {
      const req = { age_range: null, gender_requirement: null, appearance_performance: null, languages: [], accents: [], skills: [], scene_references: [], shoot_dates: [], location: null, availability_requirements: null, other_instructions: null };
      const roleA = (await ok('POST', `/workspaces/${WS}/roles`, { name: 'Father', headcount: 1, requirements: req })).data;
      const roleB = (await ok('POST', `/workspaces/${WS}/roles`, { name: 'Father', headcount: 1, requirements: req })).data;
      const slotA = (await ok('GET', `/roles/${roleA.id}/slots`)).data[0];
      const photoPerson = 'c7000000-0000-4000-8000-00000000f001';
      const added = (await ok('POST', `/workspaces/${WS}/candidates`, { candidate_id: photoPerson })).data;
      const other = (await ok('POST', `/workspaces/${WS}/candidates`, { candidate_id: 'c7000000-0000-4000-8000-000000000009' })).data;
      const a1 = (await ok('POST', `/workspaces/${WS}/assignments`, { slot_id: slotA.id, workspace_candidate_id: added.id, expected_slot_row_version: slotA.row_version, shortlist_included: true })).data;
      const slotB = (await ok('GET', `/roles/${roleB.id}/slots`)).data[0];
      const b1 = (await ok('POST', `/workspaces/${WS}/assignments`, { slot_id: slotB.id, workspace_candidate_id: other.id, expected_slot_row_version: slotB.row_version, shortlist_included: true })).data;
      const scenes = [];
      for (const [n, title] of [['1', 'Breakfast'], ['3', 'Car ride'], ['5', 'Dinner']]) scenes.push((await ok('POST', `/workspaces/${WS}/scenes`, { title, scene_number: n, setting: `${title} setting` })).data);
      for (const scene of scenes) await ok('POST', `/scenes/${scene.id}/occurrences`, { role_id: roleA.id });
      await ok('POST', `/scenes/${scenes[1].id}/occurrences`, { role_id: roleB.id });
      globalThis.fixture = { roleA, roleB, slotA, slotB, added, other, a1, b1, scenes, photoPerson };
      check('photo_only_member_pinned_photo', added.portrait_source === 'photo' && added.media_selection_state === 'pinned', added);
      check('father_occurrences', (await ok('GET', `/roles/${roleA.id}/occurrences`)).data.length === 3);
    });
  },
  async scenes() {
    await journey('10-recurring-role-shared-casting', async () => {
      const { roleA, slotA, a1, b1 } = globalThis.fixture;
      const slot = (await ok('GET', `/roles/${roleA.id}/slots`)).data[0];
      await ok('PUT', `/slots/${slot.id}/main`, { assignment_id: a1.id, expected_slot_row_version: slot.row_version, replacement_behavior: 'move_previous_to_backup' });
      const list = (await ok('GET', `/workspaces/${WS}/scenes?limit=50`)).data;
      const fatherScenes = list.filter(scene => scene.occurrences.some(o => o.role_id === roleA.id)).map(scene => scene.scene_number);
      check('father_in_1_3_5', JSON.stringify(fatherScenes) === JSON.stringify(['1', '3', '5']), fatherScenes);
      const assignments = (await ok('GET', `/workspaces/${WS}/assignments?limit=100`)).data;
      check('one_main_shared_by_all_occurrences', assignments.filter(a => a.slot_id === slotA.id && a.position === 'main').length === 1);
      check('unrelated_father_unchanged', assignments.find(a => a.id === b1.id)?.position === 'option', assignments.find(a => a.id === b1.id));
      const scene3 = list.find(scene => scene.scene_number === '3');
      await ok('PATCH', `/scenes/${scene3.id}`, { row_version: scene3.row_version, scene_number: '30', title: 'Car ride (renumbered)' });
      const stale = await call('PATCH', `/scenes/${scene3.id}`, { row_version: scene3.row_version, title: 'stale' });
      check('stale_scene_edit_refused', stale.status === 409, stale.status);
      const after = (await ok('GET', `/workspaces/${WS}/assignments?limit=100`)).data;
      const shape = rows => JSON.stringify(rows.map(a => [a.id, a.position, a.shortlist_included]).sort());
      check('renumber_keeps_casting', shape(after) === shape(assignments));
      const scene5 = list.find(scene => scene.scene_number === '5');
      await ok('POST', `/scenes/${scene5.id}/archive`, { row_version: scene5.row_version });
      const afterArchive = (await ok('GET', `/workspaces/${WS}/assignments?limit=100`)).data;
      check('archive_scene_keeps_casting', shape(afterArchive) === shape(after));
      check('archive_scene_keeps_role_other_occurrences', (await ok('GET', `/roles/${roleA.id}/occurrences`)).data.length === 2);
      const fresh3 = (await ok('GET', `/workspaces/${WS}/scenes?limit=50`)).data.find(scene => scene.id === scene3.id);
      const occurrenceB = fresh3.occurrences.find(o => o.role_id !== roleA.id);
      const foreign = await call('PATCH', `/scene-occurrences/${occurrenceB.id}`, { row_version: occurrenceB.row_version, slot_ids: [slotA.id] });
      check('slot_of_other_role_refused', foreign.status >= 400, foreign.status);
    });
  },
  async audience() {
    await journey('13-client-default-and-internal-restrictions', async () => {
      const settings = (await ok('GET', '/settings')).data;
      const noDefault = await call('POST', '/presentation-series', { workspace_id: WS, output_type: 'shortlist' });
      check('missing_default_is_explicit', noDefault.status >= 400 && noDefault.body.error?.code === 'AUDIENCE_DEFAULT_REQUIRED', noDefault.body);
      const client = (await ok('POST', '/audience-presets', { label: 'Client', scope: 'external', settings: {} })).data;
      const internal = (await ok('POST', '/audience-presets', { label: 'Internal Production', scope: 'internal', settings: {} })).data;
      await ok('PATCH', '/settings', { row_version: settings.row_version, default_audience_preset_id: client.id });
      const fresh = (await ok('GET', '/settings')).data;
      check('template_default_unchanged_by_audience_setting', fresh.template_version === settings.template_version, [fresh.template_version, settings.template_version]);
      await ok('PATCH', '/settings', { row_version: fresh.row_version, template_version: '1.4.0' });
      const series = (await ok('POST', '/presentation-series', { workspace_id: WS, output_type: 'shortlist' })).data;
      check('ordinary_series_uses_client_default', JSON.stringify(series).includes(client.id), series);
      check('new_series_on_1_4', JSON.stringify(series).includes('1.4.0'), series);
      const internalSeries = (await ok('POST', '/presentation-series', { workspace_id: WS, output_type: 'shortlist', audience_preset_id: internal.id })).data;
      check('internal_is_separate_series', internalSeries.id !== series.id);
      globalThis.series = series;
      // Guest-link eligibility (eps_create_review_link: external series only) needs the review gateway credential,
      // which this stack does not provision; that function is byte-identical to live (see tracking/evidence/cycle7).
    });
  },
  async picture() {
    await journey('8-photo-portrait-in-review', async () => {
      const { added } = globalThis.fixture; const series = globalThis.series;
      const row = (await members()).find(m => m.id === added.id);
      await ok('PATCH', `/workspace-candidates/${added.id}`, { row_version: row.row_version, portrait_crop: { focal_x: 0.5, focal_y: 0.3 } });
      const review = (await ok('GET', `/workspaces/${WS}/review?series_id=${series.id}`)).data;
      const text = JSON.stringify(review);
      check('review_on_1_4', JSON.stringify(review.template ?? {}).includes('1.4.0'), review.template);
      check('photo_portrait_in_review', text.includes('c7000000-0000-4000-8000-00000000e003'), Object.keys(review));
      check('crop_captured', text.includes('0.3'));
      check('scene_context_captured', text.includes('Breakfast'));
    });
  },
  async repair() {
    await journey('9-existing-project-repair', async () => {
      const legacy = sql(`insert into eps.workspace_candidates(workspace_id,candidate_id) values('${WS}','c7000000-0000-4000-8000-000000000011') returning id`).split(/\r?\n/u)[0];
      const explicit = sql(`insert into eps.workspace_candidates(workspace_id,candidate_id,media_selection_state) values('${WS}','c7000000-0000-4000-8000-000000000012','intentionally_empty') returning id`).split(/\r?\n/u)[0];
      const suggestions = (await ok('GET', `/workspaces/${WS}/media-repairs`)).data;
      const mine = suggestions.find(item => item.workspace_candidate_id === legacy);
      check('legacy_row_suggested', mine, suggestions.slice(0, 2));
      check('intentional_choice_not_suggested', !suggestions.some(item => item.workspace_candidate_id === explicit));
      sql(`update eps.workspace_candidates set availability='changed after suggestion',row_version=row_version+1 where id='${legacy}'`);
      const stale = await call('POST', `/workspaces/${WS}/media-repairs`, { items: [{ workspace_candidate_id: legacy, row_version: mine.row_version }] });
      check('stale_repair_not_applied', sql(`select media_selection_state from eps.workspace_candidates where id='${legacy}'`) === 'unset', stale.body);
      check('explicit_choice_preserved', sql(`select media_selection_state from eps.workspace_candidates where id='${explicit}'`) === 'intentionally_empty');
    });
  },
  async search() {
    await journey('14-search-names-facets', async () => {
      const arabic = (await ok('GET', `/candidates?limit=5&q=${encodeURIComponent('شخص')}`)).data;
      check('arabic_name_search', arabic.some(c => c.id === 'c7000000-0000-4000-8000-00000000f001'), arabic.map(c => c.id));
      const english = (await ok('GET', `/candidates?limit=5&q=${encodeURIComponent('photo only')}`)).data;
      check('english_name_search', english.some(c => c.id === 'c7000000-0000-4000-8000-00000000f001'));
      const facets = await call('POST', '/candidate-facets/query', { facets: {}, include_unknown: true });
      check('facets_query_ok', facets.status < 300, facets.body);
    });
  },
};

const selected = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(JOURNEYS);
for (const name of selected) await JOURNEYS[name]();
mkdirSync('.local/cycle7/integrated', { recursive: true });
writeFileSync('.local/cycle7/integrated/journeys.json', JSON.stringify({ at: new Date().toISOString(), app: APP, container: CONTAINER, results }, null, 1));
if (results.some(r => r.result !== 'passed')) process.exitCode = 1;
