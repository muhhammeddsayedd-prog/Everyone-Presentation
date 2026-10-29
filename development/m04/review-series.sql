-- Additive M04 review/series candidate on exact reviewed21. Root owns promotion.
-- No provider calls, runtime login, secrets, seeds, resets or existing business edits.
set local search_path=''; set local lock_timeout='3s'; set local statement_timeout='30s';
do $$begin
 if current_user<>'postgres' or current_database()<>'postgres'
 or (select count(*)from supabase_migrations.schema_migrations)<>21
 or (select max(version)from supabase_migrations.schema_migrations)<>'20261029180953'
 or to_regclass('eps.presentation_series')is not null or exists(select 1 from pg_roles where rolname='eps_review_owner')
 then raise exception 'M04_REVIEW_EXACT_TWENTY_ONE_REQUIRED';end if;
end$$;
create role eps_review_owner nologin noinherit nosuperuser nocreatedb nocreaterole nobypassrls;
grant eps_review_owner to postgres;
grant authenticated to eps_review_owner with inherit true,set false,admin false;
grant usage on schema eps,public to eps_review_owner;
create table eps.presentation_templates(
 key text not null,version text not null,content_sha256 text not null check(content_sha256~'^[a-f0-9]{64}$'),
 font_key text not null,font_hashes jsonb not null check(jsonb_typeof(font_hashes)='object'),registered boolean not null default true,primary key(key,version)
);
insert into eps.presentation_templates(key,version,content_sha256,font_key,font_hashes)values
 ('everyone-casting','1.0.0','8cfc99e874b2810d782f0a447628039e52e48a337fe1ce5b6286799c56e90001','everyone-casting-fonts-v1','{"apps/web/public/fonts/IBMPlexSans-Regular.woff2":"ba711a3085ff9f27440b6b9c4550cfc47c97bf36591d5da958b975bb3add8c1a","apps/web/public/fonts/IBMPlexSans-Medium.woff2":"5660f8a658f8bb50dbc005232f885eadffd2bc1c235c4f6fbb63469d1f9cde6d","apps/web/public/fonts/IBMPlexSans-SemiBold.woff2":"f78048030eab62e860efa39a0df79e2e5581bf122eb95b9bc42c0b8a4988d205","apps/web/public/fonts/IBMPlexSansArabic-Regular.woff2":"74112e1b7bf2e2c547989a4e947a60cba6cd1f9156e0065670134636e717199d","apps/web/public/fonts/IBMPlexSansArabic-Medium.woff2":"c72f6986f50ded745d06e71e508096209c52a55a6b3a81029954e33c52ba1dd2","apps/web/public/fonts/IBMPlexSansArabic-SemiBold.woff2":"869b2acd0a9660607a2025f0fe1c640110bf23d33417509328f07722922b8063"}'::jsonb);
create table eps.presentation_series(
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references eps.workspaces(id)on delete restrict,
 output_type text not null check(output_type in('selection','shortlist')),
 audience_preset_id uuid not null references eps.audience_presets(id)on delete restrict,audience_snapshot jsonb not null check(jsonb_typeof(audience_snapshot)='object'),
 scope_fingerprint text not null check(scope_fingerprint~'^[a-f0-9]{64}$'),title text not null,
 template_key text not null,template_version text not null,template_content_sha256 text not null check(template_content_sha256~'^[a-f0-9]{64}$'),font_key text not null,
 next_version_number bigint not null default 1 check(next_version_number between 1 and 9007199254740991),
 latest_ready_version_id uuid,latest_ready_version_no bigint check(latest_ready_version_no between 1 and 9007199254740991),
 row_version bigint not null default 1 check(row_version between 1 and 9007199254740991),archived boolean not null default false,
 created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp(),
 foreign key(template_key,template_version)references eps.presentation_templates(key,version)on delete restrict,
 check((latest_ready_version_id is null)=(latest_ready_version_no is null))
);
create unique index presentation_series_active_scope on eps.presentation_series(workspace_id,output_type,scope_fingerprint)where not archived;
create index presentation_series_workspace_id on eps.presentation_series(workspace_id,id);
alter table eps.presentation_templates enable row level security;alter table eps.presentation_templates force row level security;
alter table eps.presentation_series enable row level security;alter table eps.presentation_series force row level security;
revoke all on eps.presentation_templates,eps.presentation_series from public,anon,authenticated,service_role;
grant select on eps.presentation_templates to eps_review_owner;
grant select,insert,update on eps.presentation_series to eps_review_owner;
grant select on eps.workspaces,eps.specs,eps.roles,eps.slots,eps.workspace_candidates,eps.candidates,eps.candidate_media,eps.candidate_media_frames,eps.media_assets,eps.audience_presets,eps.assignments to eps_review_owner;
grant update(id)on eps.workspaces to eps_review_owner;
grant select,insert on eps.idempotency_records to eps_review_owner;
grant insert on eps.audit_events to eps_review_owner;
grant execute on function eps.fail(text,text,integer,bigint),eps.has_capability(text),eps.require_capability(text),eps.project_scope(uuid,boolean),eps.idempotency_begin(text,text,jsonb),eps.casting_body(jsonb,text[]),eps.casting_version(jsonb),eps.casting_uuid(jsonb),eps.casting_text(jsonb),eps.casting_advance(bigint),eps.cast_fingerprint(jsonb,jsonb),eps.cast_canonical(jsonb)to eps_review_owner;
create function eps.review_scope(p_workspace uuid,p_write boolean default false)returns boolean language sql stable security invoker set search_path=''as $$
 select exists(select 1 from eps.workspaces w join public.projects p on p.id=w.project_id where w.id=p_workspace and w.archived_at is null and p.archived_at is null
 and eps.project_scope(p.id,p_write)and eps.has_capability(case when p_write then 'presentations.generate'else'workspaces.read'end))
