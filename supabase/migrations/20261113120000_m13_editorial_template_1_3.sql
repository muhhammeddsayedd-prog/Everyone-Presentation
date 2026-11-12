-- Everyone Film editorial presentation template 1.3.0 (additive, forward-only).
-- Owner decision 2026-11-05/12: one page per slot with its Main, Option and Backup side by
-- side (up to three per page), only the facts that were provided, Pending pages that list
-- only the given requirements, and 1.3.0 as the only template offered for new series.
-- Registers the pinned template, adds an independent SQL mirror of its composer, and makes
-- every gate that admits 1.1.0/1.2.0 also admit 1.3.0. Existing 1.0.0/1.1.0/1.2.0 series,
-- versions, snapshots, manifests, PDFs and links are never rewritten, and the application
-- setting is NOT changed here (a producer selects 1.3.0 in Settings afterwards).
-- Requires 20261104210000 (m08) and 20261104230000 (m08 fit fonts). Function bodies are
-- patched in place with exact-once needles against the eight pinned preimages (the m08 and
-- m08-fit-font postimages, verified on the staging replica); any other body is refused.
set local search_path='';set local lock_timeout='5s';set local statement_timeout='45s';

do $m13_target$begin
 if current_user<>'postgres'
 or exists(select 1 from eps.presentation_templates where key='everyone-casting'and version='1.3.0')
 or not exists(select 1 from eps.presentation_templates where key='everyone-casting'and version='1.2.0'and registered)
 or not exists(select 1 from supabase_migrations.schema_migrations where version='20261104210000')
 or not exists(select 1 from supabase_migrations.schema_migrations where version='20261104230000')
 or to_regprocedure('eps.editorial_deck_counts(jsonb)')is null
 or to_regprocedure('eps.editorial_deck_counts_1_3(jsonb)')is not null
 then raise exception'M13_EDITORIAL_TARGET_REQUIRED';end if;
 if(select jsonb_object_agg(p.oid::regprocedure::text,encode(sha256(convert_to(p.prosrc,'UTF8')),'hex'))from pg_proc p
   where p.oid::regprocedure::text=any(array(select jsonb_object_keys('{"eps.export_validate_result(eps.jobs,jsonb)":"612c3097f2d4a7337ae0b35502e79bae82c7af46aac5bee1ac279928d9d53d54","eps.presentation_validate_result(eps.jobs,jsonb)":"0d80168e25763f73d286494e45d58ec578cd39509000f12cc4d787611928c605","eps.review_snapshot_data(uuid,uuid,text)":"9f3b50b8fdfb0c46efb96260d6886d938c861f27d44fd02bfa9e5047684329f4","eps.review_validate_fit(eps.jobs,jsonb)":"91e27a9c641f64243a03fe54969e9f9f634bee62a50e0ff97a9534682d65adf0","public.eps_generate_version(uuid,jsonb,text)":"b4a91343c6d805309536f75f73766edc0d11d403ee22bfcd858e47a66aa90333","public.eps_get_workspace_review(uuid,uuid,text)":"152511802f304f1e8d20843559d9fb69be70e8228cb00ff972c9ee627bca5fb7","public.eps_request_workspace_review_fit(uuid,uuid,jsonb,text)":"4463ab7cf4b8da6422799a35a569b7a297ea3cfdb9edd43752312f05d6e261a2","public.eps_update_settings(jsonb,text)":"c02d4d82f51e53b6c8759515a04315363f075abcb427a960e3af6cd7889d31b7"}'::jsonb))))
   is distinct from'{"eps.export_validate_result(eps.jobs,jsonb)":"612c3097f2d4a7337ae0b35502e79bae82c7af46aac5bee1ac279928d9d53d54","eps.presentation_validate_result(eps.jobs,jsonb)":"0d80168e25763f73d286494e45d58ec578cd39509000f12cc4d787611928c605","eps.review_snapshot_data(uuid,uuid,text)":"9f3b50b8fdfb0c46efb96260d6886d938c861f27d44fd02bfa9e5047684329f4","eps.review_validate_fit(eps.jobs,jsonb)":"91e27a9c641f64243a03fe54969e9f9f634bee62a50e0ff97a9534682d65adf0","public.eps_generate_version(uuid,jsonb,text)":"b4a91343c6d805309536f75f73766edc0d11d403ee22bfcd858e47a66aa90333","public.eps_get_workspace_review(uuid,uuid,text)":"152511802f304f1e8d20843559d9fb69be70e8228cb00ff972c9ee627bca5fb7","public.eps_request_workspace_review_fit(uuid,uuid,jsonb,text)":"4463ab7cf4b8da6422799a35a569b7a297ea3cfdb9edd43752312f05d6e261a2","public.eps_update_settings(jsonb,text)":"c02d4d82f51e53b6c8759515a04315363f075abcb427a960e3af6cd7889d31b7"}'::jsonb
 then raise exception'M13_EDITORIAL_PREIMAGE_REQUIRED';end if;
