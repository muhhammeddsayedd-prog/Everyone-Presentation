/** Inert compiler/source/parser checks, never SQL/Docker/provider execution. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { SOURCE_PINS } from '../recovery33/compiler.mjs';
import { EXECUTION_ENABLED, ROOT, PURPOSE, MANIFEST_SHA, CONTRACT_SHA, sha, inputs, historicalObjects,
  compileProof, regenerateContract, rawPrelude, pausePhase, resumeFlags, ownedMigration,
  roleQuery, admitTraceRole, cleanupRoleSql, finalizeConcurrencyReport, environment,
  backendIdentitySql, backendActionSql, lockObservationSql, actorStart, unwrappedSnapshot } from './proof.mjs';

const bundle = await inputs(); const sql = bundle.manifest.sql;
const run = 'b9380000-0000-4000-8000-000000000001';
const hex = run.replaceAll('-', '');
const identity = { database: 'eps_m07_r33_source_' + hex, marker: 'eps-m07-recovery33:' + run + ':source', oid: 123456 };
const compiled = compileProof(bundle.sources, bundle.manifest, run);
const before = { state: { data: {} }, config: {}, lifecycle: Object.fromEntries(sql.counters.map(k => [k, 0])) };
for (const name of sql.config_tables) {
  before.state.data[name] = { count: 1, sha256: 'a'.repeat(64) };
  before.config[name] = { public: { enabled: true }, table_hash: 'a'.repeat(64), fixed_sha256: 'b'.repeat(64) };
}
const paused = structuredClone(before);
for (const name of sql.config_tables) paused.config[name].public.enabled = false;

function python(program, input) {
  const result = spawnSync(path.join(ROOT, '.venv-skills/Scripts/python.exe'), ['-X', 'utf8', '-B', '-c', program],
    { cwd: ROOT, env: environment(), input: JSON.stringify(input), timeout: 30000, maxBuffer: 2 * 1024 ** 2, windowsHide: true });
  assert.equal(result.status, 0, result.stderr?.toString()); return JSON.parse(result.stdout);
}
function role() {
  return { oid: 987654, name: 'eps_job_trace_owner', marker: 'eps-worker38-concurrency:' + run + ':trace:987654',
    login: false, super: false, inherit: false, bypassrls: false, create_db: false, create_role: false, replication: false,
    limit: -1, valid_until: null, memberships: [{ role: 'eps_job_trace_owner', member: 'postgres', grantor: 'postgres', admin: true, inherit: true, set: true }], dependencies: [] };
}
test('actual118 raw Git setup bytes and all13 historical compiler pins remain exact', () => {
  assert.equal(bundle.historical.size, 118); assert.equal(Object.keys(SOURCE_PINS).length, 13);
  assert.equal(bundle.manifest.compiler_pin_count, 13); assert.equal(bundle.manifest.compiler_pins_preserved, true);
  assert.equal(bundle.manifest.omitted_unused_historical_file, 'development/m07/recovery33/README.md');
  assert.equal(bundle.sources.has('development/m07/recovery33/README.md'), false);
  for (const [file, digest] of Object.entries(SOURCE_PINS)) assert.equal(sha(bundle.historical.get(file)), digest);
  assert.equal(sha(bundle.sources.get(PURPOSE + 'frozen-inputs.json')), MANIFEST_SHA);
  assert.equal(bundle.manifest.current_source_pins['development/m07/specs-diagnostic-worker38-adoption/state.py'], CONTRACT_SHA);
  const bad = Buffer.from('not-a-git-blob\n'); assert.throws(() => historicalObjects(bundle.manifest, bad));
});
test('pure production emitter regenerates the exact current38 SQL fragments', async () => {
  assert.deepEqual(await regenerateContract(), sql);
  assert.equal(sql.pause_updates.length, 5); assert.equal(sql.resume_updates.length, 5);
  assert.equal(sql.sql_contract_sha256, CONTRACT_SHA);
  assert.equal(/enabled|has_capability/iu.test(sql.lifecycle_sql), false);
  assert(sql.lifecycle_sql.includes("kind in('presentation_render','presentation_export')"));
});
test('new controller keeps the old source/profile/cleanup guards and replaces only the metadata hook', () => {
  assert.equal(compiled.plan.execution_enabled, EXECUTION_ENABLED);
  assert.equal(compiled.plan.historical_setup_sources, 118);
  assert.equal(compiled.plan.historical_119_replay_claimed, false);
  assert.equal(compiled.plan.global_outer_rollback_claimed, false);
  assert.equal(compiled.source.includes('await recovery33.metadataRestore();'), false);
  assert(compiled.source.includes('if (false) {'));
  assert(compiled.source.includes(`if(!${EXECUTION_ENABLED})throw Error('WORKER38_CONCURRENCY_EXECUTION_DISABLED')`));
  assert(compiled.source.indexOf('await cleanupTrace38({') < compiled.source.indexOf('await recovery33.cleanupRoles();'));
  assert(compiled.source.indexOf('report.disposable_databases_removed=true;') < compiled.source.indexOf('await cleanupTrace38({'));
  for (const guard of ['original29_full_auth_storage_catalogue_unchanged', 'existing_global_role_oids_attributes_memberships_unchanged',
    'RECOVERY33_EXACT_FULL29_CLONE_REQUIRED', 'WORKER38_PREPARED_SOURCE_CHANGED', 'sourceDb', 'OWNED_M07_DATABASE_REQUIRED']) {
    assert(compiled.source.includes(guard) || bundle.sources.get('development/m07/recovery33/runtime.mjs').toString().includes(guard), guard);
  }
  const syntax = spawnSync(process.execPath, ['--input-type=module', '--check'], { input: compiled.source, env: environment(), maxBuffer: 16384, timeout: 30000, windowsHide: true });
  assert.equal(syntax.status, 0, syntax.stderr?.toString());
});
test('explicit disabled entry refuses before any source/git/process preparation', async () => {
  assert.equal(typeof EXECUTION_ENABLED, 'boolean');
  let source = (await readFile(path.join(ROOT, PURPOSE, 'proof.mjs'))).toString();
  const replace = (a, b) => { assert.equal(source.split(a).length, 2); source = source.replace(a, () => b); };
  replace(`export const EXECUTION_ENABLED = ${EXECUTION_ENABLED};`, 'export const EXECUTION_ENABLED = false;');
  replace("'../recovery33/compiler.mjs'", JSON.stringify(new URL('../recovery33/compiler.mjs', import.meta.url).href));
  replace("'../recovery33/ownership.mjs'", JSON.stringify(new URL('../recovery33/ownership.mjs', import.meta.url).href));
  replace("export const ROOT = path.resolve(import.meta.dirname, '../../..');", `export const ROOT = ${JSON.stringify(ROOT)};`);
  const disabled = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  await assert.rejects(disabled.main(['prepare', run]), /WORKER38_CONCURRENCY_EXECUTION_DISABLED/u);
  await assert.rejects(disabled.execute(run), /WORKER38_CONCURRENCY_EXECUTION_DISABLED/u);
});
test('actual34..38 adaptation preserves complete functional DDL and marks trace creation atomically', () => {
  const files = [...bundle.sources.keys()].filter(v => /^supabase\/migrations\/(?:20261031143711|20261031182038|20261101012057|20261101042702|20261101110939)_/u.test(v)).sort();
  assert.equal(files.length, 5);
  for (const file of files) {
    const raw = bundle.sources.get(file); const result = ownedMigration(file, raw, identity, run);
    assert.equal(result.source_sha256, sha(raw)); assert.equal(result.adapted_sha256, sha(result.body));
    assert(result.body.includes(identity.marker)); assert(result.body.includes('oid = 123456'));
    assert.equal(/^begin;\s*$/mu.test(result.body), false); assert.equal(/^commit;\s*$/mu.test(result.body), false);
    if (file.includes('20261101012057')) {
      assert(result.body.indexOf('create role eps_job_trace_owner') < result.body.indexOf('comment on role %I is %L'));
      assert(result.body.includes('owned_trace_oid::text')); assert(result.body.includes('eps-worker38-concurrency:' + run + ':trace:'));
      assert(result.body.indexOf('comment on role %I is %L') < result.body.indexOf('insert into supabase_migrations.schema_migrations'));
    }
  }
  assert.throws(() => ownedMigration(files[0], bundle.sources.get(files[0]), { ...identity, oid: 0 }, run));
});
test('owned36 admission replaces only the impossible cloud protected-row prerequisite', () => {
  const file = 'supabase/migrations/20261101012057_m07_job_attempt_observability.sql';
  const original = bundle.sources.get(file).toString();
  const originalClause = original.slice(original.indexOf('\n or not(exists(select 1 from eps.jobs j join eps.specs s'), original.indexOf("\n then raise exception 'M07_ATTEMPT36_EXACT_REVIEWED35_REQUIRED'"));
  assert(originalClause.includes("j.id='b3f90268-147d-41d4-8875-2a6435df1496'"));
  const adapted = ownedMigration(file, bundle.sources.get(file), identity, run).body;
  assert.equal(adapted.includes(originalClause), false);
  for (const prerequisite of ["current_setting('eps.worker38.concurrency',true)is distinct from'owned-local-v1'",
    'exists(select 1 from eps.jobs)', 'exists(select 1 from eps.specs)', 'exists(select 1 from eps.media_assets)', 'exists(select 1 from eps.presentation_versions)']) assert(adapted.includes(prerequisite), prerequisite);
  for (const preserved of ["to_regclass('eps.job_stage_attempts') is not null", "to_regprocedure('eps.capture_job_stage_attempt()') is not null",
    "exists(select 1 from pg_roles where rolname='eps_job_trace_owner')", "'6912140e41804faf2c2fd257a9b1ecac9eba8c3ccee5cbd7ff75fbff4d9be953'"]) assert(adapted.includes(preserved), preserved);
  const anchor = '\ncreate role eps_job_trace_owner';
  const expected = original.slice(original.indexOf(anchor));
  assert(adapted.includes(expected));
});
test('each upgraded migration records its actual checkpoint and wire before SQL dispatch', () => {
  const source = bundle.sources.get(PURPOSE + 'proof.mjs').toString();
  const start = source.indexOf('for (const file of migrations) {');
  const end = source.indexOf("await ctx.sql(ctx.sourceDb, \"set local eps.worker38.concurrency", start);
  const loop = source.slice(start, end);
  const checkpoint = loop.indexOf("ctx.report.checkpoint = 'worker38-owned-migration-' + adapted.version");
  const prepared = loop.indexOf("status: 'prepared'");
  const wire = loop.indexOf('await writeFile(');
  const dispatch = loop.indexOf('await ctx.sql(ctx.sourceDb, adapted.body)');
  const committed = loop.indexOf("record.status = 'committed'");
  assert(checkpoint >= 0 && checkpoint < prepared && prepared < wire && wire < dispatch && dispatch < committed);
});
test('PostgreSQL parser rejects snapshot-before-config-lock ordering and accepts actual raw wire', () => {
  const prefix = rawPrelude(identity, 'eps38_parser'); const good = prefix + pausePhase(sql, before);
  const bad = good.replace('begin isolation level repeatable read;', "begin isolation level repeatable read;select count(*)from eps.jobs;");
  const proof = python(`import json,sys
from pglast import ast,parse_sql
v=json.load(sys.stdin)
def ordering(text):
 active=False;locked=False
 for raw in parse_sql(text):
  node=raw.stmt
  if isinstance(node,ast.TransactionStmt):
   active=node.kind.name in ('TRANS_STMT_BEGIN','TRANS_STMT_START')
  elif active and isinstance(node,ast.LockStmt) and node.mode==8:
   names=sorted(r.relname for r in node.relations)
   if names==v['tables']:locked=True
  elif active and isinstance(node,(ast.SelectStmt,ast.DoStmt)):
   return locked
 return False
print(json.dumps({'RED_snapshot_before_lock':ordering(v['bad']),'GREEN_actual_prefix':ordering(v['good'])}))`, { tables: sql.config_tables, good, bad });
  assert.deepEqual(proof, { RED_snapshot_before_lock: false, GREEN_actual_prefix: true });
  assert(prefix.indexOf('end$worker38_owned$;') < prefix.indexOf('set session authorization postgres;'));
  assert.equal(prefix.includes('begin isolation level'), false);
});
test('all emitted PostgreSQL wire and actual fixture PLpgSQL parse without execution', () => {
  const migrations = [...bundle.sources.keys()].filter(v => /^supabase\/migrations\/(?:20261031143711|20261031182038|20261101012057|20261101042702|20261101110939)_/u.test(v)).sort();
  const wires = Object.fromEntries(migrations.map(file => [file, ownedMigration(file, bundle.sources.get(file), identity, run).body]));
  Object.assign(wires, { fixture: bundle.sources.get(PURPOSE + 'fixture.sql').toString(), pause: pausePhase(sql, before), resume: resumeFlags(sql, paused, before),
    raw_prelude: rawPrelude(identity, 'eps38_parser'), role_query: roleQuery(), role_cleanup: cleanupRoleSql(role(), run, [identity.database, 'eps_m07_r33_restore_' + hex]) });
  const backend = { pid: 123, backend_start: '2026-11-01 00:00:00+00', application: 'eps38_parser', user: 'supabase_admin' };
  Object.assign(wires, { lock_observation: lockObservationSql(123, 124, true), cold_observation: lockObservationSql(123, 124, false), backend_identity: backendIdentitySql(),
    backend_cancel: backendActionSql(identity, backend, 'cancel'), backend_terminate: backendActionSql(identity, backend, 'terminate'), backend_absence: backendActionSql(identity, backend, 'absence'),
    actor_start: actorStart(), ordinary_snapshot: unwrappedSnapshot(sql), retry_lifecycle: 'select ' + sql.lifecycle_sql + ';' });
  const parsed = python(`import json,sys
import pglast
from pglast import ast,parse_sql,parse_plpgsql
from pglast.stream import RawStream
assert pglast.__version__=='v7.21'
docs=json.load(sys.stdin);statements=0;blocks=0
for key,text in docs.items():
 for raw in parse_sql(text):
  statements+=1;node=raw.stmt
  if isinstance(node,ast.DoStmt) or isinstance(node,ast.CreateFunctionStmt) and any(option.defname=='language' and option.arg.sval=='plpgsql' for option in node.options):
   try:parse_plpgsql(RawStream()(node));blocks+=1
   except Exception as error:raise AssertionError((key,type(node).__name__)) from error
print(json.dumps({'wire_documents':len(docs),'statements':statements,'PLpgSQL_blocks':blocks,'native_SQL_executed':False}))`, wires);
  assert.equal(parsed.wire_documents, 20); assert(parsed.statements > 100); assert(parsed.PLpgSQL_blocks > 20); assert.equal(parsed.native_SQL_executed, false);
});
test('trace cleanup binds exact marked OID and database absence, no preexisting role adoption', () => {
  const current = role(); assert.equal(admitTraceRole(current, run, current.oid), current);
  const creatorGrant = structuredClone(current);creatorGrant.memberships.push({ role: 'eps_job_trace_owner', member: 'postgres', grantor: 'supabase_admin', admin: true, inherit: false, set: false });
  assert.equal(admitTraceRole(creatorGrant, run, creatorGrant.oid), creatorGrant);
  for (const change of [v => v.marker = 'someone-else', v => v.oid++, v => v.super = true,
    v => v.memberships.push({ ...v.memberships[0], member: 'another-user' }), v => v.memberships[0].set = false]) {
    const changed = structuredClone(current); change(changed); assert.throws(() => admitTraceRole(changed, run, current.oid));
  }
  assert.throws(() => cleanupRoleSql({ ...current, dependencies: [{ dbid: 1 }] }, run, [identity.database, 'eps_m07_r33_restore_' + hex]));
  assert.throws(() => cleanupRoleSql(current, run, [identity.database, 'postgres']));
});
test('completed flags require actual observed cases and original-preservation cleanup', () => {
  const flags = ['disposable_databases_removed', 'worker38_trace_role_removed', 'new33_roles_removed', 'worker38_owned_backends_closed', 'shared_test_lock_released',
    'original_local_database_unchanged', 'original29_full_catalogue_unchanged', 'original29_full_auth_storage_catalogue_unchanged',
    'original29_exact_profile_and_settings_state_unchanged', 'existing_global_role_oids_attributes_memberships_unchanged',
    'actual_native_sql_concurrency', 'worker38_committed_intake_seen_in_first_snapshot', 'worker38_stale_preflight_refused_before_update'];
  const completed = { result: 'passed', worker38_sessions_attempted: true, ...Object.fromEntries(flags.map(key => [key, true])) };
  finalizeConcurrencyReport(completed); assert.equal(completed.result, 'passed'); assert.equal(completed.original_state_preserved, true);
  for (const flag of flags) {
    const incomplete = { ...completed, [flag]: false }; finalizeConcurrencyReport(incomplete); assert.equal(incomplete.result, 'failed', flag);
  }
});
