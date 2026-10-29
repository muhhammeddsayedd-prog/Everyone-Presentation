import assert from 'node:assert/strict';
import test from 'node:test';
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
