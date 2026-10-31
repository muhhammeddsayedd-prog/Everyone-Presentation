/** Empty-VM, metadata-only diagnosis of the dedicated native identity. */
import { NATIVE_PROBE_RELEASE, nativeProbePrivilegeArguments } from './native-probe-release.mjs';
export const DENIAL_PATHS = Object.freeze(['/', '/home/node', '/var/tmp', '/run/lock', '/dev/shm', '/dev/mqueue', '/opt/eps', '/opt/ms-playwright', '/vercel/sandbox', '/eps-work']);
const CODES = ['ENOENT', 'EACCES', 'EPERM', 'EROFS', 'EAGAIN', 'ETIMEDOUT', 'ENOTDIR', 'EIO', 'UNKNOWN'];
const CATEGORIES = ['UID_OWNED', 'WRITABLE', 'LSTAT_ERROR', 'ACCESS_ERROR', 'READDIR_ERROR', 'AUDIT_ERROR', 'UNEXPECTED_WRITE', 'DENIAL_ERROR'];
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const need = v => { if (!v) throw new Error('PROBE_BOUNDARY_DIAGNOSTIC_INVALID'); };
const exact = (v, keys) => need(object(v) && Object.keys(v).sort().join(',') === [...keys].sort().join(','));
const integer = v => Number.isSafeInteger(v) && v >= 0;
const safePath = v => v === null || typeof v === 'string' && v.length <= 500 && /^\/[A-Za-z0-9_./+@:=, -]*$/u.test(v) && !v.split('/').some(x => x === '..' || x === '.') && v.split('/').length <= 40;
export function validateBoundaryDiagnostic(v) {
  exact(v, ['protocol', 'node_started', 'counted_uid', 'visible_native_processes', 'visible_native_threads', 'proc_entries_examined', 'proc_scan_truncated', 'spawn', 'child']);
  need(v.protocol === 'eps-native-boundary-deep-v1' && v.counted_uid === NATIVE_PROBE_RELEASE.native_uid && typeof v.node_started === 'boolean' && typeof v.proc_scan_truncated === 'boolean');
  for (const k of ['visible_native_processes', 'visible_native_threads', 'proc_entries_examined']) need(integer(v[k]) && v[k] <= 10000000);
  exact(v.spawn, ['exit_code', 'signal', 'error_code', 'stderr_code']);
  need((v.spawn.exit_code === null || integer(v.spawn.exit_code) && v.spawn.exit_code <= 255) && [null, 'SIGTERM', 'SIGKILL', 'OTHER'].includes(v.spawn.signal));
  for (const k of ['error_code', 'stderr_code']) need(v.spawn[k] === null || CODES.includes(v.spawn[k]));
  if (v.child === null) return structuredClone(v);
  const c = v.child; exact(c, ['protocol', 'runtime_started', 'uid', 'gid', 'cap_effective', 'cap_bounding', 'no_new_privileges', 'identity_gate_passed',
    'audit_attempted', 'audit_passed', 'checked_paths', 'writable_outside_tmp', 'first_failure', 'first_problem', 'denials', 'known_write_denials']);
  need(v.node_started && c.protocol === 'eps-native-boundary-child-v1' && c.runtime_started === true && integer(c.uid) && c.uid <= 4294967295 && integer(c.gid) && c.gid <= 4294967295);
  for (const k of ['cap_effective', 'cap_bounding']) need(c[k] === null || typeof c[k] === 'string' && /^[a-f0-9]{1,16}$/u.test(c[k]));
  need(c.no_new_privileges === null || typeof c.no_new_privileges === 'boolean');
  for (const k of ['identity_gate_passed', 'audit_attempted', 'audit_passed']) need(typeof c[k] === 'boolean');
  const gate = c.uid === NATIVE_PROBE_RELEASE.native_uid && c.gid === NATIVE_PROBE_RELEASE.native_gid && c.no_new_privileges === true && /^0+$/u.test(c.cap_effective ?? '') && /^0+$/u.test(c.cap_bounding ?? '');
  need(c.identity_gate_passed === gate && [null, 'identity_gate', 'filesystem_audit', 'write_denials'].includes(c.first_failure));
  for (const k of ['checked_paths', 'writable_outside_tmp']) need(c[k] === null || integer(c[k]) && c[k] <= 200000);
  if (c.first_problem !== null) { const p = c.first_problem; exact(p, ['path', 'category', 'uid', 'gid', 'mode', 'error_code']); need(safePath(p.path) && CATEGORIES.includes(p.category) && (p.error_code === null || CODES.includes(p.error_code)));
    for (const k of ['uid', 'gid', 'mode']) need(p[k] === null || integer(p[k]) && p[k] <= 4294967295);
    if (p.category === 'UID_OWNED') need(p.uid === NATIVE_PROBE_RELEASE.native_uid); }
  need(Array.isArray(c.denials) && c.denials.length === DENIAL_PATHS.length && integer(c.known_write_denials) && c.known_write_denials <= 10);
  for (const [i, row] of c.denials.entries()) { exact(row, ['path', 'result', 'error_code']); need(row.path === DENIAL_PATHS[i] && ['not_attempted', 'denied', 'unexpected_write', 'error'].includes(row.result) && (row.error_code === null || CODES.includes(row.error_code))); }
  need(c.known_write_denials === c.denials.filter(r => r.result === 'denied').length);
  if (!gate) need(c.first_failure === 'identity_gate' && !c.audit_attempted && !c.audit_passed && c.denials.every(r => r.result === 'not_attempted'));
  else if (!c.audit_passed) need(c.audit_attempted && c.first_failure === 'filesystem_audit' && c.first_problem !== null && c.denials.every(r => r.result === 'not_attempted'));
  else { need(c.audit_attempted && integer(c.checked_paths) && c.checked_paths > 0 && c.writable_outside_tmp === 0);
    if (c.first_failure === null) need(c.known_write_denials === 10 && c.first_problem === null); else need(c.first_failure === 'write_denials' && c.first_problem !== null); }
  return structuredClone(v);
}

