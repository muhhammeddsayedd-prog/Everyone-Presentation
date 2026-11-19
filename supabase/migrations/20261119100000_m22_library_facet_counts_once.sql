-- m22: Cast Library facet counts read each person once. Performance only: same inputs, same response, same authority.
--
-- public.eps_candidate_facets (m20) evaluated the shared Library row predicate (eps.cast_library_row_ok: a SECURITY
-- DEFINER call per person) and the facet filter test once for the total and three times for each of the 13 facets:
-- 40 passes over the whole Library per call. On a 7,000-person rehearsal copy that is 25 s for an unfiltered Library
-- (hosted Data API requests time out long before), and the Library screen asks for it on every visit and filter change.
-- This version evaluates the row predicate once per person, works out once which facet filters each person fails
-- (eps.appearance_failed_facets), and derives every count from that: 1.3 s on the same copy, byte-identical output.
--
-- Unchanged: the function's signature, owner (eps_appearance_owner), SECURITY DEFINER, search_path, grants and the
-- capability check; eps.cast_library_row_ok and eps.appearance_filter_ok (search keeps using them); the response shape.
-- appearance_filter_ok(keys,names,filters,skip) is exactly "no element of appearance_failed_facets(keys,names,filters)
-- is distinct from skip"; the guard pins appearance_filter_ok's source and the readback proves the equivalence on the
-- live projection before the migration commits.
set local search_path='';set local lock_timeout='5s';set local statement_timeout='10min';

do $m22_guard$declare item record;begin
 if to_regprocedure('eps.appearance_failed_facets(text[],text[],jsonb)') is not null then raise exception 'M22_ALREADY_APPLIED';end if;
 if to_regprocedure('eps.previous_client()') is null then raise exception 'M22_REQUIRES_M21';end if;
 for item in select * from(values
  ('public.eps_candidate_facets(jsonb)','7ce3825cbc2330fbcb878123ab5c004ddb9c7c12cc52c4b02f48a5d46a5ee5e8'),
  ('eps.appearance_filter_ok(text[],text[],jsonb,text)','192672c154c9466f7b640bce03f72beb3b32ddfbe6b581f7b0455bd418b24545'))v(signature,expected) loop
  if to_regprocedure(item.signature) is null or (select encode(sha256(convert_to(replace(prosrc,E'\r\n',E'\n'),'UTF8')),'hex') from pg_proc where oid=item.signature::regprocedure)<>item.expected
  then raise exception 'M22_EXACT_PRECEDING_SOURCE_REQUIRED:%',item.signature;end if;
 end loop;
end$m22_guard$;

-- 1. The facet filters (normalised by eps.appearance_filters) that a projection row fails, all facets at once.
--    The test inside is appearance_filter_ok's, verbatim.
create function eps.appearance_failed_facets(p_keys text[],p_names text[],p_filters jsonb) returns text[] language sql immutable set search_path='' as $$
 select coalesce(array_agg(f.key order by f.key),'{}') from jsonb_each(p_filters->'facets') f
  where not(p_keys && array(select f.key||':'||v from jsonb_array_elements_text(f.value) v)
   or not(f.key=any(p_names)) and ((p_filters->>'include_unknown')::boolean or f.value ? 'unknown'))$$;
-- Same owner and executors as eps.appearance_filter_ok (never PUBLIC).
alter function eps.appearance_failed_facets(text[],text[],jsonb) owner to eps_appearance_owner;
revoke all on function eps.appearance_failed_facets(text[],text[],jsonb) from public,anon,authenticated,service_role;
grant execute on function eps.appearance_failed_facets(text[],text[],jsonb) to eps_appearance_owner,eps_cast_owner;

