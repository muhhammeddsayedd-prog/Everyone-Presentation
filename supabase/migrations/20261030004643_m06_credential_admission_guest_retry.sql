-- M06 additive guest credential/retry26 after exact reviewed25.
-- Disabled configuration, no private key/login, fixture, provider or hosting change.
set local search_path='';set local lock_timeout='3s';set local statement_timeout='30s';
do $m06_baseline$begin if current_user<>'postgres' or current_database()<>'postgres' or(select array_agg(version order by version)from supabase_migrations.schema_migrations)is distinct from array['20261028010943','20261028013324','20261028013655','20261028024205','20261028072515','20261028162702','20261028162800','20261028172320','20261028184145','20261028222030','20261029001520','20261029003941','20261029070038','20261029090500','20261029090724','20261029094600','20261029100500','20261029133455','20261029135318','20261029174841','20261029180953','20261029202629','20261029203953','20261029215218','20261030002634']::text[]then raise exception'M06_EXACT_REVIEWED25_REQUIRED';end if;end$m06_baseline$;

-- Exact candidate fragment: development/m06/credential-admission-forward.sql
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


-- Exact candidate fragment: development/m06/guest-export-retry-forward.sql
-- Forward-only M06 repair. A live review session may retry its own link's
-- FAILED fixed export through the existing prepare operation. No job identifier,
-- operations.retry capability, runtime operation, login or casting write is added.
grant select(id,review_link_id,link_token_generation,expires_at)on eps.guest_sessions to eps_review_stage_owner;
create policy export_retry_session_read on eps.guest_sessions for select to eps_review_stage_owner using(true);
create function eps.retry_guest_pdf_export(p_export_id uuid,p_link_id uuid,p_version_id uuid,p_session uuid default null)returns eps.presentation_exports
language plpgsql volatile security definer set search_path=''as $$
declare item eps.presentation_exports;job eps.jobs;link eps.review_links;actor uuid;at_value timestamptz;begin
 select * into item from eps.presentation_exports where id=p_export_id;
 if not found or item.review_link_id<>p_link_id or item.version_id<>p_version_id then perform eps.fail('RESOURCE_NOT_FOUND','This export is not available to the review link.',404);end if;
 -- Reentrant with prepare's workspace -> link -> export locks, then locks job.
 job:=eps.export_stage_lock(item.job_id,false);
 select * into item from eps.presentation_exports where id=p_export_id and job_id=job.id;
 select * into link from eps.review_links where id=item.review_link_id;
 if not eps.guest_link_live(link)then perform eps.fail('REVIEW_UNAVAILABLE','Review access is unavailable.',404);end if;
 if not link.download_enabled then perform eps.fail('DOWNLOAD_DISABLED','PDF downloads are disabled for this link.',403);end if;
 if p_session is not null then
  if not exists(select 1 from eps.guest_sessions s where s.id=p_session and s.review_link_id=link.id and s.link_token_generation=link.token_generation and s.expires_at>clock_timestamp())then perform eps.fail('REVIEW_UNAVAILABLE','Review access is unavailable.',404);end if;
 else
  actor:=coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid;
  if not coalesce(eps.export_stage_can_write(actor,job.workspace_id),false)or not exists(select 1 from public.app_capability_grants g where g.principal_id=actor and g.capability='workspaces.write'and g.active)then perform eps.fail('RESOURCE_NOT_FOUND','This export is not available to the acting user.',404);end if;
 end if;
 if not eps.export_stage_can_write(job.requested_by,job.workspace_id)then perform eps.fail('PERMISSION_CHANGED','The link owner no longer has export authority.',403);end if;
 perform eps.specs_stage_assert(eps.export_stage_matches(job),'SNAPSHOT_INVALID');
 if job.status='cancelled'or job.cancel_requested_at is not null or job.error->>'code'='JOB_CANCELLED'then perform eps.fail('JOB_CANCELLED','This PDF export was cancelled.',409);end if;
 if item.status in('queued','rendering','ready')then return item;end if;
 if item.status<>'failed'or job.status<>'failed'or job.stage<>'render_export'then perform eps.fail('INVALID_TRANSITION','Only a failed PDF export may be retried.',409);end if;
 perform eps.specs_stage_assert(exists(select 1 from eps.presentation_processing_config where id and enabled),'DEPENDENCY_UNAVAILABLE');
 at_value:=clock_timestamp();
 update eps.review_media_grants set revoked_at=coalesce(revoked_at,at_value)where export_id=item.id and revoked_at is null;
 update eps.jobs set status='queued',stage_attempts=stage_attempts-'render_export',error=null,result=null,
  lease_token_digest=null,lease_expires_at=null,available_at=at_value,dispatch_generation=dispatch_generation+1,
  progress_completed=0,progress_total=null,row_version=row_version+1,updated_at=at_value where id=job.id returning * into job;
 insert into eps.outbox_events(job_id,stage,input_hash,dispatch_generation,dedupe_key,available_at)
 values(job.id,job.stage,job.input_hash,job.dispatch_generation,job.id::text||':'||job.dispatch_generation::text,job.available_at);
 select * into item from eps.presentation_exports where id=p_export_id;return item;
end$$;
grant create on schema eps to eps_review_stage_owner;
alter function eps.retry_guest_pdf_export(uuid,uuid,uuid,uuid)owner to eps_review_stage_owner;
revoke create on schema eps from eps_review_stage_owner;
revoke all on function eps.retry_guest_pdf_export(uuid,uuid,uuid,uuid)from public,anon,authenticated,service_role;
grant execute on function eps.retry_guest_pdf_export(uuid,uuid,uuid,uuid)to eps_guest_owner;
do $$declare source text;definition text;patched text;begin
 select replace(prosrc,E'\r\n',E'\n'),replace(pg_get_functiondef(oid),E'\r\n',E'\n')into source,definition from pg_proc where oid='eps.guest_prepare_export(uuid,uuid,text,uuid)'::regprocedure;
 if encode(sha256(convert_to(source,'UTF8')),'hex')<>'783d54b66d38a6e33279722a19459e68427bb6a12c198678dff3870ba39c02db'then raise exception'M06_EXACT25_GUEST_EXPORT_PREPARE_REQUIRED';end if;
 patched:=replace(source,E' if found then\n  if existing.status=''ready''',E' if found then\n  if existing.status=''failed''then existing:=eps.retry_guest_pdf_export(existing.id,link.id,version.id,p_session);end if;\n  if existing.status=''ready''');
 if patched=source then raise exception'M06_GUEST_EXPORT_RETRY_ANCHOR_REQUIRED';end if;
 execute replace(definition,source,patched);
end$$;

