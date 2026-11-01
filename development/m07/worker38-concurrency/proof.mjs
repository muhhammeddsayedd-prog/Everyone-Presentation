/** New disabled owned LOCAL SQL concurrency purpose. Import has no I/O. */
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { spawn, spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';
import { compileController33, SOURCE_PINS } from '../recovery33/compiler.mjs';
import { ownedPredicate33, ownedIdentity33 } from '../recovery33/ownership.mjs';

export const EXECUTION_ENABLED = true;
export const ROOT = path.resolve(import.meta.dirname, '../../..');
export const PURPOSE = 'development/m07/worker38-concurrency/';
export const OWN = ['proof.mjs', 'fixture.sql', 'proof.test.mjs', 'frozen-inputs.json', 'README.md'].map(v => PURPOSE + v);
export const MANIFEST_SHA = '401a40092770c91571da7d8e687ef70f34c0d95d7a24eaa40f6eaa499f4f1cc4';
export const CONTRACT_SHA = '690ae972ab0481026c139af5bcbf42017aa2fe63144f2981bd035dd139bbe8ff';
const CONTRACT = 'development/m07/specs-diagnostic-worker38-adoption/state.py';
const TRACE_ROLE = 'eps_job_trace_owner';
const UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u;
const PRIVATE = path.join(ROOT, '.local/m07-worker38-concurrency-prepared');
export const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const literal = value => "'" + String(value).replaceAll("'", "''") + "'";
const json = value => literal(JSON.stringify(value)) + '::jsonb';
const same = (a, b) => assert.deepEqual(a, b);
const clone = value => structuredClone(value);
const error = code => Object.assign(new Error(code), { code });
const closedError = value => /^WORKER38_[A-Z_]+$/u.test(value?.code ?? '') ? value.code : 'WORKER38_SQL_UNCONFIRMED';

export function environment() {
  const value = { NODE_ENV: 'test' };
  for (const key of ['PATH', 'SystemRoot', 'WINDIR', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'HOMEDRIVE', 'HOMEPATH', 'TEMP', 'TMP', 'LANG']) {
    if (typeof process.env[key] === 'string') value[key] = process.env[key];
  }
  return value;
}
async function regular(file, maximum = 8 * 1024 ** 2) {
  const stat = await lstat(file);
  assert(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1 && stat.size <= maximum && await realpath(file) === file);
  return readFile(file);
}
function relativeFile(file) {
  assert(typeof file === 'string' && !path.isAbsolute(file) && !file.includes('\\') && !file.includes(':')
    && !file.split('/').some(v => !v || v === '.' || v === '..')
    && !/^\.(?:local|git|env)(?:\/|$)/u.test(file));
  return path.join(ROOT, file);
}
export function historicalObjects(manifest, payload) {
  let at = 0; const result = new Map();
  for (const [file, row] of Object.entries(manifest.historical_setup_sources)) {
    const end = payload.indexOf(10, at); assert(end >= at);
    const fields = payload.subarray(at, end).toString('utf8').split(' '); at = end + 1;
    same(fields, [row.git_blob, 'blob', String(row.bytes)]);
    const bytes = payload.subarray(at, at + row.bytes); at += row.bytes;
    assert.equal(payload[at++], 10); assert.equal(bytes.length, row.bytes); assert.equal(sha(bytes), row.sha256);
    result.set(file, Buffer.from(bytes));
  }
  assert.equal(at, payload.length); assert.equal(result.size, 118);
  assert(!result.has('development/m07/recovery33/README.md'));
  return result;
}
export async function inputs() {
  const bytes = await regular(path.join(ROOT, PURPOSE, 'frozen-inputs.json'));
  assert.equal(sha(bytes), MANIFEST_SHA); const manifest = JSON.parse(bytes);
  assert.equal(manifest.schema_version, '1.0'); assert.equal(manifest.sql.sql_contract_sha256, CONTRACT_SHA);
  assert.equal(manifest.current_source_pins[CONTRACT], CONTRACT_SHA);
  assert.equal(Object.keys(manifest.historical_setup_sources).length, 118);
  assert.equal(manifest.historical_commit, 'd3698486d1fc41d187246d66b1d51175c9f448cd');
  const objects = Object.values(manifest.historical_setup_sources).map(row => row.git_blob + '\n').join('');
  assert(Object.values(manifest.historical_setup_sources).every(row => /^[a-f0-9]{40}$/u.test(row.git_blob)));
  const read = spawnSync('git', ['cat-file', '--batch'], { cwd: ROOT, env: environment(), input: objects, timeout: 30000, maxBuffer: 32 * 1024 ** 2, windowsHide: true });
  assert.equal(read.status, 0); const historical = historicalObjects(manifest, read.stdout);
  const sources = new Map();
  for (const [file, digest] of Object.entries(manifest.current_source_pins)) {
    const raw = await regular(relativeFile(file)); assert.equal(sha(raw), digest, 'WORKER38_FROZEN_INPUT_CHANGED'); sources.set(file, raw);
  }
  for (const [file, raw] of historical) same(raw, sources.get(file));
  for (const [file, digest] of Object.entries(SOURCE_PINS)) assert.equal(sha(sources.get(file)), digest);
  for (const file of OWN) sources.set(file, await regular(relativeFile(file)));
  return { sources, manifest, historical };
}
export function compareSnapshot(snapshot, tables) {
  const value = clone(snapshot);
  for (const name of tables) { delete value.state.data[name]; delete value.config[name].table_hash; }
  return value;
}
export function expectedFlags(snapshot, tables, enabled) {
  const value = compareSnapshot(snapshot, tables);
  for (const table of tables) value.config[table].public.enabled = enabled;
  return value;
}
export function exactAssertion(expression, expected, code) {
  assert(/^WORKER38_[A-Z_]+$/u.test(code));
  return `do $worker38_compare$declare actual jsonb;begin actual:=(${expression});if actual is distinct from ${json(expected)} then raise exception'${code}';end if;end$worker38_compare$;\n`;
}
export function rawPrelude(identity, application, postgres = true) {
  ownedIdentity33(identity); assert(/^eps38_[a-z0-9_]{1,55}$/u.test(application));
  // Every guard/query here is autocommit. The first application transaction is
  // the unchanged production prefix, never ctx.sql()'s preceding BEGIN wrapper.
  return `set log_statement='none';set log_min_duration_statement=-1;set lock_timeout='5s';set statement_timeout='45s';set timezone='UTC';set application_name=${literal(application)};
do $worker38_owned$begin if ${ownedPredicate33(identity)}or(pg_control_system()).system_identifier::text<>'7701520506262638626'then raise exception'WORKER38_OWNED_DATABASE_REQUIRED';end if;end$worker38_owned$;
${postgres ? 'set session authorization postgres;\n' : ''}`;
}
export function snapshotQuery(sql) { return sql.snapshot_sql + ' as worker38_snapshot;\n'; }
export function pausePhase(sql, before, { commit = false } = {}) {
  assert(sql.transaction_prefix.endsWith('\n') && sql.transaction_prefix.startsWith('begin isolation level repeatable read;'));
  assert(sql.pause_updates.length === 5);
  return sql.transaction_prefix + exactAssertion(sql.snapshot_sql, before, 'WORKER38_INTAKE_DRIFT_REFUSED')
    + `do $worker38_zero$begin if (${sql.lifecycle_sql})<>${json(Object.fromEntries(sql.counters.map(k => [k, 0])))} then raise exception'WORKER38_LIFECYCLE_NOT_ZERO';end if;end$worker38_zero$;\n`
    + sql.pause_updates.join('')
    + exactAssertion(sql.comparable_sql, expectedFlags(before, sql.config_tables, false), 'WORKER38_PAUSE_PRESERVATION_FAILED')
    + (commit ? 'commit;\n' : '');
}
export function resumeFlags(sql, paused, original) {
  return sql.transaction_prefix + exactAssertion(sql.snapshot_sql, paused, 'WORKER38_PAUSED_STATE_CHANGED')
    + sql.resume_updates.join('') + exactAssertion(sql.snapshot_sql, original, 'WORKER38_FLAGS_NOT_RESTORED') + 'commit;\n';
}
export function ownedMigration(file, raw, identity, runId) {
  ownedIdentity33(identity); assert(UUID.test(runId)); let source = raw.toString('utf8'); const original = source;
  const version = path.basename(file).slice(0, 14); assert(/^\d{14}$/u.test(version));
  let begin, end;
  if (version === '20261031143711') {
    begin = source.indexOf("(current_database()<>'postgres'and not("); end = source.indexOf('\n or(select array_agg(version', begin);
    assert(begin > 0 && end > begin); source = source.slice(0, begin) + '(' + ownedPredicate33(identity) + ')' + source.slice(end);
  } else {
    const match = /current_database\(\)\s*<>\s*'postgres'/gu; assert.equal([...source.matchAll(match)].length, 1);
    source = source.replace(match, () => '(' + ownedPredicate33(identity) + ')');
  }
  let protectedAdmission;
  if (version === '20261101012057') {
    assert.equal(sha(raw), '4209e16b7d67cfb793375d24dfd22f9fee72f3516e3dde16be1d2b0d633b7267');
    const start = source.indexOf('\n or not(exists(select 1 from eps.jobs j join eps.specs s');
    const stop = source.indexOf("\n then raise exception 'M07_ATTEMPT36_EXACT_REVIEWED35_REQUIRED'", start);
    assert(start > 0 && stop > start);
    const canonical = source.slice(start, stop);
    assert.equal(source.split(canonical).length, 2);
    assert(canonical.includes("j.id='b3f90268-147d-41d4-8875-2a6435df1496'"));
    assert(canonical.includes("j.resource_id='73a1a500-acfe-48cc-91ba-53a83b895118'"));
    // The real canonical protected cohort deliberately does not exist in the
    // inherited empty local29 setup. Never create it or waive cloud protection.
    // This is an owned-only admission substitution; history, reviewed35 hash,
    // role/table/function/trigger absence and every functional byte stay exact.
    const owned = `
 or current_setting('eps.worker38.concurrency',true)is distinct from'owned-local-v1'
 or exists(select 1 from eps.jobs)
 or exists(select 1 from eps.specs)
 or exists(select 1 from eps.media_assets)
 or exists(select 1 from eps.presentation_versions)
 or exists(select 1 from eps.jobs where id='b3f90268-147d-41d4-8875-2a6435df1496')
 or exists(select 1 from eps.specs where id='73a1a500-acfe-48cc-91ba-53a83b895118')
 or to_regprocedure('public.eps_submit_specs(uuid,jsonb,text)')is null
 or to_regprocedure('public.eps_retry_job(uuid,jsonb,text)')is null
 or(select encode(sha256(convert_to(replace(prosrc,E'\\r\\n',E'\\n'),'UTF8')),'hex')from pg_proc where oid=to_regprocedure('eps.specs_submit_ack(uuid,uuid,uuid)'))is distinct from'e0a7c7be311e6b2139faf08238121f4687d379844a26dd602ff8331b54231481'`;
    source = source.slice(0, start) + owned + source.slice(stop);
    protectedAdmission = { canonical_clause_sha256: sha(canonical), owned_clause_sha256: sha(owned),
      canonical_job_and_spec_absence_required: true, owned_empty_jobs_specs_media_versions_required: true,
      reviewed35_history_hash_and_schema_guards_retained: true };
  }
  const anchor = {
    '20261031143711': '\ncreate function eps.english_transcript_text_valid(',
    '20261031182038': '\ncreate function public.eps_get_workspace_summary(',
    '20261101012057': '\ncreate role eps_job_trace_owner',
    '20261101042702': '\ncreate function eps.feedback_summary(',
    '20261101110939': '\ncreate function public.eps_list_jobs_by_batch(',
  }[version];
  assert(anchor); assert.equal(original.split(anchor).length, 2); assert.equal(source.split(anchor).length, 2);
  assert.equal(source.slice(source.indexOf(anchor)), original.slice(original.indexOf(anchor)), 'WORKER38_FUNCTIONAL_DDL_CHANGED');
  const functionalSha = sha(original.slice(original.indexOf(anchor)));
  const begins = [...source.matchAll(/^begin;\s*$/gmu)], commits = [...source.matchAll(/^commit;\s*$/gmu)];
  assert(begins.length <= 1 && commits.length <= 1);
  source = source.replace(/^begin;\s*$/mu, '').replace(/^commit;\s*$/mu, '');
  let body = "set local session authorization postgres;set local eps.worker38.concurrency='owned-local-v1';\n" + source + '\n';
  if (version === '20261101012057') {
    const prefix = 'eps-worker38-concurrency:' + runId + ':trace:';
    // Role creation and its marker containing its exact OID commit atomically.
    body += `do $worker38_role_marker$declare owned_trace_oid oid;begin select oid into strict owned_trace_oid from pg_roles where rolname='${TRACE_ROLE}';execute format('comment on role %I is %L','${TRACE_ROLE}',${literal(prefix)}||owned_trace_oid::text);end$worker38_role_marker$;\n`;
  }
  body += `insert into supabase_migrations.schema_migrations(version,statements,name)values('${version}',array[]::text[],'worker38_owned_concurrency');\n`;
  return { body, source_sha256: sha(raw), adapted_sha256: sha(body), functional_sha256: functionalSha,
    owned_target_and_outer_transaction_adapter: true, ...(protectedAdmission ? { protected_data_admission: protectedAdmission } : {}),
    outer_begin_removed: begins.length, outer_commit_removed: commits.length, version };
}
export function roleQuery() {
  return `select jsonb_build_object('role',(select jsonb_build_object('oid',r.oid,'name',r.rolname,'marker',shobj_description(r.oid,'pg_authid'),
'login',r.rolcanlogin,'super',r.rolsuper,'inherit',r.rolinherit,'bypassrls',r.rolbypassrls,'create_db',r.rolcreatedb,'create_role',r.rolcreaterole,'replication',r.rolreplication,'limit',r.rolconnlimit,'valid_until',r.rolvaliduntil,
'memberships',(select coalesce(jsonb_agg(jsonb_build_object('role',roleid::regrole::text,'member',member::regrole::text,'grantor',grantor::regrole::text,'admin',admin_option,'inherit',inherit_option,'set',set_option)order by roleid,member,grantor),'[]')from pg_auth_members where roleid=r.oid or member=r.oid or grantor=r.oid),
'dependencies',(select coalesce(jsonb_agg(jsonb_build_object('dbid',dbid,'classid',classid::regclass::text,'objid',objid,'objsubid',objsubid,'deptype',deptype)order by dbid,classid,objid,objsubid),'[]')from pg_shdepend where refclassid='pg_authid'::regclass and refobjid=r.oid))from pg_roles r where r.rolname='${TRACE_ROLE}'));`;
}
export function admitTraceRole(row, runId, expectedOid) {
  assert(row && row.name === TRACE_ROLE && Number.isSafeInteger(row.oid) && row.oid > 0 && UUID.test(runId));
  assert.equal(row.marker, 'eps-worker38-concurrency:' + runId + ':trace:' + row.oid);
  if (expectedOid !== undefined) assert.equal(row.oid, expectedOid);
  for (const field of ['login', 'super', 'inherit', 'bypassrls', 'create_db', 'create_role', 'replication']) assert.equal(row[field], false);
  assert.equal(row.limit, -1); assert.equal(row.valid_until, null);
  assert(row.memberships.length >= 1 && row.memberships.length <= 2);
  assert.equal(new Set(row.memberships.map(value => value.grantor)).size, row.memberships.length);
  for (const membership of row.memberships) {
    assert.equal(membership.role, TRACE_ROLE); assert.equal(membership.member, 'postgres');
    assert(['postgres', 'supabase_admin'].includes(membership.grantor));
    // PostgreSQL17 creates a bootstrap-granted ADMIN/SET FALSE membership for
    // a non-superuser creator; the explicit GRANT can be another grantor row.
    // Record both exact rows, never normalize or alter them during cleanup.
    for (const field of ['admin', 'inherit', 'set']) assert.equal(typeof membership[field], 'boolean');
  }
  assert(row.memberships.some(value => value.set === true));
  return row;
}
export function cleanupRoleSql(row, runId, databases) {
  admitTraceRole(row, runId, row.oid); assert.deepEqual(row.dependencies, []);
  same([...databases].sort(), ['eps_m07_r33_source_' + runId.replaceAll('-', ''), 'eps_m07_r33_restore_' + runId.replaceAll('-', '')].sort());
  const absence = databases.map(v => literal(v)).join(',');
  return `begin;set local lock_timeout='5s';set local statement_timeout='15s';lock table pg_authid,pg_auth_members,pg_shdepend in share row exclusive mode;
do $worker38_role_cleanup$declare actual jsonb;begin
if exists(select 1 from pg_database where datname in(${absence}))then raise exception'WORKER38_DATABASE_ABSENCE_REQUIRED';end if;
actual:=(${roleQuery().replace(/;$/u, '')});if actual is distinct from ${json({ role: row })} then raise exception'WORKER38_ROLE_CHANGED';end if;end$worker38_role_cleanup$;
drop role eps_job_trace_owner;commit;`;
}

export function backendIdentitySql() {
  return "select jsonb_build_object('pid',pg_backend_pid(),'backend_start',(select backend_start::text from pg_stat_activity where pid=pg_backend_pid()),'user',(select usename from pg_stat_activity where pid=pg_backend_pid()),'application',(select application_name from pg_stat_activity where pid=pg_backend_pid()));";
}
export function backendPredicate(identity, record) {
  ownedIdentity33(identity); assert(Number.isSafeInteger(record.pid) && record.pid > 0);
  assert(typeof record.backend_start === 'string' && record.backend_start.length < 100);
  assert(/^eps38_[a-z0-9_]{1,55}$/u.test(record.application)); assert(['postgres', 'supabase_admin'].includes(record.user));
  return `pid=${record.pid} and datname=${literal(identity.database)} and backend_start::text=${literal(record.backend_start)} and application_name=${literal(record.application)} and usename=${literal(record.user)}`;
}
export function backendActionSql(identity, record, action) {
  const check = backendPredicate(identity, record); assert(['cancel', 'terminate', 'absence'].includes(action));
  if (action === 'cancel') return `select jsonb_build_object('owned_backend_count',(select count(*)from pg_stat_activity where ${check}),'cancelled',(select pg_cancel_backend(pid)from pg_stat_activity where ${check}));`;
  if (action === 'terminate') return `select jsonb_build_object('terminated',(select pg_terminate_backend(pid)from pg_stat_activity where ${check}));`;
  return `select jsonb_build_object('count',(select count(*)from pg_stat_activity where ${check}));`;
}
export function lockObservationSql(blockedPid, blockerPid, configOnly) {
  assert([blockedPid, blockerPid].every(value => Number.isSafeInteger(value) && value > 0)); assert.equal(typeof configOnly, 'boolean');
  const relation = configOnly ? "and relation in('eps.specs_pipeline_config'::regclass,'eps.candidate_asset_config'::regclass,'eps.frame_extraction_config'::regclass,'eps.review_processing_config'::regclass,'eps.presentation_processing_config'::regclass)and mode='AccessExclusiveLock'" : '';
  return `select jsonb_build_object('blocker',${blockerPid}=any(pg_blocking_pids(${blockedPid})),'relation_wait',exists(select 1 from pg_locks where pid=${blockedPid} and locktype='relation' and not granted ${relation}),'cached_config_read',exists(select 1 from pg_locks where pid=${blockerPid} and relation='eps.specs_pipeline_config'::regclass and mode='AccessShareLock' and granted));`;
}

/** Bounded interactive raw psql. No ctx.sql() transaction wrapper is used. */
export function rawSession(ctx, identity, label, { observer = false } = {}) {
  assert(/^[a-z_]{1,12}$/u.test(label));
  const application = 'eps38_' + ctx.runId.replaceAll('-', '').slice(0, 24) + '_' + label;
  const args = ['--host', ctx.host, ...ctx.psqlArgs(identity.database)];
  assert(ctx.host === 'npipe:////./pipe/dockerDesktopLinuxEngine' || ctx.host === 'unix:///var/run/docker.sock');
  const child = spawn('docker', args, { cwd: ROOT, env: environment(), shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  let lines = '', diagnosticBytes = 0, diagnosticText = '', outputBytes = 0, pending, exited = false, exitCode, identityRecord;
  const finished = new Promise(resolve => child.once('close', code => { exited = true; exitCode = code; if (pending) {
    clearTimeout(pending.timer); pending.reject(error(diagnosticText.includes('WORKER38_INTAKE_DRIFT_REFUSED') ? 'WORKER38_INTAKE_DRIFT_REFUSED' : 'WORKER38_SESSION_ENDED')); pending = undefined;
  } resolve(code); }));
  child.stdin.on('error', () => {});
  child.once('error', () => { if (pending) { clearTimeout(pending.timer); pending.reject(error('WORKER38_SESSION_START_FAILED')); pending = undefined; } });
  child.stderr.on('data', chunk => { diagnosticBytes += chunk.length; if (diagnosticBytes > 32768) { child.stdin.destroy(); child.kill(); }
    else diagnosticText += chunk.toString('utf8'); });
  child.stdout.setEncoding('utf8').on('data', chunk => {
    outputBytes += Buffer.byteLength(chunk); lines += chunk;
    if (outputBytes > 8 * 1024 ** 2) { child.stdin.destroy(); child.kill(); return; }
    while (lines.includes('\n')) {
      const at = lines.indexOf('\n'); const line = lines.slice(0, at).replace(/\r$/u, ''); lines = lines.slice(at + 1);
      if (!pending) continue;
      if (line.startsWith('{')) {
        let value;
        try { value = JSON.parse(line); } catch { pending.reject(error('WORKER38_JSON_UNCONFIRMED')); clearTimeout(pending.timer); pending = undefined; continue; }
        if (value.__worker38_marker === pending.marker) { const selected = pending; pending = undefined; clearTimeout(selected.timer); selected.resolve(selected.rows); }
        else pending.rows.push(value);
      }
    }
  });
  function request(sql, timeout = 45000) {
    assert(!pending && !exited && typeof sql === 'string' && sql.length <= 2 * 1024 ** 2);
    return new Promise((resolve, reject) => {
      const marker = randomUUID(); const timer = setTimeout(() => {
        if (pending?.marker === marker) { pending = undefined; reject(error('WORKER38_SESSION_DEADLINE')); }
      }, timeout);
      pending = { marker, timer, rows: [], resolve, reject };
      child.stdin.write(sql + `\nselect jsonb_build_object('__worker38_marker',${literal(marker)});\n`);
    });
  }
  return { request, application, get pid() { return identityRecord?.pid; }, get record() { return identityRecord; }, get pending() { return !!pending; },
    async start() {
      const result = await request(rawPrelude(identity, application, !observer) + backendIdentitySql());
      assert.equal(result.length, 1); identityRecord = result[0];
      assert(Number.isSafeInteger(identityRecord.pid) && identityRecord.pid > 0);
      assert.equal(identityRecord.application, application); assert(['postgres', 'supabase_admin'].includes(identityRecord.user));
      assert.equal(typeof identityRecord.backend_start, 'string'); return this;
    },
    async finish() {
      if (!exited && !pending) child.stdin.end('rollback;\n\\quit\n');
      return Promise.race([finished, delay(5000).then(() => { child.stdin.destroy(); child.kill(); throw error('WORKER38_SESSION_CLOSE_UNCONFIRMED'); })]);
    },
    async cancel(observerSession) {
      if (exited) return;
      assert(identityRecord && observerSession !== this);
      const result = await observerSession.request(backendActionSql(identity, identityRecord, 'cancel'));
      assert.equal(result.length, 1); assert([0, 1].includes(result[0].owned_backend_count));
      if (!exited && !pending) child.stdin.end('rollback;\n\\quit\n');
      await Promise.race([finished, delay(2000)]);
      if (!exited) {
        await observerSession.request(backendActionSql(identity, identityRecord, 'terminate'));
        await Promise.race([finished, delay(3000).then(() => { throw error('WORKER38_OWNED_BACKEND_UNCONFIRMED'); })]);
      }
    }, get exitCode() { return exitCode; } };
}
export function actorStart() { return "begin;set local role authenticated;select eps_worker38_conc.set_actor();\n"; }
export function unwrappedSnapshot(sql) { return 'begin read only;set local search_path=\'\';' + snapshotQuery(sql) + 'rollback;'; }
function only(rows) { assert.equal(rows.length, 1); return rows[0]; }
function zeroLifecycle(sql) { return Object.fromEntries(sql.counters.map(v => [v, 0])); }
async function waitForBlock(observer, blocked, blocker, { configOnly = true } = {}) {
  const started = Date.now(); let last;
  while (Date.now() - started < 2500) {
    assert(blocked.pending);
    last = only(await observer.request(lockObservationSql(blocked.pid, blocker.pid, configOnly)));
    if (last.blocker === true && last.relation_wait === true && (!configOnly || last.cached_config_read === true)) return { ...last, elapsed_ms: Date.now() - started };
    await delay(20);
  }
  throw error('WORKER38_EXPECTED_LOCK_WAIT_MISSING');
}

export async function cleanupTrace38(ctx) {
  const query = async () => only(ctx.rows((await ctx.docker(ctx.psqlArgs('template1'), { input: 'begin read only;' + roleQuery() + 'rollback;' })).stdout)).role;
  const observed = await query();
  if (observed === null) { ctx.report.worker38_trace_role_removed = true; return; }
  assert.equal(ctx.report.worker38_trace_creation_attempted, true, 'WORKER38_UNOWNED_TRACE_ROLE');
  admitTraceRole(observed, ctx.runId, ctx.report.worker38_trace_role?.oid);
  same(observed.dependencies, []);
  const sql = cleanupRoleSql(observed, ctx.runId, [ctx.sourceDb, ctx.restoreDb]);
  await ctx.docker(ctx.psqlArgs('template1'), { input: sql }); same(await query(), null);
  ctx.report.worker38_trace_role_removed = true;
}

export async function runConcurrency38(ctx) {
  assert.equal(ctx.root, ROOT); assert(UUID.test(ctx.runId));
  const { manifest, sources } = await inputs();
  for (const [file, raw] of sources) same(raw, ctx.sourceFiles.get(file));
  const sql = manifest.sql;
  const identity = { database: ctx.sourceDb, marker: ctx.marker(ctx.sourceDb), oid: (await ctx.databaseIdentity(ctx.sourceDb)).oid };
  const migrations = [...sources.keys()].filter(v => /^supabase\/migrations\/(?:20261031143711|20261031182038|20261101012057|20261101042702|20261101110939)_/u.test(v)).sort();
  assert.equal(migrations.length, 5);
  const applied = []; ctx.report.worker38_actual34_to38 = applied;
  for (const file of migrations) {
    const adapted = ownedMigration(file, sources.get(file), identity, ctx.runId);
    ctx.report.checkpoint = 'worker38-owned-migration-' + adapted.version;
    const record = { file, ...adapted, status: 'prepared' }; delete record.body; applied.push(record);
    await writeFile(path.join(ctx.privateRoot, 'worker38-migration-' + adapted.version + '-owned.sql'), adapted.body, { flag: 'wx', mode: 0o600 });
    if (adapted.version === '20261101012057') {
      const before = only(ctx.rows((await ctx.docker(ctx.psqlArgs('template1'), { input: 'begin read only;' + roleQuery() + 'rollback;' })).stdout)).role;
      same(before, null); ctx.report.worker38_trace_creation_attempted = true;
    }
    await ctx.sql(ctx.sourceDb, adapted.body);
    record.status = 'committed';
    if (adapted.version === '20261101012057') {
      const row = only(ctx.rows((await ctx.docker(ctx.psqlArgs('template1'), { input: 'begin read only;' + roleQuery() + 'rollback;' })).stdout)).role;
      admitTraceRole(row, ctx.runId); ctx.report.worker38_trace_role = row;
    }
  }
  ctx.report.checkpoint = 'worker38-owned-current38-fixture';
  await ctx.sql(ctx.sourceDb, "set local eps.worker38.concurrency='owned-local-v1';\n" + sources.get(PURPOSE + 'fixture.sql').toString('utf8'));
  const sessions = []; let observer; ctx.report.worker38_sessions_attempted = true;
  const start = async (label, options) => { const session = rawSession(ctx, identity, label, options); sessions.push(session); return session.start(); };
  try {
    observer = await start('observer', { observer: true });
    const control = await start('control'); const before = only(await control.request(unwrappedSnapshot(sql)));
    same(before.lifecycle, zeroLifecycle(sql));
    assert(sql.config_tables.every(table => before.config[table].public.enabled === true));
    const a = await start('cached'); const b = await start('pauser');
    const accepted = only(await a.request(actorStart() + "select eps_worker38_conc.submit('worker38-cached-intake-rollback',1);"));
    assert.equal(accepted.status, 'queued');
    const waiting = b.request(pausePhase(sql, before)).then(rows => ({ rows }), failure => ({ failure }));
    const firstWait = await waitForBlock(observer, b, a);
    await a.request('rollback;'); const pausedOutcome = await waiting;
    assert(!pausedOutcome.failure, 'WORKER38_PAUSE_DID_NOT_COMPLETE');
    assert.equal(b.pending, false);
    // Start a genuinely new intake behind the still-held pause transaction.
    // It may wait at an earlier business relation SHARE lock, so no config-only
    // wait is claimed for this cold caller.
    const cold = await start('cold');
    const coldWaiting = cold.request(actorStart() + "select eps_worker38_conc.expect_submit_denied('worker38-cold-intake-after-pause',1);commit;").then(rows => ({ rows }), failure => ({ failure }));
    const coldWait = await waitForBlock(observer, cold, b, { configOnly: false });
    await b.request('commit;'); const denied = await coldWaiting;
    assert(!denied.failure); same(only(denied.rows), { error_code: 'DEPENDENCY_UNAVAILABLE' });
    const paused = only(await control.request(unwrappedSnapshot(sql)));
    same(compareSnapshot(paused, sql.config_tables), expectedFlags(before, sql.config_tables, false));
    same(paused.lifecycle, zeroLifecycle(sql));
    ctx.report.worker38_cached_pause_wait = firstWait; ctx.report.worker38_cold_intake_wait = coldWait;
    ctx.report.cached_intake_waited_before_snapshot = true; ctx.report.fresh_intake_denied_after_pause = true;

    const retry = await start('retry');
    const seeded = await retry.request("begin;set local eps.worker38.concurrency='owned-local-v1';select eps_worker38_conc.seed_retry_rows();select " + sql.lifecycle_sql + ';');
    assert.equal(seeded.length, 2); assert.equal(seeded[1].generic_retry_lifecycle, 1); assert.equal(seeded[1].presentation_retry_lifecycle, 2);
    assert.equal(seeded[1].queued, 0); assert.equal(seeded[1].pending_outbox, 0);
    const retried = only(await retry.request("set local role authenticated;select eps_worker38_conc.set_actor();select eps_worker38_conc.retry_generic('worker38-paused-generic-retry');"));
    assert.equal(retried.status, 'queued');
    const afterRetry = only(await retry.request('set local role postgres;select ' + sql.lifecycle_sql + ';'));
    assert.equal(afterRetry.generic_retry_lifecycle, 0); assert.equal(afterRetry.presentation_retry_lifecycle, 2);
    assert.equal(afterRetry.queued, 1); assert(afterRetry.pending_outbox >= 1);
    await retry.request('rollback;'); same(only(await control.request(unwrappedSnapshot(sql))), paused);
    ctx.report.retry_lifecycle_not_hidden_by_pause = true;
    ctx.report.worker38_retry_scope = { actual_generic_retry_rpc: true, generic_before: 1, presentation_export_conservative_before: 2,
      generic_after: 0, queued_after: 1, full_retry_fixture_rolled_back: true, presentation_or_export_retry_eligibility_proven: false };

    await control.request(resumeFlags(sql, paused, before)); same(only(await control.request(unwrappedSnapshot(sql))), before);
    const raced = only(await a.request(actorStart() + "select eps_worker38_conc.submit('worker38-cached-intake-commit-race',2);"));
    assert.equal(raced.status, 'queued');
    const firstSnapshot = b.request(sql.transaction_prefix + snapshotQuery(sql)).then(rows => ({ rows }), failure => ({ failure }));
    const commitWait = await waitForBlock(observer, b, a);
    await a.request('commit;'); const visible = await firstSnapshot;
    assert(!visible.failure); const observed = only(visible.rows);
    assert.equal(observed.lifecycle.queued, 1); assert(observed.lifecycle.pending_outbox >= 1);
    assert.notDeepEqual(observed, before);
    // The exact production precondition assertion is executed after the first
    // snapshot. Its expected mismatch aborts this backend before any UPDATE.
    const rejected = await b.request(exactAssertion(sql.snapshot_sql, before, 'WORKER38_INTAKE_DRIFT_REFUSED')).then(() => null, failure => failure);
    assert.equal(rejected?.code, 'WORKER38_INTAKE_DRIFT_REFUSED');
    const final = only(await control.request(unwrappedSnapshot(sql)));
    assert(sql.config_tables.every(table => final.config[table].public.enabled === true));
    assert.equal(final.lifecycle.queued, 1);
    const exactJob = only(await control.request(`begin read only;select jsonb_build_object('exists',exists(select 1 from eps.jobs where id=${literal(raced.job_id ?? raced.id)}::uuid and workspace_id=eps_worker38_conc.workspace(2)and status='queued'));rollback;`));
    assert.equal(exactJob.exists, true);
    ctx.report.worker38_commit_race_wait = commitWait;
    ctx.report.worker38_committed_intake_seen_in_first_snapshot = true;
    ctx.report.worker38_stale_preflight_refused_before_update = true;
    ctx.report.actual_native_sql_concurrency = true; ctx.report.sql_contract_sha256 = CONTRACT_SHA;
    ctx.report.worker38_scope = { actual_current38_config_and_rpc_SQL: true, config_and_one_intake_commits_owned_database_only: true,
      global_outer_transaction_rollback_claimed: false, full_cloud_phase_operator_verified: false,
      native_media_executed: false, restore_acceptance: false, HTTP_or_MCP_tested: false, worker_or_provider_called: false };
  } finally {
    if (observer) {
      for (const session of sessions.filter(value => value !== observer)) await session.cancel(observer);
      const identities = sessions.filter(value => value !== observer).map(value => value.record).filter(Boolean);
      for (const record of identities) {
        const absent = only(await observer.request(backendActionSql(identity, record, 'absence')));
        assert.equal(absent.count, 0);
      }
      await observer.finish();
      const observerGone = await ctx.value(ctx.sourceDb, backendActionSql(identity, observer.record, 'absence'));
      assert.equal(observerGone.count, 0); ctx.report.worker38_owned_backends_closed = true;
    }
  }
}

export function finalizeConcurrencyReport(report) {
  report.all_resources_cleaned = report.disposable_databases_removed === true && report.worker38_trace_role_removed === true
    && report.new33_roles_removed === true && (report.worker38_owned_backends_closed === true || report.worker38_sessions_attempted !== true)
    && report.shared_test_lock_released === true;
  report.original_state_preserved = ['original_local_database_unchanged', 'original29_full_catalogue_unchanged', 'original29_full_auth_storage_catalogue_unchanged',
    'original29_exact_profile_and_settings_state_unchanged', 'existing_global_role_oids_attributes_memberships_unchanged'].every(key => report[key] === true);
  if (!report.all_resources_cleaned || !report.original_state_preserved || report.actual_native_sql_concurrency !== true
    || report.worker38_committed_intake_seen_in_first_snapshot !== true || report.worker38_stale_preflight_refused_before_update !== true) report.result = 'failed';
}

export function compileProof(sources, manifest, runId) {
  assert(UUID.test(runId)); assert.notEqual(runId, '9af6774f-ebbc-4a57-a11c-b21ceab69b7c');
  assert.equal(sha(sources.get(PURPOSE + 'frozen-inputs.json')), MANIFEST_SHA);
  const original = compileController33(sources, { root: ROOT, runId, mode: 'metadata' }); let source = original.source;
  const changes = [];
  function once(before, after, label) {
    assert.equal(source.split(before).length, 2, 'WORKER38_FIXED_CONTROLLER_SEAM');
    source = source.replace(before, () => after); changes.push({ label, before_sha256: sha(before), after_sha256: sha(after) });
  }
  once(`const ROOT = ${JSON.stringify(ROOT)};`, `const ROOT = ${JSON.stringify(ROOT)};\nif(!${EXECUTION_ENABLED})throw Error('WORKER38_CONCURRENCY_EXECUTION_DISABLED');`, 'disabled-before-target-and-shared-lock');
  once('let recovery33; let expectedSourceCatalogue;', `let recovery33; let expectedSourceCatalogue;\nimport { runConcurrency38,cleanupTrace38,finalizeConcurrencyReport } from '${pathToFileURL(path.join(ROOT, PURPOSE, 'proof.mjs')).href}';`, 'new-purpose-runtime-only');
  once('await recovery33.metadataRestore();', 'await runConcurrency38({root:ROOT,runId,sourceDb,restoreDb,sourceFiles,report,privateRoot,sql,value,rows,databaseIdentity,marker,catalogue,recovery33,docker,psqlArgs,host:HOST});', 'replace-restore-exercise-with-actual38-concurrency');
  once('report.disposable_databases_removed=true; if(recovery33) await recovery33.cleanupRoles();',
    'report.disposable_databases_removed=true; await cleanupTrace38({report,runId,sourceDb,restoreDb,docker,psqlArgs,rows}); if(recovery33) await recovery33.cleanupRoles();', 'new-trace-role-after-owned-drops-before-old-global-comparison');
  once("scope: 'AT-070 full owned29->33 metadata synthetic local restore; original29 and existing global roles preserved'",
    "scope: 'Owned local29->33->38 real config-lock/intake/retry SQL concurrency; committed cases confined to disposable DB; no media/restore/provider/cloud-phase proof'", 'truthful-scope');
  once("'.local/m07-recovery'", "'.local/m07-worker38-concurrency-tests'", 'new-private-artifact-purpose');
  once("'tracking/evidence/m07/recovery33'", "'tracking/evidence/m07/worker38-concurrency'", 'new-receipt-purpose');
  once('report.finished_at = new Date().toISOString();', 'finalizeConcurrencyReport(report);report.finished_at = new Date().toISOString();', 'derive-final-preservation-from-actual-cleanup');
  const at = source.indexOf('sourcePaths.push(...'); assert(at > 0);
  source = source.slice(0, at) + `sourcePaths.push(...${JSON.stringify([...sources.keys()])});\n  ` + source.slice(at);
  const seal = 'report.source_seals = Object.fromEntries([...sourceFiles].map(([file, bytes]) => [file, sha(bytes)]));';
  once(seal, seal + `\nfor(const[file,digest]of Object.entries(${JSON.stringify(Object.fromEntries([...sources].map(([f, b]) => [f, sha(b)])))}))assert.equal(sha(sourceFiles.get(file)),digest,'WORKER38_PREPARED_SOURCE_CHANGED');`, 'complete-current-and-historical-source-closure');
  assert(!source.includes('await recovery33.metadataRestore();')); assert(source.includes('if (false) {'));
  return { source, plan: { schema_version: '1.0', purpose: 'worker38-owned-config-concurrency', run_id: runId,
    execution_enabled: EXECUTION_ENABLED, generated_source_sha256: sha(source), sql_contract_sha256: CONTRACT_SHA,
    source_pins: Object.fromEntries([...sources].map(([file, raw]) => [file, sha(raw)])),
    historical_setup_sources: 118, historical_119_replay_claimed: false, compiler_pins_preserved: true, compiler_pin_count: 13,
    inherited_controller_sha256: sha(original.source), inherited_substitutions: original.manifest.substitutions,
    substitutions: changes, production_sql_fragments: Object.fromEntries(['transaction_prefix', 'snapshot_sql', 'lifecycle_sql', 'comparable_sql'].map(key => [key, sha(manifest.sql[key])])),
    maximum_owned_raw_sessions: 7, process_timeout_ms: 600000, prepared_without_SQL_or_provider: true,
    global_outer_rollback_claimed: false, native_media_or_restore_acceptance: false } };
}
export async function regenerateContract() {
  const program = `from pathlib import Path
import importlib.util,json,re,hashlib
root=Path.cwd()
def module(name,file):
 spec=importlib.util.spec_from_file_location(name,root/file);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
s=module('worker38_proof_pure_contract','development/m07/specs-diagnostic-worker38-adoption/state.py')
t=module('worker38_proof_pure_emit_test','development/m07/specs-diagnostic-worker38-adoption/test_adoption.py')
fixture=t.fixture();image='sha256:'+'a'*64;marker='b9380000-0000-4000-8000-000000000001'
pause=s.render('pause',fixture,image,marker);resume=s.render('resume',t.after(t.after(fixture,'pause'),'pin'),image,marker)
blocks=lambda sql:re.findall(r'do \\$worker38_update\\$.*?end\\$worker38_update\\$;\\n',sql,re.S)
print(json.dumps({'transaction_prefix':s.transaction_prefix(),'snapshot_sql':s.snapshot_sql(),'comparable_sql':s.comparable_sql(),'lifecycle_sql':s.lifecycle_sql(),'pause_updates':blocks(pause),'resume_updates':blocks(resume),'production_pause_emission_sha256':hashlib.sha256(pause.encode()).hexdigest(),'production_resume_emission_sha256':hashlib.sha256(resume.encode()).hexdigest(),'sql_contract_sha256':s.sql_contract_sha256(),'config_tables':sorted(s.CONFIG),'counters':list(s.COUNTERS)},sort_keys=True))`;
  const result = spawnSync(path.join(ROOT, '.venv-skills/Scripts/python.exe'), ['-X', 'utf8', '-B', '-c', program],
    { cwd: ROOT, env: environment(), timeout: 30000, maxBuffer: 2 * 1024 ** 2, windowsHide: true });
  assert.equal(result.status, 0); return JSON.parse(result.stdout);
}
async function exclusive(file, raw) {
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 }); assert.equal(await realpath(path.dirname(file)), path.dirname(file));
  await writeFile(file, raw, { flag: 'wx', mode: 0o600 });
}
export async function prepare(runId) {
  assert(EXECUTION_ENABLED, 'WORKER38_CONCURRENCY_EXECUTION_DISABLED'); assert(UUID.test(runId));
  const { sources, manifest, historical } = await inputs(); same(await regenerateContract(), manifest.sql);
  const compiled = compileProof(sources, manifest, runId); const directory = path.join(PRIVATE, runId);
  assert.equal(compiled.plan.execution_enabled, true);
  await exclusive(path.join(directory, 'controller.mjs'), compiled.source);
  for (const [file, raw] of historical) await exclusive(path.join(directory, 'historical-setup', file), raw);
  await exclusive(path.join(directory, 'plan.json'), JSON.stringify(compiled.plan, null, 2) + '\n');
  return { prepared: true, run_id: runId, directory: path.relative(ROOT, directory).replaceAll('\\', '/'),
    generated_source_sha256: compiled.plan.generated_source_sha256, historical_setup_sources_materialized: historical.size,
    database_or_provider_called: false };
}
export async function execute(runId) {
  assert(EXECUTION_ENABLED, 'WORKER38_CONCURRENCY_EXECUTION_DISABLED'); assert(UUID.test(runId));
  const directory = path.join(PRIVATE, runId); const plan = JSON.parse(await regular(path.join(directory, 'plan.json')));
  const { sources, manifest, historical } = await inputs(); const compiled = compileProof(sources, manifest, runId);
  same(plan, compiled.plan); assert.equal(sha(await regular(path.join(directory, 'controller.mjs'))), plan.generated_source_sha256);
  for (const [file, raw] of historical) same(await regular(path.join(directory, 'historical-setup', file)), raw);
  same(await regenerateContract(), manifest.sql);
  await exclusive(path.join(directory, 'execution.claim.json'), JSON.stringify({ run_id: runId, controller_sha256: plan.generated_source_sha256,
    source_pins: plan.source_pins, sql_contract_sha256: CONTRACT_SHA, dispatch_may_have_occurred: true, automatic_retry: false }) + '\n');
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--import', 'tsx', path.join(directory, 'controller.mjs')],
      { cwd: ROOT, env: environment(), shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let count = 0; let output = ''; let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, plan.process_timeout_ms);
    const collect = chunk => { count += chunk.length; if (count > 128 * 1024) child.kill(); else output += chunk.toString('utf8'); };
    child.stdout.on('data', collect); child.stderr.on('data', chunk => { count += chunk.length; if (count > 128 * 1024) child.kill(); });
    child.once('error', () => { clearTimeout(timer); reject(error('WORKER38_CHILD_UNCONFIRMED')); });
    child.once('close', code => { clearTimeout(timer); resolve({ run_id: runId, process_exit_code: code, timed_out: timedOut,
      output_limit_exceeded: count > 128 * 1024, controller_output: output,
      acceptance_requires_actual_receipt_and_cleanup_flags: true, automatic_retry: false }); });
  });
}
export async function main(argv = process.argv.slice(2)) {
  assert(EXECUTION_ENABLED, 'WORKER38_CONCURRENCY_EXECUTION_DISABLED');
  assert(argv.length === 2 && ['prepare', 'execute'].includes(argv[0]));
  return argv[0] === 'prepare' ? prepare(argv[1]) : execute(argv[1]);
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) main().then(value => {
  process.stdout.write(JSON.stringify(value) + '\n');
}).catch(value => { process.stdout.write(closedError(value) + '\n'); process.exitCode = 1; });
