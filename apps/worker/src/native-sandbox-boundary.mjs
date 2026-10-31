import { access, lstat, readdir, readFile, open, unlink } from 'node:fs/promises';
import { constants } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { NATIVE_UID, nativeIdentityMatches } from './native-identity.mjs';
const fail = () => { throw new Error('NATIVE_FILESYSTEM_UNBOUNDED'); };
export async function auditNativeFilesystem(io = { access, lstat, readdir }) {
  let checked = 0;
  async function visit(target) {
    // These kernel/device trees do not supply ordinary disk storage. The two
    // writable-memory mountpoints are checked explicitly below.
    if (['/proc', '/sys', '/dev', '/tmp'].includes(target)) return;
    let info; try { info = await io.lstat(target); } catch (error) { if (['EACCES', 'ENOENT'].includes(error.code)) return; throw error; }
    if (++checked > 200_000) fail(); if (info.isSymbolicLink() || !info.isDirectory() && !info.isFile()) return;
    if (info.uid === NATIVE_UID) fail();
    let writable = false; try { await io.access(target, constants.W_OK); writable = true; } catch (error) { if (!['EACCES', 'EPERM', 'EROFS'].includes(error.code)) throw error; }
    if (writable) fail();
    if (info.isDirectory()) {
      let children; try { children = await io.readdir(target); } catch (error) { if (['EACCES', 'EPERM'].includes(error.code)) return; throw error; }
      for (const child of children) { if (child === '.' || child === '..' || child.includes('/')) fail(); await visit(path.posix.join(target, child)); }
    }
  }
  await visit('/');
  for (const target of ['/dev/shm', '/dev/mqueue']) {
    let info; try { info = await io.lstat(target); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    if (info.uid === NATIVE_UID) fail(); let writable = false; try { await io.access(target, constants.W_OK); writable = true; } catch (error) { if (!['EACCES', 'EPERM', 'EROFS'].includes(error.code)) throw error; } if (writable) fail();
  }
  return { checked_paths: checked, writable_outside_tmp: 0 };
}
async function main() {
  if (!nativeIdentityMatches(process.getuid(), process.getgid())) fail();
  const status = await readFile('/proc/self/status', 'utf8');
  if (!/^NoNewPrivs:\s+1$/mu.test(status) || !/^CapEff:\s+0+$/mu.test(status) || !/^CapBnd:\s+0+$/mu.test(status)) fail();
  const inventory = await auditNativeFilesystem(); let denied = 0;
  for (const directory of ['/', '/home/node', '/var/tmp', '/run/lock', '/dev/shm', '/dev/mqueue', '/opt/eps', '/opt/ms-playwright', '/vercel/sandbox', '/eps-work']) {
    const file = path.posix.join(directory, '.eps-denial-' + randomUUID()); let handle;
    try { handle = await open(file, 'wx', 0o600); }
    catch (error) { if (['EACCES', 'EPERM', 'EROFS', 'ENOENT'].includes(error.code)) { denied++; continue; } throw error; }
    await handle.close(); await unlink(file); fail();
  }
  process.stdout.write(JSON.stringify({ protocol: 'eps-native-boundary-v1', uid: process.getuid(), gid: process.getgid(), capabilities_empty: true, no_new_privileges: true, known_write_denials: denied, ...inventory }));
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) main().catch(() => { process.stderr.write('NATIVE_BOUNDARY_UNCONFIRMED\n'); process.exitCode = 1; });
