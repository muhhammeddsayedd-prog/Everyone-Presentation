/** Fixed credential-free INIT diagnosis. Importing performs no I/O. */
const HARDEN = ['/home/node', '/var/tmp', '/run/lock', '/dev/shm', '/dev/mqueue', '/vercel/sandbox'];
export const DIAGNOSTIC_PATHS = Object.freeze(['/', '/eps-work', '/tmp', ...HARDEN, '/opt/eps', '/opt/ms-playwright', '/usr/bin/mount', '/usr/bin/prlimit', '/usr/bin/setpriv', '/usr/local/bin/node']);
export const DIAGNOSTIC_STEPS = Object.freeze(['root_guard', 'source_verify', 'mkdir_work', 'mount_work', 'mount_tmp',
  ...HARDEN.flatMap((_path, i) => [`harden_${i}_lstat`, `harden_${i}_chown`, `harden_${i}_chmod`]),
  'scratch_work', 'scratch_tmp', 'scratch_work_owner', 'native_boundary', 'write_boundary']);
const CODES = ['ENOENT', 'EEXIST', 'EPERM', 'EACCES', 'EROFS', 'EINVAL', 'ENOTDIR', 'EBUSY', 'ENOSYS', 'ENOTSUP', 'EIO', 'ETIMEDOUT',
  'ERR_MODULE_NOT_FOUND', 'ERR_UNKNOWN_FILE_EXTENSION', 'ERR_INVALID_TYPESCRIPT_SYNTAX', 'ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX', 'ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING',
  'ROOT_INVALID', 'SOURCE_INVALID', 'PATH_INVALID', 'SCRATCH_INVALID', 'BOUNDARY_INVALID', 'COMMAND_FAILED', 'UNKNOWN', 'MISSING_PATH', 'PREVIOUS_FAILURE'];
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const require = value => { if (!value) throw new Error('PROBE_DIAGNOSTIC_INVALID'); };
const exact = (value, keys) => require(object(value) && Object.keys(value).sort().join(',') === [...keys].sort().join(','));
const integer = value => Number.isSafeInteger(value) && value >= 0;
const code = value => value === null || CODES.includes(value);
function boundary(value) {
  exact(value, ['protocol', 'uid', 'gid', 'capabilities_empty', 'no_new_privileges', 'known_write_denials', 'checked_paths', 'writable_outside_tmp']);
  require(value.protocol === 'eps-native-boundary-v1' && value.uid === 1000 && value.gid === 1000 && value.capabilities_empty === true
    && value.no_new_privileges === true && value.known_write_denials === 10 && integer(value.checked_paths) && value.checked_paths > 0 && value.checked_paths <= 200000 && value.writable_outside_tmp === 0);
}
export function validateInitDiagnostic(value) {
  exact(value, ['protocol', 'root', 'paths_before', 'paths_after', 'steps', 'first_failed_step', 'exact_sequence_completed', 'boundary_proof']);
  require(value.protocol === 'eps-native-init-diagnostic-v1');
  exact(value.root, ['uid', 'gid', 'cap_effective', 'cap_bounding', 'no_new_privileges', 'status_error_code']);
  require(integer(value.root.uid) && value.root.uid <= 4294967295 && integer(value.root.gid) && value.root.gid <= 4294967295 && code(value.root.status_error_code));
  for (const key of ['cap_effective', 'cap_bounding']) require(value.root[key] === null || typeof value.root[key] === 'string' && /^[a-f0-9]{1,16}$/u.test(value.root[key]));
  require(value.root.no_new_privileges === null || typeof value.root.no_new_privileges === 'boolean');
  for (const group of ['paths_before', 'paths_after']) {
    require(Array.isArray(value[group]) && value[group].length === DIAGNOSTIC_PATHS.length);
    for (const [i, row] of value[group].entries()) {
      exact(row, ['path', 'exists', 'error_code', 'is_directory', 'is_symlink', 'uid', 'gid', 'mode', 'size_bytes', 'fs_type', 'fs_bytes', 'fs_error_code']);
      require(row.path === DIAGNOSTIC_PATHS[i] && code(row.error_code) && code(row.fs_error_code));
      for (const key of ['exists', 'is_directory', 'is_symlink']) require(row[key] === null || typeof row[key] === 'boolean');
      for (const key of ['uid', 'gid', 'mode', 'size_bytes', 'fs_type', 'fs_bytes']) require(row[key] === null || integer(row[key]));
    }
  }
  require(Array.isArray(value.steps) && value.steps.length === DIAGNOSTIC_STEPS.length); let first = null;
  for (const [i, step] of value.steps.entries()) {
    exact(step, ['step', 'result', 'error_code', 'exit_code', 'signal']); require(step.step === DIAGNOSTIC_STEPS[i] && code(step.error_code)
      && (step.exit_code === null || integer(step.exit_code) && step.exit_code <= 255) && [null, 'SIGTERM', 'SIGKILL', 'OTHER'].includes(step.signal));
    if (first !== null) require(step.result === 'skipped' && step.error_code === 'PREVIOUS_FAILURE');
    else if (step.result === 'failed') { require(step.error_code !== null); first = step.step; }
    else if (step.result === 'passed') require(step.error_code === null && [null, 0].includes(step.exit_code) && step.signal === null);
    else require(step.result === 'skipped' && /^harden_[0-5]_(?:lstat|chown|chmod)$/u.test(step.step) && ['ENOENT', 'MISSING_PATH'].includes(step.error_code));
  }
  require(value.first_failed_step === first && value.exact_sequence_completed === (first === null));
  const ranBoundary = value.steps.find(step => step.step === 'native_boundary').result === 'passed';
  if (ranBoundary) boundary(value.boundary_proof); else require(value.boundary_proof === null);
  return structuredClone(value);
}

