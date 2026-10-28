import { Buffer } from 'node:buffer';
import { X509Certificate } from 'node:crypto';
import { Client, Pool, type ClientConfig, type PoolConfig } from 'pg';
import type { JobEvent, JobEventReceipt, StageClaim, StageLease } from '../../jobs/src/types.ts';

export const SPECS_RUNTIME_ROLE = 'eps_specs_runtime';
export const SPECS_RUNTIME_PROJECT = 'pyibofyctwnqpvktepse';
export const SPECS_RUNTIME_HOST = 'aws-0-eu-west-1.pooler.supabase.com';
const STAGES = ['prepare_document', 'extract_specs', 'apply_specs'];
const STATUSES = ['queued', 'running', 'waiting_for_input', 'succeeded', 'failed', 'cancelled'];
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u;
const HASH = /^[a-f0-9]{64}$/u;
const SERVICE_FUNCTIONS = ['eps.claim_job_stage(jsonb)', 'eps.get_specs_stage_input(uuid,uuid,text)',
  'eps.record_job_event(jsonb)', 'eps.recover_job_stages(integer)', 'eps.claim_job_outbox(integer)',
  'eps.finish_job_outbox(uuid,text,boolean)'];
const DOMAIN_STATUS = new Map<string, number>([
  ...['INVALID_REQUEST', 'INVALID_PROGRESS'].map(code => [code, 400] as const),
  ['RESOURCE_NOT_FOUND', 404], ['CAPABILITY_REQUIRED', 403], ['LEASE_INVALID', 403],
  ...['INPUT_CHANGED', 'INPUT_HASH_MISMATCH', 'JOB_CANCELLED', 'JOB_ALREADY_RUNNING', 'JOB_NOT_AVAILABLE',
    'RETRY_EXHAUSTED', 'STAGE_OUT_OF_ORDER', 'STAGE_STATE_INVALID', 'STALE_STAGE_LEASE', 'EVENT_ID_CONFLICT',
    'EVENT_SEQUENCE_CONFLICT', 'RESULT_INVALID', 'INVALID_TRANSITION'].map(code => [code, 409] as const),
  ['FEATURE_NOT_IMPLEMENTED', 503], ['SLOT_ALLOCATION_LIMIT_EXCEEDED', 409],
]);

export class SpecsRuntimeGatewayError extends Error {
  constructor(readonly code: string, readonly status = 503, readonly outcome: 'known' | 'unknown' = 'unknown') {
    super('The scoped processing operation could not be confirmed.'); this.name = 'SpecsRuntimeGatewayError';
  }
}
function fail(code: string, status = 503, outcome: 'known' | 'unknown' = 'known'): never {
  throw new SpecsRuntimeGatewayError(code, status, outcome);
}
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value: unknown, keys: string[]): value is Record<string, unknown> => object(value)
  && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const id = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);
const date = (value: unknown): value is string => typeof value === 'string' && value.length <= 40 && Number.isFinite(Date.parse(value));
function integer(value: unknown, maximum = 100): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < 1 || (value as number) > maximum) fail('INVALID_REQUEST', 400);
}
function token(value: unknown): asserts value is string {
  if (typeof value !== 'string' || value.length < 1 || value.length > 1024 || /[\s\p{C}]/u.test(value)) fail('INVALID_REQUEST', 400);
}
function safeJson(value: unknown, maximum = 294_912): string {
  let json: string;
  try { json = JSON.stringify(value); } catch { return fail('INVALID_REQUEST', 400); }
  if (typeof json !== 'string' || Buffer.byteLength(json, 'utf8') > maximum) fail('INVALID_REQUEST', 400);
  const parsed: unknown = JSON.parse(json); let nodes = 0;
  function check(item: unknown, depth: number): void {
    if (++nodes > 100_000 || depth > 32) fail('INVALID_REQUEST', 400);
    if (typeof item === 'string') {
      for (const character of item) {
        const point = character.codePointAt(0)!;
        if (point === 0 || point >= 0xd800 && point <= 0xdfff) fail('INVALID_REQUEST', 400);
      }
    } else if (Array.isArray(item)) item.forEach(entry => check(entry, depth + 1));
    else if (object(item)) for (const [key, entry] of Object.entries(item)) { check(key, depth + 1); check(entry, depth + 1); }
  }
  check(parsed, 0); return json;
}

