/** Fixed synthetic SQL-capture -> native PDF proof. No DB or service invocation. */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createCanvas } from '@napi-rs/canvas';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { parseRenderSnapshot, manifestFromSnapshot, presentationCanonicalHash, presentationCanonicalJson } from '../packages/domain/src/presentation.ts';
import { renderPresentationPdf, validatePresentationPdf } from '../apps/worker/src/presentation-pdf.ts';
const cases = [
  { file: '.local/m05-contract-fixtures/capture-0.json', sha256: 'f9780f8c5aad35aa3eed3de72ab07c1e3e32a03b4ca0657c413e75bdb0a656a9', output: 'selection', candidates: 6, pending: 1, pages: 8 },
  { file: '.local/m05-contract-fixtures/capture-1.json', sha256: '23fb4cf53baa3b05af6f176b83e61004aa4bc766734c81d95a45fd78070f403a', output: 'shortlist', candidates: 3, pending: 2, pages: 6 },
] as const;
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const stamp = new Date().toISOString().replaceAll(':', '-'); const relative = `.local/m05-sql-native/${stamp}`; const folder = path.resolve(relative);
if (!folder.startsWith(path.resolve('.local/m05-sql-native') + path.sep)) throw Error('OUTPUT_SCOPE_INVALID'); await mkdir(folder, { recursive: true });
const sources = ['tools/verify-m05-sql-pdf.mts', 'apps/worker/src/presentation-pdf.ts', 'apps/worker/src/presentation-pdf-inspect-process.mjs', 'apps/worker/src/review-fit.ts', 'apps/worker/src/native-browser.ts', 'packages/domain/src/presentation.ts', 'packages/domain/src/presentation-types.ts', 'packages/templates/src/registered.ts', 'packages/templates/src/render.ts', 'packages/templates/registry.json', 'packages/templates/versions/1.1.0/render.ts', 'packages/templates/versions/1.1.0/registry.json', 'apps/web/public/brand/everyone-logotype-white.svg', 'node_modules/bidi-js/dist/bidi.mjs'];
const before = Object.fromEntries(await Promise.all(sources.map(async file => [file, sha(await readFile(file))]))); const outputs = [];
class NoExternalData { async fetch(): Promise<never> { throw Error('EXTERNAL_RESOURCE_DENIED'); } }
for (const item of cases) {
  const bytes = await readFile(item.file); if (sha(bytes) !== item.sha256) throw Error('SYNTHETIC_CAPTURE_CHANGED');
  const value = JSON.parse(bytes.toString('utf8')); if (value.synthetic !== true || value.schema_version !== '1.0') throw Error('SYNTHETIC_SCOPE_REQUIRED');
  const snapshot = parseRenderSnapshot(value.snapshot); const manifest = manifestFromSnapshot(snapshot);
  if (snapshot.cover.output_type !== item.output || snapshot.asset_inventory.length !== 0 || await presentationCanonicalHash(snapshot) !== value.snapshot_sha256 || await presentationCanonicalHash(manifest) !== value.manifest_sha256 || await presentationCanonicalHash(snapshot.asset_inventory) !== value.inventory_sha256 || presentationCanonicalJson(manifest) !== presentationCanonicalJson(value.manifest)) throw Error('CAPTURE_BINDING_INVALID');
  const candidates = snapshot.slides.filter(slide => slide.kind === 'candidate'); const pending = snapshot.slides.filter(slide => slide.kind === 'pending');
  const calculated = 1 + candidates.length + pending.length;
  if (candidates.length !== item.candidates || pending.length !== item.pending || calculated !== item.pages || snapshot.slides.length !== calculated || snapshot.slides[0].kind !== 'cover' || new Set(candidates.map(slide => slide.assignment_id)).size !== candidates.length) throw Error('INCLUSION_INVALID');
  const rendered = await renderPresentationPdf(snapshot, new Map()); const validated = await validatePresentationPdf(snapshot, new Map(), rendered.bytes);
  if (validated.page_count !== calculated) throw Error('PAGE_COUNT_INVALID');
  const file = `${item.output}.pdf`; await writeFile(path.join(folder, file), rendered.bytes); const pages = [];
  const task = getDocument({ data: new Uint8Array(rendered.bytes), verbosity: 0, useWorkerFetch: false, useWasm: false, useSystemFonts: false, BinaryDataFactory: NoExternalData }); const pdf = await task.promise;
  try { for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n); const viewport = page.getViewport({ scale: 1 }); const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    await page.render({ canvas: canvas as unknown as HTMLCanvasElement, canvasContext: canvas.getContext('2d') as unknown as CanvasRenderingContext2D, viewport }).promise;
    const png = canvas.toBuffer('image/png'); const filename = `${item.output}-${n}.png`; await writeFile(path.join(folder, filename), png); pages.push({ page: n, file: filename, sha256: sha(png), width: canvas.width, height: canvas.height }); page.cleanup();
  } } finally { await task.destroy(); }
  outputs.push({ output_type: item.output, capture_file: item.file, capture_sha256: item.sha256, snapshot_sha256: value.snapshot_sha256, manifest_sha256: value.manifest_sha256, inventory_sha256: value.inventory_sha256,
    snapshot_unchanged: true, manifest_unchanged: true, candidate_slides: candidates.length, pending_slides: pending.length, independently_calculated_pages: calculated,
    distinct_candidate_count: new Set(candidates.map(slide => slide.candidate_id)).size, repeated_person_assignment_pages: candidates.length - new Set(candidates.map(slide => slide.candidate_id)).size,
    inventory_count: 0, file, pdf_sha256: sha(rendered.bytes), bytes: rendered.bytes.length, render_proof: rendered.proof, validation_proof: validated, pages });
}
for (const item of cases) if (sha(await readFile(item.file)) !== item.sha256) throw Error('SYNTHETIC_CAPTURE_CHANGED');
const after = Object.fromEntries(await Promise.all(sources.map(async file => [file, sha(await readFile(file))]))); if (JSON.stringify(before) !== JSON.stringify(after)) throw Error('SOURCE_CHANGED');
const report = { observed_at: new Date().toISOString(), scope: 'fixed_synthetic_sql_capture_to_actual_native_pdf', database_or_provider_called_by_this_tool: false, real_cast_or_private_media_used: false,
  template_version: '1.1.0', template_content_sha256: 'bbe72bf2bb08f37fe394c75563e2eca3ab8da72b1775db75704d47ae54f4f638', source_sha256: before, private_artifact_directory: relative,
  visual_inspection: 'pending_independent_page_review', outputs,
  limitations: ['Synthetic immutable captures provided by DB fixture harness; no live canonical DB read or app download by this tool.', 'Empty selected media is a supported source fixture; real geometric image coverage is separately proven by native representative artifacts.', 'No maximum-capacity, hosting, guest or production claim.'] };
const evidence = `tracking/evidence/m05/native/${stamp}-sql-capture-pdf.json`; await mkdir(path.dirname(evidence), { recursive: true }); await writeFile(evidence, JSON.stringify(report, null, 2) + '\n'); await writeFile(path.join(folder, 'receipt.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ ok: true, evidence, artifact_directory: relative, outputs: outputs.map(output => ({ output_type: output.output_type, pages: output.validation_proof.page_count, candidates: output.candidate_slides, pending: output.pending_slides, snapshot_unchanged: true })) }));
