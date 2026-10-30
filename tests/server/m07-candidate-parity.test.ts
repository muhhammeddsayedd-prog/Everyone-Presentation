import assert from 'node:assert/strict';
import test from 'node:test';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { AjvJsonSchemaValidator } from '@modelcontextprotocol/client/validators/ajv';
import { createManualCandidate, DomainError } from '@eps/domain';
import { createBearerUserClient } from '../../packages/central/src/client.ts';
import { createCentralCandidates } from '../../packages/central/src/candidates.ts';
import { createCentralStudio } from '../../packages/central/src/studio.ts';
import { handleCandidatesRequest, type CandidatesOperations } from '../../apps/web/lib/candidates-http.ts';
import { createStudioMcpServer, type McpServices } from '../../apps/web/lib/mcp.ts';

const principal = '10000000-0000-4000-8000-000000000001';
const candidateId = '20000000-0000-4000-8000-000000000001';
const actor = { principal_id: principal };
const facts = { name: null, casting_id: null, age_or_range: null, stated_gender: null, height_measurements: null,
  languages: [], accents: [], skills_experience: null, city: null, previous_projects_roles: null, classification: null };
const source = createManualCandidate({ id: candidateId, facts, castingId: 'EPS-SYNTHETIC', actorId: principal, now: '2026-10-30T10:00:00Z' });
const candidate = Object.fromEntries(Object.entries(source).filter(([key]) => !['source_kind', 'field_sources', 'reviewed_facts_fingerprint', 'age_as_of'].includes(key)));
const media = (id: string) => ({ id, candidate_id: candidateId, source_asset_id: `source-${id}`, preview_asset_id: null,
  transcript_asset_id: null, original_transcript: null, languages: [], available_frames: [], selected_frame_asset_ids: [], processing_issues: [], row_version: 1 });
const pool = { id: 'project-candidate', workspace_id: 'workspace', candidate_id: candidateId, selected_candidate_media_id: null,
  selected_frame_asset_ids: [], availability: null, fresh_material_required: false, media_confirmed: false, internal_notes: null, row_version: 1 };
const hasCode = (code: string) => (error: unknown) => error instanceof DomainError && error.code === code;

/** Controlled RPC bytes only: actual Supabase JS, acting-user verification, central
 * parsers, HTTP handlers and official MCP client execute. No cloud/SQL is called. */
async function fixture() {
  let rows = ['media-c', 'media-a', 'media-b'].map(media);
  const duplicates = ['duplicate-c', 'duplicate-a', 'duplicate-b'].map(id => ({ candidate_id: id, display_name: null, match_reasons: ['name'] }));
  let deny = false;
  const writes: { name: string; input: Record<string, unknown>; headers: Headers }[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.pathname === '/auth/v1/user') return Response.json({ id: principal, role: 'authenticated', aud: 'authenticated', is_anonymous: false });
    const name = url.pathname.split('/').at(-1)!;
    const supplied = JSON.parse(String(init?.body)) as Record<string, unknown>;
    if (name === 'eps_get_capabilities') return Response.json({ principal_id: principal,
      capabilities: ['projects.read', 'workspaces.read', 'cast.read', 'cast.write', 'workspaces.write'], timezone: 'Africa/Cairo',
      enabled_modules: ['casting'], upload_policy: { maximum_file_bytes: 5242880, recommended_batch_size: 200, allowed_mime_types: [], available_purposes: [] } });
    if (supplied.p_candidate_id === 'foreign') return Response.json({ code: 'P0001', message: 'RESOURCE_NOT_FOUND' }, { status: 400 });
    if (deny) return Response.json({ code: 'P0001', message: 'CAPABILITY_REQUIRED' }, { status: 400 });
    if (name === 'eps_get_candidate_media') return Response.json(rows);
    if (name === 'eps_find_candidate_duplicates') return Response.json(duplicates);
    writes.push({ name, input: supplied, headers: new Headers(init?.headers) });
    assert.equal(typeof supplied.p_idempotency_key, 'string');
    if (name === 'eps_update_candidate') return Response.json({ ...candidate, facts: { ...facts, name: 'Supplied name' }, row_version: 2 });
    if (name === 'eps_update_candidate_frames') return Response.json({ ...media('media-a'), row_version: 2 });
    if (name === 'eps_update_workspace_candidate') return Response.json({ ...pool, availability: 'Friday', row_version: 2 });
    throw new Error('Unexpected controlled RPC');
  };
  const sdk = createBearerUserClient({ url: 'https://synthetic-m07-candidate.example.invalid', publishableKey: 'sb_publishable_synthetic', accessToken: 'synthetic-user-token' }, { fetch: fetcher });
  const service = await createCentralCandidates(sdk);
  const studio = await createCentralStudio(sdk);
  return { service, studio, writes, reorder() { rows.reverse(); duplicates.reverse(); }, insert() { rows.push(media('media-d')); },
    remove(id: string) { rows = rows.filter(row => row.id !== id); },
    expand(count: number) { rows = Array.from({ length: count }, (_, index) => media(`media-${String(index).padStart(3, '0')}`)); },
    duplicateIds() { rows.push(rows[0]); duplicates.push(duplicates[0]); }, deny() { deny = true; } };
}

