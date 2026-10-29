-- TEMPLATE ONLY. Root helper substitutes bounded fixed hex/history/action into
-- an owner/SYSTEM private file. Never execute this source template directly.
begin;
-- Disable utility/nested statement persistence before the literal-key DO body.
-- PG17 pg_stat_statements stores statement slices using stmt_location/stmt_len;
-- an owned-local synthetic sentinel regression must pass before root execution.
set local pg_stat_statements.track_utility='off';set local pg_stat_statements.track='none';
set local auto_explain.log_min_duration=-1;set local auto_explain.log_parameter_max_length=0;
set local lock_timeout='5s';set local statement_timeout='30s';set local search_path='';
set local log_statement='none';set local log_min_error_statement='panic';
set local log_min_duration_statement=-1;set local log_min_duration_sample=-1;
set local log_parameter_max_length=0;set local log_parameter_max_length_on_error=0;
do $operation$declare changed integer;begin
 if current_user<>'postgres'or current_database()<>'postgres'or not(select rolsuper or rolbypassrls from pg_roles where rolname=current_user)
 or(select array_agg(version order by version)from supabase_migrations.schema_migrations)is distinct from array[__VERSIONS__]::text[]
 then raise exception'M03_REMAINING_EXACT19_ADMIN_REQUIRED';end if;
 perform pg_advisory_xact_lock(hashtextextended('eps.m03.remaining.activation',0));
 if '__ACTION__'in('provision','enable')then
  perform 1 from eps.frame_extraction_config where id for update;perform 1 from eps.candidate_support_config where id for update;
  if not exists(select 1 from eps.frame_extraction_config where id and not enabled and native_image_id is null and implementation_version='frame-extraction.v1')
   or not exists(select 1 from eps.candidate_support_config where id and not uploads_enabled)then raise exception'M03_REMAINING_DISABLED_CONFIG_REQUIRED';end if;
 end if;
 if '__ACTION__'='provision'then
  if exists(select 1 from eps.support_verification_keys where key_id='eps-candidate-support-local-20261029-v1')then raise exception'M03_SUPPORT_KEY_ALREADY_EXISTS_NO_OVERWRITE';end if;
  insert into eps.support_verification_keys(key_id,purpose,secret)values('eps-candidate-support-local-20261029-v1','candidate_support',decode('__KEY_HEX__','hex'));
  get diagnostics changed=row_count;if changed<>1 then raise exception'M03_SUPPORT_KEY_INSERT_UNCONFIRMED';end if;
 elsif '__ACTION__'='enable'then
  perform 1 from eps.support_verification_keys where key_id='eps-candidate-support-local-20261029-v1'for update;
  if not exists(select 1 from eps.support_verification_keys where key_id='eps-candidate-support-local-20261029-v1'and purpose='candidate_support'and octet_length(secret)=32 and secret=decode('__KEY_HEX__','hex')and revoked_at is null and not_before<=clock_timestamp()and not_after is null)
   then raise exception'M03_SUPPORT_ACTIVE_MATCHING_KEY_REQUIRED';end if;
  if exists(select 1 from eps.jobs where kind in('candidate_scan','frame_extract')and status in('queued','running'))or exists(select 1 from eps.outbox_events o join eps.jobs j on j.id=o.job_id where j.kind in('candidate_scan','frame_extract')and o.status='leased')then raise exception'M03_REMAINING_QUEUE_DRAIN_REQUIRED';end if;
  update eps.frame_extraction_config set enabled=true,native_image_id='sha256:ea6e27d158a843fee524d7f43f2f88a4ede8bc58e8ac32578b7dec5c1594ba6b'where id and not enabled and native_image_id is null;
  get diagnostics changed=row_count;if changed<>1 then raise exception'M03_FRAME_CONFIG_ENABLE_UNCONFIRMED';end if;
  update eps.candidate_support_config set uploads_enabled=true where id and not uploads_enabled;
  get diagnostics changed=row_count;if changed<>1 then raise exception'M03_SUPPORT_CONFIG_ENABLE_UNCONFIRMED';end if;
 elsif '__ACTION__'<>'inspect'then raise exception'M03_REMAINING_FIXED_ACTION_REQUIRED';end if;
end $operation$;
select jsonb_build_object('query_role',current_user,'database',current_database(),
 'unrestricted_visibility',(select rolsuper or rolbypassrls from pg_roles where rolname=current_user),
 'privacy_verified',(select relrowsecurity and relforcerowsecurity from pg_class where oid='eps.support_verification_keys'::regclass)
  and not has_table_privilege('authenticated','eps.support_verification_keys','SELECT,INSERT,UPDATE,DELETE')
  and not has_table_privilege('anon','eps.support_verification_keys','SELECT,INSERT,UPDATE,DELETE')
  and not has_table_privilege('service_role','eps.support_verification_keys','SELECT,INSERT,UPDATE,DELETE')
  and not has_table_privilege('eps_support_upload_owner','eps.support_verification_keys','SELECT'),
 'action','__ACTION__','key_inserted','__ACTION__'='provision','configuration_changed','__ACTION__'='enable',
 'configured_key_exists',exists(select 1 from eps.support_verification_keys where key_id='eps-candidate-support-local-20261029-v1'),
 'key_matches',coalesce((select secret=decode('__KEY_HEX__','hex')from eps.support_verification_keys where key_id='eps-candidate-support-local-20261029-v1'),false),
 'key_bytes',(select octet_length(secret)from eps.support_verification_keys where key_id='eps-candidate-support-local-20261029-v1'),
 'key_active',coalesce((select purpose='candidate_support'and revoked_at is null and not_before<=clock_timestamp()and not_after is null from eps.support_verification_keys where key_id='eps-candidate-support-local-20261029-v1'),false),
 'key_metadata',(select to_jsonb(k)from(select key_id,purpose,not_before,not_after,revoked_at,created_at from eps.support_verification_keys where key_id='eps-candidate-support-local-20261029-v1')k)
)as m03_remaining_key;
commit;
