/** ROOT-EXECUTED ONLY. Importing performs no private IO, CLI/auth/provider call.
 * One initial fixed-project transfer; permanent claim and no resume/upsert path.
 * API: https://vercel.com/docs/rest-api/projects/create-one-or-more-environment-variables
 * Metadata only: https://vercel.com/docs/rest-api/projects/retrieve-the-environment-variables-of-a-project-by-id-or-name */
import { Buffer } from 'node:buffer';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID, X509Certificate } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, mkdir, open, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL, URL } from 'node:url';
import { TextDecoder } from 'node:util';
import { loadWorkerPrivateEnvironment } from '../../../tools/worker-private-env.mjs';
import { loadWorkerRuntimeEnvironment, createSpecsWorkerEnvironment } from '../../../tools/worker-runtime-env.mjs';
import { loadWorkerFilesEnvironment } from '../../../tools/worker-files-env.mjs';
import { loadCandidateRuntimeEnvironment } from '../../../tools/candidate-runtime-env.mjs';
import { loadFrameRuntimeEnvironment } from '../../../tools/frame-runtime-env.mjs';
import { loadPdfVisionEnvironment } from '../../../tools/pdf-vision-env.mjs';
import { loadReviewRuntimeEnvironment } from '../../../tools/review-runtime-env.mjs';
import { loadPresentationRuntimeEnvironment } from '../../../tools/presentation-runtime-env.mjs';
import { validatePublicCentral, environmentMetadata, createdEnvironmentMetadata } from './env-projection.mjs';

const ROOT = path.resolve(import.meta.dirname, '../../..');
const PROJECT = 'prj_I4SMkDzaDy0KHNgiF00v4Da5aLb6';
const TEAM = 'team_gboXPxTevpCOZuaA8eY9PmR1';
const SLUG = 'muhammed-abdelrahman';
const SOURCE = 'bc774c88083d106fd522ee6277fc8a81033a6b94ff05e9debdfe1d6ee661a735';
const CONTEXT = path.join(ROOT, '.local/worker-hosting/7b5324c8-f3a1-4a61-996f-8d69c93a7180/context');
const MANIFEST = path.join(CONTEXT, 'apps/worker/native-sandbox-manifest.json');
const CLI = path.join(ROOT, '.local/m07-pilot/tooling/node_modules/vercel/dist/vc.js');
const GLOBAL = 'C:/Users/iway/AppData/Roaming/xdg.data/com.vercel.cli';
const DIRECTORY = path.join(ROOT, '.local/m07-pilot/worker-environment');
const FLAGS = ['EPS_SPECS_FILES_ENABLED', 'EPS_CANDIDATE_MEDIA_ENABLED', 'EPS_FRAME_EXTRACTION_ENABLED',
  'EPS_PDF_VISION_ENABLED', 'EPS_REVIEW_ENABLED', 'EPS_PRESENTATION_ENABLED', 'EPS_GUEST_EXPORTS_ENABLED'];
const PRIVATE = ['OPENAI_API_KEY', 'EPS_SPECS_PG_HOST', 'EPS_SPECS_PG_PASSWORD', 'EPS_SPECS_PG_CA_BASE64',
  'N8N_DISPATCH_URL', 'N8N_DISPATCH_SECRET', 'N8N_CANDIDATE_DISPATCH_URL', 'N8N_CANDIDATE_DISPATCH_SECRET',
  'N8N_REVIEW_DISPATCH_URL', 'N8N_REVIEW_DISPATCH_SECRET', 'N8N_PRESENTATION_DISPATCH_URL', 'N8N_PRESENTATION_DISPATCH_SECRET'];
const FIELDS = [...PRIVATE, 'OPENAI_EXTRACTION_MODEL', 'OPENAI_TRANSCRIPTION_MODEL', 'SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', ...FLAGS];
const FIXED = { NODE_ENV:'production', EPS_RELEASE_MODE:'controlled_pilot', EPS_NATIVE_TRANSPORT:'vercel_sandbox', EPS_PILOT_OWNER_CONTROLLED:'true' };
const KEYS = [...FIELDS, ...Object.keys(FIXED), 'EPS_NATIVE_MANIFEST_SHA256'].sort();
// CLI65 api supplies no retry override. Three default retries follow the first
// attempt; DPoP nonce correction can additionally resend inside each attempt.
const CLI_TRANSPORT_POLICY = { helper_write_retry:false, cli_network_5xx_retries_maximum:3, cli_request_attempts_maximum_per_operation:4,
  cli_dpop_nonce_resends_maximum_per_request_attempt:1,
  cli_request_attempt_scope:'Retry-loop attempts (initial plus three retries); DPoP nonce correction and authentication maintenance can add wire requests. No exact wire-count claim.' };
