-- m18 cycle 7: presentation notes and an explicit default review audience (additive, forward-only).
--
-- 1. Notes printed on template 1.4.0 slides: roles.presentation_note and slots.presentation_note (the
--    highlighted "Note:" on that role's/slot's page), presentation_series.cover_note (cover). Plain text,
--    1-500 characters after trimming, or null. Earlier templates never read them.
-- 2. app_settings.default_audience_preset_id: the audience an ordinary new series uses. It is NOT set here;
--    a Studio manager chooses it in Settings. eps_create_presentation_series without an explicit preset uses
--    it and fails AUDIENCE_DEFAULT_REQUIRED when none is configured. It never picks the first preset.
-- Requires m15. Function bodies are patched with exact-once needles against pinned preimages (the live
-- bodies, verified on the cycle-7 replica, hashed after CRLF->LF normalisation); any other body is refused. Guarded against double apply.
set local search_path='';set local lock_timeout='5s';set local statement_timeout='45s';

do $m18_target$begin
 if current_user<>'postgres'
 or exists(select 1 from information_schema.columns where table_schema='eps'and table_name='roles'and column_name='presentation_note')
 or exists(select 1 from information_schema.columns where table_schema='eps'and table_name='app_settings'and column_name='default_audience_preset_id')
 then raise exception'M18_ALREADY_APPLIED';end if;
 if to_regclass('eps.scenes')is null or to_regclass('eps.audience_presets')is null or to_regclass('eps.app_settings')is null then raise exception'M18_PREREQUISITES_MISSING';end if;
 if(select jsonb_object_agg(p.oid::regprocedure::text,encode(sha256(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'UTF8')),'hex'))from pg_proc p
   where p.oid::regprocedure::text=any(array['eps.specs_role_dto(uuid)','eps.specs_slot_dto(uuid)','eps.settings_dto()','eps.review_series_dto(eps.presentation_series)',
    'public.eps_update_role(uuid,jsonb,text)','public.eps_update_slot(uuid,jsonb,text)','public.eps_update_settings(jsonb,text)','public.eps_create_presentation_series(jsonb,text)','public.eps_update_presentation_series(uuid,jsonb,text)']))
  is distinct from'{"eps.settings_dto()":"20fd20b7d78b359da498c2308da918b29d2257b5b00562671854a00d153e04e9","eps.specs_role_dto(uuid)":"67529b104e691166f85f2170aa92729265c27b31d800052ab0e7bf4f52b17a88","eps.specs_slot_dto(uuid)":"9994a41806f124724c88b6e734f3365ea5c49de02a1ae9c8b81db94d03dbb314","public.eps_update_role(uuid,jsonb,text)":"83b14cf8feb20890f740ad606f9e0645dccef508455eac9c0ebb8539063bc00c","public.eps_update_slot(uuid,jsonb,text)":"18ded26898f6c0b1a95573113c692ecd00db20be171f78c572d79f020393c0a4","public.eps_update_settings(jsonb,text)":"53cab1029afe4d79de4aa6f9ae9dd4bc913b5ebcaa3fa15d0997a7549d07fb91","public.eps_create_presentation_series(jsonb,text)":"413271b9fe4d7305d23ef59a08ea49f3c1e284132fdd6d7b3b4c5d6040e0713f","eps.review_series_dto(eps.presentation_series)":"7e9e21679486ed31e036bd0e5ffb342698697b1b257d1d65d0f476c5837b978d","public.eps_update_presentation_series(uuid,jsonb,text)":"85b4b5d5c44ccad6a16d1905310070c3ad29ec89d6b591a6a09ad803cc1b7890"}'::jsonb
 then raise exception'M18_PREIMAGE_REQUIRED';end if;
end$m18_target$;

-- 1. Columns -------------------------------------------------------------------------------------------
alter table eps.roles add column presentation_note text,
 add constraint roles_presentation_note_check check(presentation_note is null or length(btrim(presentation_note))between 1 and 500 and length(presentation_note)<=500);
alter table eps.slots add column presentation_note text,
 add constraint slots_presentation_note_check check(presentation_note is null or length(btrim(presentation_note))between 1 and 500 and length(presentation_note)<=500);
