import assert from 'node:assert/strict';
import test from 'node:test';
import { rootCertificates } from 'node:tls';
import { createHmac, pbkdf2Sync } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { Pool, type Client, type ClientConfig, type PoolConfig } from 'pg';
import { createSpecsRuntimeGateway, readSpecsRuntimeConfig, SpecsRuntimeGatewayError,
  type SpecsRuntimePool, type SpecsRuntimeSqlClient } from '../src/specs-runtime-gateway.ts';

// Synthetic transport only: this suite never opens a database/network socket.
const env = { EPS_SPECS_PG_HOST: 'aws-0-eu-west-1.pooler.supabase.com',
  EPS_SPECS_PG_PASSWORD: 'synthetic-not-a-real-runtime-password',
  EPS_SPECS_PG_CA_BASE64: Buffer.from(rootCertificates[0]).toString('base64') };
const job = '78900000-0000-4000-8000-000000000001';
const attempt = '78900000-0000-4000-8000-000000000002';
const eventId = '78900000-0000-4000-8000-000000000003';
const inputHash = 'a'.repeat(64);
const future = new Date(Date.now() + 90_000).toISOString();
const lease = { job_id: job, attempt_id: attempt, stage: 'prepare_document', lease_token: 'b'.repeat(64),
  lease_expires_at: future, already_completed: false, input: { input_hash: inputHash } };
const scope = { job_id: job, attempt_id: attempt, lease_token: lease.lease_token };
function fixture() {
  const queries: { text: string; values: unknown[] }[] = [];
  const released: boolean[] = []; let configuration: PoolConfig | undefined; let closed = false;
  let allowed = true; let failure: unknown; let connectFailure: unknown; let response: unknown = lease;
  let queryHook: ((text: string) => Promise<void>) | undefined;
  const client: SpecsRuntimeSqlClient = {
    query: async (text, values = []) => {
      queries.push({ text, values });
      if (queryHook) await queryHook(text);
      if (text.includes(' as allowed')) return { rows: [{ allowed,function_operations:text.includes('select count(*)=11')?11:text.includes('select count(*)=7')?7:text.includes('count(*)=3')?10:6 }] };
      if (text.startsWith('select eps.')) { if (failure) throw failure; return { rows: [{ value: response }] }; }
      return { rows: [] };
    }, release: destroy => { released.push(destroy === true); },
  };
  const pool: SpecsRuntimePool = { connect: async () => { if (connectFailure) throw connectFailure; return client; }, end: async () => { closed = true; }, on: () => {} };
  return { queries, released, setAllowed: (value: boolean) => { allowed = value; },
    setFailure: (value: unknown) => { failure = value; }, setConnectFailure: (value: unknown) => { connectFailure = value; }, setResponse: (value: unknown) => { response = value; },
    setQueryHook: (value: (text: string) => Promise<void>) => { queryHook = value; },
    configuration: () => configuration, closed: () => closed,
    factory: (config: PoolConfig) => { configuration = config; return pool; } };
}
function runtimeError(code: string, outcome: 'known' | 'unknown') {
  return (error: unknown) => error instanceof SpecsRuntimeGatewayError && error.code === code && error.outcome === outcome
    && !JSON.stringify(error).includes('synthetic-private') && !error.message.includes('synthetic-private');
}

test('fixed config rejects credentials/target/TLS overrides before creating a client', async () => {
  for (const change of [{ EPS_SPECS_PG_HOST: '127.0.0.1' }, { EPS_SPECS_PG_HOST: 'https://untrusted.example.invalid' },
    { EPS_SPECS_PG_HOST: 'aws-1-eu-west-1.pooler.supabase.com' },
    { EPS_SPECS_PG_PASSWORD: '' }, { EPS_SPECS_PG_CA_BASE64: 'not-a-certificate' },
    { EPS_SPECS_PG_ROLE: 'postgres' }, { EPS_SPECS_PG_URL: 'postgresql://service_role@other' }]) {
    assert.throws(() => readSpecsRuntimeConfig({ ...env, ...change }), runtimeError('RUNTIME_CONFIG_INVALID', 'known'));
  }
  const f = fixture();
  await assert.rejects(createSpecsRuntimeGateway({ ...readSpecsRuntimeConfig(env), role: 'postgres' } as never,
    { poolFactory: f.factory }), runtimeError('RUNTIME_CONFIG_INVALID', 'known'));
  assert.equal(f.configuration(), undefined);
});

