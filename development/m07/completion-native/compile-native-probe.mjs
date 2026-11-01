/** New disabled local preparation. Never imports or invokes a cloud main(). */
import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { NATIVE_PROBE_RELEASE } from './native-probe-release.mjs';

export const PREPARATION_ENABLED = true;
export const BASE_OPERATOR_SHA256 = '84630e42f2e5277fe8865721d00779939802cc73d059bf795cffb9915e5cb3ab';
export const RELEASE_DATA_SHA256 = '41a4f9c84970d9c1509ac60fda878a746156f02a9be5f598c977276f78b5b7f9';
const BASE_RELEASE_SHA256 = 'b8eec2107417f4f4641c9dd7810ce056e5af937d2cada3236f05c454eb9cff26';
export const PRIOR_NATIVE_DIGEST = 'sha256:50082f72d4438653d4c831a1f9a360d61e64d19b3568ed1c2a2456d486f0d77c';
const ROOT = path.resolve(import.meta.dirname, '../../..');
export const MAIN = path.resolve('D:/Everyone/Presentation/Everyone-Presentation-Studio');
export const IMAGE = 'muhammed-abdelrahman/everyone-presentation-worker-pilot/native@sha256:46de2f0c0772e10d712fba514788d24041d6741faa8966b6fe9c554fe47e4af4';
export const READY_REFERENCE = Object.freeze({path:'tracking/evidence/m07/completion-worker/2026-11-01T23-38-34-463049Z-native-registry-ready.json',sha256:'9c5c6ed9f6cf74df71dd60981666fd03b5849b4ce8ca15358d308f455d1e2742'});
const PROJECT = 'prj_I4SMkDzaDy0KHNgiF00v4Da5aLb6';
const TEAM = 'team_gboXPxTevpCOZuaA8eY9PmR1';
const NATIVE_REPOSITORY = 'repo_OpIvBNiZ8vPVROs68HxcMb39W6yz';
const PURPOSE = 'development/m07/completion-native';
export const sha = value => createHash('sha256').update(value).digest('hex');
const need = value => { if (!value) throw new Error('COMPLETION_NATIVE_COMPILATION_UNCONFIRMED'); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value, keys) => object(value) && Object.keys(value).sort().join(',') === [...keys].sort().join(',');
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export const PUBLIC_HELPER_PINS = Object.freeze({
  'development/m07/worker-hosting/native-init-diagnostic.mjs': '042c29fc6241dc931cbdcc38ee9aa42094008abf0a1db1956cbb710f37200e64',
  'development/m07/worker-hosting/native-boundary-diagnostic.mjs': '3ac17c10ca838c6f349e1002d179de69b0f16d2e853e95709b2ddccdfff30616',
  'development/m07/worker-hosting/native-chromium-diagnostic.mjs': '661a6ca55c79b91c899301b832d568a3fcdb94f429adca6e4f0d0d63796ee0ec',
  'development/m07/worker-hosting/native-probe-release.mjs': BASE_RELEASE_SHA256,
  'tests/worker/document-fixtures.ts': 'afcadca5a40ff643839683876d112c186005982784c6e161d321033d00e57a0d',
  'tests/worker/review-fit-fixture.ts': 'ae23706908b67b32c7375d9a29a051a524058e804deb8752a905255cb971c2c1',
  'tests/worker/presentation-native-fixture.ts': 'd42d81ec2504b4217bee57dda7e0a15e8acd1a45c34c6193e1669e66b6659d63',
});
export function validateImage(image) {
  need(image === IMAGE);
  return image;
}
export function validateReference(ref) {
  need(exact(ref, ['path', 'sha256']) && typeof ref.path === 'string'
    && /^tracking\/evidence\/[A-Za-z0-9_./-]+\.json$/u.test(ref.path)
    && !ref.path.split('/').some(v => !v || v === '.' || v === '..') && /^[a-f0-9]{64}$/u.test(ref.sha256));
  return ref;
}
export function validateNativeReady(value, image) {
  validateImage(image);
  need(object(value) && value.read_only === true && value.provider_mutations === false && value.team_id === TEAM
    && value.repository?.project_id === PROJECT && value.repository?.public === false
    && value.repository?.id === NATIVE_REPOSITORY && value.repository?.name === 'native'
    && Array.isArray(value.images?.images));
  const matching = value.images.images.filter(row => row.manifest_digest === image.split('@')[1]);
  need(matching.length === 1 && matching[0].repository_id === NATIVE_REPOSITORY && matching[0].kind === 'manifest'
    && matching[0].status === 'ready' && matching[0].architecture === 'amd64' && matching[0].platform === 'linux');
  return { image, registry_native_ready: true, architecture: 'amd64', platform: 'linux', private_repository: true };
}
export function validateContextProof(proof, source) {
  need(object(proof) && proof.result === 'passed_context_source_and_private_value_checks'
    && proof.run === '8b559ebe-1b6c-4741-b371-9498c5855976' && proof.source_sha256 === NATIVE_PROBE_RELEASE.source_sha256
    && proof.file_count === 165 && proof.context_file_count === 170 && proof.private_inputs === 10 && proof.private_value_families === 14
    && proof.scanner_sha256 === 'def5be5cb94690b387dcaced95cc06f3a1e3bfcd1489b47ed40e963226921546'
    && proof.private_values_or_digests_recorded === false && proof.private_hits === 0 && proof.private_input_stable === true
    && proof.source_and_context_exact === true && proof.generated_dockerfiles_exact === true
    && proof.Docker_or_build_called === false && proof.registry_or_provider_called === false && proof.worker_deployed === false);
  need(exact(source, ['source_sha256', 'files']) && source.source_sha256 === NATIVE_PROBE_RELEASE.source_sha256
    && Array.isArray(source.files) && source.files.length === 165 && same(source.files, proof.files)
    && sha(JSON.stringify(source.files)) === NATIVE_PROBE_RELEASE.source_sha256);
  let previous = '';
  for (const row of source.files) {
    need(exact(row, ['path', 'bytes', 'sha256']) && typeof row.path === 'string'
      && /^(?:package(?:-lock)?\.json|(?:apps|packages|contracts)\/[A-Za-z0-9_./-]+)$/u.test(row.path)
      && !row.path.split('/').some(v => !v || v === '.' || v === '..') && row.path > previous
      && Number.isSafeInteger(row.bytes) && row.bytes > 0 && row.bytes <= 16 * 1024 ** 2 && /^[a-f0-9]{64}$/u.test(row.sha256));
    previous = row.path;
  }
  const guards = {
    'apps/worker/src/native-identity.mjs': NATIVE_PROBE_RELEASE.native_identity_sha256,
    'apps/worker/src/native-task-limits.mjs': NATIVE_PROBE_RELEASE.native_task_limits_sha256,
    'apps/worker/src/native-sandbox-launch.mjs': NATIVE_PROBE_RELEASE.native_launcher_sha256,
    'apps/worker/src/native-source-seal.ts': NATIVE_PROBE_RELEASE.seal_validator_sha256,
    ...NATIVE_PROBE_RELEASE.runtime_contract_sha256,
  };
  for (const [relative, digest] of Object.entries(guards)) need(source.files.filter(row => row.path === relative && row.sha256 === digest).length === 1);
  return { source_sha256: source.source_sha256, file_count: 165, native_guard_and_contract_pins: 8, context_proof: NATIVE_PROBE_RELEASE.context_proof };
}
export function replaceOnce(source, before, after) {
  need(source.split(before).length === 2);
  return source.replace(before, () => after);
}

