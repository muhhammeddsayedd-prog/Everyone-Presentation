import test from 'node:test';
import assert from 'node:assert/strict';
import { projectDaemon, projectRuntimeLogs, runtimeObservation, daemonCommands, validateDeploymentId, PROJECT, TEAM, SLUG } from './daemon-runtime.mjs';
const deployment = 'dpl_SYNTHETIC000000000000001';
const instance = 'dmni_01k7d0q5w3x8y9z0a1b2c3d4e5';
const now = Date.parse('2026-10-30T23:00:00.000Z');
const window = { start: now - 600000, end: now };
const image = 'vcr.vercel.com/muhammed-abdelrahman/everyone-presentation-worker-pilot/daemon@sha256:' + 'a'.repeat(64);
function metadata() {
  return { daemon: { name: 'worker', deploymentId: deployment, status: 'ready', updatedAt: new Date(now - 60000).toISOString(),
    config: { image: { requested: image, resolved: image }, instances: { dub1: 1 }, resources: { requests: { memory: '2048Mi' } },
      terminationGracePeriodSeconds: 300, command: 'SYNTHETIC_PRIVATE', livenessProbe: { headers: { secret: 'SYNTHETIC_PRIVATE' } } },
    instances: { desired: 1, ready: 1, total: 1, items: [{ id: instance, alive: true, image, region: 'dub1', memoryMiB: 2048,
      startedAt: new Date(now - 50000).toISOString(), lastCheckedAt: new Date(now - 1000).toISOString(), env: 'SYNTHETIC_PRIVATE' }] } },
    context: { project: { id: PROJECT, name: 'everyone-presentation-worker-pilot' }, team: { id: TEAM, slug: SLUG }, environment: 'production' },
    scalingOverridden: false, next: [{ command: 'SYNTHETIC_PRIVATE' }] };
}
function logs(message = { event: 'specs_worker_started', authentication: 'narrow_database_login', orchestration: 'n8n_required' }, patch = {}, summaryPatch = {}) {
  return [JSON.stringify({ type: 'log', data: { source: 'daemon', daemonName: 'worker', daemonInstanceId: instance, deploymentId: deployment,
    environment: 'production', timestamp: now - 40000, message: JSON.stringify(message), attributes: { private: 'SYNTHETIC_PRIVATE' }, ...patch } }),
    JSON.stringify({ type: 'summary', recordsReturned: 1, timeRange: { start: new Date(window.start).toISOString(), end: new Date(window.end).toISOString() },
      pagination: { hasMore: false, next: null }, excludedIntervals: [], ...summaryPatch })].join('\n');
}
const scope = () => ({ deployment, instance: projectDaemon(metadata(), deployment, now).instances[0], window });
test('fixed production project/deployment metadata drops commands, probes, headers, env and next commands', () => {
  const safe = projectDaemon(metadata(), deployment, now);
  assert.equal(safe.deployment_id, deployment); assert.equal(safe.instances[0].id, instance);
  assert(!JSON.stringify(safe).includes('SYNTHETIC_PRIVATE'));
  for (const mutate of [v => v.context.project.id = 'other', v => v.context.team.id = 'other', v => v.daemon.deploymentId = 'dpl_other',
    v => v.daemon.instances.ready = true, v => v.daemon.instances.items[0].id = 'dmni_invalid']) {
    const value = metadata(); mutate(value); assert.throws(() => projectDaemon(value, deployment, now));
  }
});
test('only exact fixed startup JSON on the bound instance/deployment/time can be evidence', () => {
  const safe = projectRuntimeLogs(logs(), scope()); assert.equal(safe.events.worker_started, 1);
  assert(!JSON.stringify(safe).includes('SYNTHETIC_PRIVATE'));
  for (const value of [logs({ event: 'specs_worker_started', authentication: 'narrow_database_login', orchestration: 'n8n_required', secret: 'SYNTHETIC_PRIVATE' }),
    logs(undefined, { deploymentId: 'dpl_other' }), logs(undefined, { daemonInstanceId: 'dmni_01k7d0q5w3x8y9z0a1b2c3d4e6' }),
    logs(undefined, { timestamp: now - 60000 }), logs(undefined, { attributes: { daemonName: 'other' } })]) {
    assert.equal(projectRuntimeLogs(value, scope()).events.worker_started, 0);
  }
});
test('truncated messages, log gaps and partial pages cannot prove clean startup', () => {
  const before = projectDaemon(metadata(), deployment, now);
  for (const raw of [logs(undefined, { truncated: true }), logs(undefined, {}, { pagination: { hasMore: true, next: 'SYNTHETIC_PRIVATE' } }),
      logs(undefined, {}, { excludedIntervals: [{ start: new Date(now - 10000).toISOString(), end: new Date(now).toISOString() }] })]) {
    const safe = projectRuntimeLogs(raw, scope()); assert.equal(runtimeObservation(before, before, [safe]).startup_observed, false);
    assert(!JSON.stringify(safe).includes('SYNTHETIC_PRIVATE'));
  }
});
test('metadata heartbeats may advance, while changed image/session or fixed failure event prevents startup evidence', () => {
  const before = projectDaemon(metadata(), deployment, now); const raw = metadata(); raw.daemon.instances.items[0].lastCheckedAt = new Date(now).toISOString();
  const after = projectDaemon(raw, deployment, now);
  assert.equal(runtimeObservation(before, after, [projectRuntimeLogs(logs(), scope())]).startup_observed, true);
  after.instances[0].id = 'dmni_01k7d0q5w3x8y9z0a1b2c3d4e6';
  assert.equal(runtimeObservation(before, after, [projectRuntimeLogs(logs(), scope())]).startup_observed, false);
  assert.equal(runtimeObservation(before, before, [projectRuntimeLogs(logs({ event: 'hosted_worker_unconfirmed' }), scope())]).startup_observed, false);
});
test('JSONL bounds and summary/record counts are closed and do not expose malformed content', () => {
  for (const value of ['SYNTHETIC_PRIVATE', logs() + '\n' + JSON.stringify({ type: 'log', data: {} }),
    logs(undefined, {}, { recordsReturned: 2 }), 'x'.repeat(1048577)]) assert.throws(() => projectRuntimeLogs(value, scope()));
});
test('read commands require actual-shaped IDs and pin CLI project/deployment/time without any mutation', () => {
  validateDeploymentId(deployment);
  for (const value of ['../x', 'https://other', 'dpl_x --token private']) assert.throws(() => validateDeploymentId(value));
  const commands = daemonCommands(deployment, instance, window);
  assert(commands.inspect.includes(PROJECT)); assert(commands.logs.includes(deployment));
  assert(commands.logs.includes('--until') && commands.logs.includes('--limit'));
  assert.equal(commands.logs[commands.logs.indexOf('--limit') + 1], '100');
  assert(!commands.logs.includes('--follow') && !commands.logs.includes('--next'));
});
test('attribute-bound daemon records work, while a mixed truncated stream cannot establish startup', () => {
  const raw = logs(); const [record,summary] = raw.split('\n').map(JSON.parse);
  const event = record.data;
  event.attributes = { daemonName:event.daemonName,daemonInstanceId:event.daemonInstanceId,source:event.source,
    deploymentId:event.deploymentId,'scope.type':'target','scope.value':'production' };
  for(const key of ['daemonName','daemonInstanceId','source','deploymentId','environment']) delete event[key];
  const attributeLogs = [record,summary].map(JSON.stringify).join('\n');
  assert.equal(projectRuntimeLogs(attributeLogs,scope()).events.worker_started,1);
  const truncated = JSON.parse(JSON.stringify(record)); truncated.data.truncated=true; summary.recordsReturned=2;
  const mixed=projectRuntimeLogs([record,truncated,summary].map(JSON.stringify).join('\n'),scope());
  const meta=projectDaemon(metadata(),deployment,now);
  assert.equal(runtimeObservation(meta,meta,[mixed]).startup_observed,false);
});
test('malformed selected truncation and conflicting production scope cannot earn startup evidence', () => {
  const meta=projectDaemon(metadata(),deployment,now);
  for(const patch of [{truncated:'true'},{truncated:1},{truncated:null},
    {attributes:{'scope.type':'target','scope.value':'preview'}},{attributes:{'scope.type':'preview','scope.value':'production'}}]) {
    const projected=projectRuntimeLogs(logs(undefined,patch),scope());
    assert.equal(runtimeObservation(meta,meta,[projected]).startup_observed,false);
  }
});
