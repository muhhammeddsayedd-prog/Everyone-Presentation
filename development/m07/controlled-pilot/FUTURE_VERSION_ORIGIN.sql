-- REVIEWABLE FIXED-TARGET DML ONLY. NOT EXECUTED BY AUTHORING THIS FILE.
-- Root must bind its established CLI/operator connection to project pyibofyctwnqpvktepse.
-- Database/user names alone cannot establish cloud project identity.
-- After the fixed public host is ready, quiesce generation/processing first.
-- Unknown COMMIT outcome: use FUTURE_VERSION_ORIGIN_READBACK.sql; never blindly rerun.
begin;set local search_path='';set local timezone='UTC';set local lock_timeout='5s';set local statement_timeout='30s';
lock table eps.presentation_processing_config in access exclusive mode;
lock table eps.presentation_versions,eps.version_slides,eps.presentation_version_assets,eps.media_assets in share mode;
do $pilot_origin$
declare previous_config jsonb;current_config jsonb;baseline jsonb;observed jsonb;pass integer;changed integer;
begin
 if current_user<>'postgres' or current_database()<>'postgres'
 or(select array_agg(version order by version)from supabase_migrations.schema_migrations)is distinct from array['20261028010943','20261028013324','20261028013655','20261028024205','20261028072515','20261028162702','20261028162800','20261028172320','20261028184145','20261028222030','20261029001520','20261029003941','20261029070038','20261029090500','20261029090724','20261029094600','20261029100500','20261029133455','20261029135318','20261029174841','20261029180953','20261029202629','20261029203953','20261029215218','20261030002634','20261030004643','20261030013832','20261030030717','20261030111549','20261030154824']::text[]
 then raise exception 'PILOT_ORIGIN_EXACT_CANONICAL30_REQUIRED';end if;
 if(select count(*)from eps.presentation_processing_config)<>1
 or not exists(select 1 from eps.presentation_processing_config where id and application_origin='http://127.0.0.1:3000')
 or exists(select 1 from pg_trigger where tgrelid='eps.presentation_processing_config'::regclass and not tgisinternal)
 or exists(select 1 from eps.jobs where kind in('presentation_render','presentation_export')and status in('queued','running','waiting_for_input'))
 then raise exception 'PILOT_ORIGIN_SINGLE_OLD_CONFIG_AND_QUIESCENCE_REQUIRED';end if;
 perform 1 from eps.jobs where id='b3f90268-147d-41d4-8875-2a6435df1496'for share;
 perform 1 from eps.specs where id=(select resource_id from eps.jobs where id='b3f90268-147d-41d4-8875-2a6435df1496')for share;
 select to_jsonb(c)into previous_config from eps.presentation_processing_config c where id;
 for pass in 1..2 loop
  select jsonb_build_object(
   'versions',(select jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(to_jsonb(v)::text,E'\n'order by v.id),''),'UTF8')),'hex'))from eps.presentation_versions v),
   'slides',(select jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(to_jsonb(s)::text,E'\n'order by s.id),''),'UTF8')),'hex'))from eps.version_slides s),
   'pins',(select jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(to_jsonb(p)::text,E'\n'order by p.version_id,p.asset_id),''),'UTF8')),'hex'))from eps.presentation_version_assets p),
   'ready_asset_metadata',(select jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(jsonb_build_object('version_id',v.id,'asset_id',a.id,'sha256',a.sha256,'size_bytes',a.size_bytes,'status',a.status)::text,E'\n'order by v.id,a.id),''),'UTF8')),'hex'))from eps.presentation_versions v join eps.presentation_version_assets p on p.version_id=v.id join eps.media_assets a on a.id=p.asset_id where v.status='ready'),
   'protected_m02',(select jsonb_build_object('id',j.id,'status',j.status,'stage',j.stage,'attempt',j.attempt,'row_version',j.row_version,'resource_id',j.resource_id,
    'manual_note_retained',position('Manual verification: preserve this instruction while extraction is pending.'in coalesce(s.normalized_instructions,''))>0,
    'spec_sha256',encode(sha256(convert_to(jsonb_build_object('id',s.id,'row_version',s.row_version,'normalized_instructions',s.normalized_instructions)::text,'UTF8')),'hex'))from eps.jobs j join eps.specs s on s.id=j.resource_id where j.id='b3f90268-147d-41d4-8875-2a6435df1496')
  )into observed;
  if observed->'protected_m02' is null or observed->'protected_m02'='null'::jsonb
   or observed#>'{protected_m02,manual_note_retained}'is distinct from'true'::jsonb
   then raise exception 'PILOT_ORIGIN_PROTECTED_M02_REQUIRED';end if;
  if pass=1 then
   baseline:=observed;
   update eps.presentation_processing_config set application_origin='https://everyone-presentation-pilot.vercel.app'
    where id and application_origin='http://127.0.0.1:3000';
   get diagnostics changed=row_count;
   if changed<>1 then raise exception 'PILOT_ORIGIN_EXACT_ONE_UPDATE_REQUIRED';end if;
  else
   select to_jsonb(c)into current_config from eps.presentation_processing_config c where id;
   if observed is distinct from baseline
   or current_config is distinct from jsonb_set(previous_config,'{application_origin}',to_jsonb('https://everyone-presentation-pilot.vercel.app'::text))
   then raise exception 'PILOT_ORIGIN_PROTECTED_STATE_CHANGED';end if;
  end if;
 end loop;
 perform set_config('eps.pilot_origin_result',jsonb_build_object('expected_project','pyibofyctwnqpvktepse',
  'old_origin',previous_config->>'application_origin','new_origin',current_config->>'application_origin',
  'configuration_other_columns_preserved',true,'snapshots_slides_pins_ready_metadata_and_m02_preserved',true,
  'protected_metadata',observed,'scope','Future captures only; no snapshots, PDF bytes, jobs, Auth, client/resource bindings or credentials changed.')::text,true);
end$pilot_origin$;
select current_setting('eps.pilot_origin_result')::jsonb as pilot_origin_update;
commit;
