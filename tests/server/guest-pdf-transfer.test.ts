import assert from 'node:assert/strict';
import test from 'node:test';
import { GUEST_PDF_DOWNLOAD_ERROR, guestPdfFilename, readGuestPdfResponse } from '../../apps/web/components/guest-pdf-transfer.ts';

const pdf = new TextEncoder().encode('%PDF-1.7\nSynthetic bounded download\n%%EOF\n');
const validHeaders = { 'Content-Type': 'application/pdf', 'Content-Length': String(pdf.length) };
const closedError = (error: unknown) => error instanceof Error && error.message === GUEST_PDF_DOWNLOAD_ERROR;
test('validated PDF preserves exact bytes even when the signature spans stream chunks', async () => {
  const parts = [pdf.slice(0, 2), pdf.slice(2, 4), pdf.slice(4)];
  const stream = new ReadableStream<Uint8Array>({ pull(controller) { const part = parts.shift(); if (part) controller.enqueue(part); else controller.close(); } });
  const blob = await readGuestPdfResponse(new Response(stream, { headers: validHeaders }));
  assert.equal(blob.type, 'application/pdf'); assert.equal(blob.size, pdf.length); assert.deepEqual(new Uint8Array(await blob.arrayBuffer()), pdf);
});
test('non-PDF, partial, error, unbounded and malformed-length responses are cancelled without reading provider text', async () => {
  const cases = [
    { status: 503, headers: validHeaders }, { status: 403, headers: validHeaders }, { status: 206, headers: validHeaders },
    { status: 200, headers: { ...validHeaders, 'Content-Type': 'application/json' } },
    { status: 200, headers: { 'Content-Type': 'application/pdf' } },
    { status: 200, headers: { ...validHeaders, 'Content-Length': String(64 * 1024 * 1024 + 1) } },
    { status: 200, headers: { ...validHeaders, 'Content-Length': '-1' } },
  ];
  for (const value of cases) {
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(pdf); controller.close(); }, cancel() { cancelled = true; } });
    await assert.rejects(readGuestPdfResponse(new Response(stream, value)), closedError); assert.equal(cancelled, true);
  }
});
test('wrong signatures, truncated and excessive bodies fail closed and cancel unfinished transfers', async () => {
  const wrong = new TextEncoder().encode('PRIVATE_PROVIDER_BODY_MUST_NOT_BE_RENDERED');
  await assert.rejects(readGuestPdfResponse(new Response(wrong, { headers: { ...validHeaders, 'Content-Length': String(wrong.length) } })), closedError);
  for (const length of [pdf.length - 1, pdf.length + 1]) await assert.rejects(readGuestPdfResponse(new Response(pdf, { headers: { ...validHeaders, 'Content-Length': String(length) } })), closedError);
  let cancelled = false, sent = false;
  const stream = new ReadableStream<Uint8Array>({ pull(controller) { if (!sent) { controller.enqueue(wrong); sent = true; } else controller.close(); }, cancel() { cancelled = true; } });
  await assert.rejects(readGuestPdfResponse(new Response(stream, { headers: { ...validHeaders, 'Content-Length': String(wrong.length) } })), closedError); assert.equal(cancelled, true);
});
test('stream exceptions expose a fixed safe message and export filenames cannot use provider paths', async () => {
  const stream = new ReadableStream<Uint8Array>({ pull() { throw new Error('PRIVATE_PROVIDER_EXCEPTION_PATH'); } });
  await assert.rejects(readGuestPdfResponse(new Response(stream, { headers: validHeaders })), closedError);
  const id = '00000000-0000-4000-8000-000000000997';
  assert.equal(guestPdfFilename(id), `everyone-review-${id}.pdf`);
  assert.equal(guestPdfFilename('../../provider.json'), 'everyone-review.pdf');
});
