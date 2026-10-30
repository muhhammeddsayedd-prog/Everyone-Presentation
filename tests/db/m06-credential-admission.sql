-- Local synthetic backend/acting identities. Real anon/authenticated roles.
set local role postgres;
insert into public.app_capability_grants(principal_id,capability)values(current_setting('eps.casting.fixture.actor')::uuid,'review_links.manage')on conflict do nothing;
update eps.review_gateway_config set backend_key=decode(repeat('17',32),'hex'),enabled=true where id;
create function pg_temp.m06_proof(p_operation text,p_input jsonb)returns jsonb language plpgsql volatile security definer set search_path=''as $$declare issued bigint:=floor(extract(epoch from clock_timestamp())*1000);nonce text:=encode(extensions.gen_random_bytes(16),'hex');signature text;begin
 signature:=encode(extensions.hmac(convert_to(eps.cast_canonical(jsonb_build_object('operation',p_operation,'input',p_input,'issued_at',issued,'nonce',nonce)),'UTF8'),(select backend_key from eps.review_gateway_config where id),'sha256'),'hex');return jsonb_build_object('issued_at',issued,'nonce',nonce,'signature',signature);
end$$;
create function pg_temp.m06_call(p_operation text,p_input jsonb)returns jsonb language sql volatile security invoker set search_path=''as $$select public.eps_guest_operation(p_operation,p_input,pg_temp.m06_proof(p_operation,p_input))$$;
create function pg_temp.m06_credential(p_operation text,p_subject uuid,p_input jsonb,p_key text,p_digest text,p_cipher text,p_actor uuid default null)returns jsonb language sql volatile security definer set search_path=''as $$
 select jsonb_build_object('token_digest',p_digest,'response_encrypted',p_cipher,'proof',pg_temp.m06_proof(p_operation,jsonb_build_object('actor_id',coalesce(p_actor,auth.uid()),'subject_id',p_subject,'input',p_input,'idempotency_key',p_key,'token_digest',p_digest,'response_encrypted',p_cipher)))
$$;
set local role authenticated;
do $$declare series uuid:=current_setting('eps.m05.selection')::uuid;before_count bigint;begin
 begin perform public.eps_create_review_link(series,'{"label":"Unsigned direct RPC"}',jsonb_build_object('token_digest',repeat('a',64),'response_encrypted','predictable-plaintext-response'),'m06-26-unsigned-create');raise exception'M06_26_UNSIGNED_DIRECT_CREDENTIAL_ACCEPTED';exception when raise_exception then if sqlerrm<>'BACKEND_CREDENTIAL_REQUIRED'then raise;end if;end;
 begin perform eps.review_credential_admit(auth.uid(),'create_review_link',series,'{}','m06-26-private-helper','{}');raise exception'M06_26_AUTHENTICATED_PRIVATE_VERIFIER_EXECUTE';exception when insufficient_privilege then null;end;
