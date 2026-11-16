import { createHash } from 'node:crypto';
import type { ResponseCreateParamsNonStreaming, ResponseInputContent } from 'openai/resources/responses/responses';
import taxonomy from '../../../contracts/appearance-taxonomy.json' with { type: 'json' };
import { IntegrationError, record, safeIdentifier } from './errors.ts';
import { requestMediaResponse, type OpenAIMediaConfig } from './openai-media.ts';
import { APPEARANCE_PROMPT, APPEARANCE_PROMPT_VERSION } from './prompts/appearance-v1.ts';

/** Image inputs follow https://developers.openai.com/api/docs/guides/images-vision (Responses input_image with a
 * Base64 JPEG data URL and detail) and the strict schema https://developers.openai.com/api/docs/guides/structured-outputs.
 * The model comes only from configuration (OPENAI_EXTRACTION_MODEL / frozen job configuration); none is hardcoded here. */
export const APPEARANCE_LIMITS = Object.freeze({ images: 12, imageBytes: 5 * 1024 * 1024, totalBytes: 40 * 1024 * 1024, people: 10, evidence: 300, positionNote: 200, qualityNote: 300 });
export const APPEARANCE_TAXONOMY_VERSION = taxonomy.version;
const ATTRIBUTES = taxonomy.attributes as Record<string, { values: { key: string }[] }>;
export const APPEARANCE_ATTRIBUTE_KEYS = Object.freeze(Object.keys(ATTRIBUTES));
const CATEGORIES = ['portfolio_photo', 'headshot', 'full_body', 'video_frame'] as const;
export type AppearanceDetail = 'low' | 'high' | 'auto';
export interface AppearanceImage { media_ref: string; asset_id: string; source_kind: 'photo' | 'frame'; frame_timestamp_ms: number | null; sha256: string; bytes: Uint8Array }
export interface AppearanceInput { candidate_ref: string; input_hash: string; images: AppearanceImage[]; detail?: AppearanceDetail }
export interface AppearanceAttributeValue { value: string; confidence: 'low' | 'medium' | 'high'; evidence: string | null }
export interface AppearancePerson { person_index: number; position_note: string | null; attributes: Record<string, AppearanceAttributeValue> }
export interface AppearanceMediaResult { media_ref: string; asset_id: string; media_category: typeof CATEGORIES[number]; people_count: number; ambiguous: boolean; quality_note: string | null; people: AppearancePerson[] }
export interface AppearanceUsage { input_tokens: number; output_tokens: number; total_tokens: number }
export interface AppearanceMetadata {
  provider: 'openai'; sdk_version: '7.45.1'; requested_model: string; resolved_model: string; request_id: string | null; response_id: string;
  prompt_version: string; prompt_sha256: string; schema_sha256: string; taxonomy_version: string; input_sha256: string; image_input_sha256: string; detail: AppearanceDetail; usage: AppearanceUsage;
}
/** The exact `candidate-appearance-result.v1` payload the database apply accepts. */
export interface AppearanceResult {
  schema_version: '1.0'; model: string; prompt_version: string; taxonomy_version: string; usage: { input_tokens: number; output_tokens: number }; media: AppearanceMediaResult[];
}
export type AppearanceTransport = (request: ResponseCreateParamsNonStreaming, configuration: OpenAIMediaConfig, signal?: AbortSignal) => Promise<unknown>;
const sha = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const exact = (value: unknown, keys: readonly string[]): value is Record<string, unknown> => Boolean(record(value)) && Object.keys(value as object).length === keys.length && keys.every(key => Object.hasOwn(value as object, key));
const invalidOutput = (message = 'Appearance analysis exceeded its result contract.'): never => { throw new IntegrationError('AI_APPEARANCE_RESULT_INVALID', message); };
function inputError(): never { throw new IntegrationError('APPEARANCE_INPUT_INVALID', 'Appearance analysis requires verified JPEG images from the authorised media list.'); }
function stopped(signal?: AbortSignal) { if (signal?.aborted) throw new IntegrationError('PROCESSING_CANCELLED', 'Appearance analysis was cancelled.'); }

