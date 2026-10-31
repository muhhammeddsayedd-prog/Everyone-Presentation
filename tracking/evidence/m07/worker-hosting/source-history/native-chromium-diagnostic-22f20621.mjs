/** Trusted synthetic-only browser diagnosis; no runtime or image changes. */
import { NATIVE_PROBE_RELEASE, nativeProbePrivilegeArguments } from './native-probe-release.mjs';
const STAGES = ['fit_import', 'browser_launch', 'browser_context', 'browser_page', 'browser_content', 'browser_fonts', 'browser_measurement', 'fit_result'];
const FLAGS = ['resource_exhausted', 'file_size_limit', 'crashpad_database', 'sandbox_denied', 'permission_denied', 'missing_executable', 'missing_library', 'no_space', 'timeout', 'unknown'];
const CODES = ['ENOENT', 'EACCES', 'EPERM', 'EAGAIN', 'ETIMEDOUT', 'ENOBUFS', 'UNKNOWN'];
const FIT_CODES = ['FIT_TEMPLATE_MISMATCH', 'FIT_FONT_UNAVAILABLE', 'FIT_EXTERNAL_RESOURCE', 'FIT_BUDGET_EXCEEDED', 'FIT_MEASUREMENT_FAILED', 'FIT_ABORTED'];
const need = value => { if (!value) throw new Error('PROBE_CHROMIUM_DIAGNOSTIC_INVALID'); };
const exact = (v, keys) => need(v !== null && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).sort().join(',') === [...keys].sort().join(','));
const integer = (v, max = 1e9) => Number.isSafeInteger(v) && v >= 0 && v <= max;
export function classifyChromiumDiagnosticError(error) {
  const text = typeof error?.message === 'string' ? error.message.slice(0, 65536) : '';
  const result = {
    resource_exhausted: /pthread_create|resource temporarily unavailable|EAGAIN|thread constructor failed|cannot fork/iu.test(text),
    file_size_limit: /file size limit|SIGXFSZ|EFBIG/iu.test(text),
    crashpad_database: /crashpad[^\n]*(?:database|handler)|--database is required/iu.test(text),
    sandbox_denied: /no usable sandbox|failed to move to new namespace|sandbox.*(?:denied|not permitted)/iu.test(text),
    permission_denied: /permission denied|operation not permitted|EACCES|EPERM/iu.test(text),
    missing_executable: /executable doesn.t exist|no such file or directory|ENOENT/iu.test(text),
    missing_library: /error while loading shared libraries|cannot open shared object/iu.test(text),
    no_space: /no space left|ENOSPC/iu.test(text), timeout: /timeout|timed out|ETIMEDOUT/iu.test(text), unknown: false,
  };
  result.unknown = !Object.values(result).some(Boolean); return result;
}
function flags(value) { exact(value, FLAGS); for (const key of FLAGS) need(typeof value[key] === 'boolean'); }
function resources(value) {
  exact(value, ['native_processes', 'native_threads', 'proc_entries_examined', 'proc_scan_truncated', 'tmp_total_bytes', 'tmp_free_bytes']);
  for (const key of ['native_processes', 'native_threads', 'proc_entries_examined']) need(integer(value[key], 1e7));
  need(typeof value.proc_scan_truncated === 'boolean');
  for (const key of ['tmp_total_bytes', 'tmp_free_bytes']) need(value[key] === null || integer(value[key], 384 * 1024 ** 2));
  if (value.tmp_total_bytes !== null && value.tmp_free_bytes !== null) need(value.tmp_free_bytes <= value.tmp_total_bytes);
}
export function validateChromiumDiagnostic(value) {
  exact(value, ['protocol', 'spawn', 'stderr_flags', 'child']); need(value.protocol === 'eps-native-chromium-deep-v1');
  exact(value.spawn, ['exit_code', 'signal', 'error_code']);
  need(value.spawn.exit_code === null || integer(value.spawn.exit_code, 255)); need([null, 'SIGTERM', 'SIGKILL', 'SIGXFSZ', 'SIGABRT', 'OTHER'].includes(value.spawn.signal));
  need(value.spawn.error_code === null || CODES.includes(value.spawn.error_code)); flags(value.stderr_flags);
  if (value.child === null) return structuredClone(value);
  const c = value.child; exact(c, ['protocol', 'uid', 'gid', 'cap_effective', 'cap_bounding', 'no_new_privileges', 'identity_gate_passed', 'limits', 'before', 'after', 'stages', 'first_failure', 'error_flags', 'fit_error_code', 'fit_verified', 'overflow_count', 'chromium_version', 'browser_environment_keys']);
  need(c.protocol === 'eps-native-chromium-child-v1' && integer(c.uid, 4294967295) && integer(c.gid, 4294967295));
  for (const key of ['cap_effective', 'cap_bounding']) need(c[key] === null || typeof c[key] === 'string' && /^[a-f0-9]{1,16}$/u.test(c[key]));
  need(c.no_new_privileges === null || typeof c.no_new_privileges === 'boolean');
  const gate = c.uid === NATIVE_PROBE_RELEASE.native_uid && c.gid === NATIVE_PROBE_RELEASE.native_gid && c.no_new_privileges === true && /^0+$/u.test(c.cap_effective ?? '') && /^0+$/u.test(c.cap_bounding ?? '');
  need(c.identity_gate_passed === gate); exact(c.limits, ['cpu_seconds', 'processes', 'open_files', 'file_bytes']);
  for (const [key, expected] of Object.entries({ cpu_seconds: 90, processes: 64, open_files: 256, file_bytes: 4194304 })) need(c.limits[key] === null || c.limits[key] === expected);
  resources(c.before); resources(c.after); flags(c.error_flags);
  need(Array.isArray(c.stages) && c.stages.length === STAGES.length);
  for (const [i, row] of c.stages.entries()) { exact(row, ['stage', 'result']); need(row.stage === STAGES[i] && ['not_attempted', 'passed', 'failed'].includes(row.result)); }
  need(c.first_failure === null || ['identity_gate', 'limits', ...STAGES].includes(c.first_failure));
  need(c.fit_error_code === null || FIT_CODES.includes(c.fit_error_code)); need(typeof c.fit_verified === 'boolean');
  need(c.overflow_count === null || integer(c.overflow_count, 10000)); need(c.chromium_version === null || typeof c.chromium_version === 'string' && /^[0-9]+(?:\.[0-9]+){2,3}$/u.test(c.chromium_version));
  need(Array.isArray(c.browser_environment_keys) && c.browser_environment_keys.every(key => ['PATH', 'LANG'].includes(key)) && new Set(c.browser_environment_keys).size === c.browser_environment_keys.length);
  if (!gate) need(c.first_failure === 'identity_gate' && c.stages.every(row => row.result === 'not_attempted') && !c.fit_verified);
  if (c.fit_verified) need(gate && Object.values(c.limits).every(v => v !== null) && c.first_failure === null && c.overflow_count === 0 && c.chromium_version !== null && c.stages.every(row => row.result === 'passed'));
  return structuredClone(value);
}

