-- Root-rendered read-only wrapper. Source fragment is pinned before rendering.
begin isolation level repeatable read read only;
set local search_path='';set local timezone='UTC';set local statement_timeout='30s';
do $dummy_read$
declare client_uuid uuid;template_uuid uuid;target_uuid uuid;observation jsonb;
begin
 if current_user<>'postgres'or current_database()<>'postgres' then raise exception'DUMMY_PROJECT_TARGET_MISMATCH';end if;
 __OBSERVATION_SQL__
 perform set_config('eps.dummy_project_readback',observation::text,true);
end$dummy_read$;
select current_setting('eps.dummy_project_readback')::jsonb as dummy_project_readback;
rollback;
