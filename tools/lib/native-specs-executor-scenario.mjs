/** Deterministic LOCAL acceptance composition. This invokes the real native
 * parser and strict extraction adapter, with a synthetic provider transport.
 * It never discovers credentials, contacts a provider or provisions services.
 */
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { tsImport } from 'tsx/esm/api';
import { nativeSpecsTransportFailure } from './native-specs-local-transport.mjs';

const STAGES = ['prepare_document', 'extract_specs', 'apply_specs'];
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u;
const HASH = /^[a-f0-9]{64}$/u;
const MODEL = 'synthetic-native-acceptance-model';
let runtime;
const sha = value => createHash('sha256').update(value, 'utf8').digest('hex');
export class NativeSpecsScenarioError extends Error {
  constructor(code, safeTransportFailure = null) { super('The synthetic native scenario could not be confirmed.'); this.name = 'NativeSpecsScenarioError'; this.code = code; this.safeTransportFailure = safeTransportFailure; }
}
function fail(code, safeTransportFailure) { throw new NativeSpecsScenarioError(code, safeTransportFailure); }
function requireValue(value, code) { if (!value) fail(code); }
async function modules() {
  runtime ??= Promise.all([
    tsImport('../../apps/worker/src/specs-executor.ts', import.meta.url),
    tsImport('../../apps/worker/src/pasted-text.ts', import.meta.url),
    tsImport('../../packages/integrations/src/index.ts', import.meta.url),
  ]);
  const [worker, parser, integrations] = await runtime;
  return { worker, parser, integrations };
}
function syntheticResult(paragraphs) {
  const first = paragraphs[0];
  requireValue(first && typeof first.text === 'string' && first.text.trim(), 'NATIVE_SYNTHETIC_EVIDENCE_MISSING');
  return { schema_version: '1.0', source_asset_id: null, source_language_codes: ['en', 'ar'],
    general_instructions: 'Synthetic normalized instructions', clarifications: [], roles: [{
      source_role_key: 'native-synthetic-role', name: null, headcount: null, category: null,
      requirements: { age_range: null, gender_requirement: null, appearance_performance: null, languages: [], accents: [],
        skills: [], scene_references: [], shoot_dates: [], location: null, availability_requirements: null, other_instructions: null },
      evidence: [{ asset_id: null, page: first.page, paragraph: first.index, segment_index: null, start_ms: null, end_ms: null,
        quote: Array.from(first.text.trim()).slice(0, 32).join('') }], clarifications: [],
    }] };
}

/** Gateway capability is supplied by the fixed local transport; this function
 * contains no target/SQL mechanism. Hooks are fixed fixture state injections,
 * not product cancellation/source APIs. Results contain only safe metadata.
 */
