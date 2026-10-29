-- Fixed Dummy Test casting checkpoint. SELECT-only, no facts/notes/media URLs,
-- Auth rows, verification keys, credentials or private audit payloads returned.
begin isolation level repeatable read read only;
set local statement_timeout='30s';set local search_path='';set local timezone='UTC';
do $scope$begin
 if current_user<>'postgres' or current_database()<>'postgres'
  or not exists(select 1 from pg_roles where rolname=current_user and(rolsuper or rolbypassrls))
  or not exists(select 1 from eps.workspaces w join public.projects p on p.id=w.project_id
   where w.id='098d5b48-42a3-475b-b562-735c9eafce80' and p.id='4b70c8ce-18bd-4a8c-b5a9-bc1156c06463' and w.archived_at is null and p.archived_at is null)
  or (select count(*)from eps.assignments where workspace_id='098d5b48-42a3-475b-b562-735c9eafce80')>512
  or (select count(*)from eps.assignment_change_events where workspace_id='098d5b48-42a3-475b-b562-735c9eafce80')>1024
 then raise exception 'M04_FIXED_APP_CAPTURE_SCOPE_UNCONFIRMED';end if;
end $scope$;
with workspace as(select * from eps.workspaces where id='098d5b48-42a3-475b-b562-735c9eafce80'),
roles as(select * from eps.roles where workspace_id='098d5b48-42a3-475b-b562-735c9eafce80'),
slots as(select * from eps.slots where workspace_id='098d5b48-42a3-475b-b562-735c9eafce80'),
assignments as(select * from eps.assignments where workspace_id='098d5b48-42a3-475b-b562-735c9eafce80'),
active_slots as(select s.*from slots s join roles r on r.id=s.role_id where s.archived_at is null and r.archived_at is null),
old_candidates as(select *from eps.candidates where id in('b7341092-50c4-49b4-ad5f-a0ceedddebf1','d5e665b3-dc23-4ead-858e-81abbce55743'))
select jsonb_build_object('observed_at',clock_timestamp(),'query_role',current_user,'database',current_database(),
 'versions',(select jsonb_agg(version order by version)from supabase_migrations.schema_migrations),
 'workspace',(select jsonb_build_object('id',id,'project_id',project_id,'row_version',row_version,'draft_revision',draft_revision,'has_unpublished_changes',has_unpublished_changes)from workspace),
 'roles',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'row_version',row_version,'headcount',headcount,'sort_order',sort_order,'archived',archived_at is not null)order by sort_order,id),'[]')from roles),
 'slots',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'role_id',role_id,'row_version',row_version,'sort_order',sort_order,'provisional',provisional,'archived',archived_at is not null)order by role_id,sort_order,id),'[]')from slots),
 'assignments',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'slot_id',slot_id,'workspace_candidate_id',workspace_candidate_id,'position',position,'shortlist_included',shortlist_included,'sort_order',sort_order,'row_version',row_version,'archived',archived_at is not null,
  'presentation_notes_sha256',case when presentation_notes is not null then encode(sha256(convert_to(presentation_notes,'UTF8')),'hex')end,
  'internal_notes_sha256',case when internal_notes is not null then encode(sha256(convert_to(internal_notes,'UTF8')),'hex')end,
  'slide_wording_sha256',encode(sha256(convert_to(slide_wording::text,'UTF8')),'hex'))order by slot_id,sort_order,id),'[]')from assignments),
 'events',(select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'operation',e.operation,'resource_id',a.resource_id,'client_type',a.client_type,'created_at',e.created_at,
  'before_assignment_ids',(select coalesce(jsonb_agg(v->'id'order by v->>'id'),'[]')from jsonb_array_elements(e.payload->'before')v),
  'after_assignments',(select coalesce(jsonb_agg(jsonb_build_object('id',v->'id','position',v->'position','row_version',v->'row_version','archived',v->'archived')order by v->>'id'),'[]')from jsonb_array_elements(e.payload->'after')v))order by e.created_at,e.id),'[]')
  from eps.assignment_change_events e join eps.audit_events a on a.id=e.audit_event_id where e.workspace_id='098d5b48-42a3-475b-b562-735c9eafce80'),
 'counts',jsonb_build_object('assignments_total',(select count(*)from assignments),'selection',(select count(*)from assignments where archived_at is null),
  'shortlist',(select count(*)from assignments where archived_at is null and shortlist_included),'mains',(select count(*)from assignments where archived_at is null and position='main'),
  'archived_assignments',(select count(*)from assignments where archived_at is not null),
  'selection_pending_slots',(select count(*)from active_slots s where not exists(select 1 from assignments a where a.slot_id=s.id and a.archived_at is null)),
  'shortlist_pending_slots',(select count(*)from active_slots s where not exists(select 1 from assignments a where a.slot_id=s.id and a.archived_at is null and a.shortlist_included))),
 'invariants',jsonb_build_object('one_main_per_slot',not exists(select slot_id from assignments where archived_at is null and position='main'group by slot_id having count(*)>1),
  'one_active_candidate_per_slot',not exists(select slot_id,workspace_candidate_id from assignments where archived_at is null group by slot_id,workspace_candidate_id having count(*)>1),
  'active_relationships_valid',not exists(select 1 from assignments a left join active_slots s on s.id=a.slot_id left join eps.workspace_candidates p on p.id=a.workspace_candidate_id
   where a.archived_at is null and(s.id is null or p.id is null or p.workspace_id<>'098d5b48-42a3-475b-b562-735c9eafce80' or p.archived_at is not null))),
 'old_candidates',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'row_version',row_version,'archived',archived_at is not null,
  'facts_sha256',encode(sha256(convert_to(facts::text,'UTF8')),'hex'),'field_sources_sha256',encode(sha256(convert_to(field_sources::text,'UTF8')),'hex'))order by id),'[]')from old_candidates),
 'old_participations',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'workspace_id',p.workspace_id,'candidate_id',p.candidate_id,'row_version',p.row_version,'archived',p.archived_at is not null,
  'selected_candidate_media_id',p.selected_candidate_media_id,'selected_frame_count',cardinality(p.selected_frame_asset_ids),
  'selected_frames_sha256',encode(sha256(convert_to(to_jsonb(p.selected_frame_asset_ids)::text,'UTF8')),'hex'),
  'availability_sha256',case when p.availability is not null then encode(sha256(convert_to(p.availability,'UTF8')),'hex')end,
  'internal_notes_sha256',case when p.internal_notes is not null then encode(sha256(convert_to(p.internal_notes,'UTF8')),'hex')end)order by p.workspace_id,p.id),'[]')from eps.workspace_candidates p join old_candidates c on c.id=p.candidate_id),
 'old_media',(select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'candidate_id',m.candidate_id,'row_version',m.row_version,
  'selected_frame_count',cardinality(m.selected_frame_asset_ids),'selected_frames_sha256',encode(sha256(convert_to(to_jsonb(m.selected_frame_asset_ids)::text,'UTF8')),'hex'))order by m.id),'[]')from eps.candidate_media m join old_candidates c on c.id=m.candidate_id),
 'protected_m02',jsonb_build_object('job_id','b3f90268-147d-41d4-8875-2a6435df1496',
  'job_exists',exists(select 1 from eps.jobs where id='b3f90268-147d-41d4-8875-2a6435df1496'),
  'job_sha256',(select encode(sha256(convert_to(to_jsonb(j)::text,'UTF8')),'hex')from eps.jobs j where id='b3f90268-147d-41d4-8875-2a6435df1496'),
  'specs_id',(select resource_id from eps.jobs where id='b3f90268-147d-41d4-8875-2a6435df1496'),
  'specs_sha256',(select encode(sha256(convert_to(to_jsonb(s)::text,'UTF8')),'hex')from eps.specs s join eps.jobs j on j.resource_id=s.id where j.id='b3f90268-147d-41d4-8875-2a6435df1496'),
  'manual_note_retained',coalesce((select position('Manual verification: preserve this instruction while extraction is pending.'in coalesce(s.normalized_instructions,''))>0 from eps.specs s join eps.jobs j on j.resource_id=s.id where j.id='b3f90268-147d-41d4-8875-2a6435df1496'),false),
  'source_inputs_count',(select count(*)from eps.specs_source_inputs where job_id='b3f90268-147d-41d4-8875-2a6435df1496'),
  'source_inputs_sha256',(select encode(sha256(convert_to(coalesce(string_agg(to_jsonb(i)::text,E'\n'order by to_jsonb(i)::text),''),'UTF8')),'hex')from eps.specs_source_inputs i where job_id='b3f90268-147d-41d4-8875-2a6435df1496'))
)as m04_app_capture;
rollback;
