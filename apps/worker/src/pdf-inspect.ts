import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DOCUMENT_LIMITS, DocumentPreparationError, normalizeSourceText } from './types.ts';
const source = fileURLToPath(new URL('./', import.meta.url)); const dependencies = fileURLToPath(new URL('../../../node_modules/', import.meta.url));
const entry = fileURLToPath(new URL('./pdf-inspect-process.mjs', import.meta.url));
export interface PdfTextPages { source_asset_id: string; source_sha256: string; pages: { page: number; text: string }[] }
function fail(code = 'SOURCE_UNREADABLE'): never { throw new DocumentPreparationError(code, 'The PDF page structure could not be read. The original was retained.'); }
export async function inspectPdfTextIsolated(bytes: Uint8Array, sourceAssetId: string, signal?: AbortSignal): Promise<PdfTextPages> {
  if (!(bytes instanceof Uint8Array) || !bytes.length || bytes.length > DOCUMENT_LIMITS.maximumBytes || typeof sourceAssetId !== 'string' || !/^[A-Za-z0-9._:-]{1,200}$/u.test(sourceAssetId)) fail();
  const snapshot = Buffer.from(bytes); const hash = createHash('sha256').update(snapshot).digest('hex');
  const text = await new Promise<string>((resolve, reject) => {
    const environment: NodeJS.ProcessEnv = { NODE_ENV: 'production' }; for (const name of ['SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'LANG']) if (process.env[name]) environment[name] = process.env[name];
    const child = spawn(process.execPath, ['--max-old-space-size=256', '--permission', '--allow-addons', `--allow-fs-read=${source}`, `--allow-fs-read=${dependencies}`, entry], { shell: false, windowsHide: true, cwd: source, env: environment, stdio: ['pipe', 'pipe', 'pipe'] });
    const chunks: Buffer[] = []; let size = 0; let diagnostic = 0; let problem: string | undefined;
    const stop = (code: string) => { problem ??= code; child.kill('SIGKILL'); }; const cancel = () => stop('DOCUMENT_PREPARATION_CANCELLED'); const timer = setTimeout(() => stop('DOCUMENT_PREPARATION_TIMEOUT'), 30_000);
    signal?.addEventListener('abort', cancel, { once: true }); child.on('error', () => { problem ??= 'DOCUMENT_PROCESS_FAILED'; }); child.stdin.on('error', () => {});
    child.stdout.on('data', (chunk: Buffer) => { size += chunk.length; if (size > 24 * 1024 * 1024) stop('DOCUMENT_LIMIT_EXCEEDED'); else chunks.push(chunk); });
    child.stderr.on('data', (chunk: Buffer) => { diagnostic += chunk.length; if (diagnostic > 65536) stop('DOCUMENT_PROCESS_FAILED'); });
    child.on('close', code => { clearTimeout(timer); signal?.removeEventListener('abort', cancel); if (problem || code !== 0) reject(new DocumentPreparationError(problem ?? 'DOCUMENT_PROCESS_FAILED', 'PDF page inspection could not complete.')); else resolve(Buffer.concat(chunks).toString('utf8')); });
    if (signal?.aborted) cancel(); child.stdin.end(JSON.stringify({ source_asset_id: sourceAssetId, bytes: snapshot.toString('base64') }));
  });
  let envelope; try { envelope = JSON.parse(text); } catch { return fail(); }
  if (envelope?.ok === false && ['SOURCE_UNREADABLE', 'DOCUMENT_ENCRYPTED', 'DOCUMENT_LIMIT_EXCEEDED', 'DOCUMENT_EXTERNAL_RESOURCE_REQUIRED'].includes(envelope.code)) fail(envelope.code);
  const value = envelope?.result;
  if (envelope?.ok !== true || value?.source_asset_id !== sourceAssetId || value?.source_sha256 !== hash || !Array.isArray(value.pages) || value.pages.length < 1 || value.pages.length > 200) fail();
  let size = 0; for (const [index, page] of value.pages.entries()) { if (!page || Object.keys(page).sort().join(',') !== 'page,text' || page.page !== index + 1 || typeof page.text !== 'string') fail(); page.text = normalizeSourceText(page.text); size += page.text.length; if (size > DOCUMENT_LIMITS.maximumTextCharacters) fail('DOCUMENT_LIMIT_EXCEEDED'); }
  return value;
}
