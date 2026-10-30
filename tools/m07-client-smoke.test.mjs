import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createSyntheticClientServer, CLIENT_ACTOR, CLIENT_PROJECT, CLIENT_RENAMED } from './m07-client-server.ts';

test('owned synthetic HTTP bridge uses the actual Studio SDK transport and preserves acting-user write/read state', async () => {
  const marker = randomBytes(32).toString('hex'); const server = await createSyntheticClientServer(marker, 0);
  const client = new Client({ name: 'eps-m07-preflight-only', version: '1.0.0' });
  try {
    assert.equal((await fetch(`${server.origin}/mcp`, { method: 'POST', body: '{}' })).status, 403);
    await client.connect(new StreamableHTTPClientTransport(new URL(`${server.origin}/mcp`), { requestInit: { headers: { Origin: server.origin, 'X-EPS-Synthetic-Run': marker } } }));
    assert.ok((await client.listTools()).tools.some(tool => tool.name === 'update_project'));
    const cap = await client.callTool({ name: 'get_capabilities', arguments: {} }); assert.equal(cap.structuredContent.data.principal_id, CLIENT_ACTOR);
    const list = await client.callTool({ name: 'list_projects', arguments: { limit: 1 } }); assert.equal(list.structuredContent.data[0].id, CLIENT_PROJECT);
    const input = { project_id: CLIENT_PROJECT, idempotency_key: 'm07-preflight-synthetic-stable-key', body: { row_version: 1, name: CLIENT_RENAMED } };
    assert.equal((await client.callTool({ name: 'update_project', arguments: input })).isError, undefined);
    assert.equal((await client.callTool({ name: 'update_project', arguments: input })).isError, undefined);
    const read = await client.callTool({ name: 'get_project', arguments: { project_id: CLIENT_PROJECT } });
    assert.equal(read.structuredContent.data.name, CLIENT_RENAMED); assert.equal(read.structuredContent.data.row_version, 2); assert.equal(server.snapshot().writes, 1);
    assert.ok(server.trace.some(event => event.negotiated_protocol)); assert.ok(server.trace.every(event => !event.principal_id || event.principal_id === CLIENT_ACTOR));
  } finally { await client.close(); await server.close(); }
});

test('protocol capture records modern server/discover and the accepted protocol revision', async () => {
  const marker = randomBytes(32).toString('hex'); const server = await createSyntheticClientServer(marker, 0);
  const client = new Client({ name: 'eps-m07-modern-preflight-only', version: '1.0.0' }, { versionNegotiation: { mode: 'auto' } });
  try {
    await client.connect(new StreamableHTTPClientTransport(new URL(`${server.origin}/mcp`), { requestInit: { headers: { Origin: server.origin, 'X-EPS-Synthetic-Run': marker } } }));
    await client.listTools();
    assert.ok(server.trace.some(event => event.method === 'server/discover'), JSON.stringify(server.trace));
    assert.ok(server.trace.some(event => event.method === 'tools/list' && event.accepted_protocol_header === '2026-07-28'), JSON.stringify(server.trace));
    assert.ok(server.trace.some(event => event.accepted_protocol_header === '2026-07-28'));
  } finally { await client.close(); await server.close(); }
});
