/** Read-only pilot trace collection. Importing performs no filesystem/provider IO.
 * Raw CLI output stays bounded in RAM. Only closed, fixed-metadata events leave. */
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '../../..');
const CLI = path.join(ROOT, '.local/m07-pilot/tooling/node_modules/vercel/dist/vc.js');
const CLI_SHA = '5724f20cc65bb0e13c7a0668af107770ddb101bb72dd3fd6160aca672ea2a493';
const GLOBAL = 'C:/Users/iway/AppData/Roaming/xdg.data/com.vercel.cli';
const PROJECT = 'prj_7xOsfRtvJ9voYi7rTEfra5ncOoA0';
const ORIGIN = 'https://everyone-presentation-pilot.vercel.app';
const MAXIMUM = 2 * 1024 * 1024;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value, keys) => object(value) && Object.keys(value).sort().join(',') === [...keys].sort().join(',');
const uuid = value => typeof value === 'string' && UUID.test(value);
const fail = code => { throw new Error(code); };
const need = value => { if (!value) fail('PILOT_TRACE_RESPONSE_INVALID'); };
function iso(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/u.test(value) || !Number.isFinite(Date.parse(value))) return null;
  const result = new Date(value).toISOString();
  return result === value || result === value.replace('Z', '.000Z') ? result : null;
}
function deploymentId(value) {
  if (typeof value !== 'string' || !/^dpl_[A-Za-z0-9]{10,80}$/u.test(value)) fail('PILOT_TRACE_ARGUMENTS_INVALID');
  return value;
}
function windowStart(value, now) {
  const normalized = iso(value);
  if (!normalized || Date.parse(normalized) < now - 24 * 60 * 60_000 || Date.parse(normalized) > now + 60_000) fail('PILOT_TRACE_ARGUMENTS_INVALID');
  return normalized;
}
export function buildLogCommand(deployment, since, now = Date.now()) {
  deploymentId(deployment); const start = windowStart(since, now);
  return [CLI, 'logs', 'runtime', '--project', PROJECT, '--deployment', deployment, '--since', start,
    '--json', '--limit', '100', '--query', 'EPS AND (OAuth OR MCP)', '--global-config', GLOBAL, '--scope', 'muhammed-abdelrahman'];
}
export function childEnvironment(source = process.env) {
  const result = { NODE_ENV: 'production', PATH: '', CI: '1', VERCEL_TELEMETRY_DISABLED: '1', VERCEL_CLI_USE_NATIVE_BINARY: '0' };
  for (const key of ['SystemRoot', 'WINDIR', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'HOMEDRIVE', 'HOMEPATH', 'TEMP', 'TMP', 'LANG']) {
    if (typeof source[key] === 'string') result[key] = source[key];
  }
  return result;
}
const TYPES = new Set(['string', 'number', 'boolean', 'object', 'array', 'null', 'undefined']);
const FIELDS = ['authorization_id', 'redirect_uri', 'client', 'user', 'scope', 'redirect_url', 'error', 'error_code', 'code', 'message', 'msg'];
const ERRORS = new Set(['oauth_authorization_not_found', 'oauth_authorization_expired', 'oauth_client_not_found', 'invalid_request', 'invalid_scope',
  'access_denied', 'flow_state_not_found', 'flow_state_expired', 'session_not_found', 'session_expired', 'bad_jwt', 'unexpected_failure', 'other']);
const VARIANTS = new Set(['authorization_details', 'redirect', 'provider_error', 'non_object', 'unrecognized', 'oversized', 'invalid_json',
  'inspection_timeout', 'inspection_unavailable', 'transport_error']);
