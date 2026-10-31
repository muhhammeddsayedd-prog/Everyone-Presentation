-- Coordinated migration31: private acknowledgement projection only.
-- Execute as one transaction through the fixed-target release controller.
-- No business rows, privileges, generic Job DTO or old migration is changed.
set local search_path='';
set local lock_timeout='5s';
set local statement_timeout='30s';
do $admission$
declare routine pg_catalog.pg_proc;
begin
 if current_database()<>'postgres' or current_user<>'postgres'
 or(select array_agg(version order by version)from supabase_migrations.schema_migrations)
  is distinct from array['20261028010943','20261028013324','20261028013655','20261028024205','20261028072515','20261028162702','20261028162800','20261028172320','20261028184145','20261028222030','20261029001520','20261029003941','20261029070038','20261029090500','20261029090724','20261029094600','20261029100500','20261029133455','20261029135318','20261029174841','20261029180953','20261029202629','20261029203953','20261029215218','20261030002634','20261030004643','20261030013832','20261030030717','20261030111549','20261030154824']::text[]
 then raise exception'M07_ACK31_EXACT_CANONICAL30_REQUIRED';end if;
 select * into strict routine from pg_catalog.pg_proc where oid='eps.specs_submit_ack(uuid,uuid,uuid)'::regprocedure;
 if routine.proowner::regrole::text<>'eps_specs_submit_owner'
 or routine.proacl::text is distinct from'{eps_specs_submit_owner=X/eps_specs_submit_owner}'
 or routine.prosecdef or routine.provolatile<>'v' or routine.prokind<>'f' or routine.proisstrict or routine.proleakproof or routine.proparallel<>'u'
 or routine.proconfig is distinct from array['search_path=""'] or routine.pronargs<>3 or routine.pronargdefaults<>0
 or routine.prorettype<>'jsonb'::regtype or routine.proretset or routine.procost<>100 or routine.prorows<>0 or routine.prosupport<>0
 or(select lanname from pg_catalog.pg_language where oid=routine.prolang)<>'plpgsql'
 or encode(sha256(convert_to(replace(routine.prosrc,E'\r\n',E'\n'),'UTF8')),'hex')<>'3a164335af33462b20dff3e1dffdcd26bec1c57d39e9028ef999adbf29eb89a4'
 then raise exception'M07_ACK31_EXACT_PRIVATE_PREDECESSOR_REQUIRED';end if;
end $admission$;

create or replace function eps.specs_submit_ack(p_job uuid,p_spec uuid,p_workspace uuid) returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare job_row record; begin
 select j.id,j.kind,j.resource_id,j.status,s.workspace_id into job_row
 from eps.jobs j join eps.specs s on s.id=j.resource_id and s.workspace_id=j.workspace_id where j.id=p_job;
 if not found or job_row.id is distinct from p_job or job_row.workspace_id is distinct from p_workspace
  or job_row.resource_id is distinct from p_spec or job_row.kind is distinct from 'specs_extract'
  or job_row.status is null or job_row.status not in('queued','running','waiting_for_input','succeeded','failed','cancelled')
 then perform eps.fail('SPECS_STATE_INVALID','The source processing job could not be confirmed.',409); end if;
 return jsonb_build_object('job_id',p_job,'resource_id',p_spec,'poll_url','/api/v1/jobs/'||p_job::text,'status',job_row.status);
end $$;

do $preserved$
declare routine pg_catalog.pg_proc;
begin
 select * into strict routine from pg_catalog.pg_proc where oid='eps.specs_submit_ack(uuid,uuid,uuid)'::regprocedure;
 if routine.proowner::regrole::text<>'eps_specs_submit_owner'
 or routine.proacl::text is distinct from'{eps_specs_submit_owner=X/eps_specs_submit_owner}'
 or routine.prosecdef or routine.provolatile<>'v' or routine.prokind<>'f' or routine.proisstrict or routine.proleakproof or routine.proparallel<>'u'
 or routine.proconfig is distinct from array['search_path=""'] or routine.pronargs<>3 or routine.pronargdefaults<>0
 or routine.prorettype<>'jsonb'::regtype or routine.proretset or routine.procost<>100 or routine.prorows<>0 or routine.prosupport<>0
 or(select lanname from pg_catalog.pg_language where oid=routine.prolang)<>'plpgsql'
 or encode(sha256(convert_to(replace(routine.prosrc,E'\r\n',E'\n'),'UTF8')),'hex')<>'e0a7c7be311e6b2139faf08238121f4687d379844a26dd602ff8331b54231481'
 then raise exception'M07_ACK31_PROJECTION_OR_METADATA_NOT_PRESERVED';end if;
end $preserved$;
