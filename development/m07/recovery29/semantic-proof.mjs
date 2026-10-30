/** Independent original29 SELECT/catalogue proof; no clone, DDL or media. */
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {mkdir,open,readFile,unlink,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {verifyLocalTarget,runOwnedLocalSql} from '../../../tools/local-postgres.mjs';
const ROOT=path.resolve(import.meta.dirname,'..','..','..');
const sqlPath='development/m07/recovery29/semantic-proof.sql';
const diffPath='tracking/evidence/m07/recovery29/2026-10-30T12-19-02-143Z-0ec7ead2-diagnostic-differences.json';
const diffSha='ea581b2e795f6c06fe2b950b714957520529517f946bfcf9fb7f100005015d2a';
const originalPath='tracking/evidence/m07/recovery29/2026-10-30T12-19-02-143Z-0ec7ead2-diagnostic-original-catalogue.json';
const originalSha='dcc5e065d77f504deaf1ebbb19a75eee4b940a32bf7dfbf1905e22b4e44f6c19';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const read=file=>readFile(path.join(ROOT,file));
const one=stdout=>{const rows=stdout.split(/\r?\n/u).filter(line=>line.startsWith('{')).map(line=>JSON.parse(line));assert.equal(rows.length,1);return rows[0];};
const runId=randomUUID(),started=new Date().toISOString(),lockPath=path.join(ROOT,'.local/local-postgres/test-db.lock');
const report={schema_version:'1.0',run_id:runId,started_at:started,result:'failed',scope:'Independent read-only original29 literal Boolean/URL and ACL/catalogue semantic proof; no business or Auth row reads',cloud_called:false,provider_called:false,native_called:false,clone_created:false,database_ddl_or_dml:false};
report.prior_attempts=[{path:'tracking/evidence/m07/recovery29/2026-10-30T12-23-31-730Z-081209ad-semantic-proof.json',result:'failed',reason:'Fixed literal query used removed lc_ctype GUC on PostgreSQL17.6; now reads pg_database.datctype metadata instead. Original catalogue, all safe role/membership/migration metadata and lock cleanup were confirmed unchanged. A bounded read-only diagnostic rerun returned only this PostgreSQL ERROR.'}];
let locked=false,before,catalogBefore;
const metadataSql=`begin isolation level repeatable read read only;set local search_path='';set local timezone='UTC';select jsonb_build_object('migrations',(select jsonb_agg(version order by version)from supabase_migrations.schema_migrations),'roles',(select jsonb_agg(jsonb_build_object('oid',oid,'name',rolname,'login',rolcanlogin,'superuser',rolsuper,'inherit',rolinherit,'bypassrls',rolbypassrls,'create_role',rolcreaterole,'create_db',rolcreatedb,'replication',rolreplication,'connection_limit',rolconnlimit,'valid_until',rolvaliduntil)order by rolname)from pg_roles),'memberships',(select jsonb_agg(jsonb_build_object('role_oid',roleid,'member_oid',member,'grantor_oid',grantor,'admin',admin_option,'inherit',inherit_option,'set',set_option)order by roleid,member,grantor)from pg_auth_members));rollback;`;
let catalogueSql;
async function catalogue(){return one((await runOwnedLocalSql(`begin isolation level repeatable read read only;set local search_path='';set local timezone='UTC';${catalogueSql}rollback;`)).stdout);}
try{
 assert.equal(process.argv.length,2);assert.equal(path.resolve(process.cwd()),ROOT);
 const sourcePaths=[sqlPath,'development/m07/recovery29/semantic-proof.mjs','tools/local-postgres.mjs','development/m07/db/catalog29.sql',diffPath,originalPath];
 const sourceBytes=new Map(await Promise.all(sourcePaths.map(async file=>[file,await read(file)])));
 report.source_seals=Object.fromEntries([...sourceBytes].map(([file,bytes])=>[file,sha(bytes)]));
 assert.equal(report.source_seals[diffPath],diffSha);assert.equal(report.source_seals[originalPath],originalSha);
 const differences=JSON.parse(sourceBytes.get(diffPath));
 const constraint=differences.find(row=>row.key==='constraints|eps.mcp_oauth_resources.mcp_oauth_resources_resource_check|definition');
 const acl=differences.find(row=>row.key==='tables|auth.sessions|acl');assert(constraint&&acl);
 const sql=sourceBytes.get(sqlPath).toString('utf8');
 for(const expression of [constraint.source,constraint.dump_clone])assert(sql.includes(expression.slice('CHECK '.length)),'ACTUAL_OBSERVED_CHECK_EXPRESSION_REQUIRED');
 for(const expression of [acl.source,acl.dump_clone])assert(sql.includes(expression),'ACTUAL_OBSERVED_ACL_REQUIRED');
 assert(/^--[^\n]*\n(?:--[^\n]*\n)*begin isolation level repeatable read read only;/u.test(sql));assert(/rollback;\s*$/u.test(sql));
 catalogueSql=sourceBytes.get('development/m07/db/catalog29.sql').toString('utf8');
 const lock=await open(lockPath,'wx',0o600);await lock.writeFile(JSON.stringify({run_id:runId,pid:process.pid,purpose:'history29-independent-readonly-semantic-proof'}));await lock.close();locked=true;
 const target=await verifyLocalTarget();assert.equal(target.observed.system_identifier,'7701520506262638626');
 report.target={container:target.config.container,system_identifier:target.observed.system_identifier,database:target.observed.database,server_version:target.observed.server_version,connection:target.observed.connection};
 before=one((await runOwnedLocalSql(metadataSql)).stdout);assert.equal(before.migrations.length,29);
 catalogBefore=await catalogue();assert.deepEqual(catalogBefore,JSON.parse(sourceBytes.get(originalPath)));
 report.metadata_before_sha256=sha(JSON.stringify(before));report.catalogue_before_sha256=sha(JSON.stringify(catalogBefore));
 const proof=one((await runOwnedLocalSql(sql)).stdout);report.proof=proof;
 assert.equal(proof.environment.transaction_read_only,'on');assert.equal(proof.three_valued_logic.cases,81);assert.equal(proof.three_valued_logic.result_mismatches,0);assert.equal(proof.three_valued_logic.check_acceptance_mismatches,0);
 assert.equal(proof.resource_check.cases,36);assert.equal(proof.resource_check.result_mismatches,0);assert.equal(proof.resource_check.check_acceptance_mismatches,0);
 assert.equal(proof.resource_check.actual_constraint.definition,constraint.source);assert.equal(proof.resource_check.actual_constraint.convalidated,true);assert.equal(proof.resource_check.actual_constraint.resource_not_null,true);
 const cases=new Map(proof.resource_check.rows.map(row=>[row.case_id,row]));assert.equal(cases.get('null').source,null);assert.equal(cases.get('null').check_accepts,true);assert.equal(cases.get('https_length_2048').characters,2048);assert.equal(cases.get('https_length_2048').source,true);assert.equal(cases.get('https_length_2049').characters,2049);assert.equal(cases.get('https_length_2049').source,false);
 assert.equal(proof.auth_sessions_acl.same_expanded_privileges,true);assert.equal(proof.auth_sessions_acl.actual_source_acl,acl.source);
 assert.equal(proof.builtins.count,7);assert.equal(proof.builtins.all_immutable,true);assert.equal(proof.builtins.all_strict,true);
 report.result='passed';
 report.limitations=['81 Boolean cases exhaust conjunction reassociation, including NULL; the finite URL fixtures are additional checks, not exhaustive URI validation.','Only the two exact observed source/dump pairs are covered. ACL ordering is compared as expanded grantor/grantee/privilege/grant-option entries.','CHECK TRUE/NULL acceptance and the actual independent NOT NULL flag are proven separately; no INSERT/DDL was used.','Literal SELECT and system metadata only; no business/Auth rows, clone, native media, provider, cloud or restore execution.'];
}catch{report.result='failed';report.failure_code='RECOVERY29_READONLY_SEMANTIC_PROOF_UNCONFIRMED';}
finally{
 try{
  if(before){const after=one((await runOwnedLocalSql(metadataSql)).stdout);assert.deepEqual(after,before);report.metadata_after_sha256=sha(JSON.stringify(after));report.original29_migration_history_and_all_global_role_oids_attributes_memberships_unchanged=true;}
  if(catalogBefore){const after=await catalogue();assert.deepEqual(after,catalogBefore);report.catalogue_after_sha256=sha(JSON.stringify(after));report.original29_full_raw_catalogue_unchanged=true;}
  for(const[file,hash]of Object.entries(report.source_seals??{}))assert.equal(sha(await read(file)),hash);
  report.sources_unchanged=true;
  if(locked){assert.equal(JSON.parse(await readFile(lockPath,'utf8')).run_id,runId);await unlink(lockPath);report.shared_lock_released=true;locked=false;}
 }catch{report.result='failed';report.final_metadata_or_lock_unconfirmed=true;}
 report.finished_at=new Date().toISOString();report.elapsed_ms=Date.parse(report.finished_at)-Date.parse(report.started_at);
 const directory=path.join(ROOT,'tracking/evidence/m07/recovery29');await mkdir(directory,{recursive:true});const file=path.join(directory,started.replace(/[:.]/gu,'-')+'-'+runId.slice(0,8)+'-semantic-proof.json');await writeFile(file,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({result:report.result,evidence:path.relative(ROOT,file).replaceAll('\\','/'),boolean_cases:report.proof?.three_valued_logic.cases,url_cases:report.proof?.resource_check.cases,source_and_roles_unchanged:report.original29_migration_history_and_all_global_role_oids_attributes_memberships_unchanged,lock_released:report.shared_lock_released}));if(report.result!=='passed')process.exitCode=1;
}
