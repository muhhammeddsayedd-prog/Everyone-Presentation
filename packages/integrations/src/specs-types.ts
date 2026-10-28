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

export interface SourceReference {
  asset_id: string | null;
  page: number | null;
  paragraph: number | null;
  segment_index: number | null;
  start_ms: number | null;
  end_ms: number | null;
  quote: string | null;
}

export interface Clarification {
  field_path: string;
  reason: string;
  source: SourceReference | null;
}

export interface RoleRequirements {
  age_range: string | null;
  gender_requirement: string | null;
  appearance_performance: string | null;
  languages: string[];
  accents: string[];
  skills: string[];
  scene_references: string[];
  shoot_dates: string[];
  location: string | null;
  availability_requirements: string | null;
  other_instructions: string | null;
}

export interface ExtractedRole {
  source_role_key: string;
  name: string | null;
  headcount: number | null;
  category: string | null;
  requirements: RoleRequirements;
  evidence: SourceReference[];
  clarifications: Clarification[];
}

/** Exact application schema; validated against contracts/json-schema on every result. */
export interface SpecsExtraction {
  schema_version: '1.0';
  source_asset_id: string | null;
  source_language_codes: string[];
  roles: ExtractedRole[];
  general_instructions: string | null;
  clarifications: Clarification[];
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
  schema_version: '1.0';
  schema_sha256: string;
  provider_schema_sha256: string;
  usage: { input_tokens: number; output_tokens: number; total_tokens: number } | null;
}

export interface SpecsExtractionOutput {
  result: SpecsExtraction;
  metadata: SpecsExtractionMetadata;
}
