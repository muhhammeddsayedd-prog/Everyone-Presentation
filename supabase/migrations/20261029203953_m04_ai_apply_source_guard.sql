-- Additive forward fix after exact22. Preserve existing history and manual PATCH.
set local search_path='';set local lock_timeout='3s';set local statement_timeout='30s';
do $$begin
 if current_user<>'postgres'or current_database()<>'postgres'or(select count(*)from supabase_migrations.schema_migrations)<>22
 or(select max(version)from supabase_migrations.schema_migrations)<>'20261029202629'
 or to_regprocedure('eps.assert_assignment_ai_apply(uuid,jsonb)')is not null then raise exception'M04_AI_APPLY_EXACT22_REQUIRED';end if;
end$$;
-- FOR SHARE requires a column UPDATE privilege. These grants authorize locks
-- only: the restrictive WITH CHECK(false) prevents actual source-row writes,
-- including through inherited permissive policies. Existing SELECT RLS remains.
do $locks$declare item record;begin
 for item in select * from(values
 ('public','projects','id'),('public','clients','id'),('eps','specs','id'),('eps','roles','id'),('eps','slots','id'),
 ('eps','workspace_candidates','id'),('eps','candidates','id'),('eps','candidate_media','id'),
 ('eps','candidate_media_frames','candidate_media_id'),('eps','media_assets','id'),('eps','presentation_templates','key'),('eps','assignments','id'),('eps','jobs','id')
 )v(schema_name,table_name,column_name)loop
  execute format('grant update(%I)on %I.%I to eps_review_owner',item.column_name,item.schema_name,item.table_name);
  execute format('create policy review_apply_source_lock on %I.%I for update to eps_review_owner using(eps.has_capability(''cast.read'')and eps.has_capability(''workspaces.write''))with check(false)',item.schema_name,item.table_name);
  execute format('create policy review_apply_source_no_write on %I.%I as restrictive for update to eps_review_owner using(true)with check(false)',item.schema_name,item.table_name);
 end loop;
