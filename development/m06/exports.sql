-- Preparation is a canonical transaction; native work remains outside it.
grant select on eps.workspaces to eps_guest_owner;
grant update(id)on eps.workspaces to eps_guest_owner;
create policy m06_export_workspace_read on eps.workspaces for select to eps_guest_owner using(true);
create policy m06_export_workspace_lock on eps.workspaces for update to eps_guest_owner using(true)with check(false);
create policy m06_export_workspace_no_write on eps.workspaces as restrictive for update to eps_guest_owner using(true)with check(false);
grant select,insert on eps.jobs,eps.outbox_events to eps_guest_owner;
create policy m06_export_jobs_read on eps.jobs for select to eps_guest_owner using(kind='presentation_export');
create policy m06_export_jobs_insert on eps.jobs for insert to eps_guest_owner with check(kind='presentation_export'and status='queued'and stage='render_export'and attempt=0 and dispatch_generation=1 and current_attempt_id is null and lease_token_digest is null
 and input_hash_version='eps.presentation-export-input.cast-canonical.v1'and exists(select 1 from eps.review_links l join eps.presentation_series s on s.id=l.series_id where l.id::text=input->>'review_link_id'and s.workspace_id=workspace_id and l.created_by=requested_by and l.download_enabled and eps.guest_link_live(l)));
