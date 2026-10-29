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
