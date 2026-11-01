/** Inert on import; only a fresh reviewed owner controller invokes this hook. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {renderFeedback37Wire,verifyFeedback37Observation} from '../feedback-summary37-proof/runtime.mjs';
import {fullCatalogue33Sql} from '../recovery33/compiler.mjs';
import {dataSql36} from '../recovery36/runtime.mjs';
import {ownedIdentity33,ownedPredicate33} from '../recovery33/ownership.mjs';
import {validateSources,DRAFT,sha} from './controller.mjs';
export const MARKER='BATCH_FILTER_SQL_AUTHORITY_ASSERTIONS_PASSED_SYNTHETIC_ONLY';
export const ROLLBACK_MARKER='batch_filter_nested_rollback_verified';
const q=v=>"'"+String(v).replaceAll("'","''")+"'";
const text=(s,f)=>{assert(s.get(f)instanceof Uint8Array);return s.get(f).toString('utf8');};
export function candidateBody(original){
 assert.equal(original.split('\nbegin;\n').length,2);assert(original.endsWith('\ncommit;\n'));
 const body=original.replace('\nbegin;\n','\n').slice(0,-'commit;\n'.length);
 assert(!/^\s*(?:begin|commit|rollback)\s*;/imu.test(body),'BATCH_PROOF_TRANSACTION_ESCAPE');return body;
}
export function authorityGuard(identity){return `do $batch_owned$begin if current_user<>'postgres'or ${ownedPredicate33(identity)}
 or not exists(select 1 from pg_roles where oid=16384 and rolname=current_user)
 or session_user<>'supabase_admin'or not exists(select 1 from pg_roles where oid=10 and rolname=session_user and rolsuper)
 or not pg_has_role('postgres','authenticated','SET')or not pg_has_role('postgres','anon','SET')
 or(pg_control_system()).system_identifier::text<>'7701520506262638626'
 then raise exception'BATCH_PROOF_EXACT_LOCAL_ADMIN_SOURCE_REQUIRED';end if;end$batch_owned$;`;}
export function captureStateSql(base,identity,phase){
 assert(['before','after'].includes(phase));assert.equal(ownedIdentity33(identity).kind,'source');
 const catalogue=fullCatalogue33Sql(base).sql.trim();assert(catalogue.endsWith(';'));
 const rows=dataSql36(),tail="select current_setting('eps.recovery36.rows')::jsonb;";assert(rows.endsWith(tail));
 const absent=`to_regprocedure('public.eps_list_jobs_by_batch(uuid,text,uuid,integer,uuid)')is null
 and to_regprocedure('pg_temp.jbf_id(text,integer)')is null and to_regprocedure('pg_temp.jbf_assert(boolean,text)')is null
 and to_regprocedure('pg_temp.jbf_error(text,text)')is null and to_regprocedure('pg_temp.jbf_actor(uuid)')is null and to_regprocedure('pg_temp.jbf_ids(jsonb)')is null
 and not exists(select 1 from auth.users where id::text like'b8380001-%')
 and not exists(select 1 from public.projects where id::text like'b8380002-%')
 and not exists(select 1 from eps.workspaces where id::text like'b8380003-%')
 and not exists(select 1 from eps.jobs where id::text like'b8380006-%')
 and not exists(select 1 from auth.oauth_clients where id='b8380010-0000-4000-8000-000000000001')
 and not exists(select 1 from auth.sessions where id='b8380011-0000-4000-8000-000000000001')
 and not exists(select 1 from eps.mcp_oauth_resources where resource='https://batch-proof.example.invalid/mcp')`;
 return `${authorityGuard(identity)}
 ${rows.slice(0,-tail.length)}
 do $batch_state$declare s jsonb;begin
 select jsonb_build_object('catalogue',(select catalog from(${catalogue.slice(0,-1)})catalogue37),
 'data',current_setting('eps.recovery36.rows')::jsonb,'history',(select jsonb_agg(version order by version)from supabase_migrations.schema_migrations),
 'identity',jsonb_build_object('session',session_user,'current',current_user),
 'roles',(select jsonb_agg(jsonb_build_object('oid',oid::text,'name',rolname,'super',rolsuper,'inherit',rolinherit,'create_role',rolcreaterole,'create_db',rolcreatedb,'login',rolcanlogin,'replication',rolreplication,'bypass',rolbypassrls,'limit',rolconnlimit,'valid',rolvaliduntil)order by oid)from pg_roles),
 'memberships',(select jsonb_agg(jsonb_build_object('role',roleid::text,'member',member::text,'grantor',grantor::text,'admin',admin_option,'inherit',inherit_option,'set',set_option)order by roleid,member,grantor)from pg_auth_members))into s;
 if jsonb_array_length(s->'history')<>37 or s#>>'{history,36}'<>'20261101042702'or not(${absent})then raise exception'BATCH_PROOF_CLEAN37_REQUIRED';end if;
 ${phase==='before'?"perform set_config('eps.batch_filter_proof.before',s::text,true);":"if s is distinct from current_setting('eps.batch_filter_proof.before')::jsonb then raise exception'BATCH_PROOF_NESTED_STATE_CHANGED';end if;"}
 end$batch_state$;`;
}
export function delegationSql(){return `
-- Strictly synthetic claims/session SQL enforcement; no JWT signature/provider assertion.
set local role postgres;
do $batch_delegate$begin
 if exists(select 1 from auth.oauth_clients where id='b8380010-0000-4000-8000-000000000001')
 or exists(select 1 from auth.sessions where id='b8380011-0000-4000-8000-000000000001')
 or exists(select 1 from eps.jobs where id=pg_temp.jbf_id('b8380006',10))
 or exists(select 1 from eps.mcp_oauth_resources where resource='https://batch-proof.example.invalid/mcp')
 then raise exception'BATCH_PROOF_SYNTHETIC_DELEGATION_COLLISION';end if;end$batch_delegate$;
insert into eps.jobs(id,workspace_id,requested_by,kind,resource_id,batch_id,input,input_hash,input_hash_version,dedupe_key,status,stage,correlation_id)
 values(pg_temp.jbf_id('b8380006',10),pg_temp.jbf_id('b8380003',1),pg_temp.jbf_id('b8380001',7),'frame_extract',pg_temp.jbf_id('b8380008',10),pg_temp.jbf_id('b8380005',1),'{}',repeat('0',64),'eps.frame-input.pg-jsonb.v1',encode(sha256(convert_to('batch-proof-synthetic-own-frame-10','UTF8')),'hex'),'queued','extract_frames','batch-proof-synthetic-own-frame-10');
insert into auth.oauth_clients(id,client_name,redirect_uris,client_type,token_endpoint_auth_method,grant_types,response_types,registration_type)
 values('b8380010-0000-4000-8000-000000000001','Synthetic batch proof client','http://localhost:3118/callback','public','none',array['authorization_code','refresh_token'],array['code'],'manual');
insert into auth.sessions(id,user_id,oauth_client_id,not_after,scopes)
 values('b8380011-0000-4000-8000-000000000001',pg_temp.jbf_id('b8380001',7),'b8380010-0000-4000-8000-000000000001','2099-01-01T00:00:00Z','openid');
insert into eps.mcp_oauth_resources(resource,client_id,enabled)values('https://batch-proof.example.invalid/mcp','b8380010-0000-4000-8000-000000000001',true);
set local role authenticated;
select pg_temp.jbf_actor(pg_temp.jbf_id('b8380001',7));
select pg_temp.jbf_assert(public.eps_get_capabilities()->'capabilities'='["cast.read","operations.read","projects.read","workspaces.read"]'::jsonb,'synthetic actor has broad ordinary business grants');
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.jbf_id('b8380001',7),'role','authenticated','aud','https://batch-proof.example.invalid/mcp','is_anonymous',false,
 'session_id','b8380011-0000-4000-8000-000000000001','client_id','b8380010-0000-4000-8000-000000000001','scope','openid',
 'iat',floor(extract(epoch from clock_timestamp()))::bigint-5,'exp',floor(extract(epoch from clock_timestamp()))::bigint+300,
 'eps_delegation',jsonb_build_object('v',1,'resource','https://batch-proof.example.invalid/mcp','client_id','b8380010-0000-4000-8000-000000000001','capabilities',jsonb_build_array('cast.read')))::text,true);
select pg_temp.jbf_assert(public.eps_get_capabilities()->'capabilities'='["cast.read"]'::jsonb,'synthetic delegated claims narrow actual SQL capabilities');
select pg_temp.jbf_assert(pg_temp.jbf_ids(public.eps_list_jobs_by_batch(null,null,null,25,pg_temp.jbf_id('b8380005',1)))=jsonb_build_array(pg_temp.jbf_id('b8380006',10)),'delegated cast-only sees own frame despite broader business grants');
select pg_temp.jbf_assert(public.eps_get_job(pg_temp.jbf_id('b8380006',10))->>'id'=pg_temp.jbf_id('b8380006',10)::text,'delegated own-frame get succeeds');
select pg_temp.jbf_error('select public.eps_get_job(pg_temp.jbf_id(''b8380006'',1))','RESOURCE_NOT_FOUND');
select pg_temp.jbf_error('select public.eps_get_job(pg_temp.jbf_id(''b8380006'',7))','RESOURCE_NOT_FOUND');
savepoint batch_delegate_expiry;
set local role postgres;
update auth.sessions set not_after=clock_timestamp()-interval'1second'where id='b8380011-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.jbf_assert(public.eps_get_capabilities()->'capabilities'='[]'::jsonb,'synthetic expired session has no effective SQL capabilities');
select pg_temp.jbf_error('select public.eps_list_jobs_by_batch(null,null,null,25,pg_temp.jbf_id(''b8380005'',1))','CAPABILITY_REQUIRED');
select pg_temp.jbf_error('select public.eps_get_job(pg_temp.jbf_id(''b8380006'',10))','CAPABILITY_REQUIRED');
rollback to savepoint batch_delegate_expiry;release savepoint batch_delegate_expiry;
set local role postgres;`;}
export function renderBatchWire(sources,identity){
 const{base}=validateSources(sources),old=renderFeedback37Wire(base,identity),candidate=text(sources,DRAFT+'candidate.sql.txt'),fixture=text(sources,DRAFT+'fixture.sql');
 assert(!/^\s*(?:begin|commit|rollback)\s*;/imu.test(fixture));
 const seam="set local eps.feedback_summary37.proof='owned-local-rollback-v1';";assert.equal(old.body.split(seam).length,2);
 const nested=captureStateSql(base,identity,'before')+`\nsavepoint batch_filter_source_proof;
${authorityGuard(identity)}
-- The original authenticated local superuser was checked immediately above.
set local session authorization postgres;
set local eps.job_batch_filter.proof='owned-local-rollback-v1';
${candidateBody(candidate)}\n${fixture}\n${delegationSql()}
select '${MARKER}';
set local role postgres;rollback to savepoint batch_filter_source_proof;release savepoint batch_filter_source_proof;
${captureStateSql(base,identity,'after')}
select jsonb_build_object('${ROLLBACK_MARKER}',true,'history_count',37,'session_identity_restored',true,'full_catalogue_rows_roles_exact',true,'fixture_and_helpers_absent',true);
`;
 const body=old.body.replace(seam,()=>nested+seam);assert(!/^\s*(?:begin|commit|rollback)\s*;/imu.test(body),'BATCH_PROOF_TRANSACTION_ESCAPE');
 assert(body.indexOf("values('20261101042702')")<body.indexOf('savepoint batch_filter_source_proof'));
 return{...old,body,base_wire_sha256:sha(old.body),injected_wire_sha256:sha(body),candidate_sha256:sha(candidate),fixture_sha256:sha(fixture)};
}
export function verifyBatchObservation(stdout,rows,before,after){
 verifyFeedback37Observation(stdout,rows,before,after);
 assert.deepEqual(stdout.split(/\r?\n/u).filter(s=>/^BATCH_FILTER_[A-Z0-9_]+_SYNTHETIC_ONLY$/u.test(s)),[MARKER]);
 const observations=rows(stdout).filter(v=>Object.hasOwn(v,ROLLBACK_MARKER));
 assert.deepEqual(observations,[{[ROLLBACK_MARKER]:true,history_count:37,session_identity_restored:true,full_catalogue_rows_roles_exact:true,fixture_and_helpers_absent:true}]);
}
export function createBatchRuntime(io={readFile,writeFile}){return async ctx=>{
 const{sourceFiles,sourceDb,report}=ctx;validateSources(sourceFiles);
 const stable=async()=>{for(const[f,b]of sourceFiles)assert.equal(sha(await io.readFile(path.join(ctx.root,f))),sha(b),'BATCH_PROOF_SOURCE_CHANGED');};
 await stable();report.checkpoint='batch-filter-owned-nested-SQL-proof';
 const observed=await ctx.databaseIdentity(sourceDb),identity={database:sourceDb,marker:ctx.marker(sourceDb),oid:observed.oid};
 const wire=renderBatchWire(sourceFiles,identity),dataSql=text(sourceFiles,'development/m07/db/data29.sql');
 const data=()=>ctx.value(sourceDb,dataSql+"select current_setting('eps.m07_readback.old_data')::jsonb;");
 const history=()=>ctx.value(sourceDb,"select jsonb_build_object('versions',(select jsonb_agg(version order by version)from supabase_migrations.schema_migrations));");
 const before={catalogue:await ctx.catalogue(sourceDb),data:await data(),history:await history()};assert.equal(before.history.versions.length,33);assert.equal(before.history.versions.at(-1),'20261031130207');
 assert.equal(report.private_artifact_acl,process.platform==='win32'?'current-user-and-SYSTEM-only-verified':'mode0700');
 await io.writeFile(path.join(ctx.privateRoot,'batch-filter-owned-test-wire.sql'),wire.body,{flag:'wx',mode:0o600});
 await stable();const executed=await ctx.sql(sourceDb,wire.body);await stable();
 const after={catalogue:await ctx.catalogue(sourceDb),data:await data(),history:await history()};verifyBatchObservation(executed.stdout,ctx.rows,before,after);assert(isDeepStrictEqual(before,after));
 report.batch_filter_sql={result:'passed',injected_wire_sha256:wire.injected_wire_sha256,base_feedback37_wire_sha256:wire.base_wire_sha256,candidate_sha256:wire.candidate_sha256,fixture_sha256:wire.fixture_sha256,
 actual34_to37_functional_DDL:true,nested37_full_state_and_session_identity_restored:true,old37_fixture_executed:true,outer_rollback_to33:true,synthetic_delegated_claims_SQL_enforced:true,
 JWT_signature_verified:false,real_OAuth_session_or_revocation_tested:false,native_media_executed:false,HTTP_tested:false,MCP_tested:false,cloud_called:false,provider_called:false,hosted_acceptance:false,restore_acceptance:false};
};}
export const runBatchProof=createBatchRuntime();
