import test from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { prepareFileLimitsContext, FILE_LIMITS_OVERLAY_PATHS, validateNewRun, verifyPreparedFileLimitsContext } from '../../tools/stage-native-file-limits-fix.mjs';
import * as stager from '../../tools/stage-native-file-limits-fix.mjs';

const sha = value => createHash('sha256').update(value).digest('hex');
const encoded = value => Buffer.from(JSON.stringify(value, null, 2) + '\n');
const parentRun = '11111111-2222-4333-8444-555555555555';
const newRun = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
// Synthetic source bytes only: no repository context, provider, process or disk IO.
function fixture() {
  const tracked = new Map([
    ['package.json', Buffer.from('{"name":"synthetic-root"}\n')],
    ['package-lock.json', Buffer.from('{"lockfileVersion":3}\n')],
    ['apps/web/package.json', Buffer.from('{"name":"synthetic-web-old"}\n')],
    ['apps/worker/package.json', Buffer.from('{"name":"synthetic-worker-old"}\n')],
    ['apps/worker/Dockerfile.daemon', Buffer.from('FROM synthetic\nUSER 1000:1000\n')],
    ['apps/worker/src/native-identity.mjs', Buffer.from('synthetic existing UID65432 identity\n')],
    ...['specs-extraction', 'candidate-extraction', 'frame-selection', 'slide-wording'].map(name => [`contracts/json-schema/${name}.schema.json`, Buffer.from('{"synthetic":true}\n')]),
    ...FILE_LIMITS_OVERLAY_PATHS.map(name => [name, Buffer.from(`synthetic parent ${name}\n`)])
  ]);
  const nativePrefix = 'FROM synthetic\nCOPY package.json package-lock.json ./\nRUN apt-install-heavy\nRUN playwright-install-heavy\n';
  tracked.set('apps/worker/Dockerfile.native-sandbox', Buffer.from(nativePrefix + 'COPY apps/worker ./apps/worker\nUSER 0:0\n'));
  for (let i = tracked.size; i < 156; i++) tracked.set(`packages/domain/src/synthetic-${String(i).padStart(3, '0')}.ts`, Buffer.from(`export const synthetic${i} = ${i};\n`));
  const records = [...tracked].sort(([a], [b]) => a.localeCompare(b, 'en')).map(([path, bytes]) => ({ path, sha256: sha(bytes), bytes: bytes.length }));
  const source = { source_sha256: sha(JSON.stringify(records)), files: records };
  const files = new Map([...tracked, ['.dockerignore', Buffer.from('.git\n.env*\n.local\nnode_modules\n**/node_modules\n')],
    ['Dockerfile.daemon', tracked.get('apps/worker/Dockerfile.daemon')], ['Dockerfile.native-sandbox', tracked.get('apps/worker/Dockerfile.native-sandbox')],
    ['apps/worker/native-source.json', encoded(source)]]);
  const overlay = new Map(FILE_LIMITS_OVERLAY_PATHS.map(name => [name, Buffer.from(`synthetic file limit fix ${name}\n`)]));
  const plan = { parentRun, parentSourceSha256: source.source_sha256, parentManifestSha256: sha(files.get('apps/worker/native-source.json')),
    parentCount: 156, parentBakedManifestSha256: sha(Buffer.from('synthetic baked manifest')), dockerignoreSha256: sha(files.get('.dockerignore')), overlayPins: Object.fromEntries([...overlay].map(([name, bytes]) => [name, sha(bytes)])) };
  return { files, overlay, plan, owner: { owner: 'eps-worker-hosting-build', run: parentRun, source_sha256: source.source_sha256 } };
}

