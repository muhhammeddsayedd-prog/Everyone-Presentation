-- Nonsecret template. Only exact reviewed history is substituted; no key value.
begin;set local lock_timeout='5s';set local statement_timeout='15s';set local search_path='';
do $$declare changed integer;begin
 if current_user<>'postgres'or current_database()<>'postgres'or not(select rolsuper or rolbypassrls from pg_roles where rolname=current_user)
 or(select array_agg(version order by version)from supabase_migrations.schema_migrations)is distinct from array[__VERSIONS__]::text[]then raise exception'M03_FRAME_EXACT19_REQUIRED';end if;
 perform pg_advisory_xact_lock(hashtextextended('eps.m03.frame.activation',0));
 perform 1 from eps.frame_extraction_config where id for update;
 if not exists(select 1 from eps.frame_extraction_config where id and not enabled and native_image_id is null and implementation_version='frame-extraction.v1')
 or not exists(select 1 from eps.candidate_support_config where id and not uploads_enabled)then raise exception'M03_FRAME_DISABLED_BASELINE_REQUIRED';end if;
 if exists(select 1 from eps.jobs where kind in('candidate_scan','frame_extract')and status in('queued','running'))or exists(select 1 from eps.outbox_events o join eps.jobs j on j.id=o.job_id where j.kind in('candidate_scan','frame_extract')and o.status='leased')then raise exception'M03_FRAME_QUEUE_DRAIN_REQUIRED';end if;
 update eps.frame_extraction_config set enabled=true,native_image_id='sha256:ea6e27d158a843fee524d7f43f2f88a4ede8bc58e8ac32578b7dec5c1594ba6b'where id and not enabled and native_image_id is null;
 get diagnostics changed=row_count;if changed<>1 then raise exception'M03_FRAME_ENABLE_UNCONFIRMED';end if;
end $$;
select jsonb_build_object('frame_config',(select to_jsonb(c)from eps.frame_extraction_config c where id),'support_config',(select to_jsonb(c)from eps.candidate_support_config c where id),'changed_rows',1)as m03_frame_enabled;
commit;
