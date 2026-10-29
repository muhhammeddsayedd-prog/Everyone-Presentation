set local role postgres;
insert into public.app_capability_grants(principal_id,capability)select current_setting('eps.casting.fixture.actor2')::uuid,value from unnest(array['presentations.generate','cast.read'])value;
update eps.roles set archived_at=clock_timestamp()where workspace_id=current_setting('eps.casting.fixture.workspace2')::uuid;
update eps.slots set archived_at=clock_timestamp()where workspace_id=current_setting('eps.casting.fixture.workspace2')::uuid;
select set_config('request.jwt.claim.sub',current_setting('eps.casting.fixture.actor2'),true),set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('eps.casting.fixture.actor2'),'role','authenticated')::text,true);
set local role authenticated;
do $$declare series jsonb;begin series:=public.eps_create_presentation_series(jsonb_build_object('workspace_id',current_setting('eps.casting.fixture.workspace2'),'output_type','selection','audience_preset_id','8a7a0000-0000-4000-8000-000000000001'),'m05-no-role-series');perform set_config('eps.m05.norole.series',series->>'id',true);end$$;
set local role postgres;
do $$declare w uuid:=current_setting('eps.casting.fixture.workspace2')::uuid;sid uuid:=current_setting('eps.m05.norole.series')::uuid;jid uuid:=gen_random_uuid();r jsonb;begin
 r:=eps.review_snapshot_data(w,sid,null);insert into eps.jobs(id,workspace_id,requested_by,kind,resource_id,input,input_hash,input_hash_version,dedupe_key,stage,correlation_id,status)values(jid,w,current_setting('eps.casting.fixture.actor2')::uuid,'review_fit',sid,'{}',repeat('f',64),'eps.review-job-input.pg-jsonb.v1',eps.presentation_hash(to_jsonb(jid)),'measure_review_fit','m05-synthetic-no-role-layout','succeeded');
 insert into eps.review_fit_results(job_id,workspace_id,series_id,input_fingerprint,status,result)values(jid,w,sid,r->>'input_fingerprint','measured',jsonb_build_object('overflows','[]'::jsonb,'measured_at','2026-10-29T20:00:00.000000Z'));
end$$;
set local role authenticated;
do $$declare r jsonb;ack jsonb;v jsonb;begin
 r:=public.eps_get_workspace_review(current_setting('eps.casting.fixture.workspace2')::uuid,current_setting('eps.m05.norole.series')::uuid,null);
 ack:=public.eps_generate_version(current_setting('eps.m05.norole.series')::uuid,jsonb_build_object('expected_workspace_row_version',public.eps_get_workspace(current_setting('eps.casting.fixture.workspace2')::uuid)->'row_version','expected_draft_revision',r->'draft_revision','expected_input_fingerprint',r->'input_fingerprint'),'m05-generate-no-role');v:=public.eps_get_version((ack->>'resource_id')::uuid);perform set_config('eps.m05.norole.version',ack->>'resource_id',true);
 if jsonb_array_length(v->'slides')<>2 or v#>>'{slides,1,kind}'<>'pending'or v#>>'{slides,1,role_category}'is not null or v#>>'{slides,1,assignment_id}'is not null or(select count(*)from jsonb_object_keys(v#>'{slides,1,requirements}'))<>11 then raise exception'M05_NO_ROLE_PENDING_PAGE_CONTRACT_FAILED';end if;
 perform set_config('request.jwt.claim.sub',current_setting('eps.casting.fixture.actor'),true);perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('eps.casting.fixture.actor'),'role','authenticated')::text,true);
 begin perform public.eps_get_version(current_setting('eps.m05.norole.version')::uuid);raise exception'M05_FOREIGN_VERSION_VISIBLE';exception when raise_exception then if sqlerrm<>'RESOURCE_NOT_FOUND'then raise;end if;end;
end$$;
set local role postgres;
select jsonb_build_object('schema_version','1.0','kind','synthetic_presentation_capture','synthetic',true,'snapshot',v.snapshot,'snapshot_sha256',v.snapshot_sha256,'manifest',v.manifest,'manifest_sha256',v.manifest_sha256,'inventory_sha256',v.inventory_sha256,'version',eps.presentation_version_dto(v))from eps.presentation_versions v where id=current_setting('eps.m05.norole.version')::uuid;
select'M05_NO_ROLE_TWO_PAGES_COMPLETE_PENDING_AND_FOREIGN_VERSION_DENIAL_PASSED';
