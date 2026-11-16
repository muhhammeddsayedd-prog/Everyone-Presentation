-- Everyone Film editorial presentation template 1.4.0 (additive, forward-only).
-- Reproduces the supplied Floward cast shortlist: cover (optional note), scene dividers, "Cast Shortlist." /
-- "Cast Selection." pages of portraits (labelled Main | Backup pages, unlabelled option pages of one to three),
-- highlighted notes, THANK YOU!. Facts stay in the app. 1.4.0 supersedes the "all ten fields" slide rule for
-- new series only; 1.0-1.3 series, versions, snapshots, manifests, PDFs and links are never rewritten and
-- keep their validation unchanged.
--
-- 1. Registers the pinned template (content and the nine font hashes).
-- 2. eps.editorial_deck_counts_1_4: independent SQL mirror of packages/templates/versions/1.4.0/compose-casting.ts.
-- 3. Admits 1.4.0 in every gate m13 patched; eps_generate_version captures, for 1.4.0 only, the presentation
--    context (cover note, confirmed scenes/occurrences, role/slot notes, picture state, pinned portrait with
--    crop focus) into the immutable snapshot and its manifest/render context, and admits pinned archive photos
--    (purpose candidate_photo, bucket eps-candidate-photos) into the asset inventory.
-- 4. The review fingerprint of a 1.4.0 series covers that context, so any note/scene/portrait change needs a
--    fresh layout measurement. A person with no picture gets a "No presentation picture" warning; a pinned
--    portrait that is unavailable blocks generation (never a silent placeholder).
-- 5. Fixed-version read paths (in-app, worker job grants, guest links) read pinned 1.4.0 photo portraits.
-- The Settings default is NOT changed here. Requires m15 and m18. Function bodies are patched with exact-once
-- needles against pinned preimages (post-m18 bodies on the cycle-7 replica, hashed after CRLF->LF normalisation);
-- any other body is refused.
set local search_path='';set local lock_timeout='5s';set local statement_timeout='60s';

do $m19_target$begin
 if current_user<>'postgres'
 or exists(select 1 from eps.presentation_templates where key='everyone-casting'and version='1.4.0')
 or not exists(select 1 from eps.presentation_templates where key='everyone-casting'and version='1.3.0'and registered)
 or to_regprocedure('eps.editorial_deck_counts_1_3(jsonb)')is null or to_regprocedure('eps.editorial_deck_counts_1_4(jsonb)')is not null
 or to_regclass('eps.scene_occurrences')is null
 or not exists(select 1 from information_schema.columns where table_schema='eps'and table_name='workspace_candidates'and column_name='media_selection_state')
 or not exists(select 1 from information_schema.columns where table_schema='eps'and table_name='roles'and column_name='presentation_note')
 or not exists(select 1 from information_schema.columns where table_schema='eps'and table_name='presentation_series'and column_name='cover_note')
 or to_regclass('eps.candidate_photos')is null
 then raise exception'M19_EDITORIAL_TARGET_REQUIRED';end if;
 if(select jsonb_object_agg(p.oid::regprocedure::text,encode(sha256(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'UTF8')),'hex'))from pg_proc p
   where p.oid::regprocedure::text=any(array(select jsonb_object_keys('{"eps.presentation_manifest(jsonb)":"07e56f7a1b1ee316d16a95e2d8004626cc7fa7effb1ec0cb132165c0537de867","eps.guest_storage_allowed(text,text)":"5aa9be0223a0b7c0f547e85ea0517826c85ea703dcce05606b4bed3c00ccd743","eps.presentation_render_context(jsonb)":"5dae11646f5c6239f3a9561fd06d390d4b4aa237d10f2bf1d654052f5d79940e","public.eps_update_settings(jsonb,text)":"9b2f5cbdd0bc7c10b7b5550687932224760b215026128bf011079c53b4f9a7d5","eps.review_validate_fit(eps.jobs,jsonb)":"07ab4c560f84d272c707ed73dad0a0b2d8fdfc9eb218231560bf481d3bbb9166","eps.review_snapshot_data(uuid,uuid,text)":"b22566c6985e6e4f97f2e6e9d7dd0e0c4e279223480c66f047d069a060362747","eps.export_validate_result(eps.jobs,jsonb)":"78411ce41e6c08baffffe1c37435255b3f6e06d58961206bc75872535e8c55ff","public.eps_generate_version(uuid,jsonb,text)":"b32644eba8c3fd1a1e5775d9e949adbf87cbfb766021e2da89fe9b1107139e5f","public.eps_get_version_asset(uuid,uuid,text)":"aa8d36adc907e981199033291026c90e049c6e618e155d41051b1c06da31fd3e","public.eps_get_workspace_review(uuid,uuid,text)":"e0bf0ddb15246d2f9856b61ca60abfd8a845198babe5ec79d48d1f9e948d9c5c","eps.presentation_storage_read_allowed(text,text)":"ccdff4ee7532af78a9b9474af8be007e445a35ad48f0101762fd9b607444e9fc","eps.presentation_validate_result(eps.jobs,jsonb)":"11d73772ec83e9f780b1bc15a2f20cd2cd61c9351ffeee31554d72318d22d5b2","eps.presentation_capability_allowed(text,text,text)":"a6e3ce146572f3cc05f2f1c8872b561d5e07d8516e92c0470bc709dc50ab866f","eps.guest_asset_issue(uuid,text,uuid,uuid,text,uuid)":"09c79db6af4131a04ed3228a7cd847e4dde55e560ac77b48080dcffddb9f64ed","eps.export_asset_member(eps.jobs,eps.media_assets,text)":"53563762857291d79f1e966a1fe72d993a4913b4c0553767fbabd65d155d19bf","eps.presentation_asset_member(eps.jobs,eps.media_assets,text)":"8d1acfca9201e5ca39452379746bb0f26e4d4f4f9a08d80958c290dd8210287d","public.eps_request_workspace_review_fit(uuid,uuid,jsonb,text)":"8fd926228a600b70f5994bdf26164befe694f0f0243d68a09cb2da572e99b76c","eps.guest_version_dto(eps.presentation_versions,eps.review_links)":"3f58c4952eb1a278c281416ad434132e51dc0a931398018b33b0883deeb09530"}'::jsonb))))
  is distinct from'{"eps.presentation_manifest(jsonb)":"07e56f7a1b1ee316d16a95e2d8004626cc7fa7effb1ec0cb132165c0537de867","eps.guest_storage_allowed(text,text)":"5aa9be0223a0b7c0f547e85ea0517826c85ea703dcce05606b4bed3c00ccd743","eps.presentation_render_context(jsonb)":"5dae11646f5c6239f3a9561fd06d390d4b4aa237d10f2bf1d654052f5d79940e","public.eps_update_settings(jsonb,text)":"9b2f5cbdd0bc7c10b7b5550687932224760b215026128bf011079c53b4f9a7d5","eps.review_validate_fit(eps.jobs,jsonb)":"07ab4c560f84d272c707ed73dad0a0b2d8fdfc9eb218231560bf481d3bbb9166","eps.review_snapshot_data(uuid,uuid,text)":"b22566c6985e6e4f97f2e6e9d7dd0e0c4e279223480c66f047d069a060362747","eps.export_validate_result(eps.jobs,jsonb)":"78411ce41e6c08baffffe1c37435255b3f6e06d58961206bc75872535e8c55ff","public.eps_generate_version(uuid,jsonb,text)":"b32644eba8c3fd1a1e5775d9e949adbf87cbfb766021e2da89fe9b1107139e5f","public.eps_get_version_asset(uuid,uuid,text)":"aa8d36adc907e981199033291026c90e049c6e618e155d41051b1c06da31fd3e","public.eps_get_workspace_review(uuid,uuid,text)":"e0bf0ddb15246d2f9856b61ca60abfd8a845198babe5ec79d48d1f9e948d9c5c","eps.presentation_storage_read_allowed(text,text)":"ccdff4ee7532af78a9b9474af8be007e445a35ad48f0101762fd9b607444e9fc","eps.presentation_validate_result(eps.jobs,jsonb)":"11d73772ec83e9f780b1bc15a2f20cd2cd61c9351ffeee31554d72318d22d5b2","eps.presentation_capability_allowed(text,text,text)":"a6e3ce146572f3cc05f2f1c8872b561d5e07d8516e92c0470bc709dc50ab866f","eps.guest_asset_issue(uuid,text,uuid,uuid,text,uuid)":"09c79db6af4131a04ed3228a7cd847e4dde55e560ac77b48080dcffddb9f64ed","eps.export_asset_member(eps.jobs,eps.media_assets,text)":"53563762857291d79f1e966a1fe72d993a4913b4c0553767fbabd65d155d19bf","eps.presentation_asset_member(eps.jobs,eps.media_assets,text)":"8d1acfca9201e5ca39452379746bb0f26e4d4f4f9a08d80958c290dd8210287d","public.eps_request_workspace_review_fit(uuid,uuid,jsonb,text)":"8fd926228a600b70f5994bdf26164befe694f0f0243d68a09cb2da572e99b76c","eps.guest_version_dto(eps.presentation_versions,eps.review_links)":"3f58c4952eb1a278c281416ad434132e51dc0a931398018b33b0883deeb09530"}'::jsonb
 then raise exception'M19_EDITORIAL_PREIMAGE_REQUIRED';end if;
