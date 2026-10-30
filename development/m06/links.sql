-- Internal management stays under the existing verified acting-user role.
create function eps.review_link_scope(p_series uuid,p_write boolean default false)returns boolean language sql stable security invoker set search_path=''as $$
 select exists(select 1 from eps.presentation_series s where s.id=p_series and eps.presentation_scope(s.workspace_id)
 and(not p_write or eps.project_scope((select project_id from eps.workspaces where id=s.workspace_id),true)and eps.has_capability('review_links.manage')and eps.has_capability('workspaces.write')))
$$;
grant select,insert,update on eps.review_links to eps_review_owner;
create policy m06_internal_link_read on eps.review_links for select to eps_review_owner using(eps.review_link_scope(series_id));
create policy m06_internal_link_insert on eps.review_links for insert to eps_review_owner with check(eps.review_link_scope(series_id,true)and created_by=auth.uid());
create policy m06_internal_link_update on eps.review_links for update to eps_review_owner using(eps.review_link_scope(series_id,true))with check(eps.review_link_scope(series_id,true));
grant select,insert,update on eps.review_link_replays to eps_review_owner;
create policy m06_internal_link_replay on eps.review_link_replays for all to eps_review_owner using(principal_id=auth.uid())with check(principal_id=auth.uid());
grant select,update on eps.review_media_grants to eps_review_owner;
create policy m06_internal_media_grants on eps.review_media_grants for all to eps_review_owner using(exists(select 1 from eps.review_links l where l.id=review_link_id and eps.review_link_scope(l.series_id,true)))with check(exists(select 1 from eps.review_links l where l.id=review_link_id and eps.review_link_scope(l.series_id,true)));
grant select,update on eps.presentation_exports to eps_review_owner;
create policy m06_internal_exports on eps.presentation_exports for all to eps_review_owner using(exists(select 1 from eps.review_links l where l.id=review_link_id and eps.review_link_scope(l.series_id)))with check(exists(select 1 from eps.review_links l where l.id=review_link_id and eps.review_link_scope(l.series_id,true)));

create function eps.review_link_require(p_series uuid,p_write boolean default false)returns void language plpgsql stable security invoker set search_path=''as $$begin
 perform eps.require_capability('workspaces.read');if not eps.review_link_scope(p_series,p_write)then perform eps.fail('RESOURCE_NOT_FOUND','Presentation series not found.',404);end if;
end$$;
create function eps.review_expiry(p_value jsonb)returns timestamptz language plpgsql immutable security invoker set search_path=''as $$declare result timestamptz;begin
 if jsonb_typeof(p_value)is distinct from'string'or length(p_value#>>'{}')>40 then perform eps.fail('VALIDATION_FAILED','Provide a finite ISO expiry.',400);end if;
 begin result:=(p_value#>>'{}')::timestamptz;exception when others then perform eps.fail('VALIDATION_FAILED','Provide a finite ISO expiry.',400);end;
 if not isfinite(result)then perform eps.fail('VALIDATION_FAILED','Provide a finite ISO expiry.',400);end if;return result;
end$$;
create function eps.review_credential(p_input jsonb)returns void language plpgsql immutable security invoker set search_path=''as $$begin
 perform eps.review_body(p_input,array['token_digest','response_encrypted'],array['token_digest','response_encrypted']);
 if jsonb_typeof(p_input->'token_digest')is distinct from'string'or(p_input->>'token_digest')!~'^[a-f0-9]{64}$'
 or jsonb_typeof(p_input->'response_encrypted')is distinct from'string'or length(p_input->>'response_encrypted')not between 1 and 16384
 then perform eps.fail('VALIDATION_FAILED','Invalid protected credential response.',400);end if;
end$$;
create function eps.review_token_replay(p_operation text,p_key text,p_input jsonb)returns eps.review_link_replays language plpgsql volatile security invoker set search_path=''as $$declare item eps.review_link_replays;begin
 if p_key is null or length(p_key)not between 16 and 200 or p_key~'[[:cntrl:]]'then perform eps.fail('VALIDATION_FAILED','Provide a stable Idempotency-Key.',400);end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':review-token:'||p_operation||':'||p_key,0));
 update eps.review_link_replays set response_encrypted=null where principal_id=auth.uid()and expires_at<=clock_timestamp()and response_encrypted is not null;
 select * into item from eps.review_link_replays where principal_id=auth.uid()and operation=p_operation and key=p_key;
 if found and item.request_hash<>eps.presentation_hash(p_input)then perform eps.fail('IDEMPOTENCY_KEY_REUSED','This request key has different content.',409);end if;
 if found and(item.response_encrypted is null or item.expires_at<=clock_timestamp())then perform eps.fail('TOKEN_REPLAY_EXPIRED','The protected response expired. Rotate the link explicitly.',409);end if;
 return item;
