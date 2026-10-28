import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';
import { runReviewedSqlFile, verifyLocalTarget, storageBaseline } from './local-postgres.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const MANIFEST = path.join(ROOT, 'development/local-db/reviewed.json');
const RECEIPTS = path.join(ROOT, 'development/local-db/receipts');
const LOCK = path.join(ROOT, '.local/local-postgres/test-db.lock');
const REQUIRED_MIGRATIONS = [
  'supabase/migrations/20261028010943_m01_canonical_foundation.sql',
  'supabase/migrations/20261028013324_m01_identity_role_inheritance.sql',
  'supabase/migrations/20261028013655_m01_workspace_scope_alias.sql',
  'supabase/migrations/20261028024205_m01_private_logo_boundary.sql',
  'supabase/migrations/20261028072515_m01_logo_upload_capability.sql',
  'supabase/migrations/20261028162702_m01_replay_scope_refresh.sql',
  'supabase/migrations/20261028162800_m02_jobs_outbox.sql',
  'supabase/migrations/20261028172320_m02_manual_specs_draft.sql',
];
const FILES = {
  roles: 'tests/db/m01-role-inheritance.sql', foundation: 'tests/db/m01-foundation.sql',
  logo: 'tests/db/m01-logo-boundary.sql',
  logoCapability: 'tests/db/m01-logo-upload-capability.sql',
  logoSetup: 'tests/db/m01-logo-race-setup.sql', logoA: 'tests/db/m01-logo-race-a.sql', logoB: 'tests/db/m01-logo-race-b.sql',
  logoVerify: 'tests/db/m01-logo-race-verify.sql', logoCleanup: 'tests/db/m01-logo-race-cleanup.sql',
  setup: 'tests/db/m01-race-setup.sql', sameA: 'tests/db/m01-race-same-a.sql', sameB: 'tests/db/m01-race-same-b.sql',
  distinctA: 'tests/db/m01-race-distinct-a.sql', distinctB: 'tests/db/m01-race-distinct-b.sql',
  verify: 'tests/db/m01-race-verify.sql', cleanup: 'tests/db/m01-race-cleanup.sql',
};
const hash = value => createHash('sha256').update(value).digest('hex');
function fail(message) { throw new Error(message); }
function diagnostic(error) {
  return String(error instanceof Error ? error.message : 'Database test failed.')
    .replace(/(postgres(?:ql)?:\/\/[^:\s/]+:)[^@\s]+@/giu, '$1[REDACTED]@').slice(0, 3000);
}

/** Exact PostgreSQL timestamp markers retain microseconds; calculations use ns. */
function timestamp(value) {
  if (typeof value !== 'string') fail('SQL session timing marker is missing a timestamp.');
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})$/u.exec(value);
  const milliseconds = match ? Date.parse(match[1] + match[3]) : Number.NaN;
  if (!match || !Number.isFinite(milliseconds)) fail('SQL session timing marker has an invalid timestamp.');
  return BigInt(milliseconds) * 1_000_000n + BigInt((match[2] ?? '').padEnd(9, '0'));
}
function milliseconds(nanoseconds) { return Number((Number(nanoseconds) / 1_000_000).toFixed(3)); }
function sessionTiming(result, file) {
  const markers = String(result.output ?? '').split(/\r?\n/u).flatMap(line => {
    if (!line.trim().startsWith('{')) return [];
    try {
      const value = JSON.parse(line);
      return value && typeof value === 'object' && Number.isSafeInteger(value.session_pid) && value.session_pid > 0 ? [value] : [];
    } catch { return []; }
  });
  const starts = markers.filter(value => Object.keys(value).length === 2 && Object.hasOwn(value, 'claim_started_at'));
  const ends = markers.filter(value => Object.keys(value).length === 2 && Object.hasOwn(value, 'claim_returned_at'));
  if (starts.length !== 1 || ends.length !== 1 || starts[0].session_pid !== ends[0].session_pid) fail(`Expected exactly one matching SQL backend/start/return marker in ${file}.`);
  const start = timestamp(starts[0].claim_started_at); const end = timestamp(ends[0].claim_returned_at);
  if (end < start) fail(`SQL timing moved backward in ${file}.`);
  return { file, receipt: result.receipt, session_pid: starts[0].session_pid, claim_started_at: starts[0].claim_started_at,
    claim_returned_at: ends[0].claim_returned_at, claim_duration_ms: milliseconds(end - start), start, end };
}

