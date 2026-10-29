-- Register a new retained template. Existing1.0 series and source bytes stay fixed.
insert into eps.presentation_templates(key,version,content_sha256,font_key,font_hashes)
 select key,'1.1.0','bbe72bf2bb08f37fe394c75563e2eca3ab8da72b1775db75704d47ae54f4f638',font_key,font_hashes
 from eps.presentation_templates where key='everyone-casting'and version='1.0.0';
do $forward$
declare item record;source text;definition text;replacement text;begin
 for item in select * from(values
 ('public.eps_create_presentation_series(jsonb,text)','3e8ee724bf684c8ce3b890d3b474ad424aaedfe450d89814aa69367f74f2fdd0'),
 ('eps.review_target_context(uuid,text,uuid,text)','d2312bd892c3a98e2ae4ac5c42e68b06289f30a6285a2e19a9e10be2755d1928'),
 ('eps.review_snapshot_data(uuid,uuid,text)','ba6e8c5501f5d9c7299b0ceb50dfc770de851d673bc6ec2c9ab98b134f5fc12a'),
 ('public.eps_get_workspace_review(uuid,uuid,text)','f1aa46bf5008f57e680a841dc94f888f9194631e10e3ba34ed39c199fda0e9c8'),
 ('public.eps_request_workspace_review_fit(uuid,uuid,jsonb,text)','a32753610028eee4159a7e4c1f252356714bab113cf6cf89ab184c7aa98bc73a')
 )v(signature,expected)loop
  select replace(prosrc,E'\r\n',E'\n'),pg_get_functiondef(oid)into source,definition from pg_proc where oid=item.signature::regprocedure;
  if encode(sha256(convert_to(source,'UTF8')),'hex')<>item.expected then raise exception'M05_PRECEDING_TEMPLATE_SOURCE_REQUIRED';end if;
  definition:=replace(definition,E'\r\n',E'\n');replacement:=source;
  if item.signature in('public.eps_create_presentation_series(jsonb,text)','eps.review_target_context(uuid,text,uuid,text)')then
   replacement:=replace(source,'version=''1.0.0''','version=''1.1.0''');
  elsif item.signature='eps.review_snapshot_data(uuid,uuid,text)'then
   replacement:=replace(source,' select coalesce(jsonb_agg(jsonb_build_object(''id'',id,''name'',name,''headcount'',headcount',
    E' if series.template_version=''1.1.0''then\n  select coalesce(jsonb_agg(v||jsonb_build_object(''role_category'',(select r.category from eps.roles r where r.id=(v->>''role_id'')::uuid))order by ord),''[]''::jsonb)into slides from jsonb_array_elements(slides)with ordinality s(v,ord);\n end if;\n select coalesce(jsonb_agg(jsonb_build_object(''id'',id,''name'',name,''headcount'',headcount');
  elsif item.signature='public.eps_get_workspace_review(uuid,uuid,text)'then
   replacement:=replace(source,' review:=eps.review_snapshot(p_workspace_id,p_series_id,p_output_type);',
    E' review:=eps.review_snapshot(p_workspace_id,p_series_id,p_output_type);\n if review#>>''{template,version}''<>''1.1.0''then return review||jsonb_build_object(''can_generate'',false,''issues'',review->''issues''||jsonb_build_array(eps.review_issue(''TEMPLATE_UPGRADE_REQUIRED'',''blocking'',p_series_id,null,''This retained template requires a new series before generation.'',''Create a current template series and review it.'')),''fit'',jsonb_build_object(''status'',''unmeasured'',''input_fingerprint'',null,''measured_at'',null,''overflows'',''[]''::jsonb,''error_code'',''TEMPLATE_UPGRADE_REQUIRED''));end if;');
  else
   replacement:=replace(source,' select * into configuration from eps.review_processing_config where id and enabled;',
    E' if not exists(select 1 from eps.presentation_series where id=p_series_id and workspace_id=p_workspace_id and template_version=''1.1.0'')then perform eps.fail(''TEMPLATE_UPGRADE_REQUIRED'',''Create a current template series before measuring.'',409);end if;\n if not exists(select 1 from eps.presentation_processing_config where id and enabled)then perform eps.fail(''REVIEW_PROCESSING_UNAVAILABLE'',''Current template processing is not enabled.'',503);end if;\n select * into configuration from eps.review_processing_config where id and enabled;');
  end if;
  if replacement=source then raise exception'M05_TEMPLATE_FORWARD_ANCHOR_REQUIRED:%',item.signature;end if;execute replace(definition,source,replacement);
 end loop;
end$forward$;
