/** Fixed offline harness for one actual, already validated guest PDF link.
 * Import is inert; only the OwnerSYSTEM HTML contains the extracted raw URL. */
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { lstat, readFile, realpath, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { parseRenderSnapshot, presentationCanonicalHash } from '../packages/domain/src/presentation.ts';
import type { RenderSnapshot } from '../packages/domain/src/presentation-types.ts';
import { presentationExportVideoHref } from '../apps/worker/src/presentation-pdf.ts';
import { nativeBrowserEnvironment } from '../apps/worker/src/native-browser.ts';
import { inspectGuestMediaAnnotations } from './inspect-m06-live-pdf.mts';

const ROOT = path.resolve(import.meta.dirname, '..');
export const PLAYBACK_SCOPE = Object.freeze({ version: '796effc6-93d6-4602-97d7-c1199083114f', export: 'f6d03929-5e19-46cf-a4a4-b46bcbe59ea7', link: '46d13208-a02b-4c38-8cc6-fc84f00d38f6', video: '20c0ed17-5705-4056-a53d-9898384d4187', workspace: '098d5b48-42a3-475b-b562-735c9eafce80', series: '9a4a2218-b250-4004-817b-760912305770' });
const PDF = `.local/m06-live/export-${PLAYBACK_SCOPE.export}.pdf`, SNAPSHOT = `.local/m06-live/version-${PLAYBACK_SCOPE.version}.snapshot.json`, OUTPUT = '.local/m06-live/pdf-playback-v1.html';
const PDF_SHA = 'd208a1100088de429847507b1e482d2625b43219e86b1b20533fc83f4bc123e5', SNAPSHOT_SHA = 'f9e8d00dbb546762b253a75afeb945fc69a09e6b3a06e7724fb96843511bd805';
const INSPECTION = 'tracking/evidence/m06/live-artifacts/2026-10-30T01-49-43.094Z.json', INSPECTION_SHA = '4130c598fc4c3c003471477ad692e1e898159fcd7ad7dde3aa1d43181ee47ac5';
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
function require(value: unknown): asserts value { if (!value) throw Error('M06_FIXED_PDF_PLAYBACK_UNCONFIRMED'); }
export function extractedV1PlaybackTarget(snapshot: RenderSnapshot, pages: string[][]) {
  require(snapshot.version_id === PLAYBACK_SCOPE.version && snapshot.workspace_id === PLAYBACK_SCOPE.workspace && snapshot.series_id === PLAYBACK_SCOPE.series && snapshot.version_no === 1 && snapshot.audience_snapshot.scope === 'external');
  require(snapshot.asset_inventory.some(asset => asset.asset_id === PLAYBACK_SCOPE.video && asset.asset_kind === 'candidate_video'));
  const access = inspectGuestMediaAnnotations(snapshot, pages); require(access); const expected = presentationExportVideoHref(snapshot, PLAYBACK_SCOPE.video, access);
  const found = pages.flatMap((links, index) => links.filter(link => link === expected).map(href => ({ href, page: index + 1 })));
  require(found.length === 1 && found[0].href.startsWith('http://127.0.0.1:3000/m/')); return found[0];
}
export function playbackHarnessHtml(href: string) {
  require(new RegExp(`^http://127[.]0[.]0[.]1:3000/m/[A-Za-z0-9_-]{43}/versions/${PLAYBACK_SCOPE.version}/media/${PLAYBACK_SCOPE.video}$`, 'u').test(href));
  return `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; base-uri 'none'; form-action 'none'; object-src 'none'"><title>Extracted actual PDF link</title></head><body><h1>Extracted actual PDF link</h1><p>Offline inspection harness. The link below was extracted from the validated saved V1 guest PDF.</p><a href="${href}" target="_blank" rel="noopener noreferrer">Open original introduction from saved V1 PDF</a></body></html>\n`;
}
async function regular(file: string, maximum: number) { const full = path.join(ROOT, file), before = await lstat(full); require(before.isFile() && !before.isSymbolicLink() && before.size > 0 && before.size <= maximum && path.resolve(await realpath(full)).toLowerCase() === full.toLowerCase()); const raw = await readFile(full), after = await lstat(full); require(raw.length === before.size && before.ino === after.ino && before.dev === after.dev && before.size === after.size && before.mtimeMs === after.mtimeMs); return raw; }
async function privateFile(operation: '--verify-inputs' | '--write-html', bytes?: Uint8Array) {
  const text = await new Promise<string>((resolve, reject) => { const child = spawn(path.join(ROOT, '.venv-skills/Scripts/python.exe'), ['-X', 'utf8', path.join(ROOT, 'tools/m06-pdf-playback-private.py'), operation], { cwd: ROOT, shell: false, windowsHide: true, env: { ...nativeBrowserEnvironment(), NODE_ENV: 'production' }, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = 0, failed = false; const stop = () => { failed = true; child.kill(); }; const timer = setTimeout(stop, 15000); child.once('error', stop); child.stdin.on('error', () => {}); child.stdout.on('data', chunk => { stdout += chunk; if (stdout.length > 2048) stop(); }); child.stderr.on('data', chunk => { stderr += chunk.length; if (stderr > 2048) stop(); }); child.once('close', code => { clearTimeout(timer); if (failed || code !== 0) reject(Error('M06_FIXED_PDF_PLAYBACK_UNCONFIRMED')); else resolve(stdout); }); child.stdin.end(bytes ? Buffer.from(bytes) : undefined);
  }); return JSON.parse(text) as Record<string, unknown>;
}
class NoExternalData { async fetch(): Promise<never> { throw Error('EXTERNAL_RESOURCE_DENIED'); } }
async function main() {
  require(process.argv.length === 2); const verified = await privateFile('--verify-inputs'); require(verified.verified === true && verified.owner_system_only === true);
  const pdf = await regular(PDF, 67108864), raw = await regular(SNAPSHOT, 8388608), receipt = await regular(INSPECTION, 1048576); require(pdf.length === 113629 && sha(pdf) === PDF_SHA && sha(receipt) === INSPECTION_SHA);
  const snapshot = parseRenderSnapshot(JSON.parse(raw.toString('utf8'))); require(await presentationCanonicalHash(snapshot) === SNAPSHOT_SHA);
  const inspection = JSON.parse(receipt.toString('utf8')); require(inspection.result === 'validated' && inspection.sources_stable === true && inspection.private_facts_or_grant_urls_published === false && inspection.exports.length === 1);
  const saved = inspection.exports[0]; require(saved.version_id === PLAYBACK_SCOPE.version && saved.export_id === PLAYBACK_SCOPE.export && saved.review_link_id === PLAYBACK_SCOPE.link && saved.snapshot_sha256 === SNAPSHOT_SHA && saved.downloaded_pdf_sha256 === PDF_SHA && saved.validation.page_count === 6);
  const sources = ['tools/extract-m06-v1-pdf-playback.mts', 'tools/m06-pdf-playback-private.py', 'tools/provision_logo_verifier.py', 'tools/inspect-m06-live-pdf.mts']; const sourceHashes = async () => Object.fromEntries(await Promise.all(sources.map(async file => [file, sha(await regular(file, 1048576))]))); const before = await sourceHashes();
  const task = getDocument({ data: new Uint8Array(pdf), verbosity: 0, useWorkerFetch: false, useWasm: false, useSystemFonts: false, BinaryDataFactory: NoExternalData }); const document = await task.promise; let selected;
  try { require(document.numPages === 6); const links: string[][] = []; for (let n = 1; n <= document.numPages; n++) { const page = await document.getPage(n), annotations = await page.getAnnotations(); require(annotations.every(value => value.subtype === 'Link')); links.push(annotations.map(value => value.url as string)); page.cleanup(); } selected = extractedV1PlaybackTarget(snapshot, links); } finally { await task.destroy(); }
  const html = Buffer.from(playbackHarnessHtml(selected.href)), output = await privateFile('--write-html', html); require(output.written === true && output.owner_system_only === true && output.sha256 === sha(html) && output.bytes === html.length);
  require(sha(await regular(OUTPUT, 16384)) === sha(html) && sha(await regular(PDF, 67108864)) === PDF_SHA && sha(await regular(SNAPSHOT, 8388608)) === sha(raw) && JSON.stringify(before) === JSON.stringify(await sourceHashes()));
  const report = { observed_at: new Date().toISOString(), result: 'created', scope: 'OwnerSYSTEM offline harness containing one extracted actual validated saved PDF link; browser playback remains separate', version_id: PLAYBACK_SCOPE.version, export_id: PLAYBACK_SCOPE.export, review_link_id: PLAYBACK_SCOPE.link, video_asset_id: PLAYBACK_SCOPE.video, annotation_page: selected.page, pdf_sha256: PDF_SHA, snapshot_sha256: SNAPSHOT_SHA, inspection_receipt: INSPECTION, inspection_receipt_sha256: INSPECTION_SHA, html_path: OUTPUT, html_sha256: sha(html), owner_system_only: true, extracted_actual_pdf_link: true, raw_url_or_grant_published: false, cloud_or_network_called: false, browser_acceptance: false, source_sha256: before, sources_stable: true, hosting_deferred: true };
  const dir = path.join(ROOT, 'tracking/evidence/m06/pdf-playback-harness'); await mkdir(dir, { recursive: true }); const file = `tracking/evidence/m06/pdf-playback-harness/${report.observed_at.replaceAll(':', '-')}.json`; await writeFile(path.join(ROOT, file), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' }); process.stdout.write(JSON.stringify({ result: 'created', receipt: file, private_html: OUTPUT, video_asset_id: PLAYBACK_SCOPE.video, annotation_page: selected.page }) + '\n');
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) main().catch(() => { process.stderr.write('Fixed PDF playback harness unconfirmed; URLs and grants were suppressed.\n'); process.exitCode = 1; });
