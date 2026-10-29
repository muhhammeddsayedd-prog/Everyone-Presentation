import assert from 'node:assert/strict';
import test from 'node:test';
import { createBearerUserClient } from '../src/client.ts';
import { createCentralReview } from '../src/review.ts';
import { slideWordingFields } from '../../domain/src/casting-types.ts';
import type { PresentationSeries, WorkspaceReview } from '../../domain/src/review-types.ts';
import { DomainError } from '../../domain/src/types.ts';

const actor = { principal_id: '10000000-0000-4000-8000-000000000001' };
const trace = { idempotencyKey: 'synthetic-review-stable-intent', requestId: 'review-request', clientType: 'mcp' as const };
const hash = 'a'.repeat(64);
const series = (): PresentationSeries => ({ id: 'series', workspace_id: 'workspace', output_type: 'selection', audience_preset_id: 'audience', audience_snapshot: { id: 'audience', key: 'internal', label: 'Synthetic internal', scope: 'internal', settings: {}, archived: false, row_version: 1 }, title: 'Synthetic review', latest_ready_version_id: null, latest_ready_version_no: null, row_version: 1, archived: false, template_key: 'everyone-casting', template_version: '1.0.0', template_content_sha256: hash, font_key: 'everyone-casting-fonts-v1' });
const review = (): WorkspaceReview => ({ workspace_id: 'workspace', series_id: 'series', input_fingerprint: hash, draft_revision: 1, output_type: 'selection', candidate_slide_count: 0, pending_slide_count: 1, issues: [{ code: 'FIT_MEASUREMENT_REQUIRED', severity: 'blocking', entity_id: null, field: null, message: 'Measure the exact layout.', repair_action: 'request_workspace_review_fit' }], can_generate: false, unreviewed_candidate_ids: [], template: { key: 'everyone-casting', version: '1.0.0', content_sha256: hash, font_key: 'everyone-casting-fonts-v1' }, cover: { project_name: 'Synthetic Project', client_name: null, title: 'Synthetic review', output_type: 'selection', logo_asset_id: null, logo_placement: 'cover' }, slides: [{ kind: 'pending', role_id: null, role_name: 'Requirements pending', slot_id: null, slot_label: 'Pending', assignment_id: null, workspace_candidate_id: null, candidate_id: null, candidate_media_id: null, position: null, review_status: null, assignment_row_version: null, workspace_candidate_row_version: null, candidate_row_version: null, requirements: { age_range: null, gender_requirement: null, appearance_performance: null, languages: [], accents: [], skills: [], scene_references: [], shoot_dates: [], location: null, availability_requirements: null, other_instructions: null }, provisional: true, fields: Object.fromEntries(slideWordingFields.map(key => [key, 'Not provided'])) as WorkspaceReview['slides'][number]['fields'], source_fields: Object.fromEntries(slideWordingFields.map(key => [key, 'Not provided'])) as WorkspaceReview['slides'][number]['fields'], frames: [], video_asset_id: null }], fit: { status: 'unmeasured', input_fingerprint: null, measured_at: null, overflows: [], error_code: 'FIT_MEASUREMENT_REQUIRED' } });
async function fixture() {
  let response: unknown = series(); let error: unknown;
  const calls: { name: string; args: unknown; headers: Headers }[] = [];
  const client = createBearerUserClient({ url: 'https://synthetic-review.invalid', publishableKey: 'sb_publishable_synthetic', accessToken: 'synthetic-user-token' }, { fetch: async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.pathname === '/auth/v1/user') return Response.json({ id: actor.principal_id, role: 'authenticated', aud: 'authenticated', is_anonymous: false });
    calls.push({ name: url.pathname.split('/').at(-1)!, args: JSON.parse(String(init?.body)), headers: new Headers(init?.headers) });
    return Response.json(error ?? response, { status: error ? 400 : 200 });
  } });
  return { api: await createCentralReview(client), calls, set: (value: unknown) => { response = value; }, error: (value: unknown) => { error = value; } };
}
const code = (name: string) => (error: unknown) => error instanceof DomainError && error.code === name;

test('series RPCs preserve request scope, audience identity, stable intent and pagination', async () => {
  const h = await fixture(); const input = { workspace_id: 'workspace', output_type: 'selection' as const, audience_preset_id: 'audience' };
  assert.deepEqual(await h.api.createPresentationSeries(actor, input, trace), series());
  assert.equal(h.calls[0].name, 'eps_create_presentation_series'); assert.deepEqual(h.calls[0].args, { p_input: input, p_idempotency_key: trace.idempotencyKey });
  assert.equal(h.calls[0].headers.get('X-EPS-Client-Type'), 'mcp'); assert.equal(h.calls[0].headers.get('X-EPS-Request-ID'), trace.requestId);
  h.set({ data: [series()], page: { next_cursor: 'opaque' } });
  assert.equal((await h.api.listPresentationSeries(actor, { workspace_id: 'workspace', limit: 1 })).page.next_cursor, 'opaque');
  assert.deepEqual(h.calls.at(-1)?.args, { p_options: { limit: 1, workspace_id: 'workspace' } });
  h.set(series()); assert.deepEqual(await h.api.getPresentationSeries(actor, 'series'), series());
  await h.api.updatePresentationSeries(actor, 'series', { row_version: 1, title: 'Renamed' }, trace);
  assert.deepEqual(h.calls.at(-1)?.args, { p_series_id: 'series', p_input: { row_version: 1, title: 'Renamed' }, p_idempotency_key: trace.idempotencyKey });
  const before = h.calls.length;
  await assert.rejects(h.api.getPresentationSeries({ principal_id: 'forged' }, 'series'), code('ACCESS_DENIED'));
  await assert.rejects(h.api.createPresentationSeries(actor, input, { idempotencyKey: 'short' }), code('IDEMPOTENCY_KEY_REQUIRED'));
  assert.equal(h.calls.length, before);
});