test('factory pins normal SDK TLS, target and narrow role verification before returning', async () => {
  const f = fixture(); const gateway = await createSpecsRuntimeGateway(readSpecsRuntimeConfig(env), { poolFactory: f.factory });
  const config = f.configuration()!;
  assert.equal(config.host, env.EPS_SPECS_PG_HOST); assert.equal(config.port, 5432);
  assert.equal(config.user, 'eps_specs_runtime.pyibofyctwnqpvktepse'); assert.equal(config.database, 'postgres');
  assert.equal(config.connectionString, undefined); assert.equal(config.max, 2); assert.equal(config.pipeline, false);
  assert.deepEqual(config.ssl, { ca: rootCertificates[0], rejectUnauthorized: true, servername: env.EPS_SPECS_PG_HOST, minVersion: 'TLSv1.2' });
  assert.equal(config.enableChannelBinding, true); assert.equal(config.sslnegotiation, 'postgres');
  assert.equal(config.connectionTimeoutMillis,3000);assert.equal(config.idleTimeoutMillis,30000);
  assert.equal(config.min,0);assert.equal(config.maxLifetimeSeconds,300);
  const identity=f.queries.find(query=>query.text.includes(' as allowed'))!.text;
  assert.match(identity,/r\.rolvaliduntil is not null/u);
  assert.match(identity,/r\.rolvaliduntil > pg_catalog\.clock_timestamp\(\)/u);
  assert.match(identity,/r\.rolvaliduntil < 'infinity'::timestamptz/u);
  assert.ok(f.queries.some(query => query.text.includes('current_user') && query.text.includes('session_user')
    && query.text.includes('has_any_column_privilege') && query.text.includes('has_function_privilege')));
  assert.equal(f.queries.some(query => /set\s+(local\s+)?role|request\.jwt/iu.test(query.text)
    && !query.text.includes(' as allowed')), false);
  await gateway.close(); assert.equal(f.closed(), true);
});

test('actual pinned pg Pool reuses a committed synthetic client and re-verifies identity before every operation',async()=>{
  let created=0;let destroyed=0;let verifications=0;let operations=0;let allowed=true;
  // Actual pg-pool lifecycle with a synthetic SQL client: no socket, database,
  // credential lookup, TLS handshake or provider is exercised by this test.
  class PooledSqlClient extends EventEmitter {
    _queryable=true;_ending=false;
    constructor(){super();created++;}
    connect(callback:(error?:Error)=>void){queueMicrotask(()=>callback());}
    end(callback?:()=>void){this._ending=true;destroyed++;this.emit('end');callback?.();}
    async query(text:string){
      if(text.includes(' as allowed')){verifications++;return {rows:[{allowed,function_operations:6}]};}
      if(text.startsWith('select eps.')){operations++;return {rows:[{value:{recovered:0}}]};}
      return {rows:[]};
    }
  }
  let pool:Pool|undefined;
  const gateway=await createSpecsRuntimeGateway(readSpecsRuntimeConfig(env),{poolFactory:config=>{
    pool=new Pool({...config,Client:PooledSqlClient as unknown as typeof Client});return pool as unknown as SpecsRuntimePool;
  }});
  try{
    assert.equal(created,1);assert.equal(destroyed,0);assert.equal(pool!.idleCount,1);
    await gateway.recover(1);await gateway.recover(1);
    assert.equal(created,1);assert.equal(destroyed,0);assert.equal(verifications,3);assert.equal(operations,2);
    assert.equal(pool!.idleCount,1);
    allowed=false;
    await assert.rejects(gateway.recover(1),runtimeError('RUNTIME_ROLE_UNVERIFIED','known'));
    assert.equal(operations,2);assert.equal(verifications,4);assert.equal(destroyed,1);assert.equal(pool!.totalCount,0);
  }finally{await gateway.close();}
});

