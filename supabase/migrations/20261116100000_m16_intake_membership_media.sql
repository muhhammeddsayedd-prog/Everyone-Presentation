-- m16 cycle 7 (A1): intake, project membership and presentation media.
--
-- 1. Newest first. Cast Library search and the project candidate list are keyset-paged on the
--    person's creation time (newest added to the app first; never last edit or membership time)
--    with the id as a deterministic tie-breaker. Cursors are versioned (v2); an older or foreign
--    cursor fails with INVALID_CURSOR instead of silently restarting.
-- 2. Library rows carry what a card needs in the same query: Arabic name, talent type, tape count,
--    a portrait hint, whether a new tape is still processing and, when a project is named, the
--    caller's project membership.
-- 3. Adding someone who is already in the project returns that membership (already_member) instead
--    of a conflict. A new membership pins the newest ready introduction, its chosen frames and a
--    presentation picture (cover photo, else the first chosen frame).
-- 4. Project rows take an explicit presentation picture (frame or archive photo of the same person),
--    crop and media_selection_state. Library edits never change project pins.
-- 5. A new tape for an existing person no longer fails because the profile was edited while the
--    video processed (facts are never touched by the save step). Archived/merged targets still fail.
--    Successful candidate jobs expose candidate_id/workspace_candidate_id through get_job.
--    The save step records what it actually did, so a refreshed page never guesses:
--    candidate_outcome created|tape_added|tape_rescanned and membership_outcome
--    added|already_member|not_requested (older results lack both: unknown).
-- 6. Reviewable repairs for legacy rows (state unset, nothing pinned) and a durable list of the
--    caller's uploads in a project, so pending rows survive a refresh.
-- Owners, ACLs, search_path and SECURITY DEFINER attributes of replaced functions are preserved.
set local search_path='';set local lock_timeout='5s';set local statement_timeout='120s';

do $m16_guard$begin
 if to_regprocedure('public.eps_suggest_media_repairs(uuid)') is not null then raise exception 'M16_ALREADY_APPLIED';end if;
 if not exists(select 1 from information_schema.columns where table_schema='eps' and table_name='workspace_candidates' and column_name='media_selection_state')
 or to_regprocedure('eps.apply_candidate_scan(uuid,uuid,text,text,jsonb)') is null or to_regprocedure('eps.cast_mutate(text,uuid,jsonb,text)') is null
 then raise exception 'M16_PREREQUISITES_MISSING';end if;
end $m16_guard$;

-- 1. Indexes ---------------------------------------------------------------------------------
create index candidates_newest_idx on eps.candidates(created_at desc,id desc) where archived_at is null and merged_into_candidate_id is null;
create index jobs_candidate_scan_target_active_idx on eps.jobs((input->>'target_candidate_id'))
 where kind='candidate_scan' and status in('queued','running','waiting_for_input');
create index candidate_uploads_workspace_recent_idx on eps.candidate_uploads(workspace_id,principal_id,created_at desc,id desc);

-- 2. Narrow grants for the new reads ------------------------------------------------------------
-- The save step reads only the cover photo link to pin a new membership's picture.
grant select(candidate_id,cover_photo_id) on eps.candidate_attributes to eps_candidate_apply_owner;
grant select(id,candidate_id,asset_id) on eps.candidate_photos to eps_candidate_apply_owner;
create policy candidate_apply_attributes_read on eps.candidate_attributes for select to eps_candidate_apply_owner using (true);
create policy candidate_apply_photos_read on eps.candidate_photos for select to eps_candidate_apply_owner using (true);
create policy cast_media_repair_idempotency on eps.idempotency_records as permissive for all to eps_cast_owner
 using (principal_id=auth.uid() and operation='cast.apply_media_repairs') with check (principal_id=auth.uid() and operation='cast.apply_media_repairs');
create policy cast_media_repair_audit on eps.audit_events as permissive for insert to eps_cast_owner
 with check (principal_id=auth.uid() and action='cast.apply_media_repairs');

-- 3. Helpers ------------------------------------------------------------------------------------
-- Versioned keyset cursor: base64 JSON {v:2,c:created_at,i:id,q:query hash}.
create function eps.cast_cursor_encode(p_created timestamptz,p_id uuid,p_query text) returns text
 language sql stable set search_path='' as $$
 select translate(encode(convert_to(jsonb_build_object('v',2,'c',p_created,'i',p_id,'q',left(encode(sha256(convert_to(p_query,'UTF8')),'hex'),32))::text,'UTF8'),'base64'),E'\n','')
$$;
create function eps.cast_cursor_decode(p_cursor text,p_query text,out created_at timestamptz,out last_id uuid)
 language plpgsql stable set search_path='' as $$
declare value jsonb;begin
 if p_cursor is null or p_cursor='' then return;end if;
 begin
  if length(p_cursor)>1000 then raise exception 'cursor too long';end if;
  value:=convert_from(decode(p_cursor,'base64'),'UTF8')::jsonb;
  if jsonb_typeof(value)<>'object' or value->'v' is distinct from '2'::jsonb or (select count(*) from jsonb_object_keys(value))<>4
   or jsonb_typeof(value->'c')<>'string' or jsonb_typeof(value->'i')<>'string' or jsonb_typeof(value->'q')<>'string' then raise exception 'cursor shape';end if;
  created_at:=(value->>'c')::timestamptz;last_id:=(value->>'i')::uuid;
 exception when others then created_at:=null;last_id:=null;
 end;
 if created_at is null or last_id is null then perform eps.fail('INVALID_CURSOR','This page link is from an older list. Reload the list from the start.',400);end if;
 if value->>'q' is distinct from left(encode(sha256(convert_to(p_query,'UTF8')),'hex'),32) then
  perform eps.fail('INVALID_CURSOR','This page link belongs to different filters. Reload the list from the start.',400);end if;
end $$;

-- A presentation picture is a ready extracted frame or a ready archive photo of this person.
create function eps.cast_portrait_valid(p_candidate uuid,p_asset uuid,p_source text) returns boolean
 language sql stable set search_path='' as $$
 select case p_source
  when 'photo' then exists(select 1 from eps.candidate_photos photo join eps.media_assets asset on asset.id=photo.asset_id
   where photo.candidate_id=p_candidate and photo.asset_id=p_asset and asset.status='ready' and asset.purpose='candidate_photo')
  when 'frame' then exists(select 1 from eps.candidate_media intro join eps.candidate_media_frames frame on frame.candidate_media_id=intro.id
   join eps.media_assets asset on asset.id=frame.asset_id
   where intro.candidate_id=p_candidate and frame.asset_id=p_asset and asset.status='ready' and asset.purpose='candidate_frame')
  else false end
