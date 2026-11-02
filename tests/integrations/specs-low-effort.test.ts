import { test } from 'node:test';
import assert from 'node:assert/strict';
import OpenAI from 'openai';
import { extractSpecs } from '../../packages/integrations/src/openai-specs.ts';
import { IntegrationError } from '../../packages/integrations/src/errors.ts';
import { SPECS_PROMPT } from '../../packages/integrations/src/prompts/specs-v1.ts';
import { SPECS_PROVIDER_SCHEMA } from '../../packages/integrations/src/specs-schema.ts';
import type { OpenAISpecsConfig } from '../../packages/integrations/src/openai-specs.ts';
import type { SpecsExtractionInput } from '../../packages/integrations/src/specs-types.ts';

// Real SDK serialization with a local fake HTTP port. No provider request.
const input: SpecsExtractionInput = { sourceAssetId: null, correlationId: 'low-effort-fixture', inputHash: 'a'.repeat(64),
  paragraphs: [{ index: 0, page: null, text: 'Synthetic requirements without a named role.' }] };
const config = { apiKey: 'synthetic-low-effort-key', model: 'gpt-6.1-sol' };
const result = { schema_version: '1.0', source_asset_id: null, source_language_codes: ['en'], roles: [],
  general_instructions: null, clarifications: [{ field_path: 'roles', reason: 'No role was supplied.', source: null }] };
const response = { id: 'resp_low_effort', model: config.model, status: 'completed', error: null,
  output: [{ type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: JSON.stringify(result) }] }],
  usage: { input_tokens: 20, output_tokens: 30, total_tokens: 50, output_tokens_details: { reasoning_tokens: 10 } } };

test('explicit low candidate changes only reasoning options and retains strict request and persisted provenance contract', async () => {
  const requests: Record<string, unknown>[] = [];
  const client = new OpenAI({ apiKey: config.apiKey, maxRetries: 0, timeout: 60_000,
    fetch: async (_url, options) => {
      requests.push(JSON.parse(String(options?.body)) as Record<string, unknown>);
      return new Response(JSON.stringify(response), { status: 200,
        headers: { 'Content-Type': 'application/json', 'x-request-id': 'req_low_effort' } });
    } });
  const send: Parameters<typeof extractSpecs>[2] = (request, signal) => client.responses.create(request, { signal });
  const before = await extractSpecs(input, config, send);
  const after = await extractSpecs(input, { ...config, reasoningEffort: 'low' }, send);
  assert.equal(requests.length, 2);
  assert.equal(Object.hasOwn(requests[0], 'reasoning'), false);
  assert.deepEqual(requests[1].reasoning, { effort: 'low' });
  const sameRequest = structuredClone(requests[1]);
  delete sameRequest.reasoning;
  assert.deepEqual(sameRequest, requests[0]);
  assert.equal(sameRequest.max_output_tokens, 16_384);
  assert.equal(sameRequest.instructions, SPECS_PROMPT);
  assert.deepEqual(sameRequest.text, { format: { type: 'json_schema', name: 'specs_extraction_v1', strict: true, schema: SPECS_PROVIDER_SCHEMA } });
  assert.deepEqual(after.result, before.result);
  assert.deepEqual(after.metadata, before.metadata);
  assert.deepEqual(Object.keys(after.metadata).sort(), ['provider', 'sdk_version', 'requested_model', 'resolved_model',
    'response_id', 'request_id', 'correlation_id', 'input_sha256', 'prepared_source_sha256', 'prompt_version', 'prompt_sha256',
    'schema_version', 'schema_sha256', 'provider_schema_sha256', 'usage'].sort());
  assert(!JSON.stringify(after.metadata).includes(config.apiKey));
  assert(!JSON.stringify(after.metadata).includes(input.paragraphs[0].text));
});

test('candidate rejects unsupported efforts before any transport dispatch', async () => {
  let dispatched = 0;
  for (const effort of ['none', 'minimal', 'medium', 'high', null, 1, {}, 'LOW']) {
    await assert.rejects(extractSpecs(input, { ...config, reasoningEffort: effort } as unknown as OpenAISpecsConfig,
      async () => { dispatched++; return response; }), (error: unknown) => error instanceof IntegrationError && error.code === 'OPENAI_CONFIGURATION_INVALID');
  }
  assert.equal(dispatched, 0);
});
