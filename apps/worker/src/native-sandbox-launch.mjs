// Trusted image-only supervisor. Arguments are fixed by native-sandbox.ts.
// This process has no provider/management credentials in the microVM. Child
// stdout is a private file, stderr is discarded, never provider command logs.
import { spawn, spawnSync } from 'node:child_process';
import { chmod, chown, lstat, mkdir, open, readFile, statfs, writeFile } from 'node:fs/promises';
import { lstatSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { nativePrivilegeArguments, nativeBoundaryProofMatches } from './native-identity.mjs';
import { nativeTaskProcessLimit, nativeTaskFileSizeLimit, readBoundedNativeOutput } from './native-task-limits.mjs';
const ROOT = '/eps-work'; const TMP_BYTES = 384 * 1024 ** 2; const WORK_BYTES = 512 * 1024 ** 2;
const limits = { document: [28, 24, 30], video: [342, 64, 190], pdf_raster: [28, 64, 190], review_fit: [8, 4, 90], presentation_render: [192, 96, 120], presentation_validate: [280, 4, 190], presentation_export_render: [192, 96, 120], presentation_export_validate: [280, 4, 190] };
const command = (file, args) => { const result = spawnSync(file, args, { env: { PATH: '', LANG: 'C', LC_ALL: 'C' }, shell: false, stdio: 'ignore', timeout: 10_000 }); if (result.status !== 0) throw new Error('isolation'); };
async function scratch() {
  for (const [directory, size] of [[ROOT, WORK_BYTES], ['/tmp', TMP_BYTES]]) {
    const info = await lstat(directory); const fs = await statfs(directory);
    if (!info.isDirectory() || info.isSymbolicLink() || fs.type !== 0x01021994 || fs.blocks * fs.bsize > size) throw new Error('isolation');
  }
  const info = await lstat(ROOT); if (info.uid !== 0 || info.gid !== 0 || (info.mode & 0o777) !== 0o700) throw new Error('isolation');
}
try {
  if (process.platform !== 'linux' || process.getuid() !== 0 || process.argv.length !== 3) throw new Error('isolation');
  const { verifyNativeSourceSeal } = await import('./native-source-seal.ts');
  const sourceSeal = JSON.parse(await readFile('/opt/eps/apps/worker/native-source.json', 'utf8'));
  verifyNativeSourceSeal(sourceSeal, sourceSeal.source_sha256, relative => { const target = '/opt/eps/' + relative; const info = lstatSync(target); if (!info.isFile() || info.isSymbolicLink()) throw new Error('source'); return readFileSync(target); });
  const task = process.argv[2];
  if (task === 'init') {
    await mkdir(ROOT, { mode: 0o700 });
    command('/usr/bin/mount', ['-t', 'tmpfs', '-o', `size=${WORK_BYTES},mode=0700,uid=0,gid=0,noexec,nosuid,nodev`, 'tmpfs', ROOT]);
    command('/usr/bin/mount', ['-t', 'tmpfs', '-o', `size=${TMP_BYTES},mode=1777,noexec,nosuid,nodev`, 'tmpfs', '/tmp']);
    // Provider-created writable directories are denied explicitly; the actual
    // native-UID inventory below refuses every other writable file/directory.
    for (const target of ['/home/node', '/var/tmp', '/run/lock', '/dev/shm', '/dev/mqueue', '/vercel/sandbox']) {
      let info; try { info = await lstat(target); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
      if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('isolation'); await chown(target, 0, 0); await chmod(target, 0o555);
    }
    await scratch();
    const boundary = spawnSync('/usr/bin/prlimit', ['--cpu=20', '--nproc=64', '--nofile=256', '--core=0', '--', '/usr/bin/setpriv', ...nativePrivilegeArguments(), '/usr/local/bin/node', '/opt/eps/apps/worker/src/native-sandbox-boundary.mjs'],
      { cwd: '/opt/eps', env: { PATH: '', NODE_ENV: 'production', LANG: 'C', LC_ALL: 'C', HOME: '/tmp', TMPDIR: '/tmp' }, shell: false, stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 4096, timeout: 30_000 });
    if (boundary.status !== 0) throw new Error('isolation');
    const proof = JSON.parse(boundary.stdout.toString()); if (!nativeBoundaryProofMatches(proof)) throw new Error('isolation');
    await writeFile(ROOT + '/boundary.json', JSON.stringify(proof), { flag: 'wx', mode: 0o600 });
  } else {
    if (!Object.hasOwn(limits, task)) throw new Error('task'); await scratch();
    const [inputMiB, outputMiB, seconds] = limits[task]; const source = ROOT + '/input.json';
    const info = await lstat(source); if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1 || info.uid !== 0 || info.gid !== 0 || info.size < 1 || info.size > inputMiB * 1024 ** 2 || (info.mode & 0o777) !== 0o600) throw new Error('input');
    const input = await open(source, 'r'); const output = await open(ROOT + '/output.json', 'wx', 0o600);
    try {
      const child = spawn('/usr/bin/prlimit', [`--cpu=${seconds}`, `--nproc=${nativeTaskProcessLimit(task)}`, '--nofile=256', `--fsize=${nativeTaskFileSizeLimit(task)}`, '--core=0', '--',
        '/usr/bin/setpriv', ...nativePrivilegeArguments(),
        '/usr/local/bin/node', '--import', 'tsx', '--max-old-space-size=512', '/opt/eps/apps/worker/src/native-sandbox-task.mjs', task],
      { cwd: '/opt/eps', shell: false, env: { PATH: '', NODE_ENV: 'production', LANG: 'C', LC_ALL: 'C', HOME: '/tmp', TMPDIR: '/tmp', PLAYWRIGHT_BROWSERS_PATH: '/opt/ms-playwright' }, stdio: [input.fd, output.fd, 'ignore'] });
      const code = await new Promise((resolve, reject) => { const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('timeout')); }, seconds * 1000); child.once('error', reject); child.once('close', code => { clearTimeout(timer); resolve(code); }); });
      if (code !== 0 && code !== 1) throw new Error('task');
    } finally { await input.close(); await output.close(); }
    const result = await lstat(ROOT + '/output.json'); if (!result.isFile() || result.isSymbolicLink() || result.nlink !== 1 || result.size < 1 || result.size > outputMiB * 1024 ** 2) throw new Error('output');
    const outputRead = await open(ROOT + '/output.json', 'r'); let bytes;
    try {
      bytes = await readBoundedNativeOutput(outputRead, outputMiB * 1024 ** 2);
      const after = await outputRead.stat(); if (!after.isFile() || after.nlink !== 1 || after.size !== bytes.length) throw new Error('output');
    } finally { await outputRead.close(); }
    if (bytes.length < 1 || bytes.length > outputMiB * 1024 ** 2) throw new Error('output');
    await writeFile(ROOT + '/receipt.json', JSON.stringify({ protocol: 'eps-native-files-v1', bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }), { flag: 'wx', mode: 0o600 });
    // SDK file IO uses the image's root control user. Native UID65432 receives
    // only inherited descriptors and cannot replace/read these private paths.
  }
} catch { process.stderr.write('NATIVE_SANDBOX_TASK_UNCONFIRMED\n'); process.exitCode = 1; }
