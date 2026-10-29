-- Actual generation RPC capture; synthetic layout provider result only.
do $$declare sid uuid;r jsonb;ack jsonb;body jsonb;version jsonb;output text;begin
 foreach output in array array['selection','shortlist']loop
  sid:=current_setting('eps.m05.'||output)::uuid;r:=public.eps_get_workspace_review(current_setting('eps.casting.fixture.workspace')::uuid,sid,null);
  body:=jsonb_build_object('expected_workspace_row_version',public.eps_get_workspace(current_setting('eps.casting.fixture.workspace')::uuid)->'row_version','expected_draft_revision',r->'draft_revision','expected_input_fingerprint',r->'input_fingerprint');
  ack:=public.eps_generate_version(sid,body,'m05-generate-'||output);
  if ack<>public.eps_generate_version(sid,body,'m05-generate-'||output)then raise exception'M05_GENERATE_ACK_REPLAY_FAILED';end if;
  version:=public.eps_get_version((ack->>'resource_id')::uuid);
  if version->>'status'<>'queued'or version->>'manifest_asset_id'is not null or version->>'pdf_asset_id'is not null or version->>'ready_at'is not null or version->>'template_version'<>'1.1.0'or jsonb_array_length(version->'slides')<>(case output when'selection'then 8 else 6 end)then raise exception'M05_CAPTURE_COUNTS_OR_ARTIFACT_COUPLING_FAILED';end if;
  if version#>>'{slides,1,fields,name_or_id}'<>'Samir'or version#>>'{slides,2,fields,name_or_id}'<>(case output when'selection'then'Omar'else'Samir'end)then raise exception'M05_CAPTURE_ORDER_FAILED';end if;
  if exists(select 1 from jsonb_array_elements(version->'slides')s where s->>'kind'='candidate'and(s->>'position'<>'option'or(select count(*)from jsonb_object_keys(s->'fields'))<>10)or s->>'kind'='pending'and((select count(*)from jsonb_object_keys(s->'requirements'))<>11 or s->>'role_category'<>'Supporting'))then raise exception'M05_CAPTURE_FIELDS_PENDING_CATEGORY_OR_OPTION_FAILED';end if;
  perform set_config('eps.m05.'||output||'.version',ack->>'resource_id',true);perform set_config('eps.m05.'||output||'.job',ack->>'job_id',true);perform set_config('eps.m05.'||output||'.body',body::text,true);
 end loop;
end$$;
do $$declare n integer;ack jsonb;begin
 for n in 2..3 loop
  ack:=public.eps_generate_version(current_setting('eps.m05.selection')::uuid,current_setting('eps.m05.selection.body')::jsonb,'m05-selection_version-'||n);
  if(public.eps_get_version((ack->>'resource_id')::uuid)->>'version_no')::integer<>n then raise exception'M05_MONOTONIC_ALLOCATION_FAILED';end if;
  perform set_config('eps.m05.selection_v'||n||'.version',ack->>'resource_id',true);perform set_config('eps.m05.selection_v'||n||'.job',ack->>'job_id',true);
 end loop;
end$$;
select'M05_ACTUAL_CAPTURE_SELECTION8_SHORTLIST6_ORDER_TEN_FIELDS_CATEGORY_PENDING_PASSED';
set local role postgres;
select jsonb_build_object('schema_version','1.0','kind','synthetic_presentation_capture','synthetic',true,'snapshot',v.snapshot,'snapshot_sha256',v.snapshot_sha256,'manifest',v.manifest,'manifest_sha256',v.manifest_sha256,'inventory_sha256',v.inventory_sha256,'version',eps.presentation_version_dto(v))from eps.presentation_versions v where id in(current_setting('eps.m05.selection.version')::uuid,current_setting('eps.m05.shortlist.version')::uuid)order by page_count desc;
set local role authenticated;
