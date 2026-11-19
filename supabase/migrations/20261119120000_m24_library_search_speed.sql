-- m24: Cast Library search-as-you-type and its duplicate flag without per-person round trips. Performance only:
-- same inputs, same responses (byte for byte), same authority. Requires m22b (facet counts read each person once).
--
-- 1. Text search. Every Library search and facet count asked eps.cast_library_row_ok about each person: a SECURITY
--    DEFINER call that, for a typed name, made two more PL/pgSQL calls and a SECURITY DEFINER projection lookup per
--    person (about 0.8 ms each): 5.9 s for a search and 4.8 s for its facet counts on a 7,000-person rehearsal copy.
--    eps.cast_library_matches(p_search) answers the same question for the whole Library in one statement: the
--    per-search parts (the normalised query, which filters are present, the facet filters) are worked out once, the
--    normalised-name/casting-id/tag test reads the projection through one join, and the per-person PL/pgSQL calls run
--    only when a supplied-fact filter, Reviewed status or facet filter is actually present.
--    Equivalence with cast_library_row_ok, term by term (all sources pinned below):
--      row_ok = (A or B) and R and F, with
--      A = cast_search_match(facts,s) is not null
--        = (q blank or position(lower(btrim(q)) in facts text)>0) and L,   L = cast_search_match(facts,s-'q') is not null
--          (cast_search_match checks q first, then loops over nine keys that never include q)
--      B = q not blank and L and cast_text_match(id,q)
--      so A or B = L and (q blank or facts-text match or cast_text_match), and L is true for everyone when none of the
--      nine keys has a non-blank value (every loop step continues). cast_text_match = a projection row exists and
--      appearance_text_ok(its names, casting id, tags, appearance_norm(q)) is true. R and F as in row_ok/cast_facet_match.
--    eps.cast_library_row_ok stays (unchanged) for anything else that calls it; the readback below proves both agree on
--    the live Library for representative searches.
-- 2. Duplicate flag. eps.cast_candidate_dto (every Library row and every person read) checked "another active person
--    with the same name or casting id" with an expression the planner cannot take to the name/casting-id indexes under
--    eps_cast_owner's row-level security (lower() and ->> are not leakproof): a scan of the whole Library per person,
--    30-45 ms each. The same expression now runs in eps.cast_duplicate_exists, owned by eps_appearance_owner, whose
--    candidates policy is unconditional, so the indexes apply (< 0.1 ms). It is reached only from cast_candidate_dto,
--    after that function has read the person under the caller's policy, so it reveals nothing the caller could not
--    already see. The flag's expression is unchanged.
set local search_path='';set local lock_timeout='5s';set local statement_timeout='20min';

do $m24_guard$declare item record;begin
 if to_regprocedure('eps.cast_library_matches(jsonb)') is not null or to_regprocedure('eps.cast_duplicate_exists(uuid,text,text)') is not null
 then raise exception 'M24_ALREADY_APPLIED';end if;
 if to_regprocedure('eps.appearance_failed_facets(text[],text[],jsonb)') is null then raise exception 'M24_REQUIRES_M22B';end if;
 if has_schema_privilege('eps_appearance_owner','eps','create') then raise exception 'M24_UNEXPECTED_SCHEMA_PRIVILEGE';end if;
 for item in select * from(values
  ('public.eps_search_candidates(jsonb)','4e65d637d658faff9912f3d70c440e315b06ccfb18b86b9f11c1868743793fa0'),
  ('public.eps_candidate_facets(jsonb)','52e915dc7949c77bb028bc67ed136043be1f53aed424273f545bc1a0ec2405e0'),
  ('eps.cast_candidate_dto(uuid,jsonb)','e32135f3a38dde2358ed259ec021a306765baa9d3336ae02df078f533d642b84'),
  ('eps.cast_library_row_ok(eps.candidates,jsonb)','e6112417e484439a4194d5f7174b60e89dbbb105852823d8bb39332244e71993'),
  ('eps.cast_search_match(jsonb,jsonb)','afd30cb33b8f4ba00c1230c178a1d34fb035ced581e438e7fe2c4a3833ec3a8e'),
  ('eps.cast_text_match(uuid,text)','7dff1c1af9d35842a5923a1deca8359367ccf30f515affc0e95c59184e706fe3'),
  ('eps.cast_facet_match(uuid,jsonb)','56950979624a6020bba5ec3d3cf462b984d8cae3a1b14f1d4dcf31775aa5638d'),
  ('eps.appearance_text_ok(text,text,text,text[],text)','b1f4c967c0be0ff3cf8911934e43281b3eb52d6639fe940616d7e282cf18815d'))v(signature,expected) loop
  if to_regprocedure(item.signature) is null or (select encode(sha256(convert_to(replace(prosrc,E'\r\n',E'\n'),'UTF8')),'hex') from pg_proc where oid=item.signature::regprocedure)<>item.expected
  then raise exception 'M24_EXACT_PRECEDING_SOURCE_REQUIRED:%',item.signature;end if;
 end loop;
