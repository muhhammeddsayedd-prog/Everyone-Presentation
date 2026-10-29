/** Fixed owned-local14 candidate DDL + synthetic assertions, always rolled back. */
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { isDeepStrictEqual } from 'node:util';
import { runOwnedLocalSql, verifyLocalTarget } from './local-postgres.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const DDL = 'development/m03/candidates-candidate.sql';
const TEST = 'development/m03/candidates-assertions.sql';
const LOCK = path.join(ROOT, '.local/local-postgres/test-db.lock');
const DIRECTORY = path.join(ROOT, 'tracking/evidence/m03/candidate-local');
const SYSTEM = '7701520506262638626';
const hash = value => createHash('sha256').update(value).digest('hex');
const SNAPSHOT = `begin read only;
do $snapshot$ declare relation regclass; rows_value bigint; digest_value text; result jsonb:='{}'; begin
 for relation in select table_value from unnest(array['auth.users','public.clients','public.projects','public.project_memberships','public.client_memberships','public.app_capability_grants']) item(table_value) union all select (quote_ident(ns.nspname)||'.'||quote_ident(table_row.relname)) from pg_class table_row join pg_namespace ns on ns.oid=table_row.relnamespace where ns.nspname='eps' and table_row.relkind='r' loop
  execute format($query$select count(*),md5(coalesce(string_agg(row_digest,'' order by row_digest),'')) from (select md5(row_to_json(value)::text) row_digest from %s value) rows$query$,relation) into rows_value,digest_value;
  result:=result||jsonb_build_object(relation::text,jsonb_build_object('count',rows_value,'digest',digest_value));
 end loop;
 perform set_config('eps.m03.snapshot',result::text,true);
end $snapshot$;
select jsonb_build_object('tables',current_setting('eps.m03.snapshot')::jsonb,'versions',(select jsonb_agg(version order by version) from supabase_migrations.schema_migrations),
 'candidate_absent',to_regclass('eps.candidates') is null and not exists(select 1 from pg_roles where rolname='eps_cast_owner'),
 'routines_digest',(select md5(string_agg(proc.oid::text||':'||pg_get_functiondef(proc.oid),'' order by proc.oid)) from pg_proc proc join pg_namespace ns on ns.oid=proc.pronamespace where ns.nspname in('eps','public') and proc.prokind='f'),
 'policies_digest',(select md5(string_agg(row_to_json(policy)::text,'' order by policy.schemaname,policy.tablename,policy.policyname)) from pg_policies policy where policy.schemaname in('eps','public','storage')));
rollback;`;
function jsonLine(output) { const lines = output.split(/\r?\n/u).filter(line => line.startsWith('{')); assert.equal(lines.length, 1); return JSON.parse(lines[0]); }
async function target() { const value = await verifyLocalTarget(); assert.equal(value.observed.system_identifier, SYSTEM); return value; }
async function snapshot() { await target(); return jsonLine((await runOwnedLocalSql(SNAPSHOT)).stdout); }
async function main() {
  assert.equal(process.argv.length, 2);
  const runId = randomUUID(); const applicationName = `eps-m03-candidates-${runId}`;
  const [ddl, tests] = await Promise.all([readFile(path.join(ROOT, DDL), 'utf8'), readFile(path.join(ROOT, TEST), 'utf8')]);
  const seals = { [DDL]: hash(ddl), [TEST]: hash(tests), 'tools/local-postgres.mjs': hash(await readFile(path.join(ROOT, 'tools/local-postgres.mjs'))) };
  const receipt = { run_id: runId, started_at: new Date().toISOString(), result: 'failed', cloud_called: false, provider_called: false,
    media_bytes_tested: false, candidate_ddl_persisted: false, source_seals: seals, harness_sha256: hash(await readFile(import.meta.filename)),
    scope: 'Owned local14 rollback DDL and synthetic canonical memberships; manual fact/review/search/duplicate/project-pool permissions only.' };
  let owns = false; let before; let attempted = false; let settled = false;
  try {
    const guard = await target(); receipt.system_identifier = SYSTEM; receipt.container_id = guard.container.Id;
    const handle = await open(LOCK, 'wx'); owns = true;
    try { await handle.writeFile(JSON.stringify({ run_id: runId, pid: process.pid, application_name: applicationName, purpose: 'm03-candidates-local14-rollback' })); } finally { await handle.close(); }
    before = await snapshot(); assert.equal(before.candidate_absent, true); assert.equal(before.versions.length, 14); receipt.before = before;
    const sql = `begin; set local application_name='${applicationName}'; set local eps.m03_candidate_rehearsal='rollback-only-v1';\n${ddl}\n${tests}\nrollback;`;
    attempted = true; const result = await runOwnedLocalSql(sql);
    for (const marker of ['M03_MANUAL_REVIEW_SEARCH_DUPLICATE_POOL_PASSED', 'M03_RLS_CAPABILITY_SCOPE_DENIALS_PASSED']) assert.equal(result.stdout.split(/\r?\n/u).filter(line => line === marker).length, 1);
    receipt.assertions_passed = true; receipt.transaction_completed_to_rollback = true;
  } catch (error) { receipt.failure_code = 'M03_LOCAL_CANDIDATE_UNCONFIRMED'; receipt.diagnostic = String(error.message).slice(0, 3000); }
  finally {
    if (owns) {
      try { await target(); const value = jsonLine((await runOwnedLocalSql(`begin read only; select jsonb_build_object('remaining',count(*)) from pg_stat_activity where application_name='${applicationName}'; rollback;`)).stdout); settled = value.remaining === 0; receipt.owned_backend_settled = settled; } catch { receipt.owned_backend_settled = false; }
    }
    if (before && settled) {
      try { const after = await snapshot(); receipt.after = after; receipt.rollback_verified = isDeepStrictEqual(before, after);
        for (const [file, seal] of Object.entries(seals)) assert.equal(hash(await readFile(path.join(ROOT, file))), seal);
        if (receipt.assertions_passed && receipt.rollback_verified) receipt.result = 'passed';
      } catch { receipt.rollback_verified = false; }
    }
    if (owns && (!attempted || settled)) { const owner = JSON.parse(await readFile(LOCK, 'utf8')); assert.equal(owner.run_id, runId); assert.equal(owner.pid, process.pid); await unlink(LOCK); }
    receipt.finished_at = new Date().toISOString(); await mkdir(DIRECTORY, { recursive: true });
    const file = path.join(DIRECTORY, `${receipt.finished_at.replace(/[:.]/gu, '-')}-${runId.slice(0, 8)}.json`);
    await writeFile(file, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
    process.stdout.write(JSON.stringify({ result: receipt.result, receipt: path.relative(ROOT, file).replaceAll('\\', '/'), rollback_verified: receipt.rollback_verified === true, diagnostic: receipt.diagnostic }) + '\n');
    if (receipt.result !== 'passed') process.exitCode = 1;
  }
}
main().catch(() => { process.stderr.write('M03 local-only candidate rehearsal stopped before completion.\n'); process.exitCode = 1; });
