-- Temporary owned-local proof helpers only; the caller installs these per session.
-- Exact4107 outer row predicates. EXISTS joins are not rewritten as locking joins.
create function pg_temp.locksource41_cohorts(p_workspace uuid,p_series uuid)returns jsonb
language plpgsql stable security invoker set search_path=''as $$
declare v_project uuid;v_client uuid;v_template_key text;v_template_version text;v_result jsonb:='[]';v_keys jsonb;
begin
 select w.project_id into v_project from eps.workspaces w where w.id=p_workspace;
 select p.client_id into v_client from public.projects p where p.id=v_project;
 select s.template_key,s.template_version into v_template_key,v_template_version
  from eps.presentation_series s where s.id=p_series and s.workspace_id=p_workspace;
 if not found then raise exception 'LOCKSOURCE41_SERIES_REQUIRED'using errcode='22023';end if;
 -- cohort:public.projects
 select coalesce(jsonb_agg(jsonb_build_object('id',q.id)order by q.id),'[]')into v_keys
  from(select p.id from public.projects p where p.id=v_project)q;
 v_result:=v_result||jsonb_build_array(jsonb_build_object('relation','public.projects','keys',v_keys));
 -- cohort:public.clients
 select coalesce(jsonb_agg(jsonb_build_object('id',q.id)order by q.id),'[]')into v_keys
  from(select c.id from public.clients c where c.id=v_client)q;
 v_result:=v_result||jsonb_build_array(jsonb_build_object('relation','public.clients','keys',v_keys));
 -- cohort:eps.presentation_templates
 select coalesce(jsonb_agg(jsonb_build_object('key',q.key,'version',q.version)order by q.key,q.version),'[]')into v_keys
  from(select t.key,t.version from eps.presentation_templates t where t.key=v_template_key and t.version=v_template_version)q;
 v_result:=v_result||jsonb_build_array(jsonb_build_object('relation','eps.presentation_templates','keys',v_keys));
 -- cohort:eps.specs
 select coalesce(jsonb_agg(jsonb_build_object('id',q.id)order by q.id),'[]')into v_keys
  from(select id from eps.specs where workspace_id=p_workspace order by id)q;
 v_result:=v_result||jsonb_build_array(jsonb_build_object('relation','eps.specs','keys',v_keys));
 -- cohort:eps.roles
 select coalesce(jsonb_agg(jsonb_build_object('id',q.id)order by q.id),'[]')into v_keys
  from(select id from eps.roles where workspace_id=p_workspace and archived_at is null order by id)q;
 v_result:=v_result||jsonb_build_array(jsonb_build_object('relation','eps.roles','keys',v_keys));
 -- cohort:eps.slots
 select coalesce(jsonb_agg(jsonb_build_object('id',q.id)order by q.id),'[]')into v_keys
  from(select id from eps.slots where workspace_id=p_workspace and archived_at is null order by id)q;
 v_result:=v_result||jsonb_build_array(jsonb_build_object('relation','eps.slots','keys',v_keys));
 -- cohort:eps.assignments
 select coalesce(jsonb_agg(jsonb_build_object('id',q.id)order by q.id),'[]')into v_keys
  from(select id from eps.assignments where workspace_id=p_workspace and archived_at is null order by id)q;
 v_result:=v_result||jsonb_build_array(jsonb_build_object('relation','eps.assignments','keys',v_keys));
 -- cohort:eps.workspace_candidates
 select coalesce(jsonb_agg(jsonb_build_object('id',q.id)order by q.id),'[]')into v_keys
  from(select p.id from eps.workspace_candidates p where p.workspace_id=p_workspace and exists(select 1 from eps.assignments a where a.workspace_candidate_id=p.id and a.archived_at is null)order by p.id)q;
 v_result:=v_result||jsonb_build_array(jsonb_build_object('relation','eps.workspace_candidates','keys',v_keys));
 -- cohort:eps.candidates
 select coalesce(jsonb_agg(jsonb_build_object('id',q.id)order by q.id),'[]')into v_keys
  from(select c.id from eps.candidates c where exists(select 1 from eps.workspace_candidates p join eps.assignments a on a.workspace_candidate_id=p.id where p.candidate_id=c.id and a.workspace_id=p_workspace and a.archived_at is null)order by c.id)q;
 v_result:=v_result||jsonb_build_array(jsonb_build_object('relation','eps.candidates','keys',v_keys));
 -- cohort:eps.candidate_media
 select coalesce(jsonb_agg(jsonb_build_object('id',q.id)order by q.id),'[]')into v_keys
  from(select m.id from eps.candidate_media m where exists(select 1 from eps.workspace_candidates p join eps.assignments a on a.workspace_candidate_id=p.id where p.selected_candidate_media_id=m.id and a.workspace_id=p_workspace and a.archived_at is null)order by m.id)q;
 v_result:=v_result||jsonb_build_array(jsonb_build_object('relation','eps.candidate_media','keys',v_keys));
 -- cohort:eps.media_assets
 select coalesce(jsonb_agg(jsonb_build_object('id',q.id)order by q.id),'[]')into v_keys
  from(select m.id from eps.media_assets m where m.id=(select logo_asset_id from eps.workspaces where id=p_workspace)
   or exists(select 1 from eps.workspace_candidates p join eps.assignments a on a.workspace_candidate_id=p.id left join eps.candidate_media v on v.id=p.selected_candidate_media_id where a.workspace_id=p_workspace and a.archived_at is null and(m.id=v.source_asset_id or m.id=any(p.selected_frame_asset_ids)))order by m.id)q;
 v_result:=v_result||jsonb_build_array(jsonb_build_object('relation','eps.media_assets','keys',v_keys));
 -- cohort:eps.candidate_media_frames
 select coalesce(jsonb_agg(jsonb_build_object('candidate_media_id',q.candidate_media_id,'asset_id',q.asset_id)order by q.candidate_media_id,q.asset_id),'[]')into v_keys
  from(select f.candidate_media_id,f.asset_id from eps.candidate_media_frames f where exists(select 1 from eps.workspace_candidates p join eps.assignments a on a.workspace_candidate_id=p.id where a.workspace_id=p_workspace and a.archived_at is null and f.candidate_media_id=p.selected_candidate_media_id and f.asset_id=any(p.selected_frame_asset_ids))order by f.candidate_media_id,f.asset_id)q;
 v_result:=v_result||jsonb_build_array(jsonb_build_object('relation','eps.candidate_media_frames','keys',v_keys));
 return v_result;
