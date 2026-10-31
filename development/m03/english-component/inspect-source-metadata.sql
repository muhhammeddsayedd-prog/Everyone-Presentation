begin read only;
set local statement_timeout='8s';
with matched as (
 select c.id as candidate_media_id,c.candidate_id,c.source_asset_id,c.transcript_asset_id,c.source_job_id,
  c.original_transcript is not null and length(c.original_transcript)>0 as raw_present,
  c.original_transcript is not null and length(c.original_transcript) between 1 and 200000 as raw_within_legacy_bound,
  j.id is not null and j.kind='candidate_scan' and j.input_asset_id=a.id as scan_job_source_matches
 from eps.candidate_media c join eps.media_assets a on a.id=c.source_asset_id
 left join eps.jobs j on j.id=c.source_job_id
 where a.sha256='ffe461d30d48b32d90f1165627e2d104b6817f61d96a5a4bd9dcd6ff1964fc0a'
),limited as(select * from matched order by candidate_media_id limit 20)
select jsonb_build_object('database',current_database(),'operator',current_user,
 'history_count',(select count(*) from supabase_migrations.schema_migrations),
 'total',(select count(*) from matched),'rows',coalesce(jsonb_agg(to_jsonb(limited)),'[]'::jsonb)) as english_component_metadata
from limited;
rollback;
