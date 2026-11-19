import assert from 'node:assert/strict';
import test from 'node:test';
import { LIVE_SEARCH_DELAY_MS, liveFilterDelay, liveFilterValues, liveSearchDelay, liveSearchTerm } from '../../apps/web/lib/live-search.ts';

test('typing waits for the short pause; clearing or whitespace-only changes apply at once', () => {
  assert.equal(LIVE_SEARCH_DELAY_MS, 250);
  assert.equal(liveSearchDelay('ann', ''), 250);
  assert.equal(liveSearchDelay('anna', 'ann'), 250);
  assert.equal(liveSearchDelay('', 'anna'), 0, 'cleared: the unfiltered list returns without a timer');
  assert.equal(liveSearchDelay('   ', 'anna'), 0, 'only spaces counts as cleared');
  assert.equal(liveSearchDelay('anna ', 'anna'), 0, 'a trailing space never starts another search');
  assert.equal(liveSearchDelay('x', '', 100), 100);
  assert.equal(liveSearchTerm('  Anna Lee '), 'Anna Lee');
});

test('typed filters debounce, while choices, cleared values and removed chips apply at once', () => {
  const typed = ['city', 'language'] as const;
  const settled = { include_unknown: 'true', city: 'Cai' };
  assert.equal(liveFilterDelay({ ...settled, city: 'Cairo' }, settled, typed), 250);
  assert.equal(liveFilterDelay({ ...settled, language: 'Arabic' }, settled, typed), 250);
  assert.equal(liveFilterDelay({ ...settled, city: '' }, settled, typed), 0, 'clearing a typed filter');
  assert.equal(liveFilterDelay({ include_unknown: 'true' }, settled, typed), 0, 'removing a chip');
  assert.equal(liveFilterDelay({ ...settled, include_unknown: 'false' }, settled, typed), 0, 'a toggle');
  assert.equal(liveFilterDelay({ ...settled, review_status: 'reviewed' }, settled, typed), 0, 'a radio');
  assert.equal(liveFilterDelay({ ...settled, city: 'Cai ' }, settled, typed), 0, 'whitespace only');
  assert.equal(liveFilterDelay({ ...settled }, settled, typed), 0, 'unchanged');
  assert.deepEqual(liveFilterValues({ city: ' Cairo ', review_status: 'reviewed' }, typed), { city: 'Cairo', review_status: 'reviewed' });
});
