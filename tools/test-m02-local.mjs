/** Fixed reviewed SQL only. Owned local PostgreSQL, no cloud/provider/runtime. */
import { createHash, randomUUID } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { mkdir, open, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { performance } from 'node:perf_hooks';
import { setTimeout } from 'node:timers';
import { restartOwnedLocalTarget, runOwnedLocalSql, runReviewedSqlFile, verifyLocalTarget } from './local-postgres.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const MANIFEST = path.join(ROOT, 'development/local-db/reviewed.json');
const LOCK = path.join(ROOT, '.local/local-postgres/test-db.lock');
const MIGRATION = 'supabase/migrations/20261028184145_m02_role_order.sql';
const FILES = {
  assertions: 'tests/db/m02-jobs-outbox.sql', setup: 'tests/db/m02-local-setup.sql',
  enqueueA: 'tests/db/m02-local-enqueue-a.sql', enqueueB: 'tests/db/m02-local-enqueue-b.sql',
  claimA: 'tests/db/m02-local-claim-a.sql', claimB: 'tests/db/m02-local-claim-b.sql',
  revokeA: 'tests/db/m02-local-revoke-a.sql', revokeB: 'tests/db/m02-local-revoke-b.sql',
  restartPrepare: 'tests/db/m02-local-restart-prepare.sql', restartClaim: 'tests/db/m02-local-restart-claim.sql',
  singleB: 'tests/db/m02-local-single-claim-b.sql', recover: 'tests/db/m02-local-restart-recover.sql',
  cancelPrepare: 'tests/db/m02-local-cancel-first-prepare.sql', cancelA: 'tests/db/m02-local-cancel-a.sql', cancelFinishB: 'tests/db/m02-local-cancel-finish-b.sql',
  finishPrepare: 'tests/db/m02-local-finish-first-prepare.sql', finishA: 'tests/db/m02-local-finish-a.sql', finishCancelB: 'tests/db/m02-local-finish-cancel-b.sql',
  verify: 'tests/db/m02-local-verify.sql', cleanup: 'tests/db/m02-local-cleanup.sql',
};
const hash = value => createHash('sha256').update(value).digest('hex');
function assert(condition, message) { if (!condition) throw new Error(message); }
function diagnostic(error) {
  return String(error instanceof Error ? error.message : 'Local M02 check failed.')
    .replace(/[A-Za-z0-9_-]{43,}/gu, '[LONG_VALUE_REDACTED]').slice(0, 2500);
}
function objects(stdout) {
  return stdout.split(/\r?\n/u).flatMap(line => {
    if (!line.startsWith('{')) return [];
    try { return [JSON.parse(line)]; } catch { return []; }
  });
}
function marker(result, phase) {
  const selected = result.records.filter(value => value.phase === phase);
  assert(selected.length === 1 && Number.isSafeInteger(selected[0].session_pid), `Missing unique ${phase} SQL backend marker.`);
  return selected[0];
}
function elapsed(result) {
  return Date.parse(marker(result, 'returned').at) - Date.parse(marker(result, 'started').at);
}
const SNAPSHOT = `begin read only; select jsonb_build_object('versions',(select jsonb_agg(version order by version) from supabase_migrations.schema_migrations),
 'business',jsonb_build_object('auth',(select count(*) from auth.users),'clients',(select count(*) from public.clients),'projects',(select count(*) from public.projects),
  'memberships',(select count(*) from public.project_memberships),'client_memberships',(select count(*) from public.client_memberships),'capabilities',(select count(*) from public.app_capability_grants),
  'workspaces',(select count(*) from eps.workspaces),'media',(select count(*) from eps.media_assets),'uploads',(select count(*) from eps.upload_sessions),
  'audit',(select count(*) from eps.audit_events),'idempotency',(select count(*) from eps.idempotency_records),
  'specs',(select count(*) from eps.specs),'specs_roles',(select count(*) from eps.roles),'specs_slots',(select count(*) from eps.slots)),
 'jobs',(select count(*) from eps.jobs),'outbox',(select count(*) from eps.outbox_events),'events',(select count(*) from eps.job_events),
 'forced_rls',(select count(*) from pg_class where oid in('eps.jobs'::regclass,'eps.outbox_events'::regclass,'eps.job_events'::regclass) and relrowsecurity and relforcerowsecurity),
 'restricted_dispatcher',not has_table_privilege('eps_jobs_dispatcher','eps.jobs','UPDATE') and not has_table_privilege('authenticated','eps.jobs','SELECT'),
 'fixture_present',to_regclass('eps_local_guard.m02_fixture') is not null,
 'fsync',current_setting('fsync'),'synchronous_commit',current_setting('synchronous_commit'),'full_page_writes',current_setting('full_page_writes')); rollback;`;

async function main() {
  assert(process.argv.length === 2 && /^v24\./u.test(process.version), 'Require pinned Node24 and no target/file arguments.');
  const runId = randomUUID(); let ownsLock = false; let setupConfirmed = false; let manifest; let manifestDigest;
  const summary = { schema_version: '1.0', run_id: runId, started_at: new Date().toISOString(), result: 'failed', stages: [], concurrency: [],
    cloud_called: false, provider_called: false, stage_callbacks_tested: false, dispatcher_daemon_tested: false,
    scope: 'Committed local jobs/outbox and PostgreSQL graceful restart; synthetic SQL accepted-dispatch flags, no HTTP dispatch or worker processing.' };
  async function unchangedManifest() {
    assert(hash(await readFile(MANIFEST)) === manifestDigest, 'Review manifest changed during local proof; preserve state.');
  }
  async function reviewed(file) {
    await unchangedManifest();
    const entry = [...manifest.migrations, ...manifest.tests].find(value => value.path === file);
    assert(entry && /^[a-f0-9]{64}$/u.test(entry.sha256) && typeof entry.reviewed_by === 'string' && entry.reviewed_by.trim()
      && Number.isFinite(Date.parse(entry.reviewed_at)), `No exact reviewed hash/reviewer/time for ${file}.`);
    const bytes = await readFile(path.join(ROOT, file));
    assert(hash(bytes) === entry.sha256 && !/^\s*\\/mu.test(bytes.toString('utf8')), `SQL changed or contains psql commands: ${file}.`);
    return { entry, sql: bytes.toString('utf8') };
  }
  async function stage(name, file, token) {
    const source = await reviewed(file); const began = performance.now();
    const record = { name, path: file, sha256: source.entry.sha256, started_at: new Date().toISOString(), result: 'failed' };
    summary.stages.push(record);
    try {
      let sql = source.sql;
      if (token !== undefined) {
        assert(/^[A-Za-z0-9_-]{43}$/u.test(token) && sql.split('__EPS_M02_TOKEN_HEX__').length === 2, 'Invalid fixed private recovery token envelope.');
        sql = sql.replace('__EPS_M02_TOKEN_HEX__', () => Buffer.from(token, 'utf8').toString('hex'));
      } else assert(!sql.includes('__EPS_M02_TOKEN_HEX__'), 'Private recovery token is required.');
      const result = await runOwnedLocalSql(sql); const records = objects(result.stdout);
      // Positive projection only: never serialize provider envelopes/raw tokens.
      const safe = records.filter(value => ['started', 'returned', 'holding', 'recovered'].includes(value.phase)).map(value => ({
        phase: value.phase, session_pid: value.session_pid, ...(typeof value.at === 'string' ? { at: value.at } : {}),
        ...(typeof value.event_id === 'string' ? { event_id: value.event_id } : {}),
        ...(value.cached_replay_denied === true ? { cached_replay_denied: true } : {}),
        ...(value.claimed_count === 0 ? { claimed_count: 0 } : {}),
        ...(value.old_ack_rejected === true ? { old_ack_rejected: true, committed_lease_survived: value.committed_lease_survived === true, expired_reclaimed: value.expired_reclaimed === true } : {})
      }));
      Object.assign(record, { result: 'passed', finished_at: new Date().toISOString(), duration_ms: Math.round(performance.now() - began), markers: safe });
      return { records, safe, system_identifier: result.system_identifier };
    } catch (error) { record.error = diagnostic(error); throw error; }
  }
  async function waitHolding(applicationName) {
    assert(['eps_m02_claim_a','eps_m02_revoke_a','eps_m02_single_a','eps_m02_cancel_a','eps_m02_finish_a'].includes(applicationName), 'Unknown fixed barrier.');
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const result = await runOwnedLocalSql(`begin read only; select jsonb_build_object('holding',exists(select 1 from pg_stat_activity where application_name='${applicationName}' and state='active' and wait_event='PgSleep')); rollback;`);
      if (objects(result.stdout).some(value => value.holding === true)) return;
      await new Promise(done => setTimeout(done, 50));
    }
    throw new Error('The reviewed peer transaction was not observed holding its test lock.');
  }
  async function heldPair(name, fileA, fileB, applicationName, { tokenA, tokenB } = {}) {
    const pending = [stage(`${name}-a`, fileA, tokenA)]; pending[0].catch(() => undefined);
    try {
      await waitHolding(applicationName);
      pending.push(stage(`${name}-b`, fileB, tokenB));
      const results = await Promise.all(pending);
      const first = marker(results[0], 'holding'); const second = marker(results[1], 'started');
      assert(first.session_pid !== second.session_pid && Date.parse(second.at) < Date.parse(first.at) + 4000, 'Two distinct overlapping SQL backends were not established.');
      summary.concurrency.push({ name, distinct_backends: true, peer_pg_sleep_observed: true, first_pid: first.session_pid, second_pid: second.session_pid,
        second_rpc_duration_ms: elapsed(results[1]), proof: 'Frozen SQL acquires its job/advisory lock before the sampled PgSleep; this is not a daemon or provider test.' });
      return results;
    } finally { await Promise.allSettled(pending); }
  }
  async function snapshot() {
    const result = await runOwnedLocalSql(SNAPSHOT); const values = objects(result.stdout);
    assert(values.length === 1 && values[0].versions?.length === 9, 'Exact nine-version persisted M02 target required.');
    return values[0];
  }
  function privateToken(result) {
    const leases = result.records.filter(value => value.phase === 'private_lease');
    assert(leases.length === 1 && /^[A-Za-z0-9_-]{43}$/u.test(leases[0].lease?.lease_token), 'Exactly one private committed lease is required.');
    return leases[0].lease.lease_token;
  }
  try {
    const target = await verifyLocalTarget();
    summary.environment = { container: target.config.container, system_identifier: target.observed.system_identifier, image_digest: target.config.image_digest, host_ip: '127.0.0.1', host_port: '55433' };
    await mkdir(path.dirname(LOCK), { recursive: true }); const lock = await open(LOCK, 'wx', 0o600);
    try { await lock.writeFile(JSON.stringify({ run_id: runId, pid: process.pid })); await lock.sync(); ownsLock = true; } finally { await lock.close(); }
    const bytes = await readFile(MANIFEST); manifest = JSON.parse(bytes.toString('utf8')); manifestDigest = hash(bytes);
    assert(manifest.version === 1 && Array.isArray(manifest.migrations) && Array.isArray(manifest.tests), 'Invalid reviewed manifest.');
    const migrations = (await readdir(path.join(ROOT, 'supabase/migrations'))).filter(file => file.endsWith('.sql')).sort().map(file => `supabase/migrations/${file}`);
    assert(migrations.length === 9 && migrations.at(-1) === MIGRATION && manifest.migrations.length === migrations.length
      && new Set([...manifest.migrations, ...manifest.tests].map(entry => entry.path)).size === manifest.migrations.length + manifest.tests.length, 'Exact reviewed nine-file migration history is required.');
    for (const file of [...migrations, ...Object.values(FILES)]) await reviewed(file);
    summary.reviewed_manifest_sha256 = manifestDigest;
    for (const file of migrations) {
      const result = await runReviewedSqlFile(file);
      assert(['applied','already_applied'].includes(result.result), 'Migration replay not confirmed.');
      summary.stages.push({ name: 'migration-replay', path: file, sha256: result.sha256, result: result.result, receipt: result.receipt });
    }
    const assertion = await runReviewedSqlFile(FILES.assertions, { test: true });
    summary.stages.push({ name: 'existing-role-state-machine-assertions', path: FILES.assertions, result: assertion.result, receipt: assertion.receipt, sha256: assertion.sha256 });
    summary.before = await snapshot();
    assert(summary.before.jobs === 0 && summary.before.outbox === 0 && summary.before.events === 0 && !summary.before.fixture_present, 'Existing M02 business rows may not be adopted by this synthetic suite.');
    assert(summary.before.fsync === 'on' && summary.before.synchronous_commit === 'on' && summary.before.full_page_writes === 'on', 'Local durable commit settings must remain enabled.');
    await stage('fixture-setup', FILES.setup); setupConfirmed = true;
    const enqueue = await Promise.allSettled([stage('enqueue-a', FILES.enqueueA), stage('enqueue-b', FILES.enqueueB)]);
    assert(enqueue.every(value => value.status === 'fulfilled'), 'Concurrent enqueue failed; inspect sanitized stages.');
    const enqueued = enqueue.map(value => value.value);
    assert(marker(enqueued[0], 'started').session_pid !== marker(enqueued[1], 'started').session_pid && enqueued.some(value => elapsed(value) > 900), 'Enqueue did not establish distinct backends and actual dedupe lock contention.');
    summary.concurrency.push({ name: 'same-input-distinct-key-enqueue', distinct_backends: true, rpc_durations_ms: enqueued.map(elapsed), lock_delay_exceeded_900_ms: true });
    const claims = await heldPair('two-job-skip-locked', FILES.claimA, FILES.claimB, 'eps_m02_claim_a');
    assert(marker(claims[0], 'returned').event_id !== marker(claims[1], 'returned').event_id && elapsed(claims[1]) < 900, 'Second dispatcher did not skip the locked first parent and claim a distinct event promptly.');
    const revoked = await heldPair('revoked-cached-replay', FILES.revokeA, FILES.revokeB, 'eps_m02_revoke_a');
    assert(marker(revoked[1], 'returned').cached_replay_denied === true && elapsed(revoked[1]) > 900, 'Revoked replay was not denied after an actual advisory wait.');
    await stage('restart-fixture-prepare', FILES.restartPrepare);
    const single = await heldPair('same-event-single-lease', FILES.restartClaim, FILES.singleB, 'eps_m02_single_a');
    assert(marker(single[1], 'returned').claimed_count === 0 && elapsed(single[1]) < 900, 'A second dispatcher did not observe one exclusive lease.');
    const restartToken = privateToken(single[0]);
    summary.restart = await restartOwnedLocalTarget(target.observed.system_identifier);
    await stage('committed-lease-recovery', FILES.recover, restartToken);
    const cancelledLease = await stage('cancel-first-fixture', FILES.cancelPrepare);
    const cancelled = await heldPair('cancel-before-dispatch-finish', FILES.cancelA, FILES.cancelFinishB, 'eps_m02_cancel_a', { tokenB: privateToken(cancelledLease) });
    assert(elapsed(cancelled[1]) > 900, 'Dispatch finish did not wait for a concurrent cancellation.');
    const finishedLease = await stage('finish-first-fixture', FILES.finishPrepare);
    const finished = await heldPair('dispatch-finish-before-cancel', FILES.finishA, FILES.finishCancelB, 'eps_m02_finish_a', { tokenA: privateToken(finishedLease) });
    assert(elapsed(finished[1]) > 900, 'Cancellation did not wait for a concurrent accepted dispatch.');
    await stage('durable-effects-verify', FILES.verify);
    summary.result = 'passed';
  } catch (error) { summary.error = diagnostic(error); }
  finally {
    if (setupConfirmed) {
      try { await stage('strict-scoped-cleanup', FILES.cleanup); summary.cleanup = 'passed';
        summary.after = await snapshot();
        assert(JSON.stringify(summary.after.business) === JSON.stringify(summary.before.business) && summary.after.jobs === 0 && summary.after.outbox === 0
          && summary.after.events === 0 && !summary.after.fixture_present && summary.after.forced_rls === 3 && summary.after.restricted_dispatcher, 'Post-cleanup counts or role boundary changed.');
      } catch (error) { summary.result = 'failed'; summary.cleanup = 'failed; unexpected data preserved'; summary.cleanup_error = diagnostic(error); }
    }
    if (ownsLock) { try { const value = JSON.parse(await readFile(LOCK, 'utf8')); assert(value.run_id === runId && value.pid === process.pid, 'DB test lock owner changed.'); await unlink(LOCK); }
      catch (error) { summary.result = 'failed'; summary.lock_error = diagnostic(error); } }
    summary.finished_at = new Date().toISOString();
    const directory = path.join(ROOT, 'tracking/evidence/m02/local'); await mkdir(directory, { recursive: true });
    const file = path.join(directory, `${summary.finished_at.replace(/[:.]/gu, '-')}-${runId.slice(0,8)}.json`);
    await writeFile(file, JSON.stringify(summary, null, 2) + '\n', { flag: 'wx' });
    process.stdout.write(`M02 owned-local proof: ${summary.result}\nReceipt: ${path.relative(ROOT,file).replaceAll('\\','/')}\n`);
    if (summary.result !== 'passed') { process.stderr.write(`${summary.error ?? summary.cleanup_error ?? summary.lock_error ?? 'Local proof failed.'}\n`); process.exitCode = 1; }
  }
}
main().catch(error => { process.stderr.write(diagnostic(error) + '\n'); process.exitCode = 1; });
