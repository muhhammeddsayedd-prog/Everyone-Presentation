-- Compatibility16 now admits a truthful paged OCR method and all prior guards.
do $$declare scope jsonb:=current_setting('eps.vision.scope')::jsonb;lease jsonb:=current_setting('eps.vision.lease')::jsonb;stored jsonb;receipt jsonb;input_value jsonb;
 job eps.jobs;asset eps.media_assets;bad_asset eps.media_assets;bad_payload text;parsed jsonb;begin
 execute 'set local role eps_specs_assets_executor';stored:=eps.store_specs_preparation(scope);execute 'set local role postgres';
 perform pg_temp.asset_assert(stored->'stored'='true','private paged vision preparation stored');
 select * into strict job from eps.jobs where id=(scope->>'job_id')::uuid;select * into strict asset from eps.media_assets where id=(scope->>'asset_id')::uuid;parsed:=(scope->>'payload_utf8')::jsonb;
 bad_payload:=jsonb_set(parsed,'{paragraphs,0,page}','null')::text;bad_asset:=asset;bad_asset.sha256:=encode(sha256(convert_to(bad_payload,'UTF8')),'hex');bad_asset.size_bytes:=octet_length(bad_payload);
 begin perform eps.specs_validate_file_preparation(job,bad_asset,bad_payload);raise exception 'EXPECTED_VISION_NULL_PAGE_DENIAL';exception when raise_exception then if sqlerrm<>'RESULT_INVALID' then raise;end if;end;
 bad_payload:=jsonb_set(jsonb_set(parsed,'{paragraphs,0,page}','3'),'{paragraphs,1,page}','1')::text;bad_asset:=asset;bad_asset.sha256:=encode(sha256(convert_to(bad_payload,'UTF8')),'hex');bad_asset.size_bytes:=octet_length(bad_payload);
 begin perform eps.specs_validate_file_preparation(job,bad_asset,bad_payload);raise exception 'EXPECTED_VISION_PAGE_ORDER_DENIAL';exception when raise_exception then if sqlerrm<>'RESULT_INVALID' then raise;end if;end;
 execute 'set local role eps_jobs_executor';
 receipt:=eps.record_job_event(pg_temp.asset_event(lease,'succeeded',jsonb_build_object('source_asset_id',parsed->'sourceAssetId','text_asset_id',asset.id,
  'page_assets','[]'::jsonb,'paragraph_count',2,'extraction_method','pdf_vision','warnings',parsed->'warnings'),'document-preparation.v1'));
 execute 'set local role postgres';perform pg_temp.asset_assert(receipt->>'job_status'='queued','vision prepare callback queues grounded extraction');
 lease:=pg_temp.asset_lease(job.id,'extract_specs');execute 'set local role eps_jobs_executor';input_value:=eps.get_specs_stage_input(job.id,(lease->>'attempt_id')::uuid,lease->>'lease_token');execute 'set local role postgres';
 perform pg_temp.asset_assert(input_value#>>'{paragraphs,0,page}'='1' and input_value#>>'{paragraphs,1,page}'='3'
  and input_value->>'text'=parsed->>'text' and input_value#>>'{paragraphs,1,text}'=parsed#>>'{paragraphs,1,text}','exact pages/Arabic retained in private next-stage input');
 perform pg_temp.asset_assert(not exists(select 1 from eps.jobs where id=job.id and (input::text like '%Scanned Father%' or completed_stages::text like '%Scanned Father%')),'OCR text excluded from public job metadata');
end $$;
-- A non-PDF cannot label preparation as vision merely to gain PDF page rules.
do $$declare item jsonb;proof jsonb;job_id uuid;lease jsonb;payload text;reserved jsonb;output_id uuid;begin
 item:=pg_temp.asset_reserve('application/vnd.openxmlformats-officedocument.wordprocessingml.document','wrong-vision.docx','synthetic-vision-docx-reserve');proof:=pg_temp.asset_proof(item,repeat('d',64));
 execute 'set local role authenticated';perform public.eps_finalize_specs_completion((item->>'upload_id')::uuid,'{"actual_size_bytes":17,"start_processing":false}','synthetic-vision-docx-complete',proof->>'payload',proof->>'mac');execute 'set local role postgres';
 job_id:=pg_temp.asset_submit((item#>>'{asset,id}')::uuid,'synthetic-vision-docx-submit');lease:=pg_temp.asset_lease(job_id,'prepare_document');
 payload:=jsonb_build_object('schema_version','document-text-v1','sourceAssetId',item#>'{asset,id}','sourceSha256',repeat('d',64),'text','Synthetic actor A',
  'paragraphs','[{"index":0,"page":1,"start":0,"end":17,"text":"Synthetic actor A"}]'::jsonb,'extractionMethod','pdf_vision','warnings','[]'::jsonb)::text;
 execute 'set local role eps_specs_assets_executor';reserved:=eps.reserve_job_output(jsonb_build_object('job_id',job_id,'attempt_id',lease->'attempt_id','lease_token',lease->'lease_token',
  'output_key','document_text','asset_kind','document_text','filename','prepared-document.json','mime_type','application/json','expected_size_bytes',octet_length(payload),'parent_asset_id',item#>'{asset,id}','time_offset_ms',null));
 output_id:=(reserved#>>'{asset,id}')::uuid;perform eps.complete_job_output(jsonb_build_object('job_id',job_id,'attempt_id',lease->'attempt_id','lease_token',lease->'lease_token','asset_id',output_id,
  'sha256',encode(sha256(convert_to(payload,'UTF8')),'hex'),'actual_size_bytes',octet_length(payload),'width',null,'height',null,'duration_ms',null));execute 'set local role postgres';
 perform set_config('eps.vision.wrong_mime',jsonb_build_object('job_id',job_id,'attempt_id',lease->'attempt_id','lease_token',lease->'lease_token','asset_id',output_id,'payload_utf8',payload)::text,true);
 execute 'set local role eps_specs_assets_executor';perform pg_temp.asset_expect('select eps.store_specs_preparation(current_setting(''eps.vision.wrong_mime'')::jsonb)','RESULT_INVALID');execute 'set local role postgres';
end $$;
select 'PDF_VISION_GREEN_PAGES_CALLBACK_AND_FORMAT_GUARDS_PASSED';
