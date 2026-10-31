import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { createBearerUserClient } from '../../packages/central/src/client.ts';
import { createCentralPresentations } from '../../packages/central/src/presentation.ts';
import type { PresentationOperations } from '../../packages/domain/src/presentation-types.ts';
import { handlePresentationRequest, isPresentationRoute } from '../../apps/web/lib/presentation-http.ts';
import { presentationId, presentationVersionFixture } from '../fixtures/presentation.ts';
import { DomainError } from '../../packages/domain/src/types.ts';

const actor = { principal_id: presentationId(51) }; const key = 'synthetic-generate-stable-key';
const metadata = { requestId: 'presentation-http', clientType: 'api' as const, idempotencyKey: key };
const body = { expected_workspace_row_version: 3, expected_draft_revision: 2, expected_input_fingerprint: 'a'.repeat(64) };
const accepted = { job_id: presentationId(50), resource_id: presentationId(1), poll_url: `/api/v1/jobs/${presentationId(50)}`, status: 'queued' as const };
function fixture() {
  const calls: unknown[] = []; const version = presentationVersionFixture(); const bytes = new TextEncoder().encode('%PDF-synthetic');
  const service: PresentationOperations = {
    listVersions: async (...args) => { calls.push(args); return { data: [version], page: { next_cursor: null } }; },
    generateVersion: async (...args) => { calls.push(args); return accepted; }, getVersion: async () => version,
    downloadVersionPdf: async () => ({ version_id: version.id, download_url: 'https://synthetic.invalid/private.pdf', expires_at: '2026-10-29T22:00:00Z', filename: 'synthetic.pdf', size_bytes: bytes.length }),
    playVersionMedia: async (_actor, versionId, assetId) => ({ asset_id: assetId, url: 'https://synthetic.invalid/private-video', expires_at: '2026-10-29T22:00:00Z', mime_type: 'video/mp4', source_version_id: versionId }),
    getVersionMediaContent: async () => ({ bytes: new Uint8Array([255, 216, 255]), mimeType: 'image/jpeg' }),
    getVersionPdfContent: async () => ({ bytes, mimeType: 'application/pdf', filename: 'synthetic.pdf' }),
  };
  return { service, calls, version, bytes };
}
test('HTTP generation forwards all three guards and stable correlation, then returns the durable202', async () => {
  const h = fixture(); const s = ['presentation-series', h.version.series_id, 'versions'];
  assert.equal(isPresentationRoute(s), true);
  const response = await handlePresentationRequest(new Request('https://synthetic.invalid/api/v1/'+s.join('/'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), s, actor, h.service, metadata);
  assert.equal(response.status, 202); assert.deepEqual(await response.json(), { request_id: metadata.requestId, data: accepted });
  assert.deepEqual(h.calls, [[actor, h.version.series_id, body, metadata]]);
});
test('bodyless fixed-media routes reject arbitrary query/body and binary content keeps private headers', async () => {
  const h = fixture(); const s = ['versions', h.version.id, 'pdf', 'content'];
  const response = await handlePresentationRequest(new Request('https://synthetic.invalid/api/v1/'+s.join('/')), s, actor, h.service, metadata);
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), h.bytes); assert.equal(response.headers.get('content-type'), 'application/pdf');
  assert.match(response.headers.get('cache-control')!, /no-store/u); assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  await assert.rejects(handlePresentationRequest(new Request('https://synthetic.invalid/api/v1/versions/x/pdf?token=forged', { method: 'POST' }), ['versions', 'x', 'pdf'], actor, h.service, metadata), DomainError);
  await assert.rejects(handlePresentationRequest(new Request('https://synthetic.invalid/api/v1/versions/x/pdf', { method: 'POST', body: '{}' }), ['versions', 'x', 'pdf'], actor, h.service, metadata), DomainError);
});
test('read-only HTTP verbs do not turn POST authorization operations into content reads', async () => {
  const h = fixture();
  for (const s of [['versions', h.version.id, 'pdf'], ['versions', h.version.id, 'media', presentationId(10), 'playback']]) {
    await assert.rejects(handlePresentationRequest(new Request('https://synthetic.invalid/api/v1/'+s.join('/')), s, actor, h.service, metadata),
      error => error instanceof DomainError && error.code === 'RESOURCE_NOT_FOUND');
  }
});

