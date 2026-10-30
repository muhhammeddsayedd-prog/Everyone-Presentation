-- Local synthetic identities/versions only. Parent owns outer rollback.
set local role postgres;
insert into public.app_capability_grants(principal_id,capability)values(current_setting('eps.casting.fixture.actor')::uuid,'review_links.manage')on conflict do nothing;
update eps.review_gateway_config set backend_key=decode(repeat('17',32),'hex'),enabled=true where id;
create function pg_temp.m06_proof(p_operation text,p_input jsonb)returns jsonb language plpgsql volatile security definer set search_path=''as $$declare issued bigint:=floor(extract(epoch from clock_timestamp())*1000);nonce text:=encode(extensions.gen_random_bytes(16),'hex');signature text;begin
 signature:=encode(extensions.hmac(convert_to(eps.cast_canonical(jsonb_build_object('operation',p_operation,'input',p_input,'issued_at',issued,'nonce',nonce)),'UTF8'),(select backend_key from eps.review_gateway_config where id),'sha256'),'hex');
 return jsonb_build_object('issued_at',issued,'nonce',nonce,'signature',signature);
end$$;
create function pg_temp.m06_call(p_operation text,p_input jsonb)returns jsonb language sql volatile security invoker set search_path=''as $$select public.eps_guest_operation(p_operation,p_input,pg_temp.m06_proof(p_operation,p_input))$$;
set local role authenticated;
do $$declare a jsonb;b jsonb;replay jsonb;v1 uuid:=current_setting('eps.m05.selection.version')::uuid;v3 uuid:=current_setting('eps.m05.selection_v3.version')::uuid;begin
 a:=public.eps_create_review_link(current_setting('eps.m05.selection')::uuid,'{"label":"Synthetic A"}','{"token_digest":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","response_encrypted":"synthetic-encrypted-A"}','m06-create-link-A');
 if(a#>>'{link,expires_at}')::timestamptz not between clock_timestamp()+interval'30days'-interval'3seconds'and clock_timestamp()+interval'30days'+interval'3seconds'or a#>'{link,download_enabled}'<>'true'then raise exception'M06_DEFAULTS_FAILED';end if;
 replay:=public.eps_create_review_link(current_setting('eps.m05.selection')::uuid,'{"label":"Synthetic A"}','{"token_digest":"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc","response_encrypted":"new-random-retry-must-not-replace"}','m06-create-link-A');
 if a<>replay then raise exception'M06_CREDENTIAL_RESPONSE_REPLAY_FAILED';end if;
 begin perform public.eps_create_review_link(current_setting('eps.m05.selection')::uuid,'{"label":"Different"}','{"token_digest":"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc","response_encrypted":"synthetic"}','m06-create-link-A');raise exception'M06_MISMATCH_ACCEPTED';exception when raise_exception then if sqlerrm<>'IDEMPOTENCY_KEY_REUSED'then raise;end if;end;
 b:=public.eps_create_review_link(current_setting('eps.m05.selection')::uuid,'{"label":"Synthetic B"}','{"token_digest":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","response_encrypted":"synthetic-encrypted-B"}','m06-create-link-B');
 perform set_config('eps.m06.linkA',a#>>'{link,id}',true);perform set_config('eps.m06.linkB',b#>>'{link,id}',true);
 if jsonb_array_length(public.eps_list_review_links(jsonb_build_object('workspace_id',current_setting('eps.casting.fixture.workspace')))->'data')<>2 then raise exception'M06_LIST_FAILED';end if;
end$$;
select'M06_INTERNAL_DEFAULT30DAY_ENCRYPTED_REPLAY_MISMATCH_AND_LINK_SCOPE_PASSED';
set local role anon;
select set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claims','{}',true);
do $$declare a jsonb;b jsonb;v1 uuid:=current_setting('eps.m05.selection.version')::uuid;input jsonb;proof jsonb;begin
 begin perform 1 from eps.review_links;raise exception'M06_ANON_TABLE_READ_ACCEPTED';exception when insufficient_privilege then null;end;
 input:='{"token_digest":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","session_digest":"1111111111111111111111111111111111111111111111111111111111111111"}';
 begin perform public.eps_guest_operation('open',input,'{"issued_at":1000000000000,"nonce":"00000000000000000000000000000000","signature":"0000000000000000000000000000000000000000000000000000000000000000"}');raise exception'M06_PASS_HASH_WITHOUT_BACKEND_ACCEPTED';exception when raise_exception then if sqlerrm<>'REVIEW_UNAVAILABLE'then raise;end if;end;
 proof:=pg_temp.m06_proof('open',input);a:=public.eps_guest_operation('open',input,proof);
 begin perform public.eps_guest_operation('open',input,proof);raise exception'M06_BACKEND_PROOF_REPLAY_ACCEPTED';exception when raise_exception then if sqlerrm<>'REVIEW_UNAVAILABLE'then raise;end if;end;
 if a->'display_name'<>'null'or a->>'version_id'<>current_setting('eps.m05.selection_v3.version')then raise exception'M06_OPEN_BEFORE_NAME_OR_LATEST_FAILED';end if;
 b:=pg_temp.m06_call('open','{"token_digest":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","session_digest":"2222222222222222222222222222222222222222222222222222222222222222"}');
 perform set_config('eps.m06.guestA',a->>'guest_session_id',true);perform set_config('eps.m06.guestB',b->>'guest_session_id',true);
 a:=pg_temp.m06_call('get_current_version','{"session_digest":"1111111111111111111111111111111111111111111111111111111111111111"}');
 if a->>'status'<>'ready'or a?'render_context'or a?'snapshot'or a?'generated_by'or a?'input_fingerprint'or a#>>'{cover,output_type}'<>'selection'then raise exception'M06_EXTERNAL_PROJECTION_FAILED';end if;
 perform set_config('eps.m06.slide1',a#>>'{slides,1,id}',true);perform set_config('eps.m06.slide2',a#>>'{slides,3,id}',true);
 begin perform pg_temp.m06_call('get_version',jsonb_build_object('session_digest',repeat('1',64),'version_id',current_setting('eps.m05.shortlist.version')));raise exception'M06_OTHER_OUTPUT_ACCEPTED';exception when raise_exception then if sqlerrm<>'RESOURCE_NOT_FOUND'then raise;end if;end;
 begin perform pg_temp.m06_call('create_comment',jsonb_build_object('session_digest',repeat('1',64),'version_id',current_setting('eps.m05.selection_v3.version'),'input',jsonb_build_object('version_slide_id',current_setting('eps.m06.slide1'),'body','First'),'idempotency_key','m06-no-name-comment'));raise exception'M06_NAMELESS_FEEDBACK_ACCEPTED';exception when raise_exception then if sqlerrm<>'GUEST_IDENTITY_REQUIRED'then raise;end if;end;
 perform pg_temp.m06_call('identify',jsonb_build_object('session_digest',repeat('1',64),'display_name','Same synthetic label','company','Synthetic company'));
 perform pg_temp.m06_call('identify',jsonb_build_object('session_digest',repeat('2',64),'display_name','Same synthetic label'));
end$$;
select'M06_ANON_REAL_ROLE_HMAC_NONCE_REPLAY_NO_SIGNIN_SAFE_LATEST_AND_SCOPE_PASSED';
do $$declare a jsonb;b jsonb;request jsonb;feedback jsonb;pref jsonb;begin
 request:=jsonb_build_object('session_digest',repeat('1',64),'version_id',current_setting('eps.m05.selection_v3.version'),'input',jsonb_build_object('version_slide_id',current_setting('eps.m06.slide1'),'body','External synthetic comment'),'idempotency_key','m06-comment-replay-A');
 a:=pg_temp.m06_call('create_comment',request);if a<>pg_temp.m06_call('create_comment',request)then raise exception'M06_COMMENT_REPLAY_FAILED';end if;perform set_config('eps.m06.commentA',a->>'id',true);
 feedback:=pg_temp.m06_call('list_feedback',jsonb_build_object('session_digest',repeat('2',64),'version_id',current_setting('eps.m05.selection_v3.version'),'options','{}'::jsonb));
 if jsonb_array_length(feedback->'comments')<>1 or feedback#>>'{comments,0,id}'<>a->>'id'then raise exception'M06_EXTERNAL_CROSS_LINK_VISIBILITY_FAILED';end if;
 begin perform pg_temp.m06_call('update_comment',jsonb_build_object('session_digest',repeat('2',64),'comment_id',a->'id','input','{"row_version":1,"body":"Impersonation"}'::jsonb));raise exception'M06_SAME_NAME_EDIT_ACCEPTED';exception when raise_exception then if sqlerrm<>'RESOURCE_NOT_FOUND'then raise;end if;end;
 b:=pg_temp.m06_call('update_comment',jsonb_build_object('session_digest',repeat('1',64),'comment_id',a->'id','input','{"row_version":1,"body":"Own edited synthetic comment"}'::jsonb));
 if b->>'row_version'<>'2'or b->>'body'<>'Own edited synthetic comment'then raise exception'M06_OWN_EDIT_FAILED';end if;
 begin perform pg_temp.m06_call('create_comment',request||jsonb_build_object('input',(request->'input')||'{"visibility":"internal"}'::jsonb,'idempotency_key','m06-internal-injection'));raise exception'M06_GUEST_VISIBILITY_INJECTION_ACCEPTED';exception when raise_exception then if sqlerrm<>'VALIDATION_FAILED'then raise;end if;end;
 request:=jsonb_build_object('session_digest',repeat('1',64),'version_id',current_setting('eps.m05.selection_v3.version'),'input',jsonb_build_object('version_slide_id',current_setting('eps.m06.slide1'),'value','preferred'),'idempotency_key','m06-preference-A');
 pref:=pg_temp.m06_call('set_preference',request);if pref<>pg_temp.m06_call('set_preference',request)then raise exception'M06_PREFERENCE_REPLAY_FAILED';end if;
 perform pg_temp.m06_call('set_preference',request||jsonb_build_object('input',jsonb_build_object('version_slide_id',current_setting('eps.m06.slide2'),'value','not_preferred'),'idempotency_key','m06-preference-A-slot2'));
 pref:=pg_temp.m06_call('set_preference',request||jsonb_build_object('input',(request->'input')||'{"value":"maybe","row_version":1}'::jsonb,'idempotency_key','m06-preference-A-change'));
 if pref#>>'{preference,row_version}'<>'2'or pref#>>'{preference,value}'<>'maybe'then raise exception'M06_PREFERENCE_UPDATE_FAILED';end if;
 feedback:=pg_temp.m06_call('list_feedback',jsonb_build_object('session_digest',repeat('2',64),'version_id',current_setting('eps.m05.selection_v3.version'),'options','{}'::jsonb));
 if jsonb_array_length(feedback->'preferences')<>2 then raise exception'M06_INDEPENDENT_REPEATED_ASSIGNMENT_PREFERENCES_FAILED';end if;
end$$;
select'M06_SHARED_EXTERNAL_FEEDBACK_SAME_NAME_OWNERSHIP_REPLAY_AND_INDEPENDENT_PREFERENCES_PASSED';
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('eps.casting.fixture.actor'),true),set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('eps.casting.fixture.actor'),'role','authenticated')::text,true);
do $$declare a jsonb;begin
 a:=public.eps_create_comment(current_setting('eps.m05.selection_v3.version')::uuid,jsonb_build_object('version_slide_id',current_setting('eps.m06.slide1'),'visibility','internal','body','INTERNAL_SYNTHETIC_NEVER_EXTERNAL'),'m06-internal-comment');
 if jsonb_array_length(public.eps_list_feedback(current_setting('eps.m05.selection_v3.version')::uuid,'{}')->'comments')<>2 then raise exception'M06_INTERNAL_NOTE_VISIBILITY_FAILED';end if;
 perform public.eps_update_comment(current_setting('eps.m06.commentA')::uuid,'{"row_version":2,"resolved":true}');
