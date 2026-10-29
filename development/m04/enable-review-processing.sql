-- Separate one-shot readiness transition. This is NOT part of migration22.
-- Root first verifies the upgraded private worker and published WF05 dispatch.
-- No credentials, login grants, workflow edits, Auth or business writes here.
begin;
set local search_path='';set local lock_timeout='3s';set local statement_timeout='15s';
do $enable_review$
declare configuration eps.review_processing_config;template eps.presentation_templates;changed integer;begin
 if current_user<>'postgres'or current_database()<>'postgres'
 or(select count(*)from supabase_migrations.schema_migrations)<>22
 or(select max(version)from supabase_migrations.schema_migrations)<>'20261029202629'
 or not exists(select 1 from supabase_migrations.schema_migrations where version='20261029202629'and name='m04_review_series_processing')
 then raise exception'M04_REVIEW_EXACT_RELEASE22_REQUIRED';end if;
 select * into configuration from eps.review_processing_config where id for update;
 if not found or to_jsonb(configuration)<>'{"id":true,"enabled":false,"model":"gpt-6.1-sol","prompt_version":"contextual_suggestion_v1","renderer_version":"everyone-casting-fit-v1"}'::jsonb
 then raise exception'M04_REVIEW_EXPECTED_DISABLED_CONFIGURATION_REQUIRED';end if;
 select * into template from eps.presentation_templates where key='everyone-casting'and version='1.0.0';
 if not found or encode(sha256(convert_to(to_jsonb(template)::text,'UTF8')),'hex')<>'7c7cce574aeed8105bbd603884a608962473575b91d0f4e22a1176913307accd'
 then raise exception'M04_REVIEW_EXACT_REGISTERED_TEMPLATE_REQUIRED';end if;
 update eps.review_processing_config set enabled=true where id and not enabled;
 get diagnostics changed=row_count;if changed<>1 then raise exception'M04_REVIEW_EXPECTED_SINGLE_READINESS_TRANSITION';end if;
end$enable_review$;
select jsonb_build_object('schema_version','1.0','release_version','20261029202629','review_processing',(select to_jsonb(c)from eps.review_processing_config c where id),'template_content_sha256',(select content_sha256 from eps.presentation_templates where key='everyone-casting'and version='1.0.0'));
commit;
