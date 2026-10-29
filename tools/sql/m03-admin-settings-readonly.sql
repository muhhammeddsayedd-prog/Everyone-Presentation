-- Role/settings only: no application table, key, literal credential or SET.
begin read only;
select jsonb_build_object('query_role',current_user,'session_role',session_user,'database',current_database(),
 'superuser',(select rolsuper from pg_roles where rolname=current_user),
 'bypass_rls',(select rolbypassrls from pg_roles where rolname=current_user),
 'settings',(select jsonb_object_agg(name,setting order by name)from pg_settings where name in(
 'log_statement','log_min_error_statement','log_min_duration_statement','log_min_duration_sample','log_transaction_sample_rate',
 'log_statement_stats','log_parser_stats','log_planner_stats','log_executor_stats','log_parameter_max_length','log_parameter_max_length_on_error',
 'pg_stat_statements.track','pg_stat_statements.track_utility','auto_explain.log_min_duration','auto_explain.log_parameter_max_length','pgaudit.log')),
 'set_privileges',(select jsonb_object_agg(name,has_parameter_privilege(current_user,name,'SET')order by name)from pg_settings where name in(
 'log_statement','log_min_error_statement','log_min_duration_statement','log_min_duration_sample','log_parameter_max_length','log_parameter_max_length_on_error',
 'pg_stat_statements.track','pg_stat_statements.track_utility','auto_explain.log_min_duration','auto_explain.log_parameter_max_length'))
)as m03_admin_settings;
rollback;
