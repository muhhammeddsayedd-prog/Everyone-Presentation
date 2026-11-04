-- Everyone Film editorial presentation template 1.2.0 (additive, forward-only).
-- Registers the pinned template and makes every 1.1.0-only gate template-aware.
-- Existing 1.0.0/1.1.0 series, versions, snapshots, manifests, PDFs and links are
-- never rewritten; the application setting is NOT changed here (a producer selects
-- 1.2.0 in Settings, which then applies to future series only).
-- Function bodies are patched in place with exact-once needles. The seven preimage
-- hashes were read from canonical history 42 on 4 Nov 2026 (read-only) and the
-- postimage hashes come from the staging replica of that catalogue
-- (development/editorial-template/staging/build_staging.py); any other body is refused.
set local search_path='';set local lock_timeout='5s';set local statement_timeout='45s';

do $editorial_target$begin
 if current_user<>'postgres'or exists(select 1 from eps.presentation_templates where key='everyone-casting'and version='1.2.0')
 or not exists(select 1 from eps.presentation_templates where key='everyone-casting'and version='1.1.0'and registered)
 or to_regprocedure('eps.editorial_deck_counts(jsonb)')is not null then raise exception'M08_EDITORIAL_TARGET_REQUIRED';end if;
 -- Every live body that pins 1.1.0 must be one this migration handles (or the AI
 -- target context, which keeps its retained 1.1.0 wording-budget identity).
 if(select array_agg(p.oid::regprocedure::text order by p.oid::regprocedure::text)from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname in('eps','public')and p.prosrc like'%''1.1.0''%')is distinct from(select array_agg(x order by x)from unnest(array[
   'eps.export_validate_result(eps.jobs,jsonb)','eps.review_snapshot_data(uuid,uuid,text)','eps.review_target_context(uuid,text,uuid,text)',
   'public.eps_generate_version(uuid,jsonb,text)','public.eps_get_workspace_review(uuid,uuid,text)','public.eps_request_workspace_review_fit(uuid,uuid,jsonb,text)','public.eps_update_settings(jsonb,text)'])x)
 then raise exception'M08_EDITORIAL_UNEXPECTED_TEMPLATE_GATES';end if;
 if(select jsonb_object_agg(p.oid::regprocedure::text,encode(sha256(convert_to(p.prosrc,'UTF8')),'hex'))from pg_proc p
   where p.oid::regprocedure::text=any(array(select jsonb_object_keys('{"eps.export_validate_result(eps.jobs,jsonb)":"7dc274566d902b7473c2a26af7f515e2c38e0b362947a4398f770adb2b2e49ff","eps.presentation_validate_result(eps.jobs,jsonb)":"f964aac1940da81a3ec43e9712f5793eea455139485097c947382e64d9800cdd","eps.review_snapshot_data(uuid,uuid,text)":"0dba1d407199191d3bbb4d84ddab94d9f4e33da6a0172738b86133e8c7bf61fd","public.eps_generate_version(uuid,jsonb,text)":"af486a7217ed5ddafea5d98dc2979d928a8e9ba675862ef0960c2930b362b198","public.eps_get_workspace_review(uuid,uuid,text)":"5bf2f621c4df891506302255f0d4daaa25b43db3f857ca171463edc99d8ce5cd","public.eps_request_workspace_review_fit(uuid,uuid,jsonb,text)":"2fe4675505f78bfb02ff98c0c1e22d0ae47ae5e0d370c85e1441dd376505ada9","public.eps_update_settings(jsonb,text)":"b9d0e9a97580afac6142880e0a3acd010c2bfe4c751a98164890be09b25f9724"}'::jsonb))))is distinct from '{"eps.export_validate_result(eps.jobs,jsonb)":"7dc274566d902b7473c2a26af7f515e2c38e0b362947a4398f770adb2b2e49ff","eps.presentation_validate_result(eps.jobs,jsonb)":"f964aac1940da81a3ec43e9712f5793eea455139485097c947382e64d9800cdd","eps.review_snapshot_data(uuid,uuid,text)":"0dba1d407199191d3bbb4d84ddab94d9f4e33da6a0172738b86133e8c7bf61fd","public.eps_generate_version(uuid,jsonb,text)":"af486a7217ed5ddafea5d98dc2979d928a8e9ba675862ef0960c2930b362b198","public.eps_get_workspace_review(uuid,uuid,text)":"5bf2f621c4df891506302255f0d4daaa25b43db3f857ca171463edc99d8ce5cd","public.eps_request_workspace_review_fit(uuid,uuid,jsonb,text)":"2fe4675505f78bfb02ff98c0c1e22d0ae47ae5e0d370c85e1441dd376505ada9","public.eps_update_settings(jsonb,text)":"b9d0e9a97580afac6142880e0a3acd010c2bfe4c751a98164890be09b25f9724"}'::jsonb
 then raise exception'M08_EDITORIAL_PREIMAGE_REQUIRED';end if;