async function childProgram() {
  const fs = await import('node:fs/promises');
  const emptyResources = () => ({ native_processes: 0, native_threads: 0, proc_entries_examined: 0, proc_scan_truncated: false, tmp_total_bytes: null, tmp_free_bytes: null });
  const report = { protocol: 'eps-native-chromium-child-v1', uid: process.getuid(), gid: process.getgid(), cap_effective: null, cap_bounding: null, no_new_privileges: null, identity_gate_passed: false,
    limits: { cpu_seconds: null, processes: null, open_files: null, file_bytes: null }, before: emptyResources(), after: emptyResources(),
    stages: FIXED.stages.map(stage => ({ stage, result: 'not_attempted' })), first_failure: null, error_flags: FIXED.classify(null), fit_error_code: null, fit_verified: false, overflow_count: null, chromium_version: null, browser_environment_keys: [] };
  const measure = async () => {
    const result = emptyResources(); try { const stat = await fs.statfs('/tmp'); result.tmp_total_bytes = stat.blocks * stat.bsize; result.tmp_free_bytes = stat.bfree * stat.bsize; } catch { /* Closed unknown. */ }
    try { const ids = (await fs.readdir('/proc')).filter(value => /^[0-9]+$/u.test(value)); result.proc_scan_truncated = ids.length > 4096;
      for (const id of ids.slice(0, 4096)) { result.proc_entries_examined++; try { const status = await fs.readFile('/proc/' + id + '/status', 'utf8'); if (status.length > 4096) { result.proc_scan_truncated = true; continue; }
        if (/^Uid:\s+([0-9]+)/mu.exec(status)?.[1] === String(FIXED.uid)) { result.native_processes++; result.native_threads += Number(/^Threads:\s+([0-9]+)/mu.exec(status)?.[1] ?? 0); } } catch { result.proc_scan_truncated = true; } }
    } catch { result.proc_scan_truncated = true; } return result;
  };
  const stage = async (name, operation) => { const row = report.stages.find(row => row.stage === name); try { const value = await operation(); row.result = 'passed'; return value; }
    catch (error) { row.result = 'failed'; if (report.first_failure === null) { report.first_failure = name; report.error_flags = FIXED.classify(error); } throw error; } };
  try {
    const status = await fs.readFile('/proc/self/status', 'utf8'); report.cap_effective = /^CapEff:\s+([a-fA-F0-9]{1,16})$/mu.exec(status)?.[1].toLowerCase() ?? null; report.cap_bounding = /^CapBnd:\s+([a-fA-F0-9]{1,16})$/mu.exec(status)?.[1].toLowerCase() ?? null;
    const nnp = /^NoNewPrivs:\s+([01])$/mu.exec(status); report.no_new_privileges = nnp ? nnp[1] === '1' : null;
    report.identity_gate_passed = report.uid === FIXED.uid && report.gid === FIXED.gid && report.no_new_privileges === true && /^0+$/u.test(report.cap_effective ?? '') && /^0+$/u.test(report.cap_bounding ?? '');
    if (!report.identity_gate_passed) { report.first_failure = 'identity_gate'; throw new Error('identity'); }
    const limits = await fs.readFile('/proc/self/limits', 'utf8');
    for (const [key, label] of Object.entries({ cpu_seconds: 'Max cpu time', processes: 'Max processes', open_files: 'Max open files', file_bytes: 'Max file size' })) { const line = limits.split('\n').find(line => line.startsWith(label)); const text = line?.slice(label.length).trim().split(/\s+/u)[0]; report.limits[key] = /^[0-9]+$/u.test(text ?? '') ? Number(text) : null; }
    if (report.limits.cpu_seconds !== 90 || report.limits.processes !== 64 || report.limits.open_files !== 256 || report.limits.file_bytes !== 4194304) { report.first_failure = 'limits'; throw new Error('limits'); }
    report.before = await measure();
    // These are the same fixed trusted imports/options used by the image task.
    const { chromium, nativeBrowserEnvironment, measureReviewFit } = await stage('fit_import', async () => {
      const { createRequire } = await import('node:module'); const require = createRequire('/opt/eps/apps/worker/src/review-fit.ts');
      const playwright = await import(require.resolve('playwright')); const chromium = playwright.chromium ?? playwright.default.chromium;
      const { nativeBrowserEnvironment } = await import('/opt/eps/apps/worker/src/native-browser.ts');
      const { measureReviewFit } = await import('/opt/eps/apps/worker/src/review-fit.ts'); return { chromium, nativeBrowserEnvironment, measureReviewFit };
    });
    report.browser_environment_keys = Object.keys(nativeBrowserEnvironment()).sort();
    const originalLaunch = chromium.launch.bind(chromium);
    chromium.launch = async options => stage('browser_launch', async () => {
      const browser = await originalLaunch(options); const originalContext = browser.newContext.bind(browser);
      browser.newContext = async options => stage('browser_context', async () => { const context = await originalContext(options); const originalPage = context.newPage.bind(context);
        context.newPage = async () => stage('browser_page', async () => { const page = await originalPage(); const setContent = page.setContent.bind(page); const evaluate = page.evaluate.bind(page); let evaluations = 0;
          page.setContent = (...args) => stage('browser_content', () => setContent(...args));
          page.evaluate = (...args) => stage(evaluations++ === 0 ? 'browser_fonts' : 'browser_measurement', () => evaluate(...args)); return page; }); return context; }); return browser;
    });
    const registry = JSON.parse(await fs.readFile('/opt/eps/packages/templates/registry.json', 'utf8'));
    const { slideWordingFields } = await import('/opt/eps/packages/domain/src/casting-types.ts');
    const fields = Object.fromEntries(slideWordingFields.map(key => [key, 'Not provided'])); fields.name_or_id = 'Synthetic fixture'; fields.languages_accents = 'Arabic; English';
    const review = { workspace_id: 'workspace', series_id: 'series', input_fingerprint: 'a'.repeat(64), draft_revision: 1, output_type: 'selection', candidate_slide_count: 1, pending_slide_count: 0, issues: [], can_generate: false, unreviewed_candidate_ids: ['person'],
      template: { key: registry.key, version: registry.version, content_sha256: registry.content_sha256, font_key: registry.font_key }, cover: { project_name: 'Synthetic casting fixture', client_name: 'Synthetic client', title: 'Cast Selection', output_type: 'selection', logo_asset_id: null, logo_placement: 'cover' },
      slides: [{ kind: 'candidate', role_id: 'role', role_name: 'Father', slot_id: 'slot', slot_label: 'Father 1', assignment_id: 'assignment', workspace_candidate_id: 'pool', candidate_id: 'person', candidate_media_id: null, position: 'option', review_status: 'unreviewed', assignment_row_version: 1, workspace_candidate_row_version: 1, candidate_row_version: 1,
        requirements: { age_range: null, gender_requirement: null, appearance_performance: null, languages: [], accents: [], skills: [], scene_references: [], shoot_dates: [], location: null, availability_requirements: null, other_instructions: null }, provisional: false, fields: { ...fields }, source_fields: { ...fields }, frames: [], video_asset_id: null }], fit: { status: 'unmeasured', input_fingerprint: null, measured_at: null, overflows: [], error_code: 'FIT_MEASUREMENT_REQUIRED' } };
    await stage('fit_result', async () => { const result = await measureReviewFit(review, { timeoutMs: 60000 }); report.overflow_count = result.overflows.length; if (/^[0-9]+(?:\.[0-9]+){2,3}$/u.test(result.chromium_version)) report.chromium_version = result.chromium_version;
      if (result.overflows.length !== 0 || result.renderer_version !== 'everyone-casting-fit-v1') throw new Error('fit result'); report.fit_verified = true; });
  } catch (error) { if (FIXED.fit_codes.includes(error?.code)) report.fit_error_code = error.code; if (report.first_failure === null) { report.first_failure = 'fit_result'; report.stages.find(row => row.stage === 'fit_result').result = 'failed'; report.error_flags = FIXED.classify(error); } }
  report.after = await measure(); process.stdout.write(JSON.stringify(report));
}

