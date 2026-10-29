/** Actual local API denial check. No credentials, cookies or browser session. */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import process from 'node:process';
const root = path.resolve(import.meta.dirname, '..');
if (process.argv.length !== 2) throw new Error('FIXED_ANONYMOUS_CHECK_REQUIRED');
const source = 'tracking/evidence/m05/app-capture/2026-10-29T22-43-01-866603Z-a630f28c.json';
const bytes = await readFile(path.join(root, source)); const captured = JSON.parse(bytes);
if (captured.result !== 'captured' || captured.state.versions.length !== 3 || captured.state.versions.some(value => value.status !== 'ready')) throw new Error('READY_VERSION_METADATA_REQUIRED');
const requests = captured.state.versions.flatMap(version => [
  { method: 'GET', route: `/api/v1/versions/${version.id}` },
  { method: 'GET', route: `/api/v1/versions/${version.id}/pdf/content` },
  { method: 'POST', route: `/api/v1/versions/${version.id}/pdf` },
]);
const first = captured.state.versions.find(version => version.id === '47b39b6c-ffc4-41fb-ac11-70a697bf19de');
for (const [kind, suffix, method] of [['candidate_frame', 'content', 'GET'], ['candidate_video', 'playback', 'POST']]) {
  const asset = first?.pins.find(pin => pin.asset_kind === kind);
  if (!asset) throw new Error('RETAINED_MEDIA_METADATA_REQUIRED');
  requests.push({ method, route: `/api/v1/versions/${first.id}/media/${asset.asset_id}/${suffix}` });
}
const checks = await Promise.all(requests.map(async request => {
  try {
    const response = await globalThis.fetch('http://127.0.0.1:3000' + request.route, { method: request.method, redirect: 'error',
      signal: globalThis.AbortSignal.timeout(15000), headers: { Origin: 'http://127.0.0.1:3000', Accept: 'application/json',
        ...(request.method === 'POST' ? { 'Content-Type': 'application/json' } : {}) },
      ...(request.method === 'POST' ? { body: '{}' } : {}) });
    await response.body?.cancel();
    return { ...request, http_status: response.status, denied: response.status === 401 || response.status === 403 };
  } catch { return { ...request, http_status: null, denied: false }; }
}));
const report = { observed_at: new Date().toISOString(), result: checks.every(value => value.denied) ? 'passed' : 'failed',
  scope: 'Actual anonymous local API calls for existing canonical Ready versions and their exact retained artifacts',
  input_receipt: source, input_receipt_sha256: createHash('sha256').update(bytes).digest('hex'),
  credentials_or_browser_session_loaded: false, authenticated_user_impersonated: false, response_bodies_retained: false,
  provider_called: false, guest_link_or_export_created: false, hosting_deferred: true, checks };
const directory = path.join(root, 'tracking/evidence/m05/anonymous-access'); await mkdir(directory, { recursive: true });
const file = path.join(directory, report.observed_at.replace(/[:.]/gu, '-') + '-' + randomUUID().slice(0, 8) + '.json');
await writeFile(file, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
process.stdout.write(JSON.stringify({ result: report.result, checks: checks.length, statuses: [...new Set(checks.map(value => value.http_status))],
  receipt: path.relative(root, file).replaceAll('\\', '/') }) + '\n');
if (report.result !== 'passed') process.exitCode = 1;
