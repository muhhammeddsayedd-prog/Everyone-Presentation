-- Supplement: metadata only. No Auth/config rows, credential or token values.
begin read only;
select jsonb_build_object(
 'observed_at',clock_timestamp(),
 'auth_session_policies',(select coalesce(jsonb_agg(to_jsonb(p)order by policyname),'[]'::jsonb)from pg_policies p where schemaname='auth'and tablename='sessions'),
 'postgres_sessions_select_grant_option',has_table_privilege('postgres','auth.sessions','SELECT WITH GRANT OPTION'),
 'postgres_sessions_column_grant_options',(select jsonb_object_agg(column_name,has_column_privilege('postgres','auth.sessions',column_name,'SELECT WITH GRANT OPTION'))from unnest(array['id','user_id','oauth_client_id','not_after','scopes'])column_name),
 'postgres_auth_admin_membership',pg_has_role('postgres','supabase_auth_admin','MEMBER'),
 'postgres_auth_schema_usage',has_schema_privilege('postgres','auth','USAGE'),
 'policy_grants',current_setting('supautils.policy_grants',true),
 'privileged_role',current_setting('supautils.privileged_role',true),
 'managed_auth_other_read_grants',(select jsonb_agg(jsonb_build_object('table',table_name,'select_grant_option',has_table_privilege('postgres','auth.'||table_name,'SELECT WITH GRANT OPTION'))order by table_name)from unnest(array['oauth_clients','oauth_consents'])table_name)
)as m07_managed_auth_privileges;
rollback;
