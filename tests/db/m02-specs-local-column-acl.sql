-- Local8-only least-privilege proof. Every forbidden statement must fail at
-- column authorization even with zero rows; no real source is written.
begin;
do $$ begin
 if current_user<>'postgres' or current_setting('eps.local_fixture_tests',true) is distinct from 'eps-presentation-canonical-pg17-local'
   or not exists(select 1 from eps_local_guard.specs_local_fixture where id=1 and marker='EPS SPECS LOCAL V1')
   or (select count(*) from supabase_migrations.schema_migrations)<>8
   or not exists(select 1 from supabase_migrations.schema_migrations where version='20261028172320')
 then raise exception 'SPECS_LOCAL_EIGHT_VERSION_TARGET_REQUIRED'; end if;
end $$;
set local role eps_specs_owner;
do $$ declare item record; column_name text; actual text[]; begin
 for item in select * from (values
  ('specs',array['normalized_instructions','clarifications','row_version','updated_at']::text[],array[]::text[],
    array['id','workspace_id','source_asset_id','source_text','source_extraction','source_language_codes','source_row_version','processing_job_id','created_at']::text[]),
  ('roles',array['name','category','requirements','clarifications','headcount','archived_at','row_version','updated_at'],
    array['workspace_id','name','headcount','category','requirements','clarifications','sort_order'],
    array['id','workspace_id','spec_id','source_role','sort_order','created_at']),
  ('slots',array['label','provisional','archived_at','row_version','updated_at'],
    array['workspace_id','role_id','ordinal','label','sort_order','provisional'],
    array['id','workspace_id','role_id','ordinal','sort_order','created_at'])
 ) scopes(table_name,update_columns,insert_columns,denied_updates) loop
  select coalesce(array_agg(attribute.attname::text order by attribute.attname),array[]::text[]) into actual
   from pg_attribute attribute where attribute.attrelid=('eps.'||item.table_name)::regclass and attribute.attnum>0 and not attribute.attisdropped
    and has_column_privilege(current_user,attribute.attrelid,attribute.attnum,'UPDATE');
  if actual is distinct from array(select value from unnest(item.update_columns) value order by value)
   then raise exception 'SPECS_LOCAL_WORKING_UPDATE_ACL_MISMATCH'; end if;
  select coalesce(array_agg(attribute.attname::text order by attribute.attname),array[]::text[]) into actual
   from pg_attribute attribute where attribute.attrelid=('eps.'||item.table_name)::regclass and attribute.attnum>0 and not attribute.attisdropped
    and has_column_privilege(current_user,attribute.attrelid,attribute.attnum,'INSERT');
  if actual is distinct from array(select value from unnest(item.insert_columns) value order by value)
   then raise exception 'SPECS_LOCAL_WORKING_INSERT_ACL_MISMATCH'; end if;
  if has_table_privilege(current_user,'eps.'||item.table_name,'DELETE') or has_table_privilege(current_user,'eps.'||item.table_name,'TRUNCATE')
   then raise exception 'SPECS_LOCAL_UNEXPECTED_DESTRUCTIVE_AUTHORITY'; end if;
  foreach column_name in array item.denied_updates loop
   begin
    execute format('update eps.%I set %I=%I where false',item.table_name,column_name,column_name);
    raise exception 'SPECS_LOCAL_FORBIDDEN_UPDATE_DID_NOT_DENY';
   exception when insufficient_privilege then null;
   end;
  end loop;
 end loop;
 begin
  insert into eps.specs(workspace_id) select '7c710000-0000-4000-8000-000000000001'::uuid where false;
  raise exception 'SPECS_LOCAL_MANUAL_OWNER_CAN_INSERT_SPEC';
 exception when insufficient_privilege then null;
 end;
 begin
  insert into eps.roles(workspace_id,name,requirements,sort_order,source_role)
   select '7c710000-0000-4000-8000-000000000001'::uuid,'Forbidden', '{}'::jsonb,0,'{}'::jsonb where false;
  raise exception 'SPECS_LOCAL_MANUAL_OWNER_CAN_INSERT_ORIGINAL_ROLE';
 exception when insufficient_privilege then null;
 end;
 begin
  insert into eps.roles(workspace_id,name,requirements,sort_order,spec_id)
   select '7c710000-0000-4000-8000-000000000001'::uuid,'Forbidden', '{}'::jsonb,0,null::uuid where false;
  raise exception 'SPECS_LOCAL_MANUAL_OWNER_CAN_INSERT_SOURCE_ASSOCIATION';
 exception when insufficient_privilege then null;
 end;
end $$;
reset role;
select jsonb_build_object('working_column_acl_exact',true,'forbidden_source_identity_updates_denied',true,'original_source_inserts_denied',true,'source_written',false);
rollback;
