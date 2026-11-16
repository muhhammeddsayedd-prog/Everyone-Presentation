-- A2 rejection of scene proposals (m17 eps.scene_review reject branch + eps.specs_stage_apply rejection keys).
-- Run after every migration as supabase_admin. Synthetic data only; one transaction, rolled back. Every failed check raises.
-- Rejected links keep a stable key so a later import (which creates new role rows) never proposes them again; a
-- proposed scene that holds a confirmed link is never rejected and the confirmed link is never archived.
begin;
set local search_path='';

create temp table a2_ids(k text primary key, v uuid not null) on commit drop;
grant all on a2_ids to public;
insert into a2_ids(k,v) select k,gen_random_uuid() from unnest(array['producer','project','ws','spec']) k;
create function pg_temp.id(p_key text) returns uuid language sql stable as $$ select v from a2_ids where k=p_key $$;
create function pg_temp.check(p_ok boolean, p_label text) returns void language plpgsql as $$ begin
  if p_ok is not true then raise exception 'A2_CHECK_FAILED %', p_label; end if;
  perform set_config('eps.a2_checks', (coalesce(nullif(current_setting('eps.a2_checks', true), ''), '0')::integer + 1)::text, true);
end $$;
create function pg_temp.expect(p_sql text, p_code text) returns void language plpgsql as $$
begin
  execute p_sql;
  raise exception 'A2_CHECK_FAILED expected % from: %', p_code, left(p_sql, 200);
exception when others then
  if sqlerrm like 'A2_CHECK_FAILED%' then raise; end if;
  if sqlerrm<>p_code then raise exception 'A2_CHECK_FAILED expected % but got % from: %', p_code, sqlerrm, left(p_sql, 200); end if;
end $$;
create function pg_temp.key() returns text language sql volatile as $$ select 'a2-'||gen_random_uuid()::text $$;
create function pg_temp.source() returns text language sql immutable as $$
  select 'SCENE 1 - INT. KITCHEN - NIGHT. The father cooks dinner.'||E'\n\n'||
    'SCENE 3A - EXT. GARDEN - DAY. The father waters the roses. Two waiters pass by. An old man waters the roses too.'||E'\n\n'||
    'The old man is the same character as the father, decades later.'
$$;
create function pg_temp.ref(p_paragraph integer, p_quote text) returns jsonb language sql immutable as $$
  select jsonb_build_object('asset_id',null,'page',null,'paragraph',p_paragraph,'segment_index',null,'start_ms',null,'end_ms',null,'quote',p_quote)
$$;
create function pg_temp.requirements(p_scenes text[]) returns jsonb language sql immutable as $$
  select jsonb_build_object('age_range',null,'gender_requirement',null,'appearance_performance',null,'languages','[]'::jsonb,'accents','[]'::jsonb,
    'skills','[]'::jsonb,'scene_references',to_jsonb(p_scenes),'shoot_dates','[]'::jsonb,'location',null,'availability_requirements',null,'other_instructions',null)
$$;
create function pg_temp.extraction() returns jsonb language sql immutable as $$
  select jsonb_build_object('schema_version','2.0','source_asset_id',null,'source_language_codes','["en"]'::jsonb,
    'roles',jsonb_build_array(
      jsonb_build_object('source_role_key','father','name','Father','headcount',1,'category',null,'requirements',pg_temp.requirements(array['1','3A']),
        'evidence',jsonb_build_array(pg_temp.ref(0,'The father cooks dinner.')),'clarifications','[]'::jsonb,
        'occurrences',jsonb_build_array(
          jsonb_build_object('scene_key','s1','display_title',null,'evidence',jsonb_build_array(pg_temp.ref(0,'The father cooks dinner.'))),
          jsonb_build_object('scene_key','s3a','display_title',null,'evidence',jsonb_build_array(pg_temp.ref(1,'The father waters the roses.')))),
        'same_character_as',null),
      jsonb_build_object('source_role_key','old-man','name','Old man','headcount',1,'category',null,'requirements',pg_temp.requirements(array['3A']),
        'evidence',jsonb_build_array(pg_temp.ref(1,'An old man waters the roses too.')),
        'clarifications',jsonb_build_array(jsonb_build_object('field_path','same_character_as','reason','The source may describe the same character as "Father". Roles stay separately cast unless you link this role to the same scenes explicitly.',
          'source',pg_temp.ref(2,'The old man is the same character as the father'))),
        'occurrences',jsonb_build_array(jsonb_build_object('scene_key','s3a','display_title','Old man','evidence',jsonb_build_array(pg_temp.ref(1,'An old man waters the roses too.')))),
        'same_character_as',jsonb_build_object('source_role_key','father','evidence',jsonb_build_array(pg_temp.ref(2,'The old man is the same character as the father')))),
      jsonb_build_object('source_role_key','waiters','name','Waiter','headcount',2,'category','Background','requirements',pg_temp.requirements(array['3A']),
        'evidence',jsonb_build_array(pg_temp.ref(1,'Two waiters pass by.')),'clarifications','[]'::jsonb,
        'occurrences',jsonb_build_array(jsonb_build_object('scene_key','s3a','display_title',null,'evidence',jsonb_build_array(pg_temp.ref(1,'Two waiters pass by.')))),
        'same_character_as',null)),
    'scenes',jsonb_build_array(
      jsonb_build_object('scene_key','s1','scene_number','1','title','Kitchen','sequence_label',null,'setting','INT. KITCHEN - NIGHT','notes',null,
        'requirements','[]'::jsonb,'evidence',jsonb_build_array(pg_temp.ref(0,'SCENE 1 - INT. KITCHEN - NIGHT.'))),
      jsonb_build_object('scene_key','s3a','scene_number','3A','title','Garden','sequence_label',null,'setting','EXT. GARDEN - DAY','notes',null,
        'requirements','["Roses in bloom"]'::jsonb,'evidence',jsonb_build_array(pg_temp.ref(1,'SCENE 3A - EXT. GARDEN - DAY.')))),
    'general_instructions',null,'clarifications','[]'::jsonb)