test('exact review scope, counts and measured-fit fingerprint reject malformed central responses', async () => {
  const h = await fixture(); h.set(review()); assert.deepEqual(await h.api.getWorkspaceReview(actor, 'workspace', { series_id: 'series' }), review());
  assert.deepEqual(h.calls.at(-1)?.args, { p_workspace_id: 'workspace', p_series_id: 'series', p_output_type: null });
  for (const bad of [{ ...review(), series_id: 'foreign' }, { ...review(), pending_slide_count: 0 }, { ...review(), can_generate: true }, { ...review(), fit: { status: 'measured', input_fingerprint: 'b'.repeat(64), measured_at: '2026-10-29T00:00:00Z', overflows: [], error_code: null } }, { ...review(), leaked_notes: 'private' }]) {
    h.set(bad); await assert.rejects(h.api.getWorkspaceReview(actor, 'workspace', { series_id: 'series' }), code('CENTRAL_RESPONSE_INVALID'));
  }
});
test('new1.1 review requires explicit nullable category while legacy1.0 responses retain their shape', async () => {
  const h = await fixture(); const legacy = review(); h.set(legacy);
  assert.deepEqual(await h.api.getWorkspaceReview(actor, 'workspace', { series_id: 'series' }), legacy);
  const current = { ...legacy, template: { ...legacy.template, version: '1.1.0' } }; h.set(current);
  await assert.rejects(h.api.getWorkspaceReview(actor, 'workspace', { series_id: 'series' }), code('CENTRAL_RESPONSE_INVALID'));
  current.slides = current.slides.map(slide => ({ ...slide, role_category: null })); h.set(current);
  assert.deepEqual(await h.api.getWorkspaceReview(actor, 'workspace', { series_id: 'series' }), current);
});

test('AI and layout jobs use durable acknowledgements and never accept arbitrary poll URLs', async () => {
  const h = await fixture(); const job = { job_id: 'job', resource_id: 'suggestion', poll_url: '/api/v1/jobs/job', status: 'queued' as const };
  const input = { workspace_id: 'workspace', capability: 'slide_shorten' as const, target_type: 'assignment' as const, target_id: 'assignment', target_row_version: 2, field: 'skills_experience', instruction: 'Preserve the qualifiers.' };
  h.set(job); assert.deepEqual(await h.api.createAiSuggestion(actor, input, trace), job);
  assert.equal(h.calls.at(-1)?.name, 'eps_create_ai_suggestion');
  await h.api.requestWorkspaceReviewFit(actor, 'workspace', { series_id: 'series', expected_input_fingerprint: hash }, trace);
  assert.deepEqual(h.calls.at(-1)?.args, { p_workspace_id: 'workspace', p_series_id: 'series', p_input: { expected_input_fingerprint: hash }, p_idempotency_key: trace.idempotencyKey });
  h.set({ ...job, poll_url: 'https://foreign.invalid' }); await assert.rejects(h.api.createAiSuggestion(actor, input, trace), code('CENTRAL_RESPONSE_INVALID'));
  const suggestion = { id: 'suggestion', target_id: 'assignment', target_row_version: 2, status: 'waiting_for_input', suggested_text: null, proposed_changes: [], warnings: [] };
  h.set(suggestion); assert.deepEqual(await h.api.getAiSuggestion(actor, 'suggestion'), suggestion);
  h.set({ ...suggestion, suggested_text: 'stale output' }); await assert.rejects(h.api.getAiSuggestion(actor, 'suggestion'), code('CENTRAL_RESPONSE_INVALID'));
});

test('retirement inverse is typed and bound to workspace/resource/event, with safe error translation', async () => {
  const h = await fixture(); const retirement = { workspace_id: 'workspace', resource_id: 'role', operation: 'archive_role', undo_event_id: 'event', expected_workspace_row_version: 5, assignment_ids: ['assignment'], slot_ids: ['slot'], main_count: 1, shortlist_count: 0, can_undo: true, unavailable_reason: null };
  h.set(retirement); assert.deepEqual(await h.api.getCastingRetirement(actor, 'workspace', 'role'), retirement);
  h.set({ success: true, affected_ids: ['role', 'slot', 'assignment'], workspace_row_version: 6 });
  await h.api.undoCastingRetirement(actor, 'workspace', 'event', { expected_workspace_row_version: 5 }, trace);
  assert.deepEqual(h.calls.at(-1)?.args, { p_workspace_id: 'workspace', p_event_id: 'event', p_input: { expected_workspace_row_version: 5 }, p_idempotency_key: trace.idempotencyKey });
  h.error({ code: 'P0001', message: 'STALE_RESOURCE_VERSION', details: '{"current_row_version":7}' });
  await assert.rejects(h.api.undoCastingRetirement(actor, 'workspace', 'event', { expected_workspace_row_version: 5 }, trace), code('STALE_RESOURCE_VERSION'));
});
