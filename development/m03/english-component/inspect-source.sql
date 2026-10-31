begin read only;
set local statement_timeout='8s';
with matched as (
 select a.id as source_asset_id,a.sha256 as source_sha256,c.id as candidate_media_id,
  c.transcript_asset_id,c.source_job_id,j.input_hash,c.original_transcript
 from eps.candidate_media c join eps.media_assets a on a.id=c.source_asset_id
 join eps.jobs j on j.id=c.source_job_id and j.kind='candidate_scan' and j.input_asset_id=a.id
 where a.sha256='ffe461d30d48b32d90f1165627e2d104b6817f61d96a5a4bd9dcd6ff1964fc0a'
  and c.original_transcript is not null and length(c.original_transcript) between 1 and 200000
)
select jsonb_build_object('database',current_database(),'operator',current_user,
 'history_count',(select count(*) from supabase_migrations.schema_migrations),
 'match_count',count(*),'source',case when count(*)=1 then jsonb_agg(jsonb_build_object(
  'source_asset_id',source_asset_id,'source_sha256',source_sha256,'candidate_media_id',candidate_media_id,
  'transcript_asset_id',transcript_asset_id,'source_job_id',source_job_id,'input_hash',input_hash,
  'original_text',original_transcript))->0 else null end) as english_component_source
from matched;
rollback;
