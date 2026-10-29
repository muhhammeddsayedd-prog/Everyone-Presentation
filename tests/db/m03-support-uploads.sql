-- Synthetic SQL state/security only; no media/native/provider or hosted TUS claim.
create function pg_temp.support_assert(ok boolean,label text)returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'SUPPORT_ASSERTION: %',label;end if;end $$;
create function pg_temp.support_expect(query text,expected text)returns void language plpgsql as $$begin begin execute query;exception when others then if sqlerrm=expected or sqlstate=expected then return;end if;raise exception 'SUPPORT_WRONG_ERROR % / % expected %',sqlstate,sqlerrm,expected;end;raise exception'SUPPORT_EXPECTED_DENIAL: %',expected;end $$;
insert into auth.users(id,is_anonymous,deleted_at,banned_until)values('7a5f0000-0000-4000-8000-000000000001',false,null,null),('7a5f0000-0000-4000-8000-000000000002',false,null,null);
insert into public.projects(id,name)values('7b5f0000-0000-4000-8000-000000000001','Synthetic supporting references');
insert into eps.workspaces(id,project_id)values('7c5f0000-0000-4000-8000-000000000001','7b5f0000-0000-4000-8000-000000000001');
insert into public.project_memberships(project_id,principal_id,can_write)values('7b5f0000-0000-4000-8000-000000000001','7a5f0000-0000-4000-8000-000000000001',true);
insert into public.app_capability_grants(principal_id,capability)select'7a5f0000-0000-4000-8000-000000000001'::uuid,c from unnest(array['projects.read','workspaces.read','workspaces.write','cast.read','cast.write','cast.upload'])c;
update eps.candidate_support_config set uploads_enabled=true where id;
insert into eps.support_verification_keys(key_id,secret,not_before)values('synthetic-support-only',decode(repeat('71',32),'hex'),clock_timestamp()-interval'1 minute');
do $$begin perform set_config('request.jwt.claim.sub','7a5f0000-0000-4000-8000-000000000001',true);perform set_config('request.jwt.claims','{"sub":"7a5f0000-0000-4000-8000-000000000001","role":"authenticated"}',true);end $$;
set local role authenticated;
do $$declare c jsonb;r jsonb;begin
 c:=public.eps_create_candidate('{"facts":{"name":"Synthetic supporting profile","casting_id":null,"age_or_range":null,"stated_gender":null,"height_measurements":null,"languages":[],"accents":[],"skills_experience":null,"city":null,"previous_projects_roles":null,"classification":null}}','support-synthetic-profile');perform set_config('eps.support.target',c->>'id',true);perform set_config('eps.support.candidate_before',c::text,true);
 r:=public.eps_reserve_support_upload(jsonb_build_object('workspace_id','7c5f0000-0000-4000-8000-000000000001','candidate_id',c->>'id','purpose','candidate_support','filename','synthetic.txt','mime_type','text/plain','size_bytes',50,'sha256',repeat('a',64)),'support-synthetic-reserve');perform set_config('eps.support.upload',r->>'upload_id',true);perform set_config('eps.support.asset',r#>>'{asset,id}',true);
 perform pg_temp.support_assert(r=public.eps_reserve_support_upload(jsonb_build_object('workspace_id','7c5f0000-0000-4000-8000-000000000001','candidate_id',c->>'id','purpose','candidate_support','filename','synthetic.txt','mime_type','text/plain','size_bytes',50,'sha256',repeat('a',64)),'support-synthetic-reserve'),'exact reservation replay');
 perform pg_temp.support_expect(format('select public.eps_reserve_support_upload(%L::jsonb,%L)',jsonb_build_object('workspace_id','7c5f0000-0000-4000-8000-000000000001','purpose','candidate_support','filename','synthetic.txt','mime_type','text/plain','size_bytes',50),'support-target-required'),'INVALID_REQUEST');
 perform pg_temp.support_expect(format('select public.eps_reserve_support_upload(%L::jsonb,%L)',jsonb_build_object('workspace_id','7c5f0000-0000-4000-8000-000000000001','candidate_id',c->>'id','purpose','candidate_support','filename','large.png','mime_type','image/png','size_bytes',5242881),'support-image-oversized'),'INVALID_REQUEST');
 perform set_config('request.headers','{"x-upsert":"false"}',true);perform pg_temp.support_assert(eps.support_storage_insert(r->>'bucket',r->>'object_key')and eps.support_storage_read(r->>'bucket',r->>'object_key'),'own open intent permits exact transfer and verification read');
end $$;
set local role postgres;
create function pg_temp.support_proof(p_upload uuid,p_width integer default null,p_height integer default null)returns jsonb language plpgsql as $$declare u eps.support_uploads;p jsonb;bytes bytea;begin
 select * into strict u from eps.support_uploads where id=p_upload;p:=jsonb_build_object('schema_version','candidate-support-verification.v1','audience','eps.candidate-support-verification','purpose','candidate_support','key_id','synthetic-support-only','verification_id',u.verification_id,'upload_id',u.id,'asset_id',u.asset_id,'principal_id',u.principal_id,'workspace_id',u.workspace_id,'candidate_id',u.candidate_id,'width',p_width,'height',p_height,'reservation_revision',u.reservation_revision,'bucket',u.bucket,'object_key',u.object_key,'size_bytes',u.expected_size_bytes,'sha256',repeat('a',64),'mime_type',u.expected_mime_type,'verified_format',case u.expected_mime_type when'image/png'then'png'else'utf8_text'end,'issued_at',floor(extract(epoch from clock_timestamp()))::bigint,'expires_at',floor(extract(epoch from clock_timestamp()))::bigint+90);bytes:=convert_to(p::text,'UTF8');
 return jsonb_build_object('payload',rtrim(translate(encode(bytes,'base64'),E'+/\n','-_'),'='),'mac',rtrim(translate(encode(extensions.hmac(bytes,decode(repeat('71',32),'hex'),'sha256'),'base64'),E'+/\n','-_'),'='));
end $$;
do $$begin perform set_config('eps.support.proof',pg_temp.support_proof(current_setting('eps.support.upload')::uuid)::text,true);end $$;
set local role authenticated;
do $$declare result jsonb;p jsonb:=current_setting('eps.support.proof')::jsonb;u uuid:=current_setting('eps.support.upload')::uuid;input jsonb:='{"actual_size_bytes":50,"start_processing":false}';list jsonb;s jsonb;begin
 perform pg_temp.support_expect(format('select public.eps_finalize_support_completion(%L,%L::jsonb,%L,%L,%L)',u,input,'support-bad-mac',p->>'payload',repeat('A',43)),'ACCESS_DENIED');
 result:=public.eps_finalize_support_completion(u,input,'support-finish-text',p->>'payload',p->>'mac');perform pg_temp.support_assert(result->>'status'='ready'and result->'processing_job_id'='null'::jsonb and result#>>'{asset,sha256}'=repeat('a',64),'verified text Ready without job');
 perform pg_temp.support_assert(result=public.eps_finalize_support_completion(u,input,'support-finish-text',null,null),'lost completion response replay skips proof only after current authorization');
 perform pg_temp.support_assert(public.eps_prepare_support_completion(u,input,'support-finish-another-key')->'replay'=result,'different-key completed replay same verified result');
 perform pg_temp.support_expect(format('select public.eps_finalize_support_completion(%L,%L::jsonb,%L,%L,%L)',u,'{"actual_size_bytes":50,"start_processing":true}','support-forbidden-ai',p->>'payload',p->>'mac'),'INVALID_REQUEST');
 list:=public.eps_list_candidate_support(current_setting('eps.support.target')::uuid);perform pg_temp.support_assert(jsonb_array_length(list->'data')=1,'one association only');s:=list#>'{data,0}';perform set_config('eps.support.record',s->>'id',true);
 perform pg_temp.support_assert(public.eps_get_candidate(current_setting('eps.support.target')::uuid)=current_setting('eps.support.candidate_before')::jsonb,'support does not modify shared facts/review/version');
 perform pg_temp.support_expect(format('select public.eps_archive_candidate_support(%L,%L::jsonb,%L)',s->>'id','{"row_version":2}','support-archive-stale'),'STALE_RESOURCE_VERSION');
 perform pg_temp.support_assert(public.eps_archive_candidate_support((s->>'id')::uuid,'{"row_version":1}','support-archive-first')='{"ok":true}'::jsonb,'versioned archive');
 perform pg_temp.support_assert(jsonb_array_length(public.eps_list_candidate_support(current_setting('eps.support.target')::uuid)->'data')=0,'archived association hidden from active list');
 perform pg_temp.support_assert(public.eps_get_candidate_support_asset(current_setting('eps.support.asset')::uuid)#>>'{asset,status}'='ready','known archived original retained and authorized');
end $$;
-- Cancel after verification/while bytes are in flight invalidates the intent and proof.
do $$declare r jsonb;begin r:=public.eps_reserve_support_upload(jsonb_build_object('workspace_id','7c5f0000-0000-4000-8000-000000000001','candidate_id',current_setting('eps.support.target'),'purpose','candidate_support','filename','synthetic.png','mime_type','image/png','size_bytes',50),'support-cancel-reserve');perform set_config('eps.support.cancel_upload',r->>'upload_id',true);end $$;
set local role postgres;do $$begin perform set_config('eps.support.cancel_proof',pg_temp.support_proof(current_setting('eps.support.cancel_upload')::uuid,3,2)::text,true);end $$;
set local role authenticated;
do $$declare u uuid:=current_setting('eps.support.cancel_upload')::uuid;p jsonb:=current_setting('eps.support.cancel_proof')::jsonb;r jsonb;begin
 perform public.eps_cancel_support_upload(u,'support-cancel-intent');perform pg_temp.support_expect(format('select public.eps_finalize_support_completion(%L,%L::jsonb,%L,%L,%L)',u,'{"actual_size_bytes":50,"start_processing":false}','support-finalize-after-cancel',p->>'payload',p->>'mac'),'UPLOAD_EXPIRED');
 r:=public.eps_get_support_upload(u);perform pg_temp.support_assert(r->>'status'='cancelled'and not eps.support_storage_insert(r->>'bucket',r->>'object_key')and not eps.support_storage_read(r->>'bucket',r->>'object_key'),'cancel denies late transfer/read/attach');
end $$;

-- Positive registered image, pagination, and explicit merge of Ready support.
do $$declare r jsonb;begin
 r:=public.eps_reserve_support_upload(jsonb_build_object('workspace_id','7c5f0000-0000-4000-8000-000000000001','candidate_id',current_setting('eps.support.target'),'purpose','candidate_support','filename','reference.png','mime_type','image/png','size_bytes',50),'support-image-positive');perform set_config('eps.support.image_upload',r->>'upload_id',true);
 r:=public.eps_reserve_support_upload(jsonb_build_object('workspace_id','7c5f0000-0000-4000-8000-000000000001','candidate_id',current_setting('eps.support.target'),'purpose','candidate_support','filename','reference2.png','mime_type','image/png','size_bytes',50),'support-image-positive2');perform set_config('eps.support.image_upload2',r->>'upload_id',true);
end $$;
set local role postgres;
do $$begin perform set_config('eps.support.image_proof',pg_temp.support_proof(current_setting('eps.support.image_upload')::uuid,3,2)::text,true);perform set_config('eps.support.image_proof2',pg_temp.support_proof(current_setting('eps.support.image_upload2')::uuid,4,2)::text,true);end $$;
set local role authenticated;
do $$declare p jsonb:=current_setting('eps.support.image_proof')::jsonb;p2 jsonb:=current_setting('eps.support.image_proof2')::jsonb;r jsonb;page jsonb;existing jsonb;linked jsonb;begin
 r:=public.eps_finalize_support_completion(current_setting('eps.support.image_upload')::uuid,'{"actual_size_bytes":50,"start_processing":false}','support-image-finalize',p->>'payload',p->>'mac');perform pg_temp.support_assert(r#>>'{asset,width}'='3'and r#>>'{asset,height}'='2','actual verifier image dimensions committed');
 perform public.eps_finalize_support_completion(current_setting('eps.support.image_upload2')::uuid,'{"actual_size_bytes":50,"start_processing":false}','support-image-finalize2',p2->>'payload',p2->>'mac');
 page:=public.eps_list_candidate_support(current_setting('eps.support.target')::uuid,null,1);perform pg_temp.support_assert(jsonb_array_length(page->'data')=1 and page#>>'{page,next_cursor}'is not null,'bounded support page cursor');
 perform pg_temp.support_assert(jsonb_array_length(public.eps_list_candidate_support(current_setting('eps.support.target')::uuid,(page#>>'{page,next_cursor}')::uuid,1)->'data')=1,'support next page');
 existing:=public.eps_create_candidate('{"facts":{"name":"Synthetic chosen existing profile","casting_id":null,"age_or_range":null,"stated_gender":null,"height_measurements":null,"languages":[],"accents":[],"skills_experience":null,"city":null,"previous_projects_roles":null,"classification":null}}','support-existing-target');perform set_config('eps.support.existing',existing->>'id',true);
 perform pg_temp.support_expect(format('select public.eps_list_candidate_support(%L,%L,1)',existing->>'id',page#>>'{page,next_cursor}'),'INVALID_REQUEST');
 linked:=public.eps_resolve_candidate_duplicate(current_setting('eps.support.target')::uuid,jsonb_build_object('row_version',1,'action','link_existing','existing_candidate_id',existing->>'id','existing_candidate_row_version',1),'support-explicit-link');
 perform pg_temp.support_assert(jsonb_array_length(public.eps_list_candidate_support((existing->>'id')::uuid)->'data')=2,'existing chosen profile shows both Ready supporting images');
 perform pg_temp.support_assert(jsonb_array_length(public.eps_list_candidate_support(current_setting('eps.support.target')::uuid)->'data')=0,'merged source has no duplicate active associations');
 perform pg_temp.support_assert(linked=public.eps_resolve_candidate_duplicate(current_setting('eps.support.target')::uuid,jsonb_build_object('row_version',1,'action','link_existing','existing_candidate_id',existing->>'id','existing_candidate_row_version',1),'support-explicit-link'),'identity link same-key replay');
end $$;
set local role postgres;
do $$begin
 perform pg_temp.support_assert((select count(*)=3 and count(distinct asset_id)=3 and bool_and(candidate_id=current_setting('eps.support.existing')::uuid)from eps.candidate_support),'Ready associations moved exactly once including retained archived record');
 perform pg_temp.support_assert((select count(*)=3 from eps.audit_events where principal_id='7a5f0000-0000-4000-8000-000000000001'and action='support.merge_association'),'one private audit per moved association');
 perform pg_temp.support_assert((select bool_and(candidate_id=current_setting('eps.support.target')::uuid)from eps.support_uploads),'immutable verification/upload candidate scope retained after merge');
 perform pg_temp.support_assert((select count(*)=3 and bool_and(sha256=repeat('a',64))from eps.media_assets where purpose='candidate_support'and status='ready'),'original Ready hashes unchanged by merge');
 perform pg_temp.support_assert(not has_function_privilege('authenticated','eps.support_move_after_merge(uuid,uuid)','EXECUTE')and has_function_privilege('eps_cast_owner','eps.support_move_after_merge(uuid,uuid)','EXECUTE'),'merge hook only cast mutation owner');
end $$;

set local role authenticated;
do $$declare r jsonb;begin
 r:=public.eps_reserve_support_upload(jsonb_build_object('workspace_id','7c5f0000-0000-4000-8000-000000000001','candidate_id',current_setting('eps.support.existing'),'purpose','candidate_support','filename','key-test.png','mime_type','image/png','size_bytes',50),'support-revocation-reserve');perform set_config('eps.support.key_upload',r->>'upload_id',true);
 r:=public.eps_reserve_support_upload(jsonb_build_object('workspace_id','7c5f0000-0000-4000-8000-000000000001','candidate_id',current_setting('eps.support.existing'),'purpose','candidate_support','filename','expired-test.png','mime_type','image/png','size_bytes',50),'support-expiration-reserve');perform set_config('eps.support.expired_upload',r->>'upload_id',true);
end $$;
set local role postgres;
do $$begin perform set_config('eps.support.key_proof',pg_temp.support_proof(current_setting('eps.support.key_upload')::uuid,3,2)::text,true);perform set_config('eps.support.expired_proof',pg_temp.support_proof(current_setting('eps.support.expired_upload')::uuid,3,2)::text,true);end $$;
update eps.support_verification_keys set revoked_at=clock_timestamp()where key_id='synthetic-support-only';
update eps.support_uploads set expires_at=created_at+interval'1 microsecond'where id=current_setting('eps.support.expired_upload')::uuid;
set local role authenticated;
do $$declare p jsonb:=current_setting('eps.support.key_proof')::jsonb;p2 jsonb:=current_setting('eps.support.expired_proof')::jsonb;begin
 perform pg_temp.support_expect(format('select public.eps_finalize_support_completion(%L,%L::jsonb,%L,%L,%L)',current_setting('eps.support.key_upload'),' {"actual_size_bytes":50,"start_processing":false}','support-revoked-key',p->>'payload',p->>'mac'),'ACCESS_DENIED');
 perform pg_temp.support_expect(format('select public.eps_finalize_support_completion(%L,%L::jsonb,%L,%L,%L)',current_setting('eps.support.expired_upload'),' {"actual_size_bytes":50,"start_processing":false}','support-expired-intent',p2->>'payload',p2->>'mac'),'UPLOAD_EXPIRED');
end $$;
set local role postgres;
update eps.support_verification_keys set revoked_at=null where key_id='synthetic-support-only';
create function pg_temp.support_tamper()returns trigger language plpgsql as $$begin if new.id=(select asset_id from eps.support_uploads where id=current_setting('eps.support.key_upload')::uuid)and new.status='ready'then new.width:=7;end if;return new;end $$;
create trigger synthetic_support_alter_dimensions before update on eps.media_assets for each row execute function pg_temp.support_tamper();
set local role authenticated;
do $$declare p jsonb:=current_setting('eps.support.key_proof')::jsonb;begin perform pg_temp.support_expect(format('select public.eps_finalize_support_completion(%L,%L::jsonb,%L,%L,%L)',current_setting('eps.support.key_upload'),' {"actual_size_bytes":50,"start_processing":false}','support-altered-dimensions',p->>'payload',p->>'mac'),'INVALID_TRANSITION');end $$;
set local role postgres;
drop trigger synthetic_support_alter_dimensions on eps.media_assets;
select pg_temp.support_assert((select status='open'from eps.support_uploads where id=current_setting('eps.support.key_upload')::uuid)and not exists(select 1 from eps.candidate_support where upload_id=current_setting('eps.support.key_upload')::uuid),'tampered Ready write rolls back with no association');
set local role postgres;
do $$declare r regprocedure;begin
 perform pg_temp.support_assert((select count(*)=0 from eps.jobs where workspace_id='7c5f0000-0000-4000-8000-000000000001'),'support creates zero jobs');
 foreach r in array array['eps.support_scope(uuid)'::regprocedure,'eps.support_require(uuid)'::regprocedure,'eps.support_upload_dto(uuid)'::regprocedure,'eps.support_verify_receipt(eps.support_uploads,text,text)'::regprocedure]loop perform pg_temp.support_assert(not has_function_privilege('authenticated',r,'EXECUTE')and not has_function_privilege('anon',r,'EXECUTE'),'private helper no user execution');end loop;
 perform pg_temp.support_assert(not has_table_privilege('authenticated','eps.support_verification_keys','SELECT')and not has_table_privilege('eps_support_upload_owner','eps.support_verification_keys','SELECT'),'key isolation');
 perform pg_temp.support_assert((select bool_and(relrowsecurity and relforcerowsecurity)from pg_class where oid in('eps.support_uploads'::regclass,'eps.candidate_support'::regclass,'eps.support_verification_keys'::regclass,'eps.candidate_support_config'::regclass)),'all support tables force RLS');
 perform set_config('request.jwt.claim.sub','7a5f0000-0000-4000-8000-000000000002',true);perform set_config('request.jwt.claims','{"sub":"7a5f0000-0000-4000-8000-000000000002","role":"authenticated"}',true);
end $$;
set local role authenticated;
do $$begin perform pg_temp.support_expect(format('select public.eps_get_support_upload(%L)',current_setting('eps.support.upload')),'RESOURCE_NOT_FOUND');perform pg_temp.support_expect(format('select public.eps_prepare_support_completion(%L,%L::jsonb,%L)',current_setting('eps.support.upload'),' {"actual_size_bytes":50,"start_processing":false}','support-finish-text'),'RESOURCE_NOT_FOUND');end $$;
set local role postgres;
select 'M03_SUPPORT_VERIFY_ASSOCIATE_ARCHIVE_CANCEL_REPLAY_RLS_PASSED';
