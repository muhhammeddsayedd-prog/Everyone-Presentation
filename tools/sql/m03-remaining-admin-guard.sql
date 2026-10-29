-- Fixed nonsecret preflight before any private literal-key SQL is sent.
begin isolation level repeatable read read only;
set local statement_timeout='15s';set local search_path='';
select jsonb_build_object('query_role',current_user,'database',current_database(),
 'unrestricted_visibility',(select rolsuper or rolbypassrls from pg_roles where rolname=current_user),
 'literal_key_logging_safe',current_setting('log_statement')='none'and current_setting('log_min_duration_statement')='-1'
  and current_setting('log_min_duration_sample')='-1'and current_setting('log_transaction_sample_rate')::numeric=0
  and coalesce(current_setting('pgaudit.log',true),'none')in('','none')
  and current_setting('log_statement_stats')='off'and current_setting('log_parser_stats')='off'and current_setting('log_planner_stats')='off'and current_setting('log_executor_stats')='off'
  and coalesce(current_setting('auto_explain.log_min_duration',true),'-1')='-1'
  and(case when exists(select 1 from pg_settings where name='pg_stat_statements.track')then has_parameter_privilege(current_user,'pg_stat_statements.track','SET')and has_parameter_privilege(current_user,'pg_stat_statements.track_utility','SET')else true end)
  and(case when exists(select 1 from pg_settings where name='auto_explain.log_min_duration')then has_parameter_privilege(current_user,'auto_explain.log_min_duration','SET')and has_parameter_privilege(current_user,'auto_explain.log_parameter_max_length','SET')else true end)
  and has_parameter_privilege(current_user,'log_min_error_statement','SET')and has_parameter_privilege(current_user,'log_statement','SET')
  and has_parameter_privilege(current_user,'log_min_duration_statement','SET')and has_parameter_privilege(current_user,'log_min_duration_sample','SET')
  and has_parameter_privilege(current_user,'log_parameter_max_length','SET')and has_parameter_privilege(current_user,'log_parameter_max_length_on_error','SET'),
 'key_privacy_verified',(select relrowsecurity and relforcerowsecurity from pg_class where oid='eps.support_verification_keys'::regclass)
  and not has_table_privilege('anon','eps.support_verification_keys','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
  and not has_table_privilege('authenticated','eps.support_verification_keys','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
  and not has_table_privilege('service_role','eps.support_verification_keys','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
  and not has_any_column_privilege('anon','eps.support_verification_keys','SELECT,INSERT,UPDATE,REFERENCES')
  and not has_any_column_privilege('authenticated','eps.support_verification_keys','SELECT,INSERT,UPDATE,REFERENCES')
  and not has_any_column_privilege('service_role','eps.support_verification_keys','SELECT,INSERT,UPDATE,REFERENCES')
  and not has_table_privilege('eps_support_upload_owner','eps.support_verification_keys','SELECT,INSERT,UPDATE,DELETE')
  and has_table_privilege('eps_support_verify_owner','eps.support_verification_keys','SELECT')
  and not has_table_privilege('eps_support_verify_owner','eps.support_verification_keys','INSERT,UPDATE,DELETE'),
 'candidate_active_jobs',(select count(*)from eps.jobs where kind='candidate_scan'and status in('queued','running')),
 'frame_active_jobs',(select count(*)from eps.jobs where kind='frame_extract'and status in('queued','running')),
 'leased_dispatches',(select count(*)from eps.outbox_events o join eps.jobs j on j.id=o.job_id where j.kind in('candidate_scan','frame_extract')and o.status='leased')
)as m03_remaining_admin;
rollback;
