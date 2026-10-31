import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
// @ts-expect-error reviewed image-only ESM has no generated declaration
import { NATIVE_UID, NATIVE_GID, nativeIdentityMatches, nativePrivilegeArguments, nativeBoundaryProofMatches, verifyNativeIdentityReservation, verifyNativeImageOwnership } from '../../apps/worker/src/native-identity.mjs';
function image(options: { uid?: number; gid?: number; status?: number | null; unreadable?: boolean } = {}) {
  const lookups: string[][] = [];
  return { lookups, accountStatus: async (kind: string, key: string) => { lookups.push([kind, key]); return options.status === undefined ? 2 : options.status; },
    lstat: async (path: string) => { if (options.unreadable && path === '/safe') throw Object.assign(new Error('incomplete'), { code: 'EACCES' });
      return { uid: path === '/safe' ? options.uid ?? 0 : 0, gid: path === '/safe' ? options.gid ?? 0 : 0, isDirectory: () => true, isSymbolicLink: () => false }; },
    readdir: async (path: string) => path === '/' ? ['safe', 'proc', 'sys', 'dev'] : [] };
}
test('native identity and closed boundary proof exclude root/provider/daemon UID1000', () => {
  assert.equal(NATIVE_UID, 65432); assert.equal(NATIVE_GID, 65432);
  assert(nativeIdentityMatches(65432, 65432));
  for (const [uid, gid] of [[0, 0], [1000, 1000], [65432, 1000], ['65432', 65432]]) assert.equal(nativeIdentityMatches(uid, gid), false);
  assert.deepEqual(nativePrivilegeArguments(), ['--reuid=65432', '--regid=65432', '--clear-groups', '--inh-caps=-all', '--bounding-set=-all', '--no-new-privs']);
  const proof = { protocol: 'eps-native-boundary-v1', uid: 65432, gid: 65432, capabilities_empty: true, no_new_privileges: true, known_write_denials: 10, checked_paths: 10, writable_outside_tmp: 0 };
  assert(nativeBoundaryProofMatches(proof));
  for (const change of [{ uid: 1000, gid: 1000 }, { capabilities_empty: false }, { no_new_privileges: false }, { known_write_denials: 9 }, { writable_outside_tmp: 1 }, { extra: 'unknown' }]) assert.equal(nativeBoundaryProofMatches({ ...proof, ...change }), false);
});
test('reservation rejects account conflicts, unknown lookup outcomes, UID/GID paths and incomplete inventory', async () => {
  const safe = image({ uid: 1000, gid: 1000 }); assert((await verifyNativeIdentityReservation(safe)).checked_paths === 2);
  assert.deepEqual(safe.lookups, [['passwd', '65432'], ['group', '65432'], ['passwd', 'eps-native'], ['group', 'eps-native']]);
  for (const options of [{ status: 0 }, { status: null }, { status: 1 }, { uid: 65432 }, { gid: 65432 }, { unreadable: true }]) await assert.rejects(verifyNativeIdentityReservation(image(options)));
  await assert.rejects(verifyNativeIdentityReservation(image(), 1));
});
test('post-account scan still rejects a new native-owned mailbox or other path', async () => {
  assert((await verifyNativeImageOwnership(image())).checked_paths === 2);
  await assert.rejects(verifyNativeImageOwnership(image({ uid: 65432 })));
  await assert.rejects(verifyNativeImageOwnership(image({ gid: 65432 })));
  await assert.rejects(verifyNativeImageOwnership(image({ unreadable: true })));
});
test('only native image reserves a locked no-home system identity after heavy dependencies', async () => {
  const native = await readFile(new URL('../../apps/worker/Dockerfile.native-sandbox', import.meta.url), 'utf8');
  const daemon = await readFile(new URL('../../apps/worker/Dockerfile.daemon', import.meta.url), 'utf8');
  assert(native.indexOf('verify-image') > native.indexOf('playwright install'));
  assert.match(native, /useradd --system --uid 65432 --gid 65432 --no-create-home --no-log-init/u);
  assert.match(native, /--home-dir \/tmp --shell \/usr\/sbin\/nologin --password '!'/u);
  assert(native.indexOf('verify-owned-paths') > native.indexOf('useradd --system'));
  assert.match(daemon, /USER 1000:1000/u); assert.match(native, /USER 0:0/u);
  assert(!native.includes('/run/vercel/share'));
});
