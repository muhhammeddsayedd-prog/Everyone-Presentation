/** Reviewed one-request ESM component probe. No SQL, mutations, new transcription or raw output. */
import { createHash, randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir, lstat, realpath } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { IntegrationError, record } from '../../../packages/integrations/src/errors.ts';
import { openAIMediaConfigFromEnv } from '../../../packages/integrations/src/openai-media.ts';
import { normalizeTranscriptEnglish, splitEnglishTranscriptSource, englishDisplayScript } from '../../../packages/integrations/src/openai-transcript-english.ts';

const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const privateDirectory = resolve(root, '.local/m03-english-component');
const bindingPath = resolve(privateDirectory, 'source-binding.json');
const hash = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const uuid = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/u;
const sourceSha = 'ffe461d30d48b32d90f1165627e2d104b6817f61d96a5a4bd9dcd6ff1964fc0a';
function need(value: unknown): asserts value { if (!value) throw new Error('ENGLISH_COMPONENT_UNCONFIRMED'); }
async function regular(path: string) { const info = await lstat(path); need(info.isFile() && info.nlink === 1 && await realpath(path) === path); }
async function main() {
  need(process.argv.length === 2);
  await regular(bindingPath);
  const beforeBytes = await readFile(bindingPath), source = record(JSON.parse(beforeBytes.toString('utf8')));
  need(source && source.source_sha256 === sourceSha && typeof source.source_asset_id === 'string' && uuid.test(source.source_asset_id));
  need(typeof source.original_text === 'string' && source.original_sha256 === hash(source.original_text));
  // One small existing transcript = exactly one paid Responses request; no retry.
  need(splitEnglishTranscriptSource(source.original_text).length === 1);
  const expected = record(JSON.parse(await readFile(resolve(privateDirectory, 'owner-confirmed.json'), 'utf8')));
  need(expected && typeof expected.name === 'string' && /^[A-Za-z .'-]{1,200}$/u.test(expected.name) && expected.age === 16);
  const environmentPath = resolve(root, '.env.worker.local'); await regular(environmentPath);
  const environmentBytes = await readFile(environmentPath); need(environmentBytes.length <= 65536);
  const configuration = { ...openAIMediaConfigFromEnv('extraction', parseEnv(environmentBytes.toString('utf8'))), timeoutMs: 60000, maxOutputTokens: 8192 };
  const runId = randomUUID(), observedAt = new Date().toISOString();
  const claim = { run_id: runId, claimed_at: observedAt, binding_sha256: hash(beforeBytes), original_sha256: source.original_sha256, requested_model: configuration.model,
    provider_request_limit: 1, automatic_retry: false };
  await writeFile(resolve(privateDirectory, 'normalization.claim.json'), JSON.stringify(claim), { flag: 'wx' });
  const receipt: Record<string, unknown> = { evidence_kind: 'actual_openai_english_normalization_component', observed_at: observedAt, run_id: runId,
    case_alias: 'permitted-arabic-introduction-01', provider_request_limit: 1, automatic_retry: false, component_only: true,
    app_or_database_acceptance: false, new_transcription: false, raw_or_english_personal_text_persisted_in_receipt: false, accepted: false };
  try {
    const value = await normalizeTranscriptEnglish({ source_asset_id: source.source_asset_id, original_text: source.original_text }, configuration);
    const text = value.text;
    const englishValid = value.status === 'available' && typeof text === 'string' && Boolean(text.trim()) && Array.from(text).length <= 200000 && englishDisplayScript(text);
    const bindingUnchanged = hash(await readFile(bindingPath)) === hash(beforeBytes), originalUnchanged = value.source_sha256 === source.original_sha256;
    const metadataValid = value.metadata.length === 1 && value.metadata[0].task === 'transcript_english' && value.metadata[0].prompt_version === 'transcript-english.v1'
      && Boolean(value.metadata[0].request_id) && Boolean(value.metadata[0].response_id) && value.metadata[0].usage !== null;
    const nameMatched = typeof text === 'string' && text.toLowerCase().includes(expected.name.toLowerCase());
    const ageMatched = typeof text === 'string' && /\b(?:16|sixteen)\b/iu.test(text);
    Object.assign(receipt, { english_available_script_and_bounds: englishValid, source_binding_file_unchanged: bindingUnchanged,
      original_sha256_unchanged: originalUnchanged, actual_ids_and_usage_present: metadataValid, narrow_owner_confirmed_name_literal_match: nameMatched,
      narrow_owner_confirmed_age_match: ageMatched, metadata: value.metadata,
      independent_broad_semantic_accuracy_claim: false, accepted: englishValid && bindingUnchanged && originalUnchanged && metadataValid && nameMatched && ageMatched });
  } catch (error) {
    const codes = new Set(['OPENAI_TIMEOUT','OPENAI_ACCESS_DENIED','OPENAI_QUOTA_EXCEEDED','OPENAI_RATE_LIMITED','OPENAI_REQUEST_REJECTED','OPENAI_UNAVAILABLE','PROCESSING_CANCELLED','AI_REFUSAL','AI_RESPONSE_NOT_COMPLETE','AI_OUTPUT_UNEXPECTED','ENGLISH_TRANSCRIPT_INPUT_INVALID','ENGLISH_TRANSCRIPT_RESULT_INVALID']);
    receipt.safe_error_code = error instanceof IntegrationError && codes.has(error.code) ? error.code : 'COMPONENT_UNCONFIRMED';
  }
  const out = resolve(root, 'tracking/evidence/m03/english-component'); await mkdir(out, { recursive: true });
  const path = resolve(out, `${observedAt.replaceAll(':', '-')}-${runId}.json`);
  await writeFile(path, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ accepted: receipt.accepted, receipt: relative(root, path).replaceAll('\\', '/'), automatic_retry: false }));
  if (!receipt.accepted) process.exitCode = 1;
}
main().catch(() => { console.log('ENGLISH_COMPONENT_UNCONFIRMED'); process.exitCode = 1; });
