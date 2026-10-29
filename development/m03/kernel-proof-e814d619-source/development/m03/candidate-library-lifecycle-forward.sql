-- M03 forward lifecycle fixes. Core15 remains immutable. Compose after kernel.
set local search_path='';set local lock_timeout='3s';set local statement_timeout='30s';
alter table eps.candidate_media add column processing_issues text[] not null default '{}'
 check(cardinality(processing_issues)<=4 and processing_issues<@array['NO_AUDIO','TRANSCRIPTION_FAILED','EXTRACTION_FAILED','INSUFFICIENT_FRAMES']::text[]);
comment on column eps.candidate_media.processing_issues is 'Fixed safe technical outcome codes derived from private validated stage payloads, never raw provider errors or inferred personal facts.';
create or replace function eps.cast_media_dto(p_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('id',media.id,'candidate_id',media.candidate_id,'source_asset_id',media.source_asset_id,'preview_asset_id',media.preview_asset_id,'transcript_asset_id',media.transcript_asset_id,'original_transcript',media.original_transcript,'languages',to_jsonb(media.languages),
 'available_frames',coalesce((select jsonb_agg(jsonb_build_object('asset_id',asset.id,'source_asset_id',asset.source_asset_id,'timestamp_ms',asset.source_timestamp_ms,'width',asset.width,'height',asset.height,'quality_flags',to_jsonb(frame.quality_flags)) order by asset.source_timestamp_ms,asset.id) from eps.candidate_media_frames frame join eps.media_assets asset on asset.id=frame.asset_id where frame.candidate_media_id=media.id and asset.status='ready'),'[]'::jsonb),
 'selected_frame_asset_ids',to_jsonb(media.selected_frame_asset_ids),'processing_issues',to_jsonb(media.processing_issues),'row_version',media.row_version) from eps.candidate_media media where media.id=p_id
$$;
create table eps.cast_operation_notes (
 principal_id uuid not null references auth.users(id) on delete restrict,
 operation text not null check(operation in('cast.archive_candidate','cast.remove_workspace_candidate')),
 key text not null check(length(key) between 16 and 200),resource_id uuid not null,
 reason text not null check(length(reason) between 1 and 10000),created_at timestamptz not null default clock_timestamp(),
 primary key(principal_id,operation,key)
);
create index cast_operation_notes_resource_idx on eps.cast_operation_notes(resource_id);
alter table eps.cast_operation_notes enable row level security;alter table eps.cast_operation_notes force row level security;
revoke all on eps.cast_operation_notes from public,anon,authenticated,service_role;
grant insert(principal_id,operation,key,resource_id,reason) on eps.cast_operation_notes to eps_cast_owner;
create policy cast_notes_insert on eps.cast_operation_notes for insert to eps_cast_owner with check(principal_id=auth.uid() and (
 operation='cast.archive_candidate' and eps.has_capability('cast.write') or operation='cast.remove_workspace_candidate' and eps.has_capability('workspaces.write')));
comment on table eps.cast_operation_notes is 'Private audit context for optional published ArchiveRequest.reason; not profile facts, feedback or a fact-conflict product.';

create or replace function public.eps_get_candidate(p_candidate_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;begin
 perform eps.require_capability('cast.read');select eps.cast_candidate_dto(id) into result from eps.candidates where id=p_candidate_id;
 if result is null then perform eps.fail('RESOURCE_NOT_FOUND','Library profile not found.',404);end if;return result;
end $$;
create or replace function public.eps_find_candidate_duplicates(p_candidate_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare candidate eps.candidates;begin
 perform eps.require_capability('cast.read');select * into candidate from eps.candidates where id=p_candidate_id;
 if not found then perform eps.fail('RESOURCE_NOT_FOUND','Library profile not found.',404);end if;
 if candidate.archived_at is not null or candidate.merged_into_candidate_id is not null then return '[]'::jsonb;end if;
 return coalesce((select jsonb_agg(jsonb_build_object('candidate_id',other.id,'display_name',other.facts->'name','match_reasons',case when lower(candidate.source_casting_id)=lower(other.casting_id) then jsonb_build_array('Same supplied casting ID; explicit identity choice required') else jsonb_build_array('Same supplied name; explicit identity choice required') end) order by other.id) from eps.candidates other where other.id<>candidate.id and other.archived_at is null and other.merged_into_candidate_id is null and (nullif(lower(candidate.facts->>'name'),'')=lower(other.facts->>'name') or lower(candidate.source_casting_id)=lower(other.casting_id))),'[]'::jsonb);
end $$;
create or replace function public.eps_get_candidate_media(p_candidate_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform eps.require_capability('cast.read');
 if not exists(select 1 from eps.candidates where id=p_candidate_id) then perform eps.fail('RESOURCE_NOT_FOUND','Library profile not found.',404);end if;
 return coalesce((select jsonb_agg(eps.cast_media_dto(id) order by created_at,id) from eps.candidate_media where candidate_id=p_candidate_id),'[]'::jsonb);
end $$;

create function eps.cast_archive_with_reason(p_kind text,p_id uuid,p_input jsonb,p_key text) returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare source eps.candidates;pool eps.workspace_candidates;workspace uuid;payload jsonb;replay jsonb;result jsonb;operation text;note text;begin
 if p_kind not in('candidate','pool') then perform eps.fail('INVALID_REQUEST','Unknown archive operation.',400);end if;
 operation:=case when p_kind='candidate' then 'cast.archive_candidate' else 'cast.remove_workspace_candidate' end;
 perform eps.require_capability(case when p_kind='candidate' then 'cast.write' else 'workspaces.write' end);
 perform eps.check_input(p_input,array['row_version','reason']);
 if octet_length(p_input::text)>65536 or p_input?'reason' and not(jsonb_typeof(p_input->'reason')='string' or p_input->'reason'='null'::jsonb) or length(p_input->>'reason')>10000 then perform eps.fail('INVALID_REQUEST','Invalid bounded archive reason.',400);end if;
 if p_key is null or length(p_key) not between 16 and 200 then perform eps.fail('IDEMPOTENCY_KEY_REQUIRED','A stable Idempotency-Key is required.',400);end if;
 payload:=jsonb_build_object('id',p_id,'input',p_input);replay:=eps.idempotency_begin(operation,p_key,payload);
 perform eps.require_capability(case when p_kind='candidate' then 'cast.write' else 'workspaces.write' end);
 if p_kind='candidate' then
  perform eps.require_capability('cast.read');select * into source from eps.candidates where id=p_id for update;
  if not found then perform eps.fail('RESOURCE_NOT_FOUND','Library profile not found.',404);end if;
  if replay is not null then return replay;end if;
  if source.archived_at is not null or source.merged_into_candidate_id is not null then perform eps.fail('INVALID_TRANSITION','Profile is already archived or linked.',409);end if;
  if eps.expected_version(p_input)<>source.row_version then perform eps.fail('STALE_RESOURCE_VERSION','Candidate changed.',409,source.row_version);end if;
  update eps.candidates set archived_at=clock_timestamp(),row_version=row_version+1,updated_at=clock_timestamp() where id=source.id;
 else
  select workspace_id into workspace from eps.workspace_candidates where id=p_id;
  if workspace is null or not eps.cast_workspace_scope(workspace,true) then perform eps.fail('RESOURCE_NOT_FOUND','Writable project candidate not found.',404);end if;
  perform 1 from eps.workspaces where id=workspace for update;
  if not eps.cast_workspace_scope(workspace,true) then perform eps.fail('RESOURCE_NOT_FOUND','Writable project not found.',404);end if;
  select * into pool from eps.workspace_candidates where id=p_id for update;
  if not found then perform eps.fail('RESOURCE_NOT_FOUND','Project candidate not found.',404);end if;
  if replay is not null then return replay;end if;
  if pool.archived_at is not null then perform eps.fail('INVALID_TRANSITION','Project candidate already removed.',409);end if;
  if eps.expected_version(p_input)<>pool.row_version then perform eps.fail('STALE_RESOURCE_VERSION','Project candidate changed.',409,pool.row_version);end if;
  if to_regclass('eps.assignments') is not null then perform eps.fail('ASSIGNMENT_RETIREMENT_UNAVAILABLE','Assignment archival must be integrated before project candidate removal.',503);end if;
  update eps.workspace_candidates set archived_at=clock_timestamp(),row_version=row_version+1,updated_at=clock_timestamp() where id=pool.id;
  perform eps.cast_changed(workspace);
 end if;
 result:=eps.finish_mutation(operation,p_key,payload,jsonb_build_object('success',true,'affected_ids',jsonb_build_array(p_id)),p_id);
 note:=nullif(btrim(p_input->>'reason'),'');if note is not null then insert into eps.cast_operation_notes(principal_id,operation,key,resource_id,reason) values(auth.uid(),operation,p_key,p_id,note);end if;
 return result;
end $$;
create or replace function public.eps_archive_candidate(p_candidate_id uuid,p_input jsonb,p_idempotency_key text) returns jsonb language sql volatile security definer set search_path='' as $$ select eps.cast_archive_with_reason('candidate',p_candidate_id,p_input,p_idempotency_key) $$;
create or replace function public.eps_remove_workspace_candidate(p_workspace_candidate_id uuid,p_input jsonb,p_idempotency_key text) returns jsonb language sql volatile security definer set search_path='' as $$ select eps.cast_archive_with_reason('pool',p_workspace_candidate_id,p_input,p_idempotency_key) $$;

create function eps.cast_link_duplicate(p_id uuid,p_input jsonb,p_key text) returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare source_row eps.candidates;target_row eps.candidates;target_id uuid;payload jsonb;replay jsonb;participation eps.workspace_candidates;workspace uuid;affected_workspaces uuid[];result jsonb;begin
 perform eps.require_capability('cast.write');perform eps.require_capability('cast.read');
 perform eps.check_input(p_input,array['row_version','action','existing_candidate_id','existing_candidate_row_version']);
 if p_input->>'action'='keep_new' then return eps.cast_mutate('resolve_candidate_duplicate',p_id,p_input,p_key);end if;
 if p_input->>'action' is distinct from 'link_existing' or octet_length(p_input::text)>65536 then perform eps.fail('INVALID_REQUEST','Choose an explicit identity resolution.',400);end if;
 target_id:=eps.input_uuid(p_input->>'existing_candidate_id');if target_id=p_id then perform eps.fail('INVALID_REQUEST','A profile cannot link to itself.',400);end if;
 if p_key is null or length(p_key) not between 16 and 200 then perform eps.fail('IDEMPOTENCY_KEY_REQUIRED','A stable Idempotency-Key is required.',400);end if;
 payload:=jsonb_build_object('id',p_id,'input',p_input);replay:=eps.idempotency_begin('cast.resolve_candidate_duplicate',p_key,payload);
 -- Consistent visible-workspace then identity order. Hidden project references
 -- cannot be rewritten by this acting user; their composite FKs remain a guard.
 for workspace in select distinct pool.workspace_id from eps.workspace_candidates pool where pool.candidate_id=p_id order by pool.workspace_id loop
  if not eps.cast_workspace_scope(workspace,true) then perform eps.fail('RESOURCE_NOT_FOUND','Writable project participation not found.',404);end if;
  perform 1 from eps.workspaces where id=workspace for update;
 end loop;
 perform 1 from eps.candidates where id in(p_id,target_id) order by id for update;
 perform eps.require_capability('cast.write');perform eps.require_capability('cast.read');
 select * into source_row from eps.candidates where id=p_id;select * into target_row from eps.candidates where id=target_id and archived_at is null and merged_into_candidate_id is null;
 if source_row.id is null or target_row.id is null then perform eps.fail('RESOURCE_NOT_FOUND','Library profile not found.',404);end if;
 if replay is not null then return replay;end if;
 if source_row.archived_at is not null or source_row.merged_into_candidate_id is not null then perform eps.fail('INVALID_TRANSITION','Profile is already archived or linked.',409);end if;
 if eps.expected_version(p_input)<>source_row.row_version then perform eps.fail('STALE_RESOURCE_VERSION','Provisional candidate changed.',409,source_row.row_version);end if;
 if eps.expected_version(p_input,'existing_candidate_row_version')<>target_row.row_version then perform eps.fail('STALE_RESOURCE_VERSION','Existing candidate changed.',409,target_row.row_version);end if;
 if to_regclass('eps.assignments') is not null then perform eps.fail('ASSIGNMENT_RETIREMENT_UNAVAILABLE','Assignment identity transfer must be integrated before linking profiles.',503);end if;
 select coalesce(array_agg(distinct pool.workspace_id),'{}') into affected_workspaces from eps.workspace_candidates pool where pool.candidate_id=source_row.id;
 set constraints eps.cast_pool_media_fk deferred;
 -- Preserve the existing participation's choices. The provisional participation
 -- is archived when both already exist in one project; its ID/notes/media/history
 -- remain. Otherwise the same participation ID is re-keyed without choice edits.
 for participation in select * from eps.workspace_candidates pool where pool.candidate_id=source_row.id order by pool.workspace_id,pool.id for update loop
  if not eps.cast_workspace_scope(participation.workspace_id,true) then perform eps.fail('RESOURCE_NOT_FOUND','Writable project participation not found.',404);end if;
  update eps.workspace_candidates pool set candidate_id=target_row.id,
   archived_at=case when participation.archived_at is null and exists(select 1 from eps.workspace_candidates existing where existing.workspace_id=participation.workspace_id and existing.candidate_id=target_row.id and existing.archived_at is null) then clock_timestamp() else participation.archived_at end,
   row_version=pool.row_version+1,updated_at=clock_timestamp() where pool.id=participation.id;
 end loop;
 update eps.candidate_media set candidate_id=target_row.id,row_version=row_version+1 where candidate_id=source_row.id;
 set constraints eps.cast_pool_media_fk immediate;
 for workspace in select value from unnest(affected_workspaces) value order by value loop
  -- Update only projects this acting user can edit, never a hidden pool row.
  if eps.cast_workspace_scope(workspace,true) then perform eps.cast_changed(workspace);end if;
 end loop;
 update eps.candidates set merged_into_candidate_id=target_row.id,duplicate_resolution='link_existing',archived_at=clock_timestamp(),row_version=row_version+1,updated_at=clock_timestamp() where id=source_row.id;
 result:=eps.cast_candidate_dto(target_row.id);
 return eps.finish_mutation('cast.resolve_candidate_duplicate',p_key,payload,result,source_row.id);
end $$;
create or replace function public.eps_resolve_candidate_duplicate(p_candidate_id uuid,p_input jsonb,p_idempotency_key text) returns jsonb language sql volatile security definer set search_path='' as $$ select eps.cast_link_duplicate(p_candidate_id,p_input,p_idempotency_key) $$;
grant create on schema eps to eps_cast_owner;
alter function eps.cast_archive_with_reason(text,uuid,jsonb,text) owner to eps_cast_owner;
alter function eps.cast_link_duplicate(uuid,jsonb,text) owner to eps_cast_owner;
revoke create on schema eps from eps_cast_owner;
revoke all on function eps.cast_archive_with_reason(text,uuid,jsonb,text),eps.cast_link_duplicate(uuid,jsonb,text) from public,anon,authenticated,service_role;
