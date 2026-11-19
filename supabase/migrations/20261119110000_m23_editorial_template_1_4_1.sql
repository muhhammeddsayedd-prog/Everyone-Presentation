-- Everyone Film editorial presentation template 1.4.1 (additive, forward-only).
-- 1.4.1 is the 1.4.0 Floward cast shortlist layout plus, under every person's portrait, only their name, age and
-- height (each only when provided; the height is the height part of the free-text measurements, never the weight,
-- with its unit only when one is stated). Captions never change the pages. 1.4.0 and every earlier template, their
-- series, versions, snapshots, manifests, PDFs and links are never rewritten and keep their validation unchanged.
--
-- 1. Registers the pinned template (content and the nine font hashes, the same fonts as 1.4.0).
-- 2. eps.editorial_deck_counts_1_4_1: the 1.4.0 page mirror (pages, pictures and silhouettes are identical) plus the
--    caption text regions, with eps.editorial141_has_height mirroring the composer's height grammar
--    (packages/templates/versions/1.4.1/compose-casting.ts, LABELLED_HEIGHT / LEADING_HEIGHT).
-- 3. Admits 1.4.1 wherever m19 admits 1.4.0: Settings, review, fit request, review capture of the presentation
--    context (cover note, scenes, notes, pinned portraits), generation (portrait/photo inventory, presentation
--    context in the snapshot, page count), render/export proof (no PDF video links), fit font inventory and the
--    archive-photo pin policy. Read paths that follow the frozen snapshot (manifest, render context, guest DTO,
--    storage and version-asset reads) are version-agnostic since m19 and need no change.
-- 4. Fit messages for the two caption regions.
-- The Settings default is NOT changed here (the owner selects 1.4.1 in Settings). Requires m22. Function bodies are
-- patched with exact-once needles against pinned preimages (post-m22 bodies on the cycle-8 replica, hashed after
-- CRLF->LF normalisation); any other body is refused. A second run is refused (M23_ALREADY_APPLIED).
set local search_path='';set local lock_timeout='5s';set local statement_timeout='60s';