alter table eps.presentation_series add column cover_note text,
 add constraint presentation_series_cover_note_check check(cover_note is null or length(btrim(cover_note))between 1 and 500 and length(cover_note)<=500);
alter table eps.app_settings add column default_audience_preset_id uuid references eps.audience_presets(id)on delete restrict;
comment on column eps.roles.presentation_note is 'Highlighted note printed on this role''s last page in template 1.4.0 (scene occurrence notes take precedence).';
comment on column eps.slots.presentation_note is 'Highlighted note printed on the page with this slot''s last person in template 1.4.0.';
comment on column eps.presentation_series.cover_note is 'Highlighted cover note in template 1.4.0 (e.g. "Pending Availability.").';
comment on column eps.app_settings.default_audience_preset_id is 'Audience an ordinary new series uses. Chosen in Settings; never set by a migration.';

grant update(presentation_note)on eps.roles to eps_specs_owner;
grant update(presentation_note)on eps.slots to eps_specs_owner;
grant update(default_audience_preset_id)on eps.app_settings to eps_settings_owner;
-- Settings validates the chosen preset (active, existing) with its own owner.
grant select on eps.audience_presets to eps_settings_owner;
create policy m18_settings_presets_read on eps.audience_presets for select to eps_settings_owner using(eps.has_capability('settings.manage'));

