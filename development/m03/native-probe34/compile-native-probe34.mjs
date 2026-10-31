/** Local compiler only. Does not import/execute the cloud operator, authenticate,
 * contact any provider, start Docker or modify the historical frozen tool. */
import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { NATIVE_PROBE_RELEASE } from './native-probe34-release.mjs';

export const BASE_OPERATOR_SHA256 = '84630e42f2e5277fe8865721d00779939802cc73d059bf795cffb9915e5cb3ab';
export const RELEASE_DATA_SHA256 = '9930e6d34ea9f8ff82ae5d2f992cda4dc63787406c180d7ae98e8a4b35ac65f8';
const BASE_RELEASE_SHA256 = 'b8eec2107417f4f4641c9dd7810ce056e5af937d2cada3236f05c454eb9cff26';
const ROOT = path.resolve(import.meta.dirname, '../../..');
export const sha = value => createHash('sha256').update(value).digest('hex');
const need = value => { if (!value) throw new Error('NATIVE_PROBE34_COMPILATION_UNCONFIRMED'); };
export function validateImage(image) {
  need(typeof image === 'string' && /^muhammed-abdelrahman\/everyone-presentation-worker-pilot\/native@sha256:[a-f0-9]{64}$/u.test(image));
  return image;
}
export function replaceOnce(source, oldValue, newValue) {
  need(source.split(oldValue).length === 2);
  return source.replace(oldValue, newValue);
}

export function compileSource(base, root, image, releaseSha, compilerSha) {
  need(sha(base) === BASE_OPERATOR_SHA256);
  validateImage(image);
  need(releaseSha === RELEASE_DATA_SHA256 && /^[a-f0-9]{64}$/u.test(compilerSha));
  let source = base.toString('utf8');
  const releaseRelative = 'development/m03/native-probe34/native-probe34-release.mjs';
  const imports = [
    '../development/m07/worker-hosting/native-init-diagnostic.mjs',
    '../development/m07/worker-hosting/native-boundary-diagnostic.mjs',
    '../development/m07/worker-hosting/native-chromium-diagnostic.mjs',
    '../tests/worker/presentation-native-fixture.ts',
    '../tests/worker/document-fixtures.ts',
  ];
  for (const oldValue of imports) source = replaceOnce(source, `'${oldValue}'`, JSON.stringify(pathToFileURL(path.resolve(root, 'tools', oldValue)).href));
  source = replaceOnce(source, "'../development/m07/worker-hosting/native-probe-release.mjs'", JSON.stringify(pathToFileURL(path.join(root, releaseRelative)).href));
  source = replaceOnce(source, "const ROOT = path.resolve(import.meta.dirname, '..');", `const ROOT = ${JSON.stringify(root)};`);
  source = replaceOnce(source, `const RELEASE_SOURCE_SHA = '${BASE_RELEASE_SHA256}';`, `const RELEASE_SOURCE_SHA = '${releaseSha}';`);
  source = replaceOnce(source, "'development/m07/worker-hosting/native-probe-release.mjs'", `'${releaseRelative}'`);
  source = replaceOnce(source, "'tracking/evidence/m07/worker-hosting'", "'tracking/evidence/m03/native-probe34'");
  const planSeam = 'const plan = probePlan(process.argv[2]); const image = validateProbeImage(process.argv[3]);';
  source = replaceOnce(source, planSeam, `${planSeam}\n  if (plan.mode !== 'smoke' || image !== ${JSON.stringify(image)}) fail('PROBE_PLAN_MISMATCH');\n  report.probe34_admission = ${JSON.stringify({ base_operator_sha256: BASE_OPERATOR_SHA256, release_sha256: releaseSha, compiler_sha256: compilerSha, mode: 'smoke', image, source_sha256: NATIVE_PROBE_RELEASE.source_sha256 })};`);
  const claimSeam = 'await lock.close(); locked = true;';
  source = replaceOnce(source, claimSeam, `${claimSeam}\n    const claimPath = path.join(ROOT, '.local/m07-pilot', ${JSON.stringify('native-probe34-' + image.split(':').at(-1) + '.claim.json')});\n    await writeFile(claimPath, JSON.stringify({ schema_version: '1.0', purpose: 'new-English34-image-native-smoke', run_id: run, project_id: PROJECT, source_sha256: SOURCE, image, automatic_retry: false }), { flag: 'wx', mode: 0o600 });\n    report.permanent_probe34_claim_created = true;`);
  // All original ownership, session consistency, snapshots, timeouts, transport
  // budget, source seal, SDK/CLI pins and cleanup code stay byte-for-byte.
  return Buffer.from(source, 'utf8');
}

