import type { AnySpecsExtraction } from '../../domain/src/specs-types.ts';
export type {
  SourceReference, SourceClarification, SourceClarification as Clarification, RoleRequirements, ExtractedRole, SpecsExtraction, AnySpecsExtraction,
  SpecsExtractionV1, SpecsExtractionV2, ExtractedRoleV2, ExtractedScene, ExtractedSceneOccurrence, ExtractedSameCharacterLink,
} from '../../domain/src/specs-types.ts';

export interface DocumentParagraph {
  /** Worker-assigned zero-based stable paragraph index; never inferred by the model. */
  index: number;
  page: number | null;
  text: string;
}

export interface SpecsExtractionInput {
  sourceAssetId: string | null;
  paragraphs: DocumentParagraph[];
  correlationId: string;
  /** Persisted job input/config fingerprint, supplied by the trusted job runner. */
  inputHash: string;
}

export interface SpecsExtractionMetadata {
  provider: 'openai';
  sdk_version: '7.45.1';
  requested_model: string;
  resolved_model: string;
  response_id: string;
  request_id: string | null;
  correlation_id: string;
  input_sha256: string;
  prepared_source_sha256: string;
  prompt_version: string;
  prompt_sha256: string;
  schema_version: '1.0' | '2.0';
  schema_sha256: string;
  provider_schema_sha256: string;
  usage: { input_tokens: number; output_tokens: number; total_tokens: number } | null;
}

export interface SpecsExtractionOutput {
  result: AnySpecsExtraction;
  metadata: SpecsExtractionMetadata;
}