test('incorrect role/table/function/logging scope fails the factory closed and closes its pool', async () => {
  const f = fixture(); f.setAllowed(false);
  await assert.rejects(createSpecsRuntimeGateway(readSpecsRuntimeConfig(env), { poolFactory: f.factory }),
    runtimeError('RUNTIME_ROLE_UNVERIFIED', 'known'));
  assert.equal(f.closed(), true); assert.equal(f.queries.some(query => query.text.startsWith('select eps.')), false);
});

test('file mode explicitly requires the third execute-only group and four additional fixed operations', async () => {
  const f = fixture(); const original = '78900000-0000-4000-8000-000000000004';
  const files = { storageOrigin: 'https://pyibofyctwnqpvktepse.supabase.co', publishableKey: 'sb_publishable_synthetic_public_file_key' };
  const gateway = await createSpecsRuntimeGateway(readSpecsRuntimeConfig(env), { poolFactory: f.factory }, files);
  assert.equal(gateway.candidateFiles,undefined);
  const identity = f.queries.find(query => query.text.includes(' as allowed'))!.text;
  assert.ok(identity.includes('count(*)=3') && identity.includes('count(*)=10') && identity.includes('eps_specs_assets_executor'));
  assert.ok(identity.includes('eps.store_specs_preparation(jsonb)') && identity.includes('has_any_column_privilege'));
  f.setResponse({ asset_id: original, bucket: 'eps-specs-assets', object_key: `assets/${original}/original.pdf`, permission: 'read',
    grant_token: 'd'.repeat(43), expires_at: future, mime_type: 'application/pdf', size_bytes: 100, sha256: inputHash });
  const result = await gateway.files!.getAssetAccess({ ...scope, asset_id: original }, AbortSignal.timeout(1000));
  assert.equal(result.url, `${files.storageOrigin}/storage/v1/object/authenticated/eps-specs-assets/assets/${original}/original.pdf`);
  const call = f.queries.find(query => query.text === 'select eps.get_job_asset_access($1::jsonb) as value')!;
  assert.ok(call); assert.equal(call.text.includes(lease.lease_token), false);
  assert.deepEqual(JSON.parse(call.values[0] as string), { ...scope, asset_id: original });
  f.setResponse({ stored: true });
  const payload = JSON.stringify({ synthetic: 'private-prepared-text', text: 'x'.repeat(300_000) });
  await gateway.files!.storePreparation({ ...scope, asset_id: original, payload_utf8: payload }, AbortSignal.timeout(1000));
  const preparation = f.queries.find(query => query.text === 'select eps.store_specs_preparation($1::jsonb) as value')!;
  assert.ok(preparation && !preparation.text.includes('private-prepared-text'));
  assert.equal(JSON.parse(preparation.values[0] as string).payload_utf8, payload);
  f.setFailure({ code: 'ECONNRESET', message: 'synthetic-private-transport-body' });
  const attempts = f.queries.filter(query => query.text === 'select eps.store_specs_preparation($1::jsonb) as value').length;
  await assert.rejects(gateway.files!.storePreparation({ ...scope, asset_id: original, payload_utf8: payload }, AbortSignal.timeout(1000)),
    runtimeError('RUNTIME_UNAVAILABLE', 'unknown'));
  assert.equal(f.queries.filter(query => query.text === 'select eps.store_specs_preparation($1::jsonb) as value').length, attempts + 1);
  await gateway.close();
});
test('candidate ports require an explicit enable flag without broadening the audited runtime authority',async()=>{
  const f=fixture();const files={storageOrigin:'https://pyibofyctwnqpvktepse.supabase.co',publishableKey:'sb_publishable_synthetic_public_file_key'};
  const gateway=await createSpecsRuntimeGateway(readSpecsRuntimeConfig(env),{poolFactory:f.factory},files,undefined,true);
  assert.equal(typeof gateway.candidateFiles?.getAssetAccess,'function');assert.equal(gateway.verifiedFunctionOperations,10);
  await gateway.close();
  const denied=fixture();await assert.rejects(createSpecsRuntimeGateway(readSpecsRuntimeConfig(env),{poolFactory:denied.factory},undefined,undefined,true),runtimeError('RUNTIME_CONFIG_INVALID','known'));
  assert.equal(denied.configuration(),undefined);
});
test('HTTP claim replay requires its private key config and uses one exact parameterized function without logging its key', async () => {
  const f=fixture(); const replay={ keyId:'synthetic-replay-v1',encryptionKey:'d'.repeat(64) };
  const gateway=await createSpecsRuntimeGateway(readSpecsRuntimeConfig(env),{ poolFactory:f.factory },undefined,replay);
  const identity=f.queries.find(query=>query.text.includes(' as allowed'))!.text;
  assert.ok(identity.includes('count(*)=7')&&identity.includes('eps.claim_job_stage_replay(jsonb,text,text,text)'));
  const input={ job_id:job,stage:'prepare_document',input_hash:inputHash };
  assert.deepEqual(await gateway.claimWithReplay(input,'synthetic-replay-intent'),lease);
  const call=f.queries.find(query=>query.text==='select eps.claim_job_stage_replay($1::jsonb,$2::text,$3::text,$4::text) as value')!;
  assert.deepEqual(call.values,[JSON.stringify(input),'synthetic-replay-intent',replay.keyId,replay.encryptionKey]);
  assert.equal(call.text.includes(replay.encryptionKey),false);
  await assert.rejects(gateway.claimWithReplay({ ...input,principal_id:'forged' } as never,'synthetic-replay-intent'),runtimeError('INVALID_REQUEST','known'));
  await gateway.close();
  for(const changed of [{ encryptionKey:'invalid' },{ keyId:'invalid key' }]) {
    const fixtureValue=fixture();await assert.rejects(createSpecsRuntimeGateway(readSpecsRuntimeConfig(env),{ poolFactory:fixtureValue.factory },undefined,{ ...replay,...changed }),runtimeError('RUNTIME_CONFIG_INVALID','known'));
    assert.equal(fixtureValue.configuration(),undefined);
  }
});