$$;

-- One reviewed v2 job against the current workspace version (what eps_submit_specs + the worker produce).
create function pg_temp.job() returns eps.jobs language plpgsql as $$
declare job eps.jobs; input jsonb; paragraphs jsonb:=eps.specs_stage_paragraphs(pg_temp.source()); source_hash text:=encode(sha256(convert_to(pg_temp.source(),'UTF8')),'hex');
  spec eps.specs; correlation text:='a2-reject-'||replace(gen_random_uuid()::text,'-',''); begin
  select * into spec from eps.specs where id=pg_temp.id('spec');
  input:=jsonb_build_object('schema_version','1.0','specs_id',spec.id,'source_row_version',spec.source_row_version,'source_hash',source_hash,
    'workspace_row_version',(select row_version from eps.workspaces where id=pg_temp.id('ws')),
    'configuration',jsonb_build_object('document_preparation_version','document-preparation.v1','model_version','synthetic-model','prompt_version','spec_extract_v2.0.0','result_schema_version','2.0'));
  insert into eps.jobs(workspace_id,requested_by,kind,resource_id,input,input_hash,input_hash_version,dedupe_key,correlation_id,stage)
    values(pg_temp.id('ws'),pg_temp.id('producer'),'specs_extract',spec.id,input,eps.jobs_hash_v1(input),'eps.specs-input.pg-jsonb.v1',
      encode(sha256(convert_to(correlation,'UTF8')),'hex'),correlation,'apply_specs') returning * into job;
  update eps.specs set processing_job_id=job.id where id=spec.id;
  insert into eps.specs_source_inputs(job_id,workspace_id,spec_id,source_row_version,source_hash,input_hash,source_text)
    values(job.id,job.workspace_id,spec.id,spec.source_row_version,source_hash,job.input_hash,pg_temp.source());
  insert into eps.specs_stage_payloads(job_id,stage,attempt_id,input_hash,result_schema,result,prepared_text,paragraphs)
    values(job.id,'prepare_document',gen_random_uuid(),job.input_hash,'document-preparation.v1','{}'::jsonb,pg_temp.source(),paragraphs),
      (job.id,'extract_specs',gen_random_uuid(),job.input_hash,'specs-extraction-stage.v1',jsonb_build_object('result',pg_temp.extraction(),'metadata',jsonb_build_object(
        'provider','openai','sdk_version','7.45.1','requested_model','synthetic-model','resolved_model','synthetic-model','response_id','resp_synthetic','request_id',null,
        'correlation_id',correlation,'input_sha256',job.input_hash,'prepared_source_sha256',eps.specs_document_prepared_hash(null,paragraphs),
        'prompt_version','spec_extract_v2.0.0','prompt_sha256','65575b1c5b9e509f73b64dd44ae94c9151502e081b0a4b0cfdfb73693374d745',
        'schema_version','2.0','schema_sha256','a50665e17b53d11c2eb741483cae4e0081d4461e3711b3d06a5b4358dca51fc1',
        'provider_schema_sha256','cd80820db66ad4e22d3cce7dc9dbfb07f2da6aee4e74697d2f81fe9c5b5123fc','usage',null)),null,null);
  return job;
