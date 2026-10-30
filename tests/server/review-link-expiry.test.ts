import assert from 'node:assert/strict';
import test from 'node:test';
import { reviewLinkLocalExpiry } from '../../apps/web/components/review-link-expiry.ts';

const cases = [
  { zone: 'Africa/Cairo', values: [
    ['2026-10-29T18:00:56.789Z', '2026-10-29T21:00'],
    ['2026-10-29T20:45:23.456Z', '2026-10-29T23:45'],
    ['2026-10-30T00:00:56.789Z', '2026-10-30T02:00'],
  ] },
  { zone: 'UTC', values: [
    ['2026-10-29T18:00:56.789Z', '2026-10-29T18:00'],
    ['2026-10-30T00:00:56.789Z', '2026-10-30T00:00'],
  ] },
  { zone: 'Asia/Kolkata', values: [
    ['2026-10-29T18:00:56.789Z', '2026-10-29T23:30'],
    ['2026-10-29T20:45:23.456Z', '2026-10-30T02:15'],
  ] },
];
for (const { zone, values } of cases) test(`review expiry displays the exact local minute in ${zone}`, t => {
  const previous = process.env.TZ; process.env.TZ = zone;
  t.after(() => { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; });
  for (const [input, expected] of values) assert.equal(reviewLinkLocalExpiry(input), expected, input);
});
