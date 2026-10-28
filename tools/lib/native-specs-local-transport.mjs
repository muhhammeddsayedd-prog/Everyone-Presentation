/** LOCAL AUTHORIZATION ACCEPTANCE ONLY. No credential authentication proof.
 * Direct restricted DB login over the observed inside-container loopback TRUST
 * route; never a hosted service, arbitrary target or SQL API.
 * psql17 \bind keeps private JSON out of SQL text; server logging still requires
 * the fixed session guard and a later observed synthetic-sentinel proof.
 */
import { Buffer } from 'node:buffer';
import { spawn } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';
import process from 'node:process';
import { clearTimeout, setTimeout } from 'node:timers';
import { runOwnedLocalSql, verifyLocalTarget } from '../local-postgres.mjs';

const CONTAINER = 'eps-presentation-canonical-pg17-local';
const SYSTEM_ID = '7701520506262638626';
const EXECUTOR_LOGIN = 'eps_native_specs_local_probe';
const ENDPOINT = process.platform === 'win32' ? 'npipe:////./pipe/dockerDesktopLinuxEngine' : 'unix:///var/run/docker.sock';
const CONTEXT = process.platform === 'win32' ? 'desktop-linux' : 'default';
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u;
const HASH = /^[a-f0-9]{64}$/u;
const STAGES = ['prepare_document', 'extract_specs', 'apply_specs'];
const CODES = ['INVALID_REQUEST', 'RESOURCE_NOT_FOUND', 'CAPABILITY_REQUIRED', 'INPUT_CHANGED', 'INPUT_HASH_MISMATCH',
  'JOB_CANCELLED', 'JOB_ALREADY_RUNNING', 'JOB_NOT_AVAILABLE', 'RETRY_EXHAUSTED', 'STAGE_OUT_OF_ORDER', 'STAGE_STATE_INVALID',
  'STALE_STAGE_LEASE', 'LEASE_INVALID', 'EVENT_ID_CONFLICT', 'EVENT_SEQUENCE_CONFLICT', 'INVALID_PROGRESS', 'RESULT_INVALID',
  'FEATURE_NOT_IMPLEMENTED', 'SLOT_ALLOCATION_LIMIT_EXCEEDED'];
const CALLS = Object.freeze({
  claim: 'eps.claim_job_stage(arguments_value)',
  input: "eps.get_specs_stage_input((arguments_value->>'job_id')::uuid,(arguments_value->>'attempt_id')::uuid,arguments_value->>'lease_token')",
  event: 'eps.record_job_event(arguments_value)',
  recover: "eps.recover_job_stages((arguments_value->>'limit')::integer)",
});
export class NativeSpecsTransportError extends Error {
  constructor(code, { status = 503, unknown = false } = {}) {
    super('The owned-local stage operation could not be confirmed.');
    this.name = 'NativeSpecsTransportError'; this.code = code; this.status = status; this.unknown = unknown;
  }
}
const TRANSPORT_CODES = new Set([...CODES, 'NATIVE_QUERY_CANCELLED', 'NATIVE_RPC_FAILED', 'NATIVE_INPUT_INVALID', 'NATIVE_ABORTED',
  'NATIVE_CALL_UNCONFIRMED', 'NATIVE_TARGET_REJECTED', 'NATIVE_TARGET_CHANGED', 'NATIVE_RESPONSE_UNCONFIRMED', 'NATIVE_SETTLEMENT_UNCONFIRMED']);
export function nativeSpecsTransportFailure(error) {
  if (!(error instanceof NativeSpecsTransportError)) return null;
  return { code: TRANSPORT_CODES.has(error.code) ? error.code : 'NATIVE_CALL_UNCONFIRMED',
    status: Number.isSafeInteger(error.status) && error.status >= 400 && error.status <= 599 ? error.status : 503,
    unknown: error.unknown === true };
}
function fail(code, options) { throw new NativeSpecsTransportError(code, options); }
function requireValue(value) { if (!value) fail('NATIVE_INPUT_INVALID', { status: 400 }); }
const object = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const exact = (value, fields) => object(value) && Object.keys(value).length === fields.length && fields.every(field => Object.hasOwn(value, field));

