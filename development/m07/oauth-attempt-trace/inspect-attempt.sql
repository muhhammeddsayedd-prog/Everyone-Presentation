-- Fixed, read-only metadata projection for the owner's failed 12:45 UTC attempt.
-- No raw selector, code, state, challenge, credential, IP, email or user-agent output.
begin isolation level repeatable read read only;
set local search_path='';
set local timezone='UTC';
set local statement_timeout='20s';
with recent as (
 select a.client_id,a.user_id,a.redirect_uri,a.scope,a.resource,a.status,a.created_at,a.expires_at,
  encode(sha256(convert_to(a.authorization_id,'UTF8')),'hex') as selector_hash
 from auth.oauth_authorizations a
 where a.created_at>='2026-10-31T12:30:00Z'::timestamptz
  and a.created_at<='2026-10-31T12:46:00Z'::timestamptz
 order by a.created_at desc limit 50
), attempts as (
 select jsonb_build_object(
  'client_id',a.client_id,'client_is_expected',a.client_id='f2acafd5-d4b6-4176-b86c-067c57e45ecc'::uuid,
  'created_at',a.created_at,'expires_at',a.expires_at,
  'status',case when a.status::text in('pending','approved','denied','expired')then a.status::text else '[other]'end,
  'scope',case when length(a.scope)<=256 and a.scope~'^(openid|profile|email|offline_access|phone|address)( (openid|profile|email|offline_access|phone|address))*$'then a.scope else '[other]'end,
  'callback',case when a.redirect_uri~'^http://(localhost|127[.]0[.]0[.]1):[0-9]{1,5}/callback$'
    or a.redirect_uri='https://claude.ai/api/mcp/auth_callback'then a.redirect_uri else '[other]'end,
  'callback_class',case when a.redirect_uri='https://claude.ai/api/mcp/auth_callback'then 'claude_ai'
    when a.redirect_uri~'^http://(localhost|127[.]0[.]0[.]1):[0-9]{1,5}/callback$'then 'http_loopback_callback'else 'other'end,
  'callback_matches_registered',coalesce(a.redirect_uri=any(string_to_array(c.redirect_uris,',')),false),
  'callback_matches_expected',a.redirect_uri='http://localhost:3118/callback',
  'user_is_null',a.user_id is null,'user_is_owner',coalesce(a.user_id='0a79a703-caba-47e5-93d4-42e32197037a'::uuid,false),
  'resource_is_null',a.resource is null,'resource_matches_expected',coalesce(a.resource='https://everyone-presentation-pilot.vercel.app/mcp',false),
  'enabled_registry_matches',(select count(*)from eps.mcp_oauth_resources r where r.client_id=a.client_id and r.resource='https://everyone-presentation-pilot.vercel.app/mcp'and r.enabled),
  'enabled_client_registry_count',(select count(*)from eps.mcp_oauth_resources r where r.client_id=a.client_id and r.enabled),
  'claim_exists',q.authorization_hash is not null,
  'claim_outcome',case when q.outcome in('claimed','consent_ready','redirect','uncertain','rejected')then q.outcome else null end
 )as item,a.created_at
 from recent a left join auth.oauth_clients c on c.id=a.client_id
 left join eps.oauth_consent_claims q on q.authorization_hash=a.selector_hash
), expected_client as (
 select jsonb_build_object('client_id',c.id,'not_deleted',c.deleted_at is null,
  'client_type',case when c.client_type::text in('public','confidential')then c.client_type::text else '[other]'end,
  'registration_type',case when c.registration_type::text in('manual','dynamic')then c.registration_type::text else '[other]'end,
  'token_endpoint_auth_method',case when c.token_endpoint_auth_method in('none','client_secret_basic','client_secret_post')then c.token_endpoint_auth_method else '[other]'end,
  'grant_types',case when c.grant_types~'^(authorization_code|refresh_token)(,(authorization_code|refresh_token))*$'then c.grant_types else '[other]'end,
  'registered_callbacks',(select coalesce(jsonb_agg(case when uri~'^http://(localhost|127[.]0[.]0[.]1):[0-9]{1,5}/callback$'
    or uri='https://claude.ai/api/mcp/auth_callback'then uri else '[other]'end order by uri),'[]'::jsonb)
    from unnest(string_to_array(c.redirect_uris,','))uri),
  'registered_expected_callback','http://localhost:3118/callback'=any(string_to_array(c.redirect_uris,',')))as item
 from auth.oauth_clients c where c.id='f2acafd5-d4b6-4176-b86c-067c57e45ecc'::uuid
)
select jsonb_build_object('database',current_database(),'operator',current_user,'observed_at',clock_timestamp(),
 'window_start','2026-10-31T12:30:00Z','window_end','2026-10-31T12:46:00Z','limit',50,
 'attempts',coalesce((select jsonb_agg(item order by created_at desc)from attempts),'[]'::jsonb),
 'expected_clients',coalesce((select jsonb_agg(item)from expected_client),'[]'::jsonb),
 'history_count',(select count(*)from supabase_migrations.schema_migrations))as oauth_attempt_metadata;
rollback;
