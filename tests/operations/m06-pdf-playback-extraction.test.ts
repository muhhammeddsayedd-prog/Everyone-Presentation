import assert from 'node:assert/strict';
import test from 'node:test';
import { PLAYBACK_SCOPE as scope, extractedV1PlaybackTarget, playbackHarnessHtml } from '../../tools/extract-m06-v1-pdf-playback.mts';
import { nativePresentation } from '../worker/presentation-native-fixture.ts';
const token = Buffer.alloc(32, 9).toString('base64url'), href = `http://127.0.0.1:3000/m/${token}/versions/${scope.version}/media/${scope.video}`;
function fixture() { const snapshot = nativePresentation([0], false).snapshot; snapshot.version_id = scope.version; snapshot.series_id = scope.series; snapshot.workspace_id = scope.workspace; snapshot.audience_snapshot.scope = 'external'; for (const slide of snapshot.slides) { slide.version_id = scope.version; if (slide.video_asset_id) slide.video_asset_id = scope.video; } snapshot.asset_inventory[0].asset_id = scope.video; return snapshot; }
test('harness extracts the exact existing annotation rather than a caller-supplied navigation target', () => {
  const result = extractedV1PlaybackTarget(fixture(), [[], [href]]); assert.equal(result.href, href); assert.equal(result.page, 2);
  const html = playbackHarnessHtml(result.href); assert.ok(html.includes('Extracted actual PDF link')); assert.ok(html.includes('target="_blank" rel="noopener noreferrer"')); assert.ok(html.includes('name="referrer" content="no-referrer"')); assert.ok(html.includes("default-src 'none'; base-uri 'none'; form-action 'none'")); assert.equal((html.match(/href=/gu) ?? []).length, 1); assert.ok(!html.includes('<script'));
});
test('foreign version/workspace/video/origin, canonical links and injected URL attributes are denied', () => {
  for (const change of [(s: ReturnType<typeof fixture>) => { s.version_id = scope.export; }, (s: ReturnType<typeof fixture>) => { s.workspace_id = scope.export; }, (s: ReturnType<typeof fixture>) => { s.series_id = scope.export; }, (s: ReturnType<typeof fixture>) => { s.asset_inventory[0].asset_id = scope.export; }]) { const snapshot = fixture(); change(snapshot); assert.throws(() => extractedV1PlaybackTarget(snapshot, [[], [href]])); }
  for (const target of [href.replace('127.0.0.1', 'untrusted.invalid'), href + '?extra=1', href + '#extra', href.replace('/m/', '/presentations/'), href.replace(scope.video, scope.export), `${href}" onclick="private()`]) { assert.throws(() => extractedV1PlaybackTarget(fixture(), [[], [target]])); assert.throws(() => playbackHarnessHtml(target)); }
  assert.throws(() => extractedV1PlaybackTarget(fixture(), [[], []])); assert.throws(() => extractedV1PlaybackTarget(fixture(), [[], [href, href]]));
});