/** Pure protocol compiler, exported for offline inspection. It executes nothing.
 * Every SQL identifier and function call is fixed; only one hex bind value varies.
 * https://www.postgresql.org/docs/17/app-psql.html#APP-PSQL-META-COMMANDS-BIND
 */
export function compileNativeSpecsCall(operation, supplied, label) {
  requireValue(Object.hasOwn(CALLS, operation) && /^eps-native-specs-[a-f0-9-]{36}-[1-9][0-9]{0,5}$/u.test(label));
  let args;
  try { args = JSON.parse(JSON.stringify(supplied)); } catch { fail('NATIVE_INPUT_INVALID', { status: 400 }); }
  if (operation === 'claim') {
    requireValue(exact(args, ['job_id', 'stage', 'input_hash']) && UUID.test(args.job_id) && STAGES.includes(args.stage) && HASH.test(args.input_hash));
  } else if (operation === 'input') {
    requireValue(exact(args, ['job_id', 'attempt_id', 'lease_token']) && UUID.test(args.job_id) && UUID.test(args.attempt_id)
      && typeof args.lease_token === 'string' && args.lease_token.length >= 1 && args.lease_token.length <= 1024 && !/[\s\p{C}]/u.test(args.lease_token));
  } else if (operation === 'recover') {
    requireValue(exact(args, ['limit']) && Number.isSafeInteger(args.limit) && args.limit >= 1 && args.limit <= 100);
  } else {
    requireValue(object(args) && UUID.test(args.job_id) && UUID.test(args.attempt_id) && typeof args.lease_token === 'string'
      && args.lease_token.length >= 1 && args.lease_token.length <= 1024 && !/[\s\p{C}]/u.test(args.lease_token)
      && STAGES.includes(args.stage) && HASH.test(args.input_hash));
  }
  const json = JSON.stringify(args); requireValue(Buffer.byteLength(json, 'utf8') <= 294912);
  const hex = Buffer.from(json, 'utf8').toString('hex');
  const prefix = `begin;
set local application_name='${label}';
set local lock_timeout='2s'; set local statement_timeout='8s';
do $identity_guard$ begin
 if current_user<>'${EXECUTOR_LOGIN}' or session_user<>'${EXECUTOR_LOGIN}' or current_database()<>'postgres'
  or pg_catalog.inet_client_addr() is distinct from '127.0.0.1'::inet
  or pg_catalog.inet_server_addr() is distinct from '127.0.0.1'::inet
  or pg_catalog.inet_server_port() is distinct from 5432
  or not pg_has_role(current_user,'eps_jobs_executor','USAGE')
  or exists(select 1 from pg_roles where rolname=current_user and (rolsuper or rolbypassrls or rolcreatedb or rolcreaterole or rolreplication))
  or coalesce(current_setting('request.jwt.claim.sub',true),'')<>''
  or coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')<>'{}'
 then raise exception 'NATIVE_EXECUTOR_SCOPE_REQUIRED'; end if;
end $identity_guard$;
do $logging_guard$ begin
 if current_setting('log_parameter_max_length')<>'0' or current_setting('log_parameter_max_length_on_error')<>'0'
  or current_setting('log_statement')<>'none'
  or current_setting('log_min_duration_statement') not in('-1','-1ms')
  or current_setting('log_min_duration_sample') not in('-1','-1ms')
  or current_setting('log_transaction_sample_rate')::numeric<>0
  or coalesce(current_setting('pgaudit.log',true),'none')<>'none'
  or coalesce(current_setting('pgaudit.log_parameter',true),'off') not in('off','false','0')
  or coalesce(current_setting('pgaudit.role',true),'')<>''
  or coalesce(current_setting('auto_explain.log_min_duration',true),'-1') not in('-1','-1ms')
  or coalesce(current_setting('auto_explain.log_parameter_max_length',true),'0')<>'0'
 then raise exception 'NATIVE_LOGGING_UNSAFE'; end if;
end $logging_guard$;
`;
  // No private constant is embedded in a server statement, including the DO.
  const bindingQuery = "select pg_catalog.set_config('eps.native_specs.arguments',pg_catalog.convert_from(pg_catalog.decode($1,'hex'),'UTF8'),true) is not null as bound";
  const body = `do $fixed_operation$ declare arguments_value jsonb;
 result_value jsonb; envelope_value jsonb; fault_code text; fault_detail text; fault_status integer;
begin
 begin
  arguments_value:=current_setting('eps.native_specs.arguments')::jsonb;
  result_value:=${CALLS[operation]};
  envelope_value:=jsonb_build_object('ok',true,'value',result_value);
 exception when query_canceled then
  envelope_value:=jsonb_build_object('ok',false,'code','NATIVE_QUERY_CANCELLED','status',503);
 when others then
  fault_code:=case when sqlerrm=any(array[${CODES.map(code => `'${code}'`).join(',')}]) then sqlerrm else 'NATIVE_RPC_FAILED' end;
  get stacked diagnostics fault_detail=pg_exception_detail;
  begin fault_status:=(fault_detail::jsonb->>'status')::integer; exception when others then fault_status:=503; end;
  if fault_status is null or fault_status not between 400 and 599 then fault_status:=503; end if;
  envelope_value:=jsonb_build_object('ok',false,'code',fault_code,'status',fault_status);
 end;
 perform pg_catalog.set_config('eps.native_specs.result',envelope_value::text,true);
end $fixed_operation$;
select current_setting('eps.native_specs.result')::jsonb;
commit;
`;
  return Object.freeze({ script: `${prefix}${bindingQuery} \\bind '${hex}' \\gset native_specs_\n${body}`,
    serverSql: `${prefix}${bindingQuery};\n${body}`, label });
}