end$locks$;
create function eps.assert_assignment_ai_apply(p_assignment_id uuid,p_input jsonb)returns void language plpgsql volatile security definer set search_path=''as $$
declare assignment eps.assignments;pool eps.workspace_candidates;suggestion eps.ai_suggestions;job eps.jobs;binding jsonb;review jsonb;series_id uuid;suggestion_id uuid;field_value text;project_id uuid;client_id uuid;expected bigint;begin
 perform eps.require_capability('workspaces.write');perform eps.require_capability('cast.read');
 perform eps.review_body(p_input,array['row_version','slide_wording','ai_suggestion_id','expected_series_id','expected_input_fingerprint'],array['row_version','slide_wording','ai_suggestion_id','expected_series_id','expected_input_fingerprint']);
 expected:=eps.casting_version(p_input->'row_version');suggestion_id:=eps.casting_uuid(p_input->'ai_suggestion_id');series_id:=eps.casting_uuid(p_input->'expected_series_id');
 if jsonb_typeof(p_input->'expected_input_fingerprint')is distinct from'string'or(p_input->>'expected_input_fingerprint')!~'^[a-f0-9]{64}$'or jsonb_typeof(p_input->'slide_wording')is distinct from'object'then perform eps.fail('VALIDATION_FAILED','An exact source-bound proposal and review are required.',400);end if;
 select * into assignment from eps.assignments where id=p_assignment_id and archived_at is null;if not found then perform eps.fail('RESOURCE_NOT_FOUND','Assignment unavailable.',404);end if;
 perform eps.review_require(assignment.workspace_id);
 select w.project_id into project_id from eps.workspaces w where w.id=assignment.workspace_id and w.archived_at is null;
 if not eps.project_scope(project_id,true)then perform eps.fail('RESOURCE_NOT_FOUND','Writable proposal workspace unavailable.',404);end if;
 -- The caller already owns aggregate/slot/pool/target locks. Freeze all rows
 -- that the exact selected review can read. NOWAIT prevents inversion with
 -- candidate/media writers that legitimately acquire a shared source first.
 begin
  perform 1 from public.projects p where p.id=project_id for share nowait;
  select p.client_id into client_id from public.projects p where p.id=project_id;
  perform 1 from public.clients c where c.id=client_id for share nowait;
  perform 1 from eps.presentation_templates where key='everyone-casting'and version='1.0.0'for share nowait;
  perform 1 from eps.specs where workspace_id=assignment.workspace_id order by id for share nowait;
  perform 1 from eps.roles where workspace_id=assignment.workspace_id and archived_at is null order by id for share nowait;
  perform 1 from eps.slots where workspace_id=assignment.workspace_id and archived_at is null order by id for share nowait;
  perform 1 from eps.assignments where workspace_id=assignment.workspace_id and archived_at is null order by id for share nowait;
  perform 1 from eps.workspace_candidates p where p.workspace_id=assignment.workspace_id and exists(select 1 from eps.assignments a where a.workspace_candidate_id=p.id and a.archived_at is null)order by p.id for share nowait;
  perform 1 from eps.candidates c where exists(select 1 from eps.workspace_candidates p join eps.assignments a on a.workspace_candidate_id=p.id where p.candidate_id=c.id and a.workspace_id=assignment.workspace_id and a.archived_at is null)order by c.id for share nowait;
  perform 1 from eps.candidate_media m where exists(select 1 from eps.workspace_candidates p join eps.assignments a on a.workspace_candidate_id=p.id where p.selected_candidate_media_id=m.id and a.workspace_id=assignment.workspace_id and a.archived_at is null)order by m.id for share nowait;
  perform 1 from eps.media_assets m where m.id=(select logo_asset_id from eps.workspaces where id=assignment.workspace_id)
   or exists(select 1 from eps.workspace_candidates p join eps.assignments a on a.workspace_candidate_id=p.id left join eps.candidate_media v on v.id=p.selected_candidate_media_id where a.workspace_id=assignment.workspace_id and a.archived_at is null and(m.id=v.source_asset_id or m.id=any(p.selected_frame_asset_ids)))order by m.id for share nowait;
  perform 1 from eps.candidate_media_frames f where exists(select 1 from eps.workspace_candidates p join eps.assignments a on a.workspace_candidate_id=p.id where a.workspace_id=assignment.workspace_id and a.archived_at is null and f.candidate_media_id=p.selected_candidate_media_id and f.asset_id=any(p.selected_frame_asset_ids))order by f.candidate_media_id,f.asset_id for share nowait;
  perform 1 from eps.jobs j join eps.ai_suggestions s on s.job_id=j.id where s.id=suggestion_id for share of j nowait;
 exception when lock_not_available then perform eps.fail('INPUT_CHANGED','A review source is changing. Refresh before applying this proposal.',409);end;
 perform eps.require_capability('workspaces.write');perform eps.require_capability('cast.read');perform eps.review_require(assignment.workspace_id);
 if not eps.project_scope(project_id,true)then perform eps.fail('RESOURCE_NOT_FOUND','Writable proposal workspace changed.',404);end if;
 select * into suggestion from eps.ai_suggestions s where s.id=suggestion_id and s.workspace_id=assignment.workspace_id and s.target_type='assignment'and s.target_id=assignment.id;
 if not found then perform eps.fail('RESOURCE_NOT_FOUND','Assignment proposal unavailable.',404);end if;
 select * into job from eps.jobs j where j.id=suggestion.job_id and j.kind='ai_suggestion'and j.resource_id=suggestion.id and j.workspace_id=assignment.workspace_id;
 if not found or job.status<>'succeeded'or suggestion.proposal is null then perform eps.fail('INPUT_CHANGED','This proposal is not ready to apply.',409);end if;
 if assignment.row_version<>expected or suggestion.target_row_version<>expected then perform eps.fail('STALE_RESOURCE_VERSION','Proposal target changed.',409,assignment.row_version);end if;
 binding:=eps.review_target_context(assignment.workspace_id,'assignment',assignment.id,suggestion.field);
 if(binding->>'bound_context_sha256')is distinct from suggestion.bound_context_sha256 then perform eps.fail('INPUT_CHANGED','The original proposal source changed.',409);end if;
 if jsonb_typeof(suggestion.proposal->'proposed_changes')is distinct from'array'then perform eps.fail('INPUT_CHANGED','The proposal cannot be applied.',409);end if;
 if jsonb_array_length(suggestion.proposal->'proposed_changes')<>1 or suggestion.proposal#>>'{proposed_changes,0,field}'is distinct from suggestion.field or suggestion.proposal#>>'{proposed_changes,0,old_value}'is distinct from binding->>'source_text'
 or suggestion.proposal#>>'{proposed_changes,0,new_value}'is distinct from suggestion.proposal->>'suggested_text'or jsonb_typeof(suggestion.proposal->'suggested_text')is distinct from'string'
 or(select count(*)from jsonb_object_keys(p_input->'slide_wording'))<>1 or not(p_input->'slide_wording'?suggestion.field)or p_input#>>array['slide_wording',suggestion.field]is distinct from suggestion.proposal->>'suggested_text'
 then perform eps.fail('VALIDATION_FAILED','Apply exactly the supplied proposal field and wording.',400);end if;
 review:=eps.review_snapshot_data(assignment.workspace_id,series_id,null);
 if(review->>'input_fingerprint')is distinct from(p_input->>'expected_input_fingerprint')then perform eps.fail('INPUT_CHANGED','The reviewed presentation changed. Refresh before applying this proposal.',409);end if;