-- Shared validation for a presentation note value (null clears it).
create function eps.presentation_note_check(p_value jsonb)returns void language plpgsql immutable security invoker set search_path=''as $$begin
 if p_value is null or not(p_value='null'::jsonb or jsonb_typeof(p_value)='string'and length(btrim(p_value#>>'{}'))between 1 and 500 and length(p_value#>>'{}')<=500 and(p_value#>>'{}')!~'[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]')
 then perform eps.fail('VALIDATION_FAILED','A presentation note is 1-500 characters of plain text, or null to clear it.',400);end if;
end$$;
revoke all on function eps.presentation_note_check(jsonb)from public;
grant execute on function eps.presentation_note_check(jsonb)to eps_specs_owner,eps_review_owner;

-- 2. Functions -----------------------------------------------------------------------------------------
do $m18_forward$
declare item record;source text;definition text;replacement text;
begin
 for item in select * from(values
  ('eps.specs_role_dto(uuid)',$n$'clarifications',clarifications,'sort_order',sort_order,$n$,$r$'clarifications',clarifications,'presentation_note',presentation_note,'sort_order',sort_order,$r$),
  ('eps.specs_slot_dto(uuid)',$n$'label',label,'sort_order',sort_order,$n$,$r$'label',label,'presentation_note',presentation_note,'sort_order',sort_order,$r$),
  ('eps.settings_dto()',$n$'default_review_expiry_days',s.default_review_expiry_days,'row_version',s.row_version,$n$,$r$'default_review_expiry_days',s.default_review_expiry_days,'default_audience_preset_id',s.default_audience_preset_id,'row_version',s.row_version,$r$),
  ('eps.review_series_dto(eps.presentation_series)',$n$'title',p_series.title,$n$,$r$'title',p_series.title,'cover_note',p_series.cover_note,$r$),
  -- Role note.
  ('public.eps_update_role(uuid,jsonb,text)',$n$array['row_version','name','category','requirements','clarifications']);$n$,$r$array['row_version','name','category','requirements','clarifications','presentation_note']);$r$),
  ('public.eps_update_role(uuid,jsonb,text)',$n$if p_input?'clarifications' then perform eps.specs_check_clarifications(p_input->'clarifications'); end if;$n$,
   $r$if p_input?'clarifications' then perform eps.specs_check_clarifications(p_input->'clarifications'); end if;
  if p_input?'presentation_note' then perform eps.presentation_note_check(p_input->'presentation_note'); end if;$r$),
  ('public.eps_update_role(uuid,jsonb,text)',$n$clarifications=eps.specs_merge_clarifications(clarifications,p_input->'clarifications'),row_version=row_version+1$n$,
   $r$clarifications=eps.specs_merge_clarifications(clarifications,p_input->'clarifications'),presentation_note=case when p_input?'presentation_note' then nullif(btrim(p_input->>'presentation_note'),'') else presentation_note end,row_version=row_version+1$r$),
  -- Slot note (the label becomes optional when only the note changes).
  ('public.eps_update_slot(uuid,jsonb,text)',$n$perform eps.specs_check_body(p_input,array['row_version','label']); perform eps.specs_check_text(p_input->'label',false);$n$,
   $r$perform eps.specs_check_body(p_input,array['row_version','label','presentation_note']);
  if p_input?'label' then perform eps.specs_check_text(p_input->'label',false); end if;
  if p_input?'presentation_note' then perform eps.presentation_note_check(p_input->'presentation_note'); end if;
  if not(p_input?'label' or p_input?'presentation_note') then perform eps.fail('INVALID_REQUEST','Provide a label or a presentation note.',400); end if;$r$),
  ('public.eps_update_slot(uuid,jsonb,text)',$n$update eps.slots set label=p_input->>'label',row_version=row_version+1$n$,
   $r$update eps.slots set label=case when p_input?'label' then p_input->>'label' else label end,presentation_note=case when p_input?'presentation_note' then nullif(btrim(p_input->>'presentation_note'),'') else presentation_note end,row_version=row_version+1$r$),
  -- Default review audience in Settings.
  ('public.eps_update_settings(jsonb,text)',$n$next_template text;begin$n$,$r$next_template text;next_audience uuid;begin$r$),
  ('public.eps_update_settings(jsonb,text)',$n$array['row_version','default_timezone','template_version']);$n$,$r$array['row_version','default_timezone','template_version','default_audience_preset_id']);$r$),
  ('public.eps_update_settings(jsonb,text)',$n$next_timezone:=item.default_timezone;next_template:=item.template_version;$n$,$r$next_timezone:=item.default_timezone;next_template:=item.template_version;next_audience:=item.default_audience_preset_id;$r$),
  ('public.eps_update_settings(jsonb,text)',$n$ if item.row_version=9007199254740991 then$n$,
   $r$ if p_input?'default_audience_preset_id'then
  if p_input->'default_audience_preset_id'='null'::jsonb then next_audience:=null;
  elsif jsonb_typeof(p_input->'default_audience_preset_id')is distinct from'string'or not exists(select 1 from eps.audience_presets where id::text=p_input->>'default_audience_preset_id'and not archived)
  then perform eps.fail('INVALID_REQUEST','Select an active review audience.',400);
  else next_audience:=(p_input->>'default_audience_preset_id')::uuid;end if;
 end if;
 if item.row_version=9007199254740991 then$r$),
  ('public.eps_update_settings(jsonb,text)',$n$template_version=next_template,row_version=row_version+1$n$,$r$template_version=next_template,default_audience_preset_id=next_audience,row_version=row_version+1$r$),
  -- Ordinary series use the configured default audience; never the first preset.
  ('public.eps_create_presentation_series(jsonb,text)',$n$array['workspace_id','output_type','audience_preset_id','title'],array['workspace_id','output_type','audience_preset_id']);$n$,
   $r$array['workspace_id','output_type','audience_preset_id','title'],array['workspace_id','output_type']);$r$),
  ('public.eps_create_presentation_series(jsonb,text)',$n$ select * into preset from eps.audience_presets where id=eps.casting_uuid(p_input->'audience_preset_id') and not archived;$n$,
   $r$ if p_input?'audience_preset_id'then select * into preset from eps.audience_presets where id=eps.casting_uuid(p_input->'audience_preset_id') and not archived;
 else
  select p.* into preset from eps.app_settings s join eps.audience_presets p on p.id=s.default_audience_preset_id and not p.archived where s.singleton;
  if not found then perform eps.fail('AUDIENCE_DEFAULT_REQUIRED','Choose the default review audience in Settings, or choose a review context in Share.',409);end if;
 end if;$r$),
  -- Cover note.
  ('public.eps_update_presentation_series(uuid,jsonb,text)',$n$array['row_version','title','archived'],array['row_version']);$n$,$r$array['row_version','title','archived','cover_note'],array['row_version']);$r$),
  ('public.eps_update_presentation_series(uuid,jsonb,text)',$n$or p_input?'archived'and jsonb_typeof(p_input->'archived')<>'boolean'then$n$,
   $r$or p_input?'archived'and jsonb_typeof(p_input->'archived')<>'boolean'
 or p_input?'cover_note'and not(p_input->'cover_note'='null'::jsonb or jsonb_typeof(p_input->'cover_note')='string'and length(btrim(p_input->>'cover_note'))between 1 and 500 and length(p_input->>'cover_note')<=500 and(p_input->>'cover_note')!~'[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]')then$r$),
  ('public.eps_update_presentation_series(uuid,jsonb,text)',$n$archived=case when p_input?'archived'then(p_input->>'archived')::boolean else archived end,row_version=row_version+1$n$,
   $r$archived=case when p_input?'archived'then(p_input->>'archived')::boolean else archived end,cover_note=case when p_input?'cover_note'then nullif(btrim(p_input->>'cover_note'),'')else cover_note end,row_version=row_version+1$r$)
 )v(signature,needle,patch)loop
  select replace(prosrc,E'\r\n',E'\n'),replace(pg_get_functiondef(oid),E'\r\n',E'\n')into source,definition from pg_proc where oid=item.signature::regprocedure;
  if(length(source)-length(replace(source,item.needle,'')))/length(item.needle)<>1 or position(item.patch in source)>0 then raise exception'M18_ANCHOR_REQUIRED:%',item.signature;end if;
  replacement:=replace(source,item.needle,item.patch);execute replace(definition,source,replacement);
 end loop;
