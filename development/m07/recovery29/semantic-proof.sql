-- Independent literal/catalogue-only proof. No business/Auth rows or DDL.
begin isolation level repeatable read read only;
set local search_path = '';
set local timezone = 'UTC';
set local statement_timeout = '30s';
set local standard_conforming_strings = on;
with
truth(value) as (values (false), (true), (null::boolean)),
truth_rows as (
 select a.value a,b.value b,c.value c,d.value d,
  (((a.value and b.value) and c.value) and d.value) grouped,
  (a.value and b.value and c.value and d.value) flattened
 from truth a cross join truth b cross join truth c cross join truth d
),
resources(case_id,resource) as (values
 ('null',null::text),('empty',''),('plain','mcp'),('space_only',' '),
 ('https_host','https://studio.example'),('https_path','https://studio.example/mcp'),
 ('https_root','https://studio.example/'),('https_no_host','https:///mcp'),
 ('https_userinfo','https://user@studio.example/mcp'),
 ('https_query','https://studio.example/mcp?x=1'),
 ('https_fragment','https://studio.example/mcp#x'),
 ('https_uppercase_scheme','HTTPS://studio.example/mcp'),
 ('leading_space',' https://studio.example/mcp'),
 ('trailing_space','https://studio.example/mcp '),
 ('path_space','https://studio.example/a b'),
 ('tab','https://studio.example/'||chr(9)||'mcp'),
 ('line_feed','https://studio.example/mcp'||chr(10)),
 ('carriage_return','https://studio.example/mcp'||chr(13)),
 ('control_1','https://studio.example/'||chr(1)||'mcp'),
 ('delete_127','https://studio.example/'||chr(127)||'mcp'),
 ('nbsp','https://studio.example/'||chr(160)||'mcp'),
 ('em_space','https://studio.example/'||chr(8195)||'mcp'),
 ('ipv4','http://127.0.0.1/mcp'),('localhost','http://localhost/mcp'),
 ('ipv6','http://[::1]/mcp'),('port_1','http://localhost:1/mcp'),
 ('port_65535','http://localhost:65535/mcp'),
 ('port_99999','http://localhost:99999/mcp'),
 ('port_zero','http://localhost:0/mcp'),
 ('port_six_digits','http://localhost:123456/mcp'),
 ('http_other_loopback','http://127.0.0.2/mcp'),
 ('http_non_loopback','http://studio.example/mcp'),
 ('http_trailing_slash','http://localhost/mcp/'),
 ('http_query','http://localhost/mcp?x=1'),
 ('https_length_2048','https://x/'||repeat('a',2038)),
 ('https_length_2049','https://x/'||repeat('a',2039))
),
resource_rows as (
 select case_id,length(resource) characters,
  ((((length(resource) >= 1) AND (length(resource) <= 2048)) AND (resource !~ '[[:cntrl:][:space:]]'::text) AND ((resource ~ '^https://[^/@?#]+(/[^?#]*)?$'::text) OR (resource ~ '^http://(127\.0\.0\.1|localhost|\[::1\])(:[0-9]{1,5})?/mcp$'::text)))) source_result,
  (((length(resource) >= 1) AND (length(resource) <= 2048) AND (resource !~ '[[:cntrl:][:space:]]'::text) AND ((resource ~ '^https://[^/@?#]+(/[^?#]*)?$'::text) OR (resource ~ '^http://(127\.0\.0\.1|localhost|\[::1\])(:[0-9]{1,5})?/mcp$'::text)))) dump_result
 from resources
),
acl_input(label,acl) as (values
 ('source','{postgres=ar*wdDxtm/supabase_auth_admin,supabase_auth_admin=arwdDxtm/supabase_auth_admin,dashboard_user=arwdDxtm/supabase_auth_admin}'::aclitem[]),
 ('dump_clone','{supabase_auth_admin=arwdDxtm/supabase_auth_admin,postgres=ar*wdDxtm/supabase_auth_admin,dashboard_user=arwdDxtm/supabase_auth_admin}'::aclitem[])
),
acl_rows as (
 select label,jsonb_agg(jsonb_build_object('grantor',grantor,'grantee',grantee,'privilege',privilege_type,'is_grantable',is_grantable) order by grantor,grantee,privilege_type,is_grantable) entries
 from acl_input cross join lateral aclexplode(acl) group by label
),
functions(identity) as (values
 ('pg_catalog.length(text)'::regprocedure),
 ('pg_catalog.textregexeq(text,text)'::regprocedure),
 ('pg_catalog.textregexne(text,text)'::regprocedure),
 ('pg_catalog.texteq(text,text)'::regprocedure),
 ('pg_catalog.int4ge(integer,integer)'::regprocedure),
 ('pg_catalog.int4le(integer,integer)'::regprocedure),
 ('pg_catalog.btrim(text)'::regprocedure)
),
builtins as (
 select identity::text identity,p.provolatile,p.proisstrict,p.proparallel,n.nspname schema
 from functions join pg_proc p on p.oid=identity join pg_namespace n on n.oid=p.pronamespace
),
actual_constraint as (
 select pg_get_constraintdef(c.oid) definition,c.convalidated,
  (select a.attnotnull from pg_attribute a where a.attrelid=c.conrelid and a.attname='resource' and not a.attisdropped) resource_not_null
 from pg_constraint c join pg_namespace n on n.oid=c.connamespace
 where n.nspname='eps' and c.conrelid='eps.mcp_oauth_resources'::regclass and c.conname='mcp_oauth_resources_resource_check'
),
actual_acl as (select c.relacl::text acl from pg_class c where c.oid='auth.sessions'::regclass)
select jsonb_build_object(
 'environment',jsonb_build_object('database',current_database(),'user',current_user,'server_version',current_setting('server_version'),'transaction_read_only',current_setting('transaction_read_only'),'server_encoding',current_setting('server_encoding'),'lc_ctype',(select datctype from pg_database where datname=current_database()),'locale_provider',(select datlocprovider from pg_database where datname=current_database()),'standard_conforming_strings',current_setting('standard_conforming_strings')),
 'three_valued_logic',jsonb_build_object('cases',(select count(*) from truth_rows),'result_mismatches',(select count(*) from truth_rows where grouped is distinct from flattened),'check_acceptance_mismatches',(select count(*) from truth_rows where (grouped is distinct from false) is distinct from (flattened is distinct from false)),'rows',(select jsonb_agg(jsonb_build_object('a',a,'b',b,'c',c,'d',d,'source',grouped,'dump_clone',flattened) order by a nulls last,b nulls last,c nulls last,d nulls last) from truth_rows)),
 'resource_check',jsonb_build_object('cases',(select count(*) from resource_rows),'result_mismatches',(select count(*) from resource_rows where source_result is distinct from dump_result),'check_acceptance_mismatches',(select count(*) from resource_rows where (source_result is distinct from false) is distinct from (dump_result is distinct from false)),'rows',(select jsonb_agg(jsonb_build_object('case_id',case_id,'characters',characters,'source',source_result,'dump_clone',dump_result,'check_accepts',source_result is distinct from false) order by case_id) from resource_rows),'actual_constraint',(select to_jsonb(actual_constraint) from actual_constraint),'null_semantics','CHECK accepts TRUE or NULL; NOT NULL separately rejects a NULL resource. PostgreSQL text cannot contain a NUL byte, so U+0000 is outside this input domain.'),
 'auth_sessions_acl',jsonb_build_object('same_expanded_privileges',(select entries from acl_rows where label='source')=(select entries from acl_rows where label='dump_clone'),'entries',(select entries from acl_rows where label='source'),'actual_source_acl',(select acl from actual_acl)),
 'builtins',jsonb_build_object('count',(select count(*) from builtins),'all_immutable',(select bool_and(provolatile='i' and schema='pg_catalog') from builtins),'all_strict',(select bool_and(proisstrict) from builtins),'rows',(select jsonb_agg(to_jsonb(builtins) order by identity) from builtins))
);
rollback;