end$$;
set local role anon;
do $$declare feedback jsonb;begin
 feedback:=pg_temp.m06_call('list_feedback',jsonb_build_object('session_digest',repeat('2',64),'version_id',current_setting('eps.m05.selection_v3.version'),'options','{}'::jsonb));
 if jsonb_array_length(feedback->'comments')<>1 or position('INTERNAL_SYNTHETIC' in feedback::text)>0 or feedback#>'{comments,0,resolved}'<>'true'then raise exception'M06_INTERNAL_NOTE_LEAK_OR_MODERATION_FAILED';end if;
 if pg_temp.m06_call('get_version',jsonb_build_object('session_digest',repeat('1',64),'version_id',current_setting('eps.m05.selection.version')))->>'id'<>current_setting('eps.m05.selection.version')then raise exception'M06_OLD_VIEWED_VERSION_LOST';end if;
end$$;
select'M06_INTERNAL_NOTE_FILTER_MODERATION_AND_FIXED_OLD_VERSION_PASSED';
set local role postgres;
do $$declare a uuid:=current_setting('eps.m06.linkA')::uuid;version uuid:=current_setting('eps.m05.selection.version')::uuid;export uuid:=gen_random_uuid();job uuid:=gen_random_uuid();begin
 -- Deliberately synthetic grant metadata: tests only parent lifecycle, not PDF bytes.
 insert into eps.jobs(id,workspace_id,requested_by,kind,resource_id,input,input_hash,input_hash_version,dedupe_key,stage,correlation_id)
 values(job,current_setting('eps.casting.fixture.workspace')::uuid,current_setting('eps.casting.fixture.actor')::uuid,'presentation_render',export,'{}',repeat('9',64),'eps.presentation-job-input.cast-canonical.v1',encode(sha256(convert_to(job::text,'UTF8')),'hex'),'prepare_presentation','m06-synthetic-grant-parent');
 insert into eps.presentation_exports(id,version_id,review_link_id,template_version,export_revision,parent_token_generation,job_id)values(export,version,a,'1.1.0',1,1,job);
 insert into eps.review_media_grants(review_link_id,version_id,export_id,parent_token_generation,token_digest,expires_at,producing_attempt_id)values(a,version,export,1,repeat('6',64),clock_timestamp()-interval'1day',gen_random_uuid()),(a,version,export,1,repeat('7',64),clock_timestamp()-interval'1day',gen_random_uuid());
 update eps.review_media_grants set revoked_at=clock_timestamp()where token_digest=repeat('7',64);
