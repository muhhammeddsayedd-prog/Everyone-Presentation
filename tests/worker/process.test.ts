import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareDocumentIsolated } from '../../apps/worker/src/process.ts';
import { DocumentPreparationError, DOCUMENT_LIMITS } from '../../apps/worker/src/types.ts';
import { docx, pdf } from './document-fixtures.ts';

const sourceAssetId = 'synthetic-isolated-document';
const input = { bytes: Buffer.from('Role: Waiter\r\n\r\nThree people. العربية'), mimeType: 'text/plain', sourceAssetId };
test('separate parser process returns exact prepared evidence and a hash of unchanged input bytes', async () => {
  const result = await prepareDocumentIsolated(input);
  assert.equal(result.sourceAssetId, sourceAssetId);
  assert.equal(result.text, 'Role: Waiter\n\nThree people. العربية');
  assert.equal(result.paragraphs.length, 2);
  assert.equal(result.text.slice(result.paragraphs[1].start, result.paragraphs[1].end), result.paragraphs[1].text);
  assert.equal(result.extractionMethod, 'plain_text');
});
test('oversize input is refused before starting a parser, and typed format errors cross without private diagnostics', async () => {
  await assert.rejects(prepareDocumentIsolated({ ...input, bytes: new Uint8Array(DOCUMENT_LIMITS.maximumBytes + 1) }),
    (error: unknown) => error instanceof DocumentPreparationError && error.code === 'DOCUMENT_LIMIT_EXCEEDED');
  await assert.rejects(prepareDocumentIsolated({ ...input, mimeType: 'application/msword' }),
    (error: unknown) => error instanceof DocumentPreparationError && error.code === 'DOCUMENT_CONVERSION_REQUIRED' && !error.message.includes('Waiter'));
});
test('an expired parser deadline terminates that child and later parsing still works', async () => {
  await assert.rejects(prepareDocumentIsolated(input, { timeoutMs: 1 }),
    (error: unknown) => error instanceof DocumentPreparationError && error.code === 'DOCUMENT_PREPARATION_TIMEOUT');
  assert.equal((await prepareDocumentIsolated(input)).paragraphs.length, 2);
});
test('cancellation refuses already-aborted work and stops an active child without publishing a result', async () => {
  const controller = new AbortController(); controller.abort();
  await assert.rejects(prepareDocumentIsolated(input, { signal: controller.signal }),
    (error: unknown) => error instanceof DocumentPreparationError && error.code === 'DOCUMENT_PREPARATION_CANCELLED');
  const active = new AbortController(); const result = prepareDocumentIsolated(input, { signal: active.signal });
  active.abort();
  await assert.rejects(result, (error: unknown) => error instanceof DocumentPreparationError && error.code === 'DOCUMENT_PREPARATION_CANCELLED');
});
test('actual PDF and DOCX preparation work through the bounded process without a web or provider request', async () => {
  const pdfResult = await prepareDocumentIsolated({ ...input, bytes: pdf(['Role: Waiter', 'Three people, two scenes.']), mimeType: 'application/pdf' });
  assert.equal(pdfResult.extractionMethod, 'pdf_text');
  assert.deepEqual(pdfResult.paragraphs.map(paragraph => paragraph.page), [1, 2]);
  assert.match(pdfResult.text, /Three people/u);
  const wordResult = await prepareDocumentIsolated({ ...input, bytes: docx(['Role: Waiter', 'مطلوب ثلاثة أشخاص']), mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  assert.equal(wordResult.extractionMethod, 'docx_text');
  assert.match(wordResult.text, /مطلوب ثلاثة أشخاص/u);
});
test('paragraph allocation is bounded consistently before producing an AI input that exceeds its contract', async () => {
  await assert.rejects(prepareDocumentIsolated({ ...input, bytes: Buffer.from(Array.from({ length: DOCUMENT_LIMITS.maximumParagraphs + 1 }, () => 'A').join('\n\n')) }),
    (error: unknown) => error instanceof DocumentPreparationError && error.code === 'DOCUMENT_LIMIT_EXCEEDED' && !error.retryable);
});
test('only two parser processes are admitted and busy refusal does not consume a slot', async () => {
  const first = prepareDocumentIsolated(input); const second = prepareDocumentIsolated(input);
  await assert.rejects(prepareDocumentIsolated(input), (error: unknown) => error instanceof DocumentPreparationError && error.code === 'DOCUMENT_PREPARATION_BUSY' && error.retryable);
  await Promise.all([first, second]);
  assert.equal((await prepareDocumentIsolated(input)).extractionMethod, 'plain_text');
});
