/** Independent disabled evaluation. Never invokes a consumed evaluation or a job retry. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, readFile, realpath, writeFile } from 'node:fs/promises';
import { findPackageJSON } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { IntegrationError } from '../../../packages/integrations/src/errors.ts';
import { openAISpecsConfigFromEnv, type OpenAISpecsConfig } from '../../../packages/integrations/src/openai-specs.ts';
import type { SpecsExtractionInput, SpecsExtractionOutput } from '../../../packages/integrations/src/specs-types.ts';
import { captureProductionRequest, validateProductionResponse, sendExtendedRequest, SETTINGS, type Capture, type Exchange } from './transport.mts';

export const EVALUATION_ENABLED = false;
const MAIN = 'D:/Everyone/Presentation/Everyone-Presentation-Studio';
const ROOT = path.resolve(import.meta.dirname, '../../..');
const UUID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/u;
export const PRODUCTION_PINS = {
  'packages/integrations/src/openai-specs.ts': 'aa72bb5a46a91142a07968b80bcd49b0361cd51fc091cc543b5c2a874f84bdb9',
  'packages/integrations/src/errors.ts': 'ac02c36b535879e439752eeda0518c2d84389a16af97175d004f8fa7c61d4da2',
  'packages/integrations/src/specs-schema.ts': '389c36f8cca115f46390024170071851e8a974befdde19476771a20cbc63569c',
  'packages/integrations/src/prompts/specs-v1.ts': '719e7e9225cc2f939df279ff2b8bfc325f68ce0b03d30d4f3ef7ede2820e7033',
  'contracts/json-schema/specs-extraction.schema.json': 'c55e758da1b71119a3a8d7cc408340e502088c8ab88a89c81da7effb85a8809d',
} as const;
const SDK_PINS = {
  'node_modules/openai/package.json': 'fd91cc6cd6191ffcffdecd6e8b9db5598451ef4b383b7c871e6a913c1af8f470',
  'node_modules/openai/index.mjs': '17cdb2c28d43e69bad6688cbefcf206674d15efaff37481923eef2991a239e11',
  'node_modules/openai/client.mjs': '65b8e9b0a52f5b855d239f3edb75710019d1cceaeac8da1e5cba122762e86ba2',
  'node_modules/openai/core/error.mjs': 'f9af78fa51cabb0128ebdd820259ba93a38d405434e698381b9dbc5b7ca55174',
  'node_modules/openai/core/api-promise.mjs': 'edb8be5b07bc29b303f6ca13f35c97a21a014f8ff16be02ce38466d38a65c559',
  'node_modules/openai/resources/responses/responses.mjs': '4fc59d6476d8c6320bda0bf056779c79b765acd8535628c00612f99b5431058a',
  'tools/worker-private-env.mjs': 'ef935580876c9150b8150947c3796dd4760d1ad2910bc3bf322dd5015eea4d79',
};
type Prepared = { schema_version: string; job_id: string; source_asset_id: string; configured_model: string;
  prepared_source_verified: boolean; prepared_text_bytes: number; mapped_pages: number; input: SpecsExtractionInput };
export interface Ports {
  read(): Promise<Prepared>; config(): OpenAISpecsConfig; seals(): Promise<Record<string, string>>;
  claim(value: unknown): Promise<void>; receipt(phase: string, value: unknown): Promise<void>;
  send(capture: Capture, config: OpenAISpecsConfig): Promise<Exchange>;
  persistResponse(value: Exchange): Promise<void>; persist(output: SpecsExtractionOutput): Promise<void>;
}
const safeCodes = new Set(['OPENAI_TIMEOUT', 'OPENAI_UNAVAILABLE', 'OPENAI_ACCESS_DENIED', 'OPENAI_RATE_LIMITED',
  'OPENAI_REQUEST_REJECTED', 'PROCESSING_CANCELLED', 'AI_REFUSAL', 'AI_RESULT_INVALID', 'AI_EVIDENCE_INVALID',
  'AI_EVIDENCE_MISSING', 'AI_SOURCE_MISMATCH', 'AI_ROLE_KEYS_INVALID', 'AI_RESPONSE_INVALID', 'AI_RESPONSE_INCOMPLETE',
  'AI_RESPONSE_NOT_COMPLETE', 'AI_OUTPUT_UNEXPECTED', 'EVALUATION_REQUEST_DRIFT']);
const requestId = (value: unknown) => typeof value === 'string' && /^req_[A-Za-z0-9_-]{1,128}$/u.test(value) ? value : null;
const httpStatus = (value: unknown) => typeof value === 'number' && Number.isInteger(value) && value >= 100 && value <= 599 ? value : null;

/** Injection is for synthetic ordering checks. The live caller supplies only the fixed, pinned Root loader. */
export async function loadVerifiedConfiguration(verify: () => Promise<void>, load: () => Promise<unknown>) {
  await verify(); // No loader import/invocation or credential read is allowed before this check.
  const loaded = await load(); assert(loaded && typeof loaded === 'object' && !Array.isArray(loaded));
  const values = loaded as Record<string, unknown>;
  assert(typeof values.OPENAI_API_KEY === 'string' && typeof values.OPENAI_EXTRACTION_MODEL === 'string');
  return openAISpecsConfigFromEnv({ OPENAI_API_KEY: values.OPENAI_API_KEY, OPENAI_EXTRACTION_MODEL: values.OPENAI_EXTRACTION_MODEL });
}

