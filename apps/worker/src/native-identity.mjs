import { lstat, readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

// Native parsers must not share the provider SDK/bridge or daemon UID1000.
export const NATIVE_UID = 65432;
export const NATIVE_GID = 65432;
export const NATIVE_USER = 'eps-native';
export function nativeIdentityMatches(uid, gid) { return uid === NATIVE_UID && gid === NATIVE_GID; }
export function nativePrivilegeArguments() {
  return [`--reuid=${NATIVE_UID}`, `--regid=${NATIVE_GID}`, '--clear-groups', '--inh-caps=-all', '--bounding-set=-all', '--no-new-privs'];
}
export function nativeBoundaryProofMatches(proof) {
  return proof !== null && typeof proof === 'object' && !Array.isArray(proof)
    && Object.keys(proof).sort().join(',') === 'capabilities_empty,checked_paths,gid,known_write_denials,no_new_privileges,protocol,uid,writable_outside_tmp'
    && proof.protocol === 'eps-native-boundary-v1' && nativeIdentityMatches(proof.uid, proof.gid) && proof.capabilities_empty === true
    && proof.no_new_privileges === true && proof.known_write_denials === 10 && proof.writable_outside_tmp === 0
    && Number.isSafeInteger(proof.checked_paths) && proof.checked_paths > 0 && proof.checked_paths <= 200000;
}
const fail = () => { throw new Error('NATIVE_IDENTITY_RESERVATION_INVALID'); };
const imageIO = { lstat, readdir, accountStatus: async (kind, key) => {
  const result = spawnSync('/usr/bin/getent', [kind, key], { env: { PATH: '', LANG: 'C', LC_ALL: 'C' }, shell: false, stdio: 'ignore', timeout: 1000 });
  return result.error ? null : result.status;
} };
/** Build-only: no account is adopted, no incomplete inventory is accepted. */
export async function verifyNativeIdentityReservation(io = imageIO, maximumEntries = 200000) {
  for (const [kind, key] of [['passwd', String(NATIVE_UID)], ['group', String(NATIVE_GID)], ['passwd', NATIVE_USER], ['group', NATIVE_USER]])
    if (await io.accountStatus(kind, key) !== 2) fail(); // getent2 is specifically absent; other failures deny.
  return verifyNativeImageOwnership(io, maximumEntries);
}
export async function verifyNativeImageOwnership(io = imageIO, maximumEntries = 200000) {
  if (!Number.isSafeInteger(maximumEntries) || maximumEntries < 1 || maximumEntries > 200000) fail();
  let checked = 0;
  async function visit(target) {
    if (['/proc', '/sys', '/dev'].includes(target)) return; // Kernel/device trees, not image ownership.
    const info = await io.lstat(target);
    if (++checked > maximumEntries || info.uid === NATIVE_UID || info.gid === NATIVE_GID) fail();
    if (info.isDirectory() && !info.isSymbolicLink()) for (const child of await io.readdir(target)) {
      if (typeof child !== 'string' || child === '.' || child === '..' || child.includes('/') || child.includes('\0')) fail();
      await visit(path.posix.join(target, child));
    }
  }
  await visit('/'); return { checked_paths: checked };
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  if (process.argv.length !== 3 || !['verify-image', 'verify-owned-paths'].includes(process.argv[2]) || process.platform !== 'linux' || process.getuid() !== 0) process.exitCode = 1;
  else (process.argv[2] === 'verify-image' ? verifyNativeIdentityReservation() : verifyNativeImageOwnership()).then(() => { process.stdout.write('NATIVE_IDENTITY_RESERVATION_OK\n'); })
    .catch(() => { process.stderr.write('NATIVE_IDENTITY_RESERVATION_INVALID\n'); process.exitCode = 1; });
}