$$;
create policy review_workspace_read on eps.workspaces for select to eps_review_owner using(archived_at is null and eps.project_scope(project_id,false)and(eps.has_capability('workspaces.read')or eps.has_capability('presentations.generate')));
create policy review_workspace_lock on eps.workspaces for update to eps_review_owner using(archived_at is null and eps.project_scope(project_id,true)and(eps.has_capability('presentations.generate')or eps.has_capability('workspaces.write')))with check(false);
create policy review_specs_read on eps.specs for select to eps_review_owner using(eps.review_scope(workspace_id));
create policy review_roles_read on eps.roles for select to eps_review_owner using(eps.review_scope(workspace_id));
create policy review_slots_read on eps.slots for select to eps_review_owner using(eps.review_scope(workspace_id));
create policy review_pool_read on eps.workspace_candidates for select to eps_review_owner using(eps.review_scope(workspace_id));
create policy review_assignments_read on eps.assignments for select to eps_review_owner using(eps.review_scope(workspace_id));
create policy review_candidates_read on eps.candidates for select to eps_review_owner using(eps.has_capability('cast.read'));
create policy review_candidate_media_read on eps.candidate_media for select to eps_review_owner using(eps.has_capability('cast.read'));
create policy review_candidate_frames_read on eps.candidate_media_frames for select to eps_review_owner using(eps.has_capability('cast.read'));
create policy review_assets_read on eps.media_assets for select to eps_review_owner using(
 (purpose='client_logo'and(origin_workspace_id is not null and eps.review_scope(origin_workspace_id)or client_id is not null and exists(select 1 from public.clients c where c.id=client_id)))
 or eps.has_capability('cast.read')and(purpose in('candidate_video','candidate_frame')and(exists(select 1 from eps.candidate_media m where m.source_asset_id=media_assets.id)or exists(select 1 from eps.candidate_media_frames f where f.asset_id=media_assets.id)))
);
create policy review_presets_read on eps.audience_presets for select to eps_review_owner using(eps.has_capability('workspaces.read')or eps.has_capability('presentations.generate'));
create policy review_templates_read on eps.presentation_templates for select to eps_review_owner using(registered and(eps.has_capability('workspaces.read')or eps.has_capability('presentations.generate')));
create policy review_series_read on eps.presentation_series for select to eps_review_owner using(eps.review_scope(workspace_id)or eps.review_scope(workspace_id,true));
create policy review_series_insert on eps.presentation_series for insert to eps_review_owner with check(eps.review_scope(workspace_id,true));
create policy review_series_update on eps.presentation_series for update to eps_review_owner using(eps.review_scope(workspace_id,true))with check(eps.review_scope(workspace_id,true));
create policy review_idempotency on eps.idempotency_records for all to eps_review_owner using(principal_id=auth.uid()and operation like'review.%')with check(principal_id=auth.uid()and operation like'review.%');
create policy review_audit on eps.audit_events for insert to eps_review_owner with check(principal_id=auth.uid()and action like'review.%');
create policy eps_review_no_storage on storage.objects as restrictive for all to eps_review_owner using(false)with check(false);
create policy eps_review_no_bucket on storage.buckets as restrictive for all to eps_review_owner using(false)with check(false);

create function eps.review_require(p_workspace uuid,p_write boolean default false)returns void language plpgsql stable security invoker set search_path=''as $$begin
 perform eps.require_capability(case when p_write then'presentations.generate'else'workspaces.read'end);
 if not eps.review_scope(p_workspace,p_write)then perform eps.fail('RESOURCE_NOT_FOUND','Presentation workspace not found.',404);end if;
