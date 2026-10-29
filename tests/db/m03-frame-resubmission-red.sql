-- Reproduce18's terminal coalescing defect, inside a rolled-back fixture branch.
do $$declare original uuid:=current_setting('eps.frame.fixture.job')::uuid;response jsonb;begin
 execute 'set local role authenticated';
 response:=public.eps_cancel_job(original,'{"row_version":1}','synthetic-frame-resubmission-red-cancel');
 if response->>'status'<>'cancelled'then raise exception 'FRAME_RED_CANCEL_NOT_CONFIRMED';end if;
 response:=public.eps_extract_candidate_frames(current_setting('eps.frame.fixture.media')::uuid,
  jsonb_build_object('source_asset_id',current_setting('eps.frame.fixture.source'),'timestamps_ms','[1000,4500]'::jsonb),'synthetic-frame-resubmission-red-new');
 execute 'set local role postgres';
 if response->>'job_id'<>original::text or response->>'status'<>'cancelled'
  or(select count(*)from eps.jobs where kind='frame_extract'and requested_by=current_setting('eps.frame.fixture.principal')::uuid)<>1
 then raise exception 'FRAME_RED_TERMINAL_DEDUPE_NOT_REPRODUCED';end if;
end $$;
select 'M03_FRAME_TERMINAL_RESUBMISSION_RED_REPRODUCED';
