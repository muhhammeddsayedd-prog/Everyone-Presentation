-- Additive M02 compatibility16 after exact coordinated15. Two helper bodies
-- only: honest OCR method and PDF page references. No data/ACL/flag changes.
set local lock_timeout='5s';set local statement_timeout='30s';set local search_path='';
do $$begin
 if current_user<>'postgres' or current_database()<>'postgres'
  or (select array_agg(version order by version) from supabase_migrations.schema_migrations) is distinct from
   array['20261028010943','20261028013324','20261028013655','20261028024205','20261028072515','20261028162702','20261028162800','20261028172320','20261028184145','20261028222030','20261029001520','20261029003941','20261029070038','20261029090500','20261029090724']::text[]
 then raise exception 'PDF_VISION_REVIEWED_FIFTEEN_REQUIRED';end if;
end $$;
do $compatibility$
declare source text;definition text;replacement text;anchor text;insert_value text;begin
 select prosrc,pg_get_functiondef(oid) into source,definition from pg_proc where oid='eps.specs_validate_file_preparation(eps.jobs,eps.media_assets,text)'::regprocedure;
 if encode(sha256(convert_to(replace(source,E'\r\n',E'\n'),'UTF8')),'hex')<>'42033c8e8062d395551a4d14fd94bb96614e16220ba4739fe1853d68ae22bc7d' then raise exception 'PDF_VISION_VALIDATOR_SOURCE_REQUIRED';end if;
 anchor:='prepared->>''extractionMethod''=''pdf_text''';
 if length(source)-length(replace(source,anchor,''))<>length(anchor) then raise exception 'PDF_VISION_PAGE_METHOD_ANCHOR_REQUIRED';end if;
 replacement:=replace(source,anchor,'prepared->>''extractionMethod'' in(''pdf_text'',''pdf_vision'')');
 anchor:='prepared->>''extractionMethod'' in(''plain_text'',''pdf_text'',''docx_text'')';
 if length(replacement)-length(replace(replacement,anchor,''))<>length(anchor) then raise exception 'PDF_VISION_METHOD_ENUM_ANCHOR_REQUIRED';end if;
 replacement:=replace(replacement,anchor,'prepared->>''extractionMethod'' in(''plain_text'',''pdf_text'',''pdf_vision'',''docx_text'')');
 execute replace(definition,source,replacement);
 select prosrc,pg_get_functiondef(oid) into source,definition from pg_proc where oid='eps.store_specs_preparation(jsonb)'::regprocedure;
 if encode(sha256(convert_to(replace(source,E'\r\n',E'\n'),'UTF8')),'hex')<>'04e5624940e0a8f45487c437f43a11279dd7c10b1adae8955247754f86250e4f' then raise exception 'PDF_VISION_STORAGE_HELPER_SOURCE_REQUIRED';end if;
 anchor:=E'if prepared->>''extractionMethod'' is distinct from (case original_mime when ''application/pdf'' then ''pdf_text''\n  when ''application/vnd.openxmlformats-officedocument.wordprocessingml.document'' then ''docx_text'' when ''text/plain'' then ''plain_text'' else null end)';
 insert_value:=E'if not coalesce(case original_mime when ''application/pdf'' then prepared->>''extractionMethod'' in(''pdf_text'',''pdf_vision'')\n  when ''application/vnd.openxmlformats-officedocument.wordprocessingml.document'' then prepared->>''extractionMethod''=''docx_text''\n  when ''text/plain'' then prepared->>''extractionMethod''=''plain_text'' else false end,false)';
 if position(E'\r\n' in source)>0 then anchor:=replace(anchor,E'\n',E'\r\n');insert_value:=replace(insert_value,E'\n',E'\r\n');end if;
 if length(source)-length(replace(source,anchor,''))<>length(anchor) then raise exception 'PDF_VISION_ORIGINAL_METHOD_ANCHOR_REQUIRED';end if;
 replacement:=replace(source,anchor,insert_value);execute replace(definition,source,replacement);
end $compatibility$;