end$$;
set local role authenticated;
do $$declare link jsonb;rv bigint;begin
 link:=public.eps_update_review_link(current_setting('eps.m06.linkA')::uuid,'{"row_version":1,"download_enabled":false}');
 if link->'download_enabled'<>'false'then raise exception'M06_DOWNLOAD_TOGGLE_FAILED';end if;
 link:=public.eps_update_review_link(current_setting('eps.m06.linkA')::uuid,jsonb_build_object('row_version',2,'expires_at',clock_timestamp()-interval'1second'));
end$$;
set local role anon;
do $$begin
 begin perform pg_temp.m06_call('session',jsonb_build_object('session_digest',repeat('1',64)));raise exception'M06_EXPIRED_PARENT_SESSION_ACCEPTED';exception when raise_exception then if sqlerrm<>'REVIEW_UNAVAILABLE'then raise;end if;end;
end$$;
set local role authenticated;
do $$declare link jsonb;begin
 link:=public.eps_update_review_link(current_setting('eps.m06.linkA')::uuid,jsonb_build_object('row_version',3,'expires_at',clock_timestamp()+interval'10days'));
end$$;
set local role postgres;
do $$begin
 if not exists(select 1 from eps.review_media_grants where token_digest=repeat('6',64)and expires_at>clock_timestamp()and revoked_at is null)
 or not exists(select 1 from eps.review_media_grants where token_digest=repeat('7',64)and expires_at<clock_timestamp()and revoked_at is not null)then raise exception'M06_GRANT_EXPIRY_PROPAGATION_OR_REVOKED_REVIVAL_FAILED';end if;