async function main() {
  const runId = randomUUID(); const started = performance.now();
  const summary = { suite: 'M01 real local PostgreSQL acceptance', run_id: runId, started_at: new Date().toISOString(),
    result: 'failed', scope: 'owned isolated local Docker PostgreSQL only; no cloud calls', stages: [], concurrency_pairs: [],
    cleanup: { setup_confirmed: false, attempted: false }, limitations: 'Local SQL/role/concurrency evidence; hosted auth, storage, web integration and production are separate gates.' };
  let ownsLock = false; let setupConfirmed = false; let logoSetupConfirmed = false; let manifestDigest; let manifest;
  async function unchangedManifest() {
    if (!manifestDigest || hash(await readFile(MANIFEST)) !== manifestDigest) fail('The reviewed manifest changed during this run. Stop and review current files before rerunning.');
  }
  async function stage(name, file, test) {
    const began = performance.now();
    const reviewed = [...manifest.migrations, ...manifest.tests].find(entry => entry.path === file);
    const record = { name, path: file, reviewed_at: reviewed.reviewed_at, reviewed_by: reviewed.reviewed_by,
      started_at: new Date().toISOString(), result: 'failed' };
    summary.stages.push(record);
    try {
      await unchangedManifest();
      const result = await runReviewedSqlFile(file, { test });
      if (test ? result.result !== 'passed' : !['applied', 'already_applied'].includes(result.result)) fail(`The reviewed SQL runner did not confirm ${name}.`);
      Object.assign(record, { result: result.result, receipt: result.receipt, sha256: result.sha256, finished_at: new Date().toISOString(), duration_ms: Number((performance.now() - began).toFixed(2)) });
      process.stdout.write(`${name}: ${result.result}\n`);
      return result;
    } catch (error) {
      Object.assign(record, { error: diagnostic(error), finished_at: new Date().toISOString(), duration_ms: Number((performance.now() - began).toFixed(2)) });
      throw error;
    }
  }
  async function racePair(name, files) {
    // Wait for both actual sessions even when one fails, before scoped cleanup.
    const results = await Promise.allSettled(files.map((file, index) => stage(`${name}-${index + 1}`, file, true)));
    const errors = results.filter(result => result.status === 'rejected');
    if (errors.length) fail(`${name} failed: ${errors.map(result => diagnostic(result.reason)).join(' | ')}`);
    const sessions = results.map((result, index) => sessionTiming(result.value, files[index]));
    const startGap = sessions[0].start > sessions[1].start ? sessions[0].start - sessions[1].start : sessions[1].start - sessions[0].start;
    const distinctBackends = sessions[0].session_pid !== sessions[1].session_pid;
    const delayedClaim = sessions.some(session => session.claim_duration_ms > 900);
    // Reviewed SQL holds transaction/advisory locks for 1s after its return marker.
    const latestStart = sessions[0].start > sessions[1].start ? sessions[0].start : sessions[1].start;
    const earliestLockWindowEnd = (sessions[0].end < sessions[1].end ? sessions[0].end : sessions[1].end) + 1_000_000_000n;
    const transactionOverlap = latestStart < earliestLockWindowEnd;
    const proof = { name, result: distinctBackends && delayedClaim && transactionOverlap ? 'passed' : 'failed',
      distinct_database_backends: distinctBackends, overlapping_reviewed_transaction_windows: transactionOverlap,
      claim_exceeded_900_ms: delayedClaim, start_gap_ms: milliseconds(startGap),
      proof: 'Actual SQL backend/timestamp markers, with peer transaction locks held by the reviewed 1-second server sleep. Wait-event sampling is not claimed.',
      sessions: sessions.map(({ start, end, ...session }) => { void start; void end; return session; }) };
    summary.concurrency_pairs.push(proof);
    if (proof.result !== 'passed') fail(`${name} did not demonstrate distinct backends, overlapping transaction windows and a claim delay above 900ms.`);
  }

  try {
    const target = await verifyLocalTarget();
    summary.environment = { container: target.config.container, image_digest: target.config.image_digest, database: target.observed.database,
      system_identifier: target.observed.system_identifier, host_ip: target.config.host_ip, host_port: target.config.host_port };
    await mkdir(path.dirname(LOCK), { recursive: true });
    const handle = await open(LOCK, 'wx', 0o600);
    try { await handle.writeFile(JSON.stringify({ run_id: runId, pid: process.pid, started_at: summary.started_at })); await handle.sync(); ownsLock = true; }
    finally { await handle.close(); }
    const manifestBytes = await readFile(MANIFEST); manifestDigest = hash(manifestBytes); manifest = JSON.parse(manifestBytes.toString('utf8'));
    if (manifest.version !== 1 || !Array.isArray(manifest.migrations) || !Array.isArray(manifest.tests)) fail('A reviewed migration/test manifest is required.');
    const entries = [...manifest.migrations, ...manifest.tests];
    if (new Set(entries.map(entry => entry.path)).size !== entries.length) fail('The reviewed manifest has duplicate paths.');
    const migrations = (await readdir(path.join(ROOT, 'supabase/migrations'))).filter(name => name.endsWith('.sql')).sort().map(name => `supabase/migrations/${name}`);
    if (!REQUIRED_MIGRATIONS.every(file => migrations.includes(file)) || migrations.length !== manifest.migrations.length || migrations.some(file => !manifest.migrations.some(entry => entry.path === file))) fail('Every root migration, including all required M01 migrations, must have an exact reviewed entry. No migration is silently omitted.');
    for (const file of [...migrations, ...Object.values(FILES)]) {
      const entry = entries.find(value => value.path === file);
      if (!entry || !/^[a-f0-9]{64}$/u.test(entry.sha256) || typeof entry.reviewed_by !== 'string' || !entry.reviewed_by.trim()
        || typeof entry.reviewed_at !== 'string' || !Number.isFinite(Date.parse(entry.reviewed_at))) fail(`An explicit reviewed hash, reviewer and review timestamp are required for ${file}.`);
      if (hash(await readFile(path.join(ROOT, file))) !== entry.sha256) fail(`Reviewed SQL bytes changed: ${file}.`);
    }
    summary.reviewed_manifest_sha256 = manifestDigest;
    const baseline = await storageBaseline();
    summary.local_storage_fixture = { receipt: baseline.receipt, result: baseline.result,
      scope: 'simulated managed catalog for SQL policy assertions only; no Storage HTTP or bytes' };
    await unchangedManifest();
    for (const file of migrations) await stage('migration-replay', file, false);
    await stage('identity-role-proof', FILES.roles, true);
    await stage('foundation-role-and-domain-assertions', FILES.foundation, true);
    await stage('logo-role-proof-and-state-assertions', FILES.logo, true);
    await stage('scoped-logo-upload-capability-assertions', FILES.logoCapability, true);
    summary.logo_cleanup = { setup_confirmed: false, attempted: false };
    await stage('logo-concurrency-fixture-setup', FILES.logoSetup, true);
    logoSetupConfirmed = true; summary.logo_cleanup.setup_confirmed = true;
    await racePair('distinct-key-logo-completion', [FILES.logoA, FILES.logoB]);
    await stage('logo-concurrency-domain-effects', FILES.logoVerify, true);
    await stage('concurrency-fixture-setup', FILES.setup, true);
    setupConfirmed = true; summary.cleanup.setup_confirmed = true;
    await racePair('same-key-claim', [FILES.sameA, FILES.sameB]);
    await racePair('distinct-key-claim', [FILES.distinctA, FILES.distinctB]);
    await stage('concurrency-domain-effects', FILES.verify, true);
    summary.result = 'passed';
  } catch (error) {
    summary.result = 'failed'; summary.error = diagnostic(error);
  } finally {
    if (logoSetupConfirmed) {
      summary.logo_cleanup.attempted = true;
      try { const result = await stage('scoped-logo-fixture-cleanup', FILES.logoCleanup, true); Object.assign(summary.logo_cleanup, { result: 'passed', receipt: result.receipt }); }
      catch (error) { summary.result = 'failed'; Object.assign(summary.logo_cleanup, { result: 'failed', error: diagnostic(error), preservation: 'Unexpected fixture data is preserved; no CASCADE/reset/Storage deletion.' }); }
    }
    if (setupConfirmed) {
      summary.cleanup.attempted = true;
      try { const result = await stage('scoped-concurrency-fixture-cleanup', FILES.cleanup, true); Object.assign(summary.cleanup, { result: 'passed', receipt: result.receipt }); }
      catch (error) { summary.result = 'failed'; Object.assign(summary.cleanup, { result: 'failed', error: diagnostic(error), preservation: 'Cleanup refuses unexpected data; no broader deletion or reset is attempted.' }); }
    }
    if (ownsLock) {
      try { const owner = JSON.parse(await readFile(LOCK, 'utf8')); if (owner.run_id !== runId || owner.pid !== process.pid) fail('DB test lock ownership changed; refusing removal.'); await unlink(LOCK); }
      catch (error) { summary.result = 'failed'; summary.lock_error = diagnostic(error); }
    }
    summary.finished_at = new Date().toISOString(); summary.duration_ms = Number((performance.now() - started).toFixed(2));
    await mkdir(RECEIPTS, { recursive: true });
    const filename = `${summary.finished_at.replace(/[:.]/gu, '-')}-test-db-summary-${runId.slice(0, 8)}.json`;
    const file = path.join(RECEIPTS, filename);
    await writeFile(file, JSON.stringify(summary, null, 2) + '\n', { flag: 'wx' });
    process.stdout.write(`Database suite: ${summary.result}\nReceipt: ${path.relative(ROOT, file).replaceAll('\\', '/')}\n`);
    if (summary.result !== 'passed') { process.stderr.write(`${summary.error ?? summary.cleanup.error ?? summary.lock_error ?? 'Database acceptance failed.'}\n`); process.exitCode = 1; }
  }
}
main().catch(error => { process.stderr.write(diagnostic(error) + '\n'); process.exitCode = 1; });
