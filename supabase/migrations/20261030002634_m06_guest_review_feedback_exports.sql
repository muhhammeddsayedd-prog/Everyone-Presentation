-- M06 additive guest review/export25 after exact reviewed24.
-- Disabled configuration, no private key/login, fixture, provider or hosting change.
set local search_path='';set local lock_timeout='3s';set local statement_timeout='30s';
do $m06_baseline$begin if current_user<>'postgres' or current_database()<>'postgres' or(select array_agg(version order by version)from supabase_migrations.schema_migrations)is distinct from array['20261028010943','20261028013324','20261028013655','20261028024205','20261028072515','20261028162702','20261028162800','20261028172320','20261028184145','20261028222030','20261029001520','20261029003941','20261029070038','20261029090500','20261029090724','20261029094600','20261029100500','20261029133455','20261029135318','20261029174841','20261029180953','20261029202629','20261029203953','20261029215218']::text[]then raise exception'M06_EXACT_REVIEWED24_REQUIRED';end if;end$m06_baseline$;

-- Exact candidate fragment: development/m06/schema.sql
-- M06 additive candidate on exact reviewed24. Disabled, no credential material.
set local search_path='';set local lock_timeout='3s';set local statement_timeout='30s';
do $$begin
 if current_user<>'postgres' or current_database()<>'postgres'
 or(select count(*)from supabase_migrations.schema_migrations)<>24
 or(select max(version)from supabase_migrations.schema_migrations)<>'20261029215218'
 or to_regclass('eps.review_links')is not null then raise exception'M06_EXACT_REVIEWED24_REQUIRED';end if;
end$$;
create role eps_guest_owner nologin noinherit nosuperuser nocreatedb nocreaterole nobypassrls;
grant eps_guest_owner to postgres;
grant usage on schema eps,public,extensions to eps_guest_owner;

create table eps.review_gateway_config(
 id boolean primary key default true check(id),enabled boolean not null default false,
 backend_key bytea check(backend_key is null or octet_length(backend_key)=32),
 replay_ttl_seconds integer not null default 86400 check(replay_ttl_seconds=86400),
 session_ttl_seconds integer not null default 3600 check(session_ttl_seconds=3600),
 check(not enabled or backend_key is not null)
);
insert into eps.review_gateway_config(id)values(true);
create table eps.review_gateway_nonces(nonce text primary key check(nonce~'^[a-f0-9]{32}$'),expires_at timestamptz not null);
create index review_gateway_nonces_expiry on eps.review_gateway_nonces(expires_at);
create table eps.review_gateway_rates(key text primary key,window_start timestamptz not null,hits integer not null check(hits>0));
create index review_gateway_rates_expiry on eps.review_gateway_rates(window_start);
create table eps.review_links(
 id uuid primary key default gen_random_uuid(),series_id uuid not null references eps.presentation_series(id),
 label text not null default'' check(length(label)<=160),token_digest text not null unique check(token_digest~'^[a-f0-9]{64}$'),
 token_generation bigint not null default 1 check(token_generation between 1 and 9007199254740991),
 export_revision bigint not null default 1 check(export_revision between 1 and 9007199254740991),
 expires_at timestamptz not null,download_enabled boolean not null default true,revoked_at timestamptz,
 created_by uuid not null,created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp(),
 row_version bigint not null default 1 check(row_version between 1 and 9007199254740991)
);
create index review_links_series_id on eps.review_links(series_id,id);
create table eps.review_link_replays(
 principal_id uuid not null,operation text not null check(operation in('create','rotate')),key text not null check(length(key)between 16 and 200),
 request_hash text not null check(request_hash~'^[a-f0-9]{64}$'),review_link_id uuid not null references eps.review_links(id),
 token_generation bigint not null,response_encrypted text check(length(response_encrypted)between 1 and 16384),expires_at timestamptz not null,
 primary key(principal_id,operation,key)
);
create index review_link_replays_link on eps.review_link_replays(review_link_id);
create index review_link_replays_expiry on eps.review_link_replays(expires_at)where response_encrypted is not null;
create table eps.guest_sessions(
 id uuid primary key default gen_random_uuid(),review_link_id uuid not null references eps.review_links(id),
 session_token_digest text not null unique check(session_token_digest~'^[a-f0-9]{64}$'),link_token_generation bigint not null,
 display_name text check(length(btrim(display_name))between 1 and 120),company text check(length(company)<=160),
 expires_at timestamptz not null,created_at timestamptz not null default clock_timestamp(),last_seen_at timestamptz not null default clock_timestamp()
);
create index guest_sessions_link on eps.guest_sessions(review_link_id,id);
create index guest_sessions_expiry on eps.guest_sessions(expires_at);
create table eps.feedback_comments(
 id uuid primary key default gen_random_uuid(),series_id uuid not null references eps.presentation_series(id),
 version_id uuid not null references eps.presentation_versions(id),slide_id uuid not null references eps.version_slides(id),
 guest_session_id uuid references eps.guest_sessions(id),author_principal_id uuid,
 author_name_snapshot text not null check(length(btrim(author_name_snapshot))between 1 and 200),company_snapshot text,
 parent_comment_id uuid references eps.feedback_comments(id),resolved boolean not null default false,resolved_at timestamptz,resolved_by uuid,
 body text not null check(length(btrim(body))between 1 and 10000),visibility text not null check(visibility in('external','internal')),
 created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp(),deleted_at timestamptz,
 row_version bigint not null default 1 check(row_version between 1 and 9007199254740991),
 check((guest_session_id is not null and author_principal_id is null and visibility='external')or(guest_session_id is null and author_principal_id is not null))
);
create index feedback_comments_version on eps.feedback_comments(version_id,id);
create index feedback_comments_series on eps.feedback_comments(series_id,version_id,id);
create index feedback_comments_slide on eps.feedback_comments(slide_id,id);
create index feedback_comments_guest on eps.feedback_comments(guest_session_id,id);
create index feedback_comments_parent on eps.feedback_comments(parent_comment_id);
create table eps.feedback_preferences(
 id uuid primary key default gen_random_uuid(),series_id uuid not null references eps.presentation_series(id),version_id uuid not null references eps.presentation_versions(id),
 slide_id uuid not null references eps.version_slides(id),guest_session_id uuid references eps.guest_sessions(id),author_principal_id uuid,
 author_name_snapshot text not null,preference text not null check(preference in('preferred','maybe','not_preferred')),
 created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp(),
 row_version bigint not null default 1 check(row_version between 1 and 9007199254740991),
 check((guest_session_id is not null)<>(author_principal_id is not null))
);
create unique index feedback_preference_guest on eps.feedback_preferences(guest_session_id,version_id,slide_id)where guest_session_id is not null;
create unique index feedback_preference_internal on eps.feedback_preferences(author_principal_id,version_id,slide_id)where author_principal_id is not null;
create index feedback_preferences_version on eps.feedback_preferences(version_id,id);
create index feedback_preferences_series on eps.feedback_preferences(series_id,version_id,id);
create index feedback_preferences_slide on eps.feedback_preferences(slide_id,id);
create table eps.presentation_exports(
 id uuid primary key default gen_random_uuid(),version_id uuid not null references eps.presentation_versions(id),review_link_id uuid not null references eps.review_links(id),
 template_version text not null,export_revision bigint not null check(export_revision>0),parent_token_generation bigint not null check(parent_token_generation>0),
 status text not null default'queued'check(status in('queued','rendering','ready','failed')),
 pdf_asset_id uuid references eps.media_assets(id),media_grant_id uuid,job_id uuid not null unique references eps.jobs(id),
 created_at timestamptz not null default clock_timestamp(),ready_at timestamptz,failure_code text,
 row_version bigint not null default 1,
 unique(version_id,review_link_id,template_version,export_revision),
 check((status='ready'and pdf_asset_id is not null and media_grant_id is not null and ready_at is not null and failure_code is null)
 or(status in('queued','rendering')and pdf_asset_id is null and media_grant_id is null and ready_at is null and failure_code is null)
 or(status='failed'and pdf_asset_id is null and media_grant_id is null and ready_at is null and failure_code is not null))
);
create index presentation_exports_link on eps.presentation_exports(review_link_id,id);
create index presentation_exports_pdf on eps.presentation_exports(pdf_asset_id);
create table eps.review_media_grants(
 id uuid primary key default gen_random_uuid(),review_link_id uuid not null references eps.review_links(id),version_id uuid not null references eps.presentation_versions(id),
 export_id uuid not null references eps.presentation_exports(id),parent_token_generation bigint not null,
 token_digest text not null unique check(token_digest~'^[a-f0-9]{64}$'),expires_at timestamptz not null,revoked_at timestamptz,
 producing_attempt_id uuid not null,created_at timestamptz not null default clock_timestamp()
);
create index review_media_grants_link on eps.review_media_grants(review_link_id,id);
create index review_media_grants_version on eps.review_media_grants(version_id,id);
create index review_media_grants_export on eps.review_media_grants(export_id,id);
alter table eps.presentation_exports add constraint presentation_export_grant_fk foreign key(media_grant_id)references eps.review_media_grants(id);
create index presentation_exports_grant on eps.presentation_exports(media_grant_id);
create table eps.guest_asset_grants(
 token_digest text primary key check(token_digest~'^[a-f0-9]{64}$'),session_id uuid references eps.guest_sessions(id),media_grant_id uuid references eps.review_media_grants(id),
 review_link_id uuid not null references eps.review_links(id),version_id uuid not null references eps.presentation_versions(id),asset_id uuid not null references eps.media_assets(id),
 export_id uuid references eps.presentation_exports(id),parent_token_generation bigint not null,bucket text not null,object_key text not null,purpose text not null check(purpose in('frame','logo','video','pdf')),
 created_at timestamptz not null,expires_at timestamptz not null check(expires_at<=created_at+interval'60seconds'),
 check((session_id is not null)<>(media_grant_id is not null))
);
create index guest_asset_grants_link on eps.guest_asset_grants(review_link_id);
create index guest_asset_grants_session on eps.guest_asset_grants(session_id);
create index guest_asset_grants_media on eps.guest_asset_grants(media_grant_id);
create index guest_asset_grants_version on eps.guest_asset_grants(version_id);
create index guest_asset_grants_asset on eps.guest_asset_grants(asset_id);
create index guest_asset_grants_export on eps.guest_asset_grants(export_id);
create index guest_asset_grants_expiry on eps.guest_asset_grants(expires_at);
create table eps.guest_idempotency(
 session_id uuid not null references eps.guest_sessions(id),operation text not null,key text not null check(length(key)between 16 and 200),
 request_hash text not null check(request_hash~'^[a-f0-9]{64}$'),response jsonb not null,created_at timestamptz not null default clock_timestamp(),primary key(session_id,operation,key)
);

