-- Complete the one absent Settings capability for the previously owner-designated
-- verified Producer. This is not identity enrollment or a repeat bootstrap.
begin;
set local lock_timeout='3s';set local statement_timeout='15s';set local search_path='';
set local timezone='UTC';
do $$declare before_digest text;after_digest text;inserted integer;principal constant uuid:='0a79a703-caba-47e5-93d4-42e32197037a';
 expected constant text[]:=array['20261028010943','20261028013324','20261028013655','20261028024205','20261028072515','20261028162702','20261028162800','20261028172320','20261028184145','20261028222030','20261029001520','20261029003941','20261029070038','20261029090500','20261029090724','20261029094600','20261029100500','20261029133455','20261029135318','20261029174841','20261029180953','20261029202629','20261029203953','20261029215218','20261030002634','20261030004643','20261030013832','20261030030717','20261030111549']::text[];
begin
 if current_database()<>'postgres'or current_user<>'postgres'
 or(select array_agg(version order by version)from supabase_migrations.schema_migrations)is distinct from expected
 then raise exception 'SETTINGS_COMPLETION_TARGET_MISMATCH';end if;
 perform pg_advisory_xact_lock(hashtextextended('eps:m07-settings-capability-completion',0));
 lock table supabase_migrations.schema_migrations in share mode;
 lock table public.app_capability_grants in share row exclusive mode;
 if(select array_agg(version order by version)from supabase_migrations.schema_migrations)is distinct from expected
 then raise exception 'SETTINGS_COMPLETION_HISTORY_CHANGED';end if;
 perform id from auth.users where id=principal and lower(email)='mohamed.abdelrahman@everyone.film'
 and email_confirmed_at is not null and last_sign_in_at is not null and not is_anonymous
 and deleted_at is null and(banned_until is null or banned_until<=clock_timestamp())for share;
 if not found or(select count(*)from auth.users where lower(email)='mohamed.abdelrahman@everyone.film')<>1
 then raise exception 'SETTINGS_COMPLETION_VERIFIED_IDENTITY_REQUIRED';end if;
 if exists(select 1 from public.app_capability_grants where principal_id=principal and capability='settings.manage')
 then raise exception 'SETTINGS_COMPLETION_EXISTING_GRANT_PRESERVED';end if;
 select md5(coalesce(jsonb_agg(to_jsonb(g)order by principal_id,capability)::text,''))into before_digest
 from public.app_capability_grants g;
 if before_digest<>'03b41b63fee4fbc6874e52813538af2e'
 or not exists(select 1 from public.app_capability_grants where principal_id=principal and capability='cast.review'and active)
 then raise exception 'SETTINGS_COMPLETION_BASELINE_CHANGED';end if;
 perform project_id from public.project_memberships where principal_id=principal and project_id='4b70c8ce-18bd-4a8c-b5a9-bc1156c06463'and active and can_write for share;
 if not found then raise exception 'SETTINGS_COMPLETION_MEMBERSHIP_REQUIRED';end if;
 -- All potentially blocking locks are now held. Keep eligibility time-sensitive.
 if not exists(select 1 from auth.users where id=principal and email_confirmed_at is not null and last_sign_in_at is not null and not is_anonymous and deleted_at is null and(banned_until is null or banned_until<=clock_timestamp()))
 then raise exception 'SETTINGS_COMPLETION_IDENTITY_CHANGED';end if;
 insert into public.app_capability_grants(principal_id,capability,active)values(principal,'settings.manage',true);
 get diagnostics inserted=row_count;
 if inserted<>1 or not exists(select 1 from public.app_capability_grants where principal_id=principal and capability='settings.manage'and active)
 then raise exception 'SETTINGS_COMPLETION_INSERT_UNCONFIRMED';end if;
 select md5(coalesce(jsonb_agg(to_jsonb(g)order by principal_id,capability)::text,''))into after_digest
 from public.app_capability_grants g where not(principal_id=principal and capability='settings.manage');
 if after_digest<>before_digest then raise exception 'SETTINGS_COMPLETION_OTHER_GRANTS_CHANGED';end if;
 perform set_config('eps.settings_completion_result',jsonb_build_object('principal_id',principal,'capability','settings.manage','inserted_rows',inserted,'existing_grants_preserved',true,'auth_users_created',0,'revoked_grants_reactivated',0,'operator',current_user)::text,true);
end$$;
select current_setting('eps.settings_completion_result')::jsonb as completion;
commit;