const CLI_SOURCE_PINS = {
  '.local/m07-pilot/tooling/node_modules/vercel/dist/chunks/chunk-YIOT5B5Z.js':'36a7d817e495b18babf431a5380e530f3f6ceb262120bafc56b3d9163aaae661',
  '.local/m07-pilot/tooling/node_modules/vercel/dist/chunks/chunk-QZEZCUUZ.js':'d81dab4301ba45c2d3c786bbca5c29a5027e98976118102de7aa8e99b607d23a' };
const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const hash = value => createHash('sha256').update(value).digest('hex');
const fail = () => { throw new Error('WORKER_ENVIRONMENT_UNCONFIRMED'); };

function validateSelected(values) {
  if (!object(values) || !same(Object.keys(values).sort(), KEYS)
    || KEYS.some(key => typeof values[key] !== 'string' || !values[key] || values[key].length > 24000 || /[\r\n\0]/u.test(values[key]))
    || Object.entries(FIXED).some(([key,value]) => values[key] !== value) || FLAGS.some(key => values[key] !== 'true')
    || !/^[a-f0-9]{64}$/u.test(values.EPS_NATIVE_MANIFEST_SHA256)) fail();
  try { validatePublicCentral(values); } catch { fail(); }
  for (const key of ['OPENAI_EXTRACTION_MODEL', 'OPENAI_TRANSCRIPTION_MODEL']) if (!/^[A-Za-z0-9._-]{1,200}$/u.test(values[key])) fail();
  if (values.OPENAI_API_KEY.length < 16 || values.OPENAI_API_KEY.length > 4096 || /\s/u.test(values.OPENAI_API_KEY)
    || values.EPS_SPECS_PG_HOST !== 'aws-0-eu-west-1.pooler.supabase.com'
    || values.EPS_SPECS_PG_PASSWORD.length < 32 || values.EPS_SPECS_PG_PASSWORD.length > 512 || /[^\x21-\x7e]/u.test(values.EPS_SPECS_PG_PASSWORD)) fail();
  const encoded = values.EPS_SPECS_PG_CA_BASE64;
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(encoded)) fail();
  const certificate = Buffer.from(encoded,'base64');
  if (certificate.toString('base64') !== encoded || certificate.length > 16384 || !certificate.equals(Buffer.from(certificate.toString('utf8'),'utf8'))
    || !/^-----BEGIN CERTIFICATE-----\r?\n[A-Za-z0-9+/=\r\n]+\r?\n-----END CERTIFICATE-----\r?\n?$/u.test(certificate.toString('utf8'))) fail();
  try { if (!new X509Certificate(certificate).ca) fail(); } catch { fail(); }
  const webhooks = [['N8N_DISPATCH','eps-wf01-specs-stage-v1'], ['N8N_CANDIDATE_DISPATCH','eps-wf02-candidate-stage-v1'],
    ['N8N_REVIEW_DISPATCH','eps-wf05-review-suggestion-stage-v1'], ['N8N_PRESENTATION_DISPATCH','eps-wf03-presentation-stage-v1']];
  let origin; const secrets = new Set();
  for (const [prefix, endpoint] of webhooks) {
    let url; try { url = new URL(values[`${prefix}_URL`]); } catch { fail(); }
    const secret = values[`${prefix}_SECRET`];
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.search || url.hash
      || !/^[a-z0-9-]+(?:\.app)?\.n8n\.cloud$/u.test(url.hostname) || url.pathname !== `/webhook/${endpoint}`
      || values[`${prefix}_URL`] !== url.href || origin && url.origin !== origin
      || (prefix === 'N8N_DISPATCH' ? secret.trim().length < 32 || /[\r\n]/u.test(secret) : !/^[a-f0-9]{64}$/u.test(secret)) || secrets.has(secret)) fail();
    origin = url.origin; secrets.add(secret);
  }
}

