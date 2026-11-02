-- M07 additive review-link reason and existing review trace repair.
-- Local/source candidate only. Root coordinates exact canonical target admission.
set local search_path='';set local lock_timeout='3s';set local statement_timeout='30s';
do $reason40$declare item record;actual pg_proc;before jsonb;begin
 if current_user<>'postgres'or current_database()<>'postgres'
 or(select array_agg(version order by version)from supabase_migrations.schema_migrations)is distinct from array['20261028010943','20261028013324','20261028013655','20261028024205','20261028072515','20261028162702','20261028162800','20261028172320','20261028184145','20261028222030','20261029001520','20261029003941','20261029070038','20261029090500','20261029090724','20261029094600','20261029100500','20261029133455','20261029135318','20261029174841','20261029180953','20261029202629','20261029203953','20261029215218','20261030002634','20261030004643','20261030013832','20261030030717','20261030111549','20261030154824','20261031010000','20261031104603','20261031130207','20261031143711','20261031182038','20261101012057','20261101042702','20261101110939','20261101223342']::text[]
 or exists(select 1 from pg_attribute where attrelid='eps.audit_events'::regclass and attname='reason'and not attisdropped)
 then raise exception'REASON40_EXACT39_BASELINE_REQUIRED';end if;
 for item in select * from(values ('eps.review_remember(text,text,jsonb,jsonb,uuid)','b9c377129a74c237dbf5aa6db2d76d1c4170e35fac5d04a6b15003d280c0764f','eps_review_owner','["eps_review_owner=X/eps_review_owner"]'),('public.eps_revoke_review_link(uuid,jsonb,text)','ccc280d9b16642012bf3e0f781d107bdac78c1fda4009b732fe7a8e33e3be083','eps_review_owner','["eps_review_owner=X/eps_review_owner","authenticated=X/eps_review_owner"]'),('public.eps_rotate_review_link(uuid,jsonb,jsonb,text)','10fc75a60494924ea63a7b3e5a7a42a4f2a596384357af611dd78a1155394428','eps_review_owner','["eps_review_owner=X/eps_review_owner","authenticated=X/eps_review_owner"]'),('eps.review_gateway_verify(text,jsonb,jsonb)','6dcb44c5a8ed44f01528c929615c5a6232f86b38fdc3cf9ed20fcad4838742e4','eps_guest_owner','["eps_guest_owner=X/eps_guest_owner","eps_review_owner=X/eps_guest_owner"]'))v(signature,source_sha,owner_name,acl_json)loop
  select * into strict actual from pg_proc where oid=item.signature::regprocedure;
  if encode(sha256(convert_to(actual.prosrc,'UTF8')),'hex')<>item.source_sha
  or pg_get_userbyid(actual.proowner)<>item.owner_name
  or(select jsonb_agg(value order by value)from unnest(actual.proacl::text[])value)is distinct from(select jsonb_agg(value order by value)from jsonb_array_elements_text(item.acl_json::jsonb)value)
  then raise exception'REASON40_EXACT_FUNCTION_BASELINE_REQUIRED';end if;
 end loop;
 select jsonb_agg(jsonb_build_object('oid',p.oid,'owner',p.proowner,'acl',p.proacl,'security_definer',p.prosecdef,'config',p.proconfig,'language',p.prolang,'volatility',p.provolatile,'strict',p.proisstrict,'parallel',p.proparallel,'arguments',p.proargtypes::text,'result',p.prorettype)order by p.oid)into before from pg_proc p where p.oid=any(array['eps.review_remember(text,text,jsonb,jsonb,uuid)'::regprocedure::oid,'public.eps_revoke_review_link(uuid,jsonb,text)'::regprocedure::oid,'public.eps_rotate_review_link(uuid,jsonb,jsonb,text)'::regprocedure::oid,'eps.review_gateway_verify(text,jsonb,jsonb)'::regprocedure::oid]::oid[]);
 perform set_config('eps.reason40.before_function_identity',before::text,true);
end$reason40$;

-- BEGIN REASON40 FUNCTIONAL CHANGE
alter table eps.audit_events add column reason text;