/** Output/error text never becomes a thrown diagnostic or a receipt. */
async function docker(args, { input, signal, maximum = 2 * 1024 * 1024, timeoutMs = 12000 } = {}) {
  if (signal?.aborted) fail('NATIVE_ABORTED', { unknown: false });
  return await new Promise((resolve, reject) => {
    const child = spawn('docker', args, { shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    const chunks = []; let size = 0; let errors = 0; let uncertain = false;
    const interrupt = () => { uncertain = true; child.kill(); };
    const timer = setTimeout(interrupt, timeoutMs); signal?.addEventListener('abort', interrupt, { once: true });
    child.stdin.on('error', () => {});
    child.stdout.on('data', chunk => { size += chunk.length; if (size > maximum) interrupt(); else chunks.push(chunk); });
    child.stderr.on('data', chunk => { errors += chunk.length; if (errors > 65536) interrupt(); });
    child.on('error', () => { uncertain = true; });
    child.on('close', code => {
      clearTimeout(timer); signal?.removeEventListener('abort', interrupt);
      if (uncertain || code !== 0) reject(new NativeSpecsTransportError('NATIVE_CALL_UNCONFIRMED', { unknown: true }));
      else resolve(Buffer.concat(chunks).toString('utf8'));
    });
    child.stdin.end(input);
  });
}
export async function verifyNativeSpecsLocalTarget() {
  requireValue(['win32', 'linux'].includes(process.platform));
  if (['DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_TLS', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH', 'DOCKER_CONFIG'].some(key => process.env[key])) fail('NATIVE_TARGET_REJECTED');
  const current = (await docker(['context', 'show'], { maximum: 65536 })).trim();
  const endpoint = (await docker(['context', 'inspect', CONTEXT, '--format', '{{.Endpoints.docker.Host}}'], { maximum: 65536 })).trim();
  if (current !== CONTEXT || endpoint !== ENDPOINT) fail('NATIVE_TARGET_REJECTED');
  const observed = await verifyLocalTarget();
  if (observed.config.container !== CONTAINER || observed.observed.system_identifier !== SYSTEM_ID || !HASH.test(observed.container.Id)) fail('NATIVE_TARGET_REJECTED');
  const format = '{"Id":{{json .Id}},"Image":{{json .Image}},"Labels":{{json .Config.Labels}},"Mounts":{{json .Mounts}},"Bindings":{{json .HostConfig.PortBindings}},"Ports":{{json .NetworkSettings.Ports}},"Running":{{json .State.Running}}}';
  let pinned;
  try { pinned = JSON.parse(await docker(['--host', ENDPOINT, 'container', 'inspect', observed.container.Id, '--format', format], { maximum: 65536 })); }
  catch { fail('NATIVE_TARGET_REJECTED'); }
  if (pinned.Id !== observed.container.Id || pinned.Image !== observed.container.Image || pinned.Running !== true
    || !isDeepStrictEqual(pinned.Labels, observed.container.Config.Labels) || !isDeepStrictEqual(pinned.Mounts, observed.container.Mounts)
    || !isDeepStrictEqual(pinned.Bindings, observed.container.HostConfig.PortBindings) || !isDeepStrictEqual(pinned.Ports, observed.container.NetworkSettings.Ports)) fail('NATIVE_TARGET_REJECTED');
  return observed;
}

/** Pure fixed route compiler. It never connects or chooses an identity/target. */
export function compileNativeSpecsRuntimeArgs(containerId) {
  requireValue(typeof containerId === 'string' && HASH.test(containerId));
  return Object.freeze(['--host', ENDPOINT, 'exec', '--user', '65534:65534', '-i', containerId,
    'env', '-i', 'PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin', 'HOME=/tmp',
    'PGPASSFILE=/dev/null', 'PGCONNECT_TIMEOUT=3', 'PGSSLMODE=disable',
    'psql', '-X', '-q', '-A', '-t', '-w', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=sqlstate', '-v', 'SHOW_CONTEXT=never',
    '-h', '127.0.0.1', '-p', '5432', '-U', EXECUTOR_LOGIN, '-d', 'postgres']);
}

export function createNativeSpecsLocalTransport(runId) {
  requireValue(typeof runId === 'string' && UUID.test(runId));
  let sequence = 0; let containerId; const backends = new Set();
  async function invoke(operation, args, signal) {
    const label = `eps-native-specs-${runId}-${++sequence}`;
    const compiled = compileNativeSpecsCall(operation, args, label);
    const observed = await verifyNativeSpecsLocalTarget();
    if (containerId && containerId !== observed.container.Id) fail('NATIVE_TARGET_CHANGED');
    containerId = observed.container.Id; backends.add(label);
    const output = await docker(compileNativeSpecsRuntimeArgs(containerId), { input: compiled.script, signal });
    let response;
    try { const rows = output.split(/\r?\n/u).filter(line => line.startsWith('{')); requireValue(rows.length === 1); response = JSON.parse(rows[0]); }
    catch { fail('NATIVE_RESPONSE_UNCONFIRMED', { unknown: true }); }
    if (!object(response) || typeof response.ok !== 'boolean') fail('NATIVE_RESPONSE_UNCONFIRMED', { unknown: true });
    if (!response.ok) {
      if (!exact(response, ['ok', 'code', 'status']) || ![...CODES, 'NATIVE_QUERY_CANCELLED', 'NATIVE_RPC_FAILED'].includes(response.code)
        || !Number.isSafeInteger(response.status) || response.status < 400 || response.status > 599) fail('NATIVE_RESPONSE_UNCONFIRMED', { unknown: true });
      fail(response.code, { status: response.status });
    }
    if (!exact(response, ['ok', 'value'])) fail('NATIVE_RESPONSE_UNCONFIRMED', { unknown: true });
    return response.value;
  }
  return Object.freeze({
    claim: (args, signal) => invoke('claim', args, signal),
    getInput: (args, signal) => invoke('input', args, signal),
    recordEvent: (args, signal) => invoke('event', args, signal),
    recover: (limit, signal) => invoke('recover', { limit }, signal),
    async settle() {
      const observed = await verifyNativeSpecsLocalTarget();
      if (containerId && containerId !== observed.container.Id) fail('NATIVE_TARGET_CHANGED', { unknown: true });
      if (!backends.size) return true;
      const labels = [...backends].map(label => `'${label}'`).join(',');
      for (let attempt = 0; attempt < 20; attempt++) {
        const result = await runOwnedLocalSql(`begin read only; select jsonb_build_object('remaining',count(*)) from pg_stat_activity where application_name in(${labels}); rollback;`);
        let rows; try { rows = result.stdout.split(/\r?\n/u).filter(line => line.startsWith('{')).map(line => JSON.parse(line)); } catch { fail('NATIVE_SETTLEMENT_UNCONFIRMED', { unknown: true }); }
        if (rows.length === 1 && rows[0].remaining === 0) { backends.clear(); return true; }
        await new Promise(resolve => setTimeout(resolve, 250));
      }
      fail('NATIVE_SETTLEMENT_UNCONFIRMED', { unknown: true });
    },
  });
}