/** Strict output schema: every attribute required, closed value enums with an explicit "unknown". */
export function appearanceSchema(mediaRefs: string[]) {
  const attribute = (key: string) => ({ type: 'object', additionalProperties: false, properties: {
    value: { type: 'string', enum: [...ATTRIBUTES[key].values.map(value => value.key), 'unknown'] },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] }, evidence: { type: ['string', 'null'] } }, required: ['value', 'confidence', 'evidence'] });
  const person = { type: 'object', additionalProperties: false, properties: { person_index: { type: 'integer' }, position_note: { type: ['string', 'null'] },
    attributes: { type: 'object', additionalProperties: false, properties: Object.fromEntries(APPEARANCE_ATTRIBUTE_KEYS.map(key => [key, attribute(key)])), required: [...APPEARANCE_ATTRIBUTE_KEYS] } },
    required: ['person_index', 'position_note', 'attributes'] };
  return { type: 'object', additionalProperties: false, properties: { schema_version: { type: 'string', enum: ['1.0'] },
    media: { type: 'array', items: { type: 'object', additionalProperties: false, properties: {
      media_ref: { type: 'string', enum: mediaRefs }, media_category: { type: 'string', enum: [...CATEGORIES] }, people_count: { type: 'integer' }, ambiguous: { type: 'boolean' },
      quality_note: { type: ['string', 'null'] }, people: { type: 'array', items: person } }, required: ['media_ref', 'media_category', 'people_count', 'ambiguous', 'quality_note', 'people'] } } },
    required: ['schema_version', 'media'] };
}
export function appearanceImageFingerprint(images: Omit<AppearanceImage, 'bytes'>[]) {
  return sha(images.map(image => [image.media_ref, image.asset_id, image.source_kind, image.frame_timestamp_ms ?? '', image.sha256].join('\n')).join('\n\n'));
}
function validateInput(input: AppearanceInput) {
  if (!exact(input, input.detail === undefined ? ['candidate_ref', 'input_hash', 'images'] : ['candidate_ref', 'input_hash', 'images', 'detail']) || !safeIdentifier(input.candidate_ref)
    || !/^[a-f0-9]{64}$/u.test(input.input_hash) || !Array.isArray(input.images) || !input.images.length || input.images.length > APPEARANCE_LIMITS.images
    || input.detail !== undefined && !['low', 'high', 'auto'].includes(input.detail)) inputError();
  let total = 0; const refs = new Set<string>(); const assets = new Set<string>();
  for (const image of input.images) {
    if (!exact(image, ['media_ref', 'asset_id', 'source_kind', 'frame_timestamp_ms', 'sha256', 'bytes']) || !/^m[1-9][0-9]?$/u.test(image.media_ref) || refs.has(image.media_ref)
      || !safeIdentifier(image.asset_id) || assets.has(image.asset_id) || !['photo', 'frame'].includes(image.source_kind)
      || (image.source_kind === 'frame' ? !Number.isSafeInteger(image.frame_timestamp_ms) || Number(image.frame_timestamp_ms) < 0 : image.frame_timestamp_ms !== null)
      || !(image.bytes instanceof Uint8Array) || image.bytes.length < 3 || image.bytes.length > APPEARANCE_LIMITS.imageBytes || image.bytes[0] !== 0xff || image.bytes[1] !== 0xd8 || image.bytes[2] !== 0xff
      || !/^[a-f0-9]{64}$/u.test(image.sha256) || sha(image.bytes) !== image.sha256) inputError();
    refs.add(image.media_ref); assets.add(image.asset_id); total += image.bytes.length; if (total > APPEARANCE_LIMITS.totalBytes) inputError();
  }
}
const text = (value: unknown, maximum: number) => value === null || typeof value === 'string' && value.trim().length >= 1 && value.length <= maximum && !/[\p{Cc}]/u.test(value.replace(/[\n\t]/gu, ' '));
/** Validates model output against the taxonomy and the supplied media; multi-person media is always ambiguous. */
export function validateAppearanceOutput(payload: unknown, images: Pick<AppearanceImage, 'media_ref' | 'asset_id' | 'source_kind'>[]): AppearanceMediaResult[] {
  if (!exact(payload, ['schema_version', 'media']) || payload.schema_version !== '1.0' || !Array.isArray(payload.media) || payload.media.length !== images.length) invalidOutput();
  const seen = new Set<string>(); const media: AppearanceMediaResult[] = [];
  for (const entry of (payload as { media: unknown[] }).media) {
    if (!exact(entry, ['media_ref', 'media_category', 'people_count', 'ambiguous', 'quality_note', 'people'])) invalidOutput();
    const ref = images.find(image => image.media_ref === entry.media_ref);
    if (!ref || seen.has(ref.media_ref) || !CATEGORIES.includes(entry.media_category as typeof CATEGORIES[number]) || !Number.isSafeInteger(entry.people_count)
      || Number(entry.people_count) < 0 || Number(entry.people_count) > APPEARANCE_LIMITS.people || typeof entry.ambiguous !== 'boolean' || !text(entry.quality_note, APPEARANCE_LIMITS.qualityNote)
      || !Array.isArray(entry.people) || entry.people.length > Number(entry.people_count)) invalidOutput();
    seen.add(ref.media_ref); const people: AppearancePerson[] = []; const indexes = new Set<number>();
    for (const person of entry.people as unknown[]) {
      if (!exact(person, ['person_index', 'position_note', 'attributes']) || !Number.isSafeInteger(person.person_index) || Number(person.person_index) < 0
        || Number(person.person_index) >= Number(entry.people_count) || indexes.has(Number(person.person_index)) || !text(person.position_note, APPEARANCE_LIMITS.positionNote)
        || !exact(person.attributes, APPEARANCE_ATTRIBUTE_KEYS)) invalidOutput();
      indexes.add(Number(person.person_index)); const attributes: Record<string, AppearanceAttributeValue> = {};
      for (const key of APPEARANCE_ATTRIBUTE_KEYS) {
        const value = (person.attributes as Record<string, unknown>)[key];
        if (!exact(value, ['value', 'confidence', 'evidence']) || typeof value.value !== 'string' || !(value.value === 'unknown' || ATTRIBUTES[key].values.some(item => item.key === value.value))
          || !['low', 'medium', 'high'].includes(String(value.confidence)) || !text(value.evidence, APPEARANCE_LIMITS.evidence)) invalidOutput();
        attributes[key] = { value: value.value as string, confidence: value.confidence as AppearanceAttributeValue['confidence'], evidence: value.evidence === null ? null : (value.evidence as string).trim() };
      }
      people.push({ person_index: Number(person.person_index), position_note: person.position_note === null ? null : (person.position_note as string).trim(), attributes });
    }
    // Frames are always video frames; a photo is never labelled a video frame.
    const category = ref.source_kind === 'frame' ? 'video_frame' : entry.media_category === 'video_frame' ? 'portfolio_photo' : entry.media_category as typeof CATEGORIES[number];
    const count = Number(entry.people_count);
    media.push({ media_ref: ref.media_ref, asset_id: ref.asset_id, media_category: category, people_count: count, ambiguous: entry.ambiguous === true || count !== 1 || people.length > 1,
      quality_note: entry.quality_note === null ? null : (entry.quality_note as string).trim(), people: people.sort((a, b) => a.person_index - b.person_index) });
  }
  return images.map(image => media.find(item => item.media_ref === image.media_ref)!);
}
function usageOf(value: unknown): AppearanceUsage {
  const usage = record(value); const counts = [usage?.input_tokens, usage?.output_tokens, usage?.total_tokens];
  if (!counts.every(count => typeof count === 'number' && Number.isSafeInteger(count) && count >= 0)) throw new IntegrationError('AI_USAGE_MISSING', 'Appearance analysis returned no token usage, so its cost cannot be recorded.');
  return { input_tokens: counts[0] as number, output_tokens: counts[1] as number, total_tokens: counts[2] as number };
}

