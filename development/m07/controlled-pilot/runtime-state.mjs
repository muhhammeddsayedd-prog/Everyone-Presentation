/** ROOT-EXECUTED READ-ONLY snapshot; importing performs no auth/provider IO.
 * GET operations/response fields verified against https://openapi.vercel.sh:
 * getDeployment, listDeploymentAliases, getRepository, listRepositoryImages.
 * Raw CLI JSON stays in memory; never persist env/protectionBypass/actor data. */
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const ROOT = path.resolve(import.meta.dirname, '../../..');
const CLI = path.join(ROOT, '.local/m07-pilot/tooling/node_modules/vercel/dist/vc.js');
const GLOBAL = 'C:/Users/iway/AppData/Roaming/xdg.data/com.vercel.cli';
const TEAM = 'team_gboXPxTevpCOZuaA8eY9PmR1'; const SLUG = 'muhammed-abdelrahman';
const WEB = 'prj_7xOsfRtvJ9voYi7rTEfra5ncOoA0'; const WORKER = 'prj_I4SMkDzaDy0KHNgiF00v4Da5aLb6';
const DEPLOYMENT = 'dpl_GPRog6HbnXNGpciqRi7TdypUCKM7'; const REPOSITORY = 'repo_OpIvBNiZ8vPVROs68HxcMb39W6yz';
const PATHS = Object.freeze({ deployment: `/v13/deployments/${DEPLOYMENT}?teamId=${TEAM}`, aliases: `/v2/deployments/${DEPLOYMENT}/aliases?teamId=${TEAM}`,
  repository: `/v1/vcr/repository/${REPOSITORY}?projectId=${WORKER}&teamId=${TEAM}`, images: `/v1/vcr/repository/${REPOSITORY}/images?projectId=${WORKER}&teamId=${TEAM}&limit=50` });
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const fail = code => { const error = new Error(code); error.code = code; throw error; };
const id = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,160}$/u.test(value);
const host = value => typeof value === 'string' && value.length <= 253 && /^everyone-presentation-pilot(?:-[a-z0-9-]+)?\.vercel\.app$/u.test(value);
const timestamp = value => typeof value === 'string' && value.length <= 40 && /^\d{4}-\d{2}-\d{2}T[0-9:.]+Z$/u.test(value) && Number.isFinite(Date.parse(value));
const millis = value => Number.isSafeInteger(value) && value > 0 && value <= Date.now() + 60_000;
const digest = value => typeof value === 'string' && /^sha256:[a-f0-9]{64}$/u.test(value);
function environment() {
  const value = { NODE_ENV: 'production', PATH: '', CI: '1', VERCEL_TELEMETRY_DISABLED: '1', VERCEL_CLI_USE_NATIVE_BINARY: '0' };
  for (const name of ['SystemRoot', 'WINDIR', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'HOMEDRIVE', 'HOMEPATH', 'TEMP', 'TMP', 'LANG']) if (process.env[name]) value[name] = process.env[name]; return value;
}
function get(operation) {
  if (!Object.hasOwn(PATHS, operation)) fail('RUNTIME_STATE_TARGET_INVALID');
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI, 'api', PATHS[operation], '--method', 'GET', '--scope', SLUG, '--raw', '--global-config', GLOBAL],
      { cwd: ROOT, env: environment(), windowsHide: true, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
    const chunks = []; let bytes = 0; let diagnostics = 0; let problem = false;
    const stop = () => { problem = true; child.kill(); }; const timer = setTimeout(stop, 30_000);
    child.once('error', stop); child.stdout.on('data', chunk => { bytes += chunk.length; if (bytes > 4 * 1024 ** 2) stop(); else chunks.push(chunk); });
    child.stderr.on('data', chunk => { diagnostics += chunk.length; if (diagnostics > 32768) stop(); });
    child.once('close', code => { clearTimeout(timer); if (problem || code !== 0) { reject(Object.assign(new Error('RUNTIME_STATE_READ_UNCONFIRMED'), { code: 'RUNTIME_STATE_READ_UNCONFIRMED' })); return; }
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(Object.assign(new Error('RUNTIME_STATE_RESPONSE_INVALID'), { code: 'RUNTIME_STATE_RESPONSE_INVALID' })); } });
  });
}
function deployment(value) {
  if (!object(value) || value.id !== DEPLOYMENT || value.name !== 'everyone-presentation-pilot' || value.project?.id !== WEB || value.project?.name !== 'everyone-presentation-pilot'
    || value.team?.id !== TEAM || value.team?.slug !== SLUG || !['BLOCKED', 'BUILDING', 'CANCELED', 'ERROR', 'INITIALIZING', 'QUEUED', 'READY'].includes(value.readyState)
    || ![null, 'production', 'staging'].includes(value.target) || !host(value.url) || typeof value.aliasAssigned !== 'boolean' || !millis(value.createdAt)
    || value.ready !== undefined && !millis(value.ready)) fail('RUNTIME_STATE_DEPLOYMENT_INVALID');
  return { id: DEPLOYMENT, project_id: WEB, project_name: 'everyone-presentation-pilot', team_id: TEAM, ready_state: value.readyState, target: value.target,
    url: `https://${value.url}`, aliases_assigned: value.aliasAssigned, created_at_ms: value.createdAt, ready_at_ms: value.ready ?? null };
}
function aliases(value) {
  if (!object(value) || !Array.isArray(value.aliases) || value.aliases.length > 50) fail('RUNTIME_STATE_ALIASES_INVALID'); const seen = new Set();
  return value.aliases.map(row => {
    if (!object(row) || !id(row.uid) || !host(row.alias) || seen.has(row.alias)) fail('RUNTIME_STATE_ALIASES_INVALID'); seen.add(row.alias);
    return { id: row.uid, alias: row.alias, url: `https://${row.alias}` };
  });
}
function repository(value) {
  const row = object(value) ? value.repository : null;
  if (!object(row) || row.id !== REPOSITORY || row.projectId !== WORKER || row.name !== 'native' || typeof row.public !== 'boolean' || !timestamp(row.createdAt) || !timestamp(row.updatedAt)) fail('RUNTIME_STATE_REPOSITORY_INVALID');
  return { id: REPOSITORY, project_id: WORKER, name: 'native', public: row.public, expected_private: true, privacy_matches_expected: row.public === false, created_at: row.createdAt, updated_at: row.updatedAt };
}
function images(value) {
  if (!object(value) || !Array.isArray(value.images) || value.images.length > 50 || value.nextCursor !== undefined && (typeof value.nextCursor !== 'string' || value.nextCursor.length > 2048)) fail('RUNTIME_STATE_IMAGES_INVALID');
  const projected = value.images.map(row => {
    if (!object(row) || !id(row.id) || row.repositoryId !== REPOSITORY || !digest(row.manifestDigest) || !['attestation', 'index', 'manifest'].includes(row.kind)
      || ![null, 'errored', 'preparing', 'ready', 'unoptimized'].includes(row.status) || !Number.isSafeInteger(row.sizeInBytes) || row.sizeInBytes < 0 || row.sizeInBytes > 200 * 1024 ** 3
      || !timestamp(row.createdAt) || !Array.isArray(row.tags) || row.tags.length > 50 || row.tags.some(tag => typeof tag !== 'string' || !/^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$/u.test(tag))
      || ['arch', 'platform'].some(key => row[key] !== undefined && (typeof row[key] !== 'string' || !/^[a-z0-9_-]{1,20}$/u.test(row[key])))) fail('RUNTIME_STATE_IMAGES_INVALID');
    return { id: row.id, repository_id: REPOSITORY, manifest_digest: row.manifestDigest, kind: row.kind, status: row.status, architecture: row.arch ?? null, platform: row.platform ?? null,
      size_bytes: row.sizeInBytes, tags: [...row.tags], created_at: row.createdAt };
  });
  return { images: projected, has_more: Boolean(value.nextCursor), limit: 50, pagination_followed: false };
}
async function main() {
  let phase = 'preflight'; const run = randomUUID(); const report = { schema_version: '1.0', run_id: run, observed_at: new Date().toISOString(), result: 'unconfirmed', read_only: true,
    scope: 'fixed pilot deployment and private native VCR metadata only; not application/worker/native acceptance', team_id: TEAM, provider_reads_attempted: 0,
    provider_mutations: false, private_configuration_requested: false, raw_payload_persisted: false, credentials_in_report: false };
  const output = path.join(ROOT, 'tracking/evidence/m07/controlled-pilot', `${report.observed_at.replaceAll(':', '-')}-${run.slice(0, 8)}-runtime-state.json`);
  try {
    if (process.argv.length !== 2 || process.platform !== 'win32' || !/^v24\./u.test(process.version) || process.env.NODE_OPTIONS) fail('RUNTIME_STATE_CONFIGURATION_INVALID');
    const info = await lstat(CLI); if (!info.isFile() || info.isSymbolicLink() || path.resolve(await realpath(CLI)).toLowerCase() !== CLI.toLowerCase()) fail('RUNTIME_STATE_CLI_UNPINNED');
    const pkg = JSON.parse(await readFile(path.join(path.dirname(CLI), '../package.json'), 'utf8')); if (pkg.version !== '65.8.0') fail('RUNTIME_STATE_CLI_UNPINNED');
    report.helper_sha256 = createHash('sha256').update(await readFile(import.meta.filename)).digest('hex'); report.cli_version = '65.8.0';
    for (const [name, project] of [['deployment', deployment], ['aliases', aliases], ['repository', repository], ['images', images]]) { phase = name; report.provider_reads_attempted++; const raw = await get(name); const safe = project(raw); report[name] = safe; }
    report.result = 'observed';
  } catch (error) { report.failed_phase = phase; report.code = typeof error?.code === 'string' && /^RUNTIME_STATE_[A-Z_]{1,80}$/u.test(error.code) ? error.code : 'RUNTIME_STATE_UNCONFIRMED'; process.exitCode = 1; }
  report.finished_at = new Date().toISOString();
  await mkdir(path.dirname(output), { recursive: true }); await writeFile(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  process.stdout.write(JSON.stringify({ receipt: path.relative(ROOT, output), result: report.result, failed_phase: report.failed_phase ?? null, code: report.code ?? null, provider_reads_attempted: report.provider_reads_attempted }) + '\n');
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) main().catch(() => { process.stderr.write('RUNTIME_STATE_UNCONFIRMED\n'); process.exitCode = 1; });
