import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLogCommand, childEnvironment, projectPilotTrace } from './read-pilot-trace.mjs';

const deployment = 'dpl_1234567890Synthetic';
const since = '2026-10-31T12:00:00.000Z';
const observedAt = '2026-10-31T12:10:00.000Z';
const scope = { deployment, since, observedAt };
const uuid = '10000000-0000-4000-8000-000000000001';
const projectId = '20000000-0000-4000-8000-000000000001';
const row = (payload, prefix = 'EPS OAuth trace ') => ({ type: 'log', data: { timestamp: Date.parse(since) + 1000,
  deploymentId: deployment, message: prefix + JSON.stringify(payload), requestId: 'private-platform-id', path: '/private?token=private-token' } });
const summary = count => ({ type: 'summary', recordsReturned: count, timeRange: { start: since, end: observedAt },
  pagination: { hasMore: false, next: null }, excludedIntervals: [] });
const lines = values => values.map(value => JSON.stringify(value)).join('\n');

test('command target and time window are explicit and bounded; private environment is not inherited', () => {
  const command = buildLogCommand(deployment, since, Date.parse(observedAt));
  assert.deepEqual(command.slice(1), ['logs', 'runtime', '--project', 'prj_7xOsfRtvJ9voYi7rTEfra5ncOoA0', '--deployment', deployment,
    '--since', since, '--json', '--limit', '100', '--query', 'EPS AND (OAuth OR MCP)', '--global-config', 'C:/Users/iway/AppData/Roaming/xdg.data/com.vercel.cli', '--scope', 'muhammed-abdelrahman']);
  for (const value of ['https://private.invalid', '--token=private', `${deployment};private`]) assert.throws(() => buildLogCommand(value, since, Date.parse(observedAt)));
  for (const value of ['private-time', '2026-10-29T00:00:00.000Z', '2026-10-31T14:00:00.000Z']) assert.throws(() => buildLogCommand(deployment, value, Date.parse(observedAt)));
  const env = childEnvironment({ SystemRoot: 'C:/Windows', DEBUG: 'private-token', VERCEL_TOKEN: 'private-token', NODE_OPTIONS: 'private-preload', PATH: 'private-path' });
  assert.deepEqual(env, { NODE_ENV: 'production', PATH: '', CI: '1', VERCEL_TELEMETRY_DISABLED: '1', VERCEL_CLI_USE_NATIVE_BINARY: '0', SystemRoot: 'C:/Windows' });
});

test('collector projects supported OAuth and MCP event metadata and excludes platform/private fields', () => {
  const events = [row({ event: 'eps.oauth.browser_session_verified', trace_id: uuid }),
    row({ event: 'eps.oauth.provider_response', trace_id: uuid, operation: 'details', method: 'GET', status: 200, variant: 'authorization_details',
      fields: { authorization_id: 'string', redirect_uri: 'string', client: 'object', user: 'object', scope: 'string' },
      client_fields: { id: 'string', name: 'string' }, user_fields: { id: 'string', email: 'string' } }),
    row({ event: 'eps.oauth.provider_response', trace_id: uuid, operation: 'details', method: 'GET', status: 200, variant: 'redirect', fields: { redirect_url: 'string' } }),
    row({ event: 'eps.oauth.provider_response', trace_id: uuid, operation: 'decision', method: 'POST', status: 400, variant: 'provider_error', fields: { code: 'string' }, error_code: 'invalid_request' }),
    row({ event: 'eps.oauth.consent_response', trace_id: uuid, status: 200 }),
    row({ event: 'eps.mcp.project_read_succeeded', entry_point: 'mcp_http', operation: 'get_project', success: true,
      request_id: uuid, principal_id: uuid, client_id: uuid, project_ids: [projectId] }, 'EPS MCP read receipt ')];
  const report = projectPilotTrace(lines([...events, summary(events.length)]), scope);
  assert.equal(report.events.length, 6); assert.equal(report.counts.complete_window, true);
  assert.deepEqual(report.events.at(-1).project_ids, [projectId]);
  const encoded = JSON.stringify(report);
  for (const privateValue of ['private-', 'path', 'requestId', 'token=', 'code=', 'authorization_id=']) assert.ok(!encoded.includes(privateValue));
});

test('unrecognized messages, extra fields, unsafe values and mismatched records never leave RAM', () => {
  const safe = { event: 'eps.oauth.browser_session_verified', trace_id: uuid };
  const invalid = [row({ ...safe, token: 'private-token' }), row({ ...safe, trace_id: 'private-selector' }),
    row({ event: 'eps.oauth.provider_response', trace_id: uuid, operation: 'details', method: 'GET', status: 400, variant: 'provider_error', error_code: 'private-error' }),
    row({ event: 'eps.oauth.provider_response', trace_id: uuid, operation: 'details', method: 'GET', status: 200, variant: 'redirect', fields: { 'private-key': 'string' } }),
    row({ ...safe, event: 'private-event' }), { ...row(safe), data: { ...row(safe).data, deploymentId: 'dpl_WrongDeployment' } },
    { type: 'log', data: { timestamp: Date.parse(since) + 1000, message: 'private-error body token=private-token' } },
    row({ event: 'eps.mcp.project_read_succeeded', entry_point: 'mcp_http', operation: 'get_project', success: true,
      request_id: uuid, principal_id: 'private-email@example.invalid', client_id: uuid, project_ids: [projectId] }, 'EPS MCP read receipt '),
    row({ event: 'eps.mcp.project_read_succeeded', entry_point: 'mcp_http', operation: 'list_projects', success: true,
      request_id: uuid, principal_id: uuid, client_id: uuid, project_ids: Array(101).fill(projectId) }, 'EPS MCP read receipt ')];
  const report = projectPilotTrace(lines([...invalid, summary(invalid.length)]), scope);
  assert.equal(report.events.length, 0); assert.equal(report.counts.rejected_events, 8); assert.equal(report.counts.unrecognized_records, 1);
  assert.equal(report.counts.complete_window, false);
  assert.ok(!JSON.stringify(report).includes('private-'));
});

test('oversized or malformed JSONL and invalid summaries fail with a generic message', () => {
  for (const text of ['private-raw-response', 'x'.repeat(2 * 1024 * 1024 + 1), lines([summary(2)]), lines([summary(0), row({})])]) {
    assert.throws(() => projectPilotTrace(text, scope), error => error.message === 'PILOT_TRACE_RESPONSE_INVALID');
  }
});
