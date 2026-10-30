/** Fixed owned-local synthetic transaction; no hosted configuration or CLI. */
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { runOwnedLocalSql, verifyLocalTarget } from './local-postgres.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const FILES = ['tools/sql/enable-producer-review-links26.sql', 'tools/sql/producer-review-links26-readback.sql', 'tools/sql/producer-review-links26-local-fixture.sql', 'development/local-db/reviewed.json', 'tools/local-postgres.mjs'];
const CASES = ['unconfirmed', 'never_signed_in', 'anonymous', 'deleted', 'banned', 'revoked_membership', 'read_only_membership', 'missing_membership', 'revoked_cast_authority', 'missing_workspace_authority', 'archived_first_project', 'archived_workspace', 'wrong_source_hash', 'unfinished_source_job', 'already_active', 'already_inactive', 'revoked_generation_authority', 'missing_generation_authority'];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const quote = value => "'" + value.replaceAll("'", "''") + "'";
async function sources() { return Object.fromEntries(await Promise.all(FILES.map(async file => [file, sha(await readFile(path.join(ROOT, file)))]))); }
const rows = text => text.split(/\r?\n/u).filter(line => line.startsWith('{')).map(line => JSON.parse(line));
async function snapshot() {
  const result = await runOwnedLocalSql(`begin read only;select jsonb_build_object('versions',(select jsonb_agg(version order by version)from supabase_migrations.schema_migrations),'auth_users_count',(select count(*)from auth.users),'auth_row_revisions',(select encode(sha256(convert_to(coalesce(string_agg(id::text||':'||xmin::text||':'||ctid::text,E'\n'order by id),''),'UTF8')),'hex')from auth.users),'data',(select jsonb_object_agg(name,hash)from(values ${['public.clients', 'public.projects', 'public.project_memberships', 'public.client_memberships', 'public.app_capability_grants', 'eps.workspaces', 'eps.media_assets', 'eps.jobs'].map(table => `('${table}',(select encode(sha256(convert_to(coalesce(string_agg(to_jsonb(v)::text,E'\n'order by to_jsonb(v)::text),''),'UTF8')),'hex')from ${table} v))`).join(',')})v(name,hash)));rollback;`);
  const values = rows(result.stdout); assert.equal(values.length, 1); return values[0];
}
async function main() {
  assert.equal(process.argv.length, 2);
  const beforeSources = await sources(); const identity = await verifyLocalTarget(); const before = await snapshot();
  const manifest = JSON.parse(await readFile(path.join(ROOT, 'development/local-db/reviewed.json'), 'utf8'));
  const versions = manifest.migrations.map(row => path.basename(row.path).slice(0, 14));
  assert.equal(versions.length, 26); assert.deepEqual(before.versions, versions); assert.ok(versions.every(value => /^[0-9]{14}$/u.test(value)));
  const source = await readFile(path.join(ROOT, FILES[0]), 'utf8'); assert.equal(source.split('__REVIEWED_VERSIONS__').length, 2);
  const apply = source.replace('__REVIEWED_VERSIONS__', versions.map(quote).join(','));
  const start = apply.indexOf('do $complete_review_links$'); const end = apply.indexOf('end$complete_review_links$;') + 'end$complete_review_links$;'.length;
  assert.ok(start > 0 && end > start); assert.equal(apply.lastIndexOf('do $complete_review_links$'), start);
  const body = apply.slice(start, end);
  const readback = await readFile(path.join(ROOT, FILES[1]), 'utf8'); const selectStart = readback.indexOf('with source as ('); const selectEnd = readback.lastIndexOf('\nrollback;');
  assert.ok(selectStart > 0 && selectEnd > selectStart); const projection = readback.slice(selectStart, selectEnd);
  const fixture = await readFile(path.join(ROOT, FILES[2]), 'utf8');
  const query = `begin;set local lock_timeout='3s';set local statement_timeout='30s';set local search_path='';set local timezone='UTC';
select set_config('eps.producer_review_links26.test_body',${quote(body)},true);
${fixture}\n${projection}\n${body}\n${projection}\nrollback;`;
  const report = { observed_at: new Date().toISOString(), result: 'unconfirmed', cloud_called: false, provider_called: false, hosted_credentials_loaded: false,
    source_seals: beforeSources, harness_sha256: sha(await readFile(import.meta.filename)), scope: 'Exact absent-only administrative SQL under synthetic fixed-ID rows in one rolled-back owned PostgreSQL26 transaction.', hosting_deferred: true };
  let after;
  try {
    const result = await runOwnedLocalSql(query); const values = rows(result.stdout); assert.equal(values.length, 2);
    const labels = result.stdout.split(/\r?\n/u).filter(line => CASES.includes(line)); assert.deepEqual(labels, CASES);
    const [absent, active] = values; assert.deepEqual(absent.link_manager_grant, { count: 0, active: null, state: 'absent' }); assert.deepEqual(active.link_manager_grant, { count: 1, active: true, state: 'active' });
    for (const field of ['verified_active_auth', 'two_projects_current', 'two_writable_memberships_current', 'producer_authority_current', 'unrestricted_visibility']) { assert.equal(absent[field], true); assert.equal(active[field], true); }
    assert.equal(active.preservation.grants_count, absent.preservation.grants_count + 1);
    assert.deepEqual({ ...active.preservation, grants_count: absent.preservation.grants_count }, absent.preservation);
    after = await snapshot(); assert.deepEqual(after, before); assert.deepEqual(await sources(), beforeSources);
    const current = await verifyLocalTarget(); assert.equal(current.observed.system_identifier, identity.observed.system_identifier);
    Object.assign(report, { result: 'passed', negative_cases: CASES, negative_cases_passed: CASES.length, one_absent_row_inserted_in_fixture: true,
      original_grants_memberships_auth_revisions_preserved: true, readback_projection_passed: true, rollback_verified: true, sources_stable: true,
      local_system_identifier: identity.observed.system_identifier, before, after });
  } catch (error) {
    try { after = await snapshot(); report.rollback_verified = JSON.stringify(after) === JSON.stringify(before); } catch { report.rollback_verified = false; }
    report.code = 'PRODUCER_REVIEW_LINKS26_LOCAL_UNCONFIRMED';
    const message = error instanceof Error ? error.message : '';
    report.safe_failure = { category: error?.code === 'ERR_ASSERTION' ? 'assertion' : 'local_sql',
      codes: ['permission denied', 'check constraint', 'duplicate key', 'syntax error', 'does not exist', 'ambiguous', 'SYNTHETIC_GRANT_WRONG_DENIAL', 'SYNTHETIC_GRANT_DENIAL_MUTATED_ROWS', 'OWNED_EMPTY_SYNTHETIC_GRANT_SCOPE_REQUIRED'].filter(code => message.includes(code)),
      constraint: /violates check constraint "([a-z0-9_]+)"/u.exec(message)?.[1] ?? null,
      source_line: /LINE ([0-9]+):/u.exec(message)?.[1] ?? null };
    process.exitCode = 1;
  }
  const directory = path.join(ROOT, 'tracking/evidence/m06/producer-review-links26-local'); await mkdir(directory, { recursive: true });
  const file = path.join(directory, new Date().toISOString().replaceAll(':', '-') + '-' + randomUUID().slice(0, 8) + '.json');
  await writeFile(file, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' }); process.stdout.write(JSON.stringify({ result: report.result, receipt: path.relative(ROOT, file).replaceAll('\\', '/'), negative_cases_passed: report.negative_cases_passed ?? 0, rollback_verified: report.rollback_verified ?? false, cloud_called: false }));
}
void main().catch(() => { process.stderr.write('Owned local generation-capability proof stopped; raw diagnostics suppressed.\n'); process.exitCode = 1; });
