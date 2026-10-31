import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DOCUMENT_LIMITS, DocumentPreparationError, type DocumentPreparationInput, type PreparedDocument } from './types.ts';
import { pastedTextBytes } from './pasted-text.ts';
import { nativeSandboxConfiguration, runConfiguredNative } from './native-sandbox.ts';

const sourceDirectory = fileURLToPath(new URL('./', import.meta.url));
const dependencies = fileURLToPath(new URL('../../../node_modules/', import.meta.url));
const entry = fileURLToPath(new URL('./prepare-process.mjs', import.meta.url));
const maximumOutput = 24 * 1024 * 1024;
const maximumConcurrent = 2;
let active = 0;
export interface DocumentProcessOptions { timeoutMs?: number; signal?: AbortSignal }
const messages: Record<string, string> = {
  SOURCE_UNREADABLE: 'This document could not be read. Upload an unencrypted PDF or DOCX, or paste its text.',
  INVALID_SOURCE_REFERENCE: 'A verified source asset reference is required.',
  DOCUMENT_LIMIT_EXCEEDED: 'The document exceeds a preparation limit. Split it or paste the relevant requirements.',
  DOCUMENT_ARCHIVE_UNSAFE: 'This Word archive is unsafe or damaged. Re-save it as DOCX, or paste its text.',
  DOCUMENT_ENCRYPTED: 'Encrypted documents are unsupported. Upload an unencrypted source or paste its text.',
  DOCUMENT_EXTERNAL_RESOURCE_REQUIRED: 'This PDF requires an unavailable external resource. Embed its fonts or paste its text.',
  DOCUMENT_VISION_REQUIRED: 'This PDF needs scanned-page preparation, which is not configured. Upload a text-rich PDF or paste its text.',
  DOCUMENT_CONVERSION_REQUIRED: 'Legacy .doc conversion is not configured. Save as DOCX or paste its text.',
  DOCUMENT_TYPE_UNSUPPORTED: 'Use UTF-8 text, a text-rich PDF or a standard DOCX.',
};
const failure = (code: string, message: string, retryable = false) => new DocumentPreparationError(code, message, retryable);
const invalidResult = () => failure('DOCUMENT_PROCESS_FAILED', 'The document process did not return a valid result. The source was retained.', true);
const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const exact = (value: Record<string, unknown>, names: string[]) => Object.keys(value).length === names.length && names.every(name => Object.hasOwn(value, name));
interface ProcessSource { sourceKind: 'asset' | 'pasted_text'; sourceAssetId: string | null; mimeType: string; bytes: Buffer }
function resultFromBytes(bytes: Buffer, input: ProcessSource): PreparedDocument {
  let envelope: unknown;
  try { envelope = JSON.parse(bytes.toString('utf8')); } catch { throw invalidResult(); }
  if (!record(envelope)) throw invalidResult();
  if (envelope.ok === false && exact(envelope, ['ok', 'code']) && typeof envelope.code === 'string' && Object.hasOwn(messages, envelope.code)) throw failure(envelope.code, messages[envelope.code]);
  if (envelope.ok !== true || !exact(envelope, ['ok', 'result']) || !record(envelope.result)) throw invalidResult();
  const value = envelope.result;
  const method = input.mimeType === 'text/plain' ? 'plain_text' : input.mimeType === 'application/pdf' ? 'pdf_text' : 'docx_text';
  if (!exact(value, ['sourceAssetId', 'sourceSha256', 'text', 'paragraphs', 'extractionMethod', 'warnings'])
    || value.sourceAssetId !== input.sourceAssetId || value.sourceSha256 !== createHash('sha256').update(input.bytes).digest('hex')
    || value.extractionMethod !== method || typeof value.text !== 'string' || value.text.length > DOCUMENT_LIMITS.maximumTextCharacters
    || !Array.isArray(value.paragraphs) || value.paragraphs.length > DOCUMENT_LIMITS.maximumParagraphs || !Array.isArray(value.warnings) || value.warnings.length > 200
    || value.warnings.some(warning => typeof warning !== 'string' || warning.length > 2000)) throw invalidResult();
  const text = value.text; let previousEnd = 0;
  for (const [index, paragraph] of value.paragraphs.entries()) {
    if (!record(paragraph) || !exact(paragraph, ['index', 'page', 'start', 'end', 'text']) || paragraph.index !== index || !Number.isSafeInteger(paragraph.start) || !Number.isSafeInteger(paragraph.end)
      || typeof paragraph.start !== 'number' || paragraph.start < previousEnd || typeof paragraph.end !== 'number'
      || paragraph.end < paragraph.start || paragraph.end > text.length || typeof paragraph.text !== 'string'
      || text.slice(paragraph.start, paragraph.end) !== paragraph.text
      || !(paragraph.page === null || typeof paragraph.page === 'number' && Number.isSafeInteger(paragraph.page) && paragraph.page >= 1 && paragraph.page <= DOCUMENT_LIMITS.maximumPages)) throw invalidResult();
    previousEnd = paragraph.end;
  }
  return structuredClone(value) as unknown as PreparedDocument;
}

/** Fixed parser subprocess with scrubbed environment, bounded pipes, heap and
 * deadline. Node permissions are defense in depth, NOT an OS sandbox/RSS limit.
 * Native parser dependencies require addons; production still needs container
 * CPU/RSS/egress enforcement. No uploaded command, filename or URL is accepted. */
