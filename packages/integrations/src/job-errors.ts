import { IntegrationError } from './errors.ts';

/** Structural match for the job service's provider-independent Error DTO.
 * No runtime dependency on @eps/jobs and no provider exception data is retained. */
export interface ProcessingJobFailure {
  code: 'SOURCE_UNREADABLE' | 'RESULT_INVALID' | 'EXTRACTION_REFUSED' | 'PROVIDER_RATE_LIMITED' | 'DEPENDENCY_UNAVAILABLE' | 'PROCESSING_FAILED';
  message: string;
  details: Record<string, number>;
  retryable: boolean;
}
type GenericFailure = Omit<ProcessingJobFailure, 'details'>;
const generic = {
  source: { code: 'SOURCE_UNREADABLE', message: 'The prepared source cannot be read. Replace it or enter requirements manually.', retryable: false },
  result: { code: 'RESULT_INVALID', message: 'Processing returned invalid or unresolved extraction data. Existing edits were preserved.', retryable: false },
  refusal: { code: 'EXTRACTION_REFUSED', message: 'Extraction could not complete for this source. Manual requirements editing remains available.', retryable: false },
  rateLimit: { code: 'PROVIDER_RATE_LIMITED', message: 'The processing provider is temporarily rate limited.', retryable: true },
  unavailable: { code: 'DEPENDENCY_UNAVAILABLE', message: 'A required processing service is temporarily unavailable.', retryable: true },
  unknown: { code: 'PROCESSING_FAILED', message: 'Processing failed. The source and existing edits were preserved.', retryable: false },
} satisfies Record<string, GenericFailure>;

const mappings = new Map<string, GenericFailure>([
  ['SPECS_SOURCE_INVALID', generic.source], ['SPECS_SOURCE_UNREADABLE', generic.source],
  ['PDF_OCR_INPUT_INVALID', generic.source], ['PDF_OCR_RESULT_INVALID', generic.result], ['PDF_OCR_RESPONSE_INVALID', generic.result],
  ['AI_REFUSAL', generic.refusal],
  ...['AI_RESULT_INVALID', 'AI_EVIDENCE_INVALID', 'AI_EVIDENCE_MISSING', 'AI_SOURCE_MISMATCH', 'AI_ROLE_KEYS_INVALID',
    'AI_RESPONSE_INVALID', 'AI_RESPONSE_INCOMPLETE', 'AI_RESPONSE_NOT_COMPLETE', 'AI_OUTPUT_UNEXPECTED']
    .map(code => [code, generic.result] as [string, GenericFailure]),
  ['OPENAI_RATE_LIMITED', generic.rateLimit],
  ...['OPENAI_TIMEOUT', 'OPENAI_UNAVAILABLE', 'N8N_DISPATCH_TIMEOUT', 'N8N_DISPATCH_UNAVAILABLE', 'N8N_DISPATCH_RETRYABLE']
    .map(code => [code, generic.unavailable] as [string, GenericFailure]),
]);

/** Translate only explicitly classified adapter failures into the job vocabulary.
 * A runner handles PROCESSING_CANCELLED as control flow before calling this helper;
 * the helper never fabricates a cancellation transition or widens an unknown retry class. */
export function integrationErrorToJobFailure(error: unknown): ProcessingJobFailure {
  const mapped = error instanceof IntegrationError ? mappings.get(error.code) ?? generic.unknown : generic.unknown;
  const retryable = mapped.retryable && error instanceof IntegrationError && error.retryable;
  const details: Record<string, number> = {};
  if (retryable && error instanceof IntegrationError) {
    const milliseconds = error.details.retry_after_ms;
    if (typeof milliseconds === 'number' && Number.isFinite(milliseconds) && milliseconds >= 0) {
      details.retry_after_seconds = Math.min(Math.ceil(milliseconds / 1000), 300);
    }
  }
  return { code: mapped.code, message: mapped.message, details, retryable };
}
