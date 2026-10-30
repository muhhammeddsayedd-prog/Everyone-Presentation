import assert from 'node:assert/strict';
import test from 'node:test';
import { parseVersionTranscript } from '../../packages/domain/src/presentation-transcript.ts';

const available = (original_text = 'النص\nEnglish') => ({ version_id: 'version-1', asset_id: 'video-1', status: 'available',
  original_text, languages: ['Arabic', 'English'], source_kind: 'source_transcript', source_sha256: 'a'.repeat(64) });
test('transcript parsing preserves source text, language order and escaped-renderable markup exactly', () => {
  const value = available(' \t<script>text</script>\nنص\r\n');
  assert.deepEqual(parseVersionTranscript(value), value); assert.notEqual(parseVersionTranscript(value), value);
  const repeated = { ...value, languages: [' Arabic ', 'Arabic', 'ARABIC', 'İ', 'i'] };
  assert.deepEqual(parseVersionTranscript(repeated), repeated, 'Source language values and order are preserved, without locale folding or deduplication.');
});
test('the 200k transcript limit counts Unicode codepoints rather than UTF16 units', () => {
  const text = '😀'.repeat(200000); assert.equal(parseVersionTranscript(available(text)).original_text, text);
  assert.throws(() => parseVersionTranscript(available(text + 'x')));
});
test('legacy and captured absence cannot retain text, hash or inferred languages', () => {
  for (const status of ['not_captured', 'not_provided']) {
    const value = { ...available(), status, original_text: null, languages: [], source_sha256: null };
    assert.deepEqual(parseVersionTranscript(value), value);
    for (const change of [{ original_text: 'text' }, { source_sha256: 'b'.repeat(64) }, { languages: ['English'] }]) assert.throws(() => parseVersionTranscript({ ...value, ...change }));
  }
});
test('closed source contract rejects reviewed claims, private extras, malformed Unicode/control text and unbounded languages', () => {
  for (const change of [{ source_kind: 'automatic_unreviewed' }, { source_kind: 'reviewed' }, { internal_note: 'private' }, { original_text: '\ud800' },
    { original_text: 'text\u0000' }, { original_text: ' \n\t' }, { source_sha256: 'A'.repeat(64) },
    { languages: ['English\t'] }, { languages: ['x'.repeat(1001)] }, { languages: Array.from({ length: 101 }, (_, n) => String(n)) }]) assert.throws(() => parseVersionTranscript({ ...available(), ...change }));
});
