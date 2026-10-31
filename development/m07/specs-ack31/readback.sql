-- Metadata SELECT only; caller owns the read-only transaction and target proof.
select jsonb_build_object(
 'database',current_database(),'operator',current_user,
 'history',(select array_agg(version order by version)from supabase_migrations.schema_migrations),
 'owner',p.proowner::regrole::text,'acl',p.proacl::text,
 'private_invoker',not p.prosecdef,'language',(select lanname from pg_language where oid=p.prolang),
 'volatility',p.provolatile,'search_path',p.proconfig,
 'body_sha256',encode(sha256(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'UTF8')),'hex'),
 'owner_ack_execute',has_function_privilege('eps_specs_submit_owner',p.oid,'EXECUTE'),
 'public_callers_denied',(select bool_and(not has_function_privilege(role,p.oid,'EXECUTE'))from unnest(array['anon','authenticated','service_role'])role),
 'existing_projection_columns_granted',(select bool_and(has_column_privilege('eps_specs_submit_owner',relation,column_name,'SELECT'))from(values
  ('eps.jobs','id'),('eps.jobs','kind'),('eps.jobs','resource_id'),('eps.jobs','status'),('eps.jobs','workspace_id'),('eps.specs','id'),('eps.specs','workspace_id'))v(relation,column_name)),
 'whole_job_select_still_denied',not has_table_privilege('eps_specs_submit_owner','eps.jobs','SELECT'),
 'generic_jobs_dto_sha256',(select encode(sha256(convert_to(replace(prosrc,E'\r\n',E'\n'),'UTF8')),'hex')from pg_proc where oid='eps.jobs_dto(uuid)'::regprocedure)
)as specs_ack31_readback from pg_proc p where p.oid='eps.specs_submit_ack(uuid,uuid,uuid)'::regprocedure;