end$$;
grant create on schema eps to eps_review_owner;
alter function eps.assert_assignment_ai_apply(uuid,jsonb)owner to eps_review_owner;
revoke create on schema eps from eps_review_owner;
revoke all on function eps.assert_assignment_ai_apply(uuid,jsonb)from public,anon,authenticated,service_role;
grant execute on function eps.assert_assignment_ai_apply(uuid,jsonb)to eps_casting_owner;
do $integrate$
declare source text;definition text;body text;anchor text;begin
 select prosrc,pg_get_functiondef(oid)into source,definition from pg_proc where oid='public.eps_update_assignment(uuid,jsonb,text)'::regprocedure;
 body:=replace(source,E'\r\n',E'\n');
 if encode(sha256(convert_to(body,'UTF8')),'hex')<>'e64451907fa024c01b50b68d9eca2e974e8dd072727c968383f7f1bfbfa3f91b'then raise exception'M04_AI_APPLY_EXACT_PRECEDING_PATCH_REQUIRED';end if;
 anchor:='array[''row_version'',''position'',''shortlist_included'',''presentation_notes'',''internal_notes'',''slide_wording'']';
 if(length(body)-length(replace(body,anchor,'')))<>length(anchor)then raise exception'M04_AI_APPLY_PATCH_BODY_SEAM_REQUIRED';end if;
 body:=replace(body,anchor,'array[''row_version'',''position'',''shortlist_included'',''presentation_notes'',''internal_notes'',''slide_wording'',''ai_suggestion_id'',''expected_series_id'',''expected_input_fingerprint'']');
 anchor:=' if cached is not null then';
 if(length(body)-length(replace(body,anchor,'')))<>length(anchor)then raise exception'M04_AI_APPLY_PATCH_REPLAY_SEAM_REQUIRED';end if;
 body:=replace(body,anchor,E' if p_input?|array[''ai_suggestion_id'',''expected_series_id'',''expected_input_fingerprint'']then perform eps.require_capability(''cast.read'');end if;\n'||anchor);
 anchor:=' if p_input?''position''and item.position=''main''then';
 if(length(body)-length(replace(body,anchor,'')))<>length(anchor)then raise exception'M04_AI_APPLY_PATCH_GUARD_SEAM_REQUIRED';end if;
 body:=replace(body,anchor,E' if p_input?|array[''ai_suggestion_id'',''expected_series_id'',''expected_input_fingerprint'']then perform eps.assert_assignment_ai_apply(item.id,p_input);end if;\n'||anchor);
 execute replace(definition,source,body);
end$integrate$;
notify pgrst,'reload schema';
