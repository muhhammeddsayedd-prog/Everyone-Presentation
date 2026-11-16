-- A2 structured scene operations (m17_scene_operations). Run after every migration as supabase_admin.
-- Synthetic data only, one transaction rolled back at the end. Every failed check raises.
begin;
set local search_path='';

create temp table a2_ids(k text primary key, v uuid not null) on commit drop;
grant all on a2_ids to public;
insert into a2_ids(k,v) select k,gen_random_uuid() from unnest(array['producer','reader','project','other_project','ws','other_ws',
  'father','father_other','mother','other_role','slot_f','slot_fo','slot_m','slot_x','cand1','cand2','wc1','wc2','a1','a2','b1']) k;

create function pg_temp.id(p_key text) returns uuid language sql stable as $$ select v from a2_ids where k=p_key $$;
create function pg_temp.expect(p_sql text, p_code text) returns void language plpgsql as $$
begin
  execute p_sql;
  raise exception 'A2_CHECK_FAILED expected % from: %', p_code, left(p_sql, 200);
exception when others then
  if sqlerrm like 'A2_CHECK_FAILED%' then raise; end if;
  if sqlerrm<>p_code then raise exception 'A2_CHECK_FAILED expected % but got % from: %', p_code, sqlerrm, left(p_sql, 200); end if;
end $$;
create function pg_temp.check(p_ok boolean, p_label text) returns void language plpgsql as $$ begin
  if p_ok is not true then raise exception 'A2_CHECK_FAILED %', p_label; end if;
  perform set_config('eps.a2_checks', (coalesce(nullif(current_setting('eps.a2_checks', true), ''), '0')::integer + 1)::text, true);
end $$;
create function pg_temp.key() returns text language sql volatile as $$ select 'a2-'||gen_random_uuid()::text $$;
create function pg_temp.casting(p_workspace uuid) returns jsonb language sql stable security definer as $$
  select jsonb_build_object('roles',(select jsonb_agg(to_jsonb(r) order by id) from eps.roles r where workspace_id=p_workspace),
    'slots',(select jsonb_agg(to_jsonb(s) order by id) from eps.slots s where workspace_id=p_workspace),
    'assignments',(select jsonb_agg(to_jsonb(a) order by id) from eps.assignments a where workspace_id=p_workspace),
    'pool',(select jsonb_agg(to_jsonb(p) order by id) from eps.workspace_candidates p where workspace_id=p_workspace),
    'candidates',(select jsonb_agg(to_jsonb(c) order by id) from eps.candidates c where id in(select candidate_id from eps.workspace_candidates where workspace_id=p_workspace)))
$$;
-- Reads for checks made while acting as a user (the tables have no direct grants).
create function pg_temp.q(p_sql text) returns jsonb language plpgsql security definer as $$ declare r jsonb; begin execute 'select to_jsonb(('||p_sql||'))' into r; return r; end $$;
create function pg_temp.workspace(p_workspace uuid) returns jsonb language sql stable security definer as $$
  select jsonb_build_object('row_version',row_version,'draft_revision',draft_revision,'has_unpublished_changes',has_unpublished_changes) from eps.workspaces where id=p_workspace
$$;
create function pg_temp.as_user(p_key text) returns void language plpgsql as $$ begin
  perform set_config('request.jwt.claims', json_build_object('sub', pg_temp.id(p_key), 'role', 'authenticated', 'is_anonymous', false)::text, true);
  perform set_config('request.jwt.claim.sub', pg_temp.id(p_key)::text, true);
end $$;

-- Seed (replica role: direct synthetic rows, no triggers) -----------------------------------
insert into auth.users(id,instance_id,aud,role,email) select pg_temp.id(k),'00000000-0000-0000-0000-000000000000','authenticated','authenticated',k||'@example.invalid' from unnest(array['producer','reader']) k;
set local session_replication_role=replica;
insert into public.app_capability_grants(principal_id,capability,active)
  select pg_temp.id('producer'),c,true from unnest(array['projects.read','workspaces.read','workspaces.write','cast.read']) c
  union all select pg_temp.id('reader'),c,true from unnest(array['projects.read','workspaces.read']) c;
