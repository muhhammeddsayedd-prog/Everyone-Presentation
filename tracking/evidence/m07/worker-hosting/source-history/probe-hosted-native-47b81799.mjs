/** ROOT-EXECUTED ONLY. Fixed-project, synthetic-only Sandbox probe. Importing
 * performs no CLI/auth/provider/file operation. Tokens stay in process memory.
 * Never rerun automatically after unknown ownership/cleanup. */
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, open, readFile, realpath, unlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { diagnosticProgram, diagnosticSetupProgram, validateInitDiagnostic, validateInitSetupDiagnostic } from '../development/m07/worker-hosting/native-init-diagnostic.mjs';
import { boundaryDiagnosticProgram, validateBoundaryDiagnostic } from '../development/m07/worker-hosting/native-boundary-diagnostic.mjs';
import { NATIVE_PROBE_RELEASE, nativeProbePrivilegeArguments } from '../development/m07/worker-hosting/native-probe-release.mjs';
import { chromiumDiagnosticProgram, validateChromiumDiagnostic } from '../development/m07/worker-hosting/native-chromium-diagnostic.mjs';
const ROOT = path.resolve(import.meta.dirname, '..');
const TEAM = 'team_gboXPxTevpCOZuaA8eY9PmR1'; const PROJECT = 'prj_I4SMkDzaDy0KHNgiF00v4Da5aLb6';
const SLUG = 'muhammed-abdelrahman'; const NAME = 'everyone-presentation-worker-pilot';
const SOURCE = NATIVE_PROBE_RELEASE.source_sha256;
const CONTEXT = path.join(ROOT, NATIVE_PROBE_RELEASE.context_relative);
const CLI = path.join(ROOT, '.local/m07-pilot/tooling/node_modules/vercel/dist/vc.js');
const GLOBAL = 'C:/Users/iway/AppData/Roaming/xdg.data/com.vercel.cli';
const LOCK = path.join(ROOT, '.local/m07-pilot/native-probe.lock.json');
const RELEASE_SOURCE_SHA = '6a8892a6dddcf7fc3c0bf1c6726621143393f6e04bdacc6d13064ead354462e3';
const DIAGNOSTIC_SOURCE_SHA = '042c29fc6241dc931cbdcc38ee9aa42094008abf0a1db1956cbb710f37200e64';
const BOUNDARY_DIAGNOSTIC_SOURCE_SHA = '3ac17c10ca838c6f349e1002d179de69b0f16d2e853e95709b2ddccdfff30616';
const CHROMIUM_DIAGNOSTIC_SOURCE_SHA = '661a6ca55c79b91c899301b832d568a3fcdb94f429adca6e4f0d0d63796ee0ec';
const FIXTURES = { 'tests/worker/document-fixtures.ts': 'afcadca5a40ff643839683876d112c186005982784c6e161d321033d00e57a0d', 'tests/worker/review-fit-fixture.ts': 'ae23706908b67b32c7375d9a29a051a524058e804deb8752a905255cb971c2c1', 'tests/worker/presentation-native-fixture.ts': 'd42d81ec2504b4217bee57dda7e0a15e8acd1a45c34c6193e1669e66b6659d63' };
export const SDK_TRANSPORT_POLICY = Object.freeze({ sdk_default_retries_maximum: 2, sdk_default_retry_loop_attempts_maximum: 3,
  non_detached_command_http_retries: 0, repeated_create_uses_same_project_name: true, sandbox_auto_resume_possible: true,
  exact_wire_or_vm_count_proven: false,
  scope: 'Bounds count distinct named resources. SDK creation/read/write/stop/delete may retry; non-detached command POST uses retry zero. Sandbox methods may auto-resume a session. Passing proof requires initial/current/cleanup session equality; no exact wire or VM-session count claim.' });
const SDK_SOURCE_PINS = { 'api-client/base-client.js': 'ce90630c640f0edbb52b1504c2c4c9c5868850106bee05ec53d7cb8d529fdf63',
  'api-client/with-retry.js': '4fd9fd7acfb64eed38b65ef92326bc6710767a097cb253e4f44bd68ab089866d',
  'api-client/api-client.js': 'b1de5c164fe5360a34bfd51c653df63abd37c9cb4d53280d072c751d3cfd5da1',
  'session.js': 'bf6aee3451ab7622076ec18351462ea71d2db968d4f9e61fd49508e8c468a20c',
  'sandbox.js': '314e2889e186c979ce32f381b1a77a8caea32fa246424baddd1c929f7d88b866' };
