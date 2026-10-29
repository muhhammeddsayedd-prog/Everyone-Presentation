-- M02 forward MIME scalar guard. Applied11 source/owner/ACLs remain immutable.
set local lock_timeout='5s';
set local statement_timeout='15s';
set local search_path='';
do $history$ begin
 if current_user<>'postgres' or current_database()<>'postgres'
  or (select array_agg(version order by version) from supabase_migrations.schema_migrations) is distinct from
   array['20261028010943','20261028013324','20261028013655','20261028024205','20261028072515','20261028162702','20261028162800','20261028172320','20261028184145','20261028222030','20261029001520']::text[]
 then raise exception 'SPECS_MIME_REVIEWED_ELEVEN_VERSION_BASELINE_REQUIRED'; end if;
end $history$;
-- BEGIN CANONICAL SPECS MIME GUARD CORE
-- CREATE OR REPLACE preserves the existing narrow owner and all EXECUTE ACLs.
create or replace function public.eps_reserve_specs_upload(p_input jsonb,p_idempotency_key text) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare workspace uuid; current_spec_version bigint; response jsonb; upload_id uuid:=gen_random_uuid(); asset_id uuid:=gen_random_uuid();
 mime text; extension text; size bigint; changed bigint; result jsonb;
begin
 perform eps.require_capability('workspaces.write');
 perform eps.check_input(p_input,array['workspace_id','purpose','filename','mime_type','size_bytes','sha256']);
 workspace:=eps.input_uuid(p_input->>'workspace_id'); mime:=p_input->>'mime_type';
 if p_input->>'purpose' is distinct from 'specs' or jsonb_typeof(p_input->'filename') is distinct from 'string'
  or length(btrim(p_input->>'filename')) not between 1 and 255 or p_input->>'filename'~E'[/\\\\[:cntrl:]]'
  or jsonb_typeof(p_input->'mime_type') is distinct from 'string' or mime not in('application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain')
  or p_input?'sha256' and (jsonb_typeof(p_input->'sha256') is distinct from 'string' or p_input->>'sha256'!~'^[a-f0-9]{64}$')
 then perform eps.fail('INVALID_REQUEST','Provide a supported document and simple filename.',400); end if;
 size:=eps.logo_integer(p_input->'size_bytes',1,20971520);
 if not eps.logo_scope(workspace,true) then perform eps.fail('RESOURCE_NOT_FOUND','Writable workspace not found.',404); end if;
 response:=eps.idempotency_begin('specs.reserve_upload',p_idempotency_key,p_input);
 if not eps.logo_scope(workspace,true) then perform eps.fail('RESOURCE_NOT_FOUND','Writable workspace not found.',404); end if;
 if response is not null then
  upload_id:=eps.input_uuid(response->>'upload_id'); perform eps.specs_upload_require(upload_id); return eps.specs_upload_dto(upload_id);
 end if;
 if not exists(select 1 from eps.specs_asset_config where id=1 and uploads_enabled) then perform eps.fail('FEATURE_NOT_IMPLEMENTED','Document uploads are not enabled.',503); end if;
 perform 1 from eps.workspaces w where w.id=workspace for update;
 select s.row_version into current_spec_version from eps.specs s where s.workspace_id=workspace for update;
 if not found or not eps.logo_scope(workspace,true) then perform eps.fail('RESOURCE_NOT_FOUND','Writable source not found.',404); end if;
 extension:=case mime when 'application/pdf' then 'pdf' when 'text/plain' then 'txt' else 'docx' end;
 insert into eps.media_assets(id,origin_workspace_id,purpose,filename,mime_type,bucket,object_key,size_bytes,status)
 values(asset_id,workspace,'specs',p_input->>'filename',mime,'eps-specs-assets','assets/'||asset_id::text||'/original.'||extension,size,'uploading');
 get diagnostics changed=row_count; if changed<>1 then perform eps.fail('SPECS_STATE_INVALID','The document asset was not reserved.',409); end if;
 insert into eps.specs_upload_sessions(id,asset_id,principal_id,workspace_id,spec_row_version,bucket,object_key,expected_size_bytes,expected_mime_type,expected_sha256)
 values(upload_id,asset_id,auth.uid(),workspace,current_spec_version,'eps-specs-assets','assets/'||asset_id::text||'/original.'||extension,size,mime,p_input->>'sha256');
 get diagnostics changed=row_count; if changed<>1 then perform eps.fail('SPECS_STATE_INVALID','The document upload was not reserved.',409); end if;
 result:=eps.specs_upload_dto(upload_id);
 if result is null or result#>>'{asset,id}'<>asset_id::text or result->>'spec_row_version'<>current_spec_version::text
  or result->>'status'<>'open' or result#>>'{asset,status}'<>'uploading'
 then perform eps.fail('SPECS_STATE_INVALID','The document reservation was not stored completely.',409); end if;
 result:=eps.finish_mutation('specs.reserve_upload',p_idempotency_key,p_input,result,asset_id);
 if not eps.logo_scope(workspace,true) then perform eps.fail('RESOURCE_NOT_FOUND','Writable workspace not found.',404); end if; return result;
end $$;
-- END CANONICAL SPECS MIME GUARD CORE
