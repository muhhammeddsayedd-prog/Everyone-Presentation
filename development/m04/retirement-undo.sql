-- Typed, audited inverse of complete M04 retirement effects. No generic rollback.
set local search_path='';set local lock_timeout='3s';set local statement_timeout='30s';
grant update(headcount,clarifications,archived_at,row_version,updated_at)on eps.roles to eps_casting_owner;
grant update(archived_at,provisional,row_version,updated_at)on eps.slots to eps_casting_owner;
grant update(archived_at,row_version,updated_at)on eps.workspace_candidates to eps_casting_owner;
create policy casting_pool_retirement_restore on eps.workspace_candidates for update to eps_casting_owner using(eps.casting_scope(workspace_id,true))with check(eps.casting_scope(workspace_id,true));
create policy casting_retirement_idempotency on eps.idempotency_records for all to eps_casting_owner using(principal_id=auth.uid()and operation='casting.undo_retirement')with check(principal_id=auth.uid()and operation='casting.undo_retirement');
create policy casting_retirement_audit on eps.audit_events for insert to eps_casting_owner with check(principal_id=auth.uid()and action='casting.undo_retirement');

create function eps.casting_retirement_state(p_workspace uuid,p_resource uuid,p_event uuid default null)returns jsonb language plpgsql stable security invoker set search_path=''as $$
declare event eps.assignment_change_events;details jsonb;before_rows jsonb;after_rows jsonb;family uuid[];assignment_ids uuid[];slots uuid[];slot_state jsonb;item jsonb;state eps.slots;role_state eps.roles;pool eps.workspace_candidates;assignment eps.assignments;reason text;expected bigint;main_count integer;shortlist_count integer;begin
 perform eps.require_capability('workspaces.write');if not eps.casting_scope(p_workspace,true)then perform eps.fail('RESOURCE_NOT_FOUND','Writable retirement scope not found.',404);end if;
 select * into event from eps.assignment_change_events where workspace_id=p_workspace and operation in('retire_slots','archive_role','remove_workspace_candidate')and payload#>>'{details,resource_id}'=p_resource::text and(p_event is null or id=p_event)order by created_at desc,id desc limit 1;
 if not found then perform eps.fail('RESOURCE_NOT_FOUND','Retirement effect not found.',404);end if;
 details:=event.payload->'details';
 select array_agg(id order by created_at,id)into family from eps.assignment_change_events where workspace_id=p_workspace and operation=event.operation and payload->'details'=details;
 select coalesce(jsonb_agg(v.value order by e.created_at,e.id,v.ordinal),'[]')into before_rows from eps.assignment_change_events e cross join lateral jsonb_array_elements(e.payload->'before')with ordinality v(value,ordinal)where e.id=any(family);
 select coalesce(jsonb_agg(v.value order by e.created_at,e.id,v.ordinal),'[]')into after_rows from eps.assignment_change_events e cross join lateral jsonb_array_elements(e.payload->'after')with ordinality v(value,ordinal)where e.id=any(family);
 select coalesce(array_agg((v->>'id')::uuid order by v->>'id'),'{}'),count(*)filter(where v->>'position'='main'),count(*)filter(where v->'shortlist_included'='true')into assignment_ids,main_count,shortlist_count from jsonb_array_elements(before_rows)v;
 select coalesce(array_agg(value::uuid order by value),'{}')into slots from jsonb_array_elements_text(details->'selected_slot_ids');
 if cardinality(assignment_ids)>1000 or cardinality(slots)>1000 or cardinality(family)>20 then reason:='RETIREMENT_TOO_LARGE';
 elsif exists(select 1 from eps.assignment_change_consumptions where event_id=any(family))then reason:='ALREADY_UNDONE';
 elsif cardinality(assignment_ids)<>(select count(distinct v)from unnest(assignment_ids)v)or jsonb_array_length(before_rows)<>jsonb_array_length(after_rows)then reason:='RETIREMENT_CHANGED';end if;
 if reason is null then
  for item in select value from jsonb_array_elements(after_rows)loop
   select * into assignment from eps.assignments where id=(item->>'id')::uuid and workspace_id=p_workspace;
   if not found or eps.casting_assignment_dto(assignment.id)<>item or assignment.archived_at is null then reason:='RETIREMENT_CHANGED';exit;end if;
   if assignment.position='main'and exists(select 1 from eps.assignments a where a.slot_id=assignment.slot_id and a.archived_at is null and a.position='main'and a.id<>assignment.id)then reason:='MAIN_CHANGED';exit;end if;
   if exists(select 1 from eps.assignments a where a.slot_id=assignment.slot_id and a.workspace_candidate_id=assignment.workspace_candidate_id and a.archived_at is null and a.id<>assignment.id)then reason:='RETIREMENT_CHANGED';exit;end if;
  end loop;
 end if;
 if reason is null then
  if event.operation='remove_workspace_candidate'then
   select * into pool from eps.workspace_candidates where id=p_resource and workspace_id=p_workspace;
   if not found or pool.archived_at is null or pool.row_version<>(details->>'pool_row_version_before')::bigint+1
    or exists(select 1 from eps.workspace_candidates p where p.workspace_id=p_workspace and p.candidate_id=pool.candidate_id and p.archived_at is null and p.id<>pool.id)
    or not exists(select 1 from eps.candidates c where c.id=pool.candidate_id and c.archived_at is null and c.merged_into_candidate_id is null)then reason:='RETIREMENT_CHANGED';end if;
  else
   select * into role_state from eps.roles where id=p_resource and workspace_id=p_workspace;
   if not found or role_state.row_version<>(details#>>'{role_before,row_version}')::bigint+1 or(role_state.archived_at is not null)<>(event.operation='archive_role')then reason:='RETIREMENT_CHANGED';end if;
  end if;
 end if;
 if reason is null then
  for slot_state in select value from jsonb_array_elements(details->'slot_states_before')loop
   select * into state from eps.slots where id=(slot_state->>'slot_id')::uuid and workspace_id=p_workspace;
   expected:=(slot_state->>'row_version')::bigint+case when event.operation='remove_workspace_candidate'or state.id=any(slots)or event.operation='retire_slots'and(slot_state->>'provisional')::boolean then 1 else 0 end;
   if not found or state.row_version<>expected or(state.archived_at is not null)<>(event.operation in('retire_slots','archive_role')and state.id=any(slots))then reason:='RETIREMENT_CHANGED';exit;end if;
  end loop;
 end if;
 return jsonb_build_object('effect',jsonb_build_object('workspace_id',p_workspace,'resource_id',p_resource,'operation',event.operation,'undo_event_id',event.id,'expected_workspace_row_version',(select row_version from eps.workspaces where id=p_workspace),'assignment_ids',to_jsonb(assignment_ids),'slot_ids',to_jsonb(slots),'main_count',main_count,'shortlist_count',shortlist_count,'can_undo',reason is null,'unavailable_reason',reason),'details',details,'before',before_rows,'after',after_rows,'family_event_ids',to_jsonb(family));
end$$;
create function public.eps_get_casting_retirement(p_workspace_id uuid,p_resource_id uuid)returns jsonb language plpgsql stable security definer set search_path=''as $$begin
 return eps.casting_retirement_state(p_workspace_id,p_resource_id)->'effect';
end$$;
create function eps.casting_record_retirement_undo(p_workspace uuid,p_resource uuid,p_before jsonb,p_after jsonb,p_consumed uuid)returns uuid language plpgsql volatile security invoker set search_path=''as $$
declare audit uuid:=gen_random_uuid();event uuid:=gen_random_uuid();begin
 if not eps.casting_scope(p_workspace,true)or jsonb_typeof(p_before)<> 'array'or jsonb_typeof(p_after)<>'array'or jsonb_array_length(p_before)>100 or jsonb_array_length(p_after)>100 then perform eps.fail('RETIREMENT_UNDO_INVALID','Invalid bounded inverse payload.',409);end if;
 insert into eps.audit_events(id,principal_id,action,resource_id)values(audit,auth.uid(),'casting.undo_retirement',p_resource);
 insert into eps.assignment_change_events(id,audit_event_id,workspace_id,operation,payload)values(event,audit,p_workspace,'undo_retirement',jsonb_build_object('schema_version','1.0','before',p_before,'after',p_after,'details',jsonb_build_object('consumed_event_id',p_consumed,'resource_id',p_resource)));
 insert into eps.assignment_change_consumptions(event_id,consumed_by_event_id)values(p_consumed,event);return event;
end$$;
create function public.eps_undo_casting_retirement(p_workspace_id uuid,p_event_id uuid,p_input jsonb,p_idempotency_key text)returns jsonb language plpgsql volatile security definer set search_path=''as $$
declare event eps.assignment_change_events;state jsonb;details jsonb;cached jsonb;input_value jsonb;workspace_version bigint;expected bigint;resource uuid;item jsonb;slot_state jsonb;slot_row eps.slots;role_row eps.roles;pool eps.workspace_candidates;family uuid[];event_id uuid;event_before jsonb;event_after jsonb;affected uuid[]:='{}';clarification_value jsonb;marker jsonb;begin
 perform eps.casting_body(p_input,array['expected_workspace_row_version']);expected:=eps.casting_version(p_input->'expected_workspace_row_version');
 perform eps.casting_lock_workspaces(array[p_workspace_id]);input_value:=p_input||jsonb_build_object('workspace_id',p_workspace_id,'event_id',p_event_id);
 cached:=eps.casting_replay('undo_retirement',p_idempotency_key,input_value);perform eps.require_capability('workspaces.write');if not eps.casting_scope(p_workspace_id,true)then perform eps.fail('RESOURCE_NOT_FOUND','Writable retirement scope not found.',404);end if;
 if cached is not null then return cached;end if;
 select row_version into workspace_version from eps.workspaces where id=p_workspace_id;
 if expected<>workspace_version then perform eps.fail('STALE_RESOURCE_VERSION','Workspace changed since the inverse was shown.',409,workspace_version);end if;
 select * into event from eps.assignment_change_events where id=p_event_id and workspace_id=p_workspace_id and operation in('retire_slots','archive_role','remove_workspace_candidate');
 if not found then perform eps.fail('RESOURCE_NOT_FOUND','Retirement effect not found.',404);end if;
 resource:=(event.payload#>>'{details,resource_id}')::uuid;
 if event.operation<>'remove_workspace_candidate'then perform 1 from eps.roles where id=resource and workspace_id=p_workspace_id for update;else perform 1 from eps.workspace_candidates where id=resource and workspace_id=p_workspace_id for update;end if;
 perform 1 from eps.slots where workspace_id=p_workspace_id and id in(select(value->>'slot_id')::uuid from jsonb_array_elements(event.payload#>'{details,slot_states_before}'))order by id for update;
 state:=eps.casting_retirement_state(p_workspace_id,resource,p_event_id);details:=state->'details';
 if state#>'{effect,can_undo}'<>'true'then perform eps.fail('RETIREMENT_UNDO_INVALID','Retirement inverse is unavailable: '||(state#>>'{effect,unavailable_reason}'),409);end if;
 select array_agg(value::uuid order by value)into family from jsonb_array_elements_text(state->'family_event_ids');
 perform 1 from eps.assignments where workspace_id=p_workspace_id and id in(select(value->>'id')::uuid from jsonb_array_elements(state->'after'))order by slot_id,id for update;
 -- Revalidate after every relevant lock; all new casting writes take the same workspace lock.
 state:=eps.casting_retirement_state(p_workspace_id,resource,p_event_id);
 if state#>'{effect,can_undo}'<>'true'then perform eps.fail('RETIREMENT_UNDO_INVALID','Retirement choices changed while waiting.',409);end if;
 if event.operation='remove_workspace_candidate'then
  select * into pool from eps.workspace_candidates where id=resource;perform eps.casting_advance(pool.row_version);
  update eps.workspace_candidates set archived_at=null,row_version=row_version+1,updated_at=clock_timestamp()where id=pool.id;affected:=array_append(affected,pool.id);
 else
  select * into role_row from eps.roles where id=resource;perform eps.casting_advance(role_row.row_version);clarification_value:=role_row.clarifications;
  for marker in select value from jsonb_array_elements(details#>'{role_before,headcount_marker_flags}')loop
   if clarification_value#>>array[marker->>'index','field_path']<>'headcount'then perform eps.fail('RETIREMENT_UNDO_INVALID','Role clarification markers changed.',409);end if;
   clarification_value:=jsonb_set(clarification_value,array[marker->>'index','resolved'],marker->'resolved');
  end loop;
  update eps.roles set archived_at=null,headcount=(details#>>'{role_before,headcount}')::bigint,clarifications=clarification_value,row_version=row_version+1,updated_at=clock_timestamp()where id=role_row.id;affected:=array_append(affected,role_row.id);
 end if;
 for slot_state in select value from jsonb_array_elements(details->'slot_states_before')loop
  select * into slot_row from eps.slots where id=(slot_state->>'slot_id')::uuid;
  if event.operation='remove_workspace_candidate'or slot_row.archived_at is not null or slot_row.provisional is distinct from(slot_state->>'provisional')::boolean then
   perform eps.casting_advance(slot_row.row_version);update eps.slots set archived_at=null,provisional=(slot_state->>'provisional')::boolean,row_version=row_version+1,updated_at=clock_timestamp()where id=slot_row.id;affected:=array_append(affected,slot_row.id);
  end if;
 end loop;
 for item in select value from jsonb_array_elements(state->'before')loop
  perform eps.casting_advance(row_version)from eps.assignments where id=(item->>'id')::uuid;
  update eps.assignments set archived_at=null,row_version=row_version+1,updated_at=clock_timestamp()where id=(item->>'id')::uuid;affected:=array_append(affected,(item->>'id')::uuid);
 end loop;
 foreach event_id in array family loop
  select payload->'after'into event_before from eps.assignment_change_events where id=event_id;
  select coalesce(jsonb_agg(eps.casting_assignment_dto((v->>'id')::uuid)order by v->>'id'),'[]')into event_after from jsonb_array_elements(event_before)v;
  perform eps.casting_record_retirement_undo(p_workspace_id,resource,event_before,event_after,event_id);
 end loop;
 perform eps.casting_changed(p_workspace_id);
 return eps.casting_remember('undo_retirement',p_idempotency_key,input_value,jsonb_build_object('success',true,'affected_ids',to_jsonb(affected),'workspace_row_version',(select row_version from eps.workspaces where id=p_workspace_id)));
exception when unique_violation then perform eps.fail('RETIREMENT_UNDO_INVALID','A newer active choice prevents this inverse.',409);end$$;
grant create on schema eps,public to eps_casting_owner;
alter function eps.casting_retirement_state(uuid,uuid,uuid)owner to eps_casting_owner;
alter function eps.casting_record_retirement_undo(uuid,uuid,jsonb,jsonb,uuid)owner to eps_casting_owner;
alter function public.eps_get_casting_retirement(uuid,uuid)owner to eps_casting_owner;
alter function public.eps_undo_casting_retirement(uuid,uuid,jsonb,text)owner to eps_casting_owner;
revoke create on schema eps,public from eps_casting_owner;
revoke all on function eps.casting_retirement_state(uuid,uuid,uuid),eps.casting_record_retirement_undo(uuid,uuid,jsonb,jsonb,uuid),public.eps_get_casting_retirement(uuid,uuid),public.eps_undo_casting_retirement(uuid,uuid,jsonb,text)from public,anon,authenticated,service_role;
grant execute on function public.eps_get_casting_retirement(uuid,uuid),public.eps_undo_casting_retirement(uuid,uuid,jsonb,text)to authenticated;
