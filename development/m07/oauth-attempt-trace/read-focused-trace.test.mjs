import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLogCommand } from '../oauth-consent-fix/read-pilot-trace.mjs';
import { buildFocusedLogCommand, projectFocusedTrace, focusedTraceSummary } from './read-focused-trace.mjs';

const deployment = 'dpl_1234567890Synthetic';
const since = '2026-10-31T13:00:00.000Z', observedAt = '2026-10-31T13:10:00.000Z';
const scope = { deployment, since, observedAt };
const traceId = '10000000-0000-4000-8000-000000000001', projectId = '20000000-0000-4000-8000-000000000001';
const row = (value, prefix = 'EPS OAuth trace ') => ({ type: 'log', data: { timestamp: Date.parse(since) + 1000, deploymentId: deployment,
  message: prefix + JSON.stringify(value), path: '/private?token=private-token', private: 'private-platform-payload' } });
const summary = count => ({ type: 'summary', recordsReturned: count, timeRange: { start: since, end: observedAt },
  pagination: { hasMore: false, next: null }, excludedIntervals: [] });
const lines = values => values.map(value => JSON.stringify(value)).join('\n');

test('focused commands retain every fixed deployment/time/CLI argument and narrow only the closed query', () => {
  const broad = buildLogCommand(deployment, since, Date.parse(observedAt));
  for (const [mode, query] of [['oauth', 'EPS AND OAuth'], ['reads', 'EPS AND MCP AND read']]) {
    const focused = buildFocusedLogCommand(mode, deployment, since, Date.parse(observedAt));
    const queryIndex = broad.indexOf('--query') + 1;
    assert.equal(focused[queryIndex], query);
    const restored = [...focused]; restored[queryIndex] = broad[queryIndex]; assert.deepEqual(restored, broad);
  }
});

test('focused commands reject arbitrary query modes, malformed deployment and out-of-window times', () => {
  for (const mode of ['collect', 'preview', 'oauth OR private', '--token=private', '', undefined]) {
    assert.throws(() => buildFocusedLogCommand(mode, deployment, since, Date.parse(observedAt)), /FOCUSED_TRACE_ARGUMENTS_INVALID/u);
  }
  for (const value of ['https://private.invalid', '--token=private', `${deployment};private`]) {
    assert.throws(() => buildFocusedLogCommand('oauth', value, since, Date.parse(observedAt)));
  }
  for (const value of ['private-time', '2026-10-29T00:00:00.000Z', '2026-10-31T14:00:00.000Z']) {
    assert.throws(() => buildFocusedLogCommand('reads', deployment, value, Date.parse(observedAt)));
  }
});

test('focused receipts keep the original closed projection and filter stdout to useful focus events', () => {
  const values = [row({ event: 'eps.oauth.browser_session_verified', trace_id: traceId }),
    row({ event: 'eps.mcp.authorization_stage', trace_id: traceId, stage: 'authorized', result: 'accepted', status: null }, 'EPS MCP auth trace '),
    row({ event: 'eps.mcp.project_read_succeeded', entry_point: 'mcp_http', operation: 'get_project', success: true,
      request_id: traceId, principal_id: traceId, client_id: traceId, project_ids: [projectId] }, 'EPS MCP read receipt ')];
  const text = lines([...values, summary(values.length)]);
  for (const mode of ['oauth', 'reads']) {
    const receipt = projectFocusedTrace(text, scope, mode);
    assert.deepEqual(Object.keys(receipt).sort(), ['focused_scope', 'read_only', 'schema_version', 'trace']);
    assert.equal(receipt.focused_scope, mode); assert.equal(receipt.trace.events.length, 3); assert.equal(receipt.trace.counts.complete_window, true);
    const output = focusedTraceSummary(receipt, 'tracking/evidence/m07/oauth-attempt-trace/synthetic-focused-trace.json');
    assert.equal(output.events.length, 1);
    assert.equal(output.events[0].event, mode === 'oauth' ? 'eps.oauth.browser_session_verified' : 'eps.mcp.project_read_succeeded');
    for (const privateValue of ['private-', 'token=', 'path', 'authorization_stage']) assert.ok(!JSON.stringify(output.events).includes(privateValue));
    assert.ok(!JSON.stringify(receipt).includes('private-'));
  }
});

test('focused report preserves saturation and rejection evidence without claiming complete broad coverage', () => {
  const last = summary(1); last.pagination = { hasMore: true, next: 'private-page-token' };
  const receipt = projectFocusedTrace(lines([row({ event: 'eps.oauth.browser_session_verified', trace_id: traceId, token: 'private-token' }), last]), scope, 'oauth');
  assert.equal(receipt.trace.counts.complete_window, false); assert.equal(receipt.trace.counts.has_more, true); assert.equal(receipt.trace.counts.rejected_events, 1);
  assert.deepEqual(receipt.trace.events, []); assert.ok(!JSON.stringify(receipt).includes('private-'));
  assert.throws(() => projectFocusedTrace('private-raw-response', scope, 'oauth'), /PILOT_TRACE_RESPONSE_INVALID/u);
  assert.throws(() => projectFocusedTrace(lines([summary(0)]), scope, 'private-mode'), /FOCUSED_TRACE_ARGUMENTS_INVALID/u);
});
