/** One exact native-proved table ACL; inherited profile/data guards stay intact. */
import assert from 'node:assert/strict';
import {createRecovery36Context} from '../recovery36/runtime.mjs';
import {ownedIdentity33,ownedPredicate33} from '../recovery33/ownership.mjs';
import {snapshotSql,COLUMNS} from '../recovery36-trace-acl-native/runtime.mjs';
import {admitNativeReceipt,NATIVE_RECEIPT,NATIVE_SHA} from './compiler.mjs';
const KEY='tables|eps.job_stage_attempts|acl',SOURCE='{postgres=arwdDxtm/postgres}',COLUMN='{eps_job_trace_owner=a/postgres}';
const ENGLISH_ROWS_SQL="select coalesce(jsonb_agg(to_jsonb(t)order by version_id,video_asset_id),'[]')from eps.presentation_video_english_transcripts t;";
const q=v=>"'"+String(v).replaceAll("'","''")+"'",j=v=>q(JSON.stringify(v))+'::jsonb';
export function admitPair(expected,observed){
 assert.equal(expected[KEY],SOURCE);assert.equal(observed[KEY],null);
 for(const key of new Set([...Object.keys(expected),...Object.keys(observed)]))if(key!==KEY&&(key.includes('eps.job_stage_attempts')||key.includes('eps.capture_job_stage_attempt')||key.includes('eps.jobs.capture_job_stage_attempt')||key.startsWith('schemas|eps|')))assert.deepEqual(observed[key],expected[key],'TRACE_PROFILE_TARGET_METADATA_CHANGED');
 for(const view of [expected,observed]){assert.equal(view['tables|eps.job_stage_attempts|owner'],'postgres');assert.equal(view['tables|eps.job_stage_attempts|rls'],true);assert.equal(view['tables|eps.job_stage_attempts|force_rls'],true);for(const c of COLUMNS)assert.equal(view[`columns|eps.job_stage_attempts.${c}|acl`],COLUMN);}
 return true;
}
export function correctionSql(identity,before,versions){
 assert.equal(ownedIdentity33(identity).kind,'restore','TRACE_PROFILE_ONLY_OWNED_RESTORE_REQUIRED');const owned=ownedPredicate33(identity);assert.equal(versions.length,36);assert.equal(new Set(versions).size,36);assert.equal(versions.at(-1),'20261101012057');for(const v of versions)assert(/^[0-9]{14}$/u.test(v));
 assert.equal(before.table_acl,null);assert.equal(before.identity.owner, 'postgres');assert.equal(before.identity.owner_oid,16384);assert.equal(before.identity.rls,true);assert.equal(before.identity.force_rls,true);assert.deepEqual(before.columns.map(c=>c.name),COLUMNS);for(const c of before.columns)assert.equal(c.acl,COLUMN);
 const snap=snapshotSql(),marker=`eps-m07-recovery36:${identity.marker.split(':')[1]}:trace`;
 return `do $trace_profile$declare v jsonb;r oid;begin
 if current_user<>'postgres'or ${owned} or(select system_identifier::text from pg_control_system())<>'7701520506262638626'
 or(select array_agg(version order by version)from supabase_migrations.schema_migrations)is distinct from array[${versions.map(q).join(',')}]::text[]
 or not exists(select 1 from pg_roles where rolname='postgres'and oid=16384)
 or not exists(select 1 from pg_roles where rolname='eps_job_trace_owner'and shobj_description(oid,'pg_authid')=${q(marker)} and not rolcanlogin and not rolsuper and not rolinherit and not rolbypassrls and not rolcreaterole and not rolcreatedb and not rolreplication and rolconnlimit=-1 and rolvaliduntil is null)
 or not exists(select 1 from pg_proc p join pg_roles r on r.oid=p.proowner where p.oid=to_regprocedure('eps.capture_job_stage_attempt()')and r.rolname='eps_job_trace_owner'and p.prosecdef and p.provolatile='v'and p.proconfig=array['search_path=""']::text[] and encode(sha256(convert_to(replace(p.prosrc,E'\\r\\n',E'\\n'),'UTF8')),'hex')='a1de1739a8c0005e5b8a09e2e87bfb1094c38839631a813f06635e339afb9228')
 then raise exception'TRACE_PROFILE_EXACT_OWNED36_REQUIRED';end if;
 select oid into r from pg_roles where rolname='eps_job_trace_owner';
 if not exists(select 1 from pg_auth_members where roleid=r and member=16384 and grantor=16384 and not admin_option and inherit_option and set_option)
 or exists(select 1 from pg_auth_members where(roleid=r or member=r or grantor=r)and not(roleid=r and member=16384 and((grantor=16384 and not admin_option and inherit_option and set_option)or(grantor=(select oid from pg_roles where rolname='supabase_admin')and admin_option and not inherit_option and not set_option))))
 then raise exception'TRACE_PROFILE_EXACT_ROLE_MEMBERSHIP_REQUIRED';end if;
 ${snap} into v;if v is distinct from ${j(before)} then raise exception'TRACE_PROFILE_CURRENT_SNAPSHOT_REQUIRED';end if;
 perform set_config('eps.trace_profile.before',v::text,true);end$trace_profile$;
 grant all privileges on table eps.job_stage_attempts to postgres;
 do $trace_profile$declare v jsonb;b jsonb:=current_setting('eps.trace_profile.before')::jsonb;begin ${snap} into v;
 if v->>'table_acl' is distinct from ${q(SOURCE)} or(v-'table_acl')is distinct from(b-'table_acl')then raise exception'TRACE_PROFILE_ONLY_OWNER_ACL_MAY_CHANGE';end if;end$trace_profile$;`;
}
export function createTraceProfileContext(ctx,{contextFactory=createRecovery36Context}={}){
 admitNativeReceipt(ctx.sourceFiles.get(NATIVE_RECEIPT),ctx.sourceFiles);
 assert.equal(ctx.sourceFiles.get('development/m07/recovery36/runtime.mjs').toString('utf8').split('const englishSql='+JSON.stringify(ENGLISH_ROWS_SQL)+';').length,2,'TRACE_PROFILE_EXACT_ENGLISH_PORT_REQUIRED');
 const wrapped={...ctx,value:async(database,sql,...rest)=>{
  if(database!==ctx.restoreDb||sql!==ENGLISH_ROWS_SQL)return ctx.value(database,sql,...rest);
  const value=await ctx.value(database,"select jsonb_build_object('rows',("+ENGLISH_ROWS_SQL.slice(0,-1)+'));',...rest);
  assert(value&&typeof value==='object'&&!Array.isArray(value)&&Reflect.ownKeys(value).length===1,'TRACE_PROFILE_CLOSED_ENGLISH_ROWS_REQUIRED');
  const rows=Object.getOwnPropertyDescriptor(value,'rows');assert(rows&&rows.enumerable&&'value'in rows&&Array.isArray(rows.value),'TRACE_PROFILE_CLOSED_ENGLISH_ROWS_REQUIRED');return rows.value;
 },preserveOriginalDumpProfile:async(database,expected)=>{
  if(database!==ctx.restoreDb||ctx.report.checkpoint!=='populated36-metadata-dump-restore')return ctx.preserveOriginalDumpProfile(database,expected);
  const observed=await ctx.catalogue(database);
  if(expected[KEY]===observed[KEY])return ctx.preserveOriginalDumpProfile(database,expected);
  admitPair(expected,observed);const prior=JSON.parse(ctx.sourceFiles.get(NATIVE_RECEIPT));assert.equal(ctx.report.metadata36_catalogue_difference_count,13);assert.deepEqual(ctx.report.metadata36_catalogue_difference_keys,prior.metadata36_catalogue_difference_keys);
  const identity={database,marker:ctx.marker(database),oid:(await ctx.databaseIdentity(database)).oid};
  const before=await ctx.value(database,snapshotSql()+';');const versions=[...ctx.sourceFiles.keys()].filter(f=>/^supabase\/migrations\/[0-9]{14}_[^/]+\.sql$/u.test(f)).map(f=>f.split('/').at(-1).slice(0,14)).sort();
  await ctx.sql(database,correctionSql(identity,before,versions));
  const corrected=await ctx.catalogue(database);assert.deepEqual(corrected,{...observed,[KEY]:SOURCE},'TRACE_PROFILE_ONLY_EXPECTED_ACL_CHANGED');
  ctx.report.trace_profile_correction={native_receipt_sha256:NATIVE_SHA,corrected_key:KEY,exact_one_table_owner_acl:true,permissions_equivalent_by_actual_native_proof:true};
  const result=await ctx.preserveOriginalDumpProfile(database,expected);return{...result,corrected_known_fields:[...result.corrected_known_fields,KEY],trace_native_receipt_sha256:NATIVE_SHA};
 }};
 const inherited=contextFactory(wrapped);return{get active(){return inherited.active;},get catalogueSql(){return inherited.catalogueSql;},upgrade:inherited.upgrade,cleanupRoles:inherited.cleanupRoles,seedSql:inherited.seedSql,authBoundary:inherited.authBoundary,admitSourceFixtureCatalogue:inherited.admitSourceFixtureCatalogue,profileEvidence:inherited.profileEvidence,metadataRestore:inherited.metadataRestore};
}
