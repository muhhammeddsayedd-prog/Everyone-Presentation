import { Buffer } from 'node:buffer';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, realpath, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { clearTimeout, setTimeout } from 'node:timers';
function fail(code = 'SOURCE_UNREADABLE') { const error = new Error('PDF raster preparation failed.'); error.code = code; throw error; }
async function command(name, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(`/usr/bin/${name}`, args, { shell: false, stdio: ['ignore', 'pipe', 'pipe'], env: { LANG: 'C', LC_ALL: 'C' } });
    let size = 0; const diagnostics = []; const output = []; let problem = false; const timer = setTimeout(() => { problem = true; child.kill('SIGKILL'); }, 30_000);
    child.on('error', () => { problem = true; }); child.stdout.on('data', chunk => { size += chunk.length; if (size > 1024 * 1024) { problem = true; child.kill('SIGKILL'); } else output.push(chunk); }); child.stderr.on('data', chunk => { size += chunk.length; if (size > 1024 * 1024) { problem = true; child.kill('SIGKILL'); } else diagnostics.push(chunk); });
    child.on('close', code => { clearTimeout(timer); if (problem || code !== 0) { const error = new Error('PDF raster process failed.'); error.code = 'DOCUMENT_RASTER_FAILED'; reject(error); } else resolve({ stdout: Buffer.concat(output).toString('utf8'), stderr: Buffer.concat(diagnostics).toString('utf8') }); });
  });
}
function dimensions(bytes) {
  let at = 2; if (bytes[0] !== 0xff || bytes[1] !== 0xd8) fail();
  while (at + 9 < bytes.length) { if (bytes[at] !== 0xff) fail(); const marker = bytes[at + 1]; const length = bytes.readUInt16BE(at + 2); if ([0xc0, 0xc1, 0xc2].includes(marker)) return { width: bytes.readUInt16BE(at + 7), height: bytes.readUInt16BE(at + 5) }; if (length < 2) fail(); at += length + 2; } fail();
}
let directory; let root;
try {
  const chunks = []; let length = 0; for await (const chunk of process.stdin) { length += chunk.length; if (length > 28 * 1024 * 1024 + 4096) fail('DOCUMENT_LIMIT_EXCEEDED'); chunks.push(chunk); }
  const input = JSON.parse(Buffer.concat(chunks).toString('utf8')); if (!input || Object.keys(input).sort().join(',') !== 'bytes,inspect_only,pages,source_asset_id' || typeof input.bytes !== 'string' || typeof input.source_asset_id !== 'string' || typeof input.inspect_only !== 'boolean'
    || !Array.isArray(input.pages) || !input.pages.length && !input.inspect_only || input.pages.length > 20 || new Set(input.pages).size !== input.pages.length || input.pages.some(page => !Number.isSafeInteger(page) || page < 1 || page > 200)) fail();
  const bytes = Buffer.from(input.bytes, 'base64'); if (bytes.length > 20 * 1024 * 1024 || bytes.toString('base64') !== input.bytes || bytes.toString('ascii', 0, 5) !== '%PDF-') fail();
  root = await realpath(tmpdir()); directory = await mkdtemp(path.join(root, 'eps-pdf-raster-')); const original = path.join(directory, 'original.pdf'); await writeFile(original, bytes, { flag: 'wx', mode: 0o600 });
  let pageImages = [];
  if (input.inspect_only) {
    const info = (await command('pdfinfo', ['-f', '1', '-l', '200', original])).stdout;
    const areas = new Map([...info.matchAll(/Page\s+(\d+)\s+size:\s+([\d.]+)\s+x\s+([\d.]+)\s+pts/gu)].map(match => [Number(match[1]), Number(match[2]) * Number(match[3])]));
    if (!areas.size || areas.size > 200 || [...areas.values()].some(area => !Number.isFinite(area) || area <= 0)) fail();
    const list = (await command('pdfimages', ['-list', original])).stdout; const images = new Map();
    for (const line of list.split('\n')) { const fields = line.trim().split(/\s+/u); if (!/^\d+$/u.test(fields[0])) continue; const page = Number(fields[0]); const width = Number(fields[3]); const height = Number(fields[4]); const xppi = Number(fields[12]); const yppi = Number(fields[13]);
      if (!areas.has(page) || !Number.isFinite(width) || !Number.isFinite(height) || !Number.isFinite(xppi) || !Number.isFinite(yppi) || width < 1 || height < 1 || xppi <= 0 || yppi <= 0) fail();
      images.set(page, (images.get(page) ?? 0) + width * height * 72 * 72 / xppi / yppi); }
    pageImages = [...areas].map(([page, area]) => ({ page, image_coverage: Math.min(1, (images.get(page) ?? 0) / area) }));
  }
  const pages = []; let total = 0;
  for (const page of input.pages) {
    const target = path.join(directory, `page-${page}`); await command('pdftoppm', ['-f', String(page), '-l', String(page), '-singlefile', '-scale-to', '2048', '-r', '150', '-jpeg', '-jpegopt', 'quality=85', original, target]);
    const info = await stat(`${target}.jpg`); if (!info.isFile() || info.size < 1 || info.size > 4 * 1024 * 1024 || (total += info.size) > 32 * 1024 * 1024) fail('DOCUMENT_LIMIT_EXCEEDED');
    const image = await readFile(`${target}.jpg`); pages.push({ page, sha256: createHash('sha256').update(image).digest('hex'), ...dimensions(image), bytes: image.toString('base64') });
  }
  const version = (await command('pdftoppm', ['-v'])).stderr.split('\n')[0];
  process.stdout.write(JSON.stringify({ ok: true, result: { source_asset_id: input.source_asset_id, source_sha256: createHash('sha256').update(bytes).digest('hex'), rasterizer_version: version, pages, page_images: pageImages } }));
} catch (error) { process.stdout.write(JSON.stringify({ ok: false, code: ['DOCUMENT_LIMIT_EXCEEDED', 'DOCUMENT_RASTER_FAILED'].includes(error.code) ? error.code : 'SOURCE_UNREADABLE' })); }
finally { if (directory) { const owned = await realpath(directory); if (path.dirname(owned) !== root || !path.basename(owned).startsWith('eps-pdf-raster-')) fail('DOCUMENT_RASTER_OWNERSHIP_INVALID'); await rm(owned, { recursive: true, force: true }); } }
