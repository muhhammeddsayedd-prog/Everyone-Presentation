import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { createBearerUserClient } from '../src/client.ts';
import { createCentralPresentations } from '../src/presentation.ts';
import { createCentralGuestReviews } from '../src/guest-reviews.ts';
import { presentationAssetRead } from '../src/presentation-storage.ts';
import { guestAssetRead } from '../src/guest-storage.ts';
import { presentationFixture, presentationId, presentationVersionFixture } from '../../../tests/fixtures/presentation.ts';

const snapshot = presentationFixture(), version = presentationVersionFixture(snapshot);
const versionId = version.id, assetId = snapshot.slides[1].video_asset_id!;
const now = Date.parse('2026-10-30T00:00:00Z'), origin = 'https://synthetic-transcript.invalid';
const actor = { principal_id: presentationId(51) }, credential = Buffer.alloc(32, 9).toString('base64url');
const original = '  نص عربي\nEnglish source <script>literal</script>\t\r\n';
const digest = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex');
const companion = () => ({ version_id: versionId, asset_id: assetId, status: 'available', original_text: original,
  languages: ['Arabic', 'English'], source_kind: 'source_transcript', source_sha256: digest(original) });
const frozen = snapshot.asset_inventory.find(asset => asset.asset_id === assetId)!;
const asset = { id: assetId, purpose: 'candidate_video', filename: 'synthetic-original.mp4', mime_type: frozen.mime_type,
  size_bytes: frozen.byte_size, sha256: frozen.sha256, status: 'ready', duration_ms: frozen.duration_ms, width: frozen.width,
  height: frozen.height, source_asset_id: null, source_timestamp_ms: null, created_at: snapshot.created_at };
const base = { asset, bucket: frozen.bucket, object_key: frozen.object_key };
async function fixture(initial: unknown = companion()) {
  let transcript = initial, denied = false; const calls: string[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const path = new URL(String(input)).pathname; calls.push(path);
    if (path === '/auth/v1/user') return Response.json({ id: actor.principal_id, role: 'authenticated', aud: 'authenticated', is_anonymous: false });
    if (path.endsWith('/eps_get_version')) return Response.json(version);
    const result = { ...base, ...(transcript === undefined ? {} : { transcript }) };
    if (path.endsWith('/eps_get_version_asset')) return denied ? Response.json({ code: 'P0001', message: 'ACCESS_DENIED' }, { status: 400 }) : Response.json(result);
    if (path.endsWith('/eps_guest_operation')) {
      const { p_operation: operation } = JSON.parse(String(init?.body));
      if (denied) return Response.json({ code: 'P0001', message: 'REVIEW_ACCESS_DENIED' }, { status: 400 });
      if (operation === 'session') return Response.json({ expires_at: new Date(now + 3600000).toISOString(), series_id: version.series_id,
        version_id: versionId, download_enabled: true, display_name: null, guest_session_id: presentationId(80) });
      assert.ok(['get_asset', 'grant_asset'].includes(operation));
      return Response.json({ ...result, grant_token: credential, expires_at: new Date(now + 60000).toISOString(), parent_expires_at: new Date(now + 3600000).toISOString() });
    }
    if (path.includes('/object/info/')) return Response.json({ id: assetId, name: frozen.object_key, bucket_id: frozen.bucket, version: 'synthetic', size: asset.size_bytes, content_type: asset.mime_type });
    if (path.includes('/object/sign/')) return Response.json({ signedURL: `/object/sign/${frozen.bucket}/${frozen.object_key}?token=synthetic` });
    throw new Error('Unexpected synthetic request');
  };
  const client = createBearerUserClient({ url: origin, publishableKey: 'sb_publishable_synthetic', accessToken: 'synthetic-user' }, { fetch: fetcher });
  return { internal: await createCentralPresentations(client, { storageOrigin: origin, now: () => now }),
    guest: createCentralGuestReviews({ central: { url: origin, publishableKey: 'sb_publishable_synthetic' }, applicationOrigin: 'http://127.0.0.1:3000',
      replayKey: Buffer.alloc(32, 2), gatewayKey: Buffer.alloc(32, 3), now: () => now, fetch: fetcher }),
    calls, set: (value: unknown) => { transcript = value; }, deny: () => { denied = true; } };
}

