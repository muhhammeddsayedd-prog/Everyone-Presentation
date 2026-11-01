/** Isolated native ACL experiment. No IO/SQL occurs on import. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {createRecovery36Context} from '../recovery36/runtime.mjs';
import {ownedIdentity33,ownedPredicate33} from '../recovery33/ownership.mjs';
import {normalizeDatabaseOid} from '../recovery29/identity.mjs';
import {sha} from '../recovery33/compiler.mjs';
export const TABLE_PRIVILEGES=['DELETE','INSERT','MAINTAIN','REFERENCES','SELECT','TRIGGER','TRUNCATE','UPDATE'];
export const COLUMN_PRIVILEGES=['INSERT','REFERENCES','SELECT','UPDATE'];
export const COLUMNS=['schema_version','job_id','attempt_id','kind','stage','attempt','stage_attempt','dispatch_generation','correlation_id','input_hash','workflow_execution_id','workflow_execution_ref_state','claimed_at','job_row_version'];
const TYPES=['text','uuid','uuid','text','text','integer','integer','bigint','text','text','text','text','timestamp with time zone','bigint'];
const SOURCE_ACL='{postgres=arwdDxtm/postgres}',COLUMN_ACL='{eps_job_trace_owner=a/postgres}';
const q=v=>"'"+String(v).replaceAll("'","''")+"'";
const exact=(v,keys)=>{assert(v&&typeof v==='object'&&!Array.isArray(v));assert.deepEqual(Object.keys(v).sort(),[...keys].sort());};
const array=v=>`array[${v.map(q).join(',')}]::text[]`;
/** Catalogue/privilege metadata only. No table contents, settings or role secrets. */
export function snapshotSql(){return `select jsonb_build_object(
 'table_acl',c.relacl::text,
 'identity',jsonb_build_object('table_oid',c.oid::bigint,'owner_oid',c.relowner::bigint,'owner',c.relowner::regrole::text,'schema_oid',n.oid::bigint,'kind',c.relkind,'persistence',c.relpersistence,'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity),
 'columns',(select jsonb_agg(jsonb_build_object('number',a.attnum,'name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,'acl',a.attacl::text,'default',pg_get_expr(d.adbin,d.adrelid))order by a.attnum)from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped),
 'policies',(select coalesce(jsonb_agg(jsonb_build_object('name',p.polname,'command',p.polcmd,'permissive',p.polpermissive,'roles',to_jsonb(p.polroles),'using',pg_get_expr(p.polqual,p.polrelid),'check',pg_get_expr(p.polwithcheck,p.polrelid))order by p.polname),'[]')from pg_policy p where p.polrelid=c.oid),
 'constraints',(select coalesce(jsonb_agg(jsonb_build_object('oid',k.oid::bigint,'name',k.conname,'type',k.contype,'relation',k.conrelid::bigint,'foreign_relation',k.confrelid::bigint,'definition',pg_get_constraintdef(k.oid,true))order by k.oid),'[]')from pg_constraint k where k.conrelid=c.oid or k.confrelid=c.oid),
 'triggers',(select coalesce(jsonb_agg(jsonb_build_object('oid',t.oid::bigint,'relation',t.tgrelid::bigint,'constraint_relation',t.tgconstrrelid::bigint,'constraint',t.tgconstraint::bigint,'enabled',t.tgenabled,'internal',t.tgisinternal,'definition',pg_get_triggerdef(t.oid,true),'function',pg_get_functiondef(t.tgfoid))order by t.oid),'[]')from pg_trigger t where t.tgrelid=c.oid or t.tgconstrrelid=c.oid or t.tgrelid='eps.jobs'::regclass),
 'namespace',jsonb_build_object('name',n.nspname,'owner_oid',n.nspowner::bigint,'acl',n.nspacl::text),
 'roles',(select jsonb_agg(jsonb_build_object('oid',r.oid::bigint,'name',r.rolname,'login',r.rolcanlogin,'super',r.rolsuper,'inherit',r.rolinherit,'bypassrls',r.rolbypassrls,'create_role',r.rolcreaterole,'create_db',r.rolcreatedb,'replication',r.rolreplication,'connection_limit',r.rolconnlimit,'valid_until',r.rolvaliduntil)order by r.rolname)from pg_roles r),
 'memberships',(select jsonb_agg(jsonb_build_object('role',m.roleid::bigint,'member',m.member::bigint,'grantor',m.grantor::bigint,'admin',m.admin_option,'inherit',m.inherit_option,'set',m.set_option)order by m.roleid,m.member,m.grantor)from pg_auth_members m),
 'expanded_acl',(select jsonb_agg(jsonb_build_object('grantor',x.grantor::bigint,'grantee',x.grantee::bigint,'privilege',x.privilege_type,'grantable',x.is_grantable)order by x.privilege_type,x.grantor,x.grantee,x.is_grantable)from aclexplode(coalesce(c.relacl,acldefault('r'::"char",c.relowner)))x),
 'table_matrix',(select jsonb_agg(jsonb_build_object('role',r.name,'privilege',p.value,'allowed',has_table_privilege(r.name,c.oid,p.value),'grantable',has_table_privilege(r.name,c.oid,p.value||' WITH GRANT OPTION'))order by r.name,p.value)from(select rolname::text name from pg_roles union all select 'public')r cross join unnest(${array(TABLE_PRIVILEGES)})p(value)),
 'column_matrix',(select jsonb_agg(jsonb_build_object('role',r.name,'column',a.attname,'privilege',p.value,'allowed',has_column_privilege(r.name,c.oid,a.attnum,p.value),'grantable',has_column_privilege(r.name,c.oid,a.attnum,p.value||' WITH GRANT OPTION'))order by r.name,a.attnum,p.value)from(select rolname::text name from pg_roles union all select 'public')r cross join pg_attribute a cross join unnest(${array(COLUMN_PRIVILEGES)})p(value)where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped),
 'schema_matrix',(select jsonb_agg(jsonb_build_object('role',r.name,'privilege',p.value,'allowed',has_schema_privilege(r.name,n.oid,p.value),'grantable',has_schema_privilege(r.name,n.oid,p.value||' WITH GRANT OPTION'))order by r.name,p.value)from(select rolname::text name from pg_roles union all select 'public')r cross join unnest(array['CREATE','USAGE']::text[])p(value)))
 from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.oid=to_regclass('eps.job_stage_attempts')`;}
