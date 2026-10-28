-- SIMULATED LOCAL STORAGE CATALOG FOR SQL POLICY TESTS ONLY.
-- This is not a Supabase Storage server, byte store, Auth service, or cloud migration.
-- tools/local-postgres.mjs verifies the owned loopback container and exact reviewed
-- file hash, then wraps this fixed script and its marker in one transaction.
do $guard$
begin
  if current_user <> 'supabase_admin'
    or not (select rolsuper from pg_roles where rolname=current_user)
    or current_database() <> 'postgres'
    or current_setting('eps.local_fixture_tests',true) is distinct from 'eps-presentation-canonical-pg17-local'
    or coalesce(current_setting('eps.local_storage_baseline_sha256',true),'') !~ '^[a-f0-9]{64}$'
    or to_regclass('eps_local_guard.instance') is null then
    raise exception 'VERIFIED_LOCAL_STORAGE_SIMULATION_REQUIRED';
  end if;
  if to_regclass('eps_local_guard.storage_baseline') is not null then
    raise exception 'LOCAL_STORAGE_BASELINE_ALREADY_EXISTS_USE_GUARDED_HASH_CHECK';
  end if;
  if not exists(select 1 from pg_namespace where nspname='storage'
    and pg_get_userbyid(nspowner)='supabase_admin') then
    raise exception 'EXPECTED_EMPTY_MANAGED_STORAGE_NAMESPACE_REQUIRED';
  end if;
  if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='storage')
    or exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='storage')
    or exists(select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='storage') then
    raise exception 'REFUSING_TO_ADOPT_EXISTING_STORAGE_OBJECTS';
  end if;
  if not exists(select 1 from pg_roles where rolname='supabase_storage_admin'
    and not rolsuper and not rolbypassrls and not rolinherit and rolcanlogin)
    or pg_has_role('postgres','supabase_storage_admin','MEMBER') then
    raise exception 'MANAGED_STORAGE_ROLE_BOUNDARY_DIFFERS';
  end if;
  if not coalesce(current_setting('supautils.policy_grants',true)::jsonb->'postgres'
    @> '["storage.buckets","storage.objects"]'::jsonb,false) then
    raise exception 'EXISTING_NARROW_SUPAUTILS_POLICY_GRANTS_REQUIRED';
  end if;
end
$guard$;

-- Keep the image's existing managed schema/roles/grants/configuration unchanged.
-- New simulated entities have the same table/helper owner as the hosted catalog.
set local role supabase_storage_admin;

create table storage.buckets (
  id text primary key,
  name text not null unique,
  owner uuid,
  owner_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text,
  owner uuid,
  owner_id text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  last_accessed_at timestamptz default now(),
  unique(bucket_id,name)
);
alter table storage.buckets enable row level security;
alter table storage.objects enable row level security;

-- Semantic reproduction of the observed generic helpers. Context is supplied by
-- synthetic SQL tests; there is no HTTP router or verified JWT here.
create function storage.operation() returns text language sql stable
  set search_path='' as $$ select current_setting('storage.operation',true) $$;
create function storage.allow_only_operation(expected_operation text) returns boolean
  language sql stable set search_path='' as $$
    select coalesce(
      case when storage.operation() like 'storage.%' then substr(storage.operation(),9) else storage.operation() end
      = case when expected_operation like 'storage.%' then substr(expected_operation,9) else expected_operation end
      and expected_operation <> '', false)
  $$;
create function storage.allow_any_operation(expected_operations text[]) returns boolean
  language sql stable set search_path='' as $$
    select exists(select 1 from unnest(expected_operations) expected_operation
      where expected_operation is not null and expected_operation <> ''
        and storage.allow_only_operation(expected_operation))
  $$;

-- Fresh cloud ACL receipt 2026-10-28T02:53:56Z: ordinary roles arwd only;
-- service_role all; postgres all WITH GRANT OPTION. RLS still limits DML.
grant select,insert,update,delete on storage.buckets,storage.objects to anon,authenticated;
grant all privileges on storage.buckets,storage.objects to service_role;
grant all privileges on storage.buckets,storage.objects to postgres with grant option;
revoke all on function storage.operation(),storage.allow_only_operation(text),storage.allow_any_operation(text[]) from public;
grant execute on function storage.operation(),storage.allow_only_operation(text),storage.allow_any_operation(text[])
  to postgres,anon,authenticated,service_role;
comment on table storage.buckets is 'SIMULATED local SQL policy fixture only; no hosted Storage or HTTP acceptance.';
comment on table storage.objects is 'SIMULATED local SQL policy fixture only; no bytes, signed tokens, versioning, or provider triggers.';

reset role;
create table eps_local_guard.storage_baseline (
  id integer primary key check(id=1),
  version integer not null check(version=1),
  sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
  catalog jsonb not null,
  created_at timestamptz not null default clock_timestamp()
);
alter table eps_local_guard.storage_baseline owner to postgres;
revoke all on eps_local_guard.storage_baseline from public,anon,authenticated,service_role;
insert into eps_local_guard.storage_baseline(id,version,sha256,catalog)
select 1,1,current_setting('eps.local_storage_baseline_sha256'),jsonb_build_object(
  'schema',(select jsonb_build_object('oid',oid,'owner',pg_get_userbyid(nspowner)) from pg_namespace where nspname='storage'),
  'relations',(select jsonb_agg(jsonb_build_object('oid',c.oid,'name',c.relname,'kind',c.relkind,'owner',pg_get_userbyid(c.relowner),'rls',c.relrowsecurity,'force',c.relforcerowsecurity) order by c.relname)
    from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='storage'),
  'columns',(select jsonb_agg(jsonb_build_object('table',c.relname,'name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid)) order by c.relname,a.attnum)
    from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
    where n.nspname='storage' and c.relkind='r' and a.attnum>0 and not a.attisdropped),
  'functions',(select jsonb_agg(jsonb_build_object('oid',p.oid,'identity',p.oid::regprocedure::text,'owner',pg_get_userbyid(p.proowner),'definition',pg_get_functiondef(p.oid)) order by p.oid::regprocedure::text)
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='storage')
);
