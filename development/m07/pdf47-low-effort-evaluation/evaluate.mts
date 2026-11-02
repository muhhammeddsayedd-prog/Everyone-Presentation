/** Disabled one-request evaluation. Imports do not read private input or credentials. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { extractSpecs, openAISpecsConfigFromEnv } from '../../../packages/integrations/src/openai-specs.ts';
import { IntegrationError } from '../../../packages/integrations/src/errors.ts';
import type { OpenAISpecsConfig } from '../../../packages/integrations/src/openai-specs.ts';
import type { SpecsExtractionInput, SpecsExtractionOutput } from '../../../packages/integrations/src/specs-types.ts';

export const EVALUATION_ENABLED = false;
const MAIN = 'D:/Everyone/Presentation/Everyone-Presentation-Studio';
const ROOT = path.resolve(import.meta.dirname, '../../..');
const UUID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/u;
export const SETTINGS = { model: 'gpt-6.1-sol', reasoning_effort: 'low', timeout_ms: 60_000, max_output_tokens: 16_384,
  sdk_retries: 0, maximum_provider_requests: 1, store: false, stream: false, tools: 0 } as const;
type Prepared = { schema_version: string; job_id: string; prepared_text_bytes: number; mapped_pages: number;
  source_asset_id: string; configured_model: string; prepared_source_verified: boolean; input: SpecsExtractionInput };
interface Ports {
  read(): Promise<Prepared>;
  config(): OpenAISpecsConfig;
  seals(): Promise<Record<string, string>>;
  claim(value: unknown): Promise<void>;
  receipt(phase: string, value: unknown): Promise<void>;
  extract(input: SpecsExtractionInput, config: OpenAISpecsConfig): Promise<SpecsExtractionOutput>;
  persist(output: SpecsExtractionOutput): Promise<void>;
}
const safeCode = new Set(['OPENAI_TIMEOUT', 'OPENAI_UNAVAILABLE', 'OPENAI_ACCESS_DENIED', 'OPENAI_QUOTA_EXCEEDED',
  'OPENAI_RATE_LIMITED', 'OPENAI_REQUEST_REJECTED', 'PROCESSING_CANCELLED', 'AI_REFUSAL', 'AI_RESULT_INVALID',
  'AI_EVIDENCE_INVALID', 'AI_EVIDENCE_MISSING', 'AI_SOURCE_MISMATCH', 'AI_ROLE_KEYS_INVALID', 'AI_RESPONSE_INVALID',
  'AI_RESPONSE_INCOMPLETE', 'AI_RESPONSE_NOT_COMPLETE', 'AI_OUTPUT_UNEXPECTED']);

export async function evaluateOnce(run: string, ports: Ports) {
  assert(UUID.test(run));
  const prepared = await ports.read();
  assert.equal(prepared.schema_version, 'pdf47-low-effort-input.v1');
  assert.equal(prepared.job_id, '47f86513-8999-4946-b5d9-f2fd6a18fd00');
  assert.equal(prepared.source_asset_id, '0fbc905f-c51e-472d-9d03-74664ee9ac86');
  assert.equal(prepared.input.sourceAssetId, prepared.source_asset_id);
  assert.equal(prepared.configured_model, SETTINGS.model);
  assert.equal(prepared.prepared_source_verified, true);
  assert.equal(prepared.prepared_text_bytes, 12_807);
  assert.equal(prepared.mapped_pages, 24);
  assert.equal(prepared.input.paragraphs.length, 219);
  assert(/^[a-f0-9]{64}$/u.test(prepared.input.inputHash));
  assert(/^[A-Za-z0-9._:-]{1,200}$/u.test(prepared.input.correlationId));
  const indexes = new Set<number>();
  for (const paragraph of prepared.input.paragraphs) {
    assert(Number.isSafeInteger(paragraph.index) && paragraph.index >= 0 && !indexes.has(paragraph.index));
    assert(paragraph.page === null || Number.isSafeInteger(paragraph.page) && paragraph.page >= 1);
    assert.equal(typeof paragraph.text, 'string'); indexes.add(paragraph.index);
  }
  const configured = ports.config();
  assert.equal(configured.model, SETTINGS.model);
  const config: OpenAISpecsConfig = { ...configured, timeoutMs: SETTINGS.timeout_ms,
    maxOutputTokens: SETTINGS.max_output_tokens, reasoningEffort: 'low' };
  const sourceSeals = await ports.seals();
  assert.equal(sourceSeals['packages/integrations/src/openai-specs.ts'], 'aa72bb5a46a91142a07968b80bcd49b0361cd51fc091cc543b5c2a874f84bdb9');
  const base = { schema_version: '1.0', purpose: 'one_retained_pdf47_low_effort_evaluation', run_id: run,
    job_id: prepared.job_id, source_asset_id: prepared.source_asset_id, input_sha256: prepared.input.inputHash,
    settings: SETTINGS, source_seals: sourceSeals, job_outbox_or_writeback: false, production_acceptance: false };
  // This exclusive claim is permanent even if transport, persistence or receipt writing fails.
  await ports.claim(base);
  await ports.receipt('dispatch-started', { ...base, result: 'dispatch_started', provider_requests_initiated: 0 });
  const started = Date.now();
  let providerReturned = false;
  try {
    const output = await ports.extract(prepared.input, config);
    providerReturned = true;
    await ports.persist(output);
    const receipt = { ...base, result: 'validated', provider_requests_initiated: 1, duration_ms: Date.now() - started,
      metadata: output.metadata, reasoning_token_count: null, reasoning_token_count_observed: false,
      role_count: output.result.roles.length, evidence_count: output.result.roles.reduce((n, role) => n + role.evidence.length, 0),
      clarification_count: output.result.clarifications.length + output.result.roles.reduce((n, role) => n + role.clarifications.length, 0),
      factual_quality_evaluated: false, automatic_retry: false };
    await ports.receipt('result', receipt);
    return receipt;
  } catch (error) {
    const code = error instanceof IntegrationError && safeCode.has(error.code) ? error.code : 'EVALUATION_OUTCOME_UNCONFIRMED';
    const requestId = error instanceof IntegrationError ? error.details.request_id : null;
    const httpStatus = error instanceof IntegrationError ? error.details.http_status : null;
    const receipt = { ...base, result: providerReturned ? 'unknown_private_persistence' : 'failed_or_unknown_provider_outcome',
      provider_requests_initiated: 1, duration_ms: Date.now() - started, code,
      provider_request_id: typeof requestId === 'string' && /^req_[A-Za-z0-9_-]{1,128}$/u.test(requestId) ? requestId : null,
      http_status: typeof httpStatus === 'number' && Number.isInteger(httpStatus) && httpStatus >= 100 && httpStatus <= 599 ? httpStatus : null,
      automatic_retry: false, charge_or_remote_completion_unknown: true, reasoning_token_count_observed: false };
    await ports.receipt('result', receipt);
    return receipt;
  }
}

async function bridge(run: string, operation: string, value?: unknown): Promise<unknown> {
  assert(EVALUATION_ENABLED && ROOT.toLowerCase() === path.resolve(MAIN).toLowerCase());
  const environment = Object.fromEntries(['SystemRoot', 'WINDIR', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'HOMEDRIVE',
    'HOMEPATH', 'TEMP', 'TMP', 'PATH', 'LANG'].filter(name => process.env[name] !== undefined).map(name => [name, process.env[name]!]));
  const input = JSON.stringify({ run, operation, value }); assert(Buffer.byteLength(input) <= 6 * 1024 * 1024);
  return new Promise((resolve, reject) => {
    const child = spawn(path.join(MAIN, '.venv-skills/Scripts/python.exe'), ['-X', 'utf8', '-B', path.join(import.meta.dirname, 'private_bridge.py')],
      { cwd: MAIN, env: environment, shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    const chunks: Buffer[] = []; let bytes = 0, stderrBytes = 0;
    const timer = setTimeout(() => { child.kill(); reject(Error('EVALUATION_PRIVATE_BRIDGE_UNCONFIRMED')); }, 65_000);
    child.on('error', () => { clearTimeout(timer); reject(Error('EVALUATION_PRIVATE_BRIDGE_UNCONFIRMED')); });
    child.stdout.on('data', (chunk: Buffer) => { bytes += chunk.length; if (bytes > 512 * 1024) child.kill(); else chunks.push(chunk); });
    child.stderr.on('data', (chunk: Buffer) => { stderrBytes += chunk.length; if (stderrBytes > 64 * 1024) child.kill(); });
    child.once('close', code => {
      clearTimeout(timer);
      try { assert.equal(code, 0); assert(bytes <= 512 * 1024 && stderrBytes <= 64 * 1024);
        const result = JSON.parse(Buffer.concat(chunks).toString('utf8')); assert.equal(result.ok, true); resolve(result.value);
      } catch { reject(Error('EVALUATION_PRIVATE_BRIDGE_UNCONFIRMED')); }
    });
    child.stdin.on('error', () => {}); child.stdin.end(input);
  });
}
const sourcePaths = ['packages/integrations/src/openai-specs.ts', 'packages/integrations/src/specs-schema.ts',
  'packages/integrations/src/prompts/specs-v1.ts', 'contracts/json-schema/specs-extraction.schema.json',
  'development/m07/pdf47-low-effort-evaluation/evaluate.mts', 'development/m07/pdf47-low-effort-evaluation/private_bridge.py',
  'package-lock.json', 'node_modules/openai/package.json', 'node_modules/openai/client.mjs', 'node_modules/openai/core/error.mjs'];
async function main() {
  assert(EVALUATION_ENABLED, 'PDF47_LOW_EFFORT_EVALUATION_DISABLED');
  const [operation, run, ...extra] = process.argv.slice(2); assert(!extra.length && UUID.test(run) && ['prepare', 'evaluate'].includes(operation));
  assert(ROOT.toLowerCase() === path.resolve(MAIN).toLowerCase());
  if (operation === 'prepare') { await bridge(run, 'prepare'); process.stdout.write('{"result":"prepared_privately","provider_requests":0}\n'); return; }
  const folder = path.join(MAIN, 'tracking/evidence/m07/pdf47-low-effort-evaluation');
  const stats = await lstat(folder); assert(stats.isDirectory() && !stats.isSymbolicLink());
  const ports: Ports = {
    read: async () => await bridge(run, 'read') as Prepared, config: () => openAISpecsConfigFromEnv(),
    seals: async () => {
      assert.equal(JSON.parse(await readFile(path.join(ROOT, 'node_modules/openai/package.json'), 'utf8')).version, '7.45.1');
      const seals = Object.fromEntries(await Promise.all(sourcePaths.map(async file => [file, createHash('sha256').update(await readFile(path.join(ROOT, file))).digest('hex')])));
      for (const [file, expected] of Object.entries({
        'node_modules/openai/package.json': 'fd91cc6cd6191ffcffdecd6e8b9db5598451ef4b383b7c871e6a913c1af8f470',
        'node_modules/openai/client.mjs': '65b8e9b0a52f5b855d239f3edb75710019d1cceaeac8da1e5cba122762e86ba2',
        'node_modules/openai/core/error.mjs': 'f9af78fa51cabb0128ebdd820259ba93a38d405434e698381b9dbc5b7ca55174',
      })) assert.equal(seals[file], expected);
      return seals;
    },
    claim: async value => { await bridge(run, 'claim', value); },
    receipt: async (phase, value) => { assert(['dispatch-started', 'result'].includes(phase)); await writeFile(path.join(folder, run + '-' + phase + '.json'), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' }); },
    extract: (input, config) => extractSpecs(input, config), persist: async output => { await bridge(run, 'persist', output); },
  };
  const result = await evaluateOnce(run, ports);
  process.stdout.write(JSON.stringify({ result: result.result, run_id: run, provider_requests_initiated: 1, writeback: false }) + '\n');
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) main().catch(() => {
  process.stderr.write('PDF47_LOW_EFFORT_EVALUATION_REFUSED; private inputs and errors withheld.\n'); process.exitCode = 1;
});
