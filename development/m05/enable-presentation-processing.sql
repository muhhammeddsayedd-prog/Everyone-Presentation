-- Separate one-shot readiness transition, never part of migration24.
-- Root verifies the published WF03 and upgraded authenticated worker first.
-- Only the new nonsecret enabled flag changes. Hosting remains deferred.
begin;
set local search_path='';set local lock_timeout='3s';set local statement_timeout='15s';
do $enable_presentation$
declare configuration eps.presentation_processing_config;changed integer;begin
 if current_user<>'postgres'or current_database()<>'postgres'
 or(select count(*)from supabase_migrations.schema_migrations)<>24
 or(select max(version)from supabase_migrations.schema_migrations)<>'20261029215218'
 or not exists(select 1 from supabase_migrations.schema_migrations where version='20261029215218'and name='m05_immutable_presentation_versions')
 then raise exception'M05_PRESENTATION_EXACT_RELEASE24_REQUIRED';end if;
 select * into configuration from eps.presentation_processing_config where id for update;
 if not found or to_jsonb(configuration)<>'{"id":true,"enabled":false,"renderer_version":"everyone-casting-pdf-v1","application_origin":"http://127.0.0.1:3000","max_manifest_bytes":8388608,"max_pdf_bytes":67108864,"max_pages":1000}'::jsonb
 then raise exception'M05_PRESENTATION_EXPECTED_DISABLED_CONFIGURATION_REQUIRED';end if;
 if not exists(select 1 from eps.presentation_templates current_template join eps.presentation_templates retained_template
  on retained_template.key=current_template.key and retained_template.version='1.0.0'
  where current_template.key='everyone-casting'and current_template.version='1.1.0'and current_template.registered and retained_template.registered
  and current_template.content_sha256='bbe72bf2bb08f37fe394c75563e2eca3ab8da72b1775db75704d47ae54f4f638'
  and retained_template.content_sha256='8cfc99e874b2810d782f0a447628039e52e48a337fe1ce5b6286799c56e90001'
  and current_template.font_key='everyone-casting-fonts-v1'and current_template.font_key=retained_template.font_key
  and current_template.font_hashes=retained_template.font_hashes)
 then raise exception'M05_PRESENTATION_EXACT_REGISTERED_TEMPLATES_REQUIRED';end if;
 if not exists(select 1 from eps.review_processing_config where id and enabled)
 then raise exception'M05_PRESENTATION_EXISTING_REVIEW_READINESS_REQUIRED';end if;
 if not exists(select 1 from eps.jobs where id='b3f90268-147d-41d4-8875-2a6435df1496'and status='waiting_for_input')
 then raise exception'M05_PRESENTATION_PROTECTED_M02_WAITING_REQUIRED';end if;
 if exists(select 1 from eps.jobs where status in('queued','running'))
 then raise exception'M05_PRESENTATION_IDLE_WORKER_RESTART_REQUIRED';end if;
 update eps.presentation_processing_config set enabled=true where id and not enabled;
 get diagnostics changed=row_count;if changed<>1 then raise exception'M05_PRESENTATION_EXPECTED_SINGLE_READINESS_TRANSITION';end if;
end $enable_presentation$;
select jsonb_build_object('schema_version','1.0','release_version','20261029215218',
 'presentation_processing',(select to_jsonb(c)from eps.presentation_processing_config c where id),
 'review_processing_enabled',(select enabled from eps.review_processing_config where id),
 'protected_m02_status',(select status from eps.jobs where id='b3f90268-147d-41d4-8875-2a6435df1496'),
 'queued_or_running_jobs',(select count(*)from eps.jobs where status in('queued','running')))as m05_presentation_enabled;
commit;
