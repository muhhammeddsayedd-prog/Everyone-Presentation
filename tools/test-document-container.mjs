/** Owned local parser proof. No DB, provider configuration, mounts or hosted worker. */
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { clearTimeout, setTimeout } from 'node:timers';
import { pathToFileURL } from 'node:url';
import { docx, pdf } from '../tests/worker/document-fixtures.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const BASE = 'node@sha256:6f7b03f7c2c8e2e784dcf9295400527b9b1270fd37b7e9a7285cf83b6951452d';
const LOCAL_DOCKER = process.platform === 'win32'
  ? { context: 'desktop-linux', host: 'npipe:////./pipe/dockerDesktopLinuxEngine', endpoint: 'desktop_linux_named_pipe' }
  : { context: 'default', host: 'unix:///var/run/docker.sock', endpoint: 'local_unix_socket' };
const OWNER = 'com.everyone.presentation.owner'; const PURPOSE = 'com.everyone.presentation.purpose';
const RUN = 'com.everyone.presentation.run'; const SOURCE = 'com.everyone.presentation.source';
const FILES = ['.dockerignore', 'package.json', 'package-lock.json', 'apps/web/package.json', 'apps/worker/package.json',
  'packages/domain/package.json', 'packages/jobs/package.json', 'packages/integrations/package.json', 'packages/central/package.json',
  'apps/worker/Dockerfile.prepare', ...['prepare-process.mjs', 'prepare.ts', 'pasted-text.ts', 'types.ts', 'docx.ts', 'pdf.ts'].map(file => `apps/worker/src/${file}`)].sort();