export async function prepareDocumentIsolated(input: DocumentPreparationInput, options: DocumentProcessOptions = {}): Promise<PreparedDocument> {
  if (!input || typeof input !== 'object') throw failure('SOURCE_UNREADABLE', messages.SOURCE_UNREADABLE);
  let source: ProcessSource;
  if (input.sourceKind === 'pasted_text') {
    if (input.sourceAssetId !== null) throw failure('INVALID_SOURCE_REFERENCE', messages.INVALID_SOURCE_REFERENCE);
    if (!exact(input as unknown as Record<string, unknown>, ['sourceKind', 'sourceAssetId', 'text'])) throw failure('SOURCE_UNREADABLE', messages.SOURCE_UNREADABLE);
    source = { sourceKind: 'pasted_text', sourceAssetId: null, mimeType: 'text/plain', bytes: pastedTextBytes(input.text) };
  } else {
    if (!(input.bytes instanceof Uint8Array) || input.bytes.length === 0) throw failure('SOURCE_UNREADABLE', messages.SOURCE_UNREADABLE);
    if (input.bytes.length > DOCUMENT_LIMITS.maximumBytes) throw failure('DOCUMENT_LIMIT_EXCEEDED', messages.DOCUMENT_LIMIT_EXCEEDED);
    if (typeof input.sourceAssetId !== 'string' || !input.sourceAssetId.trim() || input.sourceAssetId.length > 200) throw failure('INVALID_SOURCE_REFERENCE', messages.INVALID_SOURCE_REFERENCE);
    if (input.sourceKind !== undefined && input.sourceKind !== 'asset') throw failure('SOURCE_UNREADABLE', messages.SOURCE_UNREADABLE);
    if (typeof input.mimeType !== 'string' || input.mimeType.length > 200) throw failure('DOCUMENT_TYPE_UNSUPPORTED', messages.DOCUMENT_TYPE_UNSUPPORTED);
    if (!['text/plain', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(input.mimeType)) throw failure('DOCUMENT_TYPE_UNSUPPORTED', messages.DOCUMENT_TYPE_UNSUPPORTED);
    source = { sourceKind: 'asset', sourceAssetId: input.sourceAssetId, mimeType: input.mimeType, bytes: Buffer.from(input.bytes) };
  }
  const timeout = options.timeoutMs ?? 30_000;
  if (!Number.isSafeInteger(timeout) || timeout < 1 || timeout > 30_000) throw failure('DOCUMENT_PROCESS_CONFIGURATION_INVALID', 'The parser deadline must be between 1 and 30000 milliseconds.');
  if (options.signal?.aborted) throw failure('DOCUMENT_PREPARATION_CANCELLED', 'Document preparation was cancelled.');
  if (active >= maximumConcurrent) throw failure('DOCUMENT_PREPARATION_BUSY', 'Both document parser slots are busy. Retry when one is available.', true);
  // Snapshot caller-owned data before asynchronous work; no URL/path is accepted.
  const payload = JSON.stringify({ sourceKind: source.sourceKind, sourceAssetId: source.sourceAssetId, mimeType: source.mimeType, bytes: source.bytes.toString('base64') });
  if (nativeSandboxConfiguration()) return resultFromBytes(Buffer.from(await runConfiguredNative('document', payload, { signal: options.signal, timeoutMs: timeout })), source);
  const environment: NodeJS.ProcessEnv = { NODE_ENV: 'production' };
  for (const name of ['SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'LANG']) if (process.env[name]) environment[name] = process.env[name];
  active++;
  try {
    return await new Promise<PreparedDocument>((resolve, reject) => {
      const child = spawn(process.execPath, ['--max-old-space-size=256', '--permission', '--allow-addons',
        `--allow-fs-read=${sourceDirectory}`, `--allow-fs-read=${dependencies}`, entry],
      { cwd: sourceDirectory, env: environment, windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe'] });
      let failed: DocumentPreparationError | undefined; let outputBytes = 0; let diagnosticBytes = 0; const chunks: Buffer[] = [];
      function stop(error: DocumentPreparationError) { failed ??= error; child.kill('SIGKILL'); }
      const cancel = () => stop(failure('DOCUMENT_PREPARATION_CANCELLED', 'Document preparation was cancelled.'));
      const timer = setTimeout(() => stop(failure('DOCUMENT_PREPARATION_TIMEOUT', 'Document preparation exceeded its deadline. Retry or paste the relevant text.', true)), timeout);
      options.signal?.addEventListener('abort', cancel, { once: true });
      child.on('error', () => { failed ??= invalidResult(); });
      child.stdin.on('error', () => { /* Close reports process/protocol failure; never print pipe content. */ });
      child.stdout.on('data', (chunk: Buffer) => { outputBytes += chunk.length; if (outputBytes > maximumOutput) stop(invalidResult()); else chunks.push(chunk); });
      child.stderr.on('data', (chunk: Buffer) => { diagnosticBytes += chunk.length; if (diagnosticBytes > 64 * 1024) stop(invalidResult()); });
      child.on('close', code => {
        clearTimeout(timer); options.signal?.removeEventListener('abort', cancel);
        if (failed || code !== 0) { reject(failed ?? invalidResult()); return; }
        try { resolve(resultFromBytes(Buffer.concat(chunks), source)); } catch (error) { reject(error); }
      });
      if (options.signal?.aborted) cancel();
      child.stdin.end(payload);
    });
  } finally { active--; }
}