/** Values returned here are private. Never serialize, hash or log the object. */
export function workerEnvironmentValues(composed, manifestBytes) {
  if (!object(composed) || !Buffer.isBuffer(manifestBytes) || manifestBytes.length < 1 || manifestBytes.length > 4096) fail();
  let manifest;
  try { manifest = JSON.parse(new TextDecoder('utf8',{fatal:true}).decode(manifestBytes)); } catch { fail(); }
  if (!object(manifest) || Object.keys(manifest).sort().join(',') !== 'image,protocol,region,schema_version,source_sha256,transport'
    || manifest.schema_version !== '1.0' || manifest.transport !== 'vercel_sandbox' || manifest.protocol !== 'eps-native-files-v1'
    || manifest.region !== 'dub1' || manifest.source_sha256 !== SOURCE
    || typeof manifest.image !== 'string' || !/^muhammed-abdelrahman\/everyone-presentation-worker-pilot\/native@sha256:[a-f0-9]{64}$/u.test(manifest.image)) fail();
  const values = { ...Object.fromEntries(FIELDS.map(key => [key,composed[key]])), ...FIXED, EPS_NATIVE_MANIFEST_SHA256:hash(manifestBytes) };
  validateSelected(values); return values;
}

export function validateWorkerProject(value) {
  if (!object(value) || value.id !== PROJECT || value.accountId !== TEAM || value.name !== 'everyone-presentation-worker-pilot'
    || value.nodeVersion !== '24.x' || value.rootDirectory !== null || value.oidcTokenConfig?.enabled !== true) fail();
  return { id:PROJECT, account_id:TEAM, name:value.name, node_version:'24.x', root_directory:null, oidc_enabled:true };
}

export function workerEnvironmentMetadata() {
  return environmentMetadata(KEYS.map(key => ({ key, type:PRIVATE.includes(key)?'sensitive':'plain', target:['production'] })));
}

function closedMetadata(rows) {
  if (!Array.isArray(rows) || rows.length > 64 || rows.some(row => !object(row) || row.gitBranch != null
    || row.customEnvironmentIds !== undefined && (!Array.isArray(row.customEnvironmentIds) || row.customEnvironmentIds.length !== 0))) fail();
  try { return environmentMetadata(rows); } catch { return fail(); }
}

export function inspectWorkerMetadata(response, { expected = false } = {}) {
  if (!object(response) || response.pagination?.next) fail();
  const rows = closedMetadata(response.envs);
  if (expected && !same(rows,workerEnvironmentMetadata())) fail();
  return rows;
}

const loaders = { provider:loadWorkerPrivateEnvironment, runtime:loadWorkerRuntimeEnvironment, files:loadWorkerFilesEnvironment,
  candidate:loadCandidateRuntimeEnvironment, frames:loadFrameRuntimeEnvironment, pdfVision:loadPdfVisionEnvironment,
  review:loadReviewRuntimeEnvironment, presentation:loadPresentationRuntimeEnvironment, create:createSpecsWorkerEnvironment };
export async function composeWorkerEnvironment(source = loaders) {
  const provider = await source.provider({ environment:{} }); const runtime = await source.runtime();
  const files = await source.files({ environment:{ EPS_SPECS_FILES_ENABLED:'true' } });
  const candidate = await source.candidate(); const frames = await source.frames(); const pdfVision = await source.pdfVision();
  const review = await source.review(); const presentation = await source.presentation();
  return { ...source.create(provider,runtime,{},files), ...candidate, ...frames, ...pdfVision, ...review, ...presentation, EPS_GUEST_EXPORTS_ENABLED:'true' };
}

