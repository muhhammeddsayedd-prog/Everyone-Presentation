-- Synthetic SQL metadata only, always inside the harness-owned rolled-back tx.
do $fixture$begin
 if current_setting('eps.local_fixture_tests',true)is distinct from'eps-presentation-canonical-pg17-local'
 or exists(select 1 from eps.jobs where id='9a5ddb61-6a9a-4157-b6be-8653cf2eadef')
 or exists(select 1 from public.clients where id='f4a9937c-f575-4975-bdea-fb83b85e48c3')
 or exists(select 1 from auth.users where id in('d5e00000-0000-4000-8000-000000000001','d5e00000-0000-4000-8000-000000000002'))
 then raise exception'OWNED_EMPTY_SYNTHETIC_GRANT_SCOPE_REQUIRED';end if;
end$fixture$;
insert into auth.users(id,email_confirmed_at,last_sign_in_at,is_anonymous)values
 ('d5e00000-0000-4000-8000-000000000001',clock_timestamp(),clock_timestamp(),false),
 ('d5e00000-0000-4000-8000-000000000002',clock_timestamp(),clock_timestamp(),false);
insert into public.clients(id,name)values('f4a9937c-f575-4975-bdea-fb83b85e48c3','Synthetic isolated grant client');
insert into public.projects(id,client_id,name)values
 ('4b70c8ce-18bd-4a8c-b5a9-bc1156c06463','f4a9937c-f575-4975-bdea-fb83b85e48c3','Synthetic first grant project'),
 ('bd14d10f-b1c5-4d6a-8b4d-e5c48208433c','f4a9937c-f575-4975-bdea-fb83b85e48c3','Synthetic second grant project');
insert into eps.workspaces(id,project_id)values('e470aefd-e0f7-480c-bf0d-170cb2cb7069','bd14d10f-b1c5-4d6a-8b4d-e5c48208433c');
insert into public.project_memberships(project_id,principal_id,can_write)values
 ('4b70c8ce-18bd-4a8c-b5a9-bc1156c06463','d5e00000-0000-4000-8000-000000000001',true),
 ('bd14d10f-b1c5-4d6a-8b4d-e5c48208433c','d5e00000-0000-4000-8000-000000000001',true);
insert into public.client_memberships(client_id,principal_id,can_write)values('f4a9937c-f575-4975-bdea-fb83b85e48c3','d5e00000-0000-4000-8000-000000000001',true);
insert into public.app_capability_grants(principal_id,capability)
 select'd5e00000-0000-4000-8000-000000000001'::uuid,c from unnest(array['projects.read','projects.write','workspaces.read','workspaces.write','cast.read','cast.upload','cast.write','cast.review','presentations.generate'])c;
-- An unrelated principal's existing generation grant must remain byte-identical.
insert into public.app_capability_grants(principal_id,capability)values('d5e00000-0000-4000-8000-000000000002','review_links.manage');
insert into eps.media_assets(id,origin_workspace_id,purpose,filename,mime_type,bucket,object_key,size_bytes,sha256,width,height,duration_ms,status)
 values('5f8a6d53-0da0-4064-aacf-aea6b9c47c81','e470aefd-e0f7-480c-bf0d-170cb2cb7069','candidate_video','synthetic.mp4','video/mp4',
 'eps-candidate-assets','assets/5f8a6d53-0da0-4064-aacf-aea6b9c47c81/original.mp4',4316429,'ffe461d30d48b32d90f1165627e2d104b6817f61d96a5a4bd9dcd6ff1964fc0a',853,480,20000,'ready');
insert into eps.jobs(id,workspace_id,requested_by,kind,resource_id,input_asset_id,input,input_hash,input_hash_version,dedupe_key,status,stage,correlation_id)
 values('9a5ddb61-6a9a-4157-b6be-8653cf2eadef','e470aefd-e0f7-480c-bf0d-170cb2cb7069','d5e00000-0000-4000-8000-000000000001','candidate_scan',
 'd5e00000-0000-4000-8000-000000000003','5f8a6d53-0da0-4064-aacf-aea6b9c47c81',
 '{"workspace_id":"e470aefd-e0f7-480c-bf0d-170cb2cb7069","project_id":"bd14d10f-b1c5-4d6a-8b4d-e5c48208433c"}',repeat('a',64),'eps.candidate-input.pg-jsonb.v1',repeat('b',64),'succeeded','apply_candidate','synthetic-generation-grant');
lock table public.app_capability_grants in share row exclusive mode;
create function pg_temp.reject_review_links(label text,setup text,expected text)returns text language plpgsql as $reject$
declare observed text;before_rows jsonb;after_rows jsonb;begin
 begin
  execute setup;
  select coalesce(jsonb_agg(to_jsonb(g)order by principal_id,capability),'[]')into before_rows from public.app_capability_grants g;
  begin execute current_setting('eps.producer_review_links26.test_body');exception when others then observed:=sqlstate||':'||sqlerrm;end;
  if observed is null or not(position(expected in observed)>0)then raise exception'SYNTHETIC_GRANT_WRONG_DENIAL';end if;
  select coalesce(jsonb_agg(to_jsonb(g)order by principal_id,capability),'[]')into after_rows from public.app_capability_grants g;
  if before_rows is distinct from after_rows then raise exception'SYNTHETIC_GRANT_DENIAL_MUTATED_ROWS';end if;
  raise exception'SYNTHETIC_GRANT_CASE_ROLLBACK';
 exception when raise_exception then if sqlerrm<>'SYNTHETIC_GRANT_CASE_ROLLBACK'then raise;end if;end;
 return label;
