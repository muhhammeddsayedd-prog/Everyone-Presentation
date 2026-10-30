/** Offline-only authorized downloaded guest PDF inspection. Import is inert.
 * Grant-bearing annotations stay in memory; no browser/session/cloud IO. */
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
import type { RenderSnapshot } from '../packages/domain/src/presentation-types.ts';
import { validatePresentationExportPdf, type PresentationExportMediaAccess } from '../apps/worker/src/presentation-pdf.ts';
import { nativeBrowserEnvironment } from '../apps/worker/src/native-browser.ts';
import { validateDownloadedGuestPdfWithoutImageBodies } from './m06-live-geometry.mts';

const ROOT = path.resolve(import.meta.dirname, '..'), PRIVATE = path.join(ROOT, '.local/m06-live');
const INTENT = path.join(PRIVATE, 'inspection-intent.json'), DOWNLOADS = 'C:\\Users\\iway\\Downloads';
const WORKSPACE = '098d5b48-42a3-475b-b562-735c9eafce80';
const UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u, HASH = /^[a-f0-9]{64}$/u;
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
function require(value: unknown): asserts value { if (!value) throw Error('M06_LIVE_ARTIFACT_INSPECTION_UNCONFIRMED'); }
function exact(value: unknown, keys: string[]): asserts value is Record<string, unknown> { require(value !== null && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key))); }
function within(value: string, root: string) { return path.resolve(value).toLowerCase().startsWith(path.resolve(root).toLowerCase() + path.sep); }
interface LiveIntent { schema_version: '1.0'; exports: { version_id: string; export_id: string; review_link_id: string; pdf_path: string; pdf_sha256: string; snapshot_path: string; snapshot_sha256: string; image_files: { asset_id: string; path: string; sha256: string }[] }[] }
/** IDs/hashes only, no credentials or caller-selected commands/network targets. */
export function parseLiveGuestInspectionIntent(value: unknown): LiveIntent {
  exact(value, ['schema_version', 'exports']); require(value.schema_version === '1.0' && Array.isArray(value.exports) && value.exports.length >= 1 && value.exports.length <= 8);
  const ids = new Set<string>();
  for (const item of value.exports) {
    exact(item, ['version_id', 'export_id', 'review_link_id', 'pdf_path', 'pdf_sha256', 'snapshot_path', 'snapshot_sha256', 'image_files']);
    for (const key of ['version_id', 'export_id', 'review_link_id']) require(typeof item[key] === 'string' && UUID.test(item[key]));
    require(!ids.has(item.export_id as string)); ids.add(item.export_id as string);
    require(typeof item.pdf_path === 'string' && path.isAbsolute(item.pdf_path) && /\.pdf$/iu.test(item.pdf_path) && (within(item.pdf_path, PRIVATE) || within(item.pdf_path, DOWNLOADS)));
    require(typeof item.snapshot_path === 'string' && path.isAbsolute(item.snapshot_path) && within(item.snapshot_path, PRIVATE) && path.basename(item.snapshot_path) === `version-${item.version_id}.snapshot.json`);
    require(typeof item.pdf_sha256 === 'string' && HASH.test(item.pdf_sha256) && typeof item.snapshot_sha256 === 'string' && HASH.test(item.snapshot_sha256));
    require(Array.isArray(item.image_files) && item.image_files.length <= 4001); const assets = new Set<string>();
    for (const image of item.image_files) {
      exact(image, ['asset_id', 'path', 'sha256']); require(typeof image.asset_id === 'string' && UUID.test(image.asset_id) && !assets.has(image.asset_id)); assets.add(image.asset_id);
      require(typeof image.path === 'string' && path.isAbsolute(image.path) && /\.(?:jpg|jpeg|jfif|png|webp)$/iu.test(image.path) && (within(image.path, PRIVATE) || within(image.path, DOWNLOADS)) && typeof image.sha256 === 'string' && HASH.test(image.sha256));
    }
  }
  return structuredClone(value) as unknown as LiveIntent;
}
/** Returned secret-bearing access must remain invocation-local and unlogged. */
export function inspectGuestMediaAnnotations(snapshot: RenderSnapshot, pages: string[][]): PresentationExportMediaAccess | null {
  require(pages.length === snapshot.slides.length); let grant: string | null = null;
  for (const [index, links] of pages.entries()) {
    const video = snapshot.slides[index].video_asset_id; require(Array.isArray(links) && links.length === (video ? 1 : 0));
    if (!video) continue;
    require(snapshot.asset_inventory.some(asset => asset.asset_id === video && asset.asset_kind === 'candidate_video'));
    const raw = links[0]; require(typeof raw === 'string'); let url: URL;
    try { url = new URL(raw); } catch { throw Error('M06_LIVE_ARTIFACT_INSPECTION_UNCONFIRMED'); }
    require(url.origin === snapshot.render_configuration.application_origin && !url.username && !url.password && !url.search && !url.hash);
    const match = /^\/m\/([A-Za-z0-9_-]{43})\/versions\/([a-f0-9-]{36})\/media\/([a-f0-9-]{36})$/u.exec(url.pathname);
    require(match && match[2] === snapshot.version_id && match[3] === video && raw === `${url.origin}${url.pathname}`);
    require(grant === null || grant === match[1]); grant = match[1];
  }
  return grant === null ? null : { version_id: snapshot.version_id, grant_token: grant };
}
async function readRegular(file: string, maximum: number) {
  const info = await lstat(file); require(info.isFile() && !info.isSymbolicLink() && info.size > 0 && info.size <= maximum && path.resolve(await realpath(file)).toLowerCase() === path.resolve(file).toLowerCase());
  const bytes = await readFile(file), after = await lstat(file); require(bytes.length === info.size && after.size === info.size && after.mtimeMs === info.mtimeMs && after.ino === info.ino && after.dev === info.dev); return bytes;
}
async function privateHelper(args: string[], bytes?: Uint8Array): Promise<Record<string, unknown>> {
  const text = await new Promise<string>((resolve, reject) => {
    const child = spawn(path.join(ROOT, '.venv-skills/Scripts/python.exe'), ['-X', 'utf8', path.join(ROOT, 'tools/m06-live-private-file.py'), ...args], { cwd: ROOT, shell: false, windowsHide: true, env: { ...nativeBrowserEnvironment(), NODE_ENV: 'production' }, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', diagnostic = 0, failed = false; const stop = () => { failed = true; child.kill('SIGKILL'); }; const timer = setTimeout(stop, 15000); child.on('error', stop); child.stdin.on('error', () => {});
    child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString('utf8'); if (stdout.length > 4096) stop(); }); child.stderr.on('data', (chunk: Buffer) => { diagnostic += chunk.length; if (diagnostic > 4096) stop(); });
    child.on('close', code => { clearTimeout(timer); if (failed || code !== 0) reject(Error('M06_LIVE_PRIVATE_FILE_UNCONFIRMED')); else resolve(stdout); }); child.stdin.end(bytes ? Buffer.from(bytes) : undefined);
  }); return JSON.parse(text) as Record<string, unknown>;
}
async function verifyPrivate(file: string) { const result = await privateHelper(['--verify', path.relative(ROOT, file).replaceAll('\\', '/')]); require(result.verified === true && result.owner_system_only === true); }
export async function writePrivateGuestInspectionFile(file: string, bytes: Uint8Array) {
  require(within(file, path.join(PRIVATE, 'inspections')));
  const result = await privateHelper([path.relative(ROOT, file).replaceAll('\\', '/')], bytes);
  require(result.written === true && result.owner_system_only === true && result.bytes === bytes.byteLength && result.sha256 === sha(bytes));
}
class NoExternalData { async fetch(): Promise<never> { throw Error('EXTERNAL_RESOURCE_DENIED'); } }
async function main() {
  require(process.argv.length === 2); await verifyPrivate(INTENT); const rawIntent = await readRegular(INTENT, 1024 * 1024); const intent = parseLiveGuestInspectionIntent(JSON.parse(rawIntent.toString('utf8')));
  const stamp = new Date().toISOString().replaceAll(':', '-'), relative = `.local/m06-live/inspections/${stamp}`, folder = path.resolve(ROOT, relative); await mkdir(folder, { recursive: true });
  const files = ['tools/inspect-m06-live-pdf.mts', 'tools/m06-live-geometry.mts', 'tools/m06-live-private-file.py', 'tools/provision_logo_verifier.py', 'apps/worker/src/presentation-pdf.ts', 'apps/worker/src/presentation-pdf-inspect-process.mjs', 'apps/worker/src/review-fit.ts', 'apps/worker/src/native-browser.ts', 'packages/domain/src/presentation.ts', 'packages/templates/src/registered.ts', 'packages/templates/versions/1.1.0/registry.json', 'packages/templates/versions/1.1.0/render.ts'];
  const sources = async () => Object.fromEntries(await Promise.all(files.map(async file => [file, sha(await readFile(path.join(ROOT, file)))]))); const before = await sources(), exports = [];
  for (const item of intent.exports) {
    await verifyPrivate(item.snapshot_path); const raw = await readRegular(item.snapshot_path, 8 * 1024 * 1024), snapshot = parseRenderSnapshot(JSON.parse(raw.toString('utf8')));
    require(snapshot.version_id === item.version_id && snapshot.workspace_id === WORKSPACE && snapshot.audience_snapshot.scope === 'external' && await presentationCanonicalHash(snapshot) === item.snapshot_sha256);
    const imageAssets = snapshot.asset_inventory.filter(asset => asset.asset_kind !== 'candidate_video'), images = new Map<string, Uint8Array>();
    for (const image of item.image_files) { const asset = imageAssets.find(asset => asset.asset_id === image.asset_id); require(asset && asset.sha256 === image.sha256); const body = await readRegular(image.path, 20 * 1024 * 1024); require(sha(body) === image.sha256 && body.length === asset.byte_size); images.set(asset.asset_id, body); }
    const bytes = await readRegular(item.pdf_path, 64 * 1024 * 1024); require(sha(bytes) === item.pdf_sha256);
    const task = getDocument({ data: new Uint8Array(bytes), verbosity: 0, useWorkerFetch: false, useWasm: false, useSystemFonts: false, BinaryDataFactory: NoExternalData }), pdf = await task.promise;
    const links: string[][] = [], pages = []; let proof;
    try {
      require(pdf.numPages === snapshot.slides.length);
      for (let n = 1; n <= pdf.numPages; n++) { const page = await pdf.getPage(n), annotations = await page.getAnnotations(); require(annotations.every(annotation => annotation.subtype === 'Link')); links.push(annotations.map(annotation => annotation.url as string)); page.cleanup(); }
      const access = inspectGuestMediaAnnotations(snapshot, links), allBodies = images.size === imageAssets.length;
      proof = allBodies && access ? await validatePresentationExportPdf(snapshot, images, bytes, access) : await validateDownloadedGuestPdfWithoutImageBodies(snapshot, bytes, access);
      require(proof.pdf_sha256 === item.pdf_sha256);
      for (let n = 1; n <= pdf.numPages; n++) { const page = await pdf.getPage(n), viewport = page.getViewport({ scale: 1 }), canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
        await page.render({ canvas: canvas as unknown as HTMLCanvasElement, canvasContext: canvas.getContext('2d') as unknown as CanvasRenderingContext2D, viewport }).promise;
        const png = canvas.toBuffer('image/png'), name = `${item.export_id}-${n}.png`; await writePrivateGuestInspectionFile(path.join(folder, name), png); pages.push({ page: n, file: name, sha256: sha(png), width: canvas.width, height: canvas.height, owner_system_only: true }); page.cleanup(); }
      exports.push({ version_id: item.version_id, export_id: item.export_id, review_link_id: item.review_link_id, snapshot_sha256: item.snapshot_sha256, downloaded_pdf_sha256: item.pdf_sha256, downloaded_bytes_match_expected: true,
        expected_artifact_scope_source: 'Protected owner intent; database/API export and link provenance is recorded separately by the live observer.',
        source_image_count: imageAssets.length, independently_verified_source_body_count: images.size, all_source_image_bodies_independently_verified: allBodies,
        validation_mode: allBodies && access ? 'fixed_snapshot_with_all_source_image_bodies_and_scoped_guest_annotations' : 'fixed_snapshot_text_guest_annotations_and_declared_image_geometry',
        raw_grant_or_url_published: false, guest_annotation_count: links.reduce((sum, page) => sum + page.length, 0), same_grant_for_all_video_links: access !== null, no_video_grant_scope_observable: access === null,
        independent_pdf_pixel_identity_compared: false, actual_worker_source_byte_proof_is_separate: true, validation: proof, pages });
    } finally { await task.destroy(); }
    require(sha(await readRegular(item.pdf_path, 64 * 1024 * 1024)) === item.pdf_sha256 && sha(await readRegular(item.snapshot_path, 8 * 1024 * 1024)) === sha(raw));
  }
  require(sha(await readRegular(INTENT, 1024 * 1024)) === sha(rawIntent) && JSON.stringify(before) === JSON.stringify(await sources()));
  const report = { observed_at: new Date().toISOString(), result: 'validated', scope: 'Offline authorized guest PDF inspection against frozen snapshot and its retained asset inventory; grant URL annotations only in memory', intent_composite_sha256: sha(rawIntent), source_sha256: before, sources_stable: true,
    cloud_or_provider_called: false, authenticated_browser_session_or_credentials_loaded: false, native_offline_layout_browser_used: true, private_facts_or_grant_urls_published: false, private_artifact_directory: relative, visual_inspection: 'pending_independent_page_review', hosting_deferred: true, exports };
  const serialized = JSON.stringify(report, null, 2) + '\n', evidence = `tracking/evidence/m06/live-artifacts/${stamp}.json`; await writePrivateGuestInspectionFile(path.join(folder, 'receipt.json'), new TextEncoder().encode(serialized)); await mkdir(path.join(ROOT, path.dirname(evidence)), { recursive: true }); await writeFile(path.join(ROOT, evidence), serialized, { flag: 'wx' });
  process.stdout.write(JSON.stringify({ result: 'validated', receipt: evidence, artifact_directory: relative, exports: exports.map(item => ({ version_id: item.version_id, export_id: item.export_id, page_count: item.validation.page_count })) }) + '\n');
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) main().catch(() => { process.stderr.write('M06 live artifact inspection unconfirmed; no private document text, URLs or grants were logged.\n'); process.exitCode = 1; });
