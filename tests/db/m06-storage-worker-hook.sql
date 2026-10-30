-- Injected by the NEW runner at the exact existing M05 successful leased
-- output-read checkpoint; original M05 fixture bytes are never changed.
execute'set local role postgres';
insert into storage.objects(bucket_id,name)values(grant_value->>'bucket',grant_value->>'object_key')on conflict(bucket_id,name)do nothing;
execute'set local role anon';
perform set_config('storage.operation','object.get_authenticated',true);
perform set_config('request.headers',jsonb_build_object('x-eps-asset-grant',grant_value->>'grant_token')::text,true);
if(select count(*)from storage.objects where bucket_id=grant_value->>'bucket'and name=grant_value->>'object_key')<>1 then raise exception'M06_STORAGE_EXISTING_WORKER_READ_BLOCKED';end if;
perform set_config('eps.m06.rls.worker_checks',(coalesce(nullif(current_setting('eps.m06.rls.worker_checks',true),''),'0')::integer+1)::text,true);
execute'set local role eps_jobs_executor';
