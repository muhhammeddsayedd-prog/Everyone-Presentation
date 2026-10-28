-- Forward fix: a cached response must not outlive current acting-user scope
-- while waiting on the idempotency advisory lock. Keep the original five files.
-- VOLATILE's separate post-lock commands take a fresh READ COMMITTED snapshot:
-- https://www.postgresql.org/docs/17/xfunc-volatility.html
-- No new API, role, grant, table or SECURITY DEFINER boundary is introduced.
set local lock_timeout = '5s';
create or replace function eps.idempotency_begin(p_operation text,p_key text,p_input jsonb)
returns jsonb language plpgsql volatile security invoker set search_path = '' as $$
declare old eps.idempotency_records; current_client uuid;
begin
  if p_key is null then return null; end if;
  if length(p_key)<1 or length(p_key)>200 then perform eps.fail('INVALID_REQUEST','A bounded Idempotency-Key is required.',400); end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':'||p_operation||':'||p_key,0));

  -- These are normalized payloads built by the curated M01 callers, never a
  -- caller-supplied actor. Check permissions before reading any cached response.
  -- Preserve replay ahead of row-version/open-state checks for valid retries.
  case p_operation
    when 'update_project' then
      perform eps.require_capability('projects.write');
      select project.client_id into current_client from public.projects project
        where project.id=(p_input->>'id')::uuid and project.archived_at is null and eps.project_access(project.id,true);
      if not found then perform eps.fail('RESOURCE_NOT_FOUND','Editable project not found.',404); end if;
      if ((p_input->'input')?'client_name' or (p_input->'input')?'client_logo_asset_id')
        and (current_client is null or not eps.client_access(current_client,true)) then
        perform eps.fail('CAPABILITY_REQUIRED','Canonical client write permission is required.',403);
      end if;
    when 'create_workspace' then
      perform eps.require_capability('projects.read'); perform eps.require_capability('workspaces.write');
      if not exists(select 1 from public.projects project where project.id=(p_input->>'project_id')::uuid
        and project.archived_at is null and eps.project_scope(project.id,true)) then
        perform eps.fail('RESOURCE_NOT_FOUND','Writable canonical project not found.',404);
      end if;
    when 'update_workspace' then
      perform eps.require_capability('workspaces.write');
      if not eps.logo_scope((p_input->>'id')::uuid,true) then perform eps.fail('RESOURCE_NOT_FOUND','Writable workspace not found.',404); end if;
    when 'create_upload_session' then
      perform eps.require_capability('workspaces.write');
      if not eps.logo_scope((p_input->>'workspace_id')::uuid,true) then perform eps.fail('RESOURCE_NOT_FOUND','Writable workspace not found.',404); end if;
    when 'complete_upload' then
      perform eps.logo_require_upload((p_input->>'id')::uuid);
    when 'cancel_upload' then
      perform eps.logo_require_upload((p_input->>'id')::uuid);
    when 'create_audience_preset', 'update_audience_preset', 'archive_audience_preset' then
      perform eps.require_capability('settings.manage');
    else
      -- Later private operations (e.g. M02 jobs.*) retain their own post-wait
      -- resource checks; this helper does not grant access to any operation.
      null;
  end case;

  select * into old from eps.idempotency_records where principal_id=auth.uid() and operation=p_operation and key=p_key;
  if found then
    if old.request_hash<>encode(sha256(convert_to(p_input::text,'UTF8')),'hex') then perform eps.fail('IDEMPOTENCY_KEY_REUSED','This key was used with different input.',409); end if;
    if old.expires_at<now() then perform eps.fail('IDEMPOTENCY_WINDOW_EXPIRED','Use a new key after refreshing the current resource.',409); end if;
    return old.response;
  end if;
  return null;
end $$;
