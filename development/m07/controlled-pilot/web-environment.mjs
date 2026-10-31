/** Narrow app-only secret transfer to the fixed owner-created Vercel pilot. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, lstat, realpath, mkdir, open, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { parseEnv, TextDecoder } from 'node:util';
import { randomUUID } from 'node:crypto';
import { loadPrivateLogoEnvironment } from '../../../tools/dev-central.mjs';
import { loadPrivateSpecsEnvironment } from '../../../tools/private-specs-env.mjs';
import { loadPrivateSupportEnvironment } from '../../../tools/private-support-env.mjs';
import { loadPrivateGuestEnvironment } from '../../../tools/private-guest-env.mjs';
import { validatePublicCentral, environmentMetadata as metadata, createdEnvironmentMetadata } from './env-projection.mjs';

const ROOT = path.resolve(import.meta.dirname, '../../..');
const CLI = 'C:/Users/iway/AppData/Roaming/npm/node_modules/vercel/dist/vc.js';
const TEAM = 'team_gboXPxTevpCOZuaA8eY9PmR1', PROJECT = 'prj_7xOsfRtvJ9voYi7rTEfra5ncOoA0';
const ORIGIN = 'https://everyone-presentation-pilot.vercel.app';
const action = process.argv[2];
assert(['preflight', 'apply', 'inspect', 'reconcile-empty', 'resume-initial'].includes(action) && process.argv.length === 3);
const secretNames = new Set(['LOGO_VERIFICATION_KEY_BASE64URL', 'SPECS_VERIFICATION_KEY_BASE64URL',
  'EPS_SUPPORT_VERIFIER_KEY_HEX', 'EPS_REVIEW_GATEWAY_KEY', 'EPS_REVIEW_REPLAY_KEY']);
const sourceFields = ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'CENTRAL_LOGO_UPLOADS_ENABLED',
  'LOGO_VERIFICATION_KEY_ID', 'LOGO_VERIFICATION_KEY_BASE64URL', 'CENTRAL_SPECS_UPLOADS_ENABLED',
  'SPECS_VERIFICATION_KEY_ID', 'SPECS_VERIFICATION_KEY_BASE64URL', 'CENTRAL_CANDIDATE_UPLOADS_ENABLED',
  'CENTRAL_CANDIDATE_MAXIMUM_UPLOAD_BYTES'];
function api(endpoint, body) {
  const args = [CLI, 'api', endpoint, '--scope', 'muhammed-abdelrahman', '--raw'];
  if (body) args.push('--method', 'POST', '--input', '-');
  return JSON.parse(execFileSync(process.execPath, args, { cwd: ROOT, input: body ? JSON.stringify(body) : undefined,
    stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true, timeout: 60000, maxBuffer: 2 * 1024 * 1024 }).toString('utf8'));
}
try {
  const project = api(`/v9/projects/${PROJECT}?teamId=${TEAM}`);
  assert(project.id === PROJECT && project.accountId === TEAM && project.name === 'everyone-presentation-pilot'
    && project.rootDirectory === 'apps/web' && project.nodeVersion === '24.x');
  const current = metadata(api(`/v10/projects/${PROJECT}/env?teamId=${TEAM}&decrypt=false`).envs);
  let keys = [], expiry = null, didWrite = false, expected = null;
  if (action !== 'inspect') {
    const file = path.join(ROOT, 'apps/web/.env.local'), stat = await lstat(file);
    assert(stat.isFile() && !stat.isSymbolicLink() && stat.size < 1024 * 1024
      && (await realpath(file)).toLowerCase() === file.toLowerCase());
    const parsed = parseEnv(new TextDecoder('utf8', { fatal: true }).decode(await readFile(file)));
    validatePublicCentral(parsed);
    const selected = Object.fromEntries(sourceFields.filter(k => parsed[k] !== undefined).map(k => [k, parsed[k]]));
    const logo = await loadPrivateLogoEnvironment({}), specs = await loadPrivateSpecsEnvironment({});
    const support = await loadPrivateSupportEnvironment(), guest = await loadPrivateGuestEnvironment();
    const settingsFile = path.join(ROOT, '.local/m07-pilot/pilot-settings.json');
    const settings = JSON.parse(await readFile(settingsFile, 'utf8'));
    assert.deepEqual(Object.keys(settings).sort(), ['origin', 'expires_at', 'storage_limit_receipt'].sort());
    assert.equal(settings.origin, ORIGIN);
    expiry = settings.expires_at;
    assert(typeof expiry === 'string' && new Date(expiry).toISOString() === expiry && Date.parse(expiry) > Date.now());
    assert(/^tracking\/evidence\/m03\/storage-limit-discovery\/[0-9TZ-]+-[a-f0-9]{8}\.json$/u.test(settings.storage_limit_receipt));
    const storage = JSON.parse(await readFile(path.join(ROOT, settings.storage_limit_receipt), 'utf8'));
    assert(storage.target === 'pyibofyctwnqpvktepse' && storage.project_and_repo_config_unchanged === true
      && storage.project_or_repo_config_written === false && storage.cli_exit_code === 0
      && Date.now() - Date.parse(storage.observed_at) >= 0 && Date.now() - Date.parse(storage.observed_at) < 60 * 60 * 1000
      && Number.isSafeInteger(storage.maximum_bytes) && storage.maximum_bytes > 0);
    const values = { ...selected, ...logo, ...specs, ...support, ...guest, APP_ENV: 'staging', NODE_ENV: 'production',
      APP_BASE_URL: ORIGIN, CENTRAL_ADAPTER_MODE: 'supabase', EPS_RELEASE_MODE: 'controlled_pilot',
      CENTRAL_LOGO_UPLOADS_ENABLED: 'true', CENTRAL_SPECS_UPLOADS_ENABLED: 'true',
      CENTRAL_CANDIDATE_UPLOADS_ENABLED: 'true',
      CENTRAL_CANDIDATE_MAXIMUM_UPLOAD_BYTES: String(Math.min(storage.maximum_bytes, 268435456)),
      EPS_PILOT_EXPIRES_AT: expiry, MCP_AUTH_MODE: 'disabled', DEFAULT_TIMEZONE: 'Africa/Cairo',
      NEXT_PUBLIC_APP_NAME: 'Everyone Presentation Studio' };
    assert.equal(values.CENTRAL_LOGO_UPLOADS_ENABLED, 'true'); assert.equal(values.CENTRAL_SPECS_UPLOADS_ENABLED, 'true');
    assert.equal(values.CENTRAL_CANDIDATE_UPLOADS_ENABLED, 'true');
    assert.equal(values.CENTRAL_CANDIDATE_SUPPORT_UPLOADS_ENABLED, 'true');
    assert(Object.keys(values).every(k => !/PG_|DATABASE|SERVER_KEY|SERVICE_ROLE|OPENAI|N8N|JOB_SERVICE|JOB_CLAIM|VERCEL_TOKEN/u.test(k)));
    for (const key of secretNames) assert(typeof values[key] === 'string' && values[key].length >= 32);
    keys = Object.keys(values).sort();
    expected = metadata(keys.map(key => ({key,type:secretNames.has(key) ? 'sensitive' : 'plain',target:['production','preview']})));
    if (['apply','reconcile-empty','resume-initial'].includes(action)) {
      if (action !== 'resume-initial') assert.equal(current.length, 0, 'Initial operation refuses any existing project variable.');
      else {
        assert(current.length > 0 && current.length < expected.length);
        for(const row of current) assert.deepEqual(row, expected.find(v=>v.key===row.key));
      }
      const directory = path.join(ROOT, '.local/m07-pilot'); await mkdir(directory, { recursive: true });
      if (action === 'reconcile-empty' || action === 'resume-initial') {
        const prior = JSON.parse(await readFile(path.join(directory,'web-environment-dispatch.json'),'utf8'));
        assert(prior.project === PROJECT); assert.deepEqual(prior.keys, keys);
      }
      const claimName=action==='apply'?'web-environment-dispatch.json':action==='reconcile-empty'?'web-environment-reconciled-dispatch.json':'web-environment-resume-missing-dispatch.json';
      const claim = await open(path.join(directory, claimName), 'wx');
      await claim.writeFile(JSON.stringify({ project: PROJECT, target: ['production', 'preview'], keys,
        claimed_at: new Date().toISOString(), scope: 'One initial variable batch; no blind repeat after unknown outcome' }) + '\n');
      await claim.close();
      const body = keys.map(key => ({ key, value: values[key], type: secretNames.has(key) ? 'sensitive' : 'plain',
        target: ['production', 'preview'], comment: 'Controlled Everyone Studio pilot; app-only configuration' }));
      if (action === 'apply') {
        const response = api(`/v10/projects/${PROJECT}/env?teamId=${TEAM}`, body);
        const created = createdEnvironmentMetadata(response);
        assert.deepEqual(created, expected);
      } else {
        for (const variable of body) {
          if(current.some(v=>v.key===variable.key)) continue;
          const response = api(`/v10/projects/${PROJECT}/env?teamId=${TEAM}`, variable);
          const created = createdEnvironmentMetadata(response);
          assert.deepEqual(created, expected.filter(v => v.key === variable.key));
          await writeFile(path.join(directory,`web-env-created-${variable.key}.json`),JSON.stringify({key:variable.key,observed_at:new Date().toISOString(),metadata:created})+'\n',{flag:'wx'});
        }
      }
      didWrite = true;
    }
  }
  const observed = didWrite ? metadata(api(`/v10/projects/${PROJECT}/env?teamId=${TEAM}&decrypt=false`).envs) : current;
  if (didWrite) assert.deepEqual(observed, expected);
  const report = { observed_at: new Date().toISOString(), action, project_id: PROJECT, team_id: TEAM,
    origin: ORIGIN, expires_at: expiry, result: 'passed', variables_written: didWrite, variable_names: keys,
    observed_metadata: observed, private_values_or_digests_recorded: false, service_or_provider_credentials_in_app: false,
    runtime_verified: false, claude_configuration_changed: false };
  const dir = path.join(ROOT, 'tracking/evidence/m07/controlled-pilot'); await mkdir(dir, { recursive: true });
  const output = path.join(dir, `${new Date().toISOString().replaceAll(':', '-').replace('.', '-')}-${randomUUID().slice(0, 8)}-web-env-${action}.json`);
  await writeFile(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  process.stdout.write(JSON.stringify({ receipt: path.relative(ROOT, output), ...report }) + '\n');
} catch (error) {
  const candidates = [error?.stdout, error?.stderr].filter(v => v !== undefined).map(v => String(v));
  const raw = candidates.join('\n');
  const code = /"code"\s*:\s*"([A-Za-z0-9_]{1,80})"/u.exec(raw)?.[1] ?? null;
  const approvalRejected = /automatic approval review rejected/iu.test(raw);
  process.stderr.write(JSON.stringify({provider_error_code:code,automatic_approval_rejected:approvalRejected,raw_diagnostics_suppressed:true})+'\n');
  process.stderr.write('Pilot app environment unconfirmed; private diagnostics suppressed. Inspect metadata and runtime before any repeat.\n');
  process.exitCode = 1;
}