/** Injected effects are a pure test seam. The CLI uses only the fixed adapters below. */
export async function applyWorkerEnvironment(values, io) {
  validateSelected(values); const expected = workerEnvironmentMetadata();
  if (inspectWorkerMetadata(await io.readMetadata()).length !== 0) fail();
  await io.claim({ project_id:PROJECT, team_id:TEAM, expected_metadata:expected,
    manifest_sha256:values.EPS_NATIVE_MANIFEST_SHA256, ...CLI_TRANSPORT_POLICY,
    scope:'One initial production-only transfer; CLI transport may retry the same unique-key create with upsert=false. Unknown outer outcome permits readback only' });
  if (inspectWorkerMetadata(await io.readMetadata()).length !== 0) fail();
  let attempted = 0; let createConfirmed = 0; let stopped = false;
  for (const row of expected) {
    try {
      await io.journal({phase:'attempted',metadata:[row]}); attempted++;
      const response = await io.create({...row,value:values[row.key],comment:'Controlled Studio worker pilot; scoped runtime only'});
      const created = createdEnvironmentMetadata(response);
      // Projection is shared with app transfer, then scope checks close its response.
      closedMetadata(Array.isArray(response.created)?response.created:[response.created]);
      if (!same(created,[row])) fail();
      createConfirmed++; await io.journal({phase:'created',metadata:created});
    } catch { stopped = true; break; }
  }
  let observed = null; let independent = null;
  try { observed = inspectWorkerMetadata(await io.readMetadata()); } catch { /* No raw provider error escapes. */ }
  try { independent = inspectWorkerMetadata(await io.readMetadata()); } catch { /* Never redispatch. */ }
  const equal = observed !== null && independent !== null && same(observed,independent);
  const complete = equal && same(observed,expected);
  return { result:!stopped && complete?'passed':'unconfirmed', attempted_variables:attempted, confirmed_create_responses:createConfirmed,
    observed_metadata:observed, independent_metadata:independent, independent_metadata_equal:equal,
    expected_metadata_complete:complete, ...CLI_TRANSPORT_POLICY, claim_retained:true,
    private_values_or_digests_recorded:false, runtime_or_worker_acceptance:false };
}

