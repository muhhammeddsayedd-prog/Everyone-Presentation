-- M07 Logo INFO operation. One existing helper body only; no grants/policies.
set local search_path='';set local lock_timeout='5s';set local statement_timeout='60s';
do $logo41$declare target pg_proc;begin
 if current_database()<>'postgres'or current_user<>'postgres'
 or(select array_agg(version order by version)from supabase_migrations.schema_migrations)is distinct from array['20261028010943','20261028013324','20261028013655','20261028024205','20261028072515','20261028162702','20261028162800','20261028172320','20261028184145','20261028222030','20261029001520','20261029003941','20261029070038','20261029090500','20261029090724','20261029094600','20261029100500','20261029133455','20261029135318','20261029174841','20261029180953','20261029202629','20261029203953','20261029215218','20261030002634','20261030004643','20261030013832','20261030030717','20261030111549','20261030154824','20261031010000','20261031104603','20261031130207','20261031143711','20261031182038','20261101012057','20261101042702','20261101110939','20261101223342','20261102085405']::text[]
 then raise exception'LOGO41_EXACT40_REQUIRED';end if;
 select * into strict target from pg_proc where oid='eps.logo_storage_read_allowed(text,text)'::regprocedure;
 if encode(sha256(convert_to(target.prosrc,'UTF8')),'hex')<>'1f3f2a1440bf97400b7042bafd4b49ac98f7960cce8cd815f973ca5a7d166e87' or target.proowner<>'eps_api_owner'::regrole or not target.prosecdef or target.provolatile<>'s'
 then raise exception'LOGO41_EXACT_HELPER_REQUIRED';end if;
 perform set_config('eps.logo41.function_before',(to_jsonb(target)-'prosrc')::text,true);
end$logo41$;
create or replace function eps.logo_storage_read_allowed(p_bucket text,p_key text) returns boolean
language plpgsql stable security definer set search_path='' as $logo_info$ begin
  if p_bucket is distinct from 'eps-brand-assets' or auth.uid() is null or not(storage.allow_only_operation('object.get_authenticated') or storage.allow_only_operation('object.get_authenticated_info')) then return false; end if;
  return exists(select 1 from eps.media_assets asset where asset.bucket=p_bucket and asset.object_key=p_key
    and (asset.status='ready' or exists(select 1 from eps.upload_sessions upload where upload.asset_id=asset.id and upload.principal_id=auth.uid() and upload.status='open' and upload.expires_at>clock_timestamp() and eps.logo_scope(upload.workspace_id,true))));
end $logo_info$;

do $logo41$declare target pg_proc;begin
 select * into strict target from pg_proc where oid='eps.logo_storage_read_allowed(text,text)'::regprocedure;
 if encode(sha256(convert_to(target.prosrc,'UTF8')),'hex')<>'c6d72b2aded23a18ea47d6bea419163aca204293b5265ec3e08514463e1d76dd'
 or(to_jsonb(target)-'prosrc')is distinct from current_setting('eps.logo41.function_before')::jsonb
 then raise exception'LOGO41_HELPER_METADATA_CHANGED';end if;
end$logo41$;