const hash = value => createHash('sha256').update(value).digest('hex');
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value, keys) => object(value) && Object.keys(value).sort().join(',') === [...keys].sort().join(',');
const fail = code => { const error = new Error(code); error.code = code; throw error; };
const safeId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,200}$/u.test(value);
export function validateProbeImage(value) {
  if (typeof value !== 'string' || !/^muhammed-abdelrahman\/everyone-presentation-worker-pilot\/native@sha256:[a-f0-9]{64}$/u.test(value)) fail('PROBE_IMAGE_INVALID'); return value;
}
export function probePlan(mode) {
  // Historical diagnostics model the previous64 browser bound. Current release
  // admits acceptance probes only; diagnostic reuse must be reviewed separately.
  if (!['boundary', 'smoke'].includes(mode)) fail('PROBE_MODE_INVALID');
  return { mode, maximum_named_resources: mode === 'smoke' ? 10 : 1, overall_timeout_ms: mode.startsWith('diagnose') ? 180_000 : 600_000,
    cleanup_timeout_ms: 30_000, maximum_http_calls: mode.startsWith('diagnose') ? 80 : 240 };
}
export function recordProbeSession(marker, id, stage) {
  if (!object(marker) || !safeId(id) || !['created', 'active', 'cleanup'].includes(stage)) fail('PROBE_OWNERSHIP_UNCONFIRMED');
  if (stage === 'active') marker.current_session_id = id;
  if (marker.session_id && marker.session_id !== id || marker.initial_session_id && marker.initial_session_id !== id) {
    marker.session_consistency_failed = true; fail('PROBE_OWNERSHIP_UNCONFIRMED');
  }
  if (stage === 'created') { marker.initial_session_id = id; marker.current_session_id = id; }
  else if (stage === 'cleanup') marker.cleanup_session_id = id;
  marker.session_id ??= id;
}
export function stableProbeSession(marker) {
  return object(marker) && marker.session_consistency_failed !== true && safeId(marker.initial_session_id) && marker.session_id === marker.initial_session_id
    && marker.current_session_id === marker.initial_session_id && marker.cleanup_session_id === marker.initial_session_id;
}
export function validateProjectToken(response, now = Math.floor(Date.now() / 1000)) {
  if (!exact(response, ['token']) || typeof response.token !== 'string' || response.token.length > 16000 || response.token.length < 100) fail('PROBE_TOKEN_INVALID');
  const parts = response.token.split('.'); if (parts.length !== 3 || parts.some(value => !/^[A-Za-z0-9_-]+$/u.test(value))) fail('PROBE_TOKEN_INVALID');
  let header; let value; try { header = JSON.parse(Buffer.from(parts[0], 'base64url')); value = JSON.parse(Buffer.from(parts[1], 'base64url')); } catch { fail('PROBE_TOKEN_INVALID'); }
  if (!object(header) || !['RS256', 'ES256'].includes(header.alg) || !object(value)
    || !['https://oidc.vercel.com', `https://oidc.vercel.com/${SLUG}`].includes(value.iss) || value.aud !== `https://vercel.com/${SLUG}`
    || value.sub !== `owner:${SLUG}:project:${NAME}:environment:development` || value.environment !== 'development' || value.owner_id !== TEAM || value.project_id !== PROJECT
    || !Number.isSafeInteger(value.iat) || !Number.isSafeInteger(value.exp) || value.iat > now + 30 || value.iat < now - 120 || value.exp - value.iat > 43200
    || value.exp - now < 900 || Buffer.from(parts[2], 'base64url').length < 48) fail('PROBE_TOKEN_INVALID');
  // No raw token, unknown claims, subject/user ID or key material in receipts.
  return { owner_id: TEAM, project_id: PROJECT, environment: 'development', token_ttl_seconds: value.exp - value.iat, token_remaining_seconds: value.exp - now,
    local_signature_verification: false, provenance: 'authenticated fixed-project CLI mint; SDK service acceptance checked separately' };
}
export function validateBoundaryProof(value) {
  if (!exact(value, ['protocol', 'uid', 'gid', 'capabilities_empty', 'no_new_privileges', 'known_write_denials', 'checked_paths', 'writable_outside_tmp'])
    || value.protocol !== 'eps-native-boundary-v1' || value.uid !== NATIVE_PROBE_RELEASE.native_uid || value.gid !== NATIVE_PROBE_RELEASE.native_gid || value.capabilities_empty !== true || value.no_new_privileges !== true
    || value.known_write_denials !== 10 || value.writable_outside_tmp !== 0 || !Number.isSafeInteger(value.checked_paths) || value.checked_paths < 1 || value.checked_paths > 200000) fail('PROBE_BOUNDARY_INVALID'); return structuredClone(value);
}
export function validateNetworkProof(value) {
  if (!exact(value, ['protocol', 'dns_denied', 'ip_denied']) || value.protocol !== 'eps-native-network-v1' || value.dns_denied !== true || value.ip_denied !== true) fail('PROBE_NETWORK_INVALID'); return structuredClone(value);
}
export function validateImageSourceSeal(value, expected) {
  if (!exact(value, ['source_sha256', 'files']) || value.source_sha256 !== SOURCE || JSON.stringify(value) !== JSON.stringify(expected)) fail('PROBE_IMAGE_SOURCE_INVALID');
}
export async function readBoundedCommandOutput(command, maximum, signal) {
  const value = await command.stdout({ signal }); if (typeof value !== 'string' || Buffer.byteLength(value) > maximum) fail('PROBE_COMMAND_OUTPUT_INVALID'); return value;
}
export function canReleaseProbeLock(values) { return Array.isArray(values) && values.every(value => object(value) && safeId(value.name) && value.attempted === true && value.identity_observed === true && value.absence_verified === true && value.snapshot_absence_verified === true && value.session_consistency_failed !== true); }
export async function observeFinalProbeResource(marker, find, observeSnapshots, signal) {
  marker.absence_verified = false;
  try { marker.absence_verified = (await find(marker.name, signal)) === null && marker.identity_observed === true; } catch { marker.absence_verified = false; }
  marker.snapshot_absence_verified = false;
  try { await observeSnapshots(marker.name, signal); marker.snapshot_absence_verified = true; } catch { marker.snapshot_absence_verified = false; }
}
function systemEnvironment() {
  const environment = { NODE_ENV: 'production', PATH: '', CI: '1', VERCEL_TELEMETRY_DISABLED: '1', VERCEL_CLI_USE_NATIVE_BINARY: '0' };
  for (const key of ['SystemRoot', 'WINDIR', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'HOMEDRIVE', 'HOMEPATH', 'TEMP', 'TMP', 'LANG']) if (process.env[key]) environment[key] = process.env[key]; return environment;
}
async function mintToken() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI, 'api', `/v1/projects/${PROJECT}/token?teamId=${TEAM}`, '--scope', SLUG, '--method', 'POST', '--input', '-', '--raw', '--global-config', GLOBAL],
      { cwd: ROOT, env: systemEnvironment(), windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe'] });
    const chunks = []; let bytes = 0; let diagnostics = 0; let problem = false;
    const stop = () => { problem = true; child.kill(); }; const timer = setTimeout(stop, 30_000);
    child.once('error', stop); child.stdin.on('error', () => {});
    child.stdout.on('data', chunk => { bytes += chunk.length; if (bytes > 32768) stop(); else chunks.push(chunk); });
    child.stderr.on('data', chunk => { diagnostics += chunk.length; if (diagnostics > 32768) stop(); });
    child.once('close', code => { clearTimeout(timer); if (problem || code !== 0) { reject(Object.assign(new Error('PROBE_TOKEN_MINT_UNCONFIRMED'), { code: 'PROBE_TOKEN_MINT_UNCONFIRMED' })); return; }
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(Object.assign(new Error('PROBE_TOKEN_INVALID'), { code: 'PROBE_TOKEN_INVALID' })); } });
    child.stdin.end(JSON.stringify({ source: 'everyone-studio-native-probe' }));
  });
}
async function boundedFile(handle, target, maximum, signal) {
  const stream = await handle.readFile({ path: target }, { signal }); if (!stream) fail('PROBE_FILE_UNCONFIRMED'); const chunks = []; let bytes = 0;
  for await (const raw of stream) { const chunk = Buffer.from(raw); bytes += chunk.length; if (bytes > maximum) { stream.destroy?.(); fail('PROBE_FILE_LIMIT'); } chunks.push(chunk); } return Buffer.concat(chunks);
}
function ownership(handle, expected, active = false) {
  if (handle.name !== expected.name || handle.image !== expected.image || handle.tags?.owner !== expected.tags.owner || handle.tags?.run !== expected.tags.run || handle.tags?.source !== SOURCE || Object.keys(handle.tags ?? {}).length !== 3
    || handle.persistent !== false || handle.networkPolicy !== 'deny-all' || handle.region !== 'dub1' || handle.vcpus !== 1 || handle.memory !== 2048 || handle.currentSnapshotId !== undefined
    || handle.failoverRegions.length !== 0 || handle.mounts && Object.keys(handle.mounts).length !== 0) fail('PROBE_OWNERSHIP_UNCONFIRMED');
  if (active) {
    recordProbeSession(expected, handle.currentSession().sessionId, 'active');
    if (handle.routes.length !== 0 || handle.sourceSnapshotId !== undefined) fail('PROBE_OWNERSHIP_UNCONFIRMED');
  }
}
export { ownership as probeOwnership };
const NETWORK = `const dns=await import('node:dns/promises');const net=await import('node:net');let dnsDenied=false;try{await Promise.race([dns.lookup('example.com'),new Promise((_,r)=>setTimeout(()=>r(new Error('timeout')),2000))]);}catch{dnsDenied=true;}const ipDenied=await new Promise(r=>{const s=net.connect({host:'1.1.1.1',port:443});let done=false;const end=v=>{if(done)return;done=true;s.destroy();r(v);};s.setTimeout(2000,()=>end(true));s.once('error',()=>end(true));s.once('connect',()=>end(false));});process.stdout.write(JSON.stringify({protocol:'eps-native-network-v1',dns_denied:dnsDenied,ip_denied:ipDenied}));`;
const GENERATE = `import{spawnSync}from'node:child_process';const r=spawnSync('/usr/bin/ffmpeg',['-nostdin','-v','error','-threads','1','-filter_threads','1','-f','lavfi','-i','testsrc2=size=160x90:rate=10','-t','1','-c:v','libx264','-pix_fmt','yuv420p','-an','-movflags','frag_keyframe+empty_moov','-f','mp4','/eps-work/synthetic.mp4'],{env:{LANG:'C',LC_ALL:'C',PATH:''},stdio:'ignore',timeout:15000});if(r.status!==0)process.exitCode=1;`;
async function main() {
  let phase = 'configuration'; const run = randomUUID(); const started = Date.now(); let locked = false; let token; let originalEnvironment; let client; let observeSnapshots; let apiCalls = 0;
  const attempted = new Map(); const report = { schema_version: '1.0', run_id: run, started_at: new Date(started).toISOString(), result: 'unconfirmed', project_id: PROJECT, team_id: TEAM, source_sha256: SOURCE,
    private_media_used: false, worker_polling: false, db_jobs_or_openai_n8n_calls: false, provider_control_plane_called: false, token_persisted: false, local_signature_verification: false,
    sdk_transport_policy: SDK_TRANSPORT_POLICY, probe_release: NATIVE_PROBE_RELEASE, phases: [], cleanup_confirmed: false };
  const output = path.join(ROOT, 'tracking/evidence/m07/worker-hosting', `${new Date().toISOString().replaceAll(':', '-')}-${run.slice(0, 8)}-hosted-probe.json`);
  const plan = probePlan(process.argv[2]); const image = validateProbeImage(process.argv[3]);
  if (process.argv.length !== 4 || process.platform !== 'win32' || !/^v24\./u.test(process.version) || process.env.NODE_OPTIONS) fail('PROBE_CONFIGURATION_INVALID');
  report.image = image; report.plan = plan;
  const overall = AbortSignal.timeout(plan.overall_timeout_ms);
  try {
    const cliPackage = JSON.parse(await readFile(path.join(path.dirname(CLI), '../package.json'), 'utf8')); if (cliPackage.version !== '65.8.0' || !(await lstat(CLI)).isFile() || path.resolve(await realpath(CLI)).toLowerCase() !== CLI.toLowerCase()) fail('PROBE_CLI_UNPINNED');
    const require = createRequire(path.join(ROOT, 'apps/worker/package.json')); if (require('@vercel/sandbox/package.json').version !== '3.9.1') fail('PROBE_SDK_UNPINNED');
    const sdkRequire = createRequire(require.resolve('@vercel/sandbox')); if (sdkRequire('zod/package.json').version !== '4.6.7') fail('PROBE_SDK_UNPATCHED');
    const sdkDirectory = path.dirname(require.resolve('@vercel/sandbox'));
    for (const [relative, expected] of Object.entries(SDK_SOURCE_PINS)) {
      const target = path.join(sdkDirectory, relative); const info = await lstat(target);
      if (!info.isFile() || info.isSymbolicLink() || info.size > 1024 * 1024 || path.resolve(await realpath(target)).toLowerCase() !== target.toLowerCase() || hash(await readFile(target)) !== expected) fail('PROBE_SDK_TRANSPORT_UNPINNED');
    }
    report.sdk_transport_source_sha256 = { ...SDK_SOURCE_PINS };
    const releaseFile = path.join(ROOT, 'development/m07/worker-hosting/native-probe-release.mjs'); const releaseInfo = await lstat(releaseFile);
    if (!releaseInfo.isFile() || releaseInfo.isSymbolicLink() || releaseInfo.size > 64000 || path.resolve(await realpath(releaseFile)).toLowerCase() !== releaseFile.toLowerCase() || hash(await readFile(releaseFile)) !== RELEASE_SOURCE_SHA) fail('PROBE_RELEASE_UNPINNED');
    report.probe_release_source_sha256 = RELEASE_SOURCE_SHA;
    if (plan.mode.startsWith('diagnose')) {
      const diagnosticFile = path.join(ROOT, 'development/m07/worker-hosting/native-init-diagnostic.mjs'); const info = await lstat(diagnosticFile);
      if (!info.isFile() || info.isSymbolicLink() || info.size > 64000 || path.resolve(await realpath(diagnosticFile)).toLowerCase() !== diagnosticFile.toLowerCase() || hash(await readFile(diagnosticFile)) !== DIAGNOSTIC_SOURCE_SHA) fail('PROBE_DIAGNOSTIC_SOURCE_UNPINNED');
      report.diagnostic_source_sha256 = DIAGNOSTIC_SOURCE_SHA; report.diagnostic_only = true; report.private_input_uploaded = false;
      if (plan.mode === 'diagnose-boundary') {
        const file = path.join(ROOT, 'development/m07/worker-hosting/native-boundary-diagnostic.mjs'); const info = await lstat(file);
        if (!info.isFile() || info.isSymbolicLink() || info.size > 64000 || path.resolve(await realpath(file)).toLowerCase() !== file.toLowerCase() || hash(await readFile(file)) !== BOUNDARY_DIAGNOSTIC_SOURCE_SHA) fail('PROBE_DIAGNOSTIC_SOURCE_UNPINNED');
        report.boundary_diagnostic_source_sha256 = BOUNDARY_DIAGNOSTIC_SOURCE_SHA;
      }
      if (plan.mode === 'diagnose-chromium') {
        const file = path.join(ROOT, 'development/m07/worker-hosting/native-chromium-diagnostic.mjs'); const info = await lstat(file);
        if (!info.isFile() || info.isSymbolicLink() || info.size > 64000 || path.resolve(await realpath(file)).toLowerCase() !== file.toLowerCase() || hash(await readFile(file)) !== CHROMIUM_DIAGNOSTIC_SOURCE_SHA) fail('PROBE_DIAGNOSTIC_SOURCE_UNPINNED');
        report.chromium_diagnostic_source_sha256 = CHROMIUM_DIAGNOSTIC_SOURCE_SHA;
      }
    }
    if (path.resolve(await realpath(CONTEXT)).toLowerCase() !== CONTEXT.toLowerCase()) fail('PROBE_SOURCE_INVALID');
    const source = JSON.parse(await readFile(path.join(CONTEXT, 'apps/worker/native-source.json'), 'utf8'));
    if (source.files?.length !== NATIVE_PROBE_RELEASE.file_count
      || source.files.filter(row => row.path === 'apps/worker/src/native-identity.mjs' && row.sha256 === NATIVE_PROBE_RELEASE.native_identity_sha256).length !== 1
      || source.files.filter(row => row.path === 'apps/worker/src/native-task-limits.mjs' && row.sha256 === NATIVE_PROBE_RELEASE.native_task_limits_sha256).length !== 1) fail('PROBE_RELEASE_UNPINNED');
    const { verifyNativeSourceSeal } = await import(pathToFileURL(path.join(CONTEXT, 'apps/worker/src/native-source-seal.ts')));
    const { readFileSync, lstatSync } = await import('node:fs');
    const { realpathSync } = await import('node:fs');
    verifyNativeSourceSeal(source, SOURCE, relative => { const target = path.join(CONTEXT, relative); const info = lstatSync(target); if (!info.isFile() || info.isSymbolicLink() || path.resolve(realpathSync(target)).toLowerCase() !== target.toLowerCase()) fail('PROBE_SOURCE_INVALID'); return readFileSync(target); });
    if (plan.mode === 'smoke') for (const [relative, expected] of Object.entries(FIXTURES)) { const target = path.join(ROOT, relative); const info = await lstat(target); if (!info.isFile() || info.isSymbolicLink() || path.resolve(await realpath(target)).toLowerCase() !== target.toLowerCase() || hash(await readFile(target)) !== expected) fail('PROBE_FIXTURE_SOURCE_INVALID'); }
    await mkdir(path.dirname(LOCK), { recursive: true }); if (path.resolve(await realpath(path.dirname(LOCK))).toLowerCase() !== path.dirname(LOCK).toLowerCase()) fail('PROBE_LOCK_UNCONFIRMED');
    const lock = await open(LOCK, 'wx', 0o600); await lock.writeFile(JSON.stringify({ run_id: run, project_id: PROJECT, image, source_sha256: SOURCE })); await lock.close(); locked = true;
    phase = 'token_mint'; report.provider_control_plane_called = true; const minted = await mintToken(); phase = 'token_validation'; report.authentication = validateProjectToken(minted); token = minted.token;
    const system = systemEnvironment(); originalEnvironment = { ...process.env }; for (const key of Object.keys(process.env)) delete process.env[key]; Object.assign(process.env, { ...system, NODE_ENV: 'production', VERCEL_OIDC_TOKEN: token });
    const { Sandbox, APIError, Snapshot } = await import('@vercel/sandbox'); const credentials = { token, projectId: PROJECT, teamId: TEAM };
    const fetch = async (url, options) => {
      if (++apiCalls > plan.maximum_http_calls) fail('PROBE_API_BUDGET'); const parsed = new URL(String(url));
      if (parsed.origin !== 'https://vercel.com' || !/^\/api\/v[23]\/sandboxes(?:\/|$)/u.test(parsed.pathname)) fail('PROBE_ENDPOINT_DENIED');
      return globalThis.fetch(url, options);
    };
    observeSnapshots = async (name, signal) => { const snapshots = await Snapshot.list({ ...credentials, fetch, name, limit: 1, signal }); for await (const _snapshot of snapshots) fail('PROBE_SNAPSHOT_UNEXPECTED'); };
    async function find(name, signal) {
      const marker = attempted.get(name);
      // Read the retained work handle before a fresh GET can replace it. This
      // also catches SDK auto-resume when LIST/GET metadata has not caught up.
      if (marker?.live_handle) recordProbeSession(marker, marker.live_handle.currentSession().sessionId, 'active');
      let row; const list = await Sandbox.list({ ...credentials, fetch, namePrefix: name, sortBy: 'name', limit: 2, signal });
      for await (const value of list) { if (row || value.name !== name) fail('PROBE_OWNERSHIP_UNCONFIRMED'); row = value; }
      if (row) {
        const handle = await Sandbox.get({ ...credentials, fetch, name, resume: false, signal });
        if (marker) { ownership(handle, marker); recordProbeSession(marker, row.currentSessionId, 'cleanup');
          if (['running', 'pending', 'stopping'].includes(row.status)) ownership(handle, marker, true);
          marker.identity_observed = true; }
        return { handle, status: row.status, session_id: row.currentSessionId };
      }
      try { await Sandbox.get({ ...credentials, fetch, name, resume: false, signal }); }
      catch (error) { if (error instanceof APIError && error.response.status === 404) return null; throw error; } fail('PROBE_ABSENCE_UNCONFIRMED');
    }
    client = { create: async options => {
      if (attempted.size >= plan.maximum_named_resources || options.image !== image || !/^eps-native-(?:probe-)?[a-f0-9-]{36}$/u.test(options.name) || options.tags?.source !== SOURCE || !['eps-native', 'eps-native-probe'].includes(options.tags?.owner)) fail('PROBE_NAMED_RESOURCE_BUDGET');
      const marker = { name: options.name, image, tags: options.tags, attempted: true, identity_observed: false, absence_verified: false, snapshot_absence_verified: false, session_id: null, initial_session_id: null, current_session_id: null, cleanup_session_id: null, session_consistency_failed: false }; attempted.set(options.name, marker);
      const handle = await Sandbox.create({ ...options, ...credentials, fetch }); marker.live_handle = handle;
      recordProbeSession(marker, handle.currentSession().sessionId, 'created'); ownership(handle, marker, true); marker.identity_observed = true; return handle;
    }, find };
    phase = 'sdk_preflight';
    for (const owner of ['eps-native', 'eps-native-probe']) { const old = await Sandbox.list({ ...credentials, fetch, namePrefix: 'eps-native-', sortBy: 'name', tags: { owner }, limit: 1, signal: overall }); for await (const _row of old) fail('PROBE_OUTSTANDING_RESOURCE'); }
    const name = `eps-native-probe-${run}`; const tags = { owner: 'eps-native-probe', run, source: SOURCE }; let video;
    phase = 'boundary_create'; let boundary;
    try {
      boundary = await client.create({ name, tags, image, region: 'dub1', resources: { vcpus: 1 }, timeout: ['diagnose-boundary', 'diagnose-chromium'].includes(plan.mode) ? 180000 : 120000, networkPolicy: 'deny-all', persistent: false, ports: [], mounts: {}, env: {}, signal: overall });
      const expected = attempted.get(name); ownership(boundary, expected, true);
      phase = 'image_source_seal'; validateImageSourceSeal(JSON.parse(await boundedFile(boundary, '/opt/eps/apps/worker/native-source.json', 1024 * 1024, overall)), source); report.phases.push({ phase, result: 'passed', source_sha256: SOURCE });
      if (plan.mode.startsWith('diagnose') && plan.mode !== 'diagnose-chromium') {
        phase = 'init_diagnosis';
        const setupOnly = plan.mode === 'diagnose-boundary';
        const command = await boundary.runCommand({ cmd: '/usr/local/bin/node', args: ['--input-type=module', '-e', setupOnly ? diagnosticSetupProgram() : diagnosticProgram()], cwd: '/opt/eps', env: {}, sudo: true, timeoutMs: 90000, signal: overall });
        if (command.exitCode !== 0) fail('PROBE_DIAGNOSTIC_COMMAND_UNCONFIRMED');
        const raw = JSON.parse(await readBoundedCommandOutput(command, 32768, overall));
        const diagnostic = setupOnly ? validateInitSetupDiagnostic(raw) : validateInitDiagnostic(raw);
        report.diagnostic = diagnostic; report.phases.push({ phase, result: 'diagnosed', first_failed_step: diagnostic.first_failed_step,
          exact_sequence_completed: diagnostic.exact_sequence_completed, setup_only: setupOnly, native_boundary_acceptance: false });
        if (setupOnly && diagnostic.exact_sequence_completed) {
          phase = 'boundary_diagnosis';
          const child = await boundary.runCommand({ cmd: '/usr/local/bin/node', args: ['--input-type=module', '-e', boundaryDiagnosticProgram()], cwd: '/opt/eps', env: {}, sudo: true, timeoutMs: 60000, signal: overall });
          if (child.exitCode !== 0) fail('PROBE_DIAGNOSTIC_COMMAND_UNCONFIRMED');
          const detail = validateBoundaryDiagnostic(JSON.parse(await readBoundedCommandOutput(child, 32768, overall)));
          report.boundary_diagnostic = detail; report.phases.push({ phase, result: 'diagnosed', node_started: detail.node_started,
            first_failure: detail.child?.first_failure ?? (detail.node_started ? 'child_result_unconfirmed' : 'runtime_start'), native_boundary_acceptance: false });
        }
      } else {
      phase = 'boundary_init'; const init = await boundary.runCommand({ cmd: '/usr/local/bin/node', args: ['/opt/eps/apps/worker/src/native-sandbox-launch.mjs', 'init'], cwd: '/opt/eps', env: {}, sudo: true, timeoutMs: 30000, signal: overall }); if (init.exitCode !== 0) fail('PROBE_INIT_UNCONFIRMED');
      phase = 'boundary_file'; const proof = validateBoundaryProof(JSON.parse(await boundedFile(boundary, '/eps-work/boundary.json', 4096, overall))); report.phases.push({ phase: 'boundary', result: 'passed', proof });
      phase = 'image_control_user'; const user = await boundary.runCommand({ cmd: '/usr/bin/id', args: ['-u'], cwd: '/opt/eps', env: {}, sudo: false, timeoutMs: 5000, signal: overall }); if (user.exitCode !== 0 || (await readBoundedCommandOutput(user, 16, overall)).trim() !== '0') fail('PROBE_IMAGE_USER_UNCONFIRMED'); report.phases.push({ phase, result: 'passed', uid: 0 });
      phase = 'network_denial'; const network = await boundary.runCommand({ cmd: '/usr/bin/prlimit', args: ['--cpu=5', '--nproc=64', '--nofile=64', '--core=0', '--', '/usr/bin/setpriv', ...nativeProbePrivilegeArguments(), '/usr/local/bin/node', '--input-type=module', '-e', NETWORK], cwd: '/opt/eps', env: {}, sudo: true, timeoutMs: 10000, signal: overall });
      if (network.exitCode !== 0) fail('PROBE_NETWORK_UNCONFIRMED'); const networkText = await readBoundedCommandOutput(network, 4096, overall); report.phases.push({ phase, result: 'passed', proof: validateNetworkProof(JSON.parse(networkText)) });
      if (plan.mode === 'diagnose-chromium') {
        phase = 'chromium_diagnosis';
        const command = await boundary.runCommand({ cmd: '/usr/local/bin/node', args: ['--input-type=module', '-e', chromiumDiagnosticProgram()], cwd: '/opt/eps', env: {}, sudo: true, timeoutMs: 100000, signal: overall });
        if (command.exitCode !== 0) fail('PROBE_DIAGNOSTIC_COMMAND_UNCONFIRMED');
        const detail = validateChromiumDiagnostic(JSON.parse(await readBoundedCommandOutput(command, 32768, overall)));
        report.chromium_diagnostic = detail; report.phases.push({ phase, result: 'diagnosed', first_failure: detail.child?.first_failure ?? 'runtime_start', native_browser_acceptance: false });
      }
      if (plan.mode === 'smoke') { phase = 'synthetic_fixture'; const generated = await boundary.runCommand({ cmd: '/usr/local/bin/node', args: ['--input-type=module', '-e', GENERATE], cwd: '/opt/eps', env: {}, sudo: true, timeoutMs: 20000, signal: overall }); if (generated.exitCode !== 0) fail('PROBE_FIXTURE_UNCONFIRMED'); video = await boundedFile(boundary, '/eps-work/synthetic.mp4', 1024 * 1024, overall); }
      }
    } finally {
      const priorPhase = phase; phase = 'boundary_cleanup'; const signal = AbortSignal.timeout(30000); const expected = attempted.get(name);
      if (boundary) recordProbeSession(expected, boundary.currentSession().sessionId, 'active');
      const observed = await find(name, signal);
      if (!observed && !boundary) fail('PROBE_CLEANUP_UNCONFIRMED');
      if (observed) {
        if (expected.session_id && observed.session_id !== expected.session_id || !safeId(observed.session_id)) fail('PROBE_CLEANUP_UNCONFIRMED'); ownership(observed.handle, expected);
        if (!['running', 'pending', 'stopping', 'stopped', 'failed', 'aborted'].includes(observed.status)) fail('PROBE_CLEANUP_UNCONFIRMED');
        if (!['stopped', 'failed', 'aborted'].includes(observed.status)) {
          expected.session_id ??= observed.session_id; ownership(observed.handle, expected, true);
          let stoppedResult;
          try { stoppedResult = await observed.handle.stop({ signal }); }
          catch { const stopped = await find(name, signal); if (!stopped || !['stopped', 'failed', 'aborted'].includes(stopped.status) || stopped.session_id !== expected.session_id) fail('PROBE_CLEANUP_UNCONFIRMED'); ownership(stopped.handle, expected); }
          if (stoppedResult?.snapshot !== undefined) fail('PROBE_SNAPSHOT_UNEXPECTED');
        }
        try { await observed.handle.delete({ signal, deleteOrphanSnapshots: false }); } catch { if (await find(name, signal)) fail('PROBE_CLEANUP_UNCONFIRMED'); }
      }
      if (await find(name, signal)) fail('PROBE_CLEANUP_UNCONFIRMED'); expected.absence_verified = expected.identity_observed === true; phase = priorPhase;
    }
    if (plan.mode === 'smoke') {
      const { executeNativeSandbox, parseNativeManifest } = await import(pathToFileURL(path.join(CONTEXT, 'apps/worker/src/native-sandbox.ts')));
      const manifest = parseNativeManifest({ schema_version: '1.0', transport: 'vercel_sandbox', protocol: 'eps-native-files-v1', image, region: 'dub1', source_sha256: SOURCE });
      const { pdf } = await import('../tests/worker/document-fixtures.ts'); const { fitReview } = await import('../tests/worker/review-fit-fixture.ts'); const { nativePresentation } = await import('../tests/worker/presentation-native-fixture.ts');
      const original = pdf(['SYNTHETIC SANDBOX PDF PROBE']); const text = Buffer.from('SYNTHETIC NATIVE DOCUMENT PROBE'); const sourceId = 'a5050000-0000-4000-8000-000000000999';
      const { snapshot, images } = nativePresentation([0], false); const imageList = [...images].map(([id, bytes]) => [id, Buffer.from(bytes).toString('base64')]); const access = { version_id: snapshot.version_id, grant_token: 'S'.repeat(43) }; let canonical; let exported;
      const jobs = [
        ['document', () => ({ sourceKind: 'asset', sourceAssetId: sourceId, mimeType: 'text/plain', bytes: text.toString('base64') })],
        ['document', () => ({ sourceKind: 'asset', sourceAssetId: sourceId, mimeType: 'application/pdf', bytes: original.toString('base64') })],
        ['pdf_raster', () => ({ source_asset_id: sourceId, bytes: original.toString('base64'), pages: [1], inspect_only: false })],
        ['video', () => ({ source_asset_id: sourceId, mime_type: 'video/mp4', bytes: video.toString('base64'), probe_only: false, timestamps_ms: null })],
        ['review_fit', () => ({ review: fitReview(), timeout_ms: 60000 })],
        ['presentation_render', () => ({ snapshot, images: imageList, timeout_ms: 90000 })],
        ['presentation_validate', () => ({ snapshot, images: imageList, timeout_ms: 90000, bytes: canonical })],
        ['presentation_export_render', () => ({ snapshot, images: imageList, timeout_ms: 90000, access })],
        ['presentation_export_validate', () => ({ snapshot, images: imageList, timeout_ms: 90000, bytes: exported, access })],
      ];
      for (const [task, makePayload] of jobs) {
        phase = `smoke_${task}`; const start = Date.now(); const envelope = JSON.parse(await executeNativeSandbox(task, Buffer.from(JSON.stringify(makePayload())), manifest, { client, signal: overall }));
        if (!exact(envelope, ['ok', 'result']) || envelope.ok !== true || !object(envelope.result)) fail('PROBE_SMOKE_UNCONFIRMED');
        const value = envelope.result;
        if (task === 'document' && (!['plain_text', 'pdf_text'].includes(value.extractionMethod) || value.sourceAssetId !== sourceId || typeof value.text !== 'string' || !value.text.includes('SYNTHETIC'))) fail('PROBE_SMOKE_RESULT_INVALID');
        if (task === 'video' && (value.source_asset_id !== sourceId || value.source_sha256 !== hash(video) || !Array.isArray(value.sampled_frames) || value.sampled_frames.length < 1)) fail('PROBE_SMOKE_RESULT_INVALID');
        if (task === 'pdf_raster' && (value.source_sha256 !== hash(original) || value.pages?.length !== 1 || value.pages[0].page !== 1)) fail('PROBE_SMOKE_RESULT_INVALID');
        if (task === 'review_fit' && (value.overflows?.length !== 0 || value.renderer_version !== 'everyone-casting-fit-v1')) fail('PROBE_SMOKE_RESULT_INVALID');
        if (task.endsWith('render')) { if (typeof value.bytes !== 'string' || Buffer.from(value.bytes, 'base64').subarray(0, 5).toString() !== '%PDF-' || value.proof?.page_count !== 2) fail('PROBE_SMOKE_RESULT_INVALID'); if (task === 'presentation_render') canonical = value.bytes; else exported = value.bytes; }
        if (task.endsWith('validate') && (value.page_count !== 2 || value.pdf_sha256 !== hash(Buffer.from(task === 'presentation_validate' ? canonical : exported, 'base64')))) fail('PROBE_SMOKE_RESULT_INVALID');
        report.phases.push({ phase, result: 'passed', elapsed_ms: Date.now() - start });
      }
    }
    report.result = plan.mode.startsWith('diagnose') ? 'diagnosed' : 'passed';
  } catch (error) { report.failed_phase = phase; report.code = typeof error?.code === 'string' && /^(?:PROBE|NATIVE)_[A-Z_]{1,80}$/u.test(error.code) ? error.code : 'PROBE_OPERATION_UNCONFIRMED'; process.exitCode = 1; }
  finally {
    const finalObservationSignal = AbortSignal.timeout(30000);
    if (client) for (const marker of attempted.values()) {
      await observeFinalProbeResource(marker, client.find, observeSnapshots, finalObservationSignal);
    }
    report.cleanup_confirmed = canReleaseProbeLock([...attempted.values()]);
    report.initial_current_cleanup_sessions_equal = attempted.size > 0 && [...attempted.values()].every(stableProbeSession);
    report.resources = [...attempted.values()].map(marker => ({ name: marker.name, attempted: true, identity_observed: marker.identity_observed,
      session_id: safeId(marker.session_id) ? marker.session_id : null, initial_session_id: safeId(marker.initial_session_id) ? marker.initial_session_id : null,
      current_session_id: safeId(marker.current_session_id) ? marker.current_session_id : null,
      cleanup_session_id: safeId(marker.cleanup_session_id) ? marker.cleanup_session_id : null, initial_current_cleanup_session_equal: stableProbeSession(marker),
      session_consistency_failed: marker.session_consistency_failed === true,
      absence_verified: marker.absence_verified, snapshot_absence_verified: marker.snapshot_absence_verified }));
    report.sdk_http_calls = apiCalls; report.cli_mint_commands = report.provider_control_plane_called ? 1 : 0; report.elapsed_ms = Date.now() - started; report.finished_at = new Date().toISOString();
    if (!report.cleanup_confirmed) { report.result = 'unconfirmed'; report.cleanup_code = 'PROBE_CLEANUP_UNCONFIRMED'; process.exitCode = 1; }
    if (['passed', 'diagnosed'].includes(report.result) && !report.initial_current_cleanup_sessions_equal) { report.result = 'unconfirmed'; report.code = 'PROBE_SESSION_UNCONFIRMED'; process.exitCode = 1; }
    if (locked && report.cleanup_confirmed) { try { const current = JSON.parse(await readFile(LOCK, 'utf8')); if (!exact(current, ['run_id', 'project_id', 'image', 'source_sha256']) || current.run_id !== run || current.project_id !== PROJECT || current.image !== image || current.source_sha256 !== SOURCE) fail('PROBE_LOCK_UNCONFIRMED'); await unlink(LOCK); report.lock_released = true; } catch { report.result = 'unconfirmed'; report.lock_released = false; report.lock_code = 'PROBE_LOCK_UNCONFIRMED'; process.exitCode = 1; } }
    else report.lock_released = false;
    if (originalEnvironment) { for (const key of Object.keys(process.env)) delete process.env[key]; Object.assign(process.env, originalEnvironment); } token = undefined;
    await mkdir(path.dirname(output), { recursive: true }); await writeFile(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
    process.stdout.write(JSON.stringify({ receipt: path.relative(ROOT, output), result: report.result, failed_phase: report.failed_phase ?? null, code: report.code ?? null, cleanup_confirmed: report.cleanup_confirmed, lock_released: report.lock_released }) + '\n');
  }
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) main().catch(() => { process.stderr.write('PROBE_OPERATION_UNCONFIRMED\n'); process.exitCode = 1; });