export async function executeNativeSpecsFixture(fixture, transport, hooks = {}) {
  requireValue(fixture && UUID.test(fixture.job_id) && HASH.test(fixture.input_hash), 'NATIVE_FIXTURE_SCOPE_INVALID');
  const outcome = fixture.outcome ?? 'succeeded';
  requireValue(['succeeded', 'cancelled', 'source_changed'].includes(outcome), 'NATIVE_FIXTURE_SCOPE_INVALID');
  const { worker, parser, integrations } = await modules();
  let original; let expected; let preparedProjectionHash; let adapterCalls = 0; let injected = false;
  let lastEvent; let lastReceipt; let transportFailure = null; const stages = [];
  const gateway = {
    async getInput(scope, signal) {
      let input;
      try { input = await transport.getInput(scope, signal); }
      catch (error) { transportFailure = nativeSpecsTransportFailure(error); throw error; }
      requireValue(input && input.job_id === fixture.job_id, 'NATIVE_STAGE_INPUT_SCOPE_MISMATCH');
      if (input.stage === 'prepare_document') {
        requireValue(typeof input.source_text === 'string' && sha(input.source_text) === input.source_sha256, 'NATIVE_ORIGINAL_HASH_MISMATCH');
        original = input.source_text; expected = parser.preparePastedText(original);
        requireValue(expected.sourceSha256 === input.source_sha256, 'NATIVE_ORIGINAL_HASH_MISMATCH');
      } else if (input.stage === 'extract_specs') {
        requireValue(expected && original !== undefined && input.text === expected.text
          && isDeepStrictEqual(input.paragraphs, expected.paragraphs) && input.source_sha256 === sha(original), 'NATIVE_SQL_JS_PARAGRAPH_MISMATCH');
        const projection = { source_asset_id: null, paragraphs: expected.paragraphs.map(({ index, page, text }) => ({ index, page, text })) };
        preparedProjectionHash = sha(JSON.stringify(projection));
      }
      return input;
    },
    async recordEvent(event, signal) {
      requireValue(event.job_id === fixture.job_id, 'NATIVE_EVENT_SCOPE_MISMATCH');
      if (event.stage === 'extract_specs' && event.event_type === 'succeeded') {
        requireValue(event.result?.metadata?.prepared_source_sha256 === preparedProjectionHash, 'NATIVE_PREPARED_PROJECTION_HASH_MISMATCH');
      }
      if (event.stage === 'apply_specs' && event.event_type === 'succeeded' && hooks.beforeApplyEvent && !injected) {
        injected = true; await hooks.beforeApplyEvent(Object.freeze({ job_id: event.job_id, attempt_id: event.attempt_id, lease_token: event.lease_token }));
      }
      let receipt;
      try { receipt = await transport.recordEvent(event, signal); }
      catch (error) { transportFailure = nativeSpecsTransportFailure(error); throw error; }
      if (event.event_type !== 'heartbeat') { lastEvent = globalThis.structuredClone(event); lastReceipt = globalThis.structuredClone(receipt); }
      return receipt;
    },
  };
  const extract = async (input, configuration, _unused, signal) => {
    adapterCalls++;
    return await integrations.extractSpecs(input, configuration, async (request, providerSignal) => {
      requireValue(!providerSignal?.aborted && request.model === MODEL && request.store === false
        && isDeepStrictEqual(request.tools, []) && request.text?.format?.strict === true, 'NATIVE_STRICT_PROVIDER_REQUEST_MISMATCH');
      const result = syntheticResult(input.paragraphs);
      return { id: 'resp_native_synthetic', _request_id: 'req_native_synthetic', model: MODEL, status: 'completed', error: null,
        output: [{ type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: JSON.stringify(result) }] }],
        usage: { input_tokens: 24, output_tokens: 48, total_tokens: 72 } };
    }, signal);
  };
  for (const stage of STAGES) {
    if (hooks.onStage) hooks.onStage(stage);
    const lease = stage === 'prepare_document' && hooks.initialLease ? hooks.initialLease
      : await transport.claim({ job_id: fixture.job_id, stage, input_hash: fixture.input_hash });
    requireValue(lease.job_id === fixture.job_id && lease.stage === stage && lease.already_completed === false
      && lease.input?.configuration?.model_version === MODEL, 'NATIVE_ACTUAL_LEASE_MISMATCH');
    lastEvent = undefined; lastReceipt = undefined;
    let execution;
    try {
      execution = await worker.executeSpecsStage(lease, gateway, {
        // This intentionally noncredential value never reaches a real SDK client.
        openAI: { apiKey: 'synthetic-native-provider-transport-only', model: MODEL, timeoutMs: 5000 }, extract,
      });
    } catch (error) {
      if (stage === 'apply_specs' && outcome === 'cancelled' && error instanceof worker.SpecsExecutionError
        && error.code === 'LEASE_STALE' && injected && lastReceipt?.stale === true) {
        stages.push({ stage, cancelled_callback_stale: true });
        return { job_id: fixture.job_id, outcome, stages, adapter_calls: adapterCalls,
          sql_js_paragraph_mapping: true, prepared_projection_hash_matches: true, provider_transport: 'synthetic-only' };
      }
      // Do not propagate inspected errors, original source, event or lease data.
      // The original exception may contain private parser/transport context.
      // Keep only a separately allowlisted transport classification.
      fail('NATIVE_REAL_EXECUTOR_UNCONFIRMED', transportFailure);
    }
    requireValue(execution.already_completed === false && execution.receipt?.applied === true && lastEvent,
      'NATIVE_STAGE_COMMIT_NOT_CONFIRMED');
    const expectedStatus = stage === 'apply_specs' ? outcome === 'source_changed' ? 'waiting_for_input' : 'succeeded' : 'queued';
    requireValue(execution.receipt.job_status === expectedStatus, 'NATIVE_DURABLE_STAGE_STATUS_MISMATCH');
    const duplicate = await transport.recordEvent(lastEvent, globalThis.AbortSignal.timeout(12000));
    requireValue(duplicate.applied === false && duplicate.duplicate === true, 'NATIVE_EXACT_CALLBACK_REPLAY_MISMATCH');
    stages.push({ stage, committed_status: expectedStatus, exact_callback_duplicate: true });
    if (hooks.afterStage) await hooks.afterStage(stage);
  }
  requireValue(adapterCalls === 1 && expected && preparedProjectionHash, 'NATIVE_ADAPTER_EXECUTION_MISMATCH');
  if (outcome === 'succeeded') {
    const completed = await transport.claim({ job_id: fixture.job_id, stage: 'apply_specs', input_hash: fixture.input_hash });
    requireValue(completed.already_completed === true, 'NATIVE_COMPLETED_CLAIM_MISMATCH');
    const replay = await worker.executeSpecsStage(completed, gateway);
    requireValue(replay.already_completed === true && replay.receipt === null, 'NATIVE_COMPLETED_EXECUTOR_REPLAY_MISMATCH');
  }
  return { job_id: fixture.job_id, outcome, stages, adapter_calls: adapterCalls,
    sql_js_paragraph_mapping: true, prepared_projection_hash_matches: true, provider_transport: 'synthetic-only' };
}

export const NATIVE_SPECS_SYNTHETIC_MODEL = MODEL;
