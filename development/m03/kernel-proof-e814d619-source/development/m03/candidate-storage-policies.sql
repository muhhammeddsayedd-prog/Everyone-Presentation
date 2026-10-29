-- Compose after candidate user helpers and service capability helper.
-- Exact operation, object, requester and current lease gates compose with all
-- existing policies; no bucket list/HEAD/update/delete authority is introduced.
create policy eps_candidate_service_read on storage.objects for select to anon using(
 bucket_id in('eps-candidate-assets','eps-candidate-outputs') and
 (storage.allow_only_operation('object.get_authenticated') or storage.allow_only_operation('object.get_authenticated_info'))
 and eps.candidate_capability_allowed(bucket_id,name,'read'));
create policy eps_candidate_service_write on storage.objects for insert to anon with check(
 bucket_id='eps-candidate-outputs' and storage.allow_only_operation('object.upload') and eps.candidate_capability_allowed(bucket_id,name,'write'));
create policy eps_candidate_insert_guard on storage.objects as restrictive for insert to public with check(
 bucket_id not in('eps-candidate-assets','eps-candidate-outputs')
 or bucket_id='eps-candidate-assets' and (storage.allow_only_operation('object.upload') or storage.allow_only_operation('object.sign_upload_url')) and eps.candidate_storage_insert_allowed(bucket_id,name)
 or bucket_id='eps-candidate-outputs' and storage.allow_only_operation('object.upload') and eps.candidate_capability_allowed(bucket_id,name,'write'));
create policy eps_candidate_read_guard on storage.objects as restrictive for select to public using(
 bucket_id not in('eps-candidate-assets','eps-candidate-outputs')
 or (storage.allow_only_operation('object.get_authenticated') or storage.allow_only_operation('object.get_authenticated_info'))
  and (eps.candidate_storage_read_allowed(bucket_id,name) or eps.candidate_capability_allowed(bucket_id,name,'read'))
 or storage.allow_only_operation('object.sign') and eps.candidate_storage_read_allowed(bucket_id,name));
create policy eps_candidate_update_guard on storage.objects as restrictive for update to public using(bucket_id not in('eps-candidate-assets','eps-candidate-outputs')) with check(bucket_id not in('eps-candidate-assets','eps-candidate-outputs'));
create policy eps_candidate_delete_guard on storage.objects as restrictive for delete to public using(bucket_id not in('eps-candidate-assets','eps-candidate-outputs'));
-- A restrictive policy may evaluate these predicates as anon even when its
-- authenticated branch is false; predicates explicitly reject null auth.uid.
grant execute on function eps.candidate_storage_insert_allowed(text,text),eps.candidate_storage_read_allowed(text,text) to anon;
