-- Cycle 8 (m22b, m24) Cast Library speed: the set-based matcher, the facet counts and the duplicate flag give exactly
-- the answers of the per-person predicate (eps.cast_library_row_ok) and the original duplicate expression.
-- Disposable replica only (development/cycle7/staging/replica.py apply). Synthetic people only; rolled back; the last
-- line is one JSON result.
\set ON_ERROR_STOP on
begin;
alter table auth.users add column if not exists is_anonymous boolean not null default false,add column if not exists deleted_at timestamptz,add column if not exists banned_until timestamptz;
create temp table c8_result(key text primary key,value jsonb not null);
create function pg_temp.ok(p_key text,p_condition boolean,p_detail jsonb default null) returns void language plpgsql as $$begin
 if p_condition is distinct from true then raise exception 'C8_CHECK_FAILED:% %',p_key,coalesce(p_detail::text,'');end if;
 insert into c8_result values(p_key,coalesce(p_detail,'true'::jsonb)) on conflict(key) do update set value=excluded.value;
end$$;
create function pg_temp.as_user(p_user uuid,p_sql text) returns jsonb language plpgsql as $$declare r jsonb;begin
 perform set_config('request.jwt.claims',json_build_object('sub',p_user,'role','authenticated','is_anonymous',false)::text,true);
 perform set_config('request.jwt.claim.sub',p_user::text,true);
 execute 'set local role authenticated';execute p_sql into r;execute 'reset role';
 perform set_config('request.jwt.claims','',true);perform set_config('request.jwt.claim.sub','',true);
 return r;
end$$;
-- The original duplicate expression (eps.cast_candidate_dto before m24), as the reference.
create function pg_temp.duplicate_reference(c eps.candidates) returns boolean language sql as $$
 select c.duplicate_resolution is null and exists(select 1 from eps.candidates other where other.id<>c.id and other.archived_at is null and other.merged_into_candidate_id is null
  and (nullif(lower(c.facts->>'name'),'')=lower(other.facts->>'name') or lower(c.source_casting_id)=lower(other.casting_id)))$$;

insert into auth.users(id,instance_id,aud,role,email)values
 ('c8000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','c8-reader@example.invalid'),
 ('c8000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','c8-outsider@example.invalid');