end$$;
create function eps.review_body(p_input jsonb,p_keys text[],p_required text[]default'{}')returns void language plpgsql immutable security invoker set search_path=''as $$begin
 perform eps.casting_body(p_input,p_keys);if not p_input?&p_required then perform eps.fail('VALIDATION_FAILED','Required review fields are missing.',400);end if;
end$$;
create function eps.review_replay(p_operation text,p_key text,p_input jsonb)returns jsonb language plpgsql volatile security invoker set search_path=''as $$begin
 if p_key is null or length(p_key)not between 1 and 200 or p_key~'[[:cntrl:]]'then perform eps.fail('VALIDATION_FAILED','A bounded Idempotency-Key is required.',400);end if;
 return eps.idempotency_begin('review.'||p_operation,p_key,p_input);
end$$;
create function eps.review_remember(p_operation text,p_key text,p_input jsonb,p_result jsonb,p_resource uuid)returns jsonb language plpgsql volatile security invoker set search_path=''as $$begin
 insert into eps.idempotency_records(principal_id,operation,key,request_hash,response)values(auth.uid(),'review.'||p_operation,p_key,encode(sha256(convert_to(p_input::text,'UTF8')),'hex'),p_result);
 insert into eps.audit_events(principal_id,action,resource_id)values(auth.uid(),'review.'||p_operation,p_resource);return p_result;
end$$;
create function eps.review_template_dto(p_series eps.presentation_series)returns jsonb language sql immutable security invoker set search_path=''as $$
 select jsonb_build_object('key',p_series.template_key,'version',p_series.template_version,'content_sha256',p_series.template_content_sha256,'font_key',p_series.font_key)
$$;
create function eps.review_series_dto(p_series eps.presentation_series)returns jsonb language sql immutable security invoker set search_path=''as $$
 select jsonb_build_object('id',p_series.id,'workspace_id',p_series.workspace_id,'output_type',p_series.output_type,'audience_preset_id',p_series.audience_preset_id,'audience_snapshot',p_series.audience_snapshot,'title',p_series.title,
 'latest_ready_version_id',p_series.latest_ready_version_id,'latest_ready_version_no',p_series.latest_ready_version_no,'row_version',p_series.row_version,'archived',p_series.archived,
 'template_key',p_series.template_key,'template_version',p_series.template_version,'template_content_sha256',p_series.template_content_sha256,'font_key',p_series.font_key)
$$;
create function public.eps_create_presentation_series(p_input jsonb,p_idempotency_key text)returns jsonb language plpgsql volatile security definer set search_path=''as $$
declare workspace uuid;preset eps.audience_presets;template eps.presentation_templates;item eps.presentation_series;cached jsonb;snapshot jsonb;scope_hash text;begin
 perform eps.review_body(p_input,array['workspace_id','output_type','audience_preset_id','title'],array['workspace_id','output_type','audience_preset_id']);
 workspace:=eps.casting_uuid(p_input->'workspace_id');perform eps.review_require(workspace,true);
 if jsonb_typeof(p_input->'output_type')is distinct from'string'or p_input->>'output_type'not in('selection','shortlist')or p_input?'title'and(jsonb_typeof(p_input->'title')is distinct from'string'or length(btrim(p_input->>'title'))not between 1 and 500)then perform eps.fail('VALIDATION_FAILED','Invalid series context.',400);end if;
 cached:=eps.review_replay('create_series',p_idempotency_key,p_input);perform eps.review_require(workspace,true);if cached is not null then return cached;end if;
 perform 1 from eps.workspaces where id=workspace for update;perform eps.review_require(workspace,true);
 select * into preset from eps.audience_presets where id=eps.casting_uuid(p_input->'audience_preset_id') and not archived;
 if not found then perform eps.fail('RESOURCE_NOT_FOUND','Audience preset not found.',404);end if;
 select * into template from eps.presentation_templates where key='everyone-casting'and version='1.0.0'and registered;
 if not found then perform eps.fail('TEMPLATE_UNAVAILABLE','Registered presentation template unavailable.',503);end if;
 snapshot:=jsonb_build_object('id',preset.id,'key',preset.key,'label',preset.label,'scope',preset.scope,'settings',preset.settings,'archived',false,'row_version',preset.row_version);
 scope_hash:=encode(sha256(convert_to(jsonb_build_object('audience',snapshot,'template_key',template.key,'template_version',template.version,'template_sha256',template.content_sha256,'font_key',template.font_key)::text,'UTF8')),'hex');
 select * into item from eps.presentation_series where workspace_id=workspace and output_type=p_input->>'output_type'and scope_fingerprint=scope_hash and not archived;
 if not found then insert into eps.presentation_series(workspace_id,output_type,audience_preset_id,audience_snapshot,scope_fingerprint,title,template_key,template_version,template_content_sha256,font_key)
  values(workspace,p_input->>'output_type',preset.id,snapshot,scope_hash,coalesce(nullif(btrim(p_input->>'title'),''),case p_input->>'output_type'when'selection'then'Cast Selection'else'Cast Shortlist'end),template.key,template.version,template.content_sha256,template.font_key)returning * into item;end if;
 return eps.review_remember('create_series',p_idempotency_key,p_input,eps.review_series_dto(item),item.id);