end$$;
set local role anon;
do $$begin
 if pg_temp.m06_call('session',jsonb_build_object('session_digest',repeat('1',64)))->'download_enabled'<>'false'then raise exception'M06_DISABLE_DOWNLOAD_VIEW_FAILED';end if;
 begin perform pg_temp.m06_call('prepare_export',jsonb_build_object('session_digest',repeat('1',64),'version_id',current_setting('eps.m05.selection.version'),'idempotency_key','m06-disabled-export'));raise exception'M06_DISABLED_DOWNLOAD_PREPARE_ACCEPTED';exception when raise_exception then if sqlerrm<>'DOWNLOAD_DISABLED'then raise;end if;end;
end$$;
select'M06_EXPIRY_EXTENSION_NON_REVOKED_ONLY_DOWNLOAD_DISABLE_VIEW_AND_PREPARE_DENIAL_PASSED';
set local role authenticated;
do $$declare rotated jsonb;begin
 rotated:=public.eps_rotate_review_link(current_setting('eps.m06.linkA')::uuid,'{"row_version":4}','{"token_digest":"dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd","response_encrypted":"synthetic-rotated-A"}','m06-rotate-link-A');
 if rotated<>public.eps_rotate_review_link(current_setting('eps.m06.linkA')::uuid,'{"row_version":4}','{"token_digest":"eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee","response_encrypted":"different-retry"}','m06-rotate-link-A')then raise exception'M06_ROTATION_REPLAY_FAILED';end if;
 perform public.eps_revoke_review_link(current_setting('eps.m06.linkB')::uuid,'{"row_version":1}','m06-revoke-link-B');
