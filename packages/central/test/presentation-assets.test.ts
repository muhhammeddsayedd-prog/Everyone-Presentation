import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { DomainError, type MediaAsset } from '@eps/domain';
import { createBearerUserClient } from '../src/client.ts';
import { createCentralPresentations } from '../src/presentation.ts';
import { presentationFixture, presentationId, presentationVersionFixture } from '../../../tests/fixtures/presentation.ts';

const actor = { principal_id: presentationId(51) }; const origin = 'https://synthetic-version-assets.invalid';
const now = Date.parse('2026-10-29T22:00:00Z'); const jpeg = Buffer.from([255, 216, 255, 1, 2, 3]);
const pdf = Buffer.from('%PDF-1.7\nSynthetic bounded transport fixture\n%%EOF');
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const code = (name: string) => (error: unknown) => error instanceof DomainError && error.code === name;
async function fixture(options: { foreignSign?: boolean; corrupt?: boolean; storageDenied?: boolean } = {}) {
  const snapshot = presentationFixture(); snapshot.slides[1].frames[0].sha256 = hash(jpeg);
  const version = { ...presentationVersionFixture(snapshot), status: 'ready' as const, pdf_asset_id: presentationId(60), manifest_asset_id: presentationId(61), ready_at: new Date(now).toISOString() };
  const records = new Map<string, { asset: MediaAsset; bucket: string; object_key: string }>();
  for (const asset of snapshot.asset_inventory) records.set(asset.asset_id, { asset: { id: asset.asset_id, purpose: asset.asset_kind,
    filename: asset.asset_kind === 'candidate_frame' ? 'synthetic-frame.jpg' : 'synthetic-original.mp4', mime_type: asset.mime_type,
    size_bytes: asset.asset_kind === 'candidate_frame' ? jpeg.length : asset.byte_size, sha256: asset.asset_kind === 'candidate_frame' ? hash(jpeg) : asset.sha256,
    status: 'ready', duration_ms: asset.duration_ms, width: asset.width, height: asset.height, source_asset_id: asset.source_asset_id,
    source_timestamp_ms: asset.timestamp_ms, created_at: snapshot.created_at }, bucket: asset.bucket, object_key: asset.object_key });
  records.set(version.pdf_asset_id, { asset: { id: version.pdf_asset_id, purpose: 'presentation_pdf', filename: 'synthetic.pdf', mime_type: 'application/pdf',
    size_bytes: pdf.length, sha256: hash(pdf), status: 'ready', duration_ms: null, width: null, height: null, source_asset_id: null, source_timestamp_ms: null, created_at: snapshot.created_at },
    bucket: 'eps-presentations', object_key: `versions/${version.id}/${version.pdf_asset_id}.pdf` });
  const calls: { path: string; method: string; body: unknown }[] = []; let authorized = true;
  const client = createBearerUserClient({ url: origin, publishableKey: 'sb_publishable_synthetic', accessToken: 'synthetic-user-token' }, { fetch: async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input)); const body = init?.body ? JSON.parse(String(init.body)) : null;
    calls.push({ path: url.pathname, method: init?.method ?? 'GET', body });
    if (url.pathname === '/auth/v1/user') return Response.json({ id: actor.principal_id, role: 'authenticated', aud: 'authenticated', is_anonymous: false });
    if (url.pathname.endsWith('/eps_get_version')) return Response.json(version);
    if (url.pathname.endsWith('/eps_get_version_asset')) return authorized ? Response.json(records.get(body.p_asset_id)) : Response.json({ code: 'P0001', message: 'ACCESS_DENIED' }, { status: 400 });
    const item = [...records.values()].find(record => url.pathname.endsWith(`/${record.bucket}/${record.object_key}`));
    if (!item) return Response.json({ message: 'Unmatched synthetic route' }, { status: 500 });
    if (options.storageDenied) return Response.json({ statusCode: '403', message: 'Private denial' }, { status: 403 });
    if (url.pathname.includes('/object/info/')) return Response.json({ id: item.asset.id, name: item.object_key, bucket_id: item.bucket, version: 'synthetic', size: item.asset.size_bytes, content_type: item.asset.mime_type });
    if (url.pathname.includes('/object/sign/')) return Response.json({ signedURL: options.foreignSign ? 'https://foreign.invalid/object?token=synthetic' : `/object/sign/${item.bucket}/${item.object_key}?token=synthetic` });
    return new Response(options.corrupt ? new Uint8Array(item.asset.size_bytes) : item.asset.purpose === 'presentation_pdf' ? pdf : jpeg,
      { headers: { 'content-type': item.asset.mime_type } });
  } });
  return { api: await createCentralPresentations(client, { storageOrigin: origin, now: () => now }), version, snapshot, calls, revoke: () => { authorized = false; } };
}
test('fixed-version frame/PDF bytes are hash checked; playback signs only its retained original for90seconds', async () => {
  const h = await fixture(); const frame = h.snapshot.slides[1].frames[0].asset_id; const video = h.snapshot.slides[1].video_asset_id!;
  assert.deepEqual(await h.api.getVersionMediaContent(actor, h.version.id, frame), { bytes: jpeg, mimeType: 'image/jpeg' });
  const content = await h.api.getVersionPdfContent(actor, h.version.id); assert.deepEqual(content.bytes, pdf); assert.equal(content.mimeType, 'application/pdf');
  const playback = await h.api.playVersionMedia(actor, h.version.id, video); assert.equal(playback.source_version_id, h.version.id); assert.equal(Date.parse(playback.expires_at), now + 90000);
  const download = await h.api.downloadVersionPdf(actor, h.version.id); assert.equal(download.size_bytes, pdf.length); assert.equal(download.version_id, h.version.id);
  assert.equal(new URL(download.download_url).searchParams.get('download'), download.filename);
  const signed = h.calls.filter(call => call.path.includes('/object/sign/')); assert.equal(signed.length, 2); assert.ok(signed.every(call => (call.body as { expiresIn: number }).expiresIn === 90));
  const before = h.calls.length; await assert.rejects(h.api.playVersionMedia(actor, h.version.id, presentationId(999)), code('RESOURCE_NOT_FOUND'));
  assert.equal(h.calls.slice(before).some(call => call.path.includes('/storage/')), false);
});
test('revoked scope, foreign signed destinations and changed bytes never fall back to broader media access', async () => {
  const corrupt = await fixture({ corrupt: true }); await assert.rejects(corrupt.api.getVersionPdfContent(actor, corrupt.version.id), code('SOURCE_UNREADABLE'));
  const foreign = await fixture({ foreignSign: true }); await assert.rejects(foreign.api.downloadVersionPdf(actor, foreign.version.id), code('CENTRAL_RESPONSE_INVALID'));
  const denied = await fixture({ storageDenied: true }); await assert.rejects(denied.api.downloadVersionPdf(actor, denied.version.id), code('ACCESS_DENIED'));
  const revoked = await fixture(); revoked.revoke(); await assert.rejects(revoked.api.playVersionMedia(actor, revoked.version.id, revoked.snapshot.slides[1].video_asset_id!), code('ACCESS_DENIED'));
  assert.equal(revoked.calls.some(call => call.path.includes('/storage/')), false);
});
