import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAppearanceFixture } from '../../packages/domain/src/appearance-fixture.ts';
import { invokeMcpTool, implementedMcpTools } from '../../apps/web/lib/mcp.ts';
import { handleAppearanceRequest, isAppearanceRoute } from '../../apps/web/lib/appearance-http.ts';

// local_fixture service only: synthetic people, no provider, no database. The same service object backs HTTP and MCP.
const actor = { principal_id: 'a4f00000-0000-4000-8000-0000000000aa' };
const layla = 'a4f00000-0000-4000-8000-000000000001';
const studio = { async getCapabilities() { return { principal_id: actor.principal_id, capabilities: ['cast.read', 'cast.review', 'cast.write'] }; } };
const services = (appearance = createAppearanceFixture()) => ({ studio, specs: {}, jobs: {}, candidates: {}, appearance }) as never;

test('all five appearance tools are advertised and routed before generic candidate routes', () => {
  const names = implementedMcpTools().map(tool => tool.name);
  for (const name of ['list_candidate_observations', 'review_candidate_observation', 'start_enrichment_batch', 'get_enrichment_batch', 'get_candidate_facets']) assert.ok(names.includes(name), name);
  assert.equal(isAppearanceRoute(['candidates', layla, 'observations']), true);
  assert.equal(isAppearanceRoute(['candidates', layla, 'photos']), false);
});
test('MCP list → review → facets: suggestions are not counted until confirmed; outputs validate against the catalog', async () => {
  const shared = services();
  const before = await invokeMcpTool('get_candidate_facets', { body: { facets: { glasses: ['none'] } } }, actor, shared);
  assert.equal(before.isError, undefined, JSON.stringify(before.structuredContent)); assert.equal((before.structuredContent as { data: { total: number } }).data.total, 0);
  const listed = await invokeMcpTool('list_candidate_observations', { candidate_id: layla }, actor, shared);
  const data = (listed.structuredContent as { data: { supplied: { archive: { source: { kind: string } } }; media: { ambiguous: boolean; observations: { id: string; attribute: string; status: string; row_version: number; person_index: number }[] }[] } }).data;
  assert.equal(data.supplied.archive.source.kind, 'archive_import');
  const glasses = data.media[0].observations.find(item => item.attribute === 'glasses')!;
  const reviewed = await invokeMcpTool('review_candidate_observation', { observation_id: glasses.id, idempotency_key: 'appearance-mcp-review-0001', body: { row_version: glasses.row_version, action: 'confirm' } }, actor, shared);
  assert.equal(reviewed.isError, undefined, JSON.stringify(reviewed.structuredContent)); assert.equal((reviewed.structuredContent as { data: { status: string } }).data.status, 'confirmed');
  const after = await invokeMcpTool('get_candidate_facets', { body: { facets: { glasses: ['none'] } } }, actor, shared);
  assert.equal((after.structuredContent as { data: { total: number } }).data.total, 1);
  // Ambiguous photo: confirming person 1 selects the target; person 0 then conflicts.
  const group = data.media.find(item => item.ambiguous)!;
  const one = group.observations.find(item => item.person_index === 1)!; const zero = group.observations.find(item => item.person_index === 0)!;
  await invokeMcpTool('review_candidate_observation', { observation_id: one.id, idempotency_key: 'appearance-mcp-review-0002', body: { row_version: one.row_version, action: 'confirm' } }, actor, shared);
  const conflict = await invokeMcpTool('review_candidate_observation', { observation_id: zero.id, idempotency_key: 'appearance-mcp-review-0003', body: { row_version: zero.row_version, action: 'confirm' } }, actor, shared);
  assert.equal(conflict.isError, true); assert.match(JSON.stringify(conflict.structuredContent), /TARGET_PERSON_CONFLICT/u);
});
test('HTTP and MCP share the service; invalid bodies are refused by the published schema', async () => {
  const shared = createAppearanceFixture();
  const response = await handleAppearanceRequest(new Request('http://127.0.0.1/api/v1/candidate-facets/query', { method: 'POST', body: JSON.stringify({ facets: { city: ['دبي', 'Dubai'] } }), headers: { 'Content-Type': 'application/json' } }),
    ['candidate-facets', 'query'], actor, shared, { requestId: 'r1' });
  const body = await response.json() as { data: { total: number; facets: { key: string }[] } }; assert.equal(response.status, 200); assert.equal(body.data.total, 2);
  const forbidden = await invokeMcpTool('get_candidate_facets', { body: { facets: { ethnicity: ['x'] } } }, actor, services(shared));
  assert.equal(forbidden.isError, true);
  const started = await invokeMcpTool('start_enrichment_batch', { idempotency_key: 'appearance-mcp-batch-0001', body: { workspace_id: '10000000-0000-4000-8000-000000000001', candidate_ids: [layla], limit: 1, spend_cap_cents: 10 } }, actor, services(shared));
  assert.equal(started.isError, undefined, JSON.stringify(started.structuredContent));
  const id = (started.structuredContent as { data: { id: string } }).data.id;
  const read = await invokeMcpTool('get_enrichment_batch', { batch_id: id }, actor, services(shared));
  assert.equal((read.structuredContent as { data: { items: { error_code: string }[] } }).data.items[0].error_code, 'FIXTURE_NO_PROVIDER');
});