end$m13_target$;

insert into eps.presentation_templates(key,version,content_sha256,font_key,font_hashes)values('everyone-casting','1.3.0',
 '1e62d22bc41141a085ca2eab974062193a52c1bd95ab8031de2da7c34028c665','everyone-film-fonts-v1',
 '{"apps/web/public/fonts/GeneralSans-Extralight.ttf":"e26c7ded77651217471b2b9d776230092576715990195e4d33a13e51e7f3758e","apps/web/public/fonts/GeneralSans-Light.ttf":"3dafccbe82a8a71b79d78049d65665c3020af89cb960737fabfc0003f87efe1d","apps/web/public/fonts/GeneralSans-Regular.ttf":"2e758fefe5a80a0c910505473de241a74cf6dd914ad6d576d571b610ee8efaf1","apps/web/public/fonts/GeneralSans-Medium.ttf":"21a95d0f3b25dbe4ccbe3d7f45664069249ff1ccd030172878e7f68d85833cea","apps/web/public/fonts/GeneralSans-Semibold.ttf":"48ae5b24f0c1b040cab1e1884ed9a8bca45a4028999bfd2e76184dfe215a0856","apps/web/public/fonts/GeneralSans-Bold.ttf":"fa87dd6422149ef8235b9038db3ee0f0e4addb29971a4d69483211ad7a451ab3","apps/web/public/fonts/IBMPlexSansArabic-Regular.woff2":"74112e1b7bf2e2c547989a4e947a60cba6cd1f9156e0065670134636e717199d","apps/web/public/fonts/IBMPlexSansArabic-Medium.woff2":"c72f6986f50ded745d06e71e508096209c52a55a6b3a81029954e33c52ba1dd2","apps/web/public/fonts/IBMPlexSansArabic-SemiBold.woff2":"869b2acd0a9660607a2025f0fe1c640110bf23d33417509328f07722922b8063"}'::jsonb);

-- Independent mirror of packages/templates/versions/1.3.0/compose-casting.ts
-- (composeCastingDeck + deckCounts) over the frozen snapshot. A disagreement makes the
-- render/export proof fail closed; nothing is ever accepted on worker word alone.
-- JavaScript String.prototype.trim (ECMAScript WhiteSpace + LineTerminator).
create function eps.editorial13_trim(p text)returns text language sql immutable security invoker set search_path=''as $$
 select regexp_replace(coalesce(p,''),'^[\u0009-\u000d    -     　﻿]+|[\u0009-\u000d    -     　﻿]+$','','g')$$;
