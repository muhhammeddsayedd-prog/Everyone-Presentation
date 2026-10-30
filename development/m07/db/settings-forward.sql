-- M07 additive LOCAL development candidate on exact history28. Not promoted.
set local search_path='';set local lock_timeout='5s';set local statement_timeout='45s';
do $$begin
 if current_user<>'postgres' or current_setting('eps.m07_candidate_tests',true)is distinct from'owned-local29'
 or current_database()!~'^eps_m07_settings_[a-f0-9]{32}$'
 or(select count(*)from supabase_migrations.schema_migrations)<>28
 or(select max(version)from supabase_migrations.schema_migrations)<>'20261030030717'
 or to_regclass('eps.app_settings')is not null or exists(select 1 from pg_roles where rolname='eps_settings_owner')
 then raise exception'M07_SETTINGS_EXACT_OWNED_LOCAL28_REQUIRED';end if;
end$$;
create role eps_settings_owner nologin noinherit nosuperuser nocreatedb nocreaterole nobypassrls;
grant eps_settings_owner to postgres;
grant authenticated to eps_settings_owner with inherit true,set false,admin false;
grant usage on schema eps,public to eps_settings_owner;
create table eps.app_settings(
 singleton boolean primary key default true check(singleton),
 resource_id uuid not null unique default gen_random_uuid(),
 template_key text not null default'everyone-casting'check(template_key='everyone-casting'),
 template_version text not null default'1.1.0',
 default_timezone text not null default'Africa/Cairo'check(length(default_timezone)between 1 and 100),
 default_review_expiry_days integer not null default 30 check(default_review_expiry_days=30),
 row_version bigint not null default 1 check(row_version between 1 and 9007199254740991),
 updated_at timestamptz not null default clock_timestamp(),
 foreign key(template_key,template_version)references eps.presentation_templates(key,version)on delete restrict
);
alter table eps.app_settings enable row level security;alter table eps.app_settings force row level security;
revoke all on eps.app_settings from public,anon,authenticated,service_role;
insert into eps.app_settings(singleton)values(true);
grant select on eps.app_settings to eps_settings_owner,eps_review_owner;
grant update(template_version,default_timezone,row_version,updated_at)on eps.app_settings to eps_settings_owner;
grant select(key,version,registered)on eps.presentation_templates to eps_settings_owner;
grant select(id,model_version)on eps.specs_pipeline_config to eps_settings_owner;
grant select(id,transcription_model,extraction_model)on eps.candidate_asset_config to eps_settings_owner;
grant select(id,model)on eps.review_processing_config to eps_settings_owner;
grant select,insert on eps.idempotency_records to eps_settings_owner;
grant insert on eps.audit_events to eps_settings_owner;
grant execute on function eps.fail(text,text,integer,bigint),eps.require_capability(text),eps.has_capability(text),eps.check_input(jsonb,text[]),eps.expected_version(jsonb,text),eps.idempotency_begin(text,text,jsonb),eps.finish_mutation(text,text,jsonb,jsonb,uuid)to eps_settings_owner;
create policy settings_read on eps.app_settings for select to eps_settings_owner using(eps.has_capability('settings.manage'));
create policy settings_update on eps.app_settings for update to eps_settings_owner using(eps.has_capability('settings.manage'))with check(eps.has_capability('settings.manage'));
create policy settings_future_template on eps.app_settings for select to eps_review_owner using(eps.has_capability('presentations.generate')or eps.has_capability('workspaces.read'));
create policy settings_registered_templates on eps.presentation_templates for select to eps_settings_owner using(registered and eps.has_capability('settings.manage'));
create policy settings_specs_model on eps.specs_pipeline_config for select to eps_settings_owner using(id=1 and eps.has_capability('settings.manage'));
create policy settings_candidate_models on eps.candidate_asset_config for select to eps_settings_owner using(id and eps.has_capability('settings.manage'));
create policy settings_wording_model on eps.review_processing_config for select to eps_settings_owner using(id and eps.has_capability('settings.manage'));
create policy settings_idempotency on eps.idempotency_records for all to eps_settings_owner using(principal_id=auth.uid()and operation='settings.update_settings')with check(principal_id=auth.uid()and operation='settings.update_settings');
create policy settings_audit on eps.audit_events for insert to eps_settings_owner with check(principal_id=auth.uid()and action='settings.update_settings');
create policy eps_settings_no_storage on storage.objects as restrictive for all to eps_settings_owner using(false)with check(false);
create policy eps_settings_no_buckets on storage.buckets as restrictive for all to eps_settings_owner using(false)with check(false);

create function eps.settings_timezone_valid(p_value text)returns boolean language sql stable security invoker set search_path=''as $$
 select p_value is not null and length(p_value)between 1 and 100
 and(p_value='UTC'or p_value~'^[A-Za-z_+-]+(/[A-Za-z0-9_+.-]+)+$')and p_value!~'^(posix|right)/'
 and exists(select 1 from pg_catalog.pg_timezone_names where name=p_value)
