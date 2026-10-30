/** Compose this project's existing coordinated history. No migration insertion or DB writes. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
const sha=value=>createHash('sha256').update(value).digest('hex');
const manifestBytes=await readFile('development/local-db/reviewed.json'),manifest=JSON.parse(manifestBytes);
assert.equal(manifest.migrations.length,28);for(const row of manifest.migrations)assert.equal(sha(await readFile(row.path)),row.sha256);
const baseline='development/m07/db/baseline28-reviewed.json';
try{await writeFile(baseline,manifestBytes,{flag:'wx'});}catch(error){if(error.code!=='EEXIST')throw error;assert((await readFile(baseline)).equals(manifestBytes));}
const fragments=['settings-forward','session-forward','capabilities-default-forward'].map(name=>`development/m07/db/${name}.sql`);
const sources=await Promise.all(fragments.map(file=>readFile(file,'utf8')));
// Rehearse exactly the composed migration bytes in the guarded owned clone.
// Production still requires postgres + the exact fixed28 coordinated history.
const localPredicate="current_setting('eps.m07_candidate_tests',true)is distinct from'owned-local29'\n or current_database()!~'^eps_m07_settings_[a-f0-9]{32}$'";
const dualPredicate="(current_database()<>'postgres'and(current_setting('eps.m07_candidate_tests',true)is distinct from'owned-local29'\n or current_database()!~'^eps_m07_settings_[a-f0-9]{32}$'))";
for(let i=0;i<2;i++){assert.equal(sources[i].split(localPredicate).length,2);sources[i]=sources[i].replace(localPredicate,()=>dualPredicate);}
const versions=manifest.migrations.map(row=>row.path.split('/').at(-1).slice(0,14));assert.deepEqual(versions,[...new Set(versions)].sort());
const header=`-- M07 additive settings/defaults and constrained delegated session29 after exact reviewed28.\n-- No Auth identities/client registration/hooks, secrets, flags, cloud fixtures, seeds or historical-version updates.\nset local search_path='';set local lock_timeout='5s';set local statement_timeout='45s';\ndo $m07_history$begin if current_user<>'postgres'or(select array_agg(version order by version)from supabase_migrations.schema_migrations)is distinct from array[${versions.map(v=>`'${v}'`).join(',')}]::text[]then raise exception'M07_EXACT_REVIEWED28_REQUIRED';end if;end$m07_history$;\n`;
const candidate=header+sources.map((source,i)=>`\n-- Guarded component: ${fragments[i]}\n${source}\n`).join('');
await writeFile('development/m07/db/candidate29.sql',candidate);
const input={schema_version:'1.0',prepared_at:new Date().toISOString(),baseline,baseline_sha256:sha(manifestBytes),baseline_versions:versions,fragments:Object.fromEntries(await Promise.all(fragments.map(async file=>[file,sha(await readFile(file))]))),candidate_path:'development/m07/db/candidate29.sql',candidate_sha256:sha(candidate),cloud_called:false,private_configuration_loaded:false,scope:'Candidate composition only; no supabase/migrations or reviewed manifest update. Exact same bytes require fresh owned local real-role and catalogue preservation proof before freezing.'};
await writeFile('development/m07/db/candidate29-inputs.json',JSON.stringify(input,null,2)+'\n');console.log(JSON.stringify({candidate:input.candidate_path,sha256:input.candidate_sha256}));
