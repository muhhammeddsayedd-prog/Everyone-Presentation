import assert from 'node:assert/strict';
import test from 'node:test';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { DomainError } from '@eps/domain';
import { createStudioMcpServer, invokeMcpTool, type McpServices } from '../../apps/web/lib/mcp.ts';
import { mcpErrorText } from '../../apps/web/lib/mcp-error-text.ts';
import { syntheticMcpStudio } from '../fixtures/mcp-capabilities.ts';

const principal = '98000000-0000-4000-8000-000000000001';
const requestId = '98000000-0000-4000-8000-000000000002';
const actor = { principal_id: principal };
const args = { upload_id: '98000000-0000-4000-8000-000000000003', idempotency_key: 'synthetic-logo-completion-once',
  body: { actual_size_bytes: 31749, sha256: 'a'.repeat(64), start_processing: false } };
const closed = { logo_phase: 'download', storage_http_status: 400, storage_body_status: 404, storage_code: 'NoSuchKey' };
const secret = 'SYNTHETIC_PRIVATE_URL_TOKEN_REQUEST_BODY_MUST_NOT_APPEAR';
function services() {
  let calls = 0;
  const ports = { studio: { ...syntheticMcpStudio(principal), async completeUpload() {
    calls++; throw new DomainError('UPLOAD_INCOMPLETE', 'The uploaded logo bytes are not available yet.', 409, closed);
  } }, candidates: {}, specs: {}, jobs: {} } as unknown as McpServices;
  return { ports, count: () => calls };
}
function text(result: { content: unknown; structuredContent?: unknown }) {
  assert(Array.isArray(result.content));
  const item = result.content.find((v: { type?: unknown }) => v.type === 'text');
  assert.equal(typeof item?.text, 'string');
  return JSON.parse(item.text) as { request_id: string; error: { code: string; details: Record<string, unknown>; retryable: boolean } };
}

test('actual complete-upload MCP text preserves the same safe logo diagnostics and request ID', async () => {
  const c = services();
  const result = await invokeMcpTool('complete_upload', args, actor, c.ports, requestId);
  assert.equal(result.isError, true);
  const value = text(result), structured = result.structuredContent as typeof value;
  assert.equal(value.request_id, requestId); assert.equal(value.request_id, structured.request_id);
  assert.equal(value.error.code, 'UPLOAD_INCOMPLETE'); assert.equal(value.error.retryable, false);
  assert.deepEqual(value.error.details, closed); assert.deepEqual(value.error.details, structured.error.details);
  assert.equal(c.count(), 1);
});

test('installed MCP SDK text-only client receives the closed logo fields without a second completion', async () => {
  const c = services(), server = createStudioMcpServer(actor, c.ports);
  const client = new Client({ name: 'synthetic-logo-text-only-client', version: '1.0.0' });
  const [a, b] = InMemoryTransport.createLinkedPair(); await server.connect(a); await client.connect(b);
  try {
    const result = await client.callTool({ name: 'complete_upload', arguments: args });
    const value = text(result);
    assert.equal(result.isError, true); assert.match(value.request_id, /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u);
    assert.deepEqual(value.error.details, closed); assert.equal(c.count(), 1);
  } finally { await client.close(); await server.close(); }
});

test('logo text projection admits only closed phase/status/code values and never serializes arbitrary details', () => {
  for (const status of [100, 599, 400]) {
    const value = JSON.parse(mcpErrorText({ request_id: requestId, error: { code: 'UPLOAD_INCOMPLETE', message: 'Static error.',
      details: { ...closed, storage_http_status: status, storage_body_status: null, storage_code: null, token: secret, url: secret,
        request_body: { text: secret }, toJSON() { throw Error(secret); } } } }));
    assert.deepEqual(value.error.details, { ...closed, storage_http_status: status, storage_body_status: null, storage_code: null });
    assert(!JSON.stringify(value).includes(secret));
  }
  for (const bad of [99, 600, -1, 400.5, '400', NaN, { toJSON: () => secret }]) {
    const value = JSON.parse(mcpErrorText({ request_id: requestId, error: { code: 'UPLOAD_INCOMPLETE', message: 'Static error.',
      details: { ...closed, storage_http_status: bad, storage_body_status: bad, storage_code: secret, unexpected: secret } } }));
    assert.deepEqual(value.error.details, { logo_phase: 'download', storage_http_status: null, storage_body_status: null, storage_code: null });
    assert(!JSON.stringify(value).includes(secret));
  }
});

test('unmarked/invalid logo details stay absent and revision projection remains unchanged', () => {
  for (const phase of [undefined, null, secret, {}, 1]) {
    const value = JSON.parse(mcpErrorText({ request_id: requestId, error: { code: 'INPUT_CHANGED', message: 'Static error.',
      details: { ...closed, logo_phase: phase, current_row_version: 7, private_payload: secret } } }));
    assert.deepEqual(value.error.details, { current_row_version: 7 }); assert(!JSON.stringify(value).includes(secret));
  }
  const source = { get logo_phase(): never { throw Error(secret); } };
  assert.doesNotThrow(() => mcpErrorText({ request_id: requestId, error: { code: 'UPLOAD_INCOMPLETE', message: 'Static error.', details: source } }));
});
