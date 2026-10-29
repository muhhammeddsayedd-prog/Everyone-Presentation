/** Fixed source/index/package scanner. Importing performs no IO. Private values
 * and derived encodings stay in this process's memory and are never reported. */
import { Buffer } from 'node:buffer';
import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, mkdir, open, realpath, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { parseEnv, TextDecoder } from 'node:util';
import { pathToFileURL } from 'node:url';
import { crc32 } from 'node:zlib';
import { clearTimeout, setTimeout } from 'node:timers';
import yauzl from 'yauzl';

const ROOT = path.resolve(import.meta.dirname, '..');
const PREFIX = 'Everyone-Presentation-Studio/';
const ZIP = path.join(ROOT, 'dist/Everyone-Presentation-Studio-Source.zip');
const PYTHON = path.join(ROOT, '.venv-skills', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
const PHASES = new Set(['source_inventory', 'private_configuration', 'source_bytes', 'index_listing', 'index_blobs', 'archive_structure', 'source_stability', 'private_stability']);
// The retained source/evidence inventory is 704,051,170 bytes. Aggregate growth
// does not increase a single file/read batch or the compressed archive buffer.
export const privateScanLimits = Object.freeze({ files: 20_000, entry: 64 * 1024 * 1024, total: 1024 * 1024 * 1024,
  batch: 64 * 1024 * 1024, compressedZip: 128 * 1024 * 1024, manifest: 16 * 1024 * 1024, commandMs: 300_000 });
const LIMITS = privateScanLimits;
const PRIVATE = [
  ['.env.worker.local', 16 * 1024], ['.env.worker-runtime.local', 64 * 1024],
  ['.local/cloud-logo-provision/verifier.json', 512], ['.local/specs-assets-verifier/verifier.json', 512],
  ['.env.job-service.local',4096],['.env.candidate-runtime.local',4096],
  ['.env.support-runtime.local',1024], ['.env.review-runtime.local',4096],
];
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
export class PrivateScanError extends Error {
  constructor(code = 'PRIVATE_SCAN_UNCONFIRMED', phase) { super(code); this.code = code; if (PHASES.has(phase)) this.phase = phase; }
}
const fail = (code = 'PRIVATE_SCAN_UNCONFIRMED') => { throw new PrivateScanError(code); };
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
/** Pure metadata accounting; source, expanded ZIP and unique staged bytes use
 * the same 1GiB bound without ever allocating that aggregate in one Buffer. */
export function accumulateScanBytes(total, size) {
  if (!Number.isSafeInteger(total) || total < 0 || total > LIMITS.total || !Number.isSafeInteger(size) || size < 0
    || size > LIMITS.entry || total + size > LIMITS.total) fail();
  return total + size;
}
export function requireCompressedZipSize(size) {
  if (!Number.isSafeInteger(size) || size < 0 || size > LIMITS.compressedZip) fail();
}
function decode(bytes) { try { return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); } catch { return fail(); } }
function keyJson(bytes, prefix, keyId) {
  try {
    const text = decode(bytes); const value = JSON.parse(text);
    if (!exact(value, [`${prefix}_VERIFICATION_KEY_ID`, `${prefix}_VERIFICATION_KEY_BASE64URL`])
      || value[`${prefix}_VERIFICATION_KEY_ID`] !== keyId || JSON.stringify(value) + '\n' !== text) fail();
    const encoded = value[`${prefix}_VERIFICATION_KEY_BASE64URL`];
    if (typeof encoded !== 'string' || !/^[A-Za-z0-9_-]{43}$/u.test(encoded)) fail();
    const raw = Buffer.from(encoded, 'base64url'); if (raw.length !== 32 || raw.toString('base64url') !== encoded) fail(); return raw;
  } catch { return fail('PRIVATE_SCAN_CONFIGURATION_UNAVAILABLE'); }
}
function envSecrets(bytes, names) {
  try {
    const text = decode(bytes).replace(/^\ufeff/u, ''); const parsed = parseEnv(text);
    return names.map(name => {
      const declarations = text.match(new RegExp(`^[ \\t]*(?:export[ \\t]+)?${name}[ \\t]*=`, 'gmu'));
      const value = parsed[name];
      if (!declarations || declarations.length !== 1 || typeof value !== 'string' || !value || Buffer.byteLength(value) > 16 * 1024 || /[\r\n\0]/u.test(value)) fail();
      return Buffer.from(value, 'utf8');
    });
  } catch { return fail('PRIVATE_SCAN_CONFIGURATION_UNAVAILABLE'); }
}
/** Pure synthetic-test seam. Never serialize or print the returned patterns. */
export function privatePatterns({ worker, runtime, logo, specs,jobService,candidate,support,review }) {
  const [supportHex]=envSecrets(support,['EPS_SUPPORT_VERIFIER_KEY_HEX']);
  if(!/^[a-f0-9]{64}$/u.test(supportHex.toString('utf8')))fail('PRIVATE_SCAN_CONFIGURATION_UNAVAILABLE');
  const secrets = [...envSecrets(worker, ['OPENAI_API_KEY', 'N8N_API_KEY']), ...envSecrets(runtime, ['EPS_SPECS_PG_PASSWORD', 'N8N_DISPATCH_SECRET']),
    keyJson(logo, 'LOGO', 'eps-logo-dev-20261028-v1'), keyJson(specs, 'SPECS', 'eps-specs-dev-20261029-v1'),
    ...envSecrets(jobService,['EPS_JOB_SERVICE_BEARER','EPS_JOB_CLAIM_KEY_HEX']),...envSecrets(candidate,['N8N_CANDIDATE_DISPATCH_SECRET']),...envSecrets(review,['N8N_REVIEW_DISPATCH_SECRET']),supportHex,Buffer.from(supportHex.toString('utf8'),'hex')];
  const patterns = new Map();
  const add = bytes => { if (bytes.length) patterns.set(bytes.toString('hex'), bytes); };
  for (const raw of secrets) {
    const forms = [raw];
    for (const value of [raw.toString('hex'), raw.toString('hex').toUpperCase(), raw.toString('base64'), raw.toString('base64').replace(/=+$/u, ''), raw.toString('base64url')]) {
      forms.push(Buffer.from(value), Buffer.from(value, 'utf16le'));
    }
    const text = raw.toString('utf8'); if (Buffer.from(text).equals(raw)) {
      forms.push(Buffer.from(text, 'utf16le'), Buffer.from(JSON.stringify(text).slice(1, -1)));
    }
    for (const form of forms) {
      add(form);
      for (const encoded of [form.toString('hex'), form.toString('hex').toUpperCase(), form.toString('base64'), form.toString('base64url')]) {
        add(Buffer.from(encoded)); add(Buffer.from(encoded, 'utf16le'));
      }
      // Complete interior groups detect a credential inside a larger encoded
      // JSON/script regardless of its three-byte alignment or suffix padding.
      // This also covers base64 of UTF16, rather than only UTF16 of base64.
      for (const offset of [0, 1, 2]) {
        const encoded = Buffer.concat([Buffer.alloc(offset), form]).toString('base64');
        const fragment = encoded.slice(offset ? 4 : 0, Math.floor((offset + form.length) / 3) * 4);
        if (!fragment) fail('PRIVATE_SCAN_CONFIGURATION_UNAVAILABLE');
        for (const value of [fragment, fragment.replaceAll('+', '-').replaceAll('/', '_')]) {
          add(Buffer.from(value)); add(Buffer.from(value, 'utf16le'));
        }
      }
    }
  }
  return [...patterns.values()];
}
export function containsPrivateValue(bytes, patterns) {
  if (!(bytes instanceof Uint8Array) || !Array.isArray(patterns) || !patterns.length || !patterns.every(pattern => Buffer.isBuffer(pattern) && pattern.length)) fail();
  const input = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return patterns.some(pattern => Buffer.isBuffer(pattern) && pattern.length && input.indexOf(pattern) !== -1);
}
function safeRelative(name) {
  return typeof name === 'string' && name && name.length <= 4096 && !/[\\\0:]/u.test(name) && !name.startsWith('/')
    && name.split('/').every(part => part && part !== '.' && part !== '..');
}
const same = (left, right) => left.dev === right.dev && left.ino === right.ino && left.size === right.size && left.mtimeNs === right.mtimeNs && left.ctimeNs === right.ctimeNs;
export function requirePrivateSnapshot(before, after) {
  if (!Array.isArray(before) || !Array.isArray(after) || before.length !== PRIVATE.length || after.length !== PRIVATE.length
    || before.some((value, index) => !same(value, after[index]))) fail('PRIVATE_SCAN_CONFIGURATION_CHANGED');
}
const samePath = (left, right) => process.platform === 'win32' ? left.toLowerCase() === right.toLowerCase() : left === right;
async function boundedFile(file, maximum, privateFile = false) {
  let handle;
  try {
    const before = await lstat(file, { bigint: true });
    if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1n || before.size < 0n || before.size > BigInt(maximum)
      || !samePath(await realpath(file), file)) fail();
    if (privateFile && process.platform !== 'win32' && (before.uid !== BigInt(process.geteuid()) || (before.mode & 0o077n) !== 0n)) fail();
    handle = await open(file, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const opened = await handle.stat({ bigint: true }); if (!same(before, opened)) fail();
    const bytes = Buffer.alloc(Number(opened.size) + 1); let length = 0;
    while (length < bytes.length) { const next = await handle.read(bytes, length, bytes.length - length, null); if (!next.bytesRead) break; length += next.bytesRead; }
    const after = await handle.stat({ bigint: true }); const current = await lstat(file, { bigint: true });
    if (length !== Number(opened.size) || !same(opened, after) || !same(opened, current) || !samePath(await realpath(file), file)) fail();
    return { bytes: bytes.subarray(0, length), identity: current };
  } catch { return fail(privateFile ? 'PRIVATE_SCAN_CONFIGURATION_UNAVAILABLE' : 'PRIVATE_SCAN_INPUT_UNAVAILABLE'); }
  finally { try { await handle?.close(); } catch { fail(); } }
}
function commandEnvironment() {
  return Object.fromEntries(['PATH', 'Path', 'PATHEXT', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'USERPROFILE', 'HOME'].filter(key => typeof process.env[key] === 'string').map(key => [key, process.env[key]]));
}
async function command(program, args, input, maximum = LIMITS.batch) {
  return new Promise((resolve, reject) => {
    let complete = false; let size = 0; let errorBytes = 0; const chunks = [];
    const child = spawn(program, args, { cwd: ROOT, env: commandEnvironment(), windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe'] });
    const finish = error => { if (complete) return; complete = true; clearTimeout(timer);
      if (error) { chunks.length = 0; child.kill(); reject(new PrivateScanError()); }
      else { const output = Buffer.concat(chunks); chunks.length = 0; resolve(output); }
    };
    const timer = setTimeout(() => finish(true), LIMITS.commandMs);
    child.on('error', () => finish(true)); child.on('close', code => finish(code !== 0));
    child.stdout.on('data', part => { if (complete) return; size += part.length; if (size > maximum) finish(true); else chunks.push(part); });
    // Drain but never retain or publish raw child diagnostics.
    child.stderr.on('data', part => { errorBytes += part.length; if (errorBytes > 1024 * 1024) finish(true); });
    child.stdin.on('error', () => finish(true)); child.stdin.end(input);
  });
}
async function inventoryCommand(program, args, input, maximum) {
  if (program !== PYTHON) fail();
  const interpreter = await boundedFile(PYTHON, 16 * 1024 * 1024);
  const output = await command(program, args, input, maximum);
  if (!same(await lstat(PYTHON, { bigint: true }), interpreter.identity) || !samePath(await realpath(PYTHON), PYTHON)) fail();
  return output;
}
/** Offline command injection is for synthetic tests only. The CLI pins the
 * existing project venv; PATH's Windows Python installer must never run. */
export async function readSourceInventory(runCommand = inventoryCommand) {
  const code = 'import sys,json;sys.path.insert(0,"tools");from package_pack import source_files;print(json.dumps([name for name,_ in source_files()]))';
  const selected = JSON.parse(decode(await runCommand(PYTHON, ['-c', code], undefined, 16 * 1024 * 1024)));
  if (!Array.isArray(selected) || !selected.length || selected.length > LIMITS.files || !selected.every(safeRelative) || new Set(selected).size !== selected.length) fail();
  return selected;
}
function requireObjectIds(objects) {
  if (!Array.isArray(objects) || !objects.length || objects.length > LIMITS.files
    || !objects.every(value => typeof value === 'string' && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(value))
    || new Set(objects).size !== objects.length) fail();
}
/** Metadata-only Git preflight. Missing/nonblob/reordered/duplicate responses
 * cannot become an incomplete clean scan or an unbounded payload request. */
export function inspectGitObjectMetadata(bytes, objects) {
  requireObjectIds(objects);
  if (!Buffer.isBuffer(bytes) || bytes.length > LIMITS.files * 256) fail();
  const lines = bytes.toString('latin1').split('\n');
  if (lines.pop() !== '' || lines.length !== objects.length) fail();
  let total = 0;
  return lines.map((line, index) => {
    const header = line.split(' ');
    if (line.length > 256 || header.length !== 3 || header[0] !== objects[index] || header[1] !== 'blob' || !/^(0|[1-9][0-9]*)$/u.test(header[2])) fail();
    const size = Number(header[2]); total = accumulateScanBytes(total, size);
    return { object: objects[index], bytes: size };
  });
}
function requireBatchPayloadLimit(maximum) {
  if (!Number.isSafeInteger(maximum) || maximum < 1 || maximum > LIMITS.batch) fail();
}
/** Payload bytes stay<=64MiB; exact ASCII headers/trailing newlines are separately
 * budgeted so a valid 64MiB entry remains supported. Tests may only narrow this
 * ceiling; no CLI option can alter it. No aggregate payload Buffer. */
export function planGitBlobBatches(metadata, maximum = LIMITS.batch) {
  requireBatchPayloadLimit(maximum);
  if (!Array.isArray(metadata)) fail(); requireObjectIds(metadata.map(value => value?.object));
  let total = 0; const batches = []; let batch = { entries: [], bytes: 0, wire_bytes: 0 };
  for (const value of metadata) {
    if (!exact(value, ['object', 'bytes'])) fail(); total = accumulateScanBytes(total, value.bytes); if (value.bytes > maximum) fail();
    if (batch.entries.length && batch.bytes + value.bytes > maximum) { batches.push(batch); batch = { entries: [], bytes: 0, wire_bytes: 0 }; }
    batch.entries.push({ object: value.object, bytes: value.bytes }); batch.bytes += value.bytes;
    batch.wire_bytes += value.bytes + Buffer.byteLength(`${value.object} blob ${value.bytes}\n`) + 1;
  }
  if (batch.entries.length) batches.push(batch);
  return { blobs: metadata.length, bytes: total, batches };
}
export function inspectGitBatch(bytes, objects, patterns, expectedSizes) {
  requireObjectIds(objects);
  if (!Buffer.isBuffer(bytes) || bytes.length > LIMITS.batch + objects.length * 256) fail();
  if (expectedSizes !== undefined && (!(expectedSizes instanceof Map) || expectedSizes.size !== objects.length
    || objects.some(object => !expectedSizes.has(object)))) fail();
  let offset = 0; let hits = 0; let total = 0;
  for (const object of objects) {
    const newline = bytes.indexOf(10, offset); if (newline < offset || newline - offset > 256) fail();
    const header = bytes.subarray(offset, newline).toString('latin1').split(' ');
    if (header.length !== 3 || header[0] !== object || header[1] !== 'blob' || !/^(0|[1-9][0-9]*)$/u.test(header[2])) fail();
    const size = Number(header[2]); total = accumulateScanBytes(total, size);
    if (total > LIMITS.batch || expectedSizes !== undefined && expectedSizes.get(object) !== size || newline + size + 1 >= bytes.length) fail();
    const content = bytes.subarray(newline + 1, newline + 1 + size); if (containsPrivateValue(content, patterns)) hits++;
    offset = newline + size + 2; if (bytes[offset - 1] !== 10) fail();
  }
  if (offset !== bytes.length) fail(); return { blobs: objects.length, bytes: total, hits };
}
/** Synthetic command injection is test-only, as with inventoryCommand above.
 * Both Git phases disable replacements and lazy network fetches. */
export async function scanGitObjects(objects, patterns, runCommand = command, maximum = LIMITS.batch) {
  requireBatchPayloadLimit(maximum);
  requireObjectIds(objects); const requested = [...objects]; containsPrivateValue(Buffer.alloc(0), patterns);
  const gitArgs = ['--no-replace-objects', '--no-lazy-fetch', 'cat-file'];
  const metadata = inspectGitObjectMetadata(await runCommand('git', [...gitArgs, '--batch-check'], requested.join('\n') + '\n', LIMITS.files * 256), requested);
  const plan = planGitBlobBatches(metadata, maximum); const seen = new Set(); let blobs = 0; let bytes = 0; let hits = 0;
  for (const batch of plan.batches) {
    const ids = batch.entries.map(value => value.object); const sizes = new Map(batch.entries.map(value => [value.object, value.bytes]));
    const result = inspectGitBatch(await runCommand('git', [...gitArgs, '--batch'], ids.join('\n') + '\n', batch.wire_bytes), ids, patterns, sizes);
    if (result.blobs !== ids.length || result.bytes !== batch.bytes) fail();
    for (const object of ids) { if (seen.has(object)) fail(); seen.add(object); }
    blobs += result.blobs; bytes += result.bytes; hits += result.hits;
  }
  if (blobs !== plan.blobs || bytes !== plan.bytes || seen.size !== requested.length || requested.some(object => !seen.has(object))) fail();
  return { blobs, bytes, hits, batches: plan.batches.length, coverage_verified: true };
}
function validateManifest(value, expected, actual) {
  if (!exact(value, ['project', 'kind', 'observed_at', 'status', 'supplied_manifest', 'files']) || value.project !== 'Everyone Presentation Studio'
    || value.kind !== 'current development source' || typeof value.observed_at !== 'string' || !Number.isFinite(Date.parse(value.observed_at))
    || typeof value.status !== 'string' || typeof value.supplied_manifest !== 'string' || !Array.isArray(value.files) || value.files.length !== expected.size) fail();
  const seen = new Set();
  for (const row of value.files) {
    if (!exact(row, ['path', 'bytes', 'sha256']) || !safeRelative(row.path) || seen.has(row.path) || !Number.isSafeInteger(row.bytes) || row.bytes < 0
      || !/^[a-f0-9]{64}$/u.test(row.sha256) || !expected.has(row.path) || !actual.has(row.path)) fail();
    seen.add(row.path);
    for (const item of [expected.get(row.path), actual.get(row.path)]) if (row.bytes !== item.bytes || row.sha256 !== item.sha256) fail('PRIVATE_SCAN_ARCHIVE_STALE');
  }
}
/** Real ZIP structure/CRC + exact source-manifest parity; synthetic buffers are
 * accepted only through this pure offline seam, never from CLI arguments. */
export async function inspectPackZip(bytes, expected, patterns) {
  if (!Buffer.isBuffer(bytes) || !(expected instanceof Map) || !expected.size || expected.size > LIMITS.files) fail();
  requireCompressedZipSize(bytes.length);
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(bytes, { lazyEntries: true, strictFileNames: true, validateEntrySizes: true }, (error, zip) => {
      if (error || !zip) { reject(new PrivateScanError()); return; }
      let settled = false; let total = 0; let hits = 0; let entries = 0; let manifest; let active;
      const seen = new Set(); const actual = new Map();
      const stop = () => { if (settled) return; settled = true; clearTimeout(timer); active?.destroy(); zip.close(); reject(new PrivateScanError()); };
      const timer = setTimeout(stop, LIMITS.commandMs);
      zip.on('error', stop);
      zip.on('end', () => {
        if (settled) return;
        try { if (!manifest || entries !== expected.size + 1 || actual.size !== expected.size) fail(); validateManifest(manifest, expected, actual);
          settled = true; clearTimeout(timer); resolve({ entries, bytes: total, hits, manifest_integrity_verified: true }); } catch { stop(); }
      });
      zip.on('entry', entry => {
        const relative = entry.fileName.startsWith(PREFIX) ? entry.fileName.slice(PREFIX.length) : '';
        if (++entries > LIMITS.files + 1 || !safeRelative(relative) || seen.has(relative.toLowerCase()) || entry.isEncrypted()
          || ((entry.externalFileAttributes >>> 16) & 0o170000) === 0o120000 || ![0, 8].includes(entry.compressionMethod)
          || !Number.isSafeInteger(entry.uncompressedSize) || entry.uncompressedSize < 0 || entry.uncompressedSize > (relative === 'SOURCE_MANIFEST.json' ? LIMITS.manifest : LIMITS.entry)
          || total + entry.uncompressedSize > LIMITS.total || relative !== 'SOURCE_MANIFEST.json' && !expected.has(relative)) { stop(); return; }
        seen.add(relative.toLowerCase());
        zip.openReadStream(entry, (readError, stream) => {
          if (readError || !stream || settled) { stream?.destroy(); stop(); return; } active = stream;
          void (async () => {
            let size = 0; let checksum = 0; const sha = createHash('sha256'); const chunks = [];
            let tail = Buffer.alloc(0); let hit = containsPrivateValue(Buffer.from(entry.fileName), patterns);
            const overlap = Math.max(...patterns.map(pattern => pattern.length)) - 1;
            for await (const part of stream) {
              size += part.length; total = accumulateScanBytes(total, part.length); if (size > entry.uncompressedSize) fail();
              checksum = crc32(part, checksum); sha.update(part);
              const combined = Buffer.concat([tail, part]); hit ||= containsPrivateValue(combined, patterns); tail = combined.subarray(Math.max(0, combined.length - overlap));
              if (relative === 'SOURCE_MANIFEST.json') { if (size > LIMITS.manifest) fail(); chunks.push(part); }
            }
            if (size !== entry.uncompressedSize || checksum !== entry.crc32) fail(); if (hit) hits++;
            if (relative === 'SOURCE_MANIFEST.json') manifest = JSON.parse(decode(Buffer.concat(chunks)));
            else actual.set(relative, { bytes: size, sha256: sha.digest('hex') });
            if (!settled) zip.readEntry();
          })().catch(stop);
        });
      });
      if (zip.entryCount !== expected.size + 1) stop(); else zip.readEntry();
    });
  });
}
export async function scanFixedPrivateValues() {
  let phase = 'source_inventory';
  try {
  const selected = await readSourceInventory();
  phase = 'private_configuration';
  const material = []; for (const [relative, maximum] of PRIVATE) material.push(await boundedFile(path.join(ROOT, relative), maximum, true));
  const patterns = privatePatterns({ worker: material[0].bytes, runtime: material[1].bytes, logo: material[2].bytes, specs: material[3].bytes,jobService:material[4].bytes,candidate:material[5].bytes,support:material[6].bytes,review:material[7].bytes });
  const expected = new Map(); const identities = new Map(); let sourceBytes = 0; let sourceHits = 0;
  phase = 'source_bytes';
  for (const relative of selected) {
    const item = await boundedFile(path.join(ROOT, relative), LIMITS.entry); sourceBytes = accumulateScanBytes(sourceBytes, item.bytes.length);
    if (containsPrivateValue(item.bytes, patterns) || containsPrivateValue(Buffer.from(relative), patterns)) sourceHits++;
    expected.set(relative, { bytes: item.bytes.length, sha256: digest(item.bytes) }); identities.set(relative, item.identity);
  }
  phase = 'index_listing';
  const index = decode(await command('git', ['ls-files', '--stage', '-z'], undefined, 16 * 1024 * 1024)); const objects = new Set(); let indexEntries = 0; let indexPathHits = 0;
  for (const row of index.split('\0').filter(Boolean)) {
    const match = /^(100644|100755) ([a-f0-9]{40}|[a-f0-9]{64}) 0\t(.+)$/u.exec(row);
    if (!match || !safeRelative(match[3]) || !expected.has(match[3]) || ++indexEntries > LIMITS.files) fail();
    objects.add(match[2]); if (containsPrivateValue(Buffer.from(match[3]), patterns)) indexPathHits++;
  }
  if (!objects.size) fail();
  phase = 'index_blobs';
  const staged = await scanGitObjects([...objects], patterns);
  phase = 'archive_structure';
  const archive = await boundedFile(ZIP, LIMITS.compressedZip); const zipped = await inspectPackZip(archive.bytes, expected, patterns);
  phase = 'source_stability';
  const finalSelected = await readSourceInventory(); if (JSON.stringify(finalSelected) !== JSON.stringify(selected)) fail();
  for (const relative of selected) if (!same(await lstat(path.join(ROOT, relative), { bigint: true }), identities.get(relative))) fail();
  if (!same(await lstat(ZIP, { bigint: true }), archive.identity)) fail();
  if (decode(await command('git', ['ls-files', '--stage', '-z'], undefined, 16 * 1024 * 1024)) !== index) fail();
  phase = 'private_stability';
  const privateAfter = [];
  try {
    for (const [relative] of PRIVATE) {
      const file = path.join(ROOT, relative); if (!samePath(await realpath(file), file)) fail();
      privateAfter.push(await lstat(file, { bigint: true }));
    }
  } catch { fail('PRIVATE_SCAN_CONFIGURATION_CHANGED'); }
  requirePrivateSnapshot(material.map(item => item.identity), privateAfter);
  const hits = sourceHits + staged.hits + indexPathHits + zipped.hits;
  return { result: hits ? 'failed' : 'passed', private_value_found: hits > 0, private_configuration_sources: 8, private_value_families: 11,
    source_files: selected.length, source_bytes: sourceBytes, source_hits: sourceHits, staged_entries: indexEntries, staged_blobs: staged.blobs,
    staged_blob_bytes: staged.bytes, staged_batches: staged.batches, staged_coverage_verified: staged.coverage_verified,
    staged_hits: staged.hits + indexPathHits, archive_entries: zipped.entries, archive_bytes_expanded: zipped.bytes,
    archive_hits: zipped.hits, manifest_integrity_verified: zipped.manifest_integrity_verified, source_and_archive_stable: true, private_input_snapshot_stable: true,
    identities_scanned: false, private_values_or_digests_recorded: false, external_network_called: false };
  } catch (error) { throw new PrivateScanError(error instanceof PrivateScanError ? error.code : 'PRIVATE_SCAN_UNCONFIRMED', phase); }
}
async function receiptDirectory() {
  if (!samePath(await realpath(ROOT), ROOT)) fail();
  let current = ROOT;
  for (const component of ['dist', 'checkpoints', 'private-values']) {
    current = path.join(current, component);
    try { await mkdir(current); } catch (error) { if (error?.code !== 'EEXIST') fail(); }
    const info = await lstat(current);
    if (!info.isDirectory() || info.isSymbolicLink() || !samePath(await realpath(current), current)) fail();
  }
  return current;
}
async function main() {
  if (process.argv.length !== 3 || process.argv[2] !== 'scan' || !/^v24\./u.test(process.version)) fail();
  let result;
  try { result = await scanFixedPrivateValues(); }
  catch (error) { result = { result: 'blocked', code: error instanceof PrivateScanError ? error.code : 'PRIVATE_SCAN_UNCONFIRMED',
    ...(error instanceof PrivateScanError && PHASES.has(error.phase) ? { phase: error.phase } : {}),
    private_values_or_digests_recorded: false, external_network_called: false }; }
  const report = { schema_version: '1.0', observed_at: new Date().toISOString(), scope: 'Fixed current private values in Git-eligible source, staged blob bytes and exact source ZIP', ...result };
  // Post-archive receipts are deliberately ignored source. Recording this
  // result must not invalidate the exact source/ZIP checkpoint just checked.
  const directory = await receiptDirectory();
  const filename = report.observed_at.replace(/[:.]/gu, '-') + '-' + randomUUID().slice(0, 8) + '.json';
  await writeFile(path.join(directory, filename), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  process.stdout.write(JSON.stringify(report) + '\n'); if (report.result !== 'passed') process.exitCode = 1;
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) main().catch(() => {
  process.stderr.write('Private value scan was not confirmed; private diagnostics suppressed.\n'); process.exitCode = 1;
});