end$editorial_target$;

insert into eps.presentation_templates(key,version,content_sha256,font_key,font_hashes)values('everyone-casting','1.2.0',
 '9f6e281af2ec274af0762eb5fc9a4baa8a1a0130345ac0c3bb8a0477e09c2d4a','everyone-film-fonts-v1',
 '{"apps/web/public/fonts/GeneralSans-Extralight.ttf":"e26c7ded77651217471b2b9d776230092576715990195e4d33a13e51e7f3758e","apps/web/public/fonts/GeneralSans-Light.ttf":"3dafccbe82a8a71b79d78049d65665c3020af89cb960737fabfc0003f87efe1d","apps/web/public/fonts/GeneralSans-Regular.ttf":"2e758fefe5a80a0c910505473de241a74cf6dd914ad6d576d571b610ee8efaf1","apps/web/public/fonts/GeneralSans-Medium.ttf":"21a95d0f3b25dbe4ccbe3d7f45664069249ff1ccd030172878e7f68d85833cea","apps/web/public/fonts/GeneralSans-Semibold.ttf":"48ae5b24f0c1b040cab1e1884ed9a8bca45a4028999bfd2e76184dfe215a0856","apps/web/public/fonts/GeneralSans-Bold.ttf":"fa87dd6422149ef8235b9038db3ee0f0e4addb29971a4d69483211ad7a451ab3","apps/web/public/fonts/IBMPlexSansArabic-Regular.woff2":"74112e1b7bf2e2c547989a4e947a60cba6cd1f9156e0065670134636e717199d","apps/web/public/fonts/IBMPlexSansArabic-Medium.woff2":"c72f6986f50ded745d06e71e508096209c52a55a6b3a81029954e33c52ba1dd2","apps/web/public/fonts/IBMPlexSansArabic-SemiBold.woff2":"869b2acd0a9660607a2025f0fe1c640110bf23d33417509328f07722922b8063"}'::jsonb);

