import assert from 'node:assert/strict';
import test from 'node:test';
import { feedbackSummaryDto, parseFeedbackSummaryVersionId } from '../../packages/domain/src/feedback-summary.ts';

const version = '10000000-0000-4000-8000-000000000001';
const slide = '20000000-0000-4000-8000-000000000001';
const counts = { preferred: 2, maybe: 1, not_preferred: 0, comment_count: 150, unresolved_count: 101 };
const summary = () => ({ version_id: version, per_slide: [{ version_slide_id: slide, ...counts }], totals: { ...counts } });
const invalid = (error: unknown) => error instanceof Error && 'code' in error && error.code === 'DEPENDENCY_UNAVAILABLE';

test('new summary request uses its advertised UUID contract and refuses malformed IDs safely', () => {
  assert.equal(parseFeedbackSummaryVersionId(version), version);
  for (const value of ['not-a-uuid', '10000000-0000-4000-8000-00000000000A', null, {}, 'foreign/path']) {
    assert.throws(() => parseFeedbackSummaryVersionId(value), (e: unknown) => e instanceof Error && 'code' in e && e.code === 'VALIDATION_FAILED');
  }
});

test('closed feedback summary retains full counts beyond a list page and permits zero slides', () => {
  assert.deepEqual(feedbackSummaryDto(summary()), summary());
  const zero = { preferred: 0, maybe: 0, not_preferred: 0, comment_count: 0, unresolved_count: 0 };
  assert.deepEqual(feedbackSummaryDto({ version_id: version, per_slide: [], totals: zero }), { version_id: version, per_slide: [], totals: zero });
});

test('feedback summary rejects mismatched totals, unsafe counts, duplicate slides and overlong versions', () => {
  for (const mutate of [
    (s: ReturnType<typeof summary>) => { s.totals.comment_count++; },
    (s: ReturnType<typeof summary>) => { s.per_slide[0].preferred = -1; },
    (s: ReturnType<typeof summary>) => { s.per_slide[0].maybe = Number.MAX_SAFE_INTEGER + 1; },
    (s: ReturnType<typeof summary>) => { s.per_slide[0].unresolved_count = 151; },
    (s: ReturnType<typeof summary>) => { s.per_slide.push(s.per_slide[0]); },
    (s: ReturnType<typeof summary>) => { s.version_id = 'foreign/path'; },
    (s: ReturnType<typeof summary>) => { s.per_slide = Array.from({ length: 1001 }, () => s.per_slide[0]); },
  ]) { const value = summary(); mutate(value); assert.throws(() => feedbackSummaryDto(value), invalid); }
});

test('feedback summary rejects comment bodies, author metadata and unknown fields at every level', () => {
  for (const value of [
    { ...summary(), comments: [] },
    { ...summary(), per_slide: [{ ...summary().per_slide[0], body: 'private synthetic body' }] },
    { ...summary(), totals: { ...counts, author_display_name: 'Synthetic' } },
    { ...summary(), per_slide: [{ ...summary().per_slide[0], version_slide_id: 'not-a-uuid' }] },
  ]) assert.throws(() => feedbackSummaryDto(value), invalid);
});
