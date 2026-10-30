-- Rollback-only synthetic SQL protocol proof. Injected artifact metadata does
-- not claim native files, Storage HTTP, a real browser or provider execution.
set local role postgres;
insert into public.app_capability_grants(principal_id,capability)values(current_setting('eps.casting.fixture.actor')::uuid,'review_links.manage')on conflict do nothing;
select set_config('eps.m06.worker.canonical_before',(select eps.presentation_hash(to_jsonb(v))from eps.presentation_versions v where id=current_setting('eps.m05.selection.version')::uuid),true);
set local role authenticated;
do $$declare link jsonb;prepared jsonb;begin
 link:=public.eps_create_review_link(current_setting('eps.m05.selection')::uuid,'{"label":"Synthetic export worker"}','{"token_digest":"ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff","response_encrypted":"synthetic-worker-encrypted"}','m06-worker-create-link');perform set_config('eps.m06.worker.link',link#>>'{link,id}',true);
 prepared:=public.eps_prepare_pdf_export(jsonb_build_object('review_link_id',link#>'{link,id}','version_id',current_setting('eps.m05.selection.version')),'m06-worker-prepare');
 if prepared<>public.eps_prepare_pdf_export(jsonb_build_object('review_link_id',link#>'{link,id}','version_id',current_setting('eps.m05.selection.version')),'m06-worker-prepare')then raise exception'M06_WORKER_PREPARE_REPLAY_FAILED';end if;
 perform set_config('eps.m06.worker.export',prepared#>>'{export,id}',true);perform set_config('eps.m06.worker.job',prepared->>'job_id',true);
end$$;
set local role postgres;
select set_config('eps.m06.worker.hash',(select input_hash from eps.jobs where id=current_setting('eps.m06.worker.job')::uuid),true);
select set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claims','{}',true);
set local role eps_jobs_executor;
do $$declare job uuid:=current_setting('eps.m06.worker.job')::uuid;hash text:=current_setting('eps.m06.worker.hash');lease jsonb;source jsonb;grant_one jsonb;grant_two jsonb;asset jsonb;complete jsonb;result jsonb;event jsonb;receipt jsonb;candidate_count integer;pending_count integer;frames integer;logos integer;videos integer;begin
 lease:=eps.claim_job_stage_replay(jsonb_build_object('job_id',job,'stage','render_export','input_hash',hash),'m06-worker-claim','synthetic-key',repeat('a',64));
 if lease<>eps.claim_job_stage_replay(jsonb_build_object('job_id',job,'stage','render_export','input_hash',hash),'m06-worker-claim','synthetic-key',repeat('a',64))then raise exception'M06_EXPORT_LEASE_REPLAY_FAILED';end if;
 source:=eps.get_specs_stage_input(job,(lease->>'attempt_id')::uuid,lease->>'lease_token');
 if(select count(*)from jsonb_object_keys(source))<>17 or source->>'export_id'<>current_setting('eps.m06.worker.export')or source#>>'{snapshot,slides,1,fields,height_measurements}'<>'178 cm'then raise exception'M06_EXPORT_FIXED_INPUT_FAILED';end if;
 grant_one:=eps.mint_review_media_grant(jsonb_build_object('job_id',job,'attempt_id',lease->'attempt_id','lease_token',lease->'lease_token'));
 grant_two:=eps.mint_review_media_grant(jsonb_build_object('job_id',job,'attempt_id',lease->'attempt_id','lease_token',lease->'lease_token'));
 if grant_one->>'grant_id'=grant_two->>'grant_id'or grant_one->>'grant_token'=grant_two->>'grant_token'or grant_two->>'version_id'<>source->>'version_id'then raise exception'M06_EXPORT_GRANT_MINT_SCOPE_FAILED';end if;
 perform set_config('eps.m06.worker.old_grant',grant_one->>'grant_id',true);perform set_config('eps.m06.worker.grant',grant_two->>'grant_id',true);perform set_config('eps.m06.worker.raw_grant',grant_two->>'grant_token',true);
 begin perform eps.mint_review_media_grant(jsonb_build_object('job_id',job,'attempt_id',lease->'attempt_id','lease_token',lease->'lease_token','version_id',source->'version_id'));raise exception'M06_MINT_ARBITRARY_SCOPE_ACCEPTED';exception when raise_exception then if sqlerrm<>'INVALID_REQUEST'then raise;end if;end;
 execute'set local role eps_specs_assets_executor';
 asset:=eps.reserve_job_output(jsonb_build_object('job_id',job,'attempt_id',lease->'attempt_id','lease_token',lease->'lease_token','output_key','presentation_pdf','asset_kind','presentation_pdf','filename','presentation.pdf','mime_type','application/pdf','expected_size_bytes',100,'parent_asset_id',null,'time_offset_ms',null));
 if eps.get_job_asset_access(jsonb_build_object('job_id',job,'attempt_id',lease->'attempt_id','lease_token',lease->'lease_token','asset_id',asset#>'{asset,id}','access','write'))->>'bucket'<>'eps-presentation-outputs'then raise exception'M06_EXPORT_PRIVATE_OUTPUT_GRANT_FAILED';end if;
 complete:=eps.complete_job_output(jsonb_build_object('job_id',job,'attempt_id',lease->'attempt_id','lease_token',lease->'lease_token','asset_id',asset#>'{asset,id}','sha256',repeat('c',64),'actual_size_bytes',100,'width',null,'height',null,'duration_ms',null));
 execute'set local role eps_jobs_executor';
 select count(*)filter(where s->>'kind'='candidate'),count(*)filter(where s->>'kind'='pending'),coalesce(sum(jsonb_array_length(s->'frames')),0),count(*)filter(where s->>'logo_asset_id'is not null),count(*)filter(where s->>'video_asset_id'is not null)into candidate_count,pending_count,frames,logos,videos from jsonb_array_elements(source#>'{snapshot,slides}')s;
 result:=jsonb_build_object('schema_version','1.0','version_id',source->'version_id','export_id',source->'export_id','review_link_id',source->'review_link_id','export_revision',source->'export_revision','grant_id',grant_two->'grant_id','snapshot_sha256',source->'snapshot_sha256','manifest_sha256',source->'manifest_sha256','inventory_sha256',source->'inventory_sha256',
 'pdf_asset',jsonb_build_object('asset_id',complete->'id','sha256',complete->'sha256','size_bytes',complete->'size_bytes','mime_type',complete->'mime_type'),
 'render_proof',jsonb_build_object('renderer_version',source#>'{configuration,renderer_version}','chromium_version','148.0.0.0','template_content_sha256',source#>'{snapshot,template,content_sha256}','font_hashes',source#>'{snapshot,template,font_hashes}','page_count',jsonb_array_length(source#>'{snapshot,slides}'),'width_css_px',1600,'height_css_px',900,'overflow_count',0,'candidate_field_count',candidate_count*10,'frame_draw_count',frames,'logo_draw_count',logos,'video_link_count',videos,'fonts_ready',true,'images_ready',true,'rendered_at','2026-10-29T20:00:00.000000Z','link_targets_sha256',repeat('e',64)),
 'validation_proof',jsonb_build_object('pdf_sha256',complete->'sha256','page_count',jsonb_array_length(source#>'{snapshot,slides}'),'width_points',1200,'height_points',675,'text_regions_checked',3+candidate_count*23+pending_count*27,'image_draws_checked',frames+logos,'video_links_checked',videos,'embedded_font_count',2,'validated_at','2026-10-29T20:00:00.000000Z'));
 event:=jsonb_build_object('job_id',job,'attempt_id',lease->'attempt_id','lease_token',lease->'lease_token','stage','render_export','input_hash',hash,'event_id','m06-worker-success','sequence',1,'event_type','succeeded','result_schema','presentation-export-result.v1','result',result);
 receipt:=eps.record_job_event(event);if receipt->'applied'<>'true'or receipt->>'job_status'<>'succeeded'or eps.record_job_event(event)->'duplicate'<>'true'then raise exception'M06_EXPORT_READY_OR_EVENT_REPLAY_FAILED';end if;
end$$;
set local role postgres;
do $$declare item eps.presentation_exports;begin
 select * into item from eps.presentation_exports where id=current_setting('eps.m06.worker.export')::uuid;
 if item.status<>'ready'or item.media_grant_id<>current_setting('eps.m06.worker.grant')::uuid or not exists(select 1 from eps.review_media_grants where id=current_setting('eps.m06.worker.old_grant')::uuid and revoked_at is not null)then raise exception'M06_EXPORT_COMMIT_OR_SUPERSEDED_GRANT_FAILED';end if;
 if exists(select 1 from eps.jobs where id=item.job_id and(input::text like'%'||current_setting('eps.m06.worker.raw_grant')||'%'or coalesce(result::text,'')like'%'||current_setting('eps.m06.worker.raw_grant')||'%'))or exists(select 1 from eps.outbox_events where job_id=item.job_id and to_jsonb(outbox_events)::text like'%'||current_setting('eps.m06.worker.raw_grant')||'%')then raise exception'M06_GRANT_IN_DURABLE_METADATA';end if;
 if(select eps.presentation_hash(to_jsonb(v))from eps.presentation_versions v where id=current_setting('eps.m05.selection.version')::uuid)<>current_setting('eps.m06.worker.canonical_before')then raise exception'M06_EXPORT_CHANGED_CANONICAL_READY_VERSION';end if;
end$$;
select'M06_EXPORT_SCOPED_CLAIM_MINT_ROTATION_OUTPUT_COMMIT_REPLAY_AND_CANONICAL_PRESERVATION_PASSED';
select set_config('request.jwt.claim.sub',current_setting('eps.casting.fixture.actor'),true),set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('eps.casting.fixture.actor'),'role','authenticated')::text,true);
set local role authenticated;
do $$declare prepared jsonb;link uuid:=current_setting('eps.m06.worker.link')::uuid;begin
 prepared:=public.eps_prepare_pdf_export(jsonb_build_object('review_link_id',link,'version_id',current_setting('eps.m05.selection.version')),'m06-worker-cached-export');if prepared->'cached'<>'true'or prepared->'job_id'<>'null'then raise exception'M06_EXPORT_READY_CACHE_FAILED';end if;
 perform public.eps_update_review_link(link,jsonb_build_object('row_version',1,'expires_at','2026-10-28T00:00:00Z'),'m06-worker-expire-link');
 begin perform public.eps_get_pdf_export(current_setting('eps.m06.worker.export')::uuid);raise exception'M06_EXPIRED_EXPORT_ACCEPTED';exception when raise_exception then if sqlerrm<>'REVIEW_UNAVAILABLE'then raise;end if;end;
 perform public.eps_update_review_link(link,jsonb_build_object('row_version',2,'expires_at',to_jsonb(clock_timestamp()+interval'30days')),'m06-worker-extend-link');
 perform public.eps_get_pdf_export(current_setting('eps.m06.worker.export')::uuid);
 perform public.eps_update_review_link(link,jsonb_build_object('row_version',3,'download_enabled',false),'m06-worker-disable-download');
 begin perform public.eps_prepare_pdf_export(jsonb_build_object('review_link_id',link,'version_id',current_setting('eps.m05.selection.version')),'m06-worker-disabled-prepare');raise exception'M06_DISABLED_EXPORT_PREPARE_ACCEPTED';exception when raise_exception then if sqlerrm<>'DOWNLOAD_DISABLED'then raise;end if;end;
 begin perform public.eps_get_pdf_export_asset(current_setting('eps.m06.worker.export')::uuid);raise exception'M06_DISABLED_EXPORT_DOWNLOAD_ACCEPTED';exception when raise_exception then if sqlerrm<>'DOWNLOAD_DISABLED'then raise;end if;end;
end$$;
set local role postgres;
do $$begin
 if not exists(select 1 from eps.review_media_grants where id=current_setting('eps.m06.worker.grant')::uuid and revoked_at is null and expires_at>clock_timestamp())or not exists(select 1 from eps.review_media_grants where id=current_setting('eps.m06.worker.old_grant')::uuid and revoked_at is not null)then raise exception'M06_EXTENSION_OR_DOWNLOAD_DISABLE_REVOKED_AUTHORIZED_VIEWING';end if;
end$$;
select'M06_EXPORT_READY_CACHE_EXPIRY_EXTENSION_NO_REVOKED_GRANT_REVIVAL_AND_DOWNLOAD_DISABLE_PASSED';
select set_config('request.jwt.claim.sub',current_setting('eps.casting.fixture.actor'),true),set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('eps.casting.fixture.actor'),'role','authenticated')::text,true);
set local role authenticated;
select public.eps_update_review_link(current_setting('eps.m06.worker.link')::uuid,'{"row_version":4,"download_enabled":true}','m06-worker-enable-download');
do $$declare prepared jsonb;begin
 prepared:=public.eps_prepare_pdf_export(jsonb_build_object('review_link_id',current_setting('eps.m06.worker.link'),'version_id',current_setting('eps.m05.selection_v2.version')),'m06-worker-prepare-failure');perform set_config('eps.m06.worker.failure_job',prepared->>'job_id',true);perform set_config('eps.m06.worker.failure_export',prepared#>>'{export,id}',true);
end$$;
set local role postgres;
select set_config('eps.m06.worker.failure_hash',(select input_hash from eps.jobs where id=current_setting('eps.m06.worker.failure_job')::uuid),true);
select set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claims','{}',true);
set local role eps_jobs_executor;
do $$declare job uuid:=current_setting('eps.m06.worker.failure_job')::uuid;lease jsonb;grant_value jsonb;begin
 lease:=eps.claim_job_stage(jsonb_build_object('job_id',job,'stage','render_export','input_hash',current_setting('eps.m06.worker.failure_hash')));
 grant_value:=eps.mint_review_media_grant(jsonb_build_object('job_id',job,'attempt_id',lease->'attempt_id','lease_token',lease->'lease_token'));perform set_config('eps.m06.worker.failure_grant',grant_value->>'grant_id',true);
 perform eps.record_job_event(jsonb_build_object('job_id',job,'attempt_id',lease->'attempt_id','lease_token',lease->'lease_token','stage','render_export','input_hash',current_setting('eps.m06.worker.failure_hash'),'event_id','m06-worker-injected-failure','sequence',1,'event_type','failed','error',jsonb_build_object('code','PDF_INVALID','message','Synthetic invalid PDF','details','{}'::jsonb,'retryable',false)));
end$$;
set local role postgres;
do $$begin if not exists(select 1 from eps.review_media_grants where id=current_setting('eps.m06.worker.failure_grant')::uuid and revoked_at is not null)or not exists(select 1 from eps.presentation_exports where id=current_setting('eps.m06.worker.failure_export')::uuid and status='failed')then raise exception'M06_FAILED_ATTEMPT_GRANT_NOT_REVOKED';end if;end$$;
select set_config('request.jwt.claim.sub',current_setting('eps.casting.fixture.actor'),true),set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('eps.casting.fixture.actor'),'role','authenticated')::text,true);
set local role authenticated;
do $$declare job uuid:=current_setting('eps.m06.worker.failure_job')::uuid;dto jsonb;begin dto:=public.eps_get_job(job);if dto->'can_retry'<>'true'then raise exception'M06_EXPORT_EXPLICIT_RETRY_ACTION_MISSING';end if;perform public.eps_retry_job(job,jsonb_build_object('row_version',dto->'row_version'),'m06-worker-explicit-retry');end$$;
select set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claims','{}',true);
set local role eps_jobs_executor;
do $$declare job uuid:=current_setting('eps.m06.worker.failure_job')::uuid;lease jsonb;grant_value jsonb;begin
 lease:=eps.claim_job_stage(jsonb_build_object('job_id',job,'stage','render_export','input_hash',current_setting('eps.m06.worker.failure_hash')));grant_value:=eps.mint_review_media_grant(jsonb_build_object('job_id',job,'attempt_id',lease->'attempt_id','lease_token',lease->'lease_token'));
 if grant_value->>'grant_id'=current_setting('eps.m06.worker.failure_grant')then raise exception'M06_RETRY_REUSED_REVOKED_GRANT';end if;perform set_config('eps.m06.worker.retry_grant',grant_value->>'grant_id',true);
end$$;
select set_config('request.jwt.claim.sub',current_setting('eps.casting.fixture.actor'),true),set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('eps.casting.fixture.actor'),'role','authenticated')::text,true);
set local role authenticated;
do $$declare job uuid:=current_setting('eps.m06.worker.failure_job')::uuid;dto jsonb;begin dto:=public.eps_get_job(job);perform public.eps_cancel_job(job,jsonb_build_object('row_version',dto->'row_version'),'m06-worker-cancel-retry');end$$;
set local role postgres;
do $$begin if not exists(select 1 from eps.review_media_grants where id=current_setting('eps.m06.worker.retry_grant')::uuid and revoked_at is not null)or not exists(select 1 from eps.jobs where id=current_setting('eps.m06.worker.failure_job')::uuid and status='cancelled')then raise exception'M06_CANCELLED_EXPORT_GRANT_NOT_REVOKED';end if;end$$;
select'M06_EXPORT_FAILURE_REVOKES_GRANT_EXPLICIT_RETRY_FRESH_GRANT_CANCEL_TERMINAL_PASSED';
