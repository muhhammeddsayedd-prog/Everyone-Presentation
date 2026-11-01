-- Synthetic counts/authority only. Caller owns exact marked/OID-owned source DB
-- and an outer savepoint which rolls back this entire fixture and migrations.
set local role postgres;
do $fixture37$begin
 if current_database()!~'^eps_m07_r33_source_[a-f0-9]{32}$'
 or current_setting('eps.feedback_summary37.proof',true)is distinct from'owned-local-rollback-v1'
 or current_user<>'postgres' or(pg_control_system()).system_identifier::text<>'7701520506262638626'
 or to_regprocedure('public.eps_get_feedback_summary(uuid)')is null
 or exists(select 1 from auth.users where id::text like'b7370001-%')
 then raise exception'FEEDBACK37_OWNED_SYNTHETIC_FIXTURE_REQUIRED';end if;
end$fixture37$;
create function pg_temp.fb37_id(prefix text,n integer)returns uuid language sql immutable as $$
 select(prefix||'-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid
$$;
create function pg_temp.fb37_assert(value boolean,label text)returns void language plpgsql as $$begin
 if value is distinct from true then raise exception'FEEDBACK37_ASSERTION_FAILED:%',label;end if;
end$$;
create function pg_temp.fb37_error(query text,code text)returns void language plpgsql as $$begin
 begin execute query;exception when others then if sqlerrm=code or sqlstate=code then return;end if;raise exception'FEEDBACK37_WRONG_ERROR:%/% EXPECTED %',sqlstate,sqlerrm,code;end;
 raise exception'FEEDBACK37_EXPECTED_ERROR:%',code;
end$$;

insert into auth.users(id,is_anonymous)select pg_temp.fb37_id('b7370001',n),false from generate_series(1,123)n;
insert into public.app_capability_grants(principal_id,capability)
 select pg_temp.fb37_id('b7370001',1),c from unnest(array['projects.read','workspaces.read','workspaces.write'])c;
insert into public.app_capability_grants(principal_id,capability)
 select pg_temp.fb37_id('b7370001',2),c from unnest(array['projects.read','workspaces.read'])c;
insert into public.app_capability_grants(principal_id,capability)values(pg_temp.fb37_id('b7370001',3),'projects.read');
insert into public.projects(id,name)select pg_temp.fb37_id('b7370002',n),'Synthetic feedback project '||n from generate_series(1,2)n;
insert into public.project_memberships(project_id,principal_id,can_write)values
 (pg_temp.fb37_id('b7370002',1),pg_temp.fb37_id('b7370001',1),true),
 (pg_temp.fb37_id('b7370002',2),pg_temp.fb37_id('b7370001',2),true),
 (pg_temp.fb37_id('b7370002',1),pg_temp.fb37_id('b7370001',3),true);
insert into eps.workspaces(id,project_id)select pg_temp.fb37_id('b7370003',n),pg_temp.fb37_id('b7370002',n)from generate_series(1,2)n;
insert into eps.audience_presets(id,key,label,scope)select pg_temp.fb37_id('b7370004',n),'feedback37-'||n,'Synthetic external audience','external'from generate_series(1,2)n;
insert into eps.presentation_series(id,workspace_id,output_type,audience_preset_id,audience_snapshot,scope_fingerprint,title,template_key,template_version,template_content_sha256,font_key)
 select pg_temp.fb37_id('b7370005',n),pg_temp.fb37_id('b7370003',n),'selection',pg_temp.fb37_id('b7370004',n),'{"scope":"external"}',lpad(n::text,64,'0'),'Synthetic feedback series',t.key,t.version,t.content_sha256,t.font_key
 from generate_series(1,2)n cross join lateral(select*from eps.presentation_templates where registered order by version desc limit 1)t;
insert into eps.jobs(id,workspace_id,requested_by,kind,resource_id,input,input_hash,input_hash_version,dedupe_key,stage,correlation_id,status)
 select pg_temp.fb37_id('b7370006',n),pg_temp.fb37_id('b7370003',case when n=3 then 2 else 1 end),pg_temp.fb37_id('b7370001',1),'presentation_render',pg_temp.fb37_id('b7370008',n),'{}',repeat('0',64),'eps.presentation-job-input.cast-canonical.v1',lpad(n::text,64,'0'),'prepare_presentation','synthetic-feedback37-'||n,case when n=4 then'queued'else'succeeded'end from generate_series(1,4)n;
insert into eps.media_assets(id,origin_workspace_id,purpose,filename,mime_type,bucket,object_key,size_bytes,sha256,status,producing_job_id,producing_attempt_id,output_stage,output_key)
 select pg_temp.fb37_id('b7370007',n),pg_temp.fb37_id('b7370003',case when n>4 then 2 else 1 end),case when n%2=1 then'presentation_manifest'else'presentation_pdf'end,'synthetic-feedback37-'||n,case when n%2=1 then'application/json'else'application/pdf'end,'eps-presentation-outputs','synthetic-feedback37/'||n,1,repeat('0',64),'ready',pg_temp.fb37_id('b7370006',(n+1)/2),pg_temp.fb37_id('b7370016',(n+1)/2),'render_presentation',case when n%2=1 then'presentation_manifest'else'presentation_pdf'end from generate_series(1,6)n;
insert into eps.presentation_versions(id,series_id,workspace_id,project_id,version_number,status,input_workspace_row_version,source_draft_revision,input_fingerprint,snapshot,snapshot_sha256,manifest,manifest_sha256,inventory_sha256,page_count,generation_job_id,generated_by,manifest_asset_id,pdf_asset_id,ready_at,created_at)
 select pg_temp.fb37_id('b7370008',n),s.id,s.workspace_id,w.project_id,case when n=3 then 1 else n end,'ready',1,0,repeat('0',64),
 jsonb_build_object('series_id',s.id,'audience_snapshot',s.audience_snapshot,'cover',jsonb_build_object('output_type',s.output_type),'template',jsonb_build_object('key',s.template_key,'version',s.template_version,'content_sha256',s.template_content_sha256)),
 repeat('0',64),'{}',repeat('0',64),repeat('0',64),3,pg_temp.fb37_id('b7370006',n),pg_temp.fb37_id('b7370001',1),pg_temp.fb37_id('b7370007',n*2-1),pg_temp.fb37_id('b7370007',n*2),clock_timestamp(),clock_timestamp()
 from generate_series(1,3)n join eps.presentation_series s on s.id=pg_temp.fb37_id('b7370005',case when n=3 then 2 else 1 end)join eps.workspaces w on w.id=s.workspace_id;
-- A newer queued version must never become readable through either summary port.
insert into eps.presentation_versions(id,series_id,workspace_id,project_id,version_number,status,input_workspace_row_version,source_draft_revision,input_fingerprint,snapshot,snapshot_sha256,manifest,manifest_sha256,inventory_sha256,page_count,generation_job_id,generated_by,created_at)
 select pg_temp.fb37_id('b7370008',4),series_id,workspace_id,project_id,3,'queued',input_workspace_row_version,source_draft_revision,input_fingerprint,snapshot,snapshot_sha256,manifest,manifest_sha256,inventory_sha256,page_count,pg_temp.fb37_id('b7370006',4),generated_by,clock_timestamp()
 from eps.presentation_versions where id=pg_temp.fb37_id('b7370008',1);
update eps.presentation_series s set latest_ready_version_id=pg_temp.fb37_id('b7370008',case when s.id=pg_temp.fb37_id('b7370005',1)then 2 else 3 end),latest_ready_version_no=case when s.id=pg_temp.fb37_id('b7370005',1)then 2 else 1 end where s.id in(pg_temp.fb37_id('b7370005',1),pg_temp.fb37_id('b7370005',2));
insert into eps.version_slides(id,version_id,ordinal,kind,snapshot,content_sha256)
 select pg_temp.fb37_id('b7370009',v*10+k),pg_temp.fb37_id('b7370008',v),k,case k when 0 then'cover'when 1 then'candidate'else'pending'end,'{}',repeat('0',64)from generate_series(1,3)v cross join generate_series(0,2)k;

insert into eps.feedback_comments(id,series_id,version_id,slide_id,author_principal_id,author_name_snapshot,body,visibility,resolved,deleted_at)
 select pg_temp.fb37_id('b7370010',n),pg_temp.fb37_id('b7370005',1),pg_temp.fb37_id('b7370008',1),pg_temp.fb37_id('b7370009',11),pg_temp.fb37_id('b7370001',1),'Synthetic author','Synthetic comment '||n,case when n<=120 then'external'else'internal'end,n<=10 or n between 121 and 125,case when n between 111 and 120 then clock_timestamp()else null end from generate_series(1,160)n;
insert into eps.feedback_comments(id,series_id,version_id,slide_id,author_principal_id,author_name_snapshot,body,visibility,parent_comment_id)
 values(pg_temp.fb37_id('b7370010',500),pg_temp.fb37_id('b7370005',1),pg_temp.fb37_id('b7370008',1),pg_temp.fb37_id('b7370009',11),pg_temp.fb37_id('b7370001',1),'Synthetic reply author','Synthetic external reply','external',pg_temp.fb37_id('b7370010',1));
insert into eps.feedback_comments(id,series_id,version_id,slide_id,author_principal_id,author_name_snapshot,body,visibility)
 select pg_temp.fb37_id('b7370010',600+n),pg_temp.fb37_id('b7370005',1),pg_temp.fb37_id('b7370008',1),pg_temp.fb37_id('b7370009',12),pg_temp.fb37_id('b7370001',1),'Synthetic pending author','Synthetic pending comment','external'from generate_series(1,3)n;
insert into eps.feedback_comments(id,series_id,version_id,slide_id,author_principal_id,author_name_snapshot,body,visibility)
 select pg_temp.fb37_id('b7370010',700+n),pg_temp.fb37_id('b7370005',1),pg_temp.fb37_id('b7370008',2),pg_temp.fb37_id('b7370009',21),pg_temp.fb37_id('b7370001',1),'Synthetic later author','Synthetic later version','external'from generate_series(1,2)n;
-- Deliberately inconsistent synthetic legacy pointer: a foreign slide must not inflate this version.
insert into eps.feedback_comments(id,series_id,version_id,slide_id,author_principal_id,author_name_snapshot,body,visibility)
 values(pg_temp.fb37_id('b7370010',900),pg_temp.fb37_id('b7370005',1),pg_temp.fb37_id('b7370008',1),pg_temp.fb37_id('b7370009',21),pg_temp.fb37_id('b7370001',1),'Synthetic foreign pointer','Synthetic out-of-version slide','external');
insert into eps.feedback_preferences(id,series_id,version_id,slide_id,author_principal_id,author_name_snapshot,preference)
 select pg_temp.fb37_id('b7370011',n),pg_temp.fb37_id('b7370005',1),pg_temp.fb37_id('b7370008',1),pg_temp.fb37_id('b7370009',11),pg_temp.fb37_id('b7370001',n+3),'Synthetic voter',case n%3 when 0 then'preferred'when 1 then'maybe'else'not_preferred'end from generate_series(1,120)n;

select set_config('request.jwt.claim.sub',pg_temp.fb37_id('b7370001',1)::text,true),set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.fb37_id('b7370001',1),'role','authenticated','is_anonymous',false)::text,true);
set local role authenticated;
do $internal37$declare r jsonb;begin
 r:=public.eps_get_feedback_summary(pg_temp.fb37_id('b7370008',1));
 perform pg_temp.fb37_assert(r->'totals'='{"preferred":40,"maybe":40,"not_preferred":40,"comment_count":154,"unresolved_count":139}'::jsonb,'all counts/replies/deletion/resolution beyond100');
 perform pg_temp.fb37_assert(jsonb_array_length(r->'per_slide')=3 and r#>>'{per_slide,0,version_slide_id}'=pg_temp.fb37_id('b7370009',10)::text,'exact slides ordinal');
 perform pg_temp.fb37_assert(r#>'{per_slide,0,comment_count}'='0'and r#>'{per_slide,0,preferred}'='0','cover zeros');
 perform pg_temp.fb37_assert(r#>'{per_slide,2,comment_count}'='3'and r#>'{per_slide,2,preferred}'='0','Pending comments only');
 perform pg_temp.fb37_assert(public.eps_get_feedback_summary(pg_temp.fb37_id('b7370008',2))#>'{totals,comment_count}'='2','fixed older version not latest substitution');
 perform pg_temp.fb37_error(format('select public.eps_get_feedback_summary(%L)',pg_temp.fb37_id('b7370008',3)),'RESOURCE_NOT_FOUND');
 perform pg_temp.fb37_error(format('select public.eps_get_feedback_summary(%L)',pg_temp.fb37_id('b7370008',4)),'RESOURCE_NOT_FOUND');
 perform pg_temp.fb37_error(format('select eps.feedback_summary(%L,false)',pg_temp.fb37_id('b7370008',1)),'42501');
 perform public.eps_set_preference(pg_temp.fb37_id('b7370008',1),jsonb_build_object('version_slide_id',pg_temp.fb37_id('b7370009',11),'value','preferred'),'feedback37-vote-set');
 perform pg_temp.fb37_assert(public.eps_get_feedback_summary(pg_temp.fb37_id('b7370008',1))#>'{totals,preferred}'='41','vote set current row');
 perform public.eps_set_preference(pg_temp.fb37_id('b7370008',1),jsonb_build_object('version_slide_id',pg_temp.fb37_id('b7370009',11),'value','maybe','row_version',1),'feedback37-vote-change');
 perform pg_temp.fb37_assert(public.eps_get_feedback_summary(pg_temp.fb37_id('b7370008',1))#>'{totals,maybe}'='41','vote changed not history');
 perform public.eps_set_preference(pg_temp.fb37_id('b7370008',1),jsonb_build_object('version_slide_id',pg_temp.fb37_id('b7370009',11),'value',null,'row_version',2),'feedback37-vote-clear');
 perform pg_temp.fb37_assert(public.eps_get_feedback_summary(pg_temp.fb37_id('b7370008',1))#>'{totals,maybe}'='40','vote cleared');
end$internal37$;
select set_config('request.jwt.claim.sub',pg_temp.fb37_id('b7370001',2)::text,true),set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.fb37_id('b7370001',2),'role','authenticated','is_anonymous',false)::text,true);
select pg_temp.fb37_assert(public.eps_get_feedback_summary(pg_temp.fb37_id('b7370008',3))->'totals'='{"preferred":0,"maybe":0,"not_preferred":0,"comment_count":0,"unresolved_count":0}'::jsonb,'authorized empty version zeros');
select set_config('request.jwt.claim.sub',pg_temp.fb37_id('b7370001',3)::text,true),set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.fb37_id('b7370001',3),'role','authenticated','is_anonymous',false)::text,true);
-- Existing feedback_version RLS hides the version before the later capability
-- guard; mirror list_feedback's safe RESOURCE_NOT_FOUND denial ordering.
select pg_temp.fb37_error(format('select public.eps_get_feedback_summary(%L)',pg_temp.fb37_id('b7370008',1)),'RESOURCE_NOT_FOUND');
select pg_temp.fb37_error(format('select public.eps_list_feedback(%L,%L::jsonb)',pg_temp.fb37_id('b7370008',1),'{}'),'RESOURCE_NOT_FOUND');
set local role postgres;
update eps.review_gateway_config set backend_key=decode(repeat('37',32),'hex'),enabled=true where id;
insert into eps.review_links(id,series_id,label,token_digest,expires_at,created_by)
 values(pg_temp.fb37_id('b7370012',1),pg_temp.fb37_id('b7370005',1),'Synthetic summary link',repeat('a',64),clock_timestamp()+interval'1hour',pg_temp.fb37_id('b7370001',1));
create function pg_temp.fb37_proof(operation text,input jsonb)returns jsonb language plpgsql volatile security definer set search_path=''as $$declare issued bigint:=floor(extract(epoch from clock_timestamp())*1000);nonce text:=encode(extensions.gen_random_bytes(16),'hex');signature text;begin
 signature:=encode(extensions.hmac(convert_to(eps.cast_canonical(jsonb_build_object('operation',operation,'input',input,'issued_at',issued,'nonce',nonce)),'UTF8'),(select backend_key from eps.review_gateway_config where id),'sha256'),'hex');return jsonb_build_object('issued_at',issued,'nonce',nonce,'signature',signature);
end$$;
create function pg_temp.fb37_guest(input jsonb)returns jsonb language sql volatile security invoker set search_path=''as $$select public.eps_guest_operation('get_feedback_summary',input,pg_temp.fb37_proof('get_feedback_summary',input))$$;
set local role anon;
select set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claims','{}',true);
do $guest37$declare r jsonb;input jsonb;proof jsonb;begin
 input:=jsonb_build_object('token_digest',repeat('a',64),'session_digest',repeat('b',64));
 perform public.eps_guest_operation('open',input,pg_temp.fb37_proof('open',input));
 r:=pg_temp.fb37_guest(jsonb_build_object('session_digest',repeat('b',64),'version_id',pg_temp.fb37_id('b7370008',1)));
 perform pg_temp.fb37_assert(r->'totals'='{"preferred":40,"maybe":40,"not_preferred":40,"comment_count":114,"unresolved_count":104}'::jsonb,'guest excludes every internal count and includes replies');
 perform pg_temp.fb37_assert(r->>'version_id'=pg_temp.fb37_id('b7370008',1)::text,'guest exact old viewed version');
 perform pg_temp.fb37_error(format('select public.eps_get_feedback_summary(%L)',pg_temp.fb37_id('b7370008',1)),'42501');
 perform pg_temp.fb37_error(format('select pg_temp.fb37_guest(%L::jsonb)',jsonb_build_object('session_digest',repeat('b',64),'version_id',pg_temp.fb37_id('b7370008',3))),'RESOURCE_NOT_FOUND');
 perform pg_temp.fb37_error(format('select pg_temp.fb37_guest(%L::jsonb)',jsonb_build_object('session_digest',repeat('b',64),'version_id',pg_temp.fb37_id('b7370008',4))),'RESOURCE_NOT_FOUND');
 perform pg_temp.fb37_error(format('select pg_temp.fb37_guest(%L::jsonb)',jsonb_build_object('session_digest',repeat('b',64),'version_id',pg_temp.fb37_id('b7370008',1),'options','{}'::jsonb)),'VALIDATION_FAILED');
 input:=jsonb_build_object('session_digest',repeat('b',64),'version_id',pg_temp.fb37_id('b7370008',1));
 perform pg_temp.fb37_error(format('select public.eps_guest_operation(%L,%L::jsonb,%L::jsonb)','get_feedback_summary',input,'{"issued_at":1000000000000,"nonce":"00000000000000000000000000000000","signature":"0000000000000000000000000000000000000000000000000000000000000000"}'),'REVIEW_UNAVAILABLE');
 proof:=pg_temp.fb37_proof('get_feedback_summary',input);
 perform public.eps_guest_operation('get_feedback_summary',input,proof);
 perform pg_temp.fb37_error(format('select public.eps_guest_operation(%L,%L::jsonb,%L::jsonb)','get_feedback_summary',input,proof),'REVIEW_UNAVAILABLE');
end$guest37$;
-- Revocation, rotation and expiry checks use nested savepoints and
-- restore the original synthetic session/link before the next check.
set local role postgres;
savepoint feedback37_revoke;
update eps.review_links set revoked_at=clock_timestamp()where id=pg_temp.fb37_id('b7370012',1);
set local role anon;
select pg_temp.fb37_error(format('select pg_temp.fb37_guest(%L::jsonb)',jsonb_build_object('session_digest',repeat('b',64),'version_id',pg_temp.fb37_id('b7370008',1))),'REVIEW_UNAVAILABLE');
set local role postgres;rollback to savepoint feedback37_revoke;release savepoint feedback37_revoke;
savepoint feedback37_rotate;
update eps.review_links set token_generation=token_generation+1 where id=pg_temp.fb37_id('b7370012',1);
set local role anon;
select pg_temp.fb37_error(format('select pg_temp.fb37_guest(%L::jsonb)',jsonb_build_object('session_digest',repeat('b',64),'version_id',pg_temp.fb37_id('b7370008',1))),'REVIEW_UNAVAILABLE');
set local role postgres;rollback to savepoint feedback37_rotate;release savepoint feedback37_rotate;
savepoint feedback37_link_expire;
update eps.review_links set expires_at=clock_timestamp()-interval'1second'where id=pg_temp.fb37_id('b7370012',1);
set local role anon;
select pg_temp.fb37_error(format('select pg_temp.fb37_guest(%L::jsonb)',jsonb_build_object('session_digest',repeat('b',64),'version_id',pg_temp.fb37_id('b7370008',1))),'REVIEW_UNAVAILABLE');
set local role postgres;rollback to savepoint feedback37_link_expire;release savepoint feedback37_link_expire;
savepoint feedback37_expire;
update eps.guest_sessions set expires_at=clock_timestamp()-interval'1second'where session_token_digest=repeat('b',64);
set local role anon;
select pg_temp.fb37_error(format('select pg_temp.fb37_guest(%L::jsonb)',jsonb_build_object('session_digest',repeat('b',64),'version_id',pg_temp.fb37_id('b7370008',1))),'REVIEW_UNAVAILABLE');
set local role postgres;rollback to savepoint feedback37_expire;release savepoint feedback37_expire;
-- Entire fixture and additive DDL are rolled back by the caller before hashes.
select'FEEDBACK37_COUNTS_AUTHORITY_ASSERTIONS_PASSED_SYNTHETIC_ONLY';
