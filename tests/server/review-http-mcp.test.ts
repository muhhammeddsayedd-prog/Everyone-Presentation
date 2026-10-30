import assert from 'node:assert/strict';
import test from 'node:test';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { AjvJsonSchemaValidator } from '@modelcontextprotocol/client/validators/ajv';
import type { ReviewOperations, WorkspaceReview, PresentationSeries } from '../../packages/domain/src/review-types';
import { handleReviewRequest, isReviewRoute } from '../../apps/web/lib/review-http';
import { createStudioMcpServer, invokeMcpTool, implementedMcpTools, type McpServices } from '../../apps/web/lib/mcp';
import { DomainError } from '../../packages/domain/src/types';
import { syntheticMcpStudio } from '../fixtures/mcp-capabilities.ts';

const actor = { principal_id: 'synthetic-review-producer' }; const hash = 'a'.repeat(64); const key = 'synthetic-review-intent';
const names = ['list_presentation_series', 'create_presentation_series', 'get_presentation_series', 'update_presentation_series', 'get_workspace_review', 'create_ai_suggestion', 'get_ai_suggestion', 'request_workspace_review_fit', 'get_casting_retirement', 'undo_casting_retirement'];
const series: PresentationSeries = { id: 'series', workspace_id: 'workspace', output_type: 'selection', audience_preset_id: 'audience', audience_snapshot: { id: 'audience', key: 'internal', label: 'Internal', scope: 'internal', settings: {}, archived: false, row_version: 1 }, title: 'Synthetic', latest_ready_version_id: null, latest_ready_version_no: null, row_version: 1, archived: false, template_key: 'everyone-casting', template_version: '1.0.0', template_content_sha256: hash, font_key: 'everyone-casting-fonts-v1' };
const review: WorkspaceReview = { workspace_id: 'workspace', series_id: 'series', input_fingerprint: hash, draft_revision: 1, output_type: 'selection', candidate_slide_count: 0, pending_slide_count: 0, issues: [], can_generate: false, unreviewed_candidate_ids: [], template: { key: series.template_key, version: series.template_version, content_sha256: hash, font_key: series.font_key }, cover: { project_name: 'Synthetic', client_name: null, title: 'Synthetic', output_type: 'selection', logo_asset_id: null, logo_placement: 'cover' }, slides: [], fit: { status: 'unmeasured', input_fingerprint: null, measured_at: null, overflows: [], error_code: 'FIT_MEASUREMENT_REQUIRED' } };
const job = { job_id: 'job', resource_id: 'suggestion', poll_url: '/api/v1/jobs/job', status: 'queued' as const };
function fixture() {
  const calls: unknown[][] = []; let error: DomainError | null = null;
  const record = (method: string, args: unknown[], response: unknown) => { calls.push([method, ...args]); if (error) throw error; return response; };
  const service: ReviewOperations = {
    async listPresentationSeries(...args) { return record('listPresentationSeries', args, { data: [series], page: { next_cursor: null } }) as Awaited<ReturnType<ReviewOperations['listPresentationSeries']>>; },
    async createPresentationSeries(...args) { return record('createPresentationSeries', args, series) as PresentationSeries; },
    async getPresentationSeries(...args) { return record('getPresentationSeries', args, series) as PresentationSeries; },
    async updatePresentationSeries(...args) { return record('updatePresentationSeries', args, series) as PresentationSeries; },
    async getWorkspaceReview(...args) { return record('getWorkspaceReview', args, review) as WorkspaceReview; },
    async createAiSuggestion(...args) { return record('createAiSuggestion', args, job) as typeof job; },
    async getAiSuggestion(...args) { return record('getAiSuggestion', args, { id: 'suggestion', target_id: 'assignment', target_row_version: 1, status: 'waiting_for_input', suggested_text: null, proposed_changes: [], warnings: [] }) as Awaited<ReturnType<ReviewOperations['getAiSuggestion']>>; },
    async requestWorkspaceReviewFit(...args) { return record('requestWorkspaceReviewFit', args, job) as typeof job; },
    async getCastingRetirement(...args) { return record('getCastingRetirement', args, { workspace_id: 'workspace', resource_id: 'role', operation: 'archive_role', undo_event_id: 'event', expected_workspace_row_version: 3, assignment_ids: [], slot_ids: ['slot'], main_count: 0, shortlist_count: 0, can_undo: true, unavailable_reason: null }) as Awaited<ReturnType<ReviewOperations['getCastingRetirement']>>; },
    async undoCastingRetirement(...args) { return record('undoCastingRetirement', args, { success: true, affected_ids: ['role', 'slot'], workspace_row_version: 4 }) as Awaited<ReturnType<ReviewOperations['undoCastingRetirement']>>; },
  };
  return { service, calls, error: (value: DomainError) => { error = value; }, services: { review: service, studio: syntheticMcpStudio(actor.principal_id) } as McpServices };
}
function request(path: string, method = 'GET', body?: unknown) { return new Request('http://127.0.0.1/api/v1' + path, { method, headers: { 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); }
const context = { requestId: 'synthetic-review-http', clientType: 'browser' as const, idempotencyKey: key };

test('review HTTP mappings require exact series and stable intent with bounded query/method ownership', async () => {
  const h = fixture();
  assert.equal(isReviewRoute(['workspaces', 'workspace', 'review']), true); assert.equal(isReviewRoute(['workspaces', 'workspace', 'review', 'unsupported']), false);
  const result = await handleReviewRequest(request('/workspaces/workspace/review?series_id=series'), ['workspaces', 'workspace', 'review'], actor, h.service, context);
  assert.equal(result.status, 200); assert.deepEqual(h.calls.at(-1), ['getWorkspaceReview', actor, 'workspace', { series_id: 'series' }]);
  await handleReviewRequest(request('/presentation-series?workspace_id=workspace&limit=1'), ['presentation-series'], actor, h.service, context);
  assert.deepEqual(h.calls.at(-1), ['listPresentationSeries', actor, { limit: 1, workspace_id: 'workspace' }]);
  const before = h.calls.length;
  for (const url of ['/workspaces/workspace/review', '/workspaces/workspace/review?series_id=series&series_id=other', '/workspaces/workspace/review?series_id=series&actor=forged']) await assert.rejects(handleReviewRequest(request(url), ['workspaces', 'workspace', 'review'], actor, h.service, context));
  await assert.rejects(handleReviewRequest(request('/presentation-series', 'DELETE'), ['presentation-series'], actor, h.service, context));
  await assert.rejects(handleReviewRequest(request('/presentation-series', 'POST', { workspace_id: 'workspace', output_type: 'selection', audience_preset_id: 'audience' }), ['presentation-series'], actor, h.service, { ...context, idempotencyKey: 'short' }));
  assert.equal(h.calls.length, before);
});

test('official MCP protocol validates ten optional shared review operations and actor/intent parity', async () => {
  const h = fixture(); const server = createStudioMcpServer(actor, h.services); const client = new Client({ name: 'eps-review-protocol', version: '1.0.0' });
  const [a, b] = InMemoryTransport.createLinkedPair(); await server.connect(a); await client.connect(b);
  try {
    const tools = (await client.listTools()).tools; const validator = new AjvJsonSchemaValidator(); type Schema = Parameters<AjvJsonSchemaValidator['getValidator']>[0];
    for (const name of names) assert.ok(tools.some(tool => tool.name === name), name);
    const cases = [
      ['list_presentation_series', { workspace_id: 'workspace', limit: 1 }],
      ['create_presentation_series', { body: { workspace_id: 'workspace', output_type: 'selection', audience_preset_id: 'audience' }, idempotency_key: key }],
      ['get_presentation_series', { series_id: 'series' }],
      ['update_presentation_series', { series_id: 'series', body: { row_version: 1, title: 'Synthetic' }, idempotency_key: key }],
      ['get_workspace_review', { workspace_id: 'workspace', series_id: 'series' }],
      ['create_ai_suggestion', { body: { workspace_id: 'workspace', capability: 'slide_shorten', target_type: 'assignment', target_id: 'assignment', target_row_version: 1, field: 'skills_experience', instruction: 'Preserve qualifications.' }, idempotency_key: key }],
      ['get_ai_suggestion', { suggestion_id: 'suggestion' }],
      ['request_workspace_review_fit', { workspace_id: 'workspace', body: { series_id: 'series', expected_input_fingerprint: hash }, idempotency_key: key }],
      ['get_casting_retirement', { workspace_id: 'workspace', resource_id: 'role' }],
      ['undo_casting_retirement', { workspace_id: 'workspace', event_id: 'event', body: { expected_workspace_row_version: 3 }, idempotency_key: key }],
    ] as const;
    for (const [name, args] of cases) {
      const tool = tools.find(row => row.name === name)!; assert.equal(validator.getValidator(tool.inputSchema as Schema)(args).valid, true, name);
      const result = await client.callTool({ name, arguments: args }); assert.equal(result.isError, undefined, name);
      assert.equal(validator.getValidator(tool.outputSchema as Schema)(result.structuredContent).valid, true, name);
      const call = h.calls.at(-1)!; assert.deepEqual(call[1], actor);
      if ('idempotency_key' in args) { const trace = call.at(-1) as typeof context; assert.equal(trace.idempotencyKey, key); assert.equal(trace.clientType, 'mcp'); assert.ok(trace.requestId); }
    }
    const before = h.calls.length;
    assert.equal((await invokeMcpTool('get_workspace_review', { workspace_id: 'workspace', series_id: 'series', principal_id: 'forged' }, actor, h.services)).isError, true);
    assert.equal(h.calls.length, before);
    h.error(new DomainError('STALE_RESOURCE_VERSION', 'Reload current state.', 409));
    const stale = await invokeMcpTool('undo_casting_retirement', { workspace_id: 'workspace', event_id: 'event', body: { expected_workspace_row_version: 3 }, idempotency_key: key }, actor, h.services);
    assert.equal(stale.isError, true); assert.equal((stale.structuredContent as { error: { code: string } }).error.code, 'STALE_RESOURCE_VERSION');
  } finally { await client.close(); await server.close(); }
});

test('uncomposed review never advertises or falls back to unrelated services', async () => {
  assert.equal(implementedMcpTools().some(tool => names.includes(tool.name)), false);
  const result = await invokeMcpTool('get_workspace_review', { workspace_id: 'workspace', series_id: 'series' }, actor, {} as McpServices);
  assert.equal(result.isError, true); assert.equal((result.structuredContent as { error: { code: string } }).error.code, 'FEATURE_NOT_IMPLEMENTED');
});