test('existing internal, guest and saved-PDF playback return the exact frozen source companion', async () => {
  const h = await fixture();
  for (const result of [await h.internal.playVersionMedia(actor, versionId, assetId), await h.guest.playMedia(credential, versionId, assetId), await h.guest.playGrantMedia(credential, versionId, assetId)]) {
    assert.deepEqual((result as unknown as { transcript: unknown }).transcript, companion());
    assert.equal(result.source_version_id, versionId); assert.equal(result.asset_id, assetId);
  }
  assert.ok(h.calls.every(path => !/candidate_media|candidate_profiles|transcript_asset/u.test(path)), 'Playback must never read the live library or transcript object.');
});

test('legacy missing companions and captured absence stay explicit without live-source fallback', async () => {
  const h = await fixture(); h.set(undefined);
  const absent = { version_id: versionId, asset_id: assetId, status: 'not_captured', original_text: null, languages: [], source_kind: 'source_transcript', source_sha256: null };
  assert.deepEqual((await h.internal.playVersionMedia(actor, versionId, assetId) as unknown as { transcript: unknown }).transcript, absent);
  h.set({ ...absent, status: 'not_provided' });
  assert.deepEqual((await h.guest.playGrantMedia(credential, versionId, assetId) as unknown as { transcript: unknown }).transcript, { ...absent, status: 'not_provided' });
});

test('wrong-version/video, altered hash and malformed source companions fail closed before disclosure', async () => {
  const h = await fixture();
  for (const change of [{ version_id: presentationId(900) }, { asset_id: presentationId(901) }, { source_sha256: '0'.repeat(64) },
    { original_text: 'bad\u0000text' }, { original_text: '\ud800' }, { original_text: 'x'.repeat(200001) }, { languages: ['\u0000'] },
    { source_kind: 'reviewed' }, { internal_note: 'must not be projected' }, { status: 'not_captured' }]) {
    h.set({ ...companion(), ...change });
    await assert.rejects(h.internal.playVersionMedia(actor, versionId, assetId));
    await assert.rejects(h.guest.playMedia(credential, versionId, assetId));
    await assert.rejects(h.guest.playGrantMedia(credential, versionId, assetId));
  }
});

test('a valid retained transcript never bypasses current video authorization', async () => {
  const h = await fixture(); h.deny();
  await assert.rejects(h.internal.playVersionMedia(actor, versionId, assetId));
  await assert.rejects(h.guest.playMedia(credential, versionId, assetId));
  await assert.rejects(h.guest.playGrantMedia(credential, versionId, assetId));
  assert.equal(h.calls.some(path => path.includes('/storage/')), false);
});

test('frozen English companions preserve source scope and reject altered translation digests in every playback path', async () => {
  const english = { english_text: 'A synthetic introduction in English.', english_status: 'available',
    english_sha256: digest('A synthetic introduction in English.') };
  const h = await fixture({ ...companion(), ...english });
  const readAll = () => [() => h.internal.playVersionMedia(actor, versionId, assetId),
    () => h.guest.playMedia(credential, versionId, assetId), () => h.guest.playGrantMedia(credential, versionId, assetId)];
  for (const read of readAll()) assert.deepEqual((await read()).transcript, { ...companion(), ...english });
  for (const change of [{ english_sha256: '0'.repeat(64) }, { english_text: 'Altered English text.' },
    { english_status: 'not_captured' }, { version_id: presentationId(900) }, { asset_id: presentationId(901) }]) {
    h.set({ ...companion(), ...english, ...change });
    for (const read of readAll()) await assert.rejects(read());
  }
  h.set({ ...companion(), english_text: null, english_status: 'not_captured', english_sha256: null });
  for (const read of readAll()) assert.equal((await read()).transcript?.english_text, null);
  h.deny();
  for (const read of readAll()) await assert.rejects(read());
});

test('frame and PDF metadata cannot smuggle a transcript outside video playback', () => {
  for (const [purpose, mime_type, filename] of [['candidate_frame', 'image/jpeg', 'synthetic-frame.jpg'], ['presentation_pdf', 'application/pdf', 'synthetic.pdf']]) {
    const item = { ...base, asset: { ...asset, purpose, mime_type, filename, duration_ms: null } };
    assert.doesNotThrow(() => presentationAssetRead(item));
    assert.throws(() => presentationAssetRead({ ...item, transcript: companion() }));
    const scoped = { ...item, grant_token: credential, expires_at: new Date(now + 60000).toISOString() };
    assert.doesNotThrow(() => guestAssetRead(scoped, now));
    assert.throws(() => guestAssetRead({ ...scoped, transcript: companion() }, now));
  }
});
