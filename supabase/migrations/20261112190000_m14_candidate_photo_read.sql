-- m14: Read path for the cast archive photos imported by m09 (eps.candidate_photos), so Cast Library cards and
-- profiles show the person's photo. Additive and read-only:
--  * one SELECT policy so functions owned by eps_cast_owner can read ready candidate_photo assets (the m09 storage
--    policy already lets any cast.read account read those objects; this matches it, nothing wider);
--  * public.eps_list_candidate_photos(candidate)  -> the person's photos, cover first (at most 50);
--  * public.eps_get_candidate_photo_asset(asset)  -> one ready photo or thumbnail asset with its storage location.
-- No existing function, policy, table or row is changed. Both functions are security definer, owned by
-- eps_cast_owner, executable by authenticated only, and require cast.read like every Cast Library read.
set local search_path='';set local lock_timeout='5s';set local statement_timeout='60s';

do $m14$begin
 if to_regclass('eps.candidate_photos') is null or to_regclass('eps.candidate_attributes') is null then raise exception 'M14_REQUIRES_M09';end if;
 if to_regprocedure('public.eps_list_candidate_photos(uuid)') is not null or to_regprocedure('public.eps_get_candidate_photo_asset(uuid)') is not null
  or exists(select 1 from pg_policies where schemaname='eps' and tablename='media_assets' and policyname='cast_photo_assets_read') then raise exception 'M14_ALREADY_APPLIED';end if;
 if not has_table_privilege('eps_cast_owner','eps.media_assets','select') or not has_table_privilege('eps_cast_owner','eps.candidate_photos','select')
  or not has_table_privilege('eps_cast_owner','eps.candidate_attributes','select') then raise exception 'M14_CAST_OWNER_GRANTS_MISSING';end if;
end$m14$;

-- 1. The cast owner may read ready photo assets (evaluated once per statement, as m12 does for the cast read policy).
create policy cast_photo_assets_read on eps.media_assets for select to eps_cast_owner
 using(purpose='candidate_photo' and status='ready' and (select eps.has_capability('cast.read')));

-- 2. A person's photos, cover first then in archive order.
create function public.eps_list_candidate_photos(p_candidate_id uuid)returns jsonb language plpgsql stable security definer set search_path='' as $$declare result jsonb;cover uuid;begin
 perform eps.require_capability('cast.read');
 if p_candidate_id is null or not exists(select 1 from eps.candidates where id=p_candidate_id)then perform eps.fail('RESOURCE_NOT_FOUND','Candidate not found.',404);end if;
 select cover_photo_id into cover from eps.candidate_attributes where candidate_id=p_candidate_id;
 with page as(select p.*,(p.id is not distinct from cover)is_cover from eps.candidate_photos p where p.candidate_id=p_candidate_id
   and exists(select 1 from eps.media_assets a where a.id=p.asset_id and a.status='ready')and exists(select 1 from eps.media_assets t where t.id=p.thumb_asset_id and t.status='ready')
   order by(p.id is not distinct from cover)desc,p.position limit 50)
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'position',position,'cover',is_cover,'width',width,'height',height,'asset_id',asset_id,'thumb_asset_id',thumb_asset_id)order by is_cover desc,position),'[]'::jsonb)into result from page;
 return jsonb_build_object('data',result);
end $$;

-- 3. One ready photo or thumbnail asset and where it is stored (the web server reads it with the caller's session).
create function public.eps_get_candidate_photo_asset(p_asset_id uuid)returns jsonb language plpgsql stable security definer set search_path='' as $$declare a eps.media_assets;begin
 perform eps.require_capability('cast.read');
 select * into a from eps.media_assets where id=p_asset_id and purpose='candidate_photo'and status='ready'
  and exists(select 1 from eps.candidate_photos p where p.asset_id=media_assets.id or p.thumb_asset_id=media_assets.id);
 if not found then perform eps.fail('RESOURCE_NOT_FOUND','Ready candidate photo not found.',404);end if;
 return jsonb_build_object('asset',jsonb_build_object('id',a.id,'purpose',a.purpose,'mime_type',a.mime_type,'size_bytes',a.size_bytes,'sha256',a.sha256,'width',a.width,'height',a.height,'status',a.status),
  'bucket',a.bucket,'object_key',a.object_key);
end $$;

-- 4. Ownership and execute rights, as for the other Cast Library reads.
grant create on schema public to eps_cast_owner;
alter function public.eps_list_candidate_photos(uuid) owner to eps_cast_owner;
alter function public.eps_get_candidate_photo_asset(uuid) owner to eps_cast_owner;
revoke create on schema public from eps_cast_owner;
revoke all on function public.eps_list_candidate_photos(uuid),public.eps_get_candidate_photo_asset(uuid) from public,anon,authenticated,service_role;
grant execute on function public.eps_list_candidate_photos(uuid),public.eps_get_candidate_photo_asset(uuid) to authenticated;

-- 5. Readback: owners, rights and the policy are exactly as declared.
do $m14_check$begin
 if (select count(*) from pg_proc where oid in('public.eps_list_candidate_photos(uuid)'::regprocedure,'public.eps_get_candidate_photo_asset(uuid)'::regprocedure)and pg_get_userbyid(proowner)='eps_cast_owner'and prosecdef)<>2
  or has_function_privilege('anon','public.eps_list_candidate_photos(uuid)','execute') or has_function_privilege('anon','public.eps_get_candidate_photo_asset(uuid)','execute')
  or not has_function_privilege('authenticated','public.eps_list_candidate_photos(uuid)','execute') or not has_function_privilege('authenticated','public.eps_get_candidate_photo_asset(uuid)','execute')
  or has_schema_privilege('eps_cast_owner','public','create')
  or not exists(select 1 from pg_policies where schemaname='eps' and tablename='media_assets' and policyname='cast_photo_assets_read' and roles='{eps_cast_owner}' and cmd='SELECT')
 then raise exception 'M14_READBACK_FAILED';end if;
end$m14_check$;
