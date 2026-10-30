/** Root-executed fixed QA transport comparison. Import is inert. Secret session
 * digests arrive only on stdin; gateway grants remain in memory. No app changes. */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { parseEnv } from 'node:util';
import { pathToFileURL } from 'node:url';
import { DomainError } from '@eps/domain';
import { guestAssetRead, createGuestAssetProxy } from '../packages/central/src/guest-storage.ts';
import { readCentralConfig, type CentralConfig } from '../packages/central/src/config.ts';
import { presentationExportDto } from '../packages/domain/src/guest.ts';
import { reviewKey, signReviewGateway } from '../packages/central/src/review-credentials.ts';
import { loadPrivateGuestEnvironment } from './private-guest-env.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
export const DIAGNOSTIC_SCOPE = Object.freeze({ version: '796effc6-93d6-4602-97d7-c1199083114f', frame: 'e6285fb5-eb94-4fb0-90ab-27475cd51842', frame_session: '4ff69576-acc4-4a7c-8377-8250e26ccf32', frame_link: '720a0969-f0d6-4280-9733-e72e57d90cfa', pdf_session: 'b6865104-bbf0-4b1c-a4dc-645278274d13', pdf_link: '46d13208-a02b-4c38-8cc6-fc84f00d38f6', pdf_export: 'f6d03929-5e19-46cf-a4a4-b46bcbe59ea7' });
interface DiagnosticInput { schema_version: '1.0'; frame_session_digest: string; pdf_session_digest: string }
interface Observation { asset: 'frame' | 'pdf'; phase: 'gateway_export' | 'gateway_asset' | 'metadata' | 'storage_headers' | 'storage_body' | 'proxy'; transport?: 'current' | 'apikey_only' | 'authenticated_path' | 'apikey_only_authenticated_path'; result: 'passed' | 'failed'; http_status?: number; code?: string; size_bytes?: number; body_sha256?: string; body_truncated?: boolean; mime_matches?: boolean; length_matches?: boolean; provider_code?: string; sqlstate?: string }
const CODES = new Set(['REVIEW_ACCESS_DENIED', 'RESOURCE_NOT_FOUND', 'DEPENDENCY_UNAVAILABLE', 'SOURCE_UNREADABLE', 'RANGE_NOT_SATISFIABLE', 'GUEST_RESPONSE_INVALID', 'REVIEW_UNAVAILABLE', 'DOWNLOAD_DISABLED', 'VERSION_NOT_READY', 'ASSET_UNAVAILABLE', 'REVIEW_CONFIGURATION_REQUIRED', 'CENTRAL_CONFIGURATION_REQUIRED']);
function require(value: unknown): asserts value { if (!value) throw new DomainError('GUEST_RESPONSE_INVALID', 'The fixed diagnostic scope could not be confirmed.', 502); }
export function parseDiagnosticInput(value: unknown): DiagnosticInput {
  require(value && typeof value === 'object' && !Array.isArray(value)); const row = value as Record<string, unknown>;
  require(Object.keys(row).length === 3 && row.schema_version === '1.0' && typeof row.frame_session_digest === 'string' && /^[a-f0-9]{64}$/u.test(row.frame_session_digest) && typeof row.pdf_session_digest === 'string' && /^[a-f0-9]{64}$/u.test(row.pdf_session_digest));
  return structuredClone(value) as DiagnosticInput;
}
const safeCode = (error: unknown) => error instanceof DomainError && CODES.has(error.code) ? error.code : 'DEPENDENCY_UNAVAILABLE';
async function boundedErrorFingerprint(response: Response) {
  const reader = response.clone().body?.getReader(); const hash = createHash('sha256'), chunks: Uint8Array[] = []; let size = 0, truncated = false;
  if (reader) try { for (;;) { const item = await reader.read(); if (item.done) break; const part = item.value.subarray(0, 16384 - size); hash.update(part); chunks.push(part); size += part.length; if (item.value.length > part.length || size === 16384) { truncated = true; void reader.cancel().catch(() => {}); break; } } } finally { reader.releaseLock(); }
  let provider: string | undefined, state: string | undefined;
  if (!truncated) try { const row = JSON.parse(Buffer.concat(chunks).toString('utf8')); const allowed = new Set(['InvalidJWT', 'InvalidSignature', 'AccessDenied', 'NoSuchKey', 'NoSuchBucket', 'InvalidRequest', 'DatabaseTimeout', 'DatabaseError', 'InternalError', 'Internal Server Error', 'Bad Request']);
    for (const value of [row.code, row.error, row.error?.code]) if (typeof value === 'string' && allowed.has(value)) provider = value;
    const states = new Set(['42501', '42P01', '42703', '42883', '22P02', '22023', '23503', '23505', '54001', '57014', '42P17', 'XX000']);
    for (const value of [row.code, row.sqlstate, row.sqlState, row.error?.code, row.error?.sqlstate, typeof row.message === 'string' ? /\(SQLSTATE ([0-9A-Z]{5})\)/u.exec(row.message)?.[1] : undefined]) if (typeof value === 'string' && states.has(value)) state = value;
  } catch { /* Provider text stays private and is never printed. */ }
  return { size_bytes: size, body_sha256: hash.digest('hex'), body_truncated: truncated, ...(provider ? { provider_code: provider } : {}), ...(state ? { sqlstate: state } : {}) };
}
export async function runGuestStorageDiagnostic(value: unknown, options: { config: CentralConfig; gatewayKey: Uint8Array; fetch: typeof fetch; now?: () => number }) {
  const input = parseDiagnosticInput(value), now = options.now ?? Date.now, observations: Observation[] = [];
  const secrets = [input.frame_session_digest, input.pdf_session_digest, Buffer.from(options.gatewayKey).toString('hex')];
  async function rpc(asset: 'frame' | 'pdf', phase: 'gateway_export' | 'gateway_asset', operation: string, body: Record<string, unknown>) {
    const response = await options.fetch(new URL('/rest/v1/rpc/eps_guest_operation', options.config.url), { method: 'POST', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000), headers: { apikey: options.config.publishableKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_operation: operation, p_input: body, p_proof: signReviewGateway(operation, body, options.gatewayKey, now()) }) });
    if (!response.ok) { observations.push({ asset, phase, result: 'failed', http_status: response.status, ...(await boundedErrorFingerprint(response)) }); throw new DomainError('DEPENDENCY_UNAVAILABLE', 'The gateway diagnostic was denied.', 503); }
    const raw = await response.text(); require(Buffer.byteLength(raw) <= 65536); observations.push({ asset, phase, result: 'passed', http_status: response.status }); return JSON.parse(raw) as unknown;
  }
  for (const kind of ['frame', 'pdf'] as const) {
    try {
      let expectedPdfAsset: string | null = null;
      if (kind === 'pdf') { const row = presentationExportDto(await rpc(kind, 'gateway_export', 'get_export', { session_digest: input.pdf_session_digest, export_id: DIAGNOSTIC_SCOPE.pdf_export })); require(row.id === DIAGNOSTIC_SCOPE.pdf_export && row.review_link_id === DIAGNOSTIC_SCOPE.pdf_link && row.version_id === DIAGNOSTIC_SCOPE.version && row.status === 'ready' && row.pdf_asset_id); expectedPdfAsset = row.pdf_asset_id; }
      const source = guestAssetRead(await rpc(kind, 'gateway_asset', kind === 'frame' ? 'get_asset' : 'get_export_asset', kind === 'frame' ? { session_digest: input.frame_session_digest, version_id: DIAGNOSTIC_SCOPE.version, asset_id: DIAGNOSTIC_SCOPE.frame, purpose: 'frame' } : { session_digest: input.pdf_session_digest, export_id: DIAGNOSTIC_SCOPE.pdf_export }), now());
      require(kind === 'frame' ? source.asset.id === DIAGNOSTIC_SCOPE.frame && source.asset.purpose === 'candidate_frame' : source.asset.id === expectedPdfAsset && source.asset.purpose === 'presentation_pdf');
      secrets.push(source.grant_token); observations.push({ asset: kind, phase: 'metadata', result: 'passed' });
      for (const transport of ['current', 'apikey_only', 'authenticated_path', 'apikey_only_authenticated_path'] as const) {
        try {
          const proxy = createGuestAssetProxy(options.config, { now, timeoutMs: 8000, fetch: async (url, init) => {
            const headers = new Headers(init?.headers); if (transport === 'apikey_only' || transport === 'apikey_only_authenticated_path') headers.delete('Authorization');
            const target = new URL(String(url)); require(target.origin === options.config.url && target.pathname.startsWith('/storage/v1/object/'));
            if (transport === 'authenticated_path' || transport === 'apikey_only_authenticated_path') target.pathname = target.pathname.replace('/storage/v1/object/', '/storage/v1/object/authenticated/');
            const response = await options.fetch(target, { ...init, headers }); const okay = response.status === 200;
            observations.push({ asset: kind, phase: 'storage_headers', transport, result: okay ? 'passed' : 'failed', http_status: response.status,
              mime_matches: response.headers.get('content-type')?.split(';')[0].trim() === source.asset.mime_type, length_matches: response.headers.get('content-length') === String(source.asset.size_bytes), ...(!okay ? await boundedErrorFingerprint(response) : {}) });
            return response;
          } });
          const content = await proxy.read(source), reader = content.body.getReader(), hash = createHash('sha256'); let size = 0;
          try { for (;;) { const part = await reader.read(); if (part.done) break; size += part.value.length; require(size <= source.asset.size_bytes); hash.update(part.value); } } finally { reader.releaseLock(); }
          require(size === source.asset.size_bytes); const digest = hash.digest('hex'); require(digest === source.asset.sha256); observations.push({ asset: kind, phase: 'storage_body', transport, result: 'passed', http_status: content.status, size_bytes: size, body_sha256: digest });
        } catch (error) { observations.push({ asset: kind, phase: 'proxy', transport, result: 'failed', code: safeCode(error) }); }
      }
    } catch (error) { observations.push({ asset: kind, phase: 'metadata', result: 'failed', code: safeCode(error) }); }
  }
  const report = { observed_at: new Date(now()).toISOString(), result: 'diagnosed', scope: 'Trusted backend fixed QA session capability and Storage transport diagnostic; no browser acceptance', observations, same_short_capability_per_transport_pair: true, production_proxy_modified: false, ordinary_gateway_capabilities_may_be_issued: true, private_values_published: false, hosting_deferred: true };
  const serialized = JSON.stringify(report); require(!secrets.some(secret => serialized.includes(secret)) && !serialized.includes(options.config.url) && !serialized.includes(options.config.publishableKey)); return report;
}
async function main() {
  require(process.argv.length === 2); const chunks = []; let size = 0; for await (const chunk of process.stdin) { size += chunk.length; require(size <= 2048); chunks.push(chunk); }
  const input = parseDiagnosticInput(JSON.parse(Buffer.concat(chunks).toString('utf8'))), environment = await loadPrivateGuestEnvironment();
  const raw = await readFile(path.join(ROOT, 'apps/web/.env.local')); require(raw.length <= 1048576); const config = readCentralConfig(parseEnv(raw.toString('utf8'))); require(config.url === 'https://pyibofyctwnqpvktepse.supabase.co');
  const report = await runGuestStorageDiagnostic(input, { config, gatewayKey: reviewKey(environment.EPS_REVIEW_GATEWAY_KEY), fetch }); process.stdout.write(JSON.stringify(report) + '\n');
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) main().catch(() => { process.stderr.write('Fixed M06 Storage diagnostic unconfirmed; private values were suppressed.\n'); process.exitCode = 1; });
