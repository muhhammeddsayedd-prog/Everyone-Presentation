import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { formatStudioDate, formatStudioDateTime, studioTimeZone } from '../../apps/web/lib/studio-time-zone.ts';
import { StudioDateTime, StudioTimeZoneProvider } from '../../apps/web/components/StudioTimeZone.tsx';

const instant = '2026-07-01T22:30:00.000Z';
test('Studio formats the same UTC instant in configured UTC/Cairo across midnight independently of host time zone', () => {
  const previous = process.env.TZ;
  try {
    process.env.TZ = 'Pacific/Honolulu';
    assert.equal(formatStudioDateTime(instant, 'UTC', 'en-GB'), '1 Jul 2026, 22:30');
    assert.equal(formatStudioDateTime(instant, 'Africa/Cairo', 'en-GB'), '2 Jul 2026, 01:30');
    assert.equal(formatStudioDate(instant, 'UTC', 'en-GB'), '1 Jul 2026');
    assert.equal(formatStudioDate(instant, 'Africa/Cairo', 'en-GB'), '2 Jul 2026');
    assert.equal(instant, '2026-07-01T22:30:00.000Z');
  } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; }
});

test('missing/invalid timezone uses Cairo and invalid timestamps remain explicitly unavailable', () => {
  for (const zone of [undefined, null, '', 'Not/A_Timezone', { timezone: 'UTC' }]) assert.equal(studioTimeZone(zone), 'Africa/Cairo');
  assert.equal(studioTimeZone('UTC'), 'UTC');
  assert.equal(formatStudioDateTime('invalid', 'UTC'), 'Date unavailable');
  assert.equal(formatStudioDate('invalid', 'Africa/Cairo'), 'Date unavailable');
});

test('shared time component preserves machine UTC value and defaults to Cairo without a privileged guest settings read', () => {
  const fallback = renderToStaticMarkup(createElement(StudioDateTime, { value: instant }));
  assert.match(fallback, /title="Africa\/Cairo"/u); assert.match(fallback, /dateTime="2026-07-01T22:30:00.000Z"/u);
  const configured = renderToStaticMarkup(createElement(StudioTimeZoneProvider, { timeZone: 'UTC' }, createElement(StudioDateTime, { value: instant, dateOnly: true })));
  assert.match(configured, /title="UTC"/u); assert.doesNotMatch(configured, /Africa\/Cairo/u);
});
