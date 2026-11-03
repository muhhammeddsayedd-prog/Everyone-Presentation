
declare project_id uuid;client_id uuid;v_pool_ids uuid[];v_candidate_ids uuid[];v_media_ids uuid[];v_frame_asset_ids uuid[];v_pair_media_ids uuid[];v_pair_asset_ids uuid[];v_asset_ids uuid[];begin
 if not eps.presentation_scope(p_workspace,true)then perform eps.fail('RESOURCE_NOT_FOUND','Writable presentation workspace not found.',404);end if;
 select w.project_id into project_id from eps.workspaces w where w.id=p_workspace;
 begin
  perform 1 from public.projects p where p.id=project_id for share nowait;select p.client_id into client_id from public.projects p where p.id=project_id;
  perform 1 from public.clients c where c.id=client_id for share nowait;
  perform 1 from eps.presentation_templates t where t.key=p_template_key and t.version=p_template_version for share nowait;
  perform 1 from eps.specs where workspace_id=p_workspace order by id for share nowait;
  perform 1 from eps.roles where workspace_id=p_workspace and archived_at is null order by id for share nowait;
  perform 1 from eps.slots where workspace_id=p_workspace and archived_at is null order by id for share nowait;
  perform 1 from eps.assignments where workspace_id=p_workspace and archived_at is null order by id for share nowait;
  -- Keep the original pool-lock scope, including archived pools still referenced
  -- by active assignments. Capture mutable selected IDs only after pool locks.
  select coalesce(array_agg(p.id order by p.id),'{}'::uuid[])into v_pool_ids
   from eps.workspace_candidates p where p.workspace_id=p_workspace
   and exists(select 1 from eps.assignments a where a.workspace_candidate_id=p.id and a.archived_at is null);
  perform 1 from eps.workspace_candidates p where p.workspace_id=p_workspace and p.id=any(v_pool_ids)order by p.id for share nowait;
  with selected as materialized(
   select distinct p.id,p.candidate_id,p.selected_candidate_media_id,p.selected_frame_asset_ids
   from eps.workspace_candidates p
   where p.workspace_id=p_workspace and p.id=any(v_pool_ids)
  ),frames as materialized(
   select s.selected_candidate_media_id media_id,f.asset_id
   from selected s cross join lateral unnest(s.selected_frame_asset_ids)f(asset_id)
  ),pairs as materialized(
   select distinct media_id,asset_id from frames where media_id is not null and asset_id is not null
  )
  select
   (select coalesce(array_agg(distinct candidate_id order by candidate_id),'{}'::uuid[])from selected where candidate_id is not null),
   (select coalesce(array_agg(distinct selected_candidate_media_id order by selected_candidate_media_id),'{}'::uuid[])from selected where selected_candidate_media_id is not null),
   (select coalesce(array_agg(distinct asset_id order by asset_id),'{}'::uuid[])from frames where asset_id is not null),
   (select coalesce(array_agg(media_id order by media_id,asset_id),'{}'::uuid[])from pairs),
   (select coalesce(array_agg(asset_id order by media_id,asset_id),'{}'::uuid[])from pairs)
  into v_candidate_ids,v_media_ids,v_frame_asset_ids,v_pair_media_ids,v_pair_asset_ids;
  perform 1 from eps.candidates c where c.id=any(v_candidate_ids)order by c.id for share nowait;
  perform 1 from eps.candidate_media m where m.id=any(v_media_ids)order by m.id for share nowait;
  -- Source IDs are read after the media locks, at the same stage as the old
  -- asset query. Keep frame IDs even when no media/frame link is available.
  select coalesce(array_agg(distinct wanted.asset_id order by wanted.asset_id),'{}'::uuid[])into v_asset_ids
   from(select w.logo_asset_id asset_id from eps.workspaces w where w.id=p_workspace
    union all select m.source_asset_id from eps.candidate_media m where m.id=any(v_media_ids)
    union all select unnest(v_frame_asset_ids))wanted where wanted.asset_id is not null;
  perform 1 from eps.media_assets m where m.id=any(v_asset_ids)order by m.id for share nowait;
  -- Use exact media/frame pairs, not the cross product of two selected sets.
  perform 1 from eps.candidate_media_frames f
   where(f.candidate_media_id,f.asset_id)in(select k.media_id,k.asset_id from unnest(v_pair_media_ids,v_pair_asset_ids)k(media_id,asset_id))
   order by f.candidate_media_id,f.asset_id for share nowait;
 exception when lock_not_available then perform eps.fail('INPUT_CHANGED','Presentation source information is changing. Refresh review before generating.',409);end;
 if not eps.presentation_scope(p_workspace,true)then perform eps.fail('RESOURCE_NOT_FOUND','Writable presentation workspace changed.',404);end if;
end