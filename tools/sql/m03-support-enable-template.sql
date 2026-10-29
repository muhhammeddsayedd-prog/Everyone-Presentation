-- PUBLIC nonce/HMAC/history only. Updates the support flag, never key/frame rows.
begin;set local lock_timeout='5s';set local statement_timeout='15s';set local search_path='';
do $$declare changed integer;begin
 if current_user<>'postgres'or current_database()<>'postgres'or not(select rolsuper or rolbypassrls from pg_roles where rolname=current_user)
 or(select array_agg(version order by version)from supabase_migrations.schema_migrations)is distinct from array[__VERSIONS__]::text[]then raise exception'M03_SUPPORT_EXACT19_REQUIRED';end if;
 perform pg_advisory_xact_lock(hashtextextended('eps.m03.support.activation',0));
 perform 1 from eps.candidate_support_config where id for update;
 if not exists(select 1 from eps.candidate_support_config where id and not uploads_enabled)
 or not exists(select 1 from eps.frame_extraction_config where id and enabled and native_image_id='sha256:ea6e27d158a843fee524d7f43f2f88a4ede8bc58e8ac32578b7dec5c1594ba6b'and implementation_version='frame-extraction.v1')then raise exception'M03_SUPPORT_DISABLED_FRAME_ENABLED_REQUIRED';end if;
 if not exists(select 1 from eps.support_verification_keys where key_id='eps-candidate-support-local-20261029-v1'and purpose='candidate_support'and octet_length(secret)=32 and revoked_at is null and not_after is null and not_before<=clock_timestamp()
 and encode(extensions.hmac(convert_to('__NONCE__','UTF8'),secret,'sha256'),'hex')='__EXPECTED_HMAC__')then raise exception'M03_SUPPORT_CHALLENGE_UNCONFIRMED';end if;
 update eps.candidate_support_config set uploads_enabled=true where id and not uploads_enabled;
 get diagnostics changed=row_count;if changed<>1 then raise exception'M03_SUPPORT_ENABLE_UNCONFIRMED';end if;
end $$;
select jsonb_build_object('support_config',(select to_jsonb(c)from eps.candidate_support_config c where id),'frame_config',(select to_jsonb(c)from eps.frame_extraction_config c where id),'changed_rows',1)as m03_support_enabled;
commit;