-- A fact is provided when it is a string that is neither blank nor "Not provided".
create function eps.editorial13_provided(p jsonb)returns boolean language sql immutable security invoker set search_path=''as $$
 select coalesce(jsonb_typeof(p)='string'and eps.editorial13_trim(p#>>'{}')not in('','Not provided'),false)$$;
-- Planned value lines under a portrait: JavaScript length (UTF-16 code units) over the column's characters per line, 1..4.
create function eps.editorial13_lines(p text,p_per_line integer)returns integer language sql immutable security invoker set search_path=''as $$
 select greatest(1,least(4,ceil((length(p)+length(regexp_replace(p,'[^\U00010000-\U0010FFFF]','','g')))::numeric/p_per_line)::integer))$$;

create function eps.editorial_deck_counts_1_3(p_snapshot jsonb)returns jsonb language plpgsql immutable security invoker set search_path=''as $$
declare slides jsonb;s jsonb;person jsonb;req jsonb;total integer;n integer:=0;
 prev_role text;prev_role_set boolean:=false;prev_category text;current_category text;
 group_size integer;fits boolean;per_line integer;height numeric;facts integer;page_count integer;start integer;size integer;remaining integer;
 pages integer:=2;dividers integer:=0;regions integer:=0;fields integer:=0;frames integer:=0;placeholders integer:=0;logo_draws integer:=0;cover_regions integer:=2;
 field_keys constant text[]:=array['name_or_id','age_or_range','height_measurements','languages_accents','skills_experience','city','previous_projects_roles','classification','availability','presentation_notes'];
 requirement_keys constant text[]:=array['age_range','gender_requirement','appearance_performance','languages','accents','skills','scene_references','shoot_dates','location','availability_requirements','other_instructions'];
begin
 select coalesce(jsonb_agg(v order by o),'[]'::jsonb)into slides from jsonb_array_elements(p_snapshot->'slides')with ordinality a(v,o)where v->>'kind'<>'cover';
 total:=jsonb_array_length(slides);
 while n<total loop
  s:=slides->n;
  -- A new role (or any role-less slide) may open a category divider.
  if not prev_role_set or prev_role is null or(s->>'role_id')is distinct from prev_role then
   current_category:=nullif(eps.editorial13_trim(s->>'role_category'),'');
   if current_category is not null and current_category is distinct from prev_category then dividers:=dividers+1;end if;
   prev_category:=current_category;prev_role:=s->>'role_id';prev_role_set:=true;
  end if;
  if s->>'kind'<>'candidate'then
   -- Pending page: heading, subtitle, page number, "Pending", the provided requirements (label + value), note; the placeholder image.
   facts:=case when eps.editorial13_provided(s->'role_category')then 1 else 0 end;
   for i in 1..array_length(requirement_keys,1)loop
    req:=s->'requirements'->requirement_keys[i];
    if jsonb_typeof(req)='array'then req:=to_jsonb((select string_agg(e,'; 'order by o)from jsonb_array_elements_text(req)with ordinality x(e,o)));end if;
    if eps.editorial13_provided(req)then facts:=facts+1;end if;
   end loop;
   pages:=pages+1;regions:=regions+3+1+facts*2+1;placeholders:=placeholders+1;n:=n+1;continue;
  end if;
  -- The slot's people in captured order (a candidate without a slot stands alone).
  group_size:=1;
  if s->>'slot_id'is not null then
   while n+group_size<total and slides->(n+group_size)->>'kind'='candidate'and slides->(n+group_size)->>'slot_id'=s->>'slot_id'loop group_size:=group_size+1;end loop;
  end if;
  -- Side by side only when every person's provided facts (name excluded) fit under the smallest portrait.
  per_line:=case when group_size=2 then 30 else 26 end;fits:=group_size>=2;
  if fits then for m in n..n+group_size-1 loop
   height:=0;
   for k in 2..10 loop
    if eps.editorial13_provided(slides->m->'fields'->field_keys[k])then height:=height+eps.editorial13_lines(slides->m->'fields'->>field_keys[k],per_line)*32.5+8;end if;
   end loop;
   if height>464.2 then fits:=false;end if;
  end loop;end if;
  -- Pages of at most three whose sizes differ by at most one; a page of one is a single-person page.
  remaining:=group_size;start:=n;page_count:=case when fits then ceil(group_size/3.0)::integer else group_size end;
  for k in 0..page_count-1 loop
   size:=case when fits then ceil(remaining::numeric/(page_count-k))::integer else 1 end;
   pages:=pages+1;regions:=regions+3;
   for m in start..start+size-1 loop
    person:=slides->m;
    if person->>'position'is not null then regions:=regions+1;end if;
    if person->>'video_asset_id'is not null then regions:=regions+1;end if;
    facts:=0;for k2 in 2..10 loop if eps.editorial13_provided(person->'fields'->field_keys[k2])then facts:=facts+1;end if;end loop;
    if size=1 then
     -- cast_detail: every selected frame (or the placeholder) beside only the provided facts, name included.
     if eps.editorial13_provided(person->'fields'->'name_or_id')then facts:=facts+1;end if;
     regions:=regions+facts*2;fields:=fields+facts;
     if jsonb_array_length(person->'frames')>0 then frames:=frames+jsonb_array_length(person->'frames');else placeholders:=placeholders+1;end if;
    else
     -- cast_group_detail: one portrait (first frame or the placeholder), the name caption and the provided facts.
     regions:=regions+1+facts*2;fields:=fields+1+facts;
     if jsonb_array_length(person->'frames')>0 then frames:=frames+1;else placeholders:=placeholders+1;end if;
    end if;
   end loop;
   start:=start+size;remaining:=remaining-size;
  end loop;
  n:=n+group_size;
 end loop;
 pages:=pages+dividers;
 if p_snapshot#>>'{cover,logo_asset_id}'is not null then logo_draws:=1+case when p_snapshot#>>'{cover,logo_placement}'='every_slide'then pages-2 else 0 end;
 elsif coalesce(p_snapshot#>>'{cover,client_name}','')<>''then cover_regions:=3;end if;
 return jsonb_build_object('pages',pages,'width_css_px',1920,'height_css_px',1080,'width_points',1440,'height_points',810,
  'candidate_fields',fields,'frame_draws',frames,'logo_draws',logo_draws,'placeholder_draws',placeholders,
  'text_regions',cover_regions+dividers*2+regions+1);
end$$;
-- Pure security-invoker helpers: callers get exactly the execute rights held on
-- eps.editorial_deck_counts (the 1.2.0 mirror), which follow eps.presentation_hash.
do $m13_grants$declare grantee record;fn text;begin
 foreach fn in array array['eps.editorial13_trim(text)','eps.editorial13_provided(jsonb)','eps.editorial13_lines(text,integer)','eps.editorial_deck_counts_1_3(jsonb)']loop
  execute format('revoke all on function %s from public',fn);
  for grantee in select distinct pg_get_userbyid(a.grantee)as name from pg_proc p,aclexplode(p.proacl)a
   where p.oid='eps.editorial_deck_counts(jsonb)'::regprocedure and a.privilege_type='EXECUTE'and a.grantee<>0 and a.grantee<>'postgres'::regrole loop
   execute format('grant execute on function %s to %I',fn,grantee.name);
  end loop;
 end loop;
end$m13_grants$;

do $m13_forward$
declare item record;source text;definition text;replacement text;
begin
 for item in select * from(values
  ('public.eps_update_settings(jsonb,text)',$n$p_input->>'template_version'not in('1.1.0','1.2.0')$n$,$r$p_input->>'template_version'not in('1.1.0','1.2.0','1.3.0')$r$),
  ('public.eps_get_workspace_review(uuid,uuid,text)',$n$review#>>'{template,version}'not in('1.1.0','1.2.0')then$n$,$r$review#>>'{template,version}'not in('1.1.0','1.2.0','1.3.0')then$r$),
  ('public.eps_request_workspace_review_fit(uuid,uuid,jsonb,text)',$n$template_version in('1.1.0','1.2.0'))then perform eps.fail('TEMPLATE_UPGRADE_REQUIRED'$n$,$r$template_version in('1.1.0','1.2.0','1.3.0'))then perform eps.fail('TEMPLATE_UPGRADE_REQUIRED'$r$),
  ('eps.review_snapshot_data(uuid,uuid,text)',$n$series.template_version in('1.1.0','1.2.0')then$n$,$r$series.template_version in('1.1.0','1.2.0','1.3.0')then$r$),
  ('public.eps_generate_version(uuid,jsonb,text)',$n$series.template_version not in('1.1.0','1.2.0')then perform eps.fail('TEMPLATE_UPGRADE_REQUIRED'$n$,$r$series.template_version not in('1.1.0','1.2.0','1.3.0')then perform eps.fail('TEMPLATE_UPGRADE_REQUIRED'$r$),
  ('public.eps_generate_version(uuid,jsonb,text)',$n$case when series.template_version='1.2.0'then(eps.editorial_deck_counts(snapshot)->>'pages')::integer else$n$,
   $r$case when series.template_version='1.2.0'then(eps.editorial_deck_counts(snapshot)->>'pages')::integer when series.template_version='1.3.0'then(eps.editorial_deck_counts_1_3(snapshot)->>'pages')::integer else$r$),
  -- Render/publish proof: 1.3.0 counts (including the provided-fact count) come from its own SQL mirror.
  ('eps.presentation_validate_result(eps.jobs,jsonb)',$n$if version.snapshot#>>'{template,version}'='1.2.0'then layout:=eps.editorial_deck_counts(version.snapshot);frame_count$n$,
   $r$layout:=case version.snapshot#>>'{template,version}'when'1.2.0'then eps.editorial_deck_counts(version.snapshot)when'1.3.0'then eps.editorial_deck_counts_1_3(version.snapshot)end;if layout is not null then frame_count$r$),
  ('eps.presentation_validate_result(eps.jobs,jsonb)',$n$proof->'candidate_field_count'=to_jsonb(candidate_count*10)$n$,$r$proof->'candidate_field_count'=coalesce(layout->'candidate_fields',to_jsonb(candidate_count*10))$r$),
  -- Guest export proof: same rule.
  ('eps.export_validate_result(eps.jobs,jsonb)',$n$if version.snapshot#>>'{template,version}'='1.2.0'then layout:=eps.editorial_deck_counts(version.snapshot);frame_count$n$,
   $r$layout:=case version.snapshot#>>'{template,version}'when'1.2.0'then eps.editorial_deck_counts(version.snapshot)when'1.3.0'then eps.editorial_deck_counts_1_3(version.snapshot)end;if layout is not null then frame_count$r$),
  ('eps.export_validate_result(eps.jobs,jsonb)',$n$proof->'candidate_field_count'=to_jsonb(candidate_count*10)$n$,$r$proof->'candidate_field_count'=coalesce(layout->'candidate_fields',to_jsonb(candidate_count*10))$r$),
  -- Fit results: 1.3.0 pins the same nine fonts as 1.2.0.
  ('eps.review_validate_fit(eps.jobs,jsonb)',$n$(case when p_job.input#>>'{template,version}'='1.2.0'then 9 else 6 end)$n$,$r$(case when p_job.input#>>'{template,version}'in('1.2.0','1.3.0')then 9 else 6 end)$r$)
 )v(signature,needle,patch)loop
  select replace(prosrc,E'\r\n',E'\n'),replace(pg_get_functiondef(oid),E'\r\n',E'\n')into source,definition from pg_proc where oid=item.signature::regprocedure;
  if(length(source)-length(replace(source,item.needle,'')))/length(item.needle)<>1 or position(item.patch in source)>0 then raise exception'M13_EDITORIAL_ANCHOR_REQUIRED:%',item.signature;end if;
  replacement:=replace(source,item.needle,item.patch);execute replace(definition,source,replacement);
 end loop;
end$m13_forward$;

-- Retained proof for the release readback: every gate that admits 1.2.0 now admits 1.3.0.
do $m13_readback$begin
 if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('eps','public')
   and p.oid::regprocedure::text not in('eps.review_target_context(uuid,text,uuid,text)','eps.editorial_deck_counts(jsonb)')and p.prosrc like'%''1.2.0''%'and p.prosrc not like'%''1.3.0''%')
 or(select count(*)from eps.presentation_templates where key='everyone-casting'and registered)<>4
 or(select jsonb_object_agg(p.oid::regprocedure::text,encode(sha256(convert_to(p.prosrc,'UTF8')),'hex'))from pg_proc p
   where p.oid::regprocedure::text=any(array(select jsonb_object_keys('{"eps.export_validate_result(eps.jobs,jsonb)":"78411ce41e6c08baffffe1c37435255b3f6e06d58961206bc75872535e8c55ff","eps.presentation_validate_result(eps.jobs,jsonb)":"11d73772ec83e9f780b1bc15a2f20cd2cd61c9351ffeee31554d72318d22d5b2","eps.review_snapshot_data(uuid,uuid,text)":"b22566c6985e6e4f97f2e6e9d7dd0e0c4e279223480c66f047d069a060362747","eps.review_validate_fit(eps.jobs,jsonb)":"07ab4c560f84d272c707ed73dad0a0b2d8fdfc9eb218231560bf481d3bbb9166","public.eps_generate_version(uuid,jsonb,text)":"b32644eba8c3fd1a1e5775d9e949adbf87cbfb766021e2da89fe9b1107139e5f","public.eps_get_workspace_review(uuid,uuid,text)":"e0bf0ddb15246d2f9856b61ca60abfd8a845198babe5ec79d48d1f9e948d9c5c","public.eps_request_workspace_review_fit(uuid,uuid,jsonb,text)":"8fd926228a600b70f5994bdf26164befe694f0f0243d68a09cb2da572e99b76c","public.eps_update_settings(jsonb,text)":"53cab1029afe4d79de4aa6f9ae9dd4bc913b5ebcaa3fa15d0997a7549d07fb91"}'::jsonb))))is distinct from'{"eps.export_validate_result(eps.jobs,jsonb)":"78411ce41e6c08baffffe1c37435255b3f6e06d58961206bc75872535e8c55ff","eps.presentation_validate_result(eps.jobs,jsonb)":"11d73772ec83e9f780b1bc15a2f20cd2cd61c9351ffeee31554d72318d22d5b2","eps.review_snapshot_data(uuid,uuid,text)":"b22566c6985e6e4f97f2e6e9d7dd0e0c4e279223480c66f047d069a060362747","eps.review_validate_fit(eps.jobs,jsonb)":"07ab4c560f84d272c707ed73dad0a0b2d8fdfc9eb218231560bf481d3bbb9166","public.eps_generate_version(uuid,jsonb,text)":"b32644eba8c3fd1a1e5775d9e949adbf87cbfb766021e2da89fe9b1107139e5f","public.eps_get_workspace_review(uuid,uuid,text)":"e0bf0ddb15246d2f9856b61ca60abfd8a845198babe5ec79d48d1f9e948d9c5c","public.eps_request_workspace_review_fit(uuid,uuid,jsonb,text)":"8fd926228a600b70f5994bdf26164befe694f0f0243d68a09cb2da572e99b76c","public.eps_update_settings(jsonb,text)":"53cab1029afe4d79de4aa6f9ae9dd4bc913b5ebcaa3fa15d0997a7549d07fb91"}'::jsonb
 then raise exception'M13_EDITORIAL_READBACK_FAILED';end if;
end$m13_readback$;