async function rootProgram() {
  const { spawnSync } = await import('node:child_process');
  const result = spawnSync('/usr/bin/prlimit', ['--cpu=90', '--nproc=64', '--nofile=256', '--fsize=4194304', '--core=0', '--', '/usr/bin/setpriv', ...FIXED.privilege_args, '/usr/local/bin/node', '--import', 'tsx', '--max-old-space-size=512', '--input-type=module', '-e', FIXED.child],
    { cwd: '/opt/eps', env: { PATH: '', NODE_ENV: 'production', LANG: 'C', LC_ALL: 'C', HOME: '/tmp', TMPDIR: '/tmp', PLAYWRIGHT_BROWSERS_PATH: '/opt/ms-playwright' }, shell: false, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 65536, timeout: 90000, killSignal: 'SIGKILL' });
  const report = { protocol: 'eps-native-chromium-deep-v1', spawn: { exit_code: result.status, signal: ['SIGTERM', 'SIGKILL', 'SIGXFSZ', 'SIGABRT'].includes(result.signal) ? result.signal : result.signal ? 'OTHER' : null, error_code: result.error ? FIXED.codes.includes(result.error.code) ? result.error.code : 'UNKNOWN' : null },
    stderr_flags: FIXED.classify({ message: result.stderr?.toString('utf8') ?? '' }), child: null };
  try { report.child = JSON.parse(result.stdout.toString('utf8')); } catch { /* No raw child output leaves the VM. */ }
  process.stdout.write(JSON.stringify(report));
}

export function chromiumDiagnosticChildProgram() {
  const classify = classifyChromiumDiagnosticError.toString();
  return 'const FIXED={...' + JSON.stringify({ stages: STAGES, fit_codes: FIT_CODES, uid: NATIVE_PROBE_RELEASE.native_uid, gid: NATIVE_PROBE_RELEASE.native_gid }) + ',classify:' + classify + '};(' + childProgram.toString() + ')().catch(()=>{process.stderr.write("CHROMIUM_DIAGNOSTIC_UNCONFIRMED\\n");process.exitCode=1;});';
}
export function chromiumDiagnosticProgram() {
  const classify = classifyChromiumDiagnosticError.toString(); const child = chromiumDiagnosticChildProgram();
  return 'const FIXED={...' + JSON.stringify({ child, codes: CODES, privilege_args: nativeProbePrivilegeArguments() }) + ',classify:' + classify + '};(' + rootProgram.toString() + ')().catch(()=>{process.stderr.write("CHROMIUM_DIAGNOSTIC_UNCONFIRMED\\n");process.exitCode=1;});';
}
