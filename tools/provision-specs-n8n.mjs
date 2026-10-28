/** Dedicated WF01 credential bootstrap. Management keys and credential data
 * stay in memory/private files. Unknown POST outcomes are never retried. */
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { loadWorkerPrivateEnvironment } from './worker-private-env.mjs';
import { buildSpecsWf01, validateSpecsWf01 } from './build-specs-wf01.mjs';
const root = path.resolve(import.meta.dirname, '..');
const privatePath = path.join(root, '.local/specs-runtime/n8n-bootstrap.json');
const config = await loadWorkerPrivateEnvironment();
const mode = process.argv[2];
let phase = 'initial'; const observations = [];
if (process.argv.length !== 3 || !['inspect', 'credential', 'draft', 'update', 'publish', 'probe', 'runtime-config'].includes(mode)) throw new Error('FIXED_OPERATION_REQUIRED');
async function request(route, method = 'GET', body) {
  try {
    const response = await fetch(config.N8N_BASE_URL + '/api/v1' + route, { method, redirect: 'error',
      signal: AbortSignal.timeout(15_000), headers: { 'X-N8N-API-KEY': config.N8N_API_KEY, Accept: 'application/json', 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}) });
    const reader = response.body?.getReader(); if (!reader) throw new Error();
    const chunks = []; let bytes = 0;
    try {
      for (;;) {
        const part = await reader.read(); if (part.done) break;
        bytes += part.value.byteLength;
        if (bytes > 1_048_576) { await reader.cancel(); throw new Error(); }
        chunks.push(part.value);
      }
    } finally { reader.releaseLock(); }
    observations.push({ operation: route.split('?')[0], method, http_status: response.status, bytes });
    const text = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
    return { status: response.status, value: JSON.parse(text) };
  } catch { throw new Error('N8N_OPERATION_UNCONFIRMED'); }
}
async function receipt(report) {
  const directory = path.join(root, 'tracking/evidence/m02/n8n-wf01'); await mkdir(directory, { recursive: true });
  const result = { observed_at: new Date().toISOString(), ...report };
  await writeFile(path.join(directory, `${result.observed_at.replace(/[:.]/gu, '-')}-${randomUUID().slice(0, 8)}-${mode}.json`), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify(result));
}
try {
  if (['draft', 'update', 'publish', 'probe', 'runtime-config'].includes(mode)) {
    phase = 'load_credential_reference';
    const state = JSON.parse(await readFile(privatePath, 'utf8'));
    if (state.status !== 'created' || state.credential_id !== 'DgZ83IpyrbinQ9gW') throw new Error();
    const expected = buildSpecsWf01(); validateSpecsWf01(expected);
    const journalPath = path.join(root, '.local/specs-runtime/wf01-release.json');
    if (mode === 'draft') {
      phase = 'list_collisions';
      // Verify name/path collision absence across the existing collection.
      let cursor; let pages = 0;
      do {
        const page = await request('/workflows?limit=10' + (cursor ? '&cursor=' + encodeURIComponent(cursor) : ''));
        if (page.status !== 200 || !Array.isArray(page.value?.data) || ++pages > 100
          || page.value.data.some(item => item.name === expected.name || item.nodes?.some(node => node.parameters?.path === 'eps-wf01-specs-stage-v1'))) throw new Error();
        cursor = page.value.nextCursor;
      } while (cursor);
      const journal = { observed_at: new Date().toISOString(), status: 'dispatching', workflow_name: expected.name };
      phase = 'create_journal';
      await writeFile(journalPath, JSON.stringify(journal), { flag: 'wx', mode: 0o600 });
      const created = await request('/workflows', 'POST', expected);
      if (created.status !== 200 || typeof created.value?.id !== 'string') {
        journal.status = 'unconfirmed'; await writeFile(journalPath, JSON.stringify(journal));
        await receipt({ result: 'unconfirmed', create_http_status: created.status, automatic_retry: false }); process.exitCode = 1;
      } else {
        journal.status = 'draft'; journal.workflow_id = created.value.id;
        await writeFile(journalPath, JSON.stringify(journal));
        const readback = await request('/workflows/' + encodeURIComponent(journal.workflow_id));
        validateSpecsWf01(readback.value);
        if (readback.status !== 200 || readback.value.active !== false) throw new Error();
        await receipt({ result: 'passed', create_http_status: 200, readback_http_status: 200, workflow_id: journal.workflow_id,
          active: false, graph_verified: true, credential_reference_verified: true, execution_payload_retention: 'none', unrelated_workflows_modified: false });
      }
    } else {
      const journal = JSON.parse(await readFile(journalPath, 'utf8'));
      if (!/^[A-Za-z0-9_-]{1,100}$/u.test(journal.workflow_id) || !['draft', 'published'].includes(journal.status)) throw new Error();
      const before = await request('/workflows/' + journal.workflow_id);
      if (mode === 'update') {
        if (before.status !== 200 || before.value.name !== expected.name || before.value.nodes?.[0]?.credentials?.httpHeaderAuth?.id !== state.credential_id) throw new Error();
        journal.status = 'updating'; await writeFile(journalPath, JSON.stringify(journal));
        const response = await request('/workflows/' + journal.workflow_id, 'PUT', expected);
        const after = await request('/workflows/' + journal.workflow_id); validateSpecsWf01(after.value);
        if (response.status !== 200 || after.status !== 200) throw new Error();
        // Publish the edited version explicitly; updating an active workflow is
        // not evidence that the new graph is serving.
        const published = await request('/workflows/' + journal.workflow_id + '/activate', 'POST', { versionId: after.value.versionId });
        const final = await request('/workflows/' + journal.workflow_id); validateSpecsWf01(final.value);
        if (published.status !== 200 || final.value.active !== true) throw new Error();
        journal.status = 'published'; await writeFile(journalPath, JSON.stringify(journal));
        await receipt({ result: 'passed', workflow_id: journal.workflow_id, update_http_status: response.status,
          publish_http_status: published.status, readback_http_status: final.status, active: true, graph_verified: true });
      } else {
      validateSpecsWf01(before.value);
      if (mode === 'runtime-config') {
        if (before.status !== 200 || before.value.active !== true || journal.status !== 'published') throw new Error();
        state.dispatch_url = config.N8N_BASE_URL + '/webhook/eps-wf01-specs-stage-v1';
        await writeFile(privatePath, JSON.stringify(state), { mode: 0o600 });
        await receipt({ result: 'passed', workflow_id: journal.workflow_id, active: true, readback_http_status: 200,
          private_runtime_endpoint_prepared: true, credentials_changed: false, workflows_changed: false });
      } else if (mode === 'publish') {
        if (before.status !== 200 || before.value.active !== false || journal.status !== 'draft') throw new Error();
        journal.status = 'publishing'; await writeFile(journalPath, JSON.stringify(journal));
        const response = await request('/workflows/' + journal.workflow_id + '/activate', 'POST', {});
        const after = await request('/workflows/' + journal.workflow_id); validateSpecsWf01(after.value);
        if (response.status !== 200 || after.status !== 200 || after.value.active !== true) throw new Error();
        journal.status = 'published'; await writeFile(journalPath, JSON.stringify(journal));
        await receipt({ result: 'passed', workflow_id: journal.workflow_id, active: true, publish_http_status: response.status,
          readback_http_status: after.status, graph_verified: true, public_worker_listener: false, hosting_deferred: true });
      } else {
        if (before.status !== 200 || before.value.active !== true) throw new Error();
        const scopes = ['prepare_document', 'extract_specs', 'apply_specs']; const observations = [];
        const url = config.N8N_BASE_URL + '/webhook/eps-wf01-specs-stage-v1';
        for (const stage of scopes) {
          const envelope = { event_id: randomUUID(), event_type: 'job.stage_ready', contract_version: '1.0', job_id: randomUUID(),
            kind: 'specs_extract', stage, input_hash: 'a'.repeat(64), correlation_id: 'wf01-contract-probe-' + randomUUID() };
          const result = await fetch(url, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15_000),
            headers: { Authorization: 'Bearer ' + state.secret, 'Content-Type': 'application/json' }, body: JSON.stringify(envelope) });
          const value = await result.json(); const expectedHandler = { prepare_document: 'native.prepare_document', extract_specs: 'openai.extract_specs', apply_specs: 'domain.apply_specs' }[stage];
          if (result.status !== 200 || Object.keys(value).length !== 9 || value.schema_version !== '1.0' || value.kind !== 'specs_extract'
            || value.event_id !== envelope.event_id || value.job_id !== envelope.job_id
            || value.stage !== stage || value.input_hash !== envelope.input_hash || value.correlation_id !== envelope.correlation_id
            || value.handler !== expectedHandler || !/^[0-9]+$/u.test(value.workflow_execution_id)) throw new Error();
          observations.push({ stage, http_status: result.status, execution_id: value.workflow_execution_id, bound_response: true });
        }
        const unauthorized = await fetch(url, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15_000), headers: { 'Content-Type': 'application/json' }, body: '{}' });
        await unauthorized.body?.cancel();
        const invalid = await fetch(url, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15_000),
          headers: { Authorization: 'Bearer ' + state.secret, 'Content-Type': 'application/json' }, body: '{}' });
        const invalidBody = await invalid.json();
        if (![401, 403].includes(unauthorized.status) || invalid.status !== 400 || invalidBody.error?.code !== 'DISPATCH_ENVELOPE_INVALID') throw new Error();
        const malformed = await fetch(url, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15_000),
          headers: { Authorization: 'Bearer ' + state.secret, 'Content-Type': 'application/json' },
          body: JSON.stringify({ event_id: randomUUID(), event_type: 'job.stage_ready', contract_version: '1.0', job_id: randomUUID(),
            kind: 'specs_extract', stage: { toString: 'invalid', valueOf: 'invalid' }, input_hash: 'a'.repeat(64), correlation_id: 'malformed-stage-probe' }) });
        const malformedBody = await malformed.json();
        if (malformed.status !== 400 || malformedBody.error?.code !== 'DISPATCH_ENVELOPE_INVALID') throw new Error();
        await receipt({ result: 'passed', workflow_id: journal.workflow_id, stages: observations, unauthorized_http_status: unauthorized.status,
          invalid_envelope_http_status: invalid.status, malformed_stage_http_status: malformed.status,
          database_work_claimed: false, provider_invoked: false, real_workflow_executions: true });
      }
      }
    }
  } else {
  const schema = await request('/credentials/schema/httpHeaderAuth');
  if (schema.status !== 200 || schema.value?.properties?.name?.type !== 'string' || schema.value?.properties?.value?.type !== 'string') {
    await receipt({ result: 'blocked', schema_http_status: schema.status, reason: 'HEADER_SCHEMA_UNCONFIRMED', credentials_modified: false });
    process.exitCode = 1;
  } else if (mode === 'inspect') await receipt({ result: 'passed', schema_http_status: 200, credential_schema: schema.value, credentials_modified: false });
  else {
    await mkdir(path.dirname(privatePath), { recursive: true });
    // wx prevents a second credential creation after any success or unknown response.
    const state = { secret: randomBytes(48).toString('base64url'), credential_name: 'Everyone Presentation Studio WF01 local dispatch', status: 'prepared' };
    await writeFile(privatePath, JSON.stringify(state), { flag: 'wx', mode: 0o600 });
    state.status = 'dispatching'; await writeFile(privatePath, JSON.stringify(state), { mode: 0o600 });
    const created = await request('/credentials', 'POST', { name: state.credential_name, type: 'httpHeaderAuth',
      data: { name: 'Authorization', value: 'Bearer ' + state.secret } });
    const id = created.value?.id;
    if (created.status !== 200 || typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/u.test(id)) {
      state.status = 'unconfirmed'; await writeFile(privatePath, JSON.stringify(state), { mode: 0o600 });
      await receipt({ result: 'unconfirmed', credential_http_status: created.status, credentials_modified: 'unknown', automatic_retry: false }); process.exitCode = 1;
    } else {
      state.status = 'created'; state.credential_id = id;
      await writeFile(privatePath, JSON.stringify(state), { mode: 0o600 });
      await receipt({ result: 'passed', credential_http_status: 200, credential: { id, name: state.credential_name }, credentials_modified: true,
        unrelated_credentials_modified: false, secret_recorded: false });
    }
  }
  }
} catch {
  await receipt({ result: 'unconfirmed', code: 'N8N_OPERATION_UNCONFIRMED', phase, observations, automatic_retry: false }); process.exitCode = 1;
}
