-- Exact owner authorization: "Dummy Pilot Test" under existing "Dummy Client".
-- A rendered, closed actual before-observation is mandatory. No placeholder UUID.
-- Only one project and one owner membership; no client/Auth/capability/casting/
-- workspace/queue changes, reactivation, DDL, migrations, reset or seed.
begin;
set local search_path='';set local timezone='UTC';set local lock_timeout='3s';set local statement_timeout='30s';
lock table supabase_migrations.schema_migrations in share mode;
lock table public.projects,public.project_memberships in share row exclusive mode;
lock table public.clients,public.client_memberships,public.app_capability_grants,
 eps.app_settings,eps.workspaces,eps.roles,eps.slots,eps.assignments,eps.candidates,
 eps.candidate_media,eps.candidate_media_frames,eps.workspace_candidates,eps.candidate_support,
 eps.frame_extraction_requests,eps.media_assets,eps.specs,eps.presentation_versions,
 eps.version_slides,eps.presentation_version_assets in share mode;
do $dummy_create$
declare expected constant jsonb:='__EXPECTED_BASELINE__'::jsonb;
 client_uuid uuid;template_uuid uuid;target_uuid uuid;created_uuid uuid;
 observation jsonb;before_state jsonb;inserted_projects integer;inserted_memberships integer;pass integer;
begin
 if current_user<>'postgres'or current_database()<>'postgres'
 or(select array_agg(version order by version)from supabase_migrations.schema_migrations)is distinct from array['20261028010943','20261028013324','20261028013655','20261028024205','20261028072515','20261028162702','20261028162800','20261028172320','20261028184145','20261028222030','20261029001520','20261029003941','20261029070038','20261029090500','20261029090724','20261029094600','20261029100500','20261029133455','20261029135318','20261029174841','20261029180953','20261029202629','20261029203953','20261029215218','20261030002634','20261030004643','20261030013832','20261030030717','20261030111549','20261030154824']::text[]
 or exists(select 1 from pg_trigger where tgrelid in('public.projects'::regclass,'public.project_memberships'::regclass)and not tgisinternal and(tgtype&4)<>0)
 or exists(select 1 from pg_rewrite where ev_class in('public.projects'::regclass,'public.project_memberships'::regclass)and rulename<>'_RETURN')
 then raise exception'DUMMY_PROJECT_EXACT_CANONICAL30_INSERT_SURFACE_REQUIRED';end if;
 -- A current existing verified actor is locked, never enrolled or modified.
 perform id from auth.users where id='0a79a703-caba-47e5-93d4-42e32197037a'and email_confirmed_at is not null
  and last_sign_in_at is not null and not is_anonymous and deleted_at is null and(banned_until is null or banned_until<=clock_timestamp())for share;
 if not found then raise exception'DUMMY_PROJECT_EXISTING_ACTOR_REQUIRED';end if;
 perform id from eps.jobs where id='b3f90268-147d-41d4-8875-2a6435df1496'for share;
 if not found then raise exception'DUMMY_PROJECT_PROTECTED_M02_REQUIRED';end if;
 for pass in 1..2 loop
  __OBSERVATION_SQL__
  if pass=1 then
   if observation is distinct from expected or observation->'target_matches' is distinct from'0'::jsonb
   or observation->'client_matches' is distinct from'1'::jsonb or observation->'template_matches' is distinct from'1'::jsonb
   or observation->'actor_eligible' is distinct from'true'::jsonb
   or observation#>'{template_membership,active}'is distinct from'true'::jsonb
   or observation#>'{template_membership,can_write}'is distinct from'true'::jsonb
   or observation#>'{protected_metadata,protected_m02,manual_note_retained}'is distinct from'true'::jsonb
   then raise exception'DUMMY_PROJECT_EXACT_ABSENT_BASELINE_REQUIRED';end if;
   before_state:=observation;
   created_uuid:=pg_catalog.gen_random_uuid();
   insert into public.projects(id,client_id,name,archived_at,row_version)
    values(created_uuid,client_uuid,'Dummy Pilot Test',null,1);
   get diagnostics inserted_projects=row_count;
   insert into public.project_memberships(project_id,principal_id,can_write,active)
    select created_uuid,principal_id,can_write,active from public.project_memberships
    where project_id=template_uuid and principal_id='0a79a703-caba-47e5-93d4-42e32197037a'and active and can_write;
   get diagnostics inserted_memberships=row_count;
   if inserted_projects<>1 or inserted_memberships<>1 then raise exception'DUMMY_PROJECT_EXACT_TWO_INSERTS_REQUIRED';end if;
  else
   if observation->'target_matches'is distinct from'1'::jsonb or target_uuid is distinct from created_uuid
   or observation->'target'is distinct from jsonb_build_object('id',created_uuid,'client_id',client_uuid,'name','Dummy Pilot Test','archived',false,'row_version',1)
   or observation->'target_memberships'is distinct from jsonb_build_array(jsonb_build_object('project_id',created_uuid,'principal_id','0a79a703-caba-47e5-93d4-42e32197037a','active',true,'can_write',true))
   or observation->'target_workspace_count'is distinct from'0'::jsonb
   or observation-'{target_matches,target,target_memberships}'::text[] is distinct from before_state-'{target_matches,target,target_memberships}'::text[]
   then raise exception'DUMMY_PROJECT_PRESERVATION_OR_INSERT_MISMATCH';end if;
  end if;
 end loop;
 perform set_config('eps.dummy_project_create',jsonb_build_object('inserted_projects',inserted_projects,
  'inserted_memberships',inserted_memberships,'protected_before_after_equal',true,'observation',observation)::text,true);
end$dummy_create$;
select current_setting('eps.dummy_project_create')::jsonb as dummy_project_create;
commit;
