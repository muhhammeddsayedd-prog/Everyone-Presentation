-- LOCAL-ONLY synthetic bootstrap proof. No email delivery or real owner data.
-- Render each EPS_BOOTSTRAP_INCLUDE marker with its action template DO block,
-- replacing ONLY __EPS_BOOTSTRAP_REQUEST_HEX__ with this marker JSON's UTF8 hex.
-- Extract between EPS_BOOTSTRAP_ACTION_BEGIN/END; never include template COMMIT.
-- All nested action statements and fixtures run inside this one rollback.
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';
do $$ begin
  if current_database()<>'postgres' or current_user<>'postgres'
    or current_setting('eps.local_fixture_tests',true) is distinct from 'eps-presentation-canonical-pg17-local'
    or not exists(select 1 from eps_local_guard.instance where id=1)
  then raise exception 'LOCAL_FIXTURE_TARGET_REQUIRED'; end if;
  if exists(select 1 from auth.users where id='abababab-1111-4111-8111-111111111111' or lower(btrim(email))='producer-bootstrap@example.invalid')
    or exists(select 1 from public.clients where id in('abababab-3333-4333-8333-333333333333','cdcdcdcd-3333-4333-8333-333333333333','edededed-3333-4333-8333-333333333333'))
    or exists(select 1 from public.projects where id in('abababab-4444-4444-8444-444444444444','cdcdcdcd-4444-4444-8444-444444444444'))
  then raise exception 'BOOTSTRAP_FIXTURE_COLLISION_PRESERVE_EXISTING_DATA'; end if;
end $$;
create function pg_temp.assert_bootstrap(condition boolean,label text) returns void language plpgsql as $$ begin
  if condition is distinct from true then raise exception 'BOOTSTRAP_ASSERTION_FAILED: %',label; end if;
end $$;

