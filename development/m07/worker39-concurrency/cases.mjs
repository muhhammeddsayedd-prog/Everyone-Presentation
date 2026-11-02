/** New owned-cluster callbacks; no provider, native worker or import-time IO. */
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { clearTimeout, setTimeout } from 'node:timers';
import { setTimeout as delay } from 'node:timers/promises';
export const EXECUTION_ENABLED = true;
const sha = raw => createHash('sha256').update(raw).digest('hex');
const literal = text => "'" + text.replaceAll("'", "''") + "'";
const json = value => literal(JSON.stringify(value)) + '::jsonb';
const same = (a, b) => assert.deepEqual(a, b);
const only = rows => { assert.equal(rows.length, 1); return rows[0]; };
const clone = value => globalThis.structuredClone(value);
export function adaptFixture(raw, identity, run) {
  assert(/^[a-f0-9-]{36}$/u.test(run) && identity.database === 'project39' && /^\d{10,30}$/u.test(identity.system_identifier)
    && identity.system_identifier !== '7701520506262638626');
  let text = raw.toString('utf8'); const replacements = [];
  const replace = (from, to, count) => { assert.equal(text.split(from).length - 1, count); text = text.replaceAll(from, to); replacements.push({ from_sha256: sha(from), to_sha256: sha(to), count }); };
  replace("current_database()!~'^eps_m07_r33_source_[a-f0-9]{32}$'", "(current_database()is distinct from'project39'or current_setting('eps.worker39.run',true)is distinct from" + literal(run) + ")", 2);
  replace("(pg_control_system()).system_identifier::text<>'7701520506262638626'", '(pg_control_system()).system_identifier::text is distinct from' + literal(identity.system_identifier), 1);
  replace('(select count(*)from supabase_migrations.schema_migrations)<>38', '(select count(*)from supabase_migrations.schema_migrations)<>39', 1);
  replace("(select max(version)from supabase_migrations.schema_migrations)<>'20261101110939'", "(select max(version)from supabase_migrations.schema_migrations)<>'20261101223342'", 1);
  replace('sha256:795f8f7736594fb51cc0c304d85bae9d29f31861e606eec0c2a83806fff5d3b9', 'sha256:50082f72d4438653d4c831a1f9a360d61e64d19b3568ed1c2a2456d486f0d77c', 1);
  return { text, source_sha256: sha(raw), adapted_sha256: sha(text), replacements,
    owned_only_target_history_and_synthetic_native_label_adapter: true, actual_rpc_implementation_copied_or_modified: false };
}
export function comparable(value, tables) {
  value = clone(value); for (const name of tables) { delete value.canonical.base.data[name]; delete value.canonical.processing_config[name].table_hash; } return value;
}
export function expectedFlags(value, tables, enabled) {
  value = comparable(value, tables); for (const name of tables) value.canonical.processing_config[name].public.enabled = enabled; return value;
}
export function assertion(template, expected) {
  assert.equal(template.split('__WORKER39_CAPTURED_PREIMAGE_SQL__').length, 2);
  return template.replace('__WORKER39_CAPTURED_PREIMAGE_SQL__', json(expected));
}
export function pause(cfg, before) {
  return cfg.prefix + assertion(cfg.precondition_template, before) + cfg.pause_updates.join('')
    + assertion(cfg.postcondition_template, expectedFlags(before, cfg.tables, false));
}
export function restoreFlags(cfg, paused, original) {
  return cfg.prefix + assertion(cfg.precondition_template, paused) + cfg.resume_updates.join('')
    + assertion(cfg.full_postcondition_template, original) + 'commit;';
}
async function validateCheckpoint(ctx, cfg, before) {
  // The existing owned one-shot port has a32MiB capture. No raw application
  // rows enter the interactive session, report, or an error diagnostic.
  try {
    const wire = await ctx.sql('set session authorization postgres;' + cfg.checkpoint_sql);
    const rows = wire.stdout.split(/\r?\n/u).filter(line => line.startsWith('{')).map(line => JSON.parse(line)); const value = only(rows);
    same(Object.keys(value).sort(), ['application_tables', 'catalogue', 'state']); same(value.state, before); same(Object.keys(value.application_tables).sort(), cfg.checkpoint_tables);
    assert.equal(cfg.checkpoint_tables.length, 76); assert(value.catalogue && typeof value.catalogue === 'object' && !Array.isArray(value.catalogue));
    for (const table of cfg.checkpoint_tables) { const expected = table === 'job_stage_attempts' ? before.canonical.base.trace_rows.count : table === 'project_creation_intents' ? before.intent_data.count : before.canonical.base.data[table].count;
      assert(Array.isArray(value.application_tables[table]) && value.application_tables[table].length === expected); }
    const after = only((await ctx.sql("set session authorization postgres;begin isolation level repeatable read read only;set local search_path='';set local timezone='UTC';" + cfg.snapshot_sql + ';rollback;')).stdout.split(/\r?\n/u).filter(line => line.startsWith('{')).map(line => JSON.parse(line))); same(after, before);
    ctx.report.checkpoint_query_validation = { query_sha256: cfg.checkpoint_sha256, application_tables: 76, same_state_before_after: true, table_counts_match_state: true, history_count: before.canonical.base.history.length,
      raw_rows_persisted: false, stdout_bytes: Buffer.byteLength(wire.stdout), maximum_capture_bytes: 32 * 1024 ** 2, owned_session_authorization: 'postgres' };
  } catch { throw Error('WORKER39_EXACT_CHECKPOINT_VALIDATION_UNCONFIRMED'); }
}
function session(ctx, tag) {
  assert(/^[a-z_]{1,12}$/u.test(tag)); const application = 'worker39_' + ctx.runId.slice(0, 8) + '_' + tag;
  const child = spawn('docker', ['--host', 'npipe:////./pipe/dockerDesktopLinuxEngine', ...ctx.psqlArgs()], { cwd: ctx.root, windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe'] });
  let stdout = '', stderr = '', buffered = '', count = 0, pending, ended = false, identity;
  const failure = () => Object.assign(Error('WORKER39_SESSION_FAILED'), { code: /\b(COMPLETION39_[A-Z_]+)\b/u.exec(stderr)?.[1] ?? 'WORKER39_SESSION_FAILED', diagnostic: { stdout, stderr } });
  const done = new Promise(resolve => { child.once('close', code => { ended = true; if (pending) { clearTimeout(pending.timer); pending.reject(failure()); pending = undefined; } resolve(code); }); });
  child.once('error', () => { if (pending) pending.reject(failure()); }); child.stdin.on('error', () => {});
  child.stderr.on('data', raw => { stderr += raw; if (stderr.length > 128 * 1024) child.kill(); });
  child.stdout.on('data', raw => {
    count += raw.length; if (count > 2 * 1024 ** 2) { child.kill(); return; } stdout += raw; buffered += raw;
    for (;;) { const end = buffered.indexOf('\n'); if (end < 0) break; const line = buffered.slice(0, end).trim(); buffered = buffered.slice(end + 1); if (!line.startsWith('{') || !pending) continue;
      let value; try { value = JSON.parse(line); } catch { child.kill(); return; }
      if (value.__worker39_marker === pending.marker) { const selected = pending; pending = undefined; clearTimeout(selected.timer); selected.resolve(selected.rows); } else pending.rows.push(value);
    }
  });
  const request = (text, timeout = 45000) => { assert(!pending && !ended && Buffer.byteLength(text) <= 2 * 1024 ** 2); count = 0;
    return new Promise((resolve, reject) => { const marker = randomUUID(); const timer = setTimeout(() => { if (pending?.marker === marker) { pending = undefined; child.kill(); reject(Error('WORKER39_SESSION_TIMEOUT')); } }, timeout);
      pending = { marker, timer, rows: [], resolve, reject }; child.stdin.write(text + '\nselect jsonb_build_object(\'__worker39_marker\',' + literal(marker) + ');\n'); }); };
  const value = { request, application, done, get pending() { return !!pending; }, get pid() { return identity?.pid; },
    async start() {
      await ctx.inspect(); const guard = `set log_statement='none';set log_min_duration_statement=-1;set lock_timeout='5s';set statement_timeout='45s';set timezone='UTC';set application_name=${literal(application)};
do $owned$begin if current_database()<>'project39'or(pg_control_system()).system_identifier::text<>${literal(ctx.system)}or(current_setting('eps.worker39.run',true)is not null and current_setting('eps.worker39.run',true)<>${literal(ctx.runId)})or(select count(*)from supabase_migrations.schema_migrations)<>39 then raise exception'WORKER39_OWNED_IDENTITY_REQUIRED';end if;end$owned$;
select jsonb_build_object('pid',pg_backend_pid(),'database',current_database(),'system',(pg_control_system()).system_identifier::text);set session authorization postgres;`;
      identity = only(await request(guard)); assert.equal(identity.database, 'project39'); assert.equal(identity.system, ctx.system); assert(Number.isSafeInteger(identity.pid) && identity.pid > 0); return value;
    },
    rollback() { if (!ended) child.stdin.end('rollback;\n\\quit\n'); },
    async finish() { value.rollback(); await Promise.race([done, delay(5000).then(() => { child.kill(); throw Error('WORKER39_SESSION_CLEANUP_UNCONFIRMED'); })]); }
  }; ctx.sessions.push(value); return value;
}
export async function runCases(ctx, cfg) {
  assert(EXECUTION_ENABLED); assert.equal(cfg.sql_contract_sha256, '4c184701d181e539d3b5de2d2d4a68d7a985086c195108872dde5d6fe61a4ff9'); assert.equal(cfg.tables.length, 5);
  const sessions = []; const start = async tag => { const s = session(ctx, tag); sessions.push(s); return s.start(); };
  try {
    const observer = await start('observer'), control = await start('control'), a = await start('cached'), b = await start('pauser');
    const snap = async () => only(await control.request("begin read only;set local search_path='';" + cfg.snapshot_sql + ' as worker39_snapshot;rollback;'));
    const before = await snap(); same(before.canonical.lifecycle, Object.fromEntries(cfg.counters.map(key => [key, 0]))); assert.equal(before.canonical.base.history.length, 39); assert(cfg.tables.every(table => before.canonical.processing_config[table].public.enabled));
    ctx.report.owned_snapshot_qualifications = { canonical_check_called: false, cli_role_safe_observed: before.canonical.base.cli_role_safe, protected_m02_integrity_observed: before.canonical.base.protected_m02_integrity,
      synthetic_data_only: true, canonical_protected_rows_or_role_oids_not_created: true, complete_local_preimage_preserved_by_actual_collector: true };
    await validateCheckpoint(ctx, cfg, before);
    const actor = "begin;set local role authenticated;select eps_worker38_conc.set_actor();";
    const accepted = only(await a.request(actor + "select eps_worker38_conc.submit('worker39-cached-intake-rollback',1);")); assert.equal(accepted.status, 'queued');
    const wait = async (blocked, blocker, configOnly) => {
      const started = Date.now(); for (;;) { assert(blocked.pending); const row = only(await observer.request(`select jsonb_build_object('blocker',${blocker.pid}=any(pg_blocking_pids(${blocked.pid})),'relation_wait',exists(select 1 from pg_locks where pid=${blocked.pid}and locktype='relation'and not granted${configOnly ? " and mode='AccessExclusiveLock'and relation in(" + cfg.tables.map(table => literal('eps.' + table) + '::regclass').join(',') + ')' : ''}),'cached_config_read',exists(select 1 from pg_locks where pid=${blocker.pid}and relation='eps.specs_pipeline_config'::regclass and mode='AccessShareLock'and granted));`));
        if (row.blocker && row.relation_wait && (!configOnly || row.cached_config_read)) return { ...row, elapsed_ms: Date.now() - started, blocked_pid: blocked.pid, blocker_pid: blocker.pid, before_first_snapshot_return: blocked.pending };
        assert(Date.now() - started < 2500, 'WORKER39_EXPECTED_RELATION_WAIT_REQUIRED'); await delay(20); }
    };
    const waiting = b.request(pause(cfg, before)).then(rows => ({ rows }), failure => ({ failure })); const firstWait = await wait(b, a, true);
    await a.request('rollback;'); const completed = await waiting; assert(!completed.failure); assert(!b.pending);
    const heldLocks = only(await observer.request(`select jsonb_build_object('config_access_exclusive',count(*))from pg_locks where pid=${b.pid}and granted and mode='AccessExclusiveLock'and relation in(${cfg.tables.map(t => literal('eps.' + t) + '::regclass').join(',')});`)); assert.equal(heldLocks.config_access_exclusive, 5);
    const cold = await start('cold'); const coldResult = cold.request(actor + "select eps_worker38_conc.expect_submit_denied('worker39-cold-intake-after-pause',1);commit;").then(rows => ({ rows }), failure => ({ failure }));
    const coldWait = await wait(cold, b, false); await b.request('commit;'); const denied = await coldResult; assert(!denied.failure); same(only(denied.rows), { error_code: 'DEPENDENCY_UNAVAILABLE' });
    const paused = await snap(); same(comparable(paused, cfg.tables), expectedFlags(before, cfg.tables, false)); same(paused.canonical.lifecycle, before.canonical.lifecycle);
    ctx.report.cached_intake_waited_before_snapshot = true; ctx.report.worker39_cached_pause_wait = firstWait; ctx.report.all_five_actual_config_locks_held = heldLocks; ctx.report.fresh_intake_denied_after_pause = true; ctx.report.worker39_cold_intake_wait = coldWait;
    const retry = await start('retry'); const seeded = await retry.request("begin;set local eps.worker38.concurrency='owned-local-v1';set local eps.worker39.run=" + literal(ctx.runId) + ';select eps_worker38_conc.seed_retry_rows();select ' + cfg.lifecycle_sql + ';'); assert.equal(seeded.length, 2); assert.equal(seeded[1].generic_retry_lifecycle, 1); assert.equal(seeded[1].presentation_retry_lifecycle, 2); assert.equal(seeded[1].queued, 0);
    const retried = only(await retry.request("set local role authenticated;select eps_worker38_conc.set_actor();select eps_worker38_conc.retry_generic('worker39-paused-generic-retry');")); assert.equal(retried.status, 'queued');
    const afterRetry = only(await retry.request('set local role postgres;select ' + cfg.lifecycle_sql + ';')); assert.equal(afterRetry.generic_retry_lifecycle, 0); assert.equal(afterRetry.presentation_retry_lifecycle, 2); assert.equal(afterRetry.queued, 1); assert(afterRetry.pending_outbox >= 1);
    await retry.request('rollback;'); same(await snap(), paused); ctx.report.retry_lifecycle_not_hidden_by_pause = true; ctx.report.retry_scope = { actual_generic_retry_rpc: true, generic_before: 1, conservative_presentation_export_before: 2, generic_after: 0, queued_after: 1, full_retry_fixture_rolled_back: true, presentation_export_retry_eligibility_proven: false };
    await control.request(restoreFlags(cfg, paused, before)); same(await snap(), before);
    const raced = only(await a.request(actor + "select eps_worker38_conc.submit('worker39-cached-intake-commit-race',2);")); assert.equal(raced.status, 'queued');
    const racedSnapshot = b.request(cfg.prefix + cfg.snapshot_sql + ' as worker39_snapshot;').then(rows => ({ rows }), failure => ({ failure })); const commitWait = await wait(b, a, true);
    await a.request('commit;'); const visible = await racedSnapshot; assert(!visible.failure); const observed = only(visible.rows); assert.equal(observed.canonical.lifecycle.queued, 1); assert(observed.canonical.lifecycle.pending_outbox >= 1); assert.notDeepEqual(observed, before);
    const rejection = await b.request(assertion(cfg.precondition_template, before)).then(() => null, failure => failure); assert.equal(rejection?.code, 'COMPLETION39_PREFLIGHT_CHANGED');
    const final = await snap(); assert(cfg.tables.every(table => final.canonical.processing_config[table].public.enabled)); assert.equal(final.canonical.lifecycle.queued, 1);
    const actual = only(await control.request(`begin read only;select jsonb_build_object('exists',exists(select 1 from eps.jobs where id=${literal(raced.job_id ?? raced.id)}::uuid and workspace_id=eps_worker38_conc.workspace(2)and status='queued'));rollback;`)); assert(actual.exists);
    ctx.report.committed_intake_visible_to_first_snapshot = true; ctx.report.committed_intake_preimage_refused_before_updates = true; ctx.report.worker39_commit_pause_wait = commitWait; ctx.report.actual_committed_intake_job_preserved = true; ctx.report.sql_contract_sha256 = cfg.sql_contract_sha256; ctx.report.query_source_hashes = cfg.hashes;
    ctx.report.distinct_backend_pids = sessions.map(s => s.pid); assert.equal(new Set(ctx.report.distinct_backend_pids).size, sessions.length);
  } finally { for (const s of sessions) s.rollback(); await Promise.all(sessions.map(s => s.finish())); }
}