test('central candidate pages are ordered, bounded and stable across RPC ordering and later additions', async () => {
  const state = await fixture();
  const first = await state.service.getCandidateMedia(actor, candidateId, { limit: 2 });
  assert.deepEqual(first.data.map(row => row.id), ['media-a', 'media-b']);
  assert.equal(typeof first.page.next_cursor, 'string');
  state.reorder(); state.insert(); state.remove('media-b');
  const second = await state.service.getCandidateMedia(actor, candidateId, { limit: 2, cursor: first.page.next_cursor! });
  assert.deepEqual(second.data.map(row => row.id), ['media-c', 'media-d']);
  assert.equal(second.page.next_cursor, null);
  assert.equal((await state.service.getCandidateMedia(actor, candidateId, { limit: 1 })).data.length, 1);
  const matches = await state.service.findCandidateDuplicates(actor, candidateId, { limit: 2 });
  assert.deepEqual(matches.data.map(row => row.candidate_id), ['duplicate-a', 'duplicate-b']);
  const final = await state.service.findCandidateDuplicates(actor, candidateId, { limit: 2, cursor: matches.page.next_cursor! });
  assert.deepEqual(final.data.map(row => row.candidate_id), ['duplicate-c']);
  assert.equal(final.page.next_cursor, null);
});

test('central candidate list defaults to25 and supports100 without silently treating a whole RPC array as one page', async () => {
  const state = await fixture(); state.expand(102);
  const initial = await state.service.getCandidateMedia(actor, candidateId);
  assert.equal(initial.data.length, 25); assert.notEqual(initial.page.next_cursor, null);
  const largest = await state.service.getCandidateMedia(actor, candidateId, { limit: 100 });
  assert.equal(largest.data.length, 100);
  const last = await state.service.getCandidateMedia(actor, candidateId, { limit: 100, cursor: largest.page.next_cursor! });
  assert.equal(last.data.length, 2); assert.equal(last.page.next_cursor, null);
});

test('central candidate lists refuse duplicate identities from either existing RPC response', async () => {
  const state = await fixture(); state.duplicateIds();
  await assert.rejects(state.service.getCandidateMedia(actor, candidateId), hasCode('CENTRAL_RESPONSE_INVALID'));
  await assert.rejects(state.service.findCandidateDuplicates(actor, candidateId), hasCode('CENTRAL_RESPONSE_INVALID'));
});

test('central candidate cursors reject malformed, cross-operation and cross-candidate input and recheck permissions', async () => {
  const state = await fixture();
  const first = await state.service.getCandidateMedia(actor, candidateId, { limit: 1 });
  for (const cursor of ['not a cursor', '', 'a'.repeat(2001), Buffer.from('{}').toString('base64url')]) {
    await assert.rejects(state.service.getCandidateMedia(actor, candidateId, { cursor }), hasCode('INVALID_REQUEST'));
  }
  await assert.rejects(state.service.findCandidateDuplicates(actor, candidateId, { cursor: first.page.next_cursor! }), hasCode('INVALID_REQUEST'));
  await assert.rejects(state.service.getCandidateMedia(actor, 'another', { cursor: first.page.next_cursor! }), hasCode('INVALID_REQUEST'));
  await assert.rejects(state.service.getCandidateMedia({ principal_id: 'forged' }, candidateId, { cursor: first.page.next_cursor! }), hasCode('ACCESS_DENIED'));
  for (const limit of [0, 101, 1.5]) await assert.rejects(state.service.getCandidateMedia(actor, candidateId, { limit }), hasCode('INVALID_REQUEST'));
  await assert.rejects(state.service.getCandidateMedia(actor, 'foreign'), hasCode('RESOURCE_NOT_FOUND'));
  state.deny();
  await assert.rejects(state.service.getCandidateMedia(actor, candidateId, { cursor: first.page.next_cursor! }), hasCode('CAPABILITY_REQUIRED'));
});

