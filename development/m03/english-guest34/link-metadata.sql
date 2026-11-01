-- Fixed self-test label/series only; never select bearer/session material.
begin isolation level repeatable read read only;
set local search_path='';
set local statement_timeout='15s';
set local timezone='UTC';
with observed as(select statement_timestamp() as at),scope as(
 select s.id,s.workspace_id,s.latest_ready_version_id,s.latest_ready_version_no
 from eps.presentation_series s join eps.presentation_versions v on v.id=s.latest_ready_version_id
 join eps.workspaces w on w.id=s.workspace_id join public.projects p on p.id=w.project_id
 where s.id='93fb7425-7311-4b69-94cb-61588724c153'::uuid
 and s.workspace_id='86936940-b48d-497d-b1ff-8e0da0913afa'::uuid
 and p.id='6da14b82-8458-451f-aa21-28cb6c85bdc5'::uuid
 and not s.archived and w.archived_at is null and p.archived_at is null
 and v.id='4f1b81a1-adb7-425b-8223-458d8bd82c28'::uuid
 and v.series_id=s.id and v.workspace_id=s.workspace_id and v.status='ready'
 and v.version_number=1 and s.latest_ready_version_no=1
),matched as(
 select l.id,l.series_id,s.workspace_id,l.row_version,l.created_at,l.expires_at,l.revoked_at,l.download_enabled,
 s.latest_ready_version_id,s.latest_ready_version_no
 from eps.review_links l join scope s on s.id=l.series_id
 where l.label='English rollout self-test — revoke after check'
),bounded_sessions as(
 select g.expires_at from eps.guest_sessions g
 where g.review_link_id=(select id from matched limit 1) limit 101
)
select jsonb_build_object('database',current_database(),'operator',current_user,'observed_at',(select at from observed),'read_only',true,
 'exact_history34',(select encode(sha256(convert_to(jsonb_agg(version order by version)::text,'UTF8')),'hex')
 from supabase_migrations.schema_migrations)='6a58bdde0319e8e1f388dd9b61a6fe4e702c15c8a708e0860b50b985aee2fb3e',
 'english_enabled',(select count(*)=1 and bool_and(english_transcript_version='1.0')from eps.candidate_asset_config),
 'scope_match_count',(select count(*)from scope),'link_match_count',(select count(*)from matched),
 'link',(select jsonb_build_object('review_link_id',id,'series_id',series_id,'workspace_id',workspace_id,'row_version',row_version,
 'created_at',created_at,'expires_at',expires_at,'revoked_at',revoked_at,'download_enabled',download_enabled,
 'current_ready_version_id',latest_ready_version_id,'current_ready_version_no',latest_ready_version_no)from matched limit 1),
 'guest_session_rows',(select jsonb_build_object('limit',100,'truncated',count(*)>100,
 'count',case when count(*)<=100 then count(*)end,
 'unexpired_row_count',case when count(*)<=100 then count(*)filter(where expires_at>(select at from observed))end)from bounded_sessions)
)as guest_link_metadata;
rollback;
