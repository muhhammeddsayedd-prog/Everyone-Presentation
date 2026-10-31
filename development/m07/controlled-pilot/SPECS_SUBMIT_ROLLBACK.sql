-- Root-executed diagnostic only. No commit statement or persistent function/grant.
begin isolation level repeatable read;
set local search_path='';set local timezone='UTC';set local statement_timeout='25s';set local lock_timeout='2s';
do $guard$
declare observed jsonb;
begin
 select q.specs_submit_state into observed from(__SNAPSHOT_QUERY__)q;
 if observed is distinct from convert_from(decode('__BEFORE_B64__','base64'),'UTF8')::jsonb then
  raise exception using errcode='P7002',message='DIAGNOSTIC_BASELINE_CHANGED';
 end if;
end $guard$;
create function pg_temp.eps_m07_specs_submit_repro()returns jsonb language plpgsql security invoker set search_path='' as $repro$
declare acknowledgement jsonb;state text;message text;denied text;object_name text;
begin
 begin
  acknowledgement:=public.eps_submit_specs('86936940-b48d-497d-b1ff-8e0da0913afa'::uuid,
   jsonb_build_object('source_text',convert_from(decode('__BRIEF_B64__','base64'),'UTF8'),'row_version',1::bigint),
   'm07-specs-rollback-86936940-v1'::text);
  -- Variable values survive this handler; all database changes in the inner
  -- block are rolled back before an acknowledgement can leave the function.
  raise exception using errcode='P7001',message='DIAGNOSTIC_SUBTRANSACTION_ROLLBACK';
 exception when sqlstate 'P7001' then
  if acknowledgement is null then raise;end if;
  return jsonb_build_object('kind','ack','subtransaction_rolled_back',true,'ack',acknowledgement);
 when others then
  get stacked diagnostics state=returned_sqlstate,message=message_text;
  denied:=case when message ilike '%permission denied%'then'permission_denied'else null end;
  object_name:=substring(lower(message)from'permission denied for (?:schema|table|function) "?([a-z_]+)');
  if object_name is not null and object_name not in('eps','public','auth','workspaces','projects','project_memberships','app_capability_grants','specs','specs_source_inputs','jobs','outbox_events','idempotency_records','audit_events','has_capability','project_scope','specs_scope','m02_enqueue_specs_job','jobs_dto','uid','jwt')then object_name:=null;end if;
  return jsonb_build_object('kind','sql_error','subtransaction_rolled_back',true,'sqlstate',state,
   'permission_denied',denied is not null,'permission_object',object_name);
 end;
end $repro$;
-- Use existing default EXECUTE only; never add a diagnostic grant.
do $acl$begin
 if not has_function_privilege('authenticated','pg_temp.eps_m07_specs_submit_repro()','EXECUTE')then
  raise exception using errcode='P7002',message='DIAGNOSTIC_TEMP_FUNCTION_ACCESS_DENIED';
 end if;
end $acl$;
set local "request.jwt.claim.sub"='0a79a703-caba-47e5-93d4-42e32197037a';
set local "request.jwt.claims"='{"sub":"0a79a703-caba-47e5-93d4-42e32197037a","role":"authenticated","is_anonymous":false}';
set local role authenticated;
select pg_temp.eps_m07_specs_submit_repro()as specs_submit_repro;
rollback;
