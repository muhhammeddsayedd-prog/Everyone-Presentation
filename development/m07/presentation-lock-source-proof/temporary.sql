-- Temporary observation helpers execute with the real caller's role/RLS.
create function pg_temp.locksource41_measure(p_operation text,p_workspace uuid,p_series uuid,p_input jsonb default null,p_key text default null)
returns jsonb language plpgsql volatile security invoker set search_path=''as $measure$
declare v_started timestamptz:=clock_timestamp();v_prepared timestamptz;v_response jsonb;v_hash text;v_code text;begin
 if current_setting('statement_timeout')<>'8s'then raise exception'LOCKSOURCE41_EIGHT_SECOND_BOUND_REQUIRED';end if;
 if p_operation='generate'then
  if current_user<>'authenticated'then raise exception'LOCKSOURCE41_AUTHENTICATED_CALLER_REQUIRED';end if;
  v_response:=public.eps_generate_version(p_series,p_input,p_key);
  return jsonb_build_object('ok',true,'duration_ms',extract(epoch from(clock_timestamp()-v_started))*1000,'role',current_user,'job_id',v_response->'job_id','resource_id',v_response->'resource_id','status',v_response->'status');
 end if;
 if current_user<>'eps_review_owner'then raise exception'LOCKSOURCE41_INVOKER_OWNER_REQUIRED';end if;
 if p_operation='locks'then perform eps.presentation_lock_sources(p_workspace,'everyone-casting','1.1.0');
 elsif p_operation='review'then v_response:=public.eps_get_workspace_review(p_workspace,p_series,null);v_hash:=eps.presentation_hash(v_response);
 elsif p_operation='snapshot'then v_response:=eps.review_snapshot_data(p_workspace,p_series,null);v_hash:=eps.presentation_hash(v_response);
 elsif p_operation='hash'then
  v_response:=eps.review_snapshot_data(p_workspace,p_series,null);v_prepared:=clock_timestamp();v_hash:=eps.presentation_hash(v_response);
 else raise exception'LOCKSOURCE41_CLOSED_OPERATION_REQUIRED';end if;
 return jsonb_build_object('ok',true,'operation',p_operation,'duration_ms',extract(epoch from(clock_timestamp()-coalesce(v_prepared,v_started)))*1000,'preparation_ms',case when v_prepared is not null then extract(epoch from(v_prepared-v_started))*1000 end,'role',current_user,'contract_hash',v_hash,'can_generate',v_response->'can_generate','blocking_codes',coalesce((select jsonb_agg(distinct v->>'code'order by v->>'code')from jsonb_array_elements(v_response->'issues')v where v->>'severity'='blocking'),'[]'));
exception when query_canceled then return jsonb_build_object('ok',false,'code','57014','duration_ms',extract(epoch from(clock_timestamp()-v_started))*1000,'operation',p_operation);
 when lock_not_available then return jsonb_build_object('ok',false,'code','55P03','duration_ms',extract(epoch from(clock_timestamp()-v_started))*1000,'operation',p_operation);
 when insufficient_privilege then return jsonb_build_object('ok',false,'code','42501','duration_ms',extract(epoch from(clock_timestamp()-v_started))*1000,'operation',p_operation);
 when raise_exception then
  if sqlerrm in('CAPABILITY_REQUIRED','RESOURCE_NOT_FOUND','AUTH_REQUIRED','INPUT_CHANGED','STALE_RESOURCE_VERSION','LAYOUT_NOT_READY','SNAPSHOT_INVALID','ASSET_UNAVAILABLE','PRESENTATION_PROCESSING_UNAVAILABLE','PERMISSION_CHANGED')then return jsonb_build_object('ok',false,'code',sqlerrm,'duration_ms',extract(epoch from(clock_timestamp()-v_started))*1000,'operation',p_operation);end if;raise;
end$measure$;

create function pg_temp.locksource41_review_meta(p_workspace uuid,p_series uuid)returns jsonb language plpgsql stable security invoker set search_path=''as $review$
declare v_review jsonb;v_workspace eps.workspaces;begin
 if current_user<>'eps_review_owner'then raise exception'LOCKSOURCE41_INVOKER_OWNER_REQUIRED';end if;
 v_review:=public.eps_get_workspace_review(p_workspace,p_series,null);select * into v_workspace from eps.workspaces where id=p_workspace;
 return jsonb_build_object('input',jsonb_build_object('expected_workspace_row_version',v_workspace.row_version,'expected_draft_revision',v_workspace.draft_revision,'expected_input_fingerprint',v_review->>'input_fingerprint'),'template_sha256',v_review#>>'{template,content_sha256}','candidate_slides',v_review->'candidate_slide_count','pending_slides',v_review->'pending_slide_count','fit_status',v_review#>>'{fit,status}','can_generate',v_review->'can_generate','review_hash',eps.presentation_hash(v_review));
end$review$;

-- Called only by the same owned session after measurement resets to postgres.
-- UUID/time differences are explicitly normalized, never called byte equality.
create function pg_temp.locksource41_generated_projection(p_version uuid)returns jsonb language plpgsql stable security invoker set search_path=''as $projection$
declare v_row eps.presentation_versions;v_snapshot jsonb;v_text text;v_slide jsonb;v_job eps.jobs;begin
 if current_user<>'postgres'then raise exception'LOCKSOURCE41_PRIVATE_OBSERVER_REQUIRED';end if;
 select * into v_row from eps.presentation_versions where id=p_version;if not found then raise exception'LOCKSOURCE41_GENERATED_ROW_REQUIRED';end if;
 v_text:=(v_row.snapshot-'created_at')::text;
 for v_slide in select value from jsonb_array_elements(v_row.snapshot->'slides')loop
  v_text:=replace(v_text,v_slide->>'id',md5('synthetic-normalized-slide-'||(v_slide->>'order'))::uuid::text);
 end loop;
 v_text:=replace(v_text,p_version::text,'00000000-0000-4000-8000-000000000001');v_snapshot:=v_text::jsonb;
 select * into v_job from eps.jobs where id=v_row.generation_job_id;
 return jsonb_build_object('normalized_snapshot_sha256',eps.presentation_hash(v_snapshot),'normalization',jsonb_build_array('created_at','generated version_id','generated slide ids by ordinal','companion captured_at'),'pages',v_row.page_count,'slides',(select count(*)from eps.version_slides where version_id=p_version),'pins',(select count(*)from eps.presentation_version_assets where version_id=p_version),'job_status',v_job.status,'outbox_rows',(select count(*)from eps.outbox_events where job_id=v_job.id),'reason_nonnull_rows',(select count(*)from eps.audit_events where reason is not null),'source_companions',(select coalesce(jsonb_agg(to_jsonb(t)-array['version_id','original_text','captured_at']order by video_asset_id),'[]')from eps.presentation_video_transcripts t where version_id=p_version),'english_companions',(select coalesce(jsonb_agg(to_jsonb(t)-array['version_id','english_text','captured_at']order by video_asset_id),'[]')from eps.presentation_video_english_transcripts t where version_id=p_version));
end$projection$;