/** Finite pure transformation. Changes list permits exact inverse proof. */
export function compileSource(base, root, image, releaseSha, compilerSha, readyReference) {
  need(sha(base) === BASE_OPERATOR_SHA256 && root === MAIN);
  validateImage(image); validateReference(readyReference); need(same(readyReference,READY_REFERENCE));
  need(releaseSha === RELEASE_DATA_SHA256 && /^[a-f0-9]{64}$/u.test(compilerSha));
  let source = base.toString('utf8'); const changes = [];
  function once(before, after, label) {
    source = replaceOnce(source, before, after);
    changes.push({ label, before, after, before_sha256: sha(before), after_sha256: sha(after) });
  }
  const releaseRelative = path.relative(MAIN,path.join(ROOT,PURPOSE,'native-probe-release.mjs')).replaceAll('\\','/');
  const evidenceRelative = path.relative(MAIN,path.join(ROOT,'tracking/evidence/m07/completion-native')).replaceAll('\\','/');
  for (const relative of [
    '../development/m07/worker-hosting/native-init-diagnostic.mjs',
    '../development/m07/worker-hosting/native-boundary-diagnostic.mjs',
    '../development/m07/worker-hosting/native-chromium-diagnostic.mjs',
    '../tests/worker/presentation-native-fixture.ts', '../tests/worker/document-fixtures.ts',
  ]) once(`'${relative}'`, JSON.stringify(pathToFileURL(path.resolve(root, 'tools', relative)).href), 'relocate:' + relative);
  once("'../development/m07/worker-hosting/native-probe-release.mjs'", JSON.stringify(pathToFileURL(path.join(root, releaseRelative)).href), 'new-release-import');
  once("const ROOT = path.resolve(import.meta.dirname, '..');", `const ROOT = ${JSON.stringify(root)};`, 'fixed-reviewed-root');
  once(`const RELEASE_SOURCE_SHA = '${BASE_RELEASE_SHA256}';`, `const RELEASE_SOURCE_SHA = '${releaseSha}';`, 'new-release-pin');
  once("'development/m07/worker-hosting/native-probe-release.mjs'", JSON.stringify(releaseRelative), 'new-release-read');
  once("'tracking/evidence/m07/worker-hosting'", JSON.stringify(evidenceRelative), 'new-receipt-directory');
  const planSeam = 'const plan = probePlan(process.argv[2]); const image = validateProbeImage(process.argv[3]);';
  const admission = { base_operator_sha256: BASE_OPERATOR_SHA256, release_sha256: releaseSha, compiler_sha256: compilerSha,
    mode: 'smoke', image, source_sha256: NATIVE_PROBE_RELEASE.source_sha256,
    context_proof: NATIVE_PROBE_RELEASE.context_proof, native_ready: readyReference };
  once(planSeam, `${planSeam}\n  if (!${PREPARATION_ENABLED} || plan.mode !== 'smoke' || image !== ${JSON.stringify(image)}) fail('PROBE_PLAN_MISMATCH');\n  report.completion_native_admission = ${JSON.stringify(admission)};`, 'disabled-exact-image-smoke-admission');
  const claimSeam = 'await lock.close(); locked = true;';
  const claimName = 'completion-native46de-' + image.split(':').at(-1) + '.claim.json';
  once(claimSeam, `${claimSeam}\n    const claimPath = path.join(ROOT, '.local/m07-pilot', ${JSON.stringify(claimName)});\n    await writeFile(claimPath, JSON.stringify({ schema_version: '1.0', purpose: 'completion-native46de-image-smoke', run_id: run, project_id: PROJECT, source_sha256: SOURCE, image, context_proof: ${JSON.stringify(NATIVE_PROBE_RELEASE.context_proof)}, native_ready: ${JSON.stringify(readyReference)}, automatic_retry: false }), { flag: 'wx', mode: 0o600 });\n    report.permanent_completion_native_claim_created = true;`, 'new-image-specific-permanent-claim');
  return { source: Buffer.from(source, 'utf8'), changes };
}