$$;

-- Crop: exactly {focal_x,focal_y} in 0..1, the focus point preview, PDF and PowerPoint all use. Any other key
-- (a crop rectangle included) is refused, so the app never stores framing that the outputs would ignore.
create function eps.cast_crop_valid(p_crop jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare key text;begin
 if p_crop is null or p_crop='null'::jsonb then return true;end if;
 if jsonb_typeof(p_crop)<>'object' or octet_length(p_crop::text)>2000 then return false;end if;
 if exists(select 1 from jsonb_object_keys(p_crop) k where k not in('focal_x','focal_y')) then return false;end if;
 foreach key in array array['focal_x','focal_y'] loop
  if jsonb_typeof(p_crop->key) is distinct from 'number' or (p_crop->>key)::numeric not between 0 and 1 then return false;end if;
 end loop;
 return true;
end $$;

-- Shape of the picture fields of add/update_workspace_candidate (before any lock or replay).
create function eps.cast_picture_input(p_input jsonb) returns void language plpgsql stable set search_path='' as $$
begin
 if p_input?'portrait_asset_id' and not(jsonb_typeof(p_input->'portrait_asset_id')='string' or p_input->'portrait_asset_id'='null'::jsonb)
  or p_input?'portrait_source' and not p_input?'portrait_asset_id'
  or p_input?'portrait_asset_id' and p_input->'portrait_asset_id'<>'null'::jsonb and coalesce(p_input->>'portrait_source','') not in('frame','photo')
  or p_input?'portrait_asset_id' and p_input->'portrait_asset_id'='null'::jsonb and coalesce(p_input->'portrait_source','null'::jsonb)<>'null'::jsonb
  or p_input?'portrait_crop' and not eps.cast_crop_valid(p_input->'portrait_crop')
  or p_input?'media_selection_state' and coalesce(p_input->>'media_selection_state','') not in('pinned','intentionally_empty')
  or p_input->>'media_selection_state'='intentionally_empty' and (coalesce(p_input->'portrait_asset_id','null'::jsonb)<>'null'::jsonb or coalesce(p_input->'portrait_crop','null'::jsonb)<>'null'::jsonb)
 then perform eps.fail('INVALID_REQUEST','Choose a frame or photo of this person, a focus point {focal_x,focal_y} in 0..1, and pinned or intentionally_empty.',400);end if;
end $$;

-- What adding a person pins by default: the newest ready introduction and its chosen frames;
-- picture = archive cover photo, else the first chosen frame. Nothing is guessed beyond that.
create function eps.cast_default_media(p_candidate uuid) returns jsonb language sql stable set search_path='' as $$
 with intro as (
  select item.id,array(select chosen.frame_id from unnest(item.selected_frame_asset_ids) with ordinality chosen(frame_id,ordinal)
    where exists(select 1 from eps.candidate_media_frames frame join eps.media_assets asset on asset.id=frame.asset_id
     where frame.candidate_media_id=item.id and frame.asset_id=chosen.frame_id and asset.status='ready' and asset.purpose='candidate_frame' and asset.source_asset_id=item.source_asset_id)
    order by chosen.ordinal) frames
  from eps.candidate_media item join eps.media_assets video on video.id=item.source_asset_id
  where item.candidate_id=p_candidate and video.status='ready' and video.purpose='candidate_video'
  order by item.created_at desc,item.id desc limit 1),
 cover as (
  select photo.asset_id from eps.candidate_attributes attr join eps.candidate_photos photo on photo.candidate_id=attr.candidate_id and photo.id=attr.cover_photo_id
   join eps.media_assets asset on asset.id=photo.asset_id where attr.candidate_id=p_candidate and asset.status='ready' and asset.purpose='candidate_photo')
 select jsonb_build_object('selected_candidate_media_id',(select id from intro),
  'selected_frame_asset_ids',coalesce(to_jsonb((select frames from intro)),'[]'::jsonb),
  'portrait_asset_id',coalesce((select asset_id from cover),(select frames[1] from intro)),
  'portrait_source',case when (select asset_id from cover) is not null then 'photo' when (select frames[1] from intro) is not null then 'frame' end)
$$;

-- Active new-tape jobs for these people that the caller may see: their own uploads, or any upload when they hold
-- operations.read; always within a project workspace they can read (the jobs RLS scope, checked explicitly too).
create function eps.candidate_scans_active(p_candidates uuid[]) returns uuid[] language sql stable security definer set search_path='' as $$
 select coalesce(array_agg(distinct (job.input->>'target_candidate_id')::uuid),'{}'::uuid[]) from eps.jobs job
 where job.kind='candidate_scan' and job.status in('queued','running','waiting_for_input')
  and job.input->>'target_candidate_id'=any(array(select item::text from unnest(p_candidates) item))
  and auth.uid() is not null and (job.requested_by=auth.uid() or eps.has_capability('operations.read'))
  and eps.jobs_can_access(job.workspace_id,'read')
$$;

-- 4. Project row DTO gains the presentation picture -------------------------------------------
do $m16_pool$begin
 if encode(sha256(convert_to(replace((select prosrc from pg_proc where oid='eps.cast_pool_dto(uuid)'::regprocedure),E'\r\n',E'\n'),'UTF8')),'hex')<>'3dca710280e3d30c17799bd45452a0abb3542c35b1357ad594d36f737515973b'
 then raise exception 'M16_POOL_DTO_SOURCE_CHANGED';end if;
end $m16_pool$;
create or replace function eps.cast_pool_dto(p_id uuid) returns jsonb language sql stable set search_path='' as $function$
 select jsonb_build_object('id',id,'workspace_id',workspace_id,'candidate_id',candidate_id,'selected_candidate_media_id',selected_candidate_media_id,'selected_frame_asset_ids',to_jsonb(selected_frame_asset_ids),'availability',availability,'fresh_material_required',fresh_material_required,'media_confirmed',media_confirmed,'internal_notes',internal_notes,
  'portrait_asset_id',portrait_asset_id,'portrait_source',portrait_source,'portrait_crop',portrait_crop,'media_selection_state',media_selection_state,'row_version',row_version) from eps.workspace_candidates where id=p_id
$function$;

-- Library row: the profile DTO plus card fields, batched with the page.
create function eps.cast_library_dto(p_id uuid,p_match jsonb,p_workspace uuid,p_processing boolean) returns jsonb language sql stable set search_path='' as $$
 select eps.cast_candidate_dto(p_id,p_match)||jsonb_build_object(
  'name_ar',attr.name_ar,'talent_type',attr.talent_type,
  'tape_count',(select count(*) from eps.candidate_media item where item.candidate_id=p_id),
  'portrait_photo',(select jsonb_build_object('photo_id',photo.id,'asset_id',photo.asset_id,'thumb_asset_id',photo.thumb_asset_id) from eps.candidate_photos photo
    where photo.candidate_id=p_id and exists(select 1 from eps.media_assets a where a.id=photo.asset_id and a.status='ready') and exists(select 1 from eps.media_assets t where t.id=photo.thumb_asset_id and t.status='ready')
    order by (photo.id is not distinct from attr.cover_photo_id) desc,photo.position limit 1),
  'portrait_frame_asset_id',(select item.selected_frame_asset_ids[1] from eps.candidate_media item where item.candidate_id=p_id and cardinality(item.selected_frame_asset_ids)>0 order by item.created_at desc,item.id desc limit 1),
  'processing',coalesce(p_processing,false),
  'membership',case when p_workspace is not null then (select jsonb_build_object('workspace_candidate_id',pool.id,'state','in_project') from eps.workspace_candidates pool
    where pool.workspace_id=p_workspace and pool.candidate_id=p_id and pool.archived_at is null) end)
 from (select 1) one left join eps.candidate_attributes attr on attr.candidate_id=p_id
$$;

-- 5. Newest-first search with optional project membership --------------------------------------
do $m16_search$begin
 if encode(sha256(convert_to(replace((select prosrc from pg_proc where oid='public.eps_search_candidates(jsonb)'::regprocedure),E'\r\n',E'\n'),'UTF8')),'hex')<>'4f44acb7edc1c6797c61bfe0eb88e8207ac4291e73632a743071fd72d491994c'
 or encode(sha256(convert_to(replace((select prosrc from pg_proc where oid='public.eps_list_workspace_candidates(uuid,text,integer)'::regprocedure),E'\r\n',E'\n'),'UTF8')),'hex')<>'8ad2781db0e7103a74a685bd5303ad5c89e923c36d19ba95ebfc78f764722b12'
 then raise exception 'M16_LIST_SOURCE_CHANGED';end if;
end $m16_search$;
create or replace function public.eps_search_candidates(p_search jsonb default '{}'::jsonb) returns jsonb
 language plpgsql stable security definer set search_path='' as $function$
declare key text; maximum integer; cursor_at timestamptz; cursor_id uuid; fingerprint text; ws uuid; result jsonb[]; begin
 perform eps.require_capability('cast.read');
 perform eps.check_input(p_search,array['q','cursor','limit','include_unknown','review_status','workspace_id','age_or_range','stated_gender','height_measurements','language','accent','skill','city','previous_project_role','classification']);
 if octet_length(p_search::text)>10000 then perform eps.fail('INVALID_REQUEST','Search exceeds the request bound.',400); end if;
 foreach key in array array['q','cursor','workspace_id','age_or_range','stated_gender','height_measurements','language','accent','skill','city','previous_project_role','classification'] loop
  if p_search?key and (jsonb_typeof(p_search->key)<>'string' or length(p_search->>key)>case when key='cursor' then 4000 else 500 end) then perform eps.fail('INVALID_REQUEST','Invalid search text.',400); end if;
 end loop;
 if p_search?'include_unknown' and jsonb_typeof(p_search->'include_unknown')<>'boolean' or p_search?'review_status' and p_search->>'review_status' not in('reviewed','unreviewed') then perform eps.fail('INVALID_REQUEST','Invalid search filter.',400); end if;
 if p_search?'limit' and (jsonb_typeof(p_search->'limit')<>'number' or (p_search->>'limit')!~'^[1-9][0-9]{0,2}$') then perform eps.fail('INVALID_REQUEST','Invalid page size.',400); end if;
 maximum:=coalesce((p_search->>'limit')::integer,25); if maximum not between 1 and 100 then perform eps.fail('INVALID_REQUEST','Invalid page size.',400); end if;
 -- m16: membership is read only in a project the caller can read.
 if p_search?'workspace_id' then ws:=eps.input_uuid(p_search->>'workspace_id');
  if not eps.cast_workspace_scope(ws,false) then perform eps.fail('RESOURCE_NOT_FOUND','Workspace not found.',404); end if;
 end if;
 fingerprint:=encode(sha256(convert_to((p_search-'cursor'-'limit')::text,'UTF8')),'hex');
 if p_search?'cursor' and p_search->>'cursor'<>'' then select decoded.created_at,decoded.last_id into cursor_at,cursor_id from eps.cast_cursor_decode(p_search->>'cursor',fingerprint) decoded; end if;
 -- m16: newest added first (creation time, then id); the page is chosen before DTOs are built.
 with page as (
  select candidate.id,candidate.created_at,eps.cast_search_match(candidate.facts,p_search) search_match from eps.candidates candidate
  where candidate.archived_at is null and candidate.merged_into_candidate_id is null
   and (cursor_id is null or (candidate.created_at,candidate.id)<(cursor_at,cursor_id))
   and eps.cast_search_match(candidate.facts,p_search) is not null
   and (not p_search?'review_status' or (p_search->>'review_status'='reviewed')=eps.cast_is_reviewed(candidate))
  order by candidate.created_at desc,candidate.id desc limit maximum+1),
 active as (select eps.candidate_scans_active(array(select page.id from page)) ids)
 select array_agg(eps.cast_library_dto(page.id,page.search_match,ws,page.id=any(active.ids)) order by page.created_at desc,page.id desc) into result from page cross join active;
 return jsonb_build_object('data',coalesce(to_jsonb(result[1:maximum]),'[]'::jsonb),'page',jsonb_build_object('next_cursor',case when cardinality(result)>maximum
  then eps.cast_cursor_encode((result[maximum]->>'created_at')::timestamptz,(result[maximum]->>'id')::uuid,fingerprint) end));
end $function$;

create or replace function public.eps_list_workspace_candidates(p_workspace_id uuid, p_cursor text default null::text, p_limit integer default 25) returns jsonb
 language plpgsql stable security definer set search_path='' as $function$
declare cursor_at timestamptz; cursor_id uuid; result jsonb[]; begin
 perform eps.require_capability('workspaces.read');
 if not eps.cast_workspace_scope(p_workspace_id,false) then perform eps.fail('RESOURCE_NOT_FOUND','Workspace not found.',404); end if;
 if p_limit is null or p_limit not between 1 and 100 then perform eps.fail('INVALID_REQUEST','Invalid page size.',400); end if;
 if p_cursor is not null then select decoded.created_at,decoded.last_id into cursor_at,cursor_id from eps.cast_cursor_decode(p_cursor,'workspace:'||p_workspace_id::text) decoded; end if;
 -- m16: newest person first by their creation time (not membership time), id as tie-breaker.
 -- Without cast.read the person row is not visible; the membership time then stands in.
 select array_agg(eps.cast_pool_dto(page.id)||jsonb_build_object('candidate_created_at',page.sort_at) order by page.sort_at desc,page.candidate_id desc) into result from (
  select pool.id,pool.candidate_id,coalesce(candidate.created_at,pool.created_at) sort_at from eps.workspace_candidates pool left join eps.candidates candidate on candidate.id=pool.candidate_id
  where pool.workspace_id=p_workspace_id and pool.archived_at is null
   and (cursor_id is null or (coalesce(candidate.created_at,pool.created_at),pool.candidate_id)<(cursor_at,cursor_id))
  order by coalesce(candidate.created_at,pool.created_at) desc,pool.candidate_id desc limit p_limit+1) page;
 return jsonb_build_object('data',coalesce((select jsonb_agg(item.dto-'candidate_created_at' order by item.ordinal) from unnest(result[1:p_limit]) with ordinality item(dto,ordinal)),'[]'::jsonb),'page',jsonb_build_object('next_cursor',case when cardinality(result)>p_limit
  then eps.cast_cursor_encode((result[p_limit]->>'candidate_created_at')::timestamptz,(result[p_limit]->>'candidate_id')::uuid,'workspace:'||p_workspace_id::text) end));
end $function$;

-- 6. Guarded seam patches (same method as m11/m12) ---------------------------------------------
create function pg_temp.m16_patch(p_routine regprocedure,p_seams text[]) returns void language plpgsql as $$
declare source text;definition text;original_source text;before_attributes jsonb;i int;begin
 select replace(prosrc,E'\r\n',E'\n'),replace(pg_get_functiondef(oid),E'\r\n',E'\n'),to_jsonb(p)-'prosrc' into source,definition,before_attributes from pg_proc p where oid=p_routine;
 for i in 1..array_length(p_seams,1)/2 loop
  if length(source)-length(replace(source,p_seams[2*i-1],''))<>length(p_seams[2*i-1]) then raise exception 'M16_SEAM_CHANGED % #%',p_routine,i;end if;
  source:=replace(source,p_seams[2*i-1],p_seams[2*i]);
 end loop;
 select replace(prosrc,E'\r\n',E'\n') into original_source from pg_proc where oid=p_routine;
 if length(definition)-length(replace(definition,original_source,''))<>length(original_source) then raise exception 'M16_DEFINITION_SEAM_CHANGED %',p_routine;end if;
 execute replace(definition,original_source,source);
 if (select to_jsonb(p)-'prosrc' from pg_proc p where oid=p_routine) is distinct from before_attributes then raise exception 'M16_AUTHORITY_CHANGED %',p_routine;end if;
end $$;

-- 6a. add/update_workspace_candidate: idempotent membership, defaults and picture fields.
select pg_temp.m16_patch('eps.cast_mutate(text,uuid,jsonb,text)'::regprocedure,array[
$o1$ workspace_id uuid; generated_id uuid; operation text:='cast.'||p_operation; selection_changed boolean:=false; changed boolean; begin$o1$,
$n1$ workspace_id uuid; generated_id uuid; operation text:='cast.'||p_operation; selection_changed boolean:=false; changed boolean;
 defaults jsonb; pic_asset uuid; pic_source text; pic_crop jsonb; pic_state text; picture_changed boolean:=false; already boolean:=false; begin$n1$,
$o2$  perform eps.check_input(p_input,array['candidate_id','selected_candidate_media_id','availability','fresh_material_required']);$o2$,
$n2$  perform eps.check_input(p_input,array['candidate_id','selected_candidate_media_id','availability','fresh_material_required','portrait_asset_id','portrait_source','portrait_crop','media_selection_state']);$n2$,
$o3$ else perform eps.check_input(p_input,array['row_version','selected_candidate_media_id','selected_frame_asset_ids','availability','fresh_material_required','media_confirmed','internal_notes']);$o3$,
$n3$ else perform eps.check_input(p_input,array['row_version','selected_candidate_media_id','selected_frame_asset_ids','availability','fresh_material_required','media_confirmed','internal_notes','portrait_asset_id','portrait_source','portrait_crop','media_selection_state']);$n3$,
$o4$  foreach key in array array['fresh_material_required','media_confirmed'] loop if p_input?key and jsonb_typeof(p_input->key)<>'boolean' then perform eps.fail('INVALID_REQUEST','Expected project boolean.',400); end if; end loop;$o4$,
$n4$  foreach key in array array['fresh_material_required','media_confirmed'] loop if p_input?key and jsonb_typeof(p_input->key)<>'boolean' then perform eps.fail('INVALID_REQUEST','Expected project boolean.',400); end if; end loop;
  perform eps.cast_picture_input(p_input);$n4$,
$o5$  candidate:=eps.cast_require_active(eps.input_uuid(p_input->>'candidate_id'));
  media_id:=case when p_input->>'selected_candidate_media_id' is not null then eps.input_uuid(p_input->>'selected_candidate_media_id') end;
  if media_id is not null then select * into medium from eps.candidate_media where id=media_id and candidate_id=candidate.id; if not found then perform eps.fail('MEDIA_REFERENCE_INVALID','Choose this candidate source recording.',422); end if; end if;
  insert into eps.workspace_candidates(workspace_id,candidate_id,selected_candidate_media_id,selected_frame_asset_ids,availability,fresh_material_required)
   values(workspace_id,candidate.id,media_id,coalesce(medium.selected_frame_asset_ids,'{}'),nullif(btrim(p_input->>'availability'),''),coalesce((p_input->>'fresh_material_required')::boolean,false)) returning id into generated_id;
  perform eps.cast_changed(workspace_id); result:=eps.cast_pool_dto(generated_id);$o5$,
$n5$  candidate:=eps.cast_require_active(eps.input_uuid(p_input->>'candidate_id'));
  -- m16: someone already in this project (added by another person, a retry with a new key or a
  -- concurrent click) returns that membership unchanged instead of a conflict.
  select prior_pool.id into generated_id from eps.workspace_candidates prior_pool where prior_pool.workspace_id=workspace_id and prior_pool.candidate_id=candidate.id and prior_pool.archived_at is null;
  already:=generated_id is not null;
  if not already then
   defaults:=eps.cast_default_media(candidate.id);
   media_id:=case when p_input?'selected_candidate_media_id' then case when p_input->>'selected_candidate_media_id' is not null then eps.input_uuid(p_input->>'selected_candidate_media_id') end
    else (defaults->>'selected_candidate_media_id')::uuid end;
   if media_id is not null then select * into medium from eps.candidate_media where id=media_id and candidate_id=candidate.id; if not found then perform eps.fail('MEDIA_REFERENCE_INVALID','Choose this candidate source recording.',422); end if; end if;
   frames:=case when p_input?'selected_candidate_media_id' then coalesce(medium.selected_frame_asset_ids,'{}')
    else array(select value::uuid from jsonb_array_elements_text(defaults->'selected_frame_asset_ids') value) end;
   if p_input?'portrait_asset_id' then
    pic_asset:=case when p_input->>'portrait_asset_id' is not null then eps.input_uuid(p_input->>'portrait_asset_id') end; pic_source:=case when pic_asset is not null then p_input->>'portrait_source' end;
   elsif p_input->>'media_selection_state' is distinct from 'intentionally_empty' then
    -- Default picture: the archive cover photo, else the first chosen frame of the pinned introduction.
    if defaults->>'portrait_source'='photo' then pic_asset:=(defaults->>'portrait_asset_id')::uuid; pic_source:='photo';
    elsif cardinality(frames)>0 then pic_asset:=frames[1]; pic_source:='frame'; end if;
   end if;
   if pic_asset is not null and not eps.cast_portrait_valid(candidate.id,pic_asset,pic_source) then perform eps.fail('MEDIA_REFERENCE_INVALID','Choose a ready frame or photo of this person.',422); end if;
   pic_crop:=case when p_input?'portrait_crop' and p_input->'portrait_crop'<>'null'::jsonb then p_input->'portrait_crop' end;
   if pic_crop is not null and pic_asset is null then perform eps.fail('INVALID_REQUEST','A crop needs a chosen picture.',400); end if;
   pic_state:=coalesce(p_input->>'media_selection_state',case when media_id is not null or pic_asset is not null then 'pinned' else 'unset' end);
   begin
    insert into eps.workspace_candidates(workspace_id,candidate_id,selected_candidate_media_id,selected_frame_asset_ids,availability,fresh_material_required,portrait_asset_id,portrait_source,portrait_crop,media_selection_state)
     values(workspace_id,candidate.id,media_id,frames,nullif(btrim(p_input->>'availability'),''),coalesce((p_input->>'fresh_material_required')::boolean,false),pic_asset,pic_source,pic_crop,pic_state) returning id into generated_id;
   exception when unique_violation then
    select prior_pool.id into generated_id from eps.workspace_candidates prior_pool where prior_pool.workspace_id=workspace_id and prior_pool.candidate_id=candidate.id and prior_pool.archived_at is null;
    if generated_id is null then raise; end if;
    already:=true;
   end;
   if not already then perform eps.cast_changed(workspace_id); end if;
  end if;
  result:=eps.cast_pool_dto(generated_id)||jsonb_build_object('already_member',already);$n5$,
$o6$  frames:=eps.cast_selected_frames(media_id,case when p_input?'selected_frame_asset_ids' then p_input->'selected_frame_asset_ids' when selection_changed then to_jsonb(coalesce(medium.selected_frame_asset_ids,'{}')) else to_jsonb(pool.selected_frame_asset_ids) end);$o6$,
$n6$  frames:=eps.cast_selected_frames(media_id,case when p_input?'selected_frame_asset_ids' then p_input->'selected_frame_asset_ids' when selection_changed then to_jsonb(coalesce(medium.selected_frame_asset_ids,'{}')) else to_jsonb(pool.selected_frame_asset_ids) end);
  -- m16: the presentation picture is chosen independently; changing the introduction keeps it.
  pic_asset:=pool.portrait_asset_id; pic_source:=pool.portrait_source; pic_crop:=pool.portrait_crop; pic_state:=pool.media_selection_state;
  if p_input?'portrait_asset_id' then
   pic_asset:=case when p_input->>'portrait_asset_id' is not null then eps.input_uuid(p_input->>'portrait_asset_id') end; pic_source:=case when pic_asset is not null then p_input->>'portrait_source' end;
   if pic_asset is not null and not eps.cast_portrait_valid(pool.candidate_id,pic_asset,pic_source) then perform eps.fail('MEDIA_REFERENCE_INVALID','Choose a ready frame or photo of this person.',422); end if;
   picture_changed:=pic_asset is distinct from pool.portrait_asset_id or pic_source is distinct from pool.portrait_source;
   if picture_changed then pic_crop:=null; end if;
  end if;
  if p_input?'portrait_crop' then
   pic_crop:=case when p_input->'portrait_crop'<>'null'::jsonb then p_input->'portrait_crop' end;
   if pic_crop is not null and pic_asset is null then perform eps.fail('INVALID_REQUEST','A crop needs a chosen picture.',400); end if;
  end if;
  if p_input?'media_selection_state' then pic_state:=p_input->>'media_selection_state';
  elsif picture_changed and pic_asset is not null then pic_state:='pinned';
  elsif pic_state='unset' and (selection_changed or picture_changed or p_input?'selected_frame_asset_ids') then pic_state:='pinned'; end if;
  if pic_state='intentionally_empty' then picture_changed:=picture_changed or pool.portrait_asset_id is not null; pic_asset:=null; pic_source:=null; pic_crop:=null; end if;$n6$,
$o7$  update eps.workspace_candidates set selected_candidate_media_id=media_id,selected_frame_asset_ids=frames,$o7$,
$n7$  update eps.workspace_candidates set selected_candidate_media_id=media_id,selected_frame_asset_ids=frames,
   portrait_asset_id=pic_asset,portrait_source=pic_source,portrait_crop=pic_crop,media_selection_state=pic_state,$n7$,
$o8$   media_confirmed=case when p_input?'media_confirmed' then (p_input->>'media_confirmed')::boolean when selection_changed then false else media_confirmed end,$o8$,
$n8$   media_confirmed=case when p_input?'media_confirmed' then (p_input->>'media_confirmed')::boolean when selection_changed or picture_changed then false else media_confirmed end,$n8$,
$o9$  if replay is not null then return replay; end if;
  if p_operation<>'add_workspace_candidate' then select * into pool$o9$,
$n9$  -- m16: an add replay is returned only while the membership it produced is still active. Once that
  -- membership was removed, the old key neither re-adds the person nor returns the archived row:
  -- 409 MEMBERSHIP_REMOVED names it, and a legitimate re-add is a new request with a new key.
  if replay is not null and p_operation='add_workspace_candidate' and not exists(select 1 from eps.workspace_candidates replayed
   where replayed.id=eps.input_uuid(replay->>'id') and replayed.archived_at is null) then
   raise exception using errcode='P0001',message='MEMBERSHIP_REMOVED',detail=jsonb_build_object('message','This person was removed from the project after this add. Start a new add to bring them back.',
    'status',409,'removed_workspace_candidate_id',replay->>'id')::text;
  end if;
  if replay is not null then return replay; end if;
  if p_operation<>'add_workspace_candidate' then select * into pool$n9$]);

-- 6b. Save step: an extra tape no longer fails on a profile edit; a new membership pins its picture.
select pg_temp.m16_patch('eps.apply_candidate_scan(uuid,uuid,text,text,jsonb)'::regprocedure,array[
$o1$ candidate_id uuid; media_id uuid; rescan_id uuid; pool_id uuid;$o1$,
$n1$ candidate_id uuid; media_id uuid; rescan_id uuid; pool_id uuid; portrait_id uuid; portrait_kind text; pool_added boolean:=false;$n1$,
$o2$  perform eps.candidate_apply_assert(found and (rescan_id is not null or candidate.row_version=(job.input->>'target_candidate_row_version')::bigint),'INPUT_CHANGED');$o2$,
$n2$  -- m16: a new tape only appends media; facts and review state are untouched, so a profile edit
  -- made while the video processed no longer fails the job. Archived or merged targets still fail.
  perform eps.candidate_apply_assert(found,'INPUT_CHANGED');$n2$,
$o3$  insert into eps.workspace_candidates(workspace_id,candidate_id,selected_candidate_media_id,selected_frame_asset_ids,availability)
   values(job.workspace_id,candidate_id,media_id,chosen_frames,extraction->>'project_availability_statement') returning id into pool_id;$o3$,
$n3$  -- m16: pin the presentation picture too: the archive cover photo, else the first chosen frame.
  select photo.asset_id into portrait_id from eps.candidate_attributes attr join eps.candidate_photos photo on photo.candidate_id=attr.candidate_id and photo.id=attr.cover_photo_id
   join eps.media_assets asset on asset.id=photo.asset_id where attr.candidate_id=candidate_id and asset.status='ready' and asset.purpose='candidate_photo';
  if portrait_id is not null then portrait_kind:='photo'; elsif cardinality(chosen_frames)>0 then portrait_id:=chosen_frames[1]; portrait_kind:='frame'; end if;
  insert into eps.workspace_candidates(workspace_id,candidate_id,selected_candidate_media_id,selected_frame_asset_ids,availability,portrait_asset_id,portrait_source,media_selection_state)
   values(job.workspace_id,candidate_id,media_id,chosen_frames,extraction->>'project_availability_statement',portrait_id,portrait_kind,'pinned') returning id into pool_id;
  pool_added:=true;$n3$,
$o4$ result:=jsonb_build_object('candidate_id',candidate_id,'candidate_media_id',media_id,'workspace_candidate_id',pool_id,$o4$,
$n4$ -- m16: record what this save step actually did; a refreshed page shows only these facts.
 result:=jsonb_build_object('candidate_id',candidate_id,'candidate_media_id',media_id,'workspace_candidate_id',pool_id,
  'candidate_outcome',case when rescan_id is not null then 'tape_rescanned' when job.input->>'target_candidate_id' is not null then 'tape_added' else 'created' end,
  'membership_outcome',case when rescan_id is not null then 'not_requested' when pool_added then 'added' else 'already_member' end,$n4$]);

-- 6c. get_job: a finished candidate job names the person and the project row it produced.
select pg_temp.m16_patch('eps.jobs_dto(uuid)'::regprocedure,array[
$o1$    ||case when kind='frame_extract' and status='succeeded' then jsonb_build_object('frame_extraction',eps.frame_user_outcome(jobs)) else '{}'::jsonb end$o1$,
$n1$    ||case when kind='candidate_scan' and status='succeeded' and jsonb_typeof(result)='object' then jsonb_build_object('candidate_result',jsonb_build_object('candidate_id',result->'candidate_id','candidate_media_id',result->'candidate_media_id','workspace_candidate_id',coalesce(result->'workspace_candidate_id','null'::jsonb),
     'candidate_outcome',coalesce(result->'candidate_outcome','null'::jsonb),'membership_outcome',coalesce(result->'membership_outcome','null'::jsonb))) else '{}'::jsonb end
    ||case when kind='frame_extract' and status='succeeded' then jsonb_build_object('frame_extraction',eps.frame_user_outcome(jobs)) else '{}'::jsonb end$n1$]);

-- 7. Reviewable repairs for legacy rows --------------------------------------------------------
create function public.eps_suggest_media_repairs(p_workspace_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_items jsonb; v_more boolean; begin
 perform eps.require_capability('workspaces.read'); perform eps.require_capability('cast.read');
 if p_workspace_id is null or not eps.cast_workspace_scope(p_workspace_id,false) then perform eps.fail('RESOURCE_NOT_FOUND','Workspace not found.',404); end if;
 with legacy as (
  select pool.id,pool.candidate_id,pool.row_version,pool.created_at from eps.workspace_candidates pool
  where pool.workspace_id=p_workspace_id and pool.archived_at is null and pool.media_selection_state='unset'
   and pool.selected_candidate_media_id is null and pool.portrait_asset_id is null
  order by pool.created_at,pool.id limit 201),
 suggested as (select legacy.*,eps.cast_default_media(legacy.candidate_id) suggestion from legacy)
 select coalesce(jsonb_agg(jsonb_build_object('workspace_candidate_id',id,'candidate_id',candidate_id,'row_version',row_version,
   'reason',case when suggestion->>'selected_candidate_media_id' is null and suggestion->>'portrait_asset_id' is null then 'no_media_available' else 'default_available' end,
   'suggestion',case when suggestion->>'selected_candidate_media_id' is null and suggestion->>'portrait_asset_id' is null then null else suggestion end) order by created_at,id)
   filter (where ordinal<=200),'[]'::jsonb),count(*)>200 into v_items,v_more
 from (select suggested.*,row_number() over(order by created_at,id) ordinal from suggested) numbered;
 return jsonb_build_object('data',v_items,'has_more',coalesce(v_more,false));
end $$;

create function public.eps_apply_media_repairs(p_workspace_id uuid,p_input jsonb,p_key text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_payload jsonb; v_replay jsonb; v_item jsonb; v_pool eps.workspace_candidates; v_defaults jsonb; v_applied jsonb:='[]'; v_skipped jsonb:='[]'; v_id uuid; v_result jsonb; begin
 perform eps.require_capability('workspaces.write'); perform eps.require_capability('cast.read');
 perform eps.check_input(p_input,array['items']);
 if jsonb_typeof(p_input->'items') is distinct from 'array' or jsonb_array_length(p_input->'items') not between 1 and 100
  or exists(select 1 from jsonb_array_elements(p_input->'items') entry where jsonb_typeof(entry)<>'object'
   or exists(select 1 from jsonb_object_keys(entry) k where k not in('workspace_candidate_id','row_version'))
   or jsonb_typeof(entry->'workspace_candidate_id') is distinct from 'string' or jsonb_typeof(entry->'row_version') is distinct from 'number' or (entry->>'row_version')!~'^[1-9][0-9]{0,14}$')
  or (select count(distinct entry->>'workspace_candidate_id') from jsonb_array_elements(p_input->'items') entry)<>jsonb_array_length(p_input->'items')
 then perform eps.fail('INVALID_REQUEST','List up to 100 distinct project rows with their row versions.',400); end if;
 perform eps.input_uuid(entry->>'workspace_candidate_id') from jsonb_array_elements(p_input->'items') entry;
 if p_key is null or length(p_key) not between 16 and 200 then perform eps.fail('IDEMPOTENCY_KEY_REQUIRED','A stable Idempotency-Key is required.',400); end if;
 v_payload:=jsonb_build_object('id',p_workspace_id,'input',p_input); v_replay:=eps.idempotency_begin('cast.apply_media_repairs',p_key,v_payload);
 perform eps.require_capability('workspaces.write'); perform eps.require_capability('cast.read');
 if p_workspace_id is null or not eps.cast_workspace_scope(p_workspace_id,true) then perform eps.fail('RESOURCE_NOT_FOUND','Writable workspace not found.',404); end if;
 perform 1 from eps.workspaces where id=p_workspace_id for update;
 if v_replay is not null then return v_replay; end if;
 for v_item in select value from jsonb_array_elements(p_input->'items') loop
  v_id:=(v_item->>'workspace_candidate_id')::uuid;
  select * into v_pool from eps.workspace_candidates where id=v_id and workspace_id=p_workspace_id and archived_at is null for update;
  if not found then v_skipped:=v_skipped||jsonb_build_array(jsonb_build_object('workspace_candidate_id',v_id,'reason','not_found')); continue; end if;
  if v_pool.row_version<>(v_item->>'row_version')::bigint then v_skipped:=v_skipped||jsonb_build_array(jsonb_build_object('workspace_candidate_id',v_id,'reason','changed','current_row_version',v_pool.row_version)); continue; end if;
  -- Only untouched legacy rows are repaired; pinned and intentionally empty rows are never changed.
  if v_pool.media_selection_state<>'unset' or v_pool.selected_candidate_media_id is not null or v_pool.portrait_asset_id is not null then
   v_skipped:=v_skipped||jsonb_build_array(jsonb_build_object('workspace_candidate_id',v_id,'reason','already_chosen')); continue; end if;
  v_defaults:=eps.cast_default_media(v_pool.candidate_id);
  if v_defaults->>'selected_candidate_media_id' is null and v_defaults->>'portrait_asset_id' is null then
   v_skipped:=v_skipped||jsonb_build_array(jsonb_build_object('workspace_candidate_id',v_id,'reason','no_media_available')); continue; end if;
  update eps.workspace_candidates set selected_candidate_media_id=(v_defaults->>'selected_candidate_media_id')::uuid,
   selected_frame_asset_ids=array(select value::uuid from jsonb_array_elements_text(v_defaults->'selected_frame_asset_ids') value),
   portrait_asset_id=(v_defaults->>'portrait_asset_id')::uuid,portrait_source=v_defaults->>'portrait_source',portrait_crop=null,media_selection_state='pinned',
   media_confirmed=false,row_version=row_version+1,updated_at=clock_timestamp() where id=v_pool.id;
  v_applied:=v_applied||jsonb_build_array(eps.cast_pool_dto(v_pool.id));
 end loop;
 if jsonb_array_length(v_applied)>0 then perform eps.cast_changed(p_workspace_id); end if;
 v_result:=jsonb_build_object('applied',v_applied,'skipped',v_skipped);
 return eps.finish_mutation('cast.apply_media_repairs',p_key,v_payload,v_result,p_workspace_id);
end $$;

-- 8. The caller's uploads in a project, newest first (survive a refresh) -----------------------
create function eps.candidate_upload_row(p_upload uuid) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('upload_id',u.id,'workspace_id',u.workspace_id,'asset_id',u.asset_id,'filename',a.filename,'size_bytes',u.expected_size_bytes,'mime_type',u.expected_mime_type,
  'target_candidate_id',u.target_candidate_id,'created_at',u.created_at,
  'upload_status',case when u.status='open' and u.expires_at<=clock_timestamp() then 'expired' else u.status end,
  'state',case when u.status='cancelled' then 'cancelled' when u.status='open' and u.expires_at<=clock_timestamp() then 'expired' when u.status='open' then 'uploading'
   when j.status='succeeded' then 'ready' when j.status='waiting_for_input' then 'needs_attention' when j.status='failed' then 'failed' when j.status='cancelled' then 'cancelled' else 'processing' end,
  'job',case when j.id is null then null else jsonb_build_object('id',j.id,'status',j.status,'stage',j.stage,'error_code',j.error->>'code',
   'retryable',(j.status='failed' and j.cancel_requested_at is null and coalesce((j.error->>'retryable')::boolean,false) and coalesce((j.stage_attempts->>j.stage)::integer,0)<3),'row_version',j.row_version,'updated_at',j.updated_at) end,
  'candidate_id',case when j.status='succeeded' then j.result->'candidate_id' end,
  'workspace_candidate_id',case when j.status='succeeded' then j.result->'workspace_candidate_id' end,
  -- Server-recorded outcomes; null for older jobs (unknown) or unfinished ones.
  'candidate_outcome',case when j.status='succeeded' then j.result->'candidate_outcome' end,
  'membership_outcome',case when j.status='succeeded' then j.result->'membership_outcome' end)
 from eps.candidate_uploads u left join eps.media_assets a on a.id=u.asset_id left join eps.jobs j on j.id=u.job_id and j.kind='candidate_scan' where u.id=p_upload
$$;
create function public.eps_list_workspace_uploads(p_workspace_id uuid,p_cursor text default null,p_limit integer default 25) returns jsonb
 language plpgsql stable security definer set search_path='' as $$
declare cursor_at timestamptz; cursor_id uuid; result jsonb[]; begin
 if auth.uid() is null then perform eps.fail('AUTH_REQUIRED','Sign in.',401); end if;
 perform eps.require_capability('cast.read');
 if p_workspace_id is null or not eps.logo_scope(p_workspace_id,false) then perform eps.fail('RESOURCE_NOT_FOUND','Workspace not found.',404); end if;
 if p_limit is null or p_limit not between 1 and 100 then perform eps.fail('INVALID_REQUEST','Invalid page size.',400); end if;
 if p_cursor is not null then select decoded.created_at,decoded.last_id into cursor_at,cursor_id from eps.cast_cursor_decode(p_cursor,'uploads:'||p_workspace_id::text) decoded; end if;
 select array_agg(eps.candidate_upload_row(page.id) order by page.created_at desc,page.id desc) into result from (
  select u.id,u.created_at from eps.candidate_uploads u where u.workspace_id=p_workspace_id and u.principal_id=auth.uid()
   and (cursor_id is null or (u.created_at,u.id)<(cursor_at,cursor_id)) order by u.created_at desc,u.id desc limit p_limit+1) page;
 return jsonb_build_object('data',coalesce(to_jsonb(result[1:p_limit]),'[]'::jsonb),'page',jsonb_build_object('next_cursor',case when cardinality(result)>p_limit
  then eps.cast_cursor_encode((result[p_limit]->>'created_at')::timestamptz,(result[p_limit]->>'upload_id')::uuid,'uploads:'||p_workspace_id::text) end));
end $$;

-- 9. Ownership and execution rights --------------------------------------------------------------
grant create on schema eps to eps_cast_owner,eps_jobs_owner,eps_candidate_upload_owner;
grant create on schema public to eps_cast_owner,eps_candidate_upload_owner;
alter function eps.cast_cursor_encode(timestamptz,uuid,text) owner to eps_cast_owner;
alter function eps.cast_cursor_decode(text,text) owner to eps_cast_owner;
alter function eps.cast_portrait_valid(uuid,uuid,text) owner to eps_cast_owner;
alter function eps.cast_crop_valid(jsonb) owner to eps_cast_owner;
alter function eps.cast_picture_input(jsonb) owner to eps_cast_owner;
alter function eps.cast_default_media(uuid) owner to eps_cast_owner;
alter function eps.cast_library_dto(uuid,jsonb,uuid,boolean) owner to eps_cast_owner;
alter function eps.candidate_scans_active(uuid[]) owner to eps_jobs_owner;
alter function eps.candidate_upload_row(uuid) owner to eps_candidate_upload_owner;
alter function public.eps_suggest_media_repairs(uuid) owner to eps_cast_owner;
alter function public.eps_apply_media_repairs(uuid,jsonb,text) owner to eps_cast_owner;
alter function public.eps_list_workspace_uploads(uuid,text,integer) owner to eps_candidate_upload_owner;
revoke create on schema eps from eps_cast_owner,eps_jobs_owner,eps_candidate_upload_owner;
revoke create on schema public from eps_cast_owner,eps_candidate_upload_owner;
revoke all on function eps.cast_cursor_encode(timestamptz,uuid,text),eps.cast_cursor_decode(text,text),eps.cast_portrait_valid(uuid,uuid,text),eps.cast_crop_valid(jsonb),
 eps.cast_picture_input(jsonb),eps.cast_default_media(uuid),eps.cast_library_dto(uuid,jsonb,uuid,boolean),eps.candidate_scans_active(uuid[]),eps.candidate_upload_row(uuid)
 from public,anon,authenticated,service_role;
grant execute on function eps.cast_cursor_encode(timestamptz,uuid,text),eps.cast_cursor_decode(text,text) to eps_candidate_upload_owner;
grant execute on function eps.candidate_scans_active(uuid[]) to eps_cast_owner;
revoke all on function public.eps_suggest_media_repairs(uuid),public.eps_apply_media_repairs(uuid,jsonb,text),public.eps_list_workspace_uploads(uuid,text,integer)
 from public,anon,authenticated,service_role;
grant execute on function public.eps_suggest_media_repairs(uuid),public.eps_apply_media_repairs(uuid,jsonb,text),public.eps_list_workspace_uploads(uuid,text,integer) to authenticated;

-- 10. Verify --------------------------------------------------------------------------------------
do $m16_verify$begin
 if (select pg_get_userbyid(proowner) from pg_proc where oid='public.eps_suggest_media_repairs(uuid)'::regprocedure) is distinct from 'eps_cast_owner'
 or (select pg_get_userbyid(proowner) from pg_proc where oid='public.eps_list_workspace_uploads(uuid,text,integer)'::regprocedure) is distinct from 'eps_candidate_upload_owner'
 or (select pg_get_userbyid(proowner)||prosecdef::text from pg_proc where oid='public.eps_search_candidates(jsonb)'::regprocedure) is distinct from 'eps_cast_ownertrue'
 or (select pg_get_userbyid(proowner)||prosecdef::text from pg_proc where oid='public.eps_list_workspace_candidates(uuid,text,integer)'::regprocedure) is distinct from 'eps_cast_ownertrue'
 or (select pg_get_userbyid(proowner) from pg_proc where oid='eps.cast_pool_dto(uuid)'::regprocedure) is distinct from 'eps_cast_owner'
 or not has_function_privilege('authenticated','public.eps_apply_media_repairs(uuid,jsonb,text)','execute')
 or has_function_privilege('anon','public.eps_list_workspace_uploads(uuid,text,integer)','execute')
 or has_function_privilege('authenticated','eps.candidate_scans_active(uuid[])','execute')
 or (select count(*) from pg_policies where schemaname='eps' and policyname in('candidate_apply_attributes_read','candidate_apply_photos_read','cast_media_repair_idempotency','cast_media_repair_audit'))<>4
 or (select prosrc from pg_proc where oid='eps.apply_candidate_scan(uuid,uuid,text,text,jsonb)'::regprocedure) ~ 'target_candidate_row_version'
 or (select prosrc from pg_proc where oid='eps.apply_candidate_scan(uuid,uuid,text,text,jsonb)'::regprocedure) !~ 'membership_outcome'
 or (select prosrc from pg_proc where oid='eps.cast_mutate(text,uuid,jsonb,text)'::regprocedure) !~ 'already_member'
 or (select prosrc from pg_proc where oid='eps.jobs_dto(uuid)'::regprocedure) !~ 'candidate_result'
 -- jobs_dto reads jobs.result; every routine that calls it must run as the jobs owner.
 or exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('eps','public') and p.prosrc like '%eps.jobs_dto(%'
   and p.oid<>'eps.jobs_dto(uuid)'::regprocedure and not(pg_get_userbyid(p.proowner)='eps_jobs_owner' and p.prosecdef))
 then raise exception 'M16_VERIFY_FAILED';end if;
end $m16_verify$;
