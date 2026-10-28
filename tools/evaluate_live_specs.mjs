/** One real OpenAI request against the reviewed synthetic pack brief. No cloud
 * business/database writes or n8n/worker-host execution. Not an automated test. */
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import process from 'node:process';
import { TextDecoder } from 'node:util';
import { URL, pathToFileURL } from 'node:url';
import path from 'node:path';
import { extractSpecs, openAISpecsConfigFromEnv } from '../packages/integrations/src/openai-specs.ts';
import { prepareDocumentIsolated } from '../apps/worker/src/process.ts';
import { commitSpecsExtraction, createEmptySpecsDraft } from '../packages/domain/src/specs.ts';
import { loadWorkerPrivateEnvironment } from './worker-private-env.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const expectedSource = '29cb8bfc078377c69e898815e167ef7a9c4fdcd7c607f01ab9a0c019ac62407b';
const reviewedModel = 'gpt-6.1-sol';
async function main() {
  assert.equal(process.argv.length, 2, 'No path/model overrides are accepted.');
  const receipt = { observed_at: new Date().toISOString(), result: 'failed', fixture: 'fixtures/source-specs.txt', synthetic: true,
    source_sha256: expectedSource, reviewed_model: reviewedModel, sdk_retries: 0, response_store: false,
    provider_request_attempted: false, adapter_completed: false, database_called: false, cloud_business_writes: false,
    n8n_called: false, pipeline_acceptance: false, raw_diagnostics_recorded: false, secrets_recorded: false };
  try {
    const config = openAISpecsConfigFromEnv(await loadWorkerPrivateEnvironment());
    assert.equal(config.model, reviewedModel, 'Selected model changed; review its current support first.');
    const bytes = await readFile(new URL('../fixtures/source-specs.txt', import.meta.url));
    assert.equal(hash(bytes), expectedSource, 'Synthetic fixture changed; no request sent.');
    const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
    const prepared = await prepareDocumentIsolated({ sourceKind: 'pasted_text', sourceAssetId: null, text });
    assert.equal(prepared.sourceSha256, expectedSource);
    const correlationId = `live-synthetic-specs-${randomUUID()}`;
    // This is an evaluation fingerprint, NOT eps.specs-input.pg-jsonb.v1 or a DB job.
    const inputHash = hash(`synthetic-evaluation.v1:${expectedSource}:${reviewedModel}`);
    receipt.evaluation_fingerprint_scheme = 'synthetic-evaluation.v1';
    receipt.correlation_id = correlationId;
    receipt.preparation = { source_asset_id: null, method: prepared.extractionMethod, paragraph_count: prepared.paragraphs.length };
    receipt.adapter_sha256 = hash(await readFile(new URL('../packages/integrations/src/openai-specs.ts', import.meta.url)));
    receipt.provider_request_attempted = true;
    const output = await extractSpecs({ sourceAssetId: null, paragraphs: prepared.paragraphs, correlationId, inputHash },
      { ...config, maxOutputTokens: 8192, timeoutMs: 60_000 });
    receipt.adapter_completed = true; receipt.metadata = output.metadata; receipt.validated_synthetic_result = output.result;
    assert.deepEqual(output.result.roles.map(role => role.name?.toLowerCase()), ['father', 'manager', 'waiter']);
    assert.deepEqual(output.result.roles.map(role => role.headcount), [1, 1, 3]);
    assert.equal(output.result.roles[1].requirements.gender_requirement, null);
    assert.equal(output.result.roles[1].requirements.availability_requirements, null);
    assert.equal(output.result.roles[2].requirements.gender_requirement, null);
    assert.equal(output.result.roles[0].requirements.scene_references.length, 2);
    let allocated = 0;
    const draft = commitSpecsExtraction(createEmptySpecsDraft({ id: 'synthetic-live-spec', workspace_id: 'synthetic-live-workspace', draft_revision: 0 }),
      { expected_spec_row_version: 1, expected_draft_revision: 0, source_asset_id: null, source_text: text, extraction: output.result },
      () => `synthetic-local-result-${++allocated}`);
    assert.equal(draft.roles.length, 3); assert.equal(draft.slots.length, 5);
    receipt.assertions = { ordered_roles: 3, explicit_slots: 5, repeated_scenes_do_not_multiply_roles: true,
      missing_gender_and_availability_stay_null: true, evidence_schema_validated: true, source_identity_null_not_fabricated: true,
      domain_projection_only: true, database_apply_tested: false };
    receipt.result = 'passed';
  } catch (error) {
    const code = error && typeof error === 'object' && typeof error.code === 'string' ? error.code : '';
    receipt.error_code = /^[A-Z_]{1,80}$/u.test(code) ? code : 'LIVE_SYNTHETIC_ASSERTION_OR_CONFIGURATION_FAILED';
    process.exitCode = 1;
  } finally {
    receipt.finished_at = new Date().toISOString();
    const directory = new URL('../tracking/evidence/m02/provider-evaluation/', import.meta.url);
    await mkdir(directory, { recursive: true });
    const name = `${receipt.finished_at.replaceAll(':', '-').replaceAll('.', '-')}-${randomUUID().slice(0, 8)}.json`;
    await writeFile(new URL(name, directory), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
    process.stdout.write(JSON.stringify({ result: receipt.result, path: `tracking/evidence/m02/provider-evaluation/${name}`,
      provider_request_attempted: receipt.provider_request_attempted, adapter_completed: receipt.adapter_completed,
      error_code: receipt.error_code ?? null, pipeline_acceptance: false, cloud_business_writes: false }) + '\n');
  }
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch(() => { process.stderr.write('Synthetic provider evaluation could not be retained; diagnostics suppressed.\n'); process.exitCode = 1; });
}
