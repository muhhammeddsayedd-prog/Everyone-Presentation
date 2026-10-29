import assert from 'node:assert/strict';
import test from 'node:test';
import { provisionReviewN8n } from '../../tools/provision-review-n8n.mjs';
import { buildReviewWf05, mapReviewStageEnvelope } from '../../tools/build-review-wf05.mjs';
import { buildSpecsWf01 } from '../../tools/build-specs-wf01.mjs';
const secret = 'a'.repeat(64); const credential = { id: 'synthetic-credential', name: 'Everyone Presentation Studio WF05 local dispatch' };
const config = { N8N_BASE_URL: 'https://synthetic.app.n8n.cloud', N8N_API_KEY: 'synthetic-management-private-key' };
test('node metadata401 can reuse only the exact active live-tested WF01 contracts, with the gap reported',async()=>{
 const state=fixture();const send=state.dependencies.request;
 state.dependencies.inspect=async()=>{throw {inspection:{settings_http_status:200,types_http_status:401}};};
 state.dependencies.request=async(...args)=>args[1]==='/workflows/Nu4bvU634yTLnRy1'?{status:200,value:{...buildSpecsWf01(),active:true}}:send(...args);
 const result=await provisionReviewN8n('inspect',state.dependencies);assert.equal(result.result,'passed');assert.deepEqual(result.metadata_http_statuses,[200,401,200]);assert.match(result.contract_source,/unavailable/u);assert.equal(state.posts(),0);
 const denied=fixture();denied.dependencies.inspect=async()=>{throw {inspection:{settings_http_status:200,types_http_status:403}};};
 assert.equal((await provisionReviewN8n('inspect',denied.dependencies)).result,'unconfirmed');assert.equal(denied.posts(),0);
});
function fixture() {
  let journal; let workflow; let posts = 0; let exports = 0; const claims = new Set();
  const dependencies = { loadConfig: async () => config, loadReview: async () => ({ N8N_REVIEW_DISPATCH_URL: config.N8N_BASE_URL + '/webhook/eps-wf05-review-suggestion-stage-v1', N8N_REVIEW_DISPATCH_SECRET: secret }),
    readJournal: async () => journal ? globalThis.structuredClone(journal) : null, saveJournal: async value => { journal = globalThis.structuredClone(value); },
    claimAction: async mode => { if (claims.has(mode)) throw new Error('Claim exists'); claims.add(mode); }, writeExport: async () => { exports++; },
    inspect: async () => ({ observed_at: new Date().toISOString(), instance_version: '2.44.6', settings_http_status: 200, types_http_status: 200, node_types: [{ name: 'n8n-nodes-base.webhook', version: [2.1] }, { name: 'n8n-nodes-base.set', version: [3.4] }, { name: 'n8n-nodes-base.respondToWebhook', version: [1.4] }] }),
    request: async (_config, route, method = 'GET', body) => {
      if (method === 'POST') posts++;
      if (route === '/credentials/schema/httpHeaderAuth') return { status: 200, value: { properties: { name: { type: 'string' }, value: { type: 'string' } } } };
      if (route === '/credentials') { assert.equal(body.data.value, `Bearer ${secret}`); return { status: 200, value: { ...credential, type: 'httpHeaderAuth' } }; }
      if (route.startsWith('/workflows?')) return { status: 200, value: { data: [], nextCursor: null } };
      if (route === '/workflows') { workflow = { ...body, id: 'synthetic-workflow', versionId: 'synthetic-version', active: false }; return { status: 200, value: { id: workflow.id } }; }
      if (route.endsWith('/activate')) { assert.deepEqual(body, { versionId: 'synthetic-version' }); workflow.active = true; workflow.activeVersionId = workflow.versionId; return { status: 200, value: { id: workflow.id } }; }
      if (route === '/workflows/synthetic-workflow') return { status: 200, value: globalThis.structuredClone(workflow) };
      throw new Error('Unexpected route');
    }, webhookFetch: async (_url, options) => { const authorized = options.headers.Authorization === `Bearer ${secret}`; if (!authorized) return new globalThis.Response(null, { status: 401 }); const result = mapReviewStageEnvelope(JSON.parse(options.body), 'synthetic-execution'); return globalThis.Response.json(result.body, { status: result.status }); },
  };
  return { dependencies, journal: () => journal, posts: () => posts, exports: () => exports };
}
test('explicit five-action bootstrap uses credential references and private fenced journal only', async () => {
  const state = fixture();
  for (const mode of ['inspect', 'credential', 'draft', 'publish', 'probe']) {
    const report = await provisionReviewN8n(mode, state.dependencies); assert.equal(report.result, 'passed', `${mode}:${report.code}`);
    assert.equal(JSON.stringify(report).includes(secret), false); assert.equal(JSON.stringify(report).includes(config.N8N_API_KEY), false);
  }
  assert.equal(state.posts(), 3); assert.equal(state.exports(), 1); assert.equal(state.journal().status, 'published'); assert.equal(JSON.stringify(state.journal()).includes(secret), false);
});
test('unknown credential POST has no automatic retry or second bootstrap', async () => {
  const state = fixture(); await provisionReviewN8n('inspect', state.dependencies); const send = state.dependencies.request;
  state.dependencies.request = async (...args) => { if (args[1] === '/credentials') { await send(...args); throw new Error('private upstream error'); } return send(...args); };
  const first = await provisionReviewN8n('credential', state.dependencies); assert.equal(first.result, 'unconfirmed'); assert.equal(first.automatic_retry, false); assert.equal(state.posts(), 1);
  const second = await provisionReviewN8n('credential', state.dependencies); assert.equal(second.result, 'unconfirmed'); assert.equal(state.posts(), 1); assert.equal(state.journal().status, 'credential_unconfirmed');
});
test('foreign path collision or graph mutation prevents creation/publication', async () => {
  const state = fixture(); await provisionReviewN8n('inspect', state.dependencies); await provisionReviewN8n('credential', state.dependencies); const send = state.dependencies.request;
  state.dependencies.request = async (...args) => args[1].startsWith('/workflows?') ? { status: 200, value: { data: [{ id: 'unrelated-workflow', name: 'Other', nodes: [{ parameters: { path: 'eps-wf05-review-suggestion-stage-v1' } }] }] } } : send(...args);
  const collision = await provisionReviewN8n('draft', state.dependencies); assert.equal(collision.code, 'WF05_WORKFLOW_COLLISION'); assert.equal(state.posts(), 1);
  const graph = fixture(); await provisionReviewN8n('inspect', graph.dependencies); await provisionReviewN8n('credential', graph.dependencies); await provisionReviewN8n('draft', graph.dependencies); const read = graph.dependencies.request;
  graph.dependencies.request = async (...args) => { const value = await read(...args); if (args[1] === '/workflows/synthetic-workflow') value.value.connections = {}; return value; };
  const publish = await provisionReviewN8n('publish', graph.dependencies); assert.equal(publish.result, 'unconfirmed'); assert.equal(graph.posts(), 2);
});
test('bootstrap cannot create an uninspected credential or use unsupported current node versions', async () => {
  const state = fixture(); assert.equal((await provisionReviewN8n('credential', state.dependencies)).code, 'WF05_INSPECTION_REQUIRED'); assert.equal(state.posts(), 0);
  state.dependencies.inspect = async () => ({ node_types: [{ name: 'n8n-nodes-base.webhook', version: [1] }] });
  assert.equal((await provisionReviewN8n('inspect', state.dependencies)).result, 'unconfirmed'); assert.equal(state.journal(), undefined);
  assert.deepEqual(buildReviewWf05(credential).nodes[0].credentials.httpHeaderAuth, credential);
});
