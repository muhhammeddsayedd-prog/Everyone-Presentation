-- M03 additive role-filter projection. Development fragment for reviewed migration18 composition.
-- Existing forced-RLS eps_specs_owner already has scoped role reads. No new table, policy or runtime authority.
-- Database-function security reference: https://supabase.com/docs/guides/database/functions
set local search_path='';
set local lock_timeout='3s';
set local statement_timeout='30s';
-- Search keeps raw supplied text. Only these exact integer/range forms get numeric overlap semantics.
create function eps.cast_supplied_age_bounds(p_value text) returns integer[]
language plpgsql immutable strict security invoker set search_path='' as $$
declare parts text[];minimum integer;maximum integer;begin
  parts:=regexp_match(btrim(p_value,E' \t\r\n'),'^([0-9]{1,3})(?: *[-–—] *([0-9]{1,3}))?$');
  if parts is null then return null;end if;
  minimum:=parts[1]::integer;maximum:=coalesce(parts[2],parts[1])::integer;
  if minimum>maximum or maximum>130 then return null;end if;
  return array[minimum,maximum];
end $$;
create or replace function eps.cast_search_match(p_facts jsonb,p_search jsonb) returns jsonb
language plpgsql immutable security invoker set search_path='' as $$
declare key text;field text;actual jsonb;wanted text;actual_age integer[];wanted_age integer[];matched jsonb:='[]';unknowns jsonb:='[]';begin
  if nullif(btrim(p_search->>'q'),'') is not null and position(lower(btrim(p_search->>'q')) in lower(coalesce((select string_agg(case when jsonb_typeof(value)='array' then (select string_agg(element,' ') from jsonb_array_elements_text(value) element) else value#>>'{}' end,' ') from jsonb_each(p_facts)),'')))=0 then return null;end if;
  foreach key in array array['age_or_range','stated_gender','height_measurements','language','accent','skill','city','previous_project_role','classification'] loop
    wanted:=nullif(btrim(p_search->>key,E' \t\r\n'),'');if wanted is null then continue;end if;
    field:=case key when 'language' then 'languages' when 'accent' then 'accents' when 'skill' then 'skills_experience' when 'previous_project_role' then 'previous_projects_roles' else key end;
    actual:=p_facts->field;
    if actual is null or actual='null'::jsonb or actual='[]'::jsonb then
      if coalesce((p_search->>'include_unknown')::boolean,true)=false then return null;end if;unknowns:=unknowns||to_jsonb(key);
    elsif key='stated_gender' then
      if lower(btrim(actual#>>'{}',E' \t\r\n'))<>lower(wanted) then return null;end if;matched:=matched||to_jsonb(key);
    elsif key='age_or_range' then
      actual_age:=eps.cast_supplied_age_bounds(actual#>>'{}');wanted_age:=eps.cast_supplied_age_bounds(wanted);
      if actual_age is not null and wanted_age is not null then
        if actual_age[1]>wanted_age[2] or wanted_age[1]>actual_age[2] then return null;end if;
      elsif position(lower(wanted) in lower(actual#>>'{}'))=0 then return null;end if;
      matched:=matched||to_jsonb(key);
    elsif jsonb_typeof(actual)='array' then
      if not exists(select 1 from jsonb_array_elements_text(actual) value where position(lower(wanted) in lower(value))>0) then return null;end if;matched:=matched||to_jsonb(key);
    else
      if position(lower(wanted) in lower(actual#>>'{}'))=0 then return null;end if;matched:=matched||to_jsonb(key);
    end if;
  end loop;
  return jsonb_build_object('matched_filter_fields',matched,'unknown_filter_fields',unknowns);
end $$;
revoke all on function eps.cast_supplied_age_bounds(text) from public,anon,authenticated,service_role;
grant create on schema eps to eps_cast_owner;
alter function eps.cast_supplied_age_bounds(text) owner to eps_cast_owner;
revoke create on schema eps from eps_cast_owner;
create function public.eps_suggest_candidate_filters(p_role_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare role record; filters jsonb; begin
  perform eps.require_capability('workspaces.read');
  perform eps.require_capability('cast.read');
  select resource.id,resource.category,resource.requirements into role from eps.roles resource
    where resource.id=p_role_id and resource.archived_at is null and eps.specs_scope(resource.workspace_id,false);
  if not found then perform eps.fail('RESOURCE_NOT_FOUND','Active role not found in an accessible workspace.',404); end if;
  perform eps.specs_check_requirements(role.requirements);
  -- No transformations from role name, shoot location, appearance, free instructions or candidate data.
  -- Retain the first identical field/value's source path; distinct values remain separate editable choices.
  with values_to_suggest as (
    select 1::bigint ordinal,'age_or_range'::text field,role.requirements->>'age_range' value,'requirements.age_range'::text source_field
    union all select 2,'stated_gender',role.requirements->>'gender_requirement','requirements.gender_requirement'
    union all select 3 + item.ordinal,'language',item.value,'requirements.languages['||(item.ordinal-1)::text||']'
      from jsonb_array_elements_text(role.requirements->'languages') with ordinality item(value,ordinal)
    union all select 3 + jsonb_array_length(role.requirements->'languages') + item.ordinal,'accent',item.value,'requirements.accents['||(item.ordinal-1)::text||']'
      from jsonb_array_elements_text(role.requirements->'accents') with ordinality item(value,ordinal)
    union all select 3 + jsonb_array_length(role.requirements->'languages') + jsonb_array_length(role.requirements->'accents') + item.ordinal,
      'skill',item.value,'requirements.skills['||(item.ordinal-1)::text||']'
      from jsonb_array_elements_text(role.requirements->'skills') with ordinality item(value,ordinal)
    union all select 4 + jsonb_array_length(role.requirements->'languages') + jsonb_array_length(role.requirements->'accents') + jsonb_array_length(role.requirements->'skills'),
      'classification',role.category,'category'
  ), distinct_values as (
    select distinct on(field,value) ordinal,field,value,source_field from values_to_suggest
      where value is not null and btrim(value,E' \t\r\n')<>'' order by field,value,ordinal
  )
  select coalesce(jsonb_agg(jsonb_build_object('field',field,'value',value,'source_field',source_field) order by ordinal),'[]'::jsonb)
    into filters from distinct_values;
  return jsonb_build_object('role_id',role.id,'include_unknown',true,'suggested_filters',filters,'explanations',jsonb_build_array(
    'Suggestions copy explicit current role requirements. Change or clear any filter before searching.',
    'Unknown supplied candidate values remain included and labelled; known contradictions do not match.',
    'These filters do not rank suitability or select a candidate.'));
end $$;
revoke all on function public.eps_suggest_candidate_filters(uuid) from public,anon,authenticated,service_role;
grant create on schema public to eps_specs_owner;
alter function public.eps_suggest_candidate_filters(uuid) owner to eps_specs_owner;
revoke create on schema public from eps_specs_owner;
grant execute on function public.eps_suggest_candidate_filters(uuid) to authenticated;