export async function evaluateOnce(run: string, ports: Ports) {
  assert(UUID.test(run)); const prepared = await ports.read();
  assert.equal(prepared.schema_version, 'pdf47-extended-input.v1');
  assert.equal(prepared.job_id, '47f86513-8999-4946-b5d9-f2fd6a18fd00');
  assert.equal(prepared.source_asset_id, '0fbc905f-c51e-472d-9d03-74664ee9ac86');
  assert.equal(prepared.input.sourceAssetId, prepared.source_asset_id);
  assert.equal(prepared.configured_model, SETTINGS.model); assert.equal(prepared.prepared_source_verified, true);
  assert.equal(prepared.prepared_text_bytes, 12_807); assert.equal(prepared.mapped_pages, 24); assert.equal(prepared.input.paragraphs.length, 219);
  const config = ports.config(); assert.equal(config.model, SETTINGS.model);
  const seals = await ports.seals();
  for (const [file, expected] of Object.entries(PRODUCTION_PINS)) assert.equal(seals[file], expected);
  const capture = await captureProductionRequest(prepared.input, config);
  const base = { schema_version: '1.0', purpose: 'one_retained_pdf47_extended_deadline_evaluation', run_id: run,
    job_id: prepared.job_id, source_asset_id: prepared.source_asset_id, input_sha256: prepared.input.inputHash,
    request_sha256: capture.sha256, settings: SETTINGS, source_seals: seals,
    request_capture: 'production_extractSpecs_injected_transport_sentinel_no_sdk',
    response_validation: 'production_extractSpecs_immediate_response_transport_exact_request_bytes',
    whole_production_function_acceptance: false, production_acceptance: false, job_outbox_or_writeback: false };
  await ports.claim(base); // Exclusive and permanent, even after unknown transport or custody outcomes.
  await ports.receipt('dispatch-started', { ...base, result: 'dispatch_started', provider_requests_initiated: 0 });
  const began = Date.now(); let phase = 'transport', exchange: Exchange | undefined, result: Record<string, unknown>;
  try {
    exchange = await ports.send(capture, config); phase = 'private_response_custody';
    await ports.persistResponse(exchange); phase = 'production_response_validation';
    assert.deepEqual(await ports.seals(), seals);
    const output = await validateProductionResponse(prepared.input, config, capture, exchange.response);
    phase = 'private_validated_output_custody'; await ports.persist(output);
    result = { ...base, result: 'validated', provider_requests_initiated: 1, duration_ms: Date.now() - began,
      http_status: httpStatus(exchange.http_status), provider_request_id: requestId(exchange.provider_request_id),
      metadata: { ...output.metadata, request_id: requestId(output.metadata.request_id),
        response_id: /^resp_[A-Za-z0-9_-]{1,128}$/u.test(output.metadata.response_id) ? output.metadata.response_id : null,
        resolved_model: output.metadata.resolved_model === SETTINGS.model ? SETTINGS.model : null },
      resolved_model_matches_requested: output.metadata.resolved_model === SETTINGS.model,
      request_semantic_bytes_equal: true, production_schema_and_evidence_validation: true,
      reasoning_token_count_observed: false, role_count: output.result.roles.length,
      evidence_count: output.result.roles.reduce((n, role) => n + role.evidence.length, 0),
      clarification_count: output.result.clarifications.length + output.result.roles.reduce((n, role) => n + role.clarifications.length, 0),
      factual_quality_evaluated: false, automatic_retry: false };
  } catch (error) {
    result = { ...base, result: 'failed_or_unknown', phase, provider_requests_initiated: 1, duration_ms: Date.now() - began,
      code: error instanceof IntegrationError && safeCodes.has(error.code) ? error.code : 'EVALUATION_OUTCOME_UNCONFIRMED',
      http_status: httpStatus(exchange?.http_status ?? (error instanceof IntegrationError ? error.details.http_status : null)),
      provider_request_id: requestId(exchange?.provider_request_id ?? (error instanceof IntegrationError ? error.details.request_id : null)),
      automatic_retry: false, charge_or_remote_completion_unknown: true, provider_response_observed: exchange !== undefined,
      validated_output_acceptance: false, reasoning_token_count_observed: false };
  }
  // A receipt failure propagates; it never triggers a second write or provider call.
  await ports.receipt('result', result); return result;
}

