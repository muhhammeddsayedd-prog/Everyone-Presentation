import assert from 'node:assert/strict';
import test from 'node:test';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { AjvJsonSchemaValidator } from '@modelcontextprotocol/client/validators/ajv';
import type { PresentationOperations } from '../../packages/domain/src/presentation-types.ts';
import { createStudioMcpServer, implementedMcpTools, invokeMcpTool, type McpServices } from '../../apps/web/lib/mcp.ts';
import { DomainError } from '../../packages/domain/src/types.ts';
import { presentationId, presentationVersionFixture } from '../fixtures/presentation.ts';
import { syntheticMcpStudio } from '../fixtures/mcp-capabilities.ts';

const actor = { principal_id: presentationId(51) }; const key = 'synthetic-version-mcp-stable-key';
const names = ['list_versions', 'generate_version', 'get_version', 'download_version_pdf', 'play_version_media'];
function fixture() {
  const version = presentationVersionFixture(); const calls: unknown[][] = []; let error: DomainError | null = null;
  function record(args: unknown[], value: unknown) { if (error) throw error; calls.push(args); return value; }
  const service: PresentationOperations = {
    listVersions: async (...args) => record(args, { data: [version], page: { next_cursor: null } }) as Awaited<ReturnType<PresentationOperations['listVersions']>>,
    generateVersion: async (...args) => record(args, { job_id: presentationId(50), resource_id: version.id, poll_url: `/api/v1/jobs/${presentationId(50)}`, status: 'queued' }) as Awaited<ReturnType<PresentationOperations['generateVersion']>>,
    getVersion: async (...args) => record(args, version) as typeof version,
    downloadVersionPdf: async (...args) => record(args, { version_id: version.id, download_url: 'https://synthetic.invalid/private.pdf', expires_at: '2026-10-29T23:00:00Z', filename: 'synthetic.pdf', size_bytes: 100 }) as Awaited<ReturnType<PresentationOperations['downloadVersionPdf']>>,
    playVersionMedia: async (...args) => record(args, { asset_id: presentationId(10), url: 'https://synthetic.invalid/original', expires_at: '2026-10-29T23:00:00Z', mime_type: 'video/mp4', source_version_id: version.id }) as Awaited<ReturnType<PresentationOperations['playVersionMedia']>>,
    getVersionMediaContent: async () => { throw new Error('Binary helpers are not MCP tools'); }, getVersionPdfContent: async () => { throw new Error('Binary helpers are not MCP tools'); },
  };
  return { version, calls, services: { presentation: service, studio: syntheticMcpStudio(actor.principal_id) } as unknown as McpServices, error: (value: DomainError) => { error = value; } };
}
test('official MCP protocol exposes five composed version operations with acting-user and three-guard parity', async () => {
  const h = fixture(); const server = createStudioMcpServer(actor, h.services); const client = new Client({ name: 'eps-presentation-protocol', version: '1.0.0' });
  const [a, b] = InMemoryTransport.createLinkedPair(); await server.connect(a); await client.connect(b);
  try {
    const tools = (await client.listTools()).tools; const validator = new AjvJsonSchemaValidator(); type Schema = Parameters<AjvJsonSchemaValidator['getValidator']>[0];
    for (const name of names) assert.ok(tools.some(tool => tool.name === name), name);
    const cases = [
      ['list_versions', { series_id: h.version.series_id, limit: 1 }],
      ['generate_version', { series_id: h.version.series_id, body: { expected_workspace_row_version: 3, expected_draft_revision: 2, expected_input_fingerprint: 'a'.repeat(64) }, idempotency_key: key }],
      ['get_version', { version_id: h.version.id }], ['download_version_pdf', { version_id: h.version.id }],
      ['play_version_media', { version_id: h.version.id, asset_id: presentationId(10) }],
    ] as const;
    for (const [name, args] of cases) {
      const tool = tools.find(tool => tool.name === name)!; assert.equal(validator.getValidator(tool.inputSchema as Schema)(args).valid, true);
      const result = await client.callTool({ name, arguments: args }); assert.equal(result.isError, undefined, name);
      assert.equal(validator.getValidator(tool.outputSchema as Schema)(result.structuredContent).valid, true, name); assert.deepEqual(h.calls.at(-1)![0], actor);
    }
    const generation = h.calls[1].at(-1) as { idempotencyKey: string; clientType: string }; assert.equal(generation.idempotencyKey, key); assert.equal(generation.clientType, 'mcp');
    const before = h.calls.length; assert.equal((await invokeMcpTool('get_version', { version_id: h.version.id, principal_id: 'forged' }, actor, h.services)).isError, true); assert.equal(h.calls.length, before);
    h.error(new DomainError('INPUT_CHANGED', 'Refresh the selected review.', 409));
    const stale = await invokeMcpTool('generate_version', cases[1][1], actor, h.services); assert.equal(stale.isError, true);
    assert.equal((stale.structuredContent as { error: { code: string } }).error.code, 'INPUT_CHANGED');
  } finally { await client.close(); await server.close(); }
});
test('uncomposed versions never advertise or fall back to generic live-media operations', async () => {
  assert.equal(implementedMcpTools().some(tool => names.includes(tool.name)), false);
  const result = await invokeMcpTool('play_version_media', { version_id: presentationId(1), asset_id: presentationId(10) }, actor, {} as McpServices);
  assert.equal(result.isError, true); assert.equal((result.structuredContent as { error: { code: string } }).error.code, 'FEATURE_NOT_IMPLEMENTED');
});