end$$;
create function public.eps_get_presentation_series(p_series_id uuid)returns jsonb language plpgsql stable security definer set search_path=''as $$declare item eps.presentation_series;begin
 select * into item from eps.presentation_series where id=p_series_id;if not found then perform eps.fail('RESOURCE_NOT_FOUND','Presentation series not found.',404);end if;
 perform eps.review_require(item.workspace_id);return eps.review_series_dto(item);
end$$;
create function public.eps_update_presentation_series(p_series_id uuid,p_input jsonb,p_idempotency_key text)returns jsonb language plpgsql volatile security definer set search_path=''as $$
declare item eps.presentation_series;cached jsonb;input_value jsonb;expected bigint;begin
 perform eps.review_body(p_input,array['row_version','title','archived'],array['row_version']);expected:=eps.casting_version(p_input->'row_version');
 select * into item from eps.presentation_series where id=p_series_id;if not found then perform eps.fail('RESOURCE_NOT_FOUND','Presentation series not found.',404);end if;
 perform eps.review_require(item.workspace_id,true);input_value:=p_input||jsonb_build_object('series_id',p_series_id);
 cached:=eps.review_replay('update_series',p_idempotency_key,input_value);perform eps.review_require(item.workspace_id,true);if cached is not null then return cached;end if;
 perform 1 from eps.workspaces where id=item.workspace_id for update;perform eps.review_require(item.workspace_id,true);
 select * into item from eps.presentation_series where id=p_series_id for update;
 if item.row_version<>expected then perform eps.fail('STALE_RESOURCE_VERSION','Presentation series changed.',409,item.row_version);end if;
 if p_input?'title'and(jsonb_typeof(p_input->'title')<>'string'or length(btrim(p_input->>'title'))not between 1 and 500)or p_input?'archived'and jsonb_typeof(p_input->'archived')<>'boolean'then perform eps.fail('VALIDATION_FAILED','Invalid series changes.',400);end if;
 perform eps.casting_advance(item.row_version);
 update eps.presentation_series set title=case when p_input?'title'then btrim(p_input->>'title')else title end,archived=case when p_input?'archived'then(p_input->>'archived')::boolean else archived end,row_version=row_version+1,updated_at=clock_timestamp()where id=item.id returning * into item;
 return eps.review_remember('update_series',p_idempotency_key,input_value,eps.review_series_dto(item),item.id);
exception when unique_violation then perform eps.fail('SERIES_SCOPE_EXISTS','An active series already uses this context.',409);end$$;
create function public.eps_list_presentation_series(p_options jsonb default '{}')returns jsonb language plpgsql stable security definer set search_path=''as $$
declare workspace uuid;output_value text;maximum integer:=25;cursor_id uuid;cursor_scope text;scope_value text;items jsonb;last_id uuid;begin
 perform eps.require_capability('workspaces.read');perform eps.review_body(p_options,array['workspace_id','output_type','cursor','limit']);
 if p_options?'workspace_id'then workspace:=eps.casting_uuid(p_options->'workspace_id');perform eps.review_require(workspace);end if;
 output_value:=p_options->>'output_type';if p_options?'output_type'and(jsonb_typeof(p_options->'output_type')is distinct from'string'or output_value not in('selection','shortlist'))then perform eps.fail('VALIDATION_FAILED','Invalid output.',400);end if;
 if p_options?'limit'then if jsonb_typeof(p_options->'limit')is distinct from'number'or(p_options->>'limit')!~'^[1-9][0-9]{0,2}$'then perform eps.fail('VALIDATION_FAILED','Invalid page limit.',400);end if;maximum:=(p_options->>'limit')::integer;end if;if maximum not between 1 and 100 then perform eps.fail('VALIDATION_FAILED','Invalid page limit.',400);end if;
 scope_value:=coalesce(workspace::text,'*')||':'||coalesce(output_value,'*');
 if p_options?'cursor'then if jsonb_typeof(p_options->'cursor')is distinct from'string'or cardinality(string_to_array(p_options->>'cursor','|'))<>2 then perform eps.fail('VALIDATION_FAILED','Invalid series cursor.',400);end if;begin cursor_scope:=split_part(p_options->>'cursor','|',1);cursor_id:=split_part(p_options->>'cursor','|',2)::uuid;exception when others then perform eps.fail('VALIDATION_FAILED','Invalid series cursor.',400);end;
  if cursor_scope<>scope_value or length(p_options->>'cursor')>200 then perform eps.fail('VALIDATION_FAILED','Series cursor context changed.',400);end if;end if;
 select coalesce(jsonb_agg(eps.review_series_dto(s)order by s.id),'[]'),max(s.id::text)::uuid into items,last_id from(select * from eps.presentation_series where not archived and(workspace is null or workspace_id=workspace)and(output_value is null or output_type=output_value)and(cursor_id is null or id>cursor_id)and eps.review_scope(workspace_id)order by id limit maximum)s;
 return jsonb_build_object('data',items,'page',jsonb_build_object('next_cursor',case when last_id is not null and exists(select 1 from eps.presentation_series where not archived and(workspace is null or workspace_id=workspace)and(output_value is null or output_type=output_value)and id>last_id and eps.review_scope(workspace_id))then scope_value||'|'||last_id::text else null end));
