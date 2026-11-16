import { createHash } from 'node:crypto';
import { Ajv2020 } from 'ajv/dist/2020.js';
import sourceSchema from '../../../contracts/json-schema/specs-extraction.schema.json' with { type: 'json' };
import sourceSchemaV2 from '../../../contracts/json-schema/specs-extraction-v2.schema.json' with { type: 'json' };
import { IntegrationError } from './errors.ts';
import type {
  ExtractedRole, SourceClarification, SourceReference, SpecsExtractionInput, SpecsExtractionV1, SpecsExtractionV2,
} from './specs-types.ts';

export const sha256 = (value: string): string => createHash('sha256').update(value, 'utf8').digest('hex');
export const SPECS_SCHEMA_SHA256 = sha256(JSON.stringify(sourceSchema));
const validate = new Ajv2020({ strict: true, allErrors: false }).compile<SpecsExtractionV1>(sourceSchema);

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

// v2 (structured scenes). Hashes are computed exactly like v1 and pinned in SQL (m17).
export const SPECS_V2_SCHEMA_SHA256 = sha256(JSON.stringify(sourceSchemaV2));
const validateV2 = new Ajv2020({ strict: true, allErrors: false }).compile<SpecsExtractionV2>(sourceSchemaV2);
export const SPECS_V2_PROVIDER_SCHEMA = providerSchema(sourceSchemaV2) as Record<string, unknown>;
export const SPECS_V2_PROVIDER_SCHEMA_SHA256 = sha256(JSON.stringify(SPECS_V2_PROVIDER_SCHEMA));

/** JSON permits escaped NUL and lone UTF-16 surrogates; PostgreSQL jsonb does
 * not. Reject them before any result enters a private callback or SQL payload.
 * Iterating code points preserves valid surrogate pairs without rewriting text. */
function validateStringScalars(value: unknown): void {
  if (typeof value === 'string') {
    for (const character of value) {
      const point = character.codePointAt(0)!;
      if (point === 0 || (point >= 0xd800 && point <= 0xdfff)) {
        throw new IntegrationError('AI_RESULT_INVALID', 'Extraction contains unsupported text characters.');
      }
    }
  } else if (Array.isArray(value)) {
    value.forEach(validateStringScalars);
  } else if (value !== null && typeof value === 'object') {
    Object.values(value).forEach(validateStringScalars);
  }
}

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

function validateRoles(roles: ExtractedRole[], clarifications: SourceClarification[], input: SpecsExtractionInput): Set<string> {
  const roleKeys = new Set<string>();
  for (const role of roles) {
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
  clarifications.forEach((clarification) => {
    if (clarification.source) validateReference(clarification.source, input);
  });
  return roleKeys;
}

export function validateSpecsExtraction(value: unknown, input: SpecsExtractionInput): SpecsExtractionV1 {
  if (!validate(value)) {
    // No raw provider payload or schema value is included in error diagnostics.
    throw new IntegrationError('AI_RESULT_INVALID', 'Extraction did not match the application specs schema.');
  }
  validateStringScalars(value);
  if (value.source_asset_id !== input.sourceAssetId) {
    throw new IntegrationError('AI_SOURCE_MISMATCH', 'Extraction source identity does not match the current job.');
  }
  validateRoles(value.roles, value.clarifications, input);
  return structuredClone(value);
}

function requireEvidence(evidence: SourceReference[], input: SpecsExtractionInput, message: string): void {
  if (!evidence.length) throw new IntegrationError('AI_EVIDENCE_MISSING', message);
  evidence.forEach((reference) => validateReference(reference, input));
}

/** v2: the v1 checks plus scenes, per-role occurrences and explicit same-character links.
 * Every structural key must resolve inside this extraction and every claim must cite the source. */
export function validateSpecsExtractionV2(value: unknown, input: SpecsExtractionInput): SpecsExtractionV2 {
  if (!validateV2(value)) {
    throw new IntegrationError('AI_RESULT_INVALID', 'Extraction did not match the application specs schema.');
  }
  validateStringScalars(value);
  if (value.source_asset_id !== input.sourceAssetId) {
    throw new IntegrationError('AI_SOURCE_MISMATCH', 'Extraction source identity does not match the current job.');
  }
  const roleKeys = validateRoles(value.roles, value.clarifications, input);
  const sceneKeys = new Set<string>();
  for (const scene of value.scenes) {
    if (!scene.scene_key.trim() || sceneKeys.has(scene.scene_key) || !scene.title.trim()) {
      throw new IntegrationError('AI_RESULT_INVALID', 'Extracted scenes require distinct keys and titles.');
    }
    sceneKeys.add(scene.scene_key);
    requireEvidence(scene.evidence, input, 'Extracted scenes require document evidence.');
  }
  for (const role of value.roles) {
    const seen = new Set<string>();
    for (const occurrence of role.occurrences) {
      if (!sceneKeys.has(occurrence.scene_key) || seen.has(occurrence.scene_key)) {
        throw new IntegrationError('AI_RESULT_INVALID', 'Role scene occurrences must reference distinct extracted scenes.');
      }
      seen.add(occurrence.scene_key);
      requireEvidence(occurrence.evidence, input, 'Role scene occurrences require document evidence.');
    }
    if (role.same_character_as !== null) {
      const target = role.same_character_as.source_role_key;
      if (target === role.source_role_key || !roleKeys.has(target)) {
        throw new IntegrationError('AI_ROLE_KEYS_INVALID', 'A same-character link must reference another extracted role.');
      }
      requireEvidence(role.same_character_as.evidence, input, 'Same-character links require document evidence.');
    }
  }
  return normalizeSpecsExtractionV2(structuredClone(value));
}

/** Deterministic, after validation: a same-character link never merges casting by itself. The stored
 * extraction carries a reviewable role clarification because SQL derives role clarifications from it. */
export function normalizeSpecsExtractionV2(value: SpecsExtractionV2): SpecsExtractionV2 {
  const names = new Map(value.roles.map((role) => [role.source_role_key, role.name?.trim() || role.source_role_key]));
  for (const role of value.roles) {
    if (role.same_character_as === null || role.clarifications.some((item) => item.field_path === 'same_character_as')) continue;
    const other = names.get(role.same_character_as.source_role_key) ?? role.same_character_as.source_role_key;
    role.clarifications.push({ field_path: 'same_character_as',
      reason: `The source may describe the same character as "${other}". Roles stay separately cast unless you link this role to the same scenes explicitly.`,
      source: structuredClone(role.same_character_as.evidence[0]) });
  }
  return value;
}