insert into public.projects(id,name) values(pg_temp.id('project'),'Synthetic scenes project'),(pg_temp.id('other_project'),'Other synthetic project');
insert into public.project_memberships(project_id,principal_id,can_write,active) values(pg_temp.id('project'),pg_temp.id('producer'),true,true),
  (pg_temp.id('other_project'),pg_temp.id('producer'),true,true),(pg_temp.id('project'),pg_temp.id('reader'),false,true);
insert into eps.workspaces(id,project_id) values(pg_temp.id('ws'),pg_temp.id('project')),(pg_temp.id('other_ws'),pg_temp.id('other_project'));
insert into eps.roles(id,workspace_id,name,headcount,requirements,sort_order) values
  (pg_temp.id('father'),pg_temp.id('ws'),'Father',1,'{"scene_references":["1","3","5"]}',0),
  (pg_temp.id('father_other'),pg_temp.id('ws'),'Father',1,'{}',1),
  (pg_temp.id('mother'),pg_temp.id('ws'),'Mother',1,'{}',2),
  (pg_temp.id('other_role'),pg_temp.id('other_ws'),'Father',1,'{}',0);
insert into eps.slots(id,workspace_id,role_id,ordinal,label,sort_order) values
  (pg_temp.id('slot_f'),pg_temp.id('ws'),pg_temp.id('father'),1,'Father 1',0),(pg_temp.id('slot_fo'),pg_temp.id('ws'),pg_temp.id('father_other'),1,'Father 1',0),
  (pg_temp.id('slot_m'),pg_temp.id('ws'),pg_temp.id('mother'),1,'Mother 1',0),(pg_temp.id('slot_x'),pg_temp.id('other_ws'),pg_temp.id('other_role'),1,'Father 1',0);
insert into eps.candidates(id,casting_id,facts,source_kind,created_by) select pg_temp.id(k),'EPS-SYN-'||k,jsonb_build_object('name','Synthetic '||k),'archive',pg_temp.id('producer') from unnest(array['cand1','cand2']) k;
insert into eps.workspace_candidates(id,workspace_id,candidate_id) values(pg_temp.id('wc1'),pg_temp.id('ws'),pg_temp.id('cand1')),(pg_temp.id('wc2'),pg_temp.id('ws'),pg_temp.id('cand2'));
insert into eps.assignments(id,workspace_id,slot_id,workspace_candidate_id,position,sort_order) values
  (pg_temp.id('a1'),pg_temp.id('ws'),pg_temp.id('slot_f'),pg_temp.id('wc1'),'option',0),(pg_temp.id('a2'),pg_temp.id('ws'),pg_temp.id('slot_f'),pg_temp.id('wc2'),'option',1),
  (pg_temp.id('b1'),pg_temp.id('ws'),pg_temp.id('slot_fo'),pg_temp.id('wc1'),'option',0);
set local session_replication_role=origin;

