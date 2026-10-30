-- An ordinary project reader must never receive a guest PDF bearer URL.
set local role postgres;
select set_config('eps.m06.access.bucket',a.bucket,true),set_config('eps.m06.access.key',a.object_key,true)from eps.presentation_exports e join eps.media_assets a on a.id=e.pdf_asset_id where e.id=current_setting('eps.m06.worker.export')::uuid;
select set_config('request.jwt.claim.sub',current_setting('eps.casting.fixture.actor2'),true),set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('eps.casting.fixture.actor2'),'role','authenticated')::text,true);
set local role authenticated;
do $$begin
 begin perform public.eps_get_pdf_export(current_setting('eps.m06.worker.export')::uuid);raise exception'M06_READER_WITHOUT_LINK_CAPABILITY_READ_EXPORT';exception when raise_exception then if sqlerrm<>'CAPABILITY_REQUIRED'then raise;end if;end;
 begin perform public.eps_get_pdf_export_asset(current_setting('eps.m06.worker.export')::uuid);raise exception'M06_READER_WITHOUT_LINK_CAPABILITY_READ_PDF';exception when raise_exception then if sqlerrm<>'CAPABILITY_REQUIRED'then raise;end if;end;
 if eps.export_storage_read_allowed(current_setting('eps.m06.access.bucket'),current_setting('eps.m06.access.key'))then raise exception'M06_READER_WITHOUT_LINK_CAPABILITY_STORAGE_READ';end if;
end$$;
select'M06_LINK_MANAGEMENT_CAPABILITY_REQUIRED_FOR_INTERNAL_EXPORT_AND_STORAGE_PASSED';
set local role postgres;
update eps.review_link_replays set expires_at=clock_timestamp()-interval'1second'where operation='create'and key='m06-create-link-A';
set local role eps_jobs_executor;
select eps.recover_job_stages(1);
set local role postgres;
do $$begin if exists(select 1 from eps.review_link_replays where key='m06-create-link-A'and response_encrypted is not null)then raise exception'M06_WORKER_POLL_EXPIRED_CIPHERTEXT_RETAINED';end if;end$$;
set local role anon;
do $$declare access jsonb;result jsonb;request jsonb;begin
 access:=pg_temp.m06_call('open',jsonb_build_object('token_digest',repeat('f',64),'session_digest',repeat('4',64)));
 perform pg_temp.m06_call('identify',jsonb_build_object('session_digest',repeat('4',64),'display_name','Synthetic Unicode reviewer'));
 request:=jsonb_build_object('session_digest',repeat('4',64),'version_id',current_setting('eps.m05.selection_v3.version'),'input',jsonb_build_object('version_slide_id',current_setting('eps.m06.slide1'),'body',repeat(chr(128578),10000)),'idempotency_key','m06-unicode-max-valid');
 result:=pg_temp.m06_call('create_comment',request);if length(result->>'body')<>10000 then raise exception'M06_UNICODE_CODEPOINT_LIMIT_INCORRECT';end if;
 begin perform pg_temp.m06_call('create_comment',request||jsonb_build_object('input',(request->'input')||jsonb_build_object('body',repeat(chr(128578),10001)),'idempotency_key','m06-unicode-over-limit'));raise exception'M06_UNICODE_OVER_LIMIT_ACCEPTED';exception when raise_exception then if sqlerrm<>'VALIDATION_FAILED'then raise;end if;end;
end$$;
select'M06_WORKER_POLL_CIPHERTEXT_PURGE_AND_10000_UNICODE_CODEPOINT_BOUNDARY_PASSED';
