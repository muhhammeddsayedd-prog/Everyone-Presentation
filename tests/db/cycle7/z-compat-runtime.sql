-- m21 previous-client response compatibility + the worker runtime login's exact executable surface.
-- Run after every migration as supabase_admin. Synthetic data only; one transaction, rolled back. Every failed check raises.
-- Found on the staging rehearsal: (1) the previous web release rejects responses carrying cycle-7 keys; (2) helper
-- functions granted to PUBLIC widen the runtime login's executable set, which the worker refuses at startup.
begin;
set local search_path='';
create function pg_temp.check(p_ok boolean, p_label text) returns void language plpgsql as $$ begin
  if p_ok is not true then raise exception 'Z_CHECK_FAILED %', p_label; end if;
  perform set_config('eps.z_checks', (coalesce(nullif(current_setting('eps.z_checks', true), ''), '0')::integer + 1)::text, true);
end $$;

-- 1. Runtime login surface: exactly the 12 hosted operations (guest exports enabled), nothing else.
select pg_temp.check((select array_agg(x order by x) from (select n.nspname||'.'||p.proname x from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where (n.nspname='eps' or n.nspname='public' and (p.proname like 'eps\_%' escape '\' or p.prosecdef)) and has_function_privilege('eps_specs_runtime',p.oid,'EXECUTE')) f)
  = (select array_agg(x order by x) from unnest(array['eps.claim_job_outbox','eps.claim_job_stage','eps.claim_job_stage_replay','eps.complete_job_output','eps.finish_job_outbox','eps.get_job_asset_access',
          'eps.get_specs_stage_input','eps.mint_review_media_grant','eps.record_job_event','eps.recover_job_stages','eps.reserve_job_output','eps.store_specs_preparation']) x),
  'runtime login executes exactly the 12 hosted operations');
select pg_temp.check(not exists(select 1 from pg_proc p where p.pronamespace='eps'::regnamespace and p.proname like 'appearance\_%' and has_function_privilege('public',p.oid,'EXECUTE')),
  'no appearance helper is executable by PUBLIC');
select pg_temp.check(not exists(select 1 from pg_proc p where p.pronamespace='eps'::regnamespace
  and p.proname in('previous_client','settings_dto','specs_role_dto','specs_slot_dto','review_series_dto','cast_pool_dto','cast_library_dto','jobs_dto',
   'settings_dto_cycle7','specs_role_dto_cycle7','specs_slot_dto_cycle7','review_series_dto_cycle7','cast_pool_dto_cycle7','cast_library_dto_cycle7','jobs_dto_cycle7')
  and has_function_privilege('public',p.oid,'EXECUTE')), 'response builders and the client gate are not executable by PUBLIC');

select pg_temp.check(has_function_privilege('eps_appearance_owner','eps.cast_canonical(jsonb)','EXECUTE'), 'Reviewed filter can run (m25)');

-- 2. Previous-client gate.
select set_config('request.headers','{"accept":"application/json","user-agent":"postgrest"}',true);
select pg_temp.check(eps.previous_client(), 'Data API request without the contract header is a previous client');
select set_config('request.headers','{"x-eps-contract":"2026-11-cycle7"}',true);
select pg_temp.check(not eps.previous_client(), 'contract header selects the current shape');
select set_config('request.headers','',true);
select pg_temp.check(not eps.previous_client(), 'direct SQL (worker, tests) gets the current shape');

-- 3. Series and settings responses per client.
create temp table z_series on commit drop as select jsonb_populate_record(null::eps.presentation_series, jsonb_build_object(
  'id',gen_random_uuid(),'workspace_id',gen_random_uuid(),'output_type','shortlist','audience_preset_id',gen_random_uuid(),'audience_snapshot','{"scope":"external"}',
  'title','Z','template_key','everyone-casting','template_version','1.4.0','template_content_sha256',repeat('a',64),'font_key','general-sans',
  'row_version',1,'archived',false,'cover_note','A note','next_version_number',1)) s;
select pg_temp.check((select eps.review_series_dto(s) ? 'cover_note' from z_series), 'direct call keeps cover_note');
select set_config('request.headers','{"accept":"application/json"}',true);
select pg_temp.check((select not (eps.review_series_dto(s) ? 'cover_note') and eps.review_series_dto(s) ? 'title' from z_series), 'previous client: cover_note removed, other keys kept');
select set_config('request.headers','{"x-eps-contract":"2026-11-cycle7"}',true);
select pg_temp.check((select eps.review_series_dto(s)->>'cover_note'='A note' from z_series), 'current client keeps cover_note');
select set_config('request.headers','',true);
insert into eps.app_settings(singleton,template_key,template_version,default_timezone,default_review_expiry_days) values(true,'everyone-casting','1.3.0','Africa/Cairo',30) on conflict do nothing;
select pg_temp.check(eps.settings_dto() ? 'default_audience_preset_id', 'direct settings keep default_audience_preset_id');
select set_config('request.headers','{"accept":"application/json"}',true);
select pg_temp.check(not (eps.settings_dto() ? 'default_audience_preset_id') and eps.settings_dto() ? 'template_version', 'previous client settings shape');
select set_config('request.headers','',true);
select pg_temp.check((select prosrc ~ 'previous_client' from pg_proc where oid='eps.cast_mutate(text,uuid,jsonb,text)'::regprocedure), 'already_member gated for previous clients');

select json_build_object('result','passed','file','z-compat-runtime','checks',current_setting('eps.z_checks')::integer);
rollback;
