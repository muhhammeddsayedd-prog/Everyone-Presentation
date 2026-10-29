/** Dedicated WF02 bootstrap. No network/file access at import. The root caller
 * executes one explicit action; unknown POST outcomes never trigger a retry. */
import { Buffer } from 'node:buffer';
import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { TextDecoder } from 'node:util';
import { pathToFileURL } from 'node:url';
import { loadWorkerPrivateEnvironment } from './worker-private-env.mjs';
import { loadCandidateRuntimeEnvironment } from './candidate-runtime-env.mjs';
import { inspectN8nWorkflowMetadata, validateSpecsWf01 } from './build-specs-wf01.mjs';
import { buildCandidateWf02, mapCandidateStageEnvelope, validateCandidateWf02 } from './build-candidate-wf02.mjs';

const ROOT = path.resolve(import.meta.dirname, '..'); const DIRECTORY = path.join(ROOT, '.local/candidate-runtime');
const JOURNAL = path.join(DIRECTORY, 'n8n-bootstrap.json');
const NAME = 'Everyone Presentation Studio WF02 local dispatch';
const ROUTE = '/webhook/eps-wf02-candidate-stage-v1';
const ID = /^[A-Za-z0-9_-]{1,100}$/u; const modes = ['inspect', 'credential', 'draft', 'publish', 'probe', 'update'];
const hash = value => createHash('sha256').update(value).digest('hex');
const canonical = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);
class ProvisionError extends Error { constructor(code) { super('The dedicated candidate workflow operation could not be confirmed.'); this.code = code; } }
function fail(code) { throw new ProvisionError(code); }
async function readJournal() {
  try {
    const info = await lstat(JOURNAL); if (!info.isFile() || info.isSymbolicLink() || info.size > 8192 || (await realpath(JOURNAL)).toLowerCase() !== JOURNAL.toLowerCase()) fail('WF02_JOURNAL_INVALID');
    return JSON.parse(await readFile(JOURNAL, 'utf8'));
  } catch (error) { if (error.code === 'ENOENT') return null; fail('WF02_JOURNAL_INVALID'); }
}
async function saveJournal(value, initial = false) {
  await mkdir(DIRECTORY, { recursive: true });
  await writeFile(JOURNAL, JSON.stringify(value, null, 2) + '\n', { flag: initial ? 'wx' : 'w', mode: 0o600 });
}
async function claimAction(action) {
  if (!['credential', 'draft', 'publish'].includes(action)&&!/^update-[a-f0-9]{64}$/u.test(action)) fail('WF02_FIXED_ACTION_REQUIRED');
  await mkdir(DIRECTORY, { recursive: true });
  await writeFile(path.join(DIRECTORY, `${action}-dispatch.claim`), JSON.stringify({ action, attempted_at: new Date().toISOString(), automatic_retry: false }) + '\n', { flag: 'wx', mode: 0o600 });
}
/** Never expose arbitrary upstream error bodies. Only private code consumes the
 * bounded response; receipts contain status, byte counts and opaque IDs. */
async function http(config, route, method = 'GET', body) {
  const response = await globalThis.fetch(config.N8N_BASE_URL + '/api/v1' + route, { method, redirect: 'error', signal: globalThis.AbortSignal.timeout(15_000),
    headers: { 'X-N8N-API-KEY': config.N8N_API_KEY, Accept: 'application/json', 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return boundedJSON(response, 2 * 1024 * 1024);
}
async function boundedJSON(response, maximum) {
  const reader = response.body?.getReader(); if (!reader) fail('WF02_RESPONSE_INVALID'); const chunks = []; let size = 0;
  try { for (;;) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > maximum) { await reader.cancel(); fail('WF02_RESPONSE_INVALID'); } chunks.push(part.value); } }
  finally { reader.releaseLock(); }
  let value; try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))); } catch { fail('WF02_RESPONSE_INVALID'); }
  return { status: response.status, value, bytes: size };
}
function selectedVersions(report) {
  if (!report || !Array.isArray(report.node_types)) fail('WF02_METADATA_UNCONFIRMED');
  const expected = [['n8n-nodes-base.webhook', 2.1], ['n8n-nodes-base.set', 3.4], ['n8n-nodes-base.respondToWebhook', 1.4]];
  return expected.map(([name, version]) => {
    const found = report.node_types.some(node => node.name === name && (Array.isArray(node.version) ? node.version.includes(version) : node.version === version));
    if (!found) fail('WF02_NODE_VERSION_UNCONFIRMED'); return { name, selected_version: version };
  });
}
function checkJournal(journal, config, candidate) {
  if (!journal || journal.schema_version !== '1.0' || journal.target_origin !== config.N8N_BASE_URL
    || journal.secret_sha256 !== hash(candidate.N8N_CANDIDATE_DISPATCH_SECRET) || !modes.includes(journal.last_action)
    || typeof journal.status !== 'string' || journal.credential_id !== undefined && !ID.test(journal.credential_id)
    || journal.workflow_id !== undefined && !ID.test(journal.workflow_id)) fail('WF02_JOURNAL_INVALID');
}
/** Test seams are internal only. Product requests cannot choose destinations,
 * files, credentials, workflow IDs, graph versions or operations through them. */
