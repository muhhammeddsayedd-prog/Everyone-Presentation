-- m25: the Library "Reviewed" filter failed with "permission denied for function cast_canonical" as soon as a reviewed
-- person was checked: the filter check runs as eps_appearance_owner (m20), which could not execute
-- eps.cast_canonical(jsonb). Grant exactly that one function to that one owner role (same grant other owners hold).
-- The worker runtime login is not a member of eps_appearance_owner, so its executable surface is unchanged.
-- Requires m24. Refuses a second run.
set local search_path='';set local lock_timeout='5s';set local statement_timeout='60s';
do $m25$begin
 if to_regprocedure('eps.cast_library_matches(jsonb)') is null and not exists(select 1 from pg_proc where proname='cast_library_matches') then raise exception 'M25_REQUIRES_M24'; end if;
 if has_function_privilege('eps_appearance_owner','eps.cast_canonical(jsonb)','EXECUTE') then raise exception 'M25_ALREADY_APPLIED'; end if;
end$m25$;
grant execute on function eps.cast_canonical(jsonb) to eps_appearance_owner;
do $m25_readback$begin
 if not has_function_privilege('eps_appearance_owner','eps.cast_canonical(jsonb)','EXECUTE')
  or has_function_privilege('public','eps.cast_canonical(jsonb)','EXECUTE')
  or (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='eps' or n.nspname='public' and (p.proname like 'eps\_%' escape '\' or p.prosecdef)) and has_function_privilege('eps_specs_runtime',p.oid,'EXECUTE'))<>12
 then raise exception 'M25_READBACK_FAILED'; end if;
end$m25_readback$;