/** One Responses call over up to 12 authorised JPEGs. No video reprocessing, no tools, store:false. */
export async function analyzeAppearance(input: AppearanceInput, configuration: OpenAIMediaConfig, signal?: AbortSignal,
  transport: AppearanceTransport = requestMediaResponse): Promise<{ result: AppearanceResult; metadata: AppearanceMetadata }> {
  stopped(signal); validateInput(input);
  if (!safeIdentifier(configuration.model) || typeof configuration.apiKey !== 'string' || !configuration.apiKey.trim()) throw new IntegrationError('OPENAI_CONFIGURATION_INVALID', 'Configure the evaluated image-capable model.');
  const detail = input.detail ?? 'high'; const schema = appearanceSchema(input.images.map(image => image.media_ref));
  const content: ResponseInputContent[] = [{ type: 'input_text', text: JSON.stringify({ taxonomy_version: APPEARANCE_TAXONOMY_VERSION,
    media: input.images.map(image => ({ media_ref: image.media_ref, source_kind: image.source_kind === 'frame' ? 'video_frame' : 'photo' })) }) }];
  for (const image of input.images) content.push({ type: 'input_text', text: JSON.stringify({ media_ref: image.media_ref }) },
    { type: 'input_image', image_url: 'data:image/jpeg;base64,' + Buffer.from(image.bytes).toString('base64'), detail });
  const request: ResponseCreateParamsNonStreaming = { model: configuration.model, stream: false, store: false, tools: [], instructions: APPEARANCE_PROMPT,
    input: [{ role: 'user', content }], text: { format: { type: 'json_schema', name: 'candidate_appearance_v1', strict: true, schema } },
    max_output_tokens: Math.min(configuration.maxOutputTokens ?? 16_384, 32_768) };
  let raw: unknown;
  try { raw = await transport(request, configuration, signal); }
  catch (error) { stopped(signal); if (error instanceof IntegrationError) throw error; throw new IntegrationError('OPENAI_UNAVAILABLE', 'Appearance analysis is temporarily unavailable.', true); }
  stopped(signal); const response = record(raw);
  if (!response || response.status !== 'completed' || response.error || !Array.isArray(response.output) || !safeIdentifier(response.id) || !safeIdentifier(response.model)) {
    const reason = record(response?.incomplete_details)?.reason;
    throw new IntegrationError('AI_RESPONSE_NOT_COMPLETE', 'Appearance analysis did not complete.', false, { reason: typeof reason === 'string' && /^[a-z_]{1,40}$/u.test(reason) ? reason : null });
  }
  const usage = usageOf(response.usage); const texts: string[] = [];
  for (const item of response.output) {
    const message = record(item); if (message?.type === 'reasoning') continue;
    if (message?.type !== 'message' || message.role !== 'assistant' || message.status !== 'completed' || !Array.isArray(message.content)) throw new IntegrationError('AI_OUTPUT_UNEXPECTED', 'Appearance analysis returned unexpected output.');
    for (const entry of message.content) {
      const value = record(entry);
      if (value?.type === 'refusal') throw new IntegrationError('AI_REFUSAL', 'Appearance analysis was declined; manual review remains available.', false, { input_tokens: usage.input_tokens, output_tokens: usage.output_tokens });
      if (value?.type !== 'output_text' || typeof value.text !== 'string') throw new IntegrationError('AI_OUTPUT_UNEXPECTED', 'Appearance analysis returned unexpected content.');
      texts.push(value.text);
    }
  }
  if (texts.length !== 1 || Buffer.byteLength(texts[0]) > 262_144) invalidOutput();
  let payload: unknown; try { payload = JSON.parse(texts[0]); } catch { invalidOutput('Appearance analysis returned invalid JSON.'); }
  let media: AppearanceMediaResult[];
  try { media = validateAppearanceOutput(payload, input.images); }
  catch (error) { if (error instanceof IntegrationError) throw new IntegrationError(error.code, error.message, false, { input_tokens: usage.input_tokens, output_tokens: usage.output_tokens }); throw error; }
  const resolved = response.model as string;
  return { result: { schema_version: '1.0', model: resolved, prompt_version: APPEARANCE_PROMPT_VERSION, taxonomy_version: APPEARANCE_TAXONOMY_VERSION,
    usage: { input_tokens: usage.input_tokens, output_tokens: usage.output_tokens }, media },
  metadata: { provider: 'openai', sdk_version: '7.45.1', requested_model: configuration.model, resolved_model: resolved, request_id: safeIdentifier(response._request_id), response_id: response.id as string,
    prompt_version: APPEARANCE_PROMPT_VERSION, prompt_sha256: sha(APPEARANCE_PROMPT), schema_sha256: sha(JSON.stringify(schema)), taxonomy_version: APPEARANCE_TAXONOMY_VERSION,
    input_sha256: input.input_hash, image_input_sha256: appearanceImageFingerprint(input.images), detail, usage } };
}
/** Cost from returned usage and an operator-supplied price table (USD per million tokens). Never a built-in price. */
export function appearanceCostUsd(usage: Pick<AppearanceUsage, 'input_tokens' | 'output_tokens'>, prices: { input_usd_per_mtok: number; output_usd_per_mtok: number }) {
  if (![prices.input_usd_per_mtok, prices.output_usd_per_mtok].every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0)) throw new IntegrationError('PRICE_TABLE_INVALID', 'Provide non-negative USD per million token prices.');
  return (usage.input_tokens * prices.input_usd_per_mtok + usage.output_tokens * prices.output_usd_per_mtok) / 1_000_000;
}