do $$declare item text;begin
 foreach item in array array['review_gateway_config','review_gateway_nonces','review_gateway_rates','review_links','review_link_replays','guest_sessions','feedback_comments','feedback_preferences','presentation_exports','review_media_grants','guest_asset_grants','guest_idempotency']loop
  execute format('alter table eps.%I enable row level security',item);execute format('alter table eps.%I force row level security',item);
  execute format('revoke all on eps.%I from public,anon,authenticated,service_role',item);
  execute format('grant select,insert,update,delete on eps.%I to eps_guest_owner',item);
  execute format('create policy m06_gateway_only on eps.%I for all to eps_guest_owner using(true)with check(true)',item);
 end loop;
end$$;
revoke insert,update,delete on eps.review_gateway_config from eps_guest_owner;
grant select on eps.presentation_series,eps.presentation_versions,eps.version_slides,eps.presentation_version_assets,eps.media_assets,eps.presentation_processing_config to eps_guest_owner;
create policy m06_guest_series_read on eps.presentation_series for select to eps_guest_owner using(true);
create policy m06_guest_version_read on eps.presentation_versions for select to eps_guest_owner using(true);
create policy m06_guest_slide_read on eps.version_slides for select to eps_guest_owner using(true);
create policy m06_guest_pin_read on eps.presentation_version_assets for select to eps_guest_owner using(true);
create policy m06_guest_asset_read on eps.media_assets for select to eps_guest_owner using(true);
create policy m06_guest_render_config_read on eps.presentation_processing_config for select to eps_guest_owner using(true);
grant execute on function eps.fail(text,text,integer,bigint),eps.cast_canonical(jsonb),eps.presentation_hash(jsonb),eps.presentation_time(timestamptz),eps.presentation_version_dto(eps.presentation_versions),eps.presentation_render_context(jsonb),eps.presentation_media_dto(eps.media_assets),eps.casting_uuid(jsonb),eps.casting_body(jsonb,text[]),eps.review_body(jsonb,text[],text[]),eps.logo_integer(jsonb,bigint,bigint)to eps_guest_owner;
grant usage on schema extensions to eps_review_owner;
grant execute on function eps.logo_integer(jsonb,bigint,bigint)to eps_review_owner;

create function eps.guest_link_live(p_link eps.review_links)returns boolean language sql volatile security invoker set search_path=''as $$select p_link.id is not null and p_link.revoked_at is null and p_link.expires_at>clock_timestamp()$$;
create function eps.review_link_dto(p_link eps.review_links)returns jsonb language sql stable security invoker set search_path=''as $$
 select jsonb_build_object('id',p_link.id,'series_id',p_link.series_id,'label',p_link.label,'expires_at',eps.presentation_time(p_link.expires_at),'download_enabled',p_link.download_enabled,'revoked_at',eps.presentation_time(p_link.revoked_at),'latest_ready_version_id',(select latest_ready_version_id from eps.presentation_series where id=p_link.series_id),'row_version',p_link.row_version,'created_at',eps.presentation_time(p_link.created_at))
$$;
create function eps.presentation_export_dto(p_export eps.presentation_exports)returns jsonb language sql stable security invoker set search_path=''as $$
 select jsonb_build_object('id',p_export.id,'version_id',p_export.version_id,'review_link_id',p_export.review_link_id,'template_version',p_export.template_version,'export_revision',p_export.export_revision,'status',p_export.status,'pdf_asset_id',p_export.pdf_asset_id,'job_id',p_export.job_id,'created_at',eps.presentation_time(p_export.created_at),'ready_at',eps.presentation_time(p_export.ready_at),'failure_code',p_export.failure_code)
$$;


-- Exact candidate fragment: development/m06/links.sql
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


-- Exact candidate fragment: development/m06/feedback.sql
create function eps.feedback_comment_dto(p_item eps.feedback_comments)returns jsonb language sql stable security invoker set search_path=''as $$
 select jsonb_build_object('id',p_item.id,'series_id',p_item.series_id,'version_id',p_item.version_id,'version_slide_id',p_item.slide_id,'guest_session_id',p_item.guest_session_id,'author_display_name',p_item.author_name_snapshot,'company',p_item.company_snapshot,'visibility',p_item.visibility,'body',p_item.body,'parent_comment_id',p_item.parent_comment_id,'resolved',p_item.resolved,'row_version',p_item.row_version,'created_at',eps.presentation_time(p_item.created_at),'updated_at',eps.presentation_time(p_item.updated_at))
$$;
create function eps.feedback_preference_dto(p_item eps.feedback_preferences)returns jsonb language sql stable security invoker set search_path=''as $$
 select jsonb_build_object('id',p_item.id,'version_slide_id',p_item.slide_id,'guest_session_id',p_item.guest_session_id,'author_display_name',p_item.author_name_snapshot,'value',p_item.preference,'row_version',p_item.row_version,'updated_at',eps.presentation_time(p_item.updated_at))