-- 2. Facet counts from one pass. Owner, privileges and settings are read back below.
create temp table m22_before on commit drop as select to_jsonb(p)-'prosrc' attributes from pg_proc p where oid='public.eps_candidate_facets(jsonb)'::regprocedure;
create or replace function public.eps_candidate_facets(p_filters jsonb) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare filters jsonb;search jsonb;facets jsonb;total bigint;begin
 perform eps.require_capability('cast.read');filters:=eps.appearance_filters(p_filters);
 -- Same supplied-fact/text/Reviewed predicate as search; facet filters are applied per facet below.
 search:=filters->'search'||case when filters->>'q' is not null then jsonb_build_object('q',filters->>'q') else '{}'::jsonb end;
 -- m22: the row predicate runs once per person and each person's failed facet filters are worked out once;
 -- "passes every facet filter except f" (appearance_filter_ok with p_skip f) is then a test on that array.
 with base as materialized (
  select p.candidate_id,p.facet_keys,p.facet_names,eps.appearance_failed_facets(p.facet_keys,p.facet_names,filters) failed
  from eps.candidate_search_projection p join eps.candidates c on c.id=p.candidate_id
  where p.active and eps.cast_library_row_ok(c,search)),
 allowed as (select a.f,a.ordinal from unnest(eps.appearance_facet_keys_allowed()) with ordinality a(f,ordinal)),
 counted as (
  select a.f,a.ordinal,count(b.candidate_id) matched,count(b.candidate_id) filter(where not(a.f=any(b.facet_names))) unknown
  from allowed a left join base b on not exists(select 1 from unnest(b.failed) x where x is distinct from a.f)
  group by a.f,a.ordinal),
 valued as (
  select a.f,substr(k,length(a.f)+2) value,count(distinct b.candidate_id) n
  from allowed a join base b on not exists(select 1 from unnest(b.failed) x where x is distinct from a.f) cross join unnest(b.facet_keys) k
  where k like a.f||':%' group by 1,2),
 ranked as (select v.f,v.value,v.n,row_number() over(partition by v.f order by v.n desc,v.value) position from valued v)
 select (select count(*) from base b where cardinality(b.failed)=0),
  coalesce(jsonb_agg(jsonb_build_object('key',c.f,'matched',c.matched,'unknown',c.unknown,
   'values',coalesce((select jsonb_agg(jsonb_build_object('value',r.value,'count',r.n) order by r.n desc,r.value) from ranked r
     where r.f=c.f and r.position<=case when c.f='tags' then 30 else 100 end),'[]'::jsonb),
   'selected',coalesce(filters#>array['facets',c.f],'[]'::jsonb)) order by c.ordinal),'[]'::jsonb)
 into total,facets from counted c;
 return jsonb_build_object('data',jsonb_build_object('total',total,'filters',filters,'facets',facets));
end$$;

-- 3. Readback: authority unchanged, and the new helper agrees with appearance_filter_ok on every live projection row,
--    for every facet skip and for representative filters (selected values, unknown, include_unknown).
do $m22_check$declare filters jsonb;begin
 if (select to_jsonb(p)-'prosrc' from pg_proc p where oid='public.eps_candidate_facets(jsonb)'::regprocedure) is distinct from (select attributes from m22_before)
 then raise exception 'M22_AUTHORITY_CHANGED';end if;
 if has_function_privilege('anon','public.eps_candidate_facets(jsonb)','execute') or not has_function_privilege('authenticated','public.eps_candidate_facets(jsonb)','execute')
  or has_function_privilege('authenticated','eps.appearance_failed_facets(text[],text[],jsonb)','execute')
  or has_function_privilege('anon','eps.appearance_failed_facets(text[],text[],jsonb)','execute') then raise exception 'M22_PRIVILEGES_CHANGED';end if;
 for filters in select eps.appearance_filters(x) from(values('{}'::jsonb),('{"include_unknown":true,"facets":{"city":["unknown"]}}'::jsonb),
   (jsonb_build_object('include_unknown',false,'facets',coalesce((select jsonb_object_agg(f,jsonb_build_array(v,'unknown')) from(
     select distinct on (split_part(k,':',1)) split_part(k,':',1) f,substr(k,length(split_part(k,':',1))+2) v
     from eps.candidate_search_projection p cross join unnest(p.facet_keys) k where p.active order by split_part(k,':',1),k) s),'{}'::jsonb))),
   (jsonb_build_object('include_unknown',true,'facets',coalesce((select jsonb_object_agg(f,jsonb_build_array(v)) from(
     select distinct on (split_part(k,':',1)) split_part(k,':',1) f,substr(k,length(split_part(k,':',1))+2) v
     from eps.candidate_search_projection p cross join unnest(p.facet_keys) k where p.active order by split_part(k,':',1),k desc) s),'{}'::jsonb)))) t(x) loop
  if exists(select 1 from eps.candidate_search_projection p cross join (select unnest(eps.appearance_facet_keys_allowed()) union all select null) s(skip)
   where eps.appearance_filter_ok(p.facet_keys,p.facet_names,filters,s.skip)
    is distinct from not exists(select 1 from unnest(eps.appearance_failed_facets(p.facet_keys,p.facet_names,filters)) x where x is distinct from s.skip))
  then raise exception 'M22_FACET_TEST_DIFFERS';end if;
 end loop;
end$m22_check$;