end$m19_target$;

-- 1. Registration ------------------------------------------------------------------------------------------
insert into eps.presentation_templates(key,version,content_sha256,font_key,font_hashes)values('everyone-casting','1.4.0',
 'b4fbd16ff5038c8a97583d1225294fbe0c26b71439f850e7fb888ff4320b9ac8','everyone-film-fonts-v1',
 '{"apps/web/public/fonts/GeneralSans-Extralight.ttf":"e26c7ded77651217471b2b9d776230092576715990195e4d33a13e51e7f3758e","apps/web/public/fonts/GeneralSans-Light.ttf":"3dafccbe82a8a71b79d78049d65665c3020af89cb960737fabfc0003f87efe1d","apps/web/public/fonts/GeneralSans-Regular.ttf":"2e758fefe5a80a0c910505473de241a74cf6dd914ad6d576d571b610ee8efaf1","apps/web/public/fonts/GeneralSans-Medium.ttf":"21a95d0f3b25dbe4ccbe3d7f45664069249ff1ccd030172878e7f68d85833cea","apps/web/public/fonts/GeneralSans-Semibold.ttf":"48ae5b24f0c1b040cab1e1884ed9a8bca45a4028999bfd2e76184dfe215a0856","apps/web/public/fonts/GeneralSans-Bold.ttf":"fa87dd6422149ef8235b9038db3ee0f0e4addb29971a4d69483211ad7a451ab3","apps/web/public/fonts/IBMPlexSansArabic-Regular.woff2":"74112e1b7bf2e2c547989a4e947a60cba6cd1f9156e0065670134636e717199d","apps/web/public/fonts/IBMPlexSansArabic-Medium.woff2":"c72f6986f50ded745d06e71e508096209c52a55a6b3a81029954e33c52ba1dd2","apps/web/public/fonts/IBMPlexSansArabic-SemiBold.woff2":"869b2acd0a9660607a2025f0fe1c640110bf23d33417509328f07722922b8063"}'::jsonb);

-- Fixed-version asset pins may now be archive photos (1.4.0 portraits only; eps_generate_version enforces the template).
alter table eps.presentation_version_assets drop constraint presentation_version_assets_asset_kind_check,
 add constraint presentation_version_assets_asset_kind_check check(asset_kind=any(array['client_logo','candidate_frame','candidate_video','candidate_photo','presentation_manifest','presentation_pdf']));

-- Generation may pin an archive photo only into a 1.4.0 version.
do $m19_pin$begin
 if(select pg_get_expr(polwithcheck,polrelid)from pg_policy where polrelid='eps.presentation_version_assets'::regclass and polname='presentation_pin_insert')
  not like'%(asset_kind = ANY (ARRAY[''client_logo''::text, ''candidate_frame''::text, ''candidate_video''::text]))%'then raise exception'M19_PIN_POLICY_PREIMAGE_REQUIRED';end if;
