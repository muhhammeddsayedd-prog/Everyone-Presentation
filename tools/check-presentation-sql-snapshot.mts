import type { RenderSnapshot, PresentationManifest, PresentationVersion } from '../packages/domain/src/presentation-types.ts';
import { parseRenderSnapshot, parsePresentationManifest, parsePresentationVersion, manifestFromSnapshot, renderContextFromSnapshot,
  presentationCanonicalHash, presentationCanonicalJson } from '../packages/domain/src/presentation.ts';
import registry from '../packages/templates/versions/1.1.0/registry.json';
import { lstat, open, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
export interface SyntheticPresentationCapture {
  schema_version: '1.0'; kind: 'synthetic_presentation_capture'; synthetic: true; snapshot: RenderSnapshot; snapshot_sha256: string;
  manifest: PresentationManifest; manifest_sha256: string; inventory_sha256: string; version: PresentationVersion;
}
const fail = (): never => { throw new Error('SYNTHETIC_PRESENTATION_CAPTURE_UNCONFIRMED'); };
const requireValue = (value: unknown) => { if (!value) fail(); };
export async function checkSyntheticPresentationCapture(value: unknown): Promise<Record<string, unknown>> {
  try {
    const keys = ['schema_version', 'kind', 'synthetic', 'snapshot', 'snapshot_sha256', 'manifest', 'manifest_sha256', 'inventory_sha256', 'version'];
    requireValue(value && typeof value === 'object' && !Array.isArray(value)); const row = value as Record<string, unknown>;
    requireValue(Object.keys(row).length === keys.length && keys.every(key => Object.hasOwn(row, key))
      && row.schema_version === '1.0' && row.kind === 'synthetic_presentation_capture' && row.synthetic === true);
    for (const key of ['snapshot_sha256', 'manifest_sha256', 'inventory_sha256']) requireValue(typeof row[key] === 'string' && /^[a-f0-9]{64}$/u.test(row[key]));
    const snapshot = parseRenderSnapshot(row.snapshot); const manifest = parsePresentationManifest(row.manifest); const version = parsePresentationVersion(row.version);
    requireValue(snapshot.template.key === registry.key && snapshot.template.version === registry.version && snapshot.template.content_sha256 === registry.content_sha256
      && snapshot.template.font_key === registry.font_key && presentationCanonicalJson(snapshot.template.font_hashes) === presentationCanonicalJson(Object.fromEntries(registry.fonts.map(font => [font.path, font.sha256]))));
    requireValue(await presentationCanonicalHash(snapshot) === row.snapshot_sha256 && await presentationCanonicalHash(manifest) === row.manifest_sha256
      && await presentationCanonicalHash(snapshot.asset_inventory) === row.inventory_sha256
      && presentationCanonicalJson(manifestFromSnapshot(snapshot)) === presentationCanonicalJson(manifest));
    requireValue(version.id === snapshot.version_id && version.series_id === snapshot.series_id && version.version_no === snapshot.version_no
      && version.input_draft_revision === snapshot.input_draft_revision && version.input_fingerprint === snapshot.input_fingerprint
      && version.template_version === snapshot.template.version && version.manifest_hash === row.manifest_sha256 && version.created_at === snapshot.created_at
      && presentationCanonicalJson(version.slides) === presentationCanonicalJson(manifest.slides)
      && presentationCanonicalJson(version.render_context) === presentationCanonicalJson(renderContextFromSnapshot(snapshot)));
    return { schema_version: '1.0', result: 'validated_synthetic_capture', version_id: version.id, series_id: version.series_id, version_no: version.version_no,
      output_type: manifest.output_type, page_count: manifest.slides.length, candidate_slide_count: manifest.slides.filter(slide => slide.kind === 'candidate').length,
      pending_slide_count: manifest.slides.filter(slide => slide.kind === 'pending').length, asset_count: manifest.asset_inventory.length,
      frame_reference_count: snapshot.slides.reduce((sum, slide) => sum + slide.frames.length, 0), snapshot_sha256: row.snapshot_sha256,
      manifest_sha256: row.manifest_sha256, inventory_sha256: row.inventory_sha256, template_content_sha256: snapshot.template.content_sha256,
      render_context_matches: true, cloud_called: false, native_pdf_claimed: false };
  } catch { return fail(); }
}

const root = fileURLToPath(new URL('../', import.meta.url));
export const SYNTHETIC_PRESENTATION_FIXTURES = resolve(root, '.local/m05-contract-fixtures');
const samePath = (left: string, right: string) => process.platform === 'win32' ? left.toLowerCase() === right.toLowerCase() : left === right;
/** Only a directly named, regular JSON file in this task's synthetic fixture
 * folder is admitted. No environment, database or service configuration loads. */
export async function readSyntheticPresentationCapture(path: string): Promise<Record<string, unknown>> {
  try {
    requireValue(typeof path === 'string' && path.length <= 2000 && !/[\p{C}]/u.test(path)); const file = resolve(path);
    requireValue(samePath(dirname(file), SYNTHETIC_PRESENTATION_FIXTURES) && /^[A-Za-z0-9][A-Za-z0-9._-]{0,150}\.json$/u.test(basename(file)));
    requireValue(samePath(await realpath(SYNTHETIC_PRESENTATION_FIXTURES), SYNTHETIC_PRESENTATION_FIXTURES));
    const before = await lstat(file); requireValue(before.isFile() && !before.isSymbolicLink() && before.size > 0 && before.size <= 32 * 1024 * 1024
      && samePath(await realpath(file), file));
    const handle = await open(file, 'r'); let bytes: Buffer;
    try {
      const opened = await handle.stat(); requireValue(opened.ino === before.ino && opened.dev === before.dev && opened.size === before.size && opened.mtimeMs === before.mtimeMs);
      const parts: Buffer[] = []; let length = 0;
      for (;;) { const chunk = Buffer.allocUnsafe(65536); const part = await handle.read(chunk, 0, chunk.length, null); if (!part.bytesRead) break;
        length += part.bytesRead; requireValue(length <= 32 * 1024 * 1024); parts.push(chunk.subarray(0, part.bytesRead)); }
      const after = await handle.stat(); requireValue(after.size === before.size && after.mtimeMs === before.mtimeMs && length === before.size); bytes = Buffer.concat(parts);
    } finally { await handle.close(); }
    const result = await checkSyntheticPresentationCapture(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
    return { ...result, fixture_bytes_sha256: createHash('sha256').update(bytes).digest('hex') };
  } catch { return fail(); }
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  void (async () => {
    try { requireValue(process.argv.length === 3); process.stdout.write(JSON.stringify(await readSyntheticPresentationCapture(process.argv[2])) + '\n'); }
    catch { process.stdout.write(JSON.stringify({ result: 'unconfirmed', code: 'SYNTHETIC_PRESENTATION_CAPTURE_UNCONFIRMED', cloud_called: false }) + '\n'); process.exitCode = 1; }
  })();
}
