import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import test from 'node:test';
import { compileNativeSpecsCall, compileNativeSpecsRuntimeArgs, NativeSpecsTransportError, nativeSpecsTransportFailure } from '../../tools/lib/native-specs-local-transport.mjs';

const job = '7b980000-0000-4000-8000-000000000001';
const attempt = '7d980000-0000-4000-8000-000000000001';
const label = 'eps-native-specs-11111111-1111-4111-8111-111111111111-1';
const opaque = "synthetic-private-token'\\!never-execute";
const event = () => ({ job_id: job, attempt_id: attempt, event_id: 'synthetic-event', lease_token: opaque,
  stage: 'extract_specs', input_hash: 'a'.repeat(64), sequence: 1, event_type: 'succeeded',
  result_schema: 'specs-extraction-stage.v1', result: { source: '\ufeffSynthetic private requirements\r\nالعمر غير محدد.\n"; rollback; --' } });
const decoded = compiled => {
  const bindings = [...compiled.script.matchAll(/ \\bind '([a-f0-9]+)' \\gset native_specs_/gu)];
  assert.equal(bindings.length, 1);
  return JSON.parse(Buffer.from(bindings[0][1], 'hex').toString('utf8'));
};
const invalid = error => error instanceof NativeSpecsTransportError && error.code === 'NATIVE_INPUT_INVALID';

test('local TRUST route is fixed to an unprivileged OS user and the narrow direct loopback login', () => {
  const args = compileNativeSpecsRuntimeArgs('a'.repeat(64));
  const argument = flag => args[args.indexOf(flag) + 1];
  assert.equal(argument('--user'), '65534:65534');
  assert.equal(argument('-h'), '127.0.0.1'); assert.equal(argument('-p'), '5432');
  assert.equal(argument('-U'), 'eps_native_specs_local_probe');
  assert.ok(args.includes('env') && args.indexOf('-i', args.indexOf('env')) === args.indexOf('env') + 1);
  assert.ok(args.includes('PGPASSFILE=/dev/null'));
  assert.ok(!args.includes('/var/run/postgresql') && !args.some(value => value.startsWith('PGPASSWORD=')));
  assert.throws(() => compileNativeSpecsRuntimeArgs('name-or-external-target'), invalid);
  const { serverSql } = compileNativeSpecsCall('recover', { limit: 1 }, label);
  assert.match(serverSql, /inet_client_addr\(\) is distinct from '127\.0\.0\.1'::inet/u);
  assert.match(serverSql, /inet_server_addr\(\) is distinct from '127\.0\.0\.1'::inet/u);
  assert.match(serverSql, /inet_server_port\(\) is distinct from 5432/u);
});

test('private source and opaque tokens are parameters rather than server SQL text or metacommands', () => {
  const supplied = event(); const compiled = compileNativeSpecsCall('event', supplied, label);
  assert.deepEqual(decoded(compiled), supplied);
  for (const privateValue of [supplied.lease_token, supplied.result.source, Buffer.from(JSON.stringify(supplied)).toString('hex')]) {
    assert.ok(!compiled.serverSql.includes(privateValue));
  }
  assert.match(compiled.serverSql, /decode\(\$1,'hex'\)/u);
  assert.match(compiled.serverSql, /eps\.record_job_event\(arguments_value\)/u);
  assert.equal((compiled.script.match(/\\bind/gu) ?? []).length, 1);
  assert.ok(!compiled.serverSql.includes('\\!never-execute'));
});

test('compiler admits fixed RPCs and well-scoped arguments only', () => {
  const claim = { job_id: job, stage: 'prepare_document', input_hash: 'a'.repeat(64) };
  assert.deepEqual(decoded(compileNativeSpecsCall('claim', claim, label)), claim);
  assert.deepEqual(decoded(compileNativeSpecsCall('input', { job_id: job, attempt_id: attempt, lease_token: opaque }, label)), { job_id: job, attempt_id: attempt, lease_token: opaque });
  assert.deepEqual(decoded(compileNativeSpecsCall('recover', { limit: 100 }, label)), { limit: 100 });
  for (const [operation, supplied, scope] of [
    ['__proto__', claim, label], ['other.sql', claim, label], ['claim', { ...claim, principal_id: job }, label],
    ['claim', { ...claim, job_id: "'; commit; --" }, label], ['claim', { ...claim, stage: 'run_shell' }, label],
    ['input', { job_id: job, attempt_id: attempt, lease_token: 'line\nbreak' }, label],
    ['recover', { limit: 101 }, label], ['recover', { limit: 0 }, label], ['recover', { limit: '1' }, label],
    ['claim', claim, "'; select private_data; --"],
  ]) assert.throws(() => compileNativeSpecsCall(operation, supplied, scope), invalid);
});

