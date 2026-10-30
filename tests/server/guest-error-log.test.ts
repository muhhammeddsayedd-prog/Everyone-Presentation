import assert from 'node:assert/strict';
import test from 'node:test';
import { DomainError } from '@eps/domain';
import { guestOperationClass, logGuestRequestFailure } from '../../apps/web/lib/guest-error-log.ts';
import { GET } from '../../apps/web/app/api/v1/[...segments]/route.ts';

const requestId = 'a6060000-0000-4000-8000-000000000001';
const marker = 'PRIVATE_REQUEST_TOKEN_PATH_MESSAGE_BODY_MUST_NOT_APPEAR';
test('guest failure log contains only closed operation, status, error code and request correlation', () => {
  const lines: string[] = [];
  const error = new DomainError('SOURCE_UNREADABLE', marker, 422, { headers: marker, token_digest: marker, identity: marker });
  logGuestRequestFailure(guestOperationClass(['review', 'versions', marker, 'media', marker, 'content']), error, requestId, value => lines.push(value));
  assert.equal(lines.length, 1);
  assert.deepEqual(JSON.parse(lines[0]), { event: 'guest_request_failed', operation_class: 'guest_media_content', status: 422, code: 'SOURCE_UNREADABLE', request_id: requestId });
  assert.ok(!lines[0].includes(marker));
});
test('unrecognized error codes, malformed correlation and ordinary exceptions cannot leak through diagnostics', () => {
  const lines: string[] = []; const write = (value: string) => lines.push(value);
  logGuestRequestFailure(guestOperationClass([marker]), new DomainError(marker, marker, 999, { [marker]: marker }), marker, write);
  logGuestRequestFailure(guestOperationClass(['review', marker]), new Error(marker), requestId, write);
  assert.equal(lines.length, 2);
  assert.deepEqual(JSON.parse(lines[0]), { event: 'guest_request_failed', operation_class: 'guest_unknown', status: 503, code: 'DEPENDENCY_UNAVAILABLE', request_id: 'unavailable' });
  assert.equal(JSON.parse(lines[1]).code, 'DEPENDENCY_UNAVAILABLE'); assert.ok(!lines.join('').includes(marker));
  assert.doesNotThrow(() => logGuestRequestFailure(guestOperationClass(['review']), new Error(marker), requestId, () => { throw new Error(marker); }));
});
test('fixed guest operation classes distinguish content and acknowledgement without copying resource identifiers', () => {
  const cases: [string[], string][] = [
    [['review', 'open'], 'guest_exchange'], [['review', 'identity'], 'guest_identity'],
    [['review', 'session'], 'guest_session'], [['review', 'presentation'], 'guest_presentation'],
    [['review', 'versions', marker], 'guest_presentation'],
    [['review', 'versions', marker, 'feedback'], 'guest_feedback'],
    [['review', 'versions', marker, 'comments'], 'guest_feedback'], [['review', 'comments', marker], 'guest_feedback'],
    [['review', 'versions', marker, 'preferences'], 'guest_feedback'],
    [['review', 'versions', marker, 'pdf-exports'], 'guest_export_prepare'],
    [['review', 'pdf-exports', marker], 'guest_export_status'],
    [['review', 'pdf-exports', marker, 'download'], 'guest_export_download'],
    [['review', 'pdf-exports', marker, 'content'], 'guest_export_content'],
    [['review', 'versions', marker, 'media', marker], 'guest_media_playback'],
    [['review-media', 'versions', marker, 'media', marker, 'playback'], 'grant_media_playback'],
    [['review-media', 'versions', marker, 'media', marker, 'content'], 'grant_media_content'],
  ];
  for (const [segments, expected] of cases) assert.equal(guestOperationClass(segments), expected);
});
test('actual guest route catch logs a closed configuration error with its generated response request ID', async t => {
  const names = ['CENTRAL_ADAPTER_MODE', 'SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'APP_ENV', 'APP_BASE_URL', 'EPS_REVIEW_GATEWAY_KEY', 'EPS_REVIEW_REPLAY_KEY'] as const;
  const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
  const lines: unknown[][] = []; let networkCalls = 0;
  t.mock.method(console, 'error', (...values: unknown[]) => { lines.push(values); });
  t.mock.method(globalThis, 'fetch', async () => { networkCalls++; throw new Error(marker); });
  try {
    Object.assign(process.env, { CENTRAL_ADAPTER_MODE: 'supabase', SUPABASE_URL: 'https://synthetic.invalid', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic_diagnostic_12345', APP_ENV: 'test', APP_BASE_URL: 'http://127.0.0.1:3000' });
    delete process.env.EPS_REVIEW_GATEWAY_KEY; delete process.env.EPS_REVIEW_REPLAY_KEY;
    const response = await GET(new Request('http://127.0.0.1:3000/api/v1/review/pdf-exports/synthetic/content', { headers: { host: '127.0.0.1:3000' } }), { params: Promise.resolve({ segments: ['review', 'pdf-exports', 'synthetic', 'content'] }) });
    const body = await response.json(); assert.equal(response.status, 503); assert.equal(body.error.code, 'REVIEW_CONFIGURATION_REQUIRED'); assert.equal(networkCalls, 0);
    assert.equal(lines.length, 1); assert.equal(lines[0].length, 1); assert.equal(typeof lines[0][0], 'string');
    assert.deepEqual(JSON.parse(lines[0][0] as string), { event: 'guest_request_failed', operation_class: 'guest_export_content', status: 503, code: 'REVIEW_CONFIGURATION_REQUIRED', request_id: body.request_id });
    assert.match(body.request_id, /^[a-f0-9-]{36}$/u); assert.ok(!JSON.stringify(lines).includes(marker));
  } finally { for (const name of names) { if (previous[name] === undefined) delete process.env[name]; else process.env[name] = previous[name]; } }
});