test('invalid optional file target is denied before constructing the private database pool', async () => {
  const f = fixture();
  await assert.rejects(createSpecsRuntimeGateway(readSpecsRuntimeConfig(env), { poolFactory: f.factory },
    { storageOrigin: 'https://untrusted.example.invalid', publishableKey: 'sb_publishable_synthetic_public_file_key' }),
  runtimeError('RUNTIME_CONFIG_INVALID', 'known'));
  assert.equal(f.configuration(), undefined);
});

test('six operations use fixed extended-query parameters with no private SQL interpolation', async () => {
  const f = fixture(); const gateway = await createSpecsRuntimeGateway(readSpecsRuntimeConfig(env), { poolFactory: f.factory });
  assert.deepEqual(await gateway.claim({ job_id: job, stage: 'prepare_document', input_hash: inputHash }), lease);
  f.setResponse({ ...scope, input_hash: inputHash, stage: 'prepare_document', correlation_id: 'synthetic',
    configuration: {}, source_text: 'synthetic-private-source' });
  await gateway.getInput(scope, AbortSignal.timeout(1000));
  f.setResponse({ event_id: eventId, applied: true, duplicate: false, stale: false, job_status: 'running' });
  await gateway.recordEvent({ ...scope, event_id: eventId, stage: 'prepare_document', input_hash: inputHash,
    sequence: 1, event_type: 'heartbeat' }, AbortSignal.timeout(1000));
  f.setResponse({ leases: [] }); await gateway.claimOutbox(1);
  f.setResponse({ acknowledged: true, stale: false }); await gateway.finishOutbox(job, 'c'.repeat(43), true);
  f.setResponse({ recovered: 0 }); await gateway.recover(1);
  const calls = f.queries.filter(query => query.text.startsWith('select eps.'));
  assert.equal(calls.length, 6);
  for (const call of calls) { assert.ok(call.text.includes('$1')); assert.equal(call.text.includes(lease.lease_token), false);
    assert.equal(call.text.includes('synthetic-private'), false); }
  assert.deepEqual(calls[1].values, [job, attempt, lease.lease_token]);
  await gateway.close();
});