test('builds a coherent 156-record seal while preserving every non-overlay parent byte and old dependency inputs', () => {
  const value = fixture(); const result = prepareFileLimitsContext(value.owner, value.files, value.overlay, value.plan);
  assert.equal(result.source.files.length, 156);
  assert.equal(result.source.source_sha256, sha(JSON.stringify(result.source.files)));
  assert.notEqual(result.source.source_sha256, value.owner.source_sha256);
  for (const item of result.source.files) {
    const actual = result.files.get(item.path);
    assert.equal(sha(actual), item.sha256); assert.equal(actual.length, item.bytes);
    assert.deepEqual(actual, value.overlay.get(item.path) ?? value.files.get(item.path));
  }
  for (const name of ['package.json', 'package-lock.json', 'apps/web/package.json', 'apps/worker/package.json']) assert.deepEqual(result.files.get(name), value.files.get(name));
  assert.deepEqual(result.files.get('Dockerfile.native-sandbox'), value.files.get('apps/worker/Dockerfile.native-sandbox'));
  assert.deepEqual(result.files.get('Dockerfile.daemon'), value.files.get('Dockerfile.daemon'));
  assert.deepEqual(JSON.parse(result.files.get('apps/worker/native-source.json').toString()), result.source);
  assert.equal(result.files.size, 160); assert.equal(value.files.size, 160);
});

test('refuses an altered original file even when its length is unchanged', () => {
  const value = fixture(); const name = 'package-lock.json';
  value.files.set(name, Buffer.alloc(value.files.get(name).length, 120));
  assert.throws(() => prepareFileLimitsContext(value.owner, value.files, value.overlay, value.plan), /FILE_LIMITS_CONTEXT_INVALID/);
});

test('refuses mismatched owner, seal, omitted source record and same-count replacement', () => {
  const mutations = [value => { value.owner.run = newRun; }, value => { value.owner.extra = true; },
    value => { value.owner.source_sha256 = 'a'.repeat(64); }, value => { value.files.delete('package.json'); },
    value => { const source = JSON.parse(value.files.get('apps/worker/native-source.json')); source.files[0].path = '../escape'; value.files.set('apps/worker/native-source.json', encoded(source)); }];
  for (const mutate of mutations) { const value = fixture(); mutate(value); assert.throws(() => prepareFileLimitsContext(value.owner, value.files, value.overlay, value.plan), /FILE_LIMITS_CONTEXT_INVALID/); }
});

test('admits only both exact reviewed overlays, without adding a source record', () => {
  for (const mutate of [value => value.overlay.delete('apps/worker/src/native-task-limits.mjs'),
    value => value.overlay.set('package-lock.json', Buffer.from('different dependency graph')),
    value => value.overlay.set('apps/worker/src/native-sandbox-launch.mjs', Buffer.from('unreviewed runtime'))]) {
    const value = fixture(); mutate(value); assert.throws(() => prepareFileLimitsContext(value.owner, value.files, value.overlay, value.plan), /FILE_LIMITS_CONTEXT_INVALID/);
  }
});

test('refuses extra context files, stale baked native manifest and inconsistent Docker aliases', () => {
  for (const mutate of [value => value.files.set('.env', Buffer.from('synthetic forbidden')),
    value => value.files.set('apps/worker/native-sandbox-manifest.json', Buffer.from('{}')),
    value => value.files.set('Dockerfile.native-sandbox', Buffer.from('different alias'))]) {
    const value = fixture(); mutate(value); assert.throws(() => prepareFileLimitsContext(value.owner, value.files, value.overlay, value.plan), /FILE_LIMITS_CONTEXT_INVALID/);
  }
});

test('produces stable sorted records regardless of map insertion order and owns its byte buffers', () => {
  const value = fixture(); const first = prepareFileLimitsContext(value.owner, value.files, value.overlay, value.plan);
  const second = prepareFileLimitsContext(value.owner, new Map([...value.files].reverse()), new Map([...value.overlay].reverse()), value.plan);
  assert.deepEqual(first.source, second.source);
  value.overlay.get('apps/worker/src/native-task-limits.mjs').fill(120);
  assert.notDeepEqual(first.files.get('apps/worker/src/native-task-limits.mjs'), value.overlay.get('apps/worker/src/native-task-limits.mjs'));
});

test('new run identity is a fresh canonical v4 UUID, never the fixed parent or an arbitrary path', () => {
  assert.doesNotThrow(() => validateNewRun(newRun, parentRun));
  for (const run of [parentRun, '../elsewhere', 'aaaaaaaa-bbbb-1ccc-8ddd-eeeeeeeeeeee', newRun.toUpperCase()]) assert.throws(() => validateNewRun(run, parentRun), /FILE_LIMITS_CONTEXT_INVALID/);
});