async function childProgram() {
  process.stdout.write('{"protocol":"eps-native-child-started-v1"}\n');
  const { access, lstat, readdir, readFile, open, unlink } = await import('node:fs/promises');
  const { randomUUID } = await import('node:crypto');
  const code = e => FIXED.codes.includes(e?.code) ? e.code : 'UNKNOWN';
  const path = p => typeof p === 'string' && p.length <= 500 && /^\/[A-Za-z0-9_./+@:=, -]*$/u.test(p) && !p.split('/').some(x => x === '..' || x === '.') && p.split('/').length <= 40 ? p : null;
  const report = { protocol: 'eps-native-boundary-child-v1', runtime_started: true, uid: process.getuid(), gid: process.getgid(), cap_effective: null, cap_bounding: null, no_new_privileges: null,
    identity_gate_passed: false, audit_attempted: false, audit_passed: false, checked_paths: null, writable_outside_tmp: null, first_failure: null, first_problem: null,
    denials: FIXED.denials.map(path => ({ path, result: 'not_attempted', error_code: null })), known_write_denials: 0 };
  let last = null; const stats = new Map();
  const problem = (p, category, error = null) => { const info = stats.get(p); report.first_problem ??= { path: path(p), category,
    uid: info?.uid ?? null, gid: info?.gid ?? null, mode: info ? info.mode & 0o7777 : null, error_code: error }; };
  try {
    const status = await readFile('/proc/self/status', 'utf8'); report.cap_effective = /^CapEff:\s+([a-fA-F0-9]{1,16})$/mu.exec(status)?.[1].toLowerCase() ?? null;
    report.cap_bounding = /^CapBnd:\s+([a-fA-F0-9]{1,16})$/mu.exec(status)?.[1].toLowerCase() ?? null;
    const nnp = /^NoNewPrivs:\s+([01])$/mu.exec(status); report.no_new_privileges = nnp ? nnp[1] === '1' : null;
    report.identity_gate_passed = report.uid === FIXED.native_uid && report.gid === FIXED.native_gid && report.no_new_privileges === true && /^0+$/u.test(report.cap_effective ?? '') && /^0+$/u.test(report.cap_bounding ?? '');
    if (!report.identity_gate_passed) report.first_failure = 'identity_gate';
    else {
      report.audit_attempted = true;
      try {
        const { auditNativeFilesystem } = await import('/opt/eps/apps/worker/src/native-sandbox-boundary.mjs');
        const result = await auditNativeFilesystem({
          lstat: async p => { last = p; let info; try { info = await lstat(p); } catch (e) { if (!['EACCES', 'ENOENT'].includes(e.code)) problem(p, 'LSTAT_ERROR', code(e)); throw e; }
            if (stats.size < 200000) stats.set(p, { uid: info.uid, gid: info.gid, mode: info.mode });
            if (!info.isSymbolicLink() && (info.isFile() || info.isDirectory()) && info.uid === FIXED.native_uid) problem(p, 'UID_OWNED'); return info; },
          access: async (p, mode) => { last = p; try { await access(p, mode); problem(p, 'WRITABLE'); } catch (e) { if (!['EACCES', 'EPERM', 'EROFS'].includes(e.code)) problem(p, 'ACCESS_ERROR', code(e)); throw e; } },
          readdir: async p => { last = p; try { return await readdir(p); } catch (e) { if (!['EACCES', 'EPERM'].includes(e.code)) problem(p, 'READDIR_ERROR', code(e)); throw e; } },
        });
        report.audit_passed = true; report.checked_paths = result.checked_paths; report.writable_outside_tmp = result.writable_outside_tmp;
      } catch { report.first_failure = 'filesystem_audit'; problem(last, 'AUDIT_ERROR'); }
      if (report.audit_passed) for (const row of report.denials) {
        const file = row.path.replace(/\/$/u, '') + '/.eps-denial-' + randomUUID(); let handle;
        try { handle = await open(file, 'wx', 0o600); }
        catch (e) { if (['EACCES', 'EPERM', 'EROFS', 'ENOENT'].includes(e.code)) { row.result = 'denied'; row.error_code = e.code; report.known_write_denials++; continue; }
          row.result = 'error'; row.error_code = code(e); report.first_failure = 'write_denials'; problem(row.path, 'DENIAL_ERROR', code(e)); break; }
        await handle.close(); await unlink(file); row.result = 'unexpected_write'; report.first_failure = 'write_denials'; problem(row.path, 'UNEXPECTED_WRITE'); break;
      }
    }
  } catch { report.first_failure ??= report.identity_gate_passed ? 'filesystem_audit' : 'identity_gate'; if (report.identity_gate_passed) problem(last, 'AUDIT_ERROR'); }
  process.stdout.write(JSON.stringify(report) + '\n');
}

