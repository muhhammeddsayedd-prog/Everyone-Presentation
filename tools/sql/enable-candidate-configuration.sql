-- Fixed one-row runtime configuration activation. No ACL/schema/identity change.
-- Invoked only by the explicitly enabled, guarded root release helper.
begin;
set local statement_timeout='10s';
set local lock_timeout='3s';
set local search_path='';
do $activation$
declare prior jsonb; current_value jsonb; changed integer;
begin
 if current_user<>'postgres' or current_database()<>'postgres'
  or not exists(select 1 from pg_roles where rolname=current_user and (rolsuper or rolbypassrls))
  or (select array_agg(version order by version) from supabase_migrations.schema_migrations) is distinct from
   array['20261028010943','20261028013324','20261028013655','20261028024205','20261028072515','20261028162702','20261028162800','20261028172320','20261028184145','20261028222030','20261029001520','20261029003941','20261029070038','20261029090500','20261029090724','20261029094600','20261029100500']::text[]
  or (select count(*) from eps.candidate_asset_config)<>1
  or exists(select 1 from eps.jobs where kind='candidate_scan' and status in('queued','running'))
  or exists(select 1 from eps.candidate_uploads where status='open' and expires_at>clock_timestamp())
 then raise exception 'CANDIDATE_CONFIGURATION_ACTIVATION_PRECONDITION_FAILED'; end if;
 select to_jsonb(c) into prior from eps.candidate_asset_config c where id for update;
 if prior is distinct from jsonb_build_object('id',true,'enabled',false,'transcription_model',null,'extraction_model',null,
  'prompt_version','candidate-v1','schema_version','1.0','media_implementation_version','video-preparation.v1')
 then raise exception 'CANDIDATE_CONFIGURATION_PRISTINE_DISABLED_REQUIRED'; end if;
 update eps.candidate_asset_config set enabled=true,transcription_model='gpt-transcribe',extraction_model='gpt-6.1-sol'
  where id and not enabled and transcription_model is null and extraction_model is null;
 get diagnostics changed=row_count;
 if changed<>1 then raise exception 'CANDIDATE_CONFIGURATION_SINGLE_ROW_REQUIRED'; end if;
 select to_jsonb(c) into current_value from eps.candidate_asset_config c where id;
 perform set_config('eps.candidate_activation.result',jsonb_build_object('before',prior,'after',current_value,'changed_rows',changed)::text,true);
end $activation$;
select current_setting('eps.candidate_activation.result')::jsonb as candidate_activation;
commit;
