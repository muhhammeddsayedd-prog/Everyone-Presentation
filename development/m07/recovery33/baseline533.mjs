/** Exact original-session baseline diagnosis. READ ONLY; no cleanup or unlock. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { staticControllerSql33 } from './compiler.mjs';
import { RUN533 } from './reconcile533.mjs';
import { runOwnedLocalSql } from '../../../tools/local-postgres.mjs';
const ROOT = path.resolve(import.meta.dirname, '../../..');
const CONTROLLER_SHA = 'ed503574d408cb13494dc9b93abeb312977216137bee57496bed8f4f34c3a8ed';
const FAILED = 'tracking/evidence/m07/recovery33/2026-10-31T14-39-48-217Z-5332c86b.json';
const LOCK = '.local/local-postgres/test-db.lock';
const sha = value => createHash('sha256').update(value).digest('hex');
const context = phase => `select jsonb_build_object('kind','baseline533_session','phase','${phase}','current_user',current_user,'session_user',session_user,
 'search_path',current_setting('search_path'),'timezone',current_setting('TimeZone'),'date_style',current_setting('DateStyle'),
 'interval_style',current_setting('IntervalStyle'),'extra_float_digits',current_setting('extra_float_digits'),'bytea_output',current_setting('bytea_output'));`;
export function buildBaselineComparison533(controller) {
  assert.equal(sha(controller), CONTROLLER_SHA);
  const original = staticControllerSql33(Buffer.from(controller).toString('utf8')).baselineSql;
  assert(original.startsWith('begin read only;') && /rollback;\s*$/u.test(original));
  const body = original.slice('begin read only;'.length).replace(/rollback;\s*$/u, '');
  return `begin read only;set local lock_timeout='5s';set local statement_timeout='20s';
do $baseline533$begin if current_database()<>'postgres'or current_user<>'postgres'
 or(select count(*)from supabase_migrations.schema_migrations)<>29
 then raise exception'BASELINE533_EXACT_ORIGINAL_POSTGRES_CONTEXT_REQUIRED';end if;end$baseline533$;
${context('native')}
${body}
set local search_path='';set local timezone='UTC';
${context('normalized')}
${body}
rollback;
`;
}
export function projectBaselineComparison533(rows, expectedSha) {
  assert.equal(rows.length, 4); const [nativeContext, native, normalizedContext, normalized] = rows;
  assert.equal(nativeContext.kind, 'baseline533_session'); assert.equal(nativeContext.phase, 'native');
  assert.equal(nativeContext.current_user, 'postgres'); assert.equal(nativeContext.session_user, 'postgres');
  assert.equal(normalizedContext.kind, 'baseline533_session'); assert.equal(normalizedContext.phase, 'normalized');
  for (const value of [native, normalized]) {
    assert.deepEqual(Object.keys(value).sort(), ['functions', 'grants', 'table_rows']);
    assert(/^[a-f0-9]{32}$/u.test(value.functions) && /^[a-f0-9]{32}$/u.test(value.grants));
    assert(value.table_rows && typeof value.table_rows === 'object' && !Array.isArray(value.table_rows));
    assert(Object.entries(value.table_rows).every(([key, hash]) => /^[a-z_]+\.[a-z_]+$/u.test(key) && /^[a-f0-9]{32}$/u.test(hash)));
  }
  const changed = [...new Set([...Object.keys(native.table_rows), ...Object.keys(normalized.table_rows)])]
    .filter(key => native.table_rows[key] !== normalized.table_rows[key]).sort();
  return { schema_version: '1.0', run_id: RUN533, read_only: true, expected_original_baseline_sha256: expectedSha,
    native_current_baseline_sha256: sha(JSON.stringify(native)), native_exact_original_baseline_match: sha(JSON.stringify(native)) === expectedSha,
    normalized_current_baseline_sha256: sha(JSON.stringify(normalized)), native_context: nativeContext, normalized_context: normalizedContext,
    parts: { native_functions_hash: native.functions, normalized_functions_hash: normalized.functions,
      native_grants_hash: native.grants, normalized_grants_hash: normalized.grants, functions_same: native.functions === normalized.functions,
      grants_same: native.grants === normalized.grants, table_hash_keys_same: Object.keys(native.table_rows).sort().join(',') === Object.keys(normalized.table_rows).sort().join(','),
      changed_table_count: changed.length, changed_tables: changed.map(table => ({ table, native_hash: native.table_rows[table] ?? null, normalized_hash: normalized.table_rows[table] ?? null })) } };
}
async function main() {
  assert.equal(process.argv.length, 3); assert.equal(process.argv[2], 'inspect'); assert(!process.env.NODE_OPTIONS);
  const controller = await readFile(path.join(ROOT, `.local/m07-recovery33-prepared/${RUN533}/controller.mjs`));
  const before = JSON.parse(await readFile(path.join(ROOT, FAILED), 'utf8')); assert.equal(before.run_id, RUN533);
  const lockBytes = await readFile(path.join(ROOT, LOCK)), lock = JSON.parse(lockBytes); assert.equal(lock.run_id, RUN533); assert.equal(lock.pid, 48928);
  const sql = buildBaselineComparison533(controller), result = await runOwnedLocalSql(sql);
  assert.equal(result.system_identifier, '7701520506262638626'); assert(Buffer.byteLength(result.stdout) < 4 * 1024 * 1024);
  const rows = result.stdout.split(/\r?\n/u).filter(line => line.startsWith('{')).map(line => JSON.parse(line));
  assert((await readFile(path.join(ROOT, LOCK))).equals(lockBytes));
  const receipt = { observed_at: new Date().toISOString(), query_sha256: sha(sql), retained_lock_sha256: sha(lockBytes), ...projectBaselineComparison533(rows, before.original_baseline_sha256) };
  const privateFile = path.join(ROOT, before.private_artifact_directory, `native-baseline-diagnostic-${receipt.observed_at.replaceAll(':', '-')}.json`);
  await writeFile(privateFile, JSON.stringify({ native_context: rows[0], native_baseline: rows[1], normalized_context: rows[2], normalized_baseline: rows[3] }, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  const file = `tracking/evidence/m07/recovery33/${receipt.observed_at.replaceAll(':', '-')}-533-baseline-context.json`;
  receipt.private_baseline_artifact = path.relative(ROOT, privateFile).replaceAll('\\', '/');
  await writeFile(path.join(ROOT, file), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
  process.stdout.write(JSON.stringify({ evidence: file, ...receipt }) + '\n');
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) main().catch(() => { process.stderr.write('BASELINE533_READ_UNCONFIRMED\n'); process.exitCode = 1; });
