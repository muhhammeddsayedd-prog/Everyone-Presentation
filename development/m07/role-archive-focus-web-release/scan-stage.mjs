/** Local fixed-family scan of an already isolated immutable Git stage. */
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { readFile, lstat, realpath, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
async function regular(file, max = 8 * 1024 ** 2) {
  const info = await lstat(file); assert(info.isFile() && !info.isSymbolicLink() && info.nlink === 1 && info.size <= max);
  assert.equal((await realpath(file)).toLowerCase(), path.resolve(file).toLowerCase()); return readFile(file);
}
async function main() {
  assert.equal(process.argv.length, 4); const root = await realpath(process.argv[2]), folder = await realpath(process.argv[3]);
  assert(path.basename(folder) === 'source' && /^[a-f0-9-]{36}$/u.test(path.basename(path.dirname(folder))) && path.dirname(path.dirname(folder)).toLowerCase() === path.join(root, '.local/role-archive-focus-web-release').toLowerCase());
  const scanner = path.join(root, 'tools/scan-private-values.mjs');
  assert.equal(sha(await regular(scanner)), 'def5be5cb94690b387dcaced95cc06f3a1e3bfcd1489b47ed40e963226921546');
  const { privatePatterns, containsPrivateValue } = await import(pathToFileURL(scanner).href);
  const names = { worker: '.env.worker.local', runtime: '.env.worker-runtime.local', logo: '.local/cloud-logo-provision/verifier.json',
    specs: '.local/specs-assets-verifier/verifier.json', jobService: '.env.job-service.local', candidate: '.env.candidate-runtime.local',
    support: '.env.support-runtime.local', review: '.env.review-runtime.local', presentation: '.env.presentation-runtime.local', guest: '.env.guest-runtime.local' };
  const material = {}, hashes = {};
  for (const [key, relative] of Object.entries(names)) { const bytes = await regular(path.join(root, relative), 65536); material[key] = bytes; hashes[key] = sha(bytes); }
  const patterns = privatePatterns(material); let count = 0, total = 0; const pending = [folder];
  while (pending.length) for (const entry of await readdir(pending.pop(), { withFileTypes: true })) {
    const file = path.join(entry.parentPath, entry.name); assert(!entry.isSymbolicLink());
    if (entry.isDirectory()) { assert((await realpath(file)).toLowerCase() === file.toLowerCase()); pending.push(file); continue; }
    const relative = path.relative(folder, file).replaceAll('\\', '/');
    if (relative === '.vercel/project.json') continue;
    const raw = await regular(file); total += raw.length; assert(total <= 16 * 1024 ** 2 && ++count <= 1000);
    assert(!containsPrivateValue(raw, patterns) && !containsPrivateValue(Buffer.from(relative), patterns));
  }
  for (const [key, relative] of Object.entries(names)) assert.equal(sha(await regular(path.join(root, relative), 65536)), hashes[key]);
  process.stdout.write(JSON.stringify({ result: 'passed', private_hits: 0, private_inputs_stable: true, private_input_families: 14, private_input_files: 10, files: count }) + '\n');
}
main().catch(() => { process.stderr.write('ROLE_ARCHIVE_FOCUS_WEB_PRIVATE_SCAN_UNCONFIRMED\n'); process.exitCode = 1; });
