-- One cancelled synthetic transfer only. No private path, credential or source text.
begin isolation level repeatable read read only;
set local statement_timeout='15s';set local search_path='';
select jsonb_build_object('query_role',current_user,'database',current_database(),
 'rows',(select coalesce(jsonb_agg(jsonb_build_object('upload_id',u.id,'asset_id',u.asset_id,
  'status',u.status,'reservation_revision',u.reservation_revision,'expected_size_bytes',u.expected_size_bytes,
  'expected_sha256',u.expected_sha256,'asset_status',a.status,
  'associated_job_count',(select count(*)from eps.jobs j where j.input_asset_id=u.asset_id),
  'associated_candidate_media_count',(select count(*)from eps.candidate_media m where m.source_asset_id=u.asset_id))order by u.id),'[]')
  from eps.candidate_uploads u join eps.media_assets a on a.id=u.asset_id
  where u.workspace_id='e470aefd-e0f7-480c-bf0d-170cb2cb7069'and u.target_candidate_id is null
   and u.expected_sha256='f62a0fc95c1df06c08d92d73c749b992d58daecd4f66a0ef43ce9878d265d14a'
   and u.expected_size_bytes=37253969 and u.created_at>='2026-10-29T15:18:00Z'
   and u.created_at<'2026-10-29T15:24:00Z')
)as cancelled_transfer;
rollback;