test('actual prepared-source QA rejects mixed new runtime bytes with an old or stale source manifest', () => {
  const value = fixture(); const result = prepareFileLimitsContext(value.owner, value.files, value.overlay, value.plan);
  for (const mutate of [files => files.set('apps/worker/src/native-sandbox-launch.mjs', value.files.get('apps/worker/src/native-sandbox-launch.mjs')),
    files => files.set('apps/worker/native-source.json', value.files.get('apps/worker/native-source.json')),
    files => files.delete('apps/worker/src/native-task-limits.mjs')]) {
    const files = new Map(result.files); mutate(files);
    assert.throws(() => verifyPreparedFileLimitsContext(result.source.source_sha256, files, value.plan.dockerignoreSha256), /FILE_LIMITS_CONTEXT_INVALID/);
  }
});

test('forbids a Docker overlay so the complete heavy dependency/APT/Chromium cache chain is preserved', () => {
  const value = fixture(); const name = 'apps/worker/Dockerfile.native-sandbox';
  value.overlay.set(name, Buffer.from(value.files.get(name).toString().replace('RUN apt-install-heavy', 'RUN changed-heavy-install')));
  value.plan.overlayPins[name] = sha(value.overlay.get(name));
  assert.throws(() => prepareFileLimitsContext(value.owner, value.files, value.overlay, value.plan), /FILE_LIMITS_CONTEXT_INVALID/);
});

test('inventory admits the closed public name set before any file contents are loaded', () => {
  const names = [...fixture().files.keys()];
  assert.doesNotThrow(() => stager.validateFileLimitsInventory([...names].reverse(), names));
  for (const observed of [[...names, '.env'], [...names.slice(1), 'private/credentials.json'], names.slice(1), [...names.slice(1), names[1]]]) {
    assert.throws(() => stager.validateFileLimitsInventory(observed, names), /FILE_LIMITS_CONTEXT_INVALID/);
  }
});

test('admits only the exact optional parent baked manifest and omits it from the fresh unbaked context', () => {
  const value = fixture(); const name = 'apps/worker/native-sandbox-manifest.json';
  value.files.set(name, Buffer.from('synthetic baked manifest'));
  assert.doesNotThrow(() => stager.validateFileLimitsInventory([...value.files.keys()], [...value.files.keys()].filter(key => key !== name), true));
  const result = prepareFileLimitsContext(value.owner, value.files, value.overlay, value.plan);
  assert.equal(result.files.has(name), false); assert.equal(result.files.size, 160);
  assert.equal(value.files.has(name), true);
  value.files.set(name, Buffer.from('changed baked manifest'));
  assert.throws(() => prepareFileLimitsContext(value.owner, value.files, value.overlay, value.plan), /FILE_LIMITS_CONTEXT_INVALID/);
  assert.throws(() => stager.validateFileLimitsInventory([...value.files.keys(), name], [...result.files.keys()], true), /FILE_LIMITS_CONTEXT_INVALID/);
  assert.throws(() => stager.validateFileLimitsInventory([...value.files.keys()], [...result.files.keys()]), /FILE_LIMITS_CONTEXT_INVALID/);
});

test('accepts immutable dotted template-version directories used by the real parent graph', () => {
  const value = fixture(); const manifest = JSON.parse(value.files.get('apps/worker/native-source.json'));
  const record = manifest.files.find(item => item.path.startsWith('packages/domain/src/synthetic-'));
  const oldPath = record.path; record.path = 'packages/templates/versions/1.1.0/registry.json';
  value.files.set(record.path, value.files.get(oldPath)); value.files.delete(oldPath);
  manifest.files.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  manifest.source_sha256 = sha(JSON.stringify(manifest.files));
  value.owner.source_sha256 = manifest.source_sha256; value.plan.parentSourceSha256 = manifest.source_sha256;
  value.files.set('apps/worker/native-source.json', encoded(manifest));
  value.plan.parentManifestSha256 = sha(value.files.get('apps/worker/native-source.json'));
  assert.doesNotThrow(() => prepareFileLimitsContext(value.owner, value.files, value.overlay, value.plan));
});