end$$;
create function eps.review_fields(p_facts jsonb,p_availability text,p_notes text)returns jsonb language sql immutable security invoker set search_path=''as $$
 select jsonb_build_object('name_or_id',coalesce(nullif(btrim(p_facts->>'name'),''),nullif(btrim(p_facts->>'casting_id'),''),'Not provided'),
 'age_or_range',coalesce(nullif(btrim(p_facts->>'age_or_range'),''),'Not provided'),'height_measurements',coalesce(nullif(btrim(p_facts->>'height_measurements'),''),'Not provided'),
 'languages_accents',coalesce(nullif((select string_agg(value,'; 'order by ordinal)from jsonb_array_elements_text(coalesce(p_facts->'languages','[]')||coalesce(p_facts->'accents','[]'))with ordinality v(value,ordinal)),''),'Not provided'),
 'skills_experience',coalesce(nullif(btrim(p_facts->>'skills_experience'),''),'Not provided'),'city',coalesce(nullif(btrim(p_facts->>'city'),''),'Not provided'),
 'previous_projects_roles',coalesce(nullif(btrim(p_facts->>'previous_projects_roles'),''),'Not provided'),'classification',coalesce(nullif(btrim(p_facts->>'classification'),''),'Not provided'),
 'availability',coalesce(nullif(btrim(p_availability),''),'Not provided'),'presentation_notes',coalesce(nullif(btrim(p_notes),''),'Not provided'))
$$;
create function eps.review_issue(p_code text,p_severity text,p_entity uuid,p_field text,p_message text,p_repair text default null)returns jsonb language sql immutable security invoker set search_path=''as $$
 select jsonb_build_object('code',p_code,'severity',p_severity,'entity_id',p_entity,'field',p_field,'message',p_message,'repair_action',p_repair)
