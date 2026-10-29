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

-- Typed, audited inverse of complete M04 retirement effects. No generic rollback.
set local search_path='';set local lock_timeout='3s';set local statement_timeout='30s';
grant update(headcount,clarifications,archived_at,row_version,updated_at)on eps.roles to eps_casting_owner;
grant update(archived_at,provisional,row_version,updated_at)on eps.slots to eps_casting_owner;
grant update(archived_at,row_version,updated_at)on eps.workspace_candidates to eps_casting_owner;
create policy casting_pool_retirement_restore on eps.workspace_candidates for update to eps_casting_owner using(eps.casting_scope(workspace_id,true))with check(eps.casting_scope(workspace_id,true));
create policy casting_retirement_idempotency on eps.idempotency_records for all to eps_casting_owner using(principal_id=auth.uid()and operation='casting.undo_retirement')with check(principal_id=auth.uid()and operation='casting.undo_retirement');
create policy casting_retirement_audit on eps.audit_events for insert to eps_casting_owner with check(principal_id=auth.uid()and action='casting.undo_retirement');

create function eps.casting_retirement_state(p_workspace uuid,p_resource uuid,p_event uuid default null)returns jsonb language plpgsql stable security invoker set search_path=''as $$
declare event eps.assignment_change_events;details jsonb;before_rows jsonb;after_rows jsonb;family uuid[];assignment_ids uuid[];slots uuid[];slot_state jsonb;item jsonb;state eps.slots;role_state eps.roles;pool eps.workspace_candidates;assignment eps.assignments;reason text;expected bigint;main_count integer;shortlist_count integer;begin
 perform eps.require_capability('workspaces.write');if not eps.casting_scope(p_workspace,true)then perform eps.fail('RESOURCE_NOT_FOUND','Writable retirement scope not found.',404);end if;
 select * into event from eps.assignment_change_events where workspace_id=p_workspace and operation in('retire_slots','archive_role','remove_workspace_candidate')and payload#>>'{details,resource_id}'=p_resource::text and(p_event is null or id=p_event)order by created_at desc,id desc limit 1;
 if not found then perform eps.fail('RESOURCE_NOT_FOUND','Retirement effect not found.',404);end if;
 details:=event.payload->'details';
 select array_agg(id order by created_at,id)into family from eps.assignment_change_events where workspace_id=p_workspace and operation=event.operation and payload->'details'=details;
 select coalesce(jsonb_agg(v.value order by e.created_at,e.id,v.ordinal),'[]')into before_rows from eps.assignment_change_events e cross join lateral jsonb_array_elements(e.payload->'before')with ordinality v(value,ordinal)where e.id=any(family);
 select coalesce(jsonb_agg(v.value order by e.created_at,e.id,v.ordinal),'[]')into after_rows from eps.assignment_change_events e cross join lateral jsonb_array_elements(e.payload->'after')with ordinality v(value,ordinal)where e.id=any(family);
 select coalesce(array_agg((v->>'id')::uuid order by v->>'id'),'{}'),count(*)filter(where v->>'position'='main'),count(*)filter(where v->'shortlist_included'='true')into assignment_ids,main_count,shortlist_count from jsonb_array_elements(before_rows)v;
 select coalesce(array_agg(value::uuid order by value),'{}')into slots from jsonb_array_elements_text(details->'selected_slot_ids');
 if cardinality(assignment_ids)>1000 or cardinality(slots)>1000 or cardinality(family)>20 then reason:='RETIREMENT_TOO_LARGE';
 elsif exists(select 1 from eps.assignment_change_consumptions where event_id=any(family))then reason:='ALREADY_UNDONE';
 elsif cardinality(assignment_ids)<>(select count(distinct v)from unnest(assignment_ids)v)or jsonb_array_length(before_rows)<>jsonb_array_length(after_rows)then reason:='RETIREMENT_CHANGED';end if;
 if reason is null then
  for item in select value from jsonb_array_elements(after_rows)loop
   select * into assignment from eps.assignments where id=(item->>'id')::uuid and workspace_id=p_workspace;
   if not found or eps.casting_assignment_dto(assignment.id)<>item or assignment.archived_at is null then reason:='RETIREMENT_CHANGED';exit;end if;
   if assignment.position='main'and exists(select 1 from eps.assignments a where a.slot_id=assignment.slot_id and a.archived_at is null and a.position='main'and a.id<>assignment.id)then reason:='MAIN_CHANGED';exit;end if;
   if exists(select 1 from eps.assignments a where a.slot_id=assignment.slot_id and a.workspace_candidate_id=assignment.workspace_candidate_id and a.archived_at is null and a.id<>assignment.id)then reason:='RETIREMENT_CHANGED';exit;end if;
  end loop;
 end if;
 if reason is null then
  if event.operation='remove_workspace_candidate'then
   select * into pool from eps.workspace_candidates where id=p_resource and workspace_id=p_workspace;
   if not found or pool.archived_at is null or pool.row_version<>(details->>'pool_row_version_before')::bigint+1
    or exists(select 1 from eps.workspace_candidates p where p.workspace_id=p_workspace and p.candidate_id=pool.candidate_id and p.archived_at is null and p.id<>pool.id)
    or not exists(select 1 from eps.candidates c where c.id=pool.candidate_id and c.archived_at is null and c.merged_into_candidate_id is null)then reason:='RETIREMENT_CHANGED';end if;
  else
   select * into role_state from eps.roles where id=p_resource and workspace_id=p_workspace;
   if not found or role_state.row_version<>(details#>>'{role_before,row_version}')::bigint+1 or(role_state.archived_at is not null)<>(event.operation='archive_role')then reason:='RETIREMENT_CHANGED';end if;
  end if;
 end if;
 if reason is null then
  for slot_state in select value from jsonb_array_elements(details->'slot_states_before')loop
   select * into state from eps.slots where id=(slot_state->>'slot_id')::uuid and workspace_id=p_workspace;
   expected:=(slot_state->>'row_version')::bigint+case when event.operation='remove_workspace_candidate'or state.id=any(slots)or event.operation='retire_slots'and(slot_state->>'provisional')::boolean then 1 else 0 end;
   if not found or state.row_version<>expected or(state.archived_at is not null)<>(event.operation in('retire_slots','archive_role')and state.id=any(slots))then reason:='RETIREMENT_CHANGED';exit;end if;
  end loop;
 end if;
 return jsonb_build_object('effect',jsonb_build_object('workspace_id',p_workspace,'resource_id',p_resource,'operation',event.operation,'undo_event_id',event.id,'expected_workspace_row_version',(select row_version from eps.workspaces where id=p_workspace),'assignment_ids',to_jsonb(assignment_ids),'slot_ids',to_jsonb(slots),'main_count',main_count,'shortlist_count',shortlist_count,'can_undo',reason is null,'unavailable_reason',reason),'details',details,'before',before_rows,'after',after_rows,'family_event_ids',to_jsonb(family));
end$$;
create function public.eps_get_casting_retirement(p_workspace_id uuid,p_resource_id uuid)returns jsonb language plpgsql stable security definer set search_path=''as $$begin
 return eps.casting_retirement_state(p_workspace_id,p_resource_id)->'effect';
end$$;
create function eps.casting_record_retirement_undo(p_workspace uuid,p_resource uuid,p_before jsonb,p_after jsonb,p_consumed uuid)returns uuid language plpgsql volatile security invoker set search_path=''as $$
declare audit uuid:=gen_random_uuid();event uuid:=gen_random_uuid();begin
 if not eps.casting_scope(p_workspace,true)or jsonb_typeof(p_before)<> 'array'or jsonb_typeof(p_after)<>'array'or jsonb_array_length(p_before)>100 or jsonb_array_length(p_after)>100 then perform eps.fail('RETIREMENT_UNDO_INVALID','Invalid bounded inverse payload.',409);end if;
 insert into eps.audit_events(id,principal_id,action,resource_id)values(audit,auth.uid(),'casting.undo_retirement',p_resource);
 insert into eps.assignment_change_events(id,audit_event_id,workspace_id,operation,payload)values(event,audit,p_workspace,'undo_retirement',jsonb_build_object('schema_version','1.0','before',p_before,'after',p_after,'details',jsonb_build_object('consumed_event_id',p_consumed,'resource_id',p_resource)));
 insert into eps.assignment_change_consumptions(event_id,consumed_by_event_id)values(p_consumed,event);return event;
end$$;
create function public.eps_undo_casting_retirement(p_workspace_id uuid,p_event_id uuid,p_input jsonb,p_idempotency_key text)returns jsonb language plpgsql volatile security definer set search_path=''as $$
declare event eps.assignment_change_events;state jsonb;details jsonb;cached jsonb;input_value jsonb;workspace_version bigint;expected bigint;resource uuid;item jsonb;slot_state jsonb;slot_row eps.slots;role_row eps.roles;pool eps.workspace_candidates;family uuid[];event_id uuid;event_before jsonb;event_after jsonb;affected uuid[]:='{}';clarification_value jsonb;marker jsonb;begin
 perform eps.casting_body(p_input,array['expected_workspace_row_version']);expected:=eps.casting_version(p_input->'expected_workspace_row_version');
 perform eps.casting_lock_workspaces(array[p_workspace_id]);input_value:=p_input||jsonb_build_object('workspace_id',p_workspace_id,'event_id',p_event_id);
 cached:=eps.casting_replay('undo_retirement',p_idempotency_key,input_value);perform eps.require_capability('workspaces.write');if not eps.casting_scope(p_workspace_id,true)then perform eps.fail('RESOURCE_NOT_FOUND','Writable retirement scope not found.',404);end if;
 if cached is not null then return cached;end if;
 select row_version into workspace_version from eps.workspaces where id=p_workspace_id;
 if expected<>workspace_version then perform eps.fail('STALE_RESOURCE_VERSION','Workspace changed since the inverse was shown.',409,workspace_version);end if;
 select * into event from eps.assignment_change_events where id=p_event_id and workspace_id=p_workspace_id and operation in('retire_slots','archive_role','remove_workspace_candidate');
 if not found then perform eps.fail('RESOURCE_NOT_FOUND','Retirement effect not found.',404);end if;
 resource:=(event.payload#>>'{details,resource_id}')::uuid;
 if event.operation<>'remove_workspace_candidate'then perform 1 from eps.roles where id=resource and workspace_id=p_workspace_id for update;else perform 1 from eps.workspace_candidates where id=resource and workspace_id=p_workspace_id for update;end if;
 perform 1 from eps.slots where workspace_id=p_workspace_id and id in(select(value->>'slot_id')::uuid from jsonb_array_elements(event.payload#>'{details,slot_states_before}'))order by id for update;
 state:=eps.casting_retirement_state(p_workspace_id,resource,p_event_id);details:=state->'details';
 if state#>'{effect,can_undo}'<>'true'then perform eps.fail('RETIREMENT_UNDO_INVALID','Retirement inverse is unavailable: '||(state#>>'{effect,unavailable_reason}'),409);end if;
 select array_agg(value::uuid order by value)into family from jsonb_array_elements_text(state->'family_event_ids');
 perform 1 from eps.assignments where workspace_id=p_workspace_id and id in(select(value->>'id')::uuid from jsonb_array_elements(state->'after'))order by slot_id,id for update;
 -- Revalidate after every relevant lock; all new casting writes take the same workspace lock.
 state:=eps.casting_retirement_state(p_workspace_id,resource,p_event_id);
 if state#>'{effect,can_undo}'<>'true'then perform eps.fail('RETIREMENT_UNDO_INVALID','Retirement choices changed while waiting.',409);end if;
 if event.operation='remove_workspace_candidate'then
  select * into pool from eps.workspace_candidates where id=resource;perform eps.casting_advance(pool.row_version);
  update eps.workspace_candidates set archived_at=null,row_version=row_version+1,updated_at=clock_timestamp()where id=pool.id;affected:=array_append(affected,pool.id);
 else
  select * into role_row from eps.roles where id=resource;perform eps.casting_advance(role_row.row_version);clarification_value:=role_row.clarifications;
  for marker in select value from jsonb_array_elements(details#>'{role_before,headcount_marker_flags}')loop
   if clarification_value#>>array[marker->>'index','field_path']<>'headcount'then perform eps.fail('RETIREMENT_UNDO_INVALID','Role clarification markers changed.',409);end if;
   clarification_value:=jsonb_set(clarification_value,array[marker->>'index','resolved'],marker->'resolved');
  end loop;
  update eps.roles set archived_at=null,headcount=(details#>>'{role_before,headcount}')::bigint,clarifications=clarification_value,row_version=row_version+1,updated_at=clock_timestamp()where id=role_row.id;affected:=array_append(affected,role_row.id);
 end if;
 for slot_state in select value from jsonb_array_elements(details->'slot_states_before')loop
  select * into slot_row from eps.slots where id=(slot_state->>'slot_id')::uuid;
  if event.operation='remove_workspace_candidate'or slot_row.archived_at is not null or slot_row.provisional is distinct from(slot_state->>'provisional')::boolean then
   perform eps.casting_advance(slot_row.row_version);update eps.slots set archived_at=null,provisional=(slot_state->>'provisional')::boolean,row_version=row_version+1,updated_at=clock_timestamp()where id=slot_row.id;affected:=array_append(affected,slot_row.id);
  end if;
 end loop;
 for item in select value from jsonb_array_elements(state->'before')loop
  perform eps.casting_advance(row_version)from eps.assignments where id=(item->>'id')::uuid;
  update eps.assignments set archived_at=null,row_version=row_version+1,updated_at=clock_timestamp()where id=(item->>'id')::uuid;affected:=array_append(affected,(item->>'id')::uuid);
 end loop;
 foreach event_id in array family loop
  select payload->'after'into event_before from eps.assignment_change_events where id=event_id;
  select coalesce(jsonb_agg(eps.casting_assignment_dto((v->>'id')::uuid)order by v->>'id'),'[]')into event_after from jsonb_array_elements(event_before)v;
  perform eps.casting_record_retirement_undo(p_workspace_id,resource,event_before,event_after,event_id);
 end loop;
 perform eps.casting_changed(p_workspace_id);
 return eps.casting_remember('undo_retirement',p_idempotency_key,input_value,jsonb_build_object('success',true,'affected_ids',to_jsonb(affected),'workspace_row_version',(select row_version from eps.workspaces where id=p_workspace_id)));
exception when unique_violation then perform eps.fail('RETIREMENT_UNDO_INVALID','A newer active choice prevents this inverse.',409);end$$;
grant create on schema eps,public to eps_casting_owner;
alter function eps.casting_retirement_state(uuid,uuid,uuid)owner to eps_casting_owner;
alter function eps.casting_record_retirement_undo(uuid,uuid,jsonb,jsonb,uuid)owner to eps_casting_owner;
alter function public.eps_get_casting_retirement(uuid,uuid)owner to eps_casting_owner;
alter function public.eps_undo_casting_retirement(uuid,uuid,jsonb,text)owner to eps_casting_owner;
revoke create on schema eps,public from eps_casting_owner;
revoke all on function eps.casting_retirement_state(uuid,uuid,uuid),eps.casting_record_retirement_undo(uuid,uuid,jsonb,jsonb,uuid),public.eps_get_casting_retirement(uuid,uuid),public.eps_undo_casting_retirement(uuid,uuid,jsonb,text)from public,anon,authenticated,service_role;
grant execute on function public.eps_get_casting_retirement(uuid,uuid),public.eps_undo_casting_retirement(uuid,uuid,jsonb,text)to authenticated;

-- Durable optional WF05 and native layout measurement on reviewed21 + M04 review core.
-- New work is disabled until coordinated worker/routing activation. Existing jobs unchanged.
set local search_path='';set local lock_timeout='3s';set local statement_timeout='30s';
create role eps_review_stage_owner nologin noinherit nosuperuser nocreatedb nocreaterole nobypassrls;
grant eps_review_stage_owner to postgres;
grant usage on schema eps,public,extensions to eps_review_stage_owner;
create table eps.review_processing_config(id boolean primary key default true check(id),enabled boolean not null default false,model text not null check(model~'^[A-Za-z0-9._-]{1,200}$'),prompt_version text not null,renderer_version text not null);
insert into eps.review_processing_config(id,model,prompt_version,renderer_version)values(true,'gpt-6.1-sol','contextual_suggestion_v1','everyone-casting-fit-v1');
create table eps.ai_suggestions(
 id uuid primary key,workspace_id uuid not null references eps.workspaces(id),job_id uuid unique references eps.jobs(id),
 target_type text not null check(target_type in('assignment','role','workspace_candidate','candidate')),target_id uuid not null,target_row_version bigint not null,
 field text not null,bound_context_sha256 text not null check(bound_context_sha256~'^[a-f0-9]{64}$'),proposal jsonb,
 created_at timestamptz not null default clock_timestamp(),check(proposal is null or jsonb_typeof(proposal)='object')
);
create table eps.review_stage_payloads(
 id uuid primary key default gen_random_uuid(),job_id uuid not null references eps.jobs(id),workspace_id uuid not null references eps.workspaces(id),
 stage text not null,attempt_id uuid not null,input_hash text not null,result_schema text not null,payload jsonb not null check(jsonb_typeof(payload)='object'and octet_length(payload::text)<=1048576),
 created_at timestamptz not null default clock_timestamp(),unique(job_id,stage,input_hash)
);
create table eps.review_fit_results(
 job_id uuid primary key references eps.jobs(id),workspace_id uuid not null references eps.workspaces(id),series_id uuid not null references eps.presentation_series(id),
 input_fingerprint text not null check(input_fingerprint~'^[a-f0-9]{64}$'),status text not null check(status in('measured','failed')),result jsonb,error_code text,
 completed_at timestamptz not null default clock_timestamp(),check(status='measured'and result is not null and error_code is null or status='failed'and result is null and error_code is not null)
);
create index review_fit_scope on eps.review_fit_results(series_id,input_fingerprint,completed_at desc);
alter table eps.review_processing_config enable row level security;alter table eps.review_processing_config force row level security;
alter table eps.ai_suggestions enable row level security;alter table eps.ai_suggestions force row level security;
alter table eps.review_stage_payloads enable row level security;alter table eps.review_stage_payloads force row level security;
alter table eps.review_fit_results enable row level security;alter table eps.review_fit_results force row level security;
revoke all on eps.review_processing_config,eps.ai_suggestions,eps.review_stage_payloads,eps.review_fit_results from public,anon,authenticated,service_role;
grant select on eps.review_processing_config to eps_review_owner,eps_review_stage_owner;
grant select,insert,update on eps.ai_suggestions to eps_review_owner;
grant select,update on eps.ai_suggestions to eps_review_stage_owner;
grant select,insert on eps.review_stage_payloads,eps.review_fit_results to eps_review_stage_owner;
grant select on eps.review_fit_results to eps_review_owner;
create policy review_processing_config_read on eps.review_processing_config for select to eps_review_owner,eps_review_stage_owner using(true);
create policy review_suggestions_read on eps.ai_suggestions for select to eps_review_owner using(eps.review_scope(workspace_id)and eps.has_capability('cast.read'));
create policy review_suggestions_insert on eps.ai_suggestions for insert to eps_review_owner with check(eps.review_scope(workspace_id)and eps.project_scope((select project_id from eps.workspaces where id=workspace_id),true)and eps.has_capability('workspaces.write')and eps.has_capability('cast.read'));
create policy review_suggestions_job_update on eps.ai_suggestions for update to eps_review_owner using(eps.review_scope(workspace_id)and eps.has_capability('workspaces.write'))with check(eps.review_scope(workspace_id)and eps.has_capability('workspaces.write'));
create policy review_suggestions_service on eps.ai_suggestions for all to eps_review_stage_owner using(true)with check(true);
create policy review_payloads_service on eps.review_stage_payloads for all to eps_review_stage_owner using(true)with check(true);
create policy review_fit_service on eps.review_fit_results for all to eps_review_stage_owner using(true)with check(true);
create policy review_fit_read on eps.review_fit_results for select to eps_review_owner using(eps.review_scope(workspace_id));

alter table eps.jobs drop constraint jobs_kind_check;
alter table eps.jobs add constraint jobs_kind_check check(kind in('specs_extract','candidate_scan','frame_extract','ai_suggestion','review_fit'));
alter table eps.jobs drop constraint jobs_stage_check;
alter table eps.jobs add constraint jobs_stage_check check(stage in('prepare_document','extract_specs','apply_specs','prepare_candidate','transcribe_candidate','extract_candidate','select_frames','apply_candidate','extract_frames','apply_frames','prepare_suggestion','generate_suggestion','validate_suggestion','measure_review_fit'));
alter table eps.jobs drop constraint jobs_kind_stage_check;
alter table eps.jobs add constraint jobs_kind_stage_check check(kind='specs_extract'and stage in('prepare_document','extract_specs','apply_specs')or kind='candidate_scan'and stage in('prepare_candidate','transcribe_candidate','extract_candidate','select_frames','apply_candidate')or kind='frame_extract'and stage in('extract_frames','apply_frames')or kind='ai_suggestion'and stage in('prepare_suggestion','generate_suggestion','validate_suggestion')or kind='review_fit'and stage='measure_review_fit');
alter table eps.jobs drop constraint jobs_input_hash_version_check;
alter table eps.jobs add constraint jobs_input_hash_version_check check(input_hash_version in('eps.specs-input.pg-jsonb.v1','eps.candidate-input.pg-jsonb.v1','eps.frame-input.pg-jsonb.v1','eps.review-job-input.pg-jsonb.v1'));
alter table eps.job_events drop constraint job_events_stage_check;
alter table eps.job_events add constraint job_events_stage_check check(stage in('prepare_document','extract_specs','apply_specs','prepare_candidate','transcribe_candidate','extract_candidate','select_frames','apply_candidate','extract_frames','apply_frames','prepare_suggestion','generate_suggestion','validate_suggestion','measure_review_fit'));
alter table eps.outbox_events drop constraint outbox_events_stage_check;
alter table eps.outbox_events add constraint outbox_events_stage_check check(stage in('prepare_document','extract_specs','apply_specs','prepare_candidate','transcribe_candidate','extract_candidate','select_frames','apply_candidate','extract_frames','apply_frames','prepare_suggestion','generate_suggestion','validate_suggestion','measure_review_fit'));
grant select,insert on eps.jobs,eps.outbox_events to eps_review_owner;
create policy review_jobs_user_read on eps.jobs for select to eps_review_owner using(kind in('ai_suggestion','review_fit')and eps.review_scope(workspace_id));
create policy review_jobs_user_insert on eps.jobs for insert to eps_review_owner with check(kind in('ai_suggestion','review_fit')and requested_by=auth.uid()and status='queued'and stage in('prepare_suggestion','measure_review_fit')and attempt=0 and dispatch_generation=1 and current_attempt_id is null and lease_token_digest is null and eps.review_scope(workspace_id)and eps.project_scope((select project_id from eps.workspaces where id=workspace_id),true)and eps.has_capability('cast.read')and(kind='ai_suggestion'and eps.has_capability('workspaces.write')or kind='review_fit'and eps.has_capability('workspaces.write')));
create policy review_outbox_user_read on eps.outbox_events for select to eps_review_owner using(exists(select 1 from eps.jobs j where j.id=job_id and j.kind in('ai_suggestion','review_fit')));
create policy review_outbox_user_insert on eps.outbox_events for insert to eps_review_owner with check(exists(select 1 from eps.jobs j where j.id=job_id and j.kind in('ai_suggestion','review_fit')and j.requested_by=auth.uid()and j.status='queued'));
grant select,update on eps.jobs to eps_review_stage_owner;
grant select,insert on eps.job_events,eps.outbox_events to eps_review_stage_owner;
create policy review_jobs_service_read on eps.jobs for select to eps_review_stage_owner using(kind in('ai_suggestion','review_fit'));
create policy review_jobs_service_update on eps.jobs for update to eps_review_stage_owner using(kind in('ai_suggestion','review_fit'))with check(kind in('ai_suggestion','review_fit'));
create policy review_events_service on eps.job_events for all to eps_review_stage_owner using(exists(select 1 from eps.jobs j where j.id=job_id))with check(exists(select 1 from eps.jobs j where j.id=job_id));
create policy review_outbox_service on eps.outbox_events for all to eps_review_stage_owner using(exists(select 1 from eps.jobs j where j.id=job_id))with check(exists(select 1 from eps.jobs j where j.id=job_id));
grant select on public.projects,public.clients,public.project_memberships,public.app_capability_grants,eps.workspaces,eps.specs,eps.roles,eps.slots,eps.assignments,eps.workspace_candidates,eps.candidates,eps.candidate_media,eps.candidate_media_frames,eps.media_assets,eps.presentation_templates,eps.presentation_series to eps_review_stage_owner;
grant update(id)on eps.workspaces to eps_review_stage_owner;
do $$declare table_name text;begin
 foreach table_name in array array['public.projects','public.clients','public.project_memberships','public.app_capability_grants','eps.workspaces','eps.specs','eps.roles','eps.slots','eps.assignments','eps.workspace_candidates','eps.candidates','eps.candidate_media','eps.candidate_media_frames','eps.media_assets','eps.presentation_templates','eps.presentation_series']loop
  execute format('create policy review_stage_read on %s for select to eps_review_stage_owner using(true)',table_name);
 end loop;
end$$;
create function eps.review_stage_can_write(p_principal uuid,p_workspace uuid,p_kind text)returns boolean language sql volatile security invoker set search_path=''as $$
 select exists(select 1 from eps.workspaces w join public.projects p on p.id=w.project_id join public.project_memberships m on m.project_id=p.id and m.principal_id=p_principal
 where w.id=p_workspace and w.archived_at is null and p.archived_at is null and m.active and m.can_write and eps.job_requester_active(p_principal)
 and not exists(select 1 from unnest(array['projects.read','workspaces.read','workspaces.write','cast.read'])required where not exists(select 1 from public.app_capability_grants g where g.principal_id=p_principal and g.capability=required and g.active)))
$$;
create function eps.review_stage_source_matches(p_job eps.jobs)returns boolean language plpgsql volatile security definer set search_path=''as $$
declare item eps.ai_suggestions;context jsonb;review jsonb;begin
 if p_job.kind not in('ai_suggestion','review_fit')or p_job.input_hash_version<>'eps.review-job-input.pg-jsonb.v1'or p_job.input_hash<>encode(sha256(convert_to(p_job.input::text,'UTF8')),'hex')or p_job.input->>'workspace_id'<>p_job.workspace_id::text then return false;end if;
 if p_job.kind='ai_suggestion'then
  select * into item from eps.ai_suggestions where id=p_job.resource_id and job_id=p_job.id and workspace_id=p_job.workspace_id;
  if not found then return false;end if;
  context:=eps.review_target_context(p_job.workspace_id,item.target_type,item.target_id,item.field);
  return item.bound_context_sha256=context->>'bound_context_sha256'and item.target_row_version=(context->>'target_row_version')::bigint and p_job.input->>'source_text'=context->>'source_text'and p_job.input->'template'=context->'template';
 end if;
 if p_job.resource_id::text<>p_job.input->>'series_id'then return false;end if;
 review:=eps.review_snapshot_data(p_job.workspace_id,p_job.resource_id,null);
 return review->>'input_fingerprint'=p_job.input->>'expected_input_fingerprint'and review->'template'=p_job.input->'template';
exception when raise_exception then return false;end$$;
create function eps.review_is_job(p_job uuid)returns boolean language sql volatile security definer set search_path=''as $$select exists(select 1 from eps.jobs where id=p_job and kind in('ai_suggestion','review_fit'))$$;
create function eps.review_stage_lock(p_job uuid,p_require_access boolean default true)returns eps.jobs language plpgsql volatile security definer set search_path=''as $$
declare identity eps.jobs;job eps.jobs;begin
 select * into identity from eps.jobs where id=p_job and kind in('ai_suggestion','review_fit');if not found then perform eps.fail('RESOURCE_NOT_FOUND','Review processing job not found.',404);end if;
 perform 1 from eps.workspaces where id=identity.workspace_id for update;
 select * into job from eps.jobs where id=p_job and workspace_id=identity.workspace_id and resource_id=identity.resource_id and kind=identity.kind for update;
 perform eps.specs_stage_assert(found,'RESOURCE_NOT_FOUND');
 if p_require_access and not eps.review_stage_can_write(job.requested_by,job.workspace_id,job.kind)then perform eps.fail('CAPABILITY_REQUIRED','The requester no longer has this processing authority.',403);end if;
 return job;
end$$;
create function eps.claim_review_job_stage(p_input jsonb)returns jsonb language plpgsql volatile security definer set search_path=''as $$
declare job eps.jobs;completed jsonb;token text;attempts integer;at_value timestamptz:=clock_timestamp();begin
 perform eps.specs_stage_assert(eps.specs_stage_shape(p_input,array['job_id','stage','input_hash','workflow_execution_id'],array['job_id','stage','input_hash'])and p_input->>'stage'in('prepare_suggestion','generate_suggestion','validate_suggestion','measure_review_fit')and p_input->>'input_hash'~'^[a-f0-9]{64}$');
 job:=eps.review_stage_lock((p_input->>'job_id')::uuid);at_value:=clock_timestamp();perform eps.specs_stage_assert(exists(select 1 from eps.review_processing_config where id and enabled),'DEPENDENCY_UNAVAILABLE');
 perform eps.specs_stage_assert(eps.review_stage_source_matches(job),'INPUT_CHANGED');perform eps.specs_stage_assert(job.input_hash=p_input->>'input_hash','INPUT_HASH_MISMATCH');
 if job.status='cancelled'or job.cancel_requested_at is not null then perform eps.fail('JOB_CANCELLED','Review processing was cancelled.',409);end if;
 select value into completed from jsonb_array_elements(job.completed_stages)value where value->>'stage'=p_input->>'stage'and value->>'input_hash'=job.input_hash;
 if completed is not null then return jsonb_build_object('job_id',job.id,'stage',p_input->>'stage','attempt_id',completed->>'attempt_id','lease_token','','lease_expires_at',completed->>'completed_at','already_completed',true,'input',jsonb_build_object('input_hash',job.input_hash,'result_schema',completed->>'result_schema','result',completed->'result'));end if;
 perform eps.specs_stage_assert(job.stage=p_input->>'stage','STAGE_OUT_OF_ORDER');
 if job.status='running'and job.lease_expires_at>at_value then perform eps.fail('JOB_ALREADY_RUNNING','Review stage already has an active lease.',409);end if;
 perform eps.specs_stage_assert(job.status in('queued','running')and job.available_at<=at_value,'JOB_NOT_AVAILABLE');attempts:=coalesce((job.stage_attempts->>job.stage)::integer,0);perform eps.specs_stage_assert(attempts<3,'RETRY_EXHAUSTED');
 token:=encode(extensions.gen_random_bytes(32),'hex');
 update eps.jobs set status='running',attempt=attempt+1,current_attempt_id=gen_random_uuid(),lease_token_digest=encode(sha256(convert_to(token,'UTF8')),'hex'),lease_expires_at=at_value+interval'90seconds',heartbeat_at=at_value,last_event_sequence=0,stage_attempts=jsonb_set(stage_attempts,array[stage],to_jsonb(attempts+1)),progress_completed=0,progress_total=null,error=null,n8n_execution_id=p_input->>'workflow_execution_id',row_version=row_version+1,updated_at=at_value where id=job.id returning * into job;
 return jsonb_build_object('job_id',job.id,'stage',job.stage,'attempt_id',job.current_attempt_id,'lease_token',token,'lease_expires_at',job.lease_expires_at,'already_completed',false,'input',job.input||jsonb_build_object('input_hash',job.input_hash));
end$$;
create function eps.get_review_stage_input(p_job_id uuid,p_attempt_id uuid,p_lease_token text)returns jsonb language plpgsql volatile security definer set search_path=''as $$
declare job eps.jobs;generated jsonb;review jsonb;begin
 job:=eps.review_stage_lock(p_job_id);perform eps.specs_stage_assert(job.status='running'and job.current_attempt_id=p_attempt_id and job.cancel_requested_at is null and job.lease_expires_at>clock_timestamp(),'STALE_STAGE_LEASE');
 perform eps.specs_stage_assert(p_lease_token~'^[a-f0-9]{64}$'and job.lease_token_digest=encode(sha256(convert_to(p_lease_token,'UTF8')),'hex'),'LEASE_INVALID');perform eps.specs_stage_assert(eps.review_stage_source_matches(job),'INPUT_CHANGED');
 if job.kind='ai_suggestion'then
  if job.stage='validate_suggestion'then select payload into generated from eps.review_stage_payloads where job_id=job.id and input_hash=job.input_hash and stage='generate_suggestion';perform eps.specs_stage_assert(found,'STAGE_STATE_INVALID');end if;
  return job.input||jsonb_build_object('job_id',job.id,'attempt_id',p_attempt_id,'stage',job.stage,'input_hash',job.input_hash,'generated',generated);
 end if;
 review:=eps.review_snapshot_data(job.workspace_id,job.resource_id,null);
 return job.input||jsonb_build_object('job_id',job.id,'attempt_id',p_attempt_id,'stage',job.stage,'input_hash',job.input_hash,'review',review);
end$$;
create function eps.review_validate_proposal(p_job eps.jobs,p_value jsonb)returns void language plpgsql immutable security invoker set search_path=''as $$
declare metadata jsonb;change jsonb;usage jsonb;begin
 perform eps.specs_stage_assert(eps.specs_stage_shape(p_value,array['schema_version','suggested_text','proposed_changes','warnings','metadata'])and p_value->>'schema_version'='1.0'and jsonb_typeof(p_value->'suggested_text')='string'and length(btrim(p_value->>'suggested_text'))between 1 and 20000 and octet_length(p_value->>'suggested_text')<=32768 and p_value->'warnings'='[]'::jsonb and jsonb_typeof(p_value->'proposed_changes')='array'and jsonb_array_length(p_value->'proposed_changes')=1,'RESULT_INVALID');
 change:=p_value#>'{proposed_changes,0}';perform eps.specs_stage_assert(eps.specs_stage_shape(change,array['field','old_value','new_value'])and change->>'field'=p_job.input->>'field'and change->>'old_value'=p_job.input->>'source_text'and change->>'new_value'=p_value->>'suggested_text','RESULT_INVALID');
 metadata:=p_value->'metadata';perform eps.specs_stage_assert(eps.specs_stage_shape(metadata,array['provider','sdk_version','requested_model','resolved_model','request_id','response_id','prompt_version','input_sha256','usage','prompt_sha256','schema_sha256'])and metadata->>'provider'='openai'and metadata->>'sdk_version'='7.45.1'and metadata->>'requested_model'=p_job.input#>>'{configuration,model}'and metadata->>'prompt_version'=p_job.input#>>'{configuration,prompt_version}'and metadata->>'prompt_sha256'='8480a63823dc9be53ff4898c42df82f6e5b70ccc72100d141392d6c99766c242'and metadata->>'schema_sha256'~'^[a-f0-9]{64}$'and metadata->>'input_sha256'=p_job.input_hash and metadata->>'resolved_model'~'^[A-Za-z0-9._:-]{1,200}$'and metadata->>'response_id'~'^[A-Za-z0-9._:-]{1,200}$' and(metadata->'request_id'='null'or jsonb_typeof(metadata->'request_id')='string'and metadata->>'request_id'~'^[A-Za-z0-9._:-]{1,200}$'),'RESULT_INVALID');
 usage:=metadata->'usage';if usage<>'null'then perform eps.specs_stage_assert(eps.specs_stage_shape(usage,array['input_tokens','output_tokens','total_tokens'])and eps.specs_stage_integer(usage->'input_tokens')and eps.specs_stage_integer(usage->'output_tokens')and eps.specs_stage_integer(usage->'total_tokens')and(usage->>'input_tokens')::bigint+(usage->>'output_tokens')::bigint=(usage->>'total_tokens')::bigint,'RESULT_INVALID');end if;
end$$;
create function eps.review_validate_fit(p_job eps.jobs,p_value jsonb)returns void language plpgsql stable security invoker set search_path=''as $$
declare overflow jsonb;review jsonb;begin
 perform eps.specs_stage_assert(eps.specs_stage_shape(p_value,array['schema_version','input_fingerprint','template_content_sha256','renderer_version','chromium_version','font_hashes','overflows','measured_at'])and p_value->>'schema_version'='1.0'and p_value->>'input_fingerprint'=p_job.input->>'expected_input_fingerprint'and p_value->>'template_content_sha256'=p_job.input#>>'{template,content_sha256}'and p_value->>'renderer_version'=p_job.input#>>'{configuration,renderer_version}'and length(p_value->>'chromium_version')between 1 and 100 and jsonb_typeof(p_value->'font_hashes')='object'and jsonb_typeof(p_value->'measured_at')='string'and p_value->>'measured_at'~'(Z|[+-][0-9]{2}:[0-9]{2})$'and jsonb_typeof(p_value->'overflows')='array'and jsonb_array_length(p_value->'overflows')<=10000,'RESULT_INVALID');
 if p_value->'font_hashes'is distinct from(select font_hashes from eps.presentation_templates where key=p_job.input#>>'{template,key}'and version=p_job.input#>>'{template,version}'and content_sha256=p_job.input#>>'{template,content_sha256}')or exists(select 1 from jsonb_each_text(p_value->'font_hashes')where value!~'^[a-f0-9]{64}$')or(select count(*)from jsonb_object_keys(p_value->'font_hashes'))<>6 then perform eps.fail('RESULT_INVALID','Measured font inventory is invalid.',422);end if;
 begin if(p_value->>'measured_at')::timestamptz>clock_timestamp()+interval'5 minutes'then perform eps.fail('RESULT_INVALID','Measurement timestamp is invalid.',422);end if;exception when invalid_datetime_format or datetime_field_overflow then perform eps.fail('RESULT_INVALID','Measurement timestamp is invalid.',422);end;
 review:=eps.review_snapshot_data(p_job.workspace_id,p_job.resource_id,null);
 for overflow in select value from jsonb_array_elements(p_value->'overflows')loop
  perform eps.specs_stage_assert(eps.specs_stage_shape(overflow,array['slide_index','field','axis','overflow_px'])and eps.specs_stage_integer(overflow->'slide_index',0,jsonb_array_length(review->'slides'))and jsonb_typeof(overflow->'field')='string'and length(overflow->>'field')between 1 and 100 and overflow->>'axis'in('horizontal','vertical')and jsonb_typeof(overflow->'overflow_px')='number'and(overflow->>'overflow_px')::numeric>0 and(overflow->>'overflow_px')::numeric<=100000000,'RESULT_INVALID');
 end loop;
end$$;
create policy review_stage_workspace_lock on eps.workspaces for update to eps_review_stage_owner using(true)with check(false);
create policy eps_review_stage_no_storage on storage.objects as restrictive for all to eps_review_stage_owner using(false)with check(false);
create policy eps_review_stage_no_buckets on storage.buckets as restrictive for all to eps_review_stage_owner using(false)with check(false);
grant execute on function eps.fail(text,text,integer,bigint),eps.specs_stage_assert(boolean,text),eps.specs_stage_shape(jsonb,text[],text[]),eps.specs_stage_integer(jsonb,bigint,bigint),eps.specs_stage_error(text,boolean,jsonb),eps.job_requester_active(uuid),eps.review_snapshot_data(uuid,uuid,text),eps.review_fields(jsonb,text,text),eps.review_template_dto(eps.presentation_series),eps.review_issue(text,text,uuid,text,text,text),eps.cast_fingerprint(jsonb,jsonb),eps.cast_canonical(jsonb),eps.input_uuid(text)to eps_review_stage_owner;
grant execute on function extensions.gen_random_bytes(integer)to eps_review_stage_owner;

create function eps.review_target_context(p_workspace uuid,p_type text,p_target uuid,p_field text)returns jsonb language plpgsql stable security invoker set search_path=''as $$
declare assignment eps.assignments;pool eps.workspace_candidates;candidate eps.candidates;role_item eps.roles;source text;target_version bigint;context jsonb;template eps.presentation_templates;begin
 select * into template from eps.presentation_templates where key='everyone-casting'and version='1.0.0'and registered;if not found then perform eps.fail('TEMPLATE_UNAVAILABLE','Registered template unavailable.',503);end if;
 if p_type='assignment'then
  if p_field not in('name_or_id','age_or_range','height_measurements','languages_accents','skills_experience','city','previous_projects_roles','classification','availability','presentation_notes')then perform eps.fail('VALIDATION_FAILED','Unsupported assignment field.',400);end if;
  select * into assignment from eps.assignments a where a.id=p_target and a.workspace_id=p_workspace and a.archived_at is null and exists(select 1 from eps.slots s join eps.roles r on r.id=s.role_id where s.id=a.slot_id and s.archived_at is null and r.archived_at is null);
  if not found then perform eps.fail('RESOURCE_NOT_FOUND','Suggestion assignment unavailable.',404);end if;
  select * into pool from eps.workspace_candidates where id=assignment.workspace_candidate_id and workspace_id=p_workspace and archived_at is null;
  select * into candidate from eps.candidates where id=pool.candidate_id and merged_into_candidate_id is null;
  if candidate.id is null then perform eps.fail('RESOURCE_NOT_FOUND','Suggestion source profile unavailable.',404);end if;
  source:=(eps.review_fields(candidate.facts,pool.availability,assignment.presentation_notes)||jsonb_strip_nulls(assignment.slide_wording))->>p_field;target_version:=assignment.row_version;
  context:=jsonb_build_object('candidate_fingerprint',eps.cast_fingerprint(candidate.facts,candidate.field_sources),'pool_media_id',pool.selected_candidate_media_id,'pool_frames',to_jsonb(pool.selected_frame_asset_ids),'availability',pool.availability,'presentation_notes',assignment.presentation_notes,'slide_wording',assignment.slide_wording,'selected_media_content',(select jsonb_build_object('source_id',m.source_asset_id,'source_sha256',a.sha256,'source_status',a.status,'transcript_sha256',encode(sha256(convert_to(coalesce(m.original_transcript,''),'UTF8')),'hex'))from eps.candidate_media m join eps.media_assets a on a.id=m.source_asset_id where m.id=pool.selected_candidate_media_id),'frame_content',(select jsonb_agg(jsonb_build_object('id',f.id,'sha256',f.sha256,'status',f.status)order by v.ordinal)from unnest(pool.selected_frame_asset_ids)with ordinality v(id,ordinal)left join eps.media_assets f on f.id=v.id));
 elsif p_type='candidate'then
  if p_field not in('name','age_or_range','height_measurements','skills_experience','city','previous_projects_roles','classification')then perform eps.fail('VALIDATION_FAILED','Unsupported reusable text field.',400);end if;
  select * into candidate from eps.candidates c where c.id=p_target and c.archived_at is null and c.merged_into_candidate_id is null and exists(select 1 from eps.workspace_candidates p where p.workspace_id=p_workspace and p.candidate_id=c.id and p.archived_at is null);
  if not found then perform eps.fail('RESOURCE_NOT_FOUND','Suggestion profile unavailable in this project.',404);end if;
  source:=candidate.facts->>p_field;target_version:=candidate.row_version;context:=jsonb_build_object('facts_fingerprint',eps.cast_fingerprint(candidate.facts,candidate.field_sources));
 elsif p_type='workspace_candidate'then
  if p_field<>'availability'then perform eps.fail('VALIDATION_FAILED','Unsupported project text field.',400);end if;
  select * into pool from eps.workspace_candidates where id=p_target and workspace_id=p_workspace and archived_at is null;
  if not found then perform eps.fail('RESOURCE_NOT_FOUND','Suggestion project candidate unavailable.',404);end if;
  source:=pool.availability;target_version:=pool.row_version;context:=jsonb_build_object('availability',pool.availability,'selected_media',pool.selected_candidate_media_id,'selected_frames',to_jsonb(pool.selected_frame_asset_ids));
 elsif p_type='role'then
  if p_field not in('name','requirements.age_range','requirements.appearance_performance','requirements.location','requirements.availability_requirements','requirements.other_instructions')then perform eps.fail('VALIDATION_FAILED','Unsupported role text field.',400);end if;
  select * into role_item from eps.roles where id=p_target and workspace_id=p_workspace and archived_at is null;
  if not found then perform eps.fail('RESOURCE_NOT_FOUND','Suggestion role unavailable.',404);end if;
  source:=case when p_field='name'then role_item.name else role_item.requirements->>split_part(p_field,'.',2)end;target_version:=role_item.row_version;context:=jsonb_build_object('name',role_item.name,'requirements',role_item.requirements,'clarifications',role_item.clarifications,'headcount',role_item.headcount);
 else perform eps.fail('VALIDATION_FAILED','Unsupported suggestion target.',400);end if;
 if source is null or length(btrim(source))=0 or source in('Not provided','Pending')then perform eps.fail('AI_SOURCE_REQUIRED','Provide source text before requesting wording.',409);end if;
 if octet_length(source)>20000 then perform eps.fail('VALIDATION_FAILED','The selected text exceeds the bounded AI context budget.',400);end if;
 return jsonb_build_object('source_text',source,'target_row_version',target_version,'template',jsonb_build_object('key',template.key,'version',template.version,'content_sha256',template.content_sha256,'font_key',template.font_key),
 'bound_context_sha256',encode(sha256(convert_to(jsonb_build_object('target_type',p_type,'target_id',p_target,'target_row_version',target_version,'field',p_field,'source_text',source,'context',context,'template',to_jsonb(template)-'registered')::text,'UTF8')),'hex'));
end$$;
create function public.eps_create_ai_suggestion(p_input jsonb,p_idempotency_key text)returns jsonb language plpgsql volatile security definer set search_path=''as $$
declare workspace uuid;target uuid;expected bigint;binding jsonb;configuration eps.review_processing_config;input_value jsonb;job_input jsonb;cached jsonb;suggestion uuid:=gen_random_uuid();job uuid:=gen_random_uuid();input_hash text;begin
 perform eps.review_body(p_input,array['workspace_id','capability','target_type','target_id','target_row_version','field','instruction','source_text'],array['workspace_id','capability','target_type','target_id','target_row_version','field','instruction']);
 workspace:=eps.casting_uuid(p_input->'workspace_id');target:=eps.casting_uuid(p_input->'target_id');expected:=eps.casting_version(p_input->'target_row_version');
 perform eps.require_capability('workspaces.write');perform eps.require_capability('cast.read');perform eps.review_require(workspace);
 if not eps.project_scope((select project_id from eps.workspaces where id=workspace),true)then perform eps.fail('RESOURCE_NOT_FOUND','Writable suggestion workspace unavailable.',404);end if;
 cached:=eps.review_replay('create_ai_suggestion',p_idempotency_key,p_input);
 perform 1 from eps.workspaces where id=workspace for update;perform eps.require_capability('workspaces.write');perform eps.require_capability('cast.read');perform eps.review_require(workspace);
 if not eps.project_scope((select project_id from eps.workspaces where id=workspace),true)then perform eps.fail('RESOURCE_NOT_FOUND','Writable suggestion workspace changed.',404);end if;
 if cached is not null then return cached;end if;
 select * into configuration from eps.review_processing_config where id and enabled;if not found then perform eps.fail('REVIEW_PROCESSING_UNAVAILABLE','Review processing is not enabled.',503);end if;
 if jsonb_typeof(p_input->'capability')is distinct from'string'or p_input->>'capability'not in('slide_shorten','normalize_english','contextual_instruction')or jsonb_typeof(p_input->'target_type')is distinct from'string'or p_input->>'target_type'not in('assignment','candidate','workspace_candidate','role')or p_input->>'capability'='slide_shorten'and p_input->>'target_type'<>'assignment'or jsonb_typeof(p_input->'instruction')is distinct from'string'or length(btrim(p_input->>'instruction'))=0 or length(p_input->>'instruction')>8000 or octet_length(p_input->>'instruction')>16384 or jsonb_typeof(p_input->'field')is distinct from'string'then perform eps.fail('VALIDATION_FAILED','Invalid contextual instruction.',400);end if;
 binding:=eps.review_target_context(workspace,p_input->>'target_type',target,p_input->>'field');
 if(binding->>'target_row_version')::bigint<>expected then perform eps.fail('STALE_RESOURCE_VERSION','Suggestion target changed.',409,(binding->>'target_row_version')::bigint);end if;
 if p_input?'source_text'and(jsonb_typeof(p_input->'source_text')<>'string'or p_input->>'source_text'<>binding->>'source_text')then perform eps.fail('INPUT_CHANGED','Selected source text changed.',409);end if;
 job_input:=jsonb_build_object('schema_version','1.0','workspace_id',workspace,'target_type',p_input->>'target_type','target_id',target,'target_row_version',expected,'capability',p_input->>'capability','field',p_input->>'field','instruction',p_input->>'instruction','source_text',binding->>'source_text','budget',case when p_input->>'target_type'='assignment'then jsonb_build_object('max_characters',96,'max_lines',2)else jsonb_build_object('max_characters',600,'max_lines',6)end,'template',binding->'template','configuration',jsonb_build_object('model',configuration.model,'prompt_version',configuration.prompt_version));
 if octet_length(job_input::text)>65536 then perform eps.fail('VALIDATION_FAILED','The bounded processing context exceeds its byte budget.',400);end if;
 input_hash:=encode(sha256(convert_to(job_input::text,'UTF8')),'hex');
 insert into eps.ai_suggestions(id,workspace_id,target_type,target_id,target_row_version,field,bound_context_sha256)values(suggestion,workspace,p_input->>'target_type',target,expected,p_input->>'field',binding->>'bound_context_sha256');
 insert into eps.jobs(id,workspace_id,requested_by,kind,resource_id,input,input_hash,input_hash_version,dedupe_key,stage,correlation_id)values(job,workspace,auth.uid(),'ai_suggestion',suggestion,job_input,input_hash,'eps.review-job-input.pg-jsonb.v1',encode(sha256(convert_to(auth.uid()::text||':review.ai:'||p_idempotency_key,'UTF8')),'hex'),'prepare_suggestion',job::text);
 update eps.ai_suggestions set job_id=job where id=suggestion;
 insert into eps.outbox_events(job_id,stage,input_hash,dispatch_generation,dedupe_key)values(job,'prepare_suggestion',input_hash,1,job::text||':1');
 return eps.review_remember('create_ai_suggestion',p_idempotency_key,p_input,jsonb_build_object('job_id',job,'resource_id',suggestion,'status','queued','poll_url','/api/v1/jobs/'||job::text),suggestion);
end$$;
create function public.eps_get_ai_suggestion(p_suggestion_id uuid)returns jsonb language plpgsql stable security definer set search_path=''as $$declare item eps.ai_suggestions;job eps.jobs;context jsonb;visible_status text;begin
 perform eps.require_capability('workspaces.read');perform eps.require_capability('cast.read');select * into item from eps.ai_suggestions where id=p_suggestion_id;
 if not found then perform eps.fail('RESOURCE_NOT_FOUND','Suggestion not found.',404);end if;perform eps.review_require(item.workspace_id);
 select * into job from eps.jobs where id=item.job_id and kind='ai_suggestion'and resource_id=item.id and workspace_id=item.workspace_id;
 if not found then perform eps.fail('RESOURCE_NOT_FOUND','Suggestion job unavailable.',404);end if;
 visible_status:=job.status;if job.status='succeeded'then begin context:=eps.review_target_context(item.workspace_id,item.target_type,item.target_id,item.field);if context->>'bound_context_sha256'<>item.bound_context_sha256 then visible_status:='waiting_for_input';end if;exception when raise_exception then visible_status:='waiting_for_input';end;end if;
 return jsonb_build_object('id',item.id,'target_id',item.target_id,'target_row_version',item.target_row_version,'status',visible_status,'suggested_text',case when visible_status='succeeded'then item.proposal->>'suggested_text'else null end,'proposed_changes',case when visible_status='succeeded'then item.proposal->'proposed_changes'else'[]'::jsonb end,'warnings',case when visible_status='succeeded'then item.proposal->'warnings'else'[]'::jsonb end);
end$$;
create function public.eps_request_workspace_review_fit(p_workspace_id uuid,p_series_id uuid,p_input jsonb,p_idempotency_key text)returns jsonb language plpgsql volatile security definer set search_path=''as $$
declare review jsonb;configuration eps.review_processing_config;cached jsonb;request jsonb;job_input jsonb;job uuid:=gen_random_uuid();input_hash text;begin
 perform eps.review_require(p_workspace_id);perform eps.require_capability('workspaces.write');perform eps.require_capability('cast.read');if not eps.project_scope((select project_id from eps.workspaces where id=p_workspace_id),true)then perform eps.fail('RESOURCE_NOT_FOUND','Writable fit workspace unavailable.',404);end if;perform eps.review_body(p_input,array['expected_input_fingerprint'],array['expected_input_fingerprint']);
 if jsonb_typeof(p_input->'expected_input_fingerprint')is distinct from'string'or(p_input->>'expected_input_fingerprint')!~'^[a-f0-9]{64}$'then perform eps.fail('VALIDATION_FAILED','A complete review input fingerprint is required.',400);end if;
 request:=p_input||jsonb_build_object('workspace_id',p_workspace_id,'series_id',p_series_id);cached:=eps.review_replay('request_fit',p_idempotency_key,request);
 perform 1 from eps.workspaces where id=p_workspace_id for update;perform eps.review_require(p_workspace_id);perform eps.require_capability('workspaces.write');perform eps.require_capability('cast.read');if not eps.project_scope((select project_id from eps.workspaces where id=p_workspace_id),true)then perform eps.fail('RESOURCE_NOT_FOUND','Writable fit workspace changed.',404);end if;if cached is not null then return cached;end if;
 select * into configuration from eps.review_processing_config where id and enabled;if not found then perform eps.fail('REVIEW_PROCESSING_UNAVAILABLE','Review processing is not enabled.',503);end if;
 review:=eps.review_snapshot(p_workspace_id,p_series_id,null);
 if(p_input->>'expected_input_fingerprint')is distinct from(review->>'input_fingerprint')then perform eps.fail('INPUT_CHANGED','Review content changed. Refresh before measuring.',409);end if;
 job_input:=jsonb_build_object('schema_version','1.0','workspace_id',p_workspace_id,'series_id',p_series_id,'expected_input_fingerprint',review->>'input_fingerprint','template',review->'template','configuration',jsonb_build_object('renderer_version',configuration.renderer_version));
 if octet_length(job_input::text)>65536 then perform eps.fail('VALIDATION_FAILED','The bounded processing context exceeds its byte budget.',400);end if;
 input_hash:=encode(sha256(convert_to(job_input::text,'UTF8')),'hex');
 insert into eps.jobs(id,workspace_id,requested_by,kind,resource_id,input,input_hash,input_hash_version,dedupe_key,stage,correlation_id)values(job,p_workspace_id,auth.uid(),'review_fit',p_series_id,job_input,input_hash,'eps.review-job-input.pg-jsonb.v1',encode(sha256(convert_to(auth.uid()::text||':review.fit:'||p_idempotency_key,'UTF8')),'hex'),'measure_review_fit',job::text);
 insert into eps.outbox_events(job_id,stage,input_hash,dispatch_generation,dedupe_key)values(job,'measure_review_fit',input_hash,1,job::text||':1');
 return eps.review_remember('request_fit',p_idempotency_key,request,jsonb_build_object('job_id',job,'resource_id',p_series_id,'status','queued','poll_url','/api/v1/jobs/'||job::text),p_series_id);
end$$;
create function eps.record_review_job_event(p_event jsonb)returns jsonb language plpgsql volatile security definer set search_path=''as $$
declare job eps.jobs;previous eps.job_events;receipt jsonb;digest text;attempt uuid;sequence_value bigint;at_value timestamptz:=clock_timestamp();safe_error jsonb;payload_id uuid;next_stage text;generated jsonb;begin
 perform eps.specs_stage_assert(eps.specs_stage_shape(p_event,array['event_id','job_id','attempt_id','lease_token','stage','sequence','event_type','input_hash','result_schema','result','error'],array['event_id','job_id','attempt_id','lease_token','stage','sequence','event_type','input_hash'])and octet_length(p_event::text)<=case when p_event->>'stage'='measure_review_fit'then 1048576 else 409600 end and p_event->>'stage'in('prepare_suggestion','generate_suggestion','validate_suggestion','measure_review_fit')and p_event->>'event_type'in('heartbeat','progress','succeeded','failed')and eps.specs_stage_integer(p_event->'sequence',1)and length(p_event->>'event_id')between 1 and 200 and p_event->>'lease_token'~'^[a-f0-9]{64}$'and p_event->>'input_hash'~'^[a-f0-9]{64}$');
 job:=eps.review_stage_lock((p_event->>'job_id')::uuid);at_value:=clock_timestamp();attempt:=(p_event->>'attempt_id')::uuid;sequence_value:=(p_event->>'sequence')::bigint;digest:=encode(sha256(convert_to(p_event::text,'UTF8')),'hex');
 select * into previous from eps.job_events where job_id=job.id and attempt_id=attempt and event_id=p_event->>'event_id';
 if found then perform eps.specs_stage_assert(previous.payload_digest=digest,'EVENT_ID_CONFLICT');return previous.receipt||'{"duplicate":true,"applied":false}'::jsonb;end if;
 perform eps.specs_stage_assert(not exists(select 1 from eps.job_events where job_id=job.id and attempt_id=attempt and sequence=sequence_value),'EVENT_SEQUENCE_CONFLICT');
 receipt:=jsonb_build_object('event_id',p_event->>'event_id','applied',false,'duplicate',false,'stale',false,'job_status',job.status);
 if job.status<>'running'or job.cancel_requested_at is not null or job.current_attempt_id<>attempt or job.stage<>p_event->>'stage'or job.lease_expires_at<=at_value then return receipt||'{"stale":true}'::jsonb;end if;
 perform eps.specs_stage_assert(job.lease_token_digest=encode(sha256(convert_to(p_event->>'lease_token','UTF8')),'hex'),'LEASE_INVALID');perform eps.specs_stage_assert(job.input_hash=p_event->>'input_hash','INPUT_HASH_MISMATCH');
 if sequence_value<=job.last_event_sequence then return receipt||'{"stale":true}'::jsonb;end if;
 if not eps.review_stage_source_matches(job)then job.status:='waiting_for_input';safe_error:=eps.specs_stage_error('INPUT_CHANGED',false);
 elsif p_event->>'event_type'='heartbeat'then
  perform eps.specs_stage_assert(not(p_event?'result')and not(p_event?'result_schema')and coalesce(p_event->'error','null')='null');job.heartbeat_at:=at_value;job.lease_expires_at:=at_value+interval'90seconds';
 elsif p_event->>'event_type'='progress'then
  perform eps.specs_stage_assert(eps.specs_stage_shape(p_event->'result',array['progress_completed','progress_total'])and eps.specs_stage_integer(p_event#>'{result,progress_completed}',job.progress_completed)and(p_event#>'{result,progress_total}'='null'or eps.specs_stage_integer(p_event#>'{result,progress_total}',(p_event#>>'{result,progress_completed}')::bigint)),'INVALID_PROGRESS');job.progress_completed:=(p_event#>>'{result,progress_completed}')::bigint;job.progress_total:=(p_event#>>'{result,progress_total}')::bigint;
 elsif p_event->>'event_type'='failed'then
  perform eps.specs_stage_assert(not(p_event?'result')and eps.specs_stage_shape(p_event->'error',array['code','message','details','retryable'])and jsonb_typeof(p_event#>'{error,code}')='string'and length(p_event#>>'{error,code}')between 1 and 200 and jsonb_typeof(p_event#>'{error,retryable}')='boolean');safe_error:=eps.specs_stage_error(p_event#>>'{error,code}',(p_event#>>'{error,retryable}')::boolean);
 else
  begin
   if job.kind='review_fit'then
    perform eps.specs_stage_assert(p_event->>'result_schema'='review-fit-measurement.v1','RESULT_INVALID');perform eps.review_validate_fit(job,p_event->'result');
    -- A changed source never publishes a successful fit for a different snapshot.
    perform eps.specs_stage_assert(eps.review_stage_source_matches(job),'INPUT_CHANGED');
    insert into eps.review_fit_results(job_id,workspace_id,series_id,input_fingerprint,status,result)values(job.id,job.workspace_id,job.resource_id,job.input->>'expected_input_fingerprint','measured',p_event->'result');
   elsif job.stage='prepare_suggestion'then
    perform eps.specs_stage_assert(p_event->>'result_schema'='suggestion-preparation.v1'and eps.specs_stage_shape(p_event->'result',array['schema_version','target_id','target_row_version','field','source_text'])and p_event#>>'{result,schema_version}'='1.0'and p_event#>>'{result,target_id}'=job.input->>'target_id'and p_event#>'{result,target_row_version}'=job.input->'target_row_version'and p_event#>>'{result,field}'=job.input->>'field'and p_event#>>'{result,source_text}'=job.input->>'source_text','RESULT_INVALID');
   else
    perform eps.specs_stage_assert(p_event->>'result_schema'=case job.stage when'generate_suggestion'then'contextual-suggestion.v1'else'suggestion-validation.v1'end,'RESULT_INVALID');perform eps.review_validate_proposal(job,p_event->'result');
    if job.stage='validate_suggestion'then
     select payload into generated from eps.review_stage_payloads where job_id=job.id and input_hash=job.input_hash and stage='generate_suggestion';perform eps.specs_stage_assert(found and generated=p_event->'result','RESULT_INVALID');
     perform eps.specs_stage_assert(eps.review_stage_source_matches(job),'INPUT_CHANGED');
     update eps.ai_suggestions set proposal=p_event->'result'where id=job.resource_id and job_id=job.id and workspace_id=job.workspace_id;
     perform eps.specs_stage_assert(found,'STAGE_STATE_INVALID');
    end if;
   end if;
   insert into eps.review_stage_payloads(job_id,workspace_id,stage,attempt_id,input_hash,result_schema,payload)values(job.id,job.workspace_id,job.stage,attempt,job.input_hash,p_event->>'result_schema',p_event->'result')returning id into payload_id;
  exception when raise_exception then
   if sqlerrm in('INPUT_CHANGED','STALE_RESOURCE_VERSION')then job.status:='waiting_for_input';safe_error:=eps.specs_stage_error('INPUT_CHANGED',false);
   elsif sqlerrm in('RESULT_INVALID','INVALID_REQUEST')then safe_error:=eps.specs_stage_error('RESULT_INVALID',false);else raise;end if;
  end;
  if safe_error is null then
   job.completed_stages:=job.completed_stages||jsonb_build_array(jsonb_build_object('stage',job.stage,'attempt_id',attempt,'input_hash',job.input_hash,'result_schema',p_event->>'result_schema','result',jsonb_build_object('stage_output_id',payload_id),'completed_at',at_value));
   next_stage:=case job.stage when'prepare_suggestion'then'generate_suggestion'when'generate_suggestion'then'validate_suggestion'else null end;
   if next_stage is null then job.status:='succeeded';job.result:=case when job.kind='ai_suggestion'then jsonb_build_object('suggestion_id',job.resource_id)else jsonb_build_object('series_id',job.resource_id,'input_fingerprint',job.input->>'expected_input_fingerprint')end;
   else job.status:='queued';job.stage:=next_stage;job.dispatch_generation:=job.dispatch_generation+1;job.available_at:=at_value;job.progress_completed:=0;job.progress_total:=null;end if;
   job.lease_token_digest:=null;job.lease_expires_at:=null;
  end if;
 end if;
 if safe_error is not null then
  job.error:=safe_error;job.lease_token_digest:=null;job.lease_expires_at:=null;
  if job.status<>'waiting_for_input'then
   if safe_error->'retryable'='true'and coalesce((job.stage_attempts->>job.stage)::integer,0)<3 then job.status:='queued';job.dispatch_generation:=job.dispatch_generation+1;job.available_at:=at_value+interval'2seconds';else job.status:='failed';end if;
  end if;
  if job.kind='review_fit'and job.status='failed'then insert into eps.review_fit_results(job_id,workspace_id,series_id,input_fingerprint,status,error_code)values(job.id,job.workspace_id,job.resource_id,job.input->>'expected_input_fingerprint','failed','FIT_MEASUREMENT_FAILED');end if;
 end if;
 update eps.jobs set status=job.status,stage=job.stage,completed_stages=job.completed_stages,result=job.result,error=job.error,last_event_sequence=sequence_value,heartbeat_at=job.heartbeat_at,lease_expires_at=job.lease_expires_at,lease_token_digest=job.lease_token_digest,available_at=job.available_at,dispatch_generation=job.dispatch_generation,progress_completed=job.progress_completed,progress_total=job.progress_total,row_version=row_version+1,updated_at=at_value where id=job.id;
 if job.status='queued'then insert into eps.outbox_events(job_id,stage,input_hash,dispatch_generation,dedupe_key,available_at)values(job.id,job.stage,job.input_hash,job.dispatch_generation,job.id::text||':'||job.dispatch_generation::text,job.available_at);end if;
 receipt:=receipt||jsonb_build_object('applied',true,'job_status',job.status);
 insert into eps.job_events(job_id,attempt_id,event_id,sequence,stage,event_type,payload_digest,receipt)values(job.id,attempt,p_event->>'event_id',sequence_value,p_event->>'stage',p_event->>'event_type',digest,receipt);return receipt;
end$$;
create function eps.recover_review_job_stages(p_limit integer)returns integer language plpgsql volatile security definer set search_path=''as $$
declare item record;job eps.jobs;recovered integer:=0;obsolete boolean;at_value timestamptz;begin
 perform eps.specs_stage_assert(p_limit between 0 and 100);if p_limit=0 then return 0;end if;
 for item in select id,workspace_id from eps.jobs where kind in('ai_suggestion','review_fit')and status in('queued','running')order by lease_expires_at nulls last,id limit 1000 loop
  exit when recovered>=p_limit;
  perform 1 from eps.workspaces where id=item.workspace_id for update skip locked;if not found then continue;end if;
  job:=eps.review_stage_lock(item.id,false);if job.status not in('queued','running')or job.cancel_requested_at is not null then continue;end if;at_value:=clock_timestamp();obsolete:=not eps.review_stage_can_write(job.requested_by,job.workspace_id,job.kind)or not eps.review_stage_source_matches(job);
  if not obsolete and(job.status='queued'or job.lease_expires_at>at_value)then continue;end if;
  if obsolete then job.status:='waiting_for_input';job.error:=eps.specs_stage_error('INPUT_CHANGED',false);
  elsif coalesce((job.stage_attempts->>job.stage)::integer,0)>=3 then job.status:='failed';job.error:=eps.specs_stage_error('RETRY_EXHAUSTED',false);
  else job.status:='queued';job.error:=eps.specs_stage_error('LEASE_EXPIRED');job.dispatch_generation:=job.dispatch_generation+1;job.available_at:=at_value+interval'2seconds';end if;
  update eps.jobs set status=job.status,error=job.error,lease_token_digest=null,lease_expires_at=null,available_at=job.available_at,dispatch_generation=job.dispatch_generation,row_version=row_version+1,updated_at=at_value where id=job.id;
  if job.status='queued'then insert into eps.outbox_events(job_id,stage,input_hash,dispatch_generation,dedupe_key,available_at)values(job.id,job.stage,job.input_hash,job.dispatch_generation,job.id::text||':'||job.dispatch_generation::text,job.available_at);
  elsif job.kind='review_fit'and job.status='failed'then insert into eps.review_fit_results(job_id,workspace_id,series_id,input_fingerprint,status,error_code)values(job.id,job.workspace_id,job.resource_id,job.input->>'expected_input_fingerprint','failed','FIT_MEASUREMENT_FAILED')on conflict(job_id)do nothing;end if;
  recovered:=recovered+1;
 end loop;return recovered;
end$$;
create or replace function public.eps_get_workspace_review(p_workspace_id uuid,p_series_id uuid,p_output_type text default null)returns jsonb language plpgsql stable security definer set search_path=''as $$
declare review jsonb;fit eps.review_fit_results;overflows jsonb;issue jsonb;entry jsonb;begin
 review:=eps.review_snapshot(p_workspace_id,p_series_id,p_output_type);
 select * into fit from eps.review_fit_results where workspace_id=p_workspace_id and series_id=p_series_id and input_fingerprint=review->>'input_fingerprint'order by completed_at desc,job_id desc limit 1;
 if not found then return review||jsonb_build_object('can_generate',false,'issues',review->'issues'||jsonb_build_array(eps.review_issue('FIT_MEASUREMENT_REQUIRED','blocking',p_series_id,null,'This exact template snapshot has not been measured.','Measure the current review layout.')),'fit',jsonb_build_object('status','unmeasured','input_fingerprint',null,'measured_at',null,'overflows','[]'::jsonb,'error_code','FIT_MEASUREMENT_REQUIRED'));end if;
 if fit.status='failed'then return review||jsonb_build_object('can_generate',false,'issues',review->'issues'||jsonb_build_array(eps.review_issue('FIT_MEASUREMENT_FAILED','blocking',p_series_id,null,'Layout measurement failed. Saved content was retained.','Retry layout measurement.')),'fit',jsonb_build_object('status','failed','input_fingerprint',fit.input_fingerprint,'measured_at',null,'overflows','[]'::jsonb,'error_code',fit.error_code));end if;
 overflows:=fit.result->'overflows';
 for entry in select value from jsonb_array_elements(overflows)loop
  issue:=eps.review_issue('LAYOUT_OVERFLOW','blocking',case when(entry->>'slide_index')::integer=0 then p_series_id else nullif(review#>>array['slides',((entry->>'slide_index')::integer-1)::text,'assignment_id'],'')::uuid end,entry->>'field','Text exceeds the selected slide layout.','Shorten this display field or correct its supplied content, then measure again.');review:=review||jsonb_build_object('issues',review->'issues'||jsonb_build_array(issue));
 end loop;
 return review||jsonb_build_object('can_generate',(review->'can_generate'='true')and jsonb_array_length(overflows)=0,'fit',jsonb_build_object('status','measured','input_fingerprint',fit.input_fingerprint,'measured_at',fit.result->>'measured_at','overflows',overflows,'error_code',null));
end$$;

grant create on schema eps,public to eps_review_owner,eps_review_stage_owner;
alter function eps.review_target_context(uuid,text,uuid,text)owner to eps_review_owner;
revoke all on function eps.review_target_context(uuid,text,uuid,text)from public,anon,authenticated,service_role;
grant execute on function eps.review_target_context(uuid,text,uuid,text)to eps_review_stage_owner;
do $$declare routine regprocedure;begin
 for routine in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='eps'and(p.proname like'review_stage_%'or p.proname in('review_is_job','claim_review_job_stage','get_review_stage_input','record_review_job_event','recover_review_job_stages','review_validate_proposal','review_validate_fit'))loop
  execute format('alter function %s owner to eps_review_stage_owner',routine);execute format('revoke all on function %s from public,anon,authenticated,service_role',routine);
 end loop;
end$$;
alter function public.eps_create_ai_suggestion(jsonb,text)owner to eps_review_owner;
alter function public.eps_get_ai_suggestion(uuid)owner to eps_review_owner;
alter function public.eps_request_workspace_review_fit(uuid,uuid,jsonb,text)owner to eps_review_owner;
alter function public.eps_get_workspace_review(uuid,uuid,text)owner to eps_review_owner;
revoke create on schema eps,public from eps_review_owner,eps_review_stage_owner;
revoke all on function public.eps_create_ai_suggestion(jsonb,text),public.eps_get_ai_suggestion(uuid),public.eps_request_workspace_review_fit(uuid,uuid,jsonb,text),public.eps_get_workspace_review(uuid,uuid,text)from public,anon,authenticated,service_role;
grant execute on function public.eps_create_ai_suggestion(jsonb,text),public.eps_get_ai_suggestion(uuid),public.eps_request_workspace_review_fit(uuid,uuid,jsonb,text),public.eps_get_workspace_review(uuid,uuid,text)to authenticated;
grant execute on function eps.review_is_job(uuid),eps.review_stage_lock(uuid,boolean),eps.review_stage_source_matches(eps.jobs),eps.claim_review_job_stage(jsonb),eps.get_review_stage_input(uuid,uuid,text),eps.record_review_job_event(jsonb),eps.recover_review_job_stages(integer)to eps_specs_stage_owner;

-- Closed dispatch only, exact preceding source hashes. The original user and
-- service ports/owners/ACLs remain; no caller chooses a new handler or SQL name.
do $dispatch$
declare item record;source text;definition text;replacement text;anchor text;start_at integer;begin
 for item in select * from(values
 ('eps.claim_job_stage(jsonb)','a1dc5c518d686b1423c5fb3f8defee6b81b85b39c23a607059d706d396363322',E'begin\n if p_input->>''stage''in(''prepare_suggestion'',''generate_suggestion'',''validate_suggestion'',''measure_review_fit'')then return eps.claim_review_job_stage(p_input);end if;\n'),
 ('eps.get_specs_stage_input(uuid,uuid,text)','89d180bb49abd83b5e00b3a0ac37037bbabbe136682123952a337f92b46f63b4',E'begin\n if eps.review_is_job(p_job_id)then return eps.get_review_stage_input(p_job_id,p_attempt_id,p_lease_token);end if;\n'),
 ('eps.record_job_event(jsonb)','0cafccb9f712f73a3c7e22605ac61407a2486c07e0a650263db9a82889b0c873',E'begin\n if p_event->>''stage''in(''prepare_suggestion'',''generate_suggestion'',''validate_suggestion'',''measure_review_fit'')then return eps.record_review_job_event(p_event);end if;\n'),
 ('eps.recover_job_stages(integer)','c1bdac48813a2a6061ea4c8ff8a353329e9fa0e0d32d8beef93b334cebcd08fd',E'begin\n recovered:=eps.recover_review_job_stages(p_limit);\n')
 )v(signature,expected_sha256,insert_value)loop
  select prosrc,pg_get_functiondef(oid)into source,definition from pg_proc where oid=item.signature::regprocedure;
  if encode(sha256(convert_to(replace(source,E'\r\n',E'\n'),'UTF8')),'hex')<>item.expected_sha256 then raise exception'M04_REVIEW_PRECEDING_DISPATCH_SOURCE_REQUIRED';end if;
  start_at:=position('begin'in source);anchor:=case when substring(source from start_at for 7)=E'begin\r\n' then E'begin\r\n'else E'begin\n'end;
  if substring(source from start_at for length(anchor))<>anchor then raise exception'M04_REVIEW_DISPATCH_BEGIN_REQUIRED';end if;
  if anchor=E'begin\r\n' then item.insert_value:=replace(item.insert_value,E'\n',E'\r\n');end if;
  replacement:=overlay(source placing item.insert_value from start_at for length(anchor));
  if replacement=source then raise exception'M04_REVIEW_DISPATCH_ANCHOR_REQUIRED';end if;execute replace(definition,source,replacement);
 end loop;
 select prosrc,pg_get_functiondef(oid)into source,definition from pg_proc where oid='eps.claim_job_stage_replay(jsonb,text,text,text)'::regprocedure;
 if encode(sha256(convert_to(replace(source,E'\r\n',E'\n'),'UTF8')),'hex')<>'3848197d49b97eb0a9b28d688b07771b895c2bf57166ab64072abac1e29369b9'then raise exception'M04_REVIEW_PRECEDING_REPLAY_SOURCE_REQUIRED';end if;
 replacement:=replace(source,'job:=eps.specs_stage_lock(old.job_id);','if eps.review_is_job(old.job_id)then job:=eps.review_stage_lock(old.job_id);else job:=eps.specs_stage_lock(old.job_id);end if;');
 replacement:=replace(replacement,'else eps.specs_stage_source_matches(job) end','when job.kind in(''ai_suggestion'',''review_fit'')then eps.review_stage_source_matches(job) else eps.specs_stage_source_matches(job) end');
 if replacement=source or position('eps.review_stage_source_matches(job)'in replacement)=0 then raise exception'M04_REVIEW_REPLAY_ANCHOR_REQUIRED';end if;execute replace(definition,source,replacement);
end$dispatch$;
notify pgrst,'reload schema';
