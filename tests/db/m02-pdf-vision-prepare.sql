-- Build one paged private OCR result; before compatibility16 it must be rejected.
-- This is synthetic SQL metadata, not a claim of actual image/OCR processing.
do $$declare item jsonb;proof jsonb;job_id uuid;lease jsonb;payload text;paragraphs jsonb;reserved jsonb;asset_id uuid;source_id uuid;
 first_text text:='Scanned Father: one person.';second_text text:=chr(1605)||chr(1583)||chr(1610)||chr(1585)||' Manager';full_text text;begin
 item:=pg_temp.asset_reserve('application/pdf','synthetic-vision.pdf','synthetic-vision-reservation');proof:=pg_temp.asset_proof(item,repeat('c',64));
 execute 'set local role authenticated';perform public.eps_finalize_specs_completion((item->>'upload_id')::uuid,'{"actual_size_bytes":17,"start_processing":false}','synthetic-vision-completion',proof->>'payload',proof->>'mac');execute 'set local role postgres';
 source_id:=(item#>>'{asset,id}')::uuid;job_id:=pg_temp.asset_submit(source_id,'synthetic-vision-submit');lease:=pg_temp.asset_lease(job_id,'prepare_document');
 full_text:=first_text||E'\n\n'||second_text;
 paragraphs:=jsonb_build_array(jsonb_build_object('index',0,'page',1,'start',0,'end',eps.specs_utf16_length(first_text),'text',first_text),
  jsonb_build_object('index',1,'page',3,'start',eps.specs_utf16_length(first_text)+2,'end',eps.specs_utf16_length(full_text),'text',second_text));
 payload:=jsonb_build_object('schema_version','document-text-v1','sourceAssetId',source_id,'sourceSha256',repeat('c',64),'text',full_text,'paragraphs',paragraphs,
  'extractionMethod','pdf_vision','warnings','["PDF_VISION_OCR_PAGES_1_3"]'::jsonb)::text;
 execute 'set local role eps_specs_assets_executor';
 reserved:=eps.reserve_job_output(jsonb_build_object('job_id',job_id,'attempt_id',lease->'attempt_id','lease_token',lease->'lease_token',
  'output_key','document_text','asset_kind','document_text','filename','prepared-document.json','mime_type','application/json','expected_size_bytes',octet_length(payload),'parent_asset_id',source_id,'time_offset_ms',null));
 asset_id:=(reserved#>>'{asset,id}')::uuid;
 perform eps.complete_job_output(jsonb_build_object('job_id',job_id,'attempt_id',lease->'attempt_id','lease_token',lease->'lease_token','asset_id',asset_id,
  'sha256',encode(sha256(convert_to(payload,'UTF8')),'hex'),'actual_size_bytes',octet_length(payload),'width',null,'height',null,'duration_ms',null));
 execute 'set local role postgres';perform set_config('eps.vision.scope',jsonb_build_object('job_id',job_id,'attempt_id',lease->'attempt_id','lease_token',lease->'lease_token','asset_id',asset_id,'payload_utf8',payload)::text,true);
 perform set_config('eps.vision.lease',lease::text,true);
 execute 'set local role eps_specs_assets_executor';perform pg_temp.asset_expect('select eps.store_specs_preparation(current_setting(''eps.vision.scope'')::jsonb)','RESULT_INVALID');execute 'set local role postgres';
end $$;
select 'PDF_VISION_RED_CURRENT_METHOD_REJECTED';