function typeFields(value, allowed) {
  if (!object(value) || Object.keys(value).some(key => !allowed.includes(key) || !TYPES.has(value[key]))) return null;
  return Object.fromEntries(Object.keys(value).map(key => [key, value[key]]));
}
function oauth(value) {
  if (!object(value) || !uuid(value.trace_id)) return null;
  if (value.event === 'eps.oauth.browser_session_verified') return exact(value, ['event', 'trace_id']) ? { event: value.event, trace_id: value.trace_id } : null;
  if (value.event === 'eps.oauth.consent_response') return exact(value, ['event', 'trace_id', 'status']) && Number.isInteger(value.status) && value.status >= 100 && value.status <= 599
    ? { event: value.event, trace_id: value.trace_id, status: value.status } : null;
  if (value.event !== 'eps.oauth.provider_response' || !['details', 'decision'].includes(value.operation) || !['GET', 'POST', 'other'].includes(value.method)
    || !VARIANTS.has(value.variant) || !(value.status === null && value.variant === 'transport_error'
      || Number.isInteger(value.status) && value.status >= 100 && value.status <= 599 && value.variant !== 'transport_error')) return null;
  const required = ['event', 'trace_id', 'operation', 'method', 'status', 'variant'];
  const allowed = [...required, 'fields', 'client_fields', 'user_fields', 'error_code'];
  if (required.some(key => !Object.hasOwn(value, key)) || Object.keys(value).some(key => !allowed.includes(key))) return null;
  const result = Object.fromEntries(required.map(key => [key, value[key]]));
  for (const [key, names] of [['fields', FIELDS], ['client_fields', ['id', 'name', 'uri', 'logo_uri']], ['user_fields', ['id', 'email']]]) {
    if (!Object.hasOwn(value, key)) continue;
    const fields = typeFields(value[key], names); if (!fields) return null; result[key] = fields;
  }
  if (Object.hasOwn(value, 'error_code')) { if (!ERRORS.has(value.error_code)) return null; result.error_code = value.error_code; }
  return result;
}
function mcp(value) {
  if (!exact(value, ['event', 'entry_point', 'operation', 'success', 'request_id', 'principal_id', 'client_id', 'project_ids'])
    || value.event !== 'eps.mcp.project_read_succeeded' || value.entry_point !== 'mcp_http' || !['get_project', 'list_projects'].includes(value.operation)
    || value.success !== true || !uuid(value.request_id) || !uuid(value.principal_id) || !uuid(value.client_id)
    || !Array.isArray(value.project_ids) || value.project_ids.length > 100 || value.project_ids.some(id => !uuid(id))
    || new Set(value.project_ids).size !== value.project_ids.length || value.operation === 'get_project' && value.project_ids.length !== 1) return null;
  return { event: value.event, entry_point: 'mcp_http', operation: value.operation, success: true, request_id: value.request_id,
    principal_id: value.principal_id, client_id: value.client_id, project_ids: [...value.project_ids] };
}
function eventTime(value, start, end) {
  const parsed = Number.isSafeInteger(value) ? value : iso(value) ? Date.parse(value) : NaN;
  return Number.isFinite(parsed) && parsed >= start && parsed <= end + 60_000 ? new Date(parsed).toISOString() : null;
}
export function projectPilotTrace(text, scope) {
  deploymentId(scope.deployment); const observedAt = iso(scope.observedAt); need(observedAt);
  const since = windowStart(scope.since, Date.parse(observedAt));
  need(typeof text === 'string' && Buffer.byteLength(text) <= MAXIMUM);
  const rows = text.trim().split(/\r?\n/u); need(rows.length >= 1 && rows.length <= 202);
  const counts = { log_records: 0, matched_events: 0, rejected_events: 0, unrecognized_records: 0, warning_records: 0,
    has_more: null, excluded_intervals: null, complete_window: false };
  const events = []; let summary = null;
  for (const line of rows) {
    need(line.length > 0 && Buffer.byteLength(line) <= 262144 && !summary);
    let row; try { row = JSON.parse(line); } catch { fail('PILOT_TRACE_RESPONSE_INVALID'); }
    need(object(row));
    if (row.type === 'summary') { summary = row; continue; }
    if (row.type === 'warning') { counts.warning_records++; continue; }
    need(row.type === 'log' && object(row.data) && ++counts.log_records <= 100);
    const data = row.data, message = data.message;
    const prefix = typeof message === 'string' && message.startsWith('EPS OAuth trace ') ? 'EPS OAuth trace '
      : typeof message === 'string' && message.startsWith('EPS MCP read receipt ') ? 'EPS MCP read receipt ' : null;
    if (!prefix) { counts.unrecognized_records++; continue; }
    const loggedAt = eventTime(data.timestamp, Date.parse(since), Date.parse(observedAt));
    if (!loggedAt || data.truncated === true || data.deploymentId !== undefined && data.deploymentId !== scope.deployment
      || data.projectId !== undefined && data.projectId !== PROJECT || Buffer.byteLength(message) > 8192) { counts.rejected_events++; continue; }
    let value; try { value = JSON.parse(message.slice(prefix.length)); } catch { counts.rejected_events++; continue; }
    const projected = prefix === 'EPS OAuth trace ' ? oauth(value) : mcp(value);
    if (!projected) { counts.rejected_events++; continue; }
    events.push({ logged_at: loggedAt, ...projected }); counts.matched_events++;
  }
  need(exact(summary, ['type', 'recordsReturned', 'timeRange', 'pagination', 'excludedIntervals']) && summary.recordsReturned === counts.log_records
    && exact(summary.timeRange, ['start', 'end']) && iso(summary.timeRange.start) === since
    && eventTime(summary.timeRange.end, Date.parse(since), Date.parse(observedAt)) !== null
    && exact(summary.pagination, ['hasMore', 'next']) && typeof summary.pagination.hasMore === 'boolean'
    && (summary.pagination.next === null || typeof summary.pagination.next === 'string' && summary.pagination.next.length <= 65536)
    && Array.isArray(summary.excludedIntervals) && summary.excludedIntervals.length <= 100);
  for (const interval of summary.excludedIntervals) need(exact(interval, ['start', 'end']) && iso(interval.start) && iso(interval.end) && Date.parse(interval.start) <= Date.parse(interval.end));
  counts.has_more = summary.pagination.hasMore; counts.excluded_intervals = summary.excludedIntervals.length;
  counts.complete_window = !counts.has_more && counts.excluded_intervals === 0 && counts.warning_records === 0
    && counts.rejected_events === 0 && counts.unrecognized_records === 0;
  return { schema_version: '1.0', read_only: true, observed_at: observedAt, since, deployment_id: scope.deployment, project_id: PROJECT,
    public_origin: ORIGIN, counts, events };
}
async function pinnedCli() {
  try {
    for (const file of [CLI, path.join(path.dirname(CLI), '../package.json')]) {
      const info = await lstat(file);
      if (!info.isFile() || info.isSymbolicLink() || info.size > 8 * 1024 * 1024 || path.resolve(await realpath(file)).toLowerCase() !== path.resolve(file).toLowerCase()) fail('PILOT_TRACE_CLI_UNPINNED');
    }
    if (createHash('sha256').update(await readFile(CLI)).digest('hex') !== CLI_SHA
      || JSON.parse(await readFile(path.join(path.dirname(CLI), '../package.json'), 'utf8')).version !== '65.8.0') fail('PILOT_TRACE_CLI_UNPINNED');
  } catch { fail('PILOT_TRACE_CLI_UNPINNED'); }
}
function runtimeLogs(args) {
  return new Promise((resolve, reject) => {
    let child; const chunks = []; let bytes = 0, settled = false;
    const stop = () => { if (settled) return; settled = true; clearTimeout(timer); child?.kill(); reject(new Error('PILOT_TRACE_READ_UNCONFIRMED')); };
    const timer = setTimeout(stop, 30_000);
    try { child = spawn(process.execPath, args, { cwd: ROOT, env: childEnvironment(), windowsHide: true, shell: false, stdio: ['ignore', 'pipe', 'pipe'] }); }
    catch { stop(); return; }
    child.once('error', stop);
    child.stdout.on('data', chunk => { bytes += chunk.length; if (bytes > MAXIMUM) stop(); else if (!settled) chunks.push(chunk); });
    child.stderr.on('data', chunk => { bytes += chunk.length; if (bytes > MAXIMUM) stop(); });
    child.once('close', code => {
      if (settled) return; if (code !== 0) { stop(); return; } settled = true; clearTimeout(timer);
      try { resolve(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))); }
      catch { reject(new Error('PILOT_TRACE_RESPONSE_INVALID')); }
    });
  });
}
async function main() {
  const [mode, deployment, suppliedSince, ...extra] = process.argv.slice(2);
  if (!['preview', 'collect'].includes(mode) || extra.length || process.platform !== 'win32' || !/^v24\./u.test(process.version) || process.env.NODE_OPTIONS) fail('PILOT_TRACE_ARGUMENTS_INVALID');
  const args = buildLogCommand(deployment, suppliedSince); await pinnedCli();
  if (mode === 'preview') {
    process.stdout.write(JSON.stringify({ mode: 'preview', read_only: true, provider_reads: 0, deployment_id: deployment, project_id: PROJECT,
      public_origin: ORIGIN, since: args[8], limit: 100 }) + '\n'); return;
  }
  const text = await runtimeLogs(args), observedAt = new Date().toISOString();
  const report = projectPilotTrace(text, { deployment, since: args[8], observedAt });
  const directory = path.join(ROOT, 'tracking/evidence/m07/oauth-consent-fix'); await mkdir(directory, { recursive: true });
  const info = await lstat(directory);
  if (!info.isDirectory() || info.isSymbolicLink() || path.resolve(await realpath(directory)).toLowerCase() !== directory.toLowerCase()) fail('PILOT_TRACE_OUTPUT_UNCONFIRMED');
  await writeFile(path.join(directory, `${observedAt.replaceAll(':', '-')}-${randomUUID().slice(0, 8)}-pilot-trace.json`), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  process.stdout.write(JSON.stringify(report) + '\n');
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch(() => { process.stderr.write('PILOT_TRACE_UNCONFIRMED\n'); process.exitCode = 1; });
}
