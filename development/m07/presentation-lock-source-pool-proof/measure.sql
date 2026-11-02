-- No exception handler: an actual PostgreSQL failure reaches verbose psql and
-- the protected first-error sink. The production helper and8s remain unchanged.
create function pg_temp.pool_proof_measure(p_workspace uuid)returns jsonb
language plpgsql volatile security invoker set search_path=''as $measure$
declare started timestamptz:=clock_timestamp();begin
 if current_user<>'eps_review_owner'or current_setting('statement_timeout')<>'8s'or current_setting('lock_timeout')<>'8s'
 then raise exception'POOL_PROOF_REAL_CALLER_AND_EIGHT_SECONDS_REQUIRED';end if;
 perform eps.presentation_lock_sources(p_workspace,'everyone-casting','1.1.0');
 return jsonb_build_object('ok',true,'duration_ms',extract(epoch from(clock_timestamp()-started))*1000,'role',current_user);
end$measure$;

create function pg_temp.pool_proof_capture_ids(p_workspace uuid)returns uuid[]
language sql stable security invoker set search_path=''as $ids$
 select coalesce(array_agg(p.id order by p.id),'{}'::uuid[])
 from eps.workspace_candidates p where p.workspace_id=p_workspace
 and exists(select 1 from eps.assignments a where a.workspace_candidate_id=p.id and a.archived_at is null)
$ids$;

create function pg_temp.pool_proof_tuples(p_variant text,p_workspace uuid,p_pool_ids uuid[])returns jsonb
language plpgsql stable security invoker set search_path=''as $tuples$
declare answer jsonb;begin
 if p_variant='old'then
  select coalesce(jsonb_agg(to_jsonb(q)order by q.id),'[]')into answer from(
   select distinct p.id,p.candidate_id,p.selected_candidate_media_id,p.selected_frame_asset_ids
   from eps.workspace_candidates p join eps.assignments a on a.workspace_candidate_id=p.id
   where a.workspace_id=p_workspace and a.archived_at is null
  )q;
 elsif p_variant='new'then
  select coalesce(jsonb_agg(to_jsonb(q)order by q.id),'[]')into answer from(
   select distinct p.id,p.candidate_id,p.selected_candidate_media_id,p.selected_frame_asset_ids
   from eps.workspace_candidates p
   where p.workspace_id=p_workspace and p.id=any(p_pool_ids)
  )q;
 else raise exception'POOL_PROOF_CLOSED_TUPLE_VARIANT_REQUIRED';end if;
 return answer;
end$tuples$;
