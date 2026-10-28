/** No cookies, sign-in emails, user data, traces or target overrides. */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
const root = path.resolve(import.meta.dirname, '..');
const base = 'http://127.0.0.1:3000';
const output = path.join(root, 'tracking/evidence/m01/central-enrollment');
function assert(condition, reason) { if (!condition) throw new Error(reason); }
async function main() {
  assert(process.argv.length === 2, 'No target or credential overrides are accepted.');
  const session = await fetch(base + '/api/session', { redirect: 'error', signal: AbortSignal.timeout(15_000) });
  const body = await session.json();
  assert(session.status === 200 && body.data.mode === 'supabase' && body.data.actor === null && body.data.actors.length === 0, 'Anonymous central session response differed.');
  assert(session.headers.get('cache-control')?.includes('no-store'), 'Session must not be cached.');
  const statuses = {};
  for (const [name, route, method, expected] of [
    ['internal_projects', '/api/v1/projects', 'GET', 401],
    ['fixture_read', '/api/dev/session', 'GET', 403],
    ['fixture_write', '/api/dev/session', 'DELETE', 403],
  ]) {
    const response = await fetch(base + route, { method, headers: { Origin: base }, redirect: 'error', signal: AbortSignal.timeout(15_000) });
    assert(response.status === expected, 'Anonymous access boundary differed.');
    statuses[name] = response.status;
  }
  const receipt = { observed_at: new Date().toISOString(), result: 'passed', environment: 'actual central development HTTP',
    base_url: base, session_status: session.status, mode: body.data.mode, anonymous: true, no_store: true,
    statuses, email_sent: false, browser_verified_here: false, authenticated_journey: 'not_run', credentials_exported: false };
  await mkdir(output, { recursive: true });
  await writeFile(path.join(output, receipt.observed_at.replace(/[:.]/gu, '-') + '-anonymous-api.json'), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
  process.stdout.write(JSON.stringify(receipt, null, 2) + '\n');
}
main().catch(error => { process.stderr.write(error.message + '\n'); process.exitCode = 1; });
