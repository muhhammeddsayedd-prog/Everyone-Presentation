-- m23b: the Library "Reviewed" filter failed with "permission denied for function cast_canonical" as soon as a reviewed
-- person was checked: the filter check runs as eps_appearance_owner (m20), which could not execute
-- eps.cast_canonical(jsonb). Grant exactly that one function to that one owner role (same grant other owners hold).
-- The worker runtime login is not a member of eps_appearance_owner, so its executable surface is unchanged.
-- Applies before m24, whose equivalence proof runs the old per-person filter on live data (reviewed people).
-- Requires m23. Refuses a second run.
set local search_path='';set local lock_timeout='5s';set local statement_timeout='60s';
do $m23b$begin
 if not exists(select 1 from eps.presentation_templates where version='1.4.1') then raise exception 'M23B_REQUIRES_M23'; end if;
 if has_function_privilege('eps_appearance_owner','eps.cast_canonical(jsonb)','EXECUTE') then raise exception 'M23B_ALREADY_APPLIED'; end if;
end$m23b$;
grant execute on function eps.cast_canonical(jsonb) to eps_appearance_owner;
do $m23b_readback$begin
 if not has_function_privilege('eps_appearance_owner','eps.cast_canonical(jsonb)','EXECUTE')
  or has_function_privilege('public','eps.cast_canonical(jsonb)','EXECUTE')
  or (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='eps' or n.nspname='public' and (p.proname like 'eps\_%' escape '\' or p.prosecdef)) and has_function_privilege('eps_specs_runtime',p.oid,'EXECUTE'))<>12
 then raise exception 'M23B_READBACK_FAILED'; end if;
end$m23b_readback$;
