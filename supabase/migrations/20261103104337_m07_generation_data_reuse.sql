CREATE OR REPLACE FUNCTION eps.presentation_lock_sources(p_workspace uuid, p_template_key text, p_template_version text) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare project_id uuid;client_id uuid;v_pool_ids uuid[];v_candidate_ids uuid[];v_media_ids uuid[];v_frame_asset_ids uuid[];v_pair_media_ids uuid[];v_pair_asset_ids uuid[];v_asset_ids uuid[];begin
 if not eps.presentation_scope(p_workspace,true)then perform eps.fail('RESOURCE_NOT_FOUND','Writable presentation workspace not found.',404);end if;
 select w.project_id into project_id from eps.workspaces w where w.id=p_workspace;
 begin
  select p.client_id into client_id from public.projects p where p.id=project_id for share nowait;
  perform 1 from public.clients c where c.id=client_id for share nowait;
  perform 1 from eps.presentation_templates t where t.key=p_template_key and t.version=p_template_version for share nowait;
  perform 1 from eps.specs where workspace_id=p_workspace order by id for share nowait;
  perform 1 from eps.roles where workspace_id=p_workspace and archived_at is null order by id for share nowait;
  perform 1 from eps.slots where workspace_id=p_workspace and archived_at is null order by id for share nowait;
  select coalesce(array_agg(distinct locked.workspace_candidate_id order by locked.workspace_candidate_id),'{}'::uuid[])into v_pool_ids
   from(
    select a.workspace_candidate_id from eps.assignments a
    where a.workspace_id=p_workspace and a.archived_at is null order by a.id for share nowait
   )locked;
  -- Keep archived pools referenced by active assignments. Every ordered lock
  -- stream is consumed fully before the next source table is locked.
  with selected as materialized(
   select distinct locked.id,locked.candidate_id,locked.selected_candidate_media_id,locked.selected_frame_asset_ids
   from(
    select p.id,p.candidate_id,p.selected_candidate_media_id,p.selected_frame_asset_ids
    from eps.workspace_candidates p
    where p.workspace_id=p_workspace and p.id=any(v_pool_ids)order by p.id for share nowait
   )locked
  ),frames as materialized(
   select s.selected_candidate_media_id media_id,f.asset_id
   from selected s cross join lateral unnest(s.selected_frame_asset_ids)f(asset_id)
  ),pairs as materialized(
   select distinct media_id,asset_id from frames where media_id is not null and asset_id is not null
  )
  select
   (select coalesce(array_agg(id order by id),'{}'::uuid[])from selected),
   (select coalesce(array_agg(distinct candidate_id order by candidate_id),'{}'::uuid[])from selected where candidate_id is not null),
   (select coalesce(array_agg(distinct selected_candidate_media_id order by selected_candidate_media_id),'{}'::uuid[])from selected where selected_candidate_media_id is not null),
   (select coalesce(array_agg(distinct asset_id order by asset_id),'{}'::uuid[])from frames where asset_id is not null),
   (select coalesce(array_agg(media_id order by media_id,asset_id),'{}'::uuid[])from pairs),
   (select coalesce(array_agg(asset_id order by media_id,asset_id),'{}'::uuid[])from pairs)
  into v_pool_ids,v_candidate_ids,v_media_ids,v_frame_asset_ids,v_pair_media_ids,v_pair_asset_ids;
  perform 1 from eps.candidates c where c.id=any(v_candidate_ids)order by c.id for share nowait;
  select coalesce(array_agg(distinct locked.source_asset_id order by locked.source_asset_id),'{}'::uuid[])into v_asset_ids
   from(
    select m.source_asset_id from eps.candidate_media m
    where m.id=any(v_media_ids)order by m.id for share nowait
   )locked;
  -- Reuse source IDs returned by the fully consumed media lock acquisition.
  -- Keep frame IDs even when no media/frame link is available.
  select coalesce(array_agg(distinct wanted.asset_id order by wanted.asset_id),'{}'::uuid[])into v_asset_ids
   from(select w.logo_asset_id asset_id from eps.workspaces w where w.id=p_workspace
    union all select unnest(v_asset_ids)
    union all select unnest(v_frame_asset_ids))wanted where wanted.asset_id is not null;
  perform 1 from eps.media_assets m where m.id=any(v_asset_ids)order by m.id for share nowait;
  -- Use exact media/frame pairs, not the cross product of two selected sets.
  perform 1 from eps.candidate_media_frames f
   where(f.candidate_media_id,f.asset_id)in(select k.media_id,k.asset_id from unnest(v_pair_media_ids,v_pair_asset_ids)k(media_id,asset_id))
   order by f.candidate_media_id,f.asset_id for share nowait;
 exception when lock_not_available then perform eps.fail('INPUT_CHANGED','Presentation source information is changing. Refresh review before generating.',409);end;
 if not eps.presentation_scope(p_workspace,true)then perform eps.fail('RESOURCE_NOT_FOUND','Writable presentation workspace changed.',404);end if;
end$$;