test('review jobs reuse fixed scoped claim/input/event ports and bind every outbox kind to its exact stages', async () => {
  const f = fixture(); const gateway = await createSpecsRuntimeGateway(readSpecsRuntimeConfig(env), { poolFactory: f.factory });
  for (const [kind, stage] of [['ai_suggestion', 'prepare_suggestion'], ['ai_suggestion', 'generate_suggestion'], ['ai_suggestion', 'validate_suggestion'], ['review_fit', 'measure_review_fit']]) {
    f.setResponse({ ...lease, stage }); assert.equal((await gateway.claim({ job_id: job, stage, input_hash: inputHash })).stage, stage);
    f.setResponse({ ...scope, stage, input_hash: inputHash }); assert.equal((await gateway.getInput(scope, AbortSignal.timeout(1000)) as { stage: string }).stage, stage);
    const envelope = { event_id: eventId, event_type: 'job.stage_ready', contract_version: '1.0', job_id: job, kind, stage, input_hash: inputHash, correlation_id: 'synthetic-review' };
    f.setResponse({ leases: [{ id: eventId, lease_token: 'c'.repeat(43), lease_expires_at: future, envelope }] });
    assert.equal((await gateway.claimOutbox(1)).leases instanceof Array, true);
    f.setResponse({ leases: [{ id: eventId, lease_token: 'c'.repeat(43), lease_expires_at: future, envelope: { ...envelope, stage: kind === 'review_fit' ? 'generate_suggestion' : 'measure_review_fit' } }] });
    await assert.rejects(gateway.claimOutbox(1), runtimeError('RUNTIME_RESPONSE_INVALID', 'unknown'));
  }
  const identity = f.queries.find(query => query.text.includes(' as allowed'))!.text;
  assert.ok(identity.includes('count(*)=6')); assert.equal(gateway.verifiedFunctionOperations, 6);
  for (const call of f.queries.filter(query => query.text.startsWith('select eps.'))) assert.match(call.text, /^select eps\.(?:claim_job_stage\(\$1::jsonb\)|get_specs_stage_input\(\$1::uuid,\$2::uuid,\$3::text\)|claim_job_outbox\(\$1::integer\)) as value$/u);
  await gateway.close();
});

test('only native fit callbacks receive the explicit one MiB transport budget', async () => {
  const f = fixture(); const gateway = await createSpecsRuntimeGateway(readSpecsRuntimeConfig(env), { poolFactory: f.factory });
  f.setResponse({ event_id: eventId, applied: true, duplicate: false, stale: false, job_status: 'succeeded' });
  const event = { ...scope, event_id: eventId, stage: 'measure_review_fit', input_hash: inputHash, sequence: 1, event_type: 'succeeded' as const, result_schema: 'review-fit-measurement.v1', result: { synthetic: 'x'.repeat(500_000) } };
  await gateway.recordEvent(event, AbortSignal.timeout(1000));
  const count = f.queries.filter(query => query.text.startsWith('select eps.')).length;
  await assert.rejects(gateway.recordEvent({ ...event, stage: 'prepare_document' }, AbortSignal.timeout(1000)), runtimeError('INVALID_REQUEST', 'known'));
  await assert.rejects(gateway.recordEvent({ ...event, result: { synthetic: 'x'.repeat(1_048_576) } }, AbortSignal.timeout(1000)), runtimeError('INVALID_REQUEST', 'known'));
  assert.equal(f.queries.filter(query => query.text.startsWith('select eps.')).length, count); await gateway.close();
});

