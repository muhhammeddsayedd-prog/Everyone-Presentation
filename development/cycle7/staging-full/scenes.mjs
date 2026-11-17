// Journey 10: scene proposals from specs imports (extraction v2) on the staging stack.
// Real: web API, specs pipeline jobs, worker prepare/extract/apply stages (validation, apply, proposals), scene
// confirm/reject operations, casting. Controlled: the OpenAI extraction answer (a fixed v2 payload served to the
// worker's Responses API call; no provider request is made).
import { writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { useApp, ok, call, check, note, journey, save, sql, runWorker, seed, S, ROOT } from './lib.mjs';
useApp('http://127.0.0.1:3000');
const state = JSON.parse(readFileSync(path.join(S, 'release-state.json'), 'utf8'));
const persist = () => writeFileSync(path.join(S, 'release-state.json'), JSON.stringify(state, null, 1));
const paragraphs = [
  'SCENE 1 - INT. KITCHEN - NIGHT. The young father cooks dinner.',
  'SCENE 3A - EXT. GARDEN - DAY. The old father waters the roses. Two waiters pass by.',
  'The old father is the same character as the young father, decades later.',
];
const ref = (paragraph, quote) => ({ asset_id: null, page: null, paragraph, segment_index: null, start_ms: null, end_ms: null, quote });
const req = refs => ({ age_range: null, gender_requirement: null, appearance_performance: null, languages: [], accents: [], skills: [], scene_references: refs, shoot_dates: [], location: null, availability_requirements: null, other_instructions: null });
function extraction(withScene5 = false) {
  const roles = [
    { source_role_key: 'father-young', name: 'Father (young)', headcount: 1, category: null, requirements: req(['1']), evidence: [ref(0, 'The young father cooks dinner.')], clarifications: [],
      occurrences: [{ scene_key: 'scene-1', display_title: 'Father (young)', evidence: [ref(0, 'The young father cooks dinner.')] }], same_character_as: null },
    { source_role_key: 'father-old', name: 'Father (old)', headcount: 1, category: null, requirements: req(['3A']), evidence: [ref(1, 'The old father waters the roses.')], clarifications: [],
      occurrences: [{ scene_key: 'scene-3a', display_title: null, evidence: [ref(1, 'The old father waters the roses.')] }],
      same_character_as: { source_role_key: 'father-young', evidence: [ref(2, 'The old father is the same character as the young father')] } },
    { source_role_key: 'waiters', name: 'Waiter', headcount: 2, category: 'Background', requirements: req(withScene5 ? ['3A', '5'] : ['3A']), evidence: [ref(1, 'Two waiters pass by.')], clarifications: [],
      occurrences: [{ scene_key: 'scene-3a', display_title: null, evidence: [ref(1, 'Two waiters pass by.')] },
        ...(withScene5 ? [{ scene_key: 'scene-5', display_title: 'Waiters at the party', evidence: [ref(3, 'The waiters serve the party.')] }] : [])], same_character_as: null },
  ];
  const scenes = [
    { scene_key: 'scene-1', scene_number: '1', title: 'Kitchen at night', sequence_label: null, setting: 'INT. KITCHEN - NIGHT', notes: null, requirements: [], evidence: [ref(0, 'SCENE 1 - INT. KITCHEN - NIGHT.')] },
    { scene_key: 'scene-3a', scene_number: '3A', title: withScene5 ? 'Garden (renamed in the new draft)' : 'Garden by day', sequence_label: null, setting: 'EXT. GARDEN - DAY', notes: null, requirements: ['Roses in bloom'], evidence: [ref(1, 'SCENE 3A - EXT. GARDEN - DAY.')] },
    ...(withScene5 ? [{ scene_key: 'scene-5', scene_number: '5', title: 'Party', sequence_label: null, setting: 'INT. HALL - NIGHT', notes: null, requirements: [], evidence: [ref(3, 'SCENE 5 - INT. HALL - NIGHT.')] }] : []),
  ];
  return { schema_version: '2.0', source_asset_id: null, source_language_codes: ['en'], roles, scenes, general_instructions: null, clarifications: [] };
}
const text = withScene5 => [...paragraphs, ...(withScene5 ? ['SCENE 5 - INT. HALL - NIGHT. The waiters serve the party.'] : [])].join('\n\n');
async function importSpecs(ws, withScene5) {
  const fixture = path.join(S, `specs-fixture-${withScene5 ? 'b' : 'a'}.json`); writeFileSync(fixture, JSON.stringify(extraction(withScene5)));
  process.env.EPS_STG_OPENAI_FIXTURE = fixture;
  const specs = (await call('GET', `/workspaces/${ws}/specs`)).body?.data;
  const submitted = await call('POST', `/workspaces/${ws}/specs`, { source_text: text(withScene5), ...(specs?.row_version ? { row_version: specs.row_version } : {}) });
  note(`submit_${withScene5 ? 'b' : 'a'}_${Date.now() % 1000}`, [submitted.status, submitted.body?.error?.code ?? null]);
  const job = submitted.body?.data?.job_id; const notices = [];
  for (let round = 0; round < 6; round++) {
    if (job) sql(`update eps.jobs set available_at=now() where id='${job}' and status='queued'`);
    notices.push(...runWorker(ROOT));
    const status = job ? sql(`select status from eps.jobs where id='${job}'`) : 'unknown';
    if (['succeeded', 'failed', 'waiting_for_input', 'cancelled', 'unknown'].includes(status)) break;
  }
  note(`job_${withScene5 ? 'b' : 'a'}_${Date.now() % 1000}`, job ? sql(`select status||':'||stage||':'||coalesce(error->>'code','') from eps.jobs where id='${job}'`) : null);
  delete process.env.EPS_STG_OPENAI_FIXTURE;
  const controlled = notices.filter(n => n.event === 'staging_worker_stopped').reduce((sum, n) => sum + (n.traffic?.controlled_openai_responses ?? 0), 0);
  return { submitted, controlled, notices: notices.filter(n => !['idle', 'recovery_completed'].includes(n.event)).map(n => n.event + (n.stage ? ':' + n.stage : '') + (n.code ? ':' + n.code : '')) };
}
const scenesOf = async ws => (await ok('GET', `/workspaces/${ws}/scenes?limit=50`)).data;

await journey('10-scene-proposals-from-imports', async () => {
  // Release step: switch the specs pipeline to extraction v2 (owner configuration change).
  sql("update eps.specs_pipeline_config set prompt_version='spec_extract_v2.0.0',result_schema_version='2.0' where id=1");
  check('pipeline_on_v2', sql('select prompt_version||\'|\'||result_schema_version from eps.specs_pipeline_config where id=1') === 'spec_extract_v2.0.0|2.0');
  // A second project/workspace for the import journey (provisioned like the seed; one workspace per project).
  const n = process.env.EPS_STG_SCENES_N ?? '2';
  const P2 = `c7570000-0000-4000-8000-00000000c00${n}`, WS2 = `c7570000-0000-4000-8000-00000000d00${n}`;
  sql(`insert into public.projects(id,name) values('${P2}','Cycle 7 staging scenes project') on conflict do nothing;
insert into public.project_memberships(project_id,principal_id,can_write) select '${P2}',principal_id,true from public.project_memberships where project_id='${seed.ids.project}' on conflict do nothing;
insert into eps.workspaces(id,project_id) values('${WS2}','${P2}') on conflict do nothing;`);
  const ws = WS2; state.ws2 = WS2; persist();
  const occurrences = list => list.flatMap(sc => (sc.occurrences ?? []).map(o => ({ ...o, scene_number: sc.scene_number })));
  // 1. First import into an empty workspace: scenes and links arrive as proposals (reviewed in Specs).
  const first = await importSpecs(ws, false); note('first_import', { controlled_calls: first.controlled, worker: first.notices });
  check('first_import_used_controlled_provider_once', first.controlled === 1, first.controlled);
  let scenes = await scenesOf(ws); note('scenes_after_first', scenes.map(x => [x.scene_number, x.title, x.status, (x.occurrences ?? []).length]));
  check('first_import_proposes_scenes', scenes.length === 2 && scenes.every(x => x.status === 'proposed'), scenes.map(x => [x.scene_number, x.status]));
  // 2. Repeated import before any decision: the untouched machine baseline is replaced; the new scene is proposed.
  const second = await importSpecs(ws, true); note('second_import', { controlled_calls: second.controlled, worker: second.notices });
  scenes = await scenesOf(ws); note('scenes_after_second', scenes.map(x => [x.scene_number, x.title, x.status]));
  check('repeat_import_proposes_new_scene', scenes.some(x => x.scene_number === '5' && x.status === 'proposed') && scenes.some(x => x.scene_number === '3A' && x.title === 'Garden (renamed in the new draft)'), scenes.map(x => [x.scene_number, x.title, x.status]));
  // 3. Reject one proposed link, re-import: the rejected link is not proposed again.
  const proposedLinks = occurrences(scenes).filter(o => o.status === 'proposed');
  const waiter5 = proposedLinks.find(o => o.scene_number === '5') ?? proposedLinks[0];
  let w = (await ok('GET', `/workspaces/${ws}`)).data;
  const reject = await call('POST', `/workspaces/${ws}/scene-proposals/reject`, { row_version: w.row_version, occurrence_ids: [waiter5.id] });
  check('reject_proposal', reject.status === 200, reject.body);
  const third = await importSpecs(ws, true); note('third_import', { worker: third.notices });
  scenes = await scenesOf(ws);
  const back = occurrences(scenes).filter(o => o.status === 'proposed' && o.scene_number === waiter5.scene_number && o.role_id && (o.display_title ?? null) === (waiter5.display_title ?? null));
  note('scenes_after_third', scenes.map(x => [x.scene_number, x.status, (x.occurrences ?? []).map(o => o.status).join(',')]));
  check('rejected_link_not_reproposed', back.length === 0, back);
  // 4. Human decisions: confirm scene 5 (with its scene record), cast a role.
  w = (await ok('GET', `/workspaces/${ws}`)).data;
  const s5 = scenes.find(x => x.scene_number === '5');
  const confirm = await call('POST', `/workspaces/${ws}/scene-proposals/confirm`, { row_version: w.row_version, scene_ids: [s5.id], occurrence_ids: occurrences([s5]).filter(o => o.status === 'proposed').map(o => o.id) });
  check('confirm_proposal', confirm.status === 200, confirm.body);
  const roles = (await ok('GET', `/workspaces/${ws}/roles?limit=50`)).data; note('roles', roles.map(r => r.name));
  const young = roles.find(r => r.name === 'Father (young)');
  const member = (await ok('POST', `/workspaces/${ws}/candidates`, { candidate_id: seed.ids.framePerson })).data;
  const slot = (await ok('GET', `/roles/${young.id}/slots`)).data[0];
  const assignment = (await ok('POST', `/workspaces/${ws}/assignments`, { slot_id: slot.id, workspace_candidate_id: member.id, expected_slot_row_version: slot.row_version, shortlist_included: true })).data;
  const beforeImport = JSON.stringify({ scenes: await scenesOf(ws), roles: (await ok('GET', `/workspaces/${ws}/roles?limit=50`)).data.map(r => [r.id, r.row_version]) });
  // 5. Import again after human decisions: refused as needs-attention; nothing confirmed or cast is touched.
  const fourth = await importSpecs(ws, false); note('fourth_import', { worker: fourth.notices });
  const jobState = fourth.submitted.body?.data?.job_id ? sql(`select status||':'||coalesce(error->>'code','') from eps.jobs where id='${fourth.submitted.body.data.job_id}'`) : null;
  check('import_after_decisions_needs_attention', jobState === 'waiting_for_input:INPUT_CHANGED', jobState);
  const afterImport = JSON.stringify({ scenes: await scenesOf(ws), roles: (await ok('GET', `/workspaces/${ws}/roles?limit=50`)).data.map(r => [r.id, r.row_version]) });
  check('confirmed_scenes_and_roles_unchanged', afterImport === beforeImport);
  const finalAssignments = (await ok('GET', `/workspaces/${ws}/assignments?limit=100`)).data;
  check('casting_preserved', finalAssignments.some(a => a.id === assignment.id && a.slot_id === slot.id));
});
save('staging-journeys.json');
