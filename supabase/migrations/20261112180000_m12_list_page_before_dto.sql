-- m12: Build list DTOs only for the returned page.
-- eps_search_candidates, eps_list_jobs and eps_list_jobs_by_batch computed the full DTO for every
-- matching row before "order by id limit n+1" applied. With the 6.8k-person archive the Cast Library
-- timed out (57014) and surfaced as DEPENDENCY_UNAVAILABLE. Filters, order, page size, cursor and
-- DTO shape are unchanged: the page ids are chosen first, then DTOs are built for those rows only.
-- The cast read policy also re-evaluated has_capability (several catalogue/claim lookups) for every
-- candidate row; wrapping it in a scalar subquery evaluates it once per statement (same result).
set local search_path='';set local lock_timeout='5s';set local statement_timeout='60s';

do $m12_policy$begin
 if (select qual from pg_policies where schemaname='eps' and tablename='candidates' and policyname='cast_candidates_read') is distinct from 'eps.has_capability(''cast.read''::text)'
 then raise exception 'M12_POLICY_CHANGED';end if;
end $m12_policy$;
alter policy cast_candidates_read on eps.candidates using ((select eps.has_capability('cast.read'::text)));

do $m12$declare routine regprocedure;definition text;original_source text;source text;before_attributes jsonb;patch record;begin
 for patch in select * from (values
  ('public.eps_search_candidates(jsonb)',
   $o$ select array_agg(dto order by id) into result from (
  select candidate.id,eps.cast_candidate_dto(candidate.id,eps.cast_search_match(candidate.facts,p_search)) dto from eps.candidates candidate$o$,
   $n$ -- m12: choose the page first, then build profiles only for that page.
 select array_agg(eps.cast_candidate_dto(page.id,page.search_match) order by page.id) into result from (
  select candidate.id,eps.cast_search_match(candidate.facts,p_search) search_match from eps.candidates candidate$n$),
  ('public.eps_list_jobs(uuid,text,uuid,integer)',
   $o$  select coalesce(array_agg(dto order by id),array[]::jsonb[]) into items from
    (select id,eps.jobs_dto(id) dto from eps.jobs where$o$,
   $n$  -- m12: choose the page first, then build job DTOs only for that page.
  select coalesce(array_agg(eps.jobs_dto(page.id) order by page.id),array[]::jsonb[]) into items from
    (select id from eps.jobs where$n$),
  ('public.eps_list_jobs_by_batch(uuid,text,uuid,integer,uuid)',
   $o$  select coalesce(array_agg(dto order by id),array[]::jsonb[]) into items from
    (select id,eps.jobs_dto(id) dto from eps.jobs where batch_id=p_batch_id$o$,
   $n$  -- m12: choose the page first, then build job DTOs only for that page.
  select coalesce(array_agg(eps.jobs_dto(page.id) order by page.id),array[]::jsonb[]) into items from
    (select id from eps.jobs where batch_id=p_batch_id$n$)
 ) v(fn,old_text,new_text) loop
  routine:=patch.fn::regprocedure;
  select replace(prosrc,E'\r\n',E'\n'),replace(pg_get_functiondef(oid),E'\r\n',E'\n'),to_jsonb(p)-'prosrc' into source,definition,before_attributes from pg_proc p where oid=routine;
  if length(source)-length(replace(source,patch.old_text,''))<>length(patch.old_text) then raise exception 'M12_SEAM_CHANGED %',patch.fn;end if;
  select replace(prosrc,E'\r\n',E'\n') into original_source from pg_proc where oid=routine;
  if length(definition)-length(replace(definition,original_source,''))<>length(original_source) then raise exception 'M12_DEFINITION_SEAM_CHANGED %',patch.fn;end if;
  execute replace(definition,original_source,replace(source,patch.old_text,patch.new_text));
  if (select to_jsonb(p)-'prosrc' from pg_proc p where oid=routine) is distinct from before_attributes then raise exception 'M12_AUTHORITY_CHANGED %',patch.fn;end if;
  if (select prosrc from pg_proc where oid=routine) not like '%-- m12: choose the page first%' then raise exception 'M12_VERIFY_FAILED %',patch.fn;end if;
 end loop;
end $m12$;
