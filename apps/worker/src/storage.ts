import { createHash } from 'node:crypto';
import { prepareDocumentIsolated, type DocumentProcessOptions } from './process.ts';
import { DocumentPreparationError, type PrepareDocumentInput, type ExtractionMethod } from './types.ts';

export interface DocumentStageScope { jobId: string; attemptId: string; leaseToken: string }
export interface DocumentStoragePort {
  reserveOutput(input: { job_id: string; attempt_id: string; lease_token: string; asset_kind: 'document_text'; filename: string; mime_type: 'application/json'; expected_size_bytes: number; parent_asset_id: string; time_offset_ms: null }): Promise<{ assetId: string }>;
  writeOutput(input: { scope: DocumentStageScope; assetId: string; bytes: Uint8Array; mimeType: 'application/json' }): Promise<void>;
  completeOutput(input: { job_id: string; attempt_id: string; lease_token: string; asset_id: string; sha256: string; actual_size_bytes: number; width: null; height: null; duration_ms: null }): Promise<void>;
}
export interface DocumentPreparationResult {
  source_asset_id: string;
  text_asset_id: string | null;
  page_assets: { page: number; asset_id: string }[];
  paragraph_count: number;
  extraction_method: ExtractionMethod;
  warnings: string[];
}

export async function prepareAndStoreDocument(input: PrepareDocumentInput, scope: DocumentStageScope, storage: DocumentStoragePort, options: DocumentProcessOptions = {}): Promise<DocumentPreparationResult> {
  if (![scope.jobId, scope.attemptId, scope.leaseToken].every(value => typeof value === 'string' && value.trim())) throw new DocumentPreparationError('INVALID_JOB_SCOPE', 'An active authenticated job attempt and lease are required.');
  const stage = { ...scope };
  const prepared = await prepareDocumentIsolated(input, options);
  // Original bytes stay unchanged; this derived JSON retains the hash and exact text offsets.
  const bytes = Buffer.from(JSON.stringify({ schema_version: 'document-text-v1', ...prepared }));
  const jobScope = { job_id: stage.jobId, attempt_id: stage.attemptId, lease_token: stage.leaseToken };
  const reservation = await storage.reserveOutput({ ...jobScope, asset_kind: 'document_text', filename: 'prepared-document.json', mime_type: 'application/json', expected_size_bytes: bytes.length, parent_asset_id: prepared.sourceAssetId, time_offset_ms: null });
  if (!reservation.assetId || reservation.assetId.length > 200) throw new DocumentPreparationError('INVALID_OUTPUT_RESERVATION', 'The document output reservation is invalid.');
  await storage.writeOutput({ scope: stage, assetId: reservation.assetId, bytes, mimeType: 'application/json' });
  await storage.completeOutput({ ...jobScope, asset_id: reservation.assetId, sha256: createHash('sha256').update(bytes).digest('hex'), actual_size_bytes: bytes.length, width: null, height: null, duration_ms: null });
  return { source_asset_id: prepared.sourceAssetId, text_asset_id: reservation.assetId, page_assets: [], paragraph_count: prepared.paragraphs.length, extraction_method: prepared.extractionMethod, warnings: prepared.warnings };
}