end $$;
create function pg_temp.scenes(p_status text default null) returns bigint language sql as $$
  select count(*) from eps.scenes where workspace_id=pg_temp.id('ws') and archived_at is null and (p_status is null or status=p_status) $$;
create function pg_temp.as_producer() returns void language plpgsql as $$ begin
  perform set_config('request.jwt.claims', json_build_object('sub', pg_temp.id('producer'), 'role', 'authenticated', 'is_anonymous', false)::text, true);
  perform set_config('request.jwt.claim.sub', pg_temp.id('producer')::text, true);
end $$;

-- The disposable replica's auth.users stub lacks the hosted columns eps.job_requester_active reads; add them inside this rolled-back transaction.
alter table auth.users add column if not exists is_anonymous boolean not null default false, add column if not exists deleted_at timestamptz, add column if not exists banned_until timestamptz;
insert into auth.users(id,instance_id,aud,role,email) values(pg_temp.id('producer'),'00000000-0000-0000-0000-000000000000','authenticated','authenticated','reject-producer@example.invalid');
set local session_replication_role=replica;
insert into public.app_capability_grants(principal_id,capability,active) select pg_temp.id('producer'),c,true from unnest(array['projects.read','workspaces.read','workspaces.write']) c;
insert into public.projects(id,name) values(pg_temp.id('project'),'Synthetic reject project');
insert into public.project_memberships(project_id,principal_id,can_write,active) values(pg_temp.id('project'),pg_temp.id('producer'),true,true);
insert into eps.workspaces(id,project_id) values(pg_temp.id('ws'),pg_temp.id('project'));
insert into eps.specs(id,workspace_id,source_text) values(pg_temp.id('spec'),pg_temp.id('ws'),pg_temp.source());
set local session_replication_role=origin;

-- 1. First import; a person rejects one proposed link (Old man in the Garden).
do $$ declare job eps.jobs:=pg_temp.job(); begin perform eps.specs_stage_apply(job); end $$;
select pg_temp.as_producer();
-- Identifiers are looked up as the test owner; the operations run as the producer.
do $$ begin
  perform set_config('a2r.old_man',(select o.id::text from eps.scene_occurrences o join eps.roles r on r.id=o.role_id
    where o.workspace_id=pg_temp.id('ws') and o.archived_at is null and r.name='Old man'),true);
  perform set_config('a2r.ws_version',(select row_version::text from eps.workspaces where id=pg_temp.id('ws')),true);
end $$;
set local role authenticated;
do $$
declare result jsonb; old_man uuid:=current_setting('a2r.old_man')::uuid; begin
  result:=public.eps_reject_scene_proposals(pg_temp.id('ws'),jsonb_build_object('row_version',current_setting('a2r.ws_version')::bigint,'occurrence_ids',jsonb_build_array(old_man)),pg_temp.key());
  perform pg_temp.check(result->'rejected_occurrence_ids'=jsonb_build_array(old_man) and result->'rejected_scene_ids'='[]' and result->'skipped_scene_ids'='[]','one proposed link rejected');
end $$;
reset role;
do $$ begin
  perform pg_temp.check((select rejection_key='3a|garden|old man' and status='rejected' and archived_at is not null from eps.scene_occurrences o
    where o.workspace_id=pg_temp.id('ws') and o.status='rejected'),'the rejected link keeps a stable scene+role key');
end $$;

-- 2. A new import replaces the untouched machine roles; the rejected link is not proposed again, the others are.
do $$
declare job eps.jobs:=pg_temp.job(); begin
  perform eps.specs_stage_apply(job);
  perform pg_temp.check(not exists(select 1 from eps.scene_occurrences o join eps.roles r on r.id=o.role_id
    where o.workspace_id=pg_temp.id('ws') and o.archived_at is null and r.name='Old man'),'a rejected link is never re-proposed by a later import');
  perform pg_temp.check((select count(*) from eps.scene_occurrences o join eps.roles r on r.id=o.role_id join eps.scenes s on s.id=o.scene_id
    where o.workspace_id=pg_temp.id('ws') and o.archived_at is null and o.status='proposed' and r.archived_at is null and s.title='Garden' and r.name in('Father','Waiter'))=2
    and (select count(*) from eps.scene_occurrences o join eps.roles r on r.id=o.role_id where o.workspace_id=pg_temp.id('ws') and o.archived_at is null and r.name='Father')=2,
    'the other links are proposed again for the new roles');
end $$;

