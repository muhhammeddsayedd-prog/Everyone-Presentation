// Replays supabase/migrations in filename order into the staging database container (eps-c7stg-db only), each file in
// one transaction as `postgres`, recording supabase_migrations.schema_migrations like hosted Supabase.
// Usage: node migrate.mjs [--until <version>]   (default: all files)
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '../../..');
const until = process.argv.includes('--until') ? process.argv[process.argv.indexOf('--until') + 1] : null;
const psql = (sql, user = 'postgres') => execFileSync('docker', ['exec', '-i', 'eps-c7stg-db', 'psql', '-U', user, '-h', 'localhost', '-d', 'postgres',
  '-v', 'ON_ERROR_STOP=1', '-At', '-q'], { input: sql, maxBuffer: 64 * 1024 * 1024 }).toString();
psql(`create schema if not exists supabase_migrations authorization postgres;
create table if not exists supabase_migrations.schema_migrations(version text primary key, statements text[], name text);
alter table supabase_migrations.schema_migrations owner to postgres;`, 'supabase_admin');
const applied = new Set(psql('select version from supabase_migrations.schema_migrations').split('\n').filter(Boolean));
const files = readdirSync(path.join(root, 'supabase/migrations')).filter(f => /^\d{14}_.+\.sql$/.test(f)).sort();
const out = [];
for (const file of files) {
  const [version, ...rest] = file.replace(/\.sql$/, '').split('_'); const name = rest.join('_');
  if (until && version > until) break;
  if (applied.has(version)) { out.push({ version, name, status: 'already_applied' }); continue; }
  const sql = readFileSync(path.join(root, 'supabase/migrations', file), 'utf8');
  const tag = '$eps_mig$';
  try {
    psql(`begin;\n${sql}\n;\ninsert into supabase_migrations.schema_migrations(version,name,statements) values ('${version}','${name}',array[${tag}${sql}${tag}]);\ncommit;\n`);
    out.push({ version, name, status: 'applied' });
  } catch (error) {
    out.push({ version, name, status: 'failed', error: String(error.stderr ?? error).split('\n').filter(l => /ERROR|DETAIL|CONTEXT/.test(l)).slice(0, 4).join(' | ') });
    console.log(JSON.stringify(out.slice(-3), null, 1)); process.exit(1);
  }
}
console.log(JSON.stringify({ applied: out.filter(o => o.status === 'applied').length, already: out.filter(o => o.status === 'already_applied').length,
  last: out.at(-1) }));
