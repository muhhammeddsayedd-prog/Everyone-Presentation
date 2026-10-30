begin isolation level repeatable read read only;
set local search_path='';set local lock_timeout='3s';set local statement_timeout='15s';
select jsonb_build_object(
 'query_role',current_user,'database',current_database(),
 'unrestricted_visibility',exists(select 1 from pg_roles where rolname=current_user and(rolsuper or rolbypassrls)),
 'versions',(select jsonb_agg(version order by version)from supabase_migrations.schema_migrations),
 'configuration',(select jsonb_build_object('count',count(*),'enabled',bool_or(enabled),'key_present',bool_or(backend_key is not null),
   'key_bytes',coalesce(max(octet_length(backend_key)),0),'replay_ttl_seconds',min(replay_ttl_seconds),'session_ttl_seconds',min(session_ttl_seconds))from eps.review_gateway_config),
 'constraints_sha256',(select encode(sha256(convert_to(coalesce(string_agg(conname||E'\n'||pg_get_constraintdef(oid),E'\n'order by conname),''),'UTF8')),'hex')from pg_constraint where conrelid='eps.review_gateway_config'::regclass),
 'user_triggers',(select count(*)from pg_trigger where tgrelid='eps.review_gateway_config'::regclass and not tgisinternal),
 'rules',(select count(*)from pg_rewrite where ev_class='eps.review_gateway_config'::regclass)
)as guest_key_state;
rollback;
