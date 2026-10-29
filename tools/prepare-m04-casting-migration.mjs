/** Compose exact reviewed19 assignment/lifecycle fragments. No database IO. */
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

export const CASTING_VERSION = '20261029174841';
export const CASTING_MIGRATION = `supabase/migrations/${CASTING_VERSION}_m04_casting_assignments_lifecycle.sql`;
export const CASTING_BASELINE = 'tracking/evidence/m04/migration-preparation/baseline19-reviewed-manifest.json';
export const CASTING_BASELINE_SHA = 'f504c4745bfb1ac31c7ba30d42153fe965dcc9e3451821808b3b4050122985b2';
export const CASTING_FRAGMENTS = Object.freeze([
  ['development/m04/assignments.sql', 'f19d194646b73e2510aa5e3ceb3ae8f311d6541095f71b7b34ab733ec77cd93f'],
  ['development/m04/lifecycle-forward.sql', '0c9719e912df0390073cb5818c1e7bc0eace899b84f0b9f7d02655e93ee0a35a'],
]);
export const castingSha256 = value => createHash('sha256').update(value).digest('hex');

export function composeCastingMigration(baselineBytes, sources) {
  assert.equal(castingSha256(baselineBytes), CASTING_BASELINE_SHA, 'EXACT_REVIEWED_NINETEEN_MANIFEST_REQUIRED');
  const baseline = JSON.parse(baselineBytes);
  assert.equal(baseline.migrations.length, 19);
  const versions = baseline.migrations.map(row => path.posix.basename(row.path).slice(0, 14));
  assert.deepEqual(versions, [...new Set(versions)].sort());
  assert(sources instanceof Map && sources.size === 2, 'BOTH_ATOMIC_CASTING_FRAGMENTS_REQUIRED');
  for (const [file, expected] of CASTING_FRAGMENTS) assert.equal(castingSha256(sources.get(file)), expected, `REVIEWED_CASTING_FRAGMENT_CHANGED:${file}`);
  const header = `-- M04 additive assignment/lifecycle20, after exact reviewed19.\n-- Shared facts and project media remain independent from casting decisions.\n-- No fixture identities, configuration, private keys, provider or hosting changes.\nset local lock_timeout='3s';set local statement_timeout='30s';set local search_path='';\ndo $release_baseline$begin\n if current_user<>'postgres' or current_database()<>'postgres' or\n (select array_agg(version order by version)from supabase_migrations.schema_migrations)is distinct from array[${versions.map(value => `'${value}'`).join(',')}]::text[]\n then raise exception 'M04_RELEASE_EXACT_REVIEWED_NINETEEN_REQUIRED';end if;\nend $release_baseline$;\n`;
  return Buffer.concat([Buffer.from(header), ...CASTING_FRAGMENTS.flatMap(([file]) => [Buffer.from(`\n-- Exact reviewed fragment: ${file}\n`), Buffer.from(sources.get(file)), Buffer.from('\n')])]);
}

async function main() {
  assert.equal(process.argv.length, 2);
  const root = path.resolve(import.meta.dirname, '..');
  const manifestBytes = await readFile(path.join(root, 'development/local-db/reviewed.json'));
  assert.equal(castingSha256(manifestBytes), CASTING_BASELINE_SHA);
  const baseline = JSON.parse(manifestBytes);
  for (const row of baseline.migrations) assert.equal(castingSha256(await readFile(path.join(root, row.path))), row.sha256, 'OLD_MIGRATION_BYTES_CHANGED');
  const sources = new Map(await Promise.all(CASTING_FRAGMENTS.map(async ([file]) => [file, await readFile(path.join(root, file))])));
  const migration = composeCastingMigration(manifestBytes, sources);
  const target = path.join(root, CASTING_MIGRATION); const previous = await readFile(target);
  assert(previous.length === 0 || previous.equals(migration), 'NONEMPTY_MIGRATION_REPLACEMENT_DENIED');
  if (previous.length === 0) await writeFile(target, migration);
  assert.equal(castingSha256(await readFile(target)), castingSha256(migration));
  const directory = path.join(root, 'tracking/evidence/m04/migration-preparation'); await mkdir(directory, { recursive: true });
  const retain = async (file, bytes) => {
    try { await writeFile(file, bytes, { flag: 'wx' }); }
    catch (error) { if (error.code !== 'EEXIST') throw error; assert((await readFile(file)).equals(bytes), 'RETAINED_PREPARATION_BYTES_CHANGED'); }
  };
  await retain(path.join(root, CASTING_BASELINE), manifestBytes);
  const report = { observed_at: new Date().toISOString(), migration: CASTING_MIGRATION, migration_sha256: castingSha256(migration),
    baseline_manifest: CASTING_BASELINE, baseline_manifest_sha256: CASTING_BASELINE_SHA, baseline_versions: baseline.migrations.map(row => path.posix.basename(row.path).slice(0, 14)),
    source_order: CASTING_FRAGMENTS.map(([file]) => file), source_seals: Object.fromEntries(CASTING_FRAGMENTS), adaptations: [],
    source_bytes_preserved: true, sql_executed: false, cloud_called: false, runtime_enabled: false, hosting_deferred: true };
  const receipt = path.join(directory, 'migration20-source.json');
  try { await writeFile(receipt, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' }); }
  catch (error) { if (error.code !== 'EEXIST') throw error; const prior = JSON.parse(await readFile(receipt)); assert.equal(prior.migration_sha256, report.migration_sha256); assert.deepEqual(prior.source_seals, report.source_seals); }
  process.stdout.write(JSON.stringify({ migration: CASTING_MIGRATION, migration_sha256: report.migration_sha256, receipt: path.relative(root, receipt).replaceAll('\\', '/'), sql_executed: false }) + '\n');
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main().catch(() => {
  process.stderr.write('Casting20 composition stopped; no SQL was executed.\n'); process.exitCode = 1;
});