do $bootstrap_test$ declare result jsonb; begin
  -- EPS_BOOTSTRAP_INCLUDE inspect {"schema_version":"1.0","request_id":"abababab-2222-4222-8222-222222222222","client_id":"abababab-3333-4333-8333-333333333333","project_id":"abababab-4444-4444-8444-444444444444","principal_id":null,"producer_email":"producer-bootstrap@example.invalid","client_name":"Synthetic Bootstrap Client","project_name":"Synthetic Bootstrap Project"}
  result:=current_setting('eps.bootstrap.result')::jsonb;
  perform pg_temp.assert_bootstrap(result->>'resource_state'='absent' and (result->>'principal_match_count')::int=0 and result->'principal_id'='null'::jsonb,'inspection invents neither user nor records');
  -- EPS_BOOTSTRAP_INCLUDE records {"schema_version":"1.0","request_id":"abababab-2222-4222-8222-222222222222","client_id":"abababab-3333-4333-8333-333333333333","project_id":"abababab-4444-4444-8444-444444444444","principal_id":null,"producer_email":"producer-bootstrap@example.invalid","client_name":"Synthetic Bootstrap Client","project_name":"Synthetic Bootstrap Project"}
  result:=current_setting('eps.bootstrap.result')::jsonb;
  perform pg_temp.assert_bootstrap(result->>'result'='created' and result->>'workspace_created'='false','owner-requested records can precede genuine account sign-in');
  perform pg_temp.assert_bootstrap(not exists(select 1 from auth.users where id='abababab-1111-4111-8111-111111111111'),'records action creates no Auth principal');
  perform pg_temp.assert_bootstrap(not exists(select 1 from eps.workspaces where project_id='abababab-4444-4444-8444-444444444444'),'records action creates no workspace');
  update public.clients set name='Edited Synthetic Client',row_version=row_version+1 where id='abababab-3333-4333-8333-333333333333';
  update public.projects set name='Edited Synthetic Project',row_version=row_version+1 where id='abababab-4444-4444-8444-444444444444';
  -- EPS_BOOTSTRAP_INCLUDE records {"schema_version":"1.0","request_id":"abababab-2222-4222-8222-222222222222","client_id":"abababab-3333-4333-8333-333333333333","project_id":"abababab-4444-4444-8444-444444444444","principal_id":null,"producer_email":"producer-bootstrap@example.invalid","client_name":"Synthetic Bootstrap Client","project_name":"Synthetic Bootstrap Project"}
  perform pg_temp.assert_bootstrap(current_setting('eps.bootstrap.result')::jsonb->>'result'='existing_pair','exact private-owned ID pair replays');
  perform pg_temp.assert_bootstrap(exists(select 1 from public.clients where id='abababab-3333-4333-8333-333333333333' and name='Edited Synthetic Client' and row_version=2)
    and exists(select 1 from public.projects where id='abababab-4444-4444-8444-444444444444' and name='Edited Synthetic Project' and row_version=2),'replay preserves normal label/version edits');
  begin
    -- EPS_BOOTSTRAP_INCLUDE records {"schema_version":"1.0","request_id":"abababab-5555-4555-8555-555555555555","client_id":"abababab-6666-4666-8666-666666666666","project_id":"abababab-7777-4777-8777-777777777777","principal_id":null,"producer_email":"producer-bootstrap@example.invalid","client_name":"Edited Synthetic Client","project_name":"Edited Synthetic Project"}
    raise exception 'BOOTSTRAP_EXPECTED_ERROR_NOT_RAISED';
  exception when raise_exception then if sqlerrm<>'BOOTSTRAP_NAME_COLLISION' then raise; end if;
  end;
  perform pg_temp.assert_bootstrap(not exists(select 1 from public.clients where id='abababab-6666-4666-8666-666666666666'),'same-name collision creates no duplicate/adoption');
  insert into public.clients(id,name) values('edededed-3333-4333-8333-333333333333','Synthetic Partial Client');
  begin
    -- EPS_BOOTSTRAP_INCLUDE records {"schema_version":"1.0","request_id":"abababab-2222-4222-8222-222222222222","client_id":"edededed-3333-4333-8333-333333333333","project_id":"edededed-4444-4444-8444-444444444444","principal_id":null,"producer_email":"producer-bootstrap@example.invalid","client_name":"Synthetic Partial Client","project_name":"Synthetic Bootstrap Project"}
    raise exception 'BOOTSTRAP_EXPECTED_ERROR_NOT_RAISED';
  exception when raise_exception then if sqlerrm<>'BOOTSTRAP_RESOURCE_COLLISION' then raise; end if;
  end;
  begin
    -- EPS_BOOTSTRAP_INCLUDE records {"schema_version":"1.0","request_id":"abababab-2222-4222-8222-222222222222","client_id":"edededed-3333-4333-8333-333333333333","project_id":"abababab-4444-4444-8444-444444444444","principal_id":null,"producer_email":"producer-bootstrap@example.invalid","client_name":"Synthetic Bootstrap Client","project_name":"Synthetic Bootstrap Project"}
    raise exception 'BOOTSTRAP_EXPECTED_ERROR_NOT_RAISED';
  exception when raise_exception then if sqlerrm<>'BOOTSTRAP_RESOURCE_COLLISION' then raise; end if;
  end;
  begin
    -- EPS_BOOTSTRAP_INCLUDE grants {"schema_version":"1.0","request_id":"abababab-2222-4222-8222-222222222222","client_id":"abababab-3333-4333-8333-333333333333","project_id":"abababab-4444-4444-8444-444444444444","principal_id":null,"producer_email":"producer-bootstrap@example.invalid","client_name":"Synthetic Bootstrap Client","project_name":"Synthetic Bootstrap Project"}
    raise exception 'BOOTSTRAP_EXPECTED_ERROR_NOT_RAISED';
  exception when raise_exception then if sqlerrm<>'BOOTSTRAP_PINNED_PRINCIPAL_REQUIRED' then raise; end if;
  end;
  begin
    -- EPS_BOOTSTRAP_INCLUDE grants {"schema_version":"1.0","request_id":"abababab-2222-4222-8222-222222222222","client_id":"abababab-3333-4333-8333-333333333333","project_id":"abababab-4444-4444-8444-444444444444","principal_id":"abababab-1111-4111-8111-111111111111","producer_email":"producer-bootstrap@example.invalid","client_name":"Synthetic Bootstrap Client","project_name":"Synthetic Bootstrap Project"}
    raise exception 'BOOTSTRAP_EXPECTED_ERROR_NOT_RAISED';
  exception when raise_exception then if sqlerrm<>'BOOTSTRAP_PRINCIPAL_MISMATCH' then raise; end if;
  end;
  insert into auth.users(id,email,is_anonymous,last_sign_in_at) values('abababab-1111-4111-8111-111111111111','producer-bootstrap@example.invalid',false,clock_timestamp());
  begin
    -- EPS_BOOTSTRAP_INCLUDE grants {"schema_version":"1.0","request_id":"abababab-2222-4222-8222-222222222222","client_id":"abababab-3333-4333-8333-333333333333","project_id":"abababab-4444-4444-8444-444444444444","principal_id":"abababab-1111-4111-8111-111111111111","producer_email":"producer-bootstrap@example.invalid","client_name":"Synthetic Bootstrap Client","project_name":"Synthetic Bootstrap Project"}
    raise exception 'BOOTSTRAP_EXPECTED_ERROR_NOT_RAISED';
  exception when raise_exception then if sqlerrm<>'BOOTSTRAP_PRINCIPAL_NOT_READY' then raise; end if;
  end;
  update auth.users set email_confirmed_at=clock_timestamp(),last_sign_in_at=null where id='abababab-1111-4111-8111-111111111111';
  begin
    -- EPS_BOOTSTRAP_INCLUDE grants {"schema_version":"1.0","request_id":"abababab-2222-4222-8222-222222222222","client_id":"abababab-3333-4333-8333-333333333333","project_id":"abababab-4444-4444-8444-444444444444","principal_id":"abababab-1111-4111-8111-111111111111","producer_email":"producer-bootstrap@example.invalid","client_name":"Synthetic Bootstrap Client","project_name":"Synthetic Bootstrap Project"}
    raise exception 'BOOTSTRAP_EXPECTED_ERROR_NOT_RAISED';
  exception when raise_exception then if sqlerrm<>'BOOTSTRAP_PRINCIPAL_NOT_READY' then raise; end if;
  end;
  update auth.users set last_sign_in_at=clock_timestamp() where id='abababab-1111-4111-8111-111111111111';
  begin
    -- EPS_BOOTSTRAP_INCLUDE grants {"schema_version":"1.0","request_id":"abababab-2222-4222-8222-222222222222","client_id":"abababab-3333-4333-8333-333333333333","project_id":"abababab-4444-4444-8444-444444444444","principal_id":"cdcdcdcd-1111-4111-8111-111111111111","producer_email":"producer-bootstrap@example.invalid","client_name":"Synthetic Bootstrap Client","project_name":"Synthetic Bootstrap Project"}
    raise exception 'BOOTSTRAP_EXPECTED_ERROR_NOT_RAISED';
  exception when raise_exception then if sqlerrm<>'BOOTSTRAP_PRINCIPAL_MISMATCH' then raise; end if;
  end;
  update auth.users set is_anonymous=true where id='abababab-1111-4111-8111-111111111111';
  begin
    -- EPS_BOOTSTRAP_INCLUDE grants {"schema_version":"1.0","request_id":"abababab-2222-4222-8222-222222222222","client_id":"abababab-3333-4333-8333-333333333333","project_id":"abababab-4444-4444-8444-444444444444","principal_id":"abababab-1111-4111-8111-111111111111","producer_email":"producer-bootstrap@example.invalid","client_name":"Synthetic Bootstrap Client","project_name":"Synthetic Bootstrap Project"}
    raise exception 'BOOTSTRAP_EXPECTED_ERROR_NOT_RAISED';
  exception when raise_exception then if sqlerrm<>'BOOTSTRAP_PRINCIPAL_NOT_READY' then raise; end if;
  end;
  update auth.users set is_anonymous=false,deleted_at=clock_timestamp() where id='abababab-1111-4111-8111-111111111111';
  begin
    -- EPS_BOOTSTRAP_INCLUDE grants {"schema_version":"1.0","request_id":"abababab-2222-4222-8222-222222222222","client_id":"abababab-3333-4333-8333-333333333333","project_id":"abababab-4444-4444-8444-444444444444","principal_id":"abababab-1111-4111-8111-111111111111","producer_email":"producer-bootstrap@example.invalid","client_name":"Synthetic Bootstrap Client","project_name":"Synthetic Bootstrap Project"}
    raise exception 'BOOTSTRAP_EXPECTED_ERROR_NOT_RAISED';
  exception when raise_exception then if sqlerrm<>'BOOTSTRAP_PRINCIPAL_NOT_READY' then raise; end if;
  end;
  update auth.users set deleted_at=null,banned_until=clock_timestamp()+interval '1 day' where id='abababab-1111-4111-8111-111111111111';
  begin
    -- EPS_BOOTSTRAP_INCLUDE grants {"schema_version":"1.0","request_id":"abababab-2222-4222-8222-222222222222","client_id":"abababab-3333-4333-8333-333333333333","project_id":"abababab-4444-4444-8444-444444444444","principal_id":"abababab-1111-4111-8111-111111111111","producer_email":"producer-bootstrap@example.invalid","client_name":"Synthetic Bootstrap Client","project_name":"Synthetic Bootstrap Project"}
    raise exception 'BOOTSTRAP_EXPECTED_ERROR_NOT_RAISED';
  exception when raise_exception then if sqlerrm<>'BOOTSTRAP_PRINCIPAL_NOT_READY' then raise; end if;
  end;
  update auth.users set banned_until=null where id='abababab-1111-4111-8111-111111111111';
  insert into public.project_memberships(project_id,principal_id,can_write) values('abababab-4444-4444-8444-444444444444','abababab-1111-4111-8111-111111111111',false);
  begin
    -- EPS_BOOTSTRAP_INCLUDE grants {"schema_version":"1.0","request_id":"abababab-2222-4222-8222-222222222222","client_id":"abababab-3333-4333-8333-333333333333","project_id":"abababab-4444-4444-8444-444444444444","principal_id":"abababab-1111-4111-8111-111111111111","producer_email":"producer-bootstrap@example.invalid","client_name":"Synthetic Bootstrap Client","project_name":"Synthetic Bootstrap Project"}
    raise exception 'BOOTSTRAP_EXPECTED_ERROR_NOT_RAISED';
  exception when raise_exception then if sqlerrm<>'BOOTSTRAP_READONLY_MEMBERSHIP' then raise; end if;
  end;
  perform pg_temp.assert_bootstrap(not exists(select 1 from public.app_capability_grants where principal_id='abababab-1111-4111-8111-111111111111')
    and exists(select 1 from public.project_memberships where project_id='abababab-4444-4444-8444-444444444444' and principal_id='abababab-1111-4111-8111-111111111111' and not can_write),'readonly project membership is never escalated');
  delete from public.project_memberships where project_id='abababab-4444-4444-8444-444444444444' and principal_id='abababab-1111-4111-8111-111111111111';
  insert into public.client_memberships(client_id,principal_id,can_write) values('abababab-3333-4333-8333-333333333333','abababab-1111-4111-8111-111111111111',false);
  begin
    -- EPS_BOOTSTRAP_INCLUDE grants {"schema_version":"1.0","request_id":"abababab-2222-4222-8222-222222222222","client_id":"abababab-3333-4333-8333-333333333333","project_id":"abababab-4444-4444-8444-444444444444","principal_id":"abababab-1111-4111-8111-111111111111","producer_email":"producer-bootstrap@example.invalid","client_name":"Synthetic Bootstrap Client","project_name":"Synthetic Bootstrap Project"}
    raise exception 'BOOTSTRAP_EXPECTED_ERROR_NOT_RAISED';
  exception when raise_exception then if sqlerrm<>'BOOTSTRAP_READONLY_MEMBERSHIP' then raise; end if;
  end;
  perform pg_temp.assert_bootstrap(exists(select 1 from public.client_memberships where client_id='abababab-3333-4333-8333-333333333333' and principal_id='abababab-1111-4111-8111-111111111111' and not can_write),'readonly client membership is never escalated');
  delete from public.client_memberships where client_id='abababab-3333-4333-8333-333333333333' and principal_id='abababab-1111-4111-8111-111111111111';
  insert into public.app_capability_grants(principal_id,capability,active) values('abababab-1111-4111-8111-111111111111','projects.write',false);
  begin
    -- EPS_BOOTSTRAP_INCLUDE grants {"schema_version":"1.0","request_id":"abababab-2222-4222-8222-222222222222","client_id":"abababab-3333-4333-8333-333333333333","project_id":"abababab-4444-4444-8444-444444444444","principal_id":"abababab-1111-4111-8111-111111111111","producer_email":"producer-bootstrap@example.invalid","client_name":"Synthetic Bootstrap Client","project_name":"Synthetic Bootstrap Project"}
    raise exception 'BOOTSTRAP_EXPECTED_ERROR_NOT_RAISED';
  exception when raise_exception then if sqlerrm<>'BOOTSTRAP_REVOKED_GRANT' then raise; end if;
  end;
  perform pg_temp.assert_bootstrap(exists(select 1 from public.app_capability_grants where principal_id='abababab-1111-4111-8111-111111111111' and capability='projects.write' and not active),'inactive capability remains inactive');
  delete from public.app_capability_grants where principal_id='abababab-1111-4111-8111-111111111111' and capability='projects.write';

  -- Preexisting unrelated authority is preserved, not stripped or escalated.
  insert into public.clients(id,name) values('cdcdcdcd-3333-4333-8333-333333333333','Synthetic Unrelated Client');
  insert into public.projects(id,client_id,name) values('cdcdcdcd-4444-4444-8444-444444444444','cdcdcdcd-3333-4333-8333-333333333333','Synthetic Unrelated Project');
  insert into public.project_memberships(project_id,principal_id,can_write) values('cdcdcdcd-4444-4444-8444-444444444444','abababab-1111-4111-8111-111111111111',false);
  insert into public.client_memberships(client_id,principal_id,can_write) values('cdcdcdcd-3333-4333-8333-333333333333','abababab-1111-4111-8111-111111111111',false);
  insert into public.app_capability_grants(principal_id,capability) values('abababab-1111-4111-8111-111111111111','cast.read');
  -- EPS_BOOTSTRAP_INCLUDE inspect {"schema_version":"1.0","request_id":"abababab-2222-4222-8222-222222222222","client_id":"abababab-3333-4333-8333-333333333333","project_id":"abababab-4444-4444-8444-444444444444","principal_id":"abababab-1111-4111-8111-111111111111","producer_email":"producer-bootstrap@example.invalid","client_name":"Synthetic Bootstrap Client","project_name":"Synthetic Bootstrap Project"}
  result:=current_setting('eps.bootstrap.result')::jsonb;
  perform pg_temp.assert_bootstrap(result->>'principal_id'='abababab-1111-4111-8111-111111111111' and result->>'principal_confirmed'='true' and result->>'signed_in'='true' and result->>'pinned_principal_matches'='true','inspection pins the one genuine confirmed signed-in principal');
  -- EPS_BOOTSTRAP_INCLUDE grants {"schema_version":"1.0","request_id":"abababab-2222-4222-8222-222222222222","client_id":"abababab-3333-4333-8333-333333333333","project_id":"abababab-4444-4444-8444-444444444444","principal_id":"abababab-1111-4111-8111-111111111111","producer_email":"producer-bootstrap@example.invalid","client_name":"Synthetic Bootstrap Client","project_name":"Synthetic Bootstrap Project"}
  result:=current_setting('eps.bootstrap.result')::jsonb;
  perform pg_temp.assert_bootstrap(result->>'result'='granted' and result->'capabilities'='["projects.read","projects.write","workspaces.read","workspaces.write"]'::jsonb,'exact four initial M01 capabilities');
  perform pg_temp.assert_bootstrap((select count(*)=5 from public.app_capability_grants where principal_id='abababab-1111-4111-8111-111111111111')
    and exists(select 1 from public.app_capability_grants where principal_id='abababab-1111-4111-8111-111111111111' and capability='cast.read' and active)
    and not exists(select 1 from public.app_capability_grants where principal_id='abababab-1111-4111-8111-111111111111' and capability='settings.manage'),'unrelated active grant retained and no settings authority invented');
  perform pg_temp.assert_bootstrap(exists(select 1 from public.project_memberships where project_id='abababab-4444-4444-8444-444444444444' and principal_id='abababab-1111-4111-8111-111111111111' and can_write and active)
    and exists(select 1 from public.client_memberships where client_id='abababab-3333-4333-8333-333333333333' and principal_id='abababab-1111-4111-8111-111111111111' and can_write and active),'only requested project/client get write membership');
  perform pg_temp.assert_bootstrap(exists(select 1 from public.project_memberships where project_id='cdcdcdcd-4444-4444-8444-444444444444' and principal_id='abababab-1111-4111-8111-111111111111' and not can_write and active)
    and exists(select 1 from public.client_memberships where client_id='cdcdcdcd-3333-4333-8333-333333333333' and principal_id='abababab-1111-4111-8111-111111111111' and not can_write and active),'unrelated readonly memberships unchanged');
  -- EPS_BOOTSTRAP_INCLUDE grants {"schema_version":"1.0","request_id":"abababab-2222-4222-8222-222222222222","client_id":"abababab-3333-4333-8333-333333333333","project_id":"abababab-4444-4444-8444-444444444444","principal_id":"abababab-1111-4111-8111-111111111111","producer_email":"producer-bootstrap@example.invalid","client_name":"Synthetic Bootstrap Client","project_name":"Synthetic Bootstrap Project"}
  perform pg_temp.assert_bootstrap(current_setting('eps.bootstrap.result')::jsonb->>'result'='already_granted'
    and (select count(*)=5 from public.app_capability_grants where principal_id='abababab-1111-4111-8111-111111111111'),'grant replay has no extra effects');
  update public.project_memberships set active=false where project_id='abababab-4444-4444-8444-444444444444' and principal_id='abababab-1111-4111-8111-111111111111';
  begin
    -- EPS_BOOTSTRAP_INCLUDE grants {"schema_version":"1.0","request_id":"abababab-2222-4222-8222-222222222222","client_id":"abababab-3333-4333-8333-333333333333","project_id":"abababab-4444-4444-8444-444444444444","principal_id":"abababab-1111-4111-8111-111111111111","producer_email":"producer-bootstrap@example.invalid","client_name":"Synthetic Bootstrap Client","project_name":"Synthetic Bootstrap Project"}
    raise exception 'BOOTSTRAP_EXPECTED_ERROR_NOT_RAISED';
  exception when raise_exception then if sqlerrm<>'BOOTSTRAP_REVOKED_GRANT' then raise; end if;
  end;
  perform pg_temp.assert_bootstrap(exists(select 1 from public.project_memberships where project_id='abababab-4444-4444-8444-444444444444' and principal_id='abababab-1111-4111-8111-111111111111' and not active),'replay never reactivates revoked project access');
  update public.project_memberships set active=true where project_id='abababab-4444-4444-8444-444444444444' and principal_id='abababab-1111-4111-8111-111111111111';
  update public.client_memberships set active=false where client_id='abababab-3333-4333-8333-333333333333' and principal_id='abababab-1111-4111-8111-111111111111';
  begin
    -- EPS_BOOTSTRAP_INCLUDE grants {"schema_version":"1.0","request_id":"abababab-2222-4222-8222-222222222222","client_id":"abababab-3333-4333-8333-333333333333","project_id":"abababab-4444-4444-8444-444444444444","principal_id":"abababab-1111-4111-8111-111111111111","producer_email":"producer-bootstrap@example.invalid","client_name":"Synthetic Bootstrap Client","project_name":"Synthetic Bootstrap Project"}
    raise exception 'BOOTSTRAP_EXPECTED_ERROR_NOT_RAISED';
  exception when raise_exception then if sqlerrm<>'BOOTSTRAP_REVOKED_GRANT' then raise; end if;
  end;
  perform pg_temp.assert_bootstrap(exists(select 1 from public.client_memberships where client_id='abababab-3333-4333-8333-333333333333' and principal_id='abababab-1111-4111-8111-111111111111' and not active),'replay never reactivates revoked client access');
  update public.client_memberships set active=true where client_id='abababab-3333-4333-8333-333333333333' and principal_id='abababab-1111-4111-8111-111111111111';
  update public.app_capability_grants set active=false where principal_id='abababab-1111-4111-8111-111111111111' and capability='workspaces.write';
  begin
    -- EPS_BOOTSTRAP_INCLUDE grants {"schema_version":"1.0","request_id":"abababab-2222-4222-8222-222222222222","client_id":"abababab-3333-4333-8333-333333333333","project_id":"abababab-4444-4444-8444-444444444444","principal_id":"abababab-1111-4111-8111-111111111111","producer_email":"producer-bootstrap@example.invalid","client_name":"Synthetic Bootstrap Client","project_name":"Synthetic Bootstrap Project"}
    raise exception 'BOOTSTRAP_EXPECTED_ERROR_NOT_RAISED';
  exception when raise_exception then if sqlerrm<>'BOOTSTRAP_REVOKED_GRANT' then raise; end if;
  end;
  perform pg_temp.assert_bootstrap(exists(select 1 from public.app_capability_grants where principal_id='abababab-1111-4111-8111-111111111111' and capability='workspaces.write' and not active),'replay never reactivates revoked capability');
  perform pg_temp.assert_bootstrap(not exists(select 1 from eps.workspaces where project_id='abababab-4444-4444-8444-444444444444')
    and not exists(select 1 from eps.audit_events where principal_id='abababab-1111-4111-8111-111111111111'),'bootstrap creates no workspace or fabricated Producer actor event');
end $bootstrap_test$;

-- Even a normal authenticated user cannot invoke this administrative template.
set local role authenticated;
do $bootstrap_denied$ begin
  begin
    -- EPS_BOOTSTRAP_INCLUDE records {"schema_version":"1.0","request_id":"abababab-2222-4222-8222-222222222222","client_id":"abababab-3333-4333-8333-333333333333","project_id":"abababab-4444-4444-8444-444444444444","principal_id":null,"producer_email":"producer-bootstrap@example.invalid","client_name":"Synthetic Bootstrap Client","project_name":"Synthetic Bootstrap Project"}
    raise exception 'BOOTSTRAP_EXPECTED_ERROR_NOT_RAISED';
  exception when raise_exception then if sqlerrm<>'BOOTSTRAP_TARGET_OR_ROLE_INVALID' then raise; end if;
  end;
end $bootstrap_denied$;
reset role;
select 'Synthetic bootstrap records/grants/replay/revocation/role assertions passed; all fixtures roll back; no enrollment email or real owner payload used.' as result;
rollback;
