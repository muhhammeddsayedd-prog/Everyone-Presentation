/** One owned collector/transaction rehearsal; no functional-suite replay. */
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createHash, randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir, lstat, realpath } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

export const EXECUTION_ENABLED = false;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(value);
const quote = value => "'" + value.replaceAll("'", "''") + "'";
const only = stdout => { const rows = stdout.split(/\r?\n/u).filter(line => line.startsWith('{')).map(line => JSON.parse(line)); assert.equal(rows.length, 1); return rows[0]; };

export async function admit(cfg, controller, root) {
  assert(EXECUTION_ENABLED, 'LOGO_INFO_COLLECTOR_DISABLED');
  assert.equal(path.resolve(root), cfg.root);
  for (const [file, digest] of Object.entries(cfg.source_pins)) {
    const stat = await lstat(file);
    assert(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1);
    assert.equal(await realpath(file), file); assert.equal(sha(await readFile(file)), digest);
  }
  assert.equal(path.resolve(controller), cfg.controller); assert(uuid(cfg.compile_uuid));
}
export async function claim(ctx, cfg) {
  assert(uuid(ctx.runId)); const directory = path.join(ctx.root, '.local/logo-info-collector-once', cfg.compile_uuid);
  await mkdir(path.dirname(directory), { recursive: true }); await ctx.protect(directory);
  await writeFile(path.join(directory, 'claim.json'), JSON.stringify({ compile_uuid: cfg.compile_uuid, run_id: ctx.runId,
    controller_sha256: sha(await readFile(cfg.controller)), source_pins: cfg.source_pins, automatic_retry: false }), { flag: 'wx' });
  ctx.report.dispatch_once_claim_created = true;
}
export async function inventories(docker, runId) {
  assert(uuid(runId)); const filter = 'label=eps.logocollector.run=' + runId;
  const containers = await docker(['ps', '-aq', '--filter', filter]), volumes = await docker(['volume', 'ls', '-q', '--filter', filter]);
  assert.equal(containers.code, 0); assert.equal(volumes.code, 0); assert.equal(containers.stdout.trim(), ''); assert.equal(volumes.stdout.trim(), '');
  return { same_engine_container_inventory_empty: true, same_engine_volume_inventory_empty: true };
}
export async function runProof(ctx, cfg) {
  assert(EXECUTION_ENABLED); assert(uuid(ctx.runId)); assert.notEqual(ctx.system, '7701520506262638626');
  assert.equal(sha(await readFile(cfg.bridge_file)), cfg.bridge_sha256);
  const bridge = await import(pathToFileURL(cfg.bridge_file).href);
  const guard = "set session authorization postgres;set timezone='UTC';set eps.logo41collector.run=" + quote(ctx.runId) + ";do $owned$begin if current_database()<>'project39'or(pg_control_system()).system_identifier::text<>" + quote(ctx.system) + "then raise exception'LOGO41_OWNED_TARGET_REQUIRED';end if;end$owned$;";
  const write = async (name, value) => bridge.privateWrite(ctx, name, Buffer.from(JSON.stringify(value)));
  const query = async sql => only((await ctx.sql(guard + sql)).stdout);
  const snapshot = () => query("begin isolation level repeatable read read only;set local search_path='';set local statement_timeout='60s';" + cfg.snapshot_sql + 'as reason40_release;rollback;');
  const checkpoint = () => query("begin isolation level repeatable read read only;set local search_path='';set local statement_timeout='60s';" + cfg.checkpoint_sql + 'as reason40_release;rollback;');
  const initial = await snapshot(); assert.deepEqual(await snapshot(), initial);
  const base = { initial, system: ctx.system, run: ctx.runId };
  const call = (action, value) => bridge.diagnosticBridge(action, { ...base, ...value }, ctx);
  assert.equal((await call('check', { observed: initial })).result, 'passed');
  const before = await checkpoint(); assert.deepEqual(before.state, initial);
  const reasons = before.application_tables.audit_events;
  for (const expected of ['Owned collector Ω\nالعربية', '', null]) assert(reasons.some(row => row.reason === expected));
  await write('before-checkpoint.json', before);
  const changed = await query("begin;set local search_path='';update eps.audit_events set reason=reason||' changed'where id=md5(" + quote(ctx.runId + ':audit0') + ")::uuid;" + cfg.snapshot_sql + 'as reason40_release;rollback;');
  assert.notEqual(changed.compatibility.schema40.canonical.base.data.audit_events.sha256, initial.compatibility.schema40.canonical.base.data.audit_events.sha256);
  assert.deepEqual(await snapshot(), initial);
  const negative = await call('render', { before: changed, marker: randomUUID() });
  await write('negative-claim.json', { sql_sha256: negative.sql_sha256, automatic_retry: false });
  let refused = false;
  try { await query(negative.sql); } catch (error) { refused = /LOGO41_PREIMAGE_CHANGED/u.test(error.diagnostic?.stderr ?? ''); if (!refused) throw error; }
  assert(refused); assert.deepEqual(await snapshot(), initial);
  const marker = randomUUID(), rendered = await call('render', { before: initial, marker });
  await write('diagnostic-claim.json', { marker, sql_sha256: rendered.diagnostic_sha256, automatic_retry: false });
  const observed = await query(rendered.diagnostic_sql); const diagnostic = await write('diagnostic-poststate.json', observed);
  const compared = await call('diagnose', { before: initial, observed });
  ctx.report.collector_diagnostic = { ...compared, private_poststate: diagnostic, normal_nonce_claimed: false };
  assert.equal(compared.result, 'passed'); assert.equal(compared.difference_count, 0); assert.deepEqual(await snapshot(), initial);
  await write('commit-claim.json', { marker, sql_sha256: rendered.sql_sha256, automatic_retry: false });
  const returned = await query(rendered.sql);
  assert.deepEqual(returned, { version: cfg.version, marker, migration_sha256: cfg.migration_sha256 });
  await write('normal-return.json', returned);
  const after = await snapshot(); assert.deepEqual(await snapshot(), after);
  const afterCheckpoint = await checkpoint(); assert.deepEqual(afterCheckpoint.state, after); await write('after-checkpoint.json', afterCheckpoint);
  assert.equal((await call('compare', { before_checkpoint: before, after_checkpoint: afterCheckpoint })).result, 'passed');
  ctx.report.collector_validation = { result: 'passed', actual_state_checkpoint_and_rendered_transaction: true,
    all76_full_rows_including_reason_preserved: true, full_functions_catalogue_roles_dependencies_preserved: true,
    actual_negative_preimage_refused_and_rolled_back: true, diagnostic_rollback_exact: true,
    two_equal_before_reads: true, two_equal_after_reads: true, before_and_after_full_checkpoints_checked: true,
    only_owned_database_identity_qualified: true, normal_commit_nonce: marker, normal_commit_return: returned,
    production_identity_admission_claimed: false };
  ctx.report.final_history_count = 41;
}
