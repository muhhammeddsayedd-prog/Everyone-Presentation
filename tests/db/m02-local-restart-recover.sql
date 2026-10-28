-- Exact bounded token hex placeholder supplied only from the private memory claim.
begin;
do $$ declare token text:=convert_from(decode('__EPS_M02_TOKEN_HEX__','hex'),'UTF8'); begin
 if current_setting('eps.local_fixture_tests',true) is distinct from 'eps-presentation-canonical-pg17-local'
   or not exists(select 1 from eps_local_guard.m02_fixture where id=1 and marker='EPS M02 LOCAL DURABILITY V1')
   or length(token)<>43 or token!~'^[A-Za-z0-9_-]{43}$'
   or (select count(*) from eps.jobs)<>3 or (select count(*) from eps.outbox_events where status='delivered')<>2
   or (select count(*) from eps.outbox_events where status='leased' and attempt_count=1 and lease_token_digest=encode(sha256(convert_to(token,'UTF8')),'hex'))<>1
 then raise exception 'M02_COMMITTED_RESTART_LEASE_NOT_PRESERVED'; end if;
 perform set_config('eps.m02.old_token',token,true);
 perform set_config('eps.m02.event',(select id::text from eps.outbox_events where status='leased'),true);
end $$;
set local role eps_jobs_dispatcher;
do $$ begin if eps.claim_job_outbox(1) is distinct from '{"leases":[]}'::jsonb then raise exception 'M02_UNEXPIRED_LEASE_RECLAIMED'; end if; end $$;
reset role;
-- Controlled synthetic expiry avoids waiting90s. This is not clock-skew evidence.
update eps.outbox_events set lease_expires_at=clock_timestamp()-interval '1 second' where id=current_setting('eps.m02.event')::uuid;
set local role eps_jobs_dispatcher;
do $$ declare new_lease jsonb; begin
 new_lease:=eps.claim_job_outbox(1)->'leases'->0;
 if new_lease is null or new_lease->>'id'<>current_setting('eps.m02.event') or new_lease->>'lease_token'=current_setting('eps.m02.old_token') then raise exception 'M02_FRESH_RECLAIM_FENCE_REQUIRED'; end if;
 begin perform eps.finish_job_outbox(current_setting('eps.m02.event')::uuid,current_setting('eps.m02.old_token'),true);
 exception when others then if sqlerrm='INVALID_TRANSITION' then perform set_config('eps.m02.old_rejected','true',true); else raise; end if; end;
 if current_setting('eps.m02.old_rejected',true) is distinct from 'true' then raise exception 'M02_OLD_ACK_NOT_FENCED'; end if;
 if eps.finish_job_outbox((new_lease->>'id')::uuid,new_lease->>'lease_token',true) is distinct from '{"acknowledged":true,"stale":false}'::jsonb then raise exception 'M02_RECOVERED_ACK_FAILED'; end if;
end $$;
reset role;
select jsonb_build_object('phase','recovered','session_pid',pg_backend_pid(),'committed_lease_survived',true,'expired_reclaimed',true,'old_ack_rejected',true,'raw_token_persisted_in_app',false);
commit;