test('malformed/NUL/surrogate request data is rejected before private SQL without repairing Unicode', async () => {
  const f = fixture(); const gateway = await createSpecsRuntimeGateway(readSpecsRuntimeConfig(env), { poolFactory: f.factory });
  for (const message of ['synthetic-private\u0000', 'synthetic-private\ud800', 'synthetic-private\udfff']) {
    await assert.rejects(gateway.recordEvent({ ...scope, event_id: eventId, stage: 'prepare_document', input_hash: inputHash,
      sequence: 1, event_type: 'failed', error: { code: 'RESULT_INVALID', message, details: {}, retryable: false } }, AbortSignal.timeout(1000)),
    runtimeError('INVALID_REQUEST', 'known'));
  }
  await assert.rejects(gateway.claim({ job_id: job, stage: 'arbitrary_sql', input_hash: inputHash }), runtimeError('INVALID_REQUEST', 'known'));
  assert.equal(f.queries.some(query => query.text.startsWith('select eps.')), false); await gateway.close();
});

test('database domain rejections are known and redacted; network/commit/unknown failures stay unknown', async () => {
  const f = fixture(); const gateway = await createSpecsRuntimeGateway(readSpecsRuntimeConfig(env), { poolFactory: f.factory });
  f.setFailure({ code: 'P0001', message: 'INPUT_CHANGED', detail: 'synthetic-private-provider-body' });
  await assert.rejects(gateway.claim({ job_id: job, stage: 'prepare_document', input_hash: inputHash }), runtimeError('INPUT_CHANGED', 'known'));
  f.setFailure({ code: 'ECONNRESET', message: 'synthetic-private-connection-string' });
  await assert.rejects(gateway.claim({ job_id: job, stage: 'prepare_document', input_hash: inputHash }), runtimeError('RUNTIME_UNAVAILABLE', 'unknown'));
  assert.equal(f.released.at(-1), true); await gateway.close();
});
test('startup diagnostics expose only fixed phase/transport codes, and auth/TLS failures cannot be retried as availability', async () => {
  for (const [failure, code, transport] of [
    [{ code: 'ECONNRESET', message: 'synthetic-private-host-or-password' }, 'RUNTIME_UNAVAILABLE', 'ECONNRESET'],
    [new Error('Connection terminated due to connection timeout'), 'RUNTIME_UNAVAILABLE', 'CONNECT_TIMEOUT'],
    [new Error('timeout exceeded when trying to connect'), 'RUNTIME_UNAVAILABLE', 'CONNECT_TIMEOUT'],
    [{ code: '28P01', message: 'synthetic-private-password' }, 'RUNTIME_AUTH_UNVERIFIED', '28P01'],
    [{ code: 'ERR_TLS_CERT_ALTNAME_INVALID', message: 'synthetic-private-certificate' }, 'RUNTIME_CONFIG_INVALID', 'ERR_TLS_CERT_ALTNAME_INVALID'],
    [{ code: 'synthetic-private-code', message: 'synthetic-private-body' }, 'RUNTIME_UNAVAILABLE', undefined],
  ] as const) {
    const f = fixture(); f.setConnectFailure(failure);
    await assert.rejects(createSpecsRuntimeGateway(readSpecsRuntimeConfig(env), { poolFactory: f.factory }), error => {
      assert.ok(error instanceof SpecsRuntimeGatewayError); const diagnostic = error as SpecsRuntimeGatewayError & { gateway_phase: string; transport_code?: string; elapsed_ms: number };
      assert.equal(diagnostic.code, code); assert.equal(diagnostic.gateway_phase, 'connect'); assert.equal(diagnostic.transport_code, transport);
      assert.ok(Number.isSafeInteger(diagnostic.elapsed_ms) && diagnostic.elapsed_ms >= 0);
      assert.doesNotMatch(JSON.stringify(error), /synthetic-private/u); return true;
    });
    assert.equal(f.queries.length, 0); assert.equal(f.closed(), true);
  }
});
test('private SQL and commit diagnostics preserve unknown outcomes without copying raw driver data', async () => {
  for (const phase of ['operation', 'commit'] as const) {
    const f = fixture(); const gateway = await createSpecsRuntimeGateway(readSpecsRuntimeConfig(env), { poolFactory: f.factory });
    if (phase === 'operation') f.setFailure({ code: '53300', message: 'synthetic-private-connection-body' });
    else f.setQueryHook(async text => { if (text === 'commit') throw { code: 'ECONNRESET', message: 'synthetic-private-commit-body' }; });
    await assert.rejects(gateway.claim({ job_id: job, stage: 'prepare_document', input_hash: inputHash }), error => {
      assert.ok(error instanceof SpecsRuntimeGatewayError); const diagnostic = error as SpecsRuntimeGatewayError & { gateway_phase: string; transport_code: string };
      assert.equal(diagnostic.code, 'RUNTIME_UNAVAILABLE'); assert.equal(diagnostic.outcome, 'unknown');
      assert.equal(diagnostic.gateway_phase, phase); assert.equal(diagnostic.transport_code, phase === 'operation' ? '53300' : 'ECONNRESET');
      assert.doesNotMatch(JSON.stringify(error), /synthetic-private/u); return true;
    });
    assert.equal(f.queries.filter(query => query.text.startsWith('select eps.')).length, 1); await gateway.close();
  }
});