end$$;
set local role anon;
do $$begin
 begin perform pg_temp.m06_call('session',jsonb_build_object('session_digest',repeat('1',64)));raise exception'M06_ROTATED_SESSION_ACCEPTED';exception when raise_exception then if sqlerrm<>'REVIEW_UNAVAILABLE'then raise;end if;end;
 begin perform pg_temp.m06_call('session',jsonb_build_object('session_digest',repeat('2',64)));raise exception'M06_REVOKED_SESSION_ACCEPTED';exception when raise_exception then if sqlerrm<>'REVIEW_UNAVAILABLE'then raise;end if;end;
 begin perform pg_temp.m06_call('open',jsonb_build_object('token_digest',repeat('a',64),'session_digest',repeat('3',64)));raise exception'M06_OLD_LINK_TOKEN_ACCEPTED';exception when raise_exception then if sqlerrm<>'REVIEW_UNAVAILABLE'then raise;end if;end;
end$$;
set local role postgres;
do $$begin
 if exists(select 1 from eps.review_media_grants where review_link_id=current_setting('eps.m06.linkA')::uuid and revoked_at is null)then raise exception'M06_ROTATION_GRANTS_REMAINED_ACTIVE';end if;
 if exists(select 1 from eps.assignments where workspace_id=current_setting('eps.casting.fixture.workspace')::uuid and position<>'option')then raise exception'M06_GUEST_PREFERENCE_CHANGED_CASTING';end if;
end$$;
select'M06_ROTATION_REVOKE_OLD_TOKEN_SESSION_GRANTS_AND_CASTING_PRESERVATION_PASSED';
set local role postgres;
insert into eps.audience_presets(id,key,label,scope)values('8a7a0000-0000-4000-8000-000000000002','m06-empty-external','Synthetic preparing','external'),('8a7a0000-0000-4000-8000-000000000003','m06-empty-internal','Synthetic private','internal');
set local role authenticated;
do $$declare series jsonb;private_series jsonb;link jsonb;request jsonb;first jsonb;begin
 series:=public.eps_create_presentation_series(jsonb_build_object('workspace_id',current_setting('eps.casting.fixture.workspace'),'output_type','selection','audience_preset_id','8a7a0000-0000-4000-8000-000000000002'),'m06-empty-external-series');
 private_series:=public.eps_create_presentation_series(jsonb_build_object('workspace_id',current_setting('eps.casting.fixture.workspace'),'output_type','selection','audience_preset_id','8a7a0000-0000-4000-8000-000000000003'),'m06-empty-internal-series');
 begin perform public.eps_create_review_link((private_series->>'id')::uuid,'{}',jsonb_build_object('token_digest',repeat('9',64),'response_encrypted','synthetic-private-rejected'),'m06-private-link-reject');raise exception'M06_INTERNAL_SERIES_SHARED';exception when raise_exception then if sqlerrm<>'EXTERNAL_SERIES_REQUIRED'then raise;end if;end;
 link:=public.eps_create_review_link((series->>'id')::uuid,'{}',jsonb_build_object('token_digest',repeat('8',64),'response_encrypted','synthetic-preparing'),'m06-empty-link-create');
 perform set_config('eps.m06.emptyLink',link#>>'{link,id}',true);
 request:='{"row_version":1,"label":"Synthetic edit"}';first:=public.eps_update_review_link((link#>>'{link,id}')::uuid,request,'m06-update-link-replay');
 if first<>public.eps_update_review_link((link#>>'{link,id}')::uuid,request,'m06-update-link-replay')then raise exception'M06_UPDATE_LINK_ACK_REPLAY_FAILED';end if;
end$$;
set local role anon;
do $$declare access jsonb;first jsonb;request jsonb;begin
 access:=pg_temp.m06_call('open',jsonb_build_object('token_digest',repeat('8',64),'session_digest',repeat('3',64)));
 if access->'version_id'<>'null'or pg_temp.m06_call('get_current_version',jsonb_build_object('session_digest',repeat('3',64)))is not null then raise exception'M06_PREPARING_STATE_FAILED';end if;
 request:=jsonb_build_object('session_digest',repeat('3',64),'display_name','Synthetic preparing reviewer','idempotency_key','m06-identify-ack-replay');first:=pg_temp.m06_call('identify',request);
 if first<>pg_temp.m06_call('identify',request)then raise exception'M06_IDENTIFY_ACK_REPLAY_FAILED';end if;
end$$;
select'M06_NO_READY_PREPARING_INTERNAL_SERIES_DENIAL_OPTIONAL_MUTATION_ACK_REPLAY_PASSED';
