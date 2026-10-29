import { createHash } from 'node:crypto';
import { Ajv2020 } from 'ajv/dist/2020.js';
import type { ResponseCreateParamsNonStreaming } from 'openai/resources/responses/responses';
import wordingContract from '../../../contracts/json-schema/slide-wording.schema.json' with { type: 'json' };
import { AI_SUGGESTION_FIELDS } from '../../domain/src/review.ts';
import { IntegrationError, record, safeIdentifier } from './errors.ts';
import { requestMediaResponse, type OpenAIMediaConfig } from './openai-media.ts';
import type { MediaProviderMetadata } from './media-types.ts';
import { WORDING_PROMPT, WORDING_PROMPT_VERSION } from './prompts/wording-v1.ts';

export interface WordingInput {
  input_hash: string; target_type: 'assignment' | 'role' | 'workspace_candidate' | 'candidate'; target_id: string; target_row_version: number;
  field: string; source_text: string; instruction: string; capability: 'slide_shorten' | 'normalize_english' | 'contextual_instruction';
  budget: { max_characters: number; max_lines: number }; template: { key: string; version: string; content_sha256: string; font_key: string };
}
export interface WordingProposal {
  schema_version: '1.0'; suggested_text: string; proposed_changes: { field: string; old_value: string; new_value: string }[];
  warnings: []; metadata: MediaProviderMetadata;
}
export type WordingTransport = (request: ResponseCreateParamsNonStreaming, configuration: OpenAIMediaConfig, signal?: AbortSignal) => Promise<unknown>;
const sha = (value: string) => createHash('sha256').update(value).digest('hex');
const digest = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
const exact = (value: unknown, keys: string[]): value is Record<string, unknown> => Boolean(record(value)) && Object.keys(value as object).length === keys.length && keys.every(key => Object.hasOwn(value as object, key));
const assignmentContract = new Ajv2020({ strict: true, allErrors: false }).compile(wordingContract);
function invalid(code = 'AI_WORDING_RESULT_INVALID'): never { throw new IntegrationError(code, 'Wording assistance could not preserve the supplied field safely. Existing text was kept.'); }
function stopped(signal?: AbortSignal) { if (signal?.aborted) throw new IntegrationError('PROCESSING_CANCELLED', 'Wording assistance was cancelled.'); }
function text(value: unknown, maximum: number): value is string {
  if (typeof value !== 'string' || [...value].length > maximum) return false;
  for (const character of value) { const point = character.codePointAt(0)!; if (point >= 0xd800 && point <= 0xdfff || point < 32 && ![9, 10, 13].includes(point) || point === 127) return false; }
  return true;
}
export function validateWordingInput(value: unknown): asserts value is WordingInput {
  if (!exact(value, ['input_hash', 'target_type', 'target_id', 'target_row_version', 'field', 'source_text', 'instruction', 'capability', 'budget', 'template'])
    || !digest(value.input_hash) || typeof value.target_type !== 'string' || !Object.hasOwn(AI_SUGGESTION_FIELDS, value.target_type)
    || !safeIdentifier(value.target_id) || typeof value.target_row_version !== 'number' || !Number.isSafeInteger(value.target_row_version) || value.target_row_version < 1
    || typeof value.field !== 'string' || !(AI_SUGGESTION_FIELDS[value.target_type as WordingInput['target_type']] as readonly string[]).includes(value.field)
    || !['slide_shorten', 'normalize_english', 'contextual_instruction'].includes(value.capability as string)
    || value.capability === 'slide_shorten' && value.target_type !== 'assignment'
    || !text(value.source_text, 20000) || !value.source_text.trim() || /^(not provided|pending)$/iu.test(value.source_text.trim())
    || !text(value.instruction, 8000) || !value.instruction.trim()
    || !exact(value.budget, ['max_characters', 'max_lines']) || !Number.isSafeInteger(value.budget.max_characters) || Number(value.budget.max_characters) < 1 || Number(value.budget.max_characters) > 8000
    || !Number.isSafeInteger(value.budget.max_lines) || Number(value.budget.max_lines) < 1 || Number(value.budget.max_lines) > 100
    || !exact(value.template, ['key', 'version', 'content_sha256', 'font_key']) || !safeIdentifier(value.template.key) || !safeIdentifier(value.template.version) || !digest(value.template.content_sha256) || !safeIdentifier(value.template.font_key)) invalid('AI_WORDING_SOURCE_INVALID');
}

