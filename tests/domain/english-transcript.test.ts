import test from 'node:test';
import assert from 'node:assert/strict';
import { candidateEnglishFields, versionEnglishFields } from '../../packages/domain/src/english-transcript.ts';
import { parseVersionTranscript } from '../../packages/domain/src/presentation-transcript.ts';

const hash = 'a'.repeat(64);
test('legacy raw-language fields never become an English projection', () => {
  assert.equal(candidateEnglishFields({ original_transcript: 'اسمي إبراهيم' }), undefined);
  assert.equal(versionEnglishFields({ original_text: 'اسمي إبراهيم', status: 'available' }), undefined);
});
test('candidate English projection accepts the complete available pair and explicit absence states', () => {
  assert.deepEqual(candidateEnglishFields({ english_transcript: 'My name is Ibrahim.', english_transcript_status: 'available' }),
    { english_transcript: 'My name is Ibrahim.', english_transcript_status: 'available' });
  for (const english_transcript_status of ['not_provided', 'not_captured', 'unavailable']) {
    assert.deepEqual(candidateEnglishFields({ english_transcript: null, english_transcript_status }), { english_transcript: null, english_transcript_status });
  }
});
test('candidate partial pairs, false availability and hidden raw fallback are rejected', () => {
  for (const value of [{ english_transcript: 'English' }, { english_transcript_status: 'available' },
    { english_transcript: '', english_transcript_status: 'available' },
    { english_transcript: 'Raw fallback', english_transcript_status: 'unavailable' },
    { english_transcript: null, english_transcript_status: 'ar' },
    { english_transcript: 'اسمي إبراهيم', english_transcript_status: 'available' },
    { english_transcript: null, english_transcript_status: 'available' }]) assert.throws(() => candidateEnglishFields(value));
});
test('English text has the same bounded Unicode and plain-text control boundary as saved transcripts', () => {
  const valid = { english_transcript: 'English\nFrançois\t16 years', english_transcript_status: 'available' };
  assert.equal(candidateEnglishFields(valid)?.english_transcript, valid.english_transcript);
  for (const text of [' ', 'English\u0000private', '\ud800', 'x'.repeat(200001)]) {
    assert.throws(() => candidateEnglishFields({ ...valid, english_transcript: text }));
  }
});
test('version English projection binds availability to text and an explicit captured digest', () => {
  assert.deepEqual(versionEnglishFields({ english_text: 'English.', english_status: 'available', english_sha256: hash }),
    { english_text: 'English.', english_status: 'available', english_sha256: hash });
  for (const english_status of ['not_captured', 'not_provided', 'unavailable']) {
    assert.deepEqual(versionEnglishFields({ english_text: null, english_status, english_sha256: null }),
      { english_text: null, english_status, english_sha256: null });
  }
  for (const value of [{ english_text: 'English.', english_status: 'available' },
    { english_text: 'English.', english_status: 'available', english_sha256: null },
    { english_text: null, english_status: 'not_captured', english_sha256: hash }]) assert.throws(() => versionEnglishFields(value));
});
test('a fixed legacy companion remains unchanged while optional English fields are independently validated', () => {
  const legacy = { version_id: 'synthetic-version', asset_id: 'synthetic-video', status: 'available', original_text: 'اسمي إبراهيم',
    languages: ['ar'], source_kind: 'source_transcript', source_sha256: hash };
  assert.deepEqual(parseVersionTranscript(legacy), legacy);
  const modern = { ...legacy, english_text: 'My name is Ibrahim.', english_status: 'available', english_sha256: hash };
  assert.deepEqual(parseVersionTranscript(modern), modern);
  assert.throws(() => parseVersionTranscript({ ...modern, english_text: null }));
  assert.throws(() => parseVersionTranscript({ ...modern, display_language: 'ar' }));
});
