-- Read-only metadata only. No Auth/business row or credential value is read.
begin read only;set local search_path='';set local statement_timeout='15s';
select jsonb_build_object('operator',current_user,'database',current_database(),'observed_at',clock_timestamp(),
 'postgres_uses_auth_owner',pg_has_role('postgres','supabase_auth_admin','USAGE'),
 'postgres_sets_auth_owner',pg_has_role('postgres','supabase_auth_admin','SET'),
 'tables',(select jsonb_agg(jsonb_build_object('relation',c.oid::regclass::text,'owner',pg_get_userbyid(c.relowner),'postgres_select',has_table_privilege('postgres',c.oid,'SELECT'),'postgres_select_grant_option',has_table_privilege('postgres',c.oid,'SELECT WITH GRANT OPTION'))order by c.relname)from pg_class c where c.oid in('auth.oauth_authorizations'::regclass,'auth.oauth_clients'::regclass,'auth.sessions'::regclass))
)as oauth_grant_authority;
rollback;
