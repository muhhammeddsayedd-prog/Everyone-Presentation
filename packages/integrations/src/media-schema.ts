import { Ajv2020 } from 'ajv/dist/2020.js';
import candidateSchema from '../../../contracts/json-schema/candidate-extraction.schema.json' with { type: 'json' };
import frameSchema from '../../../contracts/json-schema/frame-selection.schema.json' with { type: 'json' };
import { IntegrationError } from './errors.ts';
import type { CandidateExtraction, FrameSelection, TranscriptSource } from './media-types.ts';

const ajv = new Ajv2020({ strict: true, allErrors: false });
const candidate = ajv.compile<CandidateExtraction>(candidateSchema);
const frames = ajv.compile<FrameSelection>(frameSchema);
function error(code: string): never { throw new IntegrationError(code, 'The media result failed source and schema validation.'); }
export function validateMediaScalars(value: unknown): void {
  if (typeof value === 'string') {
    if (value.length > 20_000) error('AI_RESULT_INVALID');
    for (const character of value) { const point = character.codePointAt(0)!; if (point === 0 || point >= 0xd800 && point <= 0xdfff) error('AI_RESULT_INVALID'); }
  } else if (Array.isArray(value)) { if (value.length > 10_000) error('AI_RESULT_INVALID'); value.forEach(validateMediaScalars); }
  else if (value && typeof value === 'object') Object.values(value).forEach(validateMediaScalars);
}
/** Provider-compatible subset; full contract and evidence rules remain enforced. */
export function mediaProviderSchema(value: unknown): Record<string, unknown> {
  function adapt(item: unknown): unknown {
    if (Array.isArray(item)) return item.map(adapt);
    if (!item || typeof item !== 'object') return item;
    return Object.fromEntries(Object.entries(item).filter(([key]) => !['$schema', '$id', 'title', 'description', 'minLength', 'maxLength', 'minimum', 'maximum'].includes(key))
      .map(([key, value]) => key === 'const' ? ['enum', [value]] : [key, adapt(value)]));
  }
  return adapt(value) as Record<string, unknown>;
}
export const CANDIDATE_PROVIDER_SCHEMA = mediaProviderSchema(candidateSchema);
export const FRAME_PROVIDER_SCHEMA = mediaProviderSchema(frameSchema);
export function validateCandidateExtraction(value: unknown, input: TranscriptSource): CandidateExtraction {
  if (!candidate(value)) error('AI_RESULT_INVALID');
  validateMediaScalars(value);
  if (value.source_asset_id !== input.source_asset_id) error('AI_SOURCE_MISMATCH');
  const populated = new Set(Object.entries(value.facts).filter(([, value]) => Array.isArray(value) ? value.length > 0 : value !== null).map(([key]) => `facts.${key}`));
  if (value.project_availability_statement !== null) populated.add('project_availability_statement');
  const permitted = new Set([...Object.keys(value.facts).map(key => `facts.${key}`), 'project_availability_statement']);
  const backed = new Set<string>();
  for (const evidence of value.evidence) {
    const reference = evidence.source;
    const segment = input.segments.find(segment => segment.index === reference.segment_index);
    if (!permitted.has(evidence.field_path) || !segment || reference.asset_id !== input.source_asset_id || reference.page !== null || reference.paragraph !== null
      || reference.quote === null || !reference.quote.trim() || !segment.text.includes(reference.quote)
      || reference.start_ms !== segment.start_ms || reference.end_ms !== segment.end_ms) error('AI_EVIDENCE_INVALID');
    backed.add(evidence.field_path);
  }
  for (const path of populated) if (!backed.has(path)) error('AI_EVIDENCE_MISSING');
  for (const uncertainty of value.uncertainties) if (!permitted.has(uncertainty.field_path) || !uncertainty.reason.trim()) error('AI_RESULT_INVALID');
  for (const fact of Object.values(value.facts)) if (typeof fact === 'string' && !fact.trim() || Array.isArray(fact) && fact.some(item => !item.trim())) error('AI_RESULT_INVALID');
  return structuredClone(value);
}
export function validateFrameSelection(value: unknown, sourceAssetId: string, pool: { frame_asset_id: string; source_asset_id: string }[]): FrameSelection {
  if (!frames(value)) error('AI_FRAME_RESULT_INVALID');
  validateMediaScalars(value);
  if (value.source_asset_id !== sourceAssetId) error('AI_SOURCE_MISMATCH');
  const seen = new Set<string>();
  for (const frame of value.selected_frames) {
    if (seen.has(frame.frame_asset_id) || !frame.reason.trim() || !pool.some(item => item.frame_asset_id === frame.frame_asset_id && item.source_asset_id === sourceAssetId)) error('AI_FRAME_REFERENCE_INVALID');
    seen.add(frame.frame_asset_id);
  }
  if (seen.size < 3 && !value.insufficient_frames_reason?.trim()) error('AI_FRAME_RESULT_INVALID');
  return structuredClone(value);
}