async function regular(file, maximum = 1024 * 1024) {
  const info = await lstat(file);
  need(info.isFile() && !info.isSymbolicLink() && info.nlink === 1 && info.size <= maximum
    && path.resolve(await realpath(file)).toLowerCase() === file.toLowerCase());
  return readFile(file);
}

async function main() {
  need(process.argv.length === 3 && process.platform === 'win32' && /^v24\./u.test(process.version));
  const image = validateImage(process.argv[2]);
  const basePath = path.join(ROOT, 'tools/probe-hosted-native.mjs');
  const releasePath = path.join(ROOT, 'development/m03/native-probe34/native-probe34-release.mjs');
  const sourcePath = path.join(ROOT, NATIVE_PROBE_RELEASE.context_relative, 'apps/worker/native-source.json');
  const [base, release, self, sourceBytes] = await Promise.all([regular(basePath), regular(releasePath), regular(import.meta.filename), regular(sourcePath)]);
  need(sha(release) === RELEASE_DATA_SHA256);
  const source = JSON.parse(sourceBytes.toString('utf8'));
  need(source.source_sha256 === NATIVE_PROBE_RELEASE.source_sha256 && source.files.length === 160);
  const pins = { 'apps/worker/src/native-identity.mjs':NATIVE_PROBE_RELEASE.native_identity_sha256,
    'apps/worker/src/native-task-limits.mjs':NATIVE_PROBE_RELEASE.native_task_limits_sha256,
    'apps/worker/src/native-sandbox-launch.mjs':NATIVE_PROBE_RELEASE.native_launcher_sha256,
    'apps/worker/src/native-source-seal.ts':NATIVE_PROBE_RELEASE.seal_validator_sha256,
    ...NATIVE_PROBE_RELEASE.runtime_contract_sha256 };
  for (const [relative, expected] of Object.entries(pins)) need(source.files.filter(row => row.path === relative && row.sha256 === expected).length === 1);
  const compiled = compileSource(base, ROOT, image, sha(release), sha(self));
  const directory = path.join(ROOT, '.local/m03-native-probe34', randomUUID());
  await mkdir(directory, { recursive:true });
  need(path.resolve(await realpath(directory)).toLowerCase() === directory.toLowerCase());
  const operator = path.join(directory, 'probe-hosted-native34.mjs');
  const plan = { schema_version:'1.0', prepared_at:new Date().toISOString(), provider_called:false, cloud_execution_performed:false,
    image, mode:'smoke', source_sha256:NATIVE_PROBE_RELEASE.source_sha256, file_count:160, context_relative:NATIVE_PROBE_RELEASE.context_relative,
    base_operator_sha256:BASE_OPERATOR_SHA256, release_sha256:sha(release), compiler_sha256:sha(self), generated_operator_sha256:sha(compiled),
    generated_operator_relative:path.relative(ROOT, operator).replaceAll('\\','/'), expected_maximum_named_resources:10,
    expected_native_tasks:9, shared_lock_relative:'.local/m07-pilot/native-probe.lock.json',
    permanent_once_claim_relative:'.local/m07-pilot/native-probe34-' + image.split(':').at(-1) + '.claim.json',
    sdk_version:'3.9.1', cli_version:'65.8.0', fixture_kind:'public_synthetic_only',
    required_acceptance:['new_image_source_seal','uid65432_gid65432','no_new_privileges','capabilities_empty','known_write_denials',
      'dns_and_ip_network_denial','nine_native_tasks','exact_resource_identity','initial_current_cleanup_session_equality','absence_and_snapshot_absence','shared_lock_released'] };
  await writeFile(operator, compiled, { flag:'wx' });
  await writeFile(path.join(directory, 'execution-plan.json'), JSON.stringify(plan, null, 2) + '\n', { flag:'wx' });
  process.stdout.write(JSON.stringify(plan) + '\n');
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) main().catch(() => {
  process.stdout.write('NATIVE_PROBE34_COMPILATION_UNCONFIRMED\n'); process.exitCode = 1;
});
