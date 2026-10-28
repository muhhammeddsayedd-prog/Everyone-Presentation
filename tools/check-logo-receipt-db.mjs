import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';
import { signLogoReceipt } from '../packages/central/src/logo-receipt.ts';
import { verifyLocalTarget } from './local-postgres.mjs';

const ROOT = await realpath(fileURLToPath(new URL('../', import.meta.url)));
const SQL_FILE = 'tests/db/m01-logo-node-interop.sql';
const PAYLOAD_TOKEN = '__EPS_NODE_LOGO_PAYLOAD__';
const MAC_TOKEN = '__EPS_NODE_LOGO_MAC__';
const PRINCIPAL = 'ffffffff-1111-4111-8111-111111111111';
const ASSET = 'ffffffff-5555-4555-8555-555555555555';
const KEY_ID = 'synthetic-node-logo-interop-v1';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function fail(message) { throw new Error(message); }
let syntheticReceipt;
function diagnostic(value) {
  let text = String(value);
  for (const encoded of syntheticReceipt ? [syntheticReceipt.payload, syntheticReceipt.mac] : []) text = text.split(encoded).join('[SYNTHETIC_RECEIPT_REDACTED]');
  return text.replace(/(postgres(?:ql)?:\/\/[^:\s/]+:)[^@\s]+@/giu, '$1[REDACTED]@').slice(0, 4000);
}
async function localPsql(sql) {
  // Each SQL session independently re-verifies labels/image/loopback publication
  // and the recorded database fingerprint. No caller-selected target exists.
  const { config } = await verifyLocalTarget();
  return new Promise((resolve, reject) => {
    const child = spawn('docker', ['exec', '-i', '--user', 'postgres', config.container, 'psql',
      '--host', '/var/run/postgresql', '--username', 'postgres', '--dbname', 'postgres', '--no-psqlrc',
      '--set', 'ON_ERROR_STOP=1', '--tuples-only', '--no-align', '--quiet'],
    { cwd: ROOT, shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = ''; let reason = '';
    const timer = setTimeout(() => { reason = 'Local interoperability SQL exceeded its bounded timeout.'; child.kill(); }, 45_000);
    function collect(destination, value) {
      if (destination === 'stdout') stdout += value; else stderr += value;
      if (stdout.length + stderr.length > 128 * 1024) { reason = 'Local SQL output exceeded its bound.'; child.kill(); }
    }
    child.stdout.setEncoding('utf8').on('data', value => collect('stdout', value));
    child.stderr.setEncoding('utf8').on('data', value => collect('stderr', value));
    child.stdin.on('error', () => undefined);
    child.once('error', error => { clearTimeout(timer); reject(new Error(diagnostic(error.message))); });
    child.once('close', code => {
      clearTimeout(timer);
      if (reason || code !== 0) reject(new Error(diagnostic(reason || stderr || 'Local interoperability SQL failed.')));
      else resolve({ stdout, stderr });
    });
    child.stdin.end(sql);
  });
}
const CLEANUP_INSPECTION = `begin read only;
select jsonb_build_object(
 'auth_users',(select count(*) from auth.users where id='${PRINCIPAL}'),
 'clients',(select count(*) from public.clients where id='ffffffff-2222-4222-8222-222222222222'),
 'projects',(select count(*) from public.projects where id='ffffffff-3333-4333-8333-333333333333'),
 'project_memberships',(select count(*) from public.project_memberships where principal_id='${PRINCIPAL}'),
 'capabilities',(select count(*) from public.app_capability_grants where principal_id='${PRINCIPAL}'),
 'workspaces',(select count(*) from eps.workspaces where id='ffffffff-4444-4444-8444-444444444444'),
 'media',(select count(*) from eps.media_assets where id='${ASSET}'),
 'uploads',(select count(*) from eps.upload_sessions where id='ffffffff-6666-4666-8666-666666666666'),
 'keys',(select count(*) from eps.logo_verification_keys where key_id='${KEY_ID}'),
 'idempotency',(select count(*) from eps.idempotency_records where principal_id='${PRINCIPAL}'),
 'audit',(select count(*) from eps.audit_events where principal_id='${PRINCIPAL}'),
 'storage_metadata',(select count(*) from storage.objects where bucket_id='eps-brand-assets' and name='assets/${ASSET}/original.png')
) as fixture_counts; rollback;`;
async function fixtureCounts() {
  const result = await localPsql(CLEANUP_INSPECTION);
  const lines = result.stdout.split(/\r?\n/u).filter(line => line.trim().startsWith('{'));
  if (lines.length !== 1) fail('Local fixture inspection returned an unexpected result.');
  const counts = JSON.parse(lines[0]);
  if (Object.keys(counts).length !== 12 || Object.values(counts).some(value => value !== 0)) fail('Node interoperability fixture exists; no data will be adopted or deleted.');
  return counts;
}
async function main() {
  if (process.argv.length !== 2) fail('Usage: node tools/check-logo-receipt-db.mjs (no arguments or target overrides).');
  if (!/^v24\./u.test(process.version)) fail('The pinned Node 24 runtime is required.');
  const manifest = JSON.parse(await readFile(path.join(ROOT, 'development/local-db/reviewed.json'), 'utf8'));
  const entry = manifest.version === 1 && Array.isArray(manifest.tests) ? manifest.tests.find(item => item.path === SQL_FILE) : undefined;
  if (!entry || !/^[a-f0-9]{64}$/u.test(entry.sha256) || typeof entry.reviewed_by !== 'string' || !entry.reviewed_by.trim()) fail('The fixed Node interoperability SQL requires an exact reviewed test hash and reviewer.');
  const absolute = await realpath(path.join(ROOT, SQL_FILE));
  if (absolute !== path.resolve(ROOT, SQL_FILE)) fail('Reviewed interoperability SQL may not resolve through a symbolic link.');
  const bytes = await readFile(absolute);
  if (hash(bytes) !== entry.sha256) fail('Interoperability SQL changed after review. No SQL was executed.');
  const template = bytes.toString('utf8');
  if (/^\s*\\/mu.test(template) || template.split(PAYLOAD_TOKEN).length !== 2 || template.split(MAC_TOKEN).length !== 2) fail('The fixed SQL template has unexpected commands or placeholders.');
  const controls = [...template.matchAll(/^\s*(begin|commit|rollback|start\s+transaction)\s*;\s*$/gimu)].map(value => value[1].toLowerCase());
  if (controls.length !== 2 || controls[0] !== 'begin' || controls[1] !== 'rollback' || !/rollback;\s*$/iu.test(template)) fail('Interoperability SQL must use one outer BEGIN and final ROLLBACK, with no commit.');
  await fixtureCounts(); // Refuse any pre-existing fixture; never clean up by DELETE.
  const now = Math.floor(Date.now() / 1000);
  // Public deterministic test authority only; no environment or real key is read.
  syntheticReceipt = signLogoReceipt({ schema_version: '1.0', audience: 'eps.logo-verification.v1', purpose: 'client_logo', key_id: KEY_ID,
    verification_id: 'ffffffff-7777-4777-8777-777777777777', upload_id: 'ffffffff-6666-4666-8666-666666666666', asset_id: ASSET,
    principal_id: PRINCIPAL, workspace_id: 'ffffffff-4444-4444-8444-444444444444', reservation_revision: 1,
    bucket: 'eps-brand-assets', object_key: `assets/${ASSET}/original.png`, size_bytes: 1234, sha256: 'a'.repeat(64), mime_type: 'image/png',
    width: 128, height: 64, issued_at: now, expires_at: now + 120 }, new Uint8Array(32).fill(7), { now });
  if (!/^[A-Za-z0-9_-]{1,5462}$/u.test(syntheticReceipt.payload) || !/^[A-Za-z0-9_-]{43}$/u.test(syntheticReceipt.mac)) fail('Generated synthetic receipt is not bounded base64url.');
  // Only these two quote-free, strict base64url values enter reviewed SQL.
  const sql = template.replace(PAYLOAD_TOKEN, syntheticReceipt.payload).replace(MAC_TOKEN, syntheticReceipt.mac);
  const startedAt = new Date().toISOString(); let execution; let error; let rollbackCounts;
  try {
    execution = await localPsql("do $$ begin perform set_config('eps.local_fixture_tests','eps-presentation-canonical-pg17-local',false); end $$;\n" + sql);
    const lines = execution.stdout.split(/\r?\n/u).filter(line => line.trim().startsWith('{'));
    if (lines.length !== 1) fail('SQL did not return its single interoperability assertion marker.');
    const result = JSON.parse(lines[0]);
    if (result.node_to_sql_receipt_verified !== true || result.wrong_signature_rejected !== true || result.ready_projection_verified !== true || result.single_transition_verified !== true || !Number.isInteger(result.assertion_backend_pid)) fail('SQL interoperability assertions were incomplete.');
    execution = result;
  } catch (caught) { error = diagnostic(caught instanceof Error ? caught.message : caught); }
  try { rollbackCounts = await fixtureCounts(); }
  catch (caught) { error = [error, diagnostic(caught instanceof Error ? caught.message : caught)].filter(Boolean).join(' '); }
  const receipt = { action: 'logo-node-sql-interop', observed_at: new Date().toISOString(), started_at: startedAt,
    scope: 'owned local PostgreSQL only; actual Node helper to SQL verifier; synthetic key/identities/metadata; no Storage HTTP, object bytes, Sharp or cloud operations',
    sql_file: SQL_FILE, sql_sha256: entry.sha256, node_version: process.version,
    receipt_module_sha256: hash(await readFile(path.join(ROOT, 'packages/central/src/logo-receipt.ts'))),
    result: error ? 'failed' : 'passed', assertions: error ? undefined : execution,
    rollback: { verified: !error && Boolean(rollbackCounts), fixture_counts: rollbackCounts }, error };
  const directory = path.join(ROOT, 'development/local-db/receipts'); await mkdir(directory, { recursive: true });
  const filename = `${receipt.observed_at.replace(/[:.]/gu, '-')}-logo-node-sql-interop.json`;
  await writeFile(path.join(directory, filename), JSON.stringify(receipt, null, 2) + '\n');
  process.stdout.write(JSON.stringify({ receipt: `development/local-db/receipts/${filename}`, ...receipt }, null, 2) + '\n');
  if (error) process.exitCode = 1;
}
main().catch(error => { process.stderr.write(diagnostic(error instanceof Error ? error.message : error) + '\n'); process.exitCode = 1; });