$$;
create function eps.feedback_version(p_version uuid,p_series uuid default null)returns eps.presentation_versions language plpgsql stable security invoker set search_path=''as $$declare item eps.presentation_versions;begin
 select * into item from eps.presentation_versions where id=p_version and status='ready'and(p_series is null or series_id=p_series);
 if not found then perform eps.fail('RESOURCE_NOT_FOUND','Shared version not found.',404);end if;
 if p_series is not null and not exists(select 1 from eps.presentation_series s where s.id=p_series and s.audience_snapshot->>'scope'='external'
 and item.snapshot->>'series_id'=s.id::text and item.snapshot#>'{audience_snapshot}'=s.audience_snapshot and item.snapshot#>>'{audience_snapshot,scope}'='external'
 and item.snapshot#>>'{cover,output_type}'=s.output_type and item.snapshot#>>'{template,key}'=s.template_key and item.snapshot#>>'{template,version}'=s.template_version and item.snapshot#>>'{template,content_sha256}'=s.template_content_sha256)
 then perform eps.fail('RESOURCE_NOT_FOUND','Shared version not found.',404);end if;return item;
end$$;
create function eps.feedback_page(p_version uuid,p_external boolean,p_options jsonb)returns jsonb language plpgsql stable security invoker set search_path=''as $$
declare maximum integer;cursor_text text;last_key text;keys text[];comments jsonb;preferences jsonb;begin
 perform eps.review_body(p_options,array['cursor','limit','version_slide_id']);maximum:=case when p_options?'limit'then eps.logo_integer(p_options->'limit',1,100)else 25 end;
 if p_options?'cursor'then cursor_text:=p_options->>'cursor';if cursor_text!~'^[a-f0-9-]{36}:[cp]$'then perform eps.fail('VALIDATION_FAILED','Invalid feedback cursor.',400);end if;end if;
 if p_options?'version_slide_id'then perform eps.casting_uuid(p_options->'version_slide_id');end if;
 select array_agg(key order by key),max(key)into keys,last_key from(
  select key from(
   select c.id::text||':c'as key,c.slide_id from eps.feedback_comments c where c.version_id=p_version and c.deleted_at is null and(not p_external or c.visibility='external')
   union all select f.id::text||':p',f.slide_id from eps.feedback_preferences f where f.version_id=p_version
  )items where(cursor_text is null or key>cursor_text)and(not p_options?'version_slide_id'or slide_id=eps.casting_uuid(p_options->'version_slide_id'))order by key limit maximum+1
 )page;
 if cardinality(keys)>maximum then keys:=keys[1:maximum];last_key:=keys[maximum];else last_key:=null;end if;
 select coalesce(jsonb_agg(eps.feedback_comment_dto(c)order by c.id),'[]')into comments from eps.feedback_comments c where c.version_id=p_version and c.id::text||':c'=any(keys)and c.deleted_at is null and(not p_external or c.visibility='external');
 select coalesce(jsonb_agg(eps.feedback_preference_dto(f)order by f.id),'[]')into preferences from eps.feedback_preferences f where f.version_id=p_version and f.id::text||':p'=any(keys);
 return jsonb_build_object('version_id',p_version,'comments',comments,'preferences',preferences,'page',jsonb_build_object('next_cursor',last_key));
end$$;
create function eps.feedback_mutate(p_guest uuid,p_principal uuid,p_version uuid,p_action text,p_input jsonb)returns jsonb language plpgsql volatile security invoker set search_path=''as $$
declare version eps.presentation_versions;slide eps.version_slides;comment eps.feedback_comments;parent eps.feedback_comments;preference eps.feedback_preferences;guest eps.guest_sessions;author text;company text;requested_version bigint;begin
 if(p_guest is null)=(p_principal is null)then perform eps.fail('ACCESS_DENIED','Invalid feedback identity.',403);end if;
 version:=eps.feedback_version(p_version);
 if p_guest is not null then select * into guest from eps.guest_sessions where id=p_guest;if not found or guest.display_name is null then perform eps.fail('GUEST_IDENTITY_REQUIRED','Enter your name before adding feedback.',422);end if;author:=guest.display_name;company:=guest.company;
 else author:='Production';end if;
 if p_action in('create_comment','set_preference')then
  select * into slide from eps.version_slides where id=eps.casting_uuid(p_input->'version_slide_id')and version_id=version.id;
  if not found or slide.kind='cover'or(p_action='set_preference'and slide.kind<>'candidate')then perform eps.fail('RESOURCE_NOT_FOUND','Feedback slide not found.',404);end if;
 end if;
 if p_action='create_comment'then
  if jsonb_typeof(p_input->'body')is distinct from'string'or length(btrim(p_input->>'body'))not between 1 and 10000 then perform eps.fail('VALIDATION_FAILED','Provide a bounded comment.',400);end if;
  if p_input?'parent_comment_id'then select * into parent from eps.feedback_comments where id=eps.casting_uuid(p_input->'parent_comment_id')and version_id=version.id and slide_id=slide.id and deleted_at is null and(p_guest is null or visibility='external');if not found then perform eps.fail('RESOURCE_NOT_FOUND','Reply target not found.',404);end if;end if;
  if p_guest is null and(p_input->>'visibility')not in('external','internal')then perform eps.fail('VALIDATION_FAILED','Choose comment visibility.',400);end if;
  if parent.id is not null and p_guest is null and parent.visibility<>p_input->>'visibility'then perform eps.fail('VALIDATION_FAILED','Replies keep their parent visibility.',400);end if;
  insert into eps.feedback_comments(series_id,version_id,slide_id,guest_session_id,author_principal_id,author_name_snapshot,company_snapshot,parent_comment_id,body,visibility)
  values(version.series_id,version.id,slide.id,p_guest,p_principal,author,company,parent.id,btrim(p_input->>'body'),case when p_guest is not null then'external'else p_input->>'visibility'end)returning * into comment;
  return eps.feedback_comment_dto(comment);
 elsif p_action='update_comment'then
  select * into comment from eps.feedback_comments where id=eps.casting_uuid(p_input->'comment_id')and version_id=version.id and deleted_at is null for update;
  if not found or(p_guest is not null and comment.guest_session_id is distinct from p_guest)then perform eps.fail('RESOURCE_NOT_FOUND','Comment not found.',404);end if;
  if eps.logo_integer(p_input->'row_version',1,9007199254740991)<>comment.row_version then perform eps.fail('STALE_RESOURCE_VERSION','Refresh current feedback.',409,comment.row_version);end if;
  if p_input?'body'then
   if(p_guest is null and comment.author_principal_id is distinct from p_principal)then perform eps.fail('ACCESS_DENIED','Only the author may edit comment wording.',403);end if;
   if jsonb_typeof(p_input->'body')is distinct from'string'or length(btrim(p_input->>'body'))not between 1 and 10000 then perform eps.fail('VALIDATION_FAILED','Provide a bounded comment.',400);end if;
  end if;
  if p_input?'resolved'and(p_guest is not null or jsonb_typeof(p_input->'resolved')is distinct from'boolean')then perform eps.fail('ACCESS_DENIED','Only production may resolve feedback.',403);end if;
  update eps.feedback_comments set body=coalesce(p_input->>'body',body),resolved=coalesce((p_input->>'resolved')::boolean,resolved),resolved_at=case when p_input?'resolved'then case when(p_input->>'resolved')::boolean then clock_timestamp()else null end else resolved_at end,resolved_by=case when p_input?'resolved'then case when(p_input->>'resolved')::boolean then p_principal else null end else resolved_by end,row_version=row_version+1,updated_at=clock_timestamp()where id=comment.id returning * into comment;
  return eps.feedback_comment_dto(comment);
 elsif p_action='set_preference'then
  if not p_input?'value'or p_input->'value'<>'null'and(jsonb_typeof(p_input->'value')is distinct from'string'or p_input->>'value'not in('preferred','maybe','not_preferred'))then perform eps.fail('VALIDATION_FAILED','Choose a supported preference.',400);end if;
  perform pg_advisory_xact_lock(hashtextextended(coalesce(p_guest,p_principal)::text||':preference:'||slide.id::text,0));
  select * into preference from eps.feedback_preferences where version_id=version.id and slide_id=slide.id and(case when p_guest is not null then guest_session_id=p_guest else author_principal_id=p_principal end)for update;
  if found then
   if not p_input?'row_version'or p_input->'row_version'='null'or eps.logo_integer(p_input->'row_version',1,9007199254740991)<>preference.row_version then perform eps.fail('STALE_RESOURCE_VERSION','Refresh your current preference.',409,preference.row_version);end if;
   if p_input->'value'='null'then delete from eps.feedback_preferences where id=preference.id;return jsonb_build_object('preference',null,'cleared',true);end if;
   update eps.feedback_preferences set preference=p_input->>'value',author_name_snapshot=author,row_version=row_version+1,updated_at=clock_timestamp()where id=preference.id returning * into preference;
  else
   if p_input?'row_version'and p_input->'row_version'<>'null'then perform eps.fail('STALE_RESOURCE_VERSION','This preference no longer exists.',409);end if;
   if p_input->'value'='null'then return jsonb_build_object('preference',null,'cleared',true);end if;
   insert into eps.feedback_preferences(series_id,version_id,slide_id,guest_session_id,author_principal_id,author_name_snapshot,preference)values(version.series_id,version.id,slide.id,p_guest,p_principal,author,p_input->>'value')returning * into preference;
  end if;return jsonb_build_object('preference',eps.feedback_preference_dto(preference),'cleared',false);
 end if;perform eps.fail('VALIDATION_FAILED','Unsupported feedback operation.',400);return null;
end$$;
grant select,insert,update,delete on eps.feedback_comments,eps.feedback_preferences to eps_review_owner;
create policy m06_internal_comment on eps.feedback_comments for all to eps_review_owner using(eps.review_link_scope(series_id))with check(eps.review_link_scope(series_id));
create policy m06_internal_preference on eps.feedback_preferences for all to eps_review_owner using(eps.review_link_scope(series_id))with check(eps.review_link_scope(series_id));
grant select on eps.guest_sessions to eps_review_owner;
create policy m06_internal_guest_labels on eps.guest_sessions for select to eps_review_owner using(exists(select 1 from eps.review_links l where l.id=review_link_id and eps.review_link_scope(l.series_id)));
create function eps.feedback_internal_require(p_version uuid,p_write boolean default false)returns eps.presentation_versions language plpgsql stable security invoker set search_path=''as $$declare item eps.presentation_versions;begin
 item:=eps.feedback_version(p_version);perform eps.review_link_require(item.series_id);
 if p_write and(not eps.has_capability('workspaces.write')or not eps.project_scope(item.project_id,true))then perform eps.fail('ACCESS_DENIED','Feedback editing is not permitted.',403);end if;return item;
end$$;
create function public.eps_list_feedback(p_version_id uuid,p_options jsonb default'{}')returns jsonb language plpgsql stable security definer set search_path=''as $$begin
 perform eps.feedback_internal_require(p_version_id);return eps.feedback_page(p_version_id,false,p_options);
end$$;
create function public.eps_create_comment(p_version_id uuid,p_input jsonb,p_idempotency_key text)returns jsonb language plpgsql volatile security definer set search_path=''as $$declare cached jsonb;result jsonb;begin
 perform eps.review_body(p_input,array['version_slide_id','visibility','body','parent_comment_id'],array['version_slide_id','visibility','body']);perform eps.feedback_internal_require(p_version_id,true);
 cached:=eps.review_replay('create_comment',p_idempotency_key,jsonb_build_object('version_id',p_version_id,'input',p_input));if cached is not null then return cached;end if;
 result:=eps.feedback_mutate(null,auth.uid(),p_version_id,'create_comment',p_input);return eps.review_remember('create_comment',p_idempotency_key,jsonb_build_object('version_id',p_version_id,'input',p_input),result,eps.casting_uuid(result->'id'));
end$$;
create function public.eps_update_comment(p_comment_id uuid,p_input jsonb,p_idempotency_key text default null)returns jsonb language plpgsql volatile security definer set search_path=''as $$declare version_id uuid;cached jsonb;result jsonb;request jsonb:=jsonb_build_object('id',p_comment_id,'input',p_input);begin
 perform eps.review_body(p_input,array['row_version','body','resolved'],array['row_version']);if not(p_input?'body'or p_input?'resolved')then perform eps.fail('VALIDATION_FAILED','Choose a comment change.',400);end if;
 select c.version_id into version_id from eps.feedback_comments c where c.id=p_comment_id;if not found then perform eps.fail('RESOURCE_NOT_FOUND','Comment not found.',404);end if;
 perform eps.feedback_internal_require(version_id,true);if p_idempotency_key is not null then cached:=eps.review_replay('update_comment',p_idempotency_key,request);if cached is not null then return cached;end if;end if;
 result:=eps.feedback_mutate(null,auth.uid(),version_id,'update_comment',p_input||jsonb_build_object('comment_id',p_comment_id));
 if p_idempotency_key is not null then return eps.review_remember('update_comment',p_idempotency_key,request,result,p_comment_id);end if;return result;
end$$;
create function public.eps_set_preference(p_version_id uuid,p_input jsonb,p_idempotency_key text)returns jsonb language plpgsql volatile security definer set search_path=''as $$declare cached jsonb;result jsonb;begin
 perform eps.review_body(p_input,array['version_slide_id','value','row_version'],array['version_slide_id','value']);perform eps.feedback_internal_require(p_version_id,true);
 cached:=eps.review_replay('set_preference',p_idempotency_key,jsonb_build_object('version_id',p_version_id,'input',p_input));if cached is not null then return cached;end if;
 result:=eps.feedback_mutate(null,auth.uid(),p_version_id,'set_preference',p_input);return eps.review_remember('set_preference',p_idempotency_key,jsonb_build_object('version_id',p_version_id,'input',p_input),result,eps.casting_uuid(p_input->'version_slide_id'));
end$$;


-- Exact candidate fragment: development/m06/exports.sql
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


-- Exact candidate fragment: development/m06/gateway.sql
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


-- Exact candidate fragment: development/m06/export-processing.sql
-- M06 frozen Ready export stages. Bearer grants occur only in the authenticated
-- mint response and the private PDF, never job/outbox/manifest/event metadata.
do $$declare item record;definition text;begin
 for item in select conname,pg_get_constraintdef(oid)body,conrelid::regclass tab from pg_constraint where connamespace='eps'::regnamespace and conname in('jobs_kind_check','jobs_stage_check','jobs_kind_stage_check','jobs_input_hash_version_check','job_events_stage_check','outbox_events_stage_check')loop
  definition:=item.body;
  if item.conname='jobs_kind_check'then definition:=replace(definition,'''presentation_render''::text','''presentation_render''::text,''presentation_export''::text');
  elsif item.conname='jobs_kind_stage_check'then definition:='CHECK ('||substring(definition from 7)||' OR(kind=''presentation_export''and stage=''render_export''))';
  elsif item.conname='jobs_input_hash_version_check'then definition:=replace(definition,'''eps.presentation-job-input.cast-canonical.v1''::text','''eps.presentation-job-input.cast-canonical.v1''::text,''eps.presentation-export-input.cast-canonical.v1''::text');
  else definition:=replace(definition,'''publish_presentation''::text','''publish_presentation''::text,''render_export''::text');end if;
  if definition=item.body then raise exception'M06_STAGE_CONSTRAINT_ANCHOR_REQUIRED';end if;
  execute format('alter table %s drop constraint %I',item.tab,item.conname);execute format('alter table %s add constraint %I %s',item.tab,item.conname,definition);
 end loop;
end$$;
create function eps.export_is_job(p_job uuid)returns boolean language sql volatile security definer set search_path=''as $$select exists(select 1 from eps.jobs where id=p_job and kind='presentation_export')$$;
create function eps.export_stage_can_write(p_principal uuid,p_workspace uuid)returns boolean language sql volatile security invoker set search_path=''as $$
 select eps.job_requester_active(p_principal)and exists(select 1 from eps.workspaces w join public.projects p on p.id=w.project_id join public.project_memberships m on m.project_id=p.id where w.id=p_workspace and w.archived_at is null and p.archived_at is null and m.principal_id=p_principal and m.active and m.can_write)
 and exists(select 1 from public.app_capability_grants where principal_id=p_principal and capability='review_links.manage'and active)
$$;
create function eps.export_stage_matches(p_job eps.jobs)returns boolean language sql volatile security definer set search_path=''as $$
 select p_job.kind='presentation_export'and p_job.stage='render_export'and p_job.input_hash_version='eps.presentation-export-input.cast-canonical.v1'and p_job.input_hash=eps.presentation_hash(p_job.input)
 and exists(select 1 from eps.presentation_exports e join eps.review_links l on l.id=e.review_link_id join eps.presentation_versions v on v.id=e.version_id where e.id=p_job.resource_id and e.job_id=p_job.id and v.workspace_id=p_job.workspace_id and v.status='ready'and e.template_version=v.snapshot#>>'{template,version}' and l.series_id=v.series_id and eps.guest_link_live(l)and l.download_enabled and l.created_by=p_job.requested_by and e.parent_token_generation=l.token_generation and e.export_revision=l.export_revision
 and p_job.input=jsonb_build_object('schema_version','1.0','workspace_id',v.workspace_id,'series_id',v.series_id,'version_id',v.id,'export_id',e.id,'review_link_id',l.id,'export_revision',e.export_revision,'token_generation',l.token_generation,'snapshot_sha256',v.snapshot_sha256,'manifest_sha256',v.manifest_sha256,'inventory_sha256',v.inventory_sha256,'configuration',v.snapshot->'render_configuration')
 and v.snapshot_sha256=eps.presentation_hash(v.snapshot)and v.manifest_sha256=eps.presentation_hash(v.manifest)and v.inventory_sha256=eps.presentation_hash(v.snapshot->'asset_inventory'))
$$;
create function eps.export_stage_lock(p_job uuid,p_require_access boolean default true)returns eps.jobs language plpgsql volatile security definer set search_path=''as $$
declare identity eps.jobs;job eps.jobs;link_id uuid;begin
 select * into identity from eps.jobs where id=p_job and kind='presentation_export';if not found then perform eps.fail('RESOURCE_NOT_FOUND','Guest export job not found.',404);end if;
 perform 1 from eps.workspaces where id=identity.workspace_id for update;select review_link_id into link_id from eps.presentation_exports where id=identity.resource_id;
 perform 1 from eps.review_links where id=link_id for update;perform 1 from eps.presentation_exports where id=identity.resource_id for update;
 select * into job from eps.jobs where id=p_job and workspace_id=identity.workspace_id and resource_id=identity.resource_id and kind='presentation_export'for update;
 perform eps.specs_stage_assert(found,'STAGE_STATE_INVALID');if p_require_access and not eps.export_stage_can_write(job.requested_by,job.workspace_id)then perform eps.fail('PERMISSION_CHANGED','The link owner no longer has export authority.',403);end if;return job;
end$$;
create function eps.export_stage_current(p_job uuid,p_attempt uuid,p_token text)returns eps.jobs language plpgsql volatile security definer set search_path=''as $$declare job eps.jobs;begin
 job:=eps.export_stage_lock(p_job);perform eps.specs_stage_assert(job.status='running'and job.current_attempt_id=p_attempt and job.cancel_requested_at is null and job.lease_expires_at>clock_timestamp(),'STALE_STAGE_LEASE');
 perform eps.specs_stage_assert(p_token~'^[a-f0-9]{64}$'and job.lease_token_digest=encode(sha256(convert_to(p_token,'UTF8')),'hex'),'LEASE_INVALID');perform eps.specs_stage_assert(eps.export_stage_matches(job),'SNAPSHOT_INVALID');return job;
end$$;
create function eps.export_stage_live(p_job uuid,p_attempt uuid,p_hash text)returns boolean language sql volatile security definer set search_path=''as $$
 select exists(select 1 from eps.jobs j where j.id=p_job and j.kind='presentation_export'and j.current_attempt_id=p_attempt and j.input_hash=p_hash and j.status='running'and j.cancel_requested_at is null and j.lease_expires_at>clock_timestamp()and eps.export_stage_can_write(j.requested_by,j.workspace_id)and eps.export_stage_matches(j))
$$;
create function eps.mint_review_media_grant(p_input jsonb)returns jsonb language plpgsql volatile security definer set search_path=''as $$
declare job eps.jobs;export eps.presentation_exports;link eps.review_links;grant_id uuid:=gen_random_uuid();raw_token text;begin
 perform eps.specs_stage_assert(eps.specs_stage_shape(p_input,array['job_id','attempt_id','lease_token']));job:=eps.export_stage_current(eps.input_uuid(p_input->>'job_id'),eps.input_uuid(p_input->>'attempt_id'),p_input->>'lease_token');
 select * into export from eps.presentation_exports where id=job.resource_id;select * into link from eps.review_links where id=export.review_link_id;
 perform eps.specs_stage_assert(export.status='rendering'and export.media_grant_id is null,'STAGE_STATE_INVALID');
 update eps.review_media_grants set revoked_at=coalesce(revoked_at,clock_timestamp())where export_id=export.id and revoked_at is null;
 raw_token:=rtrim(translate(replace(encode(extensions.gen_random_bytes(32),'base64'),E'\n',''),'+/','-_'),'=');
 insert into eps.review_media_grants(id,review_link_id,version_id,export_id,parent_token_generation,token_digest,expires_at,producing_attempt_id)values(grant_id,link.id,export.version_id,export.id,link.token_generation,encode(sha256(convert_to(raw_token,'UTF8')),'hex'),link.expires_at,job.current_attempt_id);
 return jsonb_build_object('grant_id',grant_id,'grant_token',raw_token,'version_id',export.version_id,'review_link_id',link.id,'export_id',export.id,'export_revision',export.export_revision,'expires_at',eps.presentation_time(link.expires_at));
end$$;
create function eps.export_validate_result(p_job eps.jobs,p_value jsonb)returns void language plpgsql volatile security invoker set search_path=''as $$
declare version eps.presentation_versions;export eps.presentation_exports;proof jsonb;validation jsonb;candidate_count integer;pending_count integer;frame_count integer;logo_count integer;video_count integer;begin
 select * into export from eps.presentation_exports where id=p_job.resource_id and job_id=p_job.id;perform eps.specs_stage_assert(found,'SNAPSHOT_INVALID');select * into version from eps.presentation_versions where id=export.version_id and status='ready';perform eps.specs_stage_assert(found,'SNAPSHOT_INVALID');
 perform eps.specs_stage_assert(eps.specs_stage_shape(p_value,array['schema_version','version_id','export_id','review_link_id','export_revision','grant_id','snapshot_sha256','manifest_sha256','inventory_sha256','pdf_asset','render_proof','validation_proof'])and p_value->>'schema_version'='1.0'and p_value->>'version_id'=version.id::text and p_value->>'export_id'=export.id::text and p_value->>'review_link_id'=export.review_link_id::text and p_value->'export_revision'=to_jsonb(export.export_revision)and p_value->>'snapshot_sha256'=version.snapshot_sha256 and p_value->>'manifest_sha256'=version.manifest_sha256 and p_value->>'inventory_sha256'=version.inventory_sha256,'RESULT_INVALID');
 perform eps.specs_stage_assert(exists(select 1 from eps.review_media_grants g join eps.review_links l on l.id=g.review_link_id where g.id=eps.input_uuid(p_value->>'grant_id')and g.export_id=export.id and g.version_id=version.id and g.review_link_id=export.review_link_id and g.parent_token_generation=export.parent_token_generation and g.parent_token_generation=l.token_generation and g.revoked_at is null and g.expires_at>clock_timestamp()and eps.guest_link_live(l)and g.producing_attempt_id=p_job.current_attempt_id),'RESULT_INVALID');
 perform eps.specs_stage_assert(eps.specs_stage_shape(p_value->'pdf_asset',array['asset_id','sha256','size_bytes','mime_type'])and exists(select 1 from eps.media_assets a where a.id=eps.input_uuid(p_value#>>'{pdf_asset,asset_id}')and a.producing_job_id=p_job.id and a.producing_attempt_id=p_job.current_attempt_id and a.origin_workspace_id=p_job.workspace_id and a.output_stage='render_export'and a.output_key='presentation_pdf'and a.purpose='presentation_pdf'and a.status='ready'and a.bucket='eps-presentation-outputs'and a.object_key='jobs/'||p_job.id||'/attempts/'||p_job.current_attempt_id||'/'||a.id||'.pdf'and a.sha256=p_value#>>'{pdf_asset,sha256}'and to_jsonb(a.size_bytes)=p_value#>'{pdf_asset,size_bytes}'and a.mime_type='application/pdf'and p_value#>>'{pdf_asset,mime_type}'='application/pdf'and a.width is null and a.height is null and a.duration_ms is null and a.source_asset_id is null and a.source_timestamp_ms is null),'RESULT_INVALID');
 select count(*)filter(where s->>'kind'='candidate'),count(*)filter(where s->>'kind'='pending'),coalesce(sum(jsonb_array_length(s->'frames')),0),count(*)filter(where s->>'logo_asset_id'is not null),count(*)filter(where s->>'video_asset_id'is not null)into candidate_count,pending_count,frame_count,logo_count,video_count from jsonb_array_elements(version.snapshot->'slides')s;
 proof:=p_value->'render_proof';validation:=p_value->'validation_proof';
 perform eps.specs_stage_assert(eps.specs_stage_shape(proof,array['renderer_version','chromium_version','template_content_sha256','font_hashes','page_count','width_css_px','height_css_px','overflow_count','candidate_field_count','frame_draw_count','logo_draw_count','video_link_count','fonts_ready','images_ready','rendered_at','link_targets_sha256'])and proof->>'renderer_version'=version.snapshot#>>'{render_configuration,renderer_version}'and proof->>'chromium_version'~'^[0-9]+([.][0-9]+){2,3}$'and proof->>'template_content_sha256'=version.snapshot#>>'{template,content_sha256}'and proof->'font_hashes'=version.snapshot#>'{template,font_hashes}'and proof->'page_count'=to_jsonb(version.page_count)and proof->'width_css_px'='1600'and proof->'height_css_px'='900'and proof->'overflow_count'='0'and proof->'candidate_field_count'=to_jsonb(candidate_count*10)and proof->'frame_draw_count'=to_jsonb(frame_count)and proof->'logo_draw_count'=to_jsonb(logo_count)and proof->'video_link_count'=to_jsonb(video_count)and proof->'fonts_ready'='true'and proof->'images_ready'='true'and eps.presentation_timestamp_valid(proof->'rendered_at')and proof->>'link_targets_sha256'~'^[a-f0-9]{64}$','RESULT_INVALID');
 perform eps.specs_stage_assert(eps.specs_stage_shape(validation,array['pdf_sha256','page_count','width_points','height_points','text_regions_checked','image_draws_checked','video_links_checked','embedded_font_count','validated_at'])and validation->>'pdf_sha256'=p_value#>>'{pdf_asset,sha256}'and validation->'page_count'=to_jsonb(version.page_count)and jsonb_typeof(validation->'width_points')='number'and abs((validation->>'width_points')::numeric-1200)<=0.5 and jsonb_typeof(validation->'height_points')='number'and abs((validation->>'height_points')::numeric-675)<=0.5 and validation->'text_regions_checked'=to_jsonb(3+candidate_count*23+pending_count*case when version.snapshot#>>'{template,version}'='1.1.0'then 27 else 4 end)and validation->'image_draws_checked'=to_jsonb(frame_count+logo_count)and validation->'video_links_checked'=to_jsonb(video_count)and eps.specs_stage_integer(validation->'embedded_font_count',1,6000)and eps.presentation_timestamp_valid(validation->'validated_at'),'RESULT_INVALID');
end$$;
create function eps.export_commit_result(p_job eps.jobs,p_value jsonb)returns void language plpgsql volatile security invoker set search_path=''as $$begin
 update eps.presentation_exports set status='ready',pdf_asset_id=eps.input_uuid(p_value#>>'{pdf_asset,asset_id}'),media_grant_id=eps.input_uuid(p_value->>'grant_id'),ready_at=clock_timestamp(),failure_code=null,row_version=row_version+1 where id=p_job.resource_id and job_id=p_job.id and status='rendering';perform eps.specs_stage_assert(found,'STAGE_STATE_INVALID');
end$$;
create function eps.get_export_stage_input(p_job_id uuid,p_attempt_id uuid,p_lease_token text)returns jsonb language plpgsql volatile security definer set search_path=''as $$declare job eps.jobs;snapshot jsonb;begin
 job:=eps.export_stage_current(p_job_id,p_attempt_id,p_lease_token);select v.snapshot into snapshot from eps.presentation_exports e join eps.presentation_versions v on v.id=e.version_id where e.id=job.resource_id and v.status='ready';perform eps.specs_stage_assert(found,'SNAPSHOT_INVALID');
 return job.input||jsonb_build_object('job_id',job.id,'attempt_id',p_attempt_id,'stage','render_export','input_hash',job.input_hash,'snapshot',snapshot);
end$$;
create function eps.export_job_lifecycle()returns trigger language plpgsql security definer set search_path=''as $$declare state text;begin
 if new.kind<>'presentation_export'or new.status=old.status then return new;end if;
 state:=case when new.status='running'then'rendering'when new.status in('failed','cancelled','waiting_for_input')then'failed'when new.status='queued'then'queued'else null end;
 if state is not null then
  update eps.review_media_grants set revoked_at=coalesce(revoked_at,clock_timestamp())where export_id=new.resource_id and revoked_at is null and not exists(select 1 from eps.presentation_exports e where e.id=new.resource_id and e.status='ready');
  update eps.presentation_exports set status=state,pdf_asset_id=null,media_grant_id=null,ready_at=null,failure_code=case when state='failed'then case when new.status='cancelled'then'JOB_CANCELLED'else coalesce(new.error->>'code','PROCESSING_FAILED')end else null end,row_version=row_version+1 where id=new.resource_id and job_id=new.id and status<>'ready';
 end if;return new;
end$$;
create trigger export_job_lifecycle after update of status on eps.jobs for each row execute function eps.export_job_lifecycle();
create function eps.export_asset_member(p_job eps.jobs,p_asset eps.media_assets,p_permission text)returns boolean language plpgsql volatile security invoker set search_path=''as $$begin
 if p_permission='read'and p_asset.status in('ready','archived')and exists(select 1 from eps.presentation_version_assets p where p.version_id=eps.input_uuid(p_job.input->>'version_id')and p.asset_id=p_asset.id and p.asset_kind in('client_logo','candidate_frame')and p.bucket=p_asset.bucket and p.object_key=p_asset.object_key and p.sha256=p_asset.sha256 and p.byte_size=p_asset.size_bytes and p.mime_type=p_asset.mime_type)then return true;end if;
 return p_asset.purpose='presentation_pdf'and p_asset.producing_job_id=p_job.id and p_asset.producing_attempt_id=p_job.current_attempt_id and p_asset.output_stage='render_export'and p_asset.bucket='eps-presentation-outputs'and p_asset.status in('uploading','ready')and(p_permission='read'or p_asset.status='uploading');
end$$;
create function eps.record_export_job_event(p_event jsonb)returns jsonb language plpgsql volatile security definer set search_path=''as $$
declare job eps.jobs;previous eps.job_events;receipt jsonb;digest text;attempt uuid;sequence_value bigint;at_value timestamptz;safe_error jsonb;payload_id uuid;next_stage text;begin
 perform eps.specs_stage_assert(eps.specs_stage_shape(p_event,array['event_id','job_id','attempt_id','lease_token','stage','sequence','event_type','input_hash','result_schema','result','error'],array['event_id','job_id','attempt_id','lease_token','stage','sequence','event_type','input_hash'])and octet_length(p_event::text)<=1048576 and p_event->>'stage'='render_export'and p_event->>'event_type'in('heartbeat','progress','succeeded','failed')and eps.specs_stage_integer(p_event->'sequence',1)and length(p_event->>'event_id')between 1 and 200 and p_event->>'lease_token'~'^[a-f0-9]{64}$'and p_event->>'input_hash'~'^[a-f0-9]{64}$');
 job:=eps.export_stage_lock((p_event->>'job_id')::uuid,false);at_value:=clock_timestamp();attempt:=(p_event->>'attempt_id')::uuid;sequence_value:=(p_event->>'sequence')::bigint;digest:=encode(sha256(convert_to(p_event::text,'UTF8')),'hex');
 select * into previous from eps.job_events where job_id=job.id and attempt_id=attempt and event_id=p_event->>'event_id';
 if found then perform eps.specs_stage_assert(previous.payload_digest=digest,'EVENT_ID_CONFLICT');return previous.receipt||'{"duplicate":true,"applied":false}'::jsonb;end if;
 perform eps.specs_stage_assert(not exists(select 1 from eps.job_events where job_id=job.id and attempt_id=attempt and sequence=sequence_value),'EVENT_SEQUENCE_CONFLICT');
 receipt:=jsonb_build_object('event_id',p_event->>'event_id','applied',false,'duplicate',false,'stale',false,'job_status',job.status);
 if job.status<>'running'or job.cancel_requested_at is not null or job.current_attempt_id<>attempt or job.stage<>p_event->>'stage'or job.lease_expires_at<=at_value then return receipt||'{"stale":true}'::jsonb;end if;
 perform eps.specs_stage_assert(job.lease_token_digest=encode(sha256(convert_to(p_event->>'lease_token','UTF8')),'hex'),'LEASE_INVALID');perform eps.specs_stage_assert(job.input_hash=p_event->>'input_hash','INPUT_HASH_MISMATCH');if sequence_value<=job.last_event_sequence then return receipt||'{"stale":true}'::jsonb;end if;
 if not eps.export_stage_can_write(job.requested_by,job.workspace_id)then safe_error:=eps.presentation_error('PERMISSION_CHANGED');
 elsif not eps.export_stage_matches(job)then safe_error:=eps.presentation_error('SNAPSHOT_INVALID');
 elsif p_event->>'event_type'='heartbeat'then
  perform eps.specs_stage_assert(not(p_event?'result')and not(p_event?'result_schema')and coalesce(p_event->'error','null')='null');job.heartbeat_at:=at_value;job.lease_expires_at:=at_value+interval'90seconds';
 elsif p_event->>'event_type'='progress'then
  perform eps.specs_stage_assert(eps.specs_stage_shape(p_event->'result',array['progress_completed','progress_total'])and eps.specs_stage_integer(p_event#>'{result,progress_completed}',job.progress_completed)and(p_event#>'{result,progress_total}'='null'or eps.specs_stage_integer(p_event#>'{result,progress_total}',(p_event#>>'{result,progress_completed}')::bigint)),'INVALID_PROGRESS');job.progress_completed:=(p_event#>>'{result,progress_completed}')::bigint;job.progress_total:=(p_event#>>'{result,progress_total}')::bigint;
 elsif p_event->>'event_type'='failed'then
  perform eps.specs_stage_assert(not(p_event?'result')and eps.specs_stage_shape(p_event->'error',array['code','message','details','retryable'])and jsonb_typeof(p_event#>'{error,code}')='string'and jsonb_typeof(p_event#>'{error,retryable}')='boolean');safe_error:=eps.presentation_error(p_event#>>'{error,code}',(p_event#>>'{error,retryable}')::boolean);
 else
  begin
   perform eps.specs_stage_assert(p_event->>'result_schema'='presentation-export-result.v1','RESULT_INVALID');perform eps.export_validate_result(job,p_event->'result');
   insert into eps.review_stage_payloads(job_id,workspace_id,stage,attempt_id,input_hash,result_schema,payload)values(job.id,job.workspace_id,job.stage,attempt,job.input_hash,p_event->>'result_schema',p_event->'result')returning id into payload_id;
   perform eps.export_commit_result(job,p_event->'result');
  exception when raise_exception then if sqlerrm in('RESULT_INVALID','INVALID_REQUEST')then safe_error:=eps.presentation_error('PDF_OUTPUT_UNVERIFIED');else raise;end if;end;
  if safe_error is null then
   job.completed_stages:=job.completed_stages||jsonb_build_array(jsonb_build_object('stage',job.stage,'attempt_id',attempt,'input_hash',job.input_hash,'result_schema',p_event->>'result_schema','result',jsonb_build_object('stage_output_id',payload_id),'completed_at',at_value));
   next_stage:=null;
   if next_stage is null then job.status:='succeeded';job.result:=p_event->'result';else job.status:='queued';job.stage:=next_stage;job.dispatch_generation:=job.dispatch_generation+1;job.available_at:=at_value;job.progress_completed:=0;job.progress_total:=null;end if;job.lease_token_digest:=null;job.lease_expires_at:=null;
  end if;
 end if;
 if safe_error is not null then
  job.error:=safe_error;job.lease_token_digest:=null;job.lease_expires_at:=null;
  if safe_error->'retryable'='true'and coalesce((job.stage_attempts->>job.stage)::integer,0)<3 then job.status:='queued';job.dispatch_generation:=job.dispatch_generation+1;job.available_at:=at_value+interval'2seconds';else job.status:='failed';end if;
 end if;
 update eps.jobs set status=job.status,stage=job.stage,completed_stages=job.completed_stages,result=job.result,error=job.error,last_event_sequence=sequence_value,heartbeat_at=job.heartbeat_at,lease_expires_at=job.lease_expires_at,lease_token_digest=job.lease_token_digest,available_at=job.available_at,dispatch_generation=job.dispatch_generation,progress_completed=job.progress_completed,progress_total=job.progress_total,row_version=row_version+1,updated_at=at_value where id=job.id;
 if job.status='queued'then insert into eps.outbox_events(job_id,stage,input_hash,dispatch_generation,dedupe_key,available_at)values(job.id,job.stage,job.input_hash,job.dispatch_generation,job.id::text||':'||job.dispatch_generation::text,job.available_at);end if;
 receipt:=receipt||jsonb_build_object('applied',true,'job_status',job.status);insert into eps.job_events(job_id,attempt_id,event_id,sequence,stage,event_type,payload_digest,receipt)values(job.id,attempt,p_event->>'event_id',sequence_value,p_event->>'stage',p_event->>'event_type',digest,receipt);return receipt;
end$$;
create function eps.recover_export_job_stages(p_limit integer)returns integer language plpgsql volatile security definer set search_path=''as $$
declare item record;job eps.jobs;recovered integer:=0;obsolete boolean;at_value timestamptz;begin
 perform eps.guest_cleanup_credentials();
 perform eps.specs_stage_assert(p_limit between 0 and 100);if p_limit=0 then return 0;end if;
 for item in select id,workspace_id from eps.jobs where kind='presentation_export'and status in('queued','running')order by lease_expires_at nulls last,id limit 1000 loop
  exit when recovered>=p_limit;perform 1 from eps.workspaces where id=item.workspace_id for update skip locked;if not found then continue;end if;
  job:=eps.export_stage_lock(item.id,false);if job.status not in('queued','running')or job.cancel_requested_at is not null then continue;end if;at_value:=clock_timestamp();
  if not eps.export_stage_can_write(job.requested_by,job.workspace_id)then job.status:='failed';job.error:=eps.presentation_error('PERMISSION_CHANGED');
  elsif not eps.export_stage_matches(job)then job.status:='failed';job.error:=eps.presentation_error('SNAPSHOT_INVALID');
  elsif job.status='queued'or job.lease_expires_at>at_value then continue;
  elsif coalesce((job.stage_attempts->>job.stage)::integer,0)>=3 then job.status:='failed';job.error:=eps.presentation_error('RETRY_EXHAUSTED');
  else job.status:='queued';job.error:=eps.presentation_error('LEASE_EXPIRED',true);job.dispatch_generation:=job.dispatch_generation+1;job.available_at:=at_value+interval'2seconds';end if;
  update eps.jobs set status=job.status,error=job.error,lease_token_digest=null,lease_expires_at=null,available_at=job.available_at,dispatch_generation=job.dispatch_generation,row_version=row_version+1,updated_at=at_value where id=job.id;
  if job.status='queued'then insert into eps.outbox_events(job_id,stage,input_hash,dispatch_generation,dedupe_key,available_at)values(job.id,job.stage,job.input_hash,job.dispatch_generation,job.id::text||':'||job.dispatch_generation::text,job.available_at);end if;recovered:=recovered+1;
 end loop;return recovered;
end$$;
create function eps.claim_export_job_stage(p_input jsonb)returns jsonb language plpgsql volatile security definer set search_path=''as $$
declare job eps.jobs;completed jsonb;token text;attempts integer;at_value timestamptz;begin
 perform eps.specs_stage_assert(eps.specs_stage_shape(p_input,array['job_id','stage','input_hash','workflow_execution_id'],array['job_id','stage','input_hash'])and p_input->>'stage'='render_export'and p_input->>'input_hash'~'^[a-f0-9]{64}$');
 job:=eps.export_stage_lock((p_input->>'job_id')::uuid);at_value:=clock_timestamp();
 perform eps.specs_stage_assert(exists(select 1 from eps.presentation_processing_config where id and enabled),'DEPENDENCY_UNAVAILABLE');
 perform eps.specs_stage_assert(eps.export_stage_matches(job),'SNAPSHOT_INVALID');perform eps.specs_stage_assert(job.input_hash=p_input->>'input_hash','INPUT_HASH_MISMATCH');
 if job.status='cancelled'or job.cancel_requested_at is not null then perform eps.fail('JOB_CANCELLED','Presentation processing was cancelled.',409);end if;
 select value into completed from jsonb_array_elements(job.completed_stages)value where value->>'stage'=p_input->>'stage'and value->>'input_hash'=job.input_hash;
 if completed is not null then return jsonb_build_object('job_id',job.id,'stage',p_input->>'stage','attempt_id',completed->>'attempt_id','lease_token','','lease_expires_at',completed->>'completed_at','already_completed',true,'input',jsonb_build_object('input_hash',job.input_hash,'result_schema',completed->>'result_schema','result',completed->'result'));end if;
 perform eps.specs_stage_assert(job.stage=p_input->>'stage','STAGE_OUT_OF_ORDER');
 if job.status='running'and job.lease_expires_at>at_value then perform eps.fail('JOB_ALREADY_RUNNING','This stage already has an active lease.',409);end if;
 perform eps.specs_stage_assert(job.status in('queued','running')and job.available_at<=at_value,'JOB_NOT_AVAILABLE');update eps.review_media_grants set revoked_at=coalesce(revoked_at,at_value)where export_id=job.resource_id and revoked_at is null;attempts:=coalesce((job.stage_attempts->>job.stage)::integer,0);perform eps.specs_stage_assert(attempts<3,'RETRY_EXHAUSTED');token:=encode(extensions.gen_random_bytes(32),'hex');
 update eps.jobs set status='running',attempt=attempt+1,current_attempt_id=gen_random_uuid(),lease_token_digest=encode(sha256(convert_to(token,'UTF8')),'hex'),lease_expires_at=at_value+interval'90seconds',heartbeat_at=at_value,last_event_sequence=0,stage_attempts=jsonb_set(stage_attempts,array[stage],to_jsonb(attempts+1)),progress_completed=0,progress_total=null,error=null,n8n_execution_id=p_input->>'workflow_execution_id',row_version=row_version+1,updated_at=at_value where id=job.id returning * into job;
 return jsonb_build_object('job_id',job.id,'stage',job.stage,'attempt_id',job.current_attempt_id,'lease_token',token,'lease_expires_at',job.lease_expires_at,'already_completed',false,'input',job.input||jsonb_build_object('input_hash',job.input_hash));
end$$;
create function eps.get_export_asset_access(p_input jsonb)returns jsonb language plpgsql volatile security definer set search_path=''as $$
declare job eps.jobs;asset eps.media_assets;permission text;token text;at_value timestamptz;expiry timestamptz;begin
 perform eps.specs_stage_assert(eps.specs_stage_shape(p_input,array['job_id','attempt_id','lease_token','asset_id','access'],array['job_id','attempt_id','lease_token','asset_id']));
 job:=eps.export_stage_current(eps.input_uuid(p_input->>'job_id'),eps.input_uuid(p_input->>'attempt_id'),p_input->>'lease_token');permission:=coalesce(p_input->>'access','read');perform eps.specs_stage_assert(permission in('read','write'));
 select * into asset from eps.media_assets where id=eps.input_uuid(p_input->>'asset_id');if not found or not eps.export_asset_member(job,asset,permission)then perform eps.fail('RESOURCE_NOT_FOUND','Asset not available to this captured version stage.',404);end if;
 at_value:=clock_timestamp();expiry:=least(job.lease_expires_at,at_value+interval'60seconds');perform eps.specs_stage_assert(expiry>at_value,'STALE_STAGE_LEASE');token:=rtrim(translate(replace(encode(extensions.gen_random_bytes(32),'base64'),E'\n',''),'+/','-_'),'=');
 insert into eps.presentation_asset_grants(token_digest,job_id,attempt_id,input_hash,version_id,asset_id,bucket,object_key,permission,created_at,expires_at)values(encode(sha256(convert_to(token,'UTF8')),'hex'),job.id,job.current_attempt_id,job.input_hash,eps.input_uuid(job.input->>'version_id'),asset.id,asset.bucket,asset.object_key,permission,at_value,expiry);
 return jsonb_build_object('asset_id',asset.id,'bucket',asset.bucket,'object_key',asset.object_key,'permission',permission,'grant_token',token,'expires_at',expiry,'mime_type',asset.mime_type,'size_bytes',asset.size_bytes,'sha256',asset.sha256);
end$$;
create function eps.reserve_export_job_output(p_input jsonb)returns jsonb language plpgsql volatile security definer set search_path=''as $$
declare job eps.jobs;existing eps.media_assets;asset_id uuid:=gen_random_uuid();expected_size bigint;kind text;mime text;filename text;extension text;begin
 perform eps.specs_stage_assert(eps.specs_stage_shape(p_input,array['job_id','attempt_id','lease_token','output_key','asset_kind','filename','mime_type','expected_size_bytes','parent_asset_id','time_offset_ms']));job:=eps.export_stage_current(eps.input_uuid(p_input->>'job_id'),eps.input_uuid(p_input->>'attempt_id'),p_input->>'lease_token');
 kind:=p_input->>'asset_kind';perform eps.specs_stage_assert(job.stage='render_export'and kind='presentation_pdf'and p_input->>'output_key'=kind and p_input->'parent_asset_id'='null'and p_input->'time_offset_ms'='null');
 mime:=case kind when'presentation_pdf'then'application/pdf'else'application/json'end;filename:=case kind when'presentation_pdf'then'presentation.pdf'else'presentation-manifest.json'end;extension:=case kind when'presentation_pdf'then'pdf'else'json'end;
 perform eps.specs_stage_assert(p_input->>'mime_type'=mime and p_input->>'filename'=filename);expected_size:=eps.logo_integer(p_input->'expected_size_bytes',1,case kind when'presentation_pdf'then 67108864 else 8388608 end);
 select * into existing from eps.media_assets where producing_job_id=job.id and producing_attempt_id=job.current_attempt_id and output_key=kind;
 if found then if existing.purpose<>kind or existing.size_bytes<>expected_size or existing.mime_type<>mime or existing.filename<>filename or existing.output_stage<>job.stage then perform eps.fail('IDEMPOTENCY_KEY_REUSED','Logical presentation output metadata changed.',409);end if;
 else insert into eps.media_assets(id,origin_workspace_id,purpose,filename,mime_type,bucket,object_key,size_bytes,status,producing_job_id,producing_attempt_id,output_stage,output_key)
  values(asset_id,job.workspace_id,kind,filename,mime,'eps-presentation-outputs','jobs/'||job.id||'/attempts/'||job.current_attempt_id||'/'||asset_id||'.'||extension,expected_size,'uploading',job.id,job.current_attempt_id,job.stage,kind)returning * into existing;end if;
 return jsonb_build_object('asset',eps.presentation_media_dto(existing),'bucket',existing.bucket,'object_key',existing.object_key);
end$$;
create function eps.complete_export_job_output(p_input jsonb)returns jsonb language plpgsql volatile security definer set search_path=''as $$
declare job eps.jobs;asset eps.media_assets;begin
 perform eps.specs_stage_assert(eps.specs_stage_shape(p_input,array['job_id','attempt_id','lease_token','asset_id','sha256','actual_size_bytes','width','height','duration_ms']));job:=eps.export_stage_current(eps.input_uuid(p_input->>'job_id'),eps.input_uuid(p_input->>'attempt_id'),p_input->>'lease_token');
 select * into asset from eps.media_assets where id=eps.input_uuid(p_input->>'asset_id')and producing_job_id=job.id and producing_attempt_id=job.current_attempt_id and output_stage=job.stage and purpose='presentation_pdf';if not found or job.stage<>'render_export'then perform eps.fail('RESOURCE_NOT_FOUND','Presentation output is not in the active attempt.',404);end if;
 perform eps.specs_stage_assert(p_input->>'sha256'~'^[a-f0-9]{64}$'and eps.logo_integer(p_input->'actual_size_bytes',1,67108864)=asset.size_bytes and p_input->'width'='null'and p_input->'height'='null'and p_input->'duration_ms'='null');
 if asset.status='ready'then if asset.sha256 is distinct from p_input->>'sha256' then perform eps.fail('IDEMPOTENCY_KEY_REUSED','Presentation output already contains different verified bytes.',409);end if;
 else perform eps.specs_stage_assert(asset.status='uploading','INVALID_TRANSITION');update eps.media_assets set status='ready',sha256=p_input->>'sha256'where id=asset.id returning * into asset;end if;return eps.presentation_media_dto(asset);
end$$;
create function eps.export_capability_allowed(p_bucket text,p_key text,p_permission text)returns boolean language plpgsql volatile security definer set search_path=''as $$
declare headers jsonb;token text;begin
 if p_bucket not in('eps-brand-assets','eps-candidate-assets','eps-candidate-outputs','eps-presentation-outputs')or p_permission not in('read','write')then return false;end if;
 begin headers:=nullif(current_setting('request.headers',true),'')::jsonb;exception when others then return false;end;token:=headers->>'x-eps-asset-grant';if token is null or token!~'^[A-Za-z0-9_-]{43}$'then return false;end if;
 return exists(select 1 from eps.presentation_asset_grants g join eps.jobs j on j.id=g.job_id join eps.media_assets a on a.id=g.asset_id where g.token_digest=encode(sha256(convert_to(token,'UTF8')),'hex')and g.bucket=p_bucket and g.object_key=p_key and g.permission=p_permission and g.version_id=eps.input_uuid(j.input->>'version_id') and g.expires_at>clock_timestamp()and a.bucket=p_bucket and a.object_key=p_key and eps.export_stage_live(j.id,g.attempt_id,g.input_hash)and eps.export_asset_member(j,a,p_permission)
 and(p_permission='read'or p_bucket='eps-presentation-outputs'and headers->>'x-upsert'='false'and headers->>'content-type'=a.mime_type));
end$$;
-- Only the PDF branch accepts the export stage; manifests remain render-only.
do $$declare source text;changed text;begin
 select pg_get_constraintdef(oid)into source from pg_constraint where conrelid='eps.media_assets'::regclass and conname='media_assets_typed_purpose_check';
 changed:=replace(source,'(output_stage = ''render_presentation''::text) AND (output_key = ''presentation_pdf''::text)','(output_stage = ANY(ARRAY[''render_presentation''::text,''render_export''::text])) AND (output_key = ''presentation_pdf''::text)');
 if changed=source then raise exception'M06_PDF_ASSET_CHECK_ANCHOR_REQUIRED';end if;
 alter table eps.media_assets drop constraint media_assets_typed_purpose_check;execute'alter table eps.media_assets add constraint media_assets_typed_purpose_check '||changed;
end$$;
create policy export_jobs_service_read on eps.jobs for select to eps_review_stage_owner using(kind='presentation_export');
create policy export_jobs_service_update on eps.jobs for update to eps_review_stage_owner using(kind='presentation_export')with check(kind='presentation_export');
grant select,insert,update on eps.presentation_exports,eps.review_media_grants to eps_review_stage_owner;
create policy export_stage_rows on eps.presentation_exports for all to eps_review_stage_owner using(true)with check(true);
create policy export_stage_grants on eps.review_media_grants for all to eps_review_stage_owner using(true)with check(true);
grant select,update(id)on eps.review_links to eps_review_stage_owner;
create policy export_stage_link_read on eps.review_links for select to eps_review_stage_owner using(true);
create policy export_stage_link_never_write on eps.review_links as restrictive for update to eps_review_stage_owner using(true)with check(false);
create policy export_asset_jobs_read on eps.jobs for select to eps_candidate_assets_owner using(kind='presentation_export');
create policy export_asset_service_insert on eps.media_assets for insert to eps_candidate_assets_owner with check(purpose='presentation_pdf'and status='uploading'and bucket='eps-presentation-outputs'and output_stage='render_export'and sha256 is null and eps.export_stage_live(producing_job_id,producing_attempt_id,(select input_hash from eps.jobs where id=producing_job_id)));
create policy export_asset_service_complete on eps.media_assets for update to eps_candidate_assets_owner using(purpose='presentation_pdf'and output_stage='render_export'and status='uploading'and eps.export_stage_live(producing_job_id,producing_attempt_id,(select input_hash from eps.jobs where id=producing_job_id)))with check(status='ready'and sha256 is not null);
create policy export_service_storage_read on storage.objects for select to anon using((storage.allow_only_operation('object.get_authenticated')or storage.allow_only_operation('object.get_authenticated_info'))and eps.export_capability_allowed(bucket_id,name,'read'));
create policy export_service_storage_write on storage.objects for insert to anon with check(bucket_id='eps-presentation-outputs'and storage.allow_only_operation('object.upload')and eps.export_capability_allowed(bucket_id,name,'write'));
do $$declare item record;qual text;begin
 for item in select polname,pg_get_expr(polqual,polrelid)body from pg_policy where polrelid='storage.objects'::regclass and polname in('eps_logo_read_guard','eps_candidate_read_guard','presentation_output_read_guard')loop
  qual:='('||item.body||') OR((storage.allow_only_operation(''object.get_authenticated'')OR storage.allow_only_operation(''object.get_authenticated_info''))AND eps.export_capability_allowed(bucket_id,name,''read''))';execute format('alter policy %I on storage.objects using(%s)',item.polname,qual);
 end loop;
 select pg_get_expr(polwithcheck,polrelid)into qual from pg_policy where polrelid='storage.objects'::regclass and polname='presentation_output_insert_guard';
 if qual is null then raise exception'M06_OUTPUT_INSERT_GUARD_REQUIRED';end if;
 execute'alter policy presentation_output_insert_guard on storage.objects with check(('||qual||')OR(bucket_id=''eps-presentation-outputs''AND storage.allow_only_operation(''object.upload'')AND eps.export_capability_allowed(bucket_id,name,''write'')))';
end$$;
create function eps.export_job_actions(p_job eps.jobs)returns jsonb language plpgsql volatile security definer set search_path=''as $$declare operator boolean;principal uuid;begin
 principal:=coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid;
 operator:=eps.job_requester_active(principal)and exists(select 1 from eps.workspaces w join public.projects p on p.id=w.project_id join public.project_memberships m on m.project_id=p.id where w.id=p_job.workspace_id and w.archived_at is null and p.archived_at is null and m.principal_id=principal and m.active and m.can_write)and exists(select 1 from public.app_capability_grants where principal_id=principal and capability='operations.retry'and active);
 return jsonb_build_object('can_retry',coalesce(operator and p_job.status='failed'and p_job.cancel_requested_at is null and p_job.error->>'code'is distinct from'JOB_CANCELLED'and eps.export_stage_can_write(p_job.requested_by,p_job.workspace_id)and eps.export_stage_matches(p_job),false),'can_cancel',coalesce(operator and p_job.status in('queued','running','waiting_for_input'),false));
end$$;
create function eps.export_stage_authorized(p_job eps.jobs)returns boolean language sql volatile security definer set search_path=''as $$select eps.export_stage_can_write(p_job.requested_by,p_job.workspace_id)and eps.export_stage_matches(p_job)$$;
-- Preserve the exact preceding 24 port bodies; only closed export branches are
-- added. Any unexpected predecessor source refuses this additive composition.
do $dispatch$declare item record;source text;definition text;replacement text;at_value integer;begin
 for item in select * from(values
 ('eps.claim_job_stage(jsonb)','7e139435fb01a038b9d4784f0b472651da8ac0527c1d4769a773bdedc4227dc5','if p_input->>''stage''=''render_export''then return eps.claim_export_job_stage(p_input);end if;'),
 ('eps.get_specs_stage_input(uuid,uuid,text)','338808bae51ee21bc1aff2d0c65b3eb8f1ec667b9c507fe8cf0920400766f330','if eps.export_is_job(p_job_id)then return eps.get_export_stage_input(p_job_id,p_attempt_id,p_lease_token);end if;'),
 ('eps.record_job_event(jsonb)','8a839f89c45f946087354e1eae83ccfe2fbed6943b18a54fed1f0a3160f5e10f','if p_event->>''stage''=''render_export''then return eps.record_export_job_event(p_event);end if;'),
 ('eps.get_job_asset_access(jsonb)','fac1a429c888e477f1e0ef30a2604937bed1452bc03d3875ff52fd813fd9b01a','if eps.export_is_job(eps.input_uuid(p_input->>''job_id''))then return eps.get_export_asset_access(p_input);end if;'),
 ('eps.reserve_job_output(jsonb)','0b4340732fb7936e780189ee19186f5fc6e29d6f65ab3c91165c4157b96ca43b','if eps.export_is_job(eps.input_uuid(p_input->>''job_id''))then return eps.reserve_export_job_output(p_input);end if;'),
 ('eps.complete_job_output(jsonb)','e51f4a5583b92557ae009c0a8978c56d5b12149e86011c2ce2ae1649f6422846','if eps.export_is_job(eps.input_uuid(p_input->>''job_id''))then return eps.complete_export_job_output(p_input);end if;'),
 ('eps.recover_job_stages(integer)','6a10aa16f88611f4e6f0a297997f7d3a6cbc2c522d78a6632e0eff5a68cb2581',''),
 ('eps.claim_job_stage_replay(jsonb,text,text,text)','6dae7e05270e69e819640fcaaf510739f5b2f9ce1892ef6d630cf56fa2dc73b4',''),
 ('eps.jobs_dto(uuid)','d74480b632637a5fd74b1b52146cf7969aa2ef87e78e6da1b1f8132b898efac8',''),
 ('public.eps_retry_job(uuid,jsonb,text)','dc039309d507a2831e2fb1cd8326b0bf6abfc88bf3140a92c2c50bb331dfbd74',''),
 ('public.eps_cancel_job(uuid,jsonb,text)','0fe9e90423ac30ca3592291c0d1a5b8dbcda3bc8c937941d8b286aa3008e9b82','')
 )v(signature,expected,dispatch)loop
  select replace(prosrc,E'\r\n',E'\n'),replace(pg_get_functiondef(oid),E'\r\n',E'\n')into source,definition from pg_proc where oid=item.signature::regprocedure;
  if encode(sha256(convert_to(source,'UTF8')),'hex')<>item.expected then raise exception'M06_EXACT_PRECEDING_PORT_SOURCE_REQUIRED:%',item.signature;end if;replacement:=source;
  if item.dispatch<>''then at_value:=position('begin'in source);replacement:=overlay(source placing E'begin\n '||item.dispatch||E'\n'from at_value for 6);
  elsif item.signature='eps.recover_job_stages(integer)'then replacement:=replace(source,'recovered:=eps.recover_presentation_job_stages(p_limit);','recovered:=eps.recover_export_job_stages(p_limit);recovered:=recovered+eps.recover_presentation_job_stages(p_limit-recovered);');
  elsif item.signature='eps.claim_job_stage_replay(jsonb,text,text,text)'then
   replacement:=replace(source,'if eps.presentation_is_job(old.job_id)then','if eps.export_is_job(old.job_id)then job:=eps.export_stage_lock(old.job_id);elsif eps.presentation_is_job(old.job_id)then');
   replacement:=replace(replacement,'case when job.kind=''presentation_render''','case when job.kind=''presentation_export''then eps.export_stage_matches(job)when job.kind=''presentation_render''');
  elsif item.signature='eps.jobs_dto(uuid)'then replacement:=replace(source,'||case when kind=''presentation_render''then','||case when kind=''presentation_export''then eps.export_job_actions(jobs)else''{}''::jsonb end'||E'\n    '||'||case when kind=''presentation_render''then');
  elsif item.signature='public.eps_retry_job(uuid,jsonb,text)'then
   replacement:=replace(source,'  if response is not null then return response; end if;',E'  if job.kind=''presentation_export''and not eps.export_stage_authorized(job)then perform eps.fail(''PERMISSION_CHANGED'',''The link owner no longer has export authority.'',403);end if;\n  if response is not null then return response; end if;');
   replacement:=replace(replacement,'or job.kind<>''presentation_render''and(', 'or job.kind=''presentation_export''and(eps.export_job_actions(job)->''can_retry'')is distinct from''true''::jsonb or job.kind not in(''presentation_render'',''presentation_export'')and(');
   replacement:=replace(replacement,'case when kind=''presentation_render''then stage_attempts-stage','case when kind in(''presentation_render'',''presentation_export'')then stage_attempts-stage');
  else replacement:=replace(source,'  if job.status=''succeeded'' then',E'  if job.kind=''presentation_export''and job.status not in(''queued'',''running'',''waiting_for_input'',''cancelled'')then perform eps.fail(''INVALID_TRANSITION'',''This export job cannot be cancelled.'',409);end if;\n  if job.status=''succeeded'' then');end if;
  if replacement=source then raise exception'M06_PORT_DISPATCH_ANCHOR_REQUIRED:%',item.signature;end if;execute replace(definition,source,replacement);
 end loop;
end$dispatch$;
grant create on schema eps to eps_review_stage_owner,eps_candidate_assets_owner;
do $owners$declare item record;owner_name text;begin
 for item in select p.oid::regprocedure signature,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='eps'and p.proname<>'export_storage_read_allowed'and(p.proname like'export_%'or p.proname in('mint_review_media_grant','claim_export_job_stage','get_export_stage_input','record_export_job_event','recover_export_job_stages','get_export_asset_access','reserve_export_job_output','complete_export_job_output'))loop
  owner_name:=case when item.proname in('export_asset_member','export_capability_allowed','get_export_asset_access','reserve_export_job_output','complete_export_job_output')then'eps_candidate_assets_owner'else'eps_review_stage_owner'end;
  execute format('alter function %s owner to %I',item.signature,owner_name);execute format('revoke all on function %s from public,anon,authenticated,service_role',item.signature);
 end loop;
end$owners$;
revoke create on schema eps from eps_review_stage_owner,eps_candidate_assets_owner;
grant execute on function eps.guest_link_live(eps.review_links),eps.presentation_timestamp_valid(jsonb)to eps_review_stage_owner;
grant execute on function eps.export_is_job(uuid),eps.export_stage_lock(uuid,boolean),eps.export_stage_matches(eps.jobs),eps.claim_export_job_stage(jsonb),eps.get_export_stage_input(uuid,uuid,text),eps.record_export_job_event(jsonb),eps.recover_export_job_stages(integer)to eps_specs_stage_owner;
grant execute on function eps.export_is_job(uuid),eps.get_export_asset_access(jsonb),eps.reserve_export_job_output(jsonb),eps.complete_export_job_output(jsonb)to eps_specs_assets_owner;
grant execute on function eps.export_stage_current(uuid,uuid,text),eps.export_stage_live(uuid,uuid,text)to eps_candidate_assets_owner;
grant execute on function eps.export_job_actions(eps.jobs),eps.export_stage_authorized(eps.jobs)to eps_jobs_owner;
grant execute on function eps.export_capability_allowed(text,text,text)to anon,authenticated;
-- One explicit new runtime operation; no login, membership, table or schema
-- privilege is added to the existing worker principal.
grant execute on function eps.mint_review_media_grant(jsonb)to eps_jobs_executor;


-- Exact candidate fragment: development/m06/finalize.sql
-- Only the new public wrappers are reachable. All private helpers remain closed.
grant create on schema eps,public to eps_guest_owner,eps_review_owner;
do $$declare item record;owner_name text;begin
 for item in select p.oid::regprocedure signature,p.proname,n.nspname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where(n.nspname='public'and p.proname=any(array['eps_list_review_links','eps_create_review_link','eps_update_review_link','eps_revoke_review_link','eps_rotate_review_link','eps_list_feedback','eps_create_comment','eps_update_comment','eps_set_preference','eps_prepare_pdf_export','eps_get_pdf_export','eps_get_pdf_export_asset','eps_guest_operation']))
 or(n.nspname='eps'and p.proname=any(array['guest_cleanup_credentials','guest_link_live','review_link_dto','presentation_export_dto','review_link_scope','review_link_require','review_expiry','review_credential','review_token_replay','feedback_comment_dto','feedback_preference_dto','feedback_version','feedback_page','feedback_mutate','feedback_internal_require','review_gateway_verify','review_gateway_rate','guest_link_for','guest_current','guest_access_dto','guest_version_dto','guest_replay','guest_prepare_export','guest_asset_issue','guest_export_access','guest_storage_allowed','export_storage_read_allowed']))loop
  owner_name:=case when item.proname in('eps_guest_operation','guest_prepare_export','guest_storage_allowed')or item.nspname='eps'and(item.proname like'guest_%'or item.proname like'review_gateway_%')then'eps_guest_owner'else'eps_review_owner'end;
  execute format('alter function %s owner to %I',item.signature,owner_name);execute format('revoke all on function %s from public,anon,authenticated,service_role',item.signature);
  if item.nspname='eps'then execute format('grant execute on function %s to eps_guest_owner,eps_review_owner',item.signature);end if;
 end loop;
end$$;
revoke create on schema eps,public from eps_guest_owner,eps_review_owner;
grant execute on function public.eps_list_review_links(jsonb),public.eps_create_review_link(uuid,jsonb,jsonb,text),public.eps_update_review_link(uuid,jsonb,text),public.eps_revoke_review_link(uuid,jsonb,text),public.eps_rotate_review_link(uuid,jsonb,jsonb,text),public.eps_list_feedback(uuid,jsonb),public.eps_create_comment(uuid,jsonb,text),public.eps_update_comment(uuid,jsonb,text),public.eps_set_preference(uuid,jsonb,text),public.eps_prepare_pdf_export(jsonb,text),public.eps_get_pdf_export(uuid),public.eps_get_pdf_export_asset(uuid)to authenticated;
grant execute on function public.eps_guest_operation(text,jsonb,jsonb)to anon,authenticated;
grant execute on function eps.guest_storage_allowed(text,text),eps.export_storage_read_allowed(text,text)to anon,authenticated;
grant execute on function eps.guest_link_live(eps.review_links),eps.presentation_export_dto(eps.presentation_exports)to eps_review_stage_owner,eps_candidate_assets_owner;
grant execute on function eps.guest_cleanup_credentials()to eps_review_stage_owner;
-- Backend keys are intentionally absent; root provisions a distinct verifier
-- through the established encrypted, scoped bootstrap after local proofs.

