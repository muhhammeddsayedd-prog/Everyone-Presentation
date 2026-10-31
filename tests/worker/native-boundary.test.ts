import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error reviewed fixed image ESM boundary has no generated declaration
import { auditNativeFilesystem } from '../../apps/worker/src/native-sandbox-boundary.mjs';
function fixture(writable: string[] = [], owners: string[] = []) {
  const children: Record<string, string[]> = { '/': ['tmp','home','var','opt','proc','sys','dev'], '/home': ['node'], '/var': ['tmp'], '/opt': ['eps'], '/opt/eps': ['source.ts'] };
  return { lstat: async (path: string) => ({ uid: owners.includes(path) ? 65432 : 0, isDirectory: () => path !== '/opt/eps/source.ts', isFile: () => path === '/opt/eps/source.ts', isSymbolicLink: () => false }),
    readdir: async (path: string) => children[path] ?? [], access: async (path: string) => { if (!writable.includes(path)) throw Object.assign(new Error('denied'), { code: 'EACCES' }); } };
}
test('native image inventory permits capped tmp only and refuses any other writable directory/file', async () => {
  assert((await auditNativeFilesystem(fixture(['/tmp']))).checked_paths > 3);
  for (const path of ['/home/node','/var/tmp','/opt/eps/source.ts']) await assert.rejects(auditNativeFilesystem(fixture([path])), /NATIVE_FILESYSTEM_UNBOUNDED/);
});
test('dedicated native UID65432 ownership outside tmp is refused even if current permission bits deny writes', async () => {
  await assert.rejects(auditNativeFilesystem(fixture([], ['/home/node'])), /NATIVE_FILESYSTEM_UNBOUNDED/);
});
function bridgeFixture(writable = false, uid = 1000) {
  const children: Record<string, string[]> = { '/': ['run'], '/run': ['vercel'], '/run/vercel': ['share'] };
  return { lstat: async (path: string) => ({ uid: path === '/run/vercel/share' ? uid : 0, gid: path === '/run/vercel/share' ? 1000 : 0,
    mode: path === '/run/vercel/share' ? 0o40750 : 0o40755, isDirectory: () => true, isFile: () => false, isSymbolicLink: () => false }),
    readdir: async (path: string) => children[path] ?? [], access: async (path: string) => { if (!(writable && path === '/run/vercel/share')) throw Object.assign(new Error('denied'), { code: 'EACCES' }); } };
}
test('provider UID1000 bridge0750 is accepted only when the distinct native identity cannot write', async () => {
  assert((await auditNativeFilesystem(bridgeFixture())).checked_paths > 0);
  await assert.rejects(auditNativeFilesystem(bridgeFixture(true)), /NATIVE_FILESYSTEM_UNBOUNDED/);
  await assert.rejects(auditNativeFilesystem(bridgeFixture(false, 65432)), /NATIVE_FILESYSTEM_UNBOUNDED/);
});