$$;
create function eps.settings_dto()returns jsonb language sql stable security invoker set search_path=''as $$
 select jsonb_build_object('template_version',s.template_version,'default_timezone',s.default_timezone,
 'default_review_expiry_days',s.default_review_expiry_days,'row_version',s.row_version,
 'models',coalesce((select jsonb_object_agg(name,model)from(
   select'specs'::text name,model_version model from eps.specs_pipeline_config where id=1
   union all select'transcription',transcription_model from eps.candidate_asset_config where id
   union all select'candidate_extraction',extraction_model from eps.candidate_asset_config where id
   union all select'slide_wording',model from eps.review_processing_config where id
 )v where model~'^[A-Za-z0-9._-]{1,200}$'),'{}'::jsonb))from eps.app_settings s where singleton
$$;
create function public.eps_get_settings()returns jsonb language plpgsql stable security definer set search_path=''as $$declare result jsonb;begin
 perform eps.require_capability('settings.manage');result:=eps.settings_dto();
 if result is null then perform eps.fail('DEPENDENCY_UNAVAILABLE','Central app settings are unavailable.',503);end if;return result;
end$$;
create function public.eps_update_settings(p_input jsonb,p_idempotency_key text)returns jsonb language plpgsql volatile security definer set search_path=''as $$
declare item eps.app_settings;cached jsonb;expected bigint;next_timezone text;next_template text;begin
 perform eps.require_capability('settings.manage');perform eps.check_input(p_input,array['row_version','default_timezone','template_version']);
 expected:=eps.expected_version(p_input);
 if p_idempotency_key is null or length(p_idempotency_key)not between 16 and 200 or p_idempotency_key~'[[:cntrl:]]'then perform eps.fail('IDEMPOTENCY_KEY_REQUIRED','Provide a bounded stable Idempotency-Key.',400);end if;
 -- The generic helper obtains the per-principal/key advisory lock. Recheck live
 -- permission after that wait before returning any previously saved response.
 cached:=eps.idempotency_begin('settings.update_settings',p_idempotency_key,p_input);
 perform eps.require_capability('settings.manage');if cached is not null then return cached;end if;
 select * into item from eps.app_settings where singleton for update;
 perform eps.require_capability('settings.manage');
 if not found or item.singleton is null then perform eps.fail('DEPENDENCY_UNAVAILABLE','Central app settings are unavailable.',503);end if;
 if item.row_version<>expected then perform eps.fail('STALE_RESOURCE_VERSION','Settings changed. Reload before saving.',409,item.row_version);end if;
 next_timezone:=item.default_timezone;next_template:=item.template_version;
 if p_input?'default_timezone'then
  if jsonb_typeof(p_input->'default_timezone')is distinct from'string'or not eps.settings_timezone_valid(p_input->>'default_timezone')then perform eps.fail('INVALID_REQUEST','Select an IANA timezone.',400);end if;
  next_timezone:=p_input->>'default_timezone';
 end if;
 if p_input?'template_version'then
  if jsonb_typeof(p_input->'template_version')is distinct from'string'or p_input->>'template_version'<>'1.1.0'
  or not exists(select 1 from eps.presentation_templates where key=item.template_key and version=p_input->>'template_version'and registered)
  then perform eps.fail('INVALID_REQUEST','Select an approved template supported by the current renderer.',400);end if;
  next_template:=p_input->>'template_version';
 end if;
 if item.row_version=9007199254740991 then perform eps.fail('INVALID_TRANSITION','Settings reached their revision limit.',409);end if;
 update eps.app_settings set default_timezone=next_timezone,template_version=next_template,row_version=row_version+1,updated_at=clock_timestamp()where singleton;
 return eps.finish_mutation('settings.update_settings',p_idempotency_key,p_input,eps.settings_dto(),item.resource_id);
end$$;
grant create on schema eps,public to eps_settings_owner;
alter function eps.settings_timezone_valid(text)owner to eps_settings_owner;
alter function eps.settings_dto()owner to eps_settings_owner;
alter function public.eps_get_settings()owner to eps_settings_owner;
alter function public.eps_update_settings(jsonb,text)owner to eps_settings_owner;
revoke create on schema eps,public from eps_settings_owner;
revoke all on function eps.settings_timezone_valid(text),eps.settings_dto(),public.eps_get_settings(),public.eps_update_settings(jsonb,text)from public,anon,authenticated,service_role;
grant execute on function public.eps_get_settings(),public.eps_update_settings(jsonb,text)to authenticated;

-- Read defaults only when creating a future series. Existing retained series,
-- Ready versions, manifests, PDFs and links are deliberately never rewritten.
do $forward$declare source text;definition text;replacement text;needle text:='version=''1.1.0''and registered;';begin
 select replace(prosrc,E'\r\n',E'\n'),replace(pg_get_functiondef(oid),E'\r\n',E'\n')into source,definition from pg_proc where oid='public.eps_create_presentation_series(jsonb,text)'::regprocedure;
 if encode(sha256(convert_to(source,'UTF8')),'hex')<>'30fa983b81ad5ec624f55c3e46eae59f0157179290b91377d049644a1f685f37'
 or(length(source)-length(replace(source,needle,'')))/length(needle)<>1 then raise exception'M07_SERIES_SOURCE28_REQUIRED';end if;
 replacement:=replace(source,needle,'version=(select template_version from eps.app_settings where singleton)and registered;');
 if replacement=source then raise exception'M07_FUTURE_TEMPLATE_CHANGE_MISSING';end if;execute replace(definition,source,replacement);
end$forward$;