end$$;
create function public.eps_list_review_links(p_options jsonb default'{}')returns jsonb language plpgsql stable security definer set search_path=''as $$
declare workspace uuid;maximum integer;cursor_id uuid;items jsonb;last_id uuid;begin
 perform eps.review_body(p_options,array['workspace_id','cursor','limit']);if p_options?'workspace_id'then workspace:=eps.casting_uuid(p_options->'workspace_id');end if;
 perform eps.require_capability('review_links.manage');if workspace is not null and not eps.presentation_scope(workspace)then perform eps.fail('RESOURCE_NOT_FOUND','Workspace not found.',404);end if;
 maximum:=case when p_options?'limit'then eps.logo_integer(p_options->'limit',1,100)else 25 end;
 if p_options?'cursor'then cursor_id:=eps.casting_uuid(p_options->'cursor');end if;
 select coalesce(jsonb_agg(eps.review_link_dto(l)order by l.id),'[]'),max(l.id::text)::uuid into items,last_id from
 (select l.* from eps.review_links l join eps.presentation_series s on s.id=l.series_id where(workspace is null or s.workspace_id=workspace)and(cursor_id is null or l.id>cursor_id)order by l.id limit maximum)l;
 return jsonb_build_object('data',items,'page',jsonb_build_object('next_cursor',case when last_id is not null and exists(select 1 from eps.review_links l join eps.presentation_series s on s.id=l.series_id where(workspace is null or s.workspace_id=workspace)and l.id>last_id)then last_id::text else null end));
end$$;
create function public.eps_create_review_link(p_series_id uuid,p_input jsonb,p_credential jsonb,p_idempotency_key text)returns jsonb language plpgsql volatile security definer set search_path=''as $$
declare item eps.review_links;cached eps.review_link_replays;series eps.presentation_series;expiry timestamptz;begin
 perform eps.review_body(p_input,array['label','expires_at','download_enabled']);perform eps.review_credential(p_credential);perform eps.review_link_require(p_series_id,true);
 cached:=eps.review_token_replay('create',p_idempotency_key,jsonb_build_object('series_id',p_series_id,'input',p_input));
 if cached.review_link_id is not null then
  select * into item from eps.review_links where id=cached.review_link_id;perform eps.review_link_require(item.series_id,true);
  if item.revoked_at is not null or item.token_generation<>cached.token_generation then perform eps.fail('TOKEN_REPLAY_EXPIRED','This token response is no longer current. Rotate explicitly.',409);end if;
  return jsonb_build_object('link',eps.review_link_dto(item),'response_encrypted',cached.response_encrypted);
 end if;
 select * into series from eps.presentation_series where id=p_series_id for share;
 if not found or series.archived or series.audience_snapshot->>'scope'<>'external'then perform eps.fail('EXTERNAL_SERIES_REQUIRED','Only an active external audience series can be shared.',422);end if;
 if p_input?'label'and(jsonb_typeof(p_input->'label')is distinct from'string'or length(p_input->>'label')>160)
 or p_input?'download_enabled'and jsonb_typeof(p_input->'download_enabled')is distinct from'boolean'then perform eps.fail('VALIDATION_FAILED','Invalid link settings.',400);end if;
 expiry:=case when p_input?'expires_at'then eps.review_expiry(p_input->'expires_at')else clock_timestamp()+interval'30days'end;
 if expiry<=clock_timestamp()then perform eps.fail('VALIDATION_FAILED','New link expiry must be in the future.',400);end if;
 insert into eps.review_links(series_id,label,token_digest,expires_at,download_enabled,created_by)
 values(p_series_id,coalesce(p_input->>'label',''),p_credential->>'token_digest',expiry,coalesce((p_input->>'download_enabled')::boolean,true),auth.uid())returning * into item;
 insert into eps.review_link_replays(principal_id,operation,key,request_hash,review_link_id,token_generation,response_encrypted,expires_at)
 values(auth.uid(),'create',p_idempotency_key,eps.presentation_hash(jsonb_build_object('series_id',p_series_id,'input',p_input)),item.id,item.token_generation,p_credential->>'response_encrypted',clock_timestamp()+interval'24hours');
 insert into eps.audit_events(principal_id,action,resource_id)values(auth.uid(),'review.create_link',item.id);
 return jsonb_build_object('link',eps.review_link_dto(item),'response_encrypted',p_credential->>'response_encrypted');
