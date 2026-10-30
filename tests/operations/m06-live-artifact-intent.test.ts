import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { parseLiveGuestInspectionIntent, inspectGuestMediaAnnotations } from '../../tools/inspect-m06-live-pdf.mts';
import { nativePresentation } from '../worker/presentation-native-fixture.ts';

const version = 'a6060000-0000-4000-8000-000000000001', asset = 'a6060000-0000-4000-8000-000000000002';
const intent = { schema_version: '1.0', exports: [{ version_id: version, export_id: 'a6060000-0000-4000-8000-000000000003', review_link_id: 'a6060000-0000-4000-8000-000000000004', pdf_path: 'C:\\Users\\iway\\Downloads\\synthetic.pdf', pdf_sha256: 'a'.repeat(64), snapshot_path: path.resolve(`.local/m06-live/version-${version}.snapshot.json`), snapshot_sha256: 'b'.repeat(64), image_files: [{ asset_id: asset, path: 'C:\\Users\\iway\\Downloads\\synthetic.jpg', sha256: 'c'.repeat(64) }] }] };
test('guest inspection intent accepts only explicit bounded artifact IDs, hashes and local paths', () => {
  assert.deepEqual(parseLiveGuestInspectionIntent(intent), intent);
  const repeatedVersion = structuredClone(intent); repeatedVersion.exports.push({ ...repeatedVersion.exports[0], export_id: 'a6060000-0000-4000-8000-000000000005' });
  assert.deepEqual(parseLiveGuestInspectionIntent(repeatedVersion), repeatedVersion);
});
test('guest inspection intent rejects credentials, escape paths, substituted snapshots and duplicate exports', () => {
  const mutations = [
    (v: typeof intent) => { Object.assign(v, { grant_token: 'private-value-must-not-be-input' }); },
    (v: typeof intent) => { v.exports[0].pdf_path = 'https://untrusted.invalid/export.pdf'; },
    (v: typeof intent) => { v.exports[0].pdf_path = 'D:\\unrelated\\private.pdf'; },
    (v: typeof intent) => { v.exports[0].snapshot_path = path.resolve('.local/m05-live/version-other.snapshot.json'); },
    (v: typeof intent) => { v.exports[0].snapshot_path = path.resolve('.local/m06-live/../../unrelated.snapshot.json'); },
    (v: typeof intent) => { v.exports[0].snapshot_sha256 = 'invalid'; },
    (v: typeof intent) => { v.exports[0].image_files[0].path = 'C:\\Users\\iway\\Downloads\\.env.worker.local'; },
    (v: typeof intent) => { v.exports.push(v.exports[0]); },
  ];
  for (const mutate of mutations) { const value = structuredClone(intent); mutate(value); assert.throws(() => parseLiveGuestInspectionIntent(value)); }
});
test('PDF annotations bind one opaque grant to each exact frozen page video and reveal no grant when absent', () => {
  const { snapshot } = nativePresentation([0, 1], false); const token = 's'.repeat(43);
  const urls = snapshot.slides.map(slide => slide.video_asset_id ? [`${snapshot.render_configuration.application_origin}/m/${token}/versions/${snapshot.version_id}/media/${slide.video_asset_id}`] : []);
  assert.deepEqual(inspectGuestMediaAnnotations(snapshot, urls), { version_id: snapshot.version_id, grant_token: token });
  const absent = nativePresentation([], false).snapshot; assert.equal(inspectGuestMediaAnnotations(absent, [[]]), null);
  for (const mutation of [
    (v: string[][]) => { v[1][0] = v[1][0].replace('/m/', '/presentations/'); },
    (v: string[][]) => { v[1][0] = v[1][0].replace('127.0.0.1', 'untrusted.invalid'); },
    (v: string[][]) => { v[1][0] += '?access=extra'; },
    (v: string[][]) => { v[1][0] = v[1][0].replace(snapshot.version_id, version); },
    (v: string[][]) => { v[1][0] = v[1][0].replace(snapshot.slides[1].video_asset_id!, asset); },
    (v: string[][]) => { v[2][0] = v[2][0].replace(token, 'x'.repeat(43)); },
    (v: string[][]) => { v[0].push(v[1][0]); },
    (v: string[][]) => { v[1].push(v[1][0]); },
  ]) { const value = structuredClone(urls); mutation(value); assert.throws(() => inspectGuestMediaAnnotations(snapshot, value)); }
});
test('untrusted private artifact values cannot enter an inspection exception', () => {
  const marker = 'PRIVATE_ARTIFACT_VALUE_MUST_NOT_BE_LOGGED';
  const value = structuredClone(intent); Object.assign(value, { token: marker });
  const closed = (reason: unknown) => reason instanceof Error && reason.message === 'M06_LIVE_ARTIFACT_INSPECTION_UNCONFIRMED' && !reason.stack?.includes(marker);
  assert.throws(() => parseLiveGuestInspectionIntent(value), closed);
  const { snapshot } = nativePresentation([0], false);
  assert.throws(() => inspectGuestMediaAnnotations(snapshot, [[], [`https://${marker}.invalid/private`]]), closed);
});