test('aborted input cannot start a transaction or query and closed gateway cannot reconnect', async () => {
  const f = fixture(); const gateway = await createSpecsRuntimeGateway(readSpecsRuntimeConfig(env), { poolFactory: f.factory });
  const count = f.queries.length;
  await assert.rejects(gateway.claim({ job_id: job, stage: 'prepare_document', input_hash: inputHash }, AbortSignal.abort()),
    runtimeError('RUNTIME_ABORTED', 'known'));
  assert.equal(f.queries.length, count); await gateway.close();
  await assert.rejects(gateway.recover(1), runtimeError('RUNTIME_CLOSED', 'known'));
});

test('commit response loss and cancellation after query dispatch remain unknown without repeating SQL', async () => {
  for (const cancel of [false, true]) {
    const f = fixture(); const gateway = await createSpecsRuntimeGateway(readSpecsRuntimeConfig(env), { poolFactory: f.factory });
    const controller = new AbortController();
    f.setQueryHook(async text => {
      if (cancel && text.startsWith('select eps.')) { controller.abort(); await new Promise(() => {}); }
      if (!cancel && text === 'commit') throw new Error('synthetic-private-lost-commit-response');
    });
    await assert.rejects(gateway.claim({ job_id: job, stage: 'prepare_document', input_hash: inputHash }, controller.signal),
      runtimeError(cancel ? 'RUNTIME_ABORTED' : 'RUNTIME_UNAVAILABLE', 'unknown'));
    assert.equal(f.queries.filter(query => query.text.startsWith('select eps.')).length, 1);
    assert.deepEqual(f.released,[false,true],'Only the acknowledged startup transaction is returned; lost commit or abort destroys exactly once.'); await gateway.close();
  }
});