create policy m06_export_outbox_read on eps.outbox_events for select to eps_guest_owner using(exists(select 1 from eps.jobs j where j.id=job_id and j.kind='presentation_export'));
create policy m06_export_outbox_insert on eps.outbox_events for insert to eps_guest_owner with check(exists(select 1 from eps.jobs j where j.id=job_id and j.kind='presentation_export'and j.status='queued'and j.stage=outbox_events.stage and j.input_hash=outbox_events.input_hash and j.dispatch_generation=outbox_events.dispatch_generation));
create function eps.guest_prepare_export(p_link_id uuid,p_version_id uuid,p_key text,p_session uuid default null)returns jsonb language plpgsql volatile security definer set search_path=''as $$
declare link eps.review_links;version eps.presentation_versions;existing eps.presentation_exports;job_id uuid:=gen_random_uuid();export_id uuid:=gen_random_uuid();job_input jsonb;input_hash text;workspace uuid;begin
 if p_key is null or length(p_key)not between 16 and 200 then perform eps.fail('VALIDATION_FAILED','Provide a stable Idempotency-Key.',400);end if;
 select v.workspace_id into workspace from eps.presentation_versions v where v.id=p_version_id;
 if workspace is null then perform eps.fail('RESOURCE_NOT_FOUND','Shared version not found.',404);end if;
 perform 1 from eps.workspaces where id=workspace for update;
 select * into link from eps.review_links where id=p_link_id for update;
 if not found or not eps.guest_link_live(link)then perform eps.fail('REVIEW_UNAVAILABLE','Review access is unavailable.',404);end if;
 if not link.download_enabled then perform eps.fail('DOWNLOAD_DISABLED','PDF downloads are disabled for this link.',403);end if;
 version:=eps.feedback_version(p_version_id,link.series_id);
 if p_session is not null and not exists(select 1 from eps.guest_sessions s where s.id=p_session and s.review_link_id=link.id and s.link_token_generation=link.token_generation and s.expires_at>clock_timestamp())then perform eps.fail('REVIEW_UNAVAILABLE','Review access is unavailable.',404);end if;
 select * into existing from eps.presentation_exports where version_id=version.id and review_link_id=link.id and template_version=version.snapshot#>>'{template,version}'and export_revision=link.export_revision for update;
 if found then
  if existing.status='ready'and not exists(select 1 from eps.review_media_grants g where g.id=existing.media_grant_id and g.revoked_at is null and g.parent_token_generation=link.token_generation and g.expires_at>clock_timestamp())then perform eps.fail('EXPORT_STALE','This export requires authorized regeneration.',409);end if;
  return jsonb_build_object('export',eps.presentation_export_dto(existing),'job_id',case when existing.status='ready'then null else existing.job_id end,'cached',existing.status='ready');
 end if;
 if not exists(select 1 from eps.presentation_processing_config where id and enabled)then perform eps.fail('PRESENTATION_PROCESSING_UNAVAILABLE','PDF rendering is unavailable.',503);end if;
 job_input:=jsonb_build_object('schema_version','1.0','workspace_id',version.workspace_id,'series_id',version.series_id,'version_id',version.id,'export_id',export_id,'review_link_id',link.id,'export_revision',link.export_revision,'token_generation',link.token_generation,'snapshot_sha256',version.snapshot_sha256,'manifest_sha256',version.manifest_sha256,'inventory_sha256',version.inventory_sha256,'configuration',version.snapshot->'render_configuration');input_hash:=eps.presentation_hash(job_input);
 insert into eps.jobs(id,workspace_id,requested_by,kind,resource_id,input,input_hash,input_hash_version,dedupe_key,stage,correlation_id)
 values(job_id,version.workspace_id,link.created_by,'presentation_export',export_id,job_input,input_hash,'eps.presentation-export-input.cast-canonical.v1',encode(sha256(convert_to('presentation_export:'||version.id||':'||link.id||':'||link.export_revision,'UTF8')),'hex'),'render_export',job_id::text);
 insert into eps.presentation_exports(id,version_id,review_link_id,template_version,export_revision,parent_token_generation,job_id)
 values(export_id,version.id,link.id,version.snapshot#>>'{template,version}',link.export_revision,link.token_generation,job_id)returning * into existing;
 insert into eps.outbox_events(job_id,stage,input_hash,dispatch_generation,dedupe_key,available_at)values(job_id,'render_export',input_hash,1,job_id::text||':1',clock_timestamp());
 return jsonb_build_object('export',eps.presentation_export_dto(existing),'job_id',job_id,'cached',false);
end$$;
create function public.eps_prepare_pdf_export(p_input jsonb,p_idempotency_key text)returns jsonb language plpgsql volatile security definer set search_path=''as $$declare link eps.review_links;cached jsonb;result jsonb;begin
 perform eps.review_body(p_input,array['version_id','review_link_id'],array['version_id','review_link_id']);
 select * into link from eps.review_links where id=eps.casting_uuid(p_input->'review_link_id');if not found then perform eps.fail('RESOURCE_NOT_FOUND','Review link not found.',404);end if;perform eps.review_link_require(link.series_id,true);
 if not eps.guest_link_live(link)then perform eps.fail('REVIEW_UNAVAILABLE','Review access is unavailable.',404);end if;if not link.download_enabled then perform eps.fail('DOWNLOAD_DISABLED','PDF downloads are disabled for this link.',403);end if;
 cached:=eps.review_replay('prepare_export',p_idempotency_key,p_input);if cached is not null then return cached;end if;
 result:=eps.guest_prepare_export(link.id,eps.casting_uuid(p_input->'version_id'),p_idempotency_key,null);
 return eps.review_remember('prepare_export',p_idempotency_key,p_input,result,eps.casting_uuid(result#>'{export,id}'));
end$$;
create function public.eps_get_pdf_export(p_export_id uuid)returns jsonb language plpgsql volatile security definer set search_path=''as $$declare item eps.presentation_exports;link eps.review_links;begin
 perform eps.require_capability('review_links.manage');
 select * into item from eps.presentation_exports where id=p_export_id;if not found then perform eps.fail('RESOURCE_NOT_FOUND','PDF export not found.',404);end if;select * into link from eps.review_links where id=item.review_link_id;perform eps.review_link_require(link.series_id);
 if not eps.guest_link_live(link)then perform eps.fail('REVIEW_UNAVAILABLE','Review access is unavailable.',404);end if;
 if item.parent_token_generation<>link.token_generation or item.export_revision<>link.export_revision then perform eps.fail('RESOURCE_NOT_FOUND','Current PDF export not found.',404);end if;
 if not link.download_enabled then perform eps.fail('DOWNLOAD_DISABLED','PDF downloads are disabled for this link.',403);end if;return eps.presentation_export_dto(item);
end$$;
create function eps.guest_asset_issue(p_session uuid,p_media_digest text,p_version uuid,p_asset uuid,p_purpose text,p_export uuid)returns jsonb language plpgsql volatile security invoker set search_path=''as $$
declare session eps.guest_sessions;link eps.review_links;grant_row eps.review_media_grants;version eps.presentation_versions;pin eps.presentation_version_assets;asset eps.media_assets;export_row eps.presentation_exports;token text;expiry timestamptz;kind text;begin
 if p_session is not null then select * into session from eps.guest_sessions where id=p_session;link:=eps.guest_link_for(session);
 else
  if p_media_digest is null or p_media_digest!~'^[a-f0-9]{64}$'then perform eps.fail('REVIEW_UNAVAILABLE','Review access is unavailable.',404);end if;
  select * into grant_row from eps.review_media_grants where token_digest=p_media_digest;
  if not found or grant_row.revoked_at is not null or grant_row.expires_at<=clock_timestamp()or grant_row.version_id<>p_version then perform eps.fail('REVIEW_UNAVAILABLE','Review access is unavailable.',404);end if;
  select * into link from eps.review_links where id=grant_row.review_link_id;
  if not found or not eps.guest_link_live(link)or link.token_generation<>grant_row.parent_token_generation then perform eps.fail('REVIEW_UNAVAILABLE','Review access is unavailable.',404);end if;
 end if;
 version:=eps.feedback_version(p_version,link.series_id);
 if p_purpose is null or p_purpose not in('frame','logo','video','pdf')or(p_session is null and p_purpose<>'video')then perform eps.fail('RESOURCE_NOT_FOUND','Shared media not found.',404);end if;
 kind:=case p_purpose when'frame'then'candidate_frame'when'logo'then'client_logo'when'video'then'candidate_video'else'presentation_pdf'end;
 if p_purpose='pdf'then
  select * into export_row from eps.presentation_exports where id=p_export and version_id=version.id and review_link_id=link.id and parent_token_generation=link.token_generation and export_revision=link.export_revision and status='ready'and pdf_asset_id=p_asset;
  if not found or not link.download_enabled or not exists(select 1 from eps.review_media_grants g where g.id=export_row.media_grant_id and g.revoked_at is null and g.expires_at>clock_timestamp()and g.parent_token_generation=link.token_generation)then perform eps.fail('RESOURCE_NOT_FOUND','Authorized PDF export not found.',404);end if;
  select * into asset from eps.media_assets where id=export_row.pdf_asset_id and purpose='presentation_pdf'and status='ready'and producing_job_id=export_row.job_id and output_stage='render_export';
 else
  select * into pin from eps.presentation_version_assets where version_id=version.id and asset_id=p_asset and asset_kind=kind;
  if not found then perform eps.fail('RESOURCE_NOT_FOUND','Shared media not found.',404);end if;
  select * into asset from eps.media_assets where id=pin.asset_id and status in('ready','archived')and(bucket,object_key,purpose,sha256,size_bytes,mime_type,width,height,duration_ms,source_asset_id,source_timestamp_ms,filename,created_at)
   is not distinct from(pin.bucket,pin.object_key,pin.asset_kind,pin.sha256,pin.byte_size,pin.mime_type,pin.width,pin.height,pin.duration_ms,pin.source_asset_id,pin.timestamp_ms,pin.filename,pin.asset_created_at);
 end if;
 if not found or asset.id is null then perform eps.fail('ASSET_UNAVAILABLE','Retained media is unavailable.',503);end if;
 token:=rtrim(translate(replace(encode(extensions.gen_random_bytes(32),'base64'),E'\n',''),'+/','-_'),'=');expiry:=least(clock_timestamp()+interval'60seconds',link.expires_at,coalesce(session.expires_at,grant_row.expires_at));
 delete from eps.guest_asset_grants where expires_at<=clock_timestamp();
 insert into eps.guest_asset_grants(token_digest,session_id,media_grant_id,review_link_id,version_id,asset_id,export_id,parent_token_generation,bucket,object_key,purpose,created_at,expires_at)
 values(encode(sha256(convert_to(token,'UTF8')),'hex'),p_session,grant_row.id,link.id,version.id,asset.id,p_export,link.token_generation,asset.bucket,asset.object_key,p_purpose,clock_timestamp(),expiry);
 return jsonb_build_object('asset',eps.presentation_media_dto(asset),'bucket',asset.bucket,'object_key',asset.object_key,'grant_token',token,'expires_at',eps.presentation_time(expiry),'parent_expires_at',eps.presentation_time(least(link.expires_at,coalesce(session.expires_at,grant_row.expires_at))));
end$$;
create function eps.guest_export_access(p_session uuid,p_export uuid,p_asset boolean)returns jsonb language plpgsql volatile security invoker set search_path=''as $$
declare session eps.guest_sessions;link eps.review_links;item eps.presentation_exports;begin
 select * into session from eps.guest_sessions where id=p_session;link:=eps.guest_link_for(session);
 if not link.download_enabled then perform eps.fail('DOWNLOAD_DISABLED','PDF downloads are disabled for this link.',403);end if;
 select * into item from eps.presentation_exports where id=p_export and review_link_id=link.id and parent_token_generation=link.token_generation and export_revision=link.export_revision;
 if not found then perform eps.fail('RESOURCE_NOT_FOUND','Current PDF export not found.',404);end if;perform eps.feedback_version(item.version_id,link.series_id);
 if p_asset then
  if item.status<>'ready'then perform eps.fail('VERSION_NOT_READY','The PDF export is not ready.',409);end if;
  return eps.guest_asset_issue(session.id,null,item.version_id,item.pdf_asset_id,'pdf',item.id);
 end if;return eps.presentation_export_dto(item);
end$$;
create function eps.guest_storage_allowed(p_bucket text,p_key text)returns boolean language plpgsql volatile security definer set search_path=''as $$
declare headers jsonb;token text;begin
 begin headers:=nullif(current_setting('request.headers',true),'')::jsonb;exception when others then return false;end;token:=headers->>'x-eps-review-asset-grant';
 if token is null or token!~'^[A-Za-z0-9_-]{43}$'then return false;end if;
 return exists(select 1 from eps.guest_asset_grants g join eps.review_links l on l.id=g.review_link_id join eps.presentation_versions v on v.id=g.version_id
 left join eps.guest_sessions s on s.id=g.session_id left join eps.review_media_grants m on m.id=g.media_grant_id
 where g.token_digest=encode(sha256(convert_to(token,'UTF8')),'hex')and g.expires_at>clock_timestamp()and g.bucket=p_bucket and g.object_key=p_key
 and eps.guest_link_live(l)and l.token_generation=g.parent_token_generation and v.series_id=l.series_id and v.status='ready'
 and((g.session_id is not null and s.review_link_id=l.id and s.link_token_generation=l.token_generation and s.expires_at>clock_timestamp())
 or(g.media_grant_id is not null and g.purpose='video'and m.review_link_id=l.id and m.version_id=v.id and m.parent_token_generation=l.token_generation and m.revoked_at is null and m.expires_at>clock_timestamp()))
 and((g.purpose<>'pdf'and exists(select 1 from eps.presentation_version_assets p where p.version_id=v.id and p.asset_id=g.asset_id and p.bucket=g.bucket and p.object_key=g.object_key and p.asset_kind=case g.purpose when'video'then'candidate_video'when'frame'then'candidate_frame'else'client_logo'end))
 or(g.purpose='pdf'and l.download_enabled and exists(select 1 from eps.presentation_exports e join eps.review_media_grants eg on eg.id=e.media_grant_id where e.id=g.export_id and e.version_id=v.id and e.review_link_id=l.id and e.status='ready'and e.pdf_asset_id=g.asset_id and e.export_revision=l.export_revision and e.parent_token_generation=l.token_generation and eg.revoked_at is null and eg.expires_at>clock_timestamp()))));
end$$;
create policy m06_guest_storage_select on storage.objects for select to anon,authenticated using(eps.guest_storage_allowed(bucket_id,name));
create function public.eps_get_pdf_export_asset(p_export_id uuid)returns jsonb language plpgsql volatile security definer set search_path=''as $$declare item eps.presentation_exports;link eps.review_links;asset eps.media_assets;begin
 perform public.eps_get_pdf_export(p_export_id);select * into item from eps.presentation_exports where id=p_export_id;select * into link from eps.review_links where id=item.review_link_id;
 if item.status<>'ready'or not exists(select 1 from eps.review_media_grants g where g.id=item.media_grant_id and g.revoked_at is null and g.expires_at>clock_timestamp()and g.parent_token_generation=link.token_generation)then perform eps.fail('VERSION_NOT_READY','The current export is not ready.',409);end if;
 select * into asset from eps.media_assets where id=item.pdf_asset_id and purpose='presentation_pdf'and status='ready'and producing_job_id=item.job_id and output_stage='render_export';if not found then perform eps.fail('ASSET_UNAVAILABLE','The export is unavailable.',503);end if;
 return jsonb_build_object('asset',eps.presentation_media_dto(asset),'bucket',asset.bucket,'object_key',asset.object_key);
end$$;
create function eps.export_storage_read_allowed(p_bucket text,p_key text)returns boolean language sql volatile security definer set search_path=''as $$
 select exists(select 1 from eps.presentation_exports e join eps.review_links l on l.id=e.review_link_id join eps.media_assets a on a.id=e.pdf_asset_id join eps.review_media_grants g on g.id=e.media_grant_id
 where a.bucket=p_bucket and a.object_key=p_key and a.purpose='presentation_pdf'and a.status='ready'and a.producing_job_id=e.job_id and a.output_stage='render_export'
 and e.status='ready'and l.download_enabled and eps.guest_link_live(l)and e.export_revision=l.export_revision and e.parent_token_generation=l.token_generation
 and g.revoked_at is null and g.expires_at>clock_timestamp()and g.parent_token_generation=l.token_generation and eps.has_capability('review_links.manage')and eps.review_link_scope(l.series_id))
$$;
create policy m06_internal_export_storage_select on storage.objects for select to authenticated using(eps.export_storage_read_allowed(bucket_id,name));