do $m23_target$begin
 if exists(select 1 from eps.presentation_templates where key='everyone-casting'and version='1.4.1')
 or to_regprocedure('eps.editorial_deck_counts_1_4_1(jsonb)')is not null
 then raise exception'M23_ALREADY_APPLIED';end if;
 if current_user<>'postgres'then raise exception'M23_EDITORIAL_TARGET_REQUIRED';end if;
 if to_regprocedure('eps.specs_stage_metadata(jsonb,eps.jobs,jsonb)')is null
 or(select prosrc from pg_proc where oid='eps.specs_stage_metadata(jsonb,eps.jobs,jsonb)'::regprocedure)!~'a57c08f1e016f2187e91faa8a5d42f97b3f6861ac15608ea4267a82332d729d1'
 then raise exception'M23_REQUIRES_M22';end if;
 if not exists(select 1 from eps.presentation_templates where key='everyone-casting'and version='1.4.0'and registered
   and content_sha256='b4fbd16ff5038c8a97583d1225294fbe0c26b71439f850e7fb888ff4320b9ac8')
 or to_regprocedure('eps.editorial_deck_counts_1_4(jsonb)')is null or to_regprocedure('eps.editorial13_trim(text)')is null
 or to_regprocedure('eps.review_presentation_1_4(uuid,eps.presentation_series,jsonb)')is null
 then raise exception'M23_EDITORIAL_TARGET_REQUIRED';end if;
 if(select jsonb_object_agg(p.oid::regprocedure::text,encode(sha256(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'UTF8')),'hex'))from pg_proc p
   where p.oid::regprocedure::text=any(array(select jsonb_object_keys('{"eps.review_fit_message(text,boolean)":"54648e7eee82f9bc436e218a24e15f9463d95b65134a0690f5f6d3e1f8e525ed","public.eps_update_settings(jsonb,text)":"759f34e8fcc2dd7a4263924c888531c76ee937379a30f593ccb56660eb4ba261","eps.review_validate_fit(eps.jobs,jsonb)":"39b3373c57661d5066c52c2e7f5d1f167f6176904f634d40588b7e5c1f6158ac","eps.review_snapshot_data(uuid,uuid,text)":"c597c768afefa13b32196e884e12401773e32923e001727bbce3291afb4e5503","eps.export_validate_result(eps.jobs,jsonb)":"5f7998a6eb693a21192edd5cf035680f7f58d8850f2c7d7f7878e7dcfd840f86","public.eps_generate_version(uuid,jsonb,text)":"387cac92111196cf5ef9ddb9aed1d1d3dbab99394ea9777e2c158cad266f27fe","public.eps_get_workspace_review(uuid,uuid,text)":"e4a501549bf7b3a1e30b677415626dde9e51c141711ca01036c37a42cae3a871","eps.presentation_validate_result(eps.jobs,jsonb)":"c06fa1dcb6a4eeee1b268ea3016829132318cf10dd1948918f77ea4ed91d2300","public.eps_request_workspace_review_fit(uuid,uuid,jsonb,text)":"2ea5ea5a3d009a4252f0eec8d0091a72e26f6896fc7635773aa3ca2ceba235e7"}'::jsonb))))
  is distinct from'{"eps.review_fit_message(text,boolean)":"54648e7eee82f9bc436e218a24e15f9463d95b65134a0690f5f6d3e1f8e525ed","public.eps_update_settings(jsonb,text)":"759f34e8fcc2dd7a4263924c888531c76ee937379a30f593ccb56660eb4ba261","eps.review_validate_fit(eps.jobs,jsonb)":"39b3373c57661d5066c52c2e7f5d1f167f6176904f634d40588b7e5c1f6158ac","eps.review_snapshot_data(uuid,uuid,text)":"c597c768afefa13b32196e884e12401773e32923e001727bbce3291afb4e5503","eps.export_validate_result(eps.jobs,jsonb)":"5f7998a6eb693a21192edd5cf035680f7f58d8850f2c7d7f7878e7dcfd840f86","public.eps_generate_version(uuid,jsonb,text)":"387cac92111196cf5ef9ddb9aed1d1d3dbab99394ea9777e2c158cad266f27fe","public.eps_get_workspace_review(uuid,uuid,text)":"e4a501549bf7b3a1e30b677415626dde9e51c141711ca01036c37a42cae3a871","eps.presentation_validate_result(eps.jobs,jsonb)":"c06fa1dcb6a4eeee1b268ea3016829132318cf10dd1948918f77ea4ed91d2300","public.eps_request_workspace_review_fit(uuid,uuid,jsonb,text)":"2ea5ea5a3d009a4252f0eec8d0091a72e26f6896fc7635773aa3ca2ceba235e7"}'::jsonb
 then raise exception'M23_EDITORIAL_PREIMAGE_REQUIRED';end if;
 if(select pg_get_expr(polwithcheck,polrelid)from pg_policy where polrelid='eps.presentation_version_assets'::regclass and polname='presentation_pin_insert')
  not like'%((p.snapshot #>> ''{template,version}''::text[]) = ''1.4.0''::text)%'then raise exception'M23_PIN_POLICY_PREIMAGE_REQUIRED';end if;
end$m23_target$;

-- 1. Registration ------------------------------------------------------------------------------------------
insert into eps.presentation_templates(key,version,content_sha256,font_key,font_hashes,registered)values('everyone-casting','1.4.1',
 'de5ccc3e3ce1ac13b75502e8e9bbdc700251346c81fafae7887e6d3cb7a34c80','everyone-film-fonts-v1',
 '{"apps/web/public/fonts/GeneralSans-Extralight.ttf":"e26c7ded77651217471b2b9d776230092576715990195e4d33a13e51e7f3758e","apps/web/public/fonts/GeneralSans-Light.ttf":"3dafccbe82a8a71b79d78049d65665c3020af89cb960737fabfc0003f87efe1d","apps/web/public/fonts/GeneralSans-Regular.ttf":"2e758fefe5a80a0c910505473de241a74cf6dd914ad6d576d571b610ee8efaf1","apps/web/public/fonts/GeneralSans-Medium.ttf":"21a95d0f3b25dbe4ccbe3d7f45664069249ff1ccd030172878e7f68d85833cea","apps/web/public/fonts/GeneralSans-Semibold.ttf":"48ae5b24f0c1b040cab1e1884ed9a8bca45a4028999bfd2e76184dfe215a0856","apps/web/public/fonts/GeneralSans-Bold.ttf":"fa87dd6422149ef8235b9038db3ee0f0e4addb29971a4d69483211ad7a451ab3","apps/web/public/fonts/IBMPlexSansArabic-Regular.woff2":"74112e1b7bf2e2c547989a4e947a60cba6cd1f9156e0065670134636e717199d","apps/web/public/fonts/IBMPlexSansArabic-Medium.woff2":"c72f6986f50ded745d06e71e508096209c52a55a6b3a81029954e33c52ba1dd2","apps/web/public/fonts/IBMPlexSansArabic-SemiBold.woff2":"869b2acd0a9660607a2025f0fe1c640110bf23d33417509328f07722922b8063"}'::jsonb,true);