export interface SpecsRuntimeConfig { host: string; password: string; caPem: string }
function checkedConfig(value: unknown): SpecsRuntimeConfig {
  if (typeof window !== 'undefined' || !exact(value, ['host', 'password', 'caPem'])
    || value.host !== SPECS_RUNTIME_HOST
    || typeof value.password !== 'string' || value.password.length < 32 || value.password.length > 512
    || /[^\x21-\x7e]/u.test(value.password) || typeof value.caPem !== 'string' || value.caPem.length > 16_384
    || !/^-----BEGIN CERTIFICATE-----\r?\n[A-Za-z0-9+/=\r\n]+\r?\n-----END CERTIFICATE-----\r?\n?$/u.test(value.caPem)) fail('RUNTIME_CONFIG_INVALID');
  try { if (!new X509Certificate(value.caPem).ca) fail('RUNTIME_CONFIG_INVALID'); }
  catch { fail('RUNTIME_CONFIG_INVALID'); }
  return { host: value.host, password: value.password, caPem: value.caPem };
}
/** Only the fixed launcher reads a private file. This parser accepts values,
 * never a filename/URL/SQL option, and never falls back to PG*, user or service keys. */
export function readSpecsRuntimeConfig(env: Readonly<Record<string, string | undefined>>): SpecsRuntimeConfig {
  const fields = ['EPS_SPECS_PG_HOST', 'EPS_SPECS_PG_PASSWORD', 'EPS_SPECS_PG_CA_BASE64'];
  if (!object(env) || Object.keys(env).some(key => key.startsWith('EPS_SPECS_PG_') && !fields.includes(key))) fail('RUNTIME_CONFIG_INVALID');
  const encoded = env.EPS_SPECS_PG_CA_BASE64;
  if (typeof encoded !== 'string' || encoded.length > 24_000 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(encoded)) fail('RUNTIME_CONFIG_INVALID');
  const bytes = Buffer.from(encoded, 'base64');
  if (bytes.toString('base64') !== encoded || !bytes.equals(Buffer.from(bytes.toString('utf8'), 'utf8'))) fail('RUNTIME_CONFIG_INVALID');
  return checkedConfig({ host: env.EPS_SPECS_PG_HOST, password: env.EPS_SPECS_PG_PASSWORD, caPem: bytes.toString('utf8') });
}

/** pg8.23.1 dispatches these handlers before releasing its configured password.
 * Keep SCRAM implementation/server-proof verification in the pinned SDK. */
class ScramOnlyClient extends Client {
  private scramStarted = false; private scramFinal = false;
  constructor(config?: ClientConfig) {
    super(config);
    this.connection.on('authenticationSASL', () => { this.scramStarted = true; });
    this.connection.on('authenticationSASLFinal', () => { this.scramFinal = true; });
  }
  _handleAuthCleartextPassword() { this.connection.emit('error', new SpecsRuntimeGatewayError('RUNTIME_AUTH_UNVERIFIED')); }
  _handleAuthMD5Password() { this.connection.emit('error', new SpecsRuntimeGatewayError('RUNTIME_AUTH_UNVERIFIED')); }
  override connect(): Promise<Client>;
  override connect(callback: (err: Error | null, client?: Client) => void): void;
  override connect(callback?: (err: Error | null, client?: Client) => void): Promise<Client> | void {
    const connection = super.connect().then(async client => {
      if (!this.scramStarted || !this.scramFinal) { await super.end(); return fail('RUNTIME_AUTH_UNVERIFIED'); }
      return client;
    });
    if (callback) { void connection.then(client => callback(null, client), error => callback(error)); return; }
    return connection;
  }
}

export interface SpecsRuntimeSqlClient {
  query(text: string, values?: unknown[]): Promise<{ rows: unknown[] }>;
  release(destroy?: boolean): void;
}
export interface SpecsRuntimePool {
  connect(): Promise<SpecsRuntimeSqlClient>; end(): Promise<void>; on(event: 'error', listener: () => void): unknown;
}
export interface SpecsRuntimeDependencies { /** Offline transport injection; never a product request field. */
  poolFactory?: (config: PoolConfig) => SpecsRuntimePool }

