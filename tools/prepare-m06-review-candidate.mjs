/** Project's established coordinated byte-preserving migration composition. */
import assert from'node:assert/strict';
import{createHash}from'node:crypto';
import{mkdir,readFile,writeFile}from'node:fs/promises';
const ROOT=process.cwd();const sha=value=>createHash('sha256').update(value).digest('hex');
const baselinePath='development/m06/baseline24-reviewed.json';const baseline=await readFile('development/local-db/reviewed.json');const manifest=JSON.parse(baseline);assert.equal(manifest.migrations.length,24);
for(const row of manifest.migrations)assert.equal(sha(await readFile(row.path)),row.sha256,'ESTABLISHED_MIGRATION_BYTES_CHANGED');
await mkdir('development/m06',{recursive:true});try{await writeFile(baselinePath,baseline,{flag:'wx'});}catch(error){if(error.code!=='EEXIST')throw error;assert((await readFile(baselinePath)).equals(baseline),'BASELINE24_CHANGED');}
const fragments=['schema','links','feedback','exports','gateway','export-processing','finalize'].map(name=>`development/m06/${name}.sql`);const sources=await Promise.all(fragments.map(f=>readFile(f)));
const versions=manifest.migrations.map(row=>row.path.split('/').at(-1).slice(0,14));assert.deepEqual(versions,[...new Set(versions)].sort());
const header=`-- M06 additive guest review/export25 after exact reviewed24.\n-- Disabled configuration, no private key/login, fixture, provider or hosting change.\nset local search_path='';set local lock_timeout='3s';set local statement_timeout='30s';\ndo $m06_baseline$begin if current_user<>'postgres' or current_database()<>'postgres' or(select array_agg(version order by version)from supabase_migrations.schema_migrations)is distinct from array[${versions.map(v=>`'${v}'`).join(',')}]::text[]then raise exception'M06_EXACT_REVIEWED24_REQUIRED';end if;end$m06_baseline$;\n`;
const candidate=Buffer.concat([Buffer.from(header),...sources.flatMap((bytes,i)=>[Buffer.from(`\n-- Exact candidate fragment: ${fragments[i]}\n`),bytes,Buffer.from('\n')])]);
await writeFile('development/m06/candidate.sql',candidate);
const result={schema_version:'1.0',prepared_at:new Date().toISOString(),scope:'Mutable local candidate only; numbered migration requires frozen proof and root review. Existing project custom coordinated migration pipeline retained; Supabase CLI not introduced.',baseline:baselinePath,baseline_sha256:sha(baseline),baseline_versions:versions,fragments:Object.fromEntries(fragments.map((f,i)=>[f,sha(sources[i])])),candidate_path:'development/m06/candidate.sql',candidate_sha256:sha(candidate),candidate_bytes:candidate.length,cloud_called:false,private_configuration_loaded:false,source_root:ROOT};
await writeFile('development/m06/candidate-inputs.json',JSON.stringify(result,null,2)+'\n');process.stdout.write(JSON.stringify({candidate:result.candidate_path,sha256:result.candidate_sha256,bytes:candidate.length})+'\n');