CREATE OR REPLACE FUNCTION eps.review_snapshot_data(p_workspace uuid, p_series_id uuid, p_output text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql STABLE
    SET search_path TO ''
    AS $$
declare workspace eps.workspaces;series eps.presentation_series;project public.projects;client public.clients;role_item eps.roles;slot_item eps.slots;assignment eps.assignments;pool eps.workspace_candidates;candidate eps.candidates;media eps.candidate_media;asset eps.media_assets;logo eps.media_assets;
 cover jsonb;slides jsonb:='[]';issues jsonb:='[]';inputs jsonb:='[]';frames jsonb;frame_input jsonb;source_fields jsonb;fields jsonb;slide jsonb;field_item record;frame_id uuid;candidate_count integer:=0;pending_count integer:=0;slot_assignments integer;reviewed boolean;fingerprint text;unreviewed uuid[]:='{}';blank_fields jsonb;role_inputs jsonb;slot_inputs jsonb;
 -- Private per-invocation row data only. No misses or authority results retained.
 reuse_bytes bigint:=0;reuse_cost bigint;reuse_key text;reuse_pos integer;reuse_found boolean;
 assignment_rows eps.assignments[]:='{}';assignment_row eps.assignments;
 assignment_rows_loaded boolean:=false;assignment_rows_complete boolean:=false;
 assignment_rows_start_bytes bigint;slot_has_main boolean;
 reuse_roles eps.roles[]:='{}';reuse_slots eps.slots[]:='{}';reuse_roles_complete boolean:=true;reuse_slots_complete boolean:=true;
 reuse_pools_keys text[]:='{}';reuse_pools eps.workspace_candidates[]:='{}';
 reuse_candidates_keys text[]:='{}';reuse_candidates eps.candidates[]:='{}';
 reuse_media_keys text[]:='{}';reuse_media eps.candidate_media[]:='{}';
 reuse_videos_keys text[]:='{}';reuse_videos eps.media_assets[]:='{}';
 reuse_frames_keys text[]:='{}';reuse_frames eps.media_assets[]:='{}';
begin
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
   reuse_key:=role_item.id::text;reuse_cost:=pg_column_size(role_item)::bigint+octet_length(role_item::text)::bigint+octet_length(reuse_key)+256;
   if reuse_bytes+reuse_cost<=4194304 then
    reuse_roles:=array_append(reuse_roles,role_item);reuse_bytes:=reuse_bytes+reuse_cost;
   else reuse_roles_complete:=false;end if;
  for slot_item in select * from eps.slots where role_id=role_item.id and workspace_id=p_workspace and archived_at is null order by sort_order,id loop
   reuse_key:=slot_item.id::text;reuse_cost:=pg_column_size(slot_item)::bigint+octet_length(slot_item::text)::bigint+octet_length(reuse_key)+256;
   if reuse_bytes+reuse_cost<=4194304 then
    reuse_slots:=array_append(reuse_slots,slot_item);reuse_bytes:=reuse_bytes+reuse_cost;
   else reuse_slots_complete:=false;end if;
   slot_assignments:=0;slot_has_main:=false;
   if slot_item.provisional then issues:=issues||jsonb_build_array(eps.review_issue('ROLE_NEEDS_CLARIFICATION','warning',role_item.id,'headcount','This role has an unconfirmed headcount.','Confirm the supplied headcount when available.'));end if;
   if not assignment_rows_loaded then
    assignment_rows_loaded:=true;assignment_rows_complete:=true;
    assignment_rows_start_bytes:=reuse_bytes;
    -- Rows only, read under the original invoker RLS and STABLE snapshot.
    for assignment_row in select * from eps.assignments where workspace_id=p_workspace and archived_at is null and(series.output_type='selection'or shortlist_included)order by slot_id,sort_order,id loop
     reuse_cost:=pg_column_size(assignment_row)::bigint+octet_length(assignment_row::text)::bigint+octet_length(assignment_row.id::text)+256;
     if reuse_bytes+reuse_cost>4194304 then
      -- A partial collection can never stand for a complete enumeration.
      assignment_rows:='{}'::eps.assignments[];reuse_bytes:=assignment_rows_start_bytes;
      assignment_rows_complete:=false;exit;
     end if;
     assignment_rows:=array_append(assignment_rows,assignment_row);reuse_bytes:=reuse_bytes+reuse_cost;
    end loop;
   end if;
   for assignment in
    select cached.* from unnest(assignment_rows)cached where assignment_rows_complete and cached.workspace_id=p_workspace and cached.slot_id=slot_item.id and cached.archived_at is null and(series.output_type='selection'or cached.shortlist_included)
    union all
    select * from eps.assignments where not assignment_rows_complete and workspace_id=p_workspace and slot_id=slot_item.id and archived_at is null and(series.output_type='selection'or shortlist_included)order by sort_order,id loop
    slot_assignments:=slot_assignments+1;candidate_count:=candidate_count+1;
    if assignment.position='main'then slot_has_main:=true;end if;
    reuse_key:=assignment.workspace_candidate_id::text||':'||p_workspace::text;reuse_pos:=array_position(reuse_pools_keys,reuse_key);
     if reuse_pos is not null then pool:=reuse_pools[reuse_pos];reuse_found:=true;
     else
      select * into pool from eps.workspace_candidates where id=assignment.workspace_candidate_id and workspace_id=p_workspace and archived_at is null;
      reuse_found:=found;
      if reuse_found then
       reuse_cost:=pg_column_size(pool)::bigint+octet_length(pool::text)::bigint+octet_length(reuse_key)+256;
       if reuse_bytes+reuse_cost<=4194304 then
        reuse_pools_keys:=array_append(reuse_pools_keys,reuse_key);reuse_pools:=array_append(reuse_pools,pool);reuse_bytes:=reuse_bytes+reuse_cost;
       end if;
      end if;
     end if;
     if not reuse_found then perform eps.fail('ASSIGNMENT_STATE_INVALID','An assigned project candidate is unavailable.',409);end if;
    reuse_key:=pool.candidate_id::text;reuse_pos:=array_position(reuse_candidates_keys,reuse_key);
     if reuse_pos is not null then candidate:=reuse_candidates[reuse_pos];reuse_found:=true;
     else
      select * into candidate from eps.candidates where id=pool.candidate_id;
      reuse_found:=found;
      if reuse_found then
       reuse_cost:=pg_column_size(candidate)::bigint+octet_length(candidate::text)::bigint+octet_length(reuse_key)+256;
       if reuse_bytes+reuse_cost<=4194304 then
        reuse_candidates_keys:=array_append(reuse_candidates_keys,reuse_key);reuse_candidates:=array_append(reuse_candidates,candidate);reuse_bytes:=reuse_bytes+reuse_cost;
       end if;
      end if;
     end if;
     if not reuse_found then perform eps.fail('ASSIGNMENT_STATE_INVALID','An assigned shared profile is unavailable.',409);end if;
    reviewed:=candidate.reviewed_facts_fingerprint is not null and candidate.reviewed_facts_fingerprint=eps.cast_fingerprint(candidate.facts,candidate.field_sources);
    if not reviewed then if not candidate.id=any(unreviewed)then unreviewed:=array_append(unreviewed,candidate.id);end if;issues:=issues||jsonb_build_array(eps.review_issue('UNREVIEWED_PROFILE','warning',candidate.id,null,'Supplied profile facts are unreviewed.','Review the supplied facts if needed.'));end if;
    if candidate.archived_at is not null or candidate.merged_into_candidate_id is not null then issues:=issues||jsonb_build_array(eps.review_issue('PROFILE_ARCHIVED','warning',candidate.id,null,'This assignment uses a retained archived profile.','Inspect the current project choice.'));end if;
    source_fields:=eps.review_fields(candidate.facts,pool.availability,assignment.presentation_notes);fields:=source_fields||jsonb_strip_nulls(assignment.slide_wording);
    frames:='[]';frame_input:='[]';media:=null;asset:=null;
    if pool.selected_candidate_media_id is not null then
     reuse_key:=pool.selected_candidate_media_id::text||':'||candidate.id::text;reuse_pos:=array_position(reuse_media_keys,reuse_key);
     if reuse_pos is not null then media:=reuse_media[reuse_pos];reuse_found:=true;
     else
      select * into media from eps.candidate_media where id=pool.selected_candidate_media_id and candidate_id=candidate.id;
      reuse_found:=found;
      if reuse_found then
       reuse_cost:=pg_column_size(media)::bigint+octet_length(media::text)::bigint+octet_length(reuse_key)+256;
       if reuse_bytes+reuse_cost<=4194304 then
        reuse_media_keys:=array_append(reuse_media_keys,reuse_key);reuse_media:=array_append(reuse_media,media);reuse_bytes:=reuse_bytes+reuse_cost;
       end if;
      end if;
     end if;
     if not reuse_found then issues:=issues||jsonb_build_array(eps.review_issue('MEDIA_UNAVAILABLE','blocking',pool.id,null,'Selected introduction no longer matches this profile.','Choose an available introduction.'));
     else reuse_key:=media.source_asset_id::text;reuse_pos:=array_position(reuse_videos_keys,reuse_key);
     if reuse_pos is not null then asset:=reuse_videos[reuse_pos];reuse_found:=true;
     else
      select * into asset from eps.media_assets where id=media.source_asset_id;
      reuse_found:=found;
      if reuse_found then
       reuse_cost:=pg_column_size(asset)::bigint+octet_length(asset::text)::bigint+octet_length(reuse_key)+256;
       if reuse_bytes+reuse_cost<=4194304 then
        reuse_videos_keys:=array_append(reuse_videos_keys,reuse_key);reuse_videos:=array_append(reuse_videos,asset);reuse_bytes:=reuse_bytes+reuse_cost;
       end if;
      end if;
     end if;
     if not reuse_found or asset.status<>'ready'then issues:=issues||jsonb_build_array(eps.review_issue('MEDIA_UNAVAILABLE','blocking',pool.id,null,'Selected original video is unavailable.','Choose an available introduction.'));end if;
     end if;
    end if;
    foreach frame_id in array pool.selected_frame_asset_ids loop
     declare frame_asset eps.media_assets;begin
      reuse_key:=frame_id::text||':'||media.id::text||':'||media.source_asset_id::text;reuse_pos:=array_position(reuse_frames_keys,reuse_key);
     if reuse_pos is not null then frame_asset:=reuse_frames[reuse_pos];reuse_found:=true;
     else
      select * into frame_asset from eps.media_assets f where f.id=frame_id and f.status='ready'and f.purpose='candidate_frame'and f.source_asset_id=media.source_asset_id and f.sha256 is not null and f.width>0 and f.height>0 and f.source_timestamp_ms>=0 and exists(select 1 from eps.candidate_media_frames link where link.candidate_media_id=media.id and link.asset_id=f.id);
      reuse_found:=found;
      if reuse_found then
       reuse_cost:=pg_column_size(frame_asset)::bigint+octet_length(frame_asset::text)::bigint+octet_length(reuse_key)+256;
       if reuse_bytes+reuse_cost<=4194304 then
        reuse_frames_keys:=array_append(reuse_frames_keys,reuse_key);reuse_frames:=array_append(reuse_frames,frame_asset);reuse_bytes:=reuse_bytes+reuse_cost;
       end if;
      end if;
     end if;
     if not reuse_found then frame_input:=frame_input||jsonb_build_array(jsonb_build_object('asset_id',frame_id,'available',false));issues:=issues||jsonb_build_array(eps.review_issue('FRAME_UNAVAILABLE','blocking',frame_id,null,'A selected source frame is unavailable.','Choose an available frame or clear the selection.'));
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
   elsif not slot_has_main then issues:=issues||jsonb_build_array(eps.review_issue('NO_MAIN','warning',slot_item.id,null,'This output slot has no Main choice.','A Main is optional.'));end if;
  end loop;
 end loop;
 if jsonb_array_length(slides)=0 then pending_count:=1;slides:=jsonb_build_array(jsonb_build_object('kind','pending','role_id',null,'role_name','Requirements pending','slot_id',null,'slot_label','Pending','assignment_id',null,'workspace_candidate_id',null,'candidate_id',null,'candidate_media_id',null,'assignment_row_version',null,'workspace_candidate_row_version',null,'candidate_row_version',null,'position',null,'review_status',null,'fields',blank_fields,'source_fields',blank_fields,'frames','[]'::jsonb,'video_asset_id',null,'requirements',jsonb_build_object('age_range',null,'gender_requirement',null,'appearance_performance',null,'languages','[]'::jsonb,'accents','[]'::jsonb,'skills','[]'::jsonb,'scene_references','[]'::jsonb,'shoot_dates','[]'::jsonb,'location',null,'availability_requirements',null,'other_instructions',null),'provisional',true));issues:=issues||jsonb_build_array(eps.review_issue('NO_REQUIREMENTS','warning',null,null,'Workspace requirements are Pending.','Continue with Pending or enter supplied roles.'));end if;
 if candidate_count+pending_count+1>1000 or octet_length(slides::text)>8388608 then perform eps.fail('REVIEW_TOO_LARGE','The exact review exceeds the technical snapshot budget.',503);end if;
 if series.template_version='1.1.0'then
  select coalesce(jsonb_agg(v||jsonb_build_object('role_category',(case when reuse_roles_complete then (select r.category from unnest(reuse_roles)r where r.id=(v->>'role_id')::uuid)else (select r.category from eps.roles r where r.id=(v->>'role_id')::uuid)end))order by ord),'[]'::jsonb)into slides from jsonb_array_elements(slides)with ordinality s(v,ord);
 end if;
 if reuse_roles_complete then
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'headcount',headcount,'category',category,'requirements',requirements,'clarifications',clarifications,'sort_order',sort_order)order by sort_order,id),'[]')into role_inputs from unnest(reuse_roles);
 else
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'headcount',headcount,'category',category,'requirements',requirements,'clarifications',clarifications,'sort_order',sort_order)order by sort_order,id),'[]')into role_inputs from eps.roles where workspace_id=p_workspace and archived_at is null;
 end if;
 if reuse_roles_complete and reuse_slots_complete then
  select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'role_id',s.role_id,'label',s.label,'provisional',s.provisional,'sort_order',s.sort_order)order by r.sort_order,r.id,s.sort_order,s.id),'[]')into slot_inputs from unnest(reuse_slots)s join unnest(reuse_roles)r on r.id=s.role_id where s.workspace_id=p_workspace and s.archived_at is null and r.archived_at is null;
 else
  select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'role_id',s.role_id,'label',s.label,'provisional',s.provisional,'sort_order',s.sort_order)order by r.sort_order,r.id,s.sort_order,s.id),'[]')into slot_inputs from eps.slots s join eps.roles r on r.id=s.role_id where s.workspace_id=p_workspace and s.archived_at is null and r.archived_at is null;
 end if;
 fingerprint:=encode(sha256(convert_to(jsonb_build_object('schema_version','eps.review-input.pg-jsonb.v1','series_id',series.id,'audience_snapshot',series.audience_snapshot,'template',eps.review_template_dto(series),'cover',cover,'logo',case when workspace.logo_asset_id is null then null else jsonb_build_object('id',workspace.logo_asset_id,'sha256',logo.sha256,'width',logo.width,'height',logo.height,'status',logo.status)end,'roles',role_inputs,'slots',slot_inputs,'assignments',inputs,'general_requirements',(select normalized_instructions from eps.specs where workspace_id=p_workspace))::text,'UTF8')),'hex');
 return jsonb_build_object('workspace_id',p_workspace,'series_id',series.id,'input_fingerprint',fingerprint,'draft_revision',workspace.draft_revision,'output_type',series.output_type,'candidate_slide_count',candidate_count,'pending_slide_count',pending_count,'issues',issues,'can_generate',not exists(select 1 from jsonb_array_elements(issues)v where v->>'severity'='blocking'),'unreviewed_candidate_ids',to_jsonb(unreviewed),'template',eps.review_template_dto(series),'cover',cover,'slides',slides);