end$$;
select'M06_26_UNSIGNED_DIRECT_RPC_AND_PRIVATE_VERIFIER_DENIAL_PASSED';
do $$declare series uuid:=current_setting('eps.m05.selection')::uuid;body jsonb:='{"label":"Backend supplied synthetic"}';key text:='m06-26-valid-create';credential jsonb;first jsonb;retry jsonb;forged jsonb;begin
 credential:=pg_temp.m06_credential('create_review_link',series,body,key,repeat('a',64),'synthetic-protected-first');
 forged:=credential||jsonb_build_object('token_digest',repeat('b',64));
 begin perform public.eps_create_review_link(series,body,forged,key);raise exception'M06_26_DIGEST_TAMPERING_ACCEPTED';exception when raise_exception then if sqlerrm<>'REVIEW_UNAVAILABLE'then raise;end if;end;
 forged:=credential||jsonb_build_object('response_encrypted','different-ciphertext');
 begin perform public.eps_create_review_link(series,body,forged,key);raise exception'M06_26_CIPHERTEXT_TAMPERING_ACCEPTED';exception when raise_exception then if sqlerrm<>'REVIEW_UNAVAILABLE'then raise;end if;end;
 begin perform public.eps_create_review_link(series,'{"label":"Other semantic input"}',credential,key);raise exception'M06_26_SEMANTIC_TAMPERING_ACCEPTED';exception when raise_exception then if sqlerrm<>'REVIEW_UNAVAILABLE'then raise;end if;end;
 begin perform public.eps_create_review_link(series,body,credential,key||'-other');raise exception'M06_26_IDEMPOTENCY_TAMPERING_ACCEPTED';exception when raise_exception then if sqlerrm<>'REVIEW_UNAVAILABLE'then raise;end if;end;
 begin perform public.eps_create_review_link(current_setting('eps.m05.shortlist')::uuid,body,credential,key);raise exception'M06_26_SUBJECT_TAMPERING_ACCEPTED';exception when raise_exception then if sqlerrm<>'REVIEW_UNAVAILABLE'then raise;end if;end;
 forged:=pg_temp.m06_credential('rotate_review_link',series,body,key,repeat('a',64),'synthetic-protected-first');
 begin perform public.eps_create_review_link(series,body,forged,key);raise exception'M06_26_OPERATION_TAMPERING_ACCEPTED';exception when raise_exception then if sqlerrm<>'REVIEW_UNAVAILABLE'then raise;end if;end;
 forged:=pg_temp.m06_credential('create_review_link',series,body,key,repeat('a',64),'synthetic-protected-first',current_setting('eps.casting.fixture.actor2')::uuid);
 begin perform public.eps_create_review_link(series,body,forged,key);raise exception'M06_26_ACTOR_TAMPERING_ACCEPTED';exception when raise_exception then if sqlerrm<>'REVIEW_UNAVAILABLE'then raise;end if;end;
 first:=public.eps_create_review_link(series,body,credential,key);perform set_config('eps.m06.admission.link',first#>>'{link,id}',true);
 begin perform public.eps_create_review_link(series,body,credential,key);raise exception'M06_26_PROOF_NONCE_REPLAY_ACCEPTED';exception when raise_exception then if sqlerrm<>'REVIEW_UNAVAILABLE'then raise;end if;end;
 retry:=public.eps_create_review_link(series,body,pg_temp.m06_credential('create_review_link',series,body,key,repeat('b',64),'new-retry-ciphertext'),key);
 if first<>retry then raise exception'M06_26_FRESH_PROOF_LOST_ACK_REPLAY_FAILED';end if;
 begin perform public.eps_create_review_link(series,'{"label":"Changed request"}',pg_temp.m06_credential('create_review_link',series,'{"label":"Changed request"}',key,repeat('b',64),'retry-mismatch'),key);raise exception'M06_26_SEMANTIC_IDK_MISMATCH_ACCEPTED';exception when raise_exception then if sqlerrm<>'IDEMPOTENCY_KEY_REUSED'then raise;end if;end;
end$$;
select'M06_26_ACTOR_OPERATION_SUBJECT_INPUT_IDK_DIGEST_CIPHERTEXT_MAC_AND_FRESH_ACK_REPLAY_PASSED';
set local role postgres;
do $$begin
 if(select count(*)from eps.review_links)<>1 or(select count(*)from eps.review_link_replays)<>1 then raise exception'M06_26_DENIED_PROOFS_CREATED_ROWS';end if;
 if has_table_privilege('eps_review_owner','eps.review_gateway_config','SELECT')or has_table_privilege('authenticated','eps.review_gateway_config','SELECT')then raise exception'M06_26_BROAD_VERIFIER_KEY_READ_GRANTED';end if;
end$$;
set local role authenticated;
do $$declare link uuid:=current_setting('eps.m06.admission.link')::uuid;body jsonb:='{"row_version":1}';key text:='m06-26-valid-rotate';credential jsonb;first jsonb;retry jsonb;begin
 begin perform public.eps_rotate_review_link(link,body,jsonb_build_object('token_digest',repeat('c',64),'response_encrypted','unsigned-direct-rotate'),key);raise exception'M06_26_UNSIGNED_ROTATION_ACCEPTED';exception when raise_exception then if sqlerrm<>'BACKEND_CREDENTIAL_REQUIRED'then raise;end if;end;
 credential:=pg_temp.m06_credential('rotate_review_link',link,body,key,repeat('c',64),'synthetic-rotated-first');first:=public.eps_rotate_review_link(link,body,credential,key);
 begin perform public.eps_rotate_review_link(link,body,credential,key);raise exception'M06_26_ROTATION_PROOF_REPLAY_ACCEPTED';exception when raise_exception then if sqlerrm<>'REVIEW_UNAVAILABLE'then raise;end if;end;
 retry:=public.eps_rotate_review_link(link,body,pg_temp.m06_credential('rotate_review_link',link,body,key,repeat('d',64),'synthetic-rotation-retry'),key);if first<>retry then raise exception'M06_26_ROTATION_FRESH_ACK_REPLAY_FAILED';end if;
end$$;
set local role postgres;
do $$begin if not exists(select 1 from eps.review_links where id=current_setting('eps.m06.admission.link')::uuid and token_generation=2 and export_revision=2 and token_digest=repeat('c',64))then raise exception'M06_26_DUPLICATE_ROTATION_EFFECT';end if;end$$;
select'M06_26_ROTATION_UNSIGNED_NONCE_REPLAY_DENIED_FRESH_ACK_ONCE_PASSED';
select set_config('eps.m06.admission.nonces_before',(select count(*)from eps.review_gateway_nonces)::text,true),set_config('eps.m06.admission.links_before',(select count(*)from eps.review_links)::text,true);
set local role authenticated;
do $$declare series uuid:=current_setting('eps.m05.selection')::uuid;body jsonb:=jsonb_build_object('expires_at',to_jsonb(clock_timestamp()-interval'1second'));key text:='m06-26-rollback-proof';credential jsonb;begin
 credential:=pg_temp.m06_credential('create_review_link',series,body,key,repeat('e',64),'synthetic-rollback');
 begin perform public.eps_create_review_link(series,body,credential,key);raise exception'M06_26_EXPIRED_CREATE_ACCEPTED';exception when raise_exception then if sqlerrm<>'VALIDATION_FAILED'then raise;end if;end;
end$$;
set local role postgres;
do $$begin if(select count(*)from eps.review_gateway_nonces)<>current_setting('eps.m06.admission.nonces_before')::bigint or(select count(*)from eps.review_links)<>current_setting('eps.m06.admission.links_before')::bigint or exists(select 1 from eps.review_link_replays where key='m06-26-rollback-proof')then raise exception'M06_26_PROOF_NONCE_OR_ROWS_SURVIVED_ROLLBACK';end if;end$$;
select set_config('request.jwt.claim.sub',current_setting('eps.casting.fixture.actor2'),true),set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('eps.casting.fixture.actor2'),'role','authenticated')::text,true);
set local role authenticated;
do $$declare series uuid:=current_setting('eps.m05.selection')::uuid;begin
 begin perform public.eps_create_review_link(series,'{}',pg_temp.m06_credential('create_review_link',series,'{}','m06-26-unprivileged',repeat('f',64),'synthetic-unprivileged'),'m06-26-unprivileged');raise exception'M06_26_BACKEND_PROOF_BYPASSED_ACTOR_AUTHORITY';exception when raise_exception then if sqlerrm<>'RESOURCE_NOT_FOUND'then raise;end if;end;
end$$;
select set_config('request.jwt.claim.sub',current_setting('eps.casting.fixture.actor'),true),set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('eps.casting.fixture.actor'),'role','authenticated')::text,true);
select'M06_26_CURRENT_AUTHORITY_AND_NONCE_ROW_IDEMPOTENCY_TRANSACTION_ROLLBACK_PASSED';
set local role anon;
select pg_temp.m06_call('open',jsonb_build_object('token_digest',repeat('c',64),'session_digest',repeat('1',64)));
