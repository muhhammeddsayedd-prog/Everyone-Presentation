import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { tsImport } from 'tsx/esm/api';
import { executeNativeSpecsFixture, NATIVE_SPECS_SYNTHETIC_MODEL } from '../../tools/lib/native-specs-executor-scenario.mjs';

// Fake gateway only. These tests execute the real isolated parser and strict
// extraction adapter, and deliberately make NO SQL or actual provider claim.
const original = '\ufeffSynthetic actor 😀\r\n  continued\r\n\r\nالعمر غير محدد.';
const stages = ['prepare_document', 'extract_specs', 'apply_specs'];
const configuration = { document_preparation_version: 'document-preparation.v1', model_version: NATIVE_SPECS_SYNTHETIC_MODEL,
  prompt_version: 'spec_extract_v1.0.0', result_schema_version: '1.0' };
const sha = value => createHash('sha256').update(value, 'utf8').digest('hex');
function fixture() {
  const scope = { job_id: '7f980000-0000-4000-8000-000000000001', input_hash: 'a'.repeat(64) };
  let position = 0; let attempt = 0; let cancelled = false; let changed = false; let providerResult; const events = new Map();
  const state = { inputReads: 0, acceptedTerminals: 0, duplicateCallbacks: 0, completedClaims: 0 };
  const gateway = {
    async claim(input) {
      assert.equal(input.job_id, scope.job_id); assert.equal(input.input_hash, scope.input_hash);
      if (position === 3) { state.completedClaims++; return { job_id: scope.job_id, stage: 'apply_specs', already_completed: true }; }
      assert.equal(input.stage, stages[position]); attempt++;
      return { job_id: scope.job_id, stage: input.stage, attempt_id: `7e980000-0000-4000-8000-${String(attempt).padStart(12, '0')}`,
        lease_token: `synthetic-token-${attempt}`, lease_expires_at: new Date(Date.now() + 90_000).toISOString(), already_completed: false,
        input: { input_hash: scope.input_hash, source_hash: sha(original), specs_id: '7d980000-0000-4000-8000-000000000001', configuration } };
    },
    async getInput(input) {
      state.inputReads++;
      const common = { job_id: scope.job_id, attempt_id: input.attempt_id, stage: stages[position], input_hash: scope.input_hash,
        correlation_id: 'synthetic-native-correlation', configuration };
      if (position === 2) return { ...common, specs_id: '7d980000-0000-4000-8000-000000000001', workspace_id: '7c980000-0000-4000-8000-000000000001', source_sha256: sha(original) };
      const base = { ...common, source_kind: 'pasted_text', source_asset_id: null, source_sha256: sha(original) };
      if (position === 0) return { ...base, source_text: original };
      const { preparePastedText } = await tsImport('../../apps/worker/src/pasted-text.ts', import.meta.url);
      const prepared = preparePastedText(original);
      return { ...base, text: prepared.text, paragraphs: prepared.paragraphs };
    },
    async recordEvent(event) {
      if (events.has(event.event_id)) { state.duplicateCallbacks++; return { ...events.get(event.event_id), applied: false, duplicate: true }; }
      const status = cancelled ? 'cancelled' : position === 2 ? changed ? 'waiting_for_input' : 'succeeded' : 'queued';
      const receipt = { event_id: event.event_id, applied: !cancelled, duplicate: false, stale: cancelled, job_status: status };
      if (cancelled) return receipt;
      assert.equal(event.event_type, 'succeeded'); state.acceptedTerminals++;
      if (position === 1) providerResult = event.result;
      position++; events.set(event.event_id, receipt); return receipt;
    },
  };
  return { scope, state, gateway, cancel: () => { cancelled = true; }, change: () => { changed = true; }, result: () => providerResult };
}

test('actual parser/strict adapter composition verifies projection and duplicate replay using a fake gateway only', async () => {
  const value = fixture();
  const summary = await executeNativeSpecsFixture(value.scope, value.gateway);
  assert.equal(summary.outcome, 'succeeded'); assert.equal(summary.adapter_calls, 1);
  assert.equal(summary.sql_js_paragraph_mapping, true); assert.equal(summary.prepared_projection_hash_matches, true);
  assert.deepEqual(value.state, { inputReads: 3, acceptedTerminals: 3, duplicateCallbacks: 3, completedClaims: 1 });
  assert.equal(value.result().result.roles[0].headcount, null);
  assert.equal(value.result().metadata.requested_model, NATIVE_SPECS_SYNTHETIC_MODEL);
  for (const privateValue of [original, 'synthetic-token', 'synthetic-native-provider-transport-only', 'resp_native_synthetic']) {
    assert.ok(!JSON.stringify(summary).includes(privateValue));
  }
});

test('cancellation after input read rejects publication without another provider request', async () => {
  const value = fixture();
  let scopedHookCalled = false;
  const summary = await executeNativeSpecsFixture({ ...value.scope, outcome: 'cancelled' }, value.gateway, { beforeApplyEvent: scope => {
    assert.deepEqual(scope, { job_id: value.scope.job_id, attempt_id: '7e980000-0000-4000-8000-000000000003', lease_token: 'synthetic-token-3' });
    assert.equal(Object.isFrozen(scope), true); scopedHookCalled = true; value.cancel();
  } });
  assert.equal(scopedHookCalled, true);
  assert.equal(summary.outcome, 'cancelled'); assert.equal(summary.adapter_calls, 1);
  assert.equal(summary.stages[2].cancelled_callback_stale, true);
  assert.equal(value.state.acceptedTerminals, 2);
});

test('a later source epoch is represented as waiting for input while exact callback replay remains safe', async () => {
  const value = fixture();
  const summary = await executeNativeSpecsFixture({ ...value.scope, outcome: 'source_changed' }, value.gateway, { beforeApplyEvent: value.change });
  assert.equal(summary.outcome, 'source_changed'); assert.equal(summary.adapter_calls, 1);
  assert.equal(summary.stages[2].committed_status, 'waiting_for_input');
  assert.equal(value.state.duplicateCallbacks, 3); assert.equal(value.state.completedClaims, 0);
});