end$$;

CREATE OR REPLACE FUNCTION eps.review_snapshot(p_workspace uuid, p_series_id uuid, p_output text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql STABLE
    SET search_path TO ''
    AS $$declare data jsonb;begin
 perform eps.review_require(p_workspace);perform eps.require_capability('cast.read');
 data:=eps.review_snapshot_data(p_workspace,p_series_id,p_output);
 -- Repeat current-clock authority checks at return; no authorization is cached.
 perform eps.review_require(p_workspace);perform eps.require_capability('cast.read');return data;
end$$;

CREATE OR REPLACE FUNCTION public.eps_generate_version(p_series_id uuid, p_input jsonb, p_idempotency_key text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare series eps.presentation_series;workspace eps.workspaces;template eps.presentation_templates;configuration eps.presentation_processing_config;
 expected_workspace bigint;expected_draft bigint;initial_workspace uuid;payload jsonb;cached jsonb;review jsonb;slide jsonb;frozen jsonb;slides jsonb:='[]';inventory jsonb;manifest jsonb;snapshot jsonb;job_input jsonb;
 version_id uuid:=gen_random_uuid();job_id uuid:=gen_random_uuid();slide_id uuid;version_no bigint;created_at timestamptz;ordinal integer:=0;assets uuid[];capture_assets eps.media_assets[]:='{}'::eps.media_assets[];source eps.media_assets;item jsonb;note text;snapshot_hash text;manifest_hash text;inventory_hash text;input_hash text;begin
 perform eps.require_capability('presentations.generate');perform eps.require_capability('workspaces.write');perform eps.require_capability('cast.read');perform eps.require_capability('workspaces.read');
 perform eps.review_body(p_input,array['expected_workspace_row_version','expected_draft_revision','expected_input_fingerprint','generation_note'],array['expected_workspace_row_version','expected_draft_revision','expected_input_fingerprint']);
 expected_workspace:=eps.casting_version(p_input->'expected_workspace_row_version');
 if jsonb_typeof(p_input->'expected_draft_revision')is distinct from'number'or(p_input->>'expected_draft_revision')!~'^(0|[1-9][0-9]{0,15})$'or(p_input->>'expected_draft_revision')::numeric>9007199254740991
  or jsonb_typeof(p_input->'expected_input_fingerprint')is distinct from'string'or(p_input->>'expected_input_fingerprint')!~'^[a-f0-9]{64}$'then perform eps.fail('VALIDATION_FAILED','Exact generation revisions and review fingerprint are required.',400);end if;
 expected_draft:=(p_input->>'expected_draft_revision')::bigint;
 if p_input?'generation_note'then note:=eps.casting_text(p_input->'generation_note');if length(note)>8000 then perform eps.fail('VALIDATION_FAILED','Generation note is too long.',400);end if;end if;
 select * into series from eps.presentation_series where id=p_series_id and not archived;
 if not found or not eps.presentation_scope(series.workspace_id,true)then perform eps.fail('RESOURCE_NOT_FOUND','Writable presentation series not found.',404);end if;
 initial_workspace:=series.workspace_id;payload:=jsonb_build_object('series_id',p_series_id,'input',p_input);cached:=eps.review_replay('generate_version',p_idempotency_key,payload);
 perform 1 from eps.workspaces where id=series.workspace_id for update;
 if not eps.presentation_scope(series.workspace_id,true)then perform eps.fail('RESOURCE_NOT_FOUND','Writable presentation scope changed.',404);end if;
 if cached is not null then return cached;end if;
 select * into series from eps.presentation_series where id=p_series_id and not archived for update;if not found then perform eps.fail('RESOURCE_NOT_FOUND','Presentation series changed.',404);end if;
 if series.workspace_id is distinct from initial_workspace then perform eps.fail('INPUT_CHANGED','Presentation scope changed. Refresh review.',409);end if;
 if series.template_key<>'everyone-casting'or series.template_version<>'1.1.0'then perform eps.fail('TEMPLATE_UPGRADE_REQUIRED','Select the current presentation template, then refresh review.',409);end if;
 select * into configuration from eps.presentation_processing_config where id and enabled;if not found then perform eps.fail('PRESENTATION_PROCESSING_UNAVAILABLE','Presentation rendering is not enabled.',503);end if;
 perform eps.presentation_lock_sources(series.workspace_id,series.template_key,series.template_version);
 select * into workspace from eps.workspaces where id=series.workspace_id;
 if workspace.row_version<>expected_workspace then perform eps.fail('STALE_RESOURCE_VERSION','Workspace changed. Refresh review before generating.',409,workspace.row_version);end if;
 if workspace.draft_revision<>expected_draft then perform eps.fail('INPUT_CHANGED','The working draft changed. Refresh review before generating.',409);end if;
 review:=public.eps_get_workspace_review(workspace.id,series.id,null);
 if(review->>'input_fingerprint')is distinct from(p_input->>'expected_input_fingerprint')then perform eps.fail('INPUT_CHANGED','Presentation information changed. Refresh review before generating.',409);end if;
 if review->'can_generate'is distinct from'true'::jsonb or review#>>'{fit,status}'is distinct from'measured'or review#>>'{fit,input_fingerprint}'is distinct from review->>'input_fingerprint'or jsonb_array_length(review#>'{fit,overflows}')<>0 then perform eps.fail('LAYOUT_NOT_READY','Measure and resolve the current presentation layout before generating.',409);end if;
 select * into template from eps.presentation_templates where key=series.template_key and version=series.template_version and registered and content_sha256=series.template_content_sha256 and font_key=series.font_key;
 if not found then perform eps.fail('TEMPLATE_UNAVAILABLE','The exact registered template is unavailable.',503);end if;
 version_no:=series.next_version_number;perform eps.casting_advance(version_no);created_at:=clock_timestamp();
 slide_id:=gen_random_uuid();slides:=jsonb_build_array(jsonb_build_object('id',slide_id,'version_id',version_id,'order',0,'kind','cover','assignment_id',null,'candidate_id',null,'role_label',null,'role_category',null,'slot_label',null,'position',null,'fields',null,'requirements',null,'frame_asset_ids','[]'::jsonb,'video_asset_id',null,'logo_asset_id',workspace.logo_asset_id,'role_id',null,'slot_id',null,'candidate_media_id',null,'provisional',false,'review_status',null,'frames','[]'::jsonb));
 for slide in select value from jsonb_array_elements(review->'slides')loop
  ordinal:=ordinal+1;if ordinal>=configuration.max_pages or not(slide?'role_category')then perform eps.fail('SNAPSHOT_INVALID','The exact presentation page contract is invalid or too large.',503);end if;
  slide_id:=gen_random_uuid();frozen:=jsonb_build_object('id',slide_id,'version_id',version_id,'order',ordinal,'kind',slide->'kind','assignment_id',slide->'assignment_id','candidate_id',slide->'candidate_id','role_label',slide->'role_name','role_category',slide->'role_category','slot_label',slide->'slot_label','position',slide->'position','fields',case when slide->>'kind'='candidate'then slide->'fields'else'null'::jsonb end,'requirements',slide->'requirements',
   'frame_asset_ids',coalesce((select jsonb_agg(f->'asset_id'order by position)from jsonb_array_elements(slide->'frames')with ordinality a(f,position)),'[]'::jsonb),'video_asset_id',slide->'video_asset_id','logo_asset_id',case when workspace.logo_placement='every_slide'then workspace.logo_asset_id else null end,'role_id',slide->'role_id','slot_id',slide->'slot_id','candidate_media_id',slide->'candidate_media_id','provisional',slide->'provisional','review_status',slide->'review_status','frames',slide->'frames');
  slides:=slides||jsonb_build_array(frozen);
 end loop;
 select coalesce(array_agg(distinct id order by id),'{}')into assets from(
  select(v->>'video_asset_id')::uuid id from jsonb_array_elements(slides)v union all
  select(v->>'logo_asset_id')::uuid from jsonb_array_elements(slides)v union all
  select(f#>>'{}')::uuid from jsonb_array_elements(slides)v cross join lateral jsonb_array_elements(v->'frame_asset_ids')f
 )a where id is not null;
 select coalesce(array_agg(a order by a.id),'{}'::eps.media_assets[])into capture_assets
 from eps.media_assets a where a.id=any(assets)and a.status='ready'and a.sha256 is not null and a.size_bytes>0 and a.purpose in('client_logo','candidate_frame','candidate_video')and a.bucket in('eps-brand-assets','eps-candidate-assets','eps-candidate-outputs');
 select coalesce(jsonb_agg(jsonb_build_object('asset_id',a.id,'sha256',a.sha256,'asset_kind',a.purpose,'mime_type',a.mime_type,'byte_size',a.size_bytes,'bucket',a.bucket,'object_key',a.object_key,'width',a.width,'height',a.height,'duration_ms',a.duration_ms,'source_asset_id',a.source_asset_id,'timestamp_ms',a.source_timestamp_ms)order by a.id),'[]'::jsonb)into inventory
 from unnest(capture_assets)a;
 if jsonb_array_length(inventory)<>cardinality(assets)then perform eps.fail('ASSET_UNAVAILABLE','A selected source asset cannot be captured.',503);end if;
 snapshot:=jsonb_build_object('schema_version','1.0','hash_protocol','eps-cast-canonical-v1','version_id',version_id,'series_id',series.id,'workspace_id',workspace.id,'project_id',workspace.project_id,'version_no',version_no,'created_at',eps.presentation_time(created_at),'input_workspace_row_version',workspace.row_version,'input_draft_revision',workspace.draft_revision,'input_fingerprint',review->>'input_fingerprint','template',eps.review_template_dto(series)||jsonb_build_object('font_hashes',template.font_hashes),'render_configuration',jsonb_build_object('renderer_version',configuration.renderer_version,'application_origin',configuration.application_origin),'audience_snapshot',series.audience_snapshot,'cover',review->'cover','slides',slides,'asset_inventory',inventory);
 manifest:=eps.presentation_manifest(snapshot);
 if octet_length(snapshot::text)>8388608 or octet_length(manifest::text)>configuration.max_manifest_bytes then perform eps.fail('PDF_BUDGET_EXCEEDED','The captured presentation exceeds the technical metadata budget.',503);end if;
 snapshot_hash:=eps.presentation_hash(snapshot);manifest_hash:=eps.presentation_hash(manifest);inventory_hash:=eps.presentation_hash(inventory);
 job_input:=jsonb_build_object('schema_version','1.0','workspace_id',workspace.id,'series_id',series.id,'version_id',version_id,'snapshot_sha256',snapshot_hash,'manifest_sha256',manifest_hash,'inventory_sha256',inventory_hash,'configuration',snapshot->'render_configuration');input_hash:=eps.presentation_hash(job_input);
 insert into eps.jobs(id,workspace_id,requested_by,kind,resource_id,input,input_hash,input_hash_version,dedupe_key,stage,correlation_id)values(job_id,workspace.id,auth.uid(),'presentation_render',version_id,job_input,input_hash,'eps.presentation-job-input.cast-canonical.v1',encode(sha256(convert_to(auth.uid()::text||':presentation.generate:'||p_idempotency_key,'UTF8')),'hex'),'prepare_presentation',job_id::text);
 insert into eps.presentation_versions(id,series_id,workspace_id,project_id,version_number,input_workspace_row_version,source_draft_revision,input_fingerprint,snapshot,snapshot_sha256,manifest,manifest_sha256,inventory_sha256,page_count,generation_job_id,generated_by,generation_note,created_at,english_transcript_version)
 values(version_id,series.id,workspace.id,workspace.project_id,version_no,workspace.row_version,workspace.draft_revision,review->>'input_fingerprint',snapshot,snapshot_hash,manifest,manifest_hash,inventory_hash,jsonb_array_length(slides),job_id,auth.uid(),note,created_at,'1.0');
 if coalesce(jsonb_array_length(slides),0)>0 then
  insert into eps.version_slides(id,version_id,ordinal,kind,source_assignment_id,source_slot_id,snapshot,content_sha256)select(s.item->>'id')::uuid,version_id,(s.item->>'order')::integer,s.item->>'kind',(s.item->>'assignment_id')::uuid,(s.item->>'slot_id')::uuid,s.item,eps.presentation_hash(s.item)from jsonb_array_elements(slides)with ordinality s(item,slide_position)order by s.slide_position;
 end if;
 if coalesce(cardinality(capture_assets),0)>0 then
  insert into eps.presentation_version_assets(version_id,asset_id,asset_kind,bucket,object_key,mime_type,byte_size,sha256,width,height,duration_ms,source_asset_id,timestamp_ms,filename,asset_created_at)
  select version_id,a.id,a.purpose,a.bucket,a.object_key,a.mime_type,a.size_bytes,a.sha256,a.width,a.height,a.duration_ms,a.source_asset_id,a.source_timestamp_ms,a.filename,a.created_at from unnest(capture_assets)a order by a.id;
 end if;
 perform eps.capture_presentation_video_transcripts(version_id);
 update eps.presentation_series set next_version_number=next_version_number+1,row_version=row_version+1,updated_at=clock_timestamp()where id=series.id;
 insert into eps.outbox_events(job_id,stage,input_hash,dispatch_generation,dedupe_key)values(job_id,'prepare_presentation',input_hash,1,job_id::text||':1');
 return eps.presentation_remember(p_idempotency_key,payload,jsonb_build_object('job_id',job_id,'resource_id',version_id,'status','queued','poll_url','/api/v1/jobs/'||job_id::text),version_id);
end$_$;

CREATE OR REPLACE FUNCTION eps.capture_presentation_video_transcripts(p_version uuid) RETURNS integer
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare version eps.presentation_versions;pin record;media eps.candidate_media;source_ids uuid[];
 value_text text;value_status text;value_hash text;value_languages text[];captured integer:=0;prior_context text;capture_slide_video_ids text[]:='{}'::text[];capture_slide_media_ids text[]:='{}'::text[];capture_video_ids uuid[]:='{}'::uuid[];capture_media_ids uuid[]:='{}'::uuid[];capture_inserted integer:=0;
begin
 select * into version from eps.presentation_versions where id=p_version;
 if not found or version.status<>'queued'or version.generated_by is distinct from auth.uid()
 or not eps.presentation_scope(version.workspace_id,true)
 then perform eps.fail('IMMUTABLE_VERSION','Source companions are captured only by a fresh authorized generation.',409);end if;
 if exists(select 1 from eps.presentation_video_transcripts where version_id=version.id)
 then perform eps.fail('IMMUTABLE_VERSION','The source companion is already captured.',409);end if;
 prior_context:=current_setting('eps.presentation.transcript_capture_version',true);
 perform set_config('eps.presentation.transcript_capture_version',version.id::text,true);
 if exists(select 1 from eps.presentation_version_assets p where p.version_id=version.id and p.asset_kind='candidate_video')then
  select coalesce(array_agg(d.snapshot->>'video_asset_id'order by d.ordinal,d.id),'{}'::text[]),
   coalesce(array_agg(d.snapshot->>'candidate_media_id'order by d.ordinal,d.id),'{}'::text[])
  into capture_slide_video_ids,capture_slide_media_ids
  from eps.version_slides d where d.version_id=version.id and d.kind='candidate';
 end if;
 for pin in select p.asset_id from eps.presentation_version_assets p where p.version_id=version.id and p.asset_kind='candidate_video'order by p.asset_id loop
  select array_agg(distinct(d.candidate_media_id)::uuid)into source_ids from unnest(capture_slide_video_ids,capture_slide_media_ids)d(video_asset_id,candidate_media_id)
   where d.video_asset_id=pin.asset_id::text and d.candidate_media_id is not null;
  if coalesce(cardinality(source_ids),0)<>1 then perform eps.fail('SNAPSHOT_INVALID','The selected original source cannot be captured.',503);end if;
  select * into media from eps.candidate_media where id=source_ids[1]and source_asset_id=pin.asset_id for share;
  if not found then perform eps.fail('SNAPSHOT_INVALID','The selected original source cannot be captured.',503);end if;
  if media.original_transcript is null or media.original_transcript!~U&'[^\0009\000A\000D\0020\00A0\1680\2000-\200A\2028\2029\202F\205F\3000\FEFF]'then
   value_status:='not_provided';value_text:=null;value_hash:=null;value_languages:='{}';
  else
   -- Validate before INSERT: a CHECK failure must never echo source text in DETAIL.
   if not eps.presentation_source_text_valid(media.original_transcript,200000)
   or not eps.presentation_source_languages_valid(media.languages)
   then perform eps.fail('SNAPSHOT_INVALID','The selected source transcript cannot be captured.',503);end if;
   value_status:='available';value_text:=media.original_transcript;value_languages:=media.languages;
   value_hash:=encode(sha256(convert_to(value_text,'UTF8')),'hex');
  end if;
  capture_video_ids:=array_append(capture_video_ids,pin.asset_id);
  capture_media_ids:=array_append(capture_media_ids,media.id);
  captured:=captured+1;
 end loop;
 if captured>0 then
  insert into eps.presentation_video_transcripts(version_id,video_asset_id,candidate_media_id,source_media_row_version,status,original_text,source_sha256,languages,captured_at)
   select version.id,d.video_asset_id,m.id,m.row_version,
    case when m.original_transcript is null or m.original_transcript!~U&'[^\0009\000A\000D\0020\00A0\1680\2000-\200A\2028\2029\202F\205F\3000\FEFF]' then 'not_provided'else 'available'end,
    case when m.original_transcript is null or m.original_transcript!~U&'[^\0009\000A\000D\0020\00A0\1680\2000-\200A\2028\2029\202F\205F\3000\FEFF]' then null else m.original_transcript end,
    case when m.original_transcript is null or m.original_transcript!~U&'[^\0009\000A\000D\0020\00A0\1680\2000-\200A\2028\2029\202F\205F\3000\FEFF]' then null else encode(sha256(convert_to(m.original_transcript,'UTF8')),'hex')end,
    case when m.original_transcript is null or m.original_transcript!~U&'[^\0009\000A\000D\0020\00A0\1680\2000-\200A\2028\2029\202F\205F\3000\FEFF]' then '{}'::text[]else m.languages end,version.created_at
   from unnest(capture_video_ids,capture_media_ids)with ordinality d(video_asset_id,candidate_media_id,ordinal)
   join eps.candidate_media m on m.id=d.candidate_media_id and m.source_asset_id=d.video_asset_id order by d.ordinal;
  get diagnostics capture_inserted=row_count;
 end if;
 if not eps.presentation_scope(version.workspace_id,true)
 then perform eps.fail('IMMUTABLE_VERSION','Source companions are captured only by a fresh authorized generation.',409);end if;
 if capture_inserted<>captured then perform eps.fail('SNAPSHOT_INVALID','The selected source transcript capture is incomplete.',503);end if;
 if captured<>(select count(*)from eps.presentation_version_assets where version_id=version.id and asset_kind='candidate_video')
 then perform eps.fail('SNAPSHOT_INVALID','The selected source transcript capture is incomplete.',503);end if;
 if version.english_transcript_version='1.0'then perform eps.capture_presentation_video_english_transcripts(version.id);end if;
 perform set_config('eps.presentation.transcript_capture_version',coalesce(prior_context,''),true);
 return captured;
end$$;

CREATE OR REPLACE FUNCTION eps.capture_presentation_video_english_transcripts(p_version uuid) RETURNS integer
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare version eps.presentation_versions;raw eps.presentation_video_transcripts;media eps.candidate_media;prior_context text;captured integer:=0;capture_video_ids uuid[]:='{}'::uuid[];capture_media_ids uuid[]:='{}'::uuid[];capture_inserted integer:=0;
begin
 select * into version from eps.presentation_versions where id=p_version;
 if not found or version.status<>'queued'or version.english_transcript_version is distinct from'1.0'
  or version.generated_by is distinct from auth.uid()or not eps.presentation_scope(version.workspace_id,true)
 then perform eps.fail('IMMUTABLE_VERSION','English companions require a fresh authorized generation.',409);end if;
 if exists(select 1 from eps.presentation_video_english_transcripts where version_id=p_version)
 then perform eps.fail('IMMUTABLE_VERSION','English companions are already captured.',409);end if;
 prior_context:=current_setting('eps.presentation.english_transcript_capture_version',true);
 perform set_config('eps.presentation.english_transcript_capture_version',p_version::text,true);
 for raw in select * from eps.presentation_video_transcripts where version_id=p_version order by video_asset_id loop
  select * into media from eps.candidate_media where id=raw.candidate_media_id and source_asset_id=raw.video_asset_id for share;
  if not found or media.row_version<>raw.source_media_row_version
   or(media.english_transcript_status in('available','unavailable')and media.english_transcript_source_sha256 is distinct from raw.source_sha256)
   or(media.english_transcript_status='not_provided'and raw.status<>'not_provided')
  then perform eps.fail('SNAPSHOT_INVALID','The selected English transcript cannot be captured.',503);end if;
  capture_video_ids:=array_append(capture_video_ids,raw.video_asset_id);
  capture_media_ids:=array_append(capture_media_ids,media.id);
  captured:=captured+1;
 end loop;
 if captured>0 then
  insert into eps.presentation_video_english_transcripts(version_id,video_asset_id,candidate_media_id,source_media_row_version,status,english_text,source_sha256,english_sha256,captured_at)
   select p_version,r.video_asset_id,m.id,r.source_media_row_version,m.english_transcript_status,m.english_transcript,
    m.english_transcript_source_sha256,case when m.english_transcript_status='available'then encode(sha256(convert_to(m.english_transcript,'UTF8')),'hex')end,version.created_at
   from unnest(capture_video_ids,capture_media_ids)with ordinality d(video_asset_id,candidate_media_id,ordinal)
   join eps.presentation_video_transcripts r on r.version_id=p_version and r.video_asset_id=d.video_asset_id and r.candidate_media_id=d.candidate_media_id
   join eps.candidate_media m on m.id=d.candidate_media_id and m.source_asset_id=d.video_asset_id order by d.ordinal;
  get diagnostics capture_inserted=row_count;
 end if;
 if not eps.presentation_scope(version.workspace_id,true)
 then perform eps.fail('IMMUTABLE_VERSION','English companions require a fresh authorized generation.',409);end if;
 if capture_inserted<>captured then perform eps.fail('SNAPSHOT_INVALID','English transcript capture is incomplete.',503);end if;
 if captured<>(select count(*)from eps.presentation_version_assets where version_id=p_version and asset_kind='candidate_video')
 then perform eps.fail('SNAPSHOT_INVALID','English transcript capture is incomplete.',503);end if;
 perform set_config('eps.presentation.english_transcript_capture_version',coalesce(prior_context,''),true);return captured;
end$$;

CREATE OR REPLACE FUNCTION eps.mcp_token_permits_capability(p_capability text) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
<<scalar_token>>
declare claims jsonb:=auth.jwt();cid uuid:=eps.mcp_claim_uuid('client_id');state jsonb;begin
 if not(claims?'eps_delegation')and not exists(select 1 from eps.mcp_oauth_resources where client_id=cid)then return true;end if;

declare p_resource text:=scalar_token.claims#>>'{eps_delegation,resource}';claims jsonb:=auth.jwt();principal uuid:=auth.uid();sid uuid:=eps.mcp_claim_uuid('session_id');cid uuid:=eps.mcp_claim_uuid('client_id');delegation jsonb;inactive jsonb;capabilities jsonb;permitted boolean;now_epoch numeric:=extract(epoch from clock_timestamp());begin
 if principal is null or sid is null or cid is null or claims->>'role'is distinct from'authenticated'or claims->'is_anonymous'is distinct from'false'::jsonb
 or p_resource is null or length(p_resource)not between 1 and 2048 or jsonb_typeof(claims->'aud')is distinct from'string'or claims->>'aud'is distinct from p_resource
 then return false;end if;
 -- Numeric bounds and types precede casts. This projection is not a signature
 -- verifier: PostgREST verifies JWTs and the resource gate verifies them again.
 if jsonb_typeof(claims->'exp')is distinct from'number'or claims->>'exp'!~'^[0-9]{1,12}$'
 or jsonb_typeof(claims->'iat')is distinct from'number'or claims->>'iat'!~'^[0-9]{1,12}$'then return false;end if;
 if(claims->>'exp')::numeric<=now_epoch or(claims->>'iat')::numeric>now_epoch then return false;end if;
 if claims?'nbf'then
  if jsonb_typeof(claims->'nbf')is distinct from'number'or claims->>'nbf'!~'^[0-9]{1,12}$'then return false;end if;
  if(claims->>'nbf')::numeric>now_epoch then return false;end if;
 end if;
 if not'openid'=any(regexp_split_to_array(coalesce(claims->>'scope',''),E'\\s+'))then return false;end if;
 delegation:=claims->'eps_delegation';
 if jsonb_typeof(delegation)is distinct from'object'then return false;end if;
 if(select count(*)from jsonb_object_keys(delegation))<>4 or delegation->'v'is distinct from'1'::jsonb
 or delegation->>'resource'is distinct from p_resource or delegation->>'client_id'is distinct from cid::text
 or jsonb_typeof(delegation->'capabilities')is distinct from'array'then return false;end if;
 if jsonb_array_length(delegation->'capabilities')not between 1 and 32
 or exists(select 1 from jsonb_array_elements(delegation->'capabilities')v where jsonb_typeof(v)<>'string'or v#>>'{}'not in('projects.read','projects.write','workspaces.read','workspaces.write','cast.read','cast.upload','cast.write','cast.review','presentations.generate','review_links.manage','settings.manage','operations.read','operations.retry'))then return false;end if;
 if not exists(select 1 from eps.mcp_oauth_resources where resource=p_resource and client_id=cid and enabled)
 or not exists(select 1 from auth.sessions where id=sid and user_id=principal and oauth_client_id=cid and(not_after is null or not_after>clock_timestamp())and'openid'=any(regexp_split_to_array(coalesce(scopes,''),E'\\s+')))
 then return false;end if;
 select exists(select 1 from public.app_capability_grants g
 where g.principal_id=principal and g.active and delegation->'capabilities'?g.capability
 and(p_capability is null or g.capability=p_capability))into permitted;
 if p_capability is null then return null;end if;
 return permitted;
end;
end$$;
