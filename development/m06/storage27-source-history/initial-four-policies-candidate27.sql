-- Bounded forward27: compose guest/internal export reads with existing guards.
-- No role, function, bucket, credential, data, TTL or configuration mutation.
set local search_path='';set local lock_timeout='3s';set local statement_timeout='30s';
do $m06_storage_forward$
declare item record;previous text;next_qual text;expected_roles oid[];guest_branch text;
begin
 if current_user<>'postgres'or current_database()<>'postgres'
 or(select count(*)from supabase_migrations.schema_migrations)<>26
 or(select max(version)from supabase_migrations.schema_migrations)<>'20261030004643'
 or not exists(select 1 from supabase_migrations.schema_migrations where version='20261030004643'and name='m06_credential_admission_guest_retry')
 then raise exception'M06_STORAGE_EXACT_REVIEWED26_REQUIRED';end if;
 if(select count(*)from pg_policy where polrelid='storage.objects'::regclass and polname in('eps_logo_read_guard','eps_candidate_read_guard','presentation_output_read_guard','m06_guest_storage_select'))<>4
 then raise exception'M06_STORAGE_EXACT_PREDECESSOR_POLICIES_REQUIRED';end if;
 guest_branch:='bucket_id IN(''eps-brand-assets'',''eps-candidate-assets'',''eps-candidate-outputs'',''eps-presentation-outputs'') AND(storage.allow_only_operation(''object.get_authenticated'')OR storage.allow_only_operation(''object.get_authenticated_info''))AND eps.guest_storage_allowed(bucket_id,name)';
 for item in select * from(values
  ('eps_candidate_read_guard',false,'public','3fcbb40c6eac80a5b5547444a518e6304a7ebc0fb38b63baadd9a60f2aaa8a97'),
  ('eps_logo_read_guard',false,'authenticated','cb561a6de7cd572f26c48d43c2f52e8a1c5045c7cf5f61c648fd4fe108e03fcc'),
  ('presentation_output_read_guard',false,'public','bb25cd4ac00461ebf9fe1cf35583788638d3630212fc996cfc3c65419a8fed0d'),
  ('m06_guest_storage_select',true,'anon_authenticated','f73bb0bbe1dee3425458b2c85f5d104be7e004f4121373ed888a571136ebefb6')
 )v(policy_name,permissive,role_scope,source_sha256)loop
  expected_roles:=case item.role_scope when'public'then array[0::oid]when'authenticated'then array[(select oid from pg_roles where rolname='authenticated')]else array[(select oid from pg_roles where rolname='anon'),(select oid from pg_roles where rolname='authenticated')]end;
  select pg_get_expr(polqual,polrelid)into previous from pg_policy where polrelid='storage.objects'::regclass and polname=item.policy_name
   and polcmd='r'and polpermissive=item.permissive and polroles=expected_roles and polwithcheck is null;
  if previous is null or encode(sha256(convert_to(previous,'UTF8')),'hex')<>item.source_sha256 then raise exception'M06_STORAGE_EXACT_PREDECESSOR_EXPRESSION_REQUIRED:%',item.policy_name;end if;
  if item.policy_name='m06_guest_storage_select'then
   next_qual:='('||previous||')AND bucket_id IN(''eps-brand-assets'',''eps-candidate-assets'',''eps-candidate-outputs'',''eps-presentation-outputs'')AND(storage.allow_only_operation(''object.get_authenticated'')OR storage.allow_only_operation(''object.get_authenticated_info''))';
  else
   next_qual:='('||previous||')OR('||guest_branch||')';
   if item.policy_name='presentation_output_read_guard'then
    next_qual:=next_qual||'OR(bucket_id=''eps-presentation-outputs''AND(storage.allow_only_operation(''object.get_authenticated'')OR storage.allow_only_operation(''object.get_authenticated_info'')OR storage.allow_only_operation(''object.sign''))AND eps.export_storage_read_allowed(bucket_id,name))';
   end if;
  end if;
  execute format('alter policy %I on storage.objects using(%s)',item.policy_name,next_qual);
 end loop;
end$m06_storage_forward$;
