import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGuestIdentity, parseGuestCommentCreate, parseGuestCommentPatch, parsePreferenceSet, parseReviewLinkCreate,
  parseReviewLinkPatch, parseCommentCreate, parseCommentPatch, parseGuestListOptions, guestFeedbackDto } from '../../packages/domain/src/guest.ts';

test('guest identity is a bounded self-declared label, never an authorization claim', () => {
  assert.deepEqual(parseGuestIdentity({ display_name: '  A reviewer  ', company: null }), { display_name: 'A reviewer', company: null });
  for (const value of [{ display_name: '' }, { display_name: '   ' }, { display_name: 'x', principal_id: 'other' }, { display_name: 'x\u0000' }, { display_name: 'x'.repeat(121) }])
    assert.throws(() => parseGuestIdentity(value));
});
test('guest comment creation rejects visibility, impersonation and mutation state', () => {
  const input = { version_slide_id: 'slide-1', body: 'Review this option', parent_comment_id: 'comment-1' };
  assert.deepEqual(parseGuestCommentCreate(input), input);
  for (const extra of [{ visibility: 'internal' }, { guest_session_id: 'other' }, { resolved: true }, { version_id: 'other' }])
    assert.throws(() => parseGuestCommentCreate({ ...input, ...extra }));
  assert.throws(() => parseGuestCommentCreate({ version_slide_id: 'slide-1', body: ' '.repeat(10) }));
});
test('comment limits count Unicode characters consistently with JSON Schema and PostgreSQL', () => {
  const body = '🙂'.repeat(10000); assert.equal(parseGuestCommentCreate({ version_slide_id: 'slide-1', body }).body, body);
  assert.throws(() => parseGuestCommentCreate({ version_slide_id: 'slide-1', body: body + '🙂' }));
});
test('guest edits are row-version guarded body changes only', () => {
  assert.deepEqual(parseGuestCommentPatch({ row_version: 2, body: 'Updated' }), { row_version: 2, body: 'Updated' });
  for (const input of [{ row_version: 0, body: 'Updated' }, { row_version: 1, body: 'Updated', resolved: true }, { row_version: 1, body: 'Updated', author_display_name: 'Other' }])
    assert.throws(() => parseGuestCommentPatch(input));
});
test('preferences are explicit supplied values with optional concurrency and clear', () => {
  for (const value of ['preferred', 'maybe', 'not_preferred', null]) assert.deepEqual(parsePreferenceSet({ version_slide_id: 'slide-1', value }), { version_slide_id: 'slide-1', value });
  assert.deepEqual(parsePreferenceSet({ version_slide_id: 'slide-1', value: null, row_version: 1 }), { version_slide_id: 'slide-1', value: null, row_version: 1 });
  for (const value of ['main', 'backup', '', true]) assert.throws(() => parsePreferenceSet({ version_slide_id: 'slide-1', value }));
  assert.throws(() => parsePreferenceSet({ version_slide_id: 'slide-1', value: 'preferred', guest_session_id: 'other' }));
});
test('link inputs cannot repoint an existing link to another series', () => {
  assert.deepEqual(parseReviewLinkCreate({ series_id: 'series-1' }), { series_id: 'series-1' });
  assert.deepEqual(parseReviewLinkPatch({ row_version: 3, download_enabled: false }), { row_version: 3, download_enabled: false });
  assert.throws(() => parseReviewLinkPatch({ row_version: 3, series_id: 'series-other' }));
  assert.throws(() => parseReviewLinkCreate({ series_id: 'series-1', token: 'provided' }));
  assert.throws(() => parseReviewLinkCreate({ series_id: '../other' }));
  assert.throws(() => parseReviewLinkCreate({ series_id: 'series-1', expires_at: '2026-02-30T00:00:00Z' }));
});
test('internal feedback inputs require explicit visibility and bounded moderation', () => {
  assert.deepEqual(parseCommentCreate({ version_slide_id: 'slide-1', body: 'Internal note', visibility: 'internal' }), { version_slide_id: 'slide-1', body: 'Internal note', visibility: 'internal' });
  assert.throws(() => parseCommentCreate({ version_slide_id: 'slide-1', body: 'No visibility' }));
  assert.deepEqual(parseCommentPatch({ row_version: 1, resolved: true }), { row_version: 1, resolved: true });
  assert.throws(() => parseCommentPatch({ row_version: 1 }));
});
test('guest lists reject malformed cursors and hidden authority fields', () => {
  assert.deepEqual(parseGuestListOptions({ limit: 100 }), { limit: 100 });
  for (const input of [{ limit: 101 }, { limit: 0 }, { cursor: '' }, { cursor: 'x'.repeat(4001) }, { principal_id: 'other' }]) assert.throws(() => parseGuestListOptions(input));
});
test('external projection refuses internal comments even if a database response contains them', () => {
  const comment = { id: 'comment-1', series_id: 'series-1', version_id: 'version-1', version_slide_id: 'slide-1', guest_session_id: null,
    author_display_name: 'Producer', company: null, visibility: 'internal', body: 'Private', parent_comment_id: null, resolved: false,
    row_version: 1, created_at: '2026-10-30T00:00:00Z', updated_at: '2026-10-30T00:00:00Z' };
  assert.throws(() => guestFeedbackDto({ comments: [comment], preferences: [], version_id: 'version-1', page: { next_cursor: null } }, true));
  assert.equal(guestFeedbackDto({ comments: [{ ...comment, visibility: 'external' }], preferences: [], version_id: 'version-1', page: { next_cursor: null } }, true).comments.length, 1);
});
