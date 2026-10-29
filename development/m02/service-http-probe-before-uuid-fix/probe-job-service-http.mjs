/** Real local ServiceBearer HTTP probe. No provider/workflow/SQL/Auth-token API.
 * Root creates the fixed isolated job and stops the worker before phase1.
 * Phase1/phase2 deliberately bracket a root-owned web-process restart.
 */
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdir, lstat, readFile, realpath, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { loadPrivateJobServiceEnvironment } from './private-job-service-env.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIRECTORY = path.join(ROOT, '.local/m02-service-http-probe');
const INTENT = path.join(DIRECTORY, 'intent.json');
const STATE = path.join(DIRECTORY, 'encrypted-state.json');
const BASE = 'http://127.0.0.1:3000/api/v1/internal/jobs/';
const PROTECTED_JOB = 'b3f90268-147d-41d4-8875-2a6435df1496';
const PROTECTED_WORKSPACE = '098d5b48-42a3-475b-b562-735c9eafce80';
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u;
const HASH = /^[a-f0-9]{64}$/u;
const exact = (value, fields) => Boolean(value) && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === fields.length && fields.every(key => Object.hasOwn(value, key));
const sha = value => createHash('sha256').update(value).digest('hex');
export function validateProbeIntent(value, now = Date.now()) {
  assert(exact(value, ['schema_version', 'job_id', 'workspace_id', 'stage', 'input_hash', 'approved_at']));
  assert.equal(value.schema_version, '1.0'); assert(UUID.test(value.job_id) && value.job_id !== PROTECTED_JOB);
  assert(UUID.test(value.workspace_id) && value.workspace_id !== PROTECTED_WORKSPACE);
  assert.equal(value.stage, 'prepare_document'); assert(HASH.test(value.input_hash));
  const age = now - Date.parse(value.approved_at); assert(Number.isFinite(age) && age >= 0 && age <= 3600000);
  return globalThis.structuredClone(value);
}
export function encryptProbeState(value, key) {
  assert(HASH.test(key)); const nonce = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), nonce);
  cipher.setAAD(Buffer.from('eps-service-http-probe-state.v1'));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return { version: 'eps-service-http-probe-state.v1', nonce: nonce.toString('base64url'), tag: cipher.getAuthTag().toString('base64url'), ciphertext: encrypted.toString('base64url') };
}
export function decryptProbeState(value, key) {
  assert(exact(value, ['version', 'nonce', 'tag', 'ciphertext']) && value.version === 'eps-service-http-probe-state.v1'); assert(HASH.test(key));
  const decipher = createDecipheriv('aes-256-gcm', Buffer.from(key, 'hex'), Buffer.from(value.nonce, 'base64url'));
  decipher.setAAD(Buffer.from(value.version)); decipher.setAuthTag(Buffer.from(value.tag, 'base64url'));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(value.ciphertext, 'base64url')), decipher.final()]).toString('utf8'));
}
async function privateJson(file, maximum) {
  const info = await lstat(file); assert(info.isFile() && !info.isSymbolicLink() && info.size > 0 && info.size <= maximum);
  assert.equal(path.resolve(await realpath(file)).toLowerCase(), file.toLowerCase());
  return JSON.parse(await readFile(file, 'utf8'));
}
function lease(value, intent) {
  assert(exact(value, ['job_id', 'stage', 'attempt_id', 'lease_token', 'lease_expires_at', 'already_completed', 'input']));
  assert.equal(value.job_id, intent.job_id); assert.equal(value.stage, intent.stage); assert(UUID.test(value.attempt_id));
  assert(typeof value.lease_token === 'string' && /^[a-f0-9]{64}$/u.test(value.lease_token));
  assert.equal(value.already_completed, false); assert(Date.parse(value.lease_expires_at) > Date.now());
  assert(value.input && typeof value.input === 'object' && value.input.input_hash === intent.input_hash);
  return value;
}
async function request(operation, body, key, bearer) {
  assert(['claim', 'events', 'fail'].includes(operation)); assert(/^[A-Za-z0-9._:-]{16,200}$/u.test(key));
  const response = await globalThis.fetch(BASE + operation, { method: 'POST', redirect: 'error', signal: globalThis.AbortSignal.timeout(15000),
    headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify(body) });
  const text = await response.text(); assert(Buffer.byteLength(text, 'utf8') <= 393216);
  const value = JSON.parse(text); assert(value && typeof value === 'object' && typeof value.request_id === 'string');
  return { status: response.status, value };
}
async function save(state, key, first = false) {
  const bytes = JSON.stringify(encryptProbeState(state, key)) + '\n';
  if (first) await writeFile(STATE, bytes, { flag: 'wx', mode: 0o600 });
  else { const temp = path.join(DIRECTORY, randomUUID() + '.tmp'); await writeFile(temp, bytes, { flag: 'wx', mode: 0o600 }); await rename(temp, STATE); }
}
async function receipt(action, state, checks, result = 'passed') {
  const now = new Date().toISOString(); const directory = path.join(ROOT, 'tracking/evidence/m02/service-http-probe'); await mkdir(directory, { recursive: true });
  const value = { observed_at: now, action, result, probe_id: state.probe_id, job_id: state.intent.job_id, workspace_id: state.intent.workspace_id,
    stage: state.intent.stage, input_hash: state.intent.input_hash, attempt_id: state.lease?.attempt_id ?? null,
    lease_expires_at: state.lease?.lease_expires_at ?? null, checks, dedicated_service_bearer: true, browser_or_user_token_loaded: false,
    provider_called: false, n8n_called: false, database_called_directly: false, protected_job_touched: false,
    raw_lease_storage: 'Encrypted in ignored .local/m02-service-http-probe/encrypted-state.json only' };
  const file = path.join(directory, `${now.replace(/[:.]/gu, '-')}-${state.probe_id.slice(0, 8)}-${action}.json`);
  await writeFile(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
  process.stdout.write(JSON.stringify({ result, action, receipt: path.relative(ROOT, file).replaceAll('\\', '/'), job_id: state.intent.job_id, attempt_id: value.attempt_id }) + '\n');
}
async function main() {
  const action = process.argv[2]; assert.equal(process.argv.length, 3); assert(['prepare', 'phase1', 'phase2', 'fail'].includes(action));
  const config = await loadPrivateJobServiceEnvironment(); const key = config.EPS_JOB_CLAIM_KEY_HEX; const bearer = config.EPS_JOB_SERVICE_BEARER;
  const intent = validateProbeIntent(await privateJson(INTENT, 4096));
  if (action === 'prepare') {
    await mkdir(DIRECTORY, { recursive: true });
    const probe_id = randomUUID(); const state = { probe_id, intent, intent_sha256: sha(JSON.stringify(intent)), phase: 'prepared',
      claim_key: `service-http-${probe_id}`, heartbeat_id: `service-heartbeat-${probe_id}`, failure_id: `service-failure-${probe_id}` };
    await save(state, key, true); await receipt(action, state, { fixed_isolated_job_validated: true, state_encrypted: true }); return;
  }
  const state = decryptProbeState(await privateJson(STATE, 1024 * 1024), key);
  assert.equal(state.intent_sha256, sha(JSON.stringify(intent))); assert.deepEqual(state.intent, intent);
  const claim = { job_id: intent.job_id, stage: intent.stage, input_hash: intent.input_hash };
  if (action === 'phase1') {
    assert.equal(state.phase, 'prepared'); const checks = {};
    try {
      const wrongBearer = (bearer[0] === 'A' ? 'B' : 'A') + bearer.slice(1);
      const denied = await request('claim', claim, state.claim_key, wrongBearer); assert.equal(denied.status, 401); assert.equal(denied.value.error?.code, 'AUTH_REQUIRED'); checks.wrong_service_bearer_denied = true;
      const first = await request('claim', claim, state.claim_key, bearer); assert.equal(first.status, 200); state.lease = lease(first.value.data, intent); await save(state, key);
      const replay = await request('claim', claim, state.claim_key, bearer); assert.equal(replay.status, 200); assert(isDeepStrictEqual(replay.value.data, state.lease)); checks.same_key_exact_lease_replay = true;
      const changed = await request('claim', { ...claim, workflow_execution_id: 'changed-http-probe-payload' }, state.claim_key, bearer); assert.equal(changed.status, 409); assert.equal(changed.value.error?.code, 'IDEMPOTENCY_KEY_REUSED'); checks.same_key_changed_payload_denied = true;
      const heartbeat = { ...claim, attempt_id: state.lease.attempt_id, lease_token: state.lease.lease_token, sequence: 1, event_type: 'heartbeat', event_id: state.heartbeat_id };
      const bad = await request('events', { ...heartbeat, event_id: `wrong-lease-${state.probe_id}`, lease_token: '0'.repeat(64) }, `wrong-lease-${state.probe_id}`, bearer);
      assert([403, 409].includes(bad.status) && ['LEASE_INVALID', 'STALE_STAGE_LEASE'].includes(bad.value.error?.code)); checks.wrong_lease_denied = true;
      const wrongScope = await request('events', { ...heartbeat, event_id: `wrong-job-${state.probe_id}`, job_id: randomUUID() }, `wrong-job-${state.probe_id}`, bearer);
      assert.equal(wrongScope.status, 404); assert.equal(wrongScope.value.error?.code, 'RESOURCE_NOT_FOUND'); checks.different_nonexistent_job_denied = true;
      const beat = await request('events', heartbeat, heartbeat.event_id, bearer); assert.equal(beat.status, 200); assert.equal(beat.value.data.applied, true); assert.equal(beat.value.data.duplicate, false);
      const duplicate = await request('events', heartbeat, heartbeat.event_id, bearer); assert.equal(duplicate.status, 200); assert.equal(duplicate.value.data.duplicate, true); checks.heartbeat_duplicate_applied_once = true;
      state.phase = 'phase1'; state.phase1_at = new Date().toISOString(); await save(state, key); await receipt(action, state, checks);
    } catch { state.phase = 'phase1_unconfirmed'; await save(state, key); await receipt(action, state, checks, 'unconfirmed'); process.exitCode = 1; }
  } else if (action === 'phase2') {
    assert.equal(state.phase, 'phase1'); assert(Date.parse(state.lease.lease_expires_at) - Date.now() > 3000);
    const replay = await request('claim', claim, state.claim_key, bearer); assert.equal(replay.status, 200); assert(isDeepStrictEqual(replay.value.data, state.lease));
    state.phase = 'phase2'; state.phase2_at = new Date().toISOString(); await save(state, key); await receipt(action, state, { same_key_exact_lease_replay_after_root_restart: true, restart_is_root_observation: true });
  } else {
    assert(['phase1', 'phase2'].includes(state.phase) && state.lease); assert(Date.parse(state.lease.lease_expires_at) - Date.now() > 3000);
    const failure = { ...claim, attempt_id: state.lease.attempt_id, lease_token: state.lease.lease_token, sequence: 2, event_type: 'failed', event_id: state.failure_id,
      error: { code: 'DEPENDENCY_UNAVAILABLE', message: 'Deliberate recoverable local HTTP acceptance test.', details: {}, retryable: true } };
    const response = await request('fail', failure, failure.event_id, bearer); assert.equal(response.status, 200); assert.equal(response.value.data.applied, true);
    state.phase = 'failed_for_recovery'; await save(state, key); await receipt(action, state, { retryable_failure_published: true, observed_job_status: response.value.data.job_status });
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main().catch(() => {
  process.stderr.write('Fixed local service HTTP probe stopped. No private response or credential was printed. Preserve encrypted state for scoped inspection.\n'); process.exitCode = 1;
});