// Metadata only. No Auth rows, business records, passwords or source are read.
const IDENTITY_SQL = `select (
 current_user=$1 and session_user=$1 and current_database()='postgres'
 and coalesce(current_setting('request.jwt.claim.sub',true),'')=''
 and coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')='{}'
 and exists(select 1 from pg_catalog.pg_roles r where r.rolname=current_user and r.rolcanlogin and not r.rolinherit
  and not r.rolsuper and not r.rolbypassrls and not r.rolcreatedb and not r.rolcreaterole and not r.rolreplication and r.rolconnlimit between 1 and 4)
 and (select count(*)=2 and bool_and(g.rolname in('eps_jobs_executor','eps_jobs_dispatcher') and m.inherit_option and not m.set_option and not m.admin_option)
  from pg_catalog.pg_auth_members m join pg_catalog.pg_roles g on g.oid=m.roleid
  where m.member=(select oid from pg_catalog.pg_roles where rolname=current_user) or m.roleid=(select oid from pg_catalog.pg_roles where rolname=current_user))
 and not has_schema_privilege(current_user,'eps','CREATE') and not has_schema_privilege(current_user,'public','CREATE')
 and not exists(select 1 from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  where c.relkind in('r','p') and n.nspname in('eps','public','auth','storage')
  and (has_table_privilege(current_user,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
   or has_any_column_privilege(current_user,c.oid,'SELECT,INSERT,UPDATE,REFERENCES')))
 and (select count(*)=6 and bool_and(p.oid=any(array[${SERVICE_FUNCTIONS.map(name => `'${name}'::regprocedure`).join(',')}]))
  from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
  where (n.nspname='eps' or n.nspname='public' and (p.proname like 'eps\\_%' escape '\\' or p.prosecdef)) and has_function_privilege(current_user,p.oid,'EXECUTE'))
 and not exists(select 1 from pg_catalog.pg_shdepend d where d.refclassid='pg_authid'::regclass
  and d.refobjid=(select oid from pg_catalog.pg_roles where rolname=current_user) and d.deptype='o')
 and current_setting('log_parameter_max_length')='0' and current_setting('log_parameter_max_length_on_error')='0'
 and current_setting('log_statement')='none' and current_setting('log_min_duration_statement') in('-1','-1ms')
 and current_setting('log_min_duration_sample') in('-1','-1ms') and current_setting('log_transaction_sample_rate')::numeric=0
 and coalesce(current_setting('pgaudit.log',true),'none')='none' and coalesce(current_setting('pgaudit.log_parameter',true),'off') in('off','false','0')
 and coalesce(current_setting('pgaudit.role',true),'')='' and coalesce(current_setting('auto_explain.log_min_duration',true),'-1') in('-1','-1ms')
 and coalesce(current_setting('auto_explain.log_parameter_max_length',true),'0')='0'
) as allowed`;

function response(value: unknown, fields: string[]): Record<string, unknown> {
  if (!exact(value, fields)) fail('RUNTIME_RESPONSE_INVALID', 503, 'unknown'); return value;
}
function leaseDto(value: unknown, input: StageClaim): StageLease {
  const row = response(value, ['job_id', 'stage', 'attempt_id', 'lease_token', 'lease_expires_at', 'already_completed', 'input']);
  if (row.job_id !== input.job_id || row.stage !== input.stage || !id(row.attempt_id) || !date(row.lease_expires_at)
    || typeof row.already_completed !== 'boolean' || !object(row.input) || row.input.input_hash !== input.input_hash
    || typeof row.lease_token !== 'string' || (row.already_completed ? row.lease_token !== '' : !/^[a-f0-9]{64}$/u.test(row.lease_token))) fail('RUNTIME_RESPONSE_INVALID', 503, 'unknown');
  safeJson(row.input); return structuredClone(row) as unknown as StageLease;
}

/** Direct authenticated DB gateway. It is not an HTTP ServiceBearer façade and
 * makes no exact-key claim-response replay claim. Unknown writes stop the worker. */
