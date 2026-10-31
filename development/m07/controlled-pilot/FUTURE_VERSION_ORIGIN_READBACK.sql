-- FIXED read-only inspection. Root binds the existing canonical project externally.
-- Safe metadata/fingerprints only; no credentials, Auth payloads or raw snapshot/spec content.
begin isolation level repeatable read read only;set local search_path='';set local timezone='UTC';set local statement_timeout='30s';
do $pilot_origin_readback$
declare observed jsonb;
begin
 if current_user<>'postgres' or current_database()<>'postgres'
 or(select array_agg(version order by version)from supabase_migrations.schema_migrations)is distinct from array['20261028010943','20261028013324','20261028013655','20261028024205','20261028072515','20261028162702','20261028162800','20261028172320','20261028184145','20261028222030','20261029001520','20261029003941','20261029070038','20261029090500','20261029090724','20261029094600','20261029100500','20261029133455','20261029135318','20261029174841','20261029180953','20261029202629','20261029203953','20261029215218','20261030002634','20261030004643','20261030013832','20261030030717','20261030111549','20261030154824']::text[]
 then raise exception 'PILOT_ORIGIN_EXACT_CANONICAL30_REQUIRED';end if;
  select jsonb_build_object(
   'versions',(select jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(to_jsonb(v)::text,E'\n'order by v.id),''),'UTF8')),'hex'))from eps.presentation_versions v),
   'slides',(select jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(to_jsonb(s)::text,E'\n'order by s.id),''),'UTF8')),'hex'))from eps.version_slides s),
   'pins',(select jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(to_jsonb(p)::text,E'\n'order by p.version_id,p.asset_id),''),'UTF8')),'hex'))from eps.presentation_version_assets p),
   'ready_asset_metadata',(select jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(jsonb_build_object('version_id',v.id,'asset_id',a.id,'sha256',a.sha256,'size_bytes',a.size_bytes,'status',a.status)::text,E'\n'order by v.id,a.id),''),'UTF8')),'hex'))from eps.presentation_versions v join eps.presentation_version_assets p on p.version_id=v.id join eps.media_assets a on a.id=p.asset_id where v.status='ready'),
   'protected_m02',(select jsonb_build_object('id',j.id,'status',j.status,'stage',j.stage,'attempt',j.attempt,'row_version',j.row_version,'resource_id',j.resource_id,
    'manual_note_retained',position('Manual verification: preserve this instruction while extraction is pending.'in coalesce(s.normalized_instructions,''))>0,
    'spec_sha256',encode(sha256(convert_to(jsonb_build_object('id',s.id,'row_version',s.row_version,'normalized_instructions',s.normalized_instructions)::text,'UTF8')),'hex'))from eps.jobs j join eps.specs s on s.id=j.resource_id where j.id='b3f90268-147d-41d4-8875-2a6435df1496')
  )into observed;
 perform set_config('eps.pilot_origin_readback',jsonb_build_object('expected_project','pyibofyctwnqpvktepse',
  'configuration',(select jsonb_build_object('application_origin',application_origin,'enabled',enabled,'renderer_version',renderer_version,'max_manifest_bytes',max_manifest_bytes,'max_pdf_bytes',max_pdf_bytes,'max_pages',max_pages)from eps.presentation_processing_config where id),
  'pilot_origin_configured',exists(select 1 from eps.presentation_processing_config where id and application_origin='https://everyone-presentation-pilot.vercel.app'),
  'captured_pilot_origin_versions',(select count(*)from eps.presentation_versions where snapshot#>>'{render_configuration,application_origin}'='https://everyone-presentation-pilot.vercel.app'),
  'captured_loopback_origin_versions',(select count(*)from eps.presentation_versions where snapshot#>>'{render_configuration,application_origin}'='http://127.0.0.1:3000'),
  'protected_metadata',observed)::text,true);
end$pilot_origin_readback$;
select current_setting('eps.pilot_origin_readback')::jsonb as pilot_origin_readback;
rollback;
