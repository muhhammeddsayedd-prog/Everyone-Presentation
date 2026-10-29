-- Fixed authorized test profile; metadata only. No key, object path or document text.
begin isolation level repeatable read read only;
set local statement_timeout='15s';set local search_path='';set local timezone='UTC';
do $guard$begin
 if current_user<>'postgres' or current_database()<>'postgres'
 or not exists(select 1 from pg_roles where rolname=current_user and (rolsuper or rolbypassrls))
 or (select array_agg(version order by version) from supabase_migrations.schema_migrations) is distinct from
 array['20261028010943','20261028013324','20261028013655','20261028024205','20261028072515','20261028162702','20261028162800','20261028172320','20261028184145','20261028222030','20261029001520','20261029003941','20261029070038','20261029090500','20261029090724','20261029094600','20261029100500','20261029133455','20261029135318']::text[]
 or not exists(select 1 from eps.workspace_candidates where workspace_id='e470aefd-e0f7-480c-bf0d-170cb2cb7069' and candidate_id='b7341092-50c4-49b4-ad5f-a0ceedddebf1' and archived_at is null)
 then raise exception 'M03_SUPPORT_LIVE_SCOPE_UNCONFIRMED';end if;
end $guard$;
select jsonb_build_object('query_role',current_user,'database',current_database(),
 'candidate_id',c.id,'facts_sha256',encode(sha256(convert_to(c.facts::text,'UTF8')),'hex'),
 'reviewed',c.reviewed_facts_fingerprint is not null,'candidate_rows_sha256',(select encode(sha256(convert_to(coalesce(string_agg(to_jsonb(v)::text,E'\n' order by to_jsonb(v)::text),''),'UTF8')),'hex') from eps.candidates v),
 'jobs_count',(select count(*) from eps.jobs),
 'support',(select coalesce(jsonb_agg(jsonb_build_object('support_id',s.id,'asset_id',a.id,'candidate_id',s.candidate_id,'upload_id',u.id,
   'row_version',s.row_version,'archived',s.archived_at is not null,'asset_status',a.status,'asset_purpose',a.purpose,
   'mime_type',a.mime_type,'size_bytes',a.size_bytes,'sha256',a.sha256,'width',a.width,'height',a.height,
   'upload_status',u.status,'origin_workspace_id',a.origin_workspace_id,
   'reservation_matches',u.asset_id=a.id and u.candidate_id=c.id and u.expected_size_bytes=a.size_bytes and u.expected_sha256=a.sha256 and u.expected_mime_type=a.mime_type,
   'stored_object_exists',exists(select 1 from storage.objects o where o.bucket_id=u.bucket and o.name=u.object_key)) order by a.id),'[]')
  from eps.candidate_support s join eps.media_assets a on a.id=s.asset_id join eps.support_uploads u on u.id=s.upload_id
  where s.candidate_id=c.id and a.id in('092572d3-64ac-4bb5-bfe9-cb39830b850b','17ffa630-be3d-4be7-a03e-a5f3a6d132f8','59a586ac-d53a-4ede-8711-70195732b300','82bec606-9aa6-49c8-9c14-20463b8f5eb4'))
) as support_live from eps.candidates c where c.id='b7341092-50c4-49b4-ad5f-a0ceedddebf1';
rollback;