const sha = value => createHash('sha256').update(value).digest('hex');
function fail(code) { const error = new Error('Local document container proof failed.'); error.code = code; throw error; }
async function docker(args, { input, timeout = 60_000, maximum = 4 * 1024 * 1024, maximumDiagnostics = maximum, contextMetadata = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', [...(contextMetadata ? [] : ['--host', LOCAL_DOCKER.host]), ...args], { cwd: ROOT, shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    const output = []; const diagnostic = []; let bytes = 0; let diagnostics = 0; let problem;
    const timer = setTimeout(() => { problem = 'DOCKER_COMMAND_TIMEOUT'; child.kill(); }, timeout);
    child.on('error', () => { problem = 'DOCKER_COMMAND_UNAVAILABLE'; });
    child.stdin.on('error', () => {});
    child.stdout.on('data', chunk => { bytes += chunk.length; if (bytes > maximum) { problem = 'DOCKER_OUTPUT_LIMIT'; child.kill(); } else output.push(chunk); });
    child.stderr.on('data', chunk => { diagnostics += chunk.length; if (diagnostics > maximumDiagnostics) { problem = 'DOCKER_OUTPUT_LIMIT'; child.kill(); } else diagnostic.push(chunk); });
    child.on('close', code => {
      clearTimeout(timer);
      if (problem) { try { fail(problem); } catch (error) { reject(error); } }
      else resolve({ code, stdout: Buffer.concat(output), stderr: Buffer.concat(diagnostic), diagnostic_bytes: diagnostics });
    });
    child.stdin.end(input);
  });
}
async function localDockerPreflight() {
  if (!['win32', 'linux'].includes(process.platform)
    || (process.env.DOCKER_HOST && process.env.DOCKER_HOST !== LOCAL_DOCKER.host)
    || (process.env.DOCKER_CONTEXT && process.env.DOCKER_CONTEXT !== LOCAL_DOCKER.context)
    || ['DOCKER_TLS', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH'].some(name => Boolean(process.env[name]))) fail('LOCAL_DOCKER_TARGET_REJECTED');
  // These two CLI metadata reads do not contact the configured daemon. Every
  // daemon operation is separately pinned to the fixed local pipe/socket.
  const current = await docker(['context', 'show'], { contextMetadata: true });
  if (current.code !== 0 || current.stdout.toString('utf8').trim() !== LOCAL_DOCKER.context) fail('LOCAL_DOCKER_TARGET_REJECTED');
  const inspected = await docker(['context', 'inspect', LOCAL_DOCKER.context], { contextMetadata: true });
  if (inspected.code !== 0) fail('LOCAL_DOCKER_TARGET_REJECTED');
  const contexts = JSON.parse(inspected.stdout.toString('utf8'));
  if (contexts.length !== 1 || contexts[0].Name !== LOCAL_DOCKER.context || contexts[0].Endpoints?.docker?.Host !== LOCAL_DOCKER.host) fail('LOCAL_DOCKER_TARGET_REJECTED');
  return { context: LOCAL_DOCKER.context, endpoint: LOCAL_DOCKER.endpoint, endpoint_pinned_for_all_daemon_operations: true };
}
async function inspect(kind, id) {
  const result = await docker([kind, 'inspect', id]);
  if (result.code !== 0) fail('DOCKER_INSPECTION_FAILED');
  const data = JSON.parse(result.stdout.toString('utf8')); assert.equal(data.length, 1); return data[0];
}
async function sources() {
  const files = [];
  for (const name of FILES) {
    const full = path.join(ROOT, name); const info = await lstat(full);
    assert(info.isFile() && !info.isSymbolicLink() && info.size <= 8 * 1024 * 1024);
    assert.equal((await realpath(full)).toLowerCase(), full.toLowerCase());
    const bytes = await readFile(full); files.push({ name, bytes, sha256: sha(bytes) });
  }
  return files;
}
/** Exact regular-file tar; the checkout is never sent as Docker build context. */
function archive(files) {
  const parts = [];
  const octal = (header, offset, length, value) => header.write(value.toString(8).padStart(length - 1, '0') + '\0', offset, length, 'ascii');
  for (const { name, bytes } of files) {
    assert(name.length < 100 && !name.includes('..') && !name.startsWith('/'));
    const header = Buffer.alloc(512); header.write(name, 0, 100, 'utf8');
    octal(header, 100, 8, 0o644); octal(header, 108, 8, 0); octal(header, 116, 8, 0);
    octal(header, 124, 12, bytes.length); octal(header, 136, 12, 0); header.fill(32, 148, 156); header[156] = 48;
    header.write('ustar\0', 257, 6, 'ascii'); header.write('00', 263, 2, 'ascii');
    const sum = header.reduce((total, value) => total + value, 0);
    header.write(sum.toString(8).padStart(6, '0') + '\0 ', 148, 8, 'ascii');
    parts.push(header, bytes, Buffer.alloc((512 - bytes.length % 512) % 512));
  }
  const result = Buffer.concat([...parts, Buffer.alloc(1024)]); assert(result.length <= 12 * 1024 * 1024); return result;
}
function runtimeFacts(container) {
  const config = container.HostConfig;
  assert.equal(container.Config.User, '1000:1000'); assert.equal(config.ReadonlyRootfs, true);
  assert.equal(config.NetworkMode, 'none'); assert.deepEqual(config.CapDrop, ['ALL']);
  assert(config.SecurityOpt.some(value => value === 'no-new-privileges' || value === 'no-new-privileges:true'));
  assert.equal(config.Memory, 512 * 1024 * 1024); assert.equal(config.MemorySwap, config.Memory);
  assert.equal(config.NanoCpus, 1_000_000_000); assert.equal(config.PidsLimit, 64);
  assert.equal(config.LogConfig.Type, 'none'); assert(container.Mounts.every(mount => mount.Type === 'tmpfs' && mount.Destination === '/tmp'));
  const temporary = config.Tmpfs?.['/tmp']; assert(typeof temporary === 'string');
  for (const value of ['nosuid', 'nodev', 'noexec', 'size=16777216']) assert(temporary.split(',').includes(value));
  assert.equal(Object.keys(config.Tmpfs).length, 1);
  assert(container.Config.Entrypoint.includes('--permission') && container.Config.Entrypoint.includes('--allow-addons'));
  return { user: container.Config.User, readonly_rootfs: true, network: 'none', cap_drop: ['ALL'], no_new_privileges: true,
    memory_bytes: config.Memory, memory_swap_bytes: config.MemorySwap, nano_cpus: config.NanoCpus, pids: config.PidsLimit,
    tmpfs: { path: '/tmp', bytes: 16777216, noexec: true, nosuid: true, nodev: true }, log_driver: 'none', host_bind_or_volume_mounts: 0 };
}
async function main() {
  if (process.argv.length !== 2) fail('NO_ARGUMENT_OVERRIDES');
  const runId = randomUUID(); const summary = { schema_version: '1.0', run_id: runId, observed_at: new Date().toISOString(), result: 'failed',
    scope: 'Owned local one-shot Linux document parser container only', base_image: BASE, tests: [], cleanup: [],
    provider_called: false, database_called: false, private_configuration_read: false, hosted_deployment: false, full_worker_orchestration: false,
    fixture_text_or_parser_outputs_recorded: false };
  const owned = new Set(); let imageId; let sourceDigest;
  async function ownedContainer(id) {
    const container = await inspect('container', id);
    assert.equal(container.Id, id); assert.equal(container.Image, imageId);
    assert.equal(container.Config.Labels[OWNER], 'eps-document-parser'); assert.equal(container.Config.Labels[PURPOSE], 'local-parser-proof');
    assert.equal(container.Config.Labels[RUN], runId); assert.equal(container.Config.Labels[SOURCE], sourceDigest);
    assert(owned.has(id)); return container;
  }
  async function removeOwned(id, reason) {
    await ownedContainer(id);
    const result = await docker(['container', 'rm', '--force', id]);
    if (result.code !== 0) fail('OWNED_CONTAINER_CLEANUP_FAILED');
    owned.delete(id); summary.cleanup.push({ container_id: id, reason, ownership_verified_before_removal: true });
  }
  try {
    summary.local_docker = await localDockerPreflight();
    const files = await sources(); sourceDigest = sha(Buffer.concat(files.flatMap(file => [Buffer.from(file.name + '\0'), file.bytes])));
    summary.source_sha256 = sourceDigest; summary.source_files = files.map(({ name, sha256 }) => ({ path: name, sha256 }));
    summary.harness_sha256 = sha(await readFile(path.join(ROOT, 'tools/test-document-container.mjs')));
    summary.fixture_generator_sha256 = sha(await readFile(path.join(ROOT, 'tests/worker/document-fixtures.ts')));
    const base = await inspect('image', BASE); assert(base.RepoDigests.includes(BASE)); assert.equal(base.Os, 'linux'); assert.equal(base.Architecture, 'amd64');
    summary.base_image_id = base.Id;
    const tag = `eps-document-prepare:local-${sourceDigest.slice(0, 16)}-${runId}`;
    process.stdout.write('Building source-only local parser image.\n');
    const built = await docker(['build', '--file', 'apps/worker/Dockerfile.prepare', '--tag', tag,
      '--label', `${OWNER}=eps-document-parser`, '--label', `${PURPOSE}=local-parser-proof`, '--label', `${SOURCE}=${sourceDigest}`, '--label', `${RUN}=${runId}`, '-'], { input: archive(files), timeout: 300_000 });
    summary.build_exit_code = built.code; summary.build_diagnostic_bytes = built.diagnostic_bytes;
    if (built.code !== 0) fail('PARSER_IMAGE_BUILD_FAILED');
    const image = await inspect('image', tag); imageId = image.Id; assert.equal(image.Config.Labels[SOURCE], sourceDigest);
    assert.equal(image.Config.Labels[OWNER], 'eps-document-parser'); assert.equal(image.Config.Labels[PURPOSE], 'local-parser-proof'); assert.equal(image.Config.Labels[RUN], runId);
    assert.equal(image.Config.User, '1000:1000'); summary.image_id = imageId; summary.image_tag = tag;
    const raw = '\ufeffRole: Waiter\r\n\r\nنحتاج ثلاثة أشخاص';
    const cases = [
      { name: 'utf8_asset', bytes: Buffer.from(raw), mime: 'text/plain', kind: 'asset', source: 'synthetic-document', paragraphs: 2, fragments: ['نحتاج ثلاثة أشخاص'] },
      { name: 'pasted_bom_arabic', bytes: Buffer.from(raw), mime: 'text/plain', kind: 'pasted_text', source: null, paragraphs: 2, fragments: ['\ufeffRole: Waiter', 'نحتاج ثلاثة أشخاص'] },
      { name: 'genuine_pdf', bytes: pdf(['Role: Waiter', 'Three people, two scenes.']), mime: 'application/pdf', kind: 'asset', source: 'synthetic-document', paragraphs: 2, pages: [1, 2], fragments: ['Three people'] },
      { name: 'genuine_docx', bytes: docx(['Role: Waiter', 'مطلوب ثلاثة أشخاص']), mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', kind: 'asset', source: 'synthetic-document', paragraphs: 2, fragments: ['مطلوب ثلاثة أشخاص'] },
      { name: 'invalid_pdf', bytes: Buffer.from('%PDF-1.7\nSynthetic invalid PDF\n'), mime: 'application/pdf', kind: 'asset', source: 'synthetic-document', error: 'SOURCE_UNREADABLE' },
      { name: 'unsupported_legacy', bytes: Buffer.from('Synthetic legacy document'), mime: 'application/msword', kind: 'asset', source: 'synthetic-document', error: 'DOCUMENT_CONVERSION_REQUIRED' },
      { name: 'deadline_termination', bytes: pdf(['Synthetic deadline test']), mime: 'application/pdf', kind: 'asset', source: 'synthetic-document', timeout: 1 },
    ];
    for (const test of cases) {
      const result = { name: test.name, source_sha256: sha(test.bytes), status: 'failed' }; summary.tests.push(result);
      const created = await docker(['create', '--interactive', '--name', `eps-document-${runId.slice(0, 8)}-${test.name}`,
        '--label', `${OWNER}=eps-document-parser`, '--label', `${PURPOSE}=local-parser-proof`, '--label', `${RUN}=${runId}`, '--label', `${SOURCE}=${sourceDigest}`,
        '--read-only', '--network', 'none', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--memory', '512m', '--memory-swap', '512m',
        '--cpus', '1', '--pids-limit', '64', '--tmpfs', '/tmp:rw,nosuid,nodev,noexec,size=16777216,mode=1777', '--log-driver', 'none', imageId]);
      if (created.code !== 0) fail('PARSER_CONTAINER_CREATE_FAILED');
      const id = created.stdout.toString('utf8').trim(); assert(/^[a-f0-9]{64}$/u.test(id)); owned.add(id);
      result.container_id = id; result.runtime = runtimeFacts(await ownedContainer(id));
      const payload = JSON.stringify({ sourceKind: test.kind, sourceAssetId: test.source, mimeType: test.mime, bytes: Buffer.from(test.bytes).toString('base64') });
      let exceeded = false; let stopping;
      const timer = setTimeout(() => { exceeded = true; stopping = removeOwned(id, 'deadline'); stopping.catch(() => undefined); }, test.timeout ?? 30_000);
      let output;
      try { output = await docker(['start', '--attach', '--interactive', id], { input: payload, timeout: 40_000, maximum: 24 * 1024 * 1024, maximumDiagnostics: 64 * 1024 }); }
      finally { clearTimeout(timer); if (stopping) await stopping; }
      if (test.timeout) { assert(exceeded && !owned.has(id)); result.status = 'passed'; result.deadline_ms = 1; result.scope = 'Supervisor ownership-checked termination mechanics, not a 30s adversarial parser workload'; continue; }
      assert.equal(exceeded, false); assert.equal(output.code, 0);
      const container = await ownedContainer(id); assert.equal(container.State.Status, 'exited'); assert.equal(container.State.OOMKilled, false);
      const parsed = JSON.parse(output.stdout.toString('utf8'));
      result.parser_ok = parsed.ok === true;
      if (parsed.ok === false && /^[A-Z_]{1,80}$/u.test(parsed.code ?? '')) result.parser_error_code = parsed.code;
      if (test.error) { assert.equal(parsed.ok, false); assert.equal(parsed.code, test.error); result.error_code = parsed.code; }
      else {
        if (parsed.ok !== true) fail('PARSER_REJECTED_SUPPORTED_FIXTURE'); const prepared = parsed.result;
        result.observed_paragraphs = prepared.paragraphs.length;
        assert.equal(prepared.sourceAssetId, test.source); assert.equal(prepared.sourceSha256, sha(test.bytes));
        assert.equal(prepared.paragraphs.length, test.paragraphs); assert(!prepared.text.includes('\r'));
        for (const fragment of test.fragments) assert(prepared.text.includes(fragment));
        for (const [index, paragraph] of prepared.paragraphs.entries()) { assert.equal(paragraph.index, index); assert.equal(prepared.text.slice(paragraph.start, paragraph.end), paragraph.text); }
        if (test.pages) assert.deepEqual(prepared.paragraphs.map(paragraph => paragraph.page), test.pages);
        result.paragraphs = prepared.paragraphs.length; result.prepared_text_sha256 = sha(prepared.text); result.extraction_method = prepared.extractionMethod;
      }
      result.status = 'passed'; await removeOwned(id, 'finished');
    }
    assert.equal(sourceDigest, sha(Buffer.concat((await sources()).flatMap(file => [Buffer.from(file.name + '\0'), file.bytes]))));
    await localDockerPreflight();
    summary.result = 'passed';
  } catch (error) { summary.failure_code = /^[A-Z_]+$/u.test(error?.code ?? '') ? error.code : 'CONTAINER_ACCEPTANCE_FAILED'; }
  finally {
    for (const id of [...owned]) { try { await removeOwned(id, 'failure_cleanup'); } catch { summary.result = 'failed'; summary.cleanup.push({ container_id: id, ownership_or_cleanup_failed: true, preserved_for_reconciliation: true }); } }
    summary.finished_at = new Date().toISOString(); summary.unrelated_containers_or_images_removed = false; summary.image_retained = Boolean(imageId);
    const directory = path.join(ROOT, 'tracking/evidence/m02/document-container'); await mkdir(directory, { recursive: true });
    const file = path.join(directory, `${summary.finished_at.replace(/[:.]/gu, '-')}-${runId.slice(0, 8)}.json`);
    await writeFile(file, JSON.stringify(summary, null, 2) + '\n', { flag: 'wx' });
    process.stdout.write(`Local document container: ${summary.result}\nReceipt: ${path.relative(ROOT, file).replaceAll('\\', '/')}\n`);
    if (summary.result !== 'passed') process.exitCode = 1;
  }
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch(() => { process.stderr.write('Local parser proof could not start; details suppressed.\n'); process.exitCode = 1; });
}
