-- Owned full33 synthetic fixture; original29 and actual provider are untouched.
insert into auth.oauth_clients(id,client_name,redirect_uris,client_type,token_endpoint_auth_method,grant_types,response_types,registration_type)
 values('33000000-0000-4000-8000-000000000001','Synthetic recovery33 client','http://localhost:3118/callback','public','none',array['authorization_code','refresh_token'],array['code'],'manual');
insert into auth.sessions(id,user_id,oauth_client_id,not_after,scopes)
 values('33000000-0000-4000-8000-000000000002','8a1a0000-0000-4000-8000-000000000001',null,'2099-01-01T00:00:00Z','openid');
insert into eps.mcp_oauth_resources(resource,client_id,enabled)
 values('https://studio.example.invalid/mcp','33000000-0000-4000-8000-000000000001',true);
insert into auth.oauth_authorizations(authorization_id,client_id,redirect_uri,scope,resource,expires_at)
 values(repeat('a',32),'33000000-0000-4000-8000-000000000001','http://localhost:3118/callback','openid','https://studio.example.invalid/mcp','2099-01-01T00:00:00Z');
select set_config('request.jwt.claims','{"sub":"8a1a0000-0000-4000-8000-000000000001","role":"authenticated","aud":"authenticated","is_anonymous":false,"session_id":"33000000-0000-4000-8000-000000000002"}',true);
set local role authenticated;
select set_config('eps.recovery33.claim',(public.eps_oauth_consent_claim(repeat('a',32),'https://studio.example.invalid/mcp','details','33000000-0000-4000-8000-000000000003')->>'claim_id'),true);
set local role postgres;
update auth.oauth_authorizations set user_id='8a1a0000-0000-4000-8000-000000000001'where authorization_id=repeat('a',32);
set local role authenticated;
select public.eps_oauth_consent_finish(repeat('a',32),'https://studio.example.invalid/mcp',current_setting('eps.recovery33.claim')::uuid,'consent_ready');
set local role postgres;