$$;
-- STABLE is intentional: every SQL read in this function uses one caller snapshot.
-- M05 must capture this exact source/projection in its generation transaction.
create function eps.review_snapshot_data(p_workspace uuid,p_series_id uuid,p_output text default null)returns jsonb language plpgsql stable security invoker set search_path=''as $$
declare workspace eps.workspaces;series eps.presentation_series;project public.projects;client public.clients;role_item eps.roles;slot_item eps.slots;assignment eps.assignments;pool eps.workspace_candidates;candidate eps.candidates;media eps.candidate_media;asset eps.media_assets;logo eps.media_assets;
 cover jsonb;slides jsonb:='[]';issues jsonb:='[]';inputs jsonb:='[]';frames jsonb;frame_input jsonb;source_fields jsonb;fields jsonb;slide jsonb;field_item record;frame_id uuid;candidate_count integer:=0;pending_count integer:=0;slot_assignments integer;reviewed boolean;fingerprint text;unreviewed uuid[]:='{}';blank_fields jsonb;role_inputs jsonb;slot_inputs jsonb;begin
 select * into workspace from eps.workspaces where id=p_workspace;
 select * into series from eps.presentation_series where id=p_series_id and workspace_id=p_workspace and not archived;
 if not found then perform eps.fail('RESOURCE_NOT_FOUND','Selected presentation series not found.',404);end if;
 if p_output is not null and p_output<>series.output_type then perform eps.fail('INVALID_RELATIONSHIP','Series output does not match review.',422);end if;
 if not exists(select 1 from eps.presentation_templates where key=series.template_key and version=series.template_version and content_sha256=series.template_content_sha256 and font_key=series.font_key and registered)then perform eps.fail('TEMPLATE_UNAVAILABLE','The exact series template is unavailable.',503);end if;
 select * into project from public.projects where id=workspace.project_id;
 if project.client_id is not null then select * into client from public.clients where id=project.client_id;if not found then perform eps.fail('RESOURCE_NOT_FOUND','Shared client is unavailable.',404);end if;end if;
 if workspace.logo_asset_id is not null then select * into logo from eps.media_assets where id=workspace.logo_asset_id;
  if not found or logo.status<>'ready'then issues:=issues||jsonb_build_array(eps.review_issue('LOGO_UNAVAILABLE','blocking',workspace.logo_asset_id,null,'The selected logo is unavailable.','Choose an available logo or remove it.'));end if;end if;
 cover:=jsonb_build_object('project_name',project.name,'client_name',client.name,'title',series.title,'output_type',series.output_type,'logo_asset_id',workspace.logo_asset_id,'logo_placement',workspace.logo_placement);
 blank_fields:=eps.review_fields('{}',null,null);
 for role_item in select * from eps.roles where workspace_id=p_workspace and archived_at is null order by sort_order,id loop
  for slot_item in select * from eps.slots where role_id=role_item.id and workspace_id=p_workspace and archived_at is null order by sort_order,id loop
   slot_assignments:=0;
   if slot_item.provisional then issues:=issues||jsonb_build_array(eps.review_issue('ROLE_NEEDS_CLARIFICATION','warning',role_item.id,'headcount','This role has an unconfirmed headcount.','Confirm the supplied headcount when available.'));end if;
   for assignment in select * from eps.assignments where workspace_id=p_workspace and slot_id=slot_item.id and archived_at is null and(series.output_type='selection'or shortlist_included)order by sort_order,id loop
    slot_assignments:=slot_assignments+1;candidate_count:=candidate_count+1;
    select * into pool from eps.workspace_candidates where id=assignment.workspace_candidate_id and workspace_id=p_workspace and archived_at is null;
    if not found then perform eps.fail('ASSIGNMENT_STATE_INVALID','An assigned project candidate is unavailable.',409);end if;
    select * into candidate from eps.candidates where id=pool.candidate_id;
    if not found then perform eps.fail('ASSIGNMENT_STATE_INVALID','An assigned shared profile is unavailable.',409);end if;
    reviewed:=candidate.reviewed_facts_fingerprint is not null and candidate.reviewed_facts_fingerprint=eps.cast_fingerprint(candidate.facts,candidate.field_sources);
    if not reviewed then if not candidate.id=any(unreviewed)then unreviewed:=array_append(unreviewed,candidate.id);end if;issues:=issues||jsonb_build_array(eps.review_issue('UNREVIEWED_PROFILE','warning',candidate.id,null,'Supplied profile facts are unreviewed.','Review the supplied facts if needed.'));end if;
    if candidate.archived_at is not null or candidate.merged_into_candidate_id is not null then issues:=issues||jsonb_build_array(eps.review_issue('PROFILE_ARCHIVED','warning',candidate.id,null,'This assignment uses a retained archived profile.','Inspect the current project choice.'));end if;
    source_fields:=eps.review_fields(candidate.facts,pool.availability,assignment.presentation_notes);fields:=source_fields||jsonb_strip_nulls(assignment.slide_wording);
    frames:='[]';frame_input:='[]';media:=null;asset:=null;
    if pool.selected_candidate_media_id is not null then
     select * into media from eps.candidate_media where id=pool.selected_candidate_media_id and candidate_id=candidate.id;
     if not found then issues:=issues||jsonb_build_array(eps.review_issue('MEDIA_UNAVAILABLE','blocking',pool.id,null,'Selected introduction no longer matches this profile.','Choose an available introduction.'));
     else select * into asset from eps.media_assets where id=media.source_asset_id;
      if not found or asset.status<>'ready'then issues:=issues||jsonb_build_array(eps.review_issue('MEDIA_UNAVAILABLE','blocking',pool.id,null,'Selected original video is unavailable.','Choose an available introduction.'));end if;
     end if;
    end if;
    foreach frame_id in array pool.selected_frame_asset_ids loop
     declare frame_asset eps.media_assets;begin
      select * into frame_asset from eps.media_assets f where f.id=frame_id and f.status='ready'and f.purpose='candidate_frame'and f.source_asset_id=media.source_asset_id and f.sha256 is not null and f.width>0 and f.height>0 and f.source_timestamp_ms>=0 and exists(select 1 from eps.candidate_media_frames link where link.candidate_media_id=media.id and link.asset_id=f.id);
      if not found then frame_input:=frame_input||jsonb_build_array(jsonb_build_object('asset_id',frame_id,'available',false));issues:=issues||jsonb_build_array(eps.review_issue('FRAME_UNAVAILABLE','blocking',frame_id,null,'A selected source frame is unavailable.','Choose an available frame or clear the selection.'));
      else frames:=frames||jsonb_build_array(jsonb_build_object('asset_id',frame_asset.id,'source_asset_id',frame_asset.source_asset_id,'timestamp_ms',frame_asset.source_timestamp_ms,'width',frame_asset.width,'height',frame_asset.height,'sha256',frame_asset.sha256));frame_input:=frame_input||jsonb_build_array(jsonb_build_object('asset_id',frame_asset.id,'sha256',frame_asset.sha256,'timestamp_ms',frame_asset.source_timestamp_ms,'width',frame_asset.width,'height',frame_asset.height));end if;
     end;
    end loop;
    if jsonb_array_length(frames)<3 then issues:=issues||jsonb_build_array(eps.review_issue('FEWER_FRAMES','warning',assignment.id,null,'Fewer than three source frames are selected.','Continue with the available frames or select more.'));end if;
    if media.id is null then issues:=issues||jsonb_build_array(eps.review_issue('NO_INTRODUCTION','warning',assignment.id,null,'No introduction is selected.','Continue without a video or select one.'));end if;
    for field_item in select * from jsonb_each_text(fields)loop
     if field_item.value='Not provided'then issues:=issues||jsonb_build_array(eps.review_issue('MISSING_FIELD','warning',assignment.id,field_item.key,'This field is not provided.','Keep Not provided or enter supplied information.'));end if;
    end loop;
    slide:=jsonb_build_object('kind','candidate','role_id',role_item.id,'role_name',role_item.name,'slot_id',slot_item.id,'slot_label',slot_item.label,'assignment_id',assignment.id,'workspace_candidate_id',pool.id,'candidate_id',candidate.id,'candidate_media_id',media.id,'assignment_row_version',assignment.row_version,'workspace_candidate_row_version',pool.row_version,'candidate_row_version',candidate.row_version,'position',assignment.position,'review_status',case when reviewed then'reviewed'else'unreviewed'end,'fields',fields,'source_fields',source_fields,'frames',frames,'video_asset_id',case when asset.status='ready'then asset.id else null end,'requirements',role_item.requirements,'provisional',slot_item.provisional);
    if candidate_count+pending_count+1>1000 or octet_length(slides::text)+octet_length(slide::text)>8388608 then perform eps.fail('REVIEW_TOO_LARGE','The exact review exceeds the technical snapshot budget.',503);end if;
    slides:=slides||jsonb_build_array(slide);
    inputs:=inputs||jsonb_build_array(jsonb_build_object('assignment_id',assignment.id,'slot_id',slot_item.id,'pool_id',pool.id,'position',assignment.position,'shortlist_included',assignment.shortlist_included,'sort_order',assignment.sort_order,'fields',fields,'source_fields',source_fields,'facts_fingerprint',eps.cast_fingerprint(candidate.facts,candidate.field_sources),'reviewed',reviewed,'candidate_archived',candidate.archived_at is not null,'merged_into',candidate.merged_into_candidate_id,'media_id',media.id,'media_source_id',media.source_asset_id,'video_sha256',asset.sha256,'video_status',asset.status,'transcript_sha256',case when media.original_transcript is not null then encode(sha256(convert_to(media.original_transcript,'UTF8')),'hex')else null end,'frames',frame_input,'fresh_material_required',pool.fresh_material_required,'media_confirmed',pool.media_confirmed));
   end loop;
   if slot_assignments=0 then
    pending_count:=pending_count+1;slides:=slides||jsonb_build_array(jsonb_build_object('kind','pending','role_id',role_item.id,'role_name',role_item.name,'slot_id',slot_item.id,'slot_label',slot_item.label,'assignment_id',null,'workspace_candidate_id',null,'candidate_id',null,'candidate_media_id',null,'assignment_row_version',null,'workspace_candidate_row_version',null,'candidate_row_version',null,'position',null,'review_status',null,'fields',blank_fields,'source_fields',blank_fields,'frames','[]'::jsonb,'video_asset_id',null,'requirements',role_item.requirements,'provisional',slot_item.provisional));
    issues:=issues||jsonb_build_array(eps.review_issue('OPEN_SLOT','warning',slot_item.id,null,'This output slot is Pending.','Continue with Pending or add an assignment.'));
   elsif not exists(select 1 from eps.assignments where slot_id=slot_item.id and archived_at is null and position='main'and(series.output_type='selection'or shortlist_included))then issues:=issues||jsonb_build_array(eps.review_issue('NO_MAIN','warning',slot_item.id,null,'This output slot has no Main choice.','A Main is optional.'));end if;
  end loop;
 end loop;
 if jsonb_array_length(slides)=0 then pending_count:=1;slides:=jsonb_build_array(jsonb_build_object('kind','pending','role_id',null,'role_name','Requirements pending','slot_id',null,'slot_label','Pending','assignment_id',null,'workspace_candidate_id',null,'candidate_id',null,'candidate_media_id',null,'assignment_row_version',null,'workspace_candidate_row_version',null,'candidate_row_version',null,'position',null,'review_status',null,'fields',blank_fields,'source_fields',blank_fields,'frames','[]'::jsonb,'video_asset_id',null,'requirements',jsonb_build_object('age_range',null,'gender_requirement',null,'appearance_performance',null,'languages','[]'::jsonb,'accents','[]'::jsonb,'skills','[]'::jsonb,'scene_references','[]'::jsonb,'shoot_dates','[]'::jsonb,'location',null,'availability_requirements',null,'other_instructions',null),'provisional',true));issues:=issues||jsonb_build_array(eps.review_issue('NO_REQUIREMENTS','warning',null,null,'Workspace requirements are Pending.','Continue with Pending or enter supplied roles.'));end if;
 if candidate_count+pending_count+1>1000 or octet_length(slides::text)>8388608 then perform eps.fail('REVIEW_TOO_LARGE','The exact review exceeds the technical snapshot budget.',503);end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'headcount',headcount,'category',category,'requirements',requirements,'clarifications',clarifications,'sort_order',sort_order)order by sort_order,id),'[]')into role_inputs from eps.roles where workspace_id=p_workspace and archived_at is null;
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'role_id',s.role_id,'label',s.label,'provisional',s.provisional,'sort_order',s.sort_order)order by r.sort_order,r.id,s.sort_order,s.id),'[]')into slot_inputs from eps.slots s join eps.roles r on r.id=s.role_id where s.workspace_id=p_workspace and s.archived_at is null and r.archived_at is null;
 fingerprint:=encode(sha256(convert_to(jsonb_build_object('schema_version','eps.review-input.pg-jsonb.v1','series_id',series.id,'audience_snapshot',series.audience_snapshot,'template',eps.review_template_dto(series),'cover',cover,'logo',case when workspace.logo_asset_id is null then null else jsonb_build_object('id',workspace.logo_asset_id,'sha256',logo.sha256,'width',logo.width,'height',logo.height,'status',logo.status)end,'roles',role_inputs,'slots',slot_inputs,'assignments',inputs,'general_requirements',(select normalized_instructions from eps.specs where workspace_id=p_workspace))::text,'UTF8')),'hex');
 return jsonb_build_object('workspace_id',p_workspace,'series_id',series.id,'input_fingerprint',fingerprint,'draft_revision',workspace.draft_revision,'output_type',series.output_type,'candidate_slide_count',candidate_count,'pending_slide_count',pending_count,'issues',issues,'can_generate',not exists(select 1 from jsonb_array_elements(issues)v where v->>'severity'='blocking'),'unreviewed_candidate_ids',to_jsonb(unreviewed),'template',eps.review_template_dto(series),'cover',cover,'slides',slides);
