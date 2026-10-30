-- Bounded forward fix on exact25. Retain25 and its historical proofs unchanged.
set local search_path='';set local lock_timeout='3s';set local statement_timeout='30s';
do $$begin
 if current_user<>'postgres'or current_database()<>'postgres'or(select count(*)from supabase_migrations.schema_migrations)<>25
 or(select max(version)from supabase_migrations.schema_migrations)<>'20261030002634'
 or to_regprocedure('eps.review_credential_admit(uuid,text,uuid,jsonb,text,jsonb)')is not null then raise exception'M06_CREDENTIAL_ADMISSION_EXACT25_REQUIRED';end if;
end$$;
create function eps.review_credential_admit(p_actor uuid,p_operation text,p_subject uuid,p_input jsonb,p_idempotency_key text,p_credential jsonb)returns void
language plpgsql volatile security definer set search_path=''as $$begin
 -- p_actor is supplied only by the scoped public wrapper's auth.uid(), after
 -- its ordinary current-project/capability authorization. Private callers are
 -- restricted to the existing NOLOGIN review owner, never authenticated users.
 if p_actor is null or p_subject is null or p_operation not in('create_review_link','rotate_review_link')
 or jsonb_typeof(p_credential)is distinct from'object'or not p_credential?&array['token_digest','response_encrypted','proof']
 then perform eps.fail('BACKEND_CREDENTIAL_REQUIRED','Create or rotate review credentials through the Studio API.',403);end if;
 perform eps.review_body(p_credential,array['token_digest','response_encrypted','proof'],array['token_digest','response_encrypted','proof']);
 perform eps.review_credential(p_credential-'proof');
 perform eps.review_gateway_verify(p_operation,jsonb_build_object('actor_id',p_actor,'subject_id',p_subject,'input',p_input,'idempotency_key',p_idempotency_key,'token_digest',p_credential->>'token_digest','response_encrypted',p_credential->>'response_encrypted'),p_credential->'proof');
end$$;
grant create on schema eps to eps_guest_owner;
alter function eps.review_credential_admit(uuid,text,uuid,jsonb,text,jsonb)owner to eps_guest_owner;
revoke create on schema eps from eps_guest_owner;
revoke all on function eps.review_credential_admit(uuid,text,uuid,jsonb,text,jsonb)from public,anon,authenticated,service_role;
grant execute on function eps.review_credential_admit(uuid,text,uuid,jsonb,text,jsonb)to eps_review_owner;

do $forward$declare item record;definition text;source text;anchor text;replacement text;begin
 for item in select * from(values
 ('public.eps_create_review_link(uuid,jsonb,jsonb,text)','3ade5c58360ef5b7784e31be13b847d91aa1aa9f07f96bc2c9ed917762411e31','create_review_link'),
 ('public.eps_rotate_review_link(uuid,jsonb,jsonb,text)','fac06878045b05dbb5770a22cc02068c20fd42068161f4fc0c1589cd98179a94','rotate_review_link')
 )v(signature,expected_sha,operation)loop
  select prosrc,pg_get_functiondef(oid)into source,definition from pg_proc where oid=item.signature::regprocedure;
  if encode(sha256(convert_to(source,'UTF8')),'hex')<>item.expected_sha
  or(length(source)-length(replace(source,'perform eps.review_credential(p_credential);','')))<>length('perform eps.review_credential(p_credential);')
  then raise exception'M06_EXACT25_CREDENTIAL_WRAPPER_SOURCE_REQUIRED';end if;
  definition:=replace(definition,'perform eps.review_credential(p_credential);','perform eps.review_credential(p_credential-''proof'');');
  if item.operation='create_review_link'then
   anchor:=E'perform eps.review_link_require(p_series_id,true);\n cached:=';
   replacement:=E'perform eps.review_link_require(p_series_id,true);\n perform eps.review_credential_admit(auth.uid(),''create_review_link'',p_series_id,p_input,p_idempotency_key,p_credential);\n cached:=';
  else
   anchor:=E'perform eps.review_link_require(item.series_id,true);\n cached:=';
   replacement:=E'perform eps.review_link_require(item.series_id,true);\n perform eps.review_credential_admit(auth.uid(),''rotate_review_link'',p_review_link_id,p_input,p_idempotency_key,p_credential);\n cached:=';
  end if;
  if(length(definition)-length(replace(definition,anchor,'')))<>length(anchor)then raise exception'M06_CREDENTIAL_AUTH_BEFORE_CACHE_ANCHOR_REQUIRED';end if;
  execute replace(definition,anchor,replacement);
 end loop;
end$forward$;
