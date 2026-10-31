/** ROOT-EXECUTED ONLY: fixed retained7113 run, GET-only provider reconciliation.
 * Never creates/resumes/stops/deletes a Sandbox or reads native files. An
 * explicit unlock removes only the exact local lock after fresh full absence. */
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { lstat, open, readFile, realpath, unlink } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { validateProjectToken } from './probe-hosted-native.mjs';
const ROOT = path.resolve(import.meta.dirname, '..');
const TEAM = 'team_gboXPxTevpCOZuaA8eY9PmR1'; const PROJECT = 'prj_I4SMkDzaDy0KHNgiF00v4Da5aLb6'; const SLUG = 'muhammed-abdelrahman';
const RUN = '7113cb6d-b93e-4fab-9fc2-329f164717c3';
const SOURCE = 'bc774c88083d106fd522ee6277fc8a81033a6b94ff05e9debdfe1d6ee661a735';
const IMAGE = 'muhammed-abdelrahman/everyone-presentation-worker-pilot/native@sha256:7846b45931a0394eafafdca0d0ae2791b8de74ee9a736fd39534e34134d0d16c';
const RECEIPT = 'tracking/evidence/m07/worker-hosting/2026-10-31T00-07-06.951Z-7113cb6d-hosted-probe.json';
const LOCK = '.local/m07-pilot/native-probe.lock.json';
const CLI = '.local/m07-pilot/tooling/node_modules/vercel/dist/vc.js';
const GLOBAL = 'C:/Users/iway/AppData/Roaming/xdg.data/com.vercel.cli';
const FIXED = Object.freeze([
  ['eps-native-probe-7113cb6d-b93e-4fab-9fc2-329f164717c3', 'sbx_88Yak4vD9nmjh83gKxNi3WtM4LnB'],
  ['eps-native-42d71299-ca8e-4f33-b93a-1b13003acb5f', 'sbx_BH8xAb4GvGW6lC6m3MhlCSvc2ST3'],
  ['eps-native-b95d6bb6-8745-4922-b36b-9554546fdd86', 'sbx_LOl50Ixc274kdMHdYoUmMq7fiaKz'],
]);
const PINS = Object.freeze({ [RECEIPT]: '8d7f3a4c149d5c07fcc98f40a1543889fca47db244e83adc0ac55ae2151827fe', [LOCK]: 'f39954b44b7d0fdcdbb5d6022f9d07650ae39bd0355a8ef246857311c9552081',
  'tools/probe-hosted-native.mjs': '47b81799fb278e23c8c96791f9482d393fd31e41a40f3be51b3c60495af542da',
  '.local/m07-pilot/tooling/node_modules/vercel/dist/chunks/chunk-YIOT5B5Z.js': '36a7d817e495b18babf431a5380e530f3f6ceb262120bafc56b3d9163aaae661',
  '.local/m07-pilot/tooling/node_modules/vercel/dist/chunks/chunk-QZEZCUUZ.js': 'd81dab4301ba45c2d3c786bbca5c29a5027e98976118102de7aa8e99b607d23a' });