end$$;
create function eps.review_snapshot(p_workspace uuid,p_series_id uuid,p_output text default null)returns jsonb language plpgsql stable security invoker set search_path=''as $$begin
 perform eps.review_require(p_workspace);perform eps.require_capability('cast.read');return eps.review_snapshot_data(p_workspace,p_series_id,p_output);
end$$;
create function public.eps_get_workspace_review(p_workspace_id uuid,p_series_id uuid,p_output_type text default null)returns jsonb language plpgsql stable security definer set search_path=''as $$declare review jsonb;begin
 review:=eps.review_snapshot(p_workspace_id,p_series_id,p_output_type);
 return review||jsonb_build_object('can_generate',false,'issues',review->'issues'||jsonb_build_array(eps.review_issue('FIT_MEASUREMENT_REQUIRED','blocking',p_series_id,null,'This exact template snapshot has not been measured.','Measure the current review layout.')),'fit',jsonb_build_object('status','unmeasured','input_fingerprint',null,'measured_at',null,'overflows','[]'::jsonb,'error_code','FIT_MEASUREMENT_REQUIRED'));
end$$;
grant create on schema eps,public to eps_review_owner;
do $$declare routine regprocedure;begin
 for routine in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace where(n.nspname='eps'and p.proname like'review_%')or(n.nspname='public'and p.proname in('eps_create_presentation_series','eps_get_presentation_series','eps_update_presentation_series','eps_list_presentation_series','eps_get_workspace_review'))loop
  execute format('alter function %s owner to eps_review_owner',routine);execute format('revoke all on function %s from public,anon,authenticated,service_role',routine);
 end loop;
end$$;
revoke create on schema eps,public from eps_review_owner;
grant execute on function public.eps_create_presentation_series(jsonb,text),public.eps_get_presentation_series(uuid),public.eps_update_presentation_series(uuid,jsonb,text),public.eps_list_presentation_series(jsonb),public.eps_get_workspace_review(uuid,uuid,text)to authenticated;
notify pgrst,'reload schema';
