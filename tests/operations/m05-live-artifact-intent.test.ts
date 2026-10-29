import assert from 'node:assert/strict';
import test from 'node:test';
import { parseLiveInspectionIntent } from '../../tools/inspect-m05-live-pdf.mts';
const intent = { schema_version: '1.0', versions: [{ version_id: 'a5050000-0000-4000-8000-000000000001', pdf_path: 'C:\\Users\\iway\\Downloads\\synthetic.pdf', pdf_sha256: 'a'.repeat(64), snapshot_sha256: 'b'.repeat(64), image_files: [{ asset_id: 'a5050000-0000-4000-8000-000000000002', path: 'C:\\Users\\iway\\Downloads\\synthetic.jfif', sha256: 'c'.repeat(64) }] }] };
test('pure private live intent validation admits only bounded fixed-scope downloads and exact metadata', () => { assert.deepEqual(parseLiveInspectionIntent(intent), intent); });
test('private live intent rejects credentials, arbitrary paths, URLs, duplicates and unknown keys', () => {
  for (const mutate of [(value: typeof intent) => { value.versions[0].pdf_path = 'D:\\unrelated\\private.pdf'; }, (value: typeof intent) => { value.versions[0].pdf_path = 'https://untrusted.invalid/private.pdf'; }, (value: typeof intent) => { value.versions[0].image_files[0].path = 'C:\\Users\\iway\\Downloads\\.env.worker.local'; }, (value: typeof intent) => { value.versions.push(value.versions[0]); }, (value: typeof intent) => { value.versions[0].snapshot_sha256 = 'invalid'; }, (value: typeof intent) => { Object.assign(value, { token: 'not-allowed' }); }]) { const value = structuredClone(intent); mutate(value); assert.throws(() => parseLiveInspectionIntent(value)); }
});