end$m24_guard$;

-- Owner, privileges and settings of the three replaced routines, read back at the end.
create temp table m24_before on commit drop as select p.oid::regprocedure::text signature,to_jsonb(p)-'prosrc' attributes from pg_proc p
 where p.oid in('public.eps_search_candidates(jsonb)'::regprocedure,'public.eps_candidate_facets(jsonb)'::regprocedure,'eps.cast_candidate_dto(uuid,jsonb)'::regprocedure);

-- 1. The Library row predicate for the whole Library at once (ids of every person for whom cast_library_row_ok is true).
create function eps.cast_library_matches(p_search jsonb) returns setof uuid language sql stable security definer set search_path='' as $$
 with s as materialized (select
   nullif(btrim(p_search->>'q'),'') is not null has_q,
   lower(btrim(p_search->>'q')) q_lower,
   eps.appearance_norm(p_search->>'q') q_norm,
   exists(select 1 from unnest(array['age_or_range','stated_gender','height_measurements','language','accent','skill','city','previous_project_role','classification']) k
    where nullif(btrim(p_search->>k,E' \t\r\n'),'') is not null) has_fields,
   p_search-'q' fields,
   p_search?'review_status' has_review,p_search->>'review_status'='reviewed' want_reviewed,
   p_search?'facets' has_facets,
   case when p_search?'facets' then eps.appearance_filters(jsonb_build_object('facets',p_search->'facets','include_unknown',coalesce(p_search->'facet_include_unknown','false'::jsonb))) end facet_filters)
 select c.id from s cross join eps.candidates c left join eps.candidate_search_projection p on p.candidate_id=c.id
 where (not s.has_fields or eps.cast_search_match(c.facts,s.fields) is not null)
  and (not s.has_q
   or p.candidate_id is not null and coalesce(s.q_norm is null or strpos(coalesce(p.name_norm,''),s.q_norm)>0 or strpos(coalesce(p.name_ar_norm,''),s.q_norm)>0
     or strpos(p.casting_id_norm,s.q_norm)>0 or exists(select 1 from unnest(p.tags) t where strpos(t,s.q_norm)>0),false)
   or position(s.q_lower in lower(coalesce((select string_agg(case when jsonb_typeof(value)='array' then (select string_agg(element,' ') from jsonb_array_elements_text(value) element) else value#>>'{}' end,' ') from jsonb_each(c.facts)),'')))>0)
  and (not s.has_review or s.want_reviewed=eps.cast_is_reviewed(c))
  and (not s.has_facets or s.facet_filters->'facets'='{}'::jsonb
   or p.candidate_id is not null and coalesce(eps.appearance_filter_ok(p.facet_keys,p.facet_names,s.facet_filters,null),false))
$$;
-- 2. The duplicate flag's existing expression, under the owner whose candidates policy is unconditional.
create function eps.cast_duplicate_exists(p_id uuid,p_name text,p_source_casting_id text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from eps.candidates other where other.id<>p_id and other.archived_at is null and other.merged_into_candidate_id is null
  and (nullif(lower(p_name),'')=lower(other.facts->>'name') or lower(p_source_casting_id)=lower(other.casting_id)))
$$;
-- Same owner as cast_library_row_ok; never PUBLIC. Search (eps_cast_owner) and facet counts (eps_appearance_owner) use
-- the matcher; only cast_candidate_dto (eps_cast_owner) uses the duplicate flag.
grant create on schema eps to eps_appearance_owner;
alter function eps.cast_library_matches(jsonb) owner to eps_appearance_owner;
alter function eps.cast_duplicate_exists(uuid,text,text) owner to eps_appearance_owner;
revoke create on schema eps from eps_appearance_owner;
revoke all on function eps.cast_library_matches(jsonb),eps.cast_duplicate_exists(uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function eps.cast_library_matches(jsonb) to eps_appearance_owner,eps_cast_owner;
grant execute on function eps.cast_duplicate_exists(uuid,text,text) to eps_cast_owner;

-- 3. One seam in each caller (exact text required once; definition, owner and attributes otherwise untouched).
create function pg_temp.m24_patch(p_routine regprocedure,p_old text,p_new text) returns void language plpgsql as $$
declare source text;definition text;begin
 select replace(prosrc,E'\r\n',E'\n'),replace(pg_get_functiondef(oid),E'\r\n',E'\n') into source,definition from pg_proc where oid=p_routine;
 if length(source)-length(replace(source,p_old,''))<>length(p_old) then raise exception 'M24_SEAM_CHANGED %',p_routine;end if;
 if length(definition)-length(replace(definition,source,''))<>length(source) then raise exception 'M24_DEFINITION_SEAM_CHANGED %',p_routine;end if;
 execute replace(definition,source,replace(source,p_old,p_new));
end$$;
select pg_temp.m24_patch('public.eps_search_candidates(jsonb)',
 'and eps.cast_library_row_ok(candidate,p_search)',
 'and candidate.id in(select eps.cast_library_matches(p_search))');
select pg_temp.m24_patch('public.eps_candidate_facets(jsonb)',
 'where p.active and eps.cast_library_row_ok(c,search)),',
 'where p.active and c.id in(select eps.cast_library_matches(search))),');
select pg_temp.m24_patch('eps.cast_candidate_dto(uuid,jsonb)',
 'exists(select 1 from eps.candidates other where other.id<>candidate.id and other.archived_at is null and other.merged_into_candidate_id is null and (nullif(lower(candidate.facts->>''name''),'''')=lower(other.facts->>''name'') or lower(candidate.source_casting_id)=lower(other.casting_id)))',
 'eps.cast_duplicate_exists(candidate.id,candidate.facts->>''name'',candidate.source_casting_id)');

-- 4. Readback: authority unchanged; the matcher agrees with cast_library_row_ok and the flag with the old expression on
--    the live Library before this commits.
do $m24_check$declare search jsonb;sample text;begin
 if exists(select 1 from m24_before b join pg_proc p on p.oid=b.signature::regprocedure where to_jsonb(p)-'prosrc' is distinct from b.attributes)
  or (select count(*) from m24_before)<>3 then raise exception 'M24_AUTHORITY_CHANGED';end if;
 if has_schema_privilege('eps_appearance_owner','eps','create')
  or has_function_privilege('authenticated','eps.cast_library_matches(jsonb)','execute') or has_function_privilege('anon','eps.cast_library_matches(jsonb)','execute')
  or has_function_privilege('authenticated','eps.cast_duplicate_exists(uuid,text,text)','execute') or has_function_privilege('anon','eps.cast_duplicate_exists(uuid,text,text)','execute')
 then raise exception 'M24_PRIVILEGES_CHANGED';end if;
 select coalesce(substr(min(p.name_norm),1,3),'a') into sample from eps.candidate_search_projection p where p.active and length(p.name_norm)>=3;
 for search in select x from(values('{}'::jsonb),('{"q":"a"}'),('{"q":"   "}'),('{"q":"zzqqxx"}'),(jsonb_build_object('q',sample)),(jsonb_build_object('q',upper(sample),'include_unknown',true)),
   ('{"q":"ا"}'),(jsonb_build_object('q',chr(1614))),('{"q":"eps-"}'),('{"city":"a","include_unknown":false}'),('{"q":"a","city":"a","include_unknown":true}'),
   ('{"review_status":"reviewed"}'),('{"q":"e","review_status":"unreviewed"}'),('{"facets":{"city":["unknown"]},"facet_include_unknown":true}'),
   ('{"q":"a","facets":{"talent_type":["talent"]}}'),('{"facets":{}}')) t(x) loop
  if exists((select c.id from eps.candidates c where eps.cast_library_row_ok(c,search)) except all (select eps.cast_library_matches(search)))
   or exists((select eps.cast_library_matches(search)) except all (select c.id from eps.candidates c where eps.cast_library_row_ok(c,search)))
  then raise exception 'M24_MATCHES_DIFFER:%',search;end if;
 end loop;
 -- Every person who shares a name with someone or whose source casting id is someone's casting id, plus the first 200 by id.
 if exists(select 1 from eps.candidates c where (c.id in(select id from eps.candidates order by id limit 200)
    or lower(c.facts->>'name') in(select lower(facts->>'name') from eps.candidates group by 1 having count(*)>1)
    or lower(c.source_casting_id) in(select lower(casting_id) from eps.candidates))
   and eps.cast_duplicate_exists(c.id,c.facts->>'name',c.source_casting_id) is distinct from exists(select 1 from eps.candidates other where other.id<>c.id and other.archived_at is null
    and other.merged_into_candidate_id is null and (nullif(lower(c.facts->>'name'),'')=lower(other.facts->>'name') or lower(c.source_casting_id)=lower(other.casting_id))))
 then raise exception 'M24_DUPLICATE_FLAG_DIFFERS';end if;
end$m24_check$;