-- Act as the producer ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.as_user('producer');
do $$
declare ws uuid:=pg_temp.id('ws'); s jsonb; s1 uuid; s2 uuid; s3 uuid; s5 uuid; before jsonb; after jsonb; w jsonb; w2 jsonb; k text; r1 jsonb; r2 jsonb; occ uuid; listed jsonb; begin
  -- Create scenes 1, 2, 3, 5; manual scenes are confirmed and appended.
  w:=pg_temp.workspace(ws);
  s:=public.eps_create_scene(ws,'{"title":"Kitchen at night","scene_number":"1","setting":"INT. KITCHEN - NIGHT"}',pg_temp.key()); s1:=(s->>'id')::uuid;
  perform pg_temp.check(s->>'status'='confirmed' and s->'requirements'='{"items":[]}' and (s->>'sort_order')::int=0 and s->'occurrences'='[]','create returns a confirmed empty scene');
  w2:=pg_temp.workspace(ws);
  perform pg_temp.check((w2->>'draft_revision')::int=(w->>'draft_revision')::int+1 and (w2->>'has_unpublished_changes')::boolean,'create bumps draft_revision');
  s2:=(public.eps_create_scene(ws,'{"title":"Office","scene_number":"2"}',pg_temp.key())->>'id')::uuid;
  s3:=(public.eps_create_scene(ws,'{"title":"Garden","scene_number":"3","requirements":{"items":["Rain on set"]}}',pg_temp.key())->>'id')::uuid;
  s5:=(public.eps_create_scene(ws,'{"title":"Hospital","scene_number":"5"}',pg_temp.key())->>'id')::uuid;
  insert into a2_ids values('s1',s1),('s2',s2),('s3',s3),('s5',s5);
  perform pg_temp.expect(format('select public.eps_create_scene(%L,%L,null)',ws,'{"title":"x"}'),'IDEMPOTENCY_KEY_REQUIRED');
  perform pg_temp.expect(format('select public.eps_create_scene(%L,%L,%L)',ws,'{"title":"   "}',pg_temp.key()),'INVALID_REQUEST');
  perform pg_temp.expect(format('select public.eps_create_scene(%L,%L,%L)',ws,'{"title":"x","status":"proposed"}',pg_temp.key()),'INVALID_REQUEST');
  -- Idempotent replay returns the same scene; a reused key with other input is refused.
  k:=pg_temp.key(); r1:=public.eps_create_scene(ws,'{"title":"Replay"}',k); r2:=public.eps_create_scene(ws,'{"title":"Replay"}',k);
  perform pg_temp.check(r1->>'id'=r2->>'id' and pg_temp.q(format('select count(*) from eps.scenes where workspace_id=%L and title=''Replay''',ws))='1','create replay is idempotent');
  perform pg_temp.expect(format('select public.eps_create_scene(%L,%L,%L)',ws,'{"title":"Other"}',k),'IDEMPOTENCY_KEY_REUSED');
  perform public.eps_archive_scene((r1->>'id')::uuid,jsonb_build_object('row_version',(r1->>'row_version')::int),pg_temp.key());

  -- The Father appears in scenes 1, 3 and 5 through one canonical role.
  before:=pg_temp.casting(ws);
  foreach occ in array array[s1,s3,s5] loop
    s:=public.eps_link_scene_occurrence(occ,jsonb_build_object('role_id',pg_temp.id('father')),pg_temp.key());
  end loop;
  perform pg_temp.check(jsonb_array_length(s->'occurrences')=1 and s->'occurrences'->0->>'role_id'=pg_temp.id('father')::text
    and s->'occurrences'->0->'slot_ids'='[]' and s->'occurrences'->0->>'role_name'='Father' and s->'occurrences'->0->>'deck_placement'='auto'
    and s->'occurrences'->0->>'status'='confirmed' and (s->'occurrences'->0->>'proposal_stale')::boolean=false,'link returns the parent scene with the occurrence');
  perform pg_temp.check(pg_temp.casting(ws)=before,'linking never changes roles, slots, assignments, pool or candidates');
  perform pg_temp.expect(format('select public.eps_link_scene_occurrence(%L,%L,%L)',s1,jsonb_build_object('role_id',pg_temp.id('father')),pg_temp.key()),'SCENE_OCCURRENCE_EXISTS');
  -- Integrity: cross-workspace role and foreign slots are refused.
  perform pg_temp.expect(format('select public.eps_link_scene_occurrence(%L,%L,%L)',s2,jsonb_build_object('role_id',pg_temp.id('other_role')),pg_temp.key()),'RESOURCE_NOT_FOUND');
  perform pg_temp.expect(format('select public.eps_link_scene_occurrence(%L,%L,%L)',s2,jsonb_build_object('role_id',pg_temp.id('father'),'slot_ids',jsonb_build_array(pg_temp.id('slot_fo'))),pg_temp.key()),'INVALID_REQUEST');
  perform pg_temp.expect(format('select public.eps_link_scene_occurrence(%L,%L,%L)',s2,jsonb_build_object('role_id',pg_temp.id('father'),'slot_ids',jsonb_build_array(pg_temp.id('slot_x'))),pg_temp.key()),'INVALID_REQUEST');
  perform pg_temp.expect(format('select public.eps_link_scene_occurrence(%L,%L,%L)',s2,jsonb_build_object('role_id',pg_temp.id('father'),'slot_ids',jsonb_build_array(pg_temp.id('slot_f'),pg_temp.id('slot_f'))),pg_temp.key()),'INVALID_REQUEST');
  perform pg_temp.expect(format('select public.eps_link_scene_occurrence(%L,%L,%L)',s2,jsonb_build_object('role_id',pg_temp.id('father'),'deck_placement','twice'),pg_temp.key()),'INVALID_REQUEST');
  -- An explicit subset of the role's own slots is accepted (Mother in scene 2).
  s:=public.eps_link_scene_occurrence(s2,jsonb_build_object('role_id',pg_temp.id('mother'),'slot_ids',jsonb_build_array(pg_temp.id('slot_m')),'setting_override','Lobby'),pg_temp.key());
  perform pg_temp.check(s->'occurrences'->0->'slot_ids'=jsonb_build_array(pg_temp.id('slot_m')) and s->'occurrences'->0->>'setting_override'='Lobby','slot subset link');
  perform pg_temp.check(pg_temp.q('select not exists(select 1 from eps.scene_occurrences where role_id=pg_temp.id(''father_other''))')='true','the unrelated Father is never linked by name');
  listed:=public.eps_list_role_occurrences(pg_temp.id('father'));
  perform pg_temp.check(jsonb_array_length(listed->'data')=3 and listed->'data'->0->>'scene_number'='1' and listed->'data'->1->>'scene_number'='3'
    and listed->'data'->2->>'scene_number'='5' and (listed->'data'->1->>'scene_position')::int=3,'role occurrences list scenes 1, 3 and 5 in order');
  perform pg_temp.check(jsonb_array_length(public.eps_list_role_occurrences(pg_temp.id('father_other'))->'data')=0,'unrelated Father has no scenes');