function cliEnvironment() {
  const environment = { NODE_ENV:'production',PATH:'',CI:'1',VERCEL_TELEMETRY_DISABLED:'1',VERCEL_CLI_USE_NATIVE_BINARY:'0' };
  for (const key of ['SystemRoot','WINDIR','USERPROFILE','APPDATA','LOCALAPPDATA','HOMEDRIVE','HOMEPATH','TEMP','TMP','LANG'])
    if (typeof process.env[key] === 'string') environment[key] = process.env[key];
  return environment;
}
function api(endpoint,body) {
  const args = [CLI,'api',endpoint,'--scope',SLUG,'--raw','--global-config',GLOBAL];
  if (body !== undefined) args.push('--method','POST','--input','-');
  try {
    return JSON.parse(execFileSync(process.execPath,args,{cwd:ROOT,env:cliEnvironment(),input:body===undefined?undefined:JSON.stringify(body),
      stdio:['pipe','pipe','pipe'],windowsHide:true,shell:false,timeout:60000,maxBuffer:2*1024*1024}).toString('utf8'));
  } catch { return fail(); }
}
const metadataEndpoint = `/v10/projects/${PROJECT}/env?teamId=${TEAM}&decrypt=false`;
const createEndpoint = `/v10/projects/${PROJECT}/env?teamId=${TEAM}&upsert=false`;
const matchesPath = (a,b) => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();
async function regularPublicFile(file, maximum) {
  const before = await lstat(file,{bigint:true});
  if (!before.isFile() || before.isSymbolicLink() || before.size < 1n || before.size > BigInt(maximum) || !matchesPath(await realpath(file),file)) fail();
  const handle = await open(file,constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const opened = await handle.stat({bigint:true}); const bytes = await handle.readFile(); const after = await handle.stat({bigint:true}); const current = await lstat(file,{bigint:true});
    const identity = value => [value.dev,value.ino,value.size,value.mtimeMs,value.ctimeMs].map(String).join(',');
    if (bytes.length > maximum || BigInt(bytes.length) !== before.size || identity(before) !== identity(opened) || identity(opened) !== identity(after)
      || identity(after) !== identity(current) || !matchesPath(await realpath(file),file)) fail();
    return bytes;
  } finally { await handle.close(); }
}
async function checkedOperator() {
  if (process.platform !== 'win32' || !/^v24\./u.test(process.version) || process.env.NODE_OPTIONS) fail();
  const cli = await lstat(CLI); const config = await lstat(GLOBAL);
  if (!cli.isFile() || cli.isSymbolicLink() || !matchesPath(await realpath(CLI),CLI) || !config.isDirectory()
    || config.isSymbolicLink() || !matchesPath(await realpath(GLOBAL),GLOBAL)) fail();
  const pkg = JSON.parse(await regularPublicFile(path.join(path.dirname(CLI),'../package.json'),65536));
  if (pkg.version !== '65.8.0' || !matchesPath(await realpath(CONTEXT),CONTEXT)) fail();
  // Public source bytes only, before any authenticated CLI invocation.
  for (const [relative,expected] of Object.entries(CLI_SOURCE_PINS))
    if (hash(await regularPublicFile(path.join(ROOT,relative),2*1024*1024)) !== expected) fail();
}
async function claim(value) {
  await mkdir(DIRECTORY,{recursive:true}); if (!matchesPath(await realpath(DIRECTORY),DIRECTORY)) fail();
  const handle = await open(path.join(DIRECTORY,'apply.claim.json'),'wx',0o600);
  try { await handle.writeFile(JSON.stringify({...value,claimed_at:new Date().toISOString()})+'\n'); await handle.sync(); } finally { await handle.close(); }
}
async function journal(value) {
  const key = value.metadata?.[0]?.key;
  if (!KEYS.includes(key) || !['attempted','created'].includes(value.phase) || value.metadata.length !== 1) fail();
  const handle = await open(path.join(DIRECTORY,`${key}.${value.phase}.json`),'wx',0o600);
  try { await handle.writeFile(JSON.stringify({...value,observed_at:new Date().toISOString()})+'\n'); await handle.sync(); } finally { await handle.close(); }
}
async function main() {
  const action = process.argv[2]; if (process.argv.length !== 3 || !['inspect','preflight','apply'].includes(action)) fail();
  await checkedOperator();
  const project = validateWorkerProject(api(`/v9/projects/${PROJECT}?teamId=${TEAM}`));
  const current = inspectWorkerMetadata(api(metadataEndpoint));
  let result = {result:'passed',observed_metadata:current,expected_metadata_complete:same(current,workerEnvironmentMetadata()),variables_written:false};
  if (action !== 'inspect') {
    if (current.length !== 0) fail();
    const manifestBytes = await regularPublicFile(MANIFEST,4096);
    const values = workerEnvironmentValues(await composeWorkerEnvironment(),manifestBytes);
    result = {...result,expected_metadata:workerEnvironmentMetadata(),manifest_sha256:hash(manifestBytes),frozen_source_sha256:SOURCE};
    if (action === 'apply') {
      // Fresh fixed-project/config checks immediately before the permanent claim.
      validateWorkerProject(api(`/v9/projects/${PROJECT}?teamId=${TEAM}`));
      if (!manifestBytes.equals(await regularPublicFile(MANIFEST,4096))) fail();
      const applied = await applyWorkerEnvironment(values,{readMetadata:async()=>api(metadataEndpoint),claim,journal,create:async body=>api(createEndpoint,body)});
      result = {...result,...applied,variables_written:applied.result==='passed'?true:null,write_dispatch_attempted:applied.attempted_variables>0};
    }
  }
  const report = {schema_version:'1.0',observed_at:new Date().toISOString(),action,project,...result,
    ...CLI_TRANSPORT_POLICY,
    private_values_or_digests_recorded:false,platform_oidc_fields_uploaded:false,management_or_personal_credentials_uploaded:false,
    runtime_or_worker_acceptance:false};
  if (action === 'apply') {
    const directory = path.join(ROOT,'tracking/evidence/m07/controlled-pilot'); await mkdir(directory,{recursive:true});
    const output = path.join(directory,`${new Date().toISOString().replaceAll(':','-')}-${randomUUID().slice(0,8)}-worker-env-apply.json`);
    await writeFile(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
    process.stdout.write(JSON.stringify({receipt:path.relative(ROOT,output),...report})+'\n');
  } else process.stdout.write(JSON.stringify(report)+'\n'); // inspect/preflight write no files.
  if (report.result !== 'passed') process.exitCode = 1;
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url)
  main().catch(()=>{process.stderr.write('WORKER_ENVIRONMENT_UNCONFIRMED: fixed-target metadata readback only; never retry an unknown write.\n');process.exitCode=1;});
