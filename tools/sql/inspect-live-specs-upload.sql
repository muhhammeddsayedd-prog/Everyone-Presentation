-- Fixed read-only diagnosis for the owner-selected live test workspace.
-- No source/filename/path, Auth row, key digest/secret, JWT or grant token output.
begin read only;
set local statement_timeout='10s';
set local search_path='';
do $$ begin
 if current_user<>'postgres' or current_database()<>'postgres'
  or not exists(select 1 from pg_catalog.pg_roles where rolname=current_user and (rolsuper or rolbypassrls))
  or (select array_agg(version order by version) from supabase_migrations.schema_migrations) is distinct from
    array['20261028010943','20261028013324','20261028013655','20261028024205','20261028072515','20261028162702','20261028162800','20261028172320','20261028184145','20261028222030','20261029001520','20261029003941']::text[]
  or not exists(select 1 from eps.workspaces where id='098d5b48-42a3-475b-b562-735c9eafce80' and project_id='4b70c8ce-18bd-4a8c-b5a9-bc1156c06463')
 then raise exception 'LIVE_SPECS_UPLOAD_TARGET_UNCONFIRMED'; end if;
end $$;
select jsonb_build_object('observed_at',pg_catalog.clock_timestamp(),'query_role',current_user,'database',current_database(),
 'writes_requested',false,
 'flags',(select jsonb_build_object('uploads_enabled',uploads_enabled,'capabilities_enabled',capabilities_enabled,'file_pipeline_enabled',file_pipeline_enabled) from eps.specs_asset_config where id=1),
 'verification_key',(select jsonb_build_object('purpose_key_count',count(*),'expected_active_key_count',count(*) filter(where key_id='eps-specs-dev-20261029-v1' and revoked_at is null and not_before<=pg_catalog.clock_timestamp() and (not_after is null or not_after>pg_catalog.clock_timestamp()))) from eps.specs_verification_keys where purpose='specs'),
 'rpcs',jsonb_build_object('reserve',to_regprocedure('public.eps_reserve_specs_upload(jsonb,text)') is not null,'get',to_regprocedure('public.eps_get_specs_upload(uuid)') is not null,'prepare',to_regprocedure('public.eps_prepare_specs_completion(uuid,jsonb,text)') is not null,'finalize',to_regprocedure('public.eps_finalize_specs_completion(uuid,jsonb,text,text,text)') is not null),
 'spec',(select jsonb_build_object('spec_id',s.id,'row_version',s.row_version,'source_row_version',s.source_row_version,'source_asset_id',s.source_asset_id,'processing_job_id',s.processing_job_id,'source_extraction_job_id',s.source_extraction_job_id,'workspace_row_version',w.row_version,'workspace_draft_revision',w.draft_revision) from eps.specs s join eps.workspaces w on w.id=s.workspace_id where w.id='098d5b48-42a3-475b-b562-735c9eafce80'),
 'uploads',(select coalesce(jsonb_agg(jsonb_build_object('upload_id',u.id,'asset_id',u.asset_id,'status',u.status,'expired',u.expires_at<=pg_catalog.clock_timestamp(),'expected_size_bytes',u.expected_size_bytes,'expected_mime_type',u.expected_mime_type,'expected_sha256',u.expected_sha256,'created_at',u.created_at,'completed_at',u.completed_at,'asset_status',a.status,'asset_sha256',a.sha256,'expected_filename_matches',a.filename='synthetic-casting-english.pdf','object_metadata_present',exists(select 1 from storage.objects o where o.bucket_id=u.bucket and o.name=u.object_key)) order by u.created_at),'[]'::jsonb) from (select * from eps.specs_upload_sessions where workspace_id='098d5b48-42a3-475b-b562-735c9eafce80' order by created_at desc limit 6) u join eps.media_assets a on a.id=u.asset_id),
 'file_jobs',(select coalesce(jsonb_agg(jsonb_build_object('job_id',j.id,'status',j.status,'stage',j.stage,'source_asset_id',j.input->>'source_asset_id','error_code',j.error->>'code') order by j.created_at),'[]'::jsonb) from eps.jobs j where j.workspace_id='098d5b48-42a3-475b-b562-735c9eafce80' and j.input->>'schema_version'='1.1')
) as live_specs_upload;
rollback;