end $$;

-- Choose Main once from Scene 3: every occurrence resolves to the same slot and assignment.
do $$
declare ws uuid:=pg_temp.id('ws'); slot_version bigint; page jsonb; scene jsonb; occurrence jsonb; other_before jsonb; begin
  other_before:=pg_temp.q('select jsonb_agg(to_jsonb(a) order by id) from eps.assignments a where slot_id=pg_temp.id(''slot_fo'')');
  slot_version:=pg_temp.q('select row_version from eps.slots where id=pg_temp.id(''slot_f'')');
  perform public.eps_set_slot_main(pg_temp.id('slot_f'),jsonb_build_object('assignment_id',pg_temp.id('a1'),'expected_slot_row_version',slot_version,
    'replacement_behavior','move_previous_to_backup'),pg_temp.key());
  page:=public.eps_list_scenes(ws,null,25);
  perform pg_temp.check(jsonb_array_length(page->'data')=4 and page->'page'->>'next_cursor' is null,'four active scenes listed');
  for scene in select value from jsonb_array_elements(page->'data') loop
    for occurrence in select value from jsonb_array_elements(scene->'occurrences') loop
      if occurrence->>'role_id'=pg_temp.id('father')::text then
        perform pg_temp.check(pg_temp.q(format('select count(*)=1 and min(a.id::text)=pg_temp.id(''a1'')::text from eps.assignments a join eps.slots s on s.id=a.slot_id
          where s.role_id=%L and s.archived_at is null and a.archived_at is null and a.position=''main''',occurrence->>'role_id'))='true','occurrence resolves to the one Main');
      end if;
    end loop;
  end loop;
  perform pg_temp.check(pg_temp.q('select jsonb_agg(to_jsonb(a) order by id) from eps.assignments a where slot_id=pg_temp.id(''slot_fo'')')=other_before,'unrelated Father casting unchanged');
  -- Pagination is cursor based and ordered.
  page:=public.eps_list_scenes(ws,null,2);
  perform pg_temp.check(jsonb_array_length(page->'data')=2 and page->'page'->>'next_cursor'=page->'data'->1->>'id','first page of two');
  page:=public.eps_list_scenes(ws,page->'page'->>'next_cursor',2);
  perform pg_temp.check(jsonb_array_length(page->'data')=2 and page->'data'->0->>'scene_number'='3','second page continues after the cursor');
end $$;

-- Renumber, rename, reorder, stale versions and archive keep casting intact.
do $$
declare ws uuid:=pg_temp.id('ws'); before jsonb; s jsonb; version bigint; w jsonb; order_result jsonb; ids uuid[]; affected jsonb; begin
  before:=pg_temp.casting(ws);
  version:=pg_temp.q('select row_version from eps.scenes where id=pg_temp.id(''s3'')');
  s:=public.eps_update_scene(pg_temp.id('s3'),jsonb_build_object('row_version',version,'scene_number','3A','title','Garden in the rain','notes',null),pg_temp.key());
  perform pg_temp.check(s->>'scene_number'='3A' and s->>'title'='Garden in the rain' and (s->>'row_version')::bigint=version+1
    and jsonb_array_length(s->'occurrences')=1 and s->'requirements'='{"items":["Rain on set"]}','renumber and rename keep the occurrence');
  perform pg_temp.expect(format('select public.eps_update_scene(%L,%L,%L)',pg_temp.id('s3'),jsonb_build_object('row_version',version,'title','Stale'),pg_temp.key()),'STALE_RESOURCE_VERSION');
  perform pg_temp.expect(format('select public.eps_update_scene(%L,%L,%L)',pg_temp.id('s3'),jsonb_build_object('row_version',version+1),pg_temp.key()),'INVALID_REQUEST');
  w:=pg_temp.workspace(ws);
  ids:=array[pg_temp.id('s5'),pg_temp.id('s3'),pg_temp.id('s2'),pg_temp.id('s1')];
  perform pg_temp.expect(format('select public.eps_reorder_scenes(%L,%L,%L)',ws,jsonb_build_object('row_version',(w->>'row_version')::bigint-1,'scene_ids',to_jsonb(ids)),pg_temp.key()),'STALE_RESOURCE_VERSION');
  perform pg_temp.expect(format('select public.eps_reorder_scenes(%L,%L,%L)',ws,jsonb_build_object('row_version',(w->>'row_version')::bigint,'scene_ids',to_jsonb(ids[1:3])),pg_temp.key()),'SCENE_ORDER_INVALID');
  order_result:=public.eps_reorder_scenes(ws,jsonb_build_object('row_version',(w->>'row_version')::bigint,'scene_ids',to_jsonb(ids)),pg_temp.key());
  perform pg_temp.check(order_result->'scene_ids'=to_jsonb(ids) and (order_result->>'row_version')::bigint=(w->>'row_version')::bigint+1
    and (pg_temp.workspace(ws)->>'draft_revision')::int=(w->>'draft_revision')::int+1,'reorder applies the full order and bumps the draft');
  perform pg_temp.check((public.eps_list_role_occurrences(pg_temp.id('father'))->'data'->0->>'scene_number')='5','role occurrences follow the new scene order');
  -- Occurrence presentation fields are per scene and never touch casting.
  s:=public.eps_list_scenes(ws,null,25)->'data'->0;
  s:=public.eps_update_scene_occurrence((s->'occurrences'->0->>'id')::uuid,jsonb_build_object('row_version',(s->'occurrences'->0->>'row_version')::int,
    'deck_placement','repeat','display_title','Father (older)','presentation_note','Same actor, aged make-up'),pg_temp.key());
  perform pg_temp.check(s->'occurrences'->0->>'deck_placement'='repeat' and s->'occurrences'->0->>'display_title'='Father (older)','occurrence presentation fields saved');
  perform pg_temp.expect(format('select public.eps_update_scene_occurrence(%L,%L,%L)',(s->'occurrences'->0->>'id'),jsonb_build_object('row_version',1,'deck_placement','hidden'),pg_temp.key()),'STALE_RESOURCE_VERSION');
  -- Unlink then relink reactivates the same occurrence row (no duplicate).
  s:=public.eps_unlink_scene_occurrence((s->'occurrences'->0->>'id')::uuid,jsonb_build_object('row_version',(s->'occurrences'->0->>'row_version')::int),pg_temp.key());
  perform pg_temp.check(s->'occurrences'='[]','unlink removes the occurrence from the scene');
  s:=public.eps_link_scene_occurrence(pg_temp.id('s5'),jsonb_build_object('role_id',pg_temp.id('father')),pg_temp.key());
  perform pg_temp.check(pg_temp.q('select count(*) from eps.scene_occurrences where scene_id=pg_temp.id(''s5'') and role_id=pg_temp.id(''father'')')='1'
    and s->'occurrences'->0->>'deck_placement'='auto','relink reactivates the archived occurrence');
  -- Archive scene 5: only the scene and its links.
  version:=pg_temp.q('select row_version from eps.scenes where id=pg_temp.id(''s5'')');
  affected:=public.eps_archive_scene(pg_temp.id('s5'),jsonb_build_object('row_version',version),pg_temp.key());
  perform pg_temp.check(affected->'success'='true' and jsonb_array_length(affected->'affected_ids')=2,'archive reports the scene and its link');
  perform pg_temp.check(pg_temp.casting(ws)=before,'renumber/reorder/archive/unlink never change roles, slots, assignments, pool or candidates');
  perform pg_temp.check(jsonb_array_length(public.eps_list_role_occurrences(pg_temp.id('father'))->'data')=2,'archived scene no longer listed for the role');
  perform pg_temp.expect(format('select public.eps_update_scene(%L,%L,%L)',pg_temp.id('s5'),jsonb_build_object('row_version',version+1,'title','Gone'),pg_temp.key()),'RESOURCE_NOT_FOUND');
end $$;

-- Proposals: confirm, reject, stale proposal against a newer role edit ------------------------
reset role;
set local session_replication_role=replica;
insert into eps.scenes(id,workspace_id,scene_number,title,status,source_job_id,sort_order,source_refs) values
  ('a2000000-0000-4000-8000-000000000001',pg_temp.id('ws'),'7','Rooftop','proposed',gen_random_uuid(),10,'[{"asset_id":null,"page":null,"paragraph":0,"segment_index":null,"start_ms":null,"end_ms":null,"quote":"SCENE 7"}]'),
  ('a2000000-0000-4000-8000-000000000002',pg_temp.id('ws'),'8','Car park','proposed',gen_random_uuid(),11,'[]');
insert into eps.scene_occurrences(id,workspace_id,scene_id,role_id,status,sort_order,proposal_base) values
  ('a2000000-0000-4000-8000-000000000011',pg_temp.id('ws'),'a2000000-0000-4000-8000-000000000001',pg_temp.id('mother'),'proposed',0,
    jsonb_build_object('role_id',pg_temp.id('mother'),'role_row_version',1,'role_sha256',eps.scene_role_fingerprint(pg_temp.id('mother')))),
  ('a2000000-0000-4000-8000-000000000012',pg_temp.id('ws'),'a2000000-0000-4000-8000-000000000001',pg_temp.id('father'),'proposed',1,
    jsonb_build_object('role_id',pg_temp.id('father'),'role_row_version',1,'role_sha256',eps.scene_role_fingerprint(pg_temp.id('father')))),
  ('a2000000-0000-4000-8000-000000000013',pg_temp.id('ws'),'a2000000-0000-4000-8000-000000000002',pg_temp.id('father'),'proposed',0,null);
set local session_replication_role=origin;
set local role authenticated;
select pg_temp.as_user('producer');
do $$
declare ws uuid:=pg_temp.id('ws'); w jsonb; result jsonb; scene jsonb; version bigint; begin
  -- A person renames the Mother after the import proposed her for scene 7.
  version:=pg_temp.q('select row_version from eps.roles where id=pg_temp.id(''mother'')');
  perform public.eps_update_role(pg_temp.id('mother'),jsonb_build_object('row_version',version,'name','Mother (Lena)'),pg_temp.key());
  scene:=(select value from jsonb_array_elements(public.eps_list_scenes(ws,null,25)->'data') where value->>'id'='a2000000-0000-4000-8000-000000000001');
  perform pg_temp.check(scene->>'status'='proposed' and (scene->'occurrences'->0->>'proposal_stale')::boolean and not (scene->'occurrences'->1->>'proposal_stale')::boolean,
    'stale proposal is flagged for review');
  w:=pg_temp.workspace(ws);
  perform pg_temp.expect(format('select public.eps_confirm_scene_proposals(%L,%L,%L)',ws,jsonb_build_object('row_version',(w->>'row_version')::bigint-1),pg_temp.key()),'STALE_RESOURCE_VERSION');
  result:=public.eps_confirm_scene_proposals(ws,jsonb_build_object('row_version',(w->>'row_version')::bigint,
    'scene_ids',jsonb_build_array('a2000000-0000-4000-8000-000000000001'),
    'occurrence_ids',jsonb_build_array('a2000000-0000-4000-8000-000000000011','a2000000-0000-4000-8000-000000000012')),pg_temp.key());
  perform pg_temp.check(result->'confirmed_scene_ids'='["a2000000-0000-4000-8000-000000000001"]'
    and result->'confirmed_occurrence_ids'='["a2000000-0000-4000-8000-000000000012"]'
    and result->'skipped_occurrence_ids'='["a2000000-0000-4000-8000-000000000011"]','confirm skips the proposal made against an older role');
  perform pg_temp.check(pg_temp.q('select status from eps.scene_occurrences where id=''a2000000-0000-4000-8000-000000000011''')='"proposed"','stale proposal stays proposed');
  w:=pg_temp.workspace(ws);
  result:=public.eps_reject_scene_proposals(ws,jsonb_build_object('row_version',(w->>'row_version')::bigint,
    'scene_ids',jsonb_build_array('a2000000-0000-4000-8000-000000000002'),'occurrence_ids',jsonb_build_array('a2000000-0000-4000-8000-000000000011')),pg_temp.key());
  perform pg_temp.check(result->'rejected_scene_ids'='["a2000000-0000-4000-8000-000000000002"]'
    and result->'rejected_occurrence_ids'='["a2000000-0000-4000-8000-000000000011","a2000000-0000-4000-8000-000000000013"]','reject the scene, its links and the stale link');
  perform pg_temp.check(pg_temp.q('select status=''rejected'' and archived_at is not null from eps.scenes where id=''a2000000-0000-4000-8000-000000000002''')='true','rejected scene kept as reviewed history');
  w:=pg_temp.workspace(ws);
  result:=public.eps_confirm_scene_proposals(ws,jsonb_build_object('row_version',(w->>'row_version')::bigint),pg_temp.key());
  perform pg_temp.check(result->'confirmed_scene_ids'='[]' and result->'confirmed_occurrence_ids'='[]' and (result->>'row_version')::bigint=(w->>'row_version')::bigint,
    'nothing left to confirm; no draft change');
  perform pg_temp.expect(format('select public.eps_confirm_scene_proposals(%L,%L,%L)',pg_temp.id('other_ws'),jsonb_build_object('row_version',1,
    'scene_ids',jsonb_build_array('a2000000-0000-4000-8000-000000000001')),pg_temp.key()),'RESOURCE_NOT_FOUND');
end $$;

-- A read-only member can read but not write.
select pg_temp.as_user('reader');
do $$ begin
  perform pg_temp.check(jsonb_array_length(public.eps_list_scenes(pg_temp.id('ws'),null,25)->'data')=4,'reader lists scenes');
  perform pg_temp.expect(format('select public.eps_create_scene(%L,%L,%L)',pg_temp.id('ws'),'{"title":"Nope"}',pg_temp.key()),'CAPABILITY_REQUIRED');
  perform pg_temp.expect(format('select public.eps_list_scenes(%L,null,25)',pg_temp.id('other_ws')),'RESOURCE_NOT_FOUND');
end $$;
reset role;
set local role anon;
do $$ begin
  perform pg_temp.expect('select 1 from public.eps_list_scenes(gen_random_uuid(),null,25)','permission denied for function eps_list_scenes');
end $$;
reset role;

select json_build_object('result','passed','file','a2-scene-operations','checks',current_setting('eps.a2_checks')::integer);
rollback;
