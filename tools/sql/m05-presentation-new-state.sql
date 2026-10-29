-- Fixed initial M05 additions. No payloads, original paths or grant values returned.
-- Created/updated timestamps of the NEW bucket are environmental; all prior
-- buckets are preserved separately as complete row hashes by the readback.
do $m05_new_state$
declare name text;relation_name text;tables jsonb:='{}';amount bigint;checksum text;
 config jsonb;template jsonb;bucket jsonb;
begin
 foreach name in array array['eps.presentation_processing_config','eps.presentation_versions','eps.version_slides','eps.presentation_version_assets','eps.presentation_asset_grants']loop
  if to_regclass(name)is null then tables:=tables||jsonb_build_object(name,null);continue;end if;
  relation_name:=split_part(name,'.',2);
  execute format('select count(*),encode(sha256(convert_to(coalesce(string_agg(to_jsonb(r)::text,E''\n''order by to_jsonb(r)::text),''''),''UTF8'')),''hex'')from eps.%I r',relation_name)into amount,checksum;
  tables:=tables||jsonb_build_object(name,jsonb_build_object('count',amount,'sha256',checksum));
 end loop;
 if to_regclass('eps.presentation_processing_config')is not null then
  execute 'select to_jsonb(c)from eps.presentation_processing_config c where id'into config;
 end if;
 if to_regclass('eps.presentation_templates')is not null then
  select to_jsonb(t)into template from eps.presentation_templates t where key='everyone-casting'and version='1.1.0';
 end if;
 select to_jsonb(b)-array['created_at','updated_at']into bucket from storage.buckets b where id='eps-presentation-outputs';
 perform set_config('eps.presentation_release.new_state',jsonb_build_object('tables',tables,'config',config,'template',template,'bucket',bucket)::text,true);
end $m05_new_state$;
select current_setting('eps.presentation_release.new_state')::jsonb as m05_state;
