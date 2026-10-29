/** Read-only negative Storage proof. No JWT export, database operation, signed
 * URL, object mutation, provider call or source-body consumption. Only a
 * bounded legacy400 JSON error is inspected privately for canonical denial. */
import { writeFile } from 'node:fs/promises';
import { Buffer } from 'node:buffer';
import { TextDecoder } from 'node:util';
import { setTimeout, clearTimeout } from 'node:timers';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { loadWorkerFilesEnvironment } from './worker-files-env.mjs';

// Fill only with the actual Ready originals from root's successful app jobs.
// No CLI target/asset arguments; null deliberately refuses before any IO.
const ACTUAL_ORIGINALS = [
  { asset_id: '64e07944-43b9-46a0-aef2-92430a38773c', mime_type: 'application/pdf' },
  { asset_id: 'f94b4d49-e3d7-41cb-b936-a03570b3ccf3', mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
];
const ORIGIN = 'https://pyibofyctwnqpvktepse.supabase.co';
const MIME_EXTENSIONS = { 'application/pdf': 'pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx', 'text/plain': 'txt' };
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u;
const INVALID_GRANT = Buffer.alloc(32).toString('base64url');
const MAXIMUM_ERROR_BYTES = 8 * 1024;
async function legacyDenial(response, deadline, inspected) {
  if ((response.headers?.get('content-type') ?? '').split(';')[0].trim().toLowerCase() !== 'application/json' || !response.body) return false;
  const advertised = response.headers.get('content-length');
  if (advertised !== null && (!/^[0-9]+$/u.test(advertised) || Number(advertised) > MAXIMUM_ERROR_BYTES)) return false;
  const reader = response.body.getReader(); const chunks = []; let size = 0;
  try {
    for (;;) {
      const next = await Promise.race([reader.read(), deadline]); if (next.done) break;
      if (!(next.value instanceof Uint8Array)) return false;
      if (next.value.byteLength) inspected();
      size += next.value.byteLength; if (size > MAXIMUM_ERROR_BYTES) return false;
      chunks.push(next.value);
    }
    const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks, size)));
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      && (value.code === 'NoSuchKey' && value.statusCode === '404' || value.code === 'AccessDenied' && value.statusCode === '403');
  } catch { return false; }
  finally { void reader.cancel().catch(() => {}); try { reader.releaseLock(); } catch { /* No private diagnostics. */ } }
}
/** Injected transport/config and small timeout are offline test seams only. */
export async function probeSpecsStorageDenials(originals, { loadFiles = loadWorkerFilesEnvironment, fetch: request = globalThis.fetch, timeoutMs = 10_000 } = {}) {
  const report = { result: 'unconfirmed', http_requests: 0, source_bodies_read: false, error_bodies_inspected: false, object_mutations_requested: false,
    user_credentials_loaded: false, database_called: false, provider_called: false, checks: [] };
  try {
    if (!Array.isArray(originals) || originals.length < 1 || originals.length > 2 || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 10_000) return report;
    const assets = originals.map(item => {
      if (!item || typeof item !== 'object' || Array.isArray(item) || Object.keys(item).length !== 2) throw new Error('Fixed originals required.');
      const { asset_id, mime_type } = item;
      if (typeof asset_id !== 'string' || !UUID.test(asset_id) || !Object.hasOwn(MIME_EXTENSIONS, mime_type)) throw new Error('Fixed originals required.');
      return { asset_id, extension: MIME_EXTENSIONS[mime_type] };
    });
    if (new Set(assets.map(item => item.asset_id)).size !== assets.length) return report;
    const configuration = await loadFiles({ environment: { EPS_SPECS_FILES_ENABLED: 'true' } });
    const key = configuration.SUPABASE_PUBLISHABLE_KEY;
    if (configuration.SUPABASE_URL !== ORIGIN || typeof key !== 'string' || key.length > 4096 || !/^sb_publishable_[A-Za-z0-9_-]{8,}$/u.test(key)) return report;
    for (const asset of assets) for (const mode of ['missing_capability', 'invalid_capability']) {
      const controller = new globalThis.AbortController(); let timer; let response;
      try {
        const timeout = new Promise((_resolve, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('Read check unconfirmed.')); }, timeoutMs); });
        report.http_requests++;
        response = await Promise.race([request(`${ORIGIN}/storage/v1/object/authenticated/eps-specs-assets/assets/${asset.asset_id}/original.${asset.extension}`, {
          method: 'GET', headers: { apikey: key, authorization: `Bearer ${key}`, 'Accept-Encoding': 'identity',
            ...(mode === 'invalid_capability' ? { 'x-eps-asset-grant': INVALID_GRANT } : {}) },
          redirect: 'error', cache: 'no-store', signal: controller.signal,
        }), timeout]);
        const status = response.status;
        const legacy = status === 400 && await legacyDenial(response, timeout, () => { report.error_bodies_inspected = true; });
        const denied = status === 403 || status === 404 || legacy;
        report.checks.push({ asset_id: asset.asset_id, case: mode, http_status: Number.isSafeInteger(status) ? status : null, denied, legacy_error_matched: legacy });
        if (status >= 200 && status < 300) { report.result = 'unsafe'; return report; }
        if (!denied) return report;
      } finally { clearTimeout(timer); controller.abort(); void response?.body?.cancel().catch(() => {}); }
    }
    report.result = 'passed'; return report;
  } catch { return report; }
}
async function main() {
  if (process.argv.length !== 2 || !/^v24\./u.test(process.version) || ACTUAL_ORIGINALS === null) throw new Error('Actual Ready originals must be fixed first.');
  const report = { observed_at: new Date().toISOString(), ...await probeSpecsStorageDenials(ACTUAL_ORIGINALS) };
  const file = path.resolve(import.meta.dirname, '../tracking/evidence/m02/specs-runtime', report.observed_at.replace(/[:.]/gu, '-') + '-storage-denials.json');
  await writeFile(file, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' }); process.stdout.write(JSON.stringify(report) + '\n');
  if (report.result !== 'passed') process.exitCode = 1;
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) main().catch(() => {
  process.stderr.write('Storage denial check remains unconfirmed. Actual Ready originals are required; private diagnostics are suppressed.\n'); process.exitCode = 1;
});