insert into public.app_capability_grants(principal_id,capability,active)values('c8000000-0000-4000-8000-000000000001','cast.read',true);
-- 240 people: shared names, Arabic names, a source casting id that is someone else's casting id, archived and merged rows,
-- supplied facts for the fact filters, attributes for facets and the Arabic/tag text match. Triggers build the projection.
insert into eps.candidates(id,casting_id,source_casting_id,facts,source_kind,created_by,created_at,archived_at)
select ('c8000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'C8-SYN-'||n,case when n%40=0 then 'c8-syn-'||(n+1) end,
 jsonb_build_object('name',case when n%30=0 then 'Shared Name' when n%17=0 then '' when n%11=0 then 'سارة '||n else 'Synthetic Person '||n end,'casting_id','C8-SYN-'||n,
  'age_or_range',(array['25-30','40',null,'young adult'])[1+n%4],'stated_gender',(array['Female','Male',null])[1+n%3],'height_measurements',null,
  'languages',(array['[]','["English"]','["Arabic","English"]'])[1+n%3]::jsonb,'accents','[]'::jsonb,'skills_experience',case when n%7=0 then 'Dance, stunts' end,
  'city',(array['Cairo','Dubai','Riyadh',null])[1+n%4],'previous_projects_roles',null,'classification',null),
 'archive','c8000000-0000-4000-8000-000000000001',now()-make_interval(mins=>n),case when n%53=0 then now() end
from generate_series(1,240) n;
update eps.candidates set merged_into_candidate_id='c8000000-0000-4000-8000-000000000001' where id='c8000000-0000-4000-8000-000000000099';
-- No Reviewed people here: with one, the Reviewed filter already fails before m24 (eps_appearance_owner cannot execute
-- eps.cast_canonical, which eps.cast_is_reviewed reaches); m24 keeps that behaviour unchanged and does not touch grants.
update eps.candidates set duplicate_resolution='keep_new' where id='c8000000-0000-4000-8000-000000000060';
insert into eps.candidate_attributes(candidate_id,name_ar,talent_type,tags,hair_colour)
select ('c8000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,case when n%9=0 then 'أَحْمَد '||n end,(array['talent','real_family'])[1+n%2],
 case when n%5=0 then '{Dancer,"Stunt Driver"}'::text[] else '{}'::text[] end,case when n%4=0 then '{Black}'::text[] else '{}'::text[] end
from generate_series(1,240,2) n;
select eps.refresh_candidate_projection(id) from eps.candidates where casting_id like 'C8-SYN-%';

do $test$declare search jsonb;rows_ok uuid[];rows_new uuid[];page jsonb;listed uuid[];cursor text;expected uuid[];facets jsonb;begin
 -- 1. Matcher = per-person predicate, for every search shape the Library sends.
 for search in select x from(values('{}'::jsonb),('{"q":"person"}'),('{"q":"PERSON 1"}'),('{"q":"   "}'),('{"q":"zzqq"}'),('{"q":"سارة"}'),('{"q":"احمد"}'),
   (jsonb_build_object('q',chr(1614))),('{"q":"c8-syn-4"}'),('{"q":"dancer"}'),('{"q":"stunt"}'),('{"q":"dubai"}'),('{"q":"25"}'),
   ('{"city":"cairo","include_unknown":false}'),('{"city":"cairo","include_unknown":true}'),('{"q":"person","age_or_range":"26","include_unknown":false}'),
   ('{"skill":"dance"}'),('{"language":"arabic","stated_gender":"female"}'),('{"review_status":"reviewed"}'),('{"review_status":"unreviewed","q":"shared"}'),
   ('{"facets":{"talent_type":["talent"]}}'),('{"facets":{"hair_colour":["black","unknown"]},"facet_include_unknown":true,"q":"person"}'),('{"facets":{}}'),
   ('{"facets":{"city":["unknown"]},"facet_include_unknown":false}')) t(x) loop
  select coalesce(array_agg(c.id order by c.id),'{}') into rows_ok from eps.candidates c where c.casting_id like 'C8-SYN-%' and eps.cast_library_row_ok(c,search);
  select coalesce(array_agg(m order by m),'{}') into rows_new from eps.cast_library_matches(search) m join eps.candidates c on c.id=m where c.casting_id like 'C8-SYN-%';
  perform pg_temp.ok('matches:'||search::text,rows_ok=rows_new,jsonb_build_object('row_ok',cardinality(rows_ok),'matches',cardinality(rows_new)));
 end loop;
 perform pg_temp.ok('matches_nonempty',(select count(*) from eps.cast_library_matches('{"q":"person"}'))>100);
 -- 2. Search pages: newest first, exactly the active people the predicate accepts, across cursor pages.
 for search in select x from(values('{"q":"person","limit":40}'::jsonb),('{"q":"سارة","limit":7}'),('{"city":"dubai","include_unknown":false,"limit":30}'),('{"q":"shared","limit":3}')) t(x) loop
  listed:='{}';cursor:=null;
  loop
   page:=pg_temp.as_user('c8000000-0000-4000-8000-000000000001',format('select public.eps_search_candidates(%L::jsonb)',search||case when cursor is null then '{}'::jsonb else jsonb_build_object('cursor',cursor) end));
   listed:=listed||array(select (x->>'id')::uuid from jsonb_array_elements(page->'data') x where x->>'id' like 'c8000000-%');
   cursor:=page->'page'->>'next_cursor';exit when cursor is null;
  end loop;
  select coalesce(array_agg(c.id order by c.created_at desc,c.id desc),'{}') into expected from eps.candidates c
   where c.casting_id like 'C8-SYN-%' and c.archived_at is null and c.merged_into_candidate_id is null and eps.cast_library_row_ok(c,search-'limit');
  perform pg_temp.ok('search:'||search::text,listed=expected,jsonb_build_object('listed',cardinality(listed),'expected',cardinality(expected)));
 end loop;
 -- 3. Facet totals: the people the predicate accepts.
 facets:=pg_temp.as_user('c8000000-0000-4000-8000-000000000001',$q$select public.eps_candidate_facets('{"q":"person","search":{"city":"cairo","include_unknown":true}}'::jsonb)$q$)->'data';
 perform pg_temp.ok('facet_total',(facets->>'total')::bigint=(select count(*) from eps.candidate_search_projection p join eps.candidates c on c.id=p.candidate_id
  where p.active and eps.cast_library_row_ok(c,'{"q":"person","city":"cairo","include_unknown":true}')),facets->'total');
 -- 4. Duplicate flag: the person read and the Library rows carry the original expression's answer.
 perform pg_temp.ok('duplicate_flag',not exists(select 1 from eps.candidates c where c.casting_id like 'C8-SYN-%' and c.archived_at is null
  and (pg_temp.as_user('c8000000-0000-4000-8000-000000000001',format('select public.eps_get_candidate(%L::uuid)',c.id))->>'possible_duplicate')::boolean is distinct from pg_temp.duplicate_reference(c)));
 perform pg_temp.ok('duplicate_flag_seen',(select count(*) filter(where pg_temp.duplicate_reference(c)) from eps.candidates c where c.casting_id like 'C8-SYN-%' and c.archived_at is null)>=8);
 page:=pg_temp.as_user('c8000000-0000-4000-8000-000000000001',$q$select public.eps_search_candidates('{"q":"shared","limit":100}'::jsonb)$q$);
 perform pg_temp.ok('duplicate_flag_library',not exists(select 1 from jsonb_array_elements(page->'data') x join eps.candidates c on c.id=(x->>'id')::uuid
  where (x->>'possible_duplicate')::boolean is distinct from pg_temp.duplicate_reference(c)) and jsonb_array_length(page->'data')>=7);
 -- 5. Authority: no capability, no result; the helpers are never callable by users.
 begin perform pg_temp.as_user('c8000000-0000-4000-8000-000000000002',$q$select public.eps_search_candidates('{"q":"person"}'::jsonb)$q$);
  raise exception 'C8_OUTSIDER_SEARCHED';exception when others then if sqlerrm='C8_OUTSIDER_SEARCHED' then raise;end if;end;
 perform pg_temp.ok('outsider_refused',true);
 perform pg_temp.ok('helpers_private',not has_function_privilege('authenticated','eps.cast_library_matches(jsonb)','execute')
  and not has_function_privilege('authenticated','eps.cast_duplicate_exists(uuid,text,text)','execute')
  and not has_function_privilege('authenticated','eps.appearance_failed_facets(text[],text[],jsonb)','execute')
  and has_function_privilege('authenticated','public.eps_search_candidates(jsonb)','execute'));
 perform pg_temp.ok('owners',(select pg_get_userbyid(proowner) from pg_proc where oid='eps.cast_library_matches(jsonb)'::regprocedure)='eps_appearance_owner'
  and (select pg_get_userbyid(proowner) from pg_proc where oid='eps.cast_duplicate_exists(uuid,text,text)'::regprocedure)='eps_appearance_owner'
  and (select pg_get_userbyid(proowner) from pg_proc where oid='eps.cast_candidate_dto(uuid,jsonb)'::regprocedure)='eps_cast_owner'
  and (select pg_get_userbyid(proowner) from pg_proc where oid='public.eps_search_candidates(jsonb)'::regprocedure)='eps_cast_owner'
  and (select pg_get_userbyid(proowner) from pg_proc where oid='public.eps_candidate_facets(jsonb)'::regprocedure)='eps_appearance_owner');
end$test$;

select json_build_object('result','passed','checks',(select count(*) from c8_result),'names',(select json_agg(key order by key) from c8_result))::text;
rollback;
