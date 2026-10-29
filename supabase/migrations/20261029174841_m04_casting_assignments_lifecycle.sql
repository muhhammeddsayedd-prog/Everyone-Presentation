-- M04 additive assignment/lifecycle20, after exact reviewed19.
-- Shared facts and project media remain independent from casting decisions.
-- No fixture identities, configuration, private keys, provider or hosting changes.
set local lock_timeout='3s';set local statement_timeout='30s';set local search_path='';
do $release_baseline$begin
 if current_user<>'postgres' or current_database()<>'postgres' or
 (select array_agg(version order by version)from supabase_migrations.schema_migrations)is distinct from array['20261028010943','20261028013324','20261028013655','20261028024205','20261028072515','20261028162702','20261028162800','20261028172320','20261028184145','20261028222030','20261029001520','20261029003941','20261029070038','20261029090500','20261029090724','20261029094600','20261029100500','20261029133455','20261029135318']::text[]
 then raise exception 'M04_RELEASE_EXACT_REVIEWED_NINETEEN_REQUIRED';end if;
end $release_baseline$;

-- Exact reviewed fragment: development/m04/assignments.sql
-- M04 author-only assignment kernel; compose atomically with lifecycle-forward.sql.
-- No numbered migration, runtime configuration, Storage or provider changes.
-- Sources: PostgreSQL17 explicit-locking/ddl-rowsecurity; Supabase database/functions.
set local lock_timeout='3s'; set local statement_timeout='30s'; set local search_path='';
do $$ begin
 if current_user<>'postgres' or current_database()<>'postgres'
 or (select array_agg(version order by version) from supabase_migrations.schema_migrations) is distinct from
 array['20261028010943','20261028013324','20261028013655','20261028024205','20261028072515','20261028162702','20261028162800','20261028172320','20261028184145','20261028222030','20261029001520','20261029003941','20261029070038','20261029090500','20261029090724','20261029094600','20261029100500','20261029133455','20261029135318']::text[]
 or to_regclass('eps.assignments') is not null or exists(select 1 from pg_roles where rolname in('eps_casting_owner','eps_casting_guard_owner'))
 then raise exception 'M04_EXACT_REVIEWED_NINETEEN_BASELINE_REQUIRED'; end if;
end $$;

create role eps_casting_owner nologin noinherit nosuperuser nocreatedb nocreaterole nobypassrls;
create role eps_casting_guard_owner nologin noinherit nosuperuser nocreatedb nocreaterole nobypassrls;
grant eps_casting_owner,eps_casting_guard_owner to postgres;
grant authenticated to eps_casting_owner with inherit true,set false,admin false;
grant usage on schema eps,public to eps_casting_owner;
grant usage on schema eps to eps_casting_guard_owner;
create table eps.assignments(
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references eps.workspaces(id) on delete restrict,
 slot_id uuid not null,workspace_candidate_id uuid not null,
 position text not null default 'option' check(position in('option','main','backup')),
 shortlist_included boolean not null default false,presentation_notes text,internal_notes text,
 slide_wording jsonb not null default '{}' check(jsonb_typeof(slide_wording)='object' and octet_length(eps.cast_canonical(slide_wording))<=786432),
 sort_order bigint not null default 0 check(sort_order between 0 and 9007199254740991),
 row_version bigint not null default 1 check(row_version between 1 and 9007199254740991),archived_at timestamptz,
 created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp(),
 foreign key(workspace_id,slot_id) references eps.slots(workspace_id,id) on delete restrict,
 foreign key(workspace_id,workspace_candidate_id) references eps.workspace_candidates(workspace_id,id) on delete restrict,
 unique(workspace_id,id)
);
create unique index assignments_active_candidate_slot on eps.assignments(slot_id,workspace_candidate_id) where archived_at is null;
create unique index assignments_one_main on eps.assignments(slot_id) where archived_at is null and position='main';
create index assignments_workspace_order on eps.assignments(workspace_id,slot_id,sort_order,id) where archived_at is null;
create index assignments_pool on eps.assignments(workspace_candidate_id) where archived_at is null;
create table eps.assignment_change_events(
 id uuid primary key default gen_random_uuid(),audit_event_id uuid not null unique references eps.audit_events(id) on delete restrict,
 workspace_id uuid not null references eps.workspaces(id) on delete restrict,operation text not null,
 payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=4194304),
 created_at timestamptz not null default clock_timestamp()
);
create table eps.assignment_change_consumptions(
 event_id uuid primary key references eps.assignment_change_events(id) on delete restrict,
 consumed_by_event_id uuid not null unique references eps.assignment_change_events(id) on delete restrict,
 created_at timestamptz not null default clock_timestamp()
);
alter table eps.assignments enable row level security;alter table eps.assignments force row level security;
alter table eps.assignment_change_events enable row level security;alter table eps.assignment_change_events force row level security;
alter table eps.assignment_change_consumptions enable row level security;alter table eps.assignment_change_consumptions force row level security;
revoke all on eps.assignments,eps.assignment_change_events,eps.assignment_change_consumptions from public,anon,authenticated,service_role;
grant select,insert,update on eps.assignments to eps_casting_owner;
grant select,insert on eps.assignment_change_events,eps.assignment_change_consumptions to eps_casting_owner;
grant select(workspace_id,archived_at) on eps.assignments to eps_casting_guard_owner;
grant select(id,project_id,archived_at,row_version,draft_revision),update(row_version,draft_revision,has_unpublished_changes,updated_at) on eps.workspaces to eps_casting_owner;
grant select on eps.roles,eps.slots,eps.workspace_candidates to eps_casting_owner;
grant update(sort_order,row_version,updated_at) on eps.roles,eps.slots to eps_casting_owner;
-- Lock-only pool privilege: WITH CHECK(false) prevents all actual row updates.
grant update(id) on eps.workspace_candidates to eps_casting_owner;
grant select(id,archived_at,merged_into_candidate_id) on eps.candidates to eps_casting_owner;
grant select,insert on eps.idempotency_records to eps_casting_owner;
grant insert(id,principal_id,action,resource_id,request_id,client_type),select(id) on eps.audit_events to eps_casting_owner;
grant execute on function eps.fail(text,text,integer,bigint),eps.has_capability(text),eps.require_capability(text),eps.project_scope(uuid,boolean),eps.idempotency_begin(text,text,jsonb),eps.specs_order_workspace_dto(uuid),eps.cast_canonical(jsonb) to eps_casting_owner;
create function eps.casting_scope(p_workspace uuid,p_write boolean default false) returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from eps.workspaces w join public.projects p on p.id=w.project_id where w.id=p_workspace and w.archived_at is null and p.archived_at is null and eps.project_scope(p.id,p_write) and eps.has_capability(case when p_write then 'workspaces.write' else 'workspaces.read' end))
$$;
create policy casting_workspace_read on eps.workspaces for select to eps_casting_owner using(archived_at is null and eps.project_scope(project_id,false) and(eps.has_capability('workspaces.read')or eps.has_capability('workspaces.write')));
create policy casting_workspace_update on eps.workspaces for update to eps_casting_owner using(eps.casting_scope(id,true)) with check(eps.casting_scope(id,true));
create policy casting_roles_read on eps.roles for select to eps_casting_owner using(eps.casting_scope(workspace_id,false)or eps.casting_scope(workspace_id,true));
create policy casting_roles_update on eps.roles for update to eps_casting_owner using(eps.casting_scope(workspace_id,true)) with check(eps.casting_scope(workspace_id,true));
create policy casting_slots_read on eps.slots for select to eps_casting_owner using(eps.casting_scope(workspace_id,false)or eps.casting_scope(workspace_id,true));
create policy casting_slots_update on eps.slots for update to eps_casting_owner using(eps.casting_scope(workspace_id,true)) with check(eps.casting_scope(workspace_id,true));
create policy casting_pool_read on eps.workspace_candidates for select to eps_casting_owner using(eps.casting_scope(workspace_id,false)or eps.casting_scope(workspace_id,true));
create policy casting_pool_lock on eps.workspace_candidates for update to eps_casting_owner using(eps.casting_scope(workspace_id,true)) with check(false);
create policy casting_candidate_identity on eps.candidates for select to eps_casting_owner using(exists(select 1 from eps.workspace_candidates p where p.candidate_id=candidates.id and(eps.casting_scope(p.workspace_id,false)or eps.casting_scope(p.workspace_id,true))));
create policy casting_assignments_read on eps.assignments for select to eps_casting_owner using(eps.casting_scope(workspace_id,false)or eps.casting_scope(workspace_id,true));
create policy casting_assignments_insert on eps.assignments for insert to eps_casting_owner with check(eps.casting_scope(workspace_id,true));
create policy casting_assignments_update on eps.assignments for update to eps_casting_owner using(eps.casting_scope(workspace_id,true)) with check(eps.casting_scope(workspace_id,true));
create policy casting_assignment_guard on eps.assignments for select to eps_casting_guard_owner using(true);
create policy casting_event_read on eps.assignment_change_events for select to eps_casting_owner using(eps.casting_scope(workspace_id,true));
create policy casting_event_insert on eps.assignment_change_events for insert to eps_casting_owner with check(eps.casting_scope(workspace_id,true));
create policy casting_consumption_read on eps.assignment_change_consumptions for select to eps_casting_owner using(exists(select 1 from eps.assignment_change_events e where e.id=event_id));
create policy casting_consumption_insert on eps.assignment_change_consumptions for insert to eps_casting_owner with check(exists(select 1 from eps.assignment_change_events e where e.id=event_id)and exists(select 1 from eps.assignment_change_events e where e.id=consumed_by_event_id));
create policy casting_idempotency on eps.idempotency_records for all to eps_casting_owner using(principal_id=auth.uid()and operation in('casting.create_assignment','casting.update_assignment','casting.remove_assignment','casting.set_main','casting.undo_main','casting.reorder'))with check(principal_id=auth.uid()and operation in('casting.create_assignment','casting.update_assignment','casting.remove_assignment','casting.set_main','casting.undo_main','casting.reorder'));
create policy casting_audit on eps.audit_events for insert to eps_casting_owner with check(principal_id=auth.uid()and action in('casting.create_assignment','casting.update_assignment','casting.remove_assignment','casting.set_main','casting.undo_main','casting.reorder','casting.retire_slots','casting.archive_role','casting.remove_workspace_candidate','casting.link_duplicate'));
create policy casting_audit_id on eps.audit_events for select to eps_casting_owner using(principal_id=auth.uid());
create policy eps_casting_no_objects on storage.objects as restrictive for all to eps_casting_owner using(false)with check(false);
create policy eps_casting_no_buckets on storage.buckets as restrictive for all to eps_casting_owner using(false)with check(false);