-- Generation may pin an archive photo into a 1.4.0 or 1.4.1 version only.
alter policy presentation_pin_insert on eps.presentation_version_assets with check((asset_kind=any(array['client_logo','candidate_frame','candidate_video'])
  or asset_kind='candidate_photo'and exists(select 1 from eps.presentation_versions p where p.id=presentation_version_assets.version_id and p.snapshot#>>'{template,version}'in('1.4.0','1.4.1')))
 and exists(select 1 from eps.presentation_versions v where v.id=presentation_version_assets.version_id and eps.presentation_scope(v.workspace_id,true)and v.status='queued'));

-- 2. Mirror of the 1.4.1 composer (packages/templates/versions/1.4.1/compose-casting.ts) -------------------------
-- A caption value is provided when it is a string that is not blank after JavaScript trim and is not the review's
-- "Not provided" / "Pending" text (providedValue).
create function eps.editorial141_provided(p jsonb)returns boolean language sql immutable security invoker set search_path=''as $$
 select coalesce(jsonb_typeof(p)='string'and eps.editorial13_trim(p#>>'{}')<>''and eps.editorial13_trim(p#>>'{}')!~*'^(not provided|pending)$',false)$$;
-- A height can be identified in free-text measurements (captionHeight is not null): the composer's LABELLED_HEIGHT
-- ("Height: 173; weight: 77") or LEADING_HEIGHT ("180 cm", "5'11"", a bare "180"), case-insensitive. The patterns
-- are the composer's sources verbatim (tests/worker/editorial-1-4-1-sql-mirror.test.ts checks this).
create function eps.editorial141_has_height(p jsonb)returns boolean language sql immutable security invoker set search_path=''as $$
 select eps.editorial141_provided(p)and(eps.editorial13_trim(p#>>'{}')~*$re$(?<![A-Za-z0-9_])height(?![A-Za-z0-9_]) *(?:[-:=]|is(?![A-Za-z0-9_]))? *(?:([0-9] ?(?:'|′|ft|feet|foot) ?[0-9]{1,2}(?: ?(?:"|″|''|inch(?:es)?|in))?)|([0-9]{1,3}(?:[.,][0-9]{1,2})?)(?: ?(centimet(?:er|re)s?|millimet(?:er|re)s?|met(?:er|re)s?|cm|mm|m|feet|foot|ft|inch(?:es)?|in(?! +[A-Za-z])))?)(?![A-Za-z0-9])$re$
  or eps.editorial13_trim(p#>>'{}')~*$re$^(?:[0-9] ?(?:'|′|ft|feet|foot) ?[0-9]{1,2}(?: ?(?:"|″|''|inch(?:es)?|in))?(?![A-Za-z0-9])|[0-9]{1,3}(?:[.,][0-9]{1,2})? ?(?:centimet(?:er|re)s?|millimet(?:er|re)s?|met(?:er|re)s?|cm|mm|m|feet|foot|ft|inch(?:es)?|in(?! +[A-Za-z]))(?![A-Za-z0-9])|[0-9]{1,3}(?:[.,][0-9]{1,2})? *\.? *$)$re$)$$;
-- Caption text regions of one captured slide: the name, then one age | height line (portraitCaption).
create function eps.editorial141_caption_regions(p_slide jsonb)returns integer language sql immutable security invoker set search_path=''as $$
 select case when p_slide->>'kind'='candidate'then
  (case when eps.editorial141_provided(p_slide#>'{fields,name_or_id}')then 1 else 0 end)
  +(case when eps.editorial141_provided(p_slide#>'{fields,age_or_range}')or eps.editorial141_has_height(p_slide#>'{fields,height_measurements}')then 1 else 0 end)
 else 0 end$$;
-- 1.4.1 pages, pictures and silhouettes are exactly 1.4.0's (eps.editorial_deck_counts_1_4); every person is captioned
-- on each page that draws them. A role prints once without scenes or when no scene prints it, else once for its first
-- `auto` occurrence (if any) plus once per `repeat` occurrence; `hidden` never prints.
create function eps.editorial_deck_counts_1_4_1(p_snapshot jsonb)returns jsonb language plpgsql immutable security invoker set search_path=''as $$
declare counts jsonb:=eps.editorial_deck_counts_1_4(p_snapshot);captions integer;scenes jsonb:=coalesce(p_snapshot#>'{presentation,scenes}','[]'::jsonb);
begin
 with occ as(select o->>'role_id'role_id,o->>'deck_placement'placement from jsonb_array_elements(scenes)s,jsonb_array_elements(s->'occurrences')o),
  slides as(select v from jsonb_array_elements(p_snapshot->'slides')v where v->>'kind'<>'cover')
 select coalesce(sum(eps.editorial141_caption_regions(v)*case
   when v->>'role_id'is null or jsonb_array_length(scenes)=0 or not exists(select 1 from occ where occ.role_id=v->>'role_id'and occ.placement<>'hidden')then 1
   else(case when exists(select 1 from occ where occ.role_id=v->>'role_id'and occ.placement='auto')then 1 else 0 end)
    +(select count(*)::integer from occ where occ.role_id=v->>'role_id'and occ.placement='repeat')end),0)
 into captions from slides;
 return counts||jsonb_build_object('text_regions',(counts->>'text_regions')::integer+captions);
end$$;
-- Pure security-invoker helpers: callers get exactly the execute rights held on the 1.4.0 mirror.
do $m23_grants$declare grantee record;fn text;begin
 foreach fn in array array['eps.editorial141_provided(jsonb)','eps.editorial141_has_height(jsonb)','eps.editorial141_caption_regions(jsonb)','eps.editorial_deck_counts_1_4_1(jsonb)']loop
  execute format('revoke all on function %s from public',fn);
  for grantee in select distinct pg_get_userbyid(a.grantee)as name from pg_proc p,aclexplode(p.proacl)a
   where p.oid='eps.editorial_deck_counts_1_4(jsonb)'::regprocedure and a.privilege_type='EXECUTE'and a.grantee<>0 and a.grantee<>'postgres'::regrole loop
   execute format('grant execute on function %s to %I',fn,grantee.name);
  end loop;
 end loop;
end$m23_grants$;

-- 3./4. Gates and fit messages ------------------------------------------------------------------------------
do $m23_forward$
declare item record;source text;definition text;replacement text;
begin
 for item in select * from(values
  ('public.eps_update_settings(jsonb,text)',$n$p_input->>'template_version'not in('1.1.0','1.2.0','1.3.0','1.4.0')$n$,$r$p_input->>'template_version'not in('1.1.0','1.2.0','1.3.0','1.4.0','1.4.1')$r$),
  ('public.eps_get_workspace_review(uuid,uuid,text)',$n$review#>>'{template,version}'not in('1.1.0','1.2.0','1.3.0','1.4.0')then$n$,$r$review#>>'{template,version}'not in('1.1.0','1.2.0','1.3.0','1.4.0','1.4.1')then$r$),
  ('public.eps_request_workspace_review_fit(uuid,uuid,jsonb,text)',$n$template_version in('1.1.0','1.2.0','1.3.0','1.4.0'))then perform eps.fail('TEMPLATE_UPGRADE_REQUIRED'$n$,$r$template_version in('1.1.0','1.2.0','1.3.0','1.4.0','1.4.1'))then perform eps.fail('TEMPLATE_UPGRADE_REQUIRED'$r$),
  ('eps.review_snapshot_data(uuid,uuid,text)',$n$series.template_version in('1.1.0','1.2.0','1.3.0','1.4.0')then$n$,$r$series.template_version in('1.1.0','1.2.0','1.3.0','1.4.0','1.4.1')then$r$),
  -- 1.4.1 captures the same presentation context as 1.4.0 (its picture issues and fingerprint coverage included).
  ('eps.review_snapshot_data(uuid,uuid,text)',$n$ if series.template_version='1.4.0'then$n$,$r$ if series.template_version in('1.4.0','1.4.1')then$r$),
  -- Generation: 1.4.1 admitted; its presentation context and pinned portraits (photos included) are frozen as for 1.4.0.
  ('public.eps_generate_version(uuid,jsonb,text)',$n$series.template_version not in('1.1.0','1.2.0','1.3.0','1.4.0')then perform eps.fail('TEMPLATE_UPGRADE_REQUIRED'$n$,$r$series.template_version not in('1.1.0','1.2.0','1.3.0','1.4.0','1.4.1')then perform eps.fail('TEMPLATE_UPGRADE_REQUIRED'$r$),
  ('public.eps_generate_version(uuid,jsonb,text)',$n$jsonb_array_elements(case when series.template_version='1.4.0'then review#>'{presentation,slides}'else'[]'::jsonb end)p$n$,
   $r$jsonb_array_elements(case when series.template_version in('1.4.0','1.4.1')then review#>'{presentation,slides}'else'[]'::jsonb end)p$r$),
  ('public.eps_generate_version(uuid,jsonb,text)',$n$or series.template_version='1.4.0'and a.purpose='candidate_photo'and a.bucket='eps-candidate-photos')$n$,
   $r$or series.template_version in('1.4.0','1.4.1')and a.purpose='candidate_photo'and a.bucket='eps-candidate-photos')$r$),
  ('public.eps_generate_version(uuid,jsonb,text)',$n$||case when series.template_version='1.4.0'then jsonb_build_object('presentation',review->'presentation')else'{}'::jsonb end;$n$,
   $r$||case when series.template_version in('1.4.0','1.4.1')then jsonb_build_object('presentation',review->'presentation')else'{}'::jsonb end;$r$),
  ('public.eps_generate_version(uuid,jsonb,text)',$n$when series.template_version='1.4.0'then(eps.editorial_deck_counts_1_4(snapshot)->>'pages')::integer else$n$,
   $r$when series.template_version='1.4.0'then(eps.editorial_deck_counts_1_4(snapshot)->>'pages')::integer when series.template_version='1.4.1'then(eps.editorial_deck_counts_1_4_1(snapshot)->>'pages')::integer else$r$),
  -- Render/publish/export proof from the 1.4.1 mirror; 1.4.1 PDFs, like 1.4.0, carry no original-video links.
  ('eps.presentation_validate_result(eps.jobs,jsonb)',$n$when'1.4.0'then eps.editorial_deck_counts_1_4(version.snapshot)end;$n$,$r$when'1.4.0'then eps.editorial_deck_counts_1_4(version.snapshot)when'1.4.1'then eps.editorial_deck_counts_1_4_1(version.snapshot)end;$r$),
  ('eps.presentation_validate_result(eps.jobs,jsonb)',$n$if version.snapshot#>>'{template,version}'='1.4.0'then video_count:=0;link_hash:=$n$,$r$if version.snapshot#>>'{template,version}'in('1.4.0','1.4.1')then video_count:=0;link_hash:=$r$),
  ('eps.export_validate_result(eps.jobs,jsonb)',$n$when'1.4.0'then eps.editorial_deck_counts_1_4(version.snapshot)end;$n$,$r$when'1.4.0'then eps.editorial_deck_counts_1_4(version.snapshot)when'1.4.1'then eps.editorial_deck_counts_1_4_1(version.snapshot)end;$r$),
  ('eps.export_validate_result(eps.jobs,jsonb)',$n$if version.snapshot#>>'{template,version}'='1.4.0'then video_count:=0;end if;$n$,$r$if version.snapshot#>>'{template,version}'in('1.4.0','1.4.1')then video_count:=0;end if;$r$),
  ('eps.review_validate_fit(eps.jobs,jsonb)',$n$(case when p_job.input#>>'{template,version}'in('1.2.0','1.3.0','1.4.0')then 9 else 6 end)$n$,$r$(case when p_job.input#>>'{template,version}'in('1.2.0','1.3.0','1.4.0','1.4.1')then 9 else 6 end)$r$),
  -- Caption overflow names the region; every other field keeps its wording.
  ('eps.review_fit_message(text,boolean)',$n$  else case when p_repair then'Shorten this display field$n$,
   $r$  when'presentation.caption_name'then case when p_repair then'Shorten this person''s name (slide wording) so it fits on two lines under the portrait, then measure again.'else'The name under the portrait does not fit on two lines.'end
  when'presentation.caption_details'then case when p_repair then'Shorten this person''s age or height wording so it fits on one line under the portrait, then measure again.'else'The age and height under the portrait do not fit on one line.'end
  else case when p_repair then'Shorten this display field$r$)
 )v(signature,needle,patch)loop
  select replace(prosrc,E'\r\n',E'\n'),replace(pg_get_functiondef(oid),E'\r\n',E'\n')into source,definition from pg_proc where oid=item.signature::regprocedure;
  if(length(source)-length(replace(source,item.needle,'')))/length(item.needle)<>1 or position(item.patch in source)>0 then raise exception'M23_EDITORIAL_ANCHOR_REQUIRED:%:%',item.signature,left(item.needle,60);end if;
  replacement:=replace(source,item.needle,item.patch);execute replace(definition,source,replacement);
 end loop;
end$m23_forward$;

-- Readback: every body that admits 1.4.0 now admits 1.4.1, six templates are registered with 1.4.0 unchanged, the
-- Settings default is untouched, the pin policy admits 1.4.1 photos and the patched bodies equal the replica post-images.
do $m23_readback$begin
 if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('eps','public')
   and p.prosrc like'%''1.4.0''%'and p.prosrc not like'%''1.4.1''%')
 or(select count(*)from eps.presentation_templates where key='everyone-casting'and registered)<>6
 or not exists(select 1 from eps.presentation_templates where key='everyone-casting'and version='1.4.0'and registered and content_sha256='b4fbd16ff5038c8a97583d1225294fbe0c26b71439f850e7fb888ff4320b9ac8')
 or(select template_version from eps.app_settings where singleton)='1.4.1'
 or(select pg_get_expr(polwithcheck,polrelid)from pg_policy where polrelid='eps.presentation_version_assets'::regclass and polname='presentation_pin_insert')not like'%''1.4.1''%'
 or(select jsonb_object_agg(p.oid::regprocedure::text,encode(sha256(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'UTF8')),'hex'))from pg_proc p
   where p.oid::regprocedure::text=any(array(select jsonb_object_keys('{"eps.export_validate_result(eps.jobs,jsonb)":"e8266aea563dd8b0dad9c132795b4bf5a0cdb6b21e0c71e773f8c6a95acba456","eps.presentation_validate_result(eps.jobs,jsonb)":"48704c4206b7d433ec7d3b1b0449de21d4e5394812f08f377705a8fc85ffbe66","eps.review_fit_message(text,boolean)":"a7a0d6f42d59a56e42e04b859693776535643bdb0097de43d7b6db658a31b535","eps.review_snapshot_data(uuid,uuid,text)":"66fbebdbf8cfd246c064f6678428f5183985ccb27d6db7db4dfd94756306eb5e","eps.review_validate_fit(eps.jobs,jsonb)":"fbc44609d906ab5570e4e3628e88a3017a9234e3c5a7f26e9ed8bd58fb13adb3","public.eps_generate_version(uuid,jsonb,text)":"1713a5572c5d4733cbf856ad76251cfe672b8ed7ddf3f3faf9c2681a9728c06b","public.eps_get_workspace_review(uuid,uuid,text)":"38d49824a653680ec6881f2e24a0a725654fcfe1b0a7d99b5a88db97487a2243","public.eps_request_workspace_review_fit(uuid,uuid,jsonb,text)":"7f17b84fadbc57773f3df7e8d4d2a1df25f184723cf2fc8c6c426476d695fe97","public.eps_update_settings(jsonb,text)":"62c498c01da739ee9cf9ccddf66ee223ed46d56dee77c1b179f037cab9e20009"}'::jsonb))))
  is distinct from'{"eps.export_validate_result(eps.jobs,jsonb)":"e8266aea563dd8b0dad9c132795b4bf5a0cdb6b21e0c71e773f8c6a95acba456","eps.presentation_validate_result(eps.jobs,jsonb)":"48704c4206b7d433ec7d3b1b0449de21d4e5394812f08f377705a8fc85ffbe66","eps.review_fit_message(text,boolean)":"a7a0d6f42d59a56e42e04b859693776535643bdb0097de43d7b6db658a31b535","eps.review_snapshot_data(uuid,uuid,text)":"66fbebdbf8cfd246c064f6678428f5183985ccb27d6db7db4dfd94756306eb5e","eps.review_validate_fit(eps.jobs,jsonb)":"fbc44609d906ab5570e4e3628e88a3017a9234e3c5a7f26e9ed8bd58fb13adb3","public.eps_generate_version(uuid,jsonb,text)":"1713a5572c5d4733cbf856ad76251cfe672b8ed7ddf3f3faf9c2681a9728c06b","public.eps_get_workspace_review(uuid,uuid,text)":"38d49824a653680ec6881f2e24a0a725654fcfe1b0a7d99b5a88db97487a2243","public.eps_request_workspace_review_fit(uuid,uuid,jsonb,text)":"7f17b84fadbc57773f3df7e8d4d2a1df25f184723cf2fc8c6c426476d695fe97","public.eps_update_settings(jsonb,text)":"62c498c01da739ee9cf9ccddf66ee223ed46d56dee77c1b179f037cab9e20009"}'::jsonb
 then raise exception'M23_EDITORIAL_READBACK_FAILED';end if;
end$m23_readback$;