-- 3. A proposed scene holding a confirmed link is not rejected and its confirmed link survives; its proposed links
--    are rejected only when listed. Bulk reject treats it the same way.
do $$
declare ws uuid:=pg_temp.id('ws'); garden uuid; kitchen uuid; begin
  select id into garden from eps.scenes where workspace_id=ws and archived_at is null and title='Garden';
  select id into kitchen from eps.scenes where workspace_id=ws and archived_at is null and title='Kitchen';
  perform set_config('a2r.garden',garden::text,true); perform set_config('a2r.kitchen',kitchen::text,true);
  perform set_config('a2r.waiter',(select o.id::text from eps.scene_occurrences o join eps.roles r on r.id=o.role_id where o.scene_id=garden and o.archived_at is null and r.name='Waiter'),true);
  perform set_config('a2r.father_garden',(select o.id::text from eps.scene_occurrences o join eps.roles r on r.id=o.role_id where o.scene_id=garden and o.archived_at is null and r.name='Father'),true);
  perform set_config('a2r.father_role',(select o.role_id::text from eps.scene_occurrences o join eps.roles r on r.id=o.role_id where o.scene_id=garden and o.archived_at is null and r.name='Father'),true);
  perform set_config('a2r.father_kitchen',(select o.id::text from eps.scene_occurrences o where o.scene_id=kitchen and o.archived_at is null),true);
  perform set_config('a2r.ws_version',(select row_version::text from eps.workspaces where id=ws),true);
end $$;
set local role authenticated;
do $$
declare ws uuid:=pg_temp.id('ws'); garden uuid:=current_setting('a2r.garden')::uuid; kitchen uuid:=current_setting('a2r.kitchen')::uuid;
  waiter uuid:=current_setting('a2r.waiter')::uuid; father_garden uuid:=current_setting('a2r.father_garden')::uuid; father_kitchen uuid:=current_setting('a2r.father_kitchen')::uuid; result jsonb; begin
  result:=public.eps_confirm_scene_proposals(ws,jsonb_build_object('row_version',current_setting('a2r.ws_version')::bigint,'occurrence_ids',jsonb_build_array(waiter)),pg_temp.key());
  perform pg_temp.check(result->'confirmed_occurrence_ids'=jsonb_build_array(waiter) and result->'confirmed_scene_ids'='[]','a link confirmed on a still-proposed scene');
  result:=public.eps_reject_scene_proposals(ws,jsonb_build_object('row_version',(result->>'row_version')::bigint,'scene_ids',jsonb_build_array(garden,kitchen)),pg_temp.key());
  perform pg_temp.check(result->'rejected_scene_ids'=jsonb_build_array(kitchen) and result->'skipped_scene_ids'=jsonb_build_array(garden)
    and result->'rejected_occurrence_ids'=jsonb_build_array(father_kitchen),'the scene with a confirmed link is skipped; the other scene and its proposed link are rejected');
  perform set_config('a2r.ws_version',result->>'row_version',true);
end $$;
reset role;
do $$ begin
  perform pg_temp.check((select status='confirmed' and archived_at is null and rejection_key is null from eps.scene_occurrences where id=current_setting('a2r.waiter')::uuid)
    and (select status='proposed' and archived_at is null from eps.scenes where id=current_setting('a2r.garden')::uuid)
    and (select status='proposed' and archived_at is null from eps.scene_occurrences where id=current_setting('a2r.father_garden')::uuid),'confirmed link, its scene and unlisted proposals untouched');
end $$;
set local role authenticated;
do $$
declare ws uuid:=pg_temp.id('ws'); result jsonb; begin
  result:=public.eps_reject_scene_proposals(ws,jsonb_build_object('row_version',current_setting('a2r.ws_version')::bigint),pg_temp.key());
  perform pg_temp.check(result->'skipped_scene_ids'=jsonb_build_array(current_setting('a2r.garden')) and result->'rejected_scene_ids'='[]'
    and result->'rejected_occurrence_ids'=jsonb_build_array(current_setting('a2r.father_garden')),'bulk reject skips the scene with a confirmed link and rejects only proposals');
  -- Relinking a rejected link by hand confirms it again.
  result:=public.eps_link_scene_occurrence(current_setting('a2r.garden')::uuid,jsonb_build_object('role_id',current_setting('a2r.father_role')),pg_temp.key());
end $$;
reset role;
do $$ begin
  perform pg_temp.check((select status='confirmed' and archived_at is null from eps.scene_occurrences where id=current_setting('a2r.waiter')::uuid),'bulk reject keeps the confirmed link');
  perform pg_temp.check((select status='confirmed' and archived_at is null and rejection_key is null from eps.scene_occurrences where id=current_setting('a2r.father_garden')::uuid),
    'manual relink confirms the link and clears its rejection key');
end $$;

select json_build_object('result','passed','file','a2-scene-reject','checks',current_setting('eps.a2_checks')::integer);
rollback;
