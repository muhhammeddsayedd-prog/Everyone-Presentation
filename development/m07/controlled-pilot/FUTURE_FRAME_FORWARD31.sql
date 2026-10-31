-- ROOT-EXECUTED ONLY. Public manifest supplies the sole exact digest placeholder.
-- Canonical31 future captures only; old jobs/requests/facts/Ready snapshots stay frozen.
-- Quiesce both owned workers and new candidate/frame submissions before execution.
begin;set local search_path='';set local timezone='UTC';set local lock_timeout='5s';set local statement_timeout='30s';
lock table eps.frame_extraction_config in access exclusive mode;
lock table eps.jobs,eps.outbox_events,eps.frame_extraction_requests,eps.candidate_stage_payloads,
 eps.candidates,eps.candidate_media,eps.candidate_media_frames,eps.presentation_versions,
 eps.version_slides,eps.presentation_version_assets,eps.media_assets,eps.app_settings in share mode;
do $pilot_frame_forward$
declare previous_config jsonb;current_config jsonb;baseline jsonb;observed jsonb;changed integer;pass integer;expected text;
begin
 expected:='__HOSTED_NATIVE_IMAGE_ID__';
 if current_user<>'postgres'or current_database()<>'postgres'or expected!~'^sha256:[a-f0-9]{64}$'
 or expected='sha256:5e2500470a76caff11fa4b82a0d328dec423090ce8ba2d6417663283bacfff06'
 or(select array_agg(version order by version)from supabase_migrations.schema_migrations)is distinct from array['20261028010943','20261028013324','20261028013655','20261028024205','20261028072515','20261028162702','20261028162800','20261028172320','20261028184145','20261028222030','20261029001520','20261029003941','20261029070038','20261029090500','20261029090724','20261029094600','20261029100500','20261029133455','20261029135318','20261029174841','20261029180953','20261029202629','20261029203953','20261029215218','20261030002634','20261030004643','20261030013832','20261030030717','20261030111549','20261030154824','20261031010000']::text[]
 or (select encode(sha256(convert_to(replace(prosrc,E'\r\n',E'\n'),'UTF8')),'hex')from pg_proc where oid='eps.specs_submit_ack(uuid,uuid,uuid)'::regprocedure) is distinct from 'e0a7c7be311e6b2139faf08238121f4687d379844a26dd602ff8331b54231481'
 or (select encode(sha256(convert_to(replace(prosrc,E'\r\n',E'\n'),'UTF8')),'hex')from pg_proc where oid='eps.mcp_custom_access_token_hook(jsonb)'::regprocedure) is distinct from 'b6e422c7df5cb146e9d0c0aaaad6dfa7fc5373a36179d82284438cf599fd218c'
 then raise exception'PILOT_FRAME_FORWARD_EXACT_CANONICAL31_AND_NEW_PIN_REQUIRED';end if;
 if(select count(*)from eps.frame_extraction_config)<>1
 or not exists(select 1 from eps.frame_extraction_config where id and enabled and native_image_id='sha256:5e2500470a76caff11fa4b82a0d328dec423090ce8ba2d6417663283bacfff06'and implementation_version='frame-extraction.v1')
 or exists(select 1 from pg_trigger where tgrelid='eps.frame_extraction_config'::regclass and not tgisinternal)
 or exists(select 1 from eps.jobs where status in('queued','running','waiting_for_input'))
 or exists(select 1 from eps.outbox_events o where o.status='leased')
 then raise exception'PILOT_FRAME_FORWARD_OLD_SINGLE_ENABLED_CONFIG_AND_DRAIN_REQUIRED';end if;
 perform 1 from eps.specs where id=(select resource_id from eps.jobs where id='b3f90268-147d-41d4-8875-2a6435df1496')for share;
 select to_jsonb(c)into previous_config from eps.frame_extraction_config c where id;
 for pass in 1..2 loop
  select jsonb_build_object(
 'settings',(select jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(to_jsonb(a)::text,E'\n'order by a.singleton),''),'UTF8')),'hex'))from eps.app_settings a),
 'versions',(select jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(to_jsonb(v)::text,E'\n'order by v.id),''),'UTF8')),'hex'))from eps.presentation_versions v),
 'slides',(select jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(to_jsonb(s)::text,E'\n'order by s.id),''),'UTF8')),'hex'))from eps.version_slides s),
 'pins',(select jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(to_jsonb(p)::text,E'\n'order by p.version_id,p.asset_id),''),'UTF8')),'hex'))from eps.presentation_version_assets p),
 'ready_asset_metadata',(select jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(jsonb_build_object('version_id',v.id,'asset_id',a.id,'sha256',a.sha256,'size_bytes',a.size_bytes,'status',a.status)::text,E'\n'order by v.id,a.id),''),'UTF8')),'hex'))from eps.presentation_versions v join eps.presentation_version_assets p on p.version_id=v.id join eps.media_assets a on a.id=p.asset_id where v.status='ready'),
 'jobs',(select jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(jsonb_build_object('id',j.id,'kind',j.kind,'resource_id',j.resource_id,'input_asset_id',j.input_asset_id,'input',j.input,'input_hash',j.input_hash,'input_hash_version',j.input_hash_version,'status',j.status,'stage',j.stage,'attempt',j.attempt,'row_version',j.row_version,'completed_stages',j.completed_stages,'result',j.result,'error',j.error)::text,E'\n'order by j.id),''),'UTF8')),'hex'))from eps.jobs j),
 'outbox',(select jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(jsonb_build_object('id',o.id,'job_id',o.job_id,'topic',o.topic,'stage',o.stage,'input_hash',o.input_hash,'dispatch_generation',o.dispatch_generation,'dedupe_key',o.dedupe_key,'status',o.status,'attempt_count',o.attempt_count,'available_at',o.available_at,'lease_expires_at',o.lease_expires_at,'delivered_at',o.delivered_at,'created_at',o.created_at)::text,E'\n'order by o.id),''),'UTF8')),'hex'))from eps.outbox_events o),
 'requests',(select jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(to_jsonb(r)::text,E'\n'order by r.job_id),''),'UTF8')),'hex'))from eps.frame_extraction_requests r),
 'payloads',(select jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(to_jsonb(p)::text,E'\n'order by p.id),''),'UTF8')),'hex'))from eps.candidate_stage_payloads p),
 'candidates',(select jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(to_jsonb(c)::text,E'\n'order by c.id),''),'UTF8')),'hex'))from eps.candidates c),
 'candidate_media',(select jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(to_jsonb(m)::text,E'\n'order by m.id),''),'UTF8')),'hex'))from eps.candidate_media m),
 'frames',(select jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(to_jsonb(f)::text,E'\n'order by f.candidate_media_id,f.asset_id),''),'UTF8')),'hex'))from eps.candidate_media_frames f),
 'protected_m02',(select jsonb_build_object('id',j.id,'status',j.status,'stage',j.stage,'attempt',j.attempt,'row_version',j.row_version,'resource_id',j.resource_id,
  'manual_note_retained',position('Manual verification: preserve this instruction while extraction is pending.'in coalesce(s.normalized_instructions,''))>0,
  'spec_sha256',encode(sha256(convert_to(jsonb_build_object('id',s.id,'row_version',s.row_version,'normalized_instructions',s.normalized_instructions)::text,'UTF8')),'hex'))from eps.jobs j join eps.specs s on s.id=j.resource_id where j.id='b3f90268-147d-41d4-8875-2a6435df1496')
)into observed;
  if observed#>'{protected_m02,manual_note_retained}'is distinct from'true'::jsonb
  then raise exception'PILOT_FRAME_FORWARD_PROTECTED_M02_REQUIRED';end if;
  if pass=1 then
   baseline:=observed;
   update eps.frame_extraction_config set native_image_id=expected
    where id and enabled and native_image_id='sha256:5e2500470a76caff11fa4b82a0d328dec423090ce8ba2d6417663283bacfff06'and implementation_version='frame-extraction.v1';
   get diagnostics changed=row_count;if changed<>1 then raise exception'PILOT_FRAME_FORWARD_EXACT_ONE_UPDATE_REQUIRED';end if;
  else
   select to_jsonb(c)into current_config from eps.frame_extraction_config c where id;
   if observed is distinct from baseline or current_config is distinct from jsonb_set(previous_config,'{native_image_id}',to_jsonb(expected))
   then raise exception'PILOT_FRAME_FORWARD_PROTECTED_STATE_CHANGED';end if;
  end if;
 end loop;
 perform set_config('eps.pilot_frame_forward_result',jsonb_build_object('expected_project','pyibofyctwnqpvktepse',
 'old_native_image_id',previous_config->>'native_image_id','new_native_image_id',current_config->>'native_image_id',
 'other_config_columns_preserved',true,'protected_metadata_preserved',true,'protected_metadata',observed)::text,true);
end$pilot_frame_forward$;
select current_setting('eps.pilot_frame_forward_result')::jsonb as pilot_frame_forward_update;
commit;