end$m18_forward$;

-- Readback: columns, grants and patched bodies (post-image hashes verified on the cycle-7 replica).
do $m18_readback$begin
 if not exists(select 1 from information_schema.columns where table_schema='eps'and table_name='slots'and column_name='presentation_note')
 or not exists(select 1 from information_schema.columns where table_schema='eps'and table_name='presentation_series'and column_name='cover_note')
 or not has_column_privilege('eps_specs_owner','eps.roles','presentation_note','UPDATE')
 or not has_column_privilege('eps_settings_owner','eps.app_settings','default_audience_preset_id','UPDATE')
 or(select default_audience_preset_id from eps.app_settings where singleton)is not null
 or(select jsonb_object_agg(p.oid::regprocedure::text,encode(sha256(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'UTF8')),'hex'))from pg_proc p
   where p.oid::regprocedure::text=any(array['eps.specs_role_dto(uuid)','eps.specs_slot_dto(uuid)','eps.settings_dto()','eps.review_series_dto(eps.presentation_series)',
    'public.eps_update_role(uuid,jsonb,text)','public.eps_update_slot(uuid,jsonb,text)','public.eps_update_settings(jsonb,text)','public.eps_create_presentation_series(jsonb,text)','public.eps_update_presentation_series(uuid,jsonb,text)']))
  is distinct from'{"eps.settings_dto()":"3cd819002b92ae1714aa89cf31dc889368b55c3c9e2ff783a24a5636cb3b9968","eps.specs_role_dto(uuid)":"e9939c4fef42320563db688ee06b885d05659761537cf0bd34624dfd5341e101","eps.specs_slot_dto(uuid)":"e59b8fc4c96317aa635d4e5a9b33fee384b62b247db8e6885986f53ccea2e66f","public.eps_update_settings(jsonb,text)":"9b2f5cbdd0bc7c10b7b5550687932224760b215026128bf011079c53b4f9a7d5","public.eps_update_role(uuid,jsonb,text)":"a5b4618974b39f2da14080a80b578bbe02207a246e2cc94d06c363b63c2be99f","public.eps_update_slot(uuid,jsonb,text)":"3efd93e5e544abd966579229cb8fe4bd1c2f1df33f5fb1ac70c30e43669c4d86","public.eps_create_presentation_series(jsonb,text)":"ab5de6937e25f566a3ee257b55a53aaaddc4242a235732afcc65892754625a46","eps.review_series_dto(eps.presentation_series)":"219c08d0a84d154636119b225f73d99a75597a6e43d51aae842923f6d5c8176e","public.eps_update_presentation_series(uuid,jsonb,text)":"25cd9823c1ce0e1cdaa9c5ae5b3a8f9b6852cd814c32aa99f101ab21594e8220"}'::jsonb
 then raise exception'M18_READBACK_FAILED';end if;
end$m18_readback$;
