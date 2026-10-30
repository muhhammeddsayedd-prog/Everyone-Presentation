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
