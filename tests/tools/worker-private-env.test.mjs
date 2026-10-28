import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import test from 'node:test';
import { loadWorkerPrivateEnvironment, parseWorkerPrivateEnv, workerPrivatePresence, PrivateWorkerConfigError } from '../../tools/worker-private-env.mjs';

// Synthetic values and injected filesystem only. Never opens the real private file.
const source = 'OPENAI_API_KEY="synthetic-openai-key"\nOPENAI_EXTRACTION_MODEL=\nN8N_API_KEY=synthetic-n8n-key\nN8N_BASE_URL=https://synthetic.app.n8n.cloud/\n';
const invalid = error => error instanceof PrivateWorkerConfigError && error.code === 'PRIVATE_WORKER_CONFIGURATION_INVALID'
  && error.message === 'Private worker configuration is invalid or unavailable.' && !error.cause;
function filesystem(bytes = Buffer.from(source), changes = {}) {
  const paths = []; let reads = 0;
  const stat = { dev: 7, ino: 11, size: bytes.length, mtimeMs: 1, ctimeMs: 1, uid: 42,
    isFile: () => true, isSymbolicLink: () => false };
  const io = { currentUserId: () => 42,
    lstat: async path => { paths.push(path); return stat; }, realpath: async path => path,
    open: async path => { paths.push(path); return { stat: async () => stat, close: async () => {},
      read: async (buffer, offset, length) => { const available = bytes.subarray(reads, reads + length); available.copy(buffer, offset); reads += available.length; return { bytesRead: available.length }; } }; },
    ...changes };
  return { io, stat, paths };
}

test('Node env syntax and only four private fields are selected; model remains unselected', () => {
  const result = parseWorkerPrivateEnv(`${source}NODE_OPTIONS=--inspect\nN8N_WEBHOOK_SECRET=ignored-synthetic\n`, {});
  assert.deepEqual(result, { OPENAI_API_KEY: 'synthetic-openai-key', OPENAI_EXTRACTION_MODEL: '',
    N8N_API_KEY: 'synthetic-n8n-key', N8N_BASE_URL: 'https://synthetic.app.n8n.cloud' });
  assert.deepEqual(parseWorkerPrivateEnv('export OPENAI_API_KEY="synthetic=quoted#value"\r\n', {}),
    { OPENAI_API_KEY: 'synthetic=quoted#value', OPENAI_EXTRACTION_MODEL: '', N8N_API_KEY: '', N8N_BASE_URL: '' });
});

test('nonempty process fields override the fallback, empty fields use it and no provider is inferred', () => {
  const result = parseWorkerPrivateEnv(source, { OPENAI_API_KEY: 'synthetic-runtime', N8N_API_KEY: '',
    OPENAI_EXTRACTION_MODEL: 'synthetic-explicit-model', N8N_BASE_URL: 'https://synthetic.n8n.cloud', NODE_OPTIONS: '--inspect' });
  assert.deepEqual(result, { OPENAI_API_KEY: 'synthetic-runtime', OPENAI_EXTRACTION_MODEL: 'synthetic-explicit-model',
    N8N_API_KEY: 'synthetic-n8n-key', N8N_BASE_URL: 'https://synthetic.n8n.cloud' });
});

test('n8n base URL accepts a tenant HTTPS origin only, with no hidden authority/port/path', () => {
  for (const value of ['http://synthetic.n8n.cloud', 'https://synthetic.n8n.cloud:443', 'https://synthetic.n8n.cloud:1234',
    'https://user:pass@synthetic.n8n.cloud', 'https://synthetic.n8n.cloud/path', 'https://synthetic.n8n.cloud?x=1',
    'https://synthetic.n8n.cloud#fragment', 'https://n8n.cloud', 'https://synthetic.n8n.cloud.evil.invalid',
    'https://synthetic.evil.invalid', 'https://localhost', 'https://synthetic..n8n.cloud', ' https://synthetic.n8n.cloud']) {
    assert.throws(() => parseWorkerPrivateEnv('', { N8N_BASE_URL: value }), invalid);
  }
});

test('all selected values reject multiline/NUL data and errors expose no raw source/values', () => {
  for (const key of ['OPENAI_API_KEY', 'OPENAI_EXTRACTION_MODEL', 'N8N_API_KEY', 'N8N_BASE_URL']) {
    for (const value of ['synthetic-private\nsecond-line', 'synthetic-private\rsecond-line', 'synthetic-private\0tail']) {
      assert.throws(() => parseWorkerPrivateEnv('', { [key]: value }), invalid);
    }
  }
  assert.throws(() => parseWorkerPrivateEnv('OPENAI_API_KEY="synthetic-private\nsecond-line"', {}), invalid);
  assert.doesNotThrow(() => parseWorkerPrivateEnv('OPENAI_API_KEY=x', {})); // No guessed key-length/provider validation.
});

test('UTF8 byte budget is bounded and presence is booleans only', () => {
  assert.throws(() => parseWorkerPrivateEnv('x'.repeat(16 * 1024 + 1), {}), invalid);
  assert.throws(() => parseWorkerPrivateEnv('#' + 'ع'.repeat(9000), {}), invalid);
  assert.deepEqual(workerPrivatePresence(parseWorkerPrivateEnv(source, {})), { openai_key_present: true,
    extraction_model_selected: false, n8n_key_present: true, n8n_base_url_present: true });
  assert.doesNotMatch(JSON.stringify(workerPrivatePresence(parseWorkerPrivateEnv(source, {}))), /synthetic|https|key-value/);
});

test('fixed reader consumes injected bounded bytes without any caller-controlled path', async () => {
  const fake = filesystem();
  const result = await loadWorkerPrivateEnvironment({ environment: {}, io: fake.io, path: 'ignored-arbitrary-path' });
  assert.equal(result.OPENAI_API_KEY, 'synthetic-openai-key');
  assert.ok(fake.paths.length >= 2); assert.ok(fake.paths.every(path => path.endsWith('.env.worker.local')));
  assert.equal(new Set(fake.paths).size, 1);
  const big = filesystem();
  for (const key of ['dev', 'ino', 'size', 'mtimeMs', 'ctimeMs', 'uid']) big.stat[key] = BigInt(big.stat[key]);
  assert.equal((await loadWorkerPrivateEnvironment({ environment: {}, io: big.io })).N8N_API_KEY, 'synthetic-n8n-key');
  const missing = filesystem(Buffer.alloc(0), { lstat: async () => { throw Object.assign(new Error('private path'), { code: 'ENOENT' }); } });
  assert.equal((await loadWorkerPrivateEnvironment({ environment: { N8N_API_KEY: 'synthetic-process' }, io: missing.io })).N8N_API_KEY, 'synthetic-process');
});

test('reader denies symlinks, foreign owners, identity races, oversized files and invalid UTF8 safely', async () => {
  const cases = [];
  for (const patch of [{ isSymbolicLink: () => true }, { isFile: () => false }, { uid: 99 }, { size: 16 * 1024 + 1 }]) {
    const fake = filesystem(); Object.assign(fake.stat, patch); cases.push(fake);
  }
  const outside = filesystem(Buffer.from(source), { realpath: async () => 'outside-private-path' }); cases.push(outside);
  const race = filesystem(); const normalOpen = race.io.open;
  race.io.open = async path => { const handle = await normalOpen(path); return { ...handle, stat: async () => ({ ...race.stat, ino: 12 }) }; }; cases.push(race);
  cases.push(filesystem(Buffer.from([0xff, 0xfe, 0xff])));
  for (const fake of cases) await assert.rejects(loadWorkerPrivateEnvironment({ environment: {}, io: fake.io }), invalid);
});
