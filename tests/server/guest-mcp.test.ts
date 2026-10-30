import test from 'node:test';
import assert from 'node:assert/strict';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { AjvJsonSchemaValidator } from '@modelcontextprotocol/client/validators/ajv';
import { createStudioMcpServer, implementedMcpTools, invokeMcpTool, type McpServices } from '../../apps/web/lib/mcp.ts';
import type { ReviewLinkOperations } from '../../packages/domain/src/guest-types.ts';
import { DomainError } from '../../packages/domain/src/types.ts';

const actor = { principal_id: 'producer' }; const key = 'synthetic-sharing-request-key'; const timestamp = '2026-10-30T00:00:00Z';
const link = { id: 'link-1', series_id: 'series-1', label: 'Client', expires_at: '2026-11-29T00:00:00Z', download_enabled: true, revoked_at: null, latest_ready_version_id: 'version-1', row_version: 1, created_at: timestamp };
const created = { link, token: Buffer.alloc(32, 5).toString('base64url'), url: 'http://127.0.0.1:3000/r/synthetic' };
const comment = { id: 'comment-1', series_id: 'series-1', version_id: 'version-1', version_slide_id: 'slide-1', guest_session_id: null, author_display_name: 'Producer', company: null,
  visibility: 'internal' as const, body: 'Internal note', parent_comment_id: null, resolved: false, row_version: 1, created_at: timestamp, updated_at: timestamp };
const exported = { id: 'export-1', version_id: 'version-1', review_link_id: 'link-1', template_version: '1.1.0', export_revision: 1, status: 'queued' as const, pdf_asset_id: null, job_id: 'job-1', created_at: timestamp, ready_at: null, failure_code: null };
const names = ['list_review_links', 'create_review_link', 'update_review_link', 'revoke_review_link', 'rotate_review_link', 'list_feedback', 'create_comment', 'update_comment', 'set_preference', 'prepare_pdf_export', 'get_pdf_export', 'download_pdf_export'];
function fixture() {
  const calls: { method: string; args: unknown[] }[] = []; let error: DomainError | null = null;
  const responses: Record<string, unknown> = { listReviewLinks: { data: [link], page: { next_cursor: null } }, createReviewLink: created, updateReviewLink: link, revokeReviewLink: link, rotateReviewLink: created,
    listFeedback: { comments: [comment], preferences: [], version_id: 'version-1', page: { next_cursor: null } }, createComment: comment, updateComment: comment,
    setPreference: { preference: null, cleared: true }, preparePdfExport: { export: exported, job_id: 'job-1', cached: false }, getPdfExport: exported,
    downloadPdfExport: { version_id: 'version-1', download_url: 'http://127.0.0.1:3000/api/v1/pdf-exports/export-1/content', expires_at: '2026-10-30T00:01:00Z', filename: 'review.pdf', size_bytes: 10 } };
  const sharing = new Proxy({}, { get(_target, method: string) { return async (...args: unknown[]) => { if (error) throw error; calls.push({ method, args }); assert.ok(Object.hasOwn(responses, method)); return responses[method]; }; } }) as ReviewLinkOperations;
  return { services: { sharing } as McpServices, calls, deny() { error = new DomainError('ACCESS_DENIED', 'The represented user cannot access this series.', 403); } };
}
test('official MCP transport exposes twelve shared acting-user sharing/feedback/export operations', async () => {
  const h = fixture(); const server = createStudioMcpServer(actor, h.services); const client = new Client({ name: 'eps-guest-sharing-protocol', version: '1.0.0' });
  const [a, b] = InMemoryTransport.createLinkedPair(); await server.connect(a); await client.connect(b);
  try {
    const tools = (await client.listTools()).tools; const validator = new AjvJsonSchemaValidator(); type Schema = Parameters<AjvJsonSchemaValidator['getValidator']>[0];
    for (const name of names) assert.ok(tools.some(tool => tool.name === name), name);
    assert.ok(tools.every(tool => !tool.name.startsWith('guest_') && tool.name !== 'mint_review_media_grant'));
    const cases = [
      ['list_review_links', { workspace_id: 'workspace-1', limit: 1 }], ['create_review_link', { body: { series_id: 'series-1' }, idempotency_key: key }],
      ['update_review_link', { review_link_id: 'link-1', body: { row_version: 1, download_enabled: false }, idempotency_key: key }],
      ['revoke_review_link', { review_link_id: 'link-1', body: { row_version: 1 }, idempotency_key: key }], ['rotate_review_link', { review_link_id: 'link-1', body: { row_version: 1 }, idempotency_key: key }],
      ['list_feedback', { version_id: 'version-1' }], ['create_comment', { version_id: 'version-1', body: { version_slide_id: 'slide-1', body: 'Internal note', visibility: 'internal' }, idempotency_key: key }],
      ['update_comment', { comment_id: 'comment-1', body: { row_version: 1, resolved: true }, idempotency_key: key }],
      ['set_preference', { version_id: 'version-1', body: { version_slide_id: 'slide-1', value: null }, idempotency_key: key }],
      ['prepare_pdf_export', { body: { version_id: 'version-1', review_link_id: 'link-1' }, idempotency_key: key }], ['get_pdf_export', { export_id: 'export-1' }], ['download_pdf_export', { export_id: 'export-1' }]
    ] as const;
    for (const [name, args] of cases) {
      const tool = tools.find(item => item.name === name)!; assert.equal(validator.getValidator(tool.inputSchema as Schema)(args).valid, true, name);
      const result = await client.callTool({ name, arguments: args }); assert.equal(result.isError, undefined, name); assert.equal(validator.getValidator(tool.outputSchema as Schema)(result.structuredContent).valid, true, name);
      assert.deepEqual(h.calls.at(-1)!.args[0], actor);
    }
    assert.equal((h.calls.find(item => item.method === 'updateReviewLink')!.args.at(-1) as { idempotencyKey: string }).idempotencyKey, key);
    assert.equal((h.calls.find(item => item.method === 'createComment')!.args.at(-1) as { clientType: string }).clientType, 'mcp');
    const before = h.calls.length; const impersonate = await invokeMcpTool('list_review_links', { workspace_id: 'workspace-1', principal_id: 'other' }, actor, h.services); assert.equal(impersonate.isError, true); assert.equal(h.calls.length, before);
    h.deny(); const denied = await invokeMcpTool('list_feedback', { version_id: 'foreign' }, actor, h.services); assert.equal(denied.isError, true); assert.equal((denied.structuredContent as { error: { code: string } }).error.code, 'ACCESS_DENIED');
  } finally { await client.close(); await server.close(); }
});
test('uncomposed sharing cannot advertise or fall through to unrelated operations', async () => {
  assert.equal(implementedMcpTools(true, true, true).some(tool => names.includes(tool.name)), false);
  const result = await invokeMcpTool('list_review_links', {}, actor, {} as McpServices); assert.equal(result.isError, true); assert.equal((result.structuredContent as { error: { code: string } }).error.code, 'FEATURE_NOT_IMPLEMENTED');
});