CREATE OR REPLACE FUNCTION eps.review_remember(p_operation text, p_key text, p_input jsonb, p_result jsonb, p_resource uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$declare headers jsonb:='{}';request_id text;client_type text;audit_reason text;begin
 insert into eps.idempotency_records(principal_id,operation,key,request_hash,response)values(auth.uid(),'review.'||p_operation,p_key,encode(sha256(convert_to(p_input::text,'UTF8')),'hex'),p_result);
 begin headers:=coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb;exception when invalid_text_representation then headers:='{}';end;
 if jsonb_typeof(headers)is distinct from'object'then headers:='{}';end if;
 request_id:=headers->>'x-eps-request-id';if request_id is not null and request_id!~'^[A-Za-z0-9._:-]{1,128}$'then request_id:=null;end if;
 client_type:=headers->>'x-eps-client-type';if client_type is null or client_type not in('browser','api','mcp')then client_type:='api';end if;
 if p_operation in('revoke_link','rotate_link')then audit_reason:=p_input#>>'{input,reason}';end if;
 insert into eps.audit_events(principal_id,action,resource_id,request_id,client_type,reason)values(auth.uid(),'review.'||p_operation,p_resource,request_id,client_type,audit_reason);return p_result;
end$function$;

CREATE OR REPLACE FUNCTION public.eps_revoke_review_link(p_review_link_id uuid, p_input jsonb, p_idempotency_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare item eps.review_links;cached jsonb;begin
 perform eps.review_body(p_input,array['row_version','reason'],array['row_version']);
 if octet_length(p_input::text)>65536+3 or p_input?'reason'and(jsonb_typeof(p_input->'reason')not in('string','null')or octet_length(p_input->>'reason')>65536)then perform eps.fail('VALIDATION_FAILED','Provide a string or null review-link reason within the request byte limit.',400);end if;
select * into item from eps.review_links where id=p_review_link_id for update;
 if not found then perform eps.fail('RESOURCE_NOT_FOUND','Review link not found.',404);end if;perform eps.review_link_require(item.series_id,true);
 cached:=eps.review_replay('revoke_link',p_idempotency_key,jsonb_build_object('id',p_review_link_id,'input',p_input));if cached is not null then return cached;end if;
 if eps.logo_integer(p_input->'row_version',1,9007199254740991)<>item.row_version then perform eps.fail('STALE_RESOURCE_VERSION','Refresh current link settings.',409,item.row_version);end if;
 if item.revoked_at is null then update eps.review_links set revoked_at=clock_timestamp(),row_version=row_version+1,updated_at=clock_timestamp()where id=item.id returning * into item;end if;
 update eps.review_media_grants set revoked_at=coalesce(revoked_at,clock_timestamp())where review_link_id=item.id;
 return eps.review_remember('revoke_link',p_idempotency_key,jsonb_build_object('id',p_review_link_id,'input',p_input),eps.review_link_dto(item),item.id);
end$function$;

CREATE OR REPLACE FUNCTION public.eps_rotate_review_link(p_review_link_id uuid, p_input jsonb, p_credential jsonb, p_idempotency_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare item eps.review_links;cached eps.review_link_replays;headers jsonb:='{}';request_id text;client_type text;begin
 perform eps.review_body(p_input,array['row_version','reason'],array['row_version']);
 if octet_length(p_input::text)>65536+3 or p_input?'reason'and(jsonb_typeof(p_input->'reason')not in('string','null')or octet_length(p_input->>'reason')>65536)then perform eps.fail('VALIDATION_FAILED','Provide a string or null review-link reason within the request byte limit.',400);end if;
perform eps.review_credential(p_credential-'proof');
 -- Lock link before replay: every mutation uses link->replay ordering.
 select * into item from eps.review_links where id=p_review_link_id for update;if not found then perform eps.fail('RESOURCE_NOT_FOUND','Review link not found.',404);end if;perform eps.review_link_require(item.series_id,true);
 perform eps.review_credential_admit(auth.uid(),'rotate_review_link',p_review_link_id,p_input,p_idempotency_key,p_credential);
 cached:=eps.review_token_replay('rotate',p_idempotency_key,jsonb_build_object('id',p_review_link_id,'input',p_input));
 if cached.review_link_id is not null then
  if item.revoked_at is not null or item.token_generation<>cached.token_generation then perform eps.fail('TOKEN_REPLAY_EXPIRED','This token response is no longer current. Rotate explicitly.',409);end if;
  return jsonb_build_object('link',eps.review_link_dto(item),'response_encrypted',cached.response_encrypted);
 end if;
 if item.revoked_at is not null then perform eps.fail('LINK_REVOKED','Revoked links cannot be rotated.',409);end if;
 if eps.logo_integer(p_input->'row_version',1,9007199254740991)<>item.row_version then perform eps.fail('STALE_RESOURCE_VERSION','Refresh current link settings.',409,item.row_version);end if;
 update eps.review_links set token_digest=p_credential->>'token_digest',token_generation=token_generation+1,export_revision=export_revision+1,row_version=row_version+1,updated_at=clock_timestamp()where id=item.id returning * into item;
 update eps.review_media_grants set revoked_at=coalesce(revoked_at,clock_timestamp())where review_link_id=item.id;
 insert into eps.review_link_replays(principal_id,operation,key,request_hash,review_link_id,token_generation,response_encrypted,expires_at)
 values(auth.uid(),'rotate',p_idempotency_key,eps.presentation_hash(jsonb_build_object('id',p_review_link_id,'input',p_input)),item.id,item.token_generation,p_credential->>'response_encrypted',clock_timestamp()+interval'24hours');
 begin headers:=coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb;exception when invalid_text_representation then headers:='{}';end;
 if jsonb_typeof(headers)is distinct from'object'then headers:='{}';end if;
 request_id:=headers->>'x-eps-request-id';if request_id is not null and request_id!~'^[A-Za-z0-9._:-]{1,128}$'then request_id:=null;end if;
 client_type:=headers->>'x-eps-client-type';if client_type is null or client_type not in('browser','api','mcp')then client_type:='api';end if;
 insert into eps.audit_events(principal_id,action,resource_id,request_id,client_type,reason)values(auth.uid(),'review.rotate_link',item.id,request_id,client_type,p_input->>'reason');
 return jsonb_build_object('link',eps.review_link_dto(item),'response_encrypted',p_credential->>'response_encrypted');
end$function$;

CREATE OR REPLACE FUNCTION eps.review_gateway_verify(p_operation text, p_input jsonb, p_proof jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare config eps.review_gateway_config;expected bytea;provided bytea;difference integer:=0;issued bigint;now_ms bigint;payload_limit integer:=65536;begin
 select * into config from eps.review_gateway_config where id and enabled;
 if not found then perform eps.fail('REVIEW_UNAVAILABLE','Review access is unavailable.',503);end if;
 perform eps.review_body(p_proof,array['issued_at','nonce','signature'],array['issued_at','nonce','signature']);
 -- Only the fixed backend-attested rotation envelope carries an ArchiveRequest.
 -- The preceding review_body admits at most65536 canonical ArchiveRequest
 -- bytes; its two-field JSONB rendering gains at most three separator spaces.
 -- JSON string escaping uses at most six bytes per character; existing metadata
 -- bounds are key200, ciphertext16384, UUIDs36 each and digest64 characters.
 if p_operation='rotate_review_link'and jsonb_typeof(p_input)='object'then
  if not p_input?&array['actor_id','subject_id','input','idempotency_key','token_digest','response_encrypted']
  or exists(select 1 from jsonb_object_keys(p_input)k where not(k=any(array['actor_id','subject_id','input','idempotency_key','token_digest','response_encrypted'])))
  then perform eps.fail('REVIEW_UNAVAILABLE','Review access is unavailable.',404);end if;
  perform eps.review_body(p_input->'input',array['row_version','reason'],array['row_version']);
  if jsonb_typeof(p_input->'actor_id')is distinct from'string'or(p_input->>'actor_id')!~'^[a-f0-9]{8}-([a-f0-9]{4}-){3}[a-f0-9]{12}$'
  or jsonb_typeof(p_input->'subject_id')is distinct from'string'or(p_input->>'subject_id')!~'^[a-f0-9]{8}-([a-f0-9]{4}-){3}[a-f0-9]{12}$'
  or jsonb_typeof(p_input->'idempotency_key')is distinct from'string'or length(p_input->>'idempotency_key')not between 16 and 200 or(p_input->>'idempotency_key')~'[[:cntrl:]]'
  or jsonb_typeof(p_input->'token_digest')is distinct from'string'or(p_input->>'token_digest')!~'^[a-f0-9]{64}$'
  or jsonb_typeof(p_input->'response_encrypted')is distinct from'string'or length(p_input->>'response_encrypted')not between 1 and 16384
  or octet_length((p_input->'input')::text)>65536+3
  then perform eps.fail('REVIEW_UNAVAILABLE','Review access is unavailable.',404);end if;
  payload_limit:=65536+3+6*(200+16384)+36*2+64
   +octet_length(jsonb_build_object('actor_id','','subject_id','','input','null'::jsonb,'idempotency_key','','token_digest','','response_encrypted','')::text)-4;
 end if;
 if jsonb_typeof(p_input)is distinct from'object'or octet_length(p_input::text)>payload_limit or p_proof->>'issued_at'!~'^[0-9]{13}$'
 or p_proof->>'nonce'!~'^[a-f0-9]{32}$'or p_proof->>'signature'!~'^[a-f0-9]{64}$'
 then perform eps.fail('REVIEW_UNAVAILABLE','Review access is unavailable.',404);end if;
 issued:=(p_proof->>'issued_at')::bigint;now_ms:=floor(extract(epoch from clock_timestamp())*1000)::bigint;
 if issued>now_ms+30000 or issued<now_ms-60000 then perform eps.fail('REVIEW_UNAVAILABLE','Review access is unavailable.',404);end if;
 expected:=extensions.hmac(convert_to(eps.cast_canonical(jsonb_build_object('operation',p_operation,'input',p_input,'issued_at',issued,'nonce',p_proof->>'nonce')),'UTF8'),config.backend_key,'sha256');provided:=decode(p_proof->>'signature','hex');
 for index_value in 0..31 loop difference:=difference|(get_byte(expected,index_value)#get_byte(provided,index_value));end loop;
 if difference<>0 then perform eps.fail('REVIEW_UNAVAILABLE','Review access is unavailable.',404);end if;
 delete from eps.review_gateway_nonces where expires_at<=clock_timestamp();
 begin insert into eps.review_gateway_nonces(nonce,expires_at)values(p_proof->>'nonce',clock_timestamp()+interval'120seconds');exception when unique_violation then perform eps.fail('REVIEW_UNAVAILABLE','Review access is unavailable.',404);end;
end$function$;

-- END REASON40 FUNCTIONAL CHANGE
do $reason40$declare actual jsonb;begin
 select jsonb_agg(jsonb_build_object('oid',p.oid,'owner',p.proowner,'acl',p.proacl,'security_definer',p.prosecdef,'config',p.proconfig,'language',p.prolang,'volatility',p.provolatile,'strict',p.proisstrict,'parallel',p.proparallel,'arguments',p.proargtypes::text,'result',p.prorettype)order by p.oid)into actual from pg_proc p where p.oid=any(array['eps.review_remember(text,text,jsonb,jsonb,uuid)'::regprocedure::oid,'public.eps_revoke_review_link(uuid,jsonb,text)'::regprocedure::oid,'public.eps_rotate_review_link(uuid,jsonb,jsonb,text)'::regprocedure::oid,'eps.review_gateway_verify(text,jsonb,jsonb)'::regprocedure::oid]::oid[]);
 if actual is distinct from current_setting('eps.reason40.before_function_identity')::jsonb then raise exception'REASON40_FUNCTION_IDENTITY_CHANGED';end if;
 if exists(select 1 from eps.audit_events where reason is not null)then raise exception'REASON40_HISTORICAL_AUDIT_CHANGED';end if;
end$reason40$;