test('ambient libpq routing/options are refused without using or mutating them', { concurrency: false }, async () => {
  const previous = process.env.PGOPTIONS;
  try {
    process.env.PGOPTIONS = '-c role=postgres'; const f = fixture();
    await assert.rejects(createSpecsRuntimeGateway(readSpecsRuntimeConfig(env), { poolFactory: f.factory }), runtimeError('RUNTIME_CONFIG_INVALID', 'known'));
    assert.equal(f.configuration(), undefined); assert.equal(process.env.PGOPTIONS, '-c role=postgres');
  } finally { if (previous === undefined) Reflect.deleteProperty(process.env, 'PGOPTIONS'); else process.env.PGOPTIONS = previous; }
});

/** Synthetic server messages exercise pg8.23.1's actual SCRAM implementation.
 * No socket or TLS server exists here; real credential/TLS proof remains live. */
class SyntheticAuthentication extends EventEmitter {
  readonly stream = new PassThrough(); readonly passwords: unknown[] = [];
  private first = ''; private serverFirst = '';
  constructor(private mode: 'scram' | 'bad-proof' | 'trust' | 'cleartext' | 'md5') {
    super(); this.stream.on('close', () => this.emit('end'));
  }
  connect() { queueMicrotask(() => this.emit('connect')); }
  requestSsl() { queueMicrotask(() => this.emit('sslconnect')); }
  startup() {
    queueMicrotask(() => {
      if (this.mode === 'trust') this.emit('readyForQuery', { status: 'I' });
      else if (this.mode === 'cleartext') this.emit('authenticationCleartextPassword', {});
      else if (this.mode === 'md5') this.emit('authenticationMD5Password', { salt: Buffer.alloc(4) });
      else this.emit('authenticationSASL', { mechanisms: ['SCRAM-SHA-256'] });
    });
  }
  password(value: unknown) { this.passwords.push(value); }
  sendSASLInitialResponseMessage(mechanism: string, initial: string) {
    assert.equal(mechanism, 'SCRAM-SHA-256');
    this.first = initial.slice(initial.indexOf(',,') + 2);
    const nonce = this.first.split(',r=')[1];
    this.serverFirst = `r=${nonce}synthetic-server-nonce,s=${Buffer.from('synthetic-salt').toString('base64')},i=4096`;
    queueMicrotask(() => this.emit('authenticationSASLContinue', { data: this.serverFirst }));
  }
  sendSCRAMClientFinalMessage(message: string) {
    const salted = pbkdf2Sync(env.EPS_SPECS_PG_PASSWORD, 'synthetic-salt', 4096, 32, 'sha256');
    const key = createHmac('sha256', salted).update('Server Key').digest();
    const signature = createHmac('sha256', key).update(`${this.first},${this.serverFirst},${message.split(',p=')[0]}`).digest('base64');
    queueMicrotask(() => {
      this.emit('authenticationSASLFinal', { data: `v=${this.mode === 'bad-proof' ? Buffer.alloc(32).toString('base64') : signature}` });
      if (this.mode !== 'bad-proof') this.emit('readyForQuery', { status: 'I' });
    });
  }
  end() { this.stream.destroy(); }
}

test('actual pinned SDK requires SCRAM server proof and never releases a legacy password', async () => {
  const f = fixture(); const gateway = await createSpecsRuntimeGateway(readSpecsRuntimeConfig(env), { poolFactory: f.factory });
  const options = f.configuration()!;
  const SecureClient = options.Client as typeof Client;
  for (const mode of ['scram', 'bad-proof', 'trust', 'cleartext', 'md5'] as const) {
    const connection = new SyntheticAuthentication(mode);
    const client = new SecureClient({ ...options, connection } as ClientConfig);
    client.on('error', () => {});
    try {
      if (mode === 'scram') await client.connect(); else await assert.rejects(client.connect());
      assert.equal(connection.passwords.length, 0, 'Legacy password response must never be emitted');
    } finally { await client.end(); }
  }
  await gateway.close();
});