async function bridge(run: string, operation: string, value?: unknown): Promise<unknown> {
  assert(EVALUATION_ENABLED && ROOT.toLowerCase() === path.resolve(MAIN).toLowerCase());
  const env = Object.fromEntries(['SystemRoot', 'WINDIR', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'HOMEDRIVE', 'HOMEPATH', 'TEMP', 'TMP', 'PATH', 'LANG']
    .filter(name => process.env[name] !== undefined).map(name => [name, process.env[name]!]));
  const input = JSON.stringify({ run, operation, value }); assert(Buffer.byteLength(input) <= 6 * 1024 * 1024);
  return new Promise((resolve, reject) => {
    const child = spawn(path.join(MAIN, '.venv-skills/Scripts/python.exe'), ['-X', 'utf8', '-B', path.join(import.meta.dirname, 'private_bridge.py')],
      { cwd: MAIN, env, shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let bytes = 0, errorBytes = 0; const chunks: Buffer[] = [];
    const timer = setTimeout(() => { child.kill(); reject(Error('EXTENDED_PRIVATE_BRIDGE_UNCONFIRMED')); }, 65_000);
    child.on('error', () => { clearTimeout(timer); reject(Error('EXTENDED_PRIVATE_BRIDGE_UNCONFIRMED')); });
    child.stdout.on('data', (chunk: Buffer) => { bytes += chunk.length; if (bytes > 512 * 1024) child.kill(); else chunks.push(chunk); });
    child.stderr.on('data', (chunk: Buffer) => { errorBytes += chunk.length; if (errorBytes > 65536) child.kill(); });
    child.once('close', code => {
      clearTimeout(timer);
      try { assert.equal(code, 0); assert(bytes <= 512 * 1024 && errorBytes <= 65536);
        const result = JSON.parse(Buffer.concat(chunks).toString('utf8')); assert.equal(result.ok, true); resolve(result.value);
      } catch { reject(Error('EXTENDED_PRIVATE_BRIDGE_UNCONFIRMED')); }
    });
    child.stdin.on('error', () => {}); child.stdin.end(input);
  });
}

async function main() {
  assert(EVALUATION_ENABLED, 'PDF47_EXTENDED_EVALUATION_DISABLED');
  const [operation, run, ...extra] = process.argv.slice(2); assert(!extra.length && UUID.test(run) && ['prepare', 'evaluate'].includes(operation));
  assert(ROOT.toLowerCase() === path.resolve(MAIN).toLowerCase());
  if (operation === 'prepare') { await bridge(run, 'prepare'); process.stdout.write('{"result":"prepared_privately","provider_requests":0}\n'); return; }
  const folder = path.join(MAIN, 'tracking/evidence/m07/pdf47-extended-deadline-evaluation');
  const info = await lstat(folder); assert(info.isDirectory() && !info.isSymbolicLink());
  const loader = path.join(ROOT, 'tools/worker-private-env.mjs');
  const config = await loadVerifiedConfiguration(async () => {
    const stat = await lstat(loader); assert(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1);
    assert.equal(await realpath(loader), loader);
    assert.equal(createHash('sha256').update(await readFile(loader)).digest('hex'), SDK_PINS['tools/worker-private-env.mjs']);
  }, async () => {
    const { loadWorkerPrivateEnvironment } = await import(pathToFileURL(loader).href);
    return await loadWorkerPrivateEnvironment({ environment: {} });
  });
  const ports: Ports = {
    read: async () => await bridge(run, 'read') as Prepared, config: () => config,
    seals: async () => {
      const pkg = path.join(ROOT, 'node_modules/openai/package.json');
      assert.equal(findPackageJSON('openai', pathToFileURL(path.join(ROOT, 'packages/integrations/src/openai-specs.ts'))), pkg);
      assert.equal(import.meta.resolve('openai'), pathToFileURL(path.join(ROOT, 'node_modules/openai/index.mjs')).href);
      assert.equal(await realpath(pkg), pkg); assert.equal(JSON.parse(await readFile(pkg, 'utf8')).version, '7.45.1');
      const paths = [...Object.keys(PRODUCTION_PINS), ...Object.keys(SDK_PINS), 'package-lock.json',
        ...['evaluate.mts', 'transport.mts', 'private_bridge.py'].map(file => 'development/m07/pdf47-extended-deadline-evaluation/' + file)];
      const seals: Record<string, string> = {};
      for (const file of paths) {
        const target = path.join(ROOT, file), stat = await lstat(target); assert(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1);
        seals[file] = createHash('sha256').update(await readFile(target)).digest('hex');
      }
      for (const [file, expected] of Object.entries({ ...PRODUCTION_PINS, ...SDK_PINS })) assert.equal(seals[file], expected);
      return seals;
    },
    claim: async value => { await bridge(run, 'claim', value); },
    receipt: async (phase, value) => { assert(['dispatch-started', 'result'].includes(phase));
      await writeFile(path.join(folder, run + '-' + phase + '.json'), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' }); },
    send: (capture, configured) => sendExtendedRequest(capture, configured, globalThis.fetch),
    persistResponse: async value => { await bridge(run, 'persist_response', value); },
    persist: async output => { await bridge(run, 'persist', output); },
  };
  const result = await evaluateOnce(run, ports);
  process.stdout.write(JSON.stringify({ run_id: run, result: result.result, provider_requests_initiated: 1, writeback: false }) + '\n');
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) main().catch(() => {
  process.stderr.write('PDF47_EXTENDED_EVALUATION_REFUSED; private inputs and errors withheld.\n'); process.exitCode = 1;
});
