-- Credentials remain raw only in the HTTP server/browser, never SQL parameters.
-- Digest possession alone is insufficient: all operations require backend HMAC.
create function eps.guest_cleanup_credentials()returns void language plpgsql volatile security definer set search_path=''as $$begin
 update eps.review_link_replays set response_encrypted=null where expires_at<=clock_timestamp()and response_encrypted is not null;
 delete from eps.review_gateway_nonces where expires_at<=clock_timestamp();
 delete from eps.review_gateway_rates where window_start<clock_timestamp()-interval'2minutes';
 delete from eps.guest_asset_grants where expires_at<=clock_timestamp();
end$$;
create function eps.review_gateway_verify(p_operation text,p_input jsonb,p_proof jsonb)returns void language plpgsql volatile security invoker set search_path=''as $$
declare config eps.review_gateway_config;expected bytea;provided bytea;difference integer:=0;issued bigint;now_ms bigint;begin
 select * into config from eps.review_gateway_config where id and enabled;
 if not found then perform eps.fail('REVIEW_UNAVAILABLE','Review access is unavailable.',503);end if;
 perform eps.review_body(p_proof,array['issued_at','nonce','signature'],array['issued_at','nonce','signature']);
 if jsonb_typeof(p_input)is distinct from'object'or octet_length(p_input::text)>65536 or p_proof->>'issued_at'!~'^[0-9]{13}$'
 or p_proof->>'nonce'!~'^[a-f0-9]{32}$'or p_proof->>'signature'!~'^[a-f0-9]{64}$'
 then perform eps.fail('REVIEW_UNAVAILABLE','Review access is unavailable.',404);end if;
 issued:=(p_proof->>'issued_at')::bigint;now_ms:=floor(extract(epoch from clock_timestamp())*1000)::bigint;
 if issued>now_ms+30000 or issued<now_ms-60000 then perform eps.fail('REVIEW_UNAVAILABLE','Review access is unavailable.',404);end if;
 expected:=extensions.hmac(convert_to(eps.cast_canonical(jsonb_build_object('operation',p_operation,'input',p_input,'issued_at',issued,'nonce',p_proof->>'nonce')),'UTF8'),config.backend_key,'sha256');provided:=decode(p_proof->>'signature','hex');
 for index_value in 0..31 loop difference:=difference|(get_byte(expected,index_value)#get_byte(provided,index_value));end loop;
 if difference<>0 then perform eps.fail('REVIEW_UNAVAILABLE','Review access is unavailable.',404);end if;
 delete from eps.review_gateway_nonces where expires_at<=clock_timestamp();
 begin insert into eps.review_gateway_nonces(nonce,expires_at)values(p_proof->>'nonce',clock_timestamp()+interval'120seconds');exception when unique_violation then perform eps.fail('REVIEW_UNAVAILABLE','Review access is unavailable.',404);end;
end$$;
create function eps.review_gateway_rate(p_key text,p_maximum integer)returns void language plpgsql volatile security invoker set search_path=''as $$declare count_value integer;begin
 delete from eps.review_gateway_rates where window_start<clock_timestamp()-interval'2minutes';
 insert into eps.review_gateway_rates(key,window_start,hits)values(p_key,date_trunc('minute',clock_timestamp()),1)
 on conflict(key)do update set window_start=excluded.window_start,hits=case when review_gateway_rates.window_start=excluded.window_start then review_gateway_rates.hits+1 else 1 end returning hits into count_value;
 if count_value>p_maximum then perform eps.fail('RATE_LIMITED','Please wait before trying again.',429);end if;
end$$;
create function eps.guest_link_for(p_session eps.guest_sessions)returns eps.review_links language plpgsql volatile security invoker set search_path=''as $$declare item eps.review_links;begin
 select * into item from eps.review_links where id=p_session.review_link_id;
 if not found or not eps.guest_link_live(item)or p_session.id is null or p_session.expires_at<=clock_timestamp()or item.token_generation<>p_session.link_token_generation
 or not exists(select 1 from eps.presentation_series s where s.id=item.series_id and s.audience_snapshot->>'scope'='external')
 then perform eps.fail('REVIEW_UNAVAILABLE','Review access is unavailable.',404);end if;return item;
end$$;
create function eps.guest_current(p_digest text)returns eps.guest_sessions language plpgsql volatile security invoker set search_path=''as $$declare item eps.guest_sessions;begin
 if p_digest is null or p_digest!~'^[a-f0-9]{64}$'then perform eps.fail('REVIEW_UNAVAILABLE','Review access is unavailable.',404);end if;
 select * into item from eps.guest_sessions where session_token_digest=p_digest;if not found then perform eps.fail('REVIEW_UNAVAILABLE','Review access is unavailable.',404);end if;
 perform eps.guest_link_for(item);return item;
end$$;
create function eps.guest_access_dto(p_session eps.guest_sessions,p_link eps.review_links)returns jsonb language sql stable security invoker set search_path=''as $$
 select jsonb_build_object('expires_at',eps.presentation_time(least(p_session.expires_at,p_link.expires_at)),'series_id',p_link.series_id,'version_id',(select latest_ready_version_id from eps.presentation_series where id=p_link.series_id),'download_enabled',p_link.download_enabled,'display_name',p_session.display_name,'guest_session_id',p_session.id)
$$;
create function eps.guest_version_dto(p_version eps.presentation_versions,p_link eps.review_links)returns jsonb language sql stable security invoker set search_path=''as $$
 select jsonb_build_object('id',p_version.id,'series_id',p_version.series_id,'version_no',p_version.version_number,'title',p_version.snapshot#>>'{cover,title}','output_type',p_version.snapshot#>>'{cover,output_type}','status','ready','slides',p_version.manifest->'slides','created_at',p_version.snapshot->>'created_at','download_enabled',p_link.download_enabled,
 'cover',jsonb_build_object('project_name',p_version.snapshot#>>'{cover,project_name}','client_name',p_version.snapshot#>'{cover,client_name}','title',p_version.snapshot#>>'{cover,title}','output_type',p_version.snapshot#>>'{cover,output_type}','logo_asset_id',p_version.snapshot#>'{cover,logo_asset_id}','logo_placement',p_version.snapshot#>>'{cover,logo_placement}'),
 'template_version',p_version.snapshot#>>'{template,version}','template_content_hash',p_version.snapshot#>>'{template,content_sha256}')
$$;
create function eps.guest_replay(p_session uuid,p_operation text,p_key text,p_input jsonb)returns jsonb language plpgsql volatile security invoker set search_path=''as $$declare item eps.guest_idempotency;begin
 if p_key is null or length(p_key)not between 16 and 200 or p_key~'[[:cntrl:]]'then perform eps.fail('VALIDATION_FAILED','Provide a stable Idempotency-Key.',400);end if;
 perform pg_advisory_xact_lock(hashtextextended(p_session::text||':guest:'||p_operation||':'||p_key,0));
 select * into item from eps.guest_idempotency where session_id=p_session and operation=p_operation and key=p_key;
 if found and item.request_hash<>eps.presentation_hash(p_input)then perform eps.fail('IDEMPOTENCY_KEY_REUSED','This request key has different content.',409);end if;return item.response;
end$$;
create function public.eps_guest_operation(p_operation text,p_input jsonb,p_proof jsonb)returns jsonb language plpgsql volatile security definer set search_path=''as $$
declare session eps.guest_sessions;link eps.review_links;version eps.presentation_versions;result jsonb;cached jsonb;options jsonb;version_id uuid;comment_version uuid;begin
 perform eps.review_gateway_verify(p_operation,p_input,p_proof);
 perform eps.guest_cleanup_credentials();
 if p_operation='open'then
  perform eps.review_body(p_input,array['token_digest','session_digest'],array['token_digest','session_digest']);
  if p_input->>'token_digest'!~'^[a-f0-9]{64}$'or p_input->>'session_digest'!~'^[a-f0-9]{64}$'then perform eps.fail('REVIEW_UNAVAILABLE','Review access is unavailable.',404);end if;
  select * into link from eps.review_links where token_digest=p_input->>'token_digest'for share;
  if not found or not eps.guest_link_live(link)or not exists(select 1 from eps.presentation_series s where s.id=link.series_id and s.audience_snapshot->>'scope'='external')then perform eps.fail('REVIEW_UNAVAILABLE','Review access is unavailable.',404);end if;
  perform eps.review_gateway_rate('open:'||link.id::text,120);
  insert into eps.guest_sessions(review_link_id,session_token_digest,link_token_generation,expires_at)
  values(link.id,p_input->>'session_digest',link.token_generation,least(link.expires_at,clock_timestamp()+interval'1hour'))returning * into session;
  return eps.guest_access_dto(session,link);
 elsif p_operation='grant_asset'then
  perform eps.review_body(p_input,array['media_grant_digest','version_id','asset_id'],array['media_grant_digest','version_id','asset_id']);
  return eps.guest_asset_issue(null,p_input->>'media_grant_digest',eps.casting_uuid(p_input->'version_id'),eps.casting_uuid(p_input->'asset_id'),'video',null);
 end if;
 session:=eps.guest_current(p_input->>'session_digest');link:=eps.guest_link_for(session);perform eps.review_gateway_rate('session:'||session.id::text,240);
 if p_operation='session'then
  perform eps.review_body(p_input,array['session_digest'],array['session_digest']);return eps.guest_access_dto(session,link);
 elsif p_operation='identify'then
  perform eps.review_body(p_input,array['session_digest','display_name','company','idempotency_key'],array['session_digest','display_name']);
  if jsonb_typeof(p_input->'display_name')is distinct from'string'or length(btrim(p_input->>'display_name'))not between 1 and 120
  or p_input?'company'and p_input->'company'<>'null'and(jsonb_typeof(p_input->'company')is distinct from'string'or length(p_input->>'company')>160)then perform eps.fail('VALIDATION_FAILED','Enter a name and optional company.',400);end if;
  if p_input?'idempotency_key'then cached:=eps.guest_replay(session.id,p_operation,p_input->>'idempotency_key',p_input-array['session_digest','idempotency_key']);if cached is not null then return cached;end if;end if;
  update eps.guest_sessions set display_name=btrim(p_input->>'display_name'),company=nullif(btrim(p_input->>'company'),''),last_seen_at=clock_timestamp()where id=session.id returning * into session;
  result:=eps.guest_access_dto(session,link);
  if p_input?'idempotency_key'then insert into eps.guest_idempotency(session_id,operation,key,request_hash,response)values(session.id,p_operation,p_input->>'idempotency_key',eps.presentation_hash(p_input-array['session_digest','idempotency_key']),result);end if;return result;
 elsif p_operation in('get_current_version','get_version')then
  perform eps.review_body(p_input,array['session_digest','version_id'],array['session_digest']);
  if p_operation='get_current_version'then select latest_ready_version_id into version_id from eps.presentation_series where id=link.series_id;if version_id is null then return null;end if;
  else version_id:=eps.casting_uuid(p_input->'version_id');end if;
  version:=eps.feedback_version(version_id,link.series_id);return eps.guest_version_dto(version,link);
 elsif p_operation='list_feedback'then
  perform eps.review_body(p_input,array['session_digest','version_id','options'],array['session_digest','version_id']);version:=eps.feedback_version(eps.casting_uuid(p_input->'version_id'),link.series_id);
  return eps.feedback_page(version.id,true,coalesce(p_input->'options','{}'));
 elsif p_operation in('create_comment','update_comment','set_preference')then
  perform eps.review_gateway_rate('feedback:'||session.id::text,60);
  perform eps.review_body(p_input,array['session_digest','version_id','comment_id','input','idempotency_key'],array['session_digest','input']);
  if p_operation='update_comment'then
   perform eps.review_body(p_input->'input',array['row_version','body'],array['row_version','body']);
   select c.version_id into comment_version from eps.feedback_comments c where c.id=eps.casting_uuid(p_input->'comment_id')and c.guest_session_id=session.id and c.visibility='external'and c.deleted_at is null;
   if not found then perform eps.fail('RESOURCE_NOT_FOUND','Comment not found.',404);end if;version:=eps.feedback_version(comment_version,link.series_id);
   if p_input?'idempotency_key'then cached:=eps.guest_replay(session.id,p_operation,p_input->>'idempotency_key',p_input-array['session_digest','idempotency_key']);if cached is not null then return cached;end if;end if;
   result:=eps.feedback_mutate(session.id,null,version.id,p_operation,(p_input->'input')||jsonb_build_object('comment_id',p_input->'comment_id'));
   if p_input?'idempotency_key'then insert into eps.guest_idempotency(session_id,operation,key,request_hash,response)values(session.id,p_operation,p_input->>'idempotency_key',eps.presentation_hash(p_input-array['session_digest','idempotency_key']),result);end if;return result;
  end if;
  version:=eps.feedback_version(eps.casting_uuid(p_input->'version_id'),link.series_id);
  if p_operation='create_comment'then perform eps.review_body(p_input->'input',array['version_slide_id','body','parent_comment_id'],array['version_slide_id','body']);
  else perform eps.review_body(p_input->'input',array['version_slide_id','value','row_version'],array['version_slide_id','value']);end if;
  cached:=eps.guest_replay(session.id,p_operation,p_input->>'idempotency_key',p_input-array['session_digest','idempotency_key']);if cached is not null then return cached;end if;
  result:=eps.feedback_mutate(session.id,null,version.id,p_operation,p_input->'input');
  insert into eps.guest_idempotency(session_id,operation,key,request_hash,response)values(session.id,p_operation,p_input->>'idempotency_key',eps.presentation_hash(p_input-array['session_digest','idempotency_key']),result);return result;
 elsif p_operation='get_asset'then
  perform eps.review_body(p_input,array['session_digest','version_id','asset_id','purpose'],array['session_digest','version_id','asset_id','purpose']);
  return eps.guest_asset_issue(session.id,null,eps.casting_uuid(p_input->'version_id'),eps.casting_uuid(p_input->'asset_id'),p_input->>'purpose',null);
 elsif p_operation='prepare_export'then
  perform eps.review_body(p_input,array['session_digest','version_id','idempotency_key'],array['session_digest','version_id','idempotency_key']);
  version:=eps.feedback_version(eps.casting_uuid(p_input->'version_id'),link.series_id);
  if not link.download_enabled then perform eps.fail('DOWNLOAD_DISABLED','PDF downloads are disabled for this link.',403);end if;
  cached:=eps.guest_replay(session.id,p_operation,p_input->>'idempotency_key',p_input-array['session_digest','idempotency_key']);if cached is not null then return cached;end if;
  result:=eps.guest_prepare_export(link.id,version.id,p_input->>'idempotency_key',session.id);
  insert into eps.guest_idempotency(session_id,operation,key,request_hash,response)values(session.id,p_operation,p_input->>'idempotency_key',eps.presentation_hash(p_input-array['session_digest','idempotency_key']),result);return result;
 elsif p_operation in('get_export','get_export_asset')then
  perform eps.review_body(p_input,array['session_digest','export_id'],array['session_digest','export_id']);
  return eps.guest_export_access(session.id,eps.casting_uuid(p_input->'export_id'),p_operation='get_export_asset');
 end if;perform eps.fail('VALIDATION_FAILED','Unsupported review operation.',400);return null;
end$$;
