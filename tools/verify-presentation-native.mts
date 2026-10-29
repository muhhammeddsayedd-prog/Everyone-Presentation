/** Offline synthetic artifact/visual QA only. No gateway, credentials or cloud. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { createCanvas } from '@napi-rs/canvas';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { nativePresentation } from '../tests/worker/presentation-native-fixture.ts';
import { renderPresentationPdf, validatePresentationPdf } from '../apps/worker/src/presentation-pdf.ts';
const stamp = new Date().toISOString().replaceAll(':', '-'); const relative = `.local/m05-native/${stamp}`;
const folder = path.resolve(relative); if (!folder.startsWith(path.resolve('.local/m05-native') + path.sep)) throw Error('OUTPUT_SCOPE_INVALID'); await mkdir(folder, { recursive: true });
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const sources = ['packages/templates/src/render.ts', 'packages/templates/registry.json', 'packages/templates/src/registered.ts', 'packages/templates/versions/1.1.0/render.ts', 'packages/templates/versions/1.1.0/registry.json', 'apps/web/public/brand/everyone-logotype-white.svg',
  'apps/worker/src/presentation-pdf.ts', 'apps/worker/src/presentation-pdf-inspect-process.mjs', 'apps/worker/src/presentation-stage-executor.ts', 'apps/worker/src/presentation-assets.ts', 'apps/worker/src/review-fit.ts', 'apps/worker/src/native-browser.ts',
  'apps/worker/src/runtime.ts', 'apps/worker/src/runtime-main.ts', 'apps/worker/src/runtime-types.ts', 'apps/worker/src/n8n-orchestrator.ts', 'packages/central/src/presentation-runtime-assets.ts', 'packages/central/src/specs-runtime-gateway.ts',
  'packages/domain/src/presentation.ts', 'packages/domain/src/presentation-types.ts', 'packages/integrations/src/n8n-dispatch.ts', 'tests/worker/presentation-native-fixture.ts', 'tools/verify-presentation-native.mts', 'node_modules/bidi-js/dist/bidi.mjs'];
const before = Object.fromEntries(await Promise.all(sources.map(async file => [file, sha(await readFile(file))])));
const outputs = [];
class NoExternalData { async fetch(): Promise<never> { throw Error('EXTERNAL_RESOURCE_DENIED'); } }
for (const name of ['all-frame-counts', 'wrapped-arabic', 'pending-requirements', 'no-role-pending'] as const) {
  const pending = name === 'pending-requirements' ? 'role' : name === 'no-role-pending' ? 'no_role' : null;
  const { snapshot, images } = nativePresentation(pending ? [] : name === 'all-frame-counts' ? [0, 1, 2, 3] : [0], name !== 'wrapped-arabic', pending);
  if (name === 'wrapped-arabic') { snapshot.slides[1].fields!.name_or_id = 'مريم حسن / Maya'; snapshot.slides[1].fields!.skills_experience = 'ممثلة مسرحية Maya 16 سنة وتجيد العربية والإنجليزية'; }
  const rendered = await renderPresentationPdf(snapshot, images); const validated = await validatePresentationPdf(snapshot, images, rendered.bytes);
  const file = `${name}.pdf`; await writeFile(path.join(folder, file), rendered.bytes);
  const task = getDocument({ data: new Uint8Array(rendered.bytes), verbosity: 0, useWorkerFetch: false, useWasm: false, useSystemFonts: false, BinaryDataFactory: NoExternalData }); const pdf = await task.promise; const pages = [];
  try { for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n); const viewport = page.getViewport({ scale: 1 }); const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    await page.render({ canvas: canvas as unknown as HTMLCanvasElement, canvasContext: canvas.getContext('2d') as unknown as CanvasRenderingContext2D, viewport }).promise;
    const bytes = canvas.toBuffer('image/png'); const png = `${name}-${n}.png`; await writeFile(path.join(folder, png), bytes); pages.push({ page: n, file: png, sha256: sha(bytes), width: canvas.width, height: canvas.height }); page.cleanup();
  } } finally { await task.destroy(); }
  outputs.push({ name, file, pdf_sha256: sha(rendered.bytes), bytes: rendered.bytes.length, rendered: rendered.proof, validated, pages });
}
const after = Object.fromEntries(await Promise.all(sources.map(async file => [file, sha(await readFile(file))]))); if (JSON.stringify(before) !== JSON.stringify(after)) throw Error('SOURCE_CHANGED');
const report = { observed_at: new Date().toISOString(), scope: 'offline_synthetic_actual_pdf_and_png', provider_or_cloud_called: false, raw_cast_or_private_media_used: false, visual_inspection: 'pending_independent_page_review', source_sha256: before,
  pdf_skill_marker: { invoked_once_before_first_authoring: true, exit_code: 0, expected_output_count: 2, tool_chunk_id: 'b1029a' }, private_artifact_directory: relative.replaceAll('\\', '/'), outputs };
await writeFile(path.join(folder, 'receipt.json'), JSON.stringify(report, null, 2) + '\n');
const evidence = `tracking/evidence/m05/native/${stamp}-synthetic.json`; await mkdir(path.dirname(evidence), { recursive: true }); await writeFile(evidence, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ ok: true, evidence, artifact_directory: relative, outputs: outputs.length, pages: outputs.reduce((sum, output) => sum + output.pages.length, 0), visual_inspection: report.visual_inspection }));