export async function createSpecsRuntimeGateway(supplied: SpecsRuntimeConfig, dependencies: SpecsRuntimeDependencies = {}) {
  const config = checkedConfig(supplied);
  // pg consults ambient PG* for omitted/falsy options. Refuse that alternate
  // configuration source without mutating the host process environment.
  if (Object.keys(process.env).some(key => /^PG[A-Z_]*$/u.test(key) && process.env[key])) fail('RUNTIME_CONFIG_INVALID');
  const pgConfig: PoolConfig = { host: config.host, port: 5432, database: 'postgres',
    user: `${SPECS_RUNTIME_ROLE}.${SPECS_RUNTIME_PROJECT}`, password: config.password,
    ssl: { ca: config.caPem, rejectUnauthorized: true, servername: config.host, minVersion: 'TLSv1.2' }, enableChannelBinding: true, sslnegotiation: 'postgres',
    application_name: 'eps-specs-runtime', fallback_application_name: 'eps-specs-runtime', client_encoding: 'UTF8',
    options: '-c search_path=pg_catalog', pipeline: false, max: 2, min: 0, connectionTimeoutMillis: 3000,
    statement_timeout: 8000, lock_timeout: 2000, query_timeout: 10_000, idle_in_transaction_session_timeout: 10_000,
    idleTimeoutMillis: 10_000, maxLifetimeSeconds: 300, Client: ScramOnlyClient };
  const pool = dependencies.poolFactory ? dependencies.poolFactory(pgConfig) : new Pool(pgConfig);
  pool.on('error', () => { /* Never log a driver error or credential-bearing client. */ });
  let closed = false;
  async function execute(sql: string | null, values: unknown[] = [], signal?: AbortSignal): Promise<unknown> {
    if (closed) fail('RUNTIME_CLOSED'); if (signal?.aborted) fail('RUNTIME_ABORTED', 503);
    let client: SpecsRuntimeSqlClient | undefined; let released = false; let privateSent = false;
    let abort!: () => void;
    const interrupted = new Promise<never>((_resolve, reject) => {
      abort = () => { if (client && !released) { released = true; client.release(true); }
        reject(new SpecsRuntimeGatewayError('RUNTIME_ABORTED', 503, privateSent ? 'unknown' : 'known')); };
    });
    async function query(text: string, parameters: unknown[] = []) {
      if (signal?.aborted) { abort(); return await interrupted; }
      return await Promise.race([client!.query(text, parameters), interrupted]);
    }
    try {
      client = await pool.connect();
      signal?.addEventListener('abort', abort, { once: true });
      if (signal?.aborted) abort();
      await query('begin');
      const identity = await query(IDENTITY_SQL, [SPECS_RUNTIME_ROLE]);
      if (!identity || identity.rows.length !== 1 || !exact(identity.rows[0], ['allowed']) || identity.rows[0].allowed !== true) fail('RUNTIME_ROLE_UNVERIFIED');
      let value: unknown;
      if (sql !== null) {
        privateSent = true; const result = await query(sql, values);
        if (!result || result.rows.length !== 1 || !exact(result.rows[0], ['value'])) fail('RUNTIME_RESPONSE_INVALID', 503, 'unknown');
        value = result.rows[0].value;
      }
      await query('commit'); return value;
    } catch (error) {
      if (client && !released) { try { await client.query('rollback'); } catch { /* Destroy this connection below. */ } }
      if (error instanceof SpecsRuntimeGatewayError) throw error;
      if (object(error) && error.code === 'P0001' && typeof error.message === 'string') {
        const status = DOMAIN_STATUS.get(error.message); if (status) fail(error.message, status);
      }
      if (object(error) && ['55P03', '57014', '40001', '40P01'].includes(String(error.code))) fail('DEPENDENCY_UNAVAILABLE', 503);
      return fail('RUNTIME_UNAVAILABLE', 503, 'unknown');
    } finally { signal?.removeEventListener('abort', abort); if (client && !released) client.release(true); }
  }
  try { await execute(null); } catch (error) { closed = true; try { await pool.end(); } catch { /* No raw diagnostics. */ } throw error; }
  return {
    async claimOutbox(limit: number, signal?: AbortSignal) {
      integer(limit); const row = response(await execute('select eps.claim_job_outbox($1::integer) as value', [limit], signal), ['leases']);
      if (!Array.isArray(row.leases) || row.leases.length > limit) fail('RUNTIME_RESPONSE_INVALID', 503, 'unknown');
      for (const entry of row.leases) {
        const item = response(entry, ['id', 'lease_token', 'lease_expires_at', 'envelope']);
        const envelope = response(item.envelope, ['event_id', 'event_type', 'contract_version', 'job_id', 'kind', 'stage', 'input_hash', 'correlation_id']);
        if (!id(item.id) || typeof item.lease_token !== 'string' || !/^[A-Za-z0-9_-]{43}$/u.test(item.lease_token) || !date(item.lease_expires_at)
          || envelope.event_id !== item.id || envelope.event_type !== 'job.stage_ready' || envelope.contract_version !== '1.0' || !id(envelope.job_id)
          || envelope.kind !== 'specs_extract' || !STAGES.includes(String(envelope.stage)) || typeof envelope.input_hash !== 'string' || !HASH.test(envelope.input_hash)
          || typeof envelope.correlation_id !== 'string' || !/^[A-Za-z0-9._:-]{1,200}$/u.test(envelope.correlation_id)) fail('RUNTIME_RESPONSE_INVALID', 503, 'unknown');
      }
      return row;
    },
    async finishOutbox(outboxId: string, leaseToken: string, accepted: boolean, signal?: AbortSignal) {
      if (!id(outboxId) || !/^[A-Za-z0-9_-]{43}$/u.test(leaseToken) || typeof accepted !== 'boolean') fail('INVALID_REQUEST', 400);
      const row = response(await execute('select eps.finish_job_outbox($1::uuid,$2::text,$3::boolean) as value', [outboxId, leaseToken, accepted], signal), ['acknowledged', 'stale']);
      if (typeof row.acknowledged !== 'boolean' || typeof row.stale !== 'boolean') fail('RUNTIME_RESPONSE_INVALID', 503, 'unknown'); return row;
    },
    async claim(input: StageClaim, signal?: AbortSignal): Promise<StageLease> {
      if (!object(input) || Object.keys(input).some(key => !['job_id', 'stage', 'input_hash', 'workflow_execution_id'].includes(key))
        || !id(input.job_id) || !STAGES.includes(input.stage) || !HASH.test(input.input_hash)
        || input.workflow_execution_id !== undefined && (typeof input.workflow_execution_id !== 'string' || !/^[A-Za-z0-9._:-]{1,200}$/u.test(input.workflow_execution_id))) fail('INVALID_REQUEST', 400);
      return leaseDto(await execute('select eps.claim_job_stage($1::jsonb) as value', [safeJson(input)], signal), input);
    },
    async getInput(scope: { job_id: string; attempt_id: string; lease_token: string }, signal: AbortSignal): Promise<unknown> {
      if (!exact(scope, ['job_id', 'attempt_id', 'lease_token']) || !id(scope.job_id) || !id(scope.attempt_id)) fail('INVALID_REQUEST', 400); token(scope.lease_token);
      const result = await execute('select eps.get_specs_stage_input($1::uuid,$2::uuid,$3::text) as value', [scope.job_id, scope.attempt_id, scope.lease_token], signal);
      if (!object(result) || result.job_id !== scope.job_id || result.attempt_id !== scope.attempt_id || !STAGES.includes(String(result.stage))) fail('RUNTIME_RESPONSE_INVALID', 503, 'unknown');
      return result; // The native executor independently validates the exact stage shape before provider work.
    },
    async recordEvent(event: JobEvent, signal: AbortSignal): Promise<JobEventReceipt> {
      if (!object(event) || Object.keys(event).some(key => !['event_id', 'job_id', 'attempt_id', 'lease_token', 'stage', 'sequence', 'event_type', 'input_hash', 'result_schema', 'result', 'error'].includes(key))
        || !id(event.event_id) || !id(event.job_id) || !id(event.attempt_id) || !STAGES.includes(event.stage) || !HASH.test(event.input_hash)
        || !['heartbeat', 'progress', 'succeeded', 'failed'].includes(event.event_type)) fail('INVALID_REQUEST', 400);
      integer(event.sequence, Number.MAX_SAFE_INTEGER); token(event.lease_token);
      const row = response(await execute('select eps.record_job_event($1::jsonb) as value', [safeJson(event)], signal), ['event_id', 'applied', 'duplicate', 'stale', 'job_status']);
      if (row.event_id !== event.event_id || !['applied', 'duplicate', 'stale'].every(key => typeof row[key] === 'boolean')
        || !row.applied && !row.duplicate && !row.stale || !STATUSES.includes(String(row.job_status))) fail('RUNTIME_RESPONSE_INVALID', 503, 'unknown');
      return row as unknown as JobEventReceipt;
    },
    async recover(limit: number, signal?: AbortSignal) {
      integer(limit); const row = response(await execute('select eps.recover_job_stages($1::integer) as value', [limit], signal), ['recovered']);
      if (!Number.isSafeInteger(row.recovered) || (row.recovered as number) < 0 || (row.recovered as number) > limit) fail('RUNTIME_RESPONSE_INVALID', 503, 'unknown'); return row;
    },
    async close() { if (!closed) { closed = true; try { await pool.end(); } catch { fail('RUNTIME_UNAVAILABLE', 503, 'unknown'); } } },
  };
}
export type SpecsRuntimeGateway = Awaited<ReturnType<typeof createSpecsRuntimeGateway>>;
