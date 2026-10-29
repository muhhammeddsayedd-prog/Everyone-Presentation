/** Compose four reviewed fragments into additive18. No SQL or private configuration IO. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

export const REMAINING_MIGRATION = 'supabase/migrations/20261029133455_m03_remaining_media_library.sql';
export const REMAINING_FRAGMENTS = Object.freeze([
  ['development/m03/remaining-uploads.sql', '377caf4e5bbc33b36f479a16bc6f5d35a87036b5c26c1b9ebfdcbbb6123a7287'],
  ['development/m03/remaining-filters.sql', '2215674d0da0f7c37e766b58902b7e0a8fb08b48de17d1cab80b5354085c8198'],
  ['development/m03/remaining-frames.sql', '3a3bae7cc52dc7a5dfe05077b26818b825af75490419c31d15fa5dca111b6ce0'],
  ['development/m03/remaining-frame-user-jobs.sql', 'dbe022afff0e823be41cb1713a7d2b72037fc4adb0e8404db74dca9a90d6034a'],
]);
export const sha256 = value => createHash('sha256').update(value).digest('hex');

export function composeRemainingMigration(versions, sources) {
  assert.equal(versions.length, 17, 'EXACT_REVIEWED_SEVENTEEN_REQUIRED');
  assert(versions.every(value => typeof value === 'string' && /^\d{14}$/u.test(value)));
  assert.deepEqual(versions, [...new Set(versions)].sort());
  assert.equal(sources.size, REMAINING_FRAGMENTS.length);
  for (const [file, expected] of REMAINING_FRAGMENTS) {
    assert.equal(sha256(sources.get(file)), expected, `REVIEWED_FRAGMENT_CHANGED:${file}`);
  }
  const header = `-- M03 additive remaining media/library18 after exact reviewed17.\n-- Supporting references, source-grounded filters, immutable native frame append, requester-only frame jobs.\n-- No fixture data, credentials, native-image enablement or runtime activation.\nset local lock_timeout='5s';set local statement_timeout='30s';set local search_path='';\ndo $baseline$begin\n if current_user<>'postgres' or current_database()<>'postgres' or\n (select array_agg(version order by version) from supabase_migrations.schema_migrations) is distinct from array[${versions.map(value => `'${value}'`).join(',')}]::text[]\n then raise exception 'M03_REMAINING_REVIEWED_SEVENTEEN_REQUIRED';end if;\nend $baseline$;\n`;
  return header + REMAINING_FRAGMENTS.map(([file]) => `\n-- Exact reviewed fragment: ${file}\n${sources.get(file)}`).join('\n');
}

async function main() {
  assert.equal(process.argv.length, 2);
  const root = path.resolve(import.meta.dirname, '..');
  const manifestPath = 'development/local-db/reviewed.json';
  const manifestBytes = await readFile(path.join(root, manifestPath));
  const manifest = JSON.parse(manifestBytes);
  assert.equal(manifest.migrations.length, 17, 'EXACT_REVIEWED_SEVENTEEN_REQUIRED');
  for (const row of manifest.migrations) {
    assert.equal(sha256(await readFile(path.join(root, row.path))), row.sha256, `BASELINE_MIGRATION_CHANGED:${row.path}`);
  }
  const versions = manifest.migrations.map(row => path.basename(row.path).slice(0, 14));
  const sources = new Map(await Promise.all(REMAINING_FRAGMENTS.map(async ([file]) => [file, await readFile(path.join(root, file), 'utf8')])));
  const migration = composeRemainingMigration(versions, sources);
  const target = path.join(root, REMAINING_MIGRATION);
  const previous = await readFile(target, 'utf8');
  assert(previous.length === 0 || previous === migration, 'NONEMPTY_MIGRATION_REPLACEMENT_DENIED');
  if (previous.length === 0) await writeFile(target, migration);
  assert.equal(sha256(await readFile(target)), sha256(migration));
  const report = {
    observed_at: new Date().toISOString(), migration: REMAINING_MIGRATION, migration_sha256: sha256(migration),
    baseline_manifest: manifestPath, baseline_manifest_sha256: sha256(manifestBytes), baseline_versions: versions,
    source_order: REMAINING_FRAGMENTS.map(([file]) => file), source_seals: Object.fromEntries(REMAINING_FRAGMENTS),
    adaptations: [], sql_executed: false, cloud_called: false, runtime_enabled: false,
  };
  const directory = path.join(root, 'tracking/evidence/m03/remaining-preparation');
  await mkdir(directory, { recursive: true });
  const receipt = path.join(directory, 'migration18-source.json');
  try { await writeFile(receipt, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' }); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const retained = JSON.parse(await readFile(receipt, 'utf8'));
    assert.equal(retained.migration_sha256, report.migration_sha256);
    assert.deepEqual(retained.source_seals, report.source_seals);
  }
  process.stdout.write(JSON.stringify({ migration: report.migration, migration_sha256: report.migration_sha256, receipt: path.relative(root, receipt).replaceAll('\\', '/') }) + '\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(() => { process.stderr.write('Remaining18 composition stopped; no SQL was executed.\n'); process.exitCode = 1; });
}