end$$;
create function public.eps_update_review_link(p_review_link_id uuid,p_input jsonb,p_idempotency_key text default null)returns jsonb language plpgsql volatile security definer set search_path=''as $$declare item eps.review_links;expiry timestamptz;cached jsonb;result jsonb;request jsonb:=jsonb_build_object('id',p_review_link_id,'input',p_input);begin
 perform eps.review_body(p_input,array['row_version','label','expires_at','download_enabled'],array['row_version']);
 select * into item from eps.review_links where id=p_review_link_id for update;if not found then perform eps.fail('RESOURCE_NOT_FOUND','Review link not found.',404);end if;perform eps.review_link_require(item.series_id,true);
 if p_idempotency_key is not null then cached:=eps.review_replay('update_link',p_idempotency_key,request);if cached is not null then return cached;end if;end if;
 if eps.logo_integer(p_input->'row_version',1,9007199254740991)<>item.row_version then perform eps.fail('STALE_RESOURCE_VERSION','Refresh current link settings.',409,item.row_version);end if;
 if item.revoked_at is not null then perform eps.fail('LINK_REVOKED','Revoked links cannot be restored.',409);end if;
 if p_input?'label'and(jsonb_typeof(p_input->'label')is distinct from'string'or length(p_input->>'label')>160)
 or p_input?'download_enabled'and jsonb_typeof(p_input->'download_enabled')is distinct from'boolean'then perform eps.fail('VALIDATION_FAILED','Invalid link settings.',400);end if;
 expiry:=case when p_input?'expires_at'then eps.review_expiry(p_input->'expires_at')else item.expires_at end;
 update eps.review_links set label=coalesce(p_input->>'label',label),expires_at=expiry,download_enabled=coalesce((p_input->>'download_enabled')::boolean,download_enabled),row_version=row_version+1,updated_at=clock_timestamp()where id=item.id returning * into item;
 if p_input?'expires_at'then update eps.review_media_grants set expires_at=expiry where review_link_id=item.id and revoked_at is null;end if;
 result:=eps.review_link_dto(item);if p_idempotency_key is not null then return eps.review_remember('update_link',p_idempotency_key,request,result,item.id);end if;
 insert into eps.audit_events(principal_id,action,resource_id)values(auth.uid(),'review.update_link',item.id);return result;
end$$;
create function public.eps_revoke_review_link(p_review_link_id uuid,p_input jsonb,p_idempotency_key text)returns jsonb language plpgsql volatile security definer set search_path=''as $$declare item eps.review_links;cached jsonb;begin
 perform eps.review_body(p_input,array['row_version'],array['row_version']);select * into item from eps.review_links where id=p_review_link_id for update;
 if not found then perform eps.fail('RESOURCE_NOT_FOUND','Review link not found.',404);end if;perform eps.review_link_require(item.series_id,true);
 cached:=eps.review_replay('revoke_link',p_idempotency_key,jsonb_build_object('id',p_review_link_id,'input',p_input));if cached is not null then return cached;end if;
 if eps.logo_integer(p_input->'row_version',1,9007199254740991)<>item.row_version then perform eps.fail('STALE_RESOURCE_VERSION','Refresh current link settings.',409,item.row_version);end if;
 if item.revoked_at is null then update eps.review_links set revoked_at=clock_timestamp(),row_version=row_version+1,updated_at=clock_timestamp()where id=item.id returning * into item;end if;
 update eps.review_media_grants set revoked_at=coalesce(revoked_at,clock_timestamp())where review_link_id=item.id;
 return eps.review_remember('revoke_link',p_idempotency_key,jsonb_build_object('id',p_review_link_id,'input',p_input),eps.review_link_dto(item),item.id);
end$$;
create function public.eps_rotate_review_link(p_review_link_id uuid,p_input jsonb,p_credential jsonb,p_idempotency_key text)returns jsonb language plpgsql volatile security definer set search_path=''as $$declare item eps.review_links;cached eps.review_link_replays;begin
 perform eps.review_body(p_input,array['row_version'],array['row_version']);perform eps.review_credential(p_credential);
 -- Lock link before replay: every mutation uses link->replay ordering.
 select * into item from eps.review_links where id=p_review_link_id for update;if not found then perform eps.fail('RESOURCE_NOT_FOUND','Review link not found.',404);end if;perform eps.review_link_require(item.series_id,true);
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
 insert into eps.audit_events(principal_id,action,resource_id)values(auth.uid(),'review.rotate_link',item.id);
 return jsonb_build_object('link',eps.review_link_dto(item),'response_encrypted',p_credential->>'response_encrypted');
end$$;
