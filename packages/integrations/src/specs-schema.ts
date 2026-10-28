import { createHash } from 'node:crypto';
import { Ajv2020 } from 'ajv/dist/2020.js';
import sourceSchema from '../../../contracts/json-schema/specs-extraction.schema.json' with { type: 'json' };
import { IntegrationError } from './errors.ts';
import type { SourceReference, SpecsExtraction, SpecsExtractionInput } from './specs-types.ts';

export const sha256 = (value: string): string => createHash('sha256').update(value, 'utf8').digest('hex');
export const SPECS_SCHEMA_SHA256 = sha256(JSON.stringify(sourceSchema));
const validate = new Ajv2020({ strict: true, allErrors: false }).compile<SpecsExtraction>(sourceSchema);

/**
 * Keep the conservative Structured Outputs subset; full constraints are still enforced below.
 * const becomes enum; source-only metadata/length/minimum constraints stay server-side.
 * Source: https://developers.openai.com/api/docs/guides/structured-outputs#supported-schemas
 */
function providerSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(providerSchema);
  if (value === null || typeof value !== 'object') return value;
  const adapted: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (['$schema', '$id', 'title', 'minLength', 'maxLength', 'minimum', 'maximum'].includes(key)) continue;
    if (key === 'const') adapted.enum = [item];
    else adapted[key] = providerSchema(item);
  }
  return adapted;
}

export const SPECS_PROVIDER_SCHEMA = providerSchema(sourceSchema) as Record<string, unknown>;
export const SPECS_PROVIDER_SCHEMA_SHA256 = sha256(JSON.stringify(SPECS_PROVIDER_SCHEMA));

function validateReference(reference: SourceReference, input: SpecsExtractionInput): void {
  if (reference.asset_id !== input.sourceAssetId || reference.segment_index !== null
    || reference.start_ms !== null || reference.end_ms !== null) {
    throw new IntegrationError('AI_EVIDENCE_INVALID', 'Extraction evidence does not match the prepared document.');
  }
  const paragraphs = input.paragraphs.filter((paragraph) =>
    (reference.paragraph === null || paragraph.index === reference.paragraph)
    && (reference.page === null || paragraph.page === reference.page));
  if ((reference.paragraph === null && reference.page === null) || paragraphs.length === 0
    || (reference.quote !== null && (!reference.quote.trim()
      || !paragraphs.some((paragraph) => paragraph.text.includes(reference.quote!))))) {
    throw new IntegrationError('AI_EVIDENCE_INVALID', 'Extraction contains an unresolved paragraph, page or source quote.');
  }
}

export function validateSpecsExtraction(value: unknown, input: SpecsExtractionInput): SpecsExtraction {
  if (!validate(value)) {
    // No raw provider payload or schema value is included in error diagnostics.
    throw new IntegrationError('AI_RESULT_INVALID', 'Extraction did not match the application specs schema.');
  }
  if (value.source_asset_id !== input.sourceAssetId) {
    throw new IntegrationError('AI_SOURCE_MISMATCH', 'Extraction source identity does not match the current job.');
  }
  const roleKeys = new Set<string>();
  for (const role of value.roles) {
    if (!role.source_role_key.trim() || roleKeys.has(role.source_role_key)) {
      throw new IntegrationError('AI_ROLE_KEYS_INVALID', 'Extracted roles require distinct source keys.');
    }
    roleKeys.add(role.source_role_key);
    if (!role.evidence.length) {
      throw new IntegrationError('AI_EVIDENCE_MISSING', 'Extracted role claims require document evidence.');
    }
    role.evidence.forEach((reference) => validateReference(reference, input));
    role.clarifications.forEach((clarification) => {
      if (clarification.source) validateReference(clarification.source, input);
    });
  }
  value.clarifications.forEach((clarification) => {
    if (clarification.source) validateReference(clarification.source, input);
  });
  return structuredClone(value);
}
