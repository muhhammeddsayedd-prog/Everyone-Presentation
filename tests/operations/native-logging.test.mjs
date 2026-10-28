import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import test from 'node:test';
import { loggingProofPrepared, readLoggingSnapshot, assessLoggingWindow, readDockerLoggingSnapshot, assessDockerLoggingWindow,
  loggingProbeEvents, expectedLoggingRejection, readLoggingHba } from '../../tools/test-m02-native-logging.mjs';
import { compileNativeSpecsCall, NativeSpecsTransportError } from '../../tools/lib/native-specs-local-transport.mjs';

const snapshot = (extra = {}) => ({ collector: 'on', destination: 'stderr', directory: 'log', file: 'log/postgresql-2026-10-29_000000.log',
  truncate: 'off', size: 200, ...extra });
const secret = 'EPS_SYNTHETIC_PRIVATE_SENTINEL_7e3de538-2766-484f-bd58-26ca153df59c';
const controls = ['EPS_PUBLIC_BEGIN_123456', 'EPS_PUBLIC_END_123456'];
const buffer = content => Buffer.from(`prefix ${controls[0]} ${content} ${controls[1]} suffix`);
function assess(content, afterExtra = {}) {
  const bytes = buffer(content); const before = readLoggingSnapshot(snapshot(), 'log');
  const after = readLoggingSnapshot(snapshot({ size: 200 + bytes.length, ...afterExtra }), 'log');
  return assessLoggingWindow(before, after, bytes, controls, secret);
}
test('unsealed preparation is inert and only canonical observable relative stderr logs qualify', () => {
  assert.equal(loggingProofPrepared({}), false);
  const sealed = { migration: 'a'.repeat(64), transport: 'b'.repeat(64), login: 'c'.repeat(64) };
  assert.equal(loggingProofPrepared({ ...sealed, mode: 'docker_stderr', logDriver: 'json-file' }), true);
  assert.equal(loggingProofPrepared({ ...sealed, mode: 'docker_stderr', logDriver: 'none' }), false);
  assert.equal(loggingProofPrepared({ ...sealed, mode: 'collector_file', logDirectory: 'log' }), true);
  assert.equal(loggingProofPrepared({ ...sealed, mode: 'collector_file', logDirectory: '../log' }), false);
  assert.equal(readLoggingSnapshot(snapshot(), 'log').file, snapshot().file);
  for (const extra of [{ collector: 'off' }, { destination: 'stderr,csvlog' }, { truncate: 'on' }, { file: '/var/log/private' },
    { file: 'log/../private' }, { file: 'log/.' }, { file: 'log/subdir/file.log' }, { directory: 'other' }, { size: -1 }]) {
    assert.throws(() => readLoggingSnapshot(snapshot(extra), 'log'));
  }
});
test('Docker mode requires an observed readable driver and unchanged immutable container/runtime identity', () => {
  const input = { id: 'a'.repeat(64), started_at: '2026-10-29T00:00:00.000000000Z', driver: 'json-file', collector: 'off', destination: 'stderr', file: null };
  const before = readDockerLoggingSnapshot(input, 'json-file');
  assert.deepEqual(assessDockerLoggingWindow(before, before, buffer('public'), controls, secret), { control_present: true, raw_absent: true, hex_absent: true, base64_absent: true });
  for (const extra of [{ driver: 'none' }, { collector: 'on' }, { destination: 'stderr,csvlog' }, { file: 'log/file.log' }, { started_at: 'invalid' }]) {
    assert.throws(() => readDockerLoggingSnapshot({ ...input, ...extra }, 'json-file'));
  }
  for (const extra of [{ id: 'b'.repeat(64) }, { started_at: '2026-10-29T01:00:00Z' }, { driver: 'local' }]) {
    assert.throws(() => assessDockerLoggingWindow(before, { ...before, ...extra }, buffer('public'), controls, secret));
  }
});
test('absence is accepted only with both public controls and an exact bounded unrotated window', () => {
  assert.deepEqual(assess('public metadata only'), { control_present: true, raw_absent: true, hex_absent: true, base64_absent: true });
  assert.throws(() => assess('public', { file: 'log/postgresql-rotated.log' }));
  assert.throws(() => assess('public', { size: 2 }));
  const before = readLoggingSnapshot(snapshot(), 'log');
  assert.throws(() => assessLoggingWindow(before, { ...before, size: 204 }, Buffer.from('none'), controls, secret));
  const reversed = Buffer.from(controls[1] + controls[0]);
  assert.throws(() => assessLoggingWindow(before, { ...before, size: 200 + reversed.length }, reversed, controls, secret));
  assert.throws(() => assessLoggingWindow(before, { ...before, size: 200 + 2 ** 20 + 1 }, Buffer.alloc(2 ** 20 + 1), controls, secret));
});
test('raw, mixed-case hex and full-payload base64 leak variants fail without echoing the sentinel', () => {
  const variants = [secret, Buffer.from(secret).toString('hex').toUpperCase()];
  for (const offset of [0, 1, 2]) {
    variants.push(Buffer.from('x'.repeat(offset) + secret + 'tail').toString('base64'));
    variants.push(Buffer.from('x'.repeat(offset) + secret + 'tail').toString('base64url'));
    variants.push(Buffer.from('x'.repeat(offset) + secret + 'tail').toString('base64').match(/.{1,32}/gu).join('\n'));
  }
  for (const leak of variants) assert.throws(() => assess(leak), error => {
    assert.equal(error.message, 'PRIVATE_SENTINEL_VISIBLE'); assert(!JSON.stringify(error).includes(secret)); return true;
  });
});
test('invalid JSONB probes preserve actual NUL/surrogate values only in binds and require known sanitized rejection', () => {
  const run = '11111111-1111-4111-8111-111111111111'; const probes = loggingProbeEvents(run, secret);
  assert.equal(probes.length, 3); assert.equal(probes[0].event.error.message, secret);
  assert.equal(probes[1].event.error.message, secret + '\u0000'); assert.equal(probes[2].event.error.message, secret + '\ud800');
  for (const probe of probes) {
    const compiled = compileNativeSpecsCall('event', probe.event, `eps-native-specs-${run}-1`);
    const hex = compiled.script.match(/ \\bind '([a-f0-9]+)'/u)[1];
    assert.deepEqual(JSON.parse(Buffer.from(hex, 'hex').toString('utf8')), probe.event);
    assert(!compiled.serverSql.includes(secret));
    assert.throws(() => assess(compiled.script), /PRIVATE_SENTINEL_VISIBLE/u);
    assert.equal(expectedLoggingRejection(new NativeSpecsTransportError(probe.code, { status: probe.status, unknown: false }), probe), true);
    for (const error of [new NativeSpecsTransportError(probe.code, { status: probe.status, unknown: true }),
      new NativeSpecsTransportError(probe.code, { status: 400 }), new NativeSpecsTransportError('INVALID_REQUEST', { status: probe.status }),
      new Error(secret)]) assert.equal(expectedLoggingRejection(error, probe), false);
  }
});
test('the logging prerequisite accepts only the observed local TRUST HBA scope without a credential-authentication claim', () => {
  const observed = { hba_sha256: '05a3001844d0d4c02690e4a7091f0cb73dcd29d8b5c5df940f493901f9eca40d',
    auth_method: 'trust', connection: 'container_ipv4_loopback', credential_authentication_verified: false };
  assert.deepEqual(readLoggingHba({ ...observed, unrelated: 'not-recorded' }), observed);
  for (const change of [{ hba_sha256: 'a'.repeat(64) }, { auth_method: 'peer' }, { connection: 'container_socket' },
    { credential_authentication_verified: true }, { credential_authentication_verified: undefined }]) {
    assert.throws(() => readLoggingHba({ ...observed, ...change }), /LOCAL_LOGGING_HBA_SCOPE_CHANGED/u);
  }
});