-- Independent mirror of packages/templates/versions/1.2.0/compose-casting.ts
-- (composeCastingDeck + deckCounts) over the frozen snapshot. A disagreement makes
-- the render/export proof fail closed; nothing is ever accepted on worker word alone.
create function eps.editorial_deck_counts(p_snapshot jsonb)returns jsonb language plpgsql immutable security invoker set search_path=''as $$
declare s jsonb;n integer:=0;total integer;slides jsonb;prev_set boolean:=false;prev_role text;prev_category text;current_category text;
 dividers integer:=0;overview_pages integer:=0;overview_portraits integer:=0;overview_framed integer:=0;overview_labels integer:=0;
 candidates integer:=0;pendings integer:=0;frames integer:=0;no_frames integer:=0;positions integer:=0;
 group_size integer;group_framed integer;group_labelled boolean;m integer;pages integer;logo_draws integer:=0;cover_regions integer:=2;begin
 select coalesce(jsonb_agg(v order by o),'[]'::jsonb)into slides from jsonb_array_elements(p_snapshot->'slides')with ordinality a(v,o)where v->>'kind'<>'cover';
 total:=jsonb_array_length(slides);
 while n<total loop
  s:=slides->n;
  if not prev_set or prev_role is null or(s->>'role_id')is distinct from prev_role then
   current_category:=nullif(regexp_replace(coalesce(s->>'role_category',''),'^[[:space:]]+|[[:space:]]+$','','g'),'');
   if current_category is not null and current_category is distinct from prev_category then dividers:=dividers+1;end if;
   prev_category:=current_category;prev_role:=s->>'role_id';prev_set:=true;
  end if;
  if s->>'slot_id'is not null and(n=0 or(slides->(n-1)->>'slot_id')is distinct from(s->>'slot_id'))then
   group_size:=0;group_framed:=0;group_labelled:=false;m:=n;
   while m<total and slides->m->>'slot_id'=s->>'slot_id'and slides->m->>'kind'='candidate'loop
    group_size:=group_size+1;if jsonb_array_length(slides->m->'frames')>0 then group_framed:=group_framed+1;end if;
    if slides->m->>'position'in('main','backup')then group_labelled:=true;end if;m:=m+1;
   end loop;
   if group_size>=2 then
    overview_pages:=overview_pages+ceil(group_size/3.0)::integer;overview_portraits:=overview_portraits+group_size;overview_framed:=overview_framed+group_framed;
    if group_labelled then overview_labels:=overview_labels+group_size;end if;
   end if;
  end if;
  if s->>'kind'='candidate'then
   candidates:=candidates+1;frames:=frames+jsonb_array_length(s->'frames');
   if jsonb_array_length(s->'frames')=0 then no_frames:=no_frames+1;end if;if s->>'position'is not null then positions:=positions+1;end if;
  else pendings:=pendings+1;end if;
  n:=n+1;
 end loop;
 pages:=2+dividers+overview_pages+candidates+pendings;
 if p_snapshot#>>'{cover,logo_asset_id}'is not null then logo_draws:=1+case when p_snapshot#>>'{cover,logo_placement}'='every_slide'then pages-2 else 0 end;
 elsif coalesce(p_snapshot#>>'{cover,client_name}','')<>''then cover_regions:=3;end if;
 return jsonb_build_object('pages',pages,'width_css_px',1920,'height_css_px',1080,'width_points',1440,'height_points',810,
  'candidate_fields',candidates*10,'frame_draws',frames+overview_framed,'logo_draws',logo_draws,
  'placeholder_draws',(overview_portraits-overview_framed)+no_frames+pendings,
  'text_regions',cover_regions+dividers*2+overview_pages*3+overview_portraits+overview_labels+candidates*24+positions+no_frames+pendings*29+1);
end$$;
-- Pure security-invoker helper: callers get exactly the execute rights held on
-- eps.presentation_hash, including its owner eps_review_owner, which owns the
-- security-definer eps_generate_version that calls this helper.
do $editorial_grants$declare grantee record;begin
 revoke all on function eps.editorial_deck_counts(jsonb)from public;
 for grantee in select distinct pg_get_userbyid(a.grantee)as name from pg_proc p,aclexplode(p.proacl)a
  where p.oid='eps.presentation_hash(jsonb)'::regprocedure and a.privilege_type='EXECUTE'and a.grantee<>0 and a.grantee<>'postgres'::regrole loop
  execute format('grant execute on function eps.editorial_deck_counts(jsonb)to %I',grantee.name);
 end loop;
end$editorial_grants$;

do $editorial_forward$
declare item record;source text;definition text;replacement text;
begin
 for item in select * from(values
  ('public.eps_update_settings(jsonb,text)',$n$p_input->>'template_version'<>'1.1.0'$n$,$r$p_input->>'template_version'not in('1.1.0','1.2.0')$r$),
  ('public.eps_get_workspace_review(uuid,uuid,text)',$n$review#>>'{template,version}'<>'1.1.0'then$n$,$r$review#>>'{template,version}'not in('1.1.0','1.2.0')then$r$),
  ('public.eps_request_workspace_review_fit(uuid,uuid,jsonb,text)',$n$template_version='1.1.0')then perform eps.fail('TEMPLATE_UPGRADE_REQUIRED'$n$,$r$template_version in('1.1.0','1.2.0'))then perform eps.fail('TEMPLATE_UPGRADE_REQUIRED'$r$),
  ('eps.review_snapshot_data(uuid,uuid,text)',$n$series.template_version='1.1.0'then$n$,$r$series.template_version in('1.1.0','1.2.0')then$r$),
  ('public.eps_generate_version(uuid,jsonb,text)',$n$series.template_version<>'1.1.0'then perform eps.fail('TEMPLATE_UPGRADE_REQUIRED'$n$,$r$series.template_version not in('1.1.0','1.2.0')then perform eps.fail('TEMPLATE_UPGRADE_REQUIRED'$r$),
  ('public.eps_generate_version(uuid,jsonb,text)',$n$inventory_hash,jsonb_array_length(slides),job_id,$n$,$r$inventory_hash,case when series.template_version='1.2.0'then(eps.editorial_deck_counts(snapshot)->>'pages')::integer else jsonb_array_length(slides)end,job_id,$r$),
  -- Render/publish proof: 1.2.0 counts come from the independent SQL mirror.
  ('eps.presentation_validate_result(eps.jobs,jsonb)',$n$video_count integer;link_hash text;begin$n$,$r$video_count integer;link_hash text;layout jsonb;begin$r$),
  ('eps.presentation_validate_result(eps.jobs,jsonb)',$n$into candidate_count,pending_count,frame_count,logo_count,video_count from jsonb_array_elements(version.snapshot->'slides')s;$n$,
   $r$into candidate_count,pending_count,frame_count,logo_count,video_count from jsonb_array_elements(version.snapshot->'slides')s;
 if version.snapshot#>>'{template,version}'='1.2.0'then layout:=eps.editorial_deck_counts(version.snapshot);frame_count:=(layout->>'frame_draws')::integer;logo_count:=(layout->>'logo_draws')::integer;end if;$r$),
  ('eps.presentation_validate_result(eps.jobs,jsonb)',$n$proof->'width_css_px'='1600'and proof->'height_css_px'='900'$n$,$r$proof->'width_css_px'=coalesce(layout->'width_css_px','1600')and proof->'height_css_px'=coalesce(layout->'height_css_px','900')$r$),
  ('eps.presentation_validate_result(eps.jobs,jsonb)',$n$abs((proof->>'width_points')::numeric-1200)<=0.5$n$,$r$abs((proof->>'width_points')::numeric-coalesce((layout->>'width_points')::numeric,1200))<=0.5$r$),
  ('eps.presentation_validate_result(eps.jobs,jsonb)',$n$abs((proof->>'height_points')::numeric-675)<=0.5$n$,$r$abs((proof->>'height_points')::numeric-coalesce((layout->>'height_points')::numeric,675))<=0.5$r$),
  ('eps.presentation_validate_result(eps.jobs,jsonb)',$n$proof->'text_regions_checked'=to_jsonb(3+candidate_count*23+pending_count*27)$n$,$r$proof->'text_regions_checked'=coalesce(layout->'text_regions',to_jsonb(3+candidate_count*23+pending_count*27))$r$),
  ('eps.presentation_validate_result(eps.jobs,jsonb)',$n$proof->'image_draws_checked'=to_jsonb(frame_count+logo_count)$n$,$r$proof->'image_draws_checked'=to_jsonb(frame_count+logo_count+coalesce((layout->>'placeholder_draws')::integer,0))$r$),
  -- Guest export proof: same rule.
  ('eps.export_validate_result(eps.jobs,jsonb)',$n$video_count integer;begin$n$,$r$video_count integer;layout jsonb;begin$r$),
  ('eps.export_validate_result(eps.jobs,jsonb)',$n$into candidate_count,pending_count,frame_count,logo_count,video_count from jsonb_array_elements(version.snapshot->'slides')s;$n$,
   $r$into candidate_count,pending_count,frame_count,logo_count,video_count from jsonb_array_elements(version.snapshot->'slides')s;
 if version.snapshot#>>'{template,version}'='1.2.0'then layout:=eps.editorial_deck_counts(version.snapshot);frame_count:=(layout->>'frame_draws')::integer;logo_count:=(layout->>'logo_draws')::integer;end if;$r$),
  ('eps.export_validate_result(eps.jobs,jsonb)',$n$proof->'width_css_px'='1600'and proof->'height_css_px'='900'$n$,$r$proof->'width_css_px'=coalesce(layout->'width_css_px','1600')and proof->'height_css_px'=coalesce(layout->'height_css_px','900')$r$),
  ('eps.export_validate_result(eps.jobs,jsonb)',$n$abs((validation->>'width_points')::numeric-1200)<=0.5$n$,$r$abs((validation->>'width_points')::numeric-coalesce((layout->>'width_points')::numeric,1200))<=0.5$r$),
  ('eps.export_validate_result(eps.jobs,jsonb)',$n$abs((validation->>'height_points')::numeric-675)<=0.5$n$,$r$abs((validation->>'height_points')::numeric-coalesce((layout->>'height_points')::numeric,675))<=0.5$r$),
  ('eps.export_validate_result(eps.jobs,jsonb)',$n$validation->'text_regions_checked'=to_jsonb(3+candidate_count*23+pending_count*case when version.snapshot#>>'{template,version}'='1.1.0'then 27 else 4 end)$n$,
   $r$validation->'text_regions_checked'=coalesce(layout->'text_regions',to_jsonb(3+candidate_count*23+pending_count*case when version.snapshot#>>'{template,version}'='1.1.0'then 27 else 4 end))$r$),
  ('eps.export_validate_result(eps.jobs,jsonb)',$n$validation->'image_draws_checked'=to_jsonb(frame_count+logo_count)$n$,$r$validation->'image_draws_checked'=to_jsonb(frame_count+logo_count+coalesce((layout->>'placeholder_draws')::integer,0))$r$)
 )v(signature,needle,patch)loop
  select replace(prosrc,E'\r\n',E'\n'),replace(pg_get_functiondef(oid),E'\r\n',E'\n')into source,definition from pg_proc where oid=item.signature::regprocedure;
  if(length(source)-length(replace(source,item.needle,'')))/length(item.needle)<>1 or position(item.patch in source)>0 then raise exception'M08_EDITORIAL_ANCHOR_REQUIRED:%',item.signature;end if;
  replacement:=replace(source,item.needle,item.patch);execute replace(definition,source,replacement);
 end loop;
end$editorial_forward$;

-- Retained proof for the release readback: every 1.1.0 gate now admits 1.2.0.
do $editorial_readback$begin
 if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('eps','public')
   and p.oid::regprocedure::text<>'eps.review_target_context(uuid,text,uuid,text)'and p.prosrc like'%''1.1.0''%'and p.prosrc not like'%''1.2.0''%')
 or(select count(*)from eps.presentation_templates where key='everyone-casting'and registered)<>3
 or(select jsonb_object_agg(p.oid::regprocedure::text,encode(sha256(convert_to(p.prosrc,'UTF8')),'hex'))from pg_proc p
   where p.oid::regprocedure::text=any(array(select jsonb_object_keys('{"eps.export_validate_result(eps.jobs,jsonb)":"612c3097f2d4a7337ae0b35502e79bae82c7af46aac5bee1ac279928d9d53d54","eps.presentation_validate_result(eps.jobs,jsonb)":"0d80168e25763f73d286494e45d58ec578cd39509000f12cc4d787611928c605","eps.review_snapshot_data(uuid,uuid,text)":"9f3b50b8fdfb0c46efb96260d6886d938c861f27d44fd02bfa9e5047684329f4","public.eps_generate_version(uuid,jsonb,text)":"b4a91343c6d805309536f75f73766edc0d11d403ee22bfcd858e47a66aa90333","public.eps_get_workspace_review(uuid,uuid,text)":"152511802f304f1e8d20843559d9fb69be70e8228cb00ff972c9ee627bca5fb7","public.eps_request_workspace_review_fit(uuid,uuid,jsonb,text)":"4463ab7cf4b8da6422799a35a569b7a297ea3cfdb9edd43752312f05d6e261a2","public.eps_update_settings(jsonb,text)":"c02d4d82f51e53b6c8759515a04315363f075abcb427a960e3af6cd7889d31b7"}'::jsonb))))is distinct from '{"eps.export_validate_result(eps.jobs,jsonb)":"612c3097f2d4a7337ae0b35502e79bae82c7af46aac5bee1ac279928d9d53d54","eps.presentation_validate_result(eps.jobs,jsonb)":"0d80168e25763f73d286494e45d58ec578cd39509000f12cc4d787611928c605","eps.review_snapshot_data(uuid,uuid,text)":"9f3b50b8fdfb0c46efb96260d6886d938c861f27d44fd02bfa9e5047684329f4","public.eps_generate_version(uuid,jsonb,text)":"b4a91343c6d805309536f75f73766edc0d11d403ee22bfcd858e47a66aa90333","public.eps_get_workspace_review(uuid,uuid,text)":"152511802f304f1e8d20843559d9fb69be70e8228cb00ff972c9ee627bca5fb7","public.eps_request_workspace_review_fit(uuid,uuid,jsonb,text)":"4463ab7cf4b8da6422799a35a569b7a297ea3cfdb9edd43752312f05d6e261a2","public.eps_update_settings(jsonb,text)":"c02d4d82f51e53b6c8759515a04315363f075abcb427a960e3af6cd7889d31b7"}'::jsonb
 then raise exception'M08_EDITORIAL_READBACK_FAILED';end if;
end$editorial_readback$;