async function vmProgram() {
  const { spawnSync } = await import('node:child_process');
  const { chmod, chown, lstat, mkdir, readFile, statfs, writeFile } = await import('node:fs/promises');
  const { lstatSync, readFileSync } = await import('node:fs');
  const safeCode = error => FIXED.codes.includes(error?.code) ? error.code : 'UNKNOWN';
  const problem = code => { const error = new Error('DIAGNOSTIC_STEP'); error.code = code; throw error; };
  const report = { protocol: 'eps-native-init-diagnostic-v1', root: { uid: process.getuid(), gid: process.getgid(), cap_effective: null, cap_bounding: null, no_new_privileges: null, status_error_code: null },
    paths_before: [], paths_after: [], steps: [], first_failed_step: null, exact_sequence_completed: false, boundary_proof: null };
  try {
    const status = await readFile('/proc/self/status', 'utf8');
    report.root.cap_effective = /^CapEff:\s+([a-fA-F0-9]{1,16})$/mu.exec(status)?.[1].toLowerCase() ?? null;
    report.root.cap_bounding = /^CapBnd:\s+([a-fA-F0-9]{1,16})$/mu.exec(status)?.[1].toLowerCase() ?? null;
    const nnp = /^NoNewPrivs:\s+([01])$/mu.exec(status); report.root.no_new_privileges = nnp ? nnp[1] === '1' : null;
  } catch (error) { report.root.status_error_code = safeCode(error); }
  async function paths() {
    const result = [];
    for (const path of FIXED.paths) {
      const row = { path, exists: null, error_code: null, is_directory: null, is_symlink: null, uid: null, gid: null, mode: null, size_bytes: null, fs_type: null, fs_bytes: null, fs_error_code: null };
      try { const info = await lstat(path); Object.assign(row, { exists: true, is_directory: info.isDirectory(), is_symlink: info.isSymbolicLink(), uid: info.uid, gid: info.gid, mode: info.mode & 0o7777, size_bytes: info.size }); }
      catch (error) { row.error_code = safeCode(error); if (row.error_code === 'ENOENT') row.exists = false; }
      if (row.exists) try { const fs = await statfs(path); row.fs_type = fs.type; row.fs_bytes = fs.blocks * fs.bsize; } catch (error) { row.fs_error_code = safeCode(error); }
      result.push(row);
    } return result;
  }
  async function step(name, action, skip = false) {
    const row = { step: name, result: 'skipped', error_code: report.first_failed_step ? 'PREVIOUS_FAILURE' : 'MISSING_PATH', exit_code: null, signal: null }; report.steps.push(row);
    if (report.first_failed_step || skip) return;
    try { const status = await action(); Object.assign(row, status ?? {}, { result: 'passed', error_code: null }); }
    catch (error) {
      if (name.endsWith('_lstat') && error?.code === 'ENOENT') { row.error_code = 'ENOENT'; return; }
      Object.assign(row, error?.diagnostic_status ?? {}, { result: 'failed', error_code: safeCode(error) }); report.first_failed_step = name;
    }
  }
  function command(file, args, options = {}) {
    const result = spawnSync(file, args, { cwd: '/opt/eps', env: { PATH: '', LANG: 'C', LC_ALL: 'C', ...options.env }, shell: false,
      stdio: ['ignore', 'pipe', 'pipe'], timeout: 10000, maxBuffer: 4096, ...options });
    if (result.status !== 0) {
      const text = result.stderr?.toString('utf8') ?? ''; let code = result.error ? safeCode(result.error) : 'COMMAND_FAILED';
      for (const [pattern, value] of [[/permission denied|operation not permitted/iu, 'EPERM'], [/read-only file system/iu, 'EROFS'], [/no such file/iu, 'ENOENT'], [/not a directory/iu, 'ENOTDIR'], [/already mounted|busy/iu, 'EBUSY'], [/invalid argument|wrong fs type|bad option/iu, 'EINVAL']]) if (pattern.test(text)) { code = value; break; }
      const error = new Error('DIAGNOSTIC_COMMAND'); error.code = code; error.diagnostic_status = { exit_code: result.status, signal: ['SIGTERM', 'SIGKILL'].includes(result.signal) ? result.signal : result.signal ? 'OTHER' : null }; throw error;
    } return result;
  }
  report.paths_before = await paths();
  await step('root_guard', async () => { if (process.platform !== 'linux' || process.getuid() !== 0) problem('ROOT_INVALID'); });
  await step('source_verify', async () => {
    const { verifyNativeSourceSeal } = await import('/opt/eps/apps/worker/src/native-source-seal.ts');
    const seal = JSON.parse(await readFile('/opt/eps/apps/worker/native-source.json', 'utf8'));
    if (seal.source_sha256 !== FIXED.source) problem('SOURCE_INVALID');
    verifyNativeSourceSeal(seal, FIXED.source, relative => { const file = '/opt/eps/' + relative; const info = lstatSync(file); if (!info.isFile() || info.isSymbolicLink()) problem('SOURCE_INVALID'); return readFileSync(file); });
  });
  await step('mkdir_work', async () => { await mkdir('/eps-work', { mode: 0o700 }); });
  await step('mount_work', async () => { const r = command('/usr/bin/mount', ['-t', 'tmpfs', '-o', 'size=536870912,mode=0700,uid=0,gid=0,noexec,nosuid,nodev', 'tmpfs', '/eps-work']); return { exit_code: r.status }; });
  await step('mount_tmp', async () => { const r = command('/usr/bin/mount', ['-t', 'tmpfs', '-o', 'size=402653184,mode=1777,noexec,nosuid,nodev', 'tmpfs', '/tmp']); return { exit_code: r.status }; });
  for (const [i, target] of FIXED.harden.entries()) {
    let present = false;
    await step(`harden_${i}_lstat`, async () => { const info = await lstat(target); if (!info.isDirectory() || info.isSymbolicLink()) problem('PATH_INVALID'); present = true; });
    await step(`harden_${i}_chown`, async () => { await chown(target, 0, 0); }, !present);
    await step(`harden_${i}_chmod`, async () => { await chmod(target, 0o555); }, !present);
  }
  for (const [name, target, size] of [['scratch_work', '/eps-work', 536870912], ['scratch_tmp', '/tmp', 402653184]]) await step(name, async () => {
    const info = await lstat(target); const fs = await statfs(target); if (!info.isDirectory() || info.isSymbolicLink() || fs.type !== 0x01021994 || fs.blocks * fs.bsize > size) problem('SCRATCH_INVALID');
  });
  await step('scratch_work_owner', async () => { const info = await lstat('/eps-work'); if (info.uid !== 0 || info.gid !== 0 || (info.mode & 0o777) !== 0o700) problem('SCRATCH_INVALID'); });
  await step('native_boundary', async () => {
    const r = command('/usr/bin/prlimit', ['--cpu=20', '--nproc=64', '--nofile=256', '--core=0', '--', '/usr/bin/setpriv', '--reuid=1000', '--regid=1000', '--clear-groups', '--inh-caps=-all', '--bounding-set=-all', '--no-new-privs', '/usr/local/bin/node', '/opt/eps/apps/worker/src/native-sandbox-boundary.mjs'],
      { timeout: 30000, env: { PATH: '', NODE_ENV: 'production', LANG: 'C', LC_ALL: 'C', HOME: '/tmp', TMPDIR: '/tmp' } });
    let proof; try { proof = JSON.parse(r.stdout.toString('utf8')); } catch { problem('BOUNDARY_INVALID'); }
    const keys = ['protocol', 'uid', 'gid', 'capabilities_empty', 'no_new_privileges', 'known_write_denials', 'checked_paths', 'writable_outside_tmp'];
    if (!proof || Object.keys(proof).sort().join(',') !== keys.sort().join(',') || proof.protocol !== 'eps-native-boundary-v1' || proof.uid !== 1000 || proof.gid !== 1000 || proof.capabilities_empty !== true || proof.no_new_privileges !== true || proof.known_write_denials !== 10 || proof.writable_outside_tmp !== 0 || !Number.isSafeInteger(proof.checked_paths) || proof.checked_paths < 1 || proof.checked_paths > 200000) problem('BOUNDARY_INVALID');
    report.boundary_proof = proof; return { exit_code: r.status };
  });
  await step('write_boundary', async () => { await writeFile('/eps-work/boundary.json', JSON.stringify(report.boundary_proof), { flag: 'wx', mode: 0o600 }); });
  report.paths_after = await paths(); report.exact_sequence_completed = report.first_failed_step === null;
  process.stdout.write(JSON.stringify(report));
}

export function diagnosticProgram() {
  const fixed = { paths: DIAGNOSTIC_PATHS, harden: HARDEN, codes: CODES, source: '0ddf519a91a23a11904dbd9880f48d24a2d543a8249f9ab267dbab323d6fb297' };
  return 'const FIXED=' + JSON.stringify(fixed) + ';\n(' + vmProgram.toString() + ')().catch(()=>{process.stderr.write("INIT_DIAGNOSTIC_UNCONFIRMED\\n");process.exitCode=1;});';
}
