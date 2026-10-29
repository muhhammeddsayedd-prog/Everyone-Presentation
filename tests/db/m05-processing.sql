-- Injected artifact metadata only: native PDF bytes, fonts and inspection have separate proof.
set local role postgres;
update eps.candidates set facts=jsonb_set(facts,'{height_measurements}','"181 cm"')where id='8a5a0000-0000-4000-8000-000000000001';
update eps.workspaces set draft_revision=draft_revision+1 where id=current_setting('eps.casting.fixture.workspace')::uuid;
do $$declare output text;begin foreach output in array array['selection_v3','selection_v2','selection','shortlist']loop perform set_config('eps.m05.'||output||'.hash',(select input_hash from eps.jobs where id=current_setting('eps.m05.'||output||'.job')::uuid),true);end loop;end$$;
select set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claims','{}',true);
set local role eps_jobs_executor;
do $$declare output text;job uuid;hash text;lease jsonb;source jsonb;stage text;schema text;result jsonb;event jsonb;receipt jsonb;common jsonb;prepared jsonb;rendered jsonb;validated jsonb;manifest_asset jsonb;pdf_asset jsonb;asset jsonb;complete jsonb;grant_value jsonb;count_value integer;begin
 foreach output in array array['selection_v3','selection_v2','selection','shortlist']loop
  job:=current_setting('eps.m05.'||output||'.job')::uuid;hash:=current_setting('eps.m05.'||output||'.hash');
  foreach stage in array array['prepare_presentation','render_presentation','validate_presentation','publish_presentation']loop
   lease:=eps.claim_job_stage_replay(jsonb_build_object('job_id',job,'stage',stage,'input_hash',hash),'m05-claim-'||output||stage,'synthetic-key',repeat('a',64));
   if lease<>eps.claim_job_stage_replay(jsonb_build_object('job_id',job,'stage',stage,'input_hash',hash),'m05-claim-'||output||stage,'synthetic-key',repeat('a',64))then raise exception'M05_CLAIM_REPLAY_FAILED';end if;
   source:=eps.get_specs_stage_input(job,(lease->>'attempt_id')::uuid,lease->>'lease_token');
   if(select count(*)from jsonb_object_keys(source))<>16 or source#>>'{snapshot,slides,1,fields,height_measurements}'<>'178 cm'or source->>'version_id'<>current_setting('eps.m05.'||output||'.version')then raise exception'M05_IMMUTABLE_INPUT_OR_CLOSED_INPUT_FAILED';end if;
   count_value:=jsonb_array_length(source#>'{snapshot,slides}');common:=jsonb_build_object('schema_version','1.0','version_id',source->'version_id','snapshot_sha256',source->'snapshot_sha256','manifest_sha256',source->'manifest_sha256','inventory_sha256',source->'inventory_sha256');
   if stage='prepare_presentation'then
    result:=common||jsonb_build_object('template_content_sha256',source#>'{snapshot,template,content_sha256}','font_hashes',source#>'{snapshot,template,font_hashes}','renderer_version',source#>'{configuration,renderer_version}','prepared_at','2026-10-29T20:00:00.000000Z');schema:='presentation-preparation.v1';prepared:=result;
   elsif stage='render_presentation'then
    if source->'prepared'<>prepared then raise exception'M05_PREPARED_BINDING_FAILED';end if;
    foreach schema in array array['presentation_manifest','presentation_pdf']loop
     execute'set local role eps_specs_assets_executor';
     asset:=eps.reserve_job_output(jsonb_build_object('job_id',job,'attempt_id',lease->'attempt_id','lease_token',lease->'lease_token','output_key',schema,'asset_kind',schema,'filename',case schema when'presentation_pdf'then'presentation.pdf'else'presentation-manifest.json'end,'mime_type',case schema when'presentation_pdf'then'application/pdf'else'application/json'end,'expected_size_bytes',100,'parent_asset_id',null,'time_offset_ms',null));
     grant_value:=eps.get_job_asset_access(jsonb_build_object('job_id',job,'attempt_id',lease->'attempt_id','lease_token',lease->'lease_token','asset_id',asset#>'{asset,id}','access','write'));if grant_value->>'bucket'<>'eps-presentation-outputs'or grant_value->>'permission'<>'write'then raise exception'M05_SCOPED_OUTPUT_GRANT_FAILED';end if;
     complete:=jsonb_build_object('job_id',job,'attempt_id',lease->'attempt_id','lease_token',lease->'lease_token','asset_id',asset#>'{asset,id}','sha256',case schema when'presentation_manifest'then source->>'manifest_sha256'else repeat('b',64)end,'actual_size_bytes',100,'width',null,'height',null,'duration_ms',null);
     result:=eps.complete_job_output(complete);if result<>eps.complete_job_output(complete)then raise exception'M05_COMPLETE_OUTPUT_REPLAY_FAILED';end if;
     begin perform eps.complete_job_output(complete||jsonb_build_object('sha256',repeat('c',64)));raise exception'M05_DIFFERENT_BYTES_ACCEPTED';exception when raise_exception then if sqlerrm<>'IDEMPOTENCY_KEY_REUSED'then raise;end if;end;
     if schema='presentation_manifest'then manifest_asset:=jsonb_build_object('asset_id',result->'id','sha256',result->'sha256','size_bytes',result->'size_bytes','mime_type',result->'mime_type');else pdf_asset:=jsonb_build_object('asset_id',result->'id','sha256',result->'sha256','size_bytes',result->'size_bytes','mime_type',result->'mime_type');perform set_config('eps.m05.'||output||'.pdf',result->>'id',true);end if;
     execute'set local role eps_jobs_executor';
    end loop;
    result:=common||jsonb_build_object('manifest_asset',manifest_asset,'pdf_asset',pdf_asset,'proof',jsonb_build_object('renderer_version',source#>'{configuration,renderer_version}','chromium_version','synthetic-injected-domain','template_content_sha256',source#>'{snapshot,template,content_sha256}','font_hashes',source#>'{snapshot,template,font_hashes}','page_count',count_value,'width_css_px',1600,'height_css_px',900,'overflow_count',0,'candidate_field_count',case when output like'selection%'then 60 else 30 end,'frame_draw_count',0,'logo_draw_count',0,'video_link_count',0,'fonts_ready',true,'images_ready',true,'rendered_at','2026-10-29T20:00:00.000000Z','link_targets_sha256','4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945'));schema:='presentation-rendering.v1';rendered:=result;
   elsif stage='validate_presentation'then
    if source->'rendered'<>rendered then raise exception'M05_RENDERED_BINDING_FAILED';end if;
    execute'set local role eps_specs_assets_executor';grant_value:=eps.get_job_asset_access(jsonb_build_object('job_id',job,'attempt_id',lease->'attempt_id','lease_token',lease->'lease_token','asset_id',pdf_asset->'asset_id','access','read'));execute'set local role eps_jobs_executor';if grant_value->>'sha256'<>pdf_asset->>'sha256'then raise exception'M05_PRIOR_ATTEMPT_OUTPUT_READ_FAILED';end if;
    result:=common||jsonb_build_object('manifest_asset',manifest_asset,'pdf_asset',pdf_asset,'proof',jsonb_build_object('pdf_sha256',pdf_asset->'sha256','page_count',count_value,'width_points',1200,'height_points',675.12,'text_regions_checked',case when output like'selection%'then 168 else 126 end,'image_draws_checked',0,'video_links_checked',0,'embedded_font_count',2,'validated_at','2026-10-29T20:00:00.000000Z'));schema:='presentation-validation.v1';validated:=result;
   else
    if source->'validated'<>validated then raise exception'M05_VALIDATION_BINDING_FAILED';end if;
    result:=jsonb_build_object('version_id',source->'version_id','manifest_asset_id',manifest_asset->'asset_id','pdf_asset_id',pdf_asset->'asset_id','pdf_sha256',pdf_asset->'sha256','page_count',count_value,'template_version','1.1.0','validation_passed',true,'overflow_count',0,'renderer_build',source#>'{configuration,renderer_version}');schema:='presentation-render-result.v1';
   end if;
   event:=jsonb_build_object('job_id',job,'attempt_id',lease->'attempt_id','lease_token',lease->'lease_token','stage',stage,'input_hash',hash,'event_id','m05-'||output||stage,'sequence',1,'event_type','succeeded','result_schema',schema,'result',result);
   receipt:=eps.record_job_event(event);if receipt->'applied'<>'true'or receipt->'stale'<>'false'or receipt->>'job_status'<>(case stage when'publish_presentation'then'succeeded'else'queued'end)then raise exception'M05_STAGE_COMMIT_FAILED:%',receipt;end if;
   if eps.record_job_event(event)->'duplicate'<>'true'then raise exception'M05_EVENT_REPLAY_FAILED';end if;
  end loop;
 end loop;
end$$;
set local role postgres;
do $$begin
 if(select count(*)from eps.presentation_version_assets where asset_kind in('presentation_pdf','presentation_manifest'))<>8 then raise exception'M05_COMMITTED_OUTPUT_PINS_FAILED';end if;
 begin update eps.presentation_versions set input_fingerprint=repeat('f',64)where id=current_setting('eps.m05.selection.version')::uuid;raise exception'M05_MUTABLE_READY_ACCEPTED';exception when raise_exception then if sqlerrm<>'IMMUTABLE_VERSION'then raise;end if;end;
 begin delete from eps.media_assets where id=current_setting('eps.m05.selection.pdf')::uuid;raise exception'M05_RETAINED_BYTES_DELETE_ACCEPTED';exception when raise_exception then if sqlerrm<>'RETAINED_VERSION_ASSET'then raise;end if;end;
end$$;
select set_config('request.jwt.claim.sub',current_setting('eps.casting.fixture.actor'),true),set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('eps.casting.fixture.actor'),'role','authenticated')::text,true);
set local role authenticated;
do $$declare v jsonb;asset jsonb;begin
 v:=public.eps_get_version(current_setting('eps.m05.selection.version')::uuid);asset:=public.eps_get_version_asset((v->>'id')::uuid,(v->>'pdf_asset_id')::uuid,'pdf');
 if public.eps_get_presentation_series(current_setting('eps.m05.selection')::uuid)->>'latest_ready_version_id'<>current_setting('eps.m05.selection_v3.version')then raise exception'M05_OUT_OF_ORDER_LATEST_POINTER_REGRESSED';end if;
 if v->>'status'<>'ready'or v->>'manifest_asset_id'is null or v->>'pdf_asset_id'is null or v->>'ready_at'is null or asset->>'bucket'<>'eps-presentation-outputs'or jsonb_array_length(public.eps_list_versions(current_setting('eps.m05.selection')::uuid,'{"limit":1}')->'data')<>1 then raise exception'M05_READY_READ_AND_LIST_FAILED';end if;
 if public.eps_get_job(current_setting('eps.m05.selection.job')::uuid)->'can_retry'<>'false'or public.eps_get_job(current_setting('eps.m05.selection.job')::uuid)->'can_cancel'<>'false'then raise exception'M05_TERMINAL_JOB_ACTIONS_FAILED';end if;
end$$;
select'M05_FOUR_STAGES_FROZEN_INPUT_ASSETS_REPLAY_RETENTION_READY_POINTER_AND_READ_PASSED';