async function rootProgram() {
  const { spawnSync } = await import('node:child_process'); const { readdir, readFile } = await import('node:fs/promises');
  const report = { protocol: 'eps-native-boundary-deep-v1', node_started: false, counted_uid: FIXED.native_uid, visible_native_processes: 0, visible_native_threads: 0, proc_entries_examined: 0, proc_scan_truncated: false,
    spawn: { exit_code: null, signal: null, error_code: null, stderr_code: null }, child: null };
  const code = e => FIXED.codes.includes(e?.code) ? e.code : 'UNKNOWN';
  try {
    const ids = (await readdir('/proc')).filter(x => /^[0-9]+$/u.test(x)); report.proc_scan_truncated = ids.length > 4096;
    for (const id of ids.slice(0, 4096)) { report.proc_entries_examined++; try { const status = await readFile('/proc/' + id + '/status', 'utf8'); if (status.length > 4096) { report.proc_scan_truncated = true; continue; }
      const uid = /^Uid:\s+([0-9]+)/mu.exec(status); const threads = /^Threads:\s+([0-9]+)/mu.exec(status); if (uid?.[1] === String(FIXED.native_uid)) { report.visible_native_processes++; report.visible_native_threads += Number(threads?.[1] ?? 0); } } catch { report.proc_scan_truncated = true; } }
  } catch { report.proc_scan_truncated = true; }
  const result = spawnSync('/usr/bin/prlimit', ['--cpu=20', '--nproc=64', '--nofile=256', '--core=0', '--', '/usr/bin/setpriv', ...FIXED.privilege_args, '/usr/local/bin/node', '--input-type=module', '-e', FIXED.child],
    { cwd: '/opt/eps', env: { PATH: '', NODE_ENV: 'production', LANG: 'C', LC_ALL: 'C', HOME: '/tmp', TMPDIR: '/tmp' }, shell: false, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 16384, timeout: 30000 });
  report.spawn.exit_code = result.status; report.spawn.signal = ['SIGTERM', 'SIGKILL'].includes(result.signal) ? result.signal : result.signal ? 'OTHER' : null; report.spawn.error_code = result.error ? code(result.error) : null;
  const errorText = result.stderr?.toString('utf8') ?? '';
  if (/resource temporarily unavailable|pthread_create|EAGAIN/iu.test(errorText)) report.spawn.stderr_code = 'EAGAIN';
  else if (/operation not permitted|permission denied/iu.test(errorText)) report.spawn.stderr_code = 'EPERM';
  else if (/no such file/iu.test(errorText)) report.spawn.stderr_code = 'ENOENT';
  else if (errorText.length) report.spawn.stderr_code = 'UNKNOWN';
  try { const lines = result.stdout.toString('utf8').trim().split('\n'); const started = JSON.parse(lines[0]); report.node_started = Object.keys(started).length === 1 && started.protocol === 'eps-native-child-started-v1'; if (report.node_started && lines.length === 2) report.child = JSON.parse(lines[1]); } catch { /* No raw output leaves this VM. */ }
  process.stdout.write(JSON.stringify(report));
}

export function boundaryDiagnosticProgram() {
  const identity = { native_uid: NATIVE_PROBE_RELEASE.native_uid, native_gid: NATIVE_PROBE_RELEASE.native_gid };
  const child = 'const FIXED=' + JSON.stringify({ codes: CODES, denials: DENIAL_PATHS, ...identity }) + ';(' + childProgram.toString() + ')().catch(()=>{process.stderr.write("BOUNDARY_DIAGNOSTIC_UNCONFIRMED\\n");process.exitCode=1;});';
  return 'const FIXED=' + JSON.stringify({ codes: CODES, child, ...identity, privilege_args: nativeProbePrivilegeArguments() }) + ';(' + rootProgram.toString() + ')().catch(()=>{process.stderr.write("BOUNDARY_DIAGNOSTIC_UNCONFIRMED\\n");process.exitCode=1;});';
}