test('HTTP candidate media and duplicates return the published page envelope through the actual central parser', async () => {
  const { service } = await fixture();
  for (const suffix of ['media', 'duplicates']) {
    const segments = ['candidates', candidateId, suffix];
    const path = `http://127.0.0.1/api/v1/${segments.join('/')}`;
    const response = await handleCandidatesRequest(new Request(`${path}?limit=2`), segments, actor, service as CandidatesOperations, { requestId: 'http-page', clientType: 'api' });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(Object.keys(body).sort(), ['data', 'page', 'request_id']);
    assert.equal(body.data.length, 2);
    assert.equal(typeof body.page.next_cursor, 'string');
    assert.match(response.headers.get('cache-control')!, /no-store/u);
    const next = await handleCandidatesRequest(new Request(`${path}?cursor=${body.page.next_cursor}&limit=2`), segments, actor, service as CandidatesOperations, { requestId: 'http-next' });
    assert.equal((await next.json()).page.next_cursor, null);
    for (const query of ['?limit=2&limit=3', '?principal_id=forged', '?cursor=not-a-cursor']) {
      await assert.rejects(handleCandidatesRequest(new Request(path + query), segments, actor, service as CandidatesOperations, { requestId: 'bad' }), DomainError);
    }
  }
});

test('official MCP client can perform all three candidate updates with stable intent through real central adapters', async () => {
  const state = await fixture();
  const server = createStudioMcpServer(actor, { candidates: state.service, studio: state.studio } as unknown as McpServices);
  const client = new Client({ name: 'eps-m07-candidate-boundary', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport); await client.connect(clientTransport);
  try {
    const tools = (await client.listTools()).tools;
    const cases = [
      { name: 'update_candidate', arguments: { candidate_id: candidateId, body: { row_version: 1, facts: { ...facts, name: 'Supplied name' } }, idempotency_key: 'synthetic-candidate-update' } },
      { name: 'update_candidate_frames', arguments: { candidate_media_id: 'media-a', body: { row_version: 1, selected_frame_asset_ids: [] }, idempotency_key: 'synthetic-frame-update' } },
      { name: 'update_workspace_candidate', arguments: { workspace_candidate_id: pool.id, body: { row_version: 1, availability: 'Friday' }, idempotency_key: 'synthetic-project-update' } },
    ];
    type Schema = Parameters<AjvJsonSchemaValidator['getValidator']>[0];
    const validator = new AjvJsonSchemaValidator();
    for (const operation of cases) {
      const tool = tools.find(tool => tool.name === operation.name)!;
      assert.equal(validator.getValidator(tool.inputSchema as Schema)(operation.arguments).valid, true);
      const result = await client.callTool(operation);
      assert.equal(result.isError, undefined);
      assert.equal(validator.getValidator(tool.outputSchema as Schema)(result.structuredContent).valid, true);
      assert.equal((result.structuredContent as { data: { row_version: number } }).data.row_version, 2);
      const { idempotency_key: _key, ...withoutKey } = operation.arguments; void _key;
      assert.equal(validator.getValidator(tool.inputSchema as Schema)(withoutKey).valid, false);
      assert.equal((await client.callTool({ name: operation.name, arguments: withoutKey })).isError, true);
    }
    assert.equal(state.writes.length, 3);
    assert.deepEqual(state.writes.map(write => write.input.p_idempotency_key), cases.map(operation => operation.arguments.idempotency_key));
    assert.ok(state.writes.every(write => write.headers.get('X-EPS-Client-Type') === 'mcp'));
  } finally { await client.close(); await server.close(); }
});

test('official MCP candidate listing results match their advertised schemas and preserve denial errors', async () => {
  const state = await fixture();
  const server = createStudioMcpServer(actor, { candidates: state.service, studio: state.studio } as unknown as McpServices);
  const client = new Client({ name: 'eps-m07-candidate-list', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport); await client.connect(clientTransport);
  try {
    const tools = (await client.listTools()).tools;
    type Schema = Parameters<AjvJsonSchemaValidator['getValidator']>[0];
    const validator = new AjvJsonSchemaValidator();
    for (const name of ['get_candidate_media', 'list_duplicate_matches']) {
      const result = await client.callTool({ name, arguments: { candidate_id: candidateId, limit: 2 } });
      assert.equal(result.isError, undefined);
      assert.equal(validator.getValidator(tools.find(tool => tool.name === name)!.outputSchema as Schema)(result.structuredContent).valid, true);
      const content = result.structuredContent as { data: unknown[]; page: { next_cursor: string | null } };
      assert.equal(content.data.length, 2);
      const next = await client.callTool({ name, arguments: { candidate_id: candidateId, limit: 2, cursor: content.page.next_cursor } });
      assert.equal((next.structuredContent as typeof content).data.length, 1);
    }
    state.deny();
    const denied = await client.callTool({ name: 'get_candidate_media', arguments: { candidate_id: candidateId } });
    assert.equal(denied.isError, true);
    assert.equal((denied.structuredContent as { error: { code: string } }).error.code, 'CAPABILITY_REQUIRED');
  } finally { await client.close(); await server.close(); }
});
