import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { clearTimeout, setTimeout } from 'node:timers';
const root = process.cwd();
const host = process.platform === 'win32' ? 'npipe:////./pipe/dockerDesktopLinuxEngine' : 'unix:///var/run/docker.sock';
const context = process.platform === 'win32' ? 'desktop-linux' : 'default';
if (process.argv.length !== 2 || !['linux', 'win32'].includes(process.platform) || process.env.DOCKER_HOST && process.env.DOCKER_HOST !== host
  || process.env.DOCKER_CONTEXT && process.env.DOCKER_CONTEXT !== context || ['DOCKER_TLS', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH'].some(name => process.env[name])) throw new Error('Local media build target rejected.');
const names = ['apps/worker/Dockerfile.pdf-raster', 'apps/worker/src/pdf-raster-process.mjs'].sort();
const parts = []; const manifest = [];
for (const name of names) {
  const file = path.join(root, name); const info = await lstat(file); assert(info.isFile() && !info.isSymbolicLink()); assert.equal((await realpath(file)).toLowerCase(), file.toLowerCase());
  const bytes = await readFile(file); assert(bytes.length < 128 * 1024); manifest.push({ path: name, sha256: createHash('sha256').update(bytes).digest('hex') });
  const header = Buffer.alloc(512); header.write(name, 0, 100);
  const octal = (offset, length, value) => header.write(value.toString(8).padStart(length - 1, '0') + '\0', offset, length, 'ascii');
  octal(100, 8, 0o644); octal(108, 8, 0); octal(116, 8, 0); octal(124, 12, bytes.length); octal(136, 12, 0); header.fill(32, 148, 156); header[156] = 48;
  header.write('ustar\0', 257, 6); header.write('00', 263, 2); header.write(header.reduce((sum, value) => sum + value, 0).toString(8).padStart(6, '0') + '\0 ', 148, 8);
  parts.push(header, bytes, Buffer.alloc((512 - bytes.length % 512) % 512));
}
const source = createHash('sha256').update(JSON.stringify(manifest)).digest('hex'); const tag = `eps-pdf-raster:local-${source.slice(0, 16)}`;
async function docker(args, input) {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', ['--host', host, ...args], { shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let length = 0; const chunks = []; let failure;
    const timer = setTimeout(() => { failure = true; child.kill(); }, 300_000);
    child.on('error', () => { failure = true; }); child.stdin.on('error', () => {});
    child.stdout.on('data', chunk => { length += chunk.length; if (length < 4 * 1024 * 1024) chunks.push(chunk); else { failure = true; child.kill(); } });
    child.stderr.on('data', () => {});
    child.on('close', code => { clearTimeout(timer); if (code !== 0 || failure) reject(new Error('The local media image build failed; no private diagnostics were printed.')); else resolve(Buffer.concat(chunks).toString('utf8')); }); child.stdin.end(input);
  });
}
await docker(['build', '--label', 'com.everyone.presentation.owner=eps-media', '--label', `com.everyone.presentation.source=${source}`, '-t', tag, '-f', 'apps/worker/Dockerfile.pdf-raster', '-'], Buffer.concat([...parts, Buffer.alloc(1024)]));
const inspected = JSON.parse(await docker(['image', 'inspect', tag])); assert.equal(inspected.length, 1); const image = inspected[0];
assert.equal(image.Config.Labels['com.everyone.presentation.source'], source); assert.equal(image.Config.Labels['com.everyone.presentation.owner'], 'eps-media'); assert.equal(image.Config.User, '1000:1000');
process.stdout.write(JSON.stringify({ schema_version: '1.0', observed_at: new Date().toISOString(), image_id: image.Id, tag, source_sha256: source, manifest, network_used: 'public Debian package build only', provider_called: false, database_called: false, hosted: false }) + '\n');