create function eps.casting_body(p_input jsonb,p_keys text[]) returns void language plpgsql immutable security invoker set search_path='' as $$ begin
 if p_input is null or jsonb_typeof(p_input)<>'object' or octet_length(eps.cast_canonical(p_input))>65536 or exists(select 1 from jsonb_object_keys(p_input) k where not(k=any(p_keys)))then perform eps.fail('VALIDATION_FAILED','Invalid assignment request fields or byte budget.',400);end if;
end $$;
create function eps.casting_uuid(p_value jsonb) returns uuid language plpgsql immutable security invoker set search_path='' as $$ begin
 if jsonb_typeof(p_value)is distinct from'string'or(p_value#>>'{}')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'then perform eps.fail('VALIDATION_FAILED','A UUID is required.',400);end if;return(p_value#>>'{}')::uuid;
end $$;
create function eps.casting_version(p_value jsonb) returns bigint language plpgsql immutable security invoker set search_path='' as $$ begin
 if jsonb_typeof(p_value)is distinct from'number'or(p_value#>>'{}')!~'^[1-9][0-9]{0,15}$'or(p_value#>>'{}')::numeric>9007199254740991 then perform eps.fail('VALIDATION_FAILED','A safe positive row version is required.',400);end if;return(p_value#>>'{}')::bigint;
end $$;
create function eps.casting_text(p_value jsonb) returns text language plpgsql immutable security invoker set search_path='' as $$declare v text;begin
 if p_value is null or jsonb_typeof(p_value)not in('string','null')then perform eps.fail('VALIDATION_FAILED','Expected text or null.',400);end if;v:=p_value#>>'{}';
 if v~('['||chr(1)||'-'||chr(8)||chr(11)||chr(12)||chr(14)||'-'||chr(31)||chr(127)||']')then perform eps.fail('VALIDATION_FAILED','Text contains unsupported control characters.',400);end if;
 -- Explicit shared ASCII outer trim; preserve NBSP, other Unicode and interior text.
 return nullif(btrim(v,E' \t\r\n'),'');
end $$;
create function eps.casting_wording(p_value jsonb) returns jsonb language plpgsql immutable security invoker set search_path='' as $$ declare item record;result jsonb:='{}';begin
 perform eps.casting_body(p_value,array['name_or_id','age_or_range','height_measurements','languages_accents','skills_experience','city','previous_projects_roles','classification','availability','presentation_notes']);
 for item in select key,value from jsonb_each(p_value)loop result:=result||jsonb_build_object(item.key,eps.casting_text(item.value));end loop;return result;
end $$;
create function eps.casting_advance(p_version bigint)returns void language plpgsql immutable security invoker set search_path=''as $$begin if p_version>=9007199254740991 then perform eps.fail('ASSIGNMENT_STATE_INVALID','Resource revision budget exhausted.',409);end if;end$$;
create function eps.casting_lock_workspaces(p_ids uuid[])returns void language plpgsql volatile security definer set search_path=''as $$declare target uuid;begin
 perform eps.require_capability('workspaces.write');
 if p_ids is null or cardinality(p_ids)not between 1 and 1000 or array_position(p_ids,null)is not null then perform eps.fail('VALIDATION_FAILED','Invalid workspace lock scope.',400);end if;
 for target in select distinct id from unnest(p_ids)id order by id loop
  if not eps.casting_scope(target,true)then perform eps.fail('RESOURCE_NOT_FOUND','Writable workspace not found.',404);end if;
  perform 1 from eps.workspaces where id=target for update;
  perform eps.require_capability('workspaces.write');if not eps.casting_scope(target,true)then perform eps.fail('RESOURCE_NOT_FOUND','Writable workspace not found.',404);end if;
 end loop;
end$$;
create function eps.casting_changed(p_workspace uuid)returns void language plpgsql volatile security invoker set search_path=''as $$declare v record;begin
 select row_version,draft_revision into v from eps.workspaces where id=p_workspace;perform eps.casting_advance(v.row_version);perform eps.casting_advance(v.draft_revision);
 update eps.workspaces set row_version=row_version+1,draft_revision=draft_revision+1,has_unpublished_changes=true,updated_at=clock_timestamp()where id=p_workspace and eps.casting_scope(id,true);
 if not found then perform eps.fail('RESOURCE_NOT_FOUND','Writable workspace not found.',404);end if;
end$$;
create function eps.casting_assignment_dto(p_id uuid)returns jsonb language sql stable security invoker set search_path=''as $$
 select jsonb_build_object('id',a.id,'workspace_id',a.workspace_id,'slot_id',a.slot_id,'workspace_candidate_id',a.workspace_candidate_id,'position',a.position,'shortlist_included',a.shortlist_included,'presentation_notes',a.presentation_notes,'internal_notes',a.internal_notes,'slide_wording',a.slide_wording,'sort_order',a.sort_order,'row_version',a.row_version,'archived',a.archived_at is not null)from eps.assignments a where a.id=p_id
$$;
create function eps.casting_slot_dto(p_id uuid)returns jsonb language sql stable security invoker set search_path=''as $$select jsonb_build_object('id',s.id,'role_id',s.role_id,'label',s.label,'sort_order',s.sort_order,'row_version',s.row_version,'archived',s.archived_at is not null)from eps.slots s where s.id=p_id$$;
create function eps.casting_remember(p_operation text,p_key text,p_input jsonb,p_result jsonb)returns jsonb language plpgsql volatile security invoker set search_path=''as $$begin
 insert into eps.idempotency_records(principal_id,operation,key,request_hash,response)values(auth.uid(),'casting.'||p_operation,p_key,encode(sha256(convert_to(p_input::text,'UTF8')),'hex'),p_result);return p_result;
end$$;
create function eps.casting_replay(p_operation text,p_key text,p_input jsonb)returns jsonb language plpgsql volatile security invoker set search_path=''as $$begin
 if p_key is null or length(p_key)not between 1 and 200 or p_key~'[[:cntrl:]]'then perform eps.fail('VALIDATION_FAILED','A bounded Idempotency-Key is required.',400);end if;
 return eps.idempotency_begin('casting.'||p_operation,p_key,p_input);
end$$;
create function eps.casting_record_change(p_workspace uuid,p_operation text,p_resource uuid,p_payload jsonb)returns uuid language plpgsql volatile security definer set search_path=''as $$
declare audit_id uuid:=gen_random_uuid();event_id uuid:=gen_random_uuid();headers jsonb:='{}';request_id text;client_type text;begin
 if not eps.casting_scope(p_workspace,true)then perform eps.fail('RESOURCE_NOT_FOUND','Writable workspace not found.',404);end if;
 if p_operation not in('create_assignment','update_assignment','remove_assignment','set_main','undo_main','reorder','retire_slots','archive_role','remove_workspace_candidate','link_duplicate')
 or jsonb_typeof(p_payload)is distinct from'object'or octet_length(p_payload::text)>4194304
 or (select array_agg(key order by key)from jsonb_object_keys(p_payload)key)is distinct from array['after','before','details','schema_version']::text[]
 or p_payload->>'schema_version'<>'1.0'or jsonb_typeof(p_payload->'before')is distinct from'array'or jsonb_typeof(p_payload->'after')is distinct from'array'or jsonb_typeof(p_payload->'details')is distinct from'object'
 then perform eps.fail('ASSIGNMENT_STATE_INVALID','Invalid private change payload.',409);end if;
 if jsonb_array_length(p_payload->'before')>100 or jsonb_array_length(p_payload->'after')>100 then perform eps.fail('ASSIGNMENT_STATE_INVALID','Change batch exceeds its row budget.',409);end if;
 begin headers:=coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb;exception when invalid_text_representation then headers:='{}';end;
 if jsonb_typeof(headers)is distinct from'object'then headers:='{}';end if;
 request_id:=headers->>'x-eps-request-id';if request_id is not null and request_id!~'^[A-Za-z0-9._:-]{1,128}$'then request_id:=null;end if;
 client_type:=headers->>'x-eps-client-type';if client_type is null or client_type not in('browser','api','mcp')then client_type:='api';end if;
 insert into eps.audit_events(id,principal_id,action,resource_id,request_id,client_type)values(audit_id,auth.uid(),'casting.'||p_operation,p_resource,request_id,client_type);
 insert into eps.assignment_change_events(id,audit_event_id,workspace_id,operation,payload)values(event_id,audit_id,p_workspace,p_operation,p_payload);return event_id;
end$$;
create function eps.casting_has_active_assignments(p_workspace uuid)returns boolean language sql stable security definer set search_path=''as $$select exists(select 1 from eps.assignments where workspace_id=p_workspace and archived_at is null)$$;
grant create on schema eps to eps_casting_guard_owner;
alter function eps.casting_has_active_assignments(uuid)owner to eps_casting_guard_owner;
revoke create on schema eps from eps_casting_guard_owner;
revoke all on function eps.casting_has_active_assignments(uuid)from public,anon,authenticated,service_role;
grant execute on function eps.casting_has_active_assignments(uuid)to eps_specs_apply_owner,eps_casting_owner;
create function eps.casting_record_batches(p_workspace uuid,p_operation text,p_resource uuid,p_before jsonb,p_after jsonb,p_details jsonb)returns void language plpgsql volatile security invoker set search_path=''as $$
declare n integer;b jsonb:='[]';a jsonb:='[]';next_payload jsonb;begin
 if jsonb_typeof(p_before)is distinct from'array'or jsonb_typeof(p_after)is distinct from'array'or jsonb_array_length(p_before)<>jsonb_array_length(p_after)then perform eps.fail('ASSIGNMENT_STATE_INVALID','Invalid paired change batch.',409);end if;
 for n in 0..jsonb_array_length(p_before)-1 loop
  next_payload:=jsonb_build_object('schema_version','1.0','before',b||jsonb_build_array(p_before->n),'after',a||jsonb_build_array(p_after->n),'details',p_details);
  if jsonb_array_length(b)>=100 or octet_length(next_payload::text)>3800000 then
   if jsonb_array_length(b)>0 then perform eps.casting_record_change(p_workspace,p_operation,p_resource,jsonb_build_object('schema_version','1.0','before',b,'after',a,'details',p_details));end if;b:='[]';a:='[]';
  end if;
  b:=b||jsonb_build_array(p_before->n);a:=a||jsonb_build_array(p_after->n);
 end loop;
 if jsonb_array_length(b)>0 then perform eps.casting_record_change(p_workspace,p_operation,p_resource,jsonb_build_object('schema_version','1.0','before',b,'after',a,'details',p_details));end if;
end$$;

-- Locks child references after the workspace aggregate lock, then rechecks the
-- active relationship. Candidate identity is read only: no candidate/workspace lock inversion.
create function eps.casting_lock_slot(p_slot uuid,p_workspace uuid)returns void language plpgsql volatile security invoker set search_path=''as $$declare role_id uuid;begin
 select s.role_id into role_id from eps.slots s where s.id=p_slot and s.workspace_id=p_workspace;
 if role_id is null then perform eps.fail('RESOURCE_NOT_FOUND','Slot not found.',404);end if;
 perform 1 from eps.roles where id=role_id and workspace_id=p_workspace for update;
 perform 1 from eps.slots where id=p_slot and workspace_id=p_workspace for update;
 perform eps.require_capability('workspaces.write');
 if not eps.casting_scope(p_workspace,true)or not exists(select 1 from eps.slots s join eps.roles r on r.id=s.role_id where s.id=p_slot and s.workspace_id=p_workspace and s.archived_at is null and r.archived_at is null)then perform eps.fail('RESOURCE_NOT_FOUND','Active slot not found.',404);end if;
end$$;
-- Global library archival retains ongoing project work. Only explicit project
-- removal retires this participation and its assignments.
create function eps.casting_pool_active(p_pool uuid,p_workspace uuid)returns boolean language sql stable security invoker set search_path=''as $$select exists(select 1 from eps.workspace_candidates p where p.id=p_pool and p.workspace_id=p_workspace and p.archived_at is null)$$;

create function public.eps_create_assignment(p_workspace_id uuid,p_input jsonb,p_idempotency_key text default null)returns jsonb language plpgsql volatile security definer set search_path=''as $$
#variable_conflict use_variable
declare slot_id uuid;pool_id uuid;expected bigint;cached jsonb;payload jsonb;item eps.assignments;sv bigint;rank bigint;result jsonb;begin
 perform eps.require_capability('workspaces.write');perform eps.casting_body(p_input,array['slot_id','workspace_candidate_id','expected_slot_row_version','shortlist_included','presentation_notes']);
 slot_id:=eps.casting_uuid(p_input->'slot_id');pool_id:=eps.casting_uuid(p_input->'workspace_candidate_id');expected:=eps.casting_version(p_input->'expected_slot_row_version');
 if p_input?'shortlist_included'and jsonb_typeof(p_input->'shortlist_included')<>'boolean'then perform eps.fail('VALIDATION_FAILED','Shortlist must be boolean.',400);end if;
 if p_input?'presentation_notes'then perform eps.casting_text(p_input->'presentation_notes');end if;
 payload:=jsonb_build_object('id',p_workspace_id,'input',p_input);cached:=eps.casting_replay('create_assignment',p_idempotency_key,payload);
 perform eps.casting_lock_workspaces(array[p_workspace_id]);perform eps.casting_lock_slot(slot_id,p_workspace_id);
 perform 1 from eps.workspace_candidates where id=pool_id and workspace_id=p_workspace_id for update;
 if not eps.casting_pool_active(pool_id,p_workspace_id)then perform eps.fail('RESOURCE_NOT_FOUND','Active project candidate not found.',404);end if;
 if cached is not null then return cached;end if;
 select row_version into sv from eps.slots where id=slot_id;if expected<>sv then perform eps.fail('STALE_RESOURCE_VERSION','Slot changed.',409,sv);end if;
 select * into item from eps.assignments a where a.slot_id=slot_id and a.workspace_candidate_id=pool_id and a.archived_at is null;
 if found then return eps.casting_remember('create_assignment',p_idempotency_key,payload,eps.casting_assignment_dto(item.id));end if;
 perform eps.casting_advance(sv);select coalesce(max(a.sort_order)+1,0)into rank from eps.assignments a where a.slot_id=slot_id and a.archived_at is null;
 if rank>9007199254740991 then perform eps.fail('ASSIGNMENT_STATE_INVALID','Assignment order budget exhausted.',409);end if;
 insert into eps.assignments(workspace_id,slot_id,workspace_candidate_id,shortlist_included,presentation_notes,sort_order)values(p_workspace_id,slot_id,pool_id,coalesce((p_input->>'shortlist_included')::boolean,false),case when p_input?'presentation_notes'then eps.casting_text(p_input->'presentation_notes')end,rank)returning * into item;
 update eps.slots set row_version=row_version+1,updated_at=clock_timestamp()where id=slot_id;perform eps.casting_changed(p_workspace_id);result:=eps.casting_assignment_dto(item.id);
 perform eps.casting_record_change(p_workspace_id,'create_assignment',item.id,jsonb_build_object('schema_version','1.0','before','[]'::jsonb,'after',jsonb_build_array(result),'details',jsonb_build_object('slot_id',slot_id)));
 return eps.casting_remember('create_assignment',p_idempotency_key,payload,result);
end$$;

create function public.eps_update_assignment(p_assignment_id uuid,p_input jsonb,p_idempotency_key text default null)returns jsonb language plpgsql volatile security definer set search_path=''as $$
declare item eps.assignments;expected bigint;cached jsonb;payload jsonb;before_value jsonb;result jsonb;wording jsonb;new_position text;sv bigint;begin
 perform eps.require_capability('workspaces.write');perform eps.casting_body(p_input,array['row_version','position','shortlist_included','presentation_notes','internal_notes','slide_wording']);expected:=eps.casting_version(p_input->'row_version');
 if p_input?'position'and(jsonb_typeof(p_input->'position')<>'string'or p_input->>'position'not in('option','backup'))then perform eps.fail('VALIDATION_FAILED','Position must be Option or Backup.',400);end if;
 if p_input?'shortlist_included'and jsonb_typeof(p_input->'shortlist_included')<>'boolean'then perform eps.fail('VALIDATION_FAILED','Shortlist must be boolean.',400);end if;
 if p_input?'presentation_notes'then perform eps.casting_text(p_input->'presentation_notes');end if;if p_input?'internal_notes'then perform eps.casting_text(p_input->'internal_notes');end if;
 if p_input?'slide_wording'then perform eps.casting_wording(p_input->'slide_wording');end if;
 select * into item from eps.assignments where id=p_assignment_id;if not found then perform eps.fail('RESOURCE_NOT_FOUND','Assignment not found.',404);end if;
 payload:=jsonb_build_object('id',p_assignment_id,'input',p_input);cached:=eps.casting_replay('update_assignment',p_idempotency_key,payload);
 perform eps.casting_lock_workspaces(array[item.workspace_id]);perform eps.casting_lock_slot(item.slot_id,item.workspace_id);
 perform 1 from eps.workspace_candidates where id=item.workspace_candidate_id for update;select * into item from eps.assignments where id=p_assignment_id for update;
 if item.archived_at is not null or not eps.casting_pool_active(item.workspace_candidate_id,item.workspace_id)then perform eps.fail('RESOURCE_NOT_FOUND','Active assignment not found.',404);end if;
 if cached is not null then
  if cached->>'workspace_candidate_id'is distinct from item.workspace_candidate_id::text then perform eps.fail('STALE_RESOURCE_VERSION','Assignment participation changed after the original response.',409,item.row_version);end if;return cached;
 end if;if item.row_version<>expected then perform eps.fail('STALE_RESOURCE_VERSION','Assignment changed.',409,item.row_version);end if;
 if p_input?'position'and item.position='main'then perform eps.fail('MAIN_OPERATION_REQUIRED','Change Main through the slot Main operation.',409);end if;
 before_value:=eps.casting_assignment_dto(item.id);wording:=case when p_input?'slide_wording'then jsonb_strip_nulls(item.slide_wording||eps.casting_wording(p_input->'slide_wording'))else item.slide_wording end;new_position:=coalesce(p_input->>'position',item.position);
 if octet_length(eps.cast_canonical(wording))>786432 then perform eps.fail('VALIDATION_FAILED','Combined wording exceeds its bounded stored-state budget.',400);end if;
 result:=before_value||jsonb_build_object('position',new_position,'shortlist_included',case when p_input?'shortlist_included'then(p_input->>'shortlist_included')::boolean else item.shortlist_included end,'presentation_notes',case when p_input?'presentation_notes'then eps.casting_text(p_input->'presentation_notes')else item.presentation_notes end,'internal_notes',case when p_input?'internal_notes'then eps.casting_text(p_input->'internal_notes')else item.internal_notes end,'slide_wording',wording);
 if result=before_value then return eps.casting_remember('update_assignment',p_idempotency_key,payload,before_value);end if;perform eps.casting_advance(item.row_version);
 if new_position<>item.position then select row_version into sv from eps.slots where id=item.slot_id;perform eps.casting_advance(sv);update eps.slots set row_version=row_version+1,updated_at=clock_timestamp()where id=item.slot_id;end if;
 update eps.assignments set position=new_position,shortlist_included=(result->>'shortlist_included')::boolean,presentation_notes=result->>'presentation_notes',internal_notes=result->>'internal_notes',slide_wording=wording,row_version=row_version+1,updated_at=clock_timestamp()where id=item.id;
 perform eps.casting_changed(item.workspace_id);result:=eps.casting_assignment_dto(item.id);
 perform eps.casting_record_change(item.workspace_id,'update_assignment',item.id,jsonb_build_object('schema_version','1.0','before',jsonb_build_array(before_value),'after',jsonb_build_array(result),'details','{}'::jsonb));return eps.casting_remember('update_assignment',p_idempotency_key,payload,result);
end$$;

create function public.eps_set_slot_main(p_slot_id uuid,p_input jsonb,p_idempotency_key text default null)returns jsonb language plpgsql volatile security definer set search_path=''as $$
#variable_conflict use_variable
declare workspace_id uuid;target uuid;expected bigint;sv bigint;old_main uuid;affected uuid[];before_rows jsonb;after_rows jsonb;cached jsonb;payload jsonb;event_id uuid;undo jsonb;result jsonb;begin
 perform eps.require_capability('workspaces.write');perform eps.casting_body(p_input,array['assignment_id','expected_slot_row_version','replacement_behavior']);expected:=eps.casting_version(p_input->'expected_slot_row_version');
 if not(p_input?'assignment_id')or p_input->>'replacement_behavior'is distinct from'move_previous_to_backup'then perform eps.fail('VALIDATION_FAILED','Explicit Main and replacement behavior are required.',400);end if;
 if p_input->'assignment_id'<>'null'::jsonb then target:=eps.casting_uuid(p_input->'assignment_id');end if;
 select s.workspace_id into workspace_id from eps.slots s where s.id=p_slot_id;if workspace_id is null then perform eps.fail('RESOURCE_NOT_FOUND','Slot not found.',404);end if;
 payload:=jsonb_build_object('id',p_slot_id,'input',p_input);cached:=eps.casting_replay('set_main',p_idempotency_key,payload);
 perform eps.casting_lock_workspaces(array[workspace_id]);perform eps.casting_lock_slot(p_slot_id,workspace_id);
 perform 1 from eps.workspace_candidates p where p.id in(select a.workspace_candidate_id from eps.assignments a where a.slot_id=p_slot_id and a.archived_at is null)order by p.id for update;
 perform 1 from eps.assignments a where a.slot_id=p_slot_id and a.archived_at is null order by a.id for update;
 if target is not null and not exists(select 1 from eps.assignments a where a.id=target and a.slot_id=p_slot_id and a.archived_at is null and eps.casting_pool_active(a.workspace_candidate_id,workspace_id))then perform eps.fail('RESOURCE_NOT_FOUND','Active slot assignment not found.',404);end if;
 if cached is not null then
  if exists(select 1 from jsonb_array_elements(cached->'affected_assignments')v left join eps.assignments a on a.id=(v->>'id')::uuid where a.id is null or a.workspace_candidate_id::text is distinct from v->>'workspace_candidate_id')then perform eps.fail('STALE_RESOURCE_VERSION','Assignment participation changed after the original response.',409);end if;return cached;
 end if;select row_version into sv from eps.slots where id=p_slot_id;if sv<>expected then perform eps.fail('STALE_RESOURCE_VERSION','Slot changed.',409,sv);end if;
 select id into old_main from eps.assignments where slot_id=p_slot_id and archived_at is null and position='main';
 if old_main is not distinct from target then result:=jsonb_build_object('slot',eps.casting_slot_dto(p_slot_id),'affected_assignments','[]'::jsonb,'undo',null);return eps.casting_remember('set_main',p_idempotency_key,payload,result);end if;
 select array_agg(id order by id)into affected from unnest(array[old_main,target])id where id is not null;
 select jsonb_agg(eps.casting_assignment_dto(id)order by id)into before_rows from unnest(affected)id;
 perform eps.casting_advance(sv);perform eps.casting_advance(row_version)from eps.assignments where id=any(affected);
 -- Demote before promote; the partial unique index is immediate and authoritative.
 update eps.assignments set position='backup',row_version=row_version+1,updated_at=clock_timestamp()where id=old_main;
 update eps.assignments set position='main',row_version=row_version+1,updated_at=clock_timestamp()where id=target;
 update eps.slots set row_version=row_version+1,updated_at=clock_timestamp()where id=p_slot_id;perform eps.casting_changed(workspace_id);
 select jsonb_agg(eps.casting_assignment_dto(id)order by id)into after_rows from unnest(affected)id;
 event_id:=eps.casting_record_change(workspace_id,'set_main',p_slot_id,jsonb_build_object('schema_version','1.0','before',before_rows,'after',after_rows,'details',jsonb_build_object('slot_id',p_slot_id,'slot_before_row_version',sv,'slot_after_row_version',sv+1)));
 undo:=jsonb_build_object('undo_event_id',event_id,'slot_id',p_slot_id,'expected_slot_row_version',sv+1,'restore_assignment_positions',(select jsonb_agg(jsonb_build_object('assignment_id',v->'id','position',v->'position')order by v->>'id')from jsonb_array_elements(before_rows)v));
 result:=jsonb_build_object('slot',eps.casting_slot_dto(p_slot_id),'affected_assignments',after_rows,'undo',undo);return eps.casting_remember('set_main',p_idempotency_key,payload,result);
end$$;

create function public.eps_undo_slot_main(p_slot_id uuid,p_input jsonb,p_idempotency_key text default null)returns jsonb language plpgsql volatile security definer set search_path=''as $$
#variable_conflict use_variable
declare workspace_id uuid;event_id uuid;expected bigint;sv bigint;event eps.assignment_change_events;requested jsonb;inverse jsonb;before_rows jsonb;after_rows jsonb;cached jsonb;payload jsonb;new_event uuid;item record;ids uuid[];result jsonb;begin
 perform eps.require_capability('workspaces.write');perform eps.casting_body(p_input,array['undo_event_id','slot_id','expected_slot_row_version','restore_assignment_positions']);event_id:=eps.casting_uuid(p_input->'undo_event_id');expected:=eps.casting_version(p_input->'expected_slot_row_version');
 if eps.casting_uuid(p_input->'slot_id')<>p_slot_id or jsonb_typeof(p_input->'restore_assignment_positions')is distinct from'array'then perform eps.fail('MAIN_UNDO_INVALID','Undo does not match this slot.',409);end if;
 if jsonb_array_length(p_input->'restore_assignment_positions')not between 1 and 2 then perform eps.fail('MAIN_UNDO_INVALID','Invalid Main inverse.',409);end if;
 for item in select value from jsonb_array_elements(p_input->'restore_assignment_positions')loop perform eps.casting_body(item.value,array['assignment_id','position']);perform eps.casting_uuid(item.value->'assignment_id');if item.value->>'position'not in('option','main','backup')or jsonb_typeof(item.value->'position')is distinct from'string'then perform eps.fail('MAIN_UNDO_INVALID','Invalid Main inverse.',409);end if;end loop;
 select s.workspace_id into workspace_id from eps.slots s where s.id=p_slot_id;if workspace_id is null then perform eps.fail('RESOURCE_NOT_FOUND','Slot not found.',404);end if;
 payload:=jsonb_build_object('id',p_slot_id,'input',p_input);cached:=eps.casting_replay('undo_main',p_idempotency_key,payload);perform eps.casting_lock_workspaces(array[workspace_id]);perform eps.casting_lock_slot(p_slot_id,workspace_id);
 select * into event from eps.assignment_change_events e where e.id=event_id and e.workspace_id=workspace_id and e.operation='set_main'and e.payload->'details'->>'slot_id'=p_slot_id::text;
 if not found then perform eps.fail('MAIN_UNDO_INVALID','The Main change record was not found.',409);end if;
 select jsonb_agg(jsonb_build_object('assignment_id',v->'id','position',v->'position')order by v->>'id'),array_agg((v->>'id')::uuid order by v->>'id')into inverse,ids from jsonb_array_elements(event.payload->'before')v;
 select jsonb_agg(v order by v->>'assignment_id')into requested from jsonb_array_elements(p_input->'restore_assignment_positions')v;
 if requested is distinct from inverse or expected<>(event.payload->'details'->>'slot_after_row_version')::bigint then perform eps.fail('MAIN_UNDO_INVALID','Undo must equal the recorded inverse.',409);end if;
 perform 1 from eps.workspace_candidates p where p.id in(select a.workspace_candidate_id from eps.assignments a where a.id=any(ids))order by p.id for update;
 perform 1 from eps.assignments where id=any(ids)order by id for update;
 if exists(select 1 from unnest(ids)x(id) left join eps.assignments a on a.id=x.id where a.id is null or a.archived_at is not null or a.slot_id<>p_slot_id or not eps.casting_pool_active(a.workspace_candidate_id,workspace_id))then perform eps.fail('MAIN_UNDO_INVALID','Undo references inactive assignments.',409);end if;
 if cached is not null then
  if exists(select 1 from jsonb_array_elements(cached->'affected_assignments')v left join eps.assignments a on a.id=(v->>'id')::uuid where a.id is null or a.workspace_candidate_id::text is distinct from v->>'workspace_candidate_id')then perform eps.fail('STALE_RESOURCE_VERSION','Assignment participation changed after the original response.',409);end if;return cached;
 end if;
 if exists(select 1 from eps.assignment_change_consumptions c where c.event_id=event_id)then perform eps.fail('MAIN_UNDO_ALREADY_USED','This Main change has already been undone.',409);end if;
 select row_version into sv from eps.slots where id=p_slot_id;if sv<>expected then perform eps.fail('STALE_RESOURCE_VERSION','Slot changed.',409,sv);end if;
 if exists(select 1 from jsonb_array_elements(event.payload->'after')v left join eps.assignments a on a.id=(v->>'id')::uuid where a.id is null or a.row_version<>(v->>'row_version')::bigint or a.position<>v->>'position')then perform eps.fail('MAIN_UNDO_INVALID','An affected assignment changed after Main was set.',409);end if;
 select jsonb_agg(eps.casting_assignment_dto(id)order by id)into before_rows from unnest(ids)id;perform eps.casting_advance(sv);perform eps.casting_advance(row_version)from eps.assignments where id=any(ids);
 -- Restore non-Main first so even the inverse cannot violate immediate uniqueness.
 update eps.assignments a set position=v->>'position',row_version=a.row_version+1,updated_at=clock_timestamp()from jsonb_array_elements(event.payload->'before')v where a.id=(v->>'id')::uuid and v->>'position'<>'main';
 update eps.assignments a set position='main',row_version=a.row_version+1,updated_at=clock_timestamp()from jsonb_array_elements(event.payload->'before')v where a.id=(v->>'id')::uuid and v->>'position'='main';
 update eps.slots set row_version=row_version+1,updated_at=clock_timestamp()where id=p_slot_id;perform eps.casting_changed(workspace_id);
 select jsonb_agg(eps.casting_assignment_dto(id)order by id)into after_rows from unnest(ids)id;
 new_event:=eps.casting_record_change(workspace_id,'undo_main',p_slot_id,jsonb_build_object('schema_version','1.0','before',before_rows,'after',after_rows,'details',jsonb_build_object('slot_id',p_slot_id,'slot_before_row_version',sv,'slot_after_row_version',sv+1,'undo_of_event_id',event_id)));
 insert into eps.assignment_change_consumptions(event_id,consumed_by_event_id)values(event_id,new_event);result:=jsonb_build_object('slot',eps.casting_slot_dto(p_slot_id),'affected_assignments',after_rows,'undo',null);return eps.casting_remember('undo_main',p_idempotency_key,payload,result);
end$$;

create function public.eps_remove_assignment(p_assignment_id uuid,p_input jsonb,p_idempotency_key text default null)returns jsonb language plpgsql volatile security definer set search_path=''as $$
declare item eps.assignments;expected bigint;cached jsonb;payload jsonb;before_value jsonb;sv bigint;result jsonb;begin
 perform eps.require_capability('workspaces.write');perform eps.casting_body(p_input,array['row_version','reason']);expected:=eps.casting_version(p_input->'row_version');if p_input?'reason'then perform eps.casting_text(p_input->'reason');end if;
 select * into item from eps.assignments where id=p_assignment_id;if not found then perform eps.fail('RESOURCE_NOT_FOUND','Assignment not found.',404);end if;
 payload:=jsonb_build_object('id',p_assignment_id,'input',p_input);cached:=eps.casting_replay('remove_assignment',p_idempotency_key,payload);perform eps.casting_lock_workspaces(array[item.workspace_id]);
 -- Removal can replay its own archived row; the original scoped parents must still exist.
 perform 1 from eps.roles where id=(select role_id from eps.slots where id=item.slot_id)for update;perform 1 from eps.slots where id=item.slot_id for update;
 select * into item from eps.assignments where id=p_assignment_id for update;
 if cached is not null then return cached;end if;if item.archived_at is not null then perform eps.fail('RESOURCE_NOT_FOUND','Active assignment not found.',404);end if;
 if item.row_version<>expected then perform eps.fail('STALE_RESOURCE_VERSION','Assignment changed.',409,item.row_version);end if;
 before_value:=eps.casting_assignment_dto(item.id);perform eps.casting_advance(item.row_version);select row_version into sv from eps.slots where id=item.slot_id;perform eps.casting_advance(sv);
 update eps.assignments set archived_at=clock_timestamp(),row_version=row_version+1,updated_at=clock_timestamp()where id=item.id;update eps.slots set row_version=row_version+1,updated_at=clock_timestamp()where id=item.slot_id;perform eps.casting_changed(item.workspace_id);
 perform eps.casting_record_change(item.workspace_id,'remove_assignment',item.id,jsonb_build_object('schema_version','1.0','before',jsonb_build_array(before_value),'after',jsonb_build_array(eps.casting_assignment_dto(item.id)),'details',jsonb_build_object('reason',p_input->'reason')));result:=jsonb_build_object('success',true,'affected_ids',jsonb_build_array(item.id));return eps.casting_remember('remove_assignment',p_idempotency_key,payload,result);
end$$;

create function public.eps_list_assignments(p_workspace_id uuid,p_output_type text default null,p_cursor text default null,p_limit integer default 25)returns jsonb language plpgsql stable security definer set search_path=''as $$
declare output_type text:=coalesce(p_output_type,'selection');draft bigint;cursor_value jsonb;cursor_tuple record;items jsonb;next_cursor text;last_value jsonb;begin
 perform eps.require_capability('workspaces.read');
 if output_type not in('selection','shortlist')or p_limit is null or p_limit not between 1 and 100 then perform eps.fail('VALIDATION_FAILED','Invalid output or page size.',400);end if;
 if not eps.casting_scope(p_workspace_id,false)then perform eps.fail('RESOURCE_NOT_FOUND','Workspace not found.',404);end if;
 select draft_revision into draft from eps.workspaces where id=p_workspace_id;
 if p_cursor is not null then
  if length(p_cursor)>4000 then perform eps.fail('VALIDATION_FAILED','Invalid assignment cursor.',400);end if;
  begin cursor_value:=convert_from(decode(p_cursor,'base64'),'UTF8')::jsonb;exception when others then perform eps.fail('VALIDATION_FAILED','Invalid assignment cursor.',400);end;
  perform eps.casting_body(cursor_value,array['workspace_id','output_type','draft_revision','role_order','role_id','slot_order','slot_id','assignment_order','assignment_id']);
  if (select count(*)from jsonb_object_keys(cursor_value))<>9 or eps.casting_uuid(cursor_value->'workspace_id')<>p_workspace_id or cursor_value->>'output_type'is distinct from output_type then perform eps.fail('VALIDATION_FAILED','Cursor belongs to a different list.',400);end if;
  if eps.casting_version(cursor_value->'draft_revision')<>draft then perform eps.fail('STALE_RESOURCE_VERSION','Casting order changed; restart the list.',409,draft);end if;
  if exists(select 1 from unnest(array['role_order','slot_order','assignment_order'])k where jsonb_typeof(cursor_value->k)is distinct from'number'or(cursor_value->>k)!~'^(0|[1-9][0-9]{0,15})$'or(cursor_value->>k)::numeric>9007199254740991)then perform eps.fail('VALIDATION_FAILED','Invalid assignment order cursor.',400);end if;
  perform eps.casting_uuid(cursor_value->'role_id');perform eps.casting_uuid(cursor_value->'slot_id');perform eps.casting_uuid(cursor_value->'assignment_id');
 end if;
 with chosen as(
  select a.id,r.sort_order role_order,r.id role_id,s.sort_order slot_order,s.id slot_id,a.sort_order assignment_order,eps.casting_assignment_dto(a.id)dto
  from eps.assignments a join eps.slots s on s.id=a.slot_id join eps.roles r on r.id=s.role_id
  where a.workspace_id=p_workspace_id and a.archived_at is null and s.archived_at is null and r.archived_at is null and(output_type='selection'or a.shortlist_included)
   and(cursor_value is null or(r.sort_order,r.id,s.sort_order,s.id,a.sort_order,a.id)>((cursor_value->>'role_order')::bigint,(cursor_value->>'role_id')::uuid,(cursor_value->>'slot_order')::bigint,(cursor_value->>'slot_id')::uuid,(cursor_value->>'assignment_order')::bigint,(cursor_value->>'assignment_id')::uuid))
  order by r.sort_order,r.id,s.sort_order,s.id,a.sort_order,a.id limit p_limit+1
 ),numbered as(select *,row_number()over(order by role_order,role_id,slot_order,slot_id,assignment_order,id)rn from chosen)
 select coalesce(jsonb_agg(dto order by rn)filter(where rn<=p_limit),'[]'::jsonb),max(jsonb_build_object('workspace_id',p_workspace_id,'output_type',output_type,'draft_revision',draft,'role_order',role_order,'role_id',role_id,'slot_order',slot_order,'slot_id',slot_id,'assignment_order',assignment_order,'assignment_id',id)::text)filter(where rn=p_limit)::jsonb
 into items,last_value from numbered;
 if jsonb_array_length(items)=p_limit and exists(select 1 from eps.assignments a join eps.slots s on s.id=a.slot_id join eps.roles r on r.id=s.role_id where a.workspace_id=p_workspace_id and a.archived_at is null and s.archived_at is null and r.archived_at is null and(output_type='selection'or a.shortlist_included)and(r.sort_order,r.id,s.sort_order,s.id,a.sort_order,a.id)>((last_value->>'role_order')::bigint,(last_value->>'role_id')::uuid,(last_value->>'slot_order')::bigint,(last_value->>'slot_id')::uuid,(last_value->>'assignment_order')::bigint,(last_value->>'assignment_id')::uuid))then next_cursor:=replace(encode(convert_to(last_value::text,'UTF8'),'base64'),E'\n','');end if;
 return jsonb_build_object('data',items,'page',jsonb_build_object('next_cursor',next_cursor));
end$$;

create function eps.casting_order_ids(p_value jsonb,p_actual uuid[])returns uuid[]language plpgsql immutable security invoker set search_path=''as $$declare ids uuid[];begin
 if jsonb_typeof(p_value)is distinct from'array'or jsonb_array_length(p_value)>10000 then perform eps.fail('VALIDATION_FAILED','Order must be a bounded identifier array.',400);end if;
 select coalesce(array_agg(eps.casting_uuid(value)order by n),array[]::uuid[])into ids from jsonb_array_elements(p_value)with ordinality e(value,n);
 if cardinality(ids)<>(select count(distinct id)from unnest(ids)id)or array(select id from unnest(ids)id order by id)is distinct from p_actual then perform eps.fail('ASSIGNMENT_STATE_INVALID','Order must contain every active child exactly once.',409);end if;return ids;
end$$;
-- Replace the old role-only routine by exact guarded owner/source, preserving
-- its public signature; omitted role/slot/assignment scopes remain untouched.
do $$begin if(select encode(sha256(convert_to(replace(prosrc,E'\r\n',E'\n'),'UTF8')),'hex')from pg_proc where oid='public.eps_reorder_workspace(uuid,jsonb,text)'::regprocedure)is distinct from
 'b466f85532374b0068014c0ec7692c92fe5483e9b84c9e8dacbcc244dada6d16'
 or(select pg_get_userbyid(proowner)from pg_proc where oid='public.eps_reorder_workspace(uuid,jsonb,text)'::regprocedure)<>'eps_specs_owner'
 then raise exception'M04_REORDER_EXACT_POST19_SOURCE_REQUIRED';end if;end$$;
create or replace function public.eps_reorder_workspace(p_workspace_id uuid,p_input jsonb,p_idempotency_key text default null)returns jsonb language plpgsql volatile security definer set search_path=''as $$
declare expected bigint;wv bigint;cached jsonb;payload jsonb;result jsonb;entry record;ids uuid[];actual uuid[];changed boolean:=false;before_rows jsonb:='[]';after_rows jsonb:='[]';map_name text;begin
 perform eps.require_capability('workspaces.write');perform eps.casting_body(p_input,array['row_version','role_ids','slot_ids_by_role','assignment_ids_by_slot']);expected:=eps.casting_version(p_input->'row_version');
 foreach map_name in array array['slot_ids_by_role','assignment_ids_by_slot']loop
  if p_input?map_name then
   if jsonb_typeof(p_input->map_name)is distinct from'object'then perform eps.fail('VALIDATION_FAILED','Order maps must be objects.',400);end if;
   if(select count(*)<>count(distinct eps.casting_uuid(to_jsonb(key)))from jsonb_each(p_input->map_name))then perform eps.fail('VALIDATION_FAILED','Order maps cannot repeat the same normalized scope identifier.',400);end if;
  end if;
 end loop;
 payload:=jsonb_build_object('id',p_workspace_id,'input',p_input);cached:=eps.casting_replay('reorder',p_idempotency_key,payload);perform eps.casting_lock_workspaces(array[p_workspace_id]);
 perform 1 from eps.roles where workspace_id=p_workspace_id order by id for update;perform 1 from eps.slots where workspace_id=p_workspace_id order by id for update;perform 1 from eps.assignments where workspace_id=p_workspace_id order by id for update;
 perform eps.require_capability('workspaces.write');if not eps.casting_scope(p_workspace_id,true)then perform eps.fail('RESOURCE_NOT_FOUND','Writable workspace not found.',404);end if;
 -- Child map identity is checked even on an acknowledged replay.
 for entry in select key,value from jsonb_each(coalesce(p_input->'slot_ids_by_role','{}'::jsonb))loop if not exists(select 1 from eps.roles where id=eps.casting_uuid(to_jsonb(entry.key))and workspace_id=p_workspace_id and archived_at is null)then perform eps.fail('RESOURCE_NOT_FOUND','Ordered role not found.',404);end if;end loop;
 for entry in select key,value from jsonb_each(coalesce(p_input->'assignment_ids_by_slot','{}'::jsonb))loop if not exists(select 1 from eps.slots where id=eps.casting_uuid(to_jsonb(entry.key))and workspace_id=p_workspace_id and archived_at is null)then perform eps.fail('RESOURCE_NOT_FOUND','Ordered slot not found.',404);end if;end loop;
 if cached is not null then return cached;end if;select row_version into wv from eps.workspaces where id=p_workspace_id;if expected<>wv then perform eps.fail('STALE_RESOURCE_VERSION','Workspace changed.',409,wv);end if;
 if p_input?'role_ids'then
  select coalesce(array_agg(id order by id),array[]::uuid[])into actual from eps.roles where workspace_id=p_workspace_id and archived_at is null;ids:=eps.casting_order_ids(p_input->'role_ids',actual);
  if ids is distinct from array(select id from eps.roles where workspace_id=p_workspace_id and archived_at is null order by sort_order,id)then
   perform eps.casting_advance(row_version)from eps.roles where id=any(ids);update eps.roles r set sort_order=x.n-1,row_version=r.row_version+1,updated_at=clock_timestamp()from unnest(ids)with ordinality x(id,n)where r.id=x.id and r.sort_order<>x.n-1;changed:=true;
  end if;
 end if;
 for entry in select key,value from jsonb_each(coalesce(p_input->'slot_ids_by_role','{}'::jsonb))loop
  select coalesce(array_agg(id order by id),array[]::uuid[])into actual from eps.slots where role_id=eps.casting_uuid(to_jsonb(entry.key))and archived_at is null;ids:=eps.casting_order_ids(entry.value,actual);
  if ids is distinct from array(select id from eps.slots where role_id=eps.casting_uuid(to_jsonb(entry.key))and archived_at is null order by sort_order,id)then
   perform eps.casting_advance(row_version)from eps.slots where id=any(ids);update eps.slots s set sort_order=x.n-1,row_version=s.row_version+1,updated_at=clock_timestamp()from unnest(ids)with ordinality x(id,n)where s.id=x.id and s.sort_order<>x.n-1;changed:=true;
  end if;
 end loop;
 for entry in select key,value from jsonb_each(coalesce(p_input->'assignment_ids_by_slot','{}'::jsonb))loop
  select coalesce(array_agg(id order by id),array[]::uuid[])into actual from eps.assignments where slot_id=eps.casting_uuid(to_jsonb(entry.key))and archived_at is null;ids:=eps.casting_order_ids(entry.value,actual);
  if ids is distinct from array(select id from eps.assignments where slot_id=eps.casting_uuid(to_jsonb(entry.key))and archived_at is null order by sort_order,id)then
   select coalesce(jsonb_agg(eps.casting_assignment_dto(id)order by id),'[]'::jsonb)into before_rows from eps.assignments where id=any(ids);
   perform eps.casting_advance(row_version)from eps.assignments where id=any(ids);update eps.assignments a set sort_order=x.n-1,row_version=a.row_version+1,updated_at=clock_timestamp()from unnest(ids)with ordinality x(id,n)where a.id=x.id and a.sort_order<>x.n-1;
   select coalesce(jsonb_agg(eps.casting_assignment_dto(id)order by id),'[]'::jsonb)into after_rows from eps.assignments where id=any(ids);
   -- Split private full-row evidence; the published permutation is not reduced
   -- to the100-row per-event bound.
   perform eps.casting_record_batches(p_workspace_id,'reorder',p_workspace_id,before_rows,after_rows,jsonb_build_object('slot_id',entry.key));changed:=true;
  end if;
 end loop;
 if changed then perform eps.casting_changed(p_workspace_id);perform eps.casting_record_change(p_workspace_id,'reorder',p_workspace_id,jsonb_build_object('schema_version','1.0','before','[]'::jsonb,'after','[]'::jsonb,'details',jsonb_build_object('order',p_input-'row_version')));end if;
 result:=eps.specs_order_workspace_dto(p_workspace_id);return eps.casting_remember('reorder',p_idempotency_key,payload,result);
end$$;

create function public.eps_get_casting_context(p_resource_type text,p_resource_id uuid)returns jsonb language plpgsql stable security definer set search_path=''as $$declare result jsonb;begin
 if not(eps.has_capability('workspaces.read')or eps.has_capability('workspaces.write'))then perform eps.require_capability('workspaces.read');end if;
 if p_resource_type='assignment'then
  select jsonb_build_object('workspace_id',a.workspace_id,'slot_id',a.slot_id,'role_id',s.role_id,'workspace_candidate_id',a.workspace_candidate_id)into result from eps.assignments a join eps.slots s on s.id=a.slot_id where a.id=p_resource_id and(eps.casting_scope(a.workspace_id,false)or eps.casting_scope(a.workspace_id,true));
 elsif p_resource_type='slot'then
  select jsonb_build_object('workspace_id',s.workspace_id,'slot_id',s.id,'role_id',s.role_id,'workspace_candidate_id',null)into result from eps.slots s where s.id=p_resource_id and(eps.casting_scope(s.workspace_id,false)or eps.casting_scope(s.workspace_id,true));
 else perform eps.fail('VALIDATION_FAILED','Unknown casting context type.',400);end if;
 if result is null then perform eps.fail('RESOURCE_NOT_FOUND','Casting resource not found.',404);end if;return result;
end$$;

-- Exact allowlists: private helpers never gain authenticated EXECUTE.
grant create on schema eps,public to eps_casting_owner;
do $$declare signature text;begin foreach signature in array array[
 'eps.casting_scope(uuid,boolean)','eps.casting_body(jsonb,text[])','eps.casting_uuid(jsonb)','eps.casting_version(jsonb)','eps.casting_text(jsonb)','eps.casting_wording(jsonb)','eps.casting_advance(bigint)','eps.casting_lock_workspaces(uuid[])','eps.casting_changed(uuid)','eps.casting_assignment_dto(uuid)','eps.casting_slot_dto(uuid)','eps.casting_remember(text,text,jsonb,jsonb)','eps.casting_replay(text,text,jsonb)','eps.casting_record_change(uuid,text,uuid,jsonb)','eps.casting_record_batches(uuid,text,uuid,jsonb,jsonb,jsonb)','eps.casting_lock_slot(uuid,uuid)','eps.casting_pool_active(uuid,uuid)','eps.casting_order_ids(jsonb,uuid[])']loop
 execute format('alter function %s owner to eps_casting_owner',signature);execute format('revoke all on function %s from public,anon,authenticated,service_role',signature);
 end loop;
 foreach signature in array array['public.eps_get_casting_context(text,uuid)','public.eps_list_assignments(uuid,text,text,integer)','public.eps_create_assignment(uuid,jsonb,text)','public.eps_update_assignment(uuid,jsonb,text)','public.eps_set_slot_main(uuid,jsonb,text)','public.eps_undo_slot_main(uuid,jsonb,text)','public.eps_remove_assignment(uuid,jsonb,text)','public.eps_reorder_workspace(uuid,jsonb,text)']loop
 execute format('alter function %s owner to eps_casting_owner',signature);execute format('revoke all on function %s from public,anon,authenticated,service_role',signature);execute format('grant execute on function %s to authenticated',signature);
 end loop;
end$$;
revoke create on schema eps,public from eps_casting_owner;


-- Exact reviewed fragment: development/m04/lifecycle-forward.sql
-- Development-only additive M04 lifecycle composition, AFTER assignments.sql.
-- No numbered migration, seed, identities, feature activation or cloud action.
-- Preserve existing public DTOs; bounded private effects support later typed Undo.
set local search_path='';set local lock_timeout='3s';set local statement_timeout='30s';
do $baseline$
declare item record;body text;begin
 if current_user<>'postgres' or current_database()<>'postgres'
  or (select array_agg(version order by version)from supabase_migrations.schema_migrations)is distinct from
  array['20261028010943','20261028013324','20261028013655','20261028024205','20261028072515','20261028162702','20261028162800','20261028172320','20261028184145','20261028222030','20261029001520','20261029003941','20261029070038','20261029090500','20261029090724','20261029094600','20261029100500','20261029133455','20261029135318']::text[]
  or to_regclass('eps.assignments')is null or to_regclass('eps.assignment_change_events')is null
  or to_regprocedure('eps.casting_record_change(uuid,text,uuid,jsonb)')is null
  or to_regprocedure('eps.casting_has_active_assignments(uuid)')is null
 then raise exception 'M04_LIFECYCLE_EXACT_NINETEEN_AND_ASSIGNMENT_CORE_REQUIRED';end if;
 for item in select * from(values
  ('public.eps_resize_role_slots(uuid,jsonb,text)','eps_specs_owner','957a17e5ed0e9679f95cb8892d66c2e276faf62c4c43fd02733f1f60a2f484f8'),
  ('public.eps_archive_role(uuid,jsonb,text)','eps_specs_owner','d356c477c278d3c358d1baab46b3eab1189f43d675b23e33b78ba896df461a36'),
  ('eps.specs_machine_baseline(eps.specs)','eps_specs_apply_owner','f1d5e1a38858e06823cfbcc17baae4a0095e1d4c6befeaa2fa8a9318811cf155'),
  ('eps.cast_archive_with_reason(text,uuid,jsonb,text)','eps_cast_owner','71b109621008cbca1144c1293bf991fae95232d9f65adff8d57f81e4bd60a248'),
  ('eps.cast_link_duplicate(uuid,jsonb,text)','eps_cast_owner','f5639a241377ef90bb430feb250c25cbd1adc64b114ec56f9539f6180254a4dd'),
  ('eps.support_move_after_merge(uuid,uuid)','eps_support_upload_owner','1950f511b18520801418d5b62b2d80753e730ea88666f06b53181e22ac9e2259')
 )expected(signature,owner,source_sha256)loop
  select p.prosrc into body from pg_proc p where p.oid=item.signature::regprocedure
   and p.proowner=item.owner::regrole and p.proconfig=array['search_path=""'];
  if body is null or encode(sha256(convert_to(replace(body,E'\r\n',E'\n'),'UTF8')),'hex')<>item.source_sha256
  then raise exception 'M04_LIFECYCLE_REVIEWED_POST19_SOURCE_REQUIRED';end if;
 end loop;
end $baseline$;

-- Metadata-only complete scope lookup. Current-owner RLS must not hide an
-- affected project, and successful replays retain the original project scopes.
grant select(workspace_id,candidate_id)on eps.workspace_candidates to eps_casting_guard_owner;
grant select(workspace_id,operation,audit_event_id)on eps.assignment_change_events to eps_casting_guard_owner;
grant select(id,resource_id,action)on eps.audit_events to eps_casting_guard_owner;
create policy casting_guard_duplicate_pools on eps.workspace_candidates for select to eps_casting_guard_owner using(true);
create policy casting_guard_duplicate_events on eps.assignment_change_events for select to eps_casting_guard_owner using(true);
create policy casting_guard_duplicate_audit on eps.audit_events for select to eps_casting_guard_owner using(true);
create function eps.casting_duplicate_workspace_ids(p_source uuid)returns uuid[]language sql stable security definer set search_path=''as $$
 select coalesce(array_agg(workspace_id order by workspace_id),'{}')from(
  select workspace_id from eps.workspace_candidates where candidate_id=p_source
  union select e.workspace_id from eps.assignment_change_events e join eps.audit_events a on a.id=e.audit_event_id
   where e.operation='link_duplicate'and a.action='casting.link_duplicate'and a.resource_id=p_source
 )scopes
$$;
grant create on schema eps to eps_casting_guard_owner;
alter function eps.casting_duplicate_workspace_ids(uuid)owner to eps_casting_guard_owner;
revoke create on schema eps from eps_casting_guard_owner;
revoke all on function eps.casting_duplicate_workspace_ids(uuid)from public,anon,authenticated,service_role;
grant execute on function eps.casting_duplicate_workspace_ids(uuid)to eps_cast_owner,eps_casting_owner;

create function eps.casting_retire_assignments(p_workspace uuid,p_slots uuid[],p_pool uuid,p_operation text,p_resource uuid,p_bump_slots boolean)
returns uuid[] language plpgsql volatile security definer set search_path='' as $$
declare item eps.assignments;role_state eps.roles;pool_state eps.workspace_candidates;slot_ids uuid[];affected uuid[]:='{}';
 before_rows jsonb:='[]';after_rows jsonb:='[]';before_row jsonb;after_row jsonb;details jsonb;slot_states jsonb;next_payload jsonb;begin
 if p_workspace is null or p_operation is null or p_operation not in('retire_slots','archive_role','remove_workspace_candidate')or p_resource is null or p_bump_slots is null
  or not eps.casting_scope(p_workspace,true)
 then perform eps.fail('RESOURCE_NOT_FOUND','Writable casting scope not found.',404);end if;
 perform eps.casting_lock_workspaces(array[p_workspace]);
 if p_operation='remove_workspace_candidate'then
  if p_slots is not null or p_pool is null or p_resource<>p_pool or not p_bump_slots then perform eps.fail('INVALID_REQUEST','Invalid project removal scope.',400);end if;
  select * into pool_state from eps.workspace_candidates where id=p_pool and workspace_id=p_workspace and archived_at is null for update;
  if not found then perform eps.fail('RESOURCE_NOT_FOUND','Active project candidate not found.',404);end if;
  select coalesce(array_agg(distinct slot_id order by slot_id),'{}')into slot_ids from eps.assignments where workspace_id=p_workspace and workspace_candidate_id=p_pool and archived_at is null;
 else
  if p_slots is null or p_pool is not null or p_bump_slots or cardinality(p_slots)<>coalesce((select count(distinct v)from unnest(p_slots)v),0)
   or array_position(p_slots,null)is not null
  then perform eps.fail('INVALID_REQUEST','Invalid role retirement scope.',400);end if;
  select id,headcount,row_version,clarifications into role_state.id,role_state.headcount,role_state.row_version,role_state.clarifications
   from eps.roles where id=p_resource and workspace_id=p_workspace and archived_at is null;
  if not found or exists(select 1 from unnest(p_slots)v where not exists(select 1 from eps.slots s where s.id=v and s.workspace_id=p_workspace and s.role_id=p_resource and s.archived_at is null))
  then perform eps.fail('RESOURCE_NOT_FOUND','Active role slots not found.',404);end if;
  slot_ids:=p_slots;
 end if;
 perform 1 from eps.slots where workspace_id=p_workspace and id=any(slot_ids)order by id for update;
 if not eps.casting_scope(p_workspace,true)then perform eps.fail('RESOURCE_NOT_FOUND','Writable casting scope changed.',404);end if;
 perform eps.casting_advance(row_version)from eps.slots where workspace_id=p_workspace and id=any(slot_ids);
 -- Existing rows retain labels, notes and source fields; record only changed
 -- lifecycle/version flags for future bounded retirement restoration.
 select coalesce(jsonb_agg(jsonb_build_object('slot_id',s.id,'row_version',s.row_version,'provisional',s.provisional,'archived',s.archived_at is not null)order by s.id),'[]')into slot_states
 from eps.slots s where s.workspace_id=p_workspace and s.archived_at is null
  and(case when p_operation='remove_workspace_candidate'then s.id=any(slot_ids)else s.role_id=p_resource end);
 details:=jsonb_build_object('resource_id',p_resource,'pool_id',p_pool,'selected_slot_ids',to_jsonb(slot_ids),'slot_states_before',slot_states,'bump_slots',p_bump_slots,
  'role_before',case when role_state.id is not null then jsonb_build_object('role_id',role_state.id,'row_version',role_state.row_version,'headcount',role_state.headcount,'archived',false,
   'headcount_marker_flags',(select coalesce(jsonb_agg(jsonb_build_object('index',v.ordinal-1,'resolved',v.value->'resolved')order by v.ordinal),'[]')from jsonb_array_elements(role_state.clarifications)with ordinality v(value,ordinal)where v.value->>'field_path'='headcount'))end,
  'pool_row_version_before',pool_state.row_version);
 for item in select * from eps.assignments a where a.workspace_id=p_workspace and a.archived_at is null
  and(case when p_pool is null then a.slot_id=any(slot_ids)else a.workspace_candidate_id=p_pool end)order by a.slot_id,a.id for update loop
  before_row:=eps.casting_assignment_dto(item.id);
  perform eps.casting_advance(item.row_version);
  update eps.assignments set archived_at=clock_timestamp(),row_version=row_version+1,updated_at=clock_timestamp()where id=item.id and archived_at is null;
  if not found then perform eps.fail('STALE_RESOURCE_VERSION','Assignment changed during retirement.',409);end if;
  after_row:=eps.casting_assignment_dto(item.id);affected:=array_append(affected,item.id);
  next_payload:=jsonb_build_object('schema_version','1.0','before',before_rows||jsonb_build_array(before_row),'after',after_rows||jsonb_build_array(after_row),'details',details);
  if jsonb_array_length(before_rows)>=100 or octet_length(next_payload::text)>900000 then
   if jsonb_array_length(before_rows)>0 then perform eps.casting_record_change(p_workspace,p_operation,p_resource,jsonb_build_object('schema_version','1.0','before',before_rows,'after',after_rows,'details',details));end if;
   before_rows:='[]';after_rows:='[]';
  end if;
  before_rows:=before_rows||jsonb_build_array(before_row);after_rows:=after_rows||jsonb_build_array(after_row);
 end loop;
 if p_bump_slots then update eps.slots set row_version=row_version+1,updated_at=clock_timestamp()where workspace_id=p_workspace and id=any(slot_ids);end if;
 if jsonb_array_length(before_rows)>0 or cardinality(affected)=0 then
  perform eps.casting_record_change(p_workspace,p_operation,p_resource,jsonb_build_object('schema_version','1.0','before',before_rows,'after',after_rows,'details',details));
 end if;
 return affected;
end $$;

create function eps.casting_merge_assignments(p_source uuid,p_target uuid)returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare source_pool eps.workspace_candidates;target_pool eps.workspace_candidates;source_assignment eps.assignments;target_assignment eps.assignments;
 workspace_ids uuid[];workspace uuid;slot_ids uuid[];affected uuid[]:='{}';collapsed uuid[]:='{}';retained uuid[]:='{}';
 before_rows jsonb;after_rows jsonb;position_value text;scope_recorded boolean;begin
 perform eps.require_capability('cast.read');perform eps.require_capability('cast.write');
 if p_source is null or p_target is null or p_source=p_target then perform eps.fail('INVALID_REQUEST','Choose different candidate identities.',400);end if;
 workspace_ids:=eps.casting_duplicate_workspace_ids(p_source);
 if cardinality(workspace_ids)>0 then perform eps.casting_lock_workspaces(workspace_ids);end if;
 perform eps.require_capability('cast.read');perform eps.require_capability('cast.write');
 -- Caller already locked both profile identities in deterministic order and
 -- verified expected versions. No source facts/media/support rows are changed here.
 for workspace in select v from unnest(workspace_ids)v order by v loop
  scope_recorded:=false;
  if not eps.casting_scope(workspace,true)then perform eps.fail('RESOURCE_NOT_FOUND','Writable affected project not found.',404);end if;
  perform 1 from eps.workspace_candidates where workspace_id=workspace and candidate_id in(p_source,p_target)order by id for update;
  select coalesce(array_agg(distinct a.slot_id order by a.slot_id),'{}')into slot_ids from eps.assignments a join eps.workspace_candidates w on w.id=a.workspace_candidate_id
   where a.workspace_id=workspace and w.workspace_id=workspace and w.candidate_id=p_source and a.archived_at is null;
  perform 1 from eps.slots where workspace_id=workspace and id=any(slot_ids)order by id for update;
  perform eps.casting_advance(row_version)from eps.slots where workspace_id=workspace and id=any(slot_ids);
  perform 1 from eps.assignments where workspace_id=workspace and slot_id=any(slot_ids)and archived_at is null order by slot_id,id for update;
  for source_pool in select * from eps.workspace_candidates where workspace_id=workspace and candidate_id=p_source order by id loop
   if source_pool.archived_at is not null and exists(select 1 from eps.assignments where workspace_candidate_id=source_pool.id and archived_at is null)
   then perform eps.fail('INVALID_TRANSITION','An archived project candidate has active assignments.',409);end if;
   select * into target_pool from eps.workspace_candidates where workspace_id=workspace and candidate_id=p_target and archived_at is null;
   for source_assignment in select * from eps.assignments where workspace_id=workspace and workspace_candidate_id=source_pool.id and archived_at is null order by slot_id,id loop
    before_rows:=jsonb_build_array(eps.casting_assignment_dto(source_assignment.id));target_assignment:=null;
    perform eps.casting_advance(source_assignment.row_version);
    if target_pool.id is not null then
     select * into target_assignment from eps.assignments where workspace_id=workspace and workspace_candidate_id=target_pool.id and slot_id=source_assignment.slot_id and archived_at is null;
    end if;
    if target_assignment.id is not null then
     perform eps.casting_advance(target_assignment.row_version);
     before_rows:=before_rows||jsonb_build_array(eps.casting_assignment_dto(target_assignment.id));
     position_value:=case when source_assignment.position='main'or target_assignment.position='main'then'main'
      when source_assignment.position='backup'or target_assignment.position='backup'then'backup'else'option'end;
     -- Archive source Main first; the partial unique index never sees two Mains.
     update eps.assignments set archived_at=clock_timestamp(),row_version=row_version+1,updated_at=clock_timestamp()where id=source_assignment.id;
     update eps.assignments set position=position_value,shortlist_included=shortlist_included or source_assignment.shortlist_included,row_version=row_version+1,updated_at=clock_timestamp()where id=target_assignment.id;
     after_rows:=jsonb_build_array(eps.casting_assignment_dto(source_assignment.id),eps.casting_assignment_dto(target_assignment.id));
     collapsed:=array_append(collapsed,source_assignment.id);retained:=array_append(retained,target_assignment.id);affected:=array_append(affected,target_assignment.id);
    else
     update eps.assignments set workspace_candidate_id=coalesce(target_pool.id,source_pool.id),row_version=row_version+1,updated_at=clock_timestamp()where id=source_assignment.id;
     after_rows:=jsonb_build_array(eps.casting_assignment_dto(source_assignment.id));
    end if;
    affected:=array_append(affected,source_assignment.id);
    perform eps.casting_record_change(workspace,'link_duplicate',p_source,jsonb_build_object('schema_version','1.0','before',before_rows,'after',after_rows,
     'details',jsonb_build_object('source_candidate_id',p_source,'target_candidate_id',p_target,'source_pool_id',source_pool.id,'target_pool_id',coalesce(target_pool.id,source_pool.id),'slot_id',source_assignment.slot_id,'collapsed',target_assignment.id is not null,
      'display_note_policy','retain_existing_target_note_and_wording')));
    scope_recorded:=true;
   end loop;
  end loop;
  update eps.slots set row_version=row_version+1,updated_at=clock_timestamp()where workspace_id=workspace and id=any(slot_ids);
  if not scope_recorded then
   perform eps.casting_record_change(workspace,'link_duplicate',p_source,jsonb_build_object('schema_version','1.0','before','[]'::jsonb,'after','[]'::jsonb,
    'details',jsonb_build_object('source_candidate_id',p_source,'target_candidate_id',p_target,'scope_only',true)));
  end if;
 end loop;
 return jsonb_build_object('affected_assignment_ids',to_jsonb(affected),'collapsed_assignment_ids',to_jsonb(collapsed),'retained_assignment_ids',to_jsonb(retained));
end $$;

grant create on schema eps to eps_casting_owner;
alter function eps.casting_retire_assignments(uuid,uuid[],uuid,text,uuid,boolean)owner to eps_casting_owner;
alter function eps.casting_merge_assignments(uuid,uuid)owner to eps_casting_owner;
revoke create on schema eps from eps_casting_owner;
revoke all on function eps.casting_retire_assignments(uuid,uuid[],uuid,text,uuid,boolean),eps.casting_merge_assignments(uuid,uuid)from public,anon,authenticated,service_role;
grant execute on function eps.casting_retire_assignments(uuid,uuid[],uuid,text,uuid,boolean)to eps_specs_owner,eps_cast_owner;
grant execute on function eps.casting_merge_assignments(uuid,uuid)to eps_cast_owner;

-- Preserve every other post19 source validation, scope/replay guard and grant.
do $integrate$
declare item record;source text;body text;definition text;anchor text;replacement text;begin
 for item in select * from(values
  ('public.eps_resize_role_slots(uuid,jsonb,text)',
   'if excess>0 then perform eps.specs_retirement_gate(); end if;',
   'if excess>0 then perform eps.casting_retire_assignments(workspace_id,retire,null,''retire_slots'',role.id,false); end if;'),
  ('public.eps_archive_role(uuid,jsonb,text)',
   'affected uuid[]; changed bigint; begin',
   'affected uuid[]; retired_assignments uuid[]:=''{}''; changed bigint; begin'),
  ('public.eps_archive_role(uuid,jsonb,text)',
   '  perform eps.specs_retirement_gate();',
   '  -- Scoped assignment retirement follows the exact selected slot list below.'),
  ('public.eps_archive_role(uuid,jsonb,text)',
   '  select array[role.id]||coalesce(array_agg(id order by sort_order,id),array[]::uuid[]) into affected from eps.slots where role_id=role.id and archived_at is null;',
   '  select array[role.id]||coalesce(array_agg(id order by sort_order,id),array[]::uuid[]) into affected from eps.slots where role_id=role.id and archived_at is null;'||E'\n'||'  retired_assignments:=eps.casting_retire_assignments(workspace_id,coalesce(affected[2:cardinality(affected)],''{}''::uuid[]),null,''archive_role'',role.id,false);'),
  ('public.eps_archive_role(uuid,jsonb,text)',
   '''affected_ids'',to_jsonb(affected)',
   '''affected_ids'',to_jsonb(affected||retired_assignments)'),
  ('eps.specs_machine_baseline(eps.specs)',
   'to_regclass(''eps.assignments'') is not null',
   'eps.casting_has_active_assignments(p_spec.workspace_id)'),
  ('eps.cast_archive_with_reason(text,uuid,jsonb,text)',
   'note text;begin',
   'note text;affected_assignments uuid[]:=''{}'';begin'),
  ('eps.cast_archive_with_reason(text,uuid,jsonb,text)',
   '  if to_regclass(''eps.assignments'') is not null then perform eps.fail(''ASSIGNMENT_RETIREMENT_UNAVAILABLE'',''Assignment archival must be integrated before project candidate removal.'',503);end if;',
   '  affected_assignments:=eps.casting_retire_assignments(workspace,null,pool.id,''remove_workspace_candidate'',pool.id,true);'),
  ('eps.cast_archive_with_reason(text,uuid,jsonb,text)',
   '''affected_ids'',jsonb_build_array(p_id)',
   '''affected_ids'',to_jsonb(array[p_id]||affected_assignments)'),
  ('eps.cast_link_duplicate(uuid,jsonb,text)',
   '  perform 1 from eps.workspaces where id=workspace for update;',
   '  perform 1 from eps.workspaces where id=workspace for update;'||E'\n'||'  if not eps.cast_workspace_scope(workspace,true)then perform eps.fail(''RESOURCE_NOT_FOUND'',''Writable affected project changed.'',404);end if;'),
  ('eps.cast_link_duplicate(uuid,jsonb,text)',
   'affected_workspaces uuid[];result jsonb;begin',
   'affected_workspaces uuid[];locked_workspaces uuid[];result jsonb;begin'),
  ('eps.cast_link_duplicate(uuid,jsonb,text)',
   ' for workspace in select distinct pool.workspace_id from eps.workspace_candidates pool where pool.candidate_id=p_id order by pool.workspace_id loop',
   ' locked_workspaces:=eps.casting_duplicate_workspace_ids(p_id);'||E'\n'||' for workspace in select v from unnest(locked_workspaces)v order by v loop'),
  ('eps.cast_link_duplicate(uuid,jsonb,text)',
   ' if to_regclass(''eps.assignments'') is not null then perform eps.fail(''ASSIGNMENT_RETIREMENT_UNAVAILABLE'',''Assignment identity transfer must be integrated before linking profiles.'',503);end if;',
   ' if locked_workspaces is distinct from eps.casting_duplicate_workspace_ids(p_id)then perform eps.fail(''STALE_RESOURCE_VERSION'',''Affected project participation changed during identity resolution.'',409);end if;'||E'\n'||' perform eps.casting_merge_assignments(source_row.id,target_row.id);')
 )changes(signature,old_text,new_text)loop
  select prosrc,pg_get_functiondef(oid)into source,definition from pg_proc where oid=item.signature::regprocedure;
  body:=replace(source,E'\r\n',E'\n');anchor:=item.old_text;replacement:=item.new_text;
  if length(body)-length(replace(body,anchor,''))<>length(anchor)then raise exception 'M04_LIFECYCLE_EXACT_SOURCE_SEAM_REQUIRED';end if;
  body:=replace(body,anchor,replacement);execute replace(definition,source,body);
 end loop;
 if position('perform eps.support_move_after_merge(source_row.id,target_row.id);'in(select prosrc from pg_proc where oid='eps.cast_link_duplicate(uuid,jsonb,text)'::regprocedure))=0
 then raise exception 'M04_LIFECYCLE_SUPPORT_TRANSFER_HOOK_MUST_SURVIVE';end if;
end $integrate$;