export async function provisionCandidateN8n(mode, dependencies = {}) {
  if (!modes.includes(mode)) fail('WF02_FIXED_ACTION_REQUIRED');
  const load = dependencies.loadConfig ?? loadWorkerPrivateEnvironment; const loadCandidate = dependencies.loadCandidate ?? loadCandidateRuntimeEnvironment;
  const inspect = dependencies.inspect ?? inspectN8nWorkflowMetadata; const read = dependencies.readJournal ?? readJournal; const save = dependencies.saveJournal ?? saveJournal;
  const send = dependencies.request ?? http; const webhookFetch = dependencies.webhookFetch ?? globalThis.fetch;
  const claim = dependencies.claimAction ?? claimAction;
  const observations = []; let journal; let dispatched = false; let phase = 'configuration';
  const config = await load(); const candidate = await loadCandidate();
  if (!config.N8N_API_KEY || !config.N8N_BASE_URL || candidate.N8N_CANDIDATE_DISPATCH_URL !== config.N8N_BASE_URL + ROUTE || !/^[a-f0-9]{64}$/u.test(candidate.N8N_CANDIDATE_DISPATCH_SECRET ?? '')) fail('WF02_CONFIGURATION_UNAVAILABLE');
  async function request(route, operation, method = 'GET', body) {
    const response = await send(config, route, method, body);
    observations.push({ operation, method, http_status: response.status, bytes: response.bytes ?? null }); return response;
  }
  async function metadata() {
    let report;
    try { report = await inspect(config); }
    catch(error) {
      // The public node-definition endpoint now requires browser authentication.
      // Reuse exactly the already published, live-tested WF01 node contracts;
      // no new node type/version/configuration is introduced by WF02.
      if(error?.inspection?.settings_http_status!==200||error?.inspection?.types_http_status!==401)throw error;
      const known=await request('/workflows/Nu4bvU634yTLnRy1','known_wf01_contract');
      if(known.status!==200||known.value.active!==true)fail('WF02_METADATA_UNCONFIRMED');validateSpecsWf01(known.value);
      report={observed_at:new Date().toISOString(),instance_version:null,settings_http_status:200,types_http_status:401,
        node_types:known.value.nodes.map(node=>({name:node.type,version:node.typeVersion})),
        contract_source:'Published live-tested WF01 same three pinned node types; full node definitions unavailable (HTTP401).'};
    }
    const versions = selectedVersions(report);
    const schema = await request('/credentials/schema/httpHeaderAuth', 'credential_schema');
    if (schema.status !== 200 || schema.value?.properties?.name?.type !== 'string' || schema.value?.properties?.value?.type !== 'string') fail('WF02_CREDENTIAL_SCHEMA_UNCONFIRMED');
    return { observed_at: report.observed_at, instance_version: report.instance_version, node_versions: versions, node_metadata_sha256: hash(JSON.stringify(report.node_types)), credential_schema_verified: true,
      contract_source:report.contract_source??'Official live node definitions',
      metadata_http_statuses: [report.settings_http_status, report.types_http_status, schema.status] };
  }
  async function persist(status) { journal.status = status; journal.last_action = mode; journal.updated_at = new Date().toISOString(); await save(journal); }
  try {
    journal = await read(); if (journal) checkJournal(journal, config, candidate);
    if (mode === 'inspect') {
      phase = 'metadata'; const report = await metadata();
      if (!journal) { journal = { schema_version: '1.0', target_origin: config.N8N_BASE_URL, secret_sha256: hash(candidate.N8N_CANDIDATE_DISPATCH_SECRET), status: 'metadata_verified', last_action: mode, created_at: new Date().toISOString() }; await save(journal, true); }
      journal.metadata = report; await persist(journal.status);
      return { result: 'passed', action: mode, ...report, credentials_modified: false, workflows_modified: false, workflows_executed: false, observations };
    }
    if (!journal) fail('WF02_INSPECTION_REQUIRED');
    if (mode === 'credential') {
      if (journal.status !== 'metadata_verified' || journal.credential_id) fail('WF02_CREDENTIAL_ALREADY_ATTEMPTED');
      phase = 'metadata'; await metadata(); phase = 'credential_create'; await claim(mode); await persist('credential_dispatching'); dispatched = true;
      const response = await request('/credentials', 'credential_create', 'POST', { name: NAME, type: 'httpHeaderAuth', data: { name: 'Authorization', value: `Bearer ${candidate.N8N_CANDIDATE_DISPATCH_SECRET}` } });
      if (![200, 201].includes(response.status) || !ID.test(response.value?.id ?? '') || response.value.name !== undefined && response.value.name !== NAME || response.value.type !== undefined && response.value.type !== 'httpHeaderAuth') fail('WF02_CREDENTIAL_CREATE_UNCONFIRMED');
      journal.credential_id = response.value.id; await persist('credential_created'); dispatched = false;
      return { result: 'passed', action: mode, credential: { id: journal.credential_id, name: NAME }, credentials_modified: true, unrelated_credentials_modified: false, secret_recorded: false, automatic_retry: false, observations };
    }
    if (!journal.credential_id) fail('WF02_CREDENTIAL_REFERENCE_REQUIRED');
    const credential = { id: journal.credential_id, name: NAME }; const graph = buildCandidateWf02(credential); validateCandidateWf02(graph, credential);
    if (mode === 'draft') {
      if (journal.status !== 'credential_created' || journal.workflow_id) fail('WF02_WORKFLOW_ALREADY_ATTEMPTED');
      phase = 'metadata'; await metadata(); phase = 'collision_discovery'; let cursor; let pages = 0; let total = 0;
      do {
        const page = await request('/workflows?limit=10' + (cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''), 'workflow_list');
        if (page.status !== 200 || !Array.isArray(page.value?.data) || ++pages > 20) fail('WF02_COLLISION_DISCOVERY_UNCONFIRMED');
        for (const item of page.value.data) {
          if (!ID.test(item.id ?? '') || ++total > 200 || item.name === graph.name || item.nodes?.some(node => node.parameters?.path === ROUTE.slice('/webhook/'.length))) fail('WF02_WORKFLOW_COLLISION');
          if (!Array.isArray(item.nodes)) { const detail = await request('/workflows/' + encodeURIComponent(item.id), 'workflow_collision_read'); if (detail.status !== 200 || !Array.isArray(detail.value?.nodes)) fail('WF02_COLLISION_DISCOVERY_UNCONFIRMED'); if (detail.value.nodes.some(node => node.parameters?.path === ROUTE.slice('/webhook/'.length))) fail('WF02_WORKFLOW_COLLISION'); }
        }
        cursor = page.value.nextCursor; if (cursor !== undefined && cursor !== null && (typeof cursor !== 'string' || cursor.length > 4096)) fail('WF02_COLLISION_DISCOVERY_UNCONFIRMED');
      } while (cursor);
      phase = 'workflow_create'; await claim(mode); await persist('workflow_dispatching'); dispatched = true;
      const created = await request('/workflows', 'workflow_create', 'POST', graph);
      if (![200, 201].includes(created.status) || !ID.test(created.value?.id ?? '')) fail('WF02_WORKFLOW_CREATE_UNCONFIRMED');
      journal.workflow_id = created.value.id; await persist('draft_readback_pending');
      const saved = await request('/workflows/' + encodeURIComponent(journal.workflow_id), 'workflow_readback'); validateCandidateWf02(saved.value, credential);
      if (saved.status !== 200 || saved.value.active !== false || !ID.test(saved.value.versionId ?? '')) fail('WF02_DRAFT_READBACK_UNCONFIRMED');
      journal.version_id = saved.value.versionId; journal.graph_sha256 = hash(JSON.stringify(graph)); await persist('draft'); dispatched = false;
      if (dependencies.writeExport) await dependencies.writeExport(graph); else { await mkdir(path.join(ROOT, 'n8n'), { recursive: true }); await writeFile(path.join(ROOT, 'n8n/eps-wf02-candidate-stage.json'), JSON.stringify(graph, null, 2) + '\n'); }
      return { result: 'passed', action: mode, workflow_id: journal.workflow_id, active: false, graph_verified: true, credential_reference_verified: true, execution_payload_retention: 'none', unrelated_workflows_modified: false, automatic_retry: false, observations };
    }
    if (!journal.workflow_id || !['draft', 'published'].includes(journal.status)) fail('WF02_WORKFLOW_STATE_UNCONFIRMED');
    if(mode==='update') {
      if(journal.status!=='published')fail('WF02_KNOWN_PUBLISHED_VERSION_REQUIRED');
      const prior=JSON.parse(await readFile(path.join(ROOT,'n8n/eps-wf02-candidate-stage.json'),'utf8'));
      if(hash(JSON.stringify(prior))!==journal.graph_sha256)fail('WF02_PRIOR_EXPORT_UNCONFIRMED');
      const before=await request('/workflows/'+encodeURIComponent(journal.workflow_id),'workflow_readback');
      if(before.status!==200||before.value.active!==true||before.value.versionId!==journal.version_id||before.value.name!==prior.name
       ||canonical(before.value.nodes)!==canonical(prior.nodes)||canonical(before.value.connections)!==canonical(prior.connections)
       ||Object.entries(prior.settings).some(([key,value])=>before.value.settings?.[key]!==value))fail('WF02_PRIOR_EXPORT_UNCONFIRMED');
      const nextHash=hash(JSON.stringify(graph));if(nextHash===journal.graph_sha256)fail('WF02_NO_UPDATE_REQUIRED');
      phase='metadata';await metadata();phase='workflow_update';await claim('update-'+nextHash);await persist('update_dispatching');dispatched=true;
      const changed=await request('/workflows/'+encodeURIComponent(journal.workflow_id),'workflow_update','PUT',graph);
      const saved=await request('/workflows/'+encodeURIComponent(journal.workflow_id),'workflow_readback');validateCandidateWf02(saved.value,credential);
      if(changed.status!==200||saved.status!==200||!ID.test(saved.value.versionId??''))fail('WF02_UPDATE_UNCONFIRMED');
      journal.version_id=saved.value.versionId;await persist('update_publish_pending');
      const published=await request('/workflows/'+encodeURIComponent(journal.workflow_id)+'/activate','workflow_activate','POST',{versionId:journal.version_id});
      const after=await request('/workflows/'+encodeURIComponent(journal.workflow_id),'workflow_readback');validateCandidateWf02(after.value,credential);
      if(published.status!==200||after.status!==200||after.value.active!==true||after.value.versionId!==journal.version_id||after.value.activeVersionId!==journal.version_id)fail('WF02_UPDATE_UNCONFIRMED');
      const history=path.join(ROOT,'n8n/history');await mkdir(history,{recursive:true});await writeFile(path.join(history,journal.graph_sha256+'-wf02.json'),JSON.stringify(prior,null,2)+'\n',{flag:'wx'});
      await writeFile(path.join(ROOT,'n8n/eps-wf02-candidate-stage.json'),JSON.stringify(graph,null,2)+'\n');
      journal.graph_sha256=nextHash;await persist('published');dispatched=false;
      return {result:'passed',action:mode,workflow_id:journal.workflow_id,version_id:journal.version_id,active:true,active_version_field_verified:true,graph_verified:true,execution_payload_retention:'none',unrelated_workflows_modified:false,automatic_retry:false,observations};
    }
    phase = 'workflow_readback'; const before = await request('/workflows/' + encodeURIComponent(journal.workflow_id), 'workflow_readback'); validateCandidateWf02(before.value, credential);
    if (before.status !== 200 || before.value.versionId !== journal.version_id) fail('WF02_WORKFLOW_VERSION_UNCONFIRMED');
    if (mode === 'publish') {
      if (journal.status !== 'draft' || before.value.active !== false) fail('WF02_PUBLISH_ALREADY_ATTEMPTED');
      phase = 'metadata'; await metadata(); phase = 'workflow_publish'; await claim(mode); await persist('publishing'); dispatched = true;
      const response = await request('/workflows/' + encodeURIComponent(journal.workflow_id) + '/activate', 'workflow_activate', 'POST', { versionId: journal.version_id });
      const after = await request('/workflows/' + encodeURIComponent(journal.workflow_id), 'workflow_readback'); validateCandidateWf02(after.value, credential);
      if (response.status !== 200 || after.status !== 200 || after.value.active !== true || after.value.versionId !== journal.version_id || after.value.activeVersionId !== undefined && after.value.activeVersionId !== journal.version_id) fail('WF02_PUBLISH_UNCONFIRMED');
      await persist('published'); dispatched = false;
      return { result: 'passed', action: mode, workflow_id: journal.workflow_id, version_id: journal.version_id, active: true, active_version_field_verified: after.value.activeVersionId === journal.version_id, graph_verified: true, hosting_deferred: true, public_worker_listener: false, automatic_retry: false, observations };
    }
    if (journal.status !== 'published' || before.value.active !== true) fail('WF02_PUBLISHED_WORKFLOW_REQUIRED');
    phase = 'metadata_contract_probe'; const probes = [];
    async function probe(body, authenticated = true) {
      const response = await webhookFetch(candidate.N8N_CANDIDATE_DISPATCH_URL, { method: 'POST', redirect: 'error', signal: globalThis.AbortSignal.timeout(15_000), headers: { 'Content-Type': 'application/json', ...(authenticated ? { Authorization: `Bearer ${candidate.N8N_CANDIDATE_DISPATCH_SECRET}` } : {}) }, body: JSON.stringify(body) });
      if (!authenticated) { await response.body?.cancel(); return { status: response.status }; } return boundedJSON(response, 16_384);
    }
    const stages = [...['prepare_candidate', 'transcribe_candidate', 'extract_candidate', 'select_frames', 'apply_candidate'].map(stage => ({ kind: 'candidate_scan', stage })), ...['extract_frames','apply_frames'].map(stage => ({ kind: 'frame_extract', stage }))];
    for (const { kind, stage } of stages) {
      const envelope = { event_id: randomUUID(), event_type: 'job.stage_ready', contract_version: '1.0', job_id: randomUUID(), kind, stage, input_hash: 'a'.repeat(64), correlation_id: 'wf02-contract-' + randomUUID() };
      const response = await probe(envelope); const expected = mapCandidateStageEnvelope(envelope, response.value?.workflow_execution_id);
      if (response.status !== 200 || expected.status !== 200 || canonical(response.value) !== canonical(expected.body)) fail('WF02_PROBE_UNCONFIRMED');
      probes.push({ kind, stage, http_status: response.status, execution_id: response.value.workflow_execution_id, bound_response: true });
    }
    const unauthorized = await probe({}, false); const invalid = await probe({}); const malformed = await probe({ event_id: randomUUID(), event_type: 'job.stage_ready', contract_version: '1.0', job_id: randomUUID(), kind: 'candidate_scan', stage: { toString: 'invalid', valueOf: 'invalid' }, input_hash: 'a'.repeat(64), correlation_id: 'wf02-malformed-stage' });
    if (![401, 403].includes(unauthorized.status) || invalid.status !== 400 || invalid.value?.error?.code !== 'DISPATCH_ENVELOPE_INVALID' || malformed.status !== 400 || malformed.value?.error?.code !== 'DISPATCH_ENVELOPE_INVALID') fail('WF02_PROBE_UNCONFIRMED');
    return { result: 'passed', action: mode, workflow_id: journal.workflow_id, stages: probes, unauthorized_http_status: unauthorized.status, invalid_http_status: invalid.status, malformed_stage_http_status: malformed.status,
      real_workflow_executions: true, database_work_claimed: false, provider_invoked: false, hosting_deferred: true, observations };
  } catch (error) {
    if (dispatched && journal) { try { await persist(`${mode}_unconfirmed`); } catch { /* Preserve the dispatching journal if even local persistence is unknown. */ } }
    return { result: 'unconfirmed', action: mode, phase, code: error instanceof ProvisionError ? error.code : 'N8N_OPERATION_UNCONFIRMED', automatic_retry: false,
      ...(journal?.workflow_id ? { workflow_id: journal.workflow_id } : {}), ...(journal?.credential_id ? { credential_id: journal.credential_id } : {}), observations };
  }
}
async function main() {
  if (process.argv.length !== 3 || !modes.includes(process.argv[2])) fail('WF02_FIXED_ACTION_REQUIRED');
  let report; try { report = await provisionCandidateN8n(process.argv[2]); } catch { report = { result: 'unconfirmed', action: process.argv[2], code: 'WF02_CONFIGURATION_UNAVAILABLE', automatic_retry: false }; }
  const directory = path.join(ROOT, 'tracking/evidence/m03/n8n-wf02'); await mkdir(directory, { recursive: true });
  const receipt = { observed_at: new Date().toISOString(), ...report }; const file = path.join(directory, `${receipt.observed_at.replace(/[:.]/gu, '-')}-${randomUUID().slice(0, 8)}-${process.argv[2]}.json`);
  await writeFile(file, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' }); process.stdout.write(JSON.stringify({ ...receipt, receipt: path.relative(ROOT, file).replaceAll('\\', '/') }) + '\n'); if (report.result !== 'passed') process.exitCode = 1;
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) void main();