export function nativeProofSql(identity){
 const owned=ownedPredicate33(identity),snap=snapshotSql();
 const diff=field=>`(select count(*)from((select value from jsonb_array_elements(b->${q(field)})except select value from jsonb_array_elements(e->${q(field)}))union all(select value from jsonb_array_elements(e->${q(field)})except select value from jsonb_array_elements(b->${q(field)})))d)`;
 return `do $native_acl$declare v jsonb;begin
 if current_user<>'postgres'or ${owned} or(select system_identifier::text from pg_control_system())<>'7701520506262638626'
 or(select count(*)from supabase_migrations.schema_migrations)<>36
 or not exists(select 1 from pg_roles where rolname='postgres'and oid=16384)
 or not exists(select 1 from pg_class where oid=to_regclass('eps.job_stage_attempts')and relowner=16384 and relkind='r'and relpersistence='p'and relacl is null and relrowsecurity and relforcerowsecurity)
 then raise exception'TRACE_ACL_OWNED_NULL_PAIR_REQUIRED';end if;
 ${snap} into v;perform set_config('eps.trace_acl_native.before',v::text,true);end$native_acl$;
 select jsonb_build_object('phase','null_before','snapshot',current_setting('eps.trace_acl_native.before')::jsonb);
 savepoint trace_acl_native;
 grant all privileges on table eps.job_stage_attempts to postgres;
 with observed as(${snap}),pair as(select current_setting('eps.trace_acl_native.before')::jsonb b,(select*from observed)e)
 select jsonb_build_object('phase','explicit','snapshot',e,'metadata_equal_except_acl',(b-'table_acl')=(e-'table_acl'),'symmetric_differences',jsonb_build_object(${['expanded_acl','table_matrix','column_matrix','schema_matrix'].map(f=>q(f)+','+diff(f)).join(',')}))from pair;
 rollback to savepoint trace_acl_native;
 with observed as(${snap})select jsonb_build_object('phase','null_after','snapshot',(select*from observed),'rollback_exact',(select*from observed)=current_setting('eps.trace_acl_native.before')::jsonb);
 release savepoint trace_acl_native;`;
}
function checkSnapshot(s,acl){
 exact(s,['table_acl','identity','columns','policies','constraints','triggers','namespace','roles','memberships','expanded_acl','table_matrix','column_matrix','schema_matrix']);assert.equal(s.table_acl,acl);
 exact(s.identity,['table_oid','owner_oid','owner','schema_oid','kind','persistence','rls','force_rls']);assert.equal(normalizeDatabaseOid(s.identity.owner_oid),16384);normalizeDatabaseOid(s.identity.table_oid);normalizeDatabaseOid(s.identity.schema_oid);
 assert.deepEqual({...s.identity,table_oid:0,schema_oid:0},{table_oid:0,schema_oid:0,owner_oid:16384,owner:'postgres',kind:'r',persistence:'p',rls:true,force_rls:true});
 assert.deepEqual(s.columns.map(v=>v.name),COLUMNS);for(let i=0;i<COLUMNS.length;i++){const c=s.columns[i];exact(c,['number','name','type','not_null','acl','default']);assert.equal(c.number,i+1);assert.equal(c.type,TYPES[i]);assert.equal(c.acl,COLUMN_ACL);assert.equal(c.not_null,c.name!=='workflow_execution_id');}
 assert.equal(s.roles.length,61);const names=s.roles.map(r=>r.name);assert.equal(new Set(names).size,61);assert(!names.includes('public'));for(const n of ['postgres','anon','authenticated','service_role','eps_job_trace_owner','eps_mcp_issuer_owner','eps_oauth_consent_owner'])assert(names.includes(n));
 for(const r of s.roles){exact(r,['oid','name','login','super','inherit','bypassrls','create_role','create_db','replication','connection_limit','valid_until']);normalizeDatabaseOid(r.oid);assert.equal(typeof r.name,'string');for(const k of ['login','super','inherit','bypassrls','create_role','create_db','replication'])assert.equal(typeof r[k],'boolean');assert(Number.isSafeInteger(r.connection_limit));assert(r.valid_until===null||typeof r.valid_until==='string');}
 assert.equal(new Set(s.roles.map(r=>r.oid)).size,61);
 assert(Array.isArray(s.memberships));for(const m of s.memberships){exact(m,['role','member','grantor','admin','inherit','set']);for(const k of ['role','member','grantor'])normalizeDatabaseOid(m[k]);for(const k of ['admin','inherit','set'])assert.equal(typeof m[k],'boolean');}
 const subjects=[...names,'public'];
 const matrix=(rows,privileges,columns)=>{const expected=new Set(subjects.flatMap(r=>(columns??['']).flatMap(c=>privileges.map(p=>JSON.stringify([r,c,p])))));assert.equal(rows.length,expected.size);for(const r of rows){exact(r,columns?['role','column','privilege','allowed','grantable']:['role','privilege','allowed','grantable']);assert.equal(typeof r.allowed,'boolean');assert.equal(typeof r.grantable,'boolean');assert(expected.delete(JSON.stringify([r.role,r.column??'',r.privilege])));}assert.equal(expected.size,0);};
 matrix(s.table_matrix,TABLE_PRIVILEGES);matrix(s.column_matrix,COLUMN_PRIVILEGES,COLUMNS);matrix(s.schema_matrix,['CREATE','USAGE']);
 assert.deepEqual(s.expanded_acl,TABLE_PRIVILEGES.map(privilege=>({grantor:16384,grantee:16384,privilege,grantable:false})));
 assert.equal(s.policies.length,1);exact(s.policies[0],['name','command','permissive','roles','using','check']);assert.equal(s.policies[0].name,'job_stage_attempts_capture');assert.equal(s.policies[0].command,'a');assert.equal(s.policies[0].permissive,true);assert.equal(s.policies[0].using,null);assert.equal(typeof s.policies[0].check,'string');assert.equal(s.policies[0].roles.length,1);normalizeDatabaseOid(s.policies[0].roles[0]);
 assert(s.constraints.length>0&&s.triggers.length>0);for(const c of s.constraints)exact(c,['oid','name','type','relation','foreign_relation','definition']);for(const t of s.triggers)exact(t,['oid','relation','constraint_relation','constraint','enabled','internal','definition','function']);
 const fks=s.constraints.filter(c=>c.type==='f');assert.equal(fks.length,1);const fk=fks[0];assert.equal(fk.relation,s.identity.table_oid);normalizeDatabaseOid(fk.oid);normalizeDatabaseOid(fk.foreign_relation);
 const ri=s.triggers.filter(t=>t.constraint===fk.oid);assert.equal(ri.length,4);for(const t of ri){assert.equal(t.internal,true);assert.equal(t.enabled,'O');assert([s.identity.table_oid,fk.foreign_relation].includes(t.relation));assert([s.identity.table_oid,fk.foreign_relation].includes(t.constraint_relation));}
 exact(s.namespace,['name','owner_oid','acl']);assert.equal(s.namespace.name,'eps');normalizeDatabaseOid(s.namespace.owner_oid);return s;
}
export function validateNativeProof(rows){
 assert.deepEqual(rows.map(r=>r.phase),['null_before','explicit','null_after']);
 exact(rows[0],['phase','snapshot']);exact(rows[1],['phase','snapshot','metadata_equal_except_acl','symmetric_differences']);exact(rows[2],['phase','snapshot','rollback_exact']);
 const before=checkSnapshot(rows[0].snapshot,null),explicit=checkSnapshot(rows[1].snapshot,SOURCE_ACL),after=checkSnapshot(rows[2].snapshot,null);
 assert.deepEqual({...explicit,table_acl:null},before);assert.deepEqual(after,before);assert.equal(rows[1].metadata_equal_except_acl,true);assert.equal(rows[2].rollback_exact,true);
 assert.deepEqual(rows[1].symmetric_differences,{expanded_acl:0,table_matrix:0,column_matrix:0,schema_matrix:0});
 return{result:'passed',native_only:true,metadata_restore_acceptance:false,role_count:before.roles.length,public_pseudo_role_included:true,table_privileges:8,column_count:14,column_privileges:4,grant_options_compared:true,table_matrix_rows:before.table_matrix.length,column_matrix_rows:before.column_matrix.length,schema_matrix_rows:before.schema_matrix.length,table_matrix_sha256:sha(JSON.stringify(before.table_matrix)),column_matrix_sha256:sha(JSON.stringify(before.column_matrix)),schema_matrix_sha256:sha(JSON.stringify(before.schema_matrix)),expanded_acl_sha256:sha(JSON.stringify(before.expanded_acl)),symmetric_differences:0,null_acl_restored:true,owner_rls_policy_column_grants_schema_trigger_fk_and_global_roles_exact:true};
}
export function createTraceAclNativeContext(ctx,{contextFactory=createRecovery36Context,io={readFile,writeFile}}={}){
 const complete=Object.freeze({nativeProofComplete:true});let proved=false;
 const wrapped={...ctx,preserveOriginalDumpProfile:async(database,expected)=>{
  if(database!==ctx.restoreDb||ctx.report.checkpoint!=='populated36-metadata-dump-restore')return ctx.preserveOriginalDumpProfile(database,expected);
  assert.equal(expected['tables|eps.job_stage_attempts|acl'],SOURCE_ACL);assert.equal(ctx.report.metadata36_catalogue_difference_count,13);
  const prior=JSON.parse(ctx.sourceFiles.get('tracking/evidence/m07/recovery36/2026-11-01T03-34-12-941Z-5d8d863a.json'));
  assert.deepEqual(ctx.report.metadata36_catalogue_difference_keys,prior.metadata36_catalogue_difference_keys);
  const before=await ctx.catalogue(database);assert.equal(before['tables|eps.job_stage_attempts|acl'],null);
  for(const key of new Set([...Object.keys(expected),...Object.keys(before)]))if(key!=='tables|eps.job_stage_attempts|acl'&&(key.includes('eps.job_stage_attempts')||key.includes('eps.capture_job_stage_attempt')||key.includes('eps.jobs.capture_job_stage_attempt')||key.startsWith('schemas|eps|')))assert.deepEqual(before[key],expected[key]);
  for(const c of COLUMNS)assert.equal(before[`columns|eps.job_stage_attempts.${c}|acl`],COLUMN_ACL);
  const identity={database,marker:ctx.marker(database),oid:(await ctx.databaseIdentity(database)).oid};ownedIdentity33(identity);
  const result=await ctx.sql(database,nativeProofSql(identity));const rows=ctx.rows(result.stdout).filter(r=>['null_before','explicit','null_after'].includes(r.phase));
  const proof=validateNativeProof(rows);assert.deepEqual(await ctx.catalogue(database),before,'TRACE_ACL_ROLLBACK_CATALOGUE_CHANGED');
  assert(ctx.report.private_artifact_acl);const bytes=JSON.stringify(rows);await io.writeFile(path.join(ctx.privateRoot,'trace-acl-native-private.json'),bytes,{flag:'wx',mode:0o600});
  ctx.report.trace_acl_native={...proof,actual_native_rows_sha256:sha(bytes)};ctx.report.metadata_restore_acceptance=false;ctx.report.native_media_executed=false;ctx.report.storage_http_tested=false;ctx.report.deployed_restore_tested=false;
  proved=true;throw complete;
 }};
 const inherited=contextFactory(wrapped,{io});return{get active(){return inherited.active;},get catalogueSql(){return inherited.catalogueSql;},upgrade:inherited.upgrade,cleanupRoles:inherited.cleanupRoles,seedSql:inherited.seedSql,authBoundary:inherited.authBoundary,admitSourceFixtureCatalogue:inherited.admitSourceFixtureCatalogue,profileEvidence:inherited.profileEvidence,async metadataRestore(){
  try{await inherited.metadataRestore();assert.fail('TRACE_ACL_NATIVE_SENTINEL_REQUIRED');}catch(error){if(error!==complete||!proved)throw error;assert.equal(ctx.report.recovery36_metadata,undefined);}
 }};
}
