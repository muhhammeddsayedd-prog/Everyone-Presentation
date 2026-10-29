import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePresentationRuntimeEnvironment, loadPresentationRuntimeEnvironment } from '../../tools/presentation-runtime-env.mjs';

const source = 'EPS_PRESENTATION_ENABLED=true\nN8N_PRESENTATION_DISPATCH_URL=https://synthetic.app.n8n.cloud/webhook/eps-wf03-presentation-stage-v1\nN8N_PRESENTATION_DISPATCH_SECRET=' + 'e'.repeat(64) + '\n';
test('presentation runtime configuration projects exactly a separate fixed webhook and no management/provider credentials', () => {
  assert.deepEqual(Object.keys(parsePresentationRuntimeEnvironment(source)), ['EPS_PRESENTATION_ENABLED', 'N8N_PRESENTATION_DISPATCH_URL', 'N8N_PRESENTATION_DISPATCH_SECRET']);
  for (const value of [source + 'N8N_API_KEY=synthetic\n', source.replace('EPS_PRESENTATION_ENABLED=true', 'EPS_PRESENTATION_ENABLED=1'), source.replace('/webhook/', '/webhook-test/'), source.replace('https:', 'http:'), source.replace('N8N_PRESENTATION_DISPATCH_SECRET=' + 'e'.repeat(64), 'N8N_PRESENTATION_DISPATCH_SECRET=synthetic-provider-key'), source + '\0']) assert.throws(() => parsePresentationRuntimeEnvironment(value), /PRESENTATION_RUNTIME_CONFIGURATION_INVALID/u);
});
test('missing optional file performs no read, while a symbolic link is denied', async () => {
  let reads = 0;
  assert.deepEqual(await loadPresentationRuntimeEnvironment({ io: { lstat: async () => { throw Object.assign(new Error('missing'), { code: 'ENOENT' }); }, open: async () => { reads++; } } }), {}); assert.equal(reads, 0);
  await assert.rejects(loadPresentationRuntimeEnvironment({ io: { lstat: async () => ({ isFile: () => true, isSymbolicLink: () => true, size: 20 }), uid: () => null } }), /PRESENTATION_RUNTIME_CONFIGURATION_INVALID/u);
});
