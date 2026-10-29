/** Fixed offline inspection of authorized downloaded artifacts. Import has no
 * private IO; root supplies the protected intent only after actual downloads. */
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { Buffer } from 'node:buffer';
import { lstat, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { createCanvas } from '@napi-rs/canvas';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { parseRenderSnapshot, presentationCanonicalHash } from '../packages/domain/src/presentation.ts';
import { validatePresentationPdf } from '../apps/worker/src/presentation-pdf.ts';
import { validateDownloadedPdfWithoutImageBodies } from './m05-live-geometry.mts';
import { nativeBrowserEnvironment } from '../apps/worker/src/native-browser.ts';

const ROOT = path.resolve(import.meta.dirname, '..'); const PRIVATE = path.join(ROOT, '.local/m05-live'); const INTENT = path.join(PRIVATE, 'inspection-intent.json');
const DOWNLOADS = 'C:\\Users\\iway\\Downloads'; const WORKSPACE = '098d5b48-42a3-475b-b562-735c9eafce80';
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u; const HASH = /^[a-f0-9]{64}$/u;
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
function require(value: unknown): asserts value { if (!value) throw Error('M05_LIVE_ARTIFACT_INSPECTION_UNCONFIRMED'); }
function exact(value: unknown, keys: string[]): asserts value is Record<string, unknown> { require(value !== null && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key))); }
interface LiveIntent { schema_version: '1.0'; versions: { version_id: string; pdf_path: string; pdf_sha256: string; snapshot_sha256: string; image_files: { asset_id: string; path: string; sha256: string }[] }[] }
function within(value: string, root: string) { const target = path.resolve(value).toLowerCase(); const base = path.resolve(root).toLowerCase(); return target.startsWith(base + path.sep); }
/** Root-scoped paths only; no URL, process, config or credential inputs. */
export function parseLiveInspectionIntent(value: unknown): LiveIntent {
  exact(value, ['schema_version', 'versions']); require(value.schema_version === '1.0' && Array.isArray(value.versions) && value.versions.length >= 1 && value.versions.length <= 4);
  const ids = new Set<string>();
  for (const version of value.versions) {
    exact(version, ['version_id', 'pdf_path', 'pdf_sha256', 'snapshot_sha256', 'image_files']);
    require(typeof version.version_id === 'string' && UUID.test(version.version_id) && !ids.has(version.version_id)); ids.add(version.version_id);
    require(typeof version.pdf_path === 'string' && path.isAbsolute(version.pdf_path) && /\.pdf$/iu.test(version.pdf_path) && (within(version.pdf_path, DOWNLOADS) || within(version.pdf_path, PRIVATE)));
    require(typeof version.pdf_sha256 === 'string' && HASH.test(version.pdf_sha256) && typeof version.snapshot_sha256 === 'string' && HASH.test(version.snapshot_sha256));
    require(Array.isArray(version.image_files) && version.image_files.length <= 4001); const assets = new Set<string>();
    for (const image of version.image_files) {
      exact(image, ['asset_id', 'path', 'sha256']); require(typeof image.asset_id === 'string' && UUID.test(image.asset_id) && !assets.has(image.asset_id)); assets.add(image.asset_id);
      require(typeof image.path === 'string' && path.isAbsolute(image.path) && /\.(?:jpg|jpeg|jfif|png|webp)$/iu.test(image.path) && (within(image.path, DOWNLOADS) || within(image.path, PRIVATE)) && typeof image.sha256 === 'string' && HASH.test(image.sha256));
    }
  }
  return structuredClone(value) as unknown as LiveIntent;
}
async function readRegular(file: string, maximum: number) {
  const info = await lstat(file); require(info.isFile() && !info.isSymbolicLink() && info.size > 0 && info.size <= maximum && path.resolve(await realpath(file)).toLowerCase() === path.resolve(file).toLowerCase());
  const bytes = await readFile(file); const after = await lstat(file); require(bytes.length === info.size && after.size === info.size && after.mtimeMs === info.mtimeMs && after.ino === info.ino && after.dev === info.dev); return bytes;
}
class NoExternalData { async fetch(): Promise<never> { throw Error('EXTERNAL_RESOURCE_DENIED'); } }
export async function writePrivateInspectionFile(file: string, bytes: Uint8Array) {
  require(within(file, path.join(PRIVATE, 'inspections')));
  const relative = path.relative(ROOT, file).replaceAll('\\', '/');
  const result = await new Promise<string>((resolve, reject) => {
    const child = spawn(path.join(ROOT, '.venv-skills/Scripts/python.exe'), ['-X', 'utf8', path.join(ROOT, 'tools/m05-live-private-file.py'), relative], { cwd: ROOT, shell: false, windowsHide: true, env: { ...nativeBrowserEnvironment(), NODE_ENV: 'production' }, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = ''; let diagnostic = 0; let failed = false; const stop = () => { failed = true; child.kill('SIGKILL'); }; const timer = setTimeout(stop, 15000); child.on('error', stop); child.stdin.on('error', () => {});
    child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString('utf8'); if (stdout.length > 4096) stop(); }); child.stderr.on('data', (chunk: Buffer) => { diagnostic += chunk.length; if (diagnostic > 4096) stop(); });
    child.on('close', code => { clearTimeout(timer); if (failed || code !== 0) reject(Error('M05_LIVE_PRIVATE_WRITE_UNCONFIRMED')); else resolve(stdout); }); child.stdin.end(Buffer.from(bytes));
  });
  const confirmed = JSON.parse(result); require(confirmed.written === true && confirmed.owner_system_only === true && confirmed.bytes === bytes.byteLength && confirmed.sha256 === sha(bytes));
}
async function main() {
  require(process.argv.length === 2); const rawIntent = await readRegular(INTENT, 1024 * 1024); const intent = parseLiveInspectionIntent(JSON.parse(rawIntent.toString('utf8')));
  const stamp = new Date().toISOString().replaceAll(':', '-'); const relative = `.local/m05-live/inspections/${stamp}`; const folder = path.resolve(ROOT, relative); require(within(folder, PRIVATE)); await mkdir(folder, { recursive: true });
  const sourceFiles = ['tools/inspect-m05-live-pdf.mts', 'tools/m05-live-geometry.mts', 'tools/m05-live-private-file.py', 'tools/provision_logo_verifier.py', 'apps/worker/src/presentation-pdf.ts', 'apps/worker/src/presentation-pdf-inspect-process.mjs', 'apps/worker/src/review-fit.ts', 'apps/worker/src/native-browser.ts', 'packages/domain/src/presentation.ts', 'packages/templates/src/registered.ts', 'packages/templates/versions/1.1.0/registry.json', 'packages/templates/versions/1.1.0/render.ts'];
  const sources = async () => Object.fromEntries(await Promise.all(sourceFiles.map(async file => [file, sha(await readFile(path.join(ROOT, file)))]))); const before = await sources(); const versions = [];
  for (const item of intent.versions) {
    const file = path.join(PRIVATE, `version-${item.version_id}.snapshot.json`); const raw = await readRegular(file, 8 * 1024 * 1024); const snapshot = parseRenderSnapshot(JSON.parse(raw.toString('utf8')));
    require(snapshot.version_id === item.version_id && snapshot.workspace_id === WORKSPACE && await presentationCanonicalHash(snapshot) === item.snapshot_sha256);
    const imageAssets = snapshot.asset_inventory.filter(asset => asset.asset_kind !== 'candidate_video'); require(imageAssets.length >= item.image_files.length); const images = new Map<string, Uint8Array>();
    for (const image of item.image_files) { const asset = imageAssets.find(asset => asset.asset_id === image.asset_id); require(asset && asset.sha256 === image.sha256); const bytes = await readRegular(image.path, 20 * 1024 * 1024); require(sha(bytes) === image.sha256 && bytes.length === asset.byte_size); images.set(asset.asset_id, bytes); }
    const bytes = await readRegular(item.pdf_path, 64 * 1024 * 1024); require(sha(bytes) === item.pdf_sha256);
    const allBodies = images.size === imageAssets.length;
    const proof = allBodies ? await validatePresentationPdf(snapshot, images, bytes) : await validateDownloadedPdfWithoutImageBodies(snapshot, bytes);
    require(proof.pdf_sha256 === item.pdf_sha256);
    const task = getDocument({ data: new Uint8Array(bytes), verbosity: 0, useWorkerFetch: false, useWasm: false, useSystemFonts: false, BinaryDataFactory: NoExternalData }); const pdf = await task.promise; const pages = [];
    try { for (let n = 1; n <= pdf.numPages; n++) { const page = await pdf.getPage(n); const viewport = page.getViewport({ scale: 1 }); const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      await page.render({ canvas: canvas as unknown as HTMLCanvasElement, canvasContext: canvas.getContext('2d') as unknown as CanvasRenderingContext2D, viewport }).promise;
      const png = canvas.toBuffer('image/png'); const name = `${item.version_id}-${n}.png`; await writePrivateInspectionFile(path.join(folder, name), png); pages.push({ page: n, file: name, sha256: sha(png), width: canvas.width, height: canvas.height, owner_system_only: true }); page.cleanup(); }
    } finally { await task.destroy(); }
    require(sha(await readRegular(item.pdf_path, 64 * 1024 * 1024)) === item.pdf_sha256 && sha(await readRegular(file, 8 * 1024 * 1024)) === sha(raw));
    versions.push({ version_id: snapshot.version_id, snapshot_sha256: item.snapshot_sha256, downloaded_pdf_sha256: item.pdf_sha256, downloaded_bytes_match_expected: true,
      source_image_count: imageAssets.length, independently_verified_source_body_count: images.size, all_source_image_bodies_independently_verified: allBodies,
      validation_mode: allBodies ? 'exact_snapshot_with_all_available_source_bodies' : 'exact_snapshot_text_links_and_declared_frame_geometry_without_image_bodies',
      independent_pdf_pixel_identity_compared: false, actual_worker_source_byte_proof_is_separate: true, validation: proof, pages });
  }
  require(sha(await readRegular(INTENT, 1024 * 1024)) === sha(rawIntent) && JSON.stringify(before) === JSON.stringify(await sources()));
  const report = { observed_at: new Date().toISOString(), scope: 'offline_authorized_downloaded_pdf_exact_snapshot_and_source_images', result: 'validated', intent_composite_sha256: sha(rawIntent), source_sha256: before, sources_stable: true,
    provider_or_database_called: false, browser_session_or_credentials_loaded: false, private_facts_or_signed_urls_published: false, private_artifact_directory: relative, visual_inspection: 'pending_independent_page_review', versions };
  const evidence = `tracking/evidence/m05/live-artifacts/${stamp}.json`; const serialized = JSON.stringify(report, null, 2) + '\n'; await writePrivateInspectionFile(path.join(folder, 'receipt.json'), new TextEncoder().encode(serialized)); await mkdir(path.join(ROOT, path.dirname(evidence)), { recursive: true }); await writeFile(path.join(ROOT, evidence), serialized);
  process.stdout.write(JSON.stringify({ result: 'validated', receipt: evidence, versions: versions.map(version => ({ version_id: version.version_id, page_count: version.validation.page_count })) }) + '\n');
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) main().catch(() => { process.stderr.write('M05 live artifact inspection unconfirmed; no private document text was logged.\n'); process.exitCode = 1; });
