/** Fixed-artifact upload through a checksum-pinned vendor CLI; no rebuild. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { lstat, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
const ROOT = path.resolve(import.meta.dirname, '../../..');
const TOOL = path.join(ROOT, '.local/m07-pilot/tooling/regctl-v0.11.7.exe');
const TOOL_SHA = '70f195ff4923082340738c796880864f66a296e6c5d3296bf743310653ad761f';
const CREDENTIAL_HELPER = 'C:/Program Files/Docker/Docker/resources/bin/docker-credential-desktop.exe';
const CREDENTIAL_HELPER_SHA = '2856e226b29ae2a9c67dd2419adbd527c03c34a84fc82454856b61f555c2b3b5';
const DIGEST = 'sha256:5a41cf3c8801b2891d378b3f7caef44c3fb7af184ceb89e7f4e44c3d865ac697';
const TARGET = 'vcr.vercel.com/muhammed-abdelrahman/everyone-presentation-worker-pilot/native:pilot-2e551bb2';
const DIRECTORY = path.join(ROOT, '.local/m07-pilot');
const OCI = path.join(DIRECTORY, 'native-upload-oci-2e551bb2');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const originalConfig = '{"hosts":{},"incDockerCred":true,"incDockerCert":false}\n';
const configBytes = '{"hosts":{"vcr.vercel.com":{"blobChunk":16777216,"blobMax":16777216}},"incDockerCred":true,"incDockerCert":false}\n';
const report = { schema_version: '1.0', observed_at: new Date().toISOString(), result: 'unconfirmed',
  tool: 'regctl', tool_version: '0.11.7', tool_sha256: TOOL_SHA, target: TARGET, expected_digest: DIGEST,
  copy_timeout_ms: 1800000,
  configured_chunk_bytes: 16777216, monolithic_threshold_bytes: 16777216,
  server_chunk_minimum_can_override_configuration: true,
  copy_invocations: 0, digest_read_invocations: 0, source_layers_recompressed: false,
  private_media_or_worker_credentials_used: false, credentials_in_arguments_or_report: false,
  registry_credentials_source: 'Existing Docker Desktop credential store selected by the isolated DOCKER_CONFIG',
  global_docker_config_file_modified: false, credential_store_unchanged_claimed: false, raw_diagnostics_persisted: false };
try {
  assert.equal(process.argv.length, 2); assert.equal(process.platform, 'win32');
  for (const file of [TOOL, OCI, path.join(DIRECTORY, 'docker-config')]) {
    assert.equal((await realpath(file)).toLowerCase(), file.toLowerCase()); assert(!(await lstat(file)).isSymbolicLink());
  }
  const binary = await readFile(TOOL); assert.equal(binary.length, 13152768); assert.equal(sha(binary), TOOL_SHA);
  assert.equal((await realpath(CREDENTIAL_HELPER)).replaceAll('\\', '/').toLowerCase(), CREDENTIAL_HELPER.toLowerCase());
  assert.equal(sha(await readFile(CREDENTIAL_HELPER)), CREDENTIAL_HELPER_SHA);
  const proof = JSON.parse(await readFile(path.join(DIRECTORY, 'native-upload-oci-2e551bb2.proof.json'), 'utf8'));
  assert(proof.all_blob_sha256_and_descriptor_sizes_verified && proof.index_digest === DIGEST && proof.blobs_verified === 22 && proof.layers_recompressed === false);
  const index = JSON.parse(await readFile(path.join(OCI, 'index.json'), 'utf8')); assert.equal(index.manifests[0].digest, DIGEST);
  const manifest = await readFile(path.join(OCI, 'blobs/sha256', DIGEST.slice(7))); assert.equal('sha256:' + sha(manifest), DIGEST);
  const config = path.join(DIRECTORY, 'regctl-config.json');
  try { await writeFile(config, configBytes, { flag: 'wx' }); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const info = await lstat(config); assert(info.isFile() && !info.isSymbolicLink());
    assert.equal((await realpath(config)).toLowerCase(), config.toLowerCase());
    const current = await readFile(config, 'utf8');
    assert(current === configBytes || current === originalConfig);
    if (current === originalConfig) await writeFile(config, configBytes);
  }
  // Docker Desktop selected its credential store at login. regctl invokes the
  // installed helper internally; credentials never enter this controller.
  const environment = { PATH: path.dirname(CREDENTIAL_HELPER), REGCTL_CONFIG: config, DOCKER_CONFIG: path.join(DIRECTORY, 'docker-config') };
  for (const key of ['SystemRoot', 'WINDIR', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'TEMP', 'TMP']) if (process.env[key]) environment[key] = process.env[key];
  function call(args, timeout) {
    return execFileSync(TOOL, args, { cwd: DIRECTORY, env: environment, shell: false, windowsHide: true,
      timeout, maxBuffer: 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }).toString('utf8').trim();
  }
  report.copy_invocations++;
  try { call(['image', 'copy', 'ocidir://native-upload-oci-2e551bb2@' + DIGEST, TARGET], report.copy_timeout_ms); report.copy_completed = true; }
  catch { report.copy_completed = false; }
  report.digest_read_invocations++;
  const observed = call(['image', 'digest', TARGET], 30000);
  assert(/^sha256:[a-f0-9]{64}$/u.test(observed)); report.observed_digest = observed;
  assert.equal(observed, DIGEST); report.result = 'digest_matched';
} catch { report.code = 'NATIVE_OCI_TRANSFER_UNCONFIRMED'; process.exitCode = 1; }
report.finished_at = new Date().toISOString();
const output = path.join(ROOT, 'tracking/evidence/m07/worker-hosting', `${report.finished_at.replaceAll(':', '-')}-${randomUUID().slice(0, 8)}-oci-transfer.json`);
await writeFile(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
process.stdout.write(JSON.stringify({ receipt: path.relative(ROOT, output), result: report.result, copy_completed: report.copy_completed ?? false }) + '\n');
