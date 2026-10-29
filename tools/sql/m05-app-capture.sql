-- Fixed metadata-only observation of the authorized Dummy workspace.
begin isolation level repeatable read read only;
set local search_path='';set local statement_timeout='15s';set local row_security=off;
select jsonb_build_object(
 'observed_at',clock_timestamp(),'query_role',current_user,'database',current_database(),
 'unrestricted_visibility',current_setting('row_security')='off'and exists(select 1 from pg_roles where rolname=current_user and(rolsuper or rolbypassrls)),
 'migration_versions',(select jsonb_agg(version order by version)from supabase_migrations.schema_migrations),
 'processing_enabled',(select enabled from eps.presentation_processing_config where id),
 'versions',(select coalesce(jsonb_agg(jsonb_build_object(
  'id',v.id,'series_id',v.series_id,'workspace_id',v.workspace_id,'version_no',v.version_number,'status',v.status,
  'snapshot_sha256',v.snapshot_sha256,'manifest_sha256',v.manifest_sha256,'inventory_sha256',v.inventory_sha256,
  'snapshot_hash_matches',v.snapshot_sha256=eps.presentation_hash(v.snapshot),
  'manifest_hash_matches',v.manifest_sha256=eps.presentation_hash(v.manifest),
  'inventory_hash_matches',v.inventory_sha256=eps.presentation_hash(v.snapshot->'asset_inventory'),
  'page_count',v.page_count,'template_version',v.snapshot#>>'{template,version}',
  'template_content_sha256',v.snapshot#>>'{template,content_sha256}',
  'slides',(select jsonb_agg(jsonb_build_object('id',s.id,'order',s.ordinal,'kind',s.kind,'assignment_id',s.source_assignment_id,
   'slot_id',s.source_slot_id,'content_sha256',s.content_sha256,'frame_count',jsonb_array_length(s.snapshot->'frame_asset_ids'),
   'has_original_video',(s.snapshot->>'video_asset_id')is not null)order by s.ordinal)from eps.version_slides s where s.version_id=v.id),
  'pins',(select coalesce(jsonb_agg(jsonb_build_object('asset_id',p.asset_id,'asset_kind',p.asset_kind,'sha256',p.sha256,'byte_size',p.byte_size,
   'current_physical_identity_matches',a.bucket=p.bucket and a.object_key=p.object_key and a.sha256=p.sha256 and a.size_bytes=p.byte_size and a.mime_type=p.mime_type,
   'retained',a.status in('ready','archived'))order by p.asset_id),'[]')from eps.presentation_version_assets p join eps.media_assets a on a.id=p.asset_id where p.version_id=v.id),
  'pdf_asset_id',v.pdf_asset_id,'manifest_asset_id',v.manifest_asset_id,
  'pdf_sha256',(select sha256 from eps.media_assets where id=v.pdf_asset_id),
  'pdf_bytes',(select size_bytes from eps.media_assets where id=v.pdf_asset_id),
  'manifest_bytes_sha256',(select sha256 from eps.media_assets where id=v.manifest_asset_id),
  'job_id',j.id,'job_status',j.status,'stage',j.stage,'attempt',j.attempt,'n8n_execution_id',j.n8n_execution_id,
  'error_code',j.error->>'code',
  'completed_stages',(select coalesce(jsonb_agg(jsonb_build_object('stage',s.value->>'stage','attempt_id',s.value->>'attempt_id',
   'input_hash_matches',s.value->>'input_hash'=j.input_hash,'result_schema',s.value->>'result_schema')order by s.ordinal),'[]')from jsonb_array_elements(j.completed_stages)with ordinality s(value,ordinal)),
  'stage_receipts',(select coalesce(jsonb_agg(jsonb_build_object('stage',p.stage,'result_schema',p.result_schema,
   'payload_sha256',encode(sha256(convert_to(p.payload::text,'UTF8')),'hex'))order by p.stage),'[]')from eps.review_stage_payloads p where p.job_id=j.id),
  'outbox',(select coalesce(jsonb_agg(jsonb_build_object('stage',o.stage,'status',o.status,'generation',o.dispatch_generation)order by o.dispatch_generation),'[]')from eps.outbox_events o where o.job_id=j.id)
 )order by v.series_id,v.version_number),'[]')from eps.presentation_versions v join eps.jobs j on j.id=v.generation_job_id where v.workspace_id='098d5b48-42a3-475b-b562-735c9eafce80'),
 'series',(select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'output_type',s.output_type,'template_version',s.template_version,
  'latest_ready_version_id',s.latest_ready_version_id,'latest_ready_version_no',s.latest_ready_version_no,'next_version_no',s.next_version_number)order by s.id),'[]')from eps.presentation_series s where s.workspace_id='098d5b48-42a3-475b-b562-735c9eafce80'),
 'protected',jsonb_build_object(
  'm02_waiting_preserved',exists(select 1 from eps.jobs where id='b3f90268-147d-41d4-8875-2a6435df1496'and status='waiting_for_input'and error->>'code'='INPUT_CHANGED'),
  'owner_confirmed_profile_still_reviewed',exists(select 1 from eps.candidates where id='25a3c924-7b6c-48e3-88ce-c72e72b99c6d'and eps.cast_is_reviewed(candidates)),
  'reviewed_source_sha256',(select sha256 from eps.media_assets where id='5f8a6d53-0da0-4064-aacf-aea6b9c47c81')
 ))as m05_app_capture;
rollback;
