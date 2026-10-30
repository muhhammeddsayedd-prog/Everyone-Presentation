-- Dynamic relation discovery permits an exact reviewed24 preflight. Key bytes
-- are never projected, hashed, serialized or placed in a derived checksum.
do $m06_state$
declare name text;metadata jsonb;tables jsonb:='{}';config jsonb;begin
 foreach name in array array['review_gateway_config','review_gateway_nonces','review_gateway_rates','review_links','review_link_replays','guest_sessions','feedback_comments','feedback_preferences','presentation_exports','review_media_grants','guest_asset_grants','guest_idempotency']loop
  if to_regclass('eps.'||name)is null then metadata:=null;else execute format('select jsonb_build_object(''count'',count(*))from eps.%I',name)into metadata;end if;
  tables:=tables||jsonb_build_object(name,metadata);
 end loop;
 if to_regclass('eps.review_gateway_config')is not null then
  execute 'select jsonb_build_object(''enabled'',enabled,''key_present'',backend_key is not null,''key_bytes'',case when backend_key is null then null else octet_length(backend_key)end,''replay_ttl_seconds'',replay_ttl_seconds,''session_ttl_seconds'',session_ttl_seconds)from eps.review_gateway_config where id'into config;
 end if;
 perform set_config('eps.m06_readback.new_state',jsonb_build_object('tables',tables,'config',config)::text,true);
end$m06_state$;
