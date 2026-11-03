import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { rootCertificates } from 'node:tls';
import test from 'node:test';
import { verifySpecsWorkerStartup } from '../../apps/worker/src/runtime-main.ts';
import { readPdfPage } from '../../packages/integrations/src/openai-pdf-ocr.ts';
import type { OpenAIMediaConfig } from '../../packages/integrations/src/openai-media.ts';

const environment = { OPENAI_API_KEY: 'synthetic-ocr-config-key', OPENAI_EXTRACTION_MODEL: 'synthetic-model',
  N8N_DISPATCH_URL: 'https://synthetic.app.n8n.cloud/webhook/metadata', N8N_DISPATCH_SECRET: 'synthetic-private-webhook-secret-long',
  EPS_SPECS_PG_HOST: 'aws-0-eu-west-1.pooler.supabase.com', EPS_SPECS_PG_PASSWORD: 'synthetic-private-runtime-password',
  EPS_SPECS_PG_CA_BASE64: Buffer.from(rootCertificates[0]).toString('base64'), EPS_SPECS_FILES_ENABLED: 'true',
  SUPABASE_URL: 'https://pyibofyctwnqpvktepse.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic_public_key',
  EPS_PDF_VISION_ENABLED: 'true', EPS_PDF_RASTER_IMAGE_ID: `sha256:${'a'.repeat(64)}` };
const factory = (async () => ({ close: async () => {} })) as never;
function ocrConfig(vision: unknown): OpenAIMediaConfig {
  assert.ok(vision && typeof vision === 'object' && 'openAI' in vision, 'PDF vision must own an independent media configuration');
  return vision.openAI as OpenAIMediaConfig;
}

test('PDF OCR owns the media profile in production, pilot and direct startup', async () => {
  for (const mode of [undefined, 'controlled_pilot', 'production']) {
    const startup = await verifySpecsWorkerStartup({ ...environment, ...(mode ? { EPS_RELEASE_MODE: mode } : {}) }, factory);
    try {
      const ocr = ocrConfig(startup.vision);
      assert.deepEqual(ocr, { apiKey: environment.OPENAI_API_KEY, model: environment.OPENAI_EXTRACTION_MODEL,
        timeoutMs: 60_000, maxOutputTokens: 8192 });
      assert.notEqual(ocr, startup.openAI);
      assert.equal(startup.openAI.timeoutMs, mode === 'production' ? 300_000 : 60_000);
      assert.equal(startup.openAI.maxOutputTokens, mode === 'production' ? 32_768 : 16_384);
      assert.equal(startup.openAI.transportMode, mode === 'production' ? 'bounded_stream' : undefined);
      assert.equal(startup.openAI.reasoningEffort, mode === 'production' ? 'low' : undefined);
    } finally { await startup.gateway.close(); }
  }
});

test('real OCR SDK path accepts its startup media config while rejecting the specs timeout before HTTP', { concurrency: false }, async () => {
  const startup = await verifySpecsWorkerStartup({ ...environment, EPS_RELEASE_MODE: 'production' }, factory);
  const previous = globalThis.fetch; let requests = 0;
  const asset = '10000000-0000-4000-8000-000000000001';
  const image = new Uint8Array([0xff, 0xd8, 0xff, 1]);
  const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
  const input = { source_asset_id: asset, source_sha256: 'b'.repeat(64), page: 1, image_sha256: sha(image), bytes: image };
  globalThis.fetch = async (url, init) => {
    requests++; assert.equal(String(url), 'https://api.openai.com/v1/responses');
    const request = JSON.parse(init!.body as string) as Record<string, unknown>;
    assert.equal(request.model, environment.OPENAI_EXTRACTION_MODEL);
    assert.equal(request.stream, false); assert.equal(request.max_output_tokens, 16_384);
    assert.equal(request.reasoning, undefined); assert.deepEqual(request.tools, []);
    return Response.json({ id: 'resp_synthetic_ocr', model: environment.OPENAI_EXTRACTION_MODEL, status: 'completed',
      output: [{ type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: JSON.stringify({
        schema_version: '1.0', source_asset_id: asset, page_number: 1, text: 'Synthetic scanned role requirement.', uncertainties: [] }) }] }] });
  };
  try {
    await assert.rejects(readPdfPage(input, startup.openAI), { code: 'OPENAI_CONFIGURATION_INVALID' });
    assert.equal(requests, 0);
    const prepared = await readPdfPage(input, ocrConfig(startup.vision));
    assert.equal(requests, 1); assert.equal(prepared.text, 'Synthetic scanned role requirement.');
    assert.equal(prepared.metadata.page, 1);
    assert.equal(startup.openAI.timeoutMs, 300_000); assert.equal(startup.openAI.transportMode, 'bounded_stream');
  } finally { globalThis.fetch = previous; await startup.gateway.close(); }
});