end$$;

-- Distinguish the helper's SHARE lock from a fixture FK's weaker KEY SHARE.
-- This additional probe is closed to one pool ID and one fixed lock strength.
create function pg_temp.locksource41_probe_pool_share(p_pool uuid)returns jsonb
language plpgsql volatile security invoker set search_path=''as $$
declare v_found boolean;
begin
 begin
  select true into v_found from eps.workspace_candidates where id=p_pool for no key update nowait;
  return jsonb_build_object('found',coalesce(v_found,false),'locked',false);
 exception when lock_not_available then return jsonb_build_object('found',true,'locked',true,'code','55P03');
 when insufficient_privilege then return jsonb_build_object('found',false,'locked',false,'code','42501');
 end;
end$$;

-- locked=true means another transaction prevented NOWAIT acquisition, not that
-- this contender acquired a lock. Permission denial is never counted as held.
create function pg_temp.locksource41_probe(p_relation text,p_key jsonb)returns jsonb
language plpgsql volatile security invoker set search_path=''as $$
declare v_columns text[];v_values text[];v_query text;v_found boolean;v_name text;
begin
 case p_relation
 when 'public.projects','public.clients','eps.specs','eps.roles','eps.slots','eps.assignments','eps.workspace_candidates','eps.candidates','eps.candidate_media','eps.media_assets' then
  v_columns:=array['id'];v_query:='select true from '||p_relation||' where id=$1::uuid for update nowait';
 when 'eps.presentation_templates' then
  v_columns:=array['key','version'];v_query:='select true from eps.presentation_templates where key=$1 and version=$2 for update nowait';
 when 'eps.candidate_media_frames' then
  v_columns:=array['asset_id','candidate_media_id'];v_query:='select true from eps.candidate_media_frames where asset_id=$1::uuid and candidate_media_id=$2::uuid for update nowait';
 else raise exception 'LOCKSOURCE41_PROBE_RELATION_REQUIRED'using errcode='22023';
 end case;
 if jsonb_typeof(p_key)is distinct from'object'or(select array_agg(key order by key)from jsonb_object_keys(p_key)key)is distinct from v_columns then
  raise exception 'LOCKSOURCE41_PROBE_KEY_REQUIRED'using errcode='22023';
 end if;
 foreach v_name in array v_columns loop
  if jsonb_typeof(p_key->v_name)is distinct from'string' then raise exception 'LOCKSOURCE41_PROBE_KEY_REQUIRED'using errcode='22023';end if;
  if p_relation<>'eps.presentation_templates'and(p_key->>v_name)!~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'then raise exception 'LOCKSOURCE41_PROBE_KEY_REQUIRED'using errcode='22023';end if;
 end loop;
 select array_agg(p_key->>name order by ord)into v_values from unnest(v_columns)with ordinality k(name,ord);
 begin
  execute v_query into v_found using v_values[1],v_values[2];
  return jsonb_build_object('found',coalesce(v_found,false),'locked',false);
 exception when lock_not_available then return jsonb_build_object('found',true,'locked',true,'code','55P03');
 when insufficient_privilege then return jsonb_build_object('found',false,'locked',false,'code','42501');
 end;
end$$;