end$reject$;
select pg_temp.reject_review_links('unconfirmed','update auth.users set email_confirmed_at=null where id=''d5e00000-0000-4000-8000-000000000001''','PRODUCER_REVIEW_LINKS26_EXISTING_AUTHORITY_REQUIRED');
select pg_temp.reject_review_links('never_signed_in','update auth.users set last_sign_in_at=null where id=''d5e00000-0000-4000-8000-000000000001''','PRODUCER_REVIEW_LINKS26_EXISTING_AUTHORITY_REQUIRED');
select pg_temp.reject_review_links('anonymous','update auth.users set is_anonymous=true where id=''d5e00000-0000-4000-8000-000000000001''','PRODUCER_REVIEW_LINKS26_EXISTING_AUTHORITY_REQUIRED');
select pg_temp.reject_review_links('deleted','update auth.users set deleted_at=clock_timestamp()where id=''d5e00000-0000-4000-8000-000000000001''','PRODUCER_REVIEW_LINKS26_EXISTING_AUTHORITY_REQUIRED');
select pg_temp.reject_review_links('banned','update auth.users set banned_until=clock_timestamp()+interval''1day''where id=''d5e00000-0000-4000-8000-000000000001''','PRODUCER_REVIEW_LINKS26_EXISTING_AUTHORITY_REQUIRED');
select pg_temp.reject_review_links('revoked_membership','update public.project_memberships set active=false where principal_id=''d5e00000-0000-4000-8000-000000000001''and project_id=''bd14d10f-b1c5-4d6a-8b4d-e5c48208433c''','PRODUCER_REVIEW_LINKS26_EXISTING_AUTHORITY_REQUIRED');
select pg_temp.reject_review_links('read_only_membership','update public.project_memberships set can_write=false where principal_id=''d5e00000-0000-4000-8000-000000000001''and project_id=''4b70c8ce-18bd-4a8c-b5a9-bc1156c06463''','PRODUCER_REVIEW_LINKS26_EXISTING_AUTHORITY_REQUIRED');
select pg_temp.reject_review_links('missing_membership','delete from public.project_memberships where principal_id=''d5e00000-0000-4000-8000-000000000001''and project_id=''bd14d10f-b1c5-4d6a-8b4d-e5c48208433c''','PRODUCER_REVIEW_LINKS26_EXISTING_AUTHORITY_REQUIRED');
select pg_temp.reject_review_links('revoked_cast_authority','update public.app_capability_grants set active=false where principal_id=''d5e00000-0000-4000-8000-000000000001''and capability=''cast.review''','PRODUCER_REVIEW_LINKS26_EXISTING_AUTHORITY_REQUIRED');
select pg_temp.reject_review_links('missing_workspace_authority','delete from public.app_capability_grants where principal_id=''d5e00000-0000-4000-8000-000000000001''and capability=''workspaces.write''','PRODUCER_REVIEW_LINKS26_EXISTING_AUTHORITY_REQUIRED');
select pg_temp.reject_review_links('archived_first_project','update public.projects set archived_at=clock_timestamp()where id=''4b70c8ce-18bd-4a8c-b5a9-bc1156c06463''','PRODUCER_REVIEW_LINKS26_EXISTING_AUTHORITY_REQUIRED');
select pg_temp.reject_review_links('archived_workspace','update eps.workspaces set archived_at=clock_timestamp()where id=''e470aefd-e0f7-480c-bf0d-170cb2cb7069''','P0002');
select pg_temp.reject_review_links('wrong_source_hash','update eps.media_assets set sha256=repeat(''f'',64)where id=''5f8a6d53-0da0-4064-aacf-aea6b9c47c81''','P0002');
select pg_temp.reject_review_links('unfinished_source_job','update eps.jobs set status=''failed''where id=''9a5ddb61-6a9a-4157-b6be-8653cf2eadef''','P0002');
select pg_temp.reject_review_links('already_active','insert into public.app_capability_grants(principal_id,capability,active)values(''d5e00000-0000-4000-8000-000000000001'',''review_links.manage'',true)','PRODUCER_REVIEW_LINKS26_EXISTING_GRANT_PRESERVED');
select pg_temp.reject_review_links('already_inactive','insert into public.app_capability_grants(principal_id,capability,active)values(''d5e00000-0000-4000-8000-000000000001'',''review_links.manage'',false)','PRODUCER_REVIEW_LINKS26_EXISTING_GRANT_PRESERVED');

select pg_temp.reject_review_links('revoked_generation_authority','update public.app_capability_grants set active=false where principal_id=''d5e00000-0000-4000-8000-000000000001''and capability=''presentations.generate''','PRODUCER_REVIEW_LINKS26_EXISTING_AUTHORITY_REQUIRED');
select pg_temp.reject_review_links('missing_generation_authority','delete from public.app_capability_grants where principal_id=''d5e00000-0000-4000-8000-000000000001''and capability=''presentations.generate''','PRODUCER_REVIEW_LINKS26_EXISTING_AUTHORITY_REQUIRED');