end$m19_pin$;
alter policy presentation_pin_insert on eps.presentation_version_assets with check((asset_kind=any(array['client_logo','candidate_frame','candidate_video'])
  or asset_kind='candidate_photo'and exists(select 1 from eps.presentation_versions p where p.id=presentation_version_assets.version_id and p.snapshot#>>'{template,version}'='1.4.0'))
 and exists(select 1 from eps.presentation_versions v where v.id=presentation_version_assets.version_id and eps.presentation_scope(v.workspace_id,true)and v.status='queued'));

-- 2. Independent mirror of packages/templates/versions/1.4.0/compose-casting.ts (composeCastingDeck + deckCounts) --
-- A note/subtitle value counts when it is a string that is not blank after JavaScript trim.
create function eps.editorial14_has(p jsonb)returns boolean language sql immutable security invoker set search_path=''as $$
 select coalesce(jsonb_typeof(p)='string'and eps.editorial13_trim(p#>>'{}')<>'',false)$$;
-- Option page sizes: threes, ending with a pair or a three; 4 -> 2+2; never a lone leftover unless only one.
create function eps.editorial14_chunks(p_count integer)returns integer[] language plpgsql immutable security invoker set search_path=''as $$
declare sizes integer[]:='{}';left_count integer:=p_count;begin
 while left_count>0 loop
  if left_count=4 then sizes:=sizes||array[2,2];exit;end if;
  if left_count<=3 then sizes:=sizes||left_count;exit;end if;
  sizes:=sizes||3;left_count:=left_count-3;
 end loop;return sizes;end$$;
-- Pages of one role: [pages, frame draws, placeholder draws, text regions]. p_role = {slots:[{note,people:[{pos,draw}]}]}.
create function eps.editorial14_role(p_role jsonb,p_note boolean)returns integer[] language plpgsql immutable security invoker set search_path=''as $$
declare slot jsonb;person jsonb;pool jsonb:='[]';bodies jsonb:='[]';main_draw text;backups jsonb;others jsonb;pairs integer;k integer;n2 integer;
 frames integer:=0;placeholders integer:=0;regions integer:=0;sizes integer[];start integer;size integer;item jsonb;chunk_note boolean;slot_index integer:=0;last_body jsonb;
begin
 for slot in select v from jsonb_array_elements(p_role->'slots')v loop
  main_draw:=(select v->>'draw'from jsonb_array_elements(slot->'people')with ordinality x(v,o)where v->>'pos'='main'order by o limit 1);
  backups:=coalesce((select jsonb_agg(v order by o)from jsonb_array_elements(slot->'people')with ordinality x(v,o)where v->>'pos'='backup'),'[]');
  -- Everyone but the first Main and the Backups (Options, any further Main) is shown unlabelled.
  others:=coalesce((select jsonb_agg(v order by o)from jsonb_array_elements(slot->'people')with ordinality x(v,o)
   where v->>'pos'<>'backup'and not(v->>'pos'='main'and o=(select min(o2)from jsonb_array_elements(slot->'people')with ordinality y(v2,o2)where v2->>'pos'='main'))),'[]');
  if main_draw is not null or jsonb_array_length(backups)>0 then
   -- flush the pool before a labelled slot
   if jsonb_array_length(pool)>0 then bodies:=bodies||eps.editorial14_flush(pool);pool:='[]';end if;
   -- Main | first Backup (silhouettes where missing), then labelled Backup pages of two; nobody is drawn twice.
   if coalesce(main_draw,'p')='f'then frames:=frames+1;else placeholders:=placeholders+1;end if;
   if coalesce(backups->0->>'draw','p')='f'then frames:=frames+1;else placeholders:=placeholders+1;end if;
   bodies:=bodies||jsonb_build_array(jsonb_build_object('labels',2,'note',jsonb_array_length(others)=0 and jsonb_array_length(backups)<=1 and(slot->>'note')::boolean));
   k:=1;
   while k<jsonb_array_length(backups)loop
    pairs:=least(2,jsonb_array_length(backups)-k);
    for n2 in k..k+pairs-1 loop if backups->n2->>'draw'='f'then frames:=frames+1;else placeholders:=placeholders+1;end if;end loop;
    bodies:=bodies||jsonb_build_array(jsonb_build_object('labels',pairs,'note',jsonb_array_length(others)=0 and k+pairs>=jsonb_array_length(backups)and(slot->>'note')::boolean));
    k:=k+pairs;
   end loop;
  end if;
  for person in select v from jsonb_array_elements(others)v loop pool:=pool||jsonb_build_array(jsonb_build_object('draw',person->>'draw','slot',slot_index,'note',(slot->>'note')::boolean));end loop;
  slot_index:=slot_index+1;
 end loop;
 if jsonb_array_length(pool)>0 then bodies:=bodies||eps.editorial14_flush(pool);end if;
 if jsonb_array_length(bodies)=0 then
  -- Nobody cast: one silhouette page, which always carries a note (slot, role/scene, or "Pending.").
  bodies:=jsonb_build_array(jsonb_build_object('labels',0,'note',true));placeholders:=placeholders+1;
 else
  last_body:=bodies->(jsonb_array_length(bodies)-1);
  bodies:=jsonb_set(bodies,array[(jsonb_array_length(bodies)-1)::text,'note'],to_jsonb((last_body->>'note')::boolean or p_note));
 end if;
 for item in select v from jsonb_array_elements(bodies)v loop
  regions:=regions+3+(item->>'labels')::integer+case when(item->>'note')::boolean then 1 else 0 end;
  frames:=frames+coalesce((item->>'frames')::integer,0);placeholders:=placeholders+coalesce((item->>'placeholders')::integer,0);
 end loop;
 return array[jsonb_array_length(bodies),frames,placeholders,regions];
end$$;
-- Option pages of a pool [{draw,slot,note}]: a slot note goes on the page with that slot's last pooled person.
create function eps.editorial14_flush(p_pool jsonb)returns jsonb language plpgsql immutable security invoker set search_path=''as $$
declare sizes integer[];start integer:=0;size integer;result jsonb:='[]';chunk jsonb;frames integer;placeholders integer;note boolean;
begin
 sizes:=eps.editorial14_chunks(jsonb_array_length(p_pool));
 foreach size in array sizes loop
  select jsonb_agg(v order by o)into chunk from jsonb_array_elements(p_pool)with ordinality x(v,o)where o>start and o<=start+size;
  select count(*)filter(where v->>'draw'='f'),count(*)filter(where v->>'draw'<>'f')into frames,placeholders from jsonb_array_elements(chunk)v;
  note:=exists(select 1 from jsonb_array_elements(chunk)with ordinality c(v,o)where(v->>'note')::boolean
   and start+o=(select max(o2)from jsonb_array_elements(p_pool)with ordinality p(v2,o2)where v2->>'slot'=v->>'slot'));
  result:=result||jsonb_build_array(jsonb_build_object('labels',0,'note',note,'frames',frames,'placeholders',placeholders));
  start:=start+size;
 end loop;return result;
end$$;

create function eps.editorial_deck_counts_1_4(p_snapshot jsonb)returns jsonb language plpgsql immutable security invoker set search_path=''as $$
declare slides jsonb;s jsonb;c jsonb;total integer;n integer;roles jsonb:='[]';role_index jsonb:='{}';role_key text;ri integer;si integer;r jsonb;draw text;
 scenes jsonb;scene jsonb;occurrence jsonb;scened jsonb:='{}';printed jsonb:='{}';group_sequence text;previous_sequence text;group_items integer:=0;first_group boolean:=true;counts integer[];
 pages integer:=2;frames integer:=0;placeholders integer:=0;regions integer:=0;cover_regions integer:=2;logo_draws integer:=0;
begin
 select coalesce(jsonb_agg(v order by o),'[]'::jsonb)into slides from jsonb_array_elements(p_snapshot->'slides')with ordinality a(v,o)where v->>'kind'<>'cover';
 total:=jsonb_array_length(slides);
 -- Roles in captured order, slots in captured order, people with their drawn picture (f = portrait, p = silhouette).
 for n in 0..total-1 loop
  s:=slides->n;c:=p_snapshot->'presentation'->'slides'->n;role_key:=coalesce(s->>'role_id','workspace:'||n);
  if not role_index?role_key then
   role_index:=role_index||jsonb_build_object(role_key,jsonb_array_length(roles));
   roles:=roles||jsonb_build_array(jsonb_build_object('id',s->'role_id','note',eps.editorial14_has(c->'role_note'),'slots','[]'::jsonb));
  end if;
  ri:=(role_index->>role_key)::integer;r:=roles->ri;si:=null;
  if s->>'slot_id'is not null then select(o-1)::integer into si from jsonb_array_elements(r->'slots')with ordinality x(v,o)where v->>'id'=s->>'slot_id'order by o limit 1;end if;
  if si is null then r:=jsonb_set(r,'{slots}',(r->'slots')||jsonb_build_array(jsonb_build_object('id',s->'slot_id','note',eps.editorial14_has(c->'slot_note'),'people','[]'::jsonb)));si:=jsonb_array_length(r->'slots')-1;end if;
  if s->>'kind'='candidate'then
   draw:=case when c->>'picture_state'='intentionally_empty'then'p'when jsonb_typeof(c->'portrait')='object'or jsonb_array_length(s->'frames')>0 then'f'else'p'end;
   r:=jsonb_set(r,array['slots',si::text,'people'],(r#>array['slots',si::text,'people'])||jsonb_build_array(jsonb_build_object('pos',s->>'position','draw',draw)));
  end if;
  roles:=jsonb_set(roles,array[ri::text],r);
 end loop;
 scenes:=coalesce(p_snapshot->'presentation'->'scenes','[]'::jsonb);
 if jsonb_array_length(scenes)=0 then
  for r in select v from jsonb_array_elements(roles)v loop
   counts:=eps.editorial14_role(r,(r->>'note')::boolean);pages:=pages+counts[1];frames:=frames+counts[2];placeholders:=placeholders+counts[3];regions:=regions+counts[4];
  end loop;
 else
  -- Roles some scene prints (any occurrence that is not hidden).
  for scene in select v from jsonb_array_elements(scenes)v loop for occurrence in select v from jsonb_array_elements(scene->'occurrences')v loop
   if occurrence->>'deck_placement'<>'hidden'and role_index?(occurrence->>'role_id')then scened:=scened||jsonb_build_object(occurrence->>'role_id',true);end if;
  end loop;end loop;
  -- Roles no scene prints come first, without a divider.
  for r in select v from jsonb_array_elements(roles)v loop
   if r->>'id'is null or not scened?(r->>'id')then counts:=eps.editorial14_role(r,(r->>'note')::boolean);pages:=pages+counts[1];frames:=frames+counts[2];placeholders:=placeholders+counts[3];regions:=regions+counts[4];end if;
  end loop;
  -- Divider groups: consecutive scenes with one non-blank sequence label share one divider.
  for scene in select v from jsonb_array_elements(scenes)v loop
   group_sequence:=nullif(eps.editorial13_trim(scene->>'sequence_label'),'');
   if first_group or group_sequence is null or group_sequence is distinct from previous_sequence then
    if group_items>0 then pages:=pages+1;regions:=regions+2;end if;group_items:=0;
   end if;
   first_group:=false;previous_sequence:=group_sequence;
   for occurrence in select v from jsonb_array_elements(scene->'occurrences')v loop
    if not role_index?(occurrence->>'role_id')or occurrence->>'deck_placement'='hidden'then continue;end if;
    if occurrence->>'deck_placement'='auto'then
     if printed?(occurrence->>'role_id')then continue;end if;printed:=printed||jsonb_build_object(occurrence->>'role_id',true);
    end if;
    r:=roles->((role_index->>(occurrence->>'role_id'))::integer);
    counts:=eps.editorial14_role(r,eps.editorial14_has(occurrence->'presentation_note')or(r->>'note')::boolean);
    pages:=pages+counts[1];frames:=frames+counts[2];placeholders:=placeholders+counts[3];regions:=regions+counts[4];group_items:=group_items+1;
   end loop;
  end loop;
  if group_items>0 then pages:=pages+1;regions:=regions+2;end if;
 end if;
 if eps.editorial14_has(p_snapshot#>'{presentation,cover_note}')then cover_regions:=cover_regions+1;end if;
 if p_snapshot#>>'{cover,logo_asset_id}'is not null then logo_draws:=1;
 elsif coalesce(p_snapshot#>>'{cover,client_name}','')<>''then cover_regions:=cover_regions+1;end if;
 return jsonb_build_object('pages',pages,'width_css_px',1920,'height_css_px',1080,'width_points',1440,'height_points',810,
  'candidate_fields',0,'frame_draws',frames,'logo_draws',logo_draws,'placeholder_draws',placeholders,'video_links',0,
  'text_regions',cover_regions+regions+1);
end$$;
-- Pure security-invoker helpers: callers get exactly the execute rights held on the 1.3.0 mirror.
do $m19_grants$declare grantee record;fn text;begin
 foreach fn in array array['eps.editorial14_has(jsonb)','eps.editorial14_chunks(integer)','eps.editorial14_flush(jsonb)','eps.editorial14_role(jsonb,boolean)','eps.editorial_deck_counts_1_4(jsonb)']loop
  execute format('revoke all on function %s from public',fn);
  for grantee in select distinct pg_get_userbyid(a.grantee)as name from pg_proc p,aclexplode(p.proacl)a
   where p.oid='eps.editorial_deck_counts_1_3(jsonb)'::regprocedure and a.privilege_type='EXECUTE'and a.grantee<>0 and a.grantee<>'postgres'::regrole loop
   execute format('grant execute on function %s to %I',fn,grantee.name);
  end loop;
 end loop;
end$m19_grants$;

-- 3. Presentation context of a 1.4.0 review (cover note, scenes, notes, pictures) ----------------------------
-- Pinned archive photos are read by the review owner exactly like video frames: cast.read, ready, of this person.
-- The worker's review-fit stage rebuilds the same snapshot as the stage owner (eps.review_stage_source_matches,
-- eps.get_review_stage_input, eps.review_validate_fit), so that owner reads them too, like its other review_stage_read
-- tables (media_assets is already readable to it).
grant select on eps.candidate_photos to eps_review_owner,eps_review_stage_owner;
create policy m19_review_photos_read on eps.candidate_photos for select to eps_review_owner using(eps.has_capability('cast.read'));
create policy m19_review_stage_photos_read on eps.candidate_photos for select to eps_review_stage_owner using(true);
create policy m19_review_photo_assets_read on eps.media_assets for select to eps_review_owner using(purpose='candidate_photo'and eps.has_capability('cast.read')
 and exists(select 1 from eps.candidate_photos ph where ph.asset_id=media_assets.id));

-- Returns {cover_note, scenes, slides, issues}; slides[n] belongs to p_slides[n]. Runs as the review owner inside
-- eps.review_snapshot_data (security invoker, the caller's RLS).
create function eps.review_presentation_1_4(p_workspace uuid,p_series eps.presentation_series,p_slides jsonb)returns jsonb language plpgsql stable security invoker set search_path=''as $$
declare slide jsonb;pool eps.workspace_candidates;asset eps.media_assets;role_note text;slot_note text;portrait jsonb;contexts jsonb:='[]';issues jsonb:='[]';scenes jsonb;
 focal_x integer;focal_y integer;state text;
begin
 select coalesce(jsonb_agg(jsonb_build_object('scene_id',s.id,'scene_number',s.scene_number,'title',s.title,'sequence_label',s.sequence_label,'setting',s.setting,
   'occurrences',coalesce((select jsonb_agg(jsonb_build_object('occurrence_id',o.id,'role_id',o.role_id,'display_title',o.display_title,'setting_override',o.setting_override,'presentation_note',o.presentation_note,'deck_placement',o.deck_placement)order by o.sort_order,o.id)
     from eps.scene_occurrences o join eps.roles r on r.id=o.role_id and r.workspace_id=p_workspace and r.archived_at is null
     where o.scene_id=s.id and o.workspace_id=p_workspace and o.archived_at is null and o.status='confirmed'),'[]'::jsonb))order by s.sort_order,s.id),'[]'::jsonb)
 into scenes from eps.scenes s where s.workspace_id=p_workspace and s.archived_at is null and s.status='confirmed';
 for slide in select v from jsonb_array_elements(p_slides)v loop
  select r.presentation_note into role_note from eps.roles r where r.id=(slide->>'role_id')::uuid and r.workspace_id=p_workspace;
  select s.presentation_note into slot_note from eps.slots s where s.id=(slide->>'slot_id')::uuid and s.workspace_id=p_workspace;
  portrait:=null;state:=null;
  if slide->>'kind'='candidate'then
   select * into pool from eps.workspace_candidates where id=(slide->>'workspace_candidate_id')::uuid and workspace_id=p_workspace;
   state:=pool.media_selection_state;
   if pool.portrait_asset_id is not null and state<>'intentionally_empty'then
    -- Read the pinned asset of this person whatever its state, so processing and unavailable stay distinct.
    if pool.portrait_source='photo'then
     select a.* into asset from eps.media_assets a join eps.candidate_photos ph on ph.asset_id=a.id and ph.candidate_id=(slide->>'candidate_id')::uuid
      where a.id=pool.portrait_asset_id and a.purpose='candidate_photo'and a.bucket='eps-candidate-photos';
    else
     select a.* into asset from eps.media_assets a where a.id=pool.portrait_asset_id and a.purpose='candidate_frame'
      and exists(select 1 from eps.candidate_media_frames link join eps.candidate_media m on m.id=link.candidate_media_id where link.asset_id=a.id and m.candidate_id=(slide->>'candidate_id')::uuid);
    end if;
    if found and asset.status not in('ready','failed','archived')then
     issues:=issues||jsonb_build_array(eps.review_issue('PORTRAIT_PROCESSING','blocking',(slide->>'assignment_id')::uuid,null,'The pinned presentation picture is still processing.','Wait for processing to finish, then refresh the review.'));
    elsif not found or asset.status<>'ready'or asset.sha256 is null or coalesce(asset.width,0)<1 or coalesce(asset.height,0)<1 then
     issues:=issues||jsonb_build_array(eps.review_issue('PORTRAIT_UNAVAILABLE','blocking',(slide->>'assignment_id')::uuid,null,'The pinned presentation picture is unavailable.','Pin another picture, or mark the picture as intentionally empty.'));
    else
     -- Crop focus in thousandths (integers keep canonical hashing exact); default 0.5 / 0.4.
     focal_x:=500;focal_y:=400;
     if jsonb_typeof(pool.portrait_crop->'focal_x')='number'then focal_x:=greatest(0,least(1000,round((pool.portrait_crop->>'focal_x')::numeric*1000)::integer));end if;
     if jsonb_typeof(pool.portrait_crop->'focal_y')='number'then focal_y:=greatest(0,least(1000,round((pool.portrait_crop->>'focal_y')::numeric*1000)::integer));end if;
     portrait:=jsonb_build_object('asset_id',asset.id,'source',pool.portrait_source,'width',asset.width,'height',asset.height,'sha256',asset.sha256,'focal',jsonb_build_array(focal_x,focal_y));
    end if;
   end if;
   -- Nobody pinned and no frame: a gentle warning (a pinned but unusable picture already has its own blocking issue).
   if portrait is null and pool.portrait_asset_id is null and state<>'intentionally_empty'and jsonb_array_length(slide->'frames')=0 then
    issues:=issues||jsonb_build_array(eps.review_issue('NO_PRESENTATION_PICTURE','warning',(slide->>'assignment_id')::uuid,null,'No presentation picture.','Pin a picture, or mark the picture as intentionally empty.'));
   end if;
  end if;
  contexts:=contexts||jsonb_build_array(jsonb_build_object('role_note',role_note,'slot_note',slot_note,'picture_state',state,
   'portrait',case when portrait is null then'null'::jsonb else portrait end)||case when state='pinned'or state is null or portrait is null then'{}'::jsonb else jsonb_build_object('picture_state','pinned')end);
 end loop;
 return jsonb_build_object('cover_note',p_series.cover_note,'scenes',scenes,'slides',contexts,'issues',issues);
end$$;
revoke all on function eps.review_presentation_1_4(uuid,eps.presentation_series,jsonb)from public;
grant execute on function eps.review_presentation_1_4(uuid,eps.presentation_series,jsonb)to eps_review_owner,eps_review_stage_owner;

-- Series made with 1.3.0 or earlier cannot draw an archive photo. A person whose pinned picture is a photo gets an
-- explanation instead of a silent generation without it: blocking when that person has no video frame to show,
-- otherwise a warning that the frame is shown instead. A person marked "no picture" (intentionally_empty) whose
-- selected video frame these templates would still print gets a warning too. Frame-based series are otherwise unaffected.
create function eps.review_legacy_portrait_issues(p_workspace uuid,p_slides jsonb)returns jsonb language sql stable security invoker set search_path=''as $$
 select coalesce(jsonb_agg(case when w.media_selection_state='intentionally_empty'
   then eps.review_issue('TEMPLATE_PORTRAIT_EMPTY_IGNORED','warning',(v->>'assignment_id')::uuid,null,'This person is marked as having no presentation picture, but this series'' template still shows the selected video frame.','Create a series with Everyone Film Editorial 1.4.0 to leave the picture empty, or remove the selected frames.')
   when jsonb_array_length(v->'frames')=0
   then eps.review_issue('TEMPLATE_PORTRAIT_UNSUPPORTED','blocking',(v->>'assignment_id')::uuid,null,'This person''s presentation picture is an archive photo, which this series'' template cannot show.','Create a series with Everyone Film Editorial 1.4.0 in Presentations, or pin a video frame.')
   else eps.review_issue('TEMPLATE_PORTRAIT_SUBSTITUTED','warning',(v->>'assignment_id')::uuid,null,'This series'' template shows the selected video frame, not the pinned archive photo.','Create a series with Everyone Film Editorial 1.4.0 to show the photo.')end order by o),'[]'::jsonb)
 from jsonb_array_elements(p_slides)with ordinality x(v,o)join eps.workspace_candidates w on w.id=(v->>'workspace_candidate_id')::uuid and w.workspace_id=p_workspace
 where v->>'kind'='candidate'and(w.portrait_source='photo'and w.media_selection_state='pinned'
  or w.media_selection_state='intentionally_empty'and jsonb_array_length(v->'frames')>0)$$;
revoke all on function eps.review_legacy_portrait_issues(uuid,jsonb)from public;
grant execute on function eps.review_legacy_portrait_issues(uuid,jsonb)to eps_review_owner,eps_review_stage_owner;

-- Guests see a 1.4.0 version's presentation context without internal role/scene identities: roles become stable
-- per-version keys ('r' + first slide order) given for every slide in presentation_role_keys.
-- Guests receive only scene data the deck prints, yet compose exactly the same pages as the PDF:
--  * hidden links and links of roles that are not in this version never print and are never sent;
--  * a scene left without links is sent only when the divider grouping needs it: inside a printing sequence it
--    keeps its place as a stub (title = sequence label, no number/setting: neither is printed there); a group that
--    prints nothing is dropped, except that one neutral stub separates two printing groups of the same sequence
--    that would otherwise merge. Scene and link identities are renumbered per version.
create function eps.guest_presentation_1_4(p_snapshot jsonb)returns jsonb language sql immutable security invoker set search_path=''as $$
 with s as(select v,o from jsonb_array_elements(p_snapshot->'slides')with ordinality x(v,o)where v->>'kind'<>'cover'),
 keys as(select v->>'role_id'as role_id,'r'||min(o-1)as k from s where v->>'role_id'is not null group by 1),
 scene as(select z.sc,z.so,nullif(eps.editorial13_trim(z.sc->>'sequence_label'),'')seq,
   coalesce((select jsonb_agg(jsonb_build_object('role_id',keys.k,'display_title',oc->'display_title','setting_override',oc->'setting_override',
     'presentation_note',oc->'presentation_note','deck_placement',oc->'deck_placement')order by oo)
    from jsonb_array_elements(z.sc->'occurrences')with ordinality y(oc,oo)join keys on keys.role_id=oc->>'role_id'where oc->>'deck_placement'<>'hidden'),'[]'::jsonb)occ
  from jsonb_array_elements(coalesce(p_snapshot#>'{presentation,scenes}','[]'::jsonb))with ordinality z(sc,so)),
 breaks as(select scene.*,(seq is null or seq is distinct from lag(seq)over(order by so))starts from scene),
 grouped as(select breaks.*,sum(case when starts then 1 else 0 end)over(order by so)g from breaks),
 printing as(select grouped.*,bool_or(jsonb_array_length(occ)>0)over(partition by g)gp from grouped),
 kept as(select printing.*,lag(g)over(order by so)pg,lag(seq)over(order by so)ps from printing where gp),
 sent as(
  select so,1 part,case when jsonb_array_length(occ)>0 then jsonb_build_object('scene_number',sc->'scene_number','title',sc->'title','sequence_label',sc->'sequence_label','setting',sc->'setting')
    else jsonb_build_object('scene_number',null,'title',seq,'sequence_label',sc->'sequence_label','setting',null)end body,occ from kept
  union all
  select so,0,jsonb_build_object('scene_number',null,'title','Scene','sequence_label',null,'setting',null),'[]'::jsonb from kept where pg<>g and seq is not null and ps=seq),
 numbered as(select body,occ,row_number()over(order by so,part)n from sent)
 select jsonb_build_object('presentation',jsonb_build_object('cover_note',p_snapshot#>'{presentation,cover_note}','slides',p_snapshot#>'{presentation,slides}',
   'scenes',coalesce((select jsonb_agg(body||jsonb_build_object('scene_id','s'||n,'occurrences',coalesce((select jsonb_agg(oc||jsonb_build_object('occurrence_id','o'||n||'-'||oo)order by oo)
     from jsonb_array_elements(occ)with ordinality y(oc,oo)),'[]'::jsonb))order by n)from numbered),'[]'::jsonb)),
  'presentation_role_keys',coalesce((select jsonb_agg(coalesce((select k from keys where keys.role_id=s.v->>'role_id'),'w'||(s.o-1))order by s.o)from s),'[]'::jsonb))$$;
revoke all on function eps.guest_presentation_1_4(jsonb)from public;
grant execute on function eps.guest_presentation_1_4(jsonb)to eps_guest_owner;

-- Field-specific fit messages; other fields keep the original wording (earlier templates unchanged).
create function eps.review_fit_message(p_field text,p_repair boolean)returns text language sql immutable security invoker set search_path=''as $$
 select case p_field
  when'presentation.subtitle'then case when p_repair then'Shorten the scene, setting or role display title so the page subtitle fits on one line, then measure again.'else'The page subtitle (scene | setting | role) does not fit on one line.'end
  when'presentation.note'then case when p_repair then'Shorten the slot, role or scene presentation note so it fits on one line, then measure again.'else'The highlighted note does not fit on one line.'end
  when'cover_note'then case when p_repair then'Shorten the cover note, then measure again.'else'The cover note does not fit on one line.'end
  when'scene_title'then case when p_repair then'Shorten the scene title, sequence or setting, then measure again.'else'The scene divider does not fit on one line.'end
  else case when p_repair then'Shorten this display field or correct its supplied content, then measure again.'else'Text exceeds the selected slide layout.'end end$$;
revoke all on function eps.review_fit_message(text,boolean)from public;
grant execute on function eps.review_fit_message(text,boolean)to eps_review_owner;

-- 4. Gates ------------------------------------------------------------------------------------------------
do $m19_forward$
declare item record;source text;definition text;replacement text;
begin
 for item in select * from(values
  ('public.eps_update_settings(jsonb,text)',$n$p_input->>'template_version'not in('1.1.0','1.2.0','1.3.0')$n$,$r$p_input->>'template_version'not in('1.1.0','1.2.0','1.3.0','1.4.0')$r$),
  ('public.eps_get_workspace_review(uuid,uuid,text)',$n$review#>>'{template,version}'not in('1.1.0','1.2.0','1.3.0')then$n$,$r$review#>>'{template,version}'not in('1.1.0','1.2.0','1.3.0','1.4.0')then$r$),
  ('public.eps_get_workspace_review(uuid,uuid,text)',$n$entry->>'field','Text exceeds the selected slide layout.','Shorten this display field or correct its supplied content, then measure again.');$n$,
   $r$entry->>'field',eps.review_fit_message(entry->>'field',false),eps.review_fit_message(entry->>'field',true));$r$),
  ('public.eps_request_workspace_review_fit(uuid,uuid,jsonb,text)',$n$template_version in('1.1.0','1.2.0','1.3.0'))then perform eps.fail('TEMPLATE_UPGRADE_REQUIRED'$n$,$r$template_version in('1.1.0','1.2.0','1.3.0','1.4.0'))then perform eps.fail('TEMPLATE_UPGRADE_REQUIRED'$r$),
  ('eps.review_snapshot_data(uuid,uuid,text)',$n$series.template_version in('1.1.0','1.2.0','1.3.0')then$n$,$r$series.template_version in('1.1.0','1.2.0','1.3.0','1.4.0')then$r$),
  ('eps.review_snapshot_data(uuid,uuid,text)',$n$unreviewed uuid[]:='{}';$n$,$r$unreviewed uuid[]:='{}';presentation jsonb;$r$),
  -- 1.4.0: capture the presentation context, add its picture issues, and cover it with the fingerprint.
  ('eps.review_snapshot_data(uuid,uuid,text)',$n$ fingerprint:=encode(sha256(convert_to(jsonb_build_object($n$,
   $r$ if series.template_version='1.4.0'then
  presentation:=eps.review_presentation_1_4(p_workspace,series,slides);issues:=issues||(presentation->'issues');presentation:=presentation-'issues';
 elsif series.template_version in('1.1.0','1.2.0','1.3.0')then issues:=issues||eps.review_legacy_portrait_issues(p_workspace,slides);
 end if;
 fingerprint:=encode(sha256(convert_to(case when presentation is null then'{}'::jsonb else jsonb_build_object('presentation',presentation)end||jsonb_build_object($r$),
  ('eps.review_snapshot_data(uuid,uuid,text)',$n$'template',eps.review_template_dto(series),'cover',cover,'slides',slides);$n$,
   $r$'template',eps.review_template_dto(series),'cover',cover,'slides',slides)||case when presentation is null then'{}'::jsonb else jsonb_build_object('presentation',presentation)end;$r$),
  -- Generation: 1.4.0 admitted; its presentation context and pinned portraits are frozen into the snapshot.
  ('public.eps_generate_version(uuid,jsonb,text)',$n$series.template_version not in('1.1.0','1.2.0','1.3.0')then perform eps.fail('TEMPLATE_UPGRADE_REQUIRED'$n$,$r$series.template_version not in('1.1.0','1.2.0','1.3.0','1.4.0')then perform eps.fail('TEMPLATE_UPGRADE_REQUIRED'$r$),
  ('public.eps_generate_version(uuid,jsonb,text)',$n$cross join lateral jsonb_array_elements(v->'frame_asset_ids')f$n$,
   $r$cross join lateral jsonb_array_elements(v->'frame_asset_ids')f union all
  select(p#>>'{portrait,asset_id}')::uuid from jsonb_array_elements(case when series.template_version='1.4.0'then review#>'{presentation,slides}'else'[]'::jsonb end)p$r$),
  ('public.eps_generate_version(uuid,jsonb,text)',$n$a.purpose in('client_logo','candidate_frame','candidate_video')and a.bucket in('eps-brand-assets','eps-candidate-assets','eps-candidate-outputs')$n$,
   $r$(a.purpose in('client_logo','candidate_frame','candidate_video')and a.bucket in('eps-brand-assets','eps-candidate-assets','eps-candidate-outputs')or series.template_version='1.4.0'and a.purpose='candidate_photo'and a.bucket='eps-candidate-photos')$r$),
  ('public.eps_generate_version(uuid,jsonb,text)',$n$'cover',review->'cover','slides',slides,'asset_inventory',inventory);$n$,
   $r$'cover',review->'cover','slides',slides,'asset_inventory',inventory)||case when series.template_version='1.4.0'then jsonb_build_object('presentation',review->'presentation')else'{}'::jsonb end;$r$),
  ('public.eps_generate_version(uuid,jsonb,text)',$n$when series.template_version='1.3.0'then(eps.editorial_deck_counts_1_3(snapshot)->>'pages')::integer else$n$,
   $r$when series.template_version='1.3.0'then(eps.editorial_deck_counts_1_3(snapshot)->>'pages')::integer when series.template_version='1.4.0'then(eps.editorial_deck_counts_1_4(snapshot)->>'pages')::integer else$r$),
  -- Render/publish/export proof from the 1.4.0 mirror; 1.4.0 PDFs carry no original-video links.
  ('eps.presentation_validate_result(eps.jobs,jsonb)',$n$when'1.3.0'then eps.editorial_deck_counts_1_3(version.snapshot)end;$n$,$r$when'1.3.0'then eps.editorial_deck_counts_1_3(version.snapshot)when'1.4.0'then eps.editorial_deck_counts_1_4(version.snapshot)end;$r$),
  ('eps.presentation_validate_result(eps.jobs,jsonb)',$n$with ordinality a(s,ord)where s->>'video_asset_id'is not null;$n$,
   $r$with ordinality a(s,ord)where s->>'video_asset_id'is not null;
 if version.snapshot#>>'{template,version}'='1.4.0'then video_count:=0;link_hash:=eps.presentation_hash('[]'::jsonb);end if;$r$),
  ('eps.export_validate_result(eps.jobs,jsonb)',$n$when'1.3.0'then eps.editorial_deck_counts_1_3(version.snapshot)end;$n$,$r$when'1.3.0'then eps.editorial_deck_counts_1_3(version.snapshot)when'1.4.0'then eps.editorial_deck_counts_1_4(version.snapshot)end;$r$),
  ('eps.export_validate_result(eps.jobs,jsonb)',$n$video_count from jsonb_array_elements(version.snapshot->'slides')s;$n$,
   $r$video_count from jsonb_array_elements(version.snapshot->'slides')s;
 if version.snapshot#>>'{template,version}'='1.4.0'then video_count:=0;end if;$r$),
  ('eps.review_validate_fit(eps.jobs,jsonb)',$n$(case when p_job.input#>>'{template,version}'in('1.2.0','1.3.0')then 9 else 6 end)$n$,$r$(case when p_job.input#>>'{template,version}'in('1.2.0','1.3.0','1.4.0')then 9 else 6 end)$r$),
  -- The published manifest and render context carry the frozen 1.4.0 presentation context (absent before 1.4.0).
  ('eps.presentation_manifest(jsonb)',$n$'created_at',p_snapshot->'created_at')$n$,$r$'created_at',p_snapshot->'created_at')||case when p_snapshot?'presentation'then jsonb_build_object('presentation',p_snapshot->'presentation')else'{}'::jsonb end$r$),
  ('eps.presentation_render_context(jsonb)',$n$with ordinality s(v,ordinal)),'[]'::jsonb))$n$,$r$with ordinality s(v,ordinal)),'[]'::jsonb))||case when p_snapshot?'presentation'then jsonb_build_object('presentation',p_snapshot->'presentation')else'{}'::jsonb end$r$),
  -- Fixed-version reads of pinned 1.4.0 photo portraits (served as the "frame" purpose).
  ('public.eps_get_version_asset(uuid,uuid,text)',$n$p.asset_id=p_asset_id and p.asset_kind=kind;$n$,$r$p.asset_id=p_asset_id and(p.asset_kind=kind or kind='candidate_frame'and p.asset_kind='candidate_photo');$r$),
  ('eps.presentation_storage_read_allowed(text,text)',$n$p_bucket not in('eps-brand-assets','eps-candidate-assets','eps-candidate-outputs','eps-presentation-outputs')$n$,$r$p_bucket not in('eps-brand-assets','eps-candidate-assets','eps-candidate-outputs','eps-candidate-photos','eps-presentation-outputs')$r$),
  ('eps.presentation_storage_read_allowed(text,text)',$n$p.asset_kind in('client_logo','candidate_frame','candidate_video')$n$,$r$p.asset_kind in('client_logo','candidate_frame','candidate_photo','candidate_video')$r$),
  ('eps.presentation_asset_member(eps.jobs,eps.media_assets,text)',$n$p.asset_kind in('client_logo','candidate_frame','candidate_video')$n$,$r$p.asset_kind in('client_logo','candidate_frame','candidate_photo','candidate_video')$r$),
  ('eps.presentation_capability_allowed(text,text,text)',$n$p_bucket not in('eps-brand-assets','eps-candidate-assets','eps-candidate-outputs','eps-presentation-outputs')$n$,$r$p_bucket not in('eps-brand-assets','eps-candidate-assets','eps-candidate-outputs','eps-candidate-photos','eps-presentation-outputs')$r$),
  ('eps.export_asset_member(eps.jobs,eps.media_assets,text)',$n$p.asset_kind in('client_logo','candidate_frame')$n$,$r$p.asset_kind in('client_logo','candidate_frame','candidate_photo')$r$),
  ('eps.guest_storage_allowed(text,text)',$n$p.asset_kind=case g.purpose when'video'then'candidate_video'when'frame'then'candidate_frame'else'client_logo'end$n$,
   $r$(p.asset_kind=case g.purpose when'video'then'candidate_video'when'frame'then'candidate_frame'else'client_logo'end or g.purpose='frame'and p.asset_kind='candidate_photo')$r$),
  ('eps.guest_version_dto(eps.presentation_versions,eps.review_links)',$n$'template_content_hash',p_version.snapshot#>>'{template,content_sha256}')$n$,
   $r$'template_content_hash',p_version.snapshot#>>'{template,content_sha256}')||case when p_version.snapshot?'presentation'then eps.guest_presentation_1_4(p_version.snapshot)else'{}'::jsonb end$r$),
  ('eps.guest_asset_issue(uuid,text,uuid,uuid,text,uuid)',$n$where version_id=version.id and asset_id=p_asset and asset_kind=kind;$n$,$r$where version_id=version.id and asset_id=p_asset and(asset_kind=kind or kind='candidate_frame'and asset_kind='candidate_photo');$r$)
 )v(signature,needle,patch)loop
  select replace(prosrc,E'\r\n',E'\n'),replace(pg_get_functiondef(oid),E'\r\n',E'\n')into source,definition from pg_proc where oid=item.signature::regprocedure;
  if(length(source)-length(replace(source,item.needle,'')))/length(item.needle)<>1 or position(item.patch in source)>0 then raise exception'M19_EDITORIAL_ANCHOR_REQUIRED:%:%',item.signature,left(item.needle,60);end if;
  replacement:=replace(source,item.needle,item.patch);execute replace(definition,source,replacement);
 end loop;
end$m19_forward$;

-- 5. Storage: the photo bucket's guard also admits fixed-version reads of pinned 1.4.0 portraits (signed-in
-- presentation readers, worker job grants, guest grants). Each branch re-checks the version pin.
alter policy eps_candidate_photos_read_guard on storage.objects using((bucket_id<>'eps-candidate-photos'::text)OR((storage.allow_only_operation('object.get_authenticated'::text)OR storage.allow_only_operation('object.get_authenticated_info'::text)OR storage.allow_only_operation('object.sign'::text))AND eps.candidate_photo_read_allowed(bucket_id,name))
 OR((storage.allow_only_operation('object.get_authenticated'::text)OR storage.allow_only_operation('object.get_authenticated_info'::text))AND(eps.presentation_capability_allowed(bucket_id,name,'read'::text)OR eps.guest_storage_allowed(bucket_id,name)))
 OR((storage.allow_only_operation('object.get_authenticated'::text)OR storage.allow_only_operation('object.get_authenticated_info'::text)OR storage.allow_only_operation('object.sign'::text))AND eps.presentation_storage_read_allowed(bucket_id,name)));
create policy m19_presentation_photo_read on storage.objects for select to anon,authenticated using(bucket_id='eps-candidate-photos'
 and((storage.allow_only_operation('object.get_authenticated')or storage.allow_only_operation('object.get_authenticated_info'))and(eps.presentation_capability_allowed(bucket_id,name,'read')or eps.guest_storage_allowed(bucket_id,name))
  or(storage.allow_only_operation('object.get_authenticated')or storage.allow_only_operation('object.get_authenticated_info')or storage.allow_only_operation('object.sign'))and eps.presentation_storage_read_allowed(bucket_id,name)));

-- Readback: every gate that admits 1.3.0 now admits 1.4.0, five templates are registered, the Settings default
-- is untouched, and the patched bodies equal the replica post-images.
do $m19_readback$begin
 if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('eps','public')
   and p.oid::regprocedure::text not in('eps.editorial_deck_counts_1_3(jsonb)')and p.prosrc like'%''1.3.0''%'and p.prosrc not like'%''1.4.0''%')
 or(select count(*)from eps.presentation_templates where key='everyone-casting'and registered)<>5
 or(select template_version from eps.app_settings where singleton)='1.4.0'
 or(select jsonb_object_agg(p.oid::regprocedure::text,encode(sha256(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'UTF8')),'hex'))from pg_proc p
   where p.oid::regprocedure::text=any(array(select jsonb_object_keys('{"eps.export_asset_member(eps.jobs,eps.media_assets,text)":"bc93527bac4aa318ded89ada646188532a6f820fcaa3eec3facdea0831df40c6","eps.export_validate_result(eps.jobs,jsonb)":"5f7998a6eb693a21192edd5cf035680f7f58d8850f2c7d7f7878e7dcfd840f86","eps.guest_asset_issue(uuid,text,uuid,uuid,text,uuid)":"f1e6ffbcab2378b32beb8feddf3358a51595a39b7a1baddfdd157b16e17316a6","eps.guest_storage_allowed(text,text)":"ddf6fae991f8d81f5f8c1ff304a1b14c249b3f0b874578bfeb8e24b82ce8061b","eps.guest_version_dto(eps.presentation_versions,eps.review_links)":"35da1d09797c0e2a304cce9257ad4699f63e2928a8320d733fa0e28cef8129b1","eps.presentation_asset_member(eps.jobs,eps.media_assets,text)":"e4e8c580449108c728fd425471390f048d2da421280ccf67cb3aa6ee97a6eb4c","eps.presentation_capability_allowed(text,text,text)":"b9c76eb7e224b585852b1028c79984c09ec7dc13829335a2a8bfe9c2ce797b5c","eps.presentation_manifest(jsonb)":"a897a5af0e5380f4cf8bf8693e84c2245a0a1542079490cef6fb72a6b340a71f","eps.presentation_render_context(jsonb)":"8348ed81208ab8d83a425f5f8fe55ea83ee522002e6f65168d30d72b057304ac","eps.presentation_storage_read_allowed(text,text)":"1c3abded65f6ce23c077d20938586ded92ee31594eb76de7f294bc2eae54dcd2","eps.presentation_validate_result(eps.jobs,jsonb)":"c06fa1dcb6a4eeee1b268ea3016829132318cf10dd1948918f77ea4ed91d2300","eps.review_snapshot_data(uuid,uuid,text)":"c597c768afefa13b32196e884e12401773e32923e001727bbce3291afb4e5503","eps.review_validate_fit(eps.jobs,jsonb)":"39b3373c57661d5066c52c2e7f5d1f167f6176904f634d40588b7e5c1f6158ac","public.eps_generate_version(uuid,jsonb,text)":"387cac92111196cf5ef9ddb9aed1d1d3dbab99394ea9777e2c158cad266f27fe","public.eps_get_version_asset(uuid,uuid,text)":"d3ea401656acc68b54538f1044274f9c2348cd5af3b2bf009dbc41bc27fa529f","public.eps_get_workspace_review(uuid,uuid,text)":"e4a501549bf7b3a1e30b677415626dde9e51c141711ca01036c37a42cae3a871","public.eps_request_workspace_review_fit(uuid,uuid,jsonb,text)":"2ea5ea5a3d009a4252f0eec8d0091a72e26f6896fc7635773aa3ca2ceba235e7","public.eps_update_settings(jsonb,text)":"759f34e8fcc2dd7a4263924c888531c76ee937379a30f593ccb56660eb4ba261"}'::jsonb))))
  is distinct from'{"eps.export_asset_member(eps.jobs,eps.media_assets,text)":"bc93527bac4aa318ded89ada646188532a6f820fcaa3eec3facdea0831df40c6","eps.export_validate_result(eps.jobs,jsonb)":"5f7998a6eb693a21192edd5cf035680f7f58d8850f2c7d7f7878e7dcfd840f86","eps.guest_asset_issue(uuid,text,uuid,uuid,text,uuid)":"f1e6ffbcab2378b32beb8feddf3358a51595a39b7a1baddfdd157b16e17316a6","eps.guest_storage_allowed(text,text)":"ddf6fae991f8d81f5f8c1ff304a1b14c249b3f0b874578bfeb8e24b82ce8061b","eps.guest_version_dto(eps.presentation_versions,eps.review_links)":"35da1d09797c0e2a304cce9257ad4699f63e2928a8320d733fa0e28cef8129b1","eps.presentation_asset_member(eps.jobs,eps.media_assets,text)":"e4e8c580449108c728fd425471390f048d2da421280ccf67cb3aa6ee97a6eb4c","eps.presentation_capability_allowed(text,text,text)":"b9c76eb7e224b585852b1028c79984c09ec7dc13829335a2a8bfe9c2ce797b5c","eps.presentation_manifest(jsonb)":"a897a5af0e5380f4cf8bf8693e84c2245a0a1542079490cef6fb72a6b340a71f","eps.presentation_render_context(jsonb)":"8348ed81208ab8d83a425f5f8fe55ea83ee522002e6f65168d30d72b057304ac","eps.presentation_storage_read_allowed(text,text)":"1c3abded65f6ce23c077d20938586ded92ee31594eb76de7f294bc2eae54dcd2","eps.presentation_validate_result(eps.jobs,jsonb)":"c06fa1dcb6a4eeee1b268ea3016829132318cf10dd1948918f77ea4ed91d2300","eps.review_snapshot_data(uuid,uuid,text)":"c597c768afefa13b32196e884e12401773e32923e001727bbce3291afb4e5503","eps.review_validate_fit(eps.jobs,jsonb)":"39b3373c57661d5066c52c2e7f5d1f167f6176904f634d40588b7e5c1f6158ac","public.eps_generate_version(uuid,jsonb,text)":"387cac92111196cf5ef9ddb9aed1d1d3dbab99394ea9777e2c158cad266f27fe","public.eps_get_version_asset(uuid,uuid,text)":"d3ea401656acc68b54538f1044274f9c2348cd5af3b2bf009dbc41bc27fa529f","public.eps_get_workspace_review(uuid,uuid,text)":"e4a501549bf7b3a1e30b677415626dde9e51c141711ca01036c37a42cae3a871","public.eps_request_workspace_review_fit(uuid,uuid,jsonb,text)":"2ea5ea5a3d009a4252f0eec8d0091a72e26f6896fc7635773aa3ca2ceba235e7","public.eps_update_settings(jsonb,text)":"759f34e8fcc2dd7a4263924c888531c76ee937379a30f593ccb56660eb4ba261"}'::jsonb
 then raise exception'M19_EDITORIAL_READBACK_FAILED';end if;
end$m19_readback$;
