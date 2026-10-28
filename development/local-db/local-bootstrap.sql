-- LOCAL CONTAINER FIXTURE ONLY. Never a cloud migration or an Auth implementation.
-- The runner checks Docker ownership, loopback bindings and DB fingerprint first.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
do $baseline$
begin
  if current_database() <> 'postgres' then raise exception 'LOCAL_DATABASE_REQUIRED'; end if;
  if to_regclass('auth.users') is null or to_regprocedure('auth.uid()') is null or to_regprocedure('auth.jwt()') is null then
    if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname in ('public','eps') and c.relkind in ('r','p')
        and not (n.nspname='public' and c.relname='spatial_ref_sys')) then
      raise exception 'REFUSING_AUTH_BOOTSTRAP_AFTER_APPLICATION_TABLES';
    end if;
  end if;
  if to_regclass('auth.users') is null then
    create schema if not exists auth;
    create table auth.users(id uuid primary key);
    comment on table auth.users is 'Synthetic local replay baseline only; not hosted Auth acceptance.';
  end if;
  if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
  if to_regprocedure('auth.uid()') is null then
    execute $function$create function auth.uid() returns uuid language sql stable as '
      select coalesce(nullif(current_setting(''request.jwt.claim.sub'', true), ''''),
        nullif(current_setting(''request.jwt.claims'', true), '''')::jsonb ->> ''sub'')::uuid
    '$function$;
  end if;
  if to_regprocedure('auth.jwt()') is null then
    if not exists(select 1 from pg_roles where rolname='supabase_auth_admin') then
      raise exception 'MANAGED_AUTH_OWNER_MISSING';
    end if;
    execute $function$create function auth.jwt() returns jsonb language sql stable
      set search_path = '' as '
        select coalesce(nullif(current_setting(''request.jwt.claims'', true), ''''), ''{}'')::jsonb
      '$function$;
    alter function auth.jwt() owner to supabase_auth_admin;
    comment on function auth.jwt() is 'Synthetic local replay helper only; not hosted Auth or JWT verification.';
  end if;
end
$baseline$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant execute on function auth.jwt() to anon, authenticated, service_role;
commit;
