-- One absent-only grant, derived from the already verified Producer's real job.
-- Fixed reviewed migration versions are substituted only from the sealed manifest.
begin;
set local lock_timeout='3s';set local statement_timeout='15s';set local search_path='';set local timezone='UTC';
lock table public.app_capability_grants in share row exclusive mode;
do $complete_generation$
declare actor uuid;new_grants integer;locked_count integer;auth_count bigint;grant_count bigint;other_before text;other_after text;members_before text;members_after text;clients_before text;clients_after text;
 expected_versions text[]:=array[__REVIEWED_VERSIONS__]::text[];
begin
 if current_user<>'postgres' or current_database()<>'postgres'
 or not exists(select 1 from pg_roles where rolname=current_user and(rolsuper or rolbypassrls))
 or(select array_agg(version order by version)from supabase_migrations.schema_migrations)is distinct from expected_versions
 then raise exception'PRODUCER_GENERATION_TARGET_UNCONFIRMED';end if;
 select j.requested_by into strict actor from eps.jobs j join eps.workspaces w on w.id=j.workspace_id
 join public.projects p on p.id=w.project_id join eps.media_assets a on a.id=j.input_asset_id
 where j.id='9a5ddb61-6a9a-4157-b6be-8653cf2eadef' and j.kind='candidate_scan' and j.status='succeeded'
 and j.stage='apply_candidate' and j.workspace_id='e470aefd-e0f7-480c-bf0d-170cb2cb7069'
 and w.project_id='bd14d10f-b1c5-4d6a-8b4d-e5c48208433c' and w.archived_at is null and p.archived_at is null
 and j.input->>'workspace_id'=w.id::text and j.input->>'project_id'=p.id::text and j.input->>'target_candidate_id'is null
 and a.id='5f8a6d53-0da0-4064-aacf-aea6b9c47c81' and a.sha256='ffe461d30d48b32d90f1165627e2d104b6817f61d96a5a4bd9dcd6ff1964fc0a'
 and a.size_bytes=4316429 and a.status='ready';
 -- Use the same workspace-before-job order as processing callbacks.
 perform 1 from eps.workspaces where id='e470aefd-e0f7-480c-bf0d-170cb2cb7069'for share;
 perform 1 from eps.jobs where id='9a5ddb61-6a9a-4157-b6be-8653cf2eadef'for share;
 perform 1 from eps.media_assets where id='5f8a6d53-0da0-4064-aacf-aea6b9c47c81'for share;
 -- Hold all relevant identity/permission rows through this single insertion.
 perform 1 from auth.users where id=actor for share;
 perform 1 from public.clients where id='f4a9937c-f575-4975-bdea-fb83b85e48c3'for share;
 perform 1 from public.projects where id in('4b70c8ce-18bd-4a8c-b5a9-bc1156c06463','bd14d10f-b1c5-4d6a-8b4d-e5c48208433c')order by id for share;
 get diagnostics locked_count=row_count;if locked_count<>2 then raise exception'PRODUCER_GENERATION_EXISTING_AUTHORITY_REQUIRED';end if;
 perform 1 from public.project_memberships where principal_id=actor
  and project_id in('4b70c8ce-18bd-4a8c-b5a9-bc1156c06463','bd14d10f-b1c5-4d6a-8b4d-e5c48208433c')order by project_id for share;
 get diagnostics locked_count=row_count;if locked_count<>2 then raise exception'PRODUCER_GENERATION_EXISTING_AUTHORITY_REQUIRED';end if;
 -- These are fresh statements after every potentially blocking lock.
 if not exists(select 1 from eps.jobs j join eps.workspaces w on w.id=j.workspace_id join eps.media_assets a on a.id=j.input_asset_id
  where j.id='9a5ddb61-6a9a-4157-b6be-8653cf2eadef'and j.requested_by=actor and j.status='succeeded'and j.kind='candidate_scan'and j.stage='apply_candidate'
  and w.id='e470aefd-e0f7-480c-bf0d-170cb2cb7069'and w.project_id='bd14d10f-b1c5-4d6a-8b4d-e5c48208433c'and w.archived_at is null
  and j.input->>'workspace_id'=w.id::text and j.input->>'project_id'=w.project_id::text and j.input->>'target_candidate_id'is null
  and a.id='5f8a6d53-0da0-4064-aacf-aea6b9c47c81'and a.sha256='ffe461d30d48b32d90f1165627e2d104b6817f61d96a5a4bd9dcd6ff1964fc0a'and a.size_bytes=4316429 and a.status='ready')
 or not exists(select 1 from auth.users where id=actor and email_confirmed_at is not null and last_sign_in_at is not null
  and is_anonymous is false and deleted_at is null and(banned_until is null or banned_until<=clock_timestamp()))
 or not exists(select 1 from public.clients where id='f4a9937c-f575-4975-bdea-fb83b85e48c3'and archived_at is null)
 or(select count(*)from public.projects where id in('4b70c8ce-18bd-4a8c-b5a9-bc1156c06463','bd14d10f-b1c5-4d6a-8b4d-e5c48208433c')
  and archived_at is null and client_id='f4a9937c-f575-4975-bdea-fb83b85e48c3')<>2
 or(select count(*)from public.project_memberships where principal_id=actor and active and can_write
  and project_id in('4b70c8ce-18bd-4a8c-b5a9-bc1156c06463','bd14d10f-b1c5-4d6a-8b4d-e5c48208433c'))<>2
 or(select count(*)from public.app_capability_grants where principal_id=actor and active
  and capability in('projects.read','projects.write','workspaces.read','workspaces.write','cast.read','cast.upload','cast.write','cast.review'))<>8
 then raise exception'PRODUCER_GENERATION_EXISTING_AUTHORITY_REQUIRED';end if;
 if exists(select 1 from public.app_capability_grants where principal_id=actor and capability='presentations.generate')
 then raise exception'PRODUCER_GENERATION_EXISTING_GRANT_PRESERVED';end if;
 if(select array_agg(version order by version)from supabase_migrations.schema_migrations)is distinct from expected_versions
 then raise exception'PRODUCER_GENERATION_TARGET_UNCONFIRMED';end if;
 select count(*)into auth_count from auth.users;select count(*)into grant_count from public.app_capability_grants;
 select encode(sha256(convert_to(coalesce(string_agg(to_jsonb(g)::text,E'\n'order by to_jsonb(g)::text),''),'UTF8')),'hex')into other_before
  from public.app_capability_grants g where not(g.capability='presentations.generate'and g.principal_id=actor);
 select encode(sha256(convert_to(coalesce(string_agg(to_jsonb(m)::text,E'\n'order by to_jsonb(m)::text),''),'UTF8')),'hex')into members_before from public.project_memberships m;
 select encode(sha256(convert_to(coalesce(string_agg(to_jsonb(m)::text,E'\n'order by to_jsonb(m)::text),''),'UTF8')),'hex')into clients_before from public.client_memberships m;
 insert into public.app_capability_grants(principal_id,capability,active)values(actor,'presentations.generate',true);
 get diagnostics new_grants=row_count;
 select encode(sha256(convert_to(coalesce(string_agg(to_jsonb(g)::text,E'\n'order by to_jsonb(g)::text),''),'UTF8')),'hex')into other_after
  from public.app_capability_grants g where not(g.capability='presentations.generate'and g.principal_id=actor);
 select encode(sha256(convert_to(coalesce(string_agg(to_jsonb(m)::text,E'\n'order by to_jsonb(m)::text),''),'UTF8')),'hex')into members_after from public.project_memberships m;
 select encode(sha256(convert_to(coalesce(string_agg(to_jsonb(m)::text,E'\n'order by to_jsonb(m)::text),''),'UTF8')),'hex')into clients_after from public.client_memberships m;
 if new_grants<>1 or(select count(*)from auth.users)<>auth_count or(select count(*)from public.app_capability_grants)<>grant_count+1
 or other_before is distinct from other_after or members_before is distinct from members_after or clients_before is distinct from clients_after
 then raise exception'PRODUCER_GENERATION_PRESERVATION_UNCONFIRMED';end if;
 perform set_config('eps.producer_generation.result',jsonb_build_object('capability','presentations.generate','active',true,'inserted_grants',new_grants,
  'other_grants_preserved',true,'memberships_preserved',true,'auth_user_count_preserved',true,'auth_writes_requested',false,'inactive_grants_reactivated',false)::text,true);
end$complete_generation$;
select current_setting('eps.producer_generation.result')::jsonb as producer_generation;
commit;
