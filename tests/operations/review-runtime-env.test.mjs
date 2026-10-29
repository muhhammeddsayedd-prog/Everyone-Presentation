import assert from 'node:assert/strict';
import test from 'node:test';
import { parseReviewRuntimeEnvironment, loadReviewRuntimeEnvironment } from '../../tools/review-runtime-env.mjs';

const source = 'EPS_REVIEW_ENABLED=true\nN8N_REVIEW_DISPATCH_URL=https://synthetic.app.n8n.cloud/webhook/eps-wf05-review-suggestion-stage-v1\nN8N_REVIEW_DISPATCH_SECRET=' + 'e'.repeat(64) + '\n';
test('review runtime configuration projects exactly a separate fixed webhook and no management/provider credentials', () => {
  assert.deepEqual(Object.keys(parseReviewRuntimeEnvironment(source)), ['EPS_REVIEW_ENABLED', 'N8N_REVIEW_DISPATCH_URL', 'N8N_REVIEW_DISPATCH_SECRET']);
  for (const value of [source + 'N8N_API_KEY=synthetic\n', source.replace('EPS_REVIEW_ENABLED=true', 'EPS_REVIEW_ENABLED=1'), source.replace('/webhook/', '/webhook-test/'), source.replace('https:', 'http:'), source.replace('N8N_REVIEW_DISPATCH_SECRET=' + 'e'.repeat(64), 'N8N_REVIEW_DISPATCH_SECRET=synthetic-provider-key'), source + '\0']) assert.throws(() => parseReviewRuntimeEnvironment(value), /REVIEW_RUNTIME_CONFIGURATION_INVALID/u);
});
test('missing optional file performs no read, while a symbolic link is denied', async () => {
  let reads = 0;
  assert.deepEqual(await loadReviewRuntimeEnvironment({ io: { lstat: async () => { throw Object.assign(new Error('missing'), { code: 'ENOENT' }); }, open: async () => { reads++; } } }), {}); assert.equal(reads, 0);
  await assert.rejects(loadReviewRuntimeEnvironment({ io: { lstat: async () => ({ isFile: () => true, isSymbolicLink: () => true, size: 20 }), uid: () => null } }), /REVIEW_RUNTIME_CONFIGURATION_INVALID/u);
});