const numberWords = new Map(['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'].map((word, index) => [word, String(index)]));
function numericText(value: string) {
  return value.normalize('NFKC').toLocaleLowerCase('und').replace(/[٠-٩۰-۹]/gu, character => String('٠١٢٣٤٥٦٧٨٩'.includes(character) ? '٠١٢٣٤٥٦٧٨٩'.indexOf(character) : '۰۱۲۳۴۵۶۷۸۹'.indexOf(character)))
    .replace(/\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\b/gu, word => numberWords.get(word)!);
}
// Preserve punctuation rather than guessing whether a comma means thousands or
// decimals. Strings also avoid collapsing very large supplied values to Infinity.
const numericValue = (value: string) => value.replace(/^0+(?=[0-9])/u, '');
const normalizedNumbers = (value: string) => [...new Set((numericText(value).match(/[0-9]+(?:[.,][0-9]+)?/gu) ?? []).map(numericValue))].sort();
const ranges = (value: string) => [...new Set([...numericText(value).matchAll(/([0-9]+(?:[.,][0-9]+)?)\s*(?:[-–—]|\bto\b|إلى|الى)\s*([0-9]+(?:[.,][0-9]+)?)/gu)].map(match => `${numericValue(match[1])}:${numericValue(match[2])}`))].sort();
const qualifierGroups = [
  /\b(?:not|no|never|without|cannot|unavailable|unable|unless)\b|\b\w+n['’]t\b|(?:^|[^\p{L}])(?:لا|لم|لن|ليس|ليست|غير|بدون|مش)(?=$|[^\p{L}])/iu,
  /\b(?:about|around|approximately|roughly)\b|تقريب|حوالي/iu,
  /\b(?:maybe|possibly|may|might)\b|ربما|محتمل/iu,
  /\b(?:uncertain|unconfirmed|tentative|pending)\b/iu,
  /\bstudent\b|طالب|طلاب/iu,
  /\b(?:amateur|non[- ]?professional)\b|هواة/iu,
  /\bunpaid\b/iu,
  /\b(?:training|trainee)\b|متدرب/iu,
  /\b(?:beginner|novice)\b|مبتدئ/iu,
  /\blimited\b|محدود/iu,
  /\b(?:if|unless|conditional|subject to|depending on|provided that|with notice|advance notice)\b|بشرط|حسب|إذا|لو /iu,
  /\b(?:fluent|fluency)\b|بطلاقة/iu,
  /\b(?:native speaker|native proficiency|native level)\b/iu,
  /\bprofessional\b|محترف/iu,
  /\bexpert\b|خبير/iu,
  /\baward[- ]winning\b/iu,
  /\b(?:lead role|starring)\b|بطولة/iu,
  /\b(?:over|more than)\b|أكثر من|اكتر من/iu,
  /\b(?:under|less than)\b|أقل من|اقل من/iu,
  /\b(?:at least|minimum)\b|على الأقل|على الاقل/iu,
  /\b(?:up to|at most|maximum)\b|بحد أقصى|بحد اقصى/iu,
];
/** Conservative guards catch obvious unsupported changes. They do not prove
 * semantic equivalence; the proposal remains a preview requiring ordinary apply. */
export function validateWordingSafety(source: string, proposed: string, field?: string) {
  if (JSON.stringify(normalizedNumbers(source)) !== JSON.stringify(normalizedNumbers(proposed)) || JSON.stringify(ranges(source)) !== JSON.stringify(ranges(proposed))
    || qualifierGroups.some(pattern => pattern.test(source) !== pattern.test(proposed))) invalid('AI_WORDING_FACTS_CHANGED');
  // English names may be formatted, but cannot become another identity. Other
  // scripts can require transliteration and still need actor semantic review.
  if (['name', 'name_or_id'].includes(field ?? '') && /^[\p{Script=Latin}\p{N}\p{P}\p{S}\s]+$/u.test(source)) {
    const identity = (value: string) => value.normalize('NFKC').toLocaleLowerCase('und').replace(/[\p{P}\p{S}\s]/gu, '');
    if (identity(source) !== identity(proposed)) invalid('AI_WORDING_FACTS_CHANGED');
  }
}
export function wordingProviderSchema(input: WordingInput) {
  const key = input.target_type === 'assignment' ? 'assignment_id' : 'target_id';
  return { type: 'object', additionalProperties: false, properties: {
    schema_version: { type: 'string', enum: ['1.0'] }, [key]: { type: 'string', enum: [input.target_id] }, field: { type: 'string', enum: [input.field] },
    suggested_text: { type: 'string' }, facts_preserved: { type: 'array', maxItems: 8, items: { type: 'string' } }, warnings: { type: 'array', maxItems: 0, items: { type: 'string' } },
  }, required: ['schema_version', key, 'field', 'suggested_text', 'facts_preserved', 'warnings'] };
}
function checkSuggestedText(value: unknown, input: WordingInput): asserts value is string {
  if (!text(value, 20000) || !value.trim()) invalid();
  if ([...value].length > input.budget.max_characters || value.split(/\r\n|\r|\n/u).length > input.budget.max_lines) invalid('AI_WORDING_BUDGET_EXCEEDED');
  if (input.capability === 'slide_shorten' && [...value].length > [...input.source_text].length) invalid('AI_WORDING_BUDGET_EXCEEDED');
  validateWordingSafety(input.source_text, value, input.field);
}
function providerText(payload: unknown, input: WordingInput): string {
  const key = input.target_type === 'assignment' ? 'assignment_id' : 'target_id';
  if (input.target_type === 'assignment' && !assignmentContract(payload) || !exact(payload, ['schema_version', key, 'field', 'suggested_text', 'facts_preserved', 'warnings'])
    || payload.schema_version !== '1.0' || payload[key] !== input.target_id || payload.field !== input.field || !Array.isArray(payload.facts_preserved) || payload.facts_preserved.length > 8
    || payload.facts_preserved.some(value => !text(value, 1000) || !value.trim() || !input.source_text.includes(value)) || !Array.isArray(payload.warnings) || payload.warnings.length !== 0) invalid();
  checkSuggestedText(payload.suggested_text, input); return payload.suggested_text;
}
function checkedUsage(value: unknown) {
  if (!exact(value, ['input_tokens', 'output_tokens', 'total_tokens'])) return null;
  const { input_tokens: input, output_tokens: output, total_tokens: total } = value;
  return [input, output, total].every(count => typeof count === 'number' && Number.isSafeInteger(count) && count >= 0) && Number(input) + Number(output) === total
    ? { input_tokens: input as number, output_tokens: output as number, total_tokens: total as number } : null;
}
export function validateWordingProposal(value: unknown, input: WordingInput, model: string): WordingProposal {
  validateWordingInput(input);
  if (!exact(value, ['schema_version', 'suggested_text', 'proposed_changes', 'warnings', 'metadata']) || value.schema_version !== '1.0' || !Array.isArray(value.proposed_changes) || value.proposed_changes.length !== 1
    || !exact(value.proposed_changes[0], ['field', 'old_value', 'new_value']) || value.proposed_changes[0].field !== input.field || value.proposed_changes[0].old_value !== input.source_text || value.proposed_changes[0].new_value !== value.suggested_text
    || !Array.isArray(value.warnings) || value.warnings.length !== 0 || !exact(value.metadata, ['provider', 'sdk_version', 'requested_model', 'resolved_model', 'request_id', 'response_id', 'prompt_version', 'input_sha256', 'usage', 'prompt_sha256', 'schema_sha256'])) invalid();
  checkSuggestedText(value.suggested_text, input);
  const meta = value.metadata;
  if (meta.provider !== 'openai' || meta.sdk_version !== '7.45.1' || meta.requested_model !== model || !safeIdentifier(meta.resolved_model) || !safeIdentifier(meta.response_id)
    || !(meta.request_id === null || safeIdentifier(meta.request_id)) || meta.prompt_version !== WORDING_PROMPT_VERSION || meta.input_sha256 !== input.input_hash
    || meta.prompt_sha256 !== sha(WORDING_PROMPT) || meta.schema_sha256 !== sha(JSON.stringify(wordingProviderSchema(input)))
    || meta.usage !== null && checkedUsage(meta.usage) === null) invalid();
  return structuredClone(value) as unknown as WordingProposal;
}

export async function proposeWording(suppliedInput: WordingInput, configuration: OpenAIMediaConfig, signal?: AbortSignal, transport: WordingTransport = requestMediaResponse): Promise<WordingProposal> {
  stopped(signal); let input: WordingInput;
  try { input = structuredClone(suppliedInput); } catch { invalid('AI_WORDING_SOURCE_INVALID'); }
  validateWordingInput(input); const settings = { ...configuration };
  if (!safeIdentifier(settings.model) || typeof settings.apiKey !== 'string' || !settings.apiKey.trim()) throw new IntegrationError('OPENAI_CONFIGURATION_INVALID', 'Configure the evaluated wording model and private provider key.');
  const schema = wordingProviderSchema(input);
  const request: ResponseCreateParamsNonStreaming = { model: settings.model, stream: false, store: false, tools: [], instructions: WORDING_PROMPT,
    input: [{ role: 'user', content: [{ type: 'input_text', text: JSON.stringify(input) }] }],
    text: { format: { type: 'json_schema', name: WORDING_PROMPT_VERSION, strict: true, schema } }, max_output_tokens: Math.min(settings.maxOutputTokens ?? 8192, 8192) };
  let raw: unknown;
  try { raw = await transport(request, settings, signal); }
  catch (error) { stopped(signal); if (error instanceof IntegrationError) throw error; throw new IntegrationError('OPENAI_UNAVAILABLE', 'Wording assistance is temporarily unavailable.', true); }
  stopped(signal); const response = record(raw);
  if (!response || response.status !== 'completed' || response.error || !safeIdentifier(response.id) || !safeIdentifier(response.model) || !Array.isArray(response.output)) invalid('AI_RESPONSE_NOT_COMPLETE');
  const texts: string[] = [];
  for (const item of response.output) {
    const message = record(item); if (message?.type === 'reasoning') continue;
    if (message?.type !== 'message' || message.role !== 'assistant' || message.status !== 'completed' || !Array.isArray(message.content)) invalid('AI_OUTPUT_UNEXPECTED');
    for (const entry of message.content) { const content = record(entry);
      if (content?.type === 'refusal') throw new IntegrationError('AI_REFUSAL', 'Wording assistance was declined. Existing text is unchanged.');
      if (content?.type !== 'output_text' || typeof content.text !== 'string') invalid('AI_OUTPUT_UNEXPECTED'); texts.push(content.text);
    }
  }
  if (texts.length !== 1 || Buffer.byteLength(texts[0]) > 65536) invalid();
  let payload: unknown; try { payload = JSON.parse(texts[0]); } catch { invalid(); }
  const suggested = providerText(payload, input); const usage = record(response.usage);
  const counts = usage ? { input_tokens: usage.input_tokens, output_tokens: usage.output_tokens, total_tokens: usage.total_tokens } : null;
  const result: WordingProposal = { schema_version: '1.0', suggested_text: suggested,
    proposed_changes: [{ field: input.field, old_value: input.source_text, new_value: suggested }], warnings: [],
    metadata: { provider: 'openai', sdk_version: '7.45.1', requested_model: settings.model, resolved_model: response.model as string,
      request_id: safeIdentifier(response._request_id), response_id: response.id as string, prompt_version: WORDING_PROMPT_VERSION,
      input_sha256: input.input_hash, usage: checkedUsage(counts), prompt_sha256: sha(WORDING_PROMPT), schema_sha256: sha(JSON.stringify(schema)) } };
  return validateWordingProposal(result, input, settings.model);
}