async function regular(file, maximum = 1024 * 1024) {
  const info = await lstat(file);
  need(info.isFile() && !info.isSymbolicLink() && info.nlink === 1 && info.size <= maximum
    && path.resolve(await realpath(file)).toLowerCase() === file.toLowerCase());
  return readFile(file);
}
export async function prepareNativeProbe(argv, ports = { regular, mkdir, realpath, writeFile }) {
  // Before input/private paths, source I/O or preparation output. Root arms this
  // reviewed new purpose; no inherited operator or one-time claim is reused.
  need(PREPARATION_ENABLED && argv.length === 1 && process.platform === 'win32' && /^v24\./u.test(process.version));
  const input = JSON.parse((await ports.regular(path.resolve(argv[0]), 16384)).toString('utf8'));
  need(exact(input, ['image', 'native_ready']));
  const image = validateImage(input.image); validateReference(input.native_ready);
  need(same(input.native_ready,READY_REFERENCE));
  const readyBytes = await ports.regular(path.join(ROOT, input.native_ready.path), 4 * 1024 ** 2);
  need(sha(readyBytes) === input.native_ready.sha256); validateNativeReady(JSON.parse(readyBytes), image);
  const [base, release, self, proofBytes, sourceBytes] = await Promise.all([
    ports.regular(path.join(MAIN, 'tools/probe-hosted-native.mjs')),
    ports.regular(path.join(ROOT, PURPOSE, 'native-probe-release.mjs')),
    ports.regular(import.meta.filename), ports.regular(path.join(ROOT, NATIVE_PROBE_RELEASE.context_proof.path)),
    ports.regular(path.join(MAIN, NATIVE_PROBE_RELEASE.context_relative, 'apps/worker/native-source.json')),
  ]);
  need(sha(release) === RELEASE_DATA_SHA256 && sha(proofBytes) === NATIVE_PROBE_RELEASE.context_proof.sha256);
  const source = JSON.parse(sourceBytes),proof=JSON.parse(proofBytes); validateContextProof(proof, source);
  need(sha(sourceBytes)===proof.source_seal_sha256
    && sha(await ports.regular(path.join(ROOT,PURPOSE,'context-audit.mjs')))===proof.audit_source_sha256
    && sha(await ports.regular(path.join(MAIN,NATIVE_PROBE_RELEASE.context_relative,'apps/worker/native-sandbox-manifest.json'),4096))===proof.manifest_sha256);
  const publicPins = {};
  for (const [relative,digest] of Object.entries({...PUBLIC_HELPER_PINS,'tools/probe-hosted-native.mjs':BASE_OPERATOR_SHA256})) {
    const file=path.join(MAIN,relative);need(sha(await ports.regular(file))===digest);publicPins[file]=digest;
  }
  publicPins[path.join(ROOT,NATIVE_PROBE_RELEASE.context_proof.path)]=NATIVE_PROBE_RELEASE.context_proof.sha256;
  publicPins[path.join(ROOT,input.native_ready.path)]=input.native_ready.sha256;
  for (const row of source.files) {
    const bytes = await ports.regular(path.join(MAIN, NATIVE_PROBE_RELEASE.context_relative, row.path), 16 * 1024 ** 2);
    const current = await ports.regular(path.join(MAIN,row.path),16*1024**2);
    need(bytes.length === row.bytes && sha(bytes) === row.sha256 && current.length === row.bytes && sha(current) === row.sha256);
  }
  for (const name of ['compile-native-probe.mjs', 'native-probe-release.mjs', 'admit-native-probe.mjs', 'native-probe.test.mjs', 'context-audit.mjs', 'inspect.mjs', 'input.json', 'README.md']) {
    const file=path.join(ROOT,PURPOSE,name);publicPins[file] = sha(await ports.regular(file));
  }
  const compiled = compileSource(base, MAIN, image, sha(release), sha(self), input.native_ready);
  const directory = path.join(MAIN, '.local/m07-completion-native', randomUUID());
  await ports.mkdir(directory, { recursive: true });
  need(path.resolve(await ports.realpath(directory)).toLowerCase() === directory.toLowerCase());
  const operator = path.join(directory, 'probe-hosted-native46de.mjs');
  const plan = { schema_version: '1.0', prepared_at: new Date().toISOString(), provider_called: false, cloud_execution_performed: false,
    preparation_enabled: PREPARATION_ENABLED, image, mode: 'smoke', source_sha256: NATIVE_PROBE_RELEASE.source_sha256,
    file_count: 165, context_relative: NATIVE_PROBE_RELEASE.context_relative, context_proof: NATIVE_PROBE_RELEASE.context_proof,
    native_ready: input.native_ready, base_operator_sha256: BASE_OPERATOR_SHA256, release_sha256: sha(release), compiler_sha256: sha(self),
    generated_operator_sha256: sha(compiled.source), generated_operator_relative: path.relative(MAIN, operator).replaceAll('\\', '/'),
    runtime_root:MAIN,source_and_evidence_root:ROOT,
    public_source_pins: publicPins, context_source_files: source.files,
    transformations: compiled.changes.map(({ label, before_sha256, after_sha256 }) => ({ label, before_sha256, after_sha256 })),
    expected_maximum_named_resources: 10, expected_native_tasks: 9, shared_lock_relative: '.local/m07-pilot/native-probe.lock.json',
    permanent_once_claim_relative: '.local/m07-pilot/completion-native46de-' + image.split(':').at(-1) + '.claim.json',
    sdk_version: '3.9.1', zod_version: '4.6.7', cli_version: '65.8.0', fixture_kind: 'public_synthetic_only',
    actual_hosted_job_or_specs_AI_app_acceptance: false };
  await ports.writeFile(operator, compiled.source, { flag: 'wx' });
  await ports.writeFile(path.join(directory, 'execution-plan.json'), JSON.stringify(plan, null, 2) + '\n', { flag: 'wx' });
  return plan;
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) prepareNativeProbe(process.argv.slice(2)).then(value => {
  process.stdout.write(JSON.stringify(value) + '\n');
}).catch(() => { process.stdout.write('COMPLETION_NATIVE_COMPILATION_UNCONFIRMED\n'); process.exitCode = 1; });