test('only direct restricted login and safe effective logging can precede a private bind', () => {
  const { script, serverSql } = compileNativeSpecsCall('event', event(), label);
  assert.ok(script.indexOf('$identity_guard$') < script.indexOf(' \\bind '));
  assert.ok(script.indexOf('$logging_guard$') < script.indexOf(' \\bind '));
  assert.match(serverSql, /session_user<>'eps_native_specs_local_probe'/u);
  assert.match(serverSql, /current_user<>'eps_native_specs_local_probe'/u);
  assert.match(serverSql, /log_parameter_max_length'\)<>'0'/u);
  assert.match(serverSql, /log_parameter_max_length_on_error'\)<>'0'/u);
  assert.match(serverSql, /auto_explain\.log_min_duration/u);
  assert.match(serverSql, /pgaudit\.log_parameter/u);
  assert.match(serverSql, /pgaudit\.role/u);
  assert.ok(!/set\s+(?:local\s+)?role/iu.test(serverSql));
  assert.ok(!serverSql.includes('has_parameter_privilege'));
});

test('receipt diagnostics expose only recognized transport codes and bounded status', () => {
  assert.deepEqual(nativeSpecsTransportFailure(new NativeSpecsTransportError('LEASE_INVALID', { status: 403, unknown: false })),
    { code: 'LEASE_INVALID', status: 403, unknown: false });
  assert.deepEqual(nativeSpecsTransportFailure(new NativeSpecsTransportError('PRIVATE_VALUE_MUST_NOT_ESCAPE', { status: 200, unknown: true })),
    { code: 'NATIVE_CALL_UNCONFIRMED', status: 503, unknown: true });
  assert.equal(nativeSpecsTransportFailure(new Error('private diagnostic')), null);
});

test('operation errors cannot return raw SQL diagnostics and cancellation is explicit', () => {
  const { serverSql } = compileNativeSpecsCall('event', event(), label);
  assert.match(serverSql, /exception when query_canceled then/u);
  assert.match(serverSql, /then sqlerrm else 'NATIVE_RPC_FAILED'/u);
  assert.ok(!serverSql.includes('pg_exception_context'));
  assert.ok(!serverSql.includes("'message',sqlerrm"));
  assert.ok(!serverSql.includes('raise notice'));
  assert.match(serverSql, /commit;\n$/u);
});

test('PostgreSQL JSON conversion failures stay inside the sanitized exception boundary', () => {
  // JSON can encode values that PostgreSQL jsonb rejects. The server's JSON
  // CONTEXT must never escape the caught region with nearby private text.
  for (const rejectedUnicode of ['\u0000', '\ud800']) {
    const supplied = { ...event(), result: { source: `synthetic-private-before${rejectedUnicode}synthetic-private-after` } };
    const { serverSql } = compileNativeSpecsCall('event', supplied, label);
    assert.ok(!serverSql.includes('synthetic-private-before'));
    assert.match(serverSql, /declare arguments_value jsonb;/u);
    assert.match(serverSql, /begin\s+begin\s+arguments_value:=current_setting\('eps\.native_specs\.arguments'\)::jsonb;/u);
    assert.ok(serverSql.indexOf('arguments_value:=') < serverSql.indexOf('result_value:=eps.record_job_event'));
    assert.ok(serverSql.indexOf('arguments_value:=') < serverSql.indexOf('exception when query_canceled'));
  }
});

test('compiled intent is detached and oversized or unserializable payloads fail safely', () => {
  const supplied = event(); const compiled = compileNativeSpecsCall('event', supplied, label);
  supplied.job_id = '7b980000-0000-4000-8000-000000000002'; supplied.result.source = 'changed';
  assert.equal(decoded(compiled).job_id, job);
  assert.ok(decoded(compiled).result.source.startsWith('\ufeffSynthetic private'));
  assert.throws(() => compileNativeSpecsCall('event', { ...event(), result: { value: 'a'.repeat(294912) } }, label), invalid);
  const cyclic = event(); cyclic.result.self = cyclic;
  assert.throws(() => compileNativeSpecsCall('event', cyclic, label), invalid);
});
