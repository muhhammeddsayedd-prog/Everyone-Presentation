import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import path from 'node:path';
import test from 'node:test';
import { checkedWorkerFilesEnvironment, loadWorkerFilesEnvironment, parseWorkerFilesEnvironment } from '../../tools/worker-files-env.mjs';

const url = 'https://pyibofyctwnqpvktepse.supabase.co'; const key = 'sb_publishable_synthetic_public_key';
const text = `SUPABASE_URL=${url}\nSUPABASE_PUBLISHABLE_KEY=${key}\nSUPABASE_SERVICE_ROLE_KEY=synthetic-not-returned\nOPENAI_API_KEY=synthetic-not-returned\nLOGO_VERIFICATION_KEY_BASE64URL=synthetic-not-returned\n`;
const expected = { EPS_SPECS_FILES_ENABLED: 'true', SUPABASE_URL: url, SUPABASE_PUBLISHABLE_KEY: key };
function memoryFiles(bytes, { drift = false, link = false, malformed = false } = {}) {
  const data = malformed ? Buffer.from([0xff]) : Buffer.from(bytes); let position = 0; let reads = 0; let closed = false;
  const info = { dev: 1n, ino: 2n, size: BigInt(data.length), mtimeMs: 3n, ctimeMs: 4n, uid: 123n,
    isFile: () => true, isSymbolicLink: () => link };
  return { get closed() { return closed; }, io: { uid: () => 123,
    async lstat() { return info; }, async realpath(file) { return path.resolve(file); },
    async open() { return { async stat() { reads++; return drift && reads > 1 ? { ...info, ino: 5n } : info; },
      async read(target, offset, length) { const count = Math.min(length, data.length - position); data.copy(target, offset, position, position + count); position += count; return { bytesRead: count }; },
      async close() { closed = true; } }; } } };
}
test('optional file mode is disabled before IO; only an explicit true flag reads the fixed public projection', async () => {
  const forbidden = { uid() { throw new Error('No file IO is permitted.'); } };
  assert.deepEqual(await loadWorkerFilesEnvironment({ environment: {}, io: forbidden }), {});
  assert.deepEqual(await loadWorkerFilesEnvironment({ environment: { EPS_SPECS_FILES_ENABLED: 'false' }, io: forbidden }), {});
  await assert.rejects(loadWorkerFilesEnvironment({ environment: { EPS_SPECS_FILES_ENABLED: '1' }, io: forbidden }), /WORKER_FILES_CONFIGURATION_REQUIRED/u);
  const files = memoryFiles(text);
  assert.deepEqual(await loadWorkerFilesEnvironment({ environment: { EPS_SPECS_FILES_ENABLED: 'true', SUPABASE_URL: 'https://foreign.invalid' }, io: files.io }), expected);
  assert.equal(files.closed, true); assert.deepEqual(parseWorkerFilesEnvironment(text), expected);
});
test('public-only projection rejects other targets and JWT/service keys without exposing file contents', () => {
  for (const value of [text.replace(url, url + '/'), text.replace(url, 'https://foreign.supabase.co'),
    text.replace(key, 'eyJsynthetic-user-jwt'), text.replace(key, 'sb_secret_synthetic-private-key'), text.replace(key, ''), text + '\0']) {
    assert.throws(() => parseWorkerFilesEnvironment(value), { message: 'WORKER_FILES_CONFIGURATION_REQUIRED' });
  }
  assert.throws(() => checkedWorkerFilesEnvironment({ ...expected, SUPABASE_SERVICE_ROLE_KEY: 'synthetic-private' }));
  assert.deepEqual(checkedWorkerFilesEnvironment({}), {});
});
test('bounded fixed-file reading refuses symlinks, replaced handles and malformed UTF8', async () => {
  for (const options of [{ drift: true }, { link: true }, { malformed: true }]) {
    const files = memoryFiles(text, options);
    await assert.rejects(loadWorkerFilesEnvironment({ environment: { EPS_SPECS_FILES_ENABLED: 'true' }, io: files.io }), { message: 'WORKER_FILES_CONFIGURATION_REQUIRED' });
    if (!options.link) assert.equal(files.closed, true);
  }
});