// The fake is only the central network boundary; the real facade and Storage
// reader still authorize the fixed version and verify its complete checksum.
async function storedPdf(options: { corrupt?: boolean; denied?: boolean } = {}) {
  const bytes = Buffer.alloc(6 * 1024 * 1024 + 17, 65); bytes.write('%PDF-1.7\n');
  const version = { ...presentationVersionFixture(), status: 'ready' as const, pdf_asset_id: presentationId(60),
    manifest_asset_id: presentationId(61), ready_at: '2026-10-30T18:00:00Z' };
  const bucket = 'eps-presentations'; const objectKey = `versions/${version.id}/${version.pdf_asset_id}.pdf`;
  const source = { asset: { id: version.pdf_asset_id, purpose: 'presentation_pdf', filename: 'synthetic.pdf', mime_type: 'application/pdf',
    size_bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), status: 'ready', duration_ms: null,
    width: null, height: null, source_asset_id: null, source_timestamp_ms: null, created_at: version.created_at }, bucket, object_key: objectKey };
  let reads = 0;
  const origin = 'https://synthetic-version-http.invalid';
  const client = createBearerUserClient({ url: origin, publishableKey: 'sb_publishable_synthetic', accessToken: 'synthetic-user-token' }, { fetch: async input => {
    const pathname = new URL(input instanceof Request ? input.url : String(input)).pathname;
    if (pathname === '/auth/v1/user') return Response.json({ id: actor.principal_id, role: 'authenticated', aud: 'authenticated', is_anonymous: false });
    if (pathname.endsWith('/eps_get_version')) return Response.json(version);
    if (pathname.endsWith('/eps_get_version_asset')) return options.denied
      ? Response.json({ code: 'P0001', message: 'ACCESS_DENIED' }, { status: 400 }) : Response.json(source);
    if (pathname === `/storage/v1/object/info/${bucket}/${objectKey}`) return Response.json({ id: source.asset.id,
      name: objectKey, bucket_id: bucket, size: bytes.length, content_type: 'application/pdf' });
    if (pathname === `/storage/v1/object/${bucket}/${objectKey}`) {
      reads++; const output = Buffer.from(bytes); if (options.corrupt) output[output.length - 1] ^= 1;
      return new Response(output, { headers: { 'Content-Type': 'application/pdf' } });
    }
    throw new Error('Unexpected synthetic PDF destination.');
  } });
  const service = await createCentralPresentations(client, { storageOrigin: origin });
  const segments = ['versions', version.id, 'pdf', 'content'];
  const request = (signal?: AbortSignal) => new Request(`${origin}/api/v1/${segments.join('/')}`, { signal });
  return { bytes, service, segments, request, reads: () => reads };
}

test('verified PDF above the hosted buffered-response limit streams exact bytes in bounded chunks with private headers', async () => {
  const h = await storedPdf();
  const response = await handlePresentationRequest(h.request(), h.segments, actor, h.service, metadata);
  assert.equal(response.status, 200); assert.equal(response.headers.get('content-type'), 'application/pdf');
  assert.equal(response.headers.get('content-length'), String(h.bytes.length));
  assert.equal(response.headers.get('content-disposition'), 'inline; filename="everyone-selection-v1.pdf"');
  assert.match(response.headers.get('cache-control')!, /private.*no-store/u);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  const reader = response.body!.getReader(); const hash = createHash('sha256'); let size = 0; let chunks = 0;
  for (;;) {
    const part = await reader.read(); if (part.done) break;
    assert.ok(part.value.length > 0 && part.value.length <= 64 * 1024, 'HTTP delivery must not buffer the full PDF as one chunk');
    hash.update(part.value); size += part.value.length; chunks++;
  }
  assert.equal(size, h.bytes.length); assert.ok(chunks > 1);
  assert.equal(hash.digest('hex'), createHash('sha256').update(h.bytes).digest('hex'));
  assert.equal(h.reads(), 1);
});

test('PDF body cancellation and request abort stop further delivery without another Storage read', async () => {
  const h = await storedPdf();
  const response = await handlePresentationRequest(h.request(), h.segments, actor, h.service, metadata);
  const reader = response.body!.getReader(); const first = await reader.read();
  assert.ok(!first.done && first.value.length < h.bytes.length);
  await reader.cancel(); assert.deepEqual(await reader.read(), { value: undefined, done: true });
  const controller = new AbortController();
  const aborted = await handlePresentationRequest(h.request(controller.signal), h.segments, actor, h.service, metadata);
  const abortedReader = aborted.body!.getReader(); await abortedReader.read(); controller.abort();
  await assert.rejects(abortedReader.read(), error => error instanceof Error && error.name === 'AbortError');
  assert.equal(h.reads(), 2);
});

test('PDF integrity or current authorization failure returns no successful streamed response', async () => {
  for (const [options, expected] of [[{ corrupt: true }, 'SOURCE_UNREADABLE'], [{ denied: true }, 'ACCESS_DENIED']] as const) {
    const h = await storedPdf(options);
    await assert.rejects(handlePresentationRequest(h.request(), h.segments, actor, h.service, metadata),
      error => error instanceof DomainError && error.code === expected);
    assert.equal(h.reads(), options.corrupt ? 1 : 0);
  }
});
