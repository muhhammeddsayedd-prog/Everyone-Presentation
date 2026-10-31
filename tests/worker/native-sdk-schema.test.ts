import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { Sandbox } from '@vercel/sandbox';

// Actual pinned SDK/parser code, fully injected local fetch. These strings are
// synthetic test credentials; no environment credential or real network is used.
const credentials = { token: 'SYNTHETIC_LOCAL_ONLY', projectId: 'synthetic_project', teamId: 'synthetic_team' };
const image = 'team/project/native@sha256:' + 'a'.repeat(64);
function metadata() {
  const now = Date.now();
  return { sandbox: { name: 'eps-native-synthetic', persistent: false, currentSessionId: 'synthetic_session', createdAt: now, updatedAt: now, status: 'running', image, region: 'dub1', vcpus: 1, memory: 2048, networkPolicy: { mode: 'deny-all' }, tags: { owner: 'eps-native' } },
    session: { id: 'synthetic_session', memory: 2048, vcpus: 1, region: 'dub1', timeout: 30000, status: 'running', requestedAt: now, createdAt: now, updatedAt: now, cwd: '/opt/eps', networkPolicy: { mode: 'deny-all' } }, routes: [] };
}
test('all actual SDK and cli-config resolution paths use the scoped patched Zod version', () => {
  const workspace = createRequire(path.resolve('apps/worker/package.json'));
  const sandbox = createRequire(workspace.resolve('@vercel/sandbox'));
  const directOidc = createRequire(workspace.resolve('@vercel/oidc'));
  const nestedOidc = createRequire(sandbox.resolve('@vercel/oidc'));
  for (const require of [sandbox, createRequire(directOidc.resolve('@vercel/cli-config')), createRequire(nestedOidc.resolve('@vercel/cli-config'))]) assert.equal(require('zod/package.json').version, '4.6.7');
});
test('patched actual SDK parses valid create metadata and rejects malformed route collections without a provider', async () => {
  for (const invalid of [false, true]) {
    let requests = 0;
    const fetch: typeof globalThis.fetch = async (request, options) => {
      requests++; assert.equal(new URL(String(request)).pathname, '/api/v3/sandboxes'); assert.equal(options?.method, 'POST');
      const value = metadata(); const body: unknown = invalid ? { ...value, routes: [{ port: 'malformed' }] } : value;
      return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
    };
    const operation = Sandbox.create({ ...credentials, name: 'eps-native-synthetic', image, persistent: false, networkPolicy: 'deny-all', resources: { vcpus: 1 }, fetch });
    if (invalid) await assert.rejects(operation);
    else { const handle = await operation; assert.equal(handle.currentSession().sessionId, 'synthetic_session'); assert.equal(handle.networkPolicy, 'deny-all'); assert.equal(handle.persistent, false); }
    assert.equal(requests, 1);
  }
});
test('actual SDK file result travels as raw private stream, separate from metadata Zod schemas', async () => {
  let requests = 0; const privateBytes = Buffer.from('SYNTHETIC_PRIVATE_FILE');
  const fetch: typeof globalThis.fetch = async (request) => {
    requests++;
    return new URL(String(request)).pathname === '/api/v3/sandboxes' ? new Response(JSON.stringify(metadata()), { headers: { 'content-type': 'application/json' } }) : new Response(privateBytes, { headers: { 'content-type': 'application/octet-stream' } });
  };
  const handle = await Sandbox.create({ ...credentials, name: 'eps-native-synthetic', image, persistent: false, networkPolicy: 'deny-all', fetch });
  const stream = await handle.readFile({ path: '/eps-work/output.json' }); assert(stream);
  const chunks = []; for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  assert.deepEqual(Buffer.concat(chunks), privateBytes); assert.equal(requests, 2);
});
