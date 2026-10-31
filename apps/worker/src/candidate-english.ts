import { createHash } from 'node:crypto';
import { IntegrationError, record, safeIdentifier } from '../../../packages/integrations/src/errors.ts';
import { EnglishTranscriptNormalizationError, ENGLISH_TRANSCRIPT_LIMITS, englishDisplayScript, normalizeTranscriptEnglish, type EnglishTranscriptInput } from '../../../packages/integrations/src/openai-transcript-english.ts';
import type { OpenAIMediaConfig } from '../../../packages/integrations/src/openai-media.ts';
import type { EnglishTranscript, MediaProviderMetadata } from '../../../packages/integrations/src/media-types.ts';

export function candidateEnglishVersion(value: unknown): '1.0' | null {
  if (value === undefined || value === null) return null;
  if (value !== '1.0') throw new IntegrationError('OPENAI_CONFIGURATION_INVALID', 'The frozen English transcript version is not supported.');
  return value;
}
const digest = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
const idOrNull = (value: unknown) => value === null || safeIdentifier(value) !== null;
const exact = (value: unknown, keys: string[]): value is Record<string, unknown> => Boolean(record(value)) && Object.keys(value as object).length === keys.length && keys.every(key => Object.hasOwn(value as object, key));
function safeMetadata(value: unknown, model: string): MediaProviderMetadata[] {
  try {
    if (!Array.isArray(value) || value.length > ENGLISH_TRANSCRIPT_LIMITS.chunks) return [];
    const required = ['provider', 'task', 'sdk_version', 'requested_model', 'resolved_model', 'request_id', 'response_id', 'prompt_version', 'input_sha256', 'usage'];
    const allowed = [...required, 'prompt_sha256', 'schema_sha256'];
    for (const item of value) {
      const row = record(item);
      if (!row || required.some(key => !Object.hasOwn(row, key)) || Object.keys(row).some(key => !allowed.includes(key))
        || row.provider !== 'openai' || row.task !== 'transcript_english' || row.sdk_version !== '7.45.1' || row.requested_model !== model
        || !idOrNull(row.resolved_model) || !idOrNull(row.request_id) || !idOrNull(row.response_id) || row.prompt_version !== 'transcript-english.v1' || !digest(row.input_sha256)
        || ['prompt_sha256', 'schema_sha256'].some(key => Object.hasOwn(row, key) && !digest(row[key]))) return [];
      if (row.usage !== null && (!exact(row.usage, ['input_tokens', 'output_tokens', 'total_tokens']) || Object.values(row.usage).some(value => typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0))) return [];
    }
    return structuredClone(value) as MediaProviderMetadata[];
  } catch { return []; }
}
function displayText(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim() || value.length > 2 * ENGLISH_TRANSCRIPT_LIMITS.totalOutputCharacters) return false;
  let length = 0;
  for (const char of value) { const point = char.codePointAt(0)!; if (++length > ENGLISH_TRANSCRIPT_LIMITS.totalOutputCharacters || point >= 0xd800 && point <= 0xdfff || point === 127 || point < 32 && ![9, 10, 13].includes(point)) return false; }
  return englishDisplayScript(value);
}
/** English failure never changes source evidence or exposes the raw source as display text. */
export async function candidateEnglishTranscript(source: EnglishTranscriptInput | null, options: {
  configuration: OpenAIMediaConfig; allowPartial: boolean; signal?: AbortSignal; normalize?: typeof normalizeTranscriptEnglish;
}): Promise<EnglishTranscript> {
  if (source === null) return { status: 'not_provided', text: null, source_sha256: null, metadata: [], failure_code: null };
  const sourceSha = createHash('sha256').update(source.original_text, 'utf8').digest('hex');
  try {
    const value = await (options.normalize ?? normalizeTranscriptEnglish)(source, options.configuration, options.signal);
    if (options.signal?.aborted) throw new IntegrationError('PROCESSING_CANCELLED', 'English transcript normalization was cancelled.');
    const metadata = safeMetadata(value.metadata, options.configuration.model);
    if (!exact(value, ['status', 'text', 'source_sha256', 'metadata', 'failure_code']) || value.status !== 'available' || !displayText(value.text)
      || value.source_sha256 !== sourceSha || value.failure_code !== null || !metadata.length || metadata.length !== value.metadata.length)
      throw new IntegrationError('ENGLISH_TRANSCRIPT_RESULT_INVALID', 'English transcript normalization could not be verified.');
    return { status: 'available', text: value.text, source_sha256: sourceSha, metadata, failure_code: null };
  } catch (error) {
    if (options.signal?.aborted || error instanceof IntegrationError && error.code === 'PROCESSING_CANCELLED') throw new IntegrationError('PROCESSING_CANCELLED', 'English transcript normalization was cancelled.');
    if (error instanceof IntegrationError && error.retryable && !options.allowPartial) throw error;
    if (!(error instanceof IntegrationError) && !options.allowPartial) throw new IntegrationError('OPENAI_UNAVAILABLE', 'English transcript normalization is temporarily unavailable.', true);
    return { status: 'unavailable', text: null, source_sha256: sourceSha,
      metadata: error instanceof EnglishTranscriptNormalizationError ? safeMetadata(error.completedMetadata, options.configuration.model) : [], failure_code: 'ENGLISH_TRANSCRIPT_UNAVAILABLE' };
  }
}
