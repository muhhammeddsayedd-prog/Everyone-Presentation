-- Authored synthetic English only; no provider result, person or AI inference.
-- Inserted AFTER the full native fixture's media row, BEFORE version capture.
set local role postgres;
do $recovery37_english$declare changed integer;begin
 update eps.candidate_asset_config set english_transcript_version='1.0'where id;
 get diagnostics changed=row_count;if changed<>1 then raise exception'RECOVERY37_ONE_CONFIG_REQUIRED';end if;
 update eps.candidate_media set english_transcript='Authored synthetic English for full history37 recovery.',
 english_transcript_status='available',english_transcript_source_sha256=encode(sha256(convert_to(original_transcript,'UTF8')),'hex'),
 english_transcript_input_hash=repeat('e',64),english_transcript_metadata='[{"fixture":"authored synthetic full37; no provider"}]'::jsonb
 where id='8a9f0000-0000-4000-8000-000000000002'and source_asset_id='8a9f0000-0000-4000-8000-000000000001'
 and original_transcript='Synthetic local recovery fixture. No human or provider data.';
 get diagnostics changed=row_count;if changed<>1 then raise exception'RECOVERY37_ONE_SYNTHETIC_MEDIA_REQUIRED';end if;
end$recovery37_english$;