const sha = value => createHash('sha256').update(value).digest('hex');
const need = value => { if (!value) throw new Error('RECONCILE_UNCONFIRMED'); };
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const exact = (v, keys) => object(v) && Object.keys(v).sort().join(',') === [...keys].sort().join(',');
export function validateReconcileEnvironment(value) {
  for (const key of ['NODE_OPTIONS', 'NPM_CONFIG_NODE_OPTIONS', 'NODE_DEBUG', 'NODE_DEBUG_NATIVE', 'DEBUG', 'NODE_TLS_REJECT_UNAUTHORIZED', 'NODE_EXTRA_CA_CERTS', 'SSL_CERT_FILE', 'SSL_CERT_DIR', 'REQUESTS_CA_BUNDLE', 'CURL_CA_BUNDLE']) need(!value[key]);
}
export function validateRetainedRun(receipt, lock) {
  need(exact(lock, ['run_id', 'project_id', 'image', 'source_sha256']) && lock.run_id === RUN && lock.project_id === PROJECT && lock.image === IMAGE && lock.source_sha256 === SOURCE);
  need(object(receipt) && receipt.run_id === RUN && receipt.project_id === PROJECT && receipt.team_id === TEAM && receipt.image === IMAGE && receipt.source_sha256 === SOURCE
    && receipt.result === 'unconfirmed' && receipt.cleanup_confirmed === false && receipt.lock_released === false && receipt.initial_current_cleanup_sessions_equal === true && Array.isArray(receipt.resources) && receipt.resources.length === FIXED.length);
  for (const [i, [name, session]] of FIXED.entries()) {
    const r = receipt.resources[i]; need(exact(r, ['name', 'attempted', 'identity_observed', 'session_id', 'initial_session_id', 'current_session_id', 'cleanup_session_id', 'initial_current_cleanup_session_equal', 'session_consistency_failed', 'absence_verified', 'snapshot_absence_verified']));
    need(r.name === name && r.attempted === true && r.identity_observed === true && r.session_id === session && r.initial_session_id === session && r.current_session_id === session && r.cleanup_session_id === session && r.initial_current_cleanup_session_equal === true && r.session_consistency_failed === false && r.absence_verified === false && r.snapshot_absence_verified === false);
  }
  return true;
}
export function absenceComplete(value) {
  if (!exact(value, ['gets', 'sandboxes', 'snapshots']) || !Array.isArray(value.gets) || value.gets.length !== FIXED.length) return false;
  for (const [i, [name]] of FIXED.entries()) if (!exact(value.gets[i], ['name', 'http_status']) || value.gets[i].name !== name || value.gets[i].http_status !== 404) return false;
  for (const key of ['sandboxes', 'snapshots']) { const v = value[key]; if (!exact(v, ['http_status', 'count', 'row_count', 'has_more']) || v.http_status !== 200 || v.count !== 0 || v.row_count !== 0 || v.has_more !== false) return false; }
  return true;
}
export async function reconcileAbsentRun(io, mode) {
  need(['inspect', 'unlock'].includes(mode)); const observations = [];
  for (let i = 0; i < (mode === 'unlock' ? 2 : 1); i++) observations.push(await io.observe());
  const absence_confirmed = observations.every(absenceComplete); await io.verify();
  if (mode === 'unlock') { need(absence_confirmed); await io.persistProof(observations); await io.verify(); await io.unlock(); }
  return { absence_confirmed, observations, lock_released: mode === 'unlock' && absence_confirmed };
}
async function publicRead(relative, maximum = 4 * 1024 ** 2) {
  const file = path.join(ROOT, relative); const before = await lstat(file);
  need(before.isFile() && !before.isSymbolicLink() && before.nlink === 1 && before.size > 0 && before.size <= maximum && path.resolve(await realpath(file)).toLowerCase() === file.toLowerCase());
  const data = await readFile(file); const after = await lstat(file);
  need(before.ino === after.ino && before.dev === after.dev && before.size === after.size && before.mtimeMs === after.mtimeMs && before.ctimeMs === after.ctimeMs && data.length === before.size); return data;
}
async function inputs() {
  for (const [relative, expected] of Object.entries(PINS)) need(sha(await publicRead(relative)) === expected);
  validateRetainedRun(JSON.parse(await publicRead(RECEIPT)), JSON.parse(await publicRead(LOCK)));
  const pkg = JSON.parse(await publicRead('.local/m07-pilot/tooling/node_modules/vercel/package.json')); need(pkg.version === '65.8.0');
  await publicRead(CLI); return sha(await publicRead('tools/reconcile-hosted-native.mjs'));
}
function environment() {
  const value = { NODE_ENV: 'production', PATH: '', CI: '1', VERCEL_TELEMETRY_DISABLED: '1', VERCEL_CLI_USE_NATIVE_BINARY: '0' };
  for (const key of ['SystemRoot', 'WINDIR', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'HOMEDRIVE', 'HOMEPATH', 'TEMP', 'TMP', 'LANG']) if (process.env[key]) value[key] = process.env[key]; return value;
}
async function mint() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(ROOT, CLI), 'api', `/v1/projects/${PROJECT}/token?teamId=${TEAM}`, '--scope', SLUG, '--method', 'POST', '--input', '-', '--raw', '--global-config', GLOBAL], { cwd: ROOT, env: environment(), shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let bytes = 0, diagnostics = 0, failed = false; const chunks = []; const stop = () => { failed = true; child.kill(); }; const timer = setTimeout(stop, 30000);
    child.once('error', stop); child.stdin.on('error', () => {}); child.stdout.on('data', chunk => { bytes += chunk.length; if (bytes > 32768) stop(); else chunks.push(chunk); }); child.stderr.on('data', chunk => { diagnostics += chunk.length; if (diagnostics > 32768) stop(); });
    child.once('close', code => { clearTimeout(timer); try { need(!failed && code === 0); resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(new Error('RECONCILE_TOKEN_UNCONFIRMED')); } });
    child.stdin.end(JSON.stringify({ source: 'everyone-studio-native-probe' }));
  });
}
async function exclusive(file, value) { const handle = await open(file, 'wx', 0o600); try { await handle.writeFile(JSON.stringify(value, null, 2) + '\n'); await handle.sync(); } finally { await handle.close(); } }
function listProjection(response, key) {
  const v = response.data; const valid = object(v) && Array.isArray(v[key]) && v[key].length <= 20 && object(v.pagination) && Number.isSafeInteger(v.pagination.count) && v.pagination.count >= 0 && (v.pagination.next === null || typeof v.pagination.next === 'string' && v.pagination.next.length <= 4096);
  return { http_status: response.status, count: valid ? v.pagination.count : null, row_count: valid ? v[key].length : null, has_more: valid ? v.pagination.next !== null : null };
}
async function main() {
  const mode = process.argv[2]; need(process.argv.length === 3 && ['inspect', 'unlock'].includes(mode) && process.platform === 'win32' && /^v24\./u.test(process.version));
  validateReconcileEnvironment(process.env);
  const helper = await inputs(); const id = randomUUID(); const observed = new Date().toISOString(); const base = path.join(ROOT, 'tracking/evidence/m07/worker-hosting', `${observed.replaceAll(':', '-')}-${id.slice(0, 8)}-7113-reconcile`);
  const report = { schema_version: '1.0', observed_at: observed, result: 'unconfirmed', mode, retained_run_id: RUN, team_id: TEAM, project_id: PROJECT, source_sha256: SOURCE, image: IMAGE, helper_sha256: helper, input_sha256: PINS,
    provider_vm_mutations: false, provider_get_retry: false, token_persisted: false, raw_payload_persisted: false, lock_released: false, http_observations: [], original_failed_probe_reclassified: false };
  let token; let requests = 0;
  try {
    if (mode === 'unlock') await exclusive(path.join(ROOT, '.local/m07-pilot/native-probe-7113-unlock.claim.json'), { run_id: RUN, helper_sha256: helper, receipt_sha256: PINS[RECEIPT], lock_sha256: PINS[LOCK], action: 'exact_local_lock_unlock_after_fresh_absence', observed_at: observed });
    const minted = await mint(); report.authentication = validateProjectToken(minted); token = minted.token;
    const overall = AbortSignal.timeout(120000);
    const request = async (operation, suffix, parameters) => {
      need(++requests <= 12); const url = new URL('https://vercel.com/api/v2/sandboxes' + suffix); for (const [key, value] of Object.entries({ ...parameters, teamId: TEAM })) url.searchParams.set(key, String(value));
      let status = 0, bytes = 0, data = null, code = null;
      try { const response = await fetch(url, { method: 'GET', redirect: 'error', headers: { authorization: `Bearer ${token}`, accept: 'application/json' }, signal: AbortSignal.any([overall, AbortSignal.timeout(15000)]) }); status = response.status;
        if (status === 404) await response.body?.cancel();
        else { const reader = response.body?.getReader(); need(reader); const chunks = []; try { while (true) { const next = await reader.read(); if (next.done) break; bytes += next.value.length; if (bytes > 1024 ** 2) { code = 'BODY_LIMIT'; throw new Error('limit'); } chunks.push(next.value); } } finally { await reader.cancel().catch(() => {}); }
          try { data = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { code = 'JSON_INVALID'; } }
      } catch { code ??= overall.aborted ? 'TIMEOUT' : 'NETWORK_OR_TIMEOUT'; }
      report.http_observations.push({ operation, status, body_bytes_observed_capped: Math.min(bytes, 1024 ** 2 + 65536), error_code: code }); return { status, data, code };
    };
    const io = { observe: async () => { const gets = []; for (const [name] of FIXED) { const r = await request('exact_get', '/' + name, { projectId: PROJECT, resume: 'false' }); gets.push({ name, http_status: r.status }); }
      const sandboxes = listProjection(await request('sandbox_list', '', { project: PROJECT, limit: 20, sortBy: 'name', namePrefix: 'eps-native-' }), 'sandboxes');
      const snapshots = listProjection(await request('snapshot_list', '/snapshots', { project: PROJECT, limit: 20 }), 'snapshots'); return { gets, sandboxes, snapshots }; },
      verify: async () => { need(await inputs() === helper); }, persistProof: async observations => { await exclusive(base + '-absence-proof.json', { ...report, result: 'fresh_absence_proven', observations, lock_released: false }); },
      unlock: async () => { need(await inputs() === helper); await unlink(path.join(ROOT, LOCK)); } };
    Object.assign(report, await reconcileAbsentRun(io, mode)); report.result = report.absence_confirmed ? 'absence_verified' : 'unconfirmed';
  } catch { report.code = 'RECONCILE_UNCONFIRMED'; process.exitCode = 1; }
  finally { token = undefined; report.http_requests = requests; report.finished_at = new Date().toISOString(); await exclusive(base + '.json', report); process.stdout.write(JSON.stringify({ receipt: path.relative(ROOT, base + '.json'), result: report.result, lock_released: report.lock_released, http_requests: requests }) + '\n'); }
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) main().catch(() => { process.stderr.write('RECONCILE_UNCONFIRMED\n'); process.exitCode = 1; });
