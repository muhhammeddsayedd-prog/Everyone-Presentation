/** Fixed-host public admission preflight. Importing never performs a request. */
import { createHash, randomUUID } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL, URL } from 'node:url';
import { TextDecoder } from 'node:util';

const ROOT = path.resolve(import.meta.dirname, '../../..');
export const HOST_ORIGIN = 'https://everyone-presentation-pilot.vercel.app';
const CONFIGURE_RECEIPT = 'tracking/evidence/m07/controlled-pilot/2026-10-30T20-31-58-027Z-15649709-web-configure.json';
const CONFIGURE_SHA = '6ee2607d401f5ec1b6397a205bfe36d2ec34598e9d3fd15cc8c2f2c162d299d5';
const CHECKS = [
  { path: '/', status: 307, kind: 'canonical_navigation' },
  { path: '/projects', status: 200, kind: 'shell' },
  { path: '/api/session', status: 200, kind: 'signed_out' },
  { path: '/api/v1/projects', status: 401, kind: 'AUTH_REQUIRED' },
  { path: '/api/v1/settings', status: 401, kind: 'AUTH_REQUIRED' },
  { path: '/api/dev/session', status: 403, kind: 'ACCESS_DENIED' },
];
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value, keys) => object(value) && Object.keys(value).sort().join(',') === keys.slice().sort().join(',');

export function validateConfiguredTarget(value) {
  const p = value?.project;
  if (!object(p) || p.id !== 'prj_7xOsfRtvJ9voYi7rTEfra5ncOoA0' || p.account_id !== 'team_gboXPxTevpCOZuaA8eY9PmR1'
    || p.name !== 'everyone-presentation-pilot' || p.framework !== 'nextjs' || p.root_directory !== 'apps/web'
    || p.node_version !== '24.x' || p.outside_workspace_files !== true || !Array.isArray(value.domains) || value.domains.length !== 1
    || value.domains[0]?.name !== new URL(HOST_ORIGIN).hostname || value.domains[0]?.verified !== true) throw new Error('PILOT_PUBLIC_TARGET_UNCONFIRMED');
}

async function boundedText(response) {
  const reader = response.body?.getReader(); if (!reader) throw new Error('BODY_UNAVAILABLE');
  const chunks = []; let size = 0;
  try {
    for (;;) {
      const part = await reader.read(); if (part.done) break;
      size += part.value.byteLength;
      if (size > 256 * 1024) { await reader.cancel(); throw new Error('BODY_TOO_LARGE'); }
      chunks.push(part.value);
    }
  } finally { reader.releaseLock(); }
  return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
}

/** No retries, cookies, credentials, selectors, redirects or provider decisions.
 * Receipts contain closed booleans/statuses only, never raw headers/body/errors. */
export async function probePublicHost(fetcher = globalThis.fetch) {
  const checks = [];
  for (const expected of CHECKS) {
    const result = { path: expected.path, expected_status: expected.status, status: null, redirect_blocked: false,
      nosniff: false, no_set_cookie: false, private_no_store: false, expected_public_shape: false, request_id: null, passed: false };
    try {
      const url = HOST_ORIGIN + expected.path;
      const response = await fetcher(url, { method: 'GET', redirect: 'manual', credentials: 'omit', cache: 'no-store',
        headers: { Accept: ['shell','canonical_navigation'].includes(expected.kind) ? 'text/html' : 'application/json' }, signal: globalThis.AbortSignal.timeout(8000) });
      result.status = response.status;
      result.redirect_blocked = response.status >= 300 && response.status < 400;
      result.nosniff = response.headers.get('x-content-type-options') === 'nosniff';
      result.no_set_cookie = !response.headers.has('set-cookie');
      result.private_no_store = /\bprivate\b/u.test(response.headers.get('cache-control') ?? '') && /\bno-store\b/u.test(response.headers.get('cache-control') ?? '');
      if (response.status !== expected.status || response.url && response.url !== url) { await response.body?.cancel(); checks.push(result); continue; }
      if(expected.kind==='canonical_navigation'){
        const location=response.headers.get('location');
        result.expected_public_shape=location==='/projects'||location===HOST_ORIGIN+'/projects';
        result.passed=result.nosniff&&result.no_set_cookie&&result.expected_public_shape;
        await response.body?.cancel();checks.push(result);continue;
      }
      const type = response.headers.get('content-type') ?? '';
      const text = await boundedText(response);
      if (expected.kind === 'shell') result.expected_public_shape = type.startsWith('text/html') && /<title>[^<]*Presentation Studio[^<]*<\/title>/u.test(text);
      else {
        const value = JSON.parse(text);
        result.request_id = typeof value?.request_id === 'string' && UUID.test(value.request_id) ? value.request_id : null;
        result.expected_public_shape = type.startsWith('application/json') && (expected.kind === 'signed_out'
          ? exact(value, ['request_id', 'data']) && exact(value.data, ['mode', 'actor', 'actors'])
            && value.data.mode === 'supabase' && value.data.actor === null && Array.isArray(value.data.actors) && value.data.actors.length === 0
          : exact(value, ['request_id', 'error']) && exact(value.error, ['code', 'message', 'details', 'retryable'])
            && value.error.code === expected.kind && typeof value.error.message === 'string' && value.error.message.length <= 2000
            && exact(value.error.details, []) && value.error.retryable === false);
      }
      result.passed = result.nosniff && result.no_set_cookie && result.expected_public_shape
        && (expected.kind === 'shell' || result.private_no_store && result.request_id !== null);
    } catch { /* The public receipt never echoes server bodies or transport diagnostics. */ }
    checks.push(result);
  }
  return { schema_version: '1.0', host: HOST_ORIGIN, result: checks.every(check => check.passed) ? 'passed' : 'failed', checks,
    scope: 'Public no-credential admission preflight only; not signed-in app, worker, OAuth or delegated-client acceptance.',
    full_core_or_oauth_acceptance: false, requests: CHECKS.length, methods: ['GET'], redirects_followed: false, cookies_or_authorization_sent: false,
    valid_guest_or_authorization_selectors_used: false, consent_login_or_model_call: false, raw_body_headers_or_diagnostics_recorded: false };
}

async function main() {
  if (process.argv.length !== 2) throw new Error('PILOT_PUBLIC_PROBE_ACCEPTS_NO_ARGUMENTS');
  const bytes = await readFile(path.join(ROOT, CONFIGURE_RECEIPT));
  if (sha(bytes) !== CONFIGURE_SHA) throw new Error('PILOT_PUBLIC_TARGET_UNCONFIRMED');
  validateConfiguredTarget(JSON.parse(bytes));
  const startedAt = new Date().toISOString();
  const report = { ...(await probePublicHost()), started_at: startedAt, finished_at: new Date().toISOString(),
    configure_receipt: { path: CONFIGURE_RECEIPT, sha256: CONFIGURE_SHA }, probe_source_sha256: sha(await readFile(new URL(import.meta.url))) };
  const area = path.join(ROOT, 'tracking/evidence/m07/controlled-pilot'); await mkdir(area, { recursive: true });
  const file = startedAt.replace(/[:.]/gu, '-') + '-' + randomUUID().slice(0, 8) + '-public-host.json';
  await writeFile(path.join(area, file), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  process.stdout.write(JSON.stringify({ result: report.result, checks: report.checks.length, receipt: 'tracking/evidence/m07/controlled-pilot/' + file }) + '\n');
  if (report.result !== 'passed') process.exitCode = 1;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) main().catch(() => {
  process.stderr.write('PILOT_PUBLIC_PROBE_UNCONFIRMED: no private diagnostic output.\n'); process.exitCode = 1;
});
