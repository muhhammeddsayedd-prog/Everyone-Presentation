-- Additive19: a new explicit frame request may follow a terminal request.
-- Exact idempotency replay stays unchanged; matching active work still coalesces.
-- No table, ACL, ownership, runtime-port, native configuration or data change.
set local search_path='';set local lock_timeout='3s';set local statement_timeout='30s';
do $baseline$
begin
 if current_user<>'postgres' or current_database()<>'postgres'
  or (select array_agg(version order by version)from supabase_migrations.schema_migrations)is distinct from
   array['20261028010943','20261028013324','20261028013655','20261028024205','20261028072515','20261028162702',
    '20261028162800','20261028172320','20261028184145','20261028222030','20261029001520','20261029003941',
    '20261029070038','20261029090500','20261029090724','20261029094600','20261029100500','20261029133455']::text[]
 then raise exception 'FRAME_RESUBMISSION_EXACT_REVIEWED_EIGHTEEN_REQUIRED';end if;
 if not exists(select 1 from pg_proc p where p.oid='public.eps_extract_candidate_frames(uuid,jsonb,text)'::regprocedure
  and p.proowner='eps_cast_owner'::regrole and p.prosecdef and p.provolatile='v' and p.prokind='f'
  and not p.proleakproof and p.prorettype='jsonb'::regtype and p.proconfig=array['search_path=""']
  and encode(sha256(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'UTF8')),'hex')='eb387571390cf53240d819be16b408efa111d9461a81e881c83ea73c2dbcced3')
 then raise exception 'FRAME_RESUBMISSION_FUNCTION_BASELINE_CHANGED';end if;
end $baseline$;

do $forward$
declare definition text;old_text text;new_text text;begin
 definition:=pg_get_functiondef('public.eps_extract_candidate_frames(uuid,jsonb,text)'::regprocedure);
 old_text:='select * into job from eps.jobs where kind=''frame_extract'' and dedupe_key=encode(sha256(convert_to(''frame_extract:''||auth.uid()::text||'':''||fingerprint,''UTF8'')),''hex'');';
 new_text:='select * into job from eps.jobs where kind=''frame_extract'' and requested_by=auth.uid() and input_hash=fingerprint and input_hash_version=''eps.frame-input.pg-jsonb.v1'' and resource_id=p_candidate_media_id and input_asset_id=(captured->>''source_asset_id'')::uuid and status in(''queued'',''running'',''waiting_for_input'') order by created_at,id limit 1;';
 if length(definition)-length(replace(definition,old_text,''))<>length(old_text)then raise exception 'FRAME_RESUBMISSION_ACTIVE_COALESCING_SEAM_CHANGED';end if;
 definition:=replace(definition,old_text,new_text);
 old_text:='encode(sha256(convert_to(''frame_extract:''||auth.uid()::text||'':''||fingerprint,''UTF8'')),''hex''),''extract_frames''';
 new_text:='encode(sha256(convert_to(''frame_extract:''||auth.uid()::text||'':''||fingerprint||'':''||p_idempotency_key,''UTF8'')),''hex''),''extract_frames''';
 if length(definition)-length(replace(definition,old_text,''))<>length(old_text)then raise exception 'FRAME_RESUBMISSION_NEW_INTENT_SEAM_CHANGED';end if;
 execute replace(definition,old_text,new_text);
end $forward$;
