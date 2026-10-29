-- Explicit owner request: create Dummy Reuse Test under the existing Dummy
-- Client and enable Producer's four Cast Library capabilities. No Auth creation,
-- revoked-grant reactivation, source/job edits, or synthetic cloud identity.
begin;
set local lock_timeout='3s'; set local statement_timeout='15s'; set local search_path='';
do $$
declare principal uuid; project_id_value uuid:='bd14d10f-b1c5-4d6a-8b4d-e5c48208433c'; principal_count bigint;
begin
 if current_user<>'postgres' or current_database()<>'postgres'
  or (select array_agg(version order by version) from supabase_migrations.schema_migrations) is distinct from
  array['20261028010943','20261028013324','20261028013655','20261028024205','20261028072515','20261028162702','20261028162800','20261028172320','20261028184145','20261028222030','20261029001520','20261029003941','20261029070038','20261029090500']::text[]
 then raise exception 'OWNER_ENROLLMENT_TARGET_MISMATCH'; end if;
 perform pg_advisory_xact_lock(hashtextextended('eps:m03-owner-enrollment',0));
 select count(*),(array_agg(id order by id))[1] into principal_count,principal from auth.users
  where lower(email)='mohamed.abdelrahman@everyone.film' and email_confirmed_at is not null and last_sign_in_at is not null
   and not is_anonymous and deleted_at is null and (banned_until is null or banned_until<=clock_timestamp());
 if principal_count<>1 or not exists(select 1 from public.project_memberships where project_id='4b70c8ce-18bd-4a8c-b5a9-bc1156c06463' and principal_id=principal and active and can_write)
  or not exists(select 1 from public.clients where id='f4a9937c-f575-4975-bdea-fb83b85e48c3' and name='Dummy Client' and archived_at is null)
 then raise exception 'OWNER_ENROLLMENT_EXISTING_VERIFIED_PRODUCER_REQUIRED'; end if;
 if exists(select 1 from public.app_capability_grants where principal_id=principal and capability in('cast.read','cast.upload','cast.write','cast.review') and not active)
  or exists(select 1 from public.project_memberships where project_id=project_id_value and principal_id=principal and (not active or not can_write))
 then raise exception 'OWNER_ENROLLMENT_REVOKED_ACCESS_PRESERVED'; end if;
 if exists(select 1 from public.projects where (id=project_id_value or name='Dummy Reuse Test') and
  (id<>project_id_value or name<>'Dummy Reuse Test' or client_id is distinct from 'f4a9937c-f575-4975-bdea-fb83b85e48c3'::uuid or archived_at is not null))
 then raise exception 'OWNER_ENROLLMENT_NAME_OR_ID_COLLISION'; end if;
 insert into public.projects(id,client_id,name) values(project_id_value,'f4a9937c-f575-4975-bdea-fb83b85e48c3','Dummy Reuse Test') on conflict(id) do nothing;
 insert into public.project_memberships(project_id,principal_id,can_write) values(project_id_value,principal,true) on conflict(project_id,principal_id) do nothing;
 insert into public.app_capability_grants(principal_id,capability)
  select principal,capability from unnest(array['cast.read','cast.upload','cast.write','cast.review']) capability on conflict(principal_id,capability) do nothing;
 perform set_config('eps.m03_enrollment_result',jsonb_build_object('project_id',project_id_value,'project_name','Dummy Reuse Test','client_reused',true,
  'verified_existing_identity',true,'cast_capabilities',4,'auth_users_created',0,'revoked_grants_reactivated',0)::text,true);
end $$;
select current_setting('eps.m03_enrollment_result')::jsonb as enrollment;
commit;
